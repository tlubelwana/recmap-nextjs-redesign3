"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { directionLabel, directionVisual, orgInitials, uniqueSorted } from "@/components/format";
import GuidelineDetail from "@/components/GuidelineDetail";
import GuidelineDrawer from "@/components/GuidelineDrawer";
import DirectionBadge from "@/components/DirectionBadge";
import { currency } from "@/lib/audienceLens";
import type { Guideline, GuidelineGroup, GradeCertaintyLevel } from "@/lib/types";
import AudienceLensBar from "@/components/AudienceLensBar";
import CatalogCharts from "@/components/CatalogCharts";
import { useAudienceLens } from "@/components/LensProvider";

// "The map view and all accompanied data is tailored to specific audience"
// — the view/sort a signed-in user lands on is the current AUDIENCE LENS's
// own default (lib/audienceLens.ts#mapDefaults), applied on arrival and
// re-applied whenever the reader switches lens from the bar above. It never
// overrides a sort the user set by hand within one lens: switching lens is
// an explicit request to be shown that audience's default arrangement,
// where a hand-set sort is not.
const DIR_ICON_PATH: Record<string, string> = {
  for: "M8 12.5l2.5 2.5L16 9.5",
  against: "M9.5 9.5l5 5M14.5 9.5l-5 5",
  neutral: "M8 12h8",
};
const DIR_COLOR_VAR: Record<string, string> = {
  for: "var(--favour)",
  against: "var(--against)",
  neutral: "var(--neutral)",
};

// --- GRADE certainty visual scale ------------------------------------
// GRADE certainty of evidence gets its own "how much should I trust the
// evidence" color scale, deliberately distinct from the neutral-colored
// AGREE II ring (which answers "how rigorously was this guideline built").
// Ranked worst (0) to best (4); "not_reported" sits outside the ramp
// entirely since it's a data gap, not a low-trust rating. Every stop is
// built from the app's existing themed tokens (--against/--accent/--favour)
// via color-mix so the ramp keeps working automatically in dark mode.
const GRADE_RANK: Record<GradeCertaintyLevel, number> = {
  very_low: 0,
  low_very_low: 1,
  low: 2,
  moderate: 3,
  high: 4,
  not_reported: -1,
};
const GRADE_RAMP = [
  "var(--against)",
  "color-mix(in srgb, var(--against) 55%, var(--accent) 45%)",
  "var(--accent)",
  "color-mix(in srgb, var(--accent) 45%, var(--favour) 55%)",
  "var(--favour)",
];
function gradeCertaintyColor(level: GradeCertaintyLevel): string {
  const rank = GRADE_RANK[level];
  return rank < 0 ? "var(--ink-400)" : GRADE_RAMP[rank];
}
const GRADE_LEGEND: { level: GradeCertaintyLevel; label: string }[] = [
  { level: "high", label: "GRADE certainty: High" },
  { level: "moderate", label: "GRADE certainty: Moderate" },
  { level: "low", label: "GRADE certainty: Low" },
  { level: "low_very_low", label: "GRADE certainty: Low / very low" },
  { level: "very_low", label: "GRADE certainty: Very low" },
  { level: "not_reported", label: "GRADE certainty: Not reported" },
];


// --- Density map coverage color scale ---------------------------------
// A banded amber ramp for the population × topic density map, deliberately
// a different hue from the teal clinical-area × AI-domain heatmap so the
// two coverage views don't read as the same measurement.
//
// Banded rather than continuous on purpose: a continuous ramp invites
// reading a shade as an exact value, which it isn't. The bands are derived
// from the data actually in view rather than fixed, because this catalog
// deals in counts of a few, and a legend reading "46+" against a maximum
// of five would be theatre.
const DENSITY_RAMP = ["#fbf3e5", "#f6ddb0", "#f0c47c", "#e8a54c", "#da842c", "#a95a1c"];

interface DensityBand {
  /** Inclusive lower bound. */
  from: number;
  /** Inclusive upper bound; null means "and above". */
  to: number | null;
  label: string;
  color: string;
}

function densityBands(max: number): DensityBand[] {
  const bands: DensityBand[] = [{ from: 0, to: 0, label: "0", color: DENSITY_RAMP[0] }];
  if (max <= 0) return bands;
  const steps = Math.min(5, Math.max(1, max));
  const size = Math.max(1, Math.ceil(max / steps));
  let from = 1;
  let i = 1;
  while (from <= max && i < DENSITY_RAMP.length) {
    const last = from + size - 1 >= max || i === DENSITY_RAMP.length - 1;
    const to = last ? max : from + size - 1;
    bands.push({
      from,
      to: last ? null : to,
      label: last ? (from >= max ? `${from}` : `${from}+`) : from === to ? `${from}` : `${from}\u2013${to}`,
      color: DENSITY_RAMP[i],
    });
    from = to + 1;
    i += 1;
  }
  return bands;
}

function densityBandFor(count: number, bands: DensityBand[]): DensityBand {
  for (const b of bands) {
    if (count >= b.from && (b.to === null || count <= b.to)) return b;
  }
  return bands[bands.length - 1];
}

function densityCellBg(count: number, bands: DensityBand[]): string {
  return densityBandFor(count, bands).color;
}

/** Dark fills need light text; the two palest bands don't. */
function densityCellInk(count: number, bands: DensityBand[]): string {
  const index = bands.indexOf(densityBandFor(count, bands));
  return index >= 4 ? "#ffffff" : "#5a4325";
}

// A recommendation's PICO population text is free text (there's no
// structured "population type" field in the data model), so the density
// map's row axis is derived from it with a simple, transparent keyword
// heuristic rather than a fabricated classification — shown in the map's
// caption so it's clear this is a derived grouping, not extracted data.
function populationBucket(populationText: string): string {
  const v = (populationText || "").toLowerCase();
  if (v.includes("screen") || v.includes("surveil")) return "Screening / surveillance population";
  if (v.includes("suspect") || v.includes("confirmed") || v.includes("diagnos")) {
    return "Symptomatic / diagnostic population";
  }
  return "Population not otherwise specified";
}

/** Icons for the Map / Heatmap / Density / List switcher, matching the v3
 *  snapshot's segmented control. Hand-rolled rather than pulled from an
 *  icon package — none is installed and the environment can't reliably add
 *  one, the same reason the charts are hand-drawn SVG. */
const VIEW_ICONS: Record<"map" | "matrix" | "charts" | "details" | "list", React.ReactNode> = {
  map: (
    <>
      <circle cx="12" cy="7" r="2.6" />
      <circle cx="5.6" cy="17" r="2.6" />
      <circle cx="18.4" cy="17" r="2.6" />
      <path d="M10.4 9.2 7.2 14.8M13.6 9.2l3.2 5.6M8.2 17h7.6" />
    </>
  ),
  matrix: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />
      <path d="M9.5 3.5v17M15 3.5v17M3.5 9.5h17M3.5 15h17" />
    </>
  ),
  charts: (
    <>
      <path d="M4.5 20V10.5M10 20V4.5M15.5 20v-7M21 20V8" />
    </>
  ),
  details: (
    <>
      <path d="M5 4.5h14a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18V6A1.5 1.5 0 0 1 5 4.5Z" />
      <path d="M7.5 9h5M7.5 12.5h9M7.5 16h6.5" />
    </>
  ),
  list: (
    <>
      <path d="M9 6.5h11M9 12h11M9 17.5h11" />
      <path d="M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01" strokeWidth="2.6" />
    </>
  ),
};

const VIEW_TABS: { key: "map" | "matrix" | "charts" | "details" | "list"; label: string }[] = [
  { key: "map", label: "Map" },
  { key: "matrix", label: "Matrix" },
  { key: "charts", label: "Charts" },
  { key: "details", label: "Details" },
  { key: "list", label: "List" },
];

/**
 * MATRIX AXES.
 *
 * The old Heatmap (clinical area x AI domain) and Density map (population
 * bucket x clinical area) were the same visualisation — a count of
 * recommendations across two categorical fields — differing only in which
 * fields sat on the axes. They even shared the clinical-area axis. They're
 * now one Matrix view with pickers, which also unlocks pairings neither
 * offered: organisation x direction, region x certainty, type x certainty.
 *
 * `derived: true` marks an axis that is NOT an extracted field but a
 * grouping computed from free text. The UI has to keep saying so — a
 * reader who takes a keyword heuristic for recorded data will over-read
 * the result.
 */
interface AxisField {
  key: string;
  label: string;
  value: (g: Guideline) => string;
  derived?: boolean;
  note?: string;
}

const AXIS_FIELDS: AxisField[] = [
  { key: "clinicalArea", label: "Clinical area", value: (g) => g.clinicalArea },
  { key: "aiDomain", label: "AI domain", value: (g) => g.aiDomain },
  { key: "organization", label: "Organisation", value: (g) => g.organization },
  { key: "worldRegion", label: "World region", value: (g) => g.worldRegion },
  { key: "direction", label: "Direction", value: (g) => directionLabel(g) },
  { key: "recommendationType", label: "Recommendation type", value: (g) => g.recommendationTypeLabel },
  { key: "gradeCertainty", label: "GRADE certainty", value: (g) => g.gradeCertaintyLabel },
  { key: "gradingApproach", label: "Grading approach", value: (g) => g.gradingApproachLabel },
  { key: "year", label: "Publication year", value: (g) => String(g.year) },
  {
    key: "population",
    label: "Population (derived)",
    value: (g) => populationBucket(g.pico.population),
    derived: true,
    note: "Population buckets are grouped from each recommendation's free-text PICO population by keyword. They are a derived grouping, not extracted data.",
  },
];

function axisField(key: string): AxisField {
  return AXIS_FIELDS.find((f) => f.key === key) ?? AXIS_FIELDS[0];
}

/**
 * The side-by-side comparison rows. Each renders one attribute for one
 * guideline, so a reader scans across a row and compares like with like —
 * which is the thing the drawer, showing one record at a time, can't do.
 *
 * Order is the order the question gets asked in practice: what does it say,
 * how much should I trust it, will it transfer, what would it take.
 */
const COMPARE_ROWS: {
  key: string;
  label: string;
  note?: string;
  render: (g: GuidelineGroup) => React.ReactNode;
}[] = [
  {
    key: "direction",
    label: "Direction",
    render: (g) => {
      const first = g.recommendations[0];
      return g.recommendations.length === 1 ? (
        <span className={`cmp-pill dir-${directionVisual(first.direction)}`}>{directionLabel(first)}</span>
      ) : (
        <div className="cmp-stack">
          {g.recommendations.map((r) => (
            <span key={r.id} className={`cmp-pill dir-${directionVisual(r.direction)}`}>
              {directionLabel(r)}
            </span>
          ))}
        </div>
      );
    },
  },
  {
    key: "recommendation",
    label: "Recommendation",
    render: (g) => (
      <div className="cmp-stack">
        {g.recommendations.map((r) => (
          <p className="cmp-quote" key={r.id}>
            &ldquo;{r.recommendationText}&rdquo;
          </p>
        ))}
      </div>
    ),
  },
  {
    key: "type",
    label: "Statement type",
    render: (g) => (
      <div className="cmp-stack">
        {uniqueSorted(g.recommendations.map((r) => r.recommendationTypeLabel)).map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>
    ),
  },
  {
    key: "strength",
    label: "Strength",
    render: (g) => (
      <div className="cmp-stack">
        {uniqueSorted(g.recommendations.map((r) => r.strength || "Not stated")).map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>
    ),
  },
  {
    key: "grade",
    label: "GRADE certainty",
    note: "Confidence in the evidence",
    render: (g) => (
      <div className="cmp-stack">
        {g.recommendations.map((r) => (
          <span key={r.id} style={{ color: gradeCertaintyColor(r.gradeCertaintyLevel), fontWeight: 700 }}>
            {r.gradeCertaintyLabel}
          </span>
        ))}
      </div>
    ),
  },
  {
    key: "grading",
    label: "Grading approach",
    render: (g) => (
      <div className="cmp-stack">
        {uniqueSorted(g.recommendations.map((r) => r.gradingApproachLabel)).map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>
    ),
  },
  {
    key: "agree",
    label: "AGREE II overall",
    note: "Rigour of development",
    render: (g) => {
      const pct = Math.round((g.agree.overall7 / 7) * 100);
      return (
        <div className="cmp-meter">
          <span className="cmp-meter-track">
            <span className="cmp-meter-fill" style={{ width: `${pct}%` }} />
          </span>
          <b>
            {pct}% <small>· {g.agree.overall7.toFixed(1)}/7</small>
          </b>
          {g.agreeScoresEstimated && <span className="cmp-flag">AI appraisal</span>}
        </div>
      );
    },
  },
  {
    key: "applicability",
    label: "Applicability",
    note: "AGREE II domain 5",
    render: (g) => {
      const d = g.agree.domains.find((x) => x.key === "applicability");
      if (!d) return <span className="cmp-none">Not scored</span>;
      const pct = Math.round((d.score7 / 7) * 100);
      return (
        <div className="cmp-meter">
          <span className="cmp-meter-track">
            <span className="cmp-meter-fill" style={{ width: `${pct}%` }} />
          </span>
          <b>{pct}%</b>
        </div>
      );
    },
  },
  {
    key: "rex",
    label: "AGREE-REX",
    note: "Recommendation-level trust",
    render: (g) => {
      const rec = g.recommendations[0];
      if (rec.agreeRex.status !== "appraised" || !rec.agreeRex.rex) {
        return (
          <span className="cmp-none">
            {rec.agreeRex.status === "not_eligible" ? "Not eligible" : "Not yet appraised"}
          </span>
        );
      }
      const impl = rec.agreeRex.rex.domains.find((d) => d.key === "implementability");
      return (
        <div className="cmp-stack">
          <span>Overall {rec.agreeRex.rex.overallPct.toFixed(0)}%</span>
          {impl && <span className="cmp-sub-inline">Implementability {impl.score7.toFixed(1)}/7</span>}
        </div>
      );
    },
  },
  {
    key: "currency",
    label: "Currency",
    render: (g) => {
      const c = currency(g);
      return <span className={c.tone === "current" ? "" : "cmp-warn"}>{c.label}</span>;
    },
  },
  {
    key: "region",
    label: "Issued for",
    render: (g) => (
      <span>
        {g.region}
        <span className="cmp-sub-inline"> · {g.worldRegion}</span>
      </span>
    ),
  },
  {
    key: "equity",
    label: "Equity assessed",
    note: "PROGRESS-Plus",
    render: (g) =>
      g.recommendations[0].equity.evaluated ? (
        <span>Yes</span>
      ) : (
        <span className="cmp-none">Not evaluated</span>
      ),
  },
];

type SortKey = "org" | "area" | "direction" | "agree" | "grade" | "year";

function sortGuidelines(rows: Guideline[], sortKey: SortKey, sortDir: "asc" | "desc"): Guideline[] {
  return rows.slice().sort((a, b) => {
    let av: string | number;
    let bv: string | number;
    if (sortKey === "org") {
      av = a.organization;
      bv = b.organization;
    } else if (sortKey === "area") {
      av = a.clinicalArea;
      bv = b.clinicalArea;
    } else if (sortKey === "direction") {
      av = a.direction;
      bv = b.direction;
    } else if (sortKey === "year") {
      av = a.year;
      bv = b.year;
    } else if (sortKey === "grade") {
      av = GRADE_RANK[a.gradeCertaintyLevel];
      bv = GRADE_RANK[b.gradeCertaintyLevel];
    } else {
      av = a.agree.overall7;
      bv = b.agree.overall7;
    }
    if (typeof av === "string" && typeof bv === "string") {
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
  });
}

// --- Canvas layout: a radial map. One centre node (the question, or the
// catalog as a whole) with every matching guideline arranged on rings
// around it and a curved connector back to the middle. Guidelines are
// ordered by clinical area before being placed, so recommendations on the
// same topic land next to each other on the ring even though the ring
// carries no cluster labels. Replaces the earlier column-per-clinical-area
// layout ported from app.html. ---

interface LayoutNode {
  guideline: Guideline;
  x: number;
  y: number;
  /** Unit vector from the centre — used to aim the connector curve. */
  ux: number;
  uy: number;
}
interface CenterNode {
  x: number;
  y: number;
}
interface MapLayout {
  nodes: LayoutNode[];
  centerNode: CenterNode;
  width: number;
  height: number;
}

/** Geometry of a single node, shared by the layout and the renderer.
 *  Not exported: a Next.js page module may only export the component and
 *  its recognised route config, so a stray export here fails the build. */
const NODE_OUTER_R = 54;
const CENTER_R = 62;
/** Arc length each node needs on its ring, including breathing room. */
const NODE_SLOT = 165;
const FIRST_RING_R = 300;
const RING_GAP = 200;
const CANVAS_PAD = 130;

function computeMapLayout(records: Guideline[], _hasQuestion: boolean, containerW: number): MapLayout {
  const ordered = records
    .slice()
    .sort(
      (a, b) =>
        a.clinicalArea.localeCompare(b.clinicalArea) ||
        b.agree.overall7 - a.agree.overall7 ||
        a.organization.localeCompare(b.organization)
    );

  // Fill one ring at a time; each ring holds as many nodes as its
  // circumference allows, so nodes never crowd however many match.
  const rings: Guideline[][] = [];
  let remaining = ordered.slice();
  let ringIndex = 0;
  while (remaining.length > 0) {
    const radius = FIRST_RING_R + ringIndex * RING_GAP;
    const capacity = Math.max(6, Math.floor((2 * Math.PI * radius) / NODE_SLOT));
    rings.push(remaining.slice(0, capacity));
    remaining = remaining.slice(capacity);
    ringIndex += 1;
  }

  const maxRadius = rings.length > 0 ? FIRST_RING_R + (rings.length - 1) * RING_GAP : FIRST_RING_R;
  const size = 2 * (maxRadius + CANVAS_PAD);
  const width = Math.max(containerW, size);
  const height = size;
  const cx = width / 2;
  const cy = height / 2;

  const nodes: LayoutNode[] = [];
  rings.forEach((ring, ri) => {
    const radius = FIRST_RING_R + ri * RING_GAP;
    // Offset every other ring by half a step so nodes on adjacent rings
    // don't line up radially and overlap their connectors.
    const step = (2 * Math.PI) / ring.length;
    const startAngle = -Math.PI / 2 + (ri % 2 === 1 ? step / 2 : 0);
    ring.forEach((guideline, i) => {
      const angle = startAngle + i * step;
      const ux = Math.cos(angle);
      const uy = Math.sin(angle);
      nodes.push({ guideline, x: cx + ux * radius, y: cy + uy * radius, ux, uy });
    });
  });

  return { nodes, centerNode: { x: cx, y: cy }, width, height };
}

/** Curved connector from the centre disc's edge to a node's edge. The
 *  control point is pushed perpendicular to the radius so the lines sweep
 *  rather than radiate, which keeps them distinguishable where several
 *  nodes sit close together on the same ring. */
function connectorPath(center: CenterNode, node: LayoutNode): string {
  const sx = center.x + node.ux * (CENTER_R + 12);
  const sy = center.y + node.uy * (CENTER_R + 12);
  const ex = node.x - node.ux * (NODE_OUTER_R + 12);
  const ey = node.y - node.uy * (NODE_OUTER_R + 12);
  const mx = (sx + ex) / 2;
  const my = (sy + ey) / 2;
  const dist = Math.hypot(ex - sx, ey - sy);
  const bend = dist * 0.16;
  // Perpendicular to the radial direction.
  const px = -node.uy;
  const py = node.ux;
  return `M${sx} ${sy} Q ${mx + px * bend} ${my + py * bend} ${ex} ${ey}`;
}

function MapInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [guidelines, setGuidelines] = useState<Guideline[] | null>(null);
  const [groups, setGroups] = useState<GuidelineGroup[] | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [highlightRecommendationId, setHighlightRecommendationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [dirFilter, setDirFilter] = useState("");
  const [orgFilter, setOrgFilter] = useState("");
  const [agreeFilter, setAgreeFilter] = useState(0);
  const [view, setView] = useState<"map" | "matrix" | "charts" | "details" | "list">("map");
  const [axisX, setAxisX] = useState("aiDomain");
  const [axisY, setAxisY] = useState("clinicalArea");
  const [zoom, setZoom] = useState(1);
  const [exportOpen, setExportOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("agree");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Heatmap cell selection — clicking a (clinical area × AI domain) cell
  // expands the matching recommendations inline, below the grid.
  const [matrixSelection, setMatrixSelection] = useState<{ x: string; y: string } | null>(null);
  const [detailsMode, setDetailsMode] = useState<"single" | "compare">("compare");
  const [compareIds, setCompareIds] = useState<string[]>([]);

  // Density map cell selection — clicking a (population bucket × clinical
  // area) cell expands the matching recommendations inline, same
  // interaction as the heatmap above but over a different pair of axes.


  // "Filtered by your question" mode — set once from the URL a question
  // link lands on (?q=...&ids=...), then lives in local state so typing in
  // the search box (or clicking the × on the chip) can clear it without a
  // navigation.
  const [question, setQuestion] = useState<string | null>(null);
  const [baseIds, setBaseIds] = useState<Set<string> | null>(null);
  const [readUrl, setReadUrl] = useState(false);

  const { lens } = useAudienceLens();
  const lastAppliedLens = useRef<string | null>(null);

  // Apply the lens's default arrangement on first render and on every lens
  // change. Keyed on the lens key rather than run once, so switching from
  // the clinician lens to the policy lens actually re-arranges the map
  // rather than leaving the reader on a view built for someone else.
  useEffect(() => {
    if (lastAppliedLens.current === lens.key) return;
    lastAppliedLens.current = lens.key;
    setView(lens.mapDefaults.view);
    if (lens.mapDefaults.matrixX) setAxisX(lens.mapDefaults.matrixX);
    if (lens.mapDefaults.matrixY) setAxisY(lens.mapDefaults.matrixY);
    setSortKey(lens.mapDefaults.sortKey);
    setSortDir(lens.mapDefaults.sortDir);
  }, [lens]);

  useEffect(() => {
    if (readUrl) return;
    const q = searchParams.get("q");
    const ids = searchParams.get("ids");
    const requestedView = searchParams.get("view");
    let contextQuery = q;
    let contextIds = ids?.split(",").filter(Boolean) ?? [];
    if (!q && !ids) {
      try {
        const saved = JSON.parse(window.localStorage.getItem("recmap-last-map-context") ?? "null") as {
          query?: string;
          ids?: string[];
        } | null;
        contextQuery = saved?.query ?? null;
        contextIds = saved?.ids ?? [];
      } catch {
        contextQuery = null;
        contextIds = [];
      }
    } else {
      try {
        window.localStorage.setItem(
          "recmap-last-map-context",
          JSON.stringify({ query: contextQuery, ids: contextIds })
        );
      } catch {
        /* ignore */
      }
    }

    if (contextQuery) setQuestion(contextQuery);
    if (contextIds.length > 0) {
      setBaseIds(new Set(contextIds));
      // A map link from Ask is an answer-specific comparison. Start in the
      // node map so the cited recommendations are visible immediately;
      // users can still switch to another view with the segmented control.
      if (
        requestedView === "matrix" ||
        requestedView === "charts" ||
        requestedView === "details" ||
        requestedView === "list"
      ) {
        setView(requestedView);
      } else {
        setView("map");
      }
    }
    setReadUrl(true);
  }, [searchParams, readUrl]);

  function clearQuestionFilter() {
    setQuestion(null);
    setBaseIds(null);
    window.localStorage.removeItem("recmap-last-map-context");
    router.replace("/map", { scroll: false });
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/guidelines")
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        return res.json() as Promise<{ guidelines: Guideline[]; groups: GuidelineGroup[] }>;
      })
      .then((data) => {
        if (!cancelled) {
          setGuidelines(data.guidelines);
          setGroups(data.groups);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load guidelines.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const orgs = useMemo(() => uniqueSorted((guidelines ?? []).map((g) => g.organization)), [guidelines]);

  const filtered = useMemo(() => {
    if (!guidelines) return [];
    let recs = guidelines.slice();
    if (baseIds) recs = recs.filter((r) => baseIds.has(r.id) || baseIds.has(r.guidelineId));
    const q = search.trim().toLowerCase();
    if (q) {
      recs = recs.filter((r) =>
        [r.organization, r.clinicalArea, r.aiDomain, r.guidelineTitle].join(" ").toLowerCase().includes(q)
      );
    }
    if (dirFilter) recs = recs.filter((r) => directionVisual(r.direction) === dirFilter);
    if (orgFilter) recs = recs.filter((r) => r.organization === orgFilter);
    if (agreeFilter) recs = recs.filter((r) => r.agree.overall7 >= agreeFilter);
    return recs;
  }, [guidelines, baseIds, search, dirFilter, orgFilter, agreeFilter]);

  const hasQuestion = !!question && filtered.length > 0;

  // Canvas width tracking — the layout algorithm wraps clusters into rows
  // based on available width, same as the original's resize listener.
  const canvasWrapRef = useRef<HTMLDivElement | null>(null);
  const [containerW, setContainerW] = useState(1100);
  useEffect(() => {
    function measure() {
      const w = canvasWrapRef.current?.clientWidth || 0;
      setContainerW(Math.max(w || 1100, 700));
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [view, filtered.length]);

  const layout = useMemo<MapLayout | null>(() => {
    if (view !== "map" || filtered.length === 0) return null;
    return computeMapLayout(filtered, hasQuestion, containerW);
  }, [filtered, hasQuestion, containerW, view]);

  const sortedTable = useMemo(() => sortGuidelines(filtered, sortKey, sortDir), [filtered, sortKey, sortDir]);

  function onSortClick(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  }
  function sortArrow(key: SortKey) {
    if (sortKey !== key) return null;
    return <span className="sort-arrow">{sortDir === "asc" ? "▲" : "▼"}</span>;
  }

  // --- Matrix: one count-of-recommendations grid over any two categorical
  // fields. Replaces the former Heatmap (clinical area x AI domain) and
  // Density map (population x clinical area), which were this same
  // visualisation hard-wired to two axis pairs.
  //
  // Cells are nested maps (y -> x -> rows) rather than a joined string key,
  // because axis values can themselves contain the separator — aiDomain
  // holds values like "Computer vision (MelaFind), Signal processing".
  const fieldX = useMemo(() => axisField(axisX), [axisX]);
  const fieldY = useMemo(() => axisField(axisY), [axisY]);

  const matrixXValues = useMemo(
    () => uniqueSorted(filtered.map((r) => fieldX.value(r))),
    [filtered, fieldX]
  );
  const matrixYValues = useMemo(
    () => uniqueSorted(filtered.map((r) => fieldY.value(r))),
    [filtered, fieldY]
  );
  const matrixCells = useMemo(() => {
    const map = new Map<string, Map<string, Guideline[]>>();
    filtered.forEach((r) => {
      const y = fieldY.value(r);
      const x = fieldX.value(r);
      let byX = map.get(y);
      if (!byX) {
        byX = new Map<string, Guideline[]>();
        map.set(y, byX);
      }
      const list = byX.get(x);
      if (list) list.push(r);
      else byX.set(x, [r]);
    });
    return map;
  }, [filtered, fieldX, fieldY]);
  const matrixMax = useMemo(() => {
    let max = 0;
    matrixCells.forEach((byX) => {
      byX.forEach((list) => {
        if (list.length > max) max = list.length;
      });
    });
    return max;
  }, [matrixCells]);
  const matrixScale = useMemo(() => densityBands(matrixMax), [matrixMax]);
  const matrixRows = useMemo(() => {
    if (!matrixSelection) return [];
    const rows = matrixCells.get(matrixSelection.y)?.get(matrixSelection.x) ?? [];
    return sortGuidelines(rows, sortKey, sortDir);
  }, [matrixSelection, matrixCells, sortKey, sortDir]);

  // A stale selection (from a cell that no longer exists once filters
  // change) should collapse rather than silently show last time's rows.
  useEffect(() => {
    setMatrixSelection(null);
  }, [filtered, axisX, axisY]);

  const shortQuestion = question && question.length > 60 ? `${question.slice(0, 58)}…` : question;
  const chipQuestion = question && question.length > 44 ? `${question.slice(0, 42)}…` : question;
  const selectedGroup = groups?.find((group) => group.guidelineId === selectedGroupId) ?? null;

  /**
   * Export the matrix as CSV. Written client-side into a Blob and handed
   * to the browser as a download — no server round-trip, and no dependency
   * (no CSV library is installed, and the environment can't reliably add
   * one).
   *
   * The export carries the counts AND the filter state that produced them,
   * as a header comment. A matrix pasted into a paper without knowing it
   * was filtered to one organisation would be quietly wrong — and the
   * derived-axis caveat travels with it for the same reason.
   */
  function exportMatrixCsv() {
    const esc = (v: string | number) => {
      const t = String(v);
      return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
    };
    const activeFilters = [
      search.trim() ? `search="${search.trim()}"` : null,
      dirFilter ? `direction=${dirFilter}` : null,
      orgFilter ? `organisation=${orgFilter}` : null,
      agreeFilter > 0 ? `min AGREE II=${agreeFilter}/7` : null,
      question ? `question="${question}"` : null,
    ].filter(Boolean);

    const lines: string[] = [];
    lines.push(`# RecMap — ${fieldY.label} x ${fieldX.label}`);
    lines.push(`# Exported ${new Date().toISOString()}`);
    lines.push(`# ${filtered.length} of ${guidelines?.length ?? 0} recommendations in view`);
    lines.push(`# Filters: ${activeFilters.length > 0 ? activeFilters.join("; ") : "none"}`);
    for (const f of [fieldY, fieldX]) {
      if (f.derived && f.note) lines.push(`# ${f.label}: ${f.note}`);
    }
    lines.push([fieldY.label, ...matrixXValues].map(esc).join(","));
    for (const y of matrixYValues) {
      const row = matrixXValues.map((x) => matrixCells.get(y)?.get(x)?.length ?? 0);
      lines.push([esc(y), ...row].join(","));
    }

    downloadBlob(
      lines.join("\n"),
      "text/csv;charset=utf-8",
      `recmap-matrix-${axisY}-x-${axisX}-${new Date().toISOString().slice(0, 10)}.csv`
    );
  }

  /**
   * Resolve a themed colour ("var(--favour)", or a color-mix built from
   * tokens) to a concrete value. A downloaded SVG has no access to the
   * app's stylesheet, so every colour has to be baked in at export time —
   * otherwise the file opens as a set of black shapes.
   *
   * Done by painting the value onto a throwaway element and reading back
   * the computed colour, which handles color-mix() without reimplementing
   * it. Falls back to a neutral grey if the browser can't resolve it.
   */
  function resolveColor(value: string): string {
    if (typeof window === "undefined") return "#4a6864";
    const probe = document.createElement("span");
    probe.style.color = value;
    probe.style.display = "none";
    document.body.appendChild(probe);
    const resolved = getComputedStyle(probe).color;
    document.body.removeChild(probe);
    return resolved || "#4a6864";
  }

  /** The node map as a standalone SVG file. Rebuilt from the layout data
   *  rather than scraped from the DOM: the labels on screen are HTML
   *  overlaid on the SVG, so serialising the live element would produce a
   *  diagram with no text on it. */
  function exportMapSvg() {
    if (!layout) return;
    const esc = (t: string) =>
      t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const ink = resolveColor("var(--ink-900)");
    const inkSoft = resolveColor("var(--ink-500)");
    const surface = resolveColor("var(--surface)");
    const track = resolveColor("var(--line-100)");
    const brand = resolveColor("var(--brand-ink)");
    const font = "'Public Sans', -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";

    const parts: string[] = [];
    parts.push(`<rect width="${layout.width}" height="${layout.height}" fill="${surface}"/>`);

    for (const n of layout.nodes) {
      parts.push(
        `<path d="${connectorPath(layout.centerNode, n)}" fill="none" stroke="${resolveColor(
          DIR_COLOR_VAR[directionVisual(n.guideline.direction)]
        )}" stroke-width="2.6" opacity="0.85"/>`
      );
    }

    for (const n of layout.nodes) {
      const dir = resolveColor(DIR_COLOR_VAR[directionVisual(n.guideline.direction)]);
      const grade = resolveColor(gradeCertaintyColor(n.guideline.gradeCertaintyLevel));
      const frac = Math.max(0, Math.min(1, n.guideline.agree.overall7 / 7));
      const innerR = 41;
      const circ = 2 * Math.PI * innerR;
      parts.push(`<circle cx="${n.x}" cy="${n.y}" r="${NODE_OUTER_R + 6}" fill="${surface}"/>`);
      parts.push(
        `<circle cx="${n.x}" cy="${n.y}" r="${NODE_OUTER_R}" fill="none" stroke="${dir}" stroke-width="3.5"/>`
      );
      parts.push(
        `<circle cx="${n.x}" cy="${n.y}" r="${innerR}" fill="none" stroke="${track}" stroke-width="5"/>`
      );
      parts.push(
        `<circle cx="${n.x}" cy="${n.y}" r="${innerR}" fill="none" stroke="${grade}" stroke-width="5" stroke-linecap="round" stroke-dasharray="${circ}" stroke-dashoffset="${circ * (1 - frac)}" transform="rotate(-90 ${n.x} ${n.y})"/>`
      );
      parts.push(
        `<text x="${n.x}" y="${n.y - 8}" text-anchor="middle" font-family="${font}" font-size="12" font-weight="700" fill="${ink}">${esc(orgInitials(n.guideline.organization))}</text>`
      );
      parts.push(
        `<text x="${n.x}" y="${n.y + 7}" text-anchor="middle" font-family="${font}" font-size="12" font-weight="700" fill="${ink}">${n.guideline.year}</text>`
      );
      parts.push(
        `<text x="${n.x}" y="${n.y + 22}" text-anchor="middle" font-family="${font}" font-size="9.5" font-weight="700" fill="${dir}">${esc(directionLabel(n.guideline))}</text>`
      );
    }

    const c = layout.centerNode;
    const centreTop = question ? "your question" : "this catalog";
    const centreSub = question
      ? `“${shortQuestion}”`
      : `${filtered.length} recommendation${filtered.length === 1 ? "" : "s"}`;
    parts.push(`<circle cx="${c.x}" cy="${c.y}" r="${CENTER_R + 6}" fill="${surface}"/>`);
    parts.push(`<circle cx="${c.x}" cy="${c.y}" r="${CENTER_R}" fill="none" stroke="${brand}" stroke-width="5"/>`);
    parts.push(
      `<text x="${c.x}" y="${c.y - 2}" text-anchor="middle" font-family="${font}" font-size="12.5" font-weight="700" fill="${ink}">${esc(centreTop)}</text>`
    );
    parts.push(
      `<text x="${c.x}" y="${c.y + 14}" text-anchor="middle" font-family="${font}" font-size="9.5" fill="${inkSoft}">${esc(centreSub.slice(0, 40))}</text>`
    );

    // The caveats travel with the picture — a diagram lifted into a slide
    // deck without them would imply more than the data supports.
    parts.push(
      `<text x="16" y="${layout.height - 30}" font-family="${font}" font-size="11" fill="${inkSoft}">Ring colour = direction · arc length = AGREE II score · arc colour = GRADE certainty</text>`
    );
    parts.push(
      `<text x="16" y="${layout.height - 14}" font-family="${font}" font-size="11" fill="${inkSoft}">RecMap · ${esc(
        String(filtered.length)
      )} of ${guidelines?.length ?? 0} recommendations · exported ${new Date().toISOString().slice(0, 10)}</text>`
    );

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}">${parts.join("")}</svg>`;
    downloadBlob(svg, "image/svg+xml;charset=utf-8", `recmap-map-${new Date().toISOString().slice(0, 10)}.svg`);
  }

  /** The recommendations currently on the map, as CSV. */
  function exportMapCsv() {
    const esc = (v: string | number) => {
      const t = String(v);
      return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
    };
    const header = [
      "Organisation",
      "Year",
      "Guideline",
      "Clinical area",
      "Recommendation type",
      "Direction",
      "Strength",
      "GRADE certainty",
      "AGREE II (/7)",
      "AGREE II (%)",
      "Region",
      "Recommendation",
    ];
    const rows = filtered.map((g) => [
      g.organization,
      g.year,
      g.guidelineTitle,
      g.clinicalArea,
      g.recommendationTypeLabel,
      directionLabel(g),
      g.strength,
      g.gradeCertaintyLabel,
      g.agree.overall7.toFixed(2),
      Math.round((g.agree.overall7 / 7) * 100),
      g.region,
      g.recommendationText,
    ]);
    const lines = [
      `# RecMap — recommendations in view`,
      `# Exported ${new Date().toISOString()}`,
      `# ${filtered.length} of ${guidelines?.length ?? 0} recommendations`,
      `# AGREE II measures how rigorously the guideline was developed, not how strong the evidence is; GRADE certainty is the separate evidence judgement.`,
      header.map(esc).join(","),
      ...rows.map((r) => r.map(esc).join(",")),
    ];
    downloadBlob(lines.join("\n"), "text/csv;charset=utf-8", `recmap-recommendations-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  function downloadBlob(content: string, type: string, filename: string) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Shown on the Filters button so a filter left on isn't invisible once
  // the panel is closed — the previous always-visible selects made that
  // obvious for free, and collapsing them takes it away.
  const activeFilterCount =
    (dirFilter ? 1 : 0) + (orgFilter ? 1 : 0) + (agreeFilter > 0 ? 1 : 0);

  /** Guideline groups with at least one recommendation still in view, in
   *  the order the Details tab pages through them. */
  const detailsGroups = useMemo(
    () =>
      (groups ?? []).filter((g) => g.recommendations.some((r) => filtered.some((f) => f.id === r.id))),
    [groups, filtered]
  );
  const detailsIndex = detailsGroups.findIndex((g) => g.guidelineId === selectedGroupId);

  /** Guidelines chosen for side-by-side comparison, in the order they
   *  appear on the map. Capped: past four columns the rows stop being
   *  readable and the comparison stops being one. */
  const COMPARE_LIMIT = 4;
  const compareGroups = useMemo(
    () => detailsGroups.filter((g) => compareIds.includes(g.guidelineId)),
    [detailsGroups, compareIds]
  );

  /** Default the comparison to the first few guidelines in view, and drop
   *  any that filtering has since removed. */
  useEffect(() => {
    setCompareIds((prev) => {
      const stillHere = prev.filter((id) => detailsGroups.some((g) => g.guidelineId === id));
      if (stillHere.length > 0) return stillHere.length === prev.length ? prev : stillHere;
      return detailsGroups.slice(0, Math.min(3, detailsGroups.length)).map((g) => g.guidelineId);
    });
  }, [detailsGroups]);

  function toggleCompare(guidelineId: string) {
    setCompareIds((prev) =>
      prev.includes(guidelineId)
        ? prev.filter((id) => id !== guidelineId)
        : prev.length >= COMPARE_LIMIT
          ? prev
          : [...prev, guidelineId]
    );
  }

  /** Step to the next or previous record without going back to the picker,
   *  wrapping at both ends so paging never dead-ends. */
  function stepDetails(delta: number) {
    if (detailsGroups.length === 0) return;
    const from = detailsIndex >= 0 ? detailsIndex : 0;
    const next = (from + delta + detailsGroups.length) % detailsGroups.length;
    setSelectedGroupId(detailsGroups[next].guidelineId);
    setHighlightRecommendationId(null);
  }

  function openNode(guideline: Guideline) {
    setSelectedGroupId(guideline.guidelineId);
    setHighlightRecommendationId(guideline.id);
  }

  function closeNodeDrawer() {
    setSelectedGroupId(null);
    setHighlightRecommendationId(null);
  }

  // Shared sortable table — used by the List view, and reused (with a
  // filtered subset of rows) by the Heatmap view's click-to-expand panel,
  // so the two views stay visually and behaviorally consistent instead of
  // maintaining two copies of the same markup.
  function RecTable({ rows }: { rows: Guideline[] }) {
    return (
      <div className="table-wrap">
        <table className="rec-table">
          <thead>
            <tr>
              <th onClick={() => onSortClick("org")}>Guideline{sortArrow("org")}</th>
              <th onClick={() => onSortClick("area")}>Clinical area{sortArrow("area")}</th>
              <th onClick={() => onSortClick("direction")}>Direction{sortArrow("direction")}</th>
              <th onClick={() => onSortClick("agree")}>AGREE&nbsp;II{sortArrow("agree")}</th>
              <th onClick={() => onSortClick("grade")}>GRADE certainty{sortArrow("grade")}</th>
              <th onClick={() => onSortClick("year")}>Year{sortArrow("year")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="map-empty">
                  No guidelines match these filters.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const visual = directionVisual(r.direction);
              const gradeColor = gradeCertaintyColor(r.gradeCertaintyLevel);
              return (
                <tr key={r.id} onClick={() => router.push(`/catalog?guideline=${encodeURIComponent(r.id)}`)}>
                  <td>
                    <b style={{ color: "var(--ink-900)" }}>{r.organization}</b>
                  </td>
                  <td>{r.clinicalArea}</td>
                  <td>
                    <span className={`pill dir-${visual}`}>{r.directionRaw}</span>
                  </td>
                  <td>{r.agree.overall7.toFixed(1)}/7</td>
                  <td>
                    <span className="pill grade-pill" style={{ color: gradeColor, borderColor: gradeColor }}>
                      {r.gradeCertaintyLabel}
                    </span>
                  </td>
                  <td>{r.year}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <section>
      <AudienceLensBar />
      {/* Four stacked rows rather than one wrapping flex line: the status
          line, then search + back, then the three filters, then the view
          switcher. The old single row reflowed differently at every width
          and left the selects stranded on their own line. */}
      <div className="filterbar">
        <div className="fb-status">
          <span className="result-count">
            Showing <b>{filtered.length}</b> of {guidelines?.length ?? "\u2014"} guidelines
          </span>
        </div>

        <div className="fb-row fb-row-search">
          <div className="search-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                if (question || baseIds) clearQuestionFilter();
              }}
              placeholder="Search guidelines…"
              autoComplete="off"
            />
          </div>
          <button type="button" className="btn-primary map-back-ask" onClick={() => router.push("/ask")}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M19 12H5" />
              <path d="m11 18-6-6 6-6" />
            </svg>
            Back to Ask
          </button>
          {question && (
            <button type="button" className="pill plain map-question-chip" onClick={clearQuestionFilter}>
              Filtered by your question&nbsp;&nbsp;<b>&ldquo;{chipQuestion}&rdquo;</b>&nbsp;&nbsp;&times;
            </button>
          )}
        </div>

        <div className="fb-row fb-row-views">
          <div className="seg" role="group" aria-label="Explore view: map, matrix, charts, details or list">
            {VIEW_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                aria-pressed={view === tab.key}
                onClick={() => setView(tab.key)}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  {VIEW_ICONS[tab.key]}
                </svg>
                {tab.label}
              </button>
            ))}
          </div>

          <div className="fb-row-actions">
            <div className="map-export">
              <button
                type="button"
                className={`btn-outline density-export${activeFilterCount > 0 ? " has-filters" : ""}`}
                onClick={() => setFiltersOpen((v) => !v)}
                aria-expanded={filtersOpen}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3.5 5.5h17l-6.6 7.6v5.2l-3.8 2.2v-7.4Z" />
                </svg>
                Filters
                {activeFilterCount > 0 && <span className="filter-count">{activeFilterCount}</span>}
              </button>
            </div>

          {view === "map" && filtered.length > 0 && (
            <div className="map-export">
              <button
                type="button"
                className="btn-outline density-export"
                onClick={() => setExportOpen((v) => !v)}
                aria-expanded={exportOpen}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 4v10" />
                  <path d="m8 10.5 4 4 4-4" />
                  <path d="M5 17v1.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V17" />
                </svg>
                Export
              </button>
              {exportOpen && (
                <div className="map-export-menu" onMouseLeave={() => setExportOpen(false)}>
                  <button
                    type="button"
                    onClick={() => {
                      exportMapSvg();
                      setExportOpen(false);
                    }}
                  >
                    <b>Diagram (SVG)</b>
                    <span>The map as a vector image, with its legend baked in</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      exportMapCsv();
                      setExportOpen(false);
                    }}
                  >
                    <b>Data (CSV)</b>
                    <span>
                      The {filtered.length} recommendation{filtered.length === 1 ? "" : "s"} in view, with scores
                    </span>
                  </button>
                </div>
              )}
            </div>
          )}
          </div>
        </div>

        {filtersOpen && (
          <div className="fb-panel">
            <label>
              <span>Direction</span>
              <select className="filter-select" value={dirFilter} onChange={(e) => setDirFilter(e.target.value)}>
                <option value="">All directions</option>
                <option value="for">In favour</option>
                <option value="against">Against</option>
                <option value="neutral">No recommendation / insufficient evidence</option>
              </select>
            </label>
            <label>
              <span>Organisation</span>
              <select className="filter-select" value={orgFilter} onChange={(e) => setOrgFilter(e.target.value)}>
                <option value="">All organisations</option>
                {orgs.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>AGREE&nbsp;II</span>
              <select
                className="filter-select"
                value={agreeFilter}
                onChange={(e) => setAgreeFilter(Number(e.target.value))}
              >
                <option value="0">Any score</option>
                <option value="6">6.0+ / 7</option>
                <option value="5">5.0+ / 7</option>
                <option value="4">4.0+ / 7</option>
              </select>
            </label>
            {activeFilterCount > 0 && (
              <button
                type="button"
                className="fb-clear"
                onClick={() => {
                  setDirFilter("");
                  setOrgFilter("");
                  setAgreeFilter(0);
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      <div className="map-wrap">
        {error && (
          <div className="state-block error">
            <p>Couldn&rsquo;t load the guideline catalog: {error}</p>
            <button type="button" className="btn-outline" onClick={() => window.location.reload()}>
              Retry
            </button>
          </div>
        )}

        {!error && !guidelines && (
          <div className="state-block">
            <div className="spinner" />
            <p>Loading guidelines…</p>
          </div>
        )}

        {guidelines && (
          <>
            {view === "map" && (
              <div className="map-canvas" ref={canvasWrapRef}>
                {filtered.length === 0 && <div className="map-empty">No guidelines match these filters.</div>}
                {filtered.length > 0 && layout && (
                  <div className="map-stage" style={{ width: layout.width * zoom, height: layout.height * zoom }}>
                    <div
                      className="map-plane"
                      style={{
                        width: layout.width,
                        height: layout.height,
                        transform: `scale(${zoom})`,
                        transformOrigin: "top left",
                      }}
                    >
                      <svg
                        className="map-svg-layer"
                        width={layout.width}
                        height={layout.height}
                        style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
                      >
                        {layout.nodes.map((n) => (
                          <path
                            key={`link-${n.guideline.id}`}
                            d={connectorPath(layout.centerNode, n)}
                            fill="none"
                            stroke={DIR_COLOR_VAR[directionVisual(n.guideline.direction)]}
                            strokeWidth={2.6}
                            opacity={0.85}
                          />
                        ))}

                        {layout.nodes.map((n) => {
                          // Three encodings, deliberately distinct so they
                          // don't read as one measurement: the outer ring's
                          // COLOUR is the recommendation's direction, the
                          // inner arc's LENGTH is the AGREE II score, and
                          // the arc's COLOUR is GRADE certainty.
                          const visual = directionVisual(n.guideline.direction);
                          const frac = Math.max(0, Math.min(1, n.guideline.agree.overall7 / 7));
                          const innerR = 41;
                          const circ = 2 * Math.PI * innerR;
                          const gradeColor = gradeCertaintyColor(n.guideline.gradeCertaintyLevel);
                          return (
                            <g key={`ring-${n.guideline.id}`}>
                              {/* Halo: painted in the canvas colour and sized past the
                                  outer ring, so any connector passing nearby is hidden
                                  behind the node instead of crossing it. */}
                              <circle cx={n.x} cy={n.y} r={NODE_OUTER_R + 6} fill="var(--surface)" />
                              <circle
                                cx={n.x}
                                cy={n.y}
                                r={NODE_OUTER_R}
                                fill="none"
                                stroke={DIR_COLOR_VAR[visual]}
                                strokeWidth={3.5}
                              />
                              <circle cx={n.x} cy={n.y} r={innerR} fill="none" stroke="var(--line-100)" strokeWidth={5} />
                              <circle
                                cx={n.x}
                                cy={n.y}
                                r={innerR}
                                fill="none"
                                stroke={gradeColor}
                                strokeWidth={5}
                                strokeLinecap="round"
                                strokeDasharray={circ}
                                strokeDashoffset={circ * (1 - frac)}
                                transform={`rotate(-90 ${n.x} ${n.y})`}
                              />
                            </g>
                          );
                        })}

                        <circle
                          cx={layout.centerNode.x}
                          cy={layout.centerNode.y}
                          r={CENTER_R + 6}
                          fill="var(--surface)"
                        />
                        <circle
                          cx={layout.centerNode.x}
                          cy={layout.centerNode.y}
                          r={CENTER_R}
                          fill="none"
                          stroke="var(--brand-ink)"
                          strokeWidth={5}
                        />
                      </svg>

                      <div
                        className="center-node"
                        style={{ position: "absolute", left: layout.centerNode.x, top: layout.centerNode.y }}
                      >
                        {question ? (
                          <>
                            <span className="center-node-k">your question</span>
                            <span className="center-node-q">&ldquo;{shortQuestion}&rdquo;</span>
                          </>
                        ) : (
                          <>
                            <span className="center-node-k">this catalog</span>
                            <span className="center-node-q">
                              {filtered.length} recommendation{filtered.length === 1 ? "" : "s"}
                            </span>
                          </>
                        )}
                      </div>

                      {layout.nodes.map((n) => {
                        const visual = directionVisual(n.guideline.direction);
                        return (
                          <button
                            key={n.guideline.id}
                            type="button"
                            className="map-node"
                            style={{ position: "absolute", left: n.x, top: n.y }}
                            onClick={() => openNode(n.guideline)}
                            title={`${n.guideline.organization} ${n.guideline.year} · ${n.guideline.clinicalArea} · AGREE II ${n.guideline.agree.overall7.toFixed(1)}/7 · GRADE certainty: ${n.guideline.gradeCertaintyLabel}`}
                          >
                            <span className="node-label">
                              {orgInitials(n.guideline.organization)}
                              <br />
                              {n.guideline.year}
                            </span>
                            <span className={`node-sub dir-${visual}`}>{directionLabel(n.guideline)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {filtered.length > 0 && (
                  <div className="map-zoom" role="group" aria-label="Zoom">
                    <button type="button" onClick={() => setZoom((z) => Math.min(1.6, +(z + 0.15).toFixed(2)))} aria-label="Zoom in">
                      +
                    </button>
                    <button type="button" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.15).toFixed(2)))} aria-label="Zoom out">
                      &minus;
                    </button>
                    <button type="button" onClick={() => setZoom(1)} aria-label="Reset zoom" title="Reset zoom">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9" />
                        <path d="M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9" />
                        <path d="M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15" />
                        <path d="M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            )}

            {view === "charts" && <CatalogCharts guidelines={filtered} />}

            {view === "details" && (
              <div className="details-view">
                <div className="details-mode" role="group" aria-label="Details layout">
                  <button
                    type="button"
                    aria-pressed={detailsMode === "single"}
                    onClick={() => setDetailsMode("single")}
                  >
                    One at a time
                  </button>
                  <button
                    type="button"
                    aria-pressed={detailsMode === "compare"}
                    onClick={() => setDetailsMode("compare")}
                  >
                    Side by side
                  </button>
                </div>

                {/* The same record the drawer shows, rendered inline. The
                    drawer is still there for a click from the node map or a
                    matrix cell; this tab is for reading records one after
                    another without opening and dismissing an overlay each
                    time. Both render GuidelineDetail, so they can't drift. */}
                {detailsMode === "single" && (
                <div className="details-pick">
                  <label>
                    <span>Guideline</span>
                    <select
                      className="filter-select"
                      value={selectedGroupId ?? ""}
                      onChange={(e) => {
                        setSelectedGroupId(e.target.value || null);
                        setHighlightRecommendationId(null);
                      }}
                    >
                      <option value="">Choose a guideline…</option>
                      {(groups ?? [])
                        .filter((g) => g.recommendations.some((r) => filtered.some((f) => f.id === r.id)))
                        .map((g) => (
                          <option key={g.guidelineId} value={g.guidelineId}>
                            {g.organization} ({g.year}) — {g.guidelineTitle}
                          </option>
                        ))}
                    </select>
                  </label>
                  {detailsGroups.length > 1 && selectedGroup && (
                    <div className="details-nav">
                      <button
                        type="button"
                        className="btn-outline"
                        onClick={() => stepDetails(-1)}
                        aria-label="Previous guideline"
                      >
                        ← Previous
                      </button>
                      <span className="details-pos">
                        {detailsIndex + 1} of {detailsGroups.length}
                      </span>
                      <button
                        type="button"
                        className="btn-outline"
                        onClick={() => stepDetails(1)}
                        aria-label="Next guideline"
                      >
                        Next →
                      </button>
                    </div>
                  )}
                </div>

                )}

                {detailsMode === "single" && (selectedGroup ? (
                  <article className="details-card">
                    <header className="details-card-head">
                      <div className="drawer-badges">
                        {selectedGroup.recommendations.length === 1 ? (
                          <DirectionBadge guideline={selectedGroup.recommendations[0]} />
                        ) : (
                          <span className="pill plain">
                            {selectedGroup.recommendations.length} recommendations
                          </span>
                        )}
                        <span className="pill plain">{selectedGroup.year}</span>
                        {selectedGroup.agreeScoresEstimated && <span className="pill amber">AI appraisal</span>}
                      </div>
                      <h2 className="drawer-title">{selectedGroup.guidelineTitle}</h2>
                      <div className="drawer-org">{selectedGroup.organization}</div>
                    </header>
                    <GuidelineDetail
                      group={selectedGroup}
                      highlightRecommendationId={highlightRecommendationId}
                      peers={guidelines ?? undefined}
                    />
                  </article>
                ) : (
                  <div className="state-block">
                    <p>
                      Pick a guideline above, or click a node on the Map or a cell in the Matrix — the record opens
                      here.
                    </p>
                  </div>
                ))}

                {detailsMode === "compare" && (
                  <>
                    {/* Which of the map's nodes to line up. Capped at four:
                        past that the columns are too narrow to read and the
                        comparison stops being one. */}
                    <div className="cmp-pick">
                      <span className="cmp-pick-label">
                        Compare ({compareGroups.length}/{COMPARE_LIMIT})
                      </span>
                      <div className="cmp-chips">
                        {detailsGroups.map((g) => {
                          const on = compareIds.includes(g.guidelineId);
                          return (
                            <button
                              key={g.guidelineId}
                              type="button"
                              className={`cmp-chip${on ? " on" : ""}`}
                              aria-pressed={on}
                              disabled={!on && compareIds.length >= COMPARE_LIMIT}
                              onClick={() => toggleCompare(g.guidelineId)}
                              title={g.guidelineTitle}
                            >
                              {orgInitials(g.organization)} {g.year}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {compareGroups.length === 0 ? (
                      <div className="state-block">
                        <p>Pick at least one guideline above to compare.</p>
                      </div>
                    ) : (
                      <div className="cmp-wrap">
                        <table className="cmp-table">
                          <thead>
                            <tr>
                              <th className="cmp-rowhead">&nbsp;</th>
                              {compareGroups.map((g) => (
                                <th key={g.guidelineId}>
                                  <div className="cmp-org">{g.organization}</div>
                                  <div className="cmp-sub">
                                    {g.year} · {g.clinicalArea}
                                  </div>
                                  <div className="cmp-title" title={g.guidelineTitle}>
                                    {g.guidelineTitle}
                                  </div>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {COMPARE_ROWS.map((row) => (
                              <tr key={row.key}>
                                <th scope="row" className="cmp-rowhead">
                                  {row.label}
                                  {row.note && <span className="cmp-rowhead-note">{row.note}</span>}
                                </th>
                                {compareGroups.map((g) => (
                                  <td key={g.guidelineId}>{row.render(g)}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <p className="cmp-foot">
                      Rows line up like for like across guidelines. A blank or &ldquo;not reported&rdquo; cell is a
                      statement about the source guideline, not a gap in RecMap&rsquo;s extraction.
                    </p>
                  </>
                )}
              </div>
            )}

            {view === "list" && <RecTable rows={sortedTable} />}

            {view === "matrix" && (
              <div className="heatmap-wrap">
                <p className="density-caption">
                  How many recommendations sit at each intersection of two fields. Pick the axes below — the same
                  grid answers &ldquo;which AI domains are covered for which clinical topics&rdquo;, &ldquo;which
                  organisations recommend for or against&rdquo;, or &ldquo;how certainty varies by region&rdquo;.
                  Click any cell to list what it contains.
                </p>

                <div className="matrix-axes">
                  <label>
                    <span>Columns (X)</span>
                    <select
                      className="filter-select"
                      value={axisX}
                      onChange={(e) => setAxisX(e.target.value)}
                    >
                      {AXIS_FIELDS.filter((f) => f.key !== axisY).map((f) => (
                        <option key={f.key} value={f.key}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="matrix-swap"
                    onClick={() => {
                      setAxisX(axisY);
                      setAxisY(axisX);
                    }}
                    title="Swap the axes"
                    aria-label="Swap the axes"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5" />
                    </svg>
                  </button>
                  <label>
                    <span>Rows (Y)</span>
                    <select
                      className="filter-select"
                      value={axisY}
                      onChange={(e) => setAxisY(e.target.value)}
                    >
                      {AXIS_FIELDS.filter((f) => f.key !== axisX).map((f) => (
                        <option key={f.key} value={f.key}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {(fieldX.derived || fieldY.derived) && (
                  <p className="matrix-derived-note">
                    <b>Derived axis.</b>{" "}
                    {[fieldX, fieldY]
                      .filter((f) => f.derived)
                      .map((f) => f.note)
                      .join(" ")}
                  </p>
                )}

                {filtered.length === 0 && <div className="map-empty">No guidelines match these filters.</div>}
                {filtered.length > 0 && (
                  <>
                    <div className="density-bar">
                      <button type="button" className="btn-outline density-export" onClick={exportMatrixCsv}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M12 4v10" />
                          <path d="m8 10.5 4 4 4-4" />
                          <path d="M5 17v1.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V17" />
                        </svg>
                        Export
                      </button>
                    </div>
                    <div className="density-grid">
                      <div className="table-wrap heatmap-scroll">
                        <table className="heat-table">
                          <thead>
                            <tr>
                              <th className="heat-corner density-corner">
                                <span
                                  className="density-corner-info"
                                  role="img"
                                  aria-label="How to read this table"
                                  title="Each cell counts the recommendations currently in view at that intersection. Click a cell to list them."
                                >
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                                    <circle cx="12" cy="12" r="9" />
                                    <path d="M12 11v5.4" strokeLinecap="round" />
                                    <path d="M12 7.9v.4" strokeLinecap="round" strokeWidth="2.2" />
                                  </svg>
                                </span>
                                <span>
                                  {fieldY.label} &times; {fieldX.label}
                                </span>
                              </th>
                              {matrixXValues.map((x) => (
                                <th key={x} title={x}>
                                  {x}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {matrixYValues.map((y) => (
                              <tr key={y}>
                                <th scope="row">{y}</th>
                                {matrixXValues.map((x) => {
                                  const rows = matrixCells.get(y)?.get(x) ?? [];
                                  const count = rows.length;
                                  if (count === 0) {
                                    return (
                                      <td key={x}>
                                        <div
                                          className="heat-cell density-cell empty"
                                          title={`${y} × ${x}: no coverage`}
                                          aria-label={`${y} × ${x}: no coverage`}
                                        />
                                      </td>
                                    );
                                  }
                                  const selected = matrixSelection?.y === y && matrixSelection?.x === x;
                                  return (
                                    <td key={x}>
                                      <button
                                        type="button"
                                        className={`heat-cell density-cell${selected ? " selected" : ""}`}
                                        style={{
                                          background: densityCellBg(count, matrixScale),
                                          color: densityCellInk(count, matrixScale),
                                        }}
                                        onClick={() => setMatrixSelection(selected ? null : { x, y })}
                                        title={`${y} × ${x}: ${count} recommendation${count === 1 ? "" : "s"}`}
                                      >
                                        <span className="heat-count">{count}</span>
                                      </button>
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="density-legend">
                        <span className="density-legend-label">Number of recommendations</span>
                        {matrixScale.map((band) => (
                          <span className="density-legend-item" key={band.label}>
                            <span className="density-swatch" style={{ background: band.color }} />
                            {band.label}
                          </span>
                        ))}
                      </div>
                      <p className="density-footnote">
                        Empty cells indicate no recommendation in view at that intersection. Bands are derived from
                        the largest cell currently shown, so the scale always spans the real spread.
                      </p>
                    </div>

                    {matrixSelection && (
                      <div className="heat-expansion">
                        <div className="heat-expansion-head">
                          <span>
                            <b>{matrixRows.length}</b> recommendation{matrixRows.length === 1 ? "" : "s"} &middot;{" "}
                            {matrixSelection.y} &times; {matrixSelection.x}
                          </span>
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => setMatrixSelection(null)}
                            aria-label="Close"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                              <path d="M6 6l12 12M18 6L6 18" />
                            </svg>
                          </button>
                        </div>
                        <RecTable rows={matrixRows} />
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {view === "map" && (

              <div className="map-legend">
                <span className="lg-label">Legend</span>
                <span className="lg-item">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--favour)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M8 12.5l2.5 2.5L16 9.5" />
                  </svg>
                  In favour
                </span>
                <span className="lg-item">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--against)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M9.5 9.5l5 5M14.5 9.5l-5 5" />
                  </svg>
                  Against
                </span>
                <span className="lg-item">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--neutral)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M8 12h8" />
                  </svg>
                  No rec. / insufficient evidence
                </span>
                <span className="lg-item" style={{ borderLeft: "1px solid var(--line-200)", paddingLeft: 18 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="9" fill="none" stroke="var(--line-200)" strokeWidth="3" />
                    <circle
                      cx="12"
                      cy="12"
                      r="9"
                      fill="none"
                      stroke="var(--ink-600)"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeDasharray="40 56.5"
                      transform="rotate(-90 12 12)"
                    />
                  </svg>
                  Ring fill = AGREE&nbsp;II score
                </span>
                <span className="lg-item" style={{ borderLeft: "1px solid var(--line-200)", paddingLeft: 18 }}>
                  <span className="grade-legend-dots">
                    {GRADE_LEGEND.map((g) => (
                      <i key={g.level} style={{ background: gradeCertaintyColor(g.level) }} title={g.label} />
                    ))}
                  </span>
                  Outer ring = GRADE certainty (green high &rarr; red low, grey not reported)
                </span>
              </div>
            )}
          </>
        )}
      </div>

      <GuidelineDrawer
        group={view === "details" ? null : selectedGroup}
        highlightRecommendationId={highlightRecommendationId}
        peers={guidelines ?? undefined}
        onClose={closeNodeDrawer}
      />

      {/* global: nodes/labels are absolutely positioned by inline style, so
          these rules only need to supply the fixed visual chrome around
          them — safe to declare globally since none of these class names
          are used elsewhere in the app. */}
      <style jsx global>{`
        .map-wrap {
          padding: 20px 0 40px 0;
        }
        .map-canvas {
          position: relative;
          overflow: auto;
          border: 1px solid var(--line-100);
          border-radius: 14px;
          background: var(--surface);
          min-height: 420px;
        }
        .map-stage {
          position: relative;
        }
        .map-plane {
          position: relative;
        }
        .map-empty {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 320px;
          color: var(--ink-500);
          font-size: 13.5px;
        }
        /* The node is a transparent hit-target sitting exactly over the
           rings drawn in the SVG layer beneath it; the white disc and the
           two rings are SVG, the text is HTML so it stays selectable and
           inherits the app's font. */
        .map-node {
          transform: translate(-50%, -50%);
          width: 96px;
          height: 96px;
          border-radius: 50%;
          cursor: pointer;
          background: none;
          border: none;
          padding: 0 8px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3px;
          text-decoration: none;
        }
        .map-node:hover {
          text-decoration: none;
        }
        .map-node:hover .node-label {
          color: var(--brand-ink);
        }
        .node-label {
          font-size: 12px;
          font-weight: 700;
          color: var(--ink-900);
          text-align: center;
          line-height: 1.25;
        }
        .node-sub {
          font-size: 9.5px;
          font-weight: 700;
          text-align: center;
          line-height: 1.2;
        }
        .node-sub.dir-for { color: var(--favour); }
        .node-sub.dir-against { color: var(--against); }
        .node-sub.dir-neutral { color: var(--neutral); }
        .center-node {
          transform: translate(-50%, -50%);
          width: 108px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3px;
          text-align: center;
          pointer-events: none;
        }
        .center-node-k {
          font-size: 12.5px;
          font-weight: 700;
          color: var(--ink-900);
          line-height: 1.25;
        }
        .center-node-q {
          font-size: 9.5px;
          color: var(--ink-500);
          line-height: 1.3;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
        }
        .map-zoom {
          position: sticky;
          float: right;
          right: 16px;
          bottom: 16px;
          margin: -76px 16px 16px 0;
          display: inline-flex;
          flex-direction: column;
          background: var(--surface);
          border: 1px solid var(--line-200);
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 3px 12px rgba(13, 77, 80, 0.1);
          z-index: 5;
        }
        .map-zoom button {
          width: 38px;
          height: 38px;
          border: none;
          background: none;
          color: var(--ink-600);
          font-size: 17px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .map-zoom button + button {
          border-top: 1px solid var(--line-100);
        }
        .map-zoom button:hover {
          background: var(--bg-alt);
          color: var(--brand-ink);
        }
        .map-zoom svg {
          width: 15px;
          height: 15px;
        }

        .map-question-chip {
          cursor: pointer;
          gap: 7px;
        }
        .map-back-ask {
          padding: 7px 12px;
          font-size: 12px;
          white-space: nowrap;
        }
        /* Segmented control, per the v3 snapshot: one rounded white shell,
           icon + label per segment, and the active segment as a solid teal
           block that fills the full height. The divider is hidden either
           side of the active segment so nothing cuts into the fill. */
        .seg {
          display: inline-flex;
          align-items: stretch;
          border: 1px solid var(--line-200);
          border-radius: 10px;
          background: var(--surface);
          padding: 4px;
          gap: 0;
        }
        .seg button {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: none;
          background: none;
          color: var(--ink-600);
          font-size: 13.5px;
          font-weight: 600;
          padding: 9px 18px;
          border-radius: 7px;
          cursor: pointer;
          white-space: nowrap;
          position: relative;
        }
        .seg button svg {
          width: 17px;
          height: 17px;
          flex-shrink: 0;
        }
        .seg button + button::before {
          content: "";
          position: absolute;
          left: 0;
          top: 22%;
          bottom: 22%;
          width: 1px;
          background: var(--line-200);
        }
        .seg button[aria-pressed="true"]::before,
        .seg button[aria-pressed="true"] + button::before {
          display: none;
        }
        .seg button:hover:not([aria-pressed="true"]) {
          color: var(--ink-900);
        }
        .seg button[aria-pressed="true"] {
          background: var(--brand-ink);
          color: #fff;
          font-weight: 700;
        }
        .map-legend {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 18px;
          padding: 14px 4px 0;
          font-size: 12.5px;
          color: var(--ink-600);
        }
        .map-legend .lg-label {
          font-size: 10.5px;
          font-weight: 700;
          color: var(--ink-500);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .map-legend .lg-item {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .table-wrap {
          overflow-x: auto;
          border: 1px solid var(--line-100);
          border-radius: 14px;
        }
        .rec-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        .rec-table th {
          text-align: left;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--ink-500);
          background: var(--bg-alt);
          padding: 10px 16px;
          cursor: pointer;
          white-space: nowrap;
          user-select: none;
        }
        .rec-table td {
          padding: 12px 16px;
          border-top: 1px solid var(--line-100);
          color: var(--ink-800);
        }
        .rec-table tbody tr {
          cursor: pointer;
        }
        .rec-table tbody tr:hover {
          background: var(--bg-alt);
        }
        .sort-arrow {
          margin-left: 4px;
          font-size: 9px;
        }
        .grade-pill {
          background: var(--surface);
          border: 1px solid;
          font-weight: 700;
        }
        .grade-legend-dots {
          display: inline-flex;
          gap: 3px;
        }
        .grade-legend-dots i {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          display: inline-block;
        }

        /* ---------- Heatmap view (also used, with different data, by the
           Density view — same table/cell/expansion chrome, a distinct
           color scale) ---------- */
        /* Density map — banded amber grid (v3 snapshot). Cells are large
           and contiguous so the block of colour reads as a shape, with the
           count sitting inside it. */
        .density-corner {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          font-weight: 600;
          color: var(--ink-500);
          white-space: normal;
        }
        .density-corner-info {
          width: 17px;
          height: 17px;
          flex-shrink: 0;
          color: var(--ink-400);
          display: inline-flex;
          cursor: help;
        }
        .density-corner-info svg { width: 100%; height: 100%; }
        /* Density cells butt up against each other so the grid reads as
           one block of colour, the way the snapshot does — the gapped,
           rounded tiles of the teal heatmap made every count look like a
           separate object. */
        .density-grid {
          border: 1px solid var(--line-200);
          border-radius: 12px;
          background: var(--surface);
          overflow: hidden;
        }
        .density-grid .heatmap-scroll { padding: 0; }
        .density-grid .heat-table {
          border-collapse: collapse;
          border-spacing: 0;
          width: 100%;
        }
        .density-grid .heat-table thead th {
          font-size: 13px;
          font-weight: 600;
          text-transform: none;
          letter-spacing: 0;
          color: var(--ink-800);
          padding: 16px 14px;
          text-align: center;
          vertical-align: middle;
          border-bottom: 1px solid var(--line-200);
          background: var(--surface);
        }
        .density-grid .heat-table tbody th {
          text-align: left;
          font-size: 13.5px;
          font-weight: 600;
          color: var(--ink-800);
          white-space: normal;
          padding: 14px 18px 14px 20px;
          min-width: 190px;
          background: var(--surface);
          border-bottom: 1px solid var(--line-100);
        }
        .density-grid .heat-table tbody tr:last-child th { border-bottom: none; }
        .density-grid .heat-table td { padding: 0; }
        .heat-cell.density-cell {
          min-height: 104px;
          height: 100%;
          border-radius: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .heat-cell.density-cell.empty {
          border: none;
          border-radius: 0;
          background-image: none;
          background: var(--bg-alt);
        }
        .heat-cell.density-cell .heat-count {
          font-size: 22px;
          font-weight: 700;
          color: inherit;
          background: none;
          border: none;
          min-width: 0;
          height: auto;
          padding: 0;
          font-variant-numeric: tabular-nums;
        }
        .heat-cell.density-cell.selected {
          outline: 3px solid var(--brand-ink);
          outline-offset: -3px;
        }
        /* Tabs on the left, then Filters and Export side by side on the
           right — in that order. nowrap on the action group so the two
           buttons stay on one line and never stack. */
        .fb-row-views {
          justify-content: space-between;
          flex-wrap: nowrap;
          gap: 14px;
        }
        .fb-row-views .seg { flex-shrink: 1; min-width: 0; overflow-x: auto; }
        .fb-row-actions {
          display: flex;
          flex-direction: row;
          flex-wrap: nowrap;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }
        .fb-row-actions > * { flex-shrink: 0; }
        @media (max-width: 900px) {
          .fb-row-views { flex-wrap: wrap; }
        }
        .density-export.has-filters {
          border-color: var(--accent-border);
          color: var(--brand-ink);
          background: var(--accent-bg);
        }
        .filter-count {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 19px;
          height: 19px;
          padding: 0 6px;
          border-radius: 999px;
          background: var(--brand-ink);
          color: #fff;
          font-size: 11px;
          font-weight: 800;
        }
        .fb-panel {
          display: flex;
          align-items: flex-end;
          flex-wrap: wrap;
          gap: 14px;
          padding: 16px 18px;
          border: 1px solid var(--line-200);
          border-radius: 12px;
          background: var(--surface);
        }
        .fb-panel label {
          display: flex;
          flex-direction: column;
          gap: 5px;
          min-width: 0;
        }
        .fb-panel label span {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--ink-500);
        }
        .fb-panel select.filter-select {
          border-radius: 9px;
          padding: 9px 12px;
          font-size: 13px;
          max-width: 340px;
        }
        .fb-clear {
          margin-left: auto;
          border: none;
          background: none;
          color: var(--brand-ink);
          font-size: 12.5px;
          font-weight: 700;
          cursor: pointer;
          padding: 10px 2px;
        }
        .fb-clear:hover { text-decoration: underline; }

        .map-export { position: relative; }
        .map-export-menu {
          position: absolute;
          right: 0;
          top: calc(100% + 8px);
          width: 290px;
          background: var(--surface);
          border: 1px solid var(--line-200);
          border-radius: 12px;
          box-shadow: 0 14px 34px rgba(6, 30, 32, 0.16);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          z-index: 20;
        }
        .map-export-menu button {
          display: flex;
          flex-direction: column;
          gap: 3px;
          padding: 12px 15px;
          border: none;
          background: none;
          text-align: left;
          cursor: pointer;
        }
        .map-export-menu button + button { border-top: 1px solid var(--line-100); }
        .map-export-menu button:hover { background: var(--bg-alt); }
        .map-export-menu b { font-size: 13px; color: var(--ink-900); }
        .map-export-menu span { font-size: 11.5px; line-height: 1.45; color: var(--ink-500); }
        .matrix-axes {
          display: flex;
          align-items: flex-end;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 14px;
        }
        .matrix-axes label { display: flex; flex-direction: column; gap: 5px; }
        .matrix-axes label span {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--ink-500);
        }
        .matrix-axes select.filter-select {
          border-radius: 9px;
          padding: 9px 12px;
          font-size: 13px;
          min-width: 200px;
        }
        .matrix-swap {
          width: 38px;
          height: 38px;
          flex-shrink: 0;
          border: 1px solid var(--line-200);
          border-radius: 9px;
          background: var(--surface);
          color: var(--ink-600);
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .matrix-swap:hover { color: var(--brand-ink); border-color: var(--accent-border); }
        .matrix-swap svg { width: 17px; height: 17px; }
        .matrix-derived-note {
          margin: 0 0 14px 0;
          font-size: 12px;
          line-height: 1.6;
          color: var(--ink-600);
          background: var(--accent-bg);
          border: 1px solid var(--accent-border);
          border-radius: 9px;
          padding: 10px 13px;
        }
        .details-mode {
          display: inline-flex;
          align-self: flex-start;
          border: 1px solid var(--line-200);
          border-radius: 10px;
          background: var(--surface);
          padding: 4px;
        }
        .details-mode button {
          border: none;
          background: none;
          color: var(--ink-600);
          font-size: 13px;
          font-weight: 600;
          padding: 8px 16px;
          border-radius: 7px;
          cursor: pointer;
        }
        .details-mode button[aria-pressed="true"] {
          background: var(--brand-ink);
          color: #fff;
          font-weight: 700;
        }
        .cmp-pick {
          display: flex;
          align-items: center;
          gap: 14px;
          flex-wrap: wrap;
          padding: 14px 16px;
          border: 1px solid var(--line-200);
          border-radius: var(--card-radius);
          background: var(--surface);
        }
        .cmp-pick-label {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--ink-500);
        }
        .cmp-chips { display: flex; flex-wrap: wrap; gap: 7px; }
        .cmp-chip {
          font-size: 12px;
          font-weight: 700;
          padding: 7px 12px;
          border-radius: 999px;
          border: 1px solid var(--line-200);
          background: var(--bg);
          color: var(--ink-600);
          cursor: pointer;
        }
        .cmp-chip:hover:not(:disabled) { border-color: var(--accent-border); }
        .cmp-chip.on {
          background: var(--accent-bg);
          border-color: var(--accent-border);
          color: var(--brand-ink);
        }
        .cmp-chip:disabled { opacity: 0.42; cursor: not-allowed; }
        .cmp-wrap {
          overflow-x: auto;
          border: 1px solid var(--line-200);
          border-radius: var(--card-radius);
          background: var(--surface);
        }
        .cmp-table { border-collapse: collapse; width: 100%; min-width: 620px; }
        .cmp-table th,
        .cmp-table td {
          border-bottom: 1px solid var(--line-100);
          padding: 14px 16px;
          vertical-align: top;
          text-align: left;
          font-size: 13px;
          line-height: 1.55;
          color: var(--ink-700);
        }
        .cmp-table thead th {
          border-bottom: 1px solid var(--line-200);
          background: var(--bg-alt);
          position: sticky;
          top: 0;
          z-index: 2;
        }
        .cmp-rowhead {
          width: 170px;
          min-width: 150px;
          background: var(--bg-alt);
          position: sticky;
          left: 0;
          z-index: 1;
          font-size: 12px;
          font-weight: 700;
          color: var(--ink-600);
        }
        .cmp-rowhead-note {
          display: block;
          margin-top: 2px;
          font-size: 10.5px;
          font-weight: 500;
          color: var(--ink-400);
        }
        .cmp-org { font-size: 14px; font-weight: 700; color: var(--ink-900); }
        .cmp-sub { font-size: 11.5px; color: var(--ink-500); margin-top: 2px; }
        .cmp-title {
          margin-top: 5px;
          font-size: 11.5px;
          line-height: 1.4;
          color: var(--ink-600);
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .cmp-stack { display: flex; flex-direction: column; gap: 7px; }
        .cmp-quote { margin: 0; font-size: 12.5px; line-height: 1.55; color: var(--ink-700); }
        .cmp-pill {
          display: inline-flex;
          align-self: flex-start;
          font-size: 11.5px;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 999px;
          border: 1px solid var(--line-200);
        }
        .cmp-pill.dir-for { color: var(--favour); background: var(--favour-bg); border-color: var(--favour-border); }
        .cmp-pill.dir-against { color: var(--against); background: var(--against-bg); border-color: var(--against-border); }
        .cmp-pill.dir-neutral { color: var(--neutral); background: var(--neutral-bg); border-color: var(--neutral-border); }
        .cmp-meter { display: flex; flex-direction: column; gap: 5px; }
        .cmp-meter-track {
          display: block;
          height: 8px;
          border-radius: 4px;
          background: var(--line-100);
          overflow: hidden;
        }
        .cmp-meter-fill { display: block; height: 100%; border-radius: 4px; background: var(--brand-ink); }
        .cmp-meter b { font-size: 13px; color: var(--ink-900); font-variant-numeric: tabular-nums; }
        .cmp-meter small { font-size: 11px; font-weight: 600; color: var(--ink-500); }
        .cmp-flag {
          font-size: 10.5px;
          font-weight: 700;
          color: var(--accent-ink);
          background: var(--accent-bg);
          border: 1px solid var(--accent-border);
          border-radius: 999px;
          padding: 2px 8px;
          align-self: flex-start;
        }
        .cmp-none { color: var(--ink-400); font-style: italic; }
        .cmp-warn { color: var(--against); font-weight: 600; }
        .cmp-sub-inline { color: var(--ink-500); font-size: 12px; }
        .cmp-foot { margin: 0; font-size: 12px; line-height: 1.55; color: var(--ink-500); }
        .details-view { display: flex; flex-direction: column; gap: 18px; }
        .details-pick {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 14px;
          padding: 16px 18px;
          border: 1px solid var(--line-200);
          border-radius: var(--card-radius);
          background: var(--surface);
        }
        .details-pick label { display: flex; flex-direction: column; gap: 5px; flex: 1 1 420px; min-width: 0; }
        .details-pick label span {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--ink-500);
        }
        .details-pick select.filter-select {
          border-radius: 9px;
          padding: 10px 12px;
          font-size: 13px;
          width: 100%;
        }
        .details-nav { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
        .details-nav .btn-outline { padding: 9px 14px; font-size: 12.5px; }
        .details-pos {
          font-size: 12.5px;
          color: var(--ink-500);
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }
        .details-card {
          border: 1px solid var(--line-200);
          border-radius: var(--card-radius);
          background: var(--surface);
          padding: 26px 28px;
        }
        .details-card-head {
          padding-bottom: 18px;
          border-bottom: 1px solid var(--line-100);
          margin-bottom: 18px;
        }
        .details-card-head .drawer-title { margin: 10px 0 4px; }
        .details-card .drawer-body { padding: 0; }
        .density-bar {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 14px;
        }
        .density-export {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 13.5px;
          padding: 10px 18px;
        }
        .density-export svg { width: 16px; height: 16px; }
        .density-legend {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px 18px;
          padding: 16px 20px;
          border-top: 1px solid var(--line-200);
        }
        .density-legend-label {
          font-size: 12px;
          color: var(--ink-500);
        }
        .density-legend-item {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: var(--ink-600);
          font-variant-numeric: tabular-nums;
        }
        .density-swatch {
          width: 22px;
          height: 22px;
          border-radius: 5px;
          border: 1px solid rgba(90, 67, 37, 0.14);
          display: inline-block;
        }
        .density-footnote {
          margin: 0;
          padding: 0 20px 16px;
          font-size: 12px;
          line-height: 1.55;
          color: var(--ink-500);
        }
        @media (prefers-color-scheme: dark) {
          :root:not([data-theme="light"]) .density-swatch {
            border-color: rgba(255, 255, 255, 0.16);
          }
        }
        :root[data-theme="dark"] .density-swatch {
          border-color: rgba(255, 255, 255, 0.16);
        }
        .heatmap-wrap {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }
        .density-caption {
          margin: 0 0 16px 0;
          font-size: 13px;
          line-height: 1.6;
          color: var(--ink-600);
          max-width: none;
        }
        .density-caption i {
          font-style: italic;
        }
        .heatmap-scroll {
          padding: 14px;
        }
        .heat-table {
          border-collapse: separate;
          border-spacing: 6px;
          font-size: 12.5px;
        }
        .heat-table thead th {
          font-size: 10.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          color: var(--ink-500);
          padding: 0 6px 8px 6px;
          max-width: 150px;
          white-space: normal;
          line-height: 1.3;
          vertical-align: bottom;
        }
        .heat-corner {
          font-size: 10.5px;
          font-weight: 700;
          color: var(--ink-400);
          text-transform: none;
          letter-spacing: 0;
        }
        .heat-table tbody th {
          text-align: right;
          font-size: 12px;
          font-weight: 600;
          color: var(--ink-800);
          white-space: nowrap;
          padding: 0 12px 0 0;
        }
        .heat-cell {
          width: 100%;
          min-width: 68px;
          height: 44px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .heat-cell.selected {
          outline: 2px solid var(--brand);
          outline-offset: -2px;
        }
        .heat-cell.empty {
          height: 44px;
          min-width: 68px;
          border-radius: 8px;
          cursor: default;
          border: 1px dashed var(--line-200);
          background-image: repeating-linear-gradient(
            135deg,
            var(--line-100) 0px,
            var(--line-100) 5px,
            var(--bg-alt) 5px,
            var(--bg-alt) 10px
          );
        }
        .heat-count {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 22px;
          height: 22px;
          padding: 0 6px;
          border-radius: 999px;
          background: var(--surface);
          border: 1px solid var(--line-200);
          color: var(--ink-900);
          font-weight: 700;
          font-size: 12px;
        }
        .heat-scale-preview {
          display: inline-flex;
          gap: 2px;
        }
        .heat-scale-preview i {
          width: 16px;
          height: 14px;
          border-radius: 3px;
          display: inline-block;
          border: 1px solid var(--line-100);
        }
        .heat-scale-swatch {
          width: 18px;
          height: 14px;
          min-width: 0;
        }
        /* Wins over .heat-cell.empty's own sizing (higher specificity via
           the extra class) so the legend swatch stays small instead of
           rendering as a full 44px grid cell. */
        .heat-cell.empty.heat-scale-swatch {
          height: 14px;
          min-width: 0;
        }
        .heat-expansion {
          border: 1px solid var(--line-200);
          border-radius: 14px;
          background: var(--surface);
          overflow: hidden;
        }
        .heat-expansion-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 12px 16px;
          background: var(--bg-alt);
          border-bottom: 1px solid var(--line-100);
          font-size: 12.5px;
          color: var(--ink-700);
        }
        .heat-expansion-head b {
          color: var(--ink-900);
        }
      `}</style>
    </section>
  );
}

export default function MapPage() {
  return (
    <Suspense
      fallback={
        <div className="state-block">
          <div className="spinner" />
          <p>Loading guidelines…</p>
        </div>
      }
    >
      <MapInner />
    </Suspense>
  );
}
