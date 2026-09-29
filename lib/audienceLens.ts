import type {
  AgreeAppraisal,
  AgreeItem,
  Guideline,
  GuidelineGroup,
} from "./types";
import type { Persona } from "./db";
import { AI_APPRAISAL_METRIC_LABEL, AI_APPRAISAL_SIMILARITY_PCT } from "./config";

/**
 * ── The audience lens layer ────────────────────────────────────────────────
 *
 * RecMap's source papers describe audience-specific interfaces as
 * deliberately-designed surfaces, not a cosmetic re-skin: the same underlying
 * recommendation record is read through a different question depending on who
 * is reading it.
 *
 *   point-of-care clinician  "What do I do for the patient in front of me?"
 *   person with lived exp.   "What does this mean for my life, and is it my call?"
 *   policy / health-system   "What will it cost, will it work here, can I
 *                             measure it, and can I defend it?"
 *   researcher               "Where is the evidence thin, and where do
 *                             guidelines disagree?"
 *   guideline developer      "How was this built, and does it hold up?"
 *   industry                 "Where is the standard of care moving, and what
 *                             evidence would move it?"
 *
 * Everything audience-specific in the app is defined HERE and nowhere else —
 * section order and visibility, vocabulary, the framing sentence, the catalog
 * card summary, Map/Catalog defaults, the standing caveat, and the guidance
 * injected into the Ask prompt. Adding a seventh audience should mean editing
 * this file plus the `Persona` union in lib/db.ts, and nothing else.
 *
 * Design rules this file encodes, taken from the literature rather than
 * invented (see app/help#lenses for the citations shown to users):
 *  - Hiding is as deliberate as showing. A lens omits a section because that
 *    audience does not use it, never because the data is missing.
 *  - Absence is a finding. Where a lens depends on a field the source
 *    guideline never addressed (AGREE II item 20 resource implications is the
 *    common one), the UI states that explicitly instead of rendering nothing.
 *  - No lens invents data. Every lens reads the same record; a lens may
 *    reorder, rename, translate, or suppress, but never adds a fact.
 */

export type SectionKey =
  | "plain_language"
  | "recommendation"
  | "grade"
  | "agree_rex"
  | "agree_domains"
  | "policy"
  | "evidence_signals"
  | "provenance"
  | "pico"
  | "coding"
  | "equity"
  | "evidence";

/** Which catalog-card chips a lens promotes into the one-line summary. */
export type SummaryField =
  | "agree"
  | "grade"
  | "direction"
  | "strength_plain"
  | "rec_type"
  | "implementability"
  | "resource_item"
  | "monitoring_item"
  | "currency"
  | "grading_approach"
  | "equity"
  | "patient_involvement";

export interface AudienceLens {
  key: Persona;
  /** Full label, used in onboarding and the account menu. */
  label: string;
  /** Short label for chips and the lens switcher. */
  short: string;
  /** The audience as a plural noun phrase ("people with lived experience").
   *  Naive pluralisation of `label` produces "person with lived experiences"
   *  and "industry (pharma / medical device)s", so the correct form is
   *  written out per lens rather than derived. */
  plural: string;
  /** The audience in the form that follows "Reading this ..." — "as a
   *  person with lived experience", "from an industry perspective". */
  asA: string;
  /** First-person description, used on the onboarding Likert grid. */
  description: string;
  /** The question this audience is actually asking of a recommendation.
   *  Shown at the top of the detail view so the framing is explicit. */
  question: string;
  /** Ordered sections for the recommendation detail view. A section key
   *  absent from this list is deliberately not rendered for this audience. */
  sections: SectionKey[];
  /** Chips this lens promotes onto the catalog card. */
  summary: SummaryField[];
  /** Per-lens label overrides. The instrument's own name is never replaced —
   *  only the plain-language gloss beside it — so a user can always trace a
   *  renamed heading back to AGREE II / AGREE-REX / GRADE. */
  vocabulary: Partial<Record<string, string>>;
  mapDefaults: {
    /** "matrix" replaced the former separate "heatmap" and "density"
     *  views, which were the same count-matrix over different axis pairs;
     *  matrixX / matrixY say which pair a lens should land on. */
    view: "map" | "matrix" | "charts" | "list";
    matrixX?: string;
    matrixY?: string;
    sortKey: "org" | "area" | "direction" | "agree" | "grade" | "year";
    sortDir: "asc" | "desc";
  };
  /** The standing caveat this audience needs, shown once per detail view. */
  caveat: string;
  /** Injected into the Ask system prompt. */
  chatGuidance: string;
  /** CSS custom property used to tint this lens's chrome. */
  accentVar: string;
}

// ── The six lenses ─────────────────────────────────────────────────────────

export const AUDIENCE_LENSES: Record<Persona, AudienceLens> = {
  point_of_care_clinician: {
    key: "point_of_care_clinician",
    label: "Point-of-care clinician",
    short: "Clinician",
    plural: "point-of-care clinicians",
    asA: "as a point-of-care clinician",
    description:
      "I see patients directly and want quick, practical answers I can act on today.",
    question: "What do I do for the patient in front of me?",
    sections: [
      "recommendation",
      "grade",
      "pico",
      "agree_rex",
      "equity",
      "evidence",
      "agree_domains",
      "coding",
    ],
    summary: ["direction", "grade", "rec_type", "agree"],
    vocabulary: {},
    mapDefaults: { view: "map", sortKey: "direction", sortDir: "desc" },
    caveat:
      "RecMap reports what guidelines say about AI tools in clinical care. It does not make a clinical decision for an individual patient, and a recommendation's presence here is not a statement that it applies to yours.",
    chatGuidance:
      "AUDIENCE: point-of-care clinician, asking \"what do I do for the patient in front of me?\". Lead with the practical bottom line — the direction and strength of the recommendation and who it applies to — before any methodology. State GRADE certainty in the same breath as the recommendation, never as a footnote. Keep AGREE II/AGREE-REX detail to one clause unless asked. Never issue a decision for an individual patient.",
    accentVar: "--favour",
  },

  lived_experience: {
    key: "lived_experience",
    label: "Person with lived experience",
    short: "Lived experience",
    plural: "people with lived experience",
    asA: "as a person with lived experience",
    description:
      "I live with this condition, or I care for someone who does, and I want to understand what a guideline actually means for us.",
    question: "What does this mean for my life — and how much of it is my call?",
    // Deliberately no "recommendation" block: the plain-language panel
    // already carries the guideline's own wording behind a toggle, and the
    // raw block would re-introduce the badges and the "Weak strength" meta
    // line this lens exists to keep away from an unprepared reader.
    sections: ["plain_language", "equity", "provenance", "evidence"],
    summary: ["strength_plain", "patient_involvement", "currency"],
    vocabulary: {
      grade: "How sure are they?",
      agree: "How carefully was this guideline made?",
      agree_rex: "Does this recommendation fit real life?",
      pico: "Who was studied, and what was measured",
      equity: "Were people like me included, and people in situations like mine?",
      provenance: "Who wrote this, and who paid for it",
      evidence: "Where the evidence behind this sits",
    },
    mapDefaults: { view: "list", sortKey: "direction", sortDir: "desc" },
    caveat:
      "This page explains what a guideline says. It cannot know your situation, your history, or what matters most to you — use it to prepare for a conversation with your clinician, not instead of one. If you feel unwell or something is getting worse, contact a health professional.",
    chatGuidance:
      "AUDIENCE: a person with lived experience of the condition — a patient, survivor, or carer, not a clinician. Write at roughly a grade 6-8 reading level: short sentences, one idea each, active voice, address the reader as \"you\". Expand or avoid every piece of jargon (AGREE II, AGREE-REX, GRADE, PICO, CADe) — if you must name an instrument, gloss it in the same sentence. Render certainty in words, never as a bare label: high = \"we're confident about this\"; moderate = \"this is probably right, but future research could change it\"; low = \"we're not sure — the research so far is limited or mixed\"; very low = \"we really don't know yet\". NEVER use the word \"weak\" for a weak/conditional recommendation — say \"the majority of people in this situation would want this, but many would not; reasonable people choose differently\". NEVER turn a conditional recommendation into an instruction, never say \"you should\" on the guideline's behalf, and never give personal medical advice. Say \"we don't know yet\" rather than \"there is no evidence\". Where the guideline never sought patients' views, say so plainly — it is one of the things this reader most wants to know. End by pointing back to a conversation with their own clinician, with a concrete question they could ask.",
    accentVar: "--brand",
  },

  policy_maker: {
    key: "policy_maker",
    label: "Policy / health-system decision-maker",
    short: "Policy",
    plural: "policy and health-system decision-makers",
    asA: "as a policy or health-system decision-maker",
    description:
      "I make coverage, procurement, or system-level decisions about deploying AI in clinical care.",
    question:
      "What will it cost, will it work here, can I measure it, and can I defend it?",
    sections: [
      "policy",
      "recommendation",
      "grade",
      "agree_rex",
      "equity",
      "agree_domains",
      "evidence",
    ],
    summary: ["implementability", "resource_item", "monitoring_item", "grade", "equity"],
    vocabulary: {
      agree_rex: "Recommendation excellence (AGREE-REX) — applicability, values, implementability",
      grade: "Certainty of evidence (GRADE) — how defensible is this position",
      agree_domains: "Development rigour (AGREE II) — full domain breakdown",
      equity: "Equity impact — who this helps, and who it may miss",
      evidence: "Evidence base and source document",
    },
    mapDefaults: { view: "matrix", matrixX: "aiDomain", matrixY: "clinicalArea", sortKey: "org", sortDir: "asc" },
    caveat:
      "AGREE II items 20 and 21 (resource implications, monitoring and auditing criteria) are scored against what the guideline document itself reports. A low score means the guideline did not address it — not that the intervention is unaffordable or unmeasurable. Local budget impact, workforce capacity, and legal standing are outside anything RecMap holds.",
    chatGuidance:
      "AUDIENCE: a policy or health-system decision-maker, asking \"what will it cost, will it work here, can I measure it, and can I defend it?\". Lead with the decision, not the evidence. Prioritise, in this order: resource and workforce implications (AGREE II item 20), whether adherence can be monitored (AGREE II item 21), implementability and local adaptation (AGREE-REX Implementability domain, items 8-9), equity impact, then certainty of evidence as it bears on defensibility, and editorial independence as it bears on trust. Flag explicitly whenever a recommendation is strong on low-certainty evidence — that combination is the defensibility trap. Where the source guideline never addressed resource use or monitoring, say so as a finding, not an omission. De-emphasise dosing, individual contraindications, and trial-arm mechanics. Note the originating region and organisation whenever transferability is in question.",
    accentVar: "--accent",
  },

  researcher: {
    key: "researcher",
    label: "Researcher",
    short: "Researcher",
    plural: "researchers",
    asA: "as a researcher",
    description:
      "I study the evidence base itself — appraisal quality, certainty, gaps, and where guidelines diverge.",
    question: "Where is the evidence thin, and where do guidelines disagree?",
    sections: [
      "evidence_signals",
      "recommendation",
      "grade",
      "agree_domains",
      "agree_rex",
      "pico",
      "coding",
      "equity",
      "evidence",
    ],
    summary: ["rec_type", "grade", "grading_approach", "agree", "currency"],
    vocabulary: {
      evidence_signals: "Evidence-base signals",
      pico: "PICO (structured for matching and pooling)",
      coding: "Standardised coding (ICD-11 / SNOMED CT / ATC)",
    },
    mapDefaults: { view: "map", sortKey: "grade", sortDir: "asc" },
    caveat:
      `AGREE-REX scores in this catalog are AI-generated first-pass appraisals from two independent passes of the same model. Agreement between those passes is not inter-rater reliability, and a kappa or ICC computed from them would be misleading. AGREE II scores for the 13 shipped guidelines are human-derived from the source workbooks; uploaded guidelines are scored by RecMap's AI appraisal pipeline — benchmarked against human AGREE II appraisal, giving scores about ${AI_APPRAISAL_SIMILARITY_PCT}% ${AI_APPRAISAL_METRIC_LABEL} — and are labelled as such.`,
    chatGuidance:
      "AUDIENCE: a researcher studying the guideline corpus itself. Preserve disagreement rather than resolving it — never adjudicate which guideline is correct. Prioritise: recommendation type (a research recommendation or good practice statement is not a graded recommendation and must never be pooled with one), grading approach (ungraded guidelines cannot have their certainty pooled with GRADE ones), certainty distribution, strength-certainty discordance, divergence between guidelines on a matched PICO question, appraisal quality including Editorial Independence, and currency. Always state N and the denominator for any count. Name the extraction method's limits when a claim rests on it.",
    accentVar: "--brand",
  },

  guideline_developer: {
    key: "guideline_developer",
    label: "Guideline developer",
    short: "Developer",
    plural: "guideline developers",
    asA: "as a guideline developer",
    description:
      "I write, update, or appraise clinical practice guidelines and want the methodological detail.",
    question: "How was this built, and does it hold up?",
    sections: [
      "agree_domains",
      "agree_rex",
      "recommendation",
      "grade",
      "evidence_signals",
      "pico",
      "coding",
      "equity",
      "evidence",
    ],
    summary: ["agree", "rec_type", "grading_approach", "grade"],
    vocabulary: {
      agree_domains: "AGREE II — development rigour, item by item",
      agree_rex: "AGREE-REX — recommendation excellence, item by item",
    },
    mapDefaults: { view: "map", sortKey: "agree", sortDir: "desc" },
    caveat:
      "AGREE II item scores shown here come from the source appraisal workbooks for the 13 shipped guidelines and from an LLM pipeline for anything added via Upload — the two are always distinguished on the card. AGREE-REX appraisals are AI-generated and need human verification before they are cited.",
    chatGuidance:
      "AUDIENCE: a guideline developer or methodologist. Surface the methodological detail rather than the bottom line: AGREE II domain and item scores with their appraisal notes, AGREE-REX status and domain breakdown, the grading approach used, recommendation type, and where the two appraisal passes disagreed. Be precise about which instrument answers which question — AGREE II is rigour of development, GRADE is certainty of the evidence, AGREE-REX is the trustworthiness of the recommendation itself. Point out where a guideline scored poorly on a specific item and what the appraisal note gave as the reason.",
    accentVar: "--neutral",
  },

  industry: {
    key: "industry",
    label: "Industry (pharma / medical device)",
    short: "Industry",
    plural: "industry teams",
    asA: "from an industry perspective",
    description:
      "I work in pharma or medical devices and track where the standard of care is moving and what evidence would move it.",
    question:
      "Where is the standard of care moving, and what evidence would move it?",
    sections: [
      "evidence_signals",
      "recommendation",
      "grade",
      "pico",
      "agree_domains",
      "agree_rex",
      "equity",
      "evidence",
    ],
    summary: ["direction", "grade", "grading_approach", "currency", "rec_type"],
    vocabulary: {
      evidence_signals: "Standard-of-care position and evidence gaps",
      pico: "PICO — note the comparator the guideline names",
      agree_domains: "Guideline trustworthiness (AGREE II), incl. editorial independence",
    },
    mapDefaults: { view: "matrix", matrixX: "clinicalArea", matrixY: "population", sortKey: "year", sortDir: "desc" },
    caveat:
      "This lens is an evidence-gap and standard-of-care tracking surface. By design it holds no person-level data: RecMap does not list guideline authors or panellists, does not link individuals to disclosures, funding, trial sites, or contact details, and does not score any organisation on how easily its recommendations could be changed. Conflict of interest appears only as AGREE II Domain 6 at the level of the guideline document. Gaps that argue against a technology are shown exactly as prominently as gaps that favour one.",
    chatGuidance:
      "AUDIENCE: someone in industry (pharmaceutical or medical device) tracking the evidence landscape. Answer in terms of the evidence base and the standard of care, never in terms of commercial opportunity. Prioritise: the direction and strength of the current position, explicit research recommendations (the panel has already written the trial brief), low-certainty and strong-on-low-certainty recommendations as the least stable positions, the named comparator in the PICO (that is what new evidence must beat), the grading approach (a GRADE-based guideline can be moved by new trial evidence; a consensus one may not be), currency, and divergence between organisations. HARD CONSTRAINTS: never name, profile, or characterise individual guideline authors or panellists; never suggest engagement, outreach, influence, or targeting of any person or organisation; never rank organisations by persuadability; never frame a finding as a market opportunity, whitespace, or threat. Use the vocabulary of evidence — gap, unmet evidence need, standard-of-care position, certainty, divergence, comparator, currency. If asked to do any of the prohibited things, decline plainly and say what the lens is for instead.",
    accentVar: "--accent",
  },
};

/** Display order, used by onboarding and the lens switcher. Deliberately
 *  puts the two audiences the app was NOT originally built for (lived
 *  experience, policy) high in the list rather than appending them. */
export const AUDIENCE_ORDER: Persona[] = [
  "point_of_care_clinician",
  "lived_experience",
  "policy_maker",
  "researcher",
  "guideline_developer",
  "industry",
];

export const AUDIENCE_LIST: AudienceLens[] = AUDIENCE_ORDER.map((k) => AUDIENCE_LENSES[k]);

export const DEFAULT_LENS: Persona = "point_of_care_clinician";

export function getLens(persona: Persona | null | undefined): AudienceLens {
  return AUDIENCE_LENSES[persona ?? DEFAULT_LENS] ?? AUDIENCE_LENSES[DEFAULT_LENS];
}

export function isPersona(value: unknown): value is Persona {
  return typeof value === "string" && value in AUDIENCE_LENSES;
}

/** Section order for a lens, filtered to the sections that exist. */
export function sectionsFor(lens: AudienceLens): SectionKey[] {
  return lens.sections;
}

export function lensShows(lens: AudienceLens, section: SectionKey): boolean {
  return lens.sections.includes(section);
}

/** A lens may rename a section heading; the instrument's own name is kept
 *  in the fallback so nothing becomes untraceable. */
export function sectionLabel(lens: AudienceLens, key: string, fallback: string): string {
  return lens.vocabulary[key] ?? fallback;
}

// ── Reading the record through a lens ──────────────────────────────────────

/** AGREE II items are numbered 1-23 across six domains. The policy lens
 *  depends on specific items by number (18 barriers, 19 tools, 20 resource
 *  implications, 21 monitoring/auditing, 22 funding-body influence,
 *  23 competing interests), so look them up rather than assuming a domain's
 *  array position. Returns null when an appraisal doesn't carry the item —
 *  callers must render that as "not reported", never as a zero. */
export function findAgreeItem(agree: AgreeAppraisal, num: number): AgreeItem | null {
  for (const domain of agree.domains) {
    const item = domain.items.find((i) => i.num === num);
    if (item) return item;
  }
  return null;
}

export const AGREE_ITEM_RESOURCE = 20;
export const AGREE_ITEM_MONITORING = 21;
export const AGREE_ITEM_BARRIERS = 18;
export const AGREE_ITEM_TOOLS = 19;
export const AGREE_ITEM_FUNDING = 22;
export const AGREE_ITEM_COMPETING_INTERESTS = 23;
/** Domain 2, item 5: "the views and preferences of the target population
 *  have been sought" — the single item a person with lived experience most
 *  often wants answered first. */
export const AGREE_ITEM_PATIENT_VIEWS = 5;

/** A 1-7 AGREE item score, described in words. Deliberately blunt: a 2/7 on
 *  "resource implications considered" should not read as a pass. */
export function itemVerdict(score: number | null | undefined): {
  tone: "absent" | "weak" | "partial" | "good";
  label: string;
} {
  if (score === null || score === undefined) return { tone: "absent", label: "Not reported" };
  if (score <= 2) return { tone: "absent", label: "Barely addressed" };
  if (score <= 4) return { tone: "weak", label: "Partly addressed" };
  if (score <= 5) return { tone: "partial", label: "Addressed" };
  return { tone: "good", label: "Well addressed" };
}

/** Years since a record was published, for the currency signal every
 *  audience except the clinician cares about. Guidelines are commonly
 *  considered due for review at ~3-5 years. */
export function currency(rec: { year: number }, now = new Date()): {
  ageYears: number;
  tone: "current" | "ageing" | "overdue";
  label: string;
} {
  const ageYears = Math.max(0, now.getFullYear() - rec.year);
  if (ageYears <= 3) return { ageYears, tone: "current", label: `${ageYears} yr since publication` };
  if (ageYears <= 5) return { ageYears, tone: "ageing", label: `${ageYears} yrs — approaching review` };
  return { ageYears, tone: "overdue", label: `${ageYears} yrs — likely overdue for review` };
}

/**
 * The single most-cited meta-research phenotype: a strong recommendation
 * resting on low or very-low certainty evidence. It is a defensibility
 * problem for the policy lens and an instability signal for the researcher
 * and industry lenses, so it is computed once here.
 */
export function strengthCertaintyDiscordance(rec: Guideline): boolean {
  const strong = /strong/i.test(rec.strength);
  const lowCertainty =
    rec.gradeCertaintyLevel === "low" ||
    rec.gradeCertaintyLevel === "very_low" ||
    rec.gradeCertaintyLevel === "low_very_low";
  return strong && lowCertainty;
}

/** True when the guideline used no explicit grading system — meaning its
 *  certainty cannot be pooled with GRADE-based guidelines, and new trial
 *  evidence has no mechanical route to change the rating. */
export function isUngraded(rec: Guideline): boolean {
  return rec.gradingApproach !== "GRADE";
}

/**
 * The framing sentence shown at the top of a recommendation for the current
 * lens. This is composed only from fields already on the record — it states
 * the same facts a different way, and adds nothing.
 */
export function frameRecommendation(lens: AudienceLens, rec: Guideline, group: GuidelineGroup): string {
  const org = group.organization;
  const dir =
    rec.direction === "for"
      ? "recommends using"
      : rec.direction === "against"
        ? "recommends against"
        : "does not take a clear position on";
  const rex = rec.agreeRex.status === "appraised" ? rec.agreeRex.rex : null;
  const implementability = rex?.domains.find((d) => d.key === "implementability");
  const resource = findAgreeItem(group.agree, AGREE_ITEM_RESOURCE);
  const monitoring = findAgreeItem(group.agree, AGREE_ITEM_MONITORING);

  switch (lens.key) {
    case "point_of_care_clinician":
      return `${org} ${dir} this, at ${rec.strength.toLowerCase()} strength, on ${rec.gradeCertaintyLabel.toLowerCase()} certainty evidence.`;
    case "lived_experience":
      return `This is what ${org} suggests for people in this situation, and how sure they are about it.`;
    case "policy_maker":
      return [
        `${org} ${dir} this.`,
        implementability
          ? `Implementability scores ${Math.round(implementability.score01 * 100)}%.`
          : `No recommendation-level implementability appraisal is on file.`,
        `Resource implications: ${itemVerdict(resource?.score).label.toLowerCase()}.`,
        `Monitoring criteria: ${itemVerdict(monitoring?.score).label.toLowerCase()}.`,
      ].join(" ");
    case "researcher":
      return `${rec.recommendationTypeLabel} · ${rec.gradingApproachLabel} · ${rec.gradeCertaintyLabel} certainty${
        strengthCertaintyDiscordance(rec) ? " · strong-on-low-certainty discordance" : ""
      }.`;
    case "guideline_developer":
      return `AGREE II ${group.agree.overall7.toFixed(1)}/7 overall; this recommendation is a ${rec.recommendationTypeLabel.toLowerCase()} graded via ${rec.gradingApproachLabel}.`;
    case "industry":
      return `Current position: ${org} ${dir} this (${rec.strength.toLowerCase()} strength, ${rec.gradeCertaintyLabel.toLowerCase()} certainty), ${currency(rec).label.toLowerCase()}.`;
    default:
      return "";
  }
}
