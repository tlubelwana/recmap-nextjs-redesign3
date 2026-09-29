import type { EvidenceSnapshot } from "@/lib/types";

/** Evidence-inspection panel for one recommendation. Every field here is a
 *  placeholder today (see EvidenceSnapshot in lib/types.ts) — there's no
 *  real Summary-of-Findings or Evidence-to-Decision table linked yet, just
 *  a note pointing back at the source guideline. Styled clearly as
 *  "not yet available" (dashed border, muted note text) rather than
 *  looking like a broken/empty card. */
export default function EvidencePanel({
  evidence,
  pdfFile,
}: {
  evidence: EvidenceSnapshot;
  pdfFile?: string;
}) {
  return (
    <>
      <div className="evidence-panel">
        <div className="dsec-label">Evidence</div>
        <div className="evidence-grid">
          <div className={`evidence-card${evidence.sofAvailable ? "" : " unavailable"}`}>
            <div className="evidence-card-head">
              Summary of Findings
              {!evidence.sofAvailable && <span className="evidence-card-flag">Not yet available</span>}
            </div>
            <p>{evidence.sofNote}</p>
          </div>
          <div className={`evidence-card${evidence.etdAvailable ? "" : " unavailable"}`}>
            <div className="evidence-card-head">
              Evidence to Decision
              {!evidence.etdAvailable && <span className="evidence-card-flag">Not yet available</span>}
            </div>
            <p>{evidence.etdNote}</p>
          </div>
          <div className="evidence-card unavailable">
            <div className="evidence-card-head">
              Primary studies
              <span className="evidence-card-flag">Not yet available</span>
            </div>
            <p>{evidence.primaryStudiesNote}</p>
          </div>
          <div className="evidence-card unavailable">
            <div className="evidence-card-head">
              MAGICapp linkage
              <span className="evidence-card-flag">Coming soon</span>
            </div>
            {evidence.magicappUrl ? (
              <a href={evidence.magicappUrl} target="_blank" rel="noopener noreferrer" className="source-pdf-link">
                Open in MAGICapp ↗
              </a>
            ) : (
              <p>RecMap doesn&rsquo;t link out to MAGICapp yet — this is on the roadmap.</p>
            )}
          </div>
        </div>
        {pdfFile && (
          <a
            className="source-pdf-link"
            href={`/data/pdfs/${pdfFile}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Read the full guideline
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17L17 7" />
              <path d="M7 7h10v10" />
            </svg>
          </a>
        )}
      </div>
      <style jsx global>{`
        .evidence-panel {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .evidence-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 10px;
        }
        .evidence-card {
          border: 1px dashed var(--line-200);
          border-radius: 10px;
          padding: 12px 14px;
          background: var(--bg-alt);
        }
        .evidence-card-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          font-size: 12px;
          font-weight: 700;
          color: var(--ink-700);
          margin-bottom: 5px;
        }
        .evidence-card-flag {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          color: var(--ink-500);
          background: var(--surface);
          border: 1px solid var(--line-200);
          border-radius: 999px;
          padding: 2px 7px;
          flex-shrink: 0;
        }
        .evidence-card p {
          margin: 0;
          font-size: 12px;
          line-height: 1.55;
          color: var(--ink-500);
        }
      `}</style>
    </>
  );
}
