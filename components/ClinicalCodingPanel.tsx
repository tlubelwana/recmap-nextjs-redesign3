import type { ClinicalCoding, CodeRef } from "@/lib/types";

/**
 * Standardized clinical coding for this recommendation's PICO elements —
 * ICD-11, SNOMED CT, ATC/DDD — following the approach described in the
 * tuberculosis RecMap paper (PMC8168829): coding lets recommendations be
 * deduplicated, cross-referenced, and matched to a query computationally
 * instead of only living as free text in a PICO field.
 *
 * Every code shown here was independently verified — nothing is guessed.
 * Where a field couldn't be verified, doesn't apply (ATC/DDD is a drug
 * index; this dataset is AI/software interventions), or the guideline's
 * scope doesn't map to one category, that's shown honestly as "Not coded"
 * with an explanatory note rather than a fabricated code.
 *
 * Presented as the v3 snapshot's three tiles: a coded terminology is a
 * solid filled tile, an uncoded one is a dashed outline. The explanatory
 * note stays on the uncoded tiles — the snapshot has nowhere for it, but
 * "not coded" without a reason reads as an omission rather than a finding.
 */

function TileIcon({ coded }: { coded: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      {coded ? <path d="m8.2 12.3 2.5 2.5 5-5.3" /> : <path d="M8.4 12h7.2" />}
    </svg>
  );
}

function CodeTile({ system, code, note }: { system: string; code: CodeRef | null; note: string | null }) {
  if (code) {
    return (
      <div className="coding-tile coded">
        <span className="coding-tile-icon">
          <TileIcon coded />
        </span>
        <span className="coding-tile-text">
          {code.system} &middot; {code.code} &middot; {code.label}
        </span>
      </div>
    );
  }
  return (
    <div className="coding-tile uncoded">
      <div className="coding-tile-row">
        <span className="coding-tile-icon">
          <TileIcon coded={false} />
        </span>
        <span className="coding-tile-text">{system} &middot; Not coded</span>
      </div>
      {note && <p className="coding-tile-note">{note}</p>}
    </div>
  );
}

export default function ClinicalCodingPanel({ coding }: { coding: ClinicalCoding }) {
  return (
    <>
      <div className="coding-panel">
        <div className="panel-head">
          <div>
            <h3>Standardized clinical coding</h3>
            <p>Maps this recommendation to standard clinical terminologies.</p>
          </div>
          <span
            className="panel-info"
            role="img"
            aria-label="About clinical coding"
            title="Coding lets recommendations be deduplicated, cross-referenced and matched to a query computationally rather than only by free text. Every code here was verified against the source; nothing is guessed."
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 11v5.4" strokeLinecap="round" />
              <path d="M12 7.9v.4" strokeLinecap="round" strokeWidth="2.2" />
            </svg>
          </span>
        </div>
        <div className="coding-grid">
          <CodeTile system="ICD-11" code={coding.icd11} note={coding.icd11Note} />
          <CodeTile system="SNOMED CT" code={coding.snomedCt} note={coding.snomedCtNote} />
          <CodeTile system="ATC/DDD" code={coding.atcDdd} note={coding.atcDddNote} />
        </div>
      </div>
      <style jsx global>{`
        .coding-panel {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .panel-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
        }
        .panel-head h3 {
          margin: 0 0 4px 0;
          font-size: 19px;
          font-weight: 700;
          color: var(--ink-900);
          letter-spacing: -0.01em;
        }
        .panel-head p {
          margin: 0;
          font-size: 13px;
          line-height: 1.55;
          color: var(--ink-600);
        }
        .panel-info {
          flex-shrink: 0;
          width: 20px;
          height: 20px;
          color: var(--ink-400);
          display: inline-flex;
          cursor: help;
        }
        .panel-info svg { width: 100%; height: 100%; }
        .coding-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
          gap: 14px;
          align-items: stretch;
        }
        .coding-tile {
          border-radius: 10px;
          padding: 16px 18px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          justify-content: center;
          min-height: 84px;
        }
        .coding-tile.coded {
          background: #12833f;
          border: 1px solid #12833f;
          color: #fff;
          flex-direction: row;
          align-items: center;
          gap: 12px;
        }
        .coding-tile.uncoded {
          border: 1px dashed var(--line-200);
          background: var(--bg-alt);
          color: var(--ink-500);
        }
        .coding-tile-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .coding-tile-icon {
          flex-shrink: 0;
          width: 24px;
          height: 24px;
          display: inline-flex;
        }
        .coding-tile-icon svg { width: 100%; height: 100%; }
        .coding-tile-text {
          font-size: 14px;
          font-weight: 600;
          line-height: 1.4;
        }
        .coding-tile-note {
          margin: 0;
          font-size: 11.5px;
          line-height: 1.5;
          color: var(--ink-500);
        }
      `}</style>
    </>
  );
}
