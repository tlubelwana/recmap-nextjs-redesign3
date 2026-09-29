import fs from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";
import { DATA_DIR } from "./storage";

/**
 * RecMap's account/history/feedback store.
 *
 * There is no external database server or managed database here — the app
 * previously had no backend storage at all beyond the read-only
 * data/guidelines.json catalog. This uses Node's OWN built-in `node:sqlite`
 * module (stable-ish since Node 22.5, still flagged "experimental" by
 * Node itself as of this writing) as a real, file-backed, queryable
 * database with zero new npm packages — which matters because the
 * environment this was built in has no npm registry access at all, so a
 * conventional database driver (pg, mysql2, better-sqlite3, ...) could not
 * be installed even if one were wanted.
 *
 * Honest limitations, spelled out once here rather than scattered in
 * comments elsewhere:
 *  - This is a single SQLite file (data/app.db). It's genuinely durable and
 *    genuinely queryable, but it is NOT a multi-server production database —
 *    fine for one small deployment, wrong for a multi-instance one.
 *  - There is no email service wired up anywhere in this app. Signup
 *    activates an account immediately (no verification email), and there is
 *    no "forgot password" flow — see app/help for what to do instead.
 *  - Requires Node 22.5+ to run at all (see package.json "engines" and
 *    lib/nodeSqlite.d.ts's comment on why).
 */

const DB_PATH = path.join(DATA_DIR, "app.db");

let db: DatabaseSync | null = null;

function getDb(): DatabaseSync {
  if (db) return db;
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  db = new DatabaseSync(DB_PATH);
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      persona TEXT,
      selected_personas TEXT,
      welcome_seen INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS history (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      query TEXT NOT NULL,
      answer_markdown TEXT NOT NULL,
      guideline_ids TEXT NOT NULL,
      in_scope INTEGER NOT NULL DEFAULT 1,
      needs_human_review INTEGER NOT NULL DEFAULT 0,
      feedback TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_history_user ON history(user_id, created_at DESC);
  `);
  try {
    db.exec("ALTER TABLE users ADD COLUMN selected_personas TEXT");
  } catch {
    // Existing databases already have the column.
  }
  return db;
}

// --- Users -----------------------------------------------------------------

/** The six audiences RecMap builds a distinct interface for. Each one's
 *  behaviour — what the detail view shows and in what order, the vocabulary,
 *  the framing sentence, Map/Catalog defaults, the standing caveat, and the
 *  guidance injected into the Ask prompt — is defined in lib/audienceLens.ts
 *  and nowhere else. Adding an audience means editing this union plus that
 *  file. Persisted as a string in users.persona, so the stored values are the
 *  literal keys below and must not be renamed without a migration. */
export type Persona =
  | "point_of_care_clinician"
  | "lived_experience"
  | "policy_maker"
  | "researcher"
  | "guideline_developer"
  | "industry";

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  persona: Persona | null;
  selectedPersonas: Persona[];
  welcomeSeen: boolean;
  createdAt: string;
}

function rowToUser(row: Record<string, unknown>): UserRecord {
  const persona = (row.persona as Persona | null) ?? null;
  let selectedPersonas: Persona[] = persona ? [persona] : [];
  if (typeof row.selected_personas === "string") {
    try {
      const parsed = JSON.parse(row.selected_personas);
      if (Array.isArray(parsed)) selectedPersonas = parsed.filter((value): value is Persona => typeof value === "string");
    } catch {
      // Fall back to the legacy primary persona.
    }
  }
  return {
    id: String(row.id),
    email: String(row.email),
    passwordHash: String(row.password_hash),
    passwordSalt: String(row.password_salt),
    persona,
    selectedPersonas,
    welcomeSeen: Boolean(row.welcome_seen),
    createdAt: String(row.created_at),
  };
}

export function getUserByEmail(email: string): UserRecord | null {
  const row = getDb().prepare("SELECT * FROM users WHERE email = ?").get(email.trim().toLowerCase());
  return row ? rowToUser(row) : null;
}

export function getUserById(id: string): UserRecord | null {
  const row = getDb().prepare("SELECT * FROM users WHERE id = ?").get(id);
  return row ? rowToUser(row) : null;
}

export function createUserRecord(params: {
  id: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
}): UserRecord {
  const createdAt = new Date().toISOString();
  getDb()
    .prepare(
      "INSERT INTO users (id, email, password_hash, password_salt, persona, welcome_seen, created_at) VALUES (?, ?, ?, ?, NULL, 0, ?)"
    )
    .run(params.id, params.email.trim().toLowerCase(), params.passwordHash, params.passwordSalt, createdAt);
  return {
    id: params.id,
    email: params.email.trim().toLowerCase(),
    passwordHash: params.passwordHash,
    passwordSalt: params.passwordSalt,
    persona: null,
    selectedPersonas: [],
    welcomeSeen: false,
    createdAt,
  };
}

export function setUserPersona(userId: string, persona: Persona): void {
  getDb().prepare("UPDATE users SET persona = ? WHERE id = ?").run(persona, userId);
}

export function setUserPersonas(userId: string, personas: Persona[]): void {
  if (personas.length === 0) return;
  getDb()
    .prepare("UPDATE users SET persona = ?, selected_personas = ? WHERE id = ?")
    .run(personas[0], JSON.stringify(personas), userId);
}

export function markWelcomeSeen(userId: string): void {
  getDb().prepare("UPDATE users SET welcome_seen = 1 WHERE id = ?").run(userId);
}

// --- History / feedback ------------------------------------------------------

export interface HistoryEntry {
  id: string;
  userId: string;
  query: string;
  answerMarkdown: string;
  guidelineIds: string[];
  inScope: boolean;
  needsHumanReview: boolean;
  feedback: "up" | "down" | null;
  createdAt: string;
}

function rowToHistory(row: Record<string, unknown>): HistoryEntry {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    query: String(row.query),
    answerMarkdown: String(row.answer_markdown),
    guidelineIds: JSON.parse(String(row.guideline_ids)) as string[],
    inScope: Boolean(row.in_scope),
    needsHumanReview: Boolean(row.needs_human_review),
    feedback: (row.feedback as "up" | "down" | null) ?? null,
    createdAt: String(row.created_at),
  };
}

export function addHistoryEntry(params: {
  id: string;
  userId: string;
  query: string;
  answerMarkdown: string;
  guidelineIds: string[];
  inScope: boolean;
  needsHumanReview: boolean;
}): HistoryEntry {
  const createdAt = new Date().toISOString();
  getDb()
    .prepare(
      "INSERT INTO history (id, user_id, query, answer_markdown, guideline_ids, in_scope, needs_human_review, feedback, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)"
    )
    .run(
      params.id,
      params.userId,
      params.query,
      params.answerMarkdown,
      JSON.stringify(params.guidelineIds),
      params.inScope ? 1 : 0,
      params.needsHumanReview ? 1 : 0,
      createdAt
    );
  return {
    id: params.id,
    userId: params.userId,
    query: params.query,
    answerMarkdown: params.answerMarkdown,
    guidelineIds: params.guidelineIds,
    inScope: params.inScope,
    needsHumanReview: params.needsHumanReview,
    feedback: null,
    createdAt,
  };
}

export function listHistoryForUser(userId: string, limit = 200): HistoryEntry[] {
  const rows = getDb()
    .prepare("SELECT * FROM history WHERE user_id = ? ORDER BY created_at DESC LIMIT ?")
    .all(userId, limit);
  return rows.map(rowToHistory);
}

export function clearHistoryForUser(userId: string): number {
  const info = getDb().prepare("DELETE FROM history WHERE user_id = ?").run(userId);
  return Number(info.changes);
}

/** Returns true if a row matching this id+user was actually updated — the
 *  caller should treat false as "not found / not yours", not a silent
 *  no-op success. */
export function setHistoryFeedback(historyId: string, userId: string, feedback: "up" | "down" | null): boolean {
  const info = getDb()
    .prepare("UPDATE history SET feedback = ? WHERE id = ? AND user_id = ?")
    .run(feedback, historyId, userId);
  return Number(info.changes) > 0;
}
