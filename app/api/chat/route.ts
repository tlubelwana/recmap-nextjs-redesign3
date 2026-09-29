import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { askClaudeForJson } from "@/lib/anthropic";
import { buildChatPrompt, DIVERGENCE_CATEGORIES, type ChatJsonResponse } from "@/lib/chatPrompt";
import { getAllGuidelines } from "@/lib/data";
import { getCurrentUser } from "@/lib/currentUser";
import { isPersona } from "@/lib/audienceLens";
import { addHistoryEntry } from "@/lib/db";
import type { ChatRequestBody, ChatResponseBody, DivergenceAnalysis, DivergenceReasonCategory } from "@/lib/types";

const DIVERGENCE_CATEGORY_KEYS = new Set(DIVERGENCE_CATEGORIES.map((c) => c.key));
const DIVERGENCE_CATEGORY_LABELS = new Map(DIVERGENCE_CATEGORIES.map((c) => [c.key, c.label]));

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const query = (body.query ?? "").trim();
  if (!query) {
    return NextResponse.json({ error: "query is required." }, { status: 400 });
  }
  const history = Array.isArray(body.history) ? body.history : [];

  // A reader previewing another audience's lens gets that audience's answer:
  // the switcher would be misleading if the page reframed itself but the
  // assistant kept answering as the saved persona. Unrecognised values fall
  // back to the account's own persona rather than erroring.
  const activeLens = isPersona(body.lens) ? body.lens : user.persona;

  const { system, prompt } = buildChatPrompt(query, history, activeLens);

  let result: ChatJsonResponse;
  try {
    result = await askClaudeForJson<ChatJsonResponse>({ system, prompt, maxTokens: 1500 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error calling Claude.";
    // Distinguish a missing/invalid key so the UI can show something actionable.
    const status = message.includes("ANTHROPIC_API_KEY") ? 500 : 502;
    return NextResponse.json({ error: message }, { status });
  }

  if (!result.answer_markdown || typeof result.answer_markdown !== "string") {
    return NextResponse.json(
      { error: "Claude's reply didn't include an answer." },
      { status: 502 }
    );
  }

  const allIds = new Set(getAllGuidelines().map((g) => g.id));
  const guidelineIds = (result.guideline_ids ?? []).filter((id) => allIds.has(id));
  const followUpSuggestions = (result.follow_up_suggestions ?? [])
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .slice(0, 2);

  // Default open (in_scope: true, needs_human_review: false) rather than
  // treating a model omission as a hidden third state — see
  // lib/chatPrompt.ts's HONESTY CHECKPOINT / SCOPE instructions.
  const inScope = result.in_scope !== false;
  const needsHumanReview = result.needs_human_review === true;

  let divergence: DivergenceAnalysis | undefined;
  const rawDivergence = result.divergence;
  if (rawDivergence && typeof rawDivergence === "object") {
    const reasons = (rawDivergence.reasons ?? [])
      .filter((r) => r && typeof r.explanation === "string" && r.explanation.trim().length > 0)
      .map((r) => {
        const category: DivergenceReasonCategory = DIVERGENCE_CATEGORY_KEYS.has(
          r.category as DivergenceReasonCategory
        )
          ? (r.category as DivergenceReasonCategory)
          : "other";
        return {
          category,
          categoryLabel: DIVERGENCE_CATEGORY_LABELS.get(category) ?? "Other",
          explanation: r.explanation!.trim(),
          guidelineIds: (r.guideline_ids ?? []).filter((id) => allIds.has(id)),
        };
      });
    divergence = {
      hasDivergence: Boolean(rawDivergence.has_divergence) && reasons.length > 0,
      reasons,
    };
  }

  // Persist every exchange to History so the user can track what they asked,
  // give thumbs up/down feedback, and revisit past answers. Best-effort: a
  // storage hiccup shouldn't take down the answer the user is waiting on.
  let historyId: string | undefined;
  try {
    const entry = addHistoryEntry({
      id: randomUUID(),
      userId: user.id,
      query,
      answerMarkdown: result.answer_markdown,
      guidelineIds,
      inScope,
      needsHumanReview,
    });
    historyId = entry.id;
  } catch {
    // Non-fatal — the answer still gets returned even if it couldn't be logged.
  }

  const response: ChatResponseBody = {
    answerMarkdown: result.answer_markdown,
    guidelineIds,
    followUpSuggestions,
    inScope,
    needsHumanReview,
    ...(divergence ? { divergence } : {}),
    ...(historyId ? { historyId } : {}),
  };
  return NextResponse.json(response);
}
