import { NextResponse } from "next/server";
import { getAllGuidelines, getGuidelineGroups } from "@/lib/data";
import { getCurrentUser } from "@/lib/currentUser";

export const runtime = "nodejs";

export async function GET() {
  if (!getCurrentUser()) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  // `guidelines` stays the flat per-recommendation list (used by Map/Ask,
  // and for resolving older ?guideline=<recommendation id> deep links);
  // `groups` is the one-card-per-source-document view the Catalog renders.
  // Grouping logic lives once in lib/data.ts#getGuidelineGroups — not
  // duplicated here or on the client.
  return NextResponse.json({ guidelines: getAllGuidelines(), groups: getGuidelineGroups() });
}
