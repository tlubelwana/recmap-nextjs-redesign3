"use client";

import { useEffect, useRef } from "react";
import AgreeDomains from "@/components/AgreeDomains";
import AgreeRexSection from "@/components/AgreeRexSection";
import ClinicalCodingPanel from "@/components/ClinicalCodingPanel";
import DirectionBadge from "@/components/DirectionBadge";
import EquitySection from "@/components/EquitySection";
import EvidencePanel from "@/components/EvidencePanel";
import EvidenceSignalsPanel from "@/components/EvidenceSignalsPanel";
import PlainLanguagePanel from "@/components/PlainLanguagePanel";
import PolicyPanel from "@/components/PolicyPanel";
import { ClassificationNoteDot, GradeCertaintySection } from "@/components/GradeCertaintyBadge";
import RecommendationTypeBadge from "@/components/RecommendationTypeBadge";
import { useAudienceLens } from "@/components/LensProvider";
import { AI_APPRAISAL_METRIC_LABEL, AI_APPRAISAL_SIMILARITY_PCT } from "@/lib/config";
import { formatDate } from "@/components/format";
import { frameRecommendation, sectionLabel, type SectionKey } from "@/lib/audienceLens";
import { provenance } from "@/lib/plainLanguage";
import type { Guideline, GuidelineGroup } from "@/lib/types";
import DeviceLifecyclePanel from "@/components/DeviceLifecyclePanel";

/**
 * The full body of a guideline document's detail view, rendered THROUGH THE
 * CURRENT AUDIENCE LENS.
 *
 * The same record produces six materially different pages. What changes is
 * which sections appear, in what order, under what headings, and with what
 * framing sentence on top — all of it declared in lib/audienceLens.ts, none
 * of it branched on inline here beyond the section switch below. What never
 * changes is the underlying data: a lens reorders, renames, translates and
 * suppresses, but no lens adds a fact and no lens softens one.
 *
 * Sections that belong to the guideline DOCUMENT rather than to an individual
 * recommendation (the AGREE II domain breakdown) are rendered once, before or
 * after the recommendation list depending on where the lens ranks them —
 * a guideline developer opens on the appraisal, a clinician opens on the
 * recommendation.
 */
export default function GuidelineDetail({
  group,
  highlightRecommendationId,
  peers,
}: {
  group: GuidelineGroup;
  highlightRecommendationId?: string | null;
  /** The rest of the catalog, when the caller has it — lets the evidence-
   *  signals section point out other guidelines taking a different position.
   *  Safely omitted. */
  peers?: Guideline[];
}) {
  const { lens } = useAudienceLens();
  const highlightRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (highlightRecommendationId) {
      highlightRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightRecommendationId, group.guidelineId]);

  const uploadedInfo = group.recommendations.find((r) => r.uploaded)?.uploaded;

  // AGREE II is a property of the document, not of one recommendation, so it
  // is rendered once. Its position follows the lens: above the recommendations
  // for the audiences who read the appraisal first, below for everyone else.
  const agreeIdx = lens.sections.indexOf("agree_domains");
  const recIdx = lens.sections.indexOf("recommendation");
  const showAgree = agreeIdx >= 0;
  const agreeFirst = showAgree && (recIdx < 0 || agreeIdx < recIdx);

  const agreeBlock = showAgree ? (
    <div className="lens-section">
      <div className="lens-gloss">
        {sectionLabel(lens, "agree_domains", "AGREE II — how rigorously this guideline was developed")}
      </div>
      <AgreeDomains domains={group.agree.domains} overall7={group.agree.overall7} />
    </div>
  ) : null;

  function renderSection(key: SectionKey, rec: Guideline): React.ReactNode {
    switch (key) {
      case "plain_language":
        return <PlainLanguagePanel key={key} rec={rec} group={group} />;

      case "recommendation":
        return (
          <div key={key} className="lens-section">
            <div className="rec-section-badges">
              <RecommendationTypeBadge type={rec.recommendationType} label={rec.recommendationTypeLabel} />
              <DirectionBadge guideline={rec} />
              {rec.classificationNote && <ClassificationNoteDot note={rec.classificationNote} />}
            </div>
            <div className="lens-frame">{frameRecommendation(lens, rec, group)}</div>
            <div className="dsec-plain">
              <p>{rec.recommendationText}</p>
            </div>
            <div className="rec-section-meta">
              {rec.strength} strength · {rec.ageGroup}
              {rec.aiDomain ? ` · ${rec.aiDomain}` : ""}
            </div>
          </div>
        );

      case "grade":
        return (
          <div key={key} className="lens-section">
            {lens.vocabulary.grade && <div className="lens-gloss">{lens.vocabulary.grade}</div>}
            <GradeCertaintySection
              level={rec.gradeCertaintyLevel}
              label={rec.gradeCertaintyLabel}
              rawCertainty={rec.certainty}
              gradingApproachLabel={rec.gradingApproachLabel}
            />
          </div>
        );

      case "agree_rex":
        return (
          <div key={key} className="lens-section">
            {lens.vocabulary.agree_rex && <div className="lens-gloss">{lens.vocabulary.agree_rex}</div>}
            <AgreeRexSection agreeRex={rec.agreeRex} />
          </div>
        );

      case "policy":
        return (
          <div key={key} className="lens-section">
            <div className="lens-section-h">Decision brief — cost, feasibility, measurement, defensibility</div>
            <PolicyPanel rec={rec} group={group} />
          </div>
        );

      case "evidence_signals":
        return (
          <div key={key} className="lens-section">
            <div className="lens-section-h">
              {sectionLabel(lens, "evidence_signals", "Evidence-base signals")}
            </div>
            <EvidenceSignalsPanel
              rec={rec}
              group={group}
              peers={peers}
              variant={lens.key === "industry" ? "industry" : "research"}
            />
          </div>
        );

      case "provenance": {
        const p = provenance(group);
        return (
          <div key={key} className="lens-section prov-block">
            <div className="lens-section-h">{sectionLabel(lens, "provenance", "Who wrote this, and who paid for it")}</div>
            <p className="prov-p">
              Written by <b>{p.organization}</b> and published in <b>{p.year}</b>. Last checked by RecMap on{" "}
              {formatDate(group.lastCheckedISO)}.
            </p>
            <p className="prov-p">
              <b>Funding:</b>{" "}
              {p.fundingNote ??
                "This guideline hasn't been appraised on whether the funder's influence was addressed."}
              {p.fundingScore !== null && <span className="prov-score"> ({p.fundingScore}/7)</span>}
            </p>
            <p className="prov-p">
              <b>Competing interests:</b>{" "}
              {p.interestsNote ??
                "This guideline hasn't been appraised on whether competing interests were recorded."}
              {p.interestsScore !== null && <span className="prov-score"> ({p.interestsScore}/7)</span>}
            </p>
            <p className="prov-note">
              These two answers come from AGREE&nbsp;II items 22 and 23, which check whether the guideline says who paid
              for it and whether the people who wrote it declared their interests. They don&rsquo;t say the guideline is
              biased &mdash; only how openly it dealt with the question.
            </p>
          </div>
        );
      }

      case "pico": {
        const outcomes = rec.pico.outcomes
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        return (
          <div key={key} className="lens-section">
            <div className="dsec-label">{sectionLabel(lens, "pico", "PICO")}</div>
            <div className="pico-grid">
              <div className="pico-row">
                <div className="pk">Population</div>
                <div className="pv">{rec.pico.population}</div>
              </div>
              <div className="pico-row">
                <div className="pk">Intervention</div>
                <div className="pv">{rec.pico.intervention}</div>
              </div>
              <div className="pico-row">
                <div className="pk">Comparator</div>
                <div className="pv">{rec.pico.comparator}</div>
              </div>
              <div className="pico-row">
                <div className="pk">Outcomes</div>
                <div className="pv">
                  <div className="outcome-tags">
                    {outcomes.length > 0 ? (
                      outcomes.map((o, oi) => (
                        <span className="outcome-tag" key={oi}>
                          {o}
                        </span>
                      ))
                    ) : (
                      <span>—</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      }

      case "coding":
        return <ClinicalCodingPanel key={key} coding={rec.coding} />;

      case "equity":
        return (
          <div key={key} className="lens-section">
            {lens.vocabulary.equity && <div className="lens-gloss">{lens.vocabulary.equity}</div>}
            <EquitySection equity={rec.equity} />
          </div>
        );

      case "evidence":
        return (
          <div key={key} className="lens-section">
            {lens.vocabulary.evidence && <div className="lens-gloss">{lens.vocabulary.evidence}</div>}
            <EvidencePanel evidence={rec.evidence} pdfFile={group.pdfFile} />
          </div>
        );

      default:
        return null;
    }
  }

  return (
    <div className="drawer-body">
      <div className="lens-caveat" data-lens={lens.key}>
        <span className="lens-caveat-k">Reading this {lens.asA}</span>
        <p>{lens.caveat}</p>
      </div>

      {group.agreeScoresEstimated && uploadedInfo && (
        <div className="estimate-note">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
            <path d="M10.29 3.86l-8.18 14.18A1.5 1.5 0 0 0 3.5 20.5h17a1.5 1.5 0 0 0 1.39-2.46L13.71 3.86a1.5 1.5 0 0 0-2.42 0z" />
          </svg>
          <span>
            <b>AI-generated AGREE&nbsp;II appraisal.</b> This guideline was added via Upload on{" "}
            {formatDate(uploadedInfo.addedAt)} from &ldquo;{uploadedInfo.sourceFileName}&rdquo;. The domain and
            item scores below come from RecMap&rsquo;s appraisal pipeline, which scores against the AGREE&nbsp;II
            instrument using a knowledge graph and is benchmarked on human appraisals &mdash; it gives scores
            about {AI_APPRAISAL_SIMILARITY_PCT}% {AI_APPRAISAL_METRIC_LABEL}. No human reviewer has appraised
            this particular document, so check it against the source before relying on it for a decision.
          </span>
        </div>
      )}

      {agreeFirst && agreeBlock}

      <DeviceLifecyclePanel rec={group.recommendations[0]} />

      <div className="rec-list-detail">
        <div className="dsec-label">
          {group.recommendations.length === 1
            ? "Recommendation"
            : `Recommendations (${group.recommendations.length})`}
        </div>
        {group.recommendations.map((rec, i) => {
          const highlighted = rec.id === highlightRecommendationId;
          return (
            <div
              key={rec.id}
              ref={highlighted ? highlightRef : undefined}
              className={`rec-section${highlighted ? " rec-section-highlight" : ""}`}
            >
              {group.recommendations.length > 1 && (
                <div className="rec-section-index">
                  Recommendation {i + 1} of {group.recommendations.length}
                </div>
              )}
              {lens.sections
                .filter((s) => s !== "agree_domains")
                .map((s) => renderSection(s, rec))}
            </div>
          );
        })}
      </div>

      {!agreeFirst && agreeBlock}

      <div className="source-line">
        <span>
          {group.source} · {group.region} · Last checked {formatDate(group.lastCheckedISO)}
        </span>
      </div>
      {group.pdfFile && (
        <a
          className="source-pdf-link"
          href={`/data/pdfs/${group.pdfFile}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          View source PDF
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M7 17L17 7" />
            <path d="M7 7h10v10" />
          </svg>
        </a>
      )}

      <style jsx global>{`
        .rec-list-detail {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }
        .rec-section {
          display: flex;
          flex-direction: column;
          gap: 14px;
          padding: 14px;
          border: 1px solid var(--line-200);
          border-radius: 12px;
          background: var(--surface);
        }
        .rec-section-highlight {
          border-color: var(--accent-border);
          box-shadow: 0 0 0 3px var(--accent-bg);
        }
        .rec-section-index {
          font-size: 11px;
          font-weight: 700;
          color: var(--ink-400);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .rec-section-badges {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .rec-section-meta {
          font-size: 12px;
          color: var(--ink-500);
        }
        .lens-section {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .lens-section-h {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--ink-400);
        }
        /* A lens gloss reframes a section that already has its own heading —
           "Certainty of evidence (GRADE) — how defensible is this position"
           above the GRADE panel. Styled as a caption rather than a second
           uppercase header so it reads as framing, not duplication. */
        .lens-gloss {
          font-size: 12px;
          line-height: 1.5;
          color: var(--ink-500);
          padding-left: 9px;
          border-left: 2px solid var(--line-200);
        }
        .lens-frame {
          font-size: 13.5px;
          font-weight: 600;
          line-height: 1.55;
          color: var(--ink-800);
          padding: 9px 12px;
          border-left: 3px solid var(--brand);
          background: var(--bg-alt);
          border-radius: 0 8px 8px 0;
        }
        .lens-caveat {
          padding: 11px 14px;
          border: 1px solid var(--line-200);
          border-radius: 12px;
          background: var(--bg-alt);
        }
        .lens-caveat-k {
          display: block;
          font-size: 10.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--ink-400);
          margin-bottom: 4px;
        }
        .lens-caveat p {
          margin: 0;
          font-size: 12.5px;
          line-height: 1.6;
          color: var(--ink-600);
        }
        .prov-block {
          padding: 12px 14px;
          border: 1px solid var(--line-200);
          border-radius: 12px;
          background: var(--surface);
        }
        .prov-p {
          margin: 0;
          font-size: 13px;
          line-height: 1.6;
          color: var(--ink-700);
        }
        .prov-score {
          color: var(--ink-400);
          font-size: 12px;
        }
        .prov-note {
          margin: 4px 0 0;
          font-size: 11.5px;
          line-height: 1.55;
          color: var(--ink-500);
        }
      `}</style>
    </div>
  );
}
