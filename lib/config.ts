/** App-wide pipeline configuration: values that are either genuinely
 *  editable knobs (the AGREE II gate threshold) or dates about the search
 *  process itself. Centralized here so they're each set in exactly one
 *  place and easy to update as the underlying manuscript/protocol details
 *  are finalized. */

/**
 * Minimum AGREE II overall score (as a % of the 7-point scale) a guideline
 * must clear before its individual recommendations become eligible for a
 * second, recommendation-level AGREE-REX appraisal.
 *
 * NOTE ON PROVENANCE: the user's chronic-pain RecMap protocol (Wiley,
 * paywalled — not accessible to verify at the time this was implemented)
 * is cited as the source of this two-tier design, but its exact published
 * numeric cutoff could not be confirmed (both the protocol paper and its
 * companion paper returned access errors). 70% is used here as a
 * provisional placeholder — it matches a commonly-cited AGREE II
 * "recommended, possibly with modifications" cutoff in the wider
 * literature, NOT a number taken from that specific protocol. Update this
 * constant (and the label below) once the real threshold is confirmed —
 * everything that reads it (the gate logic, the About page, the
 * AGREE-REX section) will pick up the change automatically.
 */
/**
 * HOW CLOSELY RecMap's AI AGREE II APPRAISAL TRACKS A HUMAN APPRAISER.
 *
 * The pipeline scores against the AGREE II instrument with knowledge-graph
 * support and is benchmarked on human appraisals; the figure below is the
 * reported similarity between its scores and a human appraiser's.
 *
 * PROVENANCE — READ BEFORE CITING: this is currently an approximate,
 * internally-reported figure. The exact statistic it represents has not
 * been pinned down yet: "80% similar" could mean exact item-score
 * agreement, agreement within one point, or an ICC/correlation, and those
 * are materially different claims that a reviewer will ask about. Until
 * that is settled, AI_APPRAISAL_METRIC_LABEL deliberately says "similar …
 * in internal comparison" rather than naming a statistic, and
 * AI_APPRAISAL_SIMILARITY_IS_PROVISIONAL stays true.
 *
 * TO UPDATE: change the three constants here and the wording follows
 * everywhere it is shown — components/GuidelineDetail.tsx (the record-level
 * disclosure), lib/chatPrompt.ts (what the assistant is told), and
 * lib/audienceLens.ts (the researcher lens caveat). Nothing else hard-codes
 * the number.
 */
export const AI_APPRAISAL_SIMILARITY_PCT = 80;

export const AI_APPRAISAL_SIMILARITY_IS_PROVISIONAL = true;

/** Completes the sentence "…gives scores about <N>% ___". Replace with the
 *  real statistic once it's confirmed, e.g. "agreement with human appraisers
 *  at the item level (within one point, n = 13 guidelines)". */
export const AI_APPRAISAL_METRIC_LABEL =
  "similar to a human appraiser's scores in internal comparison";

export const AGREE_GATE_THRESHOLD_PCT = 70;

export const AGREE_GATE_THRESHOLD_IS_PROVISIONAL = true;

export function passesAgreeGate(overall7: number): boolean {
  return (overall7 / 7) * 100 >= AGREE_GATE_THRESHOLD_PCT;
}

/**
 * Search-cadence display (About page / nav). "Last searched" reflects the
 * manuscript-in-preparation's description of the search running "throughout
 * the spring months of 2026" — the last day of that window is used as a
 * concrete stand-in date. "Next searched" is a provisional 6-month cadence,
 * not a confirmed re-search date — both are clearly labeled as such
 * wherever they're shown.
 */
export const LAST_SEARCHED_ISO = "2026-05-31";
export const NEXT_SEARCH_ISO = "2026-11-30";
export const SEARCH_CADENCE_IS_PROVISIONAL = true;

/**
 * A narrated walkthrough video was produced (10 scenes: script, narration,
 * images, and short clips) but was never assembled into one hosted video
 * file — see the editable ElevenLabs flow handed off separately. Once that
 * video is rendered and uploaded somewhere public (e.g. an unlisted
 * YouTube/Vimeo link), set this to that URL and app/(authed)/(main)/help
 * will embed/link it automatically. Left null rather than pointing at a
 * private, edit-only flow link that end users of the app couldn't open.
 */
export const VIDEO_WALKTHROUGH_URL: string | null = null;

/** Set NEXT_PUBLIC_UPLOAD_FEATURE_ENABLED=true for a controlled deployment workflow. */
export const UPLOAD_FEATURE_ENABLED = process.env.NEXT_PUBLIC_UPLOAD_FEATURE_ENABLED === "true";

/** Public demo access skips account credentials and is for demonstrations only. */
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
