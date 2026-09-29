import type { RecommendationType } from "@/lib/types";

/** Icon per GRADE(-adjacent) statement type — distinct enough at a glance
 *  that a clinician doesn't need to read the label to tell a formally
 *  graded Recommendation apart from a Good Practice Statement, Additional
 *  Guidance, or a Research Recommendation. Stroke-based, matching
 *  DirectionBadge's icon style. */
const ICON_PATHS: Record<RecommendationType, React.ReactNode> = {
  recommendation: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.5 2.5L16 9.5" />
    </>
  ),
  good_practice_statement: (
    <>
      <path d="M7 11v9H4v-9z" />
      <path d="M7 11l3.3-6.9a1.6 1.6 0 0 1 3 .9l-.6 4h4.6a2 2 0 0 1 1.9 2.6l-1.7 6A2 2 0 0 1 15.6 19H7" />
    </>
  ),
  additional_guidance: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5" />
      <path d="M12 7.5h.01" />
    </>
  ),
  research_recommendation: (
    <>
      <path d="M10 3h4" />
      <path d="M10.5 3v6l-4.8 8.2A1.7 1.7 0 0 0 7.2 20h9.6a1.7 1.7 0 0 0 1.5-2.8L13.5 9V3" />
    </>
  ),
};

/** Small pill distinguishing the 4 GRADE(-adjacent) statement types a
 *  single source guideline can issue. These carry different evidentiary
 *  weight (see lib/types.ts#RecommendationType), so the visual treatment
 *  is deliberately different for each — not just a label swap: a solid
 *  filled pill for a formally graded Recommendation, and three differently
 *  bordered/tinted outline pills for the others. Reused on catalog cards,
 *  the drawer detail view, and cited-guideline rows in Ask. */
export default function RecommendationTypeBadge({
  type,
  label,
  soft,
}: {
  type: RecommendationType;
  label: string;
  /** Flat, tinted treatment used on the catalog cards (v3 snapshot), where
   *  a row of solid pills would fight the guideline title for attention. */
  soft?: boolean;
}) {
  return (
    <>
      <span className={`rtype-badge rtype-${type}${soft ? " rtype-soft" : ""}`}>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {ICON_PATHS[type]}
        </svg>
        {label}
      </span>
      <style jsx global>{`
        .rtype-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 11.5px;
          font-weight: 700;
          border-radius: 999px;
          padding: 5px 11px;
          white-space: nowrap;
        }
        .rtype-badge svg {
          flex-shrink: 0;
        }
        .rtype-recommendation {
          color: #fff;
          background: var(--brand);
          border: 1px solid var(--brand);
        }
        .rtype-good_practice_statement {
          color: var(--favour);
          background: var(--favour-bg);
          border: 1px solid var(--favour-border);
        }
        .rtype-additional_guidance {
          color: var(--ink-600);
          background: var(--bg-alt);
          border: 1px solid var(--line-200);
        }
        .rtype-research_recommendation {
          color: var(--accent-ink);
          background: var(--accent-bg);
          border: 1px solid var(--accent-border);
        }
      `}</style>
    </>
  );
}
