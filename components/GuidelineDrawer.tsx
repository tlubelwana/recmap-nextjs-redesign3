"use client";

import { useEffect } from "react";
import DirectionBadge from "@/components/DirectionBadge";
import GuidelineDetail from "@/components/GuidelineDetail";
import type { Guideline, GuidelineGroup } from "@/lib/types";

/** Slide-in drawer showing a source guideline document's full detail —
 *  one card's worth of AGREE II appraisal plus every recommendation
 *  statement extracted from it — mirroring the design-canvas prototype's
 *  #drawer/#scrim pattern. `group` is null when closed — the drawer stays
 *  mounted (for the CSS transform transition) but visually collapsed.
 *  `highlightRecommendationId` optionally marks which single recommendation
 *  the caller linked to (e.g. from a cited-guideline row in Ask), which
 *  still resolves correctly even though those older links carry a
 *  recommendation id rather than a guidelineId. */
export default function GuidelineDrawer({
  group,
  highlightRecommendationId,
  peers,
  onClose,
}: {
  group: GuidelineGroup | null;
  highlightRecommendationId?: string | null;
  /** The rest of the catalog, passed straight through to GuidelineDetail so
   *  the researcher and industry lenses can flag divergence. Optional. */
  peers?: Guideline[];
  onClose: () => void;
}) {
  useEffect(() => {
    if (!group) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [group, onClose]);

  const open = group !== null;
  const single = group && group.recommendations.length === 1 ? group.recommendations[0] : null;

  return (
    <>
      <div id="scrim" className={open ? "open" : ""} onClick={onClose} aria-hidden="true" />
      <aside id="drawer" className={open ? "open" : ""} aria-hidden={!open}>
        {group && (
          <>
            <div className="drawer-head">
              <div>
                <div className="drawer-badges">
                  {single ? (
                    <DirectionBadge guideline={single} />
                  ) : (
                    <span className="pill plain">{group.recommendations.length} recommendations</span>
                  )}
                  <span className="pill plain">{group.year}</span>
                  {group.agreeScoresEstimated && (
                    <span className="pill amber">AI appraisal</span>
                  )}
                </div>
                <h2 className="drawer-title">{group.guidelineTitle}</h2>
                <div className="drawer-org">{group.organization}</div>
              </div>
              <button
                type="button"
                className="icon-btn drawer-close"
                onClick={onClose}
                aria-label="Close details"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6L6 18" />
                  <path d="M6 6l12 12" />
                </svg>
              </button>
            </div>
            <GuidelineDetail group={group} highlightRecommendationId={highlightRecommendationId} peers={peers} />
          </>
        )}
      </aside>
    </>
  );
}
