"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Markdown from "@/components/Markdown";
import { formatDate } from "@/components/format";

interface HistoryEntry {
  id: string;
  query: string;
  answerMarkdown: string;
  guidelineIds: string[];
  inScope: boolean;
  needsHumanReview: boolean;
  feedback: "up" | "down" | null;
  createdAt: string;
}

/** "Make history tab so users can track what they are doing" — every
 *  question asked in Ask, most recent first, with the same scope/review
 *  flags and thumbs up/down feedback available inline (feedback here is the
 *  same POST /api/history/[id]/feedback used from the Ask page, so acting
 *  on an answer once is enough regardless of which tab it was given in). */
export default function HistoryPage() {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [pendingFeedback, setPendingFeedback] = useState<Set<string>>(new Set());
  const [clearing, setClearing] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/history")
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        return res.json() as Promise<{ entries: HistoryEntry[] }>;
      })
      .then((data) => {
        if (!cancelled) setEntries(data.entries);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load history.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function giveFeedback(entry: HistoryEntry, value: "up" | "down") {
    if (pendingFeedback.has(entry.id)) return;
    const next = entry.feedback === value ? null : value; // click again to undo
    setPendingFeedback((prev) => new Set(prev).add(entry.id));
    setEntries((prev) => prev?.map((e) => (e.id === entry.id ? { ...e, feedback: next } : e)) ?? prev);
    try {
      const res = await fetch(`/api/history/${encodeURIComponent(entry.id)}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // Roll back on failure — silent retry isn't worth the complexity here.
      setEntries((prev) => prev?.map((e) => (e.id === entry.id ? { ...e, feedback: entry.feedback } : e)) ?? prev);
    } finally {
      setPendingFeedback((prev) => {
        const next2 = new Set(prev);
        next2.delete(entry.id);
        return next2;
      });
    }
  }

  async function clearHistory() {
    if (clearing || !entries?.length) return;
    if (!window.confirm("Clear all of your saved history? This cannot be undone.")) return;
    setClearing(true);
    setClearError(null);
    try {
      const res = await fetch("/api/history/clear", { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json())?.error || "Couldn’t clear history.");
      setEntries([]);
      setExpanded(new Set());
    } catch (err) {
      setClearError(err instanceof Error ? err.message : "Couldn’t clear history.");
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="history-wrap">
      <div className="history-head">
        <span className="eyebrow">Your activity</span>
        <h1 className="wordmark">History</h1>
        <p className="history-dek">Every question you&rsquo;ve asked in Ask, most recent first.</p>
        <button type="button" className="btn-primary history-clear" onClick={clearHistory} disabled={clearing || !entries?.length}>
          {clearing ? "Clearing…" : "Clear history"}
        </button>
      </div>

      {error && (
        <div className="state-block error">
          <p>Couldn&rsquo;t load your history ({error}).</p>
        </div>
      )}
      {clearError && <div className="state-block error"><p>{clearError}</p></div>}

      {!error && entries === null && <div className="state-block">Loading…</div>}

      {entries && entries.length === 0 && (
        <div className="state-block">
          <p>
            No questions yet. <Link href="/ask">Go ask one</Link> — it&rsquo;ll show up here.
          </p>
        </div>
      )}

      {entries && entries.length > 0 && (
        <div className="history-list">
          {entries.map((e) => {
            const isOpen = expanded.has(e.id);
            return (
              <div className="history-row" key={e.id}>
                <button type="button" className="history-row-head" onClick={() => toggle(e.id)}>
                  <div className="history-row-main">
                    <div className="history-query">{e.query}</div>
                    <div className="history-meta">
                      {formatDate(e.createdAt)}
                      {!e.inScope && <span className="pill dir-against">Out of scope</span>}
                      {e.needsHumanReview && <span className="pill dir-neutral">Needs human review</span>}
                      {e.guidelineIds.length > 0 && (
                        <span className="history-cite-count">
                          {e.guidelineIds.length} guideline{e.guidelineIds.length === 1 ? "" : "s"} cited
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="history-chevron">{isOpen ? "▲" : "▼"}</span>
                </button>
                {isOpen && (
                  <div className="history-row-body">
                    <Markdown text={e.answerMarkdown} />
                    <div className="history-actions">
                      {e.guidelineIds.length > 0 && (
                        <Link
                          href={`/map?ids=${e.guidelineIds.map(encodeURIComponent).join(",")}`}
                          className="chip-btn"
                        >
                          See on map →
                        </Link>
                      )}
                      <div className="feedback-buttons">
                        <span className="glance-label">Was this answer helpful?</span>
                        <button
                          type="button"
                          className={`feedback-btn ${e.feedback === "up" ? "active" : ""}`}
                          onClick={() => giveFeedback(e, "up")}
                          aria-pressed={e.feedback === "up"}
                          aria-label="Thumbs up"
                        >
                          👍
                        </button>
                        <button
                          type="button"
                          className={`feedback-btn ${e.feedback === "down" ? "active" : ""}`}
                          onClick={() => giveFeedback(e, "down")}
                          aria-pressed={e.feedback === "down"}
                          aria-label="Thumbs down"
                        >
                          👎
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <style jsx global>{`
        .history-wrap {
          padding: 28px 24px 60px;
          max-width: 780px;
          margin: 0 auto;
        }
        .history-head {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding-bottom: 20px;
          border-bottom: 1px solid var(--line-100);
          margin-bottom: 24px;
        }
        .history-head h1 {
          margin: 0;
          font-size: 26px;
          font-weight: 700;
          color: var(--ink-900);
          line-height: 1.25;
        }
        .history-dek {
          margin: 0;
          font-size: 14px;
          line-height: 1.6;
          color: var(--ink-600);
        }
        .history-clear {
          align-self: flex-start;
          margin-top: 2px;
          padding: 8px 13px;
          font-size: 12px;
        }
        .history-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 18px;
        }
        .history-row {
          border: 1px solid var(--line-200);
          border-radius: 12px;
          background: var(--bg);
          overflow: hidden;
        }
        .history-row-head {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          background: none;
          border: none;
          cursor: pointer;
          text-align: left;
          padding: 14px 16px;
        }
        .history-query {
          font-weight: 600;
          font-size: 14px;
          color: var(--ink-800);
        }
        .history-meta {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 6px;
          font-size: 11.5px;
          color: var(--ink-500);
        }
        .history-cite-count {
          font-weight: 600;
        }
        .history-chevron {
          flex-shrink: 0;
          color: var(--ink-500);
          font-size: 11px;
        }
        .history-row-body {
          padding: 0 16px 16px;
          border-top: 1px solid var(--line-200);
          padding-top: 14px;
        }
        .history-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 14px;
        }
      `}</style>
    </div>
  );
}
