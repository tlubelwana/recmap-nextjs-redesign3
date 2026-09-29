"use client";

import { useState } from "react";
import { toPlainLanguage } from "@/lib/plainLanguage";
import type { Guideline, GuidelineGroup } from "@/lib/types";

/**
 * The lived-experience rendering of one recommendation.
 *
 * Every sentence here is produced by lib/plainLanguage.ts from fields already
 * on the record — nothing is generated at render time and nothing is inferred.
 * The verbatim clinical wording is always one click away and never replaced:
 * a plain-language layer that hides the original becomes impossible to check.
 *
 * Layering is deliberate. The literature on patient versions of guidelines
 * found strong support for a simple surface with detail one level down, and
 * found that over-stuffed patient versions get abandoned for something
 * simpler — so the surface here is four blocks (what it is, how much is your
 * call, how sure they are, who it's about) and everything else is behind a
 * disclosure.
 */
export default function PlainLanguagePanel({
  rec,
  group,
}: {
  rec: Guideline;
  group: GuidelineGroup;
}) {
  const v = toPlainLanguage(rec, group);
  const [showVerbatim, setShowVerbatim] = useState(false);
  const [showNote, setShowNote] = useState(false);

  return (
    <section className="pl-wrap">
      <div className="pl-lead">
        <h3 className="pl-h">{v.direction.headline}</h3>
        <p className="pl-p">{v.direction.detail}</p>
      </div>

      <div className="pl-grid">
        <div className={`pl-card pl-card-${v.strength.yourCall === "genuinely your call" ? "choice" : "settled"}`}>
          <div className="pl-card-k">How much of this is your call</div>
          <div className="pl-card-h">{v.strength.headline}</div>
          <p className="pl-card-p">{v.strength.detail}</p>
        </div>

        <div className="pl-card">
          <div className="pl-card-k">How sure they are</div>
          <div className="pl-card-h">{v.certainty.headline}</div>
          <p className="pl-card-p">{v.certainty.detail}</p>
        </div>
      </div>

      <div className="pl-block">
        <div className="pl-card-k">Who this is about</div>
        <p className="pl-p">{v.whoItIsAbout}</p>
        <div className="pl-pair">
          <div>
            <span className="pl-k">What it involves</span>
            <span className="pl-v">{v.whatItInvolves}</span>
          </div>
          <div>
            <span className="pl-k">Compared with</span>
            <span className="pl-v">{v.comparedWith}</span>
          </div>
        </div>
      </div>

      <div className="pl-block">
        <div className="pl-card-k">What the studies measured</div>
        {v.outcomes.list.length > 0 ? (
          <div className="outcome-tags">
            {v.outcomes.list.map((o, i) => (
              <span className="outcome-tag" key={i}>
                {o}
              </span>
            ))}
          </div>
        ) : (
          <p className="pl-p">Not recorded for this recommendation.</p>
        )}
        {v.outcomes.note && <p className="pl-note">{v.outcomes.note}</p>}
      </div>

      <div className={`pl-block pl-involve pl-involve-${v.involvement.score !== null && v.involvement.score >= 4 ? "yes" : "no"}`}>
        <div className="pl-card-k">Were people like you asked what mattered?</div>
        <div className="pl-card-h">{v.involvement.headline}</div>
        <p className="pl-p">{v.involvement.detail}</p>
        <p className="pl-note">
          This comes from a standard checklist used to judge guidelines (AGREE&nbsp;II, item 5: were the views and
          preferences of the people the guideline is about sought?). This guideline scored{" "}
          {v.involvement.score !== null ? `${v.involvement.score} out of 7` : "not yet checked"} on it.
        </p>
        {v.involvement.appraisalNote && (
          <>
            <button type="button" className="pl-toggle pl-toggle-sm" onClick={() => setShowNote((n) => !n)}>
              {showNote ? "Hide" : "Show"} how that was judged
            </button>
            {showNote && <p className="pl-appraisal-note">{v.involvement.appraisalNote}</p>}
          </>
        )}
      </div>

      <div className="pl-block">
        <div className="pl-card-k">Questions you could ask</div>
        <ul className="pl-qs">
          {v.questions.map((q, i) => (
            <li key={i}>{q}</li>
          ))}
        </ul>
      </div>

      <div className="pl-verbatim">
        <button type="button" className="pl-toggle" onClick={() => setShowVerbatim((s) => !s)}>
          {showVerbatim ? "Hide" : "Show"} the guideline&rsquo;s own words
        </button>
        {showVerbatim && (
          <blockquote className="pl-quote">
            &ldquo;{v.verbatim}&rdquo;
            <cite>
              {v.provenance.organization}, {v.provenance.year}
            </cite>
          </blockquote>
        )}
      </div>

      <style jsx global>{`
        .pl-wrap {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .pl-lead {
          padding: 14px 16px;
          border-radius: 12px;
          background: var(--favour-bg);
          border: 1px solid var(--favour-border);
        }
        .pl-h {
          margin: 0 0 6px;
          font-size: 17px;
          font-weight: 700;
          color: var(--ink-900);
          line-height: 1.35;
        }
        .pl-p {
          margin: 0;
          font-size: 13.5px;
          line-height: 1.65;
          color: var(--ink-700);
        }
        .pl-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        @media (max-width: 620px) {
          .pl-grid {
            grid-template-columns: 1fr;
          }
        }
        .pl-card,
        .pl-block {
          padding: 13px 15px;
          border: 1px solid var(--line-200);
          border-radius: 12px;
          background: var(--surface);
        }
        .pl-card-choice {
          border-color: var(--accent-border);
          background: var(--accent-bg);
        }
        .pl-card-k {
          font-size: 10.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--ink-400);
          margin-bottom: 5px;
        }
        .pl-card-h {
          font-size: 14px;
          font-weight: 700;
          color: var(--ink-900);
          margin-bottom: 5px;
          line-height: 1.35;
        }
        .pl-card-p {
          margin: 0;
          font-size: 13px;
          line-height: 1.6;
          color: var(--ink-700);
        }
        .pl-pair {
          display: flex;
          flex-direction: column;
          gap: 7px;
          margin-top: 10px;
        }
        .pl-k {
          display: block;
          font-size: 11px;
          font-weight: 700;
          color: var(--ink-400);
        }
        .pl-v {
          display: block;
          font-size: 13px;
          line-height: 1.55;
          color: var(--ink-700);
        }
        .pl-note {
          margin: 8px 0 0;
          font-size: 11.5px;
          line-height: 1.55;
          color: var(--ink-500);
        }
        .pl-involve-no {
          border-color: var(--accent-border);
        }
        .pl-qs {
          margin: 4px 0 0;
          padding-left: 18px;
          display: flex;
          flex-direction: column;
          gap: 7px;
        }
        .pl-qs li {
          font-size: 13px;
          line-height: 1.55;
          color: var(--ink-700);
        }
        .pl-toggle {
          border: 1px solid var(--line-200);
          background: var(--surface);
          border-radius: 999px;
          padding: 6px 13px;
          font-size: 12px;
          font-weight: 600;
          color: var(--ink-600);
          cursor: pointer;
        }
        .pl-toggle:hover {
          color: var(--ink-900);
          border-color: var(--ink-400);
        }
        .pl-toggle-sm {
          align-self: flex-start;
          margin-top: 8px;
          padding: 4px 10px;
          font-size: 11.5px;
        }
        .pl-appraisal-note {
          margin: 8px 0 0;
          padding: 10px 12px;
          background: var(--bg-alt);
          border-radius: 8px;
          font-size: 12px;
          line-height: 1.6;
          color: var(--ink-600);
        }
        .pl-quote {
          margin: 10px 0 0;
          padding: 12px 14px;
          border-left: 3px solid var(--line-200);
          background: var(--bg-alt);
          border-radius: 0 10px 10px 0;
          font-size: 13px;
          line-height: 1.6;
          color: var(--ink-700);
        }
        .pl-quote cite {
          display: block;
          margin-top: 8px;
          font-style: normal;
          font-size: 11.5px;
          color: var(--ink-500);
        }
      `}</style>
    </section>
  );
}
