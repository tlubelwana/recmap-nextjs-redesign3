"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAudienceLens } from "@/components/LensProvider";
import type { ChatResponseBody } from "@/lib/types";

/**
 * Ties Contextualise and Implement back to a question asked in Ask.
 *
 * Both pages used to open on the whole catalog, which asks the clinician
 * to answer "does this transfer to my setting?" for thirteen guidelines at
 * once — including ones with no bearing on what they came to find out.
 * Scoping to a question turns that into the decision they actually face:
 * these three guidelines answer my question, can I use them here?
 *
 * Scope arrives three ways: a `?q=` + `?ids=` link from an Ask answer (the
 * same shape the Map already accepts); the dropdown, which lists questions
 * this user has already asked; or typing a new question here, which runs
 * the same grounded /api/chat call Ask makes and scopes to whatever it
 * cites. All three resolve to a set of recommendation ids; "All guidelines"
 * clears it.
 */

export interface QuestionScope {
  query: string | null;
  ids: Set<string> | null;
}

export interface HistoryOption {
  id: string;
  query: string;
  guidelineIds: string[];
  createdAt: string;
}

export function useQuestionScope(): {
  scope: QuestionScope;
  setScope: (scope: QuestionScope) => void;
  history: HistoryOption[];
  historyError: string | null;
} {
  const searchParams = useSearchParams();
  const [scope, setScope] = useState<QuestionScope>({ query: null, ids: null });
  const [history, setHistory] = useState<HistoryOption[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [readUrl, setReadUrl] = useState(false);

  const updateScope = (newScope: QuestionScope) => {
    setScope(newScope);
    try {
      if (newScope.query || (newScope.ids && newScope.ids.size > 0)) {
        window.localStorage.setItem(
          "recmap-last-map-context",
          JSON.stringify({
            query: newScope.query,
            ids: newScope.ids ? Array.from(newScope.ids) : [],
          })
        );
      } else {
        window.localStorage.removeItem("recmap-last-map-context");
      }
    } catch {
      /* ignore */
    }
  };

  // Read the deep link or localStorage context once, so later manual changes aren't overwritten.
  useEffect(() => {
    if (readUrl) return;
    const q = searchParams.get("q");
    const idsParam = searchParams.get("ids");
    const ids = idsParam
      ? new Set(idsParam.split(",").map((s) => decodeURIComponent(s.trim())).filter(Boolean))
      : null;
    if (q || ids) {
      updateScope({ query: q, ids });
    } else {
      try {
        const saved = JSON.parse(window.localStorage.getItem("recmap-last-map-context") ?? "null") as {
          query?: string;
          ids?: string[];
        } | null;
        if (saved && (saved.query || (saved.ids && saved.ids.length > 0))) {
          setScope({
            query: saved.query ?? null,
            ids: saved.ids && saved.ids.length > 0 ? new Set(saved.ids) : null,
          });
        }
      } catch {
        /* ignore */
      }
    }
    setReadUrl(true);
  }, [searchParams, readUrl]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/history")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`Request failed (${res.status})`))))
      .then((data: { entries: HistoryOption[] }) => {
        if (!cancelled) {
          setHistory(data.entries ?? []);
        }
      })
      .catch((err: unknown) => {
        // The dropdown is an aid, not a dependency — the page still works
        // on the whole catalog without it.
        if (!cancelled) setHistoryError(err instanceof Error ? err.message : "Couldn't load your questions.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { scope, setScope: updateScope, history, historyError };
}

export default function QuestionScopeBar({
  scope,
  setScope,
  history,
  historyError,
  matchedCount,
  totalCount,
  hint,
}: {
  scope: QuestionScope;
  setScope: (scope: QuestionScope) => void;
  history: HistoryOption[];
  historyError: string | null;
  matchedCount: number;
  totalCount: number;
  hint: string;
}) {
  const { lens } = useAudienceLens();
  const [draft, setDraft] = useState("");
  const [asking, setAsking] = useState(false);
  const [askNote, setAskNote] = useState<string | null>(null);
  const scoped = Boolean(scope.ids && scope.ids.size > 0);

  /**
   * Ask a new question without leaving the page. Uses the same /api/chat
   * call the Ask page makes — grounded in the catalog, lens-aware, and
   * subject to the same scope check — then scopes to whatever it cited.
   *
   * A question the catalog can't answer, or one that cites nothing, does
   * NOT scope to an empty set: silently showing zero guidelines would read
   * as "no guidance exists", when what happened is that RecMap couldn't
   * match the question. It says so instead and leaves the scope alone.
   */
  async function askNew(event: React.FormEvent) {
    event.preventDefault();
    const query = draft.trim();
    if (!query || asking) return;
    setAsking(true);
    setAskNote(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, history: [], lens: lens.key }),
      });
      const data = (await res.json()) as ChatResponseBody & { error?: string };
      if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
      if (data.inScope === false) {
        setAskNote(
          "That question falls outside what RecMap covers — AI-related recommendations in clinical guidelines — so nothing was scoped."
        );
        return;
      }
      const ids = (data.guidelineIds ?? []).filter(Boolean);
      if (ids.length === 0) {
        setAskNote(
          "No guideline in the catalog was cited for that question. Nothing was scoped — try rephrasing, or browse all guidelines."
        );
        return;
      }
      setScope({ query, ids: new Set(ids) });
      setDraft("");
    } catch (err: unknown) {
      setAskNote(err instanceof Error ? err.message : "Couldn't ask that question.");
    } finally {
      setAsking(false);
    }
  }
  const selectValue = scoped
    ? history.find((h) => h.query === scope.query)?.id ?? "__deeplink"
    : "";

  return (
    <div className="qscope">
      <label className="qscope-pick">
        <span>Question</span>
        <select
          value={selectValue}
          onChange={(e) => {
            const id = e.target.value;
            if (!id) {
              setScope({ query: null, ids: null });
              return;
            }
            const entry = history.find((h) => h.id === id);
            if (entry) setScope({ query: entry.query, ids: new Set(entry.guidelineIds) });
          }}
        >
          <option value="">All guidelines in the catalog</option>
          {selectValue === "__deeplink" && scope.query && (
            <option value="__deeplink">{scope.query}</option>
          )}
          {history.length > 0 && (
            <optgroup label="Questions you've asked">
              {history.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.query.length > 80 ? `${h.query.slice(0, 78)}…` : h.query}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </label>

      <form className="qscope-ask" onSubmit={askNew}>
        <label>
          <span>Or ask a new one</span>
          <div className="qscope-ask-row">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Should we use AI-assisted colonoscopy for screening?"
              aria-label="Ask a new question"
              autoComplete="off"
              disabled={asking}
            />
            <button type="submit" className="btn-primary" disabled={!draft.trim() || asking}>
              {asking ? "Asking…" : "Ask"}
            </button>
          </div>
        </label>
      </form>

      <div className="qscope-state">
        {askNote && <span className="qscope-note">{askNote}</span>}
        {scoped ? (
          <>
            <span className="qscope-chip">
              Scoped to <b>{matchedCount}</b> of {totalCount} guideline{totalCount === 1 ? "" : "s"} — the ones
              that answer this question
            </span>
            <Link
              href={`/reports?q=${encodeURIComponent(scope.query ?? "")}&ids=${Array.from(scope.ids ?? [])
                .map((id) => encodeURIComponent(id))
                .join(",")}`}
              className="qscope-report"
            >
              Generate a report on this →
            </Link>
            <button type="button" className="qscope-clear" onClick={() => setScope({ query: null, ids: null })}>
              Show all
            </button>
          </>
        ) : (
          <span className="qscope-hint">
            {hint} <Link href="/ask">Ask a question</Link> and come back, or pick one above.
          </span>
        )}
        {historyError && <span className="qscope-hint">Couldn&rsquo;t load your past questions.</span>}
      </div>

      <style jsx global>{`
        /* Stacked, not side by side: the dropdown and the ask box are two
           ways to do the same thing, so they read as a sequence rather than
           two unrelated controls competing for the same row. */
        .qscope {
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: 14px;
          padding: 16px 18px;
          border: 1px solid var(--line-200);
          border-radius: var(--card-radius);
          background: var(--surface);
          margin-bottom: 18px;
        }
        .qscope-pick { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
        .qscope-pick span {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--ink-500);
        }
        .qscope-pick select {
          border: 1px solid var(--line-200);
          border-radius: 9px;
          padding: 9px 12px;
          font-size: 13px;
          background: var(--bg);
          color: var(--ink-800);
          width: 100%;
          max-width: 640px;
        }
        .qscope-ask { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
        .qscope-ask label > div { max-width: 640px; }
        .qscope-ask label { display: flex; flex-direction: column; gap: 5px; }
        .qscope-ask label > span {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--ink-500);
        }
        .qscope-ask-row { display: flex; gap: 8px; }
        .qscope-ask-row input {
          flex: 1;
          min-width: 0;
          border: 1px solid var(--line-200);
          border-radius: 9px;
          padding: 9px 12px;
          font-size: 13px;
          background: var(--bg);
          color: var(--ink-800);
          outline: none;
        }
        .qscope-ask-row input:focus {
          border-color: var(--accent-border);
          box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.1);
        }
        .qscope-ask-row .btn-primary {
          border-radius: 9px;
          padding: 9px 18px;
          font-size: 13px;
          flex-shrink: 0;
        }
        .qscope-note {
          font-size: 12.5px;
          line-height: 1.5;
          color: var(--accent-ink);
          background: var(--accent-bg);
          border: 1px solid var(--accent-border);
          border-radius: 9px;
          padding: 8px 12px;
          flex-basis: 100%;
        }
        .qscope-state {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .qscope-chip {
          font-size: 12.5px;
          font-weight: 600;
          color: var(--brand-ink);
          background: var(--accent-bg);
          border: 1px solid var(--accent-border);
          border-radius: 999px;
          padding: 7px 14px;
        }
        .qscope-report { font-size: 12.5px; font-weight: 700; }
        .qscope-clear {
          border: none;
          background: none;
          color: var(--brand-ink);
          font-size: 12.5px;
          font-weight: 700;
          cursor: pointer;
          padding: 0;
        }
        .qscope-clear:hover { text-decoration: underline; }
        .qscope-hint { font-size: 12.5px; color: var(--ink-500); }
        @media (max-width: 700px) {
          .qscope-ask label > div { max-width: none; }
        }
      `}</style>
    </div>
  );
}
