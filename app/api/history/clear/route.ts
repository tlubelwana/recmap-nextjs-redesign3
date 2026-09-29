import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/currentUser";
import { clearHistoryForUser } from "@/lib/db";

export const runtime = "nodejs";

export async function DELETE() {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const deleted = clearHistoryForUser(user.id);
  return NextResponse.json({ deleted });
}