import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionToken } from "./auth";
import { getUserById, type UserRecord } from "./db";

/** Server-side only (Server Components, Route Handlers) — reads the signed
 *  session cookie and resolves it to a real user row, or null if there is
 *  no valid session. app/(authed)/layout.tsx already redirects
 *  unauthenticated page requests to /login (a Server Component layout, not
 *  Edge middleware — see its comment for why), but any Server Component or
 *  route handler that needs to know WHICH user is asking (history, persona,
 *  chat logging) calls this directly rather than re-deriving it from the
 *  request. */
export function getCurrentUser(): UserRecord | null {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  const uid = verifySessionToken(token);
  if (!uid) return null;
  return getUserById(uid);
}
