import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/currentUser";
import { listHistoryForUser } from "@/lib/db";

export const runtime = "nodejs";

/** Powers the History tab — every question this user has asked, most
 *  recent first, with enough on each row to re-render the answer, show its
 *  scope/review flags, and reflect any thumbs up/down already given. */
export async function GET() {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const entries = listHistoryForUser(user.id).map((e) => ({
    id: e.id,
    query: e.query,
    answerMarkdown: e.answerMarkdown,
    guidelineIds: e.guidelineIds,
    inScope: e.inScope,
    needsHumanReview: e.needsHumanReview,
    feedback: e.feedback,
    createdAt: e.createdAt,
  }));

  return NextResponse.json({ entries });
}
