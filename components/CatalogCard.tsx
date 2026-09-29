"use client";

import DirectionBadge from "@/components/DirectionBadge";
import { ClassificationNoteDot, GradeCertaintyBadge } from "@/components/GradeCertaintyBadge";
import RecommendationTypeBadge from "@/components/RecommendationTypeBadge";
import OrgLogo from "@/components/OrgLogo";
import { useAudienceLens } from "@/components/LensProvider";
import {
  AGREE_ITEM_MONITORING,
  AGREE_ITEM_PATIENT_VIEWS,
  AGREE_ITEM_RESOURCE,
  currency,
  findAgreeItem,
  itemVerdict,
} from "@/lib/audienceLens";
import { strengthInWords } from "@/lib/plainLanguage";
import type { GuidelineGroup } from "@/lib/types";

/** One source guideline document. AGREE II (rigor of development) is
 *  scored once for the whole group and shown top-right as before; GRADE
 *  certainty (trust in the evidence) now gets equal visual weight next to
 *  it rather than being invisible. When the group has exactly one
 *  recommendation (true for every guideline in the current dataset, but
 *  not guaranteed), its type/direction badges surface directly on the
 *  card; with more than one, each gets its own compact row. Clicking
 *  anywhere on the card opens the full drawer either way. */
export default function CatalogCard({
  group,
  onOpen,
}: {
  group: GuidelineGroup;
  onOpen: (group: GuidelineGroup) => void;
}) {
  const { lens } = useAudienceLens();
  const recs = group.recommendations;
  const single = recs.length === 1 ? recs[0] : null;
  const aiDomains = Array.from(new Set(recs.map((r) => r.aiDomain).filter(Boolean))).join(" · ");

  // The card's headline figures follow the lens. A clinician scanning the
  // catalog wants AGREE II and certainty; a policymaker wants to know whether
  // resource use and monitoring were addressed at all; someone with lived
  // experience wants to know how much of it is their call and whether anyone
  // asked people like them. Same record, different first glance.
  const lensChips = summaryChips();
  // AGREE II, statement type and GRADE certainty all have their own chip
  // or badge on the card already — showing them again in the lens row
  // was pure duplication.
  const otherLensChips = lensChips.filter(
    (c) => c.k !== "AGREE II" && c.k !== "Type" && c.k !== "Certainty"
  );
  // The snapshot shows AGREE II as a percentage of the 7-point scale, which
  // is also how lib/config.ts states the quality gate.
  const agreePct = Math.round((group.agree.overall7 / 7) * 100);

  function summaryChips(): { k: string; v: string; tone?: "flag" | "good" }[] {
    const rec = single ?? recs[0];
    const out: { k: string; v: string; tone?: "flag" | "good" }[] = [];
    for (const field of lens.summary) {
      switch (field) {
        case "agree":
          out.push({ k: "AGREE II", v: `${group.agree.overall7.toFixed(1)}/7` });
          break;
        case "grade":
          out.push({ k: "Certainty", v: rec.gradeCertaintyLabel });
          break;
        case "strength_plain": {
          const sw = strengthInWords(rec.strength);
          out.push({
            k: "Your call?",
            v: sw.yourCall === "genuinely your call" ? "Yes — this is a judgement call" : sw.headline,
            tone: sw.yourCall === "genuinely your call" ? "flag" : undefined,
          });
          break;
        }
        case "rec_type":
          if (rec.recommendationType !== "recommendation") {
            out.push({ k: "Type", v: rec.recommendationTypeLabel, tone: "flag" });
          } else {
            out.push({ k: "Type", v: rec.recommendationTypeLabel });
          }
          break;
        case "implementability": {
          const rex = rec.agreeRex.status === "appraised" ? rec.agreeRex.rex : null;
          const d = rex?.domains.find((x) => x.key === "implementability");
          out.push({
            k: "Implementability",
            v: d ? `${Math.round(d.score01 * 100)}%` : "Not appraised",
            tone: d && d.score01 < 0.5 ? "flag" : undefined,
          });
          break;
        }
        case "resource_item": {
          const it = findAgreeItem(group.agree, AGREE_ITEM_RESOURCE);
          const verdict = itemVerdict(it?.score);
          out.push({ k: "Cost addressed", v: verdict.label, tone: verdict.tone === "absent" ? "flag" : undefined });
          break;
        }
        case "monitoring_item": {
          const it = findAgreeItem(group.agree, AGREE_ITEM_MONITORING);
          const verdict = itemVerdict(it?.score);
          out.push({ k: "Measurable", v: verdict.label, tone: verdict.tone === "absent" ? "flag" : undefined });
          break;
        }
        case "currency": {
          const c = currency(group);
          out.push({ k: "Currency", v: c.label, tone: c.tone === "overdue" ? "flag" : undefined });
          break;
        }
        case "grading_approach":
          out.push({
            k: "Grading",
            v: rec.gradingApproachLabel,
            tone: rec.gradingApproach !== "GRADE" ? "flag" : undefined,
          });
          break;
        case "equity":
          out.push({
            k: "Equity",
            v: rec.equity.evaluated ? "Assessed" : "Not assessed",
            tone: rec.equity.evaluated ? undefined : "flag",
          });
          break;
        case "patient_involvement": {
          const it = findAgreeItem(group.agree, AGREE_ITEM_PATIENT_VIEWS);
          const asked = (it?.score ?? 0) >= 4;
          out.push({
            k: "Patients asked?",
            v: it ? (asked ? "Yes" : "Not really") : "Unknown",
            tone: asked ? "good" : "flag",
          });
          break;
        }
        default:
          break;
      }
    }
    return out;
  }

  return (
    <button type="button" className="cat-card" onClick={() => onOpen(group)}>
      <div className="cat-card-logo">
        <OrgLogo organization={group.organization} width={190} height={46} fallback="name" />
      </div>
      <div className="cat-card-year">{group.year}</div>
      <h3 className="cat-card-title">{group.guidelineTitle}</h3>

      <div className="cat-card-chips">
        {lens.summary.includes("agree") && (
          <span className="cat-chip cat-chip-agree">
            <span className="cat-chip-k">AGREE&nbsp;II</span>
            <span className="cat-chip-v">{agreePct}%</span>
          </span>
        )}
        {single && <RecommendationTypeBadge type={single.recommendationType} label={single.recommendationTypeLabel} soft />}
        {group.agreeScoresEstimated && <span className="pill amber">AI appraisal</span>}
      </div>

      {single ? (
        <div className="cat-card-foot">
          <DirectionBadge guideline={single} />
          {lens.summary.includes("grade") && (
            <GradeCertaintyBadge level={single.gradeCertaintyLevel} label={single.gradeCertaintyLabel} compact />
          )}
          {single.classificationNote && <ClassificationNoteDot note={single.classificationNote} />}
        </div>
      ) : (
        <div className="cat-card-recs">
          {recs.map((rec) => (
            <div className="cat-rec-row" key={rec.id}>
              <RecommendationTypeBadge type={rec.recommendationType} label={rec.recommendationTypeLabel} soft />
              <DirectionBadge guideline={rec} />
              <GradeCertaintyBadge level={rec.gradeCertaintyLevel} label={rec.gradeCertaintyLabel} compact />
              {rec.classificationNote && <ClassificationNoteDot note={rec.classificationNote} />}
            </div>
          ))}
        </div>
      )}

      {/* The lens summary the persona system drives. AGREE II and statement
          type already appear above in the snapshot's own chips, so they're
          filtered out here rather than shown twice. */}
      {otherLensChips.length > 0 && (
        <div className="cat-lens-chips" aria-label={`Summary for ${lens.label}`}>
          {otherLensChips.map((c, i) => (
            <span className={`cat-lens-chip${c.tone ? ` cat-lens-chip-${c.tone}` : ""}`} key={i}>
              <span className="cat-lens-chip-k">{c.k}</span>
              <span className="cat-lens-chip-v">{c.v}</span>
            </span>
          ))}
        </div>
      )}

      <div className="cat-card-meta">
        {group.clinicalArea} · {group.worldRegion}
        {aiDomains ? ` · ${aiDomains}` : ""}
      </div>

      <style jsx global>{`
        .cat-card-scores {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }
        .cat-lens-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
          margin: 2px 0;
        }
        .cat-lens-chip {
          display: inline-flex;
          align-items: baseline;
          gap: 5px;
          padding: 3px 8px;
          border-radius: 999px;
          border: 1px solid var(--line-200);
          background: var(--bg-alt);
          font-size: 11px;
          line-height: 1.4;
        }
        .cat-lens-chip-k {
          color: var(--ink-400);
          font-weight: 600;
        }
        .cat-lens-chip-v {
          color: var(--ink-800);
          font-weight: 700;
        }
        .cat-lens-chip-flag {
          border-color: var(--accent-border);
          background: var(--accent-bg);
        }
        .cat-lens-chip-good {
          border-color: var(--favour-border);
          background: var(--favour-bg);
        }
        .cat-card-recs {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-top: 2px;
        }
        .cat-rec-row {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
      `}</style>
    </button>
  );
}
