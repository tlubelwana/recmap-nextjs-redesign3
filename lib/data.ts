import fs from "node:fs";
import path from "node:path";
import type { Guideline, GuidelineGroup } from "./types";
import { DATA_DIR, UPLOADED_DIR } from "./storage";

const BASE_FILE = path.join(process.cwd(), "data", "guidelines.json");

/** The 13 guidelines shipped with the app, pre-appraised from the AGREE II /
 *  recommendation workbooks. These scores are never re-derived by the LLM —
 *  per spec, existing AGREE II results are used as-is, structured data only. */
function loadBaseGuidelines(): Guideline[] {
  const raw = fs.readFileSync(BASE_FILE, "utf-8");
  return JSON.parse(raw) as Guideline[];
}

/** Guidelines added through the Upload flow. Each is persisted as its own
 *  JSON file under data/uploaded/ so a restart doesn't lose them. This is a
 *  simple first-version store — swap for a real database later without
 *  touching any callers of getAllGuidelines(). */
function loadUploadedGuidelines(): Guideline[] {
  if (!fs.existsSync(UPLOADED_DIR)) return [];
  const files = fs.readdirSync(UPLOADED_DIR).filter((f) => f.endsWith(".json"));
  return files.map((f) => {
    const raw = fs.readFileSync(path.join(UPLOADED_DIR, f), "utf-8");
    return JSON.parse(raw) as Guideline;
  });
}

export function getAllGuidelines(): Guideline[] {
  return [...loadBaseGuidelines(), ...loadUploadedGuidelines()];
}

export function getGuidelineById(id: string): Guideline | undefined {
  return getAllGuidelines().find((g) => g.id === id);
}

/** Groups every recommendation-statement record by its source guideline
 *  document (guidelineId). A guideline with multiple recommendations
 *  (e.g. one guideline covering several distinct AI-use questions) comes
 *  back as one group holding all of them — this is what lets the Catalog
 *  show "one card per guideline, expanding to its individual recommendation
 *  statements" instead of one card per recommendation. Group order follows
 *  first-appearance order in the underlying data; recommendations within a
 *  group keep their original order. */
export function getGuidelineGroups(): GuidelineGroup[] {
  const all = getAllGuidelines();
  const order: string[] = [];
  const byId = new Map<string, Guideline[]>();
  for (const g of all) {
    if (!byId.has(g.guidelineId)) {
      byId.set(g.guidelineId, []);
      order.push(g.guidelineId);
    }
    byId.get(g.guidelineId)!.push(g);
  }
  return order.map((guidelineId) => {
    const recs = byId.get(guidelineId)!;
    const first = recs[0];
    return {
      guidelineId,
      guidelineTitle: first.guidelineTitle,
      organization: first.organization,
      source: first.source,
      year: first.year,
      region: first.region,
      worldRegion: first.worldRegion,
      clinicalArea: first.clinicalArea,
      pdfFile: first.pdfFile,
      agree: first.agree,
      agreeScoresEstimated: first.uploaded?.agreeScoresEstimated ?? false,
      lastCheckedISO: first.lastCheckedISO,
      recommendations: recs,
    };
  });
}

export function getGuidelineGroupById(guidelineId: string): GuidelineGroup | undefined {
  return getGuidelineGroups().find((g) => g.guidelineId === guidelineId);
}

export function saveUploadedGuideline(guideline: Guideline): void {
  if (!fs.existsSync(UPLOADED_DIR)) {
    fs.mkdirSync(UPLOADED_DIR, { recursive: true });
  }
  const file = path.join(UPLOADED_DIR, `${guideline.id}.json`);
  fs.writeFileSync(file, JSON.stringify(guideline, null, 2), "utf-8");
}

/** A slimmed-down, LLM-friendly projection of the catalog: everything the
 *  chat needs to ground an answer (recommendation text, PICO, every AGREE II
 *  item-level appraisal) without extra UI-only fields. Kept the same shape
 *  the previous single-file version sent, so prompt behavior stays familiar. */
export function getCatalogForGrounding() {
  return getAllGuidelines().map((r) => ({
    id: r.id,
    organization: r.organization,
    source: r.source,
    year: r.year,
    region: r.region,
    clinicalArea: r.clinicalArea,
    aiDomain: r.aiDomain,
    aiInput: r.aiInput,
    direction: r.directionRaw,
    strength: r.strength,
    certainty: r.certainty,
    gradeCertaintyLabel: r.gradeCertaintyLabel,
    gradingApproachLabel: r.gradingApproachLabel,
    recommendationTypeLabel: r.recommendationTypeLabel,
    recommendationText: r.recommendationText,
    agreeRexStatus: r.agreeRex.status,
    // Real AGREE-REX summary for grounding, only when a real appraisal
    // exists (status "appraised") — never send a number for "not_eligible"
    // or "eligible_not_yet_appraised", so the model can't imply a score it
    // doesn't have.
    agreeRex:
      r.agreeRex.status === "appraised" && r.agreeRex.rex
        ? {
            overall7: r.agreeRex.rex.overall7,
            overallPct: r.agreeRex.rex.overallPct,
            domains: r.agreeRex.rex.domains.map((d) => ({ label: d.label, score7: d.score7, pct: Math.round(d.score01 * 100) })),
            aiGeneratedCaveat: true,
          }
        : null,
    icd11: r.coding.icd11 ? `${r.coding.icd11.code} ${r.coding.icd11.label}` : null,
    equityEvaluated: r.equity.evaluated,
    equityNote: r.equity.evaluated ? r.equity.note : null,
    pico: r.pico,
    agreeOverall7: r.agree.overall7,
    agreeScoresEstimated: r.uploaded?.agreeScoresEstimated ?? false,
    agreeDomains: r.agree.domains.map((d) => ({
      label: d.label,
      score7: d.score7,
      items: d.items.map((it) => ({
        num: it.num,
        text: it.text,
        score7: it.score,
        appraisal: it.appraisal,
      })),
    })),
  }));
}
