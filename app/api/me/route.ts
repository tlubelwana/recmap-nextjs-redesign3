import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/currentUser";

export const runtime = "nodejs";

/** What the logged-in client needs to know about itself: email, persona
 *  (for tailoring Map/Ask), and whether the welcome note has been dismissed
 *  yet. Returns 401 with user: null when there's no valid session — pages
 *  that need a user rely on app/(authed)/layout.tsx to have already
 *  redirected, but client components fetching this directly still need to
 *  handle it. */
export async function GET() {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({
    user: { email: user.email, persona: user.persona, welcomeSeen: user.welcomeSeen },
  });
}
