import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/currentUser";
import { markWelcomeSeen } from "@/lib/db";

export const runtime = "nodejs";

export async function POST() {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  markWelcomeSeen(user.id);
  return NextResponse.json({ ok: true });
}
