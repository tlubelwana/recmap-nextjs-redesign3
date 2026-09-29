// Shared data model for RecMap. This mirrors the structure already extracted
// from the AGREE II / recommendation Excel workbooks (see data/guidelines.json,
// produced by scripts/ingest.ts) plus what a newly uploaded guideline gets
// filled in with by the /api/upload LLM pipeline.

export interface AgreeItem {
  num: number;
  text: string;
  /** Item-level AGREE II score, out of 7. */
  score: number;
  /** Free-text appraisal note explaining the score (from the source workbook,
   *  or from RecMap's AI appraisal pipeline for an uploaded guideline). */
  appraisal: string;
}

export interface AgreeDomain {
  key:
    | "scope_purpose"
    | "stakeholder_involvement"
    | "rigour_of_development"
    | "clarity_of_presentation"
    | "applicability"
    | "editorial_independence";
  label: string;
  short: string;
  /** Normalized 0-1 domain score. */
  score01: number;
  /** Domain score expressed out of 7, for display. */
  score7: number;
  items: AgreeItem[];
}

export interface AgreeAppraisal {
  domains: AgreeDomain[];
  /** Weighted overall score out of 7, for display. */
  overall7: number;
}

// --- AGREE-REX (recommendation-level trust score) ----------------------

/** The 9 AGREE-REX items across its 3 domains (Clinical Applicability,
 *  Values and Preferences, Implementability), each scored 1 (lowest) to 7
 *  (highest) — same scale and normalization formula as AGREE II. Source:
 *  the official AGREE-REX instrument (agreetrust.org). Unlike AGREE II,
 *  AGREE-REX judges the trustworthiness of an individual RECOMMENDATION,
 *  not the rigor of the guideline-development process that produced it. */
export interface AgreeRexItem {
  num: number;
  text: string;
  /** Mean of the two independent appraisal passes, 1-7. */
  score: number;
  scoreA: number;
  scoreB: number;
  /** |scoreA - scoreB|. The appraisal method used to build this dataset
   *  flags an item "Review" only at a difference of 2 or more (see
   *  `AgreeRexResult.method`) — most non-zero differences here are 1 point. */
  difference: number;
  rationaleA: string;
  rationaleB: string;
}

export type AgreeRexDomainKey = "clinical_applicability" | "values_and_preferences" | "implementability";

export interface AgreeRexDomain {
  key: AgreeRexDomainKey;
  label: string;
  /** Standardised domain score as a fraction (0-1), per AGREE-REX's own
   *  formula: (obtained - min possible) / (max possible - min possible).
   *  This is NOT simply the mean item score rescaled — it's the same
   *  normalization AGREE II uses, carried over unchanged. */
  score01: number;
  /** score01 x 7, shown as "x.x/7" so this domain reads on the same visual
   *  scale as AGREE II above it. The real, source-of-truth number is the
   *  standardised percentage (score01 x 100) — see AgreeRexResult.domainPct. */
  score7: number;
  items: AgreeRexItem[];
}

/**
 * A completed AGREE-REX appraisal for one recommendation, from a real,
 * spreadsheet-sourced appraisal (AGREEREX_results.xlsx) rather than a
 * placeholder. IMPORTANT — this is an AI-generated first-pass appraisal,
 * not a validated substitute for trained human appraisers: every score
 * should be checked against the source guideline PDF before being relied
 * on for a real decision. `method` carries that caveat so the UI never
 * shows a score without it.
 */
export interface AgreeRexResult {
  domains: AgreeRexDomain[];
  /** Mean across all 9 items, 1-7. AGREE-REX defines no official total
   *  score — this "All items" figure is supplementary/descriptive only,
   *  per the source workbook's own README. Never present it as an
   *  official composite the way AGREE II's overall score is. */
  overall7: number;
  /** Same figure as overall7, as a 0-100 percentage, for direct display
   *  alongside the domain percentages. */
  overallPct: number;
  /** The two appraisers' free-text overall judgement plus whether they
   *  agreed - not a numeric score. */
  overallAssessment: {
    appraiserA: string;
    appraiserB: string;
    appraisersAgree: boolean;
  };
  /** How many of the 9 items had any disagreement between the two
   *  appraisal passes (difference >= 1), for a plain "how much did the
   *  two passes agree" summary line. */
  itemsWithDisagreement: number;
  method: {
    appraiserCount: 2;
    aiGenerated: true;
    /** The source workbook's own limitations note, condensed - surfaced
     *  verbatim (not paraphrased away) so users see the real caveats
     *  before trusting a score: two runs of one model is not inter-rater
     *  reliability, text was machine-extracted from PDFs, and every score
     *  needs human verification before use in a real decision. */
    note: string;
  };
}

/**
 * Two-tier quality appraisal, per recommendation. `gate` records whether
 * this recommendation's PARENT GUIDELINE cleared the AGREE II quality
 * threshold (see lib/config.ts#AGREE_GATE_THRESHOLD_PCT) that makes it
 * eligible for a second, recommendation-level AGREE-REX appraisal at all.
 * `rex` is only populated when the parent guideline both cleared that gate
 * AND has a real appraisal on file (migrated directly into this same
 * data/guidelines.json by scripts/migrate_agree_rex_real_data.py, from the
 * source AGREEREX_results.xlsx workbook) — a guideline can have real
 * AGREE-REX data available and still show `rex: null` here if it didn't
 * clear the gate, because RecMap's own protocol treats the gate as a
 * precondition for a recommendation-level score being meaningful, not
 * merely a placeholder for missing data. The UI must distinguish
 * "not eligible" from "eligible but not yet appraised" from "appraised" —
 * never silently treat them the same or imply a score exists.
 */
export interface AgreeRexAppraisal {
  gatePassed: boolean;
  /** The parent guideline's AGREE II overall score as a % of 7, for display
   *  next to the gate threshold. */
  parentAgreeOverallPct: number;
  rex: AgreeRexResult | null;
  /** Always a human-readable status; the UI shows this rather than
   *  inferring one from gatePassed/rex. */
  status: "not_eligible" | "eligible_not_yet_appraised" | "appraised";
}

// --- Standardized clinical coding ---------------------------------------

export interface CodeRef {
  code: string;
  label: string;
  /** e.g. "ICD-11", "SNOMED CT", "ATC/DDD" — kept alongside the code so a
   *  UI chip is self-describing without extra lookups. */
  system: string;
}

/**
 * PICO elements coded against standardized terminologies (per the
 * tuberculosis RecMap paper, PMC8168829) so recommendations can eventually
 * be deduplicated, cross-referenced, and matched to a clinician's query
 * computationally rather than only by free text.
 *
 * Precise SNOMED CT concept IDs and ICD-11 codes are clinically
 * significant if wrong, so every field here is either a source-verified
 * code or an honest `null` with a note explaining why — never a guessed
 * placeholder code. See each guideline's `codingNote` fields for the
 * per-field rationale (e.g. a guideline addressing a diagnostic modality
 * across several skin conditions rather than one disease has no single
 * ICD-11 category to assign).
 */
export interface ClinicalCoding {
  icd11: CodeRef | null;
  icd11Note: string | null;
  snomedCt: CodeRef | null;
  snomedCtNote: string;
  atcDdd: CodeRef | null;
  atcDddNote: string;
}

// --- Equity ---------------------------------------------------------------

/** The PROGRESS-Plus framework (O'Neill et al.; used by the chronic-pain
 *  RecMap protocol for its own equity work) — the standard categories a
 *  guideline would need to have actually assessed for differential impact
 *  in order for this to be filled in with real findings. `evaluated: false`
 *  across the shipped v2 dataset is an honest statement about what the
 *  SOURCE GUIDELINES address, not a limitation of RecMap's extraction —
 *  none of the 13 shipped guidelines' recommendation texts discuss
 *  differential impact on any PROGRESS-Plus dimension. */
export interface EquityInfo {
  evaluated: boolean;
  /** Which PROGRESS-Plus dimensions the source guideline explicitly
   *  discussed differential impact for, if any. Empty when `evaluated` is
   *  false. */
  dimensionsAddressed: string[];
  note: string;
}

export const PROGRESS_PLUS_DIMENSIONS = [
  "Place of residence",
  "Race / ethnicity / culture / language",
  "Occupation",
  "Gender / sex",
  "Religion",
  "Education",
  "Socioeconomic status",
  "Social capital",
  "Plus: age, disability, sexual orientation",
] as const;

// --- Divergence analysis (Ask) -------------------------------------------

export type DivergenceReasonCategory =
  | "evidence_cutoff"
  | "values_and_preferences"
  | "population_differences"
  | "rigor_of_process"
  | "certainty_of_evidence"
  | "other";

export interface DivergenceReason {
  category: DivergenceReasonCategory;
  categoryLabel: string;
  explanation: string;
  /** ids of the guideline records this specific reason draws on. */
  guidelineIds: string[];
}

/** A structured "why do these guidelines diverge" breakdown, generated only
 *  when the cited guidelines actually disagree in direction/strength on the
 *  same question — modeled on the chronic-pain RecMap protocol's defined
 *  divergence-exploration method (checking whether disagreement traces to
 *  rigor of process vs. genuine subgroup/values differences). */
export interface DivergenceAnalysis {
  hasDivergence: boolean;
  reasons: DivergenceReason[];
}

export interface Pico {
  population: string;
  intervention: string;
  comparator: string;
  outcomes: string;
}

export interface DeviceCrossReference {
  deviceName: string;
  modelVersion?: string;
  evidenceSource?: string;
  fdaStatus?: string;
  ceStatus?: string;
  clearedIndication?: string;
  checkedAt?: string;
  sourceUrls?: string[];
}

export type GuidelineLifecycleState = "active" | "superseded" | "withdrawn" | "not_assessed";

export interface GuidelineLifecycle {
  state: GuidelineLifecycleState;
  replacedByGuidelineId?: string;
  sourceUrl?: string;
  checkedAt?: string;
  note?: string;
}

export type RecommendationDirection = "for" | "against" | "neutral";

/** GRADE (and GRADE-adjacent) statement types. A single source guideline
 *  document can issue several of these — see the `guidelineId` note below —
 *  and each type carries different evidentiary weight: a "recommendation" is
 *  graded for strength + certainty, a "good_practice_statement" is an
 *  ungraded common-sense directive, "additional_guidance" is narrative
 *  context that isn't a formal recommendation, and a
 *  "research_recommendation" is a call for further study rather than
 *  clinical guidance. */
export type RecommendationType =
  | "recommendation"
  | "good_practice_statement"
  | "additional_guidance"
  | "research_recommendation";

export type GradingApproach = "GRADE" | "not_grade" | "not_specified";

export type GradeCertaintyLevel =
  | "high"
  | "moderate"
  | "low"
  | "low_very_low"
  | "very_low"
  | "not_reported";

/** Placeholder evidence-inspection fields. Populated as `available: false`
 *  with a note pointing at the source PDF until a real SoF/ETD/MAGICapp
 *  linkage exists — see the About page for why this is thin in v1. */
export interface EvidenceSnapshot {
  sofAvailable: boolean;
  sofNote: string;
  etdAvailable: boolean;
  etdNote: string;
  primaryStudiesNote: string;
  magicappUrl: string | null;
}

export interface Guideline {
  id: string;
  /** Groups every recommendation statement extracted from the SAME source
   *  guideline document — e.g. two records sharing guidelineId "ESGE_BE_2023"
   *  are two distinct recommendations from one guideline. AGREE II is scored
   *  once per document (all records sharing a guidelineId carry the same
   *  `agree` block); GRADE certainty/strength/type are scored per
   *  recommendation, so they live on the individual record. See
   *  lib/data.ts#getGuidelineGroups for the grouped-by-document view used by
   *  the Catalog. */
  guidelineId: string;
  year: number;
  guidelineTitle: string;
  source: string;
  region: string;
  /** Broader region bucket for filtering (Europe / North America /
   *  Asia-Pacific / Global-multinational / ...), derived from `region`. */
  worldRegion: string;
  organization: string;
  clinicalArea: string;
  recommendationText: string;
  aiDomain: string;
  aiInput: string;
  explicitOrImplicit: "Explicit" | "Implicit";
  direction: RecommendationDirection;
  directionRaw: string;
  strength: string;
  /** Original free-text certainty as extracted (e.g. "Low/Very Low",
   *  "Not reported") — kept for display alongside the normalized
   *  gradeCertaintyLevel/-Label below. */
  certainty: string;
  recommendationType: RecommendationType;
  recommendationTypeLabel: string;
  gradingApproach: GradingApproach;
  gradingApproachLabel: string;
  gradeCertaintyLevel: GradeCertaintyLevel;
  gradeCertaintyLabel: string;
  /** Why this record was classified as it was, when the source text needed
   *  interpretation (e.g. a narrative caveat vs. a formally graded
   *  recommendation). Null when the classification was unambiguous. First
   *  pass from extracted text, not an independent guideline re-review — see
   *  the About page caveat. */
  classificationNote: string | null;
  ageGroup: string;
  evidence: EvidenceSnapshot;
  agreeRex: AgreeRexAppraisal;
  coding: ClinicalCoding;
  equity: EquityInfo;
  /** ISO date this record's data was last checked/refreshed. Distinct from
   *  the app-wide pipeline "last checked" date on the About page, which
   *  reflects the last full catalog sweep. */
  lastCheckedISO: string;
  pico: Pico;
  agree: AgreeAppraisal;
  deviceCrossReference?: DeviceCrossReference;
  lifecycle?: GuidelineLifecycle;
  /** Filename under public/data/pdfs, or undefined if no source PDF is on file. */
  pdfFile?: string;
  /** Present only on guidelines added through the Upload flow. */
  uploaded?: {
    addedAt: string;
    /** Marks that AGREE II domain scores here come from RecMap's own AI
     *  appraisal pipeline rather than from a human appraisal of this
     *  document. The pipeline scores against the AGREE II instrument with
     *  knowledge-graph support and is benchmarked on human appraisals —
     *  internally it produces scores roughly 80% similar to a human
     *  appraiser's — so this is an appraisal, not a guess. It is still not
     *  a human-verified one, and the UI must disclose that distinction.
     *  (Field name kept as-is: renaming it would break every shipped
     *  data/uploaded/*.json record.) */
    agreeScoresEstimated: true;
    sourceFileName: string;
  };
}

/** One source guideline document, with every recommendation statement
 *  extracted from it grouped together. Built by lib/data.ts#getGuidelineGroups
 *  — this is what the Catalog now shows one card per, expanding to the
 *  individual recommendation-statement catalog underneath. */
export interface GuidelineGroup {
  guidelineId: string;
  guidelineTitle: string;
  organization: string;
  source: string;
  year: number;
  region: string;
  worldRegion: string;
  clinicalArea: string;
  pdfFile?: string;
  /** AGREE II is scored once per document; taken from the first
   *  recommendation record in the group (all share the same value). */
  agree: AgreeAppraisal;
  agreeScoresEstimated: boolean;
  lastCheckedISO: string;
  /** Every recommendation statement extracted from this document. */
  recommendations: Guideline[];
}

// --- Chat (Ask) types -------------------------------------------------

export interface ChatTurnRequest {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequestBody {
  query: string;
  /** Prior turns in this conversation, oldest first (for follow-up grounding). */
  history: ChatTurnRequest[];
  /** The audience lens the reader currently has active. Normally equal to
   *  their saved persona, but a reader previewing another audience's view
   *  should get that audience's answer too — otherwise the lens switcher
   *  changes the page but not the assistant. Server-side validated against
   *  lib/audienceLens.ts; anything unrecognised falls back to the account's
   *  saved persona. */
  lens?: string;
}

export interface ChatResponseBody {
  answerMarkdown: string;
  guidelineIds: string[];
  followUpSuggestions: string[];
  divergence?: DivergenceAnalysis;
  /** Present when the exchange was persisted to History (i.e. the caller
   *  was signed in) — used by the client to wire up thumbs up/down against
   *  this specific row via /api/history/[id]/feedback. */
  historyId?: string;
  /** Mirrors lib/chatPrompt.ts's JSON contract fields, defaulted sensibly
   *  when the model omits them (inScope true, needsHumanReview false) so
   *  callers never have to treat "undefined" as a third state. */
  inScope: boolean;
  needsHumanReview: boolean;
}

// --- Upload (full LLM pipeline) types ----------------------------------

export interface UploadResponseBody {
  guideline: Guideline;
}
