import { PROGRESS_PLUS_DIMENSIONS } from "@/lib/types";
import type { EquityInfo } from "@/lib/types";
// (PROGRESS_PLUS_DIMENSIONS is a runtime const array; EquityInfo is a type-only import — kept separate intentionally.)

/**
 * Equity information alongside PICO — whether this recommendation was
 * evaluated for differential impact on disadvantaged groups, using the
 * PROGRESS-Plus framework (the same one the chronic-pain RecMap protocol
 * uses for its own equity work: Place of residence, Race/ethnicity/
 * culture/language, Occupation, Gender/sex, Religion, Education,
 * Socioeconomic status, Social capital, Plus age/disability/orientation).
 *
 * Every recommendation in the shipped dataset is honestly marked
 * "not evaluated" — the source guidelines' recommendation text doesn't
 * discuss differential impact on any PROGRESS-Plus dimension. This
 * component exists so equity has a real, visible home in the app (it had
 * none before) rather than to claim an assessment that hasn't happened.
 */
export default function EquitySection({ equity }: { equity: EquityInfo }) {
  return (
    <>
      <div className="equity-panel">
        <div className="panel-head">
          <div>
            <h3>Equity (PROGRESS-Plus)</h3>
            <p>Whether the guideline assessed differential impact across key equity dimensions.</p>
          </div>
          <span
            className="panel-info"
            role="img"
            aria-label="About PROGRESS-Plus"
            title="PROGRESS-Plus (O'Neill et al.) is the framework the chronic-pain RecMap protocol uses for equity work: place of residence, race/ethnicity/culture/language, occupation, gender/sex, religion, education, socioeconomic status, social capital, plus age, disability and sexual orientation."
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 11v5.4" strokeLinecap="round" />
              <path d="M12 7.9v.4" strokeLinecap="round" strokeWidth="2.2" />
            </svg>
          </span>
        </div>
        {equity.evaluated ? (
          <div className="equity-dims">
            {PROGRESS_PLUS_DIMENSIONS.map((dim) => {
              const addressed = equity.dimensionsAddressed.includes(dim);
              return (
                <span key={dim} className={`equity-dim-chip${addressed ? " addressed" : ""}`}>
                  {dim}
                </span>
              );
            })}
          </div>
        ) : null}
        <div className={`equity-note${equity.evaluated ? "" : " unassessed"}`}>
          {!equity.evaluated && (
            <span className="equity-note-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M8.4 12h7.2" />
              </svg>
            </span>
          )}
          <div className="equity-note-body">
            {!equity.evaluated && <div className="equity-note-h">Not evaluated</div>}
            <p>{equity.note}</p>
          </div>
        </div>
      </div>
      <style jsx global>{`
        .equity-panel {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .equity-dims {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .equity-dim-chip {
          font-size: 11px;
          color: var(--ink-500);
          background: var(--bg-alt);
          border: 1px solid var(--line-200);
          border-radius: 999px;
          padding: 3px 9px;
        }
        .equity-dim-chip.addressed {
          color: var(--favour);
          background: var(--favour-bg);
          border-color: var(--favour-border);
          font-weight: 700;
        }
        /* The dashed "not evaluated" panel from the v3 snapshot. Dashed
           rather than solid on purpose: it reads as an empty slot waiting
           to be filled, which is exactly what it is. */
        .equity-note {
          border: 1px dashed var(--line-200);
          border-radius: 10px;
          padding: 18px 20px;
          background: var(--bg-alt);
          display: flex;
          align-items: flex-start;
          gap: 14px;
        }
        .equity-note-icon {
          flex-shrink: 0;
          width: 26px;
          height: 26px;
          color: var(--ink-400);
          display: inline-flex;
        }
        .equity-note-icon svg { width: 100%; height: 100%; }
        .equity-note-body { min-width: 0; }
        .equity-note-h {
          font-size: 16px;
          font-weight: 700;
          color: var(--ink-800);
          margin-bottom: 5px;
        }
        .equity-note p {
          margin: 0;
          font-size: 13px;
          line-height: 1.6;
          color: var(--ink-600);
        }
      `}</style>
    </>
  );
}
