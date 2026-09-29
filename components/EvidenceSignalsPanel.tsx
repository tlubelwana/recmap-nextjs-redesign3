"use client";

import { currency, isUngraded, strengthCertaintyDiscordance } from "@/lib/audienceLens";
import type { Guideline, GuidelineGroup } from "@/lib/types";

/**
 * Evidence-base signals: the researcher, guideline-developer and industry
 * view of one recommendation.
 *
 * All three audiences read a recommendation as a data point about the state
 * of the evidence rather than as advice, but they want slightly different
 * things from it, so this panel takes a `variant`:
 *
 *  - "research"  — what is poolable, what is not, where the corpus is thin,
 *                  and where two appraisal passes disagreed.
 *  - "industry"  — where the standard of care currently sits, how stable that
 *                  position is, and what evidence could move it.
 *
 * ── A deliberate constraint on the industry variant ───────────────────────
 * This is an evidence-gap surface, not a targeting tool. It holds no
 * person-level data: no author or panellist names, no linkage of individuals
 * to disclosures, funding or trial sites, no contact details, and no score
 * for how easily any organisation's recommendations could be changed.
 * Conflict of interest appears only as AGREE II Domain 6, at the level of the
 * guideline document. Signals that argue against a technology render exactly
 * as prominently as signals that favour one. That constraint is the design,
 * not a disclaimer bolted onto it — see the lens caveat in lib/audienceLens.ts.
 */

function Signal({
  k,
  v,
  note,
  tone = "plain",
}: {
  k: string;
  v: string;
  note?: string;
  tone?: "plain" | "flag" | "good";
}) {
  return (
    <div className={`sig sig-${tone}`}>
      <div className="sig-k">{k}</div>
      <div className="sig-v">{v}</div>
      {note && <div className="sig-note">{note}</div>}
    </div>
  );
}

export default function EvidenceSignalsPanel({
  rec,
  group,
  peers,
  variant,
}: {
  rec: Guideline;
  group: GuidelineGroup;
  /** Every other recommendation in the catalog, when the caller has it —
   *  used only to detect that other guidelines take a different position on
   *  the same clinical area and AI domain. Omitted safely: the divergence
   *  block simply doesn't render. */
  peers?: Guideline[];
  variant: "research" | "industry";
}) {
  const cur = currency(rec);
  const discordant = strengthCertaintyDiscordance(rec);
  const ungraded = isUngraded(rec);
  const rex = rec.agreeRex.status === "appraised" ? rec.agreeRex.rex : null;

  const related = (peers ?? []).filter(
    (p) =>
      p.id !== rec.id &&
      p.clinicalArea === rec.clinicalArea &&
      p.aiDomain === rec.aiDomain
  );
  const divergent = related.filter((p) => p.direction !== rec.direction);

  return (
    <section className="sig-wrap">
      <div className="sig-grid">
        <Signal
          k="Statement type"
          v={rec.recommendationTypeLabel}
          note={
            rec.recommendationType === "research_recommendation"
              ? "A call for further study, not clinical guidance — the panel has effectively written the trial brief."
              : rec.recommendationType === "good_practice_statement"
                ? "Ungraded common-sense directive. Do not pool with graded recommendations."
                : rec.recommendationType === "additional_guidance"
                  ? "Narrative context, not a formal recommendation. Excluding it changes your denominator."
                  : "A formal, graded recommendation."
          }
          tone={rec.recommendationType === "recommendation" ? "plain" : "flag"}
        />
        <Signal
          k="Grading approach"
          v={rec.gradingApproachLabel}
          note={
            ungraded
              ? "No explicit GRADE rating. Certainty here cannot be pooled with GRADE-based guidelines, and new trial evidence has no mechanical route to change the rating."
              : "GRADE-based: a change in the underlying evidence can move the certainty rating directly."
          }
          tone={ungraded ? "flag" : "good"}
        />
        <Signal
          k="Certainty"
          v={rec.gradeCertaintyLabel}
          note={rec.certainty && rec.certainty !== rec.gradeCertaintyLabel ? `As reported: “${rec.certainty}”` : undefined}
        />
        <Signal
          k="Currency"
          v={cur.label}
          note={`Published ${rec.year}; record last checked ${group.lastCheckedISO}.`}
          tone={cur.tone === "overdue" ? "flag" : "plain"}
        />
      </div>

      {discordant && (
        <div className="sig-callout">
          <b>Strength–certainty discordance.</b> A strong recommendation resting on {rec.gradeCertaintyLabel.toLowerCase()}{" "}
          certainty evidence.{" "}
          {variant === "industry"
            ? "Positions of this shape are the least stable in a guideline: the direction is firm but the evidence base supporting it is not."
            : "A named meta-research phenotype; check whether the guideline records a justification for the mismatch, as most do not."}
        </div>
      )}

      {variant === "industry" && (
        <div className="sig-block">
          <div className="sig-k">What this position is measured against</div>
          <p className="sig-p">
            <b>Comparator:</b> {rec.pico.comparator || "not stated in this record"}
          </p>
          <p className="sig-p">
            <b>Outcomes the guideline weighed:</b> {rec.pico.outcomes || "not stated in this record"}
          </p>
          <div className="sig-note">
            New evidence has to address this comparator and these outcomes to bear on the recommendation. RecMap holds
            no data on individual authors, panellists or their disclosures, and does not rank organisations — this lens
            tracks the evidence, not the people.
          </div>
        </div>
      )}

      {variant === "research" && rex && (
        <div className="sig-block">
          <div className="sig-k">Appraisal agreement</div>
          <p className="sig-p">
            {rex.itemsWithDisagreement} of 9 AGREE-REX items differed between the two appraisal passes; the two overall
            assessments {rex.overallAssessment.appraisersAgree ? "agreed" : "did not agree"}.
          </p>
          <div className="sig-note">
            Both passes are the same model run independently. That is a consistency check, not inter-rater reliability —
            a kappa or ICC computed from these two columns would be misleading.
          </div>
        </div>
      )}

      {related.length > 0 && (
        <div className={`sig-block${divergent.length > 0 ? " sig-block-flag" : ""}`}>
          <div className="sig-k">Other guidelines on {rec.clinicalArea.toLowerCase()} / {rec.aiDomain.toLowerCase()}</div>
          {divergent.length > 0 ? (
            <>
              <p className="sig-p">
                {divergent.length} of {related.length} other recommendation{related.length === 1 ? "" : "s"} in this
                catalog take a different direction on the same area and AI domain.
              </p>
              <ul className="sig-list">
                {divergent.slice(0, 5).map((p) => (
                  <li key={p.id}>
                    <b>{p.organization}</b> ({p.year}) — {p.directionRaw}, {p.gradeCertaintyLabel.toLowerCase()} certainty
                  </li>
                ))}
              </ul>
              <div className="sig-note">
                Matched on clinical area and AI domain only, not on a full PICO match — treat this as a pointer to check,
                not as an adjudicated disagreement.
              </div>
            </>
          ) : (
            <p className="sig-p">
              {related.length} other recommendation{related.length === 1 ? "" : "s"} in this catalog cover the same area
              and AI domain, all in the same direction.
            </p>
          )}
        </div>
      )}

      <style jsx global>{`
        .sig-wrap {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .sig-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        @media (max-width: 620px) {
          .sig-grid {
            grid-template-columns: 1fr;
          }
        }
        .sig {
          padding: 11px 13px;
          border: 1px solid var(--line-200);
          border-radius: 12px;
          background: var(--surface);
        }
        .sig-flag {
          border-color: var(--accent-border);
          background: var(--accent-bg);
        }
        .sig-k {
          font-size: 10.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--ink-400);
        }
        .sig-v {
          font-size: 14px;
          font-weight: 700;
          color: var(--ink-900);
          margin: 3px 0 4px;
          line-height: 1.3;
        }
        .sig-note {
          font-size: 11.5px;
          line-height: 1.55;
          color: var(--ink-500);
        }
        .sig-callout {
          padding: 11px 14px;
          border-radius: 10px;
          background: var(--against-bg);
          border: 1px solid var(--against-border);
          font-size: 12.5px;
          line-height: 1.6;
          color: var(--ink-800);
        }
        .sig-block {
          padding: 12px 14px;
          border: 1px solid var(--line-200);
          border-radius: 12px;
          background: var(--surface);
        }
        .sig-block-flag {
          border-color: var(--accent-border);
        }
        .sig-p {
          margin: 5px 0;
          font-size: 12.5px;
          line-height: 1.6;
          color: var(--ink-700);
        }
        .sig-list {
          margin: 6px 0 8px;
          padding-left: 18px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .sig-list li {
          font-size: 12.5px;
          line-height: 1.5;
          color: var(--ink-700);
        }
      `}</style>
    </section>
  );
}
