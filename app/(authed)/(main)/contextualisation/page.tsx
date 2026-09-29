"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import AudienceLensBar from "@/components/AudienceLensBar";
import QuestionScopeBar, { useQuestionScope } from "@/components/QuestionScope";
import { orgInitials, uniqueSorted } from "@/components/format";
import {
  assessTransfer,
  TRANSFER_RULE,
  TRANSFER_RUNG_META,
  type TransferRung,
} from "@/lib/transferability";
import { AGREE_GATE_THRESHOLD_PCT } from "@/lib/config";
import type { Guideline, GuidelineGroup } from "@/lib/types";

/**
 * Contextualisation — the DECISION step: can a guideline written for one
 * setting be used in yours, and if not, what has to change first?
 *
 * This page deliberately stops at the adopt / adapt / de-novo question.
 * Everything about DOING it — barriers, tools, resource implications,
 * monitoring, equity — lives on the sibling /implementation tab, so the
 * two tabs never restate each other.
 *
 * No new data is invented here. Every signal below is read straight out of
 * the existing catalog records (region, worldRegion, year, AGREE II
 * overall, AGREE-REX clinical-applicability and values-and-preferences
 * domains). The ladder placement is a transparent rule, shown to the
 * reader in full, not a hidden score — the rule itself lives in
 * lib/transferability.ts, shared with the Reports page.
 */


interface Assessed {
  group: GuidelineGroup;
  rung: TransferRung;
  signals: { ok: boolean; label: string; detail: string }[];
  failures: number;
}

/** Delegates to lib/transferability.ts, so this page and the Reports page
 *  reach the same verdict from the same rule rather than keeping two
 *  copies that can drift. AGREE II is scored once per document, so the
 *  group's first recommendation carries every field the assessment reads. */
function assess(group: GuidelineGroup, myRegion: string): Assessed {
  const { rung, signals, failures } = assessTransfer(group.recommendations[0], myRegion);
  return { group, rung, signals, failures };
}


const RUNG_ORDER: TransferRung[] = ["adopt", "adapt", "adapt_caution"];

function ContextualisationInner() {
  const [groups, setGroups] = useState<GuidelineGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [myRegion, setMyRegion] = useState("");
  const [areaFilter, setAreaFilter] = useState("");
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

  const regions = useMemo(
    () => (groups ? uniqueSorted(groups.map((g) => g.worldRegion)).filter((r) => r !== "Global / multinational") : []),
    [groups]
  );
  const areas = useMemo(() => (groups ? uniqueSorted(groups.map((g) => g.clinicalArea)) : []), [groups]);

  /** Groups holding at least one recommendation the question cited. */
  const inScope = useMemo(() => {
    if (!groups) return [];
    if (!scope.ids || scope.ids.size === 0) return groups;
    return groups.filter((g) => g.recommendations.some((r) => scope.ids!.has(r.id)));
  }, [groups, scope]);

  const assessed = useMemo(() => {
    if (!groups) return [];
    return inScope
      .filter((g) => !areaFilter || g.clinicalArea === areaFilter)
      .map((g) => assess(g, myRegion))
      .sort((a, b) => a.failures - b.failures || b.group.agree.overall7 - a.group.agree.overall7);
  }, [groups, inScope, myRegion, areaFilter]);

  const counts = useMemo(() => {
    const c: Record<TransferRung, number> = { adopt: 0, adapt: 0, adapt_caution: 0 };
    for (const a of assessed) c[a.rung] += 1;
    return c;
  }, [assessed]);

  return (
    <div className="ctx-wrap">
      <AudienceLensBar />

      <header className="ctx-head">
        <span className="eyebrow">Contextualisation</span>
        <h1>Does this guideline transfer to your setting?</h1>
        <p className="ctx-dek">
          A recommendation is written for a particular health system, with particular resources, patients and
          expectations behind it. Contextualisation is the step of deciding — before implementation — whether you can
          adopt it as it stands, need to adapt it, or should build guidance of your own. Pick the question you asked
          and tell the page where you work: it places each guideline that answers that question on the ladder,
          showing the reasoning in full.
        </p>
      </header>

      <section className="ctx-ladder">
        <div className="ctx-ladder-head">
          <h2>The adopt / adapt / de-novo ladder</h2>
          <p>
            Adapted from the ADAPTE framework and GRADE-ADOLOPMENT, the two established methods for reusing an
            existing guideline in a new context rather than starting from scratch. Both ask the same question first:
            what about this guidance is specific to where it came from?
          </p>
        </div>
        <div className="ctx-rungs">
          {RUNG_ORDER.map((r) => (
            <div className={`ctx-rung tone-${TRANSFER_RUNG_META[r].tone}`} key={r}>
              <div className="ctx-rung-label">{TRANSFER_RUNG_META[r].label}</div>
              <p>{TRANSFER_RUNG_META[r].blurb}</p>
            </div>
          ))}
          <div className="ctx-rung tone-plain">
            <div className="ctx-rung-label">De novo</div>
            <p>
              Nothing in the catalog is placed here automatically. It is the honest answer when no existing guideline
              addresses your question, or when so much would have to change that you are writing new guidance and
              should say so.
            </p>
          </div>
        </div>
        <details className="ctx-rule">
          <summary>How this page decides — the four checks, in full</summary>
          <dl>
            {TRANSFER_RULE.map((r) => (
              <div className="ctx-rule-row" key={r.k}>
                <dt>{r.k}</dt>
                <dd>{r.v}</dd>
              </div>
            ))}
          </dl>
          <p className="ctx-rule-note">
            No failed checks places a guideline at <strong>Adopt candidate</strong>; one or two at <strong>Adapt</strong>;
            three or four at <strong>Adapt with caution</strong>. This is a reading aid built from the catalog&rsquo;s
            existing appraisal data — it is not itself a validated contextualisation instrument, and it does not replace
            a local panel working through ADAPTE or ADOLOPMENT properly.
          </p>
        </details>
      </section>

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

          <section className="ctx-controls">
            <label>
              <span>Where do you work?</span>
              <select value={myRegion} onChange={(e) => setMyRegion(e.target.value)}>
                <option value="">Not specified — skip the context-fit check</option>
                {regions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <label>
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
            <div className="ctx-tally">
              <span className="ctx-tally-item tone-good">{counts.adopt} adopt</span>
              <span className="ctx-tally-item tone-warn">{counts.adapt} adapt</span>
              <span className="ctx-tally-item tone-stop">{counts.adapt_caution} with caution</span>
            </div>
          </section>

          {myRegion === "" && (
            <p className="ctx-hint">
              Pick a region above to run the context-fit check. Until you do, every guideline passes it by default and
              the ladder reflects currency, rigour and values fit only.
            </p>
          )}

          <section className="ctx-list">
            {assessed.map(({ group, rung, signals }) => (
              <article className={`ctx-card tone-${TRANSFER_RUNG_META[rung].tone}`} key={group.guidelineId}>
                <div className="ctx-card-top">
                  <span className="ctx-org" title={group.organization}>
                    {orgInitials(group.organization)}
                  </span>
                  <div className="ctx-card-title">
                    <h3>{group.guidelineTitle}</h3>
                    <div className="ctx-card-meta">
                      {group.organization} · {group.region} · {group.year} · {group.clinicalArea}
                    </div>
                  </div>
                  <span className={`ctx-badge tone-${TRANSFER_RUNG_META[rung].tone}`}>{TRANSFER_RUNG_META[rung].label}</span>
                </div>

                <ul className="ctx-signals">
                  {signals.map((s) => (
                    <li key={s.label} className={s.ok ? "ok" : "no"}>
                      <span className="ctx-signal-mark" aria-hidden="true">
                        {s.ok ? "✓" : "!"}
                      </span>
                      <span className="ctx-signal-body">
                        <strong>{s.label}</strong>
                        <span>{s.detail}</span>
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="ctx-card-foot">
                  <Link href={`/catalog?guideline=${encodeURIComponent(group.guidelineId)}`}>
                    Open the full record →
                  </Link>
                  <Link href="/implementation">What it would take to implement →</Link>
                </div>
              </article>
            ))}
            {assessed.length === 0 && <div className="state-block">No guidelines match that clinical area.</div>}
          </section>
        </>
      )}

      <style jsx global>{`
        .ctx-wrap {
          padding: 20px 0 60px 0;
        }
        .ctx-head {
          padding: 8px 0 22px 0;
          border-bottom: 1px solid var(--line-100);
          margin-bottom: 26px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .ctx-head h1 {
          margin: 0;
          font-size: 27px;
          font-weight: 700;
          color: var(--ink-900);
          max-width: none;
        }
        /* Runs the full width of the content column rather than being held
           to a 700px measure. The justification and hyphenation come from
           the app-wide prose rules in globals.css. */
        .ctx-dek {
          margin: 0;
          font-size: 14px;
          line-height: 1.65;
          color: var(--ink-600);
          max-width: none;
        }
        .ctx-ladder {
          margin-bottom: 30px;
        }
        .ctx-ladder-head h2 {
          margin: 0 0 6px 0;
          font-size: 17px;
          font-weight: 700;
          color: var(--ink-900);
        }
        /* Full width, like the page intro above it — the 720px measure it
           had left an awkward ragged column beside the ladder cards. */
        .ctx-ladder-head p {
          margin: 0 0 16px 0;
          font-size: 13.5px;
          line-height: 1.6;
          color: var(--ink-600);
          max-width: none;
        }
        .ctx-rungs {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(215px, 1fr));
          gap: 12px;
        }
        .ctx-rung {
          border: 1px solid var(--line-200);
          border-left-width: 4px;
          border-radius: var(--card-radius);
          padding: 15px 17px;
          background: var(--surface);
        }
        .ctx-rung p {
          margin: 6px 0 0 0;
          font-size: 12.5px;
          line-height: 1.55;
          color: var(--ink-600);
        }
        .ctx-rung-label {
          font-size: 13px;
          font-weight: 800;
          color: var(--ink-900);
        }
        .ctx-rung.tone-good {
          border-left-color: var(--favour);
        }
        .ctx-rung.tone-warn {
          border-left-color: var(--brand);
        }
        .ctx-rung.tone-stop {
          border-left-color: var(--against);
        }
        .ctx-rung.tone-plain {
          border-left-color: var(--line-200);
        }
        .ctx-rule {
          margin-top: 16px;
          border: 1px solid var(--line-200);
          border-radius: 12px;
          background: var(--bg-alt);
          padding: 0 16px;
        }
        .ctx-rule summary {
          cursor: pointer;
          padding: 12px 0;
          font-size: 13px;
          font-weight: 700;
          color: var(--ink-700);
        }
        .ctx-rule dl {
          margin: 0 0 8px 0;
        }
        .ctx-rule-row {
          display: grid;
          grid-template-columns: 160px 1fr;
          gap: 10px;
          padding: 7px 0;
          border-top: 1px solid var(--line-100);
        }
        .ctx-rule dt {
          font-size: 12.5px;
          font-weight: 700;
          color: var(--ink-800);
        }
        .ctx-rule dd {
          margin: 0;
          font-size: 12.5px;
          line-height: 1.55;
          color: var(--ink-600);
        }
        .ctx-rule-note {
          margin: 0 0 14px 0;
          font-size: 12px;
          line-height: 1.55;
          color: var(--ink-500);
        }
        .ctx-controls {
          display: flex;
          flex-wrap: wrap;
          align-items: flex-end;
          gap: 14px;
          padding: 14px 16px;
          border: 1px solid var(--line-200);
          border-radius: 12px;
          background: var(--surface);
          margin-bottom: 14px;
        }
        .ctx-controls label {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .ctx-controls label span {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--ink-500);
        }
        .ctx-controls select {
          border: 1px solid var(--line-200);
          border-radius: 9px;
          padding: 8px 10px;
          background: var(--bg);
          color: var(--ink-800);
          min-width: 230px;
        }
        .ctx-tally {
          display: flex;
          gap: 8px;
          margin-left: auto;
          flex-wrap: wrap;
        }
        .ctx-tally-item {
          font-size: 11.5px;
          font-weight: 700;
          padding: 5px 10px;
          border-radius: 999px;
          border: 1px solid var(--line-200);
        }
        .ctx-tally-item.tone-good {
          color: var(--favour);
          background: var(--favour-bg);
          border-color: var(--favour-border);
        }
        .ctx-tally-item.tone-warn {
          color: var(--brand-ink);
          background: var(--accent-bg);
          border-color: var(--accent-border);
        }
        .ctx-tally-item.tone-stop {
          color: var(--against);
          background: var(--against-bg);
          border-color: var(--against-border);
        }
        .ctx-hint {
          margin: 0 0 18px 0;
          font-size: 12.5px;
          color: var(--ink-500);
        }
        .ctx-list {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .ctx-card {
          border: 1px solid var(--line-200);
          border-left-width: 4px;
          border-radius: var(--card-radius);
          padding: 18px 20px;
          background: var(--surface);
        }
        .ctx-card.tone-good {
          border-left-color: var(--favour);
        }
        .ctx-card.tone-warn {
          border-left-color: var(--brand);
        }
        .ctx-card.tone-stop {
          border-left-color: var(--against);
        }
        .ctx-card-top {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }
        .ctx-org {
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
        .ctx-card-title {
          min-width: 0;
          flex: 1;
        }
        .ctx-card-title h3 {
          margin: 0;
          font-size: 15px;
          font-weight: 700;
          line-height: 1.4;
          color: var(--ink-900);
        }
        .ctx-card-meta {
          margin-top: 3px;
          font-size: 12px;
          color: var(--ink-500);
        }
        .ctx-badge {
          flex-shrink: 0;
          font-size: 11.5px;
          font-weight: 800;
          padding: 6px 12px;
          border-radius: 999px;
          border: 1px solid var(--line-200);
          white-space: nowrap;
        }
        .ctx-badge.tone-good {
          color: var(--favour);
          background: var(--favour-bg);
          border-color: var(--favour-border);
        }
        .ctx-badge.tone-warn {
          color: var(--brand-ink);
          background: var(--accent-bg);
          border-color: var(--accent-border);
        }
        .ctx-badge.tone-stop {
          color: var(--against);
          background: var(--against-bg);
          border-color: var(--against-border);
        }
        .ctx-signals {
          list-style: none;
          margin: 14px 0 0 0;
          padding: 0;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 10px;
        }
        .ctx-signals li {
          display: flex;
          gap: 9px;
          align-items: flex-start;
          padding: 10px 12px;
          border-radius: 10px;
          background: var(--bg-alt);
        }
        .ctx-signal-mark {
          flex-shrink: 0;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 800;
          color: #fff;
        }
        .ctx-signals li.ok .ctx-signal-mark {
          background: var(--favour);
        }
        .ctx-signals li.no .ctx-signal-mark {
          background: var(--against);
        }
        .ctx-signal-body {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }
        .ctx-signal-body strong {
          font-size: 12px;
          color: var(--ink-800);
        }
        .ctx-signal-body span {
          font-size: 12px;
          line-height: 1.5;
          color: var(--ink-600);
        }
        .ctx-card-foot {
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
          margin-top: 13px;
          padding-top: 11px;
          border-top: 1px solid var(--line-100);
        }
        .ctx-card-foot a {
          font-size: 12.5px;
          font-weight: 700;
        }
        @media (max-width: 700px) {
          .ctx-rule-row {
            grid-template-columns: 1fr;
            gap: 2px;
          }
          .ctx-controls select {
            min-width: 100%;
          }
          .ctx-tally {
            margin-left: 0;
          }
        }
      `}</style>
    </div>
  );
}

export default function ContextualisationPage() {
  return (
    <Suspense fallback={<div className="state-block">Loading…</div>}>
      <ContextualisationInner />
    </Suspense>
  );
}
