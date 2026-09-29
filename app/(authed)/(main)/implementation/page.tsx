"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import AudienceLensBar from "@/components/AudienceLensBar";
import QuestionScopeBar, { useQuestionScope } from "@/components/QuestionScope";
import { formatScore7, orgInitials, uniqueSorted } from "@/components/format";
import {
  AGREE_ITEM_BARRIERS,
  AGREE_ITEM_MONITORING,
  AGREE_ITEM_RESOURCE,
  AGREE_ITEM_TOOLS,
  findAgreeItem,
  itemVerdict,
} from "@/lib/audienceLens";
import { AGREE_GATE_THRESHOLD_PCT } from "@/lib/config";
import { PROGRESS_PLUS_DIMENSIONS } from "@/lib/types";
import type { AgreeItem, Guideline, GuidelineGroup } from "@/lib/types";

/**
 * Implementation — the DOING step, and the sibling of /contextualisation.
 * Contextualisation asks whether a guideline transfers to your setting at
 * all; this page assumes you've decided it does, and asks what the source
 * guideline actually gives you to work with.
 *
 * Three strands, all read from data already in the catalog:
 *   1. Applicability — AGREE II domain 5, items 18-21 (barriers and
 *      facilitators, tools, resource implications, monitoring criteria).
 *   2. Resources & feasibility — AGREE-REX Implementability and Clinical
 *      Applicability domains, where an appraisal exists.
 *   3. Equity — PROGRESS-Plus, from each record's EquityInfo.
 *
 * Nothing is generated or estimated here. Where a guideline never addressed
 * something, the page says so rather than filling the gap.
 */

const APPLICABILITY_ITEMS = [
  {
    num: AGREE_ITEM_BARRIERS,
    key: "barriers",
    label: "Barriers & facilitators",
    question: "Does the guideline say what will get in the way of using it — and what will help?",
  },
  {
    num: AGREE_ITEM_TOOLS,
    key: "tools",
    label: "Tools & advice",
    question: "Does it hand you anything usable — pathways, checklists, audit forms, patient materials?",
  },
  {
    num: AGREE_ITEM_RESOURCE,
    key: "resources",
    label: "Resource implications",
    question: "Does it cost out what applying the recommendations would take — staff, equipment, time, money?",
  },
  {
    num: AGREE_ITEM_MONITORING,
    key: "monitoring",
    label: "Monitoring & audit",
    question: "Does it define criteria you could measure yourself against after adopting it?",
  },
] as const;

type StrandKey = "applicability" | "resources" | "equity";

const STRANDS: { key: StrandKey; label: string; source: string; blurb: string }[] = [
  {
    key: "applicability",
    label: "Applicability",
    source: "AGREE II, domain 5 (items 18–21)",
    blurb:
      "What the guideline itself provides for putting its recommendations into practice. A guideline can be methodologically excellent and still leave you with nothing to implement.",
  },
  {
    key: "resources",
    label: "Resources & feasibility",
    source: "AGREE-REX, Implementability & Clinical Applicability domains",
    blurb:
      "Whether an individual recommendation is clear enough to act on and feasible to adopt locally. Only available for guidelines that cleared the AGREE II gate and have been appraised.",
  },
  {
    key: "equity",
    label: "Equity",
    source: "PROGRESS-Plus (O'Neill et al.)",
    blurb:
      "Whether the guideline considered differential impact across the PROGRESS-Plus dimensions. Where it didn't, that gap becomes yours to close during implementation.",
  },
];

function rexDomain(rec: Guideline, key: "implementability" | "clinical_applicability") {
  if (rec.agreeRex.status !== "appraised" || !rec.agreeRex.rex) return null;
  return rec.agreeRex.rex.domains.find((d) => d.key === key) ?? null;
}

interface Row {
  group: GuidelineGroup;
  items: { key: string; label: string; question: string; item: AgreeItem | null }[];
  applicability7: number;
  implementability: number | null;
  clinicalApplicability: number | null;
  rexStatus: Guideline["agreeRex"]["status"];
  equityEvaluated: boolean;
  equityDimensions: string[];
  equityNote: string;
}

function buildRow(group: GuidelineGroup): Row {
  const first = group.recommendations[0];
  const domain = group.agree.domains.find((d) => d.key === "applicability");
  const impl = rexDomain(first, "implementability");
  const clin = rexDomain(first, "clinical_applicability");
  return {
    group,
    items: APPLICABILITY_ITEMS.map((spec) => ({
      key: spec.key,
      label: spec.label,
      question: spec.question,
      item: findAgreeItem(group.agree, spec.num),
    })),
    applicability7: domain ? domain.score7 : 0,
    implementability: impl ? impl.score7 : null,
    clinicalApplicability: clin ? clin.score7 : null,
    rexStatus: first.agreeRex.status,
    equityEvaluated: first.equity.evaluated,
    equityDimensions: first.equity.dimensionsAddressed,
    equityNote: first.equity.note,
  };
}

function Meter({ score7 }: { score7: number }) {
  const pct = Math.max(0, Math.min(100, (score7 / 7) * 100));
  const verdict = itemVerdict(score7);
  return (
    <div className="impl-meter" role="img" aria-label={`${formatScore7(score7)} out of 7 — ${verdict.label}`}>
      <div className="impl-meter-track">
        <div className={`impl-meter-fill tone-${verdict.tone}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="impl-meter-value">{formatScore7(score7)}/7</span>
    </div>
  );
}

function ImplementationInner() {
  const [groups, setGroups] = useState<GuidelineGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [areaFilter, setAreaFilter] = useState("");
  const [strand, setStrand] = useState<StrandKey>("applicability");
  const [openId, setOpenId] = useState<string | null>(null);
  const { scope, setScope, history, historyError } = useQuestionScope();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/guidelines")
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        return res.json() as Promise<{ guidelines: Guideline[]; groups: GuidelineGroup[] }>;
      })
      .then((data) => {
        if (!cancelled) setGroups(data.groups);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load the catalog.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const areas = useMemo(() => (groups ? uniqueSorted(groups.map((g) => g.clinicalArea)) : []), [groups]);

  /** Groups holding at least one recommendation the question cited. */
  const inScope = useMemo(() => {
    if (!groups) return [];
    if (!scope.ids || scope.ids.size === 0) return groups;
    return groups.filter((g) => g.recommendations.some((r) => scope.ids!.has(r.id)));
  }, [groups, scope]);

  const rows = useMemo(() => {
    if (!groups) return [];
    return inScope
      .filter((g) => !areaFilter || g.clinicalArea === areaFilter)
      .map(buildRow)
      .sort((a, b) => b.applicability7 - a.applicability7);
  }, [groups, inScope, areaFilter]);

  /** Catalog-wide picture: how often each of the four applicability items is
   *  actually addressed. This is the number most readers want first — it says
   *  where guidance as a whole is thin, not just this one guideline. */
  const itemAverages = useMemo(() => {
    if (rows.length === 0) return [];
    return APPLICABILITY_ITEMS.map((spec) => {
      const scores = rows
        .map((r) => r.items.find((i) => i.key === spec.key)?.item?.score)
        .filter((s): s is number => typeof s === "number");
      const mean = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      const wellAddressed = scores.filter((s) => s > 5).length;
      return { key: spec.key, label: spec.label, mean, wellAddressed, n: scores.length };
    });
  }, [rows]);

  const equityTally = useMemo(() => {
    const evaluated = rows.filter((r) => r.equityEvaluated).length;
    return { evaluated, total: rows.length };
  }, [rows]);

  const rexTally = useMemo(() => {
    const appraised = rows.filter((r) => r.implementability !== null).length;
    return { appraised, total: rows.length };
  }, [rows]);

  const activeStrand = STRANDS.find((s) => s.key === strand)!;

  return (
    <div className="impl-wrap">
      <AudienceLensBar />

      <header className="impl-head">
        <span className="eyebrow">Implementation</span>
        <h1>What would it take to actually use this?</h1>
        <p className="impl-dek">
          Once you&rsquo;ve decided a guideline belongs in your setting, the next question is what the guideline gives
          you to work with — the barriers it names, the tools it hands over, the resources it costs out, the criteria you
          could audit yourself against, and who it might leave behind. Pick the question you asked and this page reads
          all of that out of appraisals already on file, for the guidelines that answer it. Deciding whether a guideline transfers at all is the{" "}
          <Link href="/contextualisation">Contextualise</Link> tab.
        </p>
      </header>

      {error && (
        <div className="state-block error">
          <p>Couldn&rsquo;t load the catalog ({error}).</p>
        </div>
      )}
      {!error && !groups && <div className="state-block">Loading catalog…</div>}

      {groups && (
        <>
          <QuestionScopeBar
            scope={scope}
            setScope={setScope}
            history={history}
            historyError={historyError}
            matchedCount={inScope.length}
            totalCount={groups.length}
            hint="Showing every guideline in the catalog."
          />

          <section className="impl-summary">
            <div className="impl-summary-head">
              <h2>Across {rows.length} guideline{rows.length === 1 ? "" : "s"} in view</h2>
              <p>
                Mean AGREE II item score, 1–7. Domain 5 is the weakest domain in most published guidelines — a low bar
                here is the norm, not an anomaly, and it is exactly the gap an implementation team inherits.
              </p>
            </div>
            <div className="impl-bars">
              {itemAverages.map((a) => {
                const verdict = itemVerdict(a.mean);
                return (
                  <div className="impl-bar-row" key={a.key}>
                    <span className="impl-bar-label">{a.label}</span>
                    <div className="impl-bar-track">
                      <div
                        className={`impl-bar-fill tone-${verdict.tone}`}
                        style={{ width: `${(a.mean / 7) * 100}%` }}
                      />
                    </div>
                    <span className="impl-bar-value">{a.mean.toFixed(1)}</span>
                    <span className="impl-bar-note">
                      {a.wellAddressed} of {a.n} well addressed
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="impl-summary-foot">
              <span>
                <strong>{rexTally.appraised}</strong> of {rexTally.total} have an AGREE-REX implementability score
                (the rest didn&rsquo;t clear the {AGREE_GATE_THRESHOLD_PCT}% AGREE II gate, or aren&rsquo;t appraised yet).
              </span>
              <span>
                <strong>{equityTally.evaluated}</strong> of {equityTally.total} assessed differential impact on any
                PROGRESS-Plus dimension.
              </span>
            </div>
          </section>

          <section className="impl-controls">
            <div className="impl-strands" role="tablist" aria-label="Implementation strands">
              {STRANDS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  role="tab"
                  aria-selected={strand === s.key}
                  className={`impl-strand-btn ${strand === s.key ? "active" : ""}`}
                  onClick={() => setStrand(s.key)}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <label className="impl-area">
              <span>Clinical area</span>
              <select value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)}>
                <option value="">All areas</option>
                {areas.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <p className="impl-strand-blurb">
            <strong>{activeStrand.label}</strong> — {activeStrand.blurb} <em>Source: {activeStrand.source}.</em>
          </p>

          <section className="impl-list">
            {rows.map((row) => {
              const open = openId === row.group.guidelineId;
              return (
                <article className="impl-card" key={row.group.guidelineId}>
                  <div className="impl-card-top">
                    <span className="impl-org" title={row.group.organization}>
                      {orgInitials(row.group.organization)}
                    </span>
                    <div className="impl-card-title">
                      <h3>{row.group.guidelineTitle}</h3>
                      <div className="impl-card-meta">
                        {row.group.organization} · {row.group.region} · {row.group.year}
                      </div>
                    </div>
                  </div>

                  {strand === "applicability" && (
                    <>
                      <div className="impl-items">
                        {row.items.map((entry) => {
                          const verdict = itemVerdict(entry.item?.score);
                          return (
                            <div className="impl-item" key={entry.key}>
                              <div className="impl-item-head">
                                <span className="impl-item-label">{entry.label}</span>
                                <span className={`impl-chip tone-${verdict.tone}`}>{verdict.label}</span>
                              </div>
                              <p className="impl-item-q">{entry.question}</p>
                              {entry.item ? (
                                <Meter score7={entry.item.score} />
                              ) : (
                                <p className="impl-item-missing">No item-level score on file.</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <button
                        type="button"
                        className="impl-toggle"
                        onClick={() => setOpenId(open ? null : row.group.guidelineId)}
                        aria-expanded={open}
                      >
                        {open ? "Hide the appraisers' notes" : "Read the appraisers' notes"}
                      </button>
                      {open && (
                        <div className="impl-notes">
                          {row.items.map((entry) =>
                            entry.item ? (
                              <div className="impl-note" key={entry.key}>
                                <div className="impl-note-h">
                                  {entry.label} — item {entry.item.num}: {entry.item.text}
                                </div>
                                <p>{entry.item.appraisal}</p>
                              </div>
                            ) : null
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {strand === "resources" && (
                    <div className="impl-rex">
                      {row.implementability !== null ? (
                        <>
                          <div className="impl-rex-row">
                            <span className="impl-rex-label">Implementability</span>
                            <Meter score7={row.implementability} />
                          </div>
                          {row.clinicalApplicability !== null && (
                            <div className="impl-rex-row">
                              <span className="impl-rex-label">Clinical applicability</span>
                              <Meter score7={row.clinicalApplicability} />
                            </div>
                          )}
                          <p className="impl-caveat">
                            AGREE-REX here is an AI-generated first-pass appraisal (two model passes, not two trained
                            human appraisers). Verify against the source guideline before acting on it.
                          </p>
                        </>
                      ) : (
                        <p className="impl-item-missing">
                          {row.rexStatus === "not_eligible"
                            ? `Not eligible — this guideline's AGREE II overall (${formatScore7(
                                row.group.agree.overall7
                              )}/7) didn't clear the ${AGREE_GATE_THRESHOLD_PCT}% gate, so no recommendation-level appraisal was run.`
                            : "Eligible for AGREE-REX, but not yet appraised. Feasibility is unknown here — not zero."}
                        </p>
                      )}
                    </div>
                  )}

                  {strand === "equity" && (
                    <div className="impl-equity">
                      {row.equityEvaluated ? (
                        <div className="impl-equity-dims">
                          {PROGRESS_PLUS_DIMENSIONS.map((dim) => (
                            <span
                              key={dim}
                              className={`impl-dim${row.equityDimensions.includes(dim) ? " addressed" : ""}`}
                            >
                              {dim}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="impl-chip tone-absent">Not evaluated</span>
                      )}
                      <p className="impl-equity-note">{row.equityNote}</p>
                    </div>
                  )}

                  <div className="impl-card-foot">
                    <Link href={`/catalog?guideline=${encodeURIComponent(row.group.guidelineId)}`}>
                      Open the full record →
                    </Link>
                    <Link href="/contextualisation">Does it fit my setting? →</Link>
                  </div>
                </article>
              );
            })}
            {rows.length === 0 && <div className="state-block">No guidelines match that clinical area.</div>}
          </section>
        </>
      )}

      <style jsx global>{`
        .impl-wrap {
          padding: 20px 0 60px 0;
        }
        .impl-head {
          padding: 8px 0 22px 0;
          border-bottom: 1px solid var(--line-100);
          margin-bottom: 24px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .impl-head h1 {
          margin: 0;
          font-size: 27px;
          font-weight: 700;
          color: var(--ink-900);
        }
        /* Full width, matching the Contextualise page's intro. */
        .impl-dek {
          margin: 0;
          font-size: 14px;
          line-height: 1.65;
          color: var(--ink-600);
          max-width: none;
        }
        .impl-summary {
          border: 1px solid var(--line-200);
          border-radius: var(--card-radius);
          padding: 20px 22px;
          background: var(--surface);
          margin-bottom: 22px;
        }
        .impl-summary-head h2 {
          margin: 0 0 5px 0;
          font-size: 16px;
          font-weight: 700;
          color: var(--ink-900);
        }
        .impl-summary-head p {
          margin: 0 0 16px 0;
          font-size: 12.5px;
          line-height: 1.6;
          color: var(--ink-600);
          max-width: none;
        }
        .impl-bars {
          display: flex;
          flex-direction: column;
          gap: 9px;
        }
        .impl-bar-row {
          display: grid;
          grid-template-columns: 165px 1fr 34px 150px;
          align-items: center;
          gap: 10px;
        }
        .impl-bar-label {
          font-size: 12px;
          font-weight: 700;
          color: var(--ink-700);
        }
        .impl-bar-track {
          height: 14px;
          border-radius: 5px;
          background: var(--bg-alt);
          overflow: hidden;
        }
        .impl-bar-fill,
        .impl-meter-fill {
          height: 100%;
          border-radius: 5px;
          min-width: 2px;
          transition: width 0.25s ease;
        }
        .impl-bar-fill.tone-good,
        .impl-meter-fill.tone-good {
          background: var(--favour);
        }
        .impl-bar-fill.tone-partial,
        .impl-meter-fill.tone-partial {
          background: var(--brand);
        }
        .impl-bar-fill.tone-weak,
        .impl-meter-fill.tone-weak {
          background: #d8a23a;
        }
        .impl-bar-fill.tone-absent,
        .impl-meter-fill.tone-absent {
          background: var(--against);
        }
        .impl-bar-value {
          font-size: 12px;
          font-weight: 800;
          color: var(--ink-800);
          text-align: right;
          font-variant-numeric: tabular-nums;
        }
        .impl-bar-note {
          font-size: 11.5px;
          color: var(--ink-500);
        }
        .impl-summary-foot {
          display: flex;
          flex-wrap: wrap;
          gap: 8px 24px;
          margin-top: 16px;
          padding-top: 13px;
          border-top: 1px solid var(--line-100);
          font-size: 12px;
          line-height: 1.55;
          color: var(--ink-600);
        }
        .impl-controls {
          display: flex;
          flex-wrap: wrap;
          align-items: flex-end;
          justify-content: space-between;
          gap: 14px;
          margin-bottom: 12px;
        }
        .impl-strands {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .impl-strand-btn {
          font-size: 12.5px;
          font-weight: 700;
          padding: 8px 15px;
          border-radius: 999px;
          border: 1px solid var(--line-200);
          background: var(--bg);
          color: var(--ink-600);
          cursor: pointer;
        }
        .impl-strand-btn:hover {
          background: var(--bg-alt);
        }
        .impl-strand-btn.active {
          background: var(--brand-ink);
          border-color: var(--brand-ink);
          color: #fff;
        }
        .impl-area {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .impl-area span {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--ink-500);
        }
        .impl-area select {
          border: 1px solid var(--line-200);
          border-radius: 9px;
          padding: 8px 10px;
          background: var(--bg);
          color: var(--ink-800);
          min-width: 200px;
        }
        /* Full width, like the other prose on this page. */
        .impl-strand-blurb {
          margin: 0 0 18px 0;
          font-size: 12.5px;
          line-height: 1.6;
          color: var(--ink-600);
          max-width: none;
        }
        .impl-strand-blurb em {
          color: var(--ink-500);
        }
        .impl-list {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .impl-card {
          border: 1px solid var(--line-200);
          border-radius: var(--card-radius);
          padding: 18px 20px;
          background: var(--surface);
        }
        .impl-card-top {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 14px;
        }
        .impl-org {
          flex-shrink: 0;
          width: 38px;
          height: 38px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-alt);
          border: 1px solid var(--line-200);
          font-size: 11.5px;
          font-weight: 800;
          color: var(--ink-600);
        }
        .impl-card-title h3 {
          margin: 0;
          font-size: 15px;
          font-weight: 700;
          line-height: 1.4;
          color: var(--ink-900);
        }
        .impl-card-meta {
          margin-top: 3px;
          font-size: 12px;
          color: var(--ink-500);
        }
        .impl-items {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
          gap: 11px;
        }
        .impl-item {
          border: 1px solid var(--line-100);
          border-radius: 11px;
          padding: 12px;
          background: var(--bg-alt);
        }
        .impl-item-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .impl-item-label {
          font-size: 12.5px;
          font-weight: 800;
          color: var(--ink-800);
        }
        .impl-item-q {
          margin: 6px 0 9px 0;
          font-size: 11.5px;
          line-height: 1.5;
          color: var(--ink-500);
        }
        .impl-chip {
          font-size: 10.5px;
          font-weight: 800;
          padding: 3px 8px;
          border-radius: 999px;
          white-space: nowrap;
          border: 1px solid transparent;
        }
        .impl-chip.tone-good {
          background: var(--favour-bg);
          color: var(--favour);
          border-color: var(--favour-border);
        }
        .impl-chip.tone-partial {
          background: var(--accent-bg);
          color: var(--brand-ink);
          border-color: var(--accent-border);
        }
        .impl-chip.tone-weak {
          background: #fbf1dd;
          color: #8a6114;
          border-color: #e5cd97;
        }
        .impl-chip.tone-absent {
          background: var(--against-bg);
          color: var(--against);
          border-color: var(--against-border);
        }
        .impl-meter {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .impl-meter-track {
          flex: 1;
          height: 8px;
          border-radius: 4px;
          background: var(--line-100);
          overflow: hidden;
        }
        .impl-meter-value {
          font-size: 11px;
          font-weight: 800;
          color: var(--ink-700);
          font-variant-numeric: tabular-nums;
        }
        .impl-item-missing {
          margin: 0;
          font-size: 12px;
          line-height: 1.55;
          color: var(--ink-500);
        }
        .impl-toggle {
          margin-top: 12px;
          background: none;
          border: none;
          padding: 0;
          font-size: 12.5px;
          font-weight: 700;
          color: var(--brand-ink);
          cursor: pointer;
        }
        .impl-toggle:hover {
          text-decoration: underline;
        }
        .impl-notes {
          margin-top: 12px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .impl-note {
          border-left: 3px solid var(--line-200);
          padding-left: 12px;
        }
        .impl-note-h {
          font-size: 12px;
          font-weight: 700;
          color: var(--ink-700);
        }
        .impl-note p {
          margin: 4px 0 0 0;
          font-size: 12.5px;
          line-height: 1.6;
          color: var(--ink-600);
        }
        .impl-rex {
          display: flex;
          flex-direction: column;
          gap: 10px;
          max-width: 520px;
        }
        .impl-rex-row {
          display: grid;
          grid-template-columns: 160px 1fr;
          align-items: center;
          gap: 12px;
        }
        .impl-rex-label {
          font-size: 12.5px;
          font-weight: 700;
          color: var(--ink-700);
        }
        .impl-caveat {
          margin: 2px 0 0 0;
          font-size: 11.5px;
          line-height: 1.55;
          color: var(--ink-500);
        }
        .impl-equity-dims {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 10px;
        }
        .impl-dim {
          font-size: 11px;
          font-weight: 600;
          padding: 4px 9px;
          border-radius: 999px;
          border: 1px dashed var(--line-200);
          color: var(--ink-400);
        }
        .impl-dim.addressed {
          border-style: solid;
          border-color: var(--favour-border);
          background: var(--favour-bg);
          color: var(--favour);
          font-weight: 700;
        }
        .impl-equity-note {
          margin: 8px 0 0 0;
          font-size: 12.5px;
          line-height: 1.6;
          color: var(--ink-600);
          max-width: 720px;
        }
        .impl-card-foot {
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
          margin-top: 14px;
          padding-top: 11px;
          border-top: 1px solid var(--line-100);
        }
        .impl-card-foot a {
          font-size: 12.5px;
          font-weight: 700;
        }
        @media (max-width: 760px) {
          .impl-bar-row {
            grid-template-columns: 120px 1fr 30px;
          }
          .impl-bar-note {
            display: none;
          }
          .impl-rex-row {
            grid-template-columns: 1fr;
            gap: 5px;
          }
          .impl-area select {
            min-width: 100%;
          }
        }
      `}</style>
    </div>
  );
}

export default function ImplementationPage() {
  return (
    <Suspense fallback={<div className="state-block">Loading…</div>}>
      <ImplementationInner />
    </Suspense>
  );
}
