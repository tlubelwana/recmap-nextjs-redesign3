import type { GradeCertaintyLevel } from "@/lib/types";

/** Visual treatment per GRADE certainty-of-evidence level: a 0-4 "how full"
 *  reading for the mini bar/ticks, plus a color pulled from the existing
 *  favour/accent/against scale (green = high certainty, amber = low, red =
 *  very low, grey = not reported) so it reads as a traffic-light gradient
 *  without inventing new tokens. "Low / Very low" (a combined GRADE bucket
 *  some guidelines report instead of picking one) is drawn the same as
 *  "Very low" since it never claims better than that. */
const LEVEL_META: Record<
  GradeCertaintyLevel,
  { fill: number; color: string; bg: string; border: string }
> = {
  high: { fill: 4, color: "var(--favour)", bg: "var(--favour-bg)", border: "var(--favour-border)" },
  moderate: { fill: 3, color: "var(--brand)", bg: "var(--favour-bg)", border: "var(--favour-border)" },
  low: { fill: 2, color: "var(--accent-ink)", bg: "var(--accent-bg)", border: "var(--accent-border)" },
  low_very_low: { fill: 1, color: "var(--against)", bg: "var(--against-bg)", border: "var(--against-border)" },
  very_low: { fill: 1, color: "var(--against)", bg: "var(--against-bg)", border: "var(--against-border)" },
  not_reported: { fill: 0, color: "var(--ink-500)", bg: "var(--bg-alt)", border: "var(--line-200)" },
};

/** Compact GRADE certainty pill — deliberately given the same visual
 *  weight (font size, filled color, border) as the AGREE II score pill
 *  (.cat-card-score) wherever the two sit side by side, since today only
 *  AGREE has any visual presence and that's the bug this component fixes. */
export function GradeCertaintyBadge({
  level,
  label,
  compact,
}: {
  level: GradeCertaintyLevel;
  label: string;
  compact?: boolean;
}) {
  const meta = LEVEL_META[level];
  return (
    <>
      <span
        className="grade-badge"
        title={`GRADE certainty: ${label}`}
        style={{ color: meta.color, background: meta.bg, borderColor: meta.border }}
      >
        <span className="grade-badge-ticks" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <i key={i} style={{ background: i < meta.fill ? meta.color : "var(--line-200)" }} />
          ))}
        </span>
        <span className="grade-badge-text">
          {compact ? "GRADE" : "GRADE certainty"}: {label}
        </span>
      </span>
      <style jsx global>{`
        .grade-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11.5px;
          font-weight: 700;
          border-radius: 999px;
          padding: 5px 11px;
          border: 1px solid;
          max-width: 100%;
          min-width: 0;
        }
        /* Truncate rather than overflow the card: a long level like
           "Low / Very low" in a narrow grid column would otherwise spill
           past the card edge. The full text stays in the title attribute. */
        .grade-badge-text {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          min-width: 0;
        }
        .grade-badge-ticks {
          display: inline-flex;
          gap: 2px;
          flex-shrink: 0;
        }
        .grade-badge-ticks i {
          width: 4px;
          height: 8px;
          border-radius: 2px;
          display: inline-block;
        }
      `}</style>
    </>
  );
}

/** Full-size "GRADE: certainty of evidence" block, sized and laid out to
 *  match the AGREE II domain breakdown (AgreeDomains.tsx) it sits next to
 *  in the drawer — same section-label treatment, a wide bar-meter instead
 *  of a small pill, and a bold level readout — so certainty of evidence
 *  and rigor of guideline development get equal billing rather than GRADE
 *  being an afterthought under a prominent AGREE score. */
export function GradeCertaintySection({
  level,
  label,
  rawCertainty,
  gradingApproachLabel,
}: {
  level: GradeCertaintyLevel;
  label: string;
  rawCertainty?: string;
  gradingApproachLabel?: string;
}) {
  const meta = LEVEL_META[level];
  const pct = (meta.fill / 4) * 100;
  return (
    <>
      <div className="grade-section">
        <div className="agree-head">
          <span className="dsec-label">GRADE: certainty of evidence</span>
          {gradingApproachLabel && <span className="agree-badge">{gradingApproachLabel}</span>}
        </div>
        <div className="grade-section-row">
          <span className="grade-section-track">
            <span className="grade-section-fill" style={{ width: `${pct}%`, background: meta.color }} />
          </span>
          <span className="grade-section-level" style={{ color: meta.color }}>
            {label}
          </span>
        </div>
        <div className="grade-section-scale" aria-hidden="true">
          <span>Very low</span>
          <span>Low</span>
          <span>Moderate</span>
          <span>High</span>
        </div>
        {rawCertainty && rawCertainty.trim() && rawCertainty.trim() !== label && (
          <div className="grade-section-raw">As reported in the source: &ldquo;{rawCertainty}&rdquo;</div>
        )}
      </div>
      <style jsx global>{`
        .grade-section {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .grade-section-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        /* A single wide bar with the level called out beside it, per the
           v3 drawer snapshot. The four-step scale underneath is what keeps
           it honest — a full-width bar with no axis invites reading "High"
           as "the evidence is strong in absolute terms". */
        .grade-section-track {
          flex: 1;
          height: 34px;
          background: var(--line-100);
          border-radius: 8px;
          overflow: hidden;
          min-width: 0;
        }
        .grade-section-fill {
          display: block;
          height: 100%;
          border-radius: 8px;
          transition: width 0.3s ease;
        }
        .grade-section-level {
          font-size: 28px;
          font-weight: 700;
          white-space: nowrap;
          flex-shrink: 0;
          line-height: 1;
          letter-spacing: -0.015em;
        }
        .grade-section-scale {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          font-size: 10.5px;
          font-weight: 600;
          color: var(--ink-400);
          letter-spacing: 0.02em;
        }
        .grade-section-scale span { text-align: center; }
        .grade-section-scale span:first-child { text-align: left; }
        .grade-section-scale span:last-child { text-align: right; }
        .grade-section-raw {
          margin-top: 8px;
          font-size: 12px;
          color: var(--ink-500);
        }
      `}</style>
    </>
  );
}

/** Small (i) affordance for `classificationNote` — shown next to a
 *  recommendation's type/certainty badges whenever the source text needed
 *  interpretation to classify. Uses a native `title` tooltip rather than
 *  hiding the caveat behind a click. */
export function ClassificationNoteDot({ note }: { note: string }) {
  return (
    <>
      <span className="classification-note-dot" title={note} aria-label={`Classification note: ${note}`}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5.5" />
          <path d="M12 7.5h.01" />
        </svg>
      </span>
      <style jsx global>{`
        .classification-note-dot {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: var(--ink-400);
          cursor: help;
          flex-shrink: 0;
        }
        .classification-note-dot:hover {
          color: var(--ink-700);
        }
      `}</style>
    </>
  );
}
