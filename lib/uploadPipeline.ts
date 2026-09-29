import { randomUUID } from "node:crypto";
import { AGREE_INSTRUMENT } from "./agreeInstrument";
import { askClaudeForJson, EXTRACTION_MODEL } from "./anthropic";
import { passesAgreeGate } from "./config";
import type {
  AgreeDomain,
  AgreeRexAppraisal,
  ClinicalCoding,
  EquityInfo,
  GradeCertaintyLevel,
  GradingApproach,
  Guideline,
  Pico,
  RecommendationDirection,
  RecommendationType,
} from "./types";

const EXTRACTION_SYSTEM_PROMPT = `You are a clinical guideline analyst. You will be given the extracted text of an uploaded clinical practice guideline document that involves an AI/ML-based tool (e.g. computer-aided detection, an AI risk-prediction model, an AI triage tool).

Your job has two parts:

1. Extract structured metadata about the guideline and its AI-related recommendation.
2. Appraise the guideline against the AGREE II instrument (23 items across 6 domains, given to you below), scoring each item 1 (strongly disagree the guideline meets this standard) to 7 (strongly agree), with a one-to-three sentence appraisal justifying each score, grounded in what the document text actually says or fails to say. Be honest and calibrated — do not default to high scores. If the document doesn't address an item at all, score it low (1-2) and say so.

Respond with ONLY valid JSON (no markdown code fences, no commentary outside the JSON), matching exactly this shape:
{
  "guideline_title": "string",
  "organization": "string (the body that issued the guideline)",
  "source": "string (short name, e.g. journal or publisher)",
  "region": "string (e.g. 'United States', 'International', 'Europe')",
  "year": number,
  "clinical_area": "string (e.g. 'Lung cancer', 'Dermatology')",
  "ai_domain": "string (the type of AI/ML involved, e.g. 'Computer vision', 'Risk prediction')",
  "ai_input": "string (what data the AI tool takes as input, e.g. 'Endoscopy images')",
  "explicit_or_implicit": "Explicit" | "Implicit",
  "recommendation_text": "string (the specific recommendation about the AI tool, quoted or closely paraphrased)",
  "direction": "For" | "Against" | "Neutral",
  "strength": "string (e.g. 'Strong', 'Weak', 'Conditional')",
  "certainty": "string (e.g. 'High', 'Moderate', 'Low', 'Very Low', or a combination like 'Low/Very Low')",
  "recommendation_type": "one of exactly: 'Recommendation', 'Good Practice Statement', 'Additional Guidance', 'Research Recommendation' — these carry different weight in GRADE. Use 'Recommendation' only for a formally graded (strength + certainty) statement. Use 'Good Practice Statement' for an ungraded common-sense directive. Use 'Additional Guidance' for narrative/contextual text that isn't a formal recommendation. Use 'Research Recommendation' when the guideline is calling for more research rather than giving clinical guidance.",
  "grading_approach": "one of exactly: 'GRADE', 'Not GRADE-based', 'Not specified' — whether the strength/certainty above were actually produced using the GRADE framework.",
  "age_group": "string (e.g. 'Adults', 'Children', 'Adults and children', or 'Not specified')",
  "world_region": "string (one of exactly: 'North America', 'Europe', 'Asia-Pacific', 'Global / multinational', 'Other')",
  "pico": {
    "population": "string",
    "intervention": "string",
    "comparator": "string",
    "outcomes": "string"
  },
  "agree_items": [ { "num": 1, "score": 1-7, "appraisal": "string" }, ... one entry for every item number 1-23, in order ]
}`;

function buildAgreeInstrumentText(): string {
  return AGREE_INSTRUMENT.map(
    (domain) =>
      `${domain.label}:\n` +
      domain.items.map((it) => `  ${it.num}. ${it.text}`).join("\n")
  ).join("\n\n");
}

interface ExtractionResult {
  guideline_title?: string;
  organization?: string;
  source?: string;
  region?: string;
  year?: number;
  clinical_area?: string;
  ai_domain?: string;
  ai_input?: string;
  explicit_or_implicit?: string;
  recommendation_text?: string;
  direction?: string;
  strength?: string;
  certainty?: string;
  recommendation_type?: string;
  grading_approach?: string;
  age_group?: string;
  world_region?: string;
  pico?: Partial<Pico>;
  agree_items?: { num: number; score: number; appraisal: string }[];
}

function normalizeDirection(raw: string | undefined): RecommendationDirection {
  const v = (raw ?? "").toLowerCase();
  if (v.startsWith("against")) return "against";
  if (v.startsWith("for")) return "for";
  return "neutral";
}

/** Turns the LLM's flat 23-item score list into the same domain-grouped
 *  shape the shipped guidelines.json uses, applying the standard single-rater
 *  AGREE II scaling: domain% = (sum - n) / (6n); score7 = domain% * 7. */
function buildAgreeDomains(items: { num: number; score: number; appraisal: string }[]): {
  domains: AgreeDomain[];
  overall7: number;
} {
  const byNum = new Map(items.map((it) => [it.num, it]));

  const domains: AgreeDomain[] = AGREE_INSTRUMENT.map((domainDef) => {
    const domainItems = domainDef.items.map((itemDef) => {
      const found = byNum.get(itemDef.num);
      const score = clampScore(found?.score);
      return {
        num: itemDef.num,
        text: itemDef.text,
        score,
        appraisal: found?.appraisal?.trim() || "No appraisal returned for this item.",
      };
    });
    const n = domainItems.length;
    const sum = domainItems.reduce((acc, it) => acc + it.score, 0);
    const score01 = clamp01((sum - n) / (n * 6));
    const score7 = round2(score01 * 7);
    return {
      key: domainDef.key,
      label: domainDef.label,
      short: domainDef.short,
      score01: round2(score01),
      score7,
      items: domainItems,
    };
  });

  const overall7 = round2(domains.reduce((acc, d) => acc + d.score7, 0) / domains.length);
  return { domains, overall7 };
}

const RECOMMENDATION_TYPE_LABELS: Record<RecommendationType, string> = {
  recommendation: "Recommendation",
  good_practice_statement: "Good Practice Statement",
  additional_guidance: "Additional Guidance",
  research_recommendation: "Research Recommendation",
};

function normalizeRecommendationType(raw: string | undefined): RecommendationType {
  const v = (raw ?? "").toLowerCase();
  if (v.includes("good practice")) return "good_practice_statement";
  if (v.includes("research")) return "research_recommendation";
  if (v.includes("additional") || v.includes("guidance")) return "additional_guidance";
  return "recommendation";
}

const GRADING_APPROACH_LABELS: Record<GradingApproach, string> = {
  GRADE: "GRADE",
  not_grade: "Not GRADE-based",
  not_specified: "Not specified in source",
};

function normalizeGradingApproach(raw: string | undefined): GradingApproach {
  const v = (raw ?? "").toLowerCase();
  if (v.includes("not grade") || v === "no" || v.includes("ungraded")) return "not_grade";
  if (v.includes("grade")) return "GRADE";
  return "not_specified";
}

const CERTAINTY_LEVEL_LABELS: Record<GradeCertaintyLevel, string> = {
  high: "High",
  moderate: "Moderate",
  low: "Low",
  low_very_low: "Low / Very low",
  very_low: "Very low",
  not_reported: "Not reported",
};

/** Parses the free-text certainty the extraction LLM returns (e.g.
 *  "Low/Very Low", "Moderate") into the same normalized level buckets the
 *  shipped dataset uses, so an uploaded guideline's GRADE certainty badge
 *  renders identically to the pre-appraised catalog. */
function normalizeCertaintyLevel(raw: string | undefined): GradeCertaintyLevel {
  const v = (raw ?? "").toLowerCase();
  const hasLow = v.includes("low");
  const hasVeryLow = v.includes("very low");
  if (!v || v.includes("not report") || v.includes("unspecified") || v.includes("unclear")) return "not_reported";
  if (hasLow && hasVeryLow) return "low_very_low";
  if (hasVeryLow) return "very_low";
  if (hasLow) return "low";
  if (v.includes("moderate")) return "moderate";
  if (v.includes("high")) return "high";
  return "not_reported";
}

const WORLD_REGION_KEYWORDS: [string, string][] = [
  ["united states", "North America"],
  ["usa", "North America"],
  ["canada", "North America"],
  ["europe", "Europe"],
  ["uk", "Europe"],
  ["united kingdom", "Europe"],
  ["germany", "Europe"],
  ["france", "Europe"],
  ["japan", "Asia-Pacific"],
  ["singapore", "Asia-Pacific"],
  ["australia", "Asia-Pacific"],
  ["asia", "Asia-Pacific"],
  ["international", "Global / multinational"],
  ["global", "Global / multinational"],
  ["multinational", "Global / multinational"],
  ["worldwide", "Global / multinational"],
];

function inferWorldRegion(raw: string | undefined): string {
  const v = (raw ?? "").toLowerCase();
  for (const [needle, bucket] of WORLD_REGION_KEYWORDS) {
    if (v.includes(needle)) return bucket;
  }
  return v ? "Other" : "Not specified";
}

/** Same two-tier gate logic as the shipped dataset (scripts/migrate_add_fields_2.py)
 *  — an uploaded guideline that clears the AGREE II threshold becomes
 *  eligible for a future AGREE-REX pass, but no such appraisal is ever
 *  fabricated here. */
function buildAgreeRex(overall7: number): AgreeRexAppraisal {
  const gatePassed = passesAgreeGate(overall7);
  return {
    gatePassed,
    parentAgreeOverallPct: Math.round((overall7 / 7) * 1000) / 10,
    rex: null,
    status: gatePassed ? "eligible_not_yet_appraised" : "not_eligible",
  };
}

/** An uploaded guideline is coded honestly as "not yet coded" across the
 *  board — the extraction LLM isn't asked to guess ICD-11/SNOMED CT/ATC-DDD
 *  codes, since a wrong clinical code is worse than none (same reasoning as
 *  the shipped dataset's coding fields). */
function buildUploadedCoding(): ClinicalCoding {
  return {
    icd11: null,
    icd11Note:
      "Not yet coded for uploaded guidelines — automatic ICD-11 coding isn't part of the extraction pipeline yet.",
    snomedCt: null,
    snomedCtNote: "Not yet coded for uploaded guidelines.",
    atcDdd: null,
    atcDddNote:
      "Not yet assessed for uploaded guidelines. ATC/DDD applies only to pharmacological interventions, not AI/software tools.",
  };
}

function buildUploadedEquity(): EquityInfo {
  return {
    evaluated: false,
    dimensionsAddressed: [],
    note:
      "Not evaluated. Differential-impact assessment (PROGRESS-Plus framework) isn't part of the automatic extraction pipeline yet — check the uploaded source document directly.",
  };
}

function clampScore(v: number | undefined): number {
  if (typeof v !== "number" || Number.isNaN(v)) return 1;
  return Math.min(7, Math.max(1, v));
}
function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}
function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export async function runFullExtractionPipeline(params: {
  documentText: string;
  originalFileName: string;
  storedPdfFileName: string | undefined;
}): Promise<Guideline> {
  const instrumentText = buildAgreeInstrumentText();

  // Guard against pathologically large documents blowing the context window —
  // most guideline PDFs extract to well under this; truncate defensively.
  const truncatedText = params.documentText.slice(0, 100_000);

  const prompt = `AGREE II INSTRUMENT (score every item, 1-23):\n${instrumentText}\n\nDOCUMENT TEXT:\n${truncatedText}`;

  const result = await askClaudeForJson<ExtractionResult>({
    system: EXTRACTION_SYSTEM_PROMPT,
    prompt,
    model: EXTRACTION_MODEL,
    maxTokens: 8000,
  });

  const { domains, overall7 } = buildAgreeDomains(result.agree_items ?? []);

  const directionValue = normalizeDirection(result.direction);
  const id = `UPLOAD_${randomUUID().slice(0, 8)}`;

  const recommendationType = normalizeRecommendationType(result.recommendation_type);
  const gradingApproach = normalizeGradingApproach(result.grading_approach);
  const gradeCertaintyLevel = normalizeCertaintyLevel(result.certainty);
  const regionRaw = result.region?.trim() || "Unspecified";

  const guideline: Guideline = {
    id,
    guidelineId: id,
    year: typeof result.year === "number" ? result.year : new Date().getFullYear(),
    guidelineTitle: result.guideline_title?.trim() || params.originalFileName,
    source: result.source?.trim() || "Uploaded document",
    region: regionRaw,
    worldRegion: result.world_region?.trim() || inferWorldRegion(regionRaw),
    organization: result.organization?.trim() || "Unspecified",
    clinicalArea: result.clinical_area?.trim() || "Unspecified",
    recommendationText: result.recommendation_text?.trim() || "",
    aiDomain: result.ai_domain?.trim() || "Unspecified",
    aiInput: result.ai_input?.trim() || "Unspecified",
    explicitOrImplicit: result.explicit_or_implicit === "Implicit" ? "Implicit" : "Explicit",
    direction: directionValue,
    directionRaw: result.direction?.trim() || "Neutral",
    strength: result.strength?.trim() || "Unspecified",
    certainty: result.certainty?.trim() || "Unspecified",
    recommendationType,
    recommendationTypeLabel: RECOMMENDATION_TYPE_LABELS[recommendationType],
    gradingApproach,
    gradingApproachLabel: GRADING_APPROACH_LABELS[gradingApproach],
    gradeCertaintyLevel,
    gradeCertaintyLabel: CERTAINTY_LEVEL_LABELS[gradeCertaintyLevel],
    classificationNote:
      "Recommendation type, grading approach, and GRADE certainty were classified by the extraction LLM from the uploaded document text — not independently re-reviewed.",
    ageGroup: result.age_group?.trim() || "Not specified",
    evidence: {
      sofAvailable: false,
      sofNote: "Summary-of-Findings table not yet linked for this recommendation — see the uploaded source document.",
      etdAvailable: false,
      etdNote: "Evidence-to-Decision table not yet linked for this recommendation — see the uploaded source document.",
      primaryStudiesNote:
        "Underlying primary studies are not individually listed here yet; consult the uploaded document's reference list.",
      magicappUrl: null,
    },
    lastCheckedISO: new Date().toISOString().slice(0, 10),
    agreeRex: buildAgreeRex(overall7),
    coding: buildUploadedCoding(),
    equity: buildUploadedEquity(),
    pico: {
      population: result.pico?.population?.trim() || "",
      intervention: result.pico?.intervention?.trim() || "",
      comparator: result.pico?.comparator?.trim() || "",
      outcomes: result.pico?.outcomes?.trim() || "",
    },
    agree: { domains, overall7 },
    pdfFile: params.storedPdfFileName,
    uploaded: {
      addedAt: new Date().toISOString(),
      agreeScoresEstimated: true,
      sourceFileName: params.originalFileName,
    },
  };

  return guideline;
}
