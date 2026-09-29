"use client";

import { AUDIENCE_LIST } from "@/lib/audienceLens";
import { useAudienceLens } from "@/components/LensProvider";

/**
 * The lens switcher. Sits above the content on every main tab, states which
 * audience the page is currently written for and what question that audience
 * is asking, and lets anyone read the same data through a different lens
 * without changing their account.
 *
 * Showing the question ("What will it cost, will it work here...") rather
 * than only the audience name is deliberate: it makes the reframing legible
 * instead of leaving the user to guess why the page rearranged itself.
 */
export default function AudienceLensBar({ compact = false }: { compact?: boolean }) {
  const { lens, persona, selectedPersonas, isOverridden, setLens, resetLens } = useAudienceLens();
  const availableAudiences = AUDIENCE_LIST.filter(
    (audience) => selectedPersonas.length === 0 || selectedPersonas.includes(audience.key)
  );

  return (
    <div className={`lensbar${compact ? " lensbar-compact" : ""}`} data-lens={lens.key}>
      <div className="lensbar-main">
        <span className="lensbar-eyebrow">Viewing as</span>
        <div className="lensbar-options" role="group" aria-label="Audience lens">
          {availableAudiences.map((a) => (
            <button
              key={a.key}
              type="button"
              className={`lensbar-opt${a.key === lens.key ? " is-active" : ""}`}
              aria-pressed={a.key === lens.key}
              title={a.question}
              onClick={() => setLens(a.key)}
            >
              {a.short}
              {a.key === persona && <span className="lensbar-yours" aria-hidden="true" />}
            </button>
          ))}
        </div>
      </div>
      <div className="lensbar-question">
        <strong>{lens.label}:</strong> &ldquo;{lens.question}&rdquo;
        {isOverridden && (
          <button type="button" className="lensbar-reset" onClick={resetLens}>
            Reset to my audience
          </button>
        )}
      </div>

      <style jsx global>{`
        .lensbar {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 12px 14px;
          border: 1px solid var(--line-200);
          border-radius: 12px;
          background: var(--bg-alt);
          margin-bottom: 16px;
        }
        .lensbar-compact {
          padding: 9px 12px;
          margin-bottom: 12px;
        }
        .lensbar-main {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .lensbar-eyebrow {
          font-size: 10.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--ink-400);
        }
        .lensbar-options {
          display: flex;
          gap: 4px;
          flex-wrap: wrap;
          background: var(--surface);
          border: 1px solid var(--line-200);
          border-radius: 999px;
          padding: 3px;
        }
        .lensbar-opt {
          position: relative;
          border: none;
          background: none;
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
          color: var(--ink-600);
          padding: 5px 11px;
          border-radius: 999px;
          white-space: nowrap;
        }
        .lensbar-opt:hover {
          color: var(--ink-900);
          background: var(--bg-alt);
        }
        .lensbar-opt.is-active {
          background: var(--brand);
          color: #fff;
        }
        .lensbar-yours {
          position: absolute;
          top: 3px;
          right: 4px;
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--accent);
        }
        .lensbar-opt.is-active .lensbar-yours {
          background: #fff;
        }
        .lensbar-question {
          font-size: 12.5px;
          color: var(--ink-600);
          line-height: 1.5;
        }
        .lensbar-question strong {
          color: var(--ink-900);
        }
        .lensbar-reset {
          margin-left: 10px;
          border: 1px solid var(--line-200);
          background: var(--surface);
          border-radius: 999px;
          padding: 3px 10px;
          font-size: 11px;
          font-weight: 600;
          color: var(--ink-600);
          cursor: pointer;
        }
        .lensbar-reset:hover {
          color: var(--ink-900);
          border-color: var(--ink-400);
        }
      `}</style>
    </div>
  );
}
