"use client";

import { useState } from "react";
import { AGREE_GATE_THRESHOLD_PCT, AGREE_GATE_THRESHOLD_IS_PROVISIONAL } from "@/lib/config";
import type { AgreeRexAppraisal } from "@/lib/types";

/**
 * Two-tier quality appraisal, recommendation-level half. AGREE II (shown
 * above, in AgreeDomains) judges how rigorously the GUIDELINE was
 * developed; AGREE-REX judges whether this specific RECOMMENDATION is
 * trustworthy in practice — applicable, value-aligned, implementable.
 * Modeled on the chronic-pain RecMap protocol's two-tier design: a
 * guideline first has to clear an AGREE II quality gate before its
 * recommendations become eligible for a second, AGREE-REX pass.
 *
 * Real AGREE-REX appraisal data (two independent AI appraisal passes per
 * item, migrated from AGREEREX_results.xlsx — see scripts/migrate_agree_rex_
 * real_data.py) is shown for every recommendation whose parent guideline
 * cleared the AGREE II quality gate; the rest render "not eligible", and
 * none render a fabricated score. The exact gate threshold is a provisional
 * placeholder (see lib/config.ts) pending confirmation of the source
 * protocol's real published cutoff.
 */
export default function AgreeRexSection({ agreeRex }: { agreeRex: AgreeRexAppraisal }) {
  const gateLabel = agreeRex.gatePassed ? "Cleared the quality gate" : "Below the quality gate";
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <div className="rex-section">
        <div className="agree-head">
          <span className="dsec-label">
            AGREE-REX &middot; recommendation trust score
            {AGREE_GATE_THRESHOLD_IS_PROVISIONAL && (
              <span className="rex-provisional-flag" title="The exact published gate threshold from the cited protocol could not be verified yet — this is a provisional placeholder, set in one place (lib/config.ts) and easy to update.">
                provisional threshold
              </span>
            )}
          </span>
          <span className={`agree-badge rex-gate-badge${agreeRex.gatePassed ? " passed" : " failed"}`}>
            {gateLabel}
          </span>
        </div>

        <div className="rex-scale">
          <div className="rex-scale-head">
            <span className="rex-scale-threshold">Gate threshold: {AGREE_GATE_THRESHOLD_PCT}%</span>
          </div>

          <div className="rex-scale-axis" aria-hidden="true">
            {[0, 20, 40, 60, 80, 100].map((t) => (
              <span key={t} style={{ left: `${t}%` }}>
                {t}%
              </span>
            ))}
          </div>

          <div
            className="rex-scale-bar"
            role="img"
            aria-label={`Parent guideline AGREE II overall ${agreeRex.parentAgreeOverallPct}% against a ${AGREE_GATE_THRESHOLD_PCT}% gate`}
          >
            {[20, 40, 60, 80].map((t) => (
              <span className="rex-scale-tick" key={t} style={{ left: `${t}%` }} />
            ))}
            <span
              className="rex-scale-threshold-mark"
              style={{ left: `${AGREE_GATE_THRESHOLD_PCT}%` }}
              title={`Gate threshold ${AGREE_GATE_THRESHOLD_PCT}%`}
            />
            <span
              className="rex-scale-marker"
              style={{ left: `${Math.min(100, Math.max(0, agreeRex.parentAgreeOverallPct))}%` }}
            >
              <span className="rex-scale-value">{agreeRex.parentAgreeOverallPct}%</span>
            </span>
          </div>
        </div>
        <div className="rex-gate-caption">
          Parent guideline&rsquo;s AGREE&nbsp;II overall score vs. a {AGREE_GATE_THRESHOLD_PCT}% gate — guidelines
          that clear it become eligible for a second, recommendation-level AGREE-REX appraisal (clinical
          applicability, values &amp; preferences, implementability), distinct from the guideline-level score above.
        </div>

        <div className="rex-chips">
          <span className={`rex-chip${agreeRex.gatePassed ? " pass" : " fail"}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              {agreeRex.gatePassed ? <path d="m8.2 12.3 2.5 2.5 5-5.3" /> : <path d="M9 15l6-6M9 9l6 6" />}
            </svg>
            {gateLabel}
          </span>
          <span className="rex-chip neutral">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7.4V12l3 1.9" />
            </svg>
            {agreeRex.status === "appraised"
              ? "Appraised"
              : agreeRex.status === "eligible_not_yet_appraised"
                ? "Eligible, not yet appraised"
                : "Not eligible"}
          </span>
        </div>

        <div className={`rex-status${agreeRex.status === "not_eligible" ? " muted" : ""}`}>
          {agreeRex.status === "not_eligible" && (
            <p>
              This guideline didn&rsquo;t clear the AGREE&nbsp;II quality gate, so its recommendations aren&rsquo;t
              eligible for a recommendation-level AGREE-REX trust score under this protocol.
            </p>
          )}
          {agreeRex.status === "eligible_not_yet_appraised" && (
            <p>
              <b>Eligible, not yet appraised.</b> AGREE-REX is a new addition to RecMap — no recommendation in this
              catalog has a completed AGREE-REX appraisal yet. This is a placeholder showing eligibility, not a
              trust score.
            </p>
          )}
          {agreeRex.status === "appraised" && agreeRex.rex && (
            <div className="rex-domains">
              {agreeRex.rex.domains.map((d) => (
                <div className="rex-domain-row" key={d.key}>
                  <span>{d.label}</span>
                  <span className="rex-domain-score">
                    {d.score7.toFixed(1)}/7 <span className="rex-domain-pct">({(d.score01 * 100).toFixed(0)}%)</span>
                  </span>
                </div>
              ))}
              <div className="agree-overall">
                All items (supplementary) <b>{agreeRex.rex.overall7.toFixed(1)}/7</b>
                <span className="rex-overall-pct"> &middot; {agreeRex.rex.overallPct.toFixed(0)}%</span>
              </div>
              <div className="rex-overall-assessment">
                <div>
                  <span className="rex-assessment-label">Appraiser A, overall:</span> {agreeRex.rex.overallAssessment.appraiserA}
                </div>
                <div>
                  <span className="rex-assessment-label">Appraiser B, overall:</span> {agreeRex.rex.overallAssessment.appraiserB}
                </div>
                <div className="rex-agree-line">
                  {agreeRex.rex.overallAssessment.appraisersAgree
                    ? "The two independent appraisal passes agreed on the overall judgement."
                    : "The two independent appraisal passes did not agree on the overall judgement — treat this one with extra care."}
                  {" "}
                  {agreeRex.rex.itemsWithDisagreement > 0
                    ? `They scored ${agreeRex.rex.itemsWithDisagreement} of 9 items differently (by 1 point each).`
                    : "They scored all 9 items identically."}
                </div>
              </div>

              <button type="button" className="rex-expand-btn" onClick={() => setExpanded((v) => !v)}>
                {expanded ? "Hide" : "Show"} the 9-item breakdown &amp; rationale
              </button>
              {expanded && (
                <div className="rex-items">
                  {agreeRex.rex.domains.map((d) => (
                    <div key={d.key} className="rex-item-domain-group">
                      <div className="rex-item-domain-label">{d.label}</div>
                      {d.items.map((it) => (
                        <details key={it.num} className="rex-item">
                          <summary>
                            <span className="rex-item-num">{it.num}.</span> {it.text}
                            <span className="rex-item-score">
                              {it.score.toFixed(1)}/7
                              {it.difference > 0 && <span className="rex-item-diff"> (A {it.scoreA} / B {it.scoreB})</span>}
                            </span>
                          </summary>
                          <p className="rex-item-rationale">
                            <b>Appraiser A:</b> {it.rationaleA}
                          </p>
                          <p className="rex-item-rationale">
                            <b>Appraiser B:</b> {it.rationaleB}
                          </p>
                        </details>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              <div className="rex-caveat">
                <b>Human verification checkpoint.</b> This appraisal was generated by AI, not by trained human
                AGREE-REX appraisers — treat it as a structured first pass. {agreeRex.rex.method.note}
              </div>
            </div>
          )}
        </div>
      </div>
      <style jsx global>{`
        .rex-section {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .rex-provisional-flag {
          font-size: 9.5px;
          font-weight: 700;
          text-transform: none;
          letter-spacing: 0;
          color: var(--accent-ink);
          background: var(--accent-bg);
          border: 1px solid var(--accent-border);
          border-radius: 999px;
          padding: 2px 7px;
          cursor: help;
        }
        .rex-gate-badge.passed {
          color: var(--favour);
          background: var(--favour-bg);
          border-color: var(--favour-border);
        }
        .rex-gate-badge.failed {
          color: var(--against);
          background: var(--against-bg);
          border-color: var(--against-border);
        }
        /* A 0-100% scale with the score marked on it, per the v3 drawer
           snapshot. The red-to-green ramp is the point: a bare number says
           nothing about whether 71% is good, and the gate mark shows the
           threshold this score is actually being judged against. */
        .rex-scale {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .rex-scale-head {
          display: flex;
          justify-content: flex-end;
        }
        .rex-scale-threshold {
          font-size: 12px;
          font-weight: 600;
          color: var(--brand-ink);
        }
        .rex-scale-axis {
          position: relative;
          height: 15px;
          margin-top: 26px;
        }
        .rex-scale-axis span {
          position: absolute;
          transform: translateX(-50%);
          font-size: 11px;
          color: var(--ink-500);
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }
        .rex-scale-axis span:first-child { transform: none; }
        .rex-scale-axis span:last-child { transform: translateX(-100%); }
        .rex-scale-bar {
          position: relative;
          height: 11px;
          border-radius: 6px;
          background: linear-gradient(
            90deg,
            #e2564d 0%,
            #ea8a45 22%,
            #efc14f 45%,
            #a8ce70 70%,
            #63b97f 100%
          );
        }
        .rex-scale-tick {
          position: absolute;
          top: -3px;
          bottom: -3px;
          width: 1px;
          background: var(--ink-400);
          opacity: 0.5;
        }
        .rex-scale-threshold-mark {
          position: absolute;
          top: -7px;
          bottom: -7px;
          width: 2px;
          background: var(--ink-700);
          opacity: 0.45;
        }
        .rex-scale-marker {
          position: absolute;
          top: -6px;
          bottom: -6px;
          width: 2.5px;
          background: var(--brand-ink);
          border-radius: 2px;
        }
        .rex-scale-value {
          position: absolute;
          bottom: calc(100% + 7px);
          left: 50%;
          transform: translateX(-50%);
          background: var(--brand-ink);
          color: #fff;
          font-size: 12.5px;
          font-weight: 700;
          padding: 4px 9px;
          border-radius: 6px;
          white-space: nowrap;
          font-variant-numeric: tabular-nums;
        }
        .rex-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 4px;
        }
        .rex-chip {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 12.5px;
          font-weight: 600;
          padding: 8px 14px;
          border-radius: 8px;
          border: 1px solid transparent;
        }
        .rex-chip svg { width: 15px; height: 15px; flex-shrink: 0; }
        .rex-chip.pass {
          background: var(--favour-bg);
          color: var(--favour);
          border-color: var(--favour-border);
        }
        .rex-chip.fail {
          background: var(--against-bg);
          color: var(--against);
          border-color: var(--against-border);
        }
        .rex-chip.neutral {
          background: var(--bg-alt);
          color: var(--ink-600);
          border-color: var(--line-200);
        }
        .rex-gate-caption {
          font-size: 11.5px;
          line-height: 1.55;
          color: var(--ink-500);
        }
        .rex-status {
          border: 1px dashed var(--line-200);
          border-radius: 10px;
          padding: 10px 12px;
          background: var(--bg-alt);
        }
        .rex-status p {
          margin: 0;
          font-size: 12.5px;
          line-height: 1.55;
          color: var(--ink-600);
        }
        .rex-status.muted p {
          color: var(--ink-500);
        }
        .rex-domains {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .rex-domain-row {
          display: flex;
          justify-content: space-between;
          font-size: 12.5px;
          color: var(--ink-700);
          padding: 3px 0;
        }
        .rex-domain-score {
          font-weight: 700;
          color: var(--ink-900);
          font-variant-numeric: tabular-nums;
        }
        .rex-domain-pct {
          font-weight: 400;
          color: var(--ink-500);
        }
        .rex-overall-pct {
          font-weight: 400;
          color: var(--ink-500);
        }
        .rex-overall-assessment {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-top: 6px;
          padding-top: 8px;
          border-top: 1px solid var(--line-100);
          font-size: 12px;
          line-height: 1.55;
          color: var(--ink-700);
        }
        .rex-assessment-label {
          font-weight: 700;
          color: var(--ink-800);
        }
        .rex-agree-line {
          color: var(--ink-500);
          margin-top: 2px;
        }
        .rex-expand-btn {
          align-self: flex-start;
          margin-top: 8px;
          font-size: 12px;
          font-weight: 600;
          color: var(--brand);
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
          text-decoration: underline;
        }
        .rex-items {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 6px;
        }
        .rex-item-domain-label {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          color: var(--ink-500);
          margin-bottom: 4px;
        }
        .rex-item {
          border: 1px solid var(--line-200);
          border-radius: 8px;
          padding: 8px 10px;
          margin-bottom: 6px;
        }
        .rex-item summary {
          cursor: pointer;
          font-size: 12.5px;
          color: var(--ink-700);
          display: flex;
          gap: 6px;
          align-items: baseline;
          flex-wrap: wrap;
        }
        .rex-item-num {
          font-weight: 700;
          color: var(--ink-500);
        }
        .rex-item-score {
          margin-left: auto;
          font-weight: 700;
          color: var(--ink-900);
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }
        .rex-item-diff {
          font-weight: 400;
          color: var(--ink-500);
        }
        .rex-item-rationale {
          font-size: 12px;
          line-height: 1.6;
          color: var(--ink-600);
          margin: 8px 0 0 0;
        }
        .rex-caveat {
          margin-top: 10px;
          padding: 10px 12px;
          border: 1px dashed var(--against-border);
          background: var(--against-bg);
          border-radius: 8px;
          font-size: 11.5px;
          line-height: 1.6;
          color: var(--ink-700);
        }
      `}</style>
    </>
  );
}
