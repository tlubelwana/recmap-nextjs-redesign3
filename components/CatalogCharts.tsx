"use client";

import { useMemo, useState } from "react";
import { directionVisual, orgInitials } from "@/components/format";
import type { Guideline } from "@/lib/types";

interface Bar {
  label: string;
  value: number;
  colorVar?: string;
}

const BAR_COLORS: Record<string, string> = {
  for: "var(--favour)",
  against: "var(--against)",
  neutral: "var(--neutral)",
};

/** A small, dependency-free horizontal bar chart / histogram. No charting
 *  library is installed (and none can be — see lib/db.ts's comment on why
 *  npm installs are unavailable here), so this draws plain SVG rects sized
 *  to the data, same principle as components/Markdown.tsx's hand-rolled
 *  table renderer. */
function BarChart({ bars, unit }: { bars: Bar[]; unit?: string }) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <div className="bar-chart">
      {bars.map((b) => (
        <div className="bar-row" key={b.label}>
          <span className="bar-label" title={b.label}>
            {b.label}
          </span>
          <div className="bar-track">
            <div
              className="bar-fill"
              style={{ width: `${(b.value / max) * 100}%`, background: b.colorVar ?? "var(--favour)" }}
            />
          </div>
          <span className="bar-value">
            {b.value}
            {unit ?? ""}
          </span>
        </div>
      ))}
    </div>
  );
}

function bucketize(values: number[], bucketSize: number, max: number): Bar[] {
  const bucketCount = Math.ceil(max / bucketSize);
  const counts = new Array(bucketCount).fill(0);
  for (const v of values) {
    const idx = Math.min(bucketCount - 1, Math.floor(v / bucketSize));
    if (idx >= 0) counts[idx] += 1;
  }
  return counts.map((count, i) => ({
    label: `${(i * bucketSize).toFixed(bucketSize < 1 ? 1 : 0)}–${((i + 1) * bucketSize).toFixed(
      bucketSize < 1 ? 1 : 0
    )}`,
    value: count,
  }));
}

function countBy<T>(items: T[], keyFn: (item: T) => string): Bar[] {
  const map = new Map<string, number>();
  for (const item of items) {
    const key = keyFn(item);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

type ChartKey =
  | "agree_histogram"
  | "agree_rex_histogram"
  | "direction_counts"
  | "certainty_counts"
  | "org_counts"
  | "clinical_area_counts"
  | "recommendation_type_counts";

const CHART_OPTIONS: { key: ChartKey; label: string; description: string }[] = [
  {
    key: "agree_histogram",
    label: "AGREE II score distribution",
    description: "How many recommendations fall into each AGREE II overall-score band (out of 7).",
  },
  {
    key: "agree_rex_histogram",
    label: "AGREE-REX score distribution",
    description: "Same, but for the AI-generated AGREE-REX overall score — appraised recommendations only.",
  },
  {
    key: "direction_counts",
    label: "Recommendation direction",
    description: "How many recommendations are for / against / neutral on using AI.",
  },
  {
    key: "certainty_counts",
    label: "GRADE certainty of evidence",
    description: "How many recommendations fall into each GRADE certainty level.",
  },
  {
    key: "org_counts",
    label: "Guidelines per organisation",
    description: "Which organisations have published the most guidelines in the catalog.",
  },
  {
    key: "clinical_area_counts",
    label: "Recommendations per clinical area",
    description: "Which clinical areas the catalog covers most.",
  },
  {
    key: "recommendation_type_counts",
    label: "Recommendation type",
    description: "Formal recommendations vs. good-practice statements vs. research recommendations.",
  },
];

/**
 * The catalog charts, as a component rather than a page.
 *
 * It used to be the standalone /analytics route, which always plotted the
 * WHOLE catalog. Living inside the Map's view switcher instead, it plots
 * whatever the map's filters and question currently select — so a chart
 * and the map beside it are always describing the same set of
 * recommendations, which the separate page could not guarantee.
 *
 * No charting library is installed (and none can reliably be added here),
 * so the bars are plain divs sized to the data.
 */
export default function CatalogCharts({ guidelines }: { guidelines: Guideline[] }) {
  const [chart, setChart] = useState<ChartKey>("agree_histogram");

  const { bars, unit, note } = useMemo(() => {
    if (guidelines.length === 0) return { bars: [] as Bar[], unit: "", note: "" };

    switch (chart) {
      case "agree_histogram": {
        const values = guidelines.map((g) => g.agree.overall7);
        return {
          bars: bucketize(values, 1, 7),
          unit: "",
          note: "1-point bands, 0–7. Includes AI-appraised scores for uploaded guidelines.",
        };
      }
      case "agree_rex_histogram": {
        const values = guidelines
          .filter((g) => g.agreeRex.status === "appraised" && g.agreeRex.rex)
          .map((g) => g.agreeRex.rex!.overall7);
        return {
          bars: bucketize(values, 1, 7),
          unit: "",
          note:
            values.length > 0
              ? "AI-generated first-pass appraisals only — always verify against the source before relying on these."
              : "No guidelines in the catalog have a completed AGREE-REX appraisal yet.",
        };
      }
      case "direction_counts": {
        const counts = countBy(guidelines, (g) => directionVisual(g.direction));
        const labelFor: Record<string, string> = { for: "In favour", against: "Against", neutral: "Neutral / mixed" };
        return {
          bars: counts.map((b) => ({ label: labelFor[b.label] ?? b.label, value: b.value, colorVar: BAR_COLORS[b.label] })),
          unit: "",
          note: "",
        };
      }
      case "certainty_counts":
        return { bars: countBy(guidelines, (g) => g.gradeCertaintyLabel), unit: "", note: "" };
      case "org_counts": {
        const counts = countBy(guidelines, (g) => g.organization);
        return {
          bars: counts.slice(0, 12).map((b) => ({ ...b, label: `${orgInitials(b.label)} — ${b.label}` })),
          unit: "",
          note: counts.length > 12 ? `Showing the top 12 of ${counts.length} organisations.` : "",
        };
      }
      case "clinical_area_counts":
        return { bars: countBy(guidelines, (g) => g.clinicalArea).slice(0, 12), unit: "", note: "" };
      case "recommendation_type_counts":
        return { bars: countBy(guidelines, (g) => g.recommendationTypeLabel), unit: "", note: "" };
      default:
        return { bars: [] as Bar[], unit: "", note: "" };
    }
  }, [guidelines, chart]);

  const activeOption = CHART_OPTIONS.find((o) => o.key === chart)!;

  return (
    <div className="analytics-wrap">
      <p className="analytics-dek">
        Plotted from the {guidelines.length} recommendation{guidelines.length === 1 ? "" : "s"} currently in view —
        change the filters above and every chart follows.
      </p>

      {guidelines.length === 0 && <div className="state-block">No guidelines match these filters.</div>}

      {guidelines.length > 0 && (
        <>
          <div className="chart-picker">
            {CHART_OPTIONS.map((o) => (
              <button
                key={o.key}
                type="button"
                className={`chart-picker-btn ${chart === o.key ? "active" : ""}`}
                onClick={() => setChart(o.key)}
              >
                {o.label}
              </button>
            ))}
          </div>

          <div className="chart-panel">
            <div className="chart-panel-head">
              <h2>{activeOption.label}</h2>
              <p>{activeOption.description}</p>
            </div>
            {bars.length > 0 ? (
              <BarChart bars={bars} unit={unit} />
            ) : (
              <p className="ask-empty-note">No data available for this chart.</p>
            )}
            {note && <p className="chart-note">{note}</p>}
          </div>
        </>
      )}

      <style jsx global>{`
        .analytics-wrap {
          padding: 4px 0 8px 0;
        }
        .analytics-dek {
          margin: 0 0 18px 0;
          font-size: 14px;
          line-height: 1.6;
          color: var(--ink-600);
          max-width: 620px;
        }
        .chart-picker {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 22px;
        }
        .chart-picker-btn {
          font-size: 12.5px;
          font-weight: 600;
          padding: 7px 13px;
          border-radius: 999px;
          border: 1px solid var(--line-200);
          background: var(--bg);
          color: var(--ink-600);
          cursor: pointer;
        }
        .chart-picker-btn:hover {
          background: var(--bg-alt);
        }
        .chart-picker-btn.active {
          background: var(--brand-ink);
          border-color: var(--brand-ink);
          color: #fff;
        }
        .chart-panel {
          border: 1px solid var(--line-200);
          border-radius: 12px;
          padding: 22px 24px;
          background: var(--bg);
          max-width: 780px;
        }
        .chart-panel-head h2 {
          margin: 0 0 4px 0;
          font-size: 16px;
          font-weight: 700;
          color: var(--ink-900);
        }
        .chart-panel-head p {
          margin: 0 0 20px 0;
          font-size: 13px;
          color: var(--ink-600);
        }
        .bar-chart {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .bar-row {
          display: grid;
          grid-template-columns: 160px 1fr 40px;
          align-items: center;
          gap: 10px;
        }
        .bar-label {
          font-size: 12px;
          font-weight: 600;
          color: var(--ink-700);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .bar-track {
          background: var(--bg-alt);
          border-radius: 5px;
          height: 16px;
          overflow: hidden;
        }
        .bar-fill {
          height: 100%;
          border-radius: 5px;
          min-width: 2px;
          transition: width 0.25s ease;
        }
        .bar-value {
          font-size: 12px;
          font-weight: 700;
          color: var(--ink-800);
          text-align: right;
          font-variant-numeric: tabular-nums;
        }
        .chart-note {
          margin: 16px 0 0 0;
          font-size: 12px;
          color: var(--ink-500);
        }
        @media (max-width: 700px) {
          .bar-row {
            grid-template-columns: 110px 1fr 34px;
          }
        }
      `}</style>
    </div>
  );
}
