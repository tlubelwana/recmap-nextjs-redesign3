// Shared formatting / display helpers for the RecMap frontend. Pure
// functions only — no React here — so both client components and any
// future server components can import freely.

import type { Guideline, GuidelineGroup } from "@/lib/types";

export type DirVisual = "for" | "against" | "neutral";

/** Maps whatever the backend put in `direction` to one of the three visual
 *  buckets our CSS knows about. The shipped dataset actually uses more
 *  granular values ("no_recommendation", "insufficient_evidence") than the
 *  Guideline["direction"] type declares, so this is deliberately permissive
 *  rather than a strict switch. */
export function directionVisual(direction: string): DirVisual {
  if (direction === "for") return "for";
  if (direction === "against") return "against";
  return "neutral";
}

/** Human label for a guideline's direction — directionRaw already carries
 *  a friendly phrase ("In favour", "No recommendation", ...). */
export function directionLabel(g: Pick<Guideline, "direction" | "directionRaw">): string {
  return g.directionRaw?.trim() || g.direction;
}

/** Short 1-3 letter initials for an organization, used in the small avatar
 *  chip on cards (drops parenthetical acronyms since those are handled by
 *  the initials themselves, e.g. "American Gastroenterological Association
 *  (AGA)" -> "AGA"). */
export function orgInitials(org: string): string {
  const paren = org.match(/\(([^)]+)\)/);
  if (paren && paren[1].trim().length <= 6) {
    return paren[1].trim().toUpperCase();
  }
  const words = org
    .replace(/\([^)]*\)/g, "")
    .split(/[\s/]+/)
    .filter((w) => w.length > 0 && /[A-Za-z]/.test(w));
  const initials = words
    .slice(0, 3)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return initials || "—";
}

export function formatDate(iso: string | undefined): string {
  if (!iso) return "unknown date";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatScore7(score7: number): string {
  return `${score7.toFixed(1)}/7`;
}

export function truncate(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max).trim()}…`;
}

export function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

/** Wraps a single Guideline (e.g. the just-uploaded record on the Upload
 *  success page) as a one-recommendation GuidelineGroup, matching the shape
 *  lib/data.ts#getGuidelineGroups produces for the catalog. Lets
 *  GuidelineDetail take a GuidelineGroup everywhere without every caller
 *  needing its own grouping logic. */
export function toSingleGuidelineGroup(guideline: Guideline): GuidelineGroup {
  return {
    guidelineId: guideline.guidelineId,
    guidelineTitle: guideline.guidelineTitle,
    organization: guideline.organization,
    source: guideline.source,
    year: guideline.year,
    region: guideline.region,
    worldRegion: guideline.worldRegion,
    clinicalArea: guideline.clinicalArea,
    pdfFile: guideline.pdfFile,
    agree: guideline.agree,
    agreeScoresEstimated: guideline.uploaded?.agreeScoresEstimated ?? false,
    lastCheckedISO: guideline.lastCheckedISO,
    recommendations: [guideline],
  };
}
