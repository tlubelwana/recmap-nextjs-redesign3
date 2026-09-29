"use client";

import { useState } from "react";
import type { AgreeDomain } from "@/lib/types";

/**
 * AGREE II domain scores, drawn as the v3 drawer snapshot has them: a
 * numbered row per domain with a filled teal meter and the score as a
 * percentage of the 7-point scale.
 *
 * NAMING NOTE — do not rename these back to .bar-track / .bar-fill. Those
 * class names are also used by the Charts page (app/(authed)/(main)/
 * analytics/page.tsx), whose styled-jsx `global` block declares
 * `.bar-fill` with no background and `.bar-track` at 16px. Because
 * styled-jsx injects after globals.css at equal specificity, once a user
 * had visited Charts those rules won the cascade here and the meters
 * rendered as tall, empty, pale tracks — the score was there, the bar was
 * invisible. Scoped names keep the two components from fighting.
 */
export default function AgreeDomains({
  domains,
  overall7,
}: {
  domains: AgreeDomain[];
  overall7: number;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const overallPct = Math.round((overall7 / 7) * 100);

  return (
    <div>
      <div className="agree-head">
        <span className="dsec-label">AGREE&nbsp;II domain scores</span>
        <span className="agree-badge">{domains.length} domains</span>
      </div>
      {domains.map((d, i) => {
        const open = openKey === d.key;
        const pct = Math.max(0, Math.min(100, (d.score7 / 7) * 100));
        return (
          <div key={d.key}>
            <button
              type="button"
              className={`domainrow${open ? " expanded" : ""}`}
              onClick={() => setOpenKey(open ? null : d.key)}
              aria-expanded={open}
            >
              <span className="dnum">{i + 1}.</span>
              <span className="dlabel">{d.label}</span>
              <span className="agree-bar-track">
                <span className="agree-bar-fill" style={{ width: `${pct}%` }} />
              </span>
              <span className="dscore" title={`${d.score7.toFixed(1)} out of 7`}>
                {Math.round(pct)}%
              </span>
              <span className="dcaret">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </span>
            </button>
            {open && (
              <div className="agree-item-detail open">
                {d.items.map((it) => (
                  <div className="agree-item-row" key={it.num}>
                    <div className="agree-item-head">
                      <span>
                        {it.num}. {it.text}
                      </span>
                      <span className="agree-item-score">{it.score.toFixed(1)}/7</span>
                    </div>
                    <p className="agree-item-appraisal">{it.appraisal}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <div className="agree-overall">
        Overall AGREE&nbsp;II score
        <b>
          {overallPct}% &middot; {overall7.toFixed(2)}/7
        </b>
      </div>

      <style jsx global>{`
        .agree-bar-track {
          height: 9px;
          background: var(--line-100);
          border-radius: 5px;
          overflow: hidden;
          min-width: 0;
        }
        .agree-bar-fill {
          display: block;
          height: 100%;
          border-radius: 5px;
          background: var(--brand-ink);
          min-width: 3px;
          transition: width 0.3s ease;
        }
      `}</style>
    </div>
  );
}
