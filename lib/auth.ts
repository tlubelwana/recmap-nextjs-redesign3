import crypto from "crypto";
import fs from "fs";
import path from "path";

/**
 * Password hashing and session tokens, built entirely from Node's built-in
 * `crypto` module — no auth library (next-auth, bcrypt, jsonwebtoken, ...)
 * because the npm registry is unreachable from where this was built. This
 * is a real, working scheme (scrypt for passwords, HMAC-signed cookies for
 * sessions), sized for a small internal tool, not an audited enterprise
 * auth stack. See app/help for the account-security limitations this
 * implies (no password reset, no 2FA, no lockout after failed attempts).
 */

const SCRYPT_KEYLEN = 64;
const SESSION_COOKIE_NAME = "recmap_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const candidate = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
  const stored = Buffer.from(hash, "hex");
  if (candidate.length !== stored.length) return false;
  return crypto.timingSafeEqual(candidate, stored);
}

// --- Session secret ----------------------------------------------------
// Prefer an operator-set SESSION_SECRET env var (see .env.example). If none
// is set, generate one once and persist it to a local file so sessions
// survive a restart in a single-instance deployment — this is a reasonable
// default for a small internal tool, not something to rely on across a
// multi-instance production deployment.

const SECRET_FILE = path.join(process.cwd(), "data", ".session_secret");

function loadOrCreateSecret(): Buffer {
  const fromEnv = process.env.SESSION_SECRET;
  if (fromEnv && fromEnv.length >= 16) return Buffer.from(fromEnv, "utf-8");
  try {
    if (fs.existsSync(SECRET_FILE)) {
      return Buffer.from(fs.readFileSync(SECRET_FILE, "utf-8").trim(), "hex");
    }
  } catch {
    // fall through to generating a fresh one
  }
  const secret = crypto.randomBytes(32);
  try {
    const dir = path.dirname(SECRET_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(SECRET_FILE, secret.toString("hex"), { mode: 0o600 });
    // eslint-disable-next-line no-console
    console.warn(
      "[recmap] No SESSION_SECRET env var set — generated one and saved it to data/.session_secret. " +
        "Set SESSION_SECRET yourself before deploying anywhere real; see app/help."
    );
  } catch {
    // eslint-disable-next-line no-console
    console.warn("[recmap] No SESSION_SECRET env var set and couldn't persist a generated one — sessions will not survive a restart.");
  }
  return secret;
}

let cachedSecret: Buffer | null = null;
function getSecret(): Buffer {
  if (!cachedSecret) cachedSecret = loadOrCreateSecret();
  return cachedSecret;
}

interface SessionPayload {
  uid: string;
  exp: number;
}

export function createSessionToken(userId: string): string {
  const payload: SessionPayload = { uid: userId, exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000 };
  const body = Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url");
  const sig = crypto.createHmac("sha256", getSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

/** Returns the user id if the token is validly signed and unexpired, else null. */
export function verifySessionToken(token: string | undefined | null): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = crypto.createHmac("sha256", getSecret()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf-8")) as SessionPayload;
    if (typeof payload.exp !== "number" || Date.now() > payload.exp) return null;
    if (typeof payload.uid !== "string" || !payload.uid) return null;
    return payload.uid;
  } catch {
    return null;
  }
}

export function isValidEmail(email: string): boolean {
  // Deliberately simple — a real deliverability check needs an email
  // service this app doesn't have. Just enough to reject obvious typos.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS };
