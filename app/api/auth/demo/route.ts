import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { DEMO_MODE } from "@/lib/config";
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS, hashPassword } from "@/lib/auth";
import { createUserRecord, getUserByEmail, setUserPersonas } from "@/lib/db";

export const runtime = "nodejs";

const DEMO_EMAIL = "demo@recmap.local";
const DEMO_PERSONA = "point_of_care_clinician" as const;

export async function POST() {
  if (!DEMO_MODE) return NextResponse.json({ error: "Demo access is disabled." }, { status: 404 });

  try {
    let user = getUserByEmail(DEMO_EMAIL);
    if (!user) {
      const { hash, salt } = hashPassword(crypto.randomUUID());
      user = createUserRecord({
        id: crypto.randomUUID(),
        email: DEMO_EMAIL,
        passwordHash: hash,
        passwordSalt: salt,
      });
    }
    setUserPersonas(user.id, [DEMO_PERSONA]);

    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE_NAME, createSessionToken(user.id), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: SESSION_MAX_AGE_SECONDS,
      path: "/",
    });
    return res;
  } catch (error) {
    console.error("[auth/demo] failed", error);
    return NextResponse.json({ error: "Demo access could not be started." }, { status: 500 });
  }
}