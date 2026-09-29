// The standard AGREE II instrument (23 items across 6 domains). Fixed text —
// this is what an uploaded guideline gets scored against by the LLM
// extraction pipeline, and what a human-appraised guideline in
// data/guidelines.json was already scored against in the source workbooks.

export interface AgreeInstrumentItem {
  num: number;
  text: string;
}

export interface AgreeInstrumentDomain {
  key:
    | "scope_purpose"
    | "stakeholder_involvement"
    | "rigour_of_development"
    | "clarity_of_presentation"
    | "applicability"
    | "editorial_independence";
  label: string;
  short: string;
  items: AgreeInstrumentItem[];
}

export const AGREE_INSTRUMENT: AgreeInstrumentDomain[] = [
  {
    key: "scope_purpose",
    label: "Scope & Purpose",
    short: "SP",
    items: [
      { num: 1, text: "Overall objective(s) specifically described" },
      { num: 2, text: "Health question(s) specifically described" },
      { num: 3, text: "Population specifically described" },
    ],
  },
  {
    key: "stakeholder_involvement",
    label: "Stakeholder Involvement",
    short: "SI",
    items: [
      { num: 4, text: "Relevant professional groups included" },
      { num: 5, text: "Views/preferences of target population sought" },
      { num: 6, text: "Target users clearly defined" },
    ],
  },
  {
    key: "rigour_of_development",
    label: "Rigour of Development",
    short: "RD",
    items: [
      { num: 7, text: "Systematic methods used to search for evidence" },
      { num: 8, text: "Evidence selection criteria clearly described" },
      { num: 9, text: "Strengths/limitations of body of evidence clearly stated" },
      { num: 10, text: "Methods for formulating recommendations clearly described" },
      { num: 11, text: "Benefits, side effects, and risks considered" },
      { num: 12, text: "Explicit link recommendations ↔ supporting evidence" },
      { num: 13, text: "External review by experts before publication" },
      { num: 14, text: "Updating procedure provided" },
    ],
  },
  {
    key: "clarity_of_presentation",
    label: "Clarity of Presentation",
    short: "CP",
    items: [
      { num: 15, text: "Recommendations specific and unambiguous" },
      { num: 16, text: "Different management options clearly presented" },
      { num: 17, text: "Key recommendations easily identifiable" },
    ],
  },
  {
    key: "applicability",
    label: "Applicability",
    short: "AP",
    items: [
      { num: 18, text: "Facilitators/barriers to application described" },
      { num: 19, text: "Advice/tools for putting recommendations into practice" },
      { num: 20, text: "Resource implications considered" },
      { num: 21, text: "Monitoring/auditing criteria presented" },
    ],
  },
  {
    key: "editorial_independence",
    label: "Editorial Independence",
    short: "EI",
    items: [
      { num: 22, text: "Funding-body influence addressed" },
      { num: 23, text: "Competing interests recorded and addressed" },
    ],
  },
];
