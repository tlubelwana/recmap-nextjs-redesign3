export default function AboutManuscript() {
  return (
    <section className="about-wrap">
      <header className="about-hero">
        <span className="eyebrow">About RecMap</span>
        <h1>Clinical practice guidelines on artificial intelligence interventions</h1>
        <p className="about-dek">
          A transparent evidence map and structured synthesis of AI-related recommendations in clinical practice
          guidelines.
        </p>
      </header>

      <div className="about-body">
        <section className="about-section">
          <h2>Purpose and scope</h2>
          <p>
            RecMap is a guideline-focused evidence map. It uses “umbrella review” to mean a structured review of
            existing clinical practice guidelines, rather than a review of systematic reviews. The project maps what
            guidelines recommend about AI in clinical care and appraises how those recommendations were developed.
            It does not pool intervention effects, replace the source guideline, or function as an autonomous clinical
            decision-maker.
          </p>
          <p>
            The current scope is deliberately narrow: AI-related recommendations in clinical practice guidelines and
            the appraisal of those recommendations. Questions outside that scope are identified rather than answered
            through unsupported general medical knowledge.
          </p>
        </section>

        <section className="about-section">
          <h2>Search and selection</h2>
          <p>
            The documented search covered Embase, MEDLINE, ECRI Guidelines Trust, the Guidelines International Network
            library, NICE, SIGN, and Guideline Central. Searches focused on clinical practice guidelines published from
            2020 onward and addressing AI-related interventions in clinical care, with English-language limits where
            the source permitted them.
          </p>
          <p>
            The project records report 74 Embase results and 57 MEDLINE results after the recorded limits. Repository
            yields included 1,149 ECRI results, 122 GIN results, 36 NICE results, 22 SIGN results, and 234 Guideline
            Central results. These are source-level yields, not unique studies: overlap, duplicates, retrieval, and
            exclusion reasons must be resolved in the final screening log. The documented screening workflow records 91
            records screened; the complete PRISMA flow remains a work in progress.
          </p>
        </section>

        <section className="about-section">
          <h2>What was extracted</h2>
          <p>
            The extraction unit is an individual AI-related recommendation, linked to its source guideline document.
            Records capture population, intervention, comparator, outcomes, recommendation wording, direction,
            strength, recommendation type, grading approach, certainty, clinical area, AI domain, region, age group,
            equity information, implementation information, coding fields, source provenance, and last-checked date.
          </p>
          <p>
            Recommendation types are retained because a Recommendation, Additional Guidance statement, Good Practice
            Statement, and Research Recommendation do not carry identical evidentiary or actionability implications.
            Source wording is kept separate from appraisal rationale, and missing information is shown as missing rather
            than inferred.
          </p>
        </section>

        <section className="about-section">
          <h2>Appraisal framework</h2>
          <h3>AGREE II</h3>
          <p>
            AGREE II describes the rigor and reporting of guideline development across 23 items and six domains. The
            13 records in the current release retain human-derived AGREE II scores from the project source workbooks;
            the language model did not re-score them. AGREE II is not a measure of intervention effectiveness or
            evidence certainty.
          </p>
          <h3>GRADE certainty</h3>
          <p>
            Source-reported certainty was retained and normalized for comparison as High, Moderate, Low, Low/Very low,
            Very low, or Not reported. Normalization improves display consistency but does not create a certainty
            judgment where the source did not report one.
          </p>
          <h3>AGREE-REX</h3>
          <p>
            AGREE-REX was applied only where the parent guideline passed the provisional 70% AGREE II gate. Nine
            current records are eligible. These are two independent AI-generated first-pass appraisals from the project
            workbook, not trained human appraisals or evidence of inter-rater reliability. Differences of two or more
            points are flagged for human review.
          </p>
        </section>

        <section className="about-section">
          <h2>Current evidence map</h2>
          <p>
            The current RecMap release contains 13 recommendation records representing 13 source guideline documents,
            11 organisations, and 11 clinical areas. Seven records are In favour, three Against, one No recommendation,
            and two Insufficient evidence. Recommendation types are eight Recommendations, three Additional Guidance
            statements, one Good Practice Statement, and one Research Recommendation.
          </p>
          <p>
            GRADE certainty is Low in five records, Very low in two, Low/Very low in one, and Not reported in five.
            These results show a heterogeneous evidence landscape rather than a single consensus position. Direction,
            certainty, AGREE II rigor, and AGREE-REX trustworthiness are displayed as separate signals and should not be
            collapsed into one score.
          </p>
        </section>

        <section className="about-section">
          <h2>How the application presents the synthesis</h2>
          <p>
            The Catalog groups recommendations by source document. The Map compares recommendation nodes by clinical
            area, direction, AGREE II score, and GRADE certainty, and can show the records linked to a specific Ask
            question. The detail drawer keeps the Map visible while exposing source wording, PICO, appraisal domains,
            equity, implementation, coding, and AGREE-REX information where eligible.
          </p>
          <p>
            Ask is a language-model interface grounded in the structured catalog. It names cited organisations and
            guideline titles, flags out-of-scope questions and answers needing human review, and does not constitute a
            new systematic review. Audience lenses change ordering, framing, and emphasis without changing the
            underlying extracted data.
          </p>
        </section>

        <section className="about-section">
          <h2>Limitations and next steps</h2>
          <p>
            The search and screening documentation is not yet a frozen PRISMA dataset. Repository yields overlap, the
            current catalog is small, and source guidelines vary in reporting quality. The application does not yet
            provide complete linkage to primary studies, Summary-of-Findings tables, or Evidence-to-Decision products.
            Machine extraction may miss content in figures, complex tables, or supplements.
          </p>
          <p>
            AGREE-REX is AI-generated and requires human verification. The 70% eligibility threshold is provisional.
            Future work should finalize deduplication and exclusion reasons, complete the PRISMA flow, preserve all
            database strategies and dates, link recommendations to underlying evidence products, and independently
            verify AI-generated appraisals.
          </p>
        </section>

        <section className="about-section" id="who-built-this">
          <h2>Who built this</h2>
          <p>
            The umbrella review behind RecMap was led by <b>Tandekile Lubelwana Hafver</b>, PhD researcher at the MAGIC
            Evidence Ecosystem Foundation, with search-strategy support from <b>Marte Ødegaard</b>, academic librarian
            at Oslo University Library.
          </p>
          <p><b>Made by Tandekile Lubelwana Hafver.</b> RecMap makes the review findings browsable while the manuscript develops.</p>
        </section>
      </div>

      <style>{`
        .about-wrap { padding: 28px 0 60px; max-width: 780px; margin: 0 auto; }
        .about-hero { display: flex; flex-direction: column; gap: 10px; padding-bottom: 30px; border-bottom: 1px solid var(--line-100); margin-bottom: 30px; }
        .about-hero h1 { margin: 0; font-size: 28px; font-weight: 700; color: var(--ink-900); line-height: 1.25; }
        .about-dek { margin: 0; font-size: 14.5px; line-height: 1.6; color: var(--ink-600); max-width: 640px; }
        .about-body { display: flex; flex-direction: column; gap: 38px; }
        .about-section h2 { margin: 0 0 12px; font-size: 18px; font-weight: 700; color: var(--ink-900); }
        .about-section h3 { margin: 18px 0 8px; font-size: 13px; font-weight: 700; color: var(--ink-700); text-transform: uppercase; letter-spacing: 0.04em; }
        .about-section p { margin: 0 0 14px; font-size: 14.5px; line-height: 1.7; color: var(--ink-800); text-align: justify; hyphens: auto; }
        .about-section p:last-child { margin-bottom: 0; }
        @media (max-width: 700px) { .about-wrap { padding: 20px 16px 48px; } }
      `}</style>
    </section>
  );
}
