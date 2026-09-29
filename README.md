# RecMap

An explorer for AI-related recommendations in clinical practice guidelines, rendered through six audience-specific interfaces — a real Next.js app with real accounts, a real backend, and a real (if deliberately narrow-scope) chat assistant, not a static page.

## What's in this version

- **Accounts.** Email + password sign-up/login (`/signup`, `/login`), backed by Node's built-in `node:sqlite` — no external database, no npm install required, no third-party auth provider. Every page under `/ask`, `/map`, `/catalog`, `/history`, `/analytics`, `/upload`, `/about`, `/help` requires sign-in; unauthenticated requests redirect to `/login`. **There is no email-based password reset** — see `app/help` (`#accounts`) for why, and what it would take to add one.
- **Six audience lenses.** First sign-in routes to `/onboarding`, a 6-audience × 5-point Likert self-identification: point-of-care clinician, person with lived experience, policy/health-system decision-maker, researcher, guideline developer, and industry (pharma/device). The highest-rated becomes the account's saved audience. Every page then carries a lens bar naming the audience it is written for and the question that audience is asking, and any user can read the same record through any other lens without changing their account.

  A lens is not a theme. It decides **which sections of a recommendation appear and in what order**, the headings and vocabulary they appear under, the framing sentence above each recommendation, the summary chips on every catalog card, the Map's default view and sort, the standing caveat, and the guidance injected into `/ask`'s prompt (a lens preview changes the assistant's answer too, not just the page). What it never changes is the data underneath — a lens reorders, renames, translates and hides, but no lens invents a fact and no lens softens one.

  All of it is declared in **`lib/audienceLens.ts`** and nowhere else; adding a seventh audience means editing that file plus the `Persona` union in `lib/db.ts`. Notable lens-specific surfaces:
  - **Lived experience** — `lib/plainLanguage.ts` renders the record in plain words by fixed rules, not by a model call at read time: certainty in sentences rather than grades, GRADE's own patient-facing formulations for strength (it never uses the word "weak", and never turns a conditional recommendation into an instruction), an explicit answer on whether patients' views were sought (AGREE II item 5), provenance in place of a disclaimer, questions to take to a clinician generated from the record's own uncertainty, and the guideline's verbatim wording always one click away.
  - **Policy** — `components/PolicyPanel.tsx` hoists AGREE II items 18–21 (barriers, tools, resource implications, monitoring/auditing criteria) and AGREE-REX Implementability out of the bottom of Domain 5 and into a decision brief, flags the strong-recommendation-on-low-certainty combination, and states explicitly that a low item score means the *guideline* did not address it, not that the intervention is unaffordable or unmeasurable.
  - **Researcher / industry** — `components/EvidenceSignalsPanel.tsx` surfaces statement type, grading approach, currency, strength–certainty discordance, appraiser agreement, and other guidelines taking a different direction on the same area. The industry variant is deliberately an evidence-gap surface and holds **no person-level data**: no author or panellist names, no linkage of individuals to disclosures or funding, no ranking of organisations by persuadability. Conflict of interest appears only as AGREE II Domain 6, at the level of the guideline document.

- **`/ask`** — free-text chat, grounded only in the structured guideline catalog, never invented. Every answer that cites a guideline names both the organisation and the guideline title, links to the Map for the detailed AGREE/AGREE-REX breakdown, and carries two honesty flags: `in_scope` (RecMap says plainly when a question falls outside AI-in-clinical-guidelines) and `needs_human_review` (flagged whenever an answer required interpretation a person should double-check). Every answer gets a thumbs up/down.
- **`/map`** — guidelines compared visually by clinical area, AGREE II, AGREE-REX, GRADE certainty, and direction; heatmap/density/list views; defaults tailored to the signed-in user's persona.
- **`/catalog`** — the full catalog, filterable, one card per source document, expanding to every recommendation statement extracted from it with full AGREE II / AGREE-REX / GRADE / equity / coding detail.
- **`/history`** — every question a user has asked, most recent first, with the same scope/review flags and thumbs up/down available inline.
- **`/analytics`** ("Charts" in the nav) — self-serve histograms and summary charts over the catalog (AGREE II/AGREE-REX distributions, direction counts, certainty levels, guidelines per organisation, and more), rendered with a small hand-rolled SVG bar chart — no charting library is installed (none can be; see below).
- **`/upload`** — add a new guideline PDF; a full LLM pipeline extracts the recommendation, PICO, and metadata, then estimates AGREE II domain scores — clearly marked as LLM-estimated, never presented as a completed human appraisal.
- **`/help`** — the full instruction manual: accounts, every tab, how to read AGREE II vs. AGREE-REX vs. GRADE, the scope/human-review checkpoints, and why the app is built the way it is.
- **AGREE-REX.** Real, spreadsheet-sourced AGREE-REX appraisals (`scripts/migrate_agree_rex_real_data.py`, run once against the source workbook) for every guideline that clears the AGREE II quality gate (`lib/config.ts#AGREE_GATE_THRESHOLD_PCT`) — always disclosed as an AI-generated first-pass appraisal (two independent passes, items differing by 2+ points flagged for human review), never a validated substitute for trained human appraisers.

The 13 guidelines shipped in `data/guidelines.json` keep their original, human-derived AGREE II scores from the source workbooks (`public/data/excel/`) — the LLM never re-scores those. Only newly uploaded guidelines get LLM-estimated AGREE II scores, and that's disclosed everywhere they're shown.

## Setup

Requires **Node 22.5+** (for the built-in `node:sqlite` module the accounts/history store uses — see `lib/db.ts`) and an [Anthropic API key](https://console.anthropic.com/settings/keys).

```bash
npm install
cp .env.example .env.local
# edit .env.local and set ANTHROPIC_API_KEY=sk-ant-...
# optionally set SESSION_SECRET=<a long random string> — if you don't, one is
# generated on first run and saved to data/.session_secret (gitignored)
npm run dev
```

Open http://localhost:3000 — signed-out visitors land on `/login`; new users go through `/signup` then the one-time `/onboarding` persona questionnaire before reaching `/ask`.

`.env.local` is gitignored and read only on the server; the API key is never sent to the browser. Passwords are hashed (`scrypt`, salted) before storage — plain-text passwords are never written anywhere.

## Deploying

Any Next.js host with a **persistent, writable filesystem** works (a VM, or a container with a volume) — Vercel-style ephemeral serverless functions do not, for the reasons below. Three things to know before deploying:

- **Accounts, personas, and history live in a single SQLite file** at `data/app.db` (created automatically on first run). This is genuinely durable on a persistent filesystem, but it is not a multi-instance database — fine for one small deployment, wrong for a horizontally-scaled one. Swap `lib/db.ts` for a real hosted database before scaling out.
- **Uploaded guidelines are stored as JSON files** under the configured runtime data directory (`data/uploaded/` locally; Render's `/var/data/uploaded/`) and PDFs are stored beside them (`data/pdfs/` locally; Render's `/var/data/pdfs/`) — the PDF route serves them at `/data/pdfs/<filename>`.
- **`/api/upload` can run long** (a full LLM extraction pass over a large PDF). It's configured for a 120s route timeout (`maxDuration` in `app/api/upload/route.ts`); raise it, or your host's equivalent limit, if you expect longer documents.

**No email service is wired up.** Sign-up activates an account immediately (no verification email) and there's no "forgot password" flow. Adding either needs a transactional-email provider (Postmark, Resend, SES, ...) and an API key for it — the one piece of this app that genuinely can't be built without an external service, since the app can't send email on its own.

## Project layout

```
app/
  (authed)/layout.tsx              auth gate (Server Component — see note below) + NavBar + welcome note
  (authed)/onboarding/              persona self-identification, one-time
  (authed)/(main)/layout.tsx        persona gate (redirects to onboarding if unset)
  (authed)/(main)/ask/               chat
  (authed)/(main)/map/               visual comparison map
  (authed)/(main)/catalog/           full catalog
  (authed)/(main)/history/           per-user question/answer history + feedback
  (authed)/(main)/analytics/         self-serve charts
  (authed)/(main)/upload/            add a guideline
  (authed)/(main)/help/              instruction manual
  (authed)/(main)/about/             pipeline & methodology
  login/  signup/                   auth pages (outside the authed group)
  api/auth/...                      signup, login, logout, persona, welcome-seen
  api/chat/route.ts                 real Claude call, grounded in the structured catalog, persists to History
  api/history/...                   list history, set feedback
  api/upload/route.ts               full LLM pipeline: PDF text -> extraction + AGREE II appraisal
  api/guidelines/route.ts           serves the merged catalog (shipped + uploaded)
lib/
  types.ts                shared data model (incl. AGREE-REX, chat response contract)
  data.ts                 loads/merges/persists guidelines
  db.ts                   node:sqlite-backed accounts/history/feedback store
  auth.ts                 password hashing + signed session tokens
  currentUser.ts          server-side "who is this request" helper
  config.ts               AGREE gate threshold, search-cadence dates, video-walkthrough URL
  anthropic.ts             Anthropic client + JSON-mode helper
  chatPrompt.ts            the /ask grounding + scope/citation/persona prompt
  uploadPipeline.ts        the /upload extraction + AGREE II scoring prompt & logic
  agreeInstrument.ts       the fixed 23-item AGREE II instrument text
  agreeRexInstrument.ts    the 9-item AGREE-REX instrument text
components/               shared UI (nav, cards, AGREE II/AGREE-REX breakdowns, a tiny markdown renderer)
data/guidelines.json       the 13 shipped guidelines, human-appraised AGREE II + real AGREE-REX where eligible
data/uploaded/             guidelines added via Upload (created at runtime)
data/app.db                accounts/history/feedback (created at runtime, gitignored)
public/data/pdfs/          source PDFs (13 shipped + any uploaded), linked from the UI
public/data/excel/         the original AGREE II / recommendation / AGREE-REX workbooks, for reference/download
scripts/migrate_agree_rex_real_data.py   one-time script that populated data/guidelines.json's real AGREE-REX data
```

### Deploying on Render

The repository includes `render.yaml` for a Node 22 web service with a persistent disk. Create the service from the GitHub repository and enter `ANTHROPIC_API_KEY` in Render's Environment settings as a secret value. Render generates `SESSION_SECRET` and mounts persistent runtime data at `/var/data`. Uploads are disabled by default; enable `NEXT_PUBLIC_UPLOAD_FEATURE_ENABLED` only when you intend to accept PDFs and keep the persistent disk attached.

**Why a Server Component layout instead of `middleware.ts`:** Next's Edge Middleware runtime can't reliably use Node's `crypto`/`fs` modules, which the accounts system needs for password hashing and `node:sqlite`. `app/(authed)/layout.tsx` gates access instead — it runs in the standard Node.js runtime, same as every Route Handler, so there's no Edge-compatibility risk to design around.

## A note on how this was verified

This project was written in a sandboxed environment without npm registry access, so `npm install` / `next build` / `next dev` could not be run here. Verification instead relied on: reading every edited/created file back in full, a brace/paren/bracket-balance sanity check across every `.ts`/`.tsx` file in the project, cross-file grep checks for signature/shape consistency (e.g. that every caller of a changed function passes the arguments it now expects), and standalone `node -e` smoke-tests of logic later written into TypeScript (the `node:sqlite` schema/CRUD calls, HMAC session-token signing) before it was relied on. **Run `npm run build` as your own first step after `npm install`** — it's the one check that couldn't be done here, and the most likely place to catch anything this process missed.
