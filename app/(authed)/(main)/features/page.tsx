const FEATURES = [
  {
    status: "Planned",
    title: "Curated guideline suggestions",
    text: "Keep the catalog closed to unreviewed uploads while providing a transparent intake route for proposed guidelines, with eligibility checks, provenance, appraisal status, and human verification before publication.",
  },
  {
    status: "Planned",
    title: "Living-guideline change tracking",
    text: "Show when a living guideline changes, what recommendation text changed, which evidence triggered the update, and whether the appraisal needs to be refreshed.",
  },
  {
    status: "Planned",
    title: "Coverage-gap mapping",
    text: "Extend the Map beyond existing guidance to show where no guideline yet addresses a plausible AI-in-clinical-care question. This would treat silence as information and would be especially useful to guideline developers deciding where new work is needed. Defining the universe of plausible questions to check is itself a research judgment, not a fully objective extraction step.",
  },
  {
    status: "Planned",
    title: "Validated-device cross-reference",
    text: "Extract the specific AI device or model version evaluated in the cited studies behind a recommendation, then cross-reference its public regulatory status, including FDA clearance, CE marking, and the approved indication. This would expose the common mismatch between a broad plain-language recommendation about AI and the specific system actually tested. It is factual extraction and public-database lookup, not a clinical judgment call.",
  },
];

export default function FeaturesPage() {
  return (
    <section className="features-wrap">
      <header className="features-hero">
        <span className="eyebrow">RecMap spotlight</span>
        <h1 className="wordmark">New features</h1>
        <p>
          RecMap is being built as a transparent evidence map. This page shows planned additions without presenting
          unfinished work as completed functionality.
        </p>
      </header>

      <div className="features-roadmap">
        {(["Planned"] as const).map((status) => {
          const features = FEATURES.filter((feature) => feature.status === status);
          if (features.length === 0) return null;
          const statusClass = "planned";
          return (
            <section className="feature-group" key={status}>
              <div className="feature-group-head">
                <span className={`feature-status ${statusClass}`}>{status}</span>
                <span className="feature-group-count">{features.length} item{features.length === 1 ? "" : "s"}</span>
              </div>
              <div className="feature-list">
                {features.map((feature) => (
                  <details className="feature-item" key={feature.title}>
                    <summary>
                      <span className={`feature-dot ${statusClass}`} aria-hidden="true" />
                      <span className="feature-title">{feature.title}</span>
                      <span className="feature-chevron" aria-hidden="true">+</span>
                    </summary>
                    <p>{feature.text}</p>
                  </details>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <div className="features-note">
        <b>Guiding principle:</b> new functionality should improve traceability, make uncertainty visible, and keep a
        human-verifiable source behind every important claim.
      </div>

      <style>{`
        .features-wrap {
          max-width: 900px;
          margin: 0 auto;
          padding: 34px 0 64px;
        }
        .features-hero {
          max-width: 700px;
          padding-bottom: 26px;
          border-bottom: 1px solid var(--line-100);
          margin-bottom: 26px;
        }
        .features-hero h1 {
          margin: 8px 0;
          color: var(--ink-900);
          font-size: 30px;
          line-height: 1.2;
        }
        .features-hero p {
          margin: 0;
          color: var(--ink-600);
          font-size: 14px;
          line-height: 1.7;
        }
        .features-roadmap {
          display: flex;
          flex-direction: column;
          gap: 28px;
        }
        .feature-group-head {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 8px;
        }
        .feature-group-count {
          color: var(--ink-500);
          font-size: 12px;
        }
        .feature-list {
          border: 1px solid var(--line-200);
          border-radius: 10px;
          background: var(--surface);
          overflow: hidden;
        }
        .feature-status {
          display: inline-flex;
          border-radius: 999px;
          padding: 4px 9px;
          font-size: 10.5px;
          font-weight: 700;
        }
        .feature-status.available {
          color: var(--favour);
          background: var(--favour-bg);
          border: 1px solid var(--favour-border);
        }
        .feature-status.development {
          color: var(--brand);
          background: var(--favour-bg);
          border: 1px solid var(--favour-border);
        }
        .feature-status.planned {
          color: var(--accent-ink);
          background: var(--accent-bg);
          border: 1px solid var(--accent-border);
        }
        .feature-item {
          border-bottom: 1px solid var(--line-100);
        }
        .feature-item:last-child {
          border-bottom: 0;
        }
        .feature-item summary {
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 14px 16px;
          cursor: pointer;
          list-style: none;
        }
        .feature-item summary::-webkit-details-marker {
          display: none;
        }
        .feature-item summary:hover {
          background: var(--bg-alt);
        }
        .feature-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex: 0 0 auto;
        }
        .feature-dot.available { background: var(--favour); }
        .feature-dot.development { background: var(--brand); }
        .feature-dot.planned { background: var(--accent); }
        .feature-title {
          flex: 1;
          color: var(--ink-900);
          font-size: 16px;
          font-weight: 700;
        }
        .feature-chevron {
          color: var(--ink-400);
          font-size: 20px;
          font-weight: 400;
          line-height: 1;
        }
        .feature-item[open] .feature-chevron {
          transform: rotate(45deg);
        }
        .feature-item p {
          margin: 0;
          padding: 0 44px 16px 35px;
          color: var(--ink-700);
          font-size: 13.5px;
          line-height: 1.6;
        }
        .features-note {
          margin-top: 22px;
          padding: 14px 16px;
          border: 1px solid var(--accent-border);
          border-radius: 10px;
          background: var(--accent-bg);
          color: var(--ink-700);
          font-size: 13px;
          line-height: 1.6;
        }
        @media (max-width: 700px) {
          .features-wrap { padding: 24px 16px 48px; }
          .feature-item p { padding-left: 35px; }
        }
      `}</style>
    </section>
  );
}
