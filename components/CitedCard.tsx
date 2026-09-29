"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AgreeDomains from "@/components/AgreeDomains";
import { GradeCertaintyBadge } from "@/components/GradeCertaintyBadge";
import OrgLogo from "@/components/OrgLogo";
import { directionLabel, directionVisual } from "@/components/format";
import type { Guideline } from "@/lib/types";

/**
 * One "Guidelines referenced" row under a chat answer, laid out per the v3
 * snapshot: organisation logo, organisation and year, a direction pill, the
 * AGREE II and GRADE badges, and a chevron through to the full record.
 *
 * The AGREE and GRADE badges stay clickable (they open the inline score
 * drawer they always did) — the snapshot shows them as flat chips, but
 * losing the ability to see a domain breakdown without leaving the answer
 * would be a real regression, so they keep their button behaviour and get
 * a hover state to advertise it.
 */
export default function CitedCard({ guideline }: { guideline: Guideline }) {
  const router = useRouter();
  const [scoreDrawer, setScoreDrawer] = useState<"agree" | "grade" | null>(null);
  const visual = directionVisual(guideline.direction);

  function openCatalog() {
    router.push(`/catalog?guideline=${encodeURIComponent(guideline.id)}`);
  }

  return (
    <>
      <div
        className={`ref-row dir-${visual}`}
        role="link"
        tabIndex={0}
        onClick={openCatalog}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openCatalog();
          }
        }}
      >
        <OrgLogo organization={guideline.organization} />

        <div className="ref-mid">
          <div className="ref-org">{guideline.organization}</div>
          <div className="ref-year" title={guideline.guidelineTitle}>
            {guideline.year}
          </div>
        </div>

        <div className="ref-meta">
          <span className={`ref-dir dir-${visual}`}>{directionLabel(guideline)}</span>

          <div className="ref-scores">
          <button
            type="button"
            className={`ref-chip${scoreDrawer === "agree" ? " active" : ""}`}
            onClick={(event) => {
              event.stopPropagation();
              setScoreDrawer(scoreDrawer === "agree" ? null : "agree");
            }}
            aria-expanded={scoreDrawer === "agree"}
          >
            AGREE II {guideline.agree.overall7.toFixed(1)}/7
          </button>
          <button
            type="button"
            className={`ref-chip${scoreDrawer === "grade" ? " active" : ""}`}
            onClick={(event) => {
              event.stopPropagation();
              setScoreDrawer(scoreDrawer === "grade" ? null : "grade");
            }}
            aria-expanded={scoreDrawer === "grade"}
          >
              GRADE: {guideline.gradeCertaintyLabel}
            </button>
          </div>
        </div>

        <span className="ref-chevron" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m9 6 6 6-6 6" />
          </svg>
        </span>
      </div>

      {scoreDrawer && (
        <div className="cited-score-drawer" onClick={(event) => event.stopPropagation()}>
          <div className="cited-score-drawer-head">
            <div>
              <div className="eyebrow">{scoreDrawer === "agree" ? "AGREE II score" : "GRADE certainty"}</div>
              <strong>
                {scoreDrawer === "agree"
                  ? `Overall AGREE II score: ${guideline.agree.overall7.toFixed(2)} / 7`
                  : `GRADE certainty: ${guideline.gradeCertaintyLabel}`}
              </strong>
            </div>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setScoreDrawer(null)}
              aria-label="Close score details"
            >
              ×
            </button>
          </div>
          {scoreDrawer === "agree" ? (
            <>
              <AgreeDomains domains={guideline.agree.domains} overall7={guideline.agree.overall7} />
              <p className="cited-score-note">
                AGREE II measures how rigorously the guideline was <i>developed</i>. It says nothing about how
                strong the underlying clinical evidence is — that is what GRADE certainty is for.
              </p>
            </>
          ) : (
            <p className="cited-score-note">
              GRADE certainty describes confidence in the underlying evidence. It is separate from AGREE II,
              which measures how rigorously the guideline was developed.
            </p>
          )}
        </div>
      )}

      <style jsx global>{`
        .org-logo {
          flex-shrink: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          background: transparent;
        }
        .org-logo img {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
        }
        .org-logo-slot { flex-shrink: 0; }
        .org-logo-fallback {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          background: var(--bg-alt);
          border: 1px solid var(--line-200);
          font-size: 13px;
          font-weight: 800;
          color: var(--ink-600);
          letter-spacing: 0.02em;
        }
        .ref-row {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 16px 26px;
          width: 100%;
          padding: 22px 24px;
          border: 1px solid #eceff0;
          border-radius: 12px;
          background: var(--surface);
          cursor: pointer;
          text-align: left;
          color: inherit;
          box-shadow: 0 1px 2px rgba(16, 40, 42, 0.04);
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .ref-row:hover {
          border-color: var(--accent-border);
          box-shadow: 0 3px 14px rgba(13, 77, 80, 0.08);
        }
        .ref-mid {
          flex: 1 1 210px;
          min-width: 0;
        }
        /* Direction pill and the two score chips travel together, and drop
           to their own line as a group rather than breaking apart. */
        .ref-meta {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          margin-left: auto;
          min-width: 0;
        }
        .ref-org {
          font-size: 17px;
          font-weight: 700;
          color: var(--ink-900);
          line-height: 1.35;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .ref-year {
          margin-top: 4px;
          font-size: 14px;
          color: var(--ink-500);
        }
        .ref-dir {
          flex-shrink: 0;
          min-width: 104px;
          text-align: center;
          font-size: 14px;
          font-weight: 600;
          padding: 12px 28px;
          border-radius: 999px;
          white-space: nowrap;
        }
        .ref-dir.dir-for {
          background: #d8f0dd;
          color: #1a7a3c;
        }
        .ref-dir.dir-against {
          background: var(--against-bg);
          color: var(--against);
        }
        .ref-dir.dir-neutral {
          background: var(--neutral-bg);
          color: var(--neutral);
        }
        .ref-scores {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-shrink: 0;
        }
        .ref-chip {
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.02em;
          padding: 10px 14px;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          border-radius: 8px;
          border: 1px solid transparent;
          background: #e6eff5;
          color: #3f6c78;
          white-space: nowrap;
          cursor: pointer;
        }
        .ref-chip:hover,
        .ref-chip.active {
          background: var(--accent-bg);
          border-color: var(--accent-border);
          color: var(--brand-ink);
        }
        .ref-chevron {
          flex-shrink: 0;
          width: 23px;
          height: 23px;
          color: #9fadad;
          display: inline-flex;
        }
        .ref-chevron svg {
          width: 100%;
          height: 100%;
        }
        .ref-row:hover .ref-chevron {
          color: var(--brand-ink);
        }
        .cited-score-drawer {
          margin: -4px 0 12px;
          padding: 16px;
          background: var(--surface);
          border: 1px solid var(--line-200);
          border-top: 0;
          border-radius: 0 0 var(--card-radius) var(--card-radius);
          cursor: default;
        }
        .cited-score-drawer-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 12px;
        }
        .cited-score-drawer-head strong {
          display: block;
          margin-top: 4px;
          color: var(--ink-900);
          font-size: 14px;
        }
        .cited-score-note {
          margin: 12px 0 0 0;
          color: var(--ink-600);
          font-size: 13px;
          line-height: 1.6;
        }
        @media (max-width: 900px) {
          .ref-row {
            gap: 12px 16px;
            padding: 18px;
          }
          .ref-meta {
            margin-left: 0;
          }
          .ref-chevron {
            display: none;
          }
        }
      `}</style>
    </>
  );
}
