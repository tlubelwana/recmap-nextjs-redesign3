import {
  AGREE_ITEM_BARRIERS,
  AGREE_ITEM_MONITORING,
  AGREE_ITEM_RESOURCE,
  AGREE_ITEM_TOOLS,
  currency,
  findAgreeItem,
  itemVerdict,
} from "./audienceLens";
import { AGREE_GATE_THRESHOLD_PCT, passesAgreeGate } from "./config";
import type { AgreeItem, Guideline } from "./types";

/**
 * Shared logic for the two halves of the "can I use this here?" question:
 *
 *   CONTEXTUALISATION — does this guideline transfer to my setting at all?
 *   IMPLEMENTATION    — what does the guideline give me to work with?
 *
 * Lifted out of app/(authed)/(main)/contextualisation and .../implementation
 * so the Reports page reaches the same verdicts from the same rules. Two
 * copies of a clinical judgement rule that drift apart is exactly the bug
 * this app exists to expose in other people's guidance, so it shouldn't
 * have one of its own.
 *
 * Everything here is arithmetic over data already in the catalog. Nothing
 * is generated, and where the source guideline never addressed something,
 * these functions report that rather than filling the gap.
 */

export type TransferRung = "adopt" | "adapt" | "adapt_caution";

export const TRANSFER_RUNG_META: Record<TransferRung, { label: string; blurb: string; tone: string }> = {
  adopt: {
    label: "Adopt candidate",
    blurb:
      "Written for a context like yours, still current, and developed rigorously enough that a local group could plausibly endorse it unchanged — after checking it against local practice.",
    tone: "good",
  },
  adapt: {
    label: "Adapt",
    blurb:
      "Sound guidance, but at least one thing about it doesn't transfer directly — the setting it was written for, its age, or the rigour of the process behind it. Keep the recommendation, revisit the parts flagged below.",
    tone: "warn",
  },
  adapt_caution: {
    label: "Adapt with caution",
    blurb:
      "Several signals point away from direct transfer. Treat this as evidence to inform a local decision rather than as a recommendation to carry across, and consider whether a de-novo process is the honest answer.",
    tone: "stop",
  },
};

/** The rule, stated once and shown to the reader verbatim wherever it runs. */
export const TRANSFER_RULE: { k: string; v: string }[] = [
  {
    k: "Context fit",
    v: "The guideline was issued for your region, or issued internationally / multinationally.",
  },
  {
    k: "Currency",
    v: "Published within the last 3 years. 3–5 years counts as ageing; over 5 years as likely overdue for review.",
  },
  {
    k: "Development rigour",
    v: `AGREE II overall clears the ${AGREE_GATE_THRESHOLD_PCT}% gate this app already uses to decide AGREE-REX eligibility.`,
  },
  {
    k: "Values fit",
    v: "Where an AGREE-REX appraisal exists, its Values & Preferences domain scores 4/7 or above — i.e. the guideline engaged with what patients in its setting would want.",
  },
];

export interface TransferSignal {
  ok: boolean;
  label: string;
  detail: string;
}

export interface TransferAssessment {
  rung: TransferRung;
  signals: TransferSignal[];
  failures: number;
}

function rexDomain(rec: Guideline, key: "implementability" | "clinical_applicability" | "values_and_preferences") {
  if (rec.agreeRex.status !== "appraised" || !rec.agreeRex.rex) return null;
  return rec.agreeRex.rex.domains.find((d) => d.key === key) ?? null;
}

/**
 * Place one recommendation on the adopt / adapt / adapt-with-caution
 * ladder. `myRegion` is a world-region string; pass "" to skip the
 * context-fit check (it then passes by default, and callers should say so).
 */
export function assessTransfer(rec: Guideline, myRegion: string): TransferAssessment {
  const global = rec.worldRegion === "Global / multinational";
  const regionMatch = !myRegion || global || rec.worldRegion === myRegion;
  const age = currency({ year: rec.year });
  const rigour = passesAgreeGate(rec.agree.overall7);
  const values = rexDomain(rec, "values_and_preferences");
  const clinApp = rexDomain(rec, "clinical_applicability");
  const estimated = Boolean(rec.uploaded?.agreeScoresEstimated);

  const signals: TransferSignal[] = [
    {
      ok: regionMatch,
      label: "Context fit",
      detail: global
        ? `Issued as international / multinational guidance (${rec.region}), so it isn't anchored to one health system.`
        : regionMatch
          ? `Issued for ${rec.region} — the same region you selected.`
          : `Issued for ${rec.region} (${rec.worldRegion}). Care pathways, reimbursement and device availability there may not match your setting.`,
    },
    {
      ok: age.tone === "current",
      label: "Currency",
      detail: `Published ${rec.year} — ${age.label.toLowerCase()}.`,
    },
    {
      ok: rigour,
      label: "Development rigour",
      detail: `AGREE II overall ${rec.agree.overall7.toFixed(1)}/7 (${Math.round(
        (rec.agree.overall7 / 7) * 100
      )}%), against a ${AGREE_GATE_THRESHOLD_PCT}% gate.${
        estimated ? " Scored by RecMap's AI appraisal pipeline rather than a human reviewer of this document." : ""
      }`,
    },
    {
      ok: values ? values.score7 >= 4 : false,
      label: "Values fit",
      detail: values
        ? `AGREE-REX Values & Preferences ${values.score7.toFixed(1)}/7${
            clinApp ? `, Clinical Applicability ${clinApp.score7.toFixed(1)}/7` : ""
          }. AI-generated first-pass appraisal — verify against the source before relying on it.`
        : rec.agreeRex.status === "not_eligible"
          ? `No AGREE-REX appraisal: this guideline didn't clear the ${AGREE_GATE_THRESHOLD_PCT}% AGREE II gate, so how well it engaged with patients' values is unknown here.`
          : "Eligible for AGREE-REX but not yet appraised — whether it engaged with patients' values is unknown here.",
    },
  ];

  const failures = signals.filter((s) => !s.ok).length;
  const rung: TransferRung = failures === 0 ? "adopt" : failures <= 2 ? "adapt" : "adapt_caution";
  return { rung, signals, failures };
}

// --- Implementation ------------------------------------------------------

/** AGREE II domain 5, the four items that decide whether a guideline hands
 *  you anything usable. */
export const APPLICABILITY_ITEMS = [
  {
    num: AGREE_ITEM_BARRIERS,
    key: "barriers",
    label: "Barriers & facilitators",
    question: "Does the guideline say what will get in the way of using it — and what will help?",
  },
  {
    num: AGREE_ITEM_TOOLS,
    key: "tools",
    label: "Tools & advice",
    question: "Does it hand you anything usable — pathways, checklists, audit forms, patient materials?",
  },
  {
    num: AGREE_ITEM_RESOURCE,
    key: "resources",
    label: "Resource implications",
    question: "Does it cost out what applying the recommendations would take — staff, equipment, time, money?",
  },
  {
    num: AGREE_ITEM_MONITORING,
    key: "monitoring",
    label: "Monitoring & audit",
    question: "Does it define criteria you could measure yourself against after adopting it?",
  },
] as const;

export interface ImplementationRead {
  items: { key: string; label: string; question: string; item: AgreeItem | null; verdictLabel: string; tone: string }[];
  applicability7: number;
  implementability: number | null;
  clinicalApplicability: number | null;
  rexStatus: Guideline["agreeRex"]["status"];
  equityEvaluated: boolean;
  equityNote: string;
}

export function readImplementation(rec: Guideline): ImplementationRead {
  const domain = rec.agree.domains.find((d) => d.key === "applicability");
  const impl = rexDomain(rec, "implementability");
  const clin = rexDomain(rec, "clinical_applicability");
  return {
    items: APPLICABILITY_ITEMS.map((spec) => {
      const item = findAgreeItem(rec.agree, spec.num);
      const verdict = itemVerdict(item?.score);
      return {
        key: spec.key,
        label: spec.label,
        question: spec.question,
        item,
        verdictLabel: verdict.label,
        tone: verdict.tone,
      };
    }),
    applicability7: domain ? domain.score7 : 0,
    implementability: impl ? impl.score7 : null,
    clinicalApplicability: clin ? clin.score7 : null,
    rexStatus: rec.agreeRex.status,
    equityEvaluated: rec.equity.evaluated,
    equityNote: rec.equity.note,
  };
}
