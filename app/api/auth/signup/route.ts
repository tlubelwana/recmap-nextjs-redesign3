import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { hashPassword, isValidEmail, createSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@/lib/auth";
import { createUserRecord, getUserByEmail } from "@/lib/db";

export const runtime = "nodejs";

/**
 * Self-service signup. Creates the account and signs the person straight in
 * — there is no email service anywhere in this app, so there is no
 * verification step. This is a deliberate, documented trade-off (see
 * app/help), not an oversight.
 */
export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const email = (body.email ?? "").trim();
  const password = body.password ?? "";

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }
  if (getUserByEmail(email)) {
    return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
  }

  const { hash, salt } = hashPassword(password);
  const user = createUserRecord({ id: crypto.randomUUID(), email, passwordHash: hash, passwordSalt: salt });

  const token = createSessionToken(user.id);
  const res = NextResponse.json({ email: user.email, persona: user.persona });
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
  });
  return res;
}
