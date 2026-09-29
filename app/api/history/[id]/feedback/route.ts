import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/currentUser";
import { setHistoryFeedback } from "@/lib/db";

export const runtime = "nodejs";

const VALID = new Set(["up", "down", null]);

/** Thumbs up/down on one History row — "allow machine to learn from asked
 *  response" per the feature request. This doesn't retrain anything today
 *  (there's no model-training pipeline here), but it durably records which
 *  answers users judged good or bad, per query, so that signal exists to
 *  build on rather than being thrown away. Posting the SAME feedback again
 *  clears it (toggle), so a user can undo an accidental click. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: { feedback?: "up" | "down" | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const feedback = body.feedback ?? null;
  if (!VALID.has(feedback)) {
    return NextResponse.json({ error: 'feedback must be "up", "down", or null.' }, { status: 400 });
  }

  const ok = setHistoryFeedback(params.id, user.id, feedback);
  if (!ok) {
    return NextResponse.json({ error: "History entry not found." }, { status: 404 });
  }

  return NextResponse.json({ feedback });
}
