"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import AudienceLensBar from "@/components/AudienceLensBar";
import TrustCards from "@/components/TrustCards";
import CitedCard from "@/components/CitedCard";
import { useAudienceLens } from "@/components/LensProvider";
import DivergencePanel from "@/components/DivergencePanel";
import Markdown from "@/components/Markdown";
import { directionVisual } from "@/components/format";
import { getLens } from "@/lib/audienceLens";
import type { DivergenceAnalysis, Guideline } from "@/lib/types";

interface Turn {
  id: string;
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
  errorMessage?: string;
  guidelineIds?: string[];
  followUpSuggestions?: string[];
  divergence?: DivergenceAnalysis;
  retryQuery?: string;
  retryHistory?: { role: "user" | "assistant"; content: string }[];
  historyId?: string;
  inScope?: boolean;
  needsHumanReview?: boolean;
  feedback?: "up" | "down" | null;
}

const TRY_PROMPTS = [
  "Should I use AI for colorectal cancer screening?",
  "Which guidelines support AI in breast imaging?",
  "Where do guidelines disagree on AI in dermatology?",
];

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `turn-${idCounter}`;
}

export default function AskPage() {
  const { lens } = useAudienceLens();
  const viewingAudience = { label: lens.label, question: lens.question };

  // Read through a ref inside the send handler: the request must carry the
  // lens that was active when the question was asked, and the handler is
  // created once rather than on every lens change.
  const lensKeyRef = useRef(lens.key);
  useEffect(() => {
    lensKeyRef.current = lens.key;
  }, [lens]);

  const [guidelines, setGuidelines] = useState<Guideline[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, setPending] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const threadEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/guidelines")
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        return res.json() as Promise<{ guidelines: Guideline[] }>;
      })
      .then((data) => {
        if (!cancelled) setGuidelines(data.guidelines);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setCatalogError(err instanceof Error ? err.message : "Failed to load the catalog.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns.length]);

  // Restore saved Ask state on mount
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("recmap-ask-state");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.turns) && parsed.turns.length > 0) {
          const restoredTurns: Turn[] = parsed.turns.map((t: Turn) => ({
            ...t,
            pending: false,
          }));
          setTurns(restoredTurns);
        }
        if (typeof parsed.inputValue === "string") {
          setInputValue(parsed.inputValue);
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Persist Ask state whenever turns or inputValue changes
  const isAskMounted = useRef(false);
  useEffect(() => {
    if (!isAskMounted.current) {
      isAskMounted.current = true;
      return;
    }
    try {
      if (turns.length > 0 || inputValue) {
        window.localStorage.setItem("recmap-ask-state", JSON.stringify({ turns, inputValue }));
      } else {
        window.localStorage.removeItem("recmap-ask-state");
      }
    } catch {
      /* ignore */
    }
  }, [turns, inputValue]);

  function guidelineById(id: string): Guideline | undefined {
    return guidelines.find((g) => g.id === id);
  }

  function resetAskView() {
    setTurns([]);
    setInputValue("");
    try {
      window.localStorage.removeItem("recmap-ask-state");
    } catch {
      /* ignore */
    }
  }

  async function runRequest(
    query: string,
    history: { role: "user" | "assistant"; content: string }[],
    assistantId: string
  ) {
    setPending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, history, lens: lensKeyRef.current }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || `Request failed (${res.status})`);
      }
      setTurns((prev) =>
        prev.map((t) =>
          t.id === assistantId
            ? {
                ...t,
                pending: false,
                errorMessage: undefined,
                content: data.answerMarkdown ?? "",
                guidelineIds: Array.isArray(data.guidelineIds) ? data.guidelineIds : [],
                followUpSuggestions: Array.isArray(data.followUpSuggestions) ? data.followUpSuggestions : [],
                divergence: data.divergence,
                historyId: data.historyId,
                inScope: data.inScope !== false,
                needsHumanReview: Boolean(data.needsHumanReview),
                feedback: null,
              }
            : t
        )
      );
      if (Array.isArray(data.guidelineIds) && data.guidelineIds.length > 0) {
        window.localStorage.setItem(
          "recmap-last-map-context",
          JSON.stringify({ query, ids: data.guidelineIds })
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setTurns((prev) => prev.map((t) => (t.id === assistantId ? { ...t, pending: false, errorMessage: message } : t)));
    } finally {
      setPending(false);
    }
  }

  function ask(query: string) {
    const trimmed = query.trim();
    if (!trimmed || pending) return;

    const history = turns.filter((t) => !t.errorMessage).map((t) => ({ role: t.role, content: t.content }));
    const userTurn: Turn = { id: nextId(), role: "user", content: trimmed };
    const assistantId = nextId();
    const assistantTurn: Turn = {
      id: assistantId,
      role: "assistant",
      content: "",
      pending: true,
      retryQuery: trimmed,
      retryHistory: history,
    };

    setTurns((prev) => [...prev, userTurn, assistantTurn]);
    setInputValue("");
    runRequest(trimmed, history, assistantId);
  }

  function retry(turn: Turn) {
    if (pending || !turn.retryQuery) return;
    setTurns((prev) => prev.map((t) => (t.id === turn.id ? { ...t, pending: true, errorMessage: undefined } : t)));
    runRequest(turn.retryQuery, turn.retryHistory ?? [], turn.id);
  }

  async function giveFeedback(turn: Turn, value: "up" | "down") {
    if (!turn.historyId) return;
    const next = turn.feedback === value ? null : value; // click again to undo
    setTurns((prev) => prev.map((t) => (t.id === turn.id ? { ...t, feedback: next } : t)));
    try {
      const res = await fetch(`/api/history/${encodeURIComponent(turn.historyId)}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setTurns((prev) => prev.map((t) => (t.id === turn.id ? { ...t, feedback: turn.feedback } : t)));
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    ask(inputValue);
  }

  const started = turns.length > 0;
  const latest = turns[turns.length - 1];
  const latestAnswer: Turn | null =
    latest && latest.role === "assistant" && !latest.pending && !latest.errorMessage ? latest : null;
  const citedGuidelines = latestAnswer
    ? (latestAnswer.guidelineIds ?? []).map(guidelineById).filter((g): g is Guideline => Boolean(g))
    : [];
  const directionCounts = citedGuidelines.reduce<Record<string, number>>((acc, g) => {
    const key = directionVisual(g.direction);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  /** ?q= + ?ids= for the current answer, shared by the follow-through links. */
  const answerScopeParams = `q=${encodeURIComponent(latestAnswer?.retryQuery ?? "")}&ids=${citedGuidelines
    .map((g) => encodeURIComponent(g.id))
    .join(",")}`;

  const avgAgree =
    citedGuidelines.length > 0
      ? citedGuidelines.reduce((sum, g) => sum + g.agree.overall7, 0) / citedGuidelines.length
      : null;

  return (
    <div>
      <AudienceLensBar compact />
      {!started && (
        <div className="ask-hero">
          <div className="ask-hero-inner">
            <span className="eyebrow">AI in clinical practice</span>
            <h1 className="ask-h1 wordmark">Ask about an AI-based recommendation</h1>
            <p className="ask-sub">
              Get answers from every relevant guideline. Each one is quality-checked with AGREE&nbsp;II and kept
              current, and answers are written for <b>{viewingAudience.label}</b>: “{viewingAudience.question}”
            </p>

            <form className="searchbar" onSubmit={onSubmit}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Should I use AI for colorectal cancer screening?"
                autoComplete="off"
              />
              <button type="submit" className="btn-primary" disabled={!inputValue.trim()}>
                Ask
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" />
                  <path d="M13 6l6 6-6 6" />
                </svg>
              </button>
            </form>

            <div className="try-block">
              <div className="try-label">Try asking</div>
              <div className="chip-row">
                {TRY_PROMPTS.map((p) => (
                  <button key={p} type="button" className="chip-btn" onClick={() => ask(p)}>
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="stats-line">
              <span>
                <b>{guidelines.length || "—"}</b> guidelines
              </span>
              <span>&bull;</span>
              <span>
                <b>{guidelines.length ? new Set(guidelines.map((g) => g.organization)).size : "—"}</b> organisations
              </span>
              <span>&bull;</span>
              <span>all AGREE&nbsp;II appraised</span>
            </div>
            <Link href="/catalog" className="catalog-link">
              Or browse the full catalog →
            </Link>
            {catalogError && (
              <p className="ask-empty-note" style={{ marginTop: 14 }}>
                Couldn&rsquo;t load the catalog summary ({catalogError}) — you can still ask a question.
              </p>
            )}
          </div>
          <TrustCards />
        </div>
      )}

      {started && (
        <div className="ask-results">
          <div className="qbar">
            <button type="button" className="btn-ghost" onClick={resetAskView}>
              Ask another question
            </button>
          </div>

          <div className="chat-thread">
            {turns.map((t) => (
              <div className={`chat-msg ${t.role}`} key={t.id}>
                {t.role === "user" && <div className="chat-bubble">{t.content}</div>}
                {t.role === "assistant" && t.pending && (
                  <span className="thinking">
                    Thinking
                    <span className="thinking-dots">
                      <i />
                      <i />
                      <i />
                    </span>
                  </span>
                )}
                {t.role === "assistant" && !t.pending && t.errorMessage && (
                  <div className="chat-bubble error-bubble">
                    Couldn&rsquo;t reach Claude: {t.errorMessage}
                    <div className="error-actions">
                      <button type="button" className="chip-btn" onClick={() => retry(t)} disabled={pending}>
                        Retry
                      </button>
                      <button type="button" className="btn-primary summary-back" onClick={resetAskView}>
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#ffffff"
                          strokeWidth="2.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M19 12H5" />
                          <path d="m11 18-6-6 6-6" />
                        </svg>
                        Back to Ask
                      </button>
                    </div>
                  </div>
                )}
                {t.role === "assistant" && !t.pending && !t.errorMessage && (
                  <div className="chat-bubble answer-panel">
                    <div className="summary-heading">
                      <div className="summary-title">
                        <span className="summary-disc" aria-hidden="true">
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M20.5 12.2c0 4-3.8 7.2-8.5 7.2a10 10 0 0 1-2.6-.34L4.2 20.7l1.3-3.7a6.8 6.8 0 0 1-2-4.8C3.5 8.2 7.3 5 12 5s8.5 3.2 8.5 7.2Z" />
                            <path d="M8.4 12.2h.01M12 12.2h.01M15.6 12.2h.01" strokeWidth="2.6" />
                          </svg>
                        </span>
                        <h2>Plain-language summary</h2>
                      </div>
                      <button
                        type="button"
                        className="btn-primary summary-back"
                        onClick={resetAskView}
                        aria-label="Back to the first Ask view"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#ffffff"
                          strokeWidth="2.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M19 12H5" />
                          <path d="m11 18-6-6 6-6" />
                        </svg>
                        Back to Ask
                      </button>
                    </div>
                    {t.inScope === false && (
                      <div className="scope-note">
                        <b>Outside RecMap&rsquo;s scope.</b> RecMap only covers AI-related recommendations in
                        clinical practice guidelines and how to interpret their appraisal — see below for why this
                        question isn&rsquo;t something it can reliably answer.
                      </div>
                    )}
                    <Markdown text={t.content} />
                    {t.needsHumanReview && (
                      <div className="review-note">
                        ⚠ This answer required interpretation beyond raw catalog facts — a human should verify it
                        before relying on it for a real decision.
                      </div>
                    )}
                    {t.historyId && (
                      <div className="feedback-buttons" style={{ marginTop: 12 }}>
                        <span className="glance-label">Was this answer helpful?</span>
                        <button
                          type="button"
                          className={`feedback-btn ${t.feedback === "up" ? "active" : ""}`}
                          onClick={() => giveFeedback(t, "up")}
                          aria-pressed={t.feedback === "up"}
                          aria-label="Thumbs up"
                        >
                          👍
                        </button>
                        <button
                          type="button"
                          className={`feedback-btn ${t.feedback === "down" ? "active" : ""}`}
                          onClick={() => giveFeedback(t, "down")}
                          aria-pressed={t.feedback === "down"}
                          aria-label="Thumbs down"
                        >
                          👎
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            <div ref={threadEndRef} />
          </div>

          {latestAnswer && (
            <div className={`ask-content${citedGuidelines.length > 0 ? "" : " no-rail"}`}>
              <div className="ask-main">
                {citedGuidelines.length > 0 ? (
                  <>
                    <h2 className="ref-section-h">Guidelines referenced</h2>
                    <div className="rec-list">
                      {citedGuidelines.map((g) => (
                        <CitedCard key={g.id} guideline={g} />
                      ))}
                    </div>
                    {/* Carry the question and its cited records into the
                        rest of the workflow, so Contextualise and Implement
                        open on these guidelines rather than the whole
                        catalog. Same ?q= + ?ids= shape the Map accepts. */}
                    <div className="ask-followthrough">
                      <Link href={`/map?${answerScopeParams}`} className="catalog-link">
                        Explore these guidelines →
                      </Link>
                      <Link href={`/contextualisation?${answerScopeParams}`} className="catalog-link">
                        Do these transfer to my setting? →
                      </Link>
                      <Link href={`/implementation?${answerScopeParams}`} className="catalog-link">
                        What would implementing them take? →
                      </Link>
                      <Link href={`/reports?${answerScopeParams}`} className="catalog-link">
                        Generate a report →
                      </Link>
                    </div>
                  </>
                ) : (
                  <p className="ask-empty-note">
                    This answer didn&rsquo;t cite a specific guideline from the catalog.
                  </p>
                )}
              </div>
              {citedGuidelines.length > 0 && (
                <div className="ask-rail">
                  <div className="side-card">
                    <div className="eyebrow">At a glance</div>
                    <p className="glance-label">Cited guidelines</p>
                    <div className="glance-value">{citedGuidelines.length}</div>
                    {(["for", "against", "neutral"] as const).map((dir) =>
                      directionCounts[dir] ? (
                        <div className="glance-dir-row" key={dir}>
                          <span className={`pill dir-${dir}`}>
                            {dir === "for" ? "In favour" : dir === "against" ? "Against" : "Neutral / mixed"}
                          </span>
                          <span>{directionCounts[dir]}</span>
                        </div>
                      ) : null
                    )}
                    {avgAgree !== null && (
                      <p className="glance-label" style={{ marginTop: 14 }}>
                        Average AGREE&nbsp;II · <b style={{ color: "var(--ink-800)" }}>{avgAgree.toFixed(1)}/7</b>
                      </p>
                    )}
                  </div>
                </div>
              )}

              {citedGuidelines.length > 0 && latestAnswer.divergence && (
                <DivergencePanel divergence={latestAnswer.divergence} guidelineById={guidelineById} />
              )}

              {latestAnswer.followUpSuggestions && latestAnswer.followUpSuggestions.length > 0 && (
                <div className="chat-suggestions ask-span">
                  {latestAnswer.followUpSuggestions.map((s) => (
                    <button key={s} type="button" className="chip-btn" onClick={() => ask(s)} disabled={pending}>
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {catalogError && (
            <div className="state-block error">
              <p>Couldn&rsquo;t load the guideline catalog ({catalogError}) — citations above may be incomplete.</p>
            </div>
          )}

          <form className="chat-composer" onSubmit={onSubmit}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20V4" />
              <path d="M5 11l7-7 7 7" />
            </svg>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask a follow-up…"
              autoComplete="off"
              disabled={pending}
            />
            <button type="submit" className="btn-primary" disabled={pending || !inputValue.trim()}>
              Ask
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
