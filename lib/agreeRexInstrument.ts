// The AGREE-REX instrument (AGREE Recommendations Excellence), 9 items
// across 3 domains. Fixed text, verified against the official instrument
// published by the AGREE Research Trust (agreetrust.org). Unlike AGREE II
// — which appraises the RIGOUR of the guideline-development PROCESS —
// AGREE-REX appraises the trustworthiness of an individual RECOMMENDATION:
// whether it accounts for patient values, is applicable to real-world
// target users and populations, and is genuinely implementable. Same 1
// (lowest) to 7 (highest) scale and normalization formula as AGREE II:
// domain% = (sum − n) / (6n); score7 = domain% × 7.

import type { AgreeRexDomainKey } from "./types";

export interface AgreeRexInstrumentItem {
  num: number;
  text: string;
}

export interface AgreeRexInstrumentDomain {
  key: AgreeRexDomainKey;
  label: string;
  short: string;
  items: AgreeRexInstrumentItem[];
}

export const AGREE_REX_INSTRUMENT: AgreeRexInstrumentDomain[] = [
  {
    key: "clinical_applicability",
    label: "Clinical Applicability",
    short: "CA",
    items: [
      { num: 1, text: "The evidence supporting the recommendation is applicable to the clinical question at hand" },
      { num: 2, text: "The recommendation is applicable to the target users it is intended for" },
      { num: 3, text: "The recommendation is applicable to the target patients/populations it is intended for" },
    ],
  },
  {
    key: "values_and_preferences",
    label: "Values & Preferences",
    short: "VP",
    items: [
      { num: 4, text: "The recommendation reflects the values and preferences of target users" },
      { num: 5, text: "The recommendation reflects the values and preferences of target patients/populations" },
      { num: 6, text: "The recommendation reflects the values and preferences of policy/decision makers" },
      { num: 7, text: "The recommendation reflects the values and preferences of the guideline developers" },
    ],
  },
  {
    key: "implementability",
    label: "Implementability",
    short: "IM",
    items: [
      { num: 8, text: "The purpose of the recommendation is clear and actionable" },
      { num: 9, text: "The recommendation is feasible for local application and adoption" },
    ],
  },
];
