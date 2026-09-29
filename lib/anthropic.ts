import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

/** Lazily constructed so a missing key fails at call time (with a clear
 *  error the API routes turn into a 500 + message) rather than at import
 *  time / build time. */
export function getAnthropicClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Copy .env.example to .env.local and add your key."
    );
  }
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

export const CHAT_MODEL = "claude-sonnet-4-5-20250929";
export const EXTRACTION_MODEL = "claude-sonnet-4-5-20250929";

/** Calls Claude with a prompt that must end in a single JSON object (no
 *  markdown fences, no commentary) and parses it. Throws if the model's
 *  reply isn't valid JSON — callers decide how to surface that. */
export async function askClaudeForJson<T>(params: {
  system: string;
  prompt: string;
  model?: string;
  maxTokens?: number;
}): Promise<T> {
  const anthropic = getAnthropicClient();
  const message = await anthropic.messages.create({
    model: params.model ?? CHAT_MODEL,
    max_tokens: params.maxTokens ?? 2000,
    system: params.system,
    messages: [{ role: "user", content: params.prompt }],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  const raw = (textBlock && "text" in textBlock ? textBlock.text : "") ?? "";

  // The model is instructed to return only JSON, but strip code fences
  // defensively in case it wraps the reply anyway.
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "");

  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    throw new Error(
      `Claude did not return valid JSON: ${(err as Error).message}\n---\n${raw.slice(0, 500)}`
    );
  }
}
