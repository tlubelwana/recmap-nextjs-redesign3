import type { Metadata } from "next";
import { getAllGuidelines, getGuidelineGroups } from "@/lib/data";
import { formatDate, uniqueSorted } from "@/components/format";
import { LAST_SEARCHED_ISO, NEXT_SEARCH_ISO, SEARCH_CADENCE_IS_PROVISIONAL } from "@/lib/config";

export const metadata: Metadata = {
  title: "About — RecMap",
  description:
    "What RecMap is, how the underlying umbrella review was conducted, and where the pipeline is still incomplete.",
};

// A fixed point in time to measure "new since" against. Every guideline in
// the shipped v1 dataset was checked on the same sweep date (see
// lib/types.ts#Guideline.lastCheckedISO), so comparing against any baseline
// before that date currently returns "all of them" and comparing against
// that date itself returns zero — neither is a meaningful freshness signal
// yet. We still compute it for real (no hardcoded count) and say plainly
// that the signal isn't meaningful until the catalog updates on a
// recurring schedule. Kept as a named constant so it's easy to find and
// move forward once that schedule exists.
const NEW_SINCE_BASELINE_ISO = "2026-01-01";

const PROJECT_PEOPLE = [
  { initials: "TH", name: "Tandekile Lubelwana Hafver", org: "MAGIC Evidence Ecosystem Foundation" },
  { initials: "FA", name: "Frankie Achille", org: "MAGIC Evidence Ecosystem Foundation" },
  { initials: "FF", name: "Farid Foroutan", org: "MAGIC Evidence Ecosystem Foundation" },
  { initials: "MØ", name: "Marte Ødegaard", org: "MAGIC Evidence Ecosystem Foundation" },
  { initials: "PV", name: "Per Olav Vandvik", org: "MAGIC Evidence Ecosystem Foundation" },
  { initials: "IF", name: "Iván D. Flórez", org: "MAGIC Evidence Ecosystem Foundation" },
  { initials: "SL", name: "Sheyu Li", org: "MAGIC Evidence Ecosystem Foundation" },
  { initials: "YJ", name: "Yinghui Jin", org: "MAGIC Evidence Ecosystem Foundation" },
  { initials: "FG", name: "Feng Gao", org: "MAGIC Evidence Ecosystem Foundation" },
  { initials: "YW", name: "Yongbo Wang", org: "MAGIC Evidence Ecosystem Foundation" },
];

function FunnelBox({
  title,
  value,
  finalized = true,
}: {
  title: string;
  value?: string;
  finalized?: boolean;
}) {
  return (
    <div className={`funnel-box${finalized ? "" : " funnel-box-open"}`}>
      <div className="funnel-box-title">{title}</div>
      {value !== undefined && <div className="funnel-box-value">{value}</div>}
      {!finalized && <span className="pill amber funnel-badge">Not yet finalized</span>}
    </div>
  );
}

function FunnelArrow() {
  return (
    <svg className="funnel-arrow" width="14" height="18" viewBox="0 0 14 18" fill="none">
      <path d="M7 0v13" stroke="var(--ink-400)" strokeWidth="1.6" />
      <path d="M1.5 10.5L7 16l5.5-5.5" stroke="var(--ink-400)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** One headline figure for the About page's summary panel, per the v3
 *  snapshot: an icon disc above the number and its label. Every figure is
 *  computed from the catalog at render time — none is hard-coded, so the
 *  panel can't drift out of date the way a written-in number would. */
function StatTile({ value, label, icon }: { value: number; label: string; icon: React.ReactNode }) {
  return (
    <div className="about-stat">
      <span className="about-stat-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          {icon}
        </svg>
      </span>
      <span className="about-stat-value">{value}</span>
      <span className="about-stat-label">{label}</span>
    </div>
  );
}

const STAT_ICONS = {
  document: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
      <path d="M14 3v5h5M9 13h6M9 16.5h4" />
    </>
  ),
  statement: (
    <>
      <path d="M20.5 12.2c0 4-3.8 7.2-8.5 7.2a10 10 0 0 1-2.6-.34L4.2 20.7l1.3-3.7a6.8 6.8 0 0 1-2-4.8C3.5 8.2 7.3 5 12 5s8.5 3.2 8.5 7.2Z" />
      <path d="M8.6 11h6.8M8.6 14h4.2" />
    </>
  ),
  clinical: (
    <>
      <path d="M7 3v5.5a4.2 4.2 0 0 0 8.4 0V3" />
      <path d="M5.4 3h3.2M13.8 3H17" />
      <path d="M11.2 12.6v2.6a4.4 4.4 0 0 0 8.8 0v-1.4" />
      <circle cx="20" cy="11.6" r="2.1" />
    </>
  ),
  organisation: (
    <>
      <path d="M3.5 9.5 12 4.5l8.5 5" />
      <path d="M5.5 10.5v7M9.5 10.5v7M14.5 10.5v7M18.5 10.5v7" />
      <path d="M3.5 20.5h17" />
    </>
  ),
};

function LegacyAboutPage() {
  const guidelines = getAllGuidelines();
  const groups = getGuidelineGroups();

  const totalGuidelines = groups.length;
  const totalRecommendations = guidelines.length;
  const clinicalAreas = uniqueSorted(guidelines.map((g) => g.clinicalArea));
  const organizations = uniqueSorted(guidelines.map((g) => g.organization));

  const lastCheckedISO = guidelines.reduce<string | null>((latest, g) => {
    if (!g.lastCheckedISO) return latest;
    if (!latest || g.lastCheckedISO > latest) return g.lastCheckedISO;
    return latest;
  }, null);

  const newSinceCount = guidelines.filter(
    (g) => g.lastCheckedISO && g.lastCheckedISO > NEW_SINCE_BASELINE_ISO
  ).length;
  const newSinceIsMeaningful = newSinceCount > 0 && newSinceCount < guidelines.length;

  return (
    <section className="about-wrap">
      <header className="about-hero">
        <span className="eyebrow">About RecMap</span>
        <h1>What this is, and how it was built</h1>
        <p className="about-dek">
          RecMap is a research tool, not a finished product — this page documents the review methodology
          behind it as honestly as we can, including the parts that are still in progress.
        </p>
      </header>

      <section className="about-summary">
        <p className="about-summary-lede">
          RecMap is a curated map of clinical practice guideline recommendations on the use of AI, appraised with
          AGREE&nbsp;II and GRADE, to support consistent, trustworthy and useful clinical decision-making.
        </p>
        <div className="about-stats">
          <StatTile value={totalGuidelines} label="Guidelines" icon={STAT_ICONS.document} />
          <StatTile value={totalRecommendations} label="Recommendation statements" icon={STAT_ICONS.statement} />
          <StatTile value={clinicalAreas.length} label="Clinical areas" icon={STAT_ICONS.clinical} />
          <StatTile value={organizations.length} label="Organisations" icon={STAT_ICONS.organisation} />
        </div>
        <div className="about-meta">
          <div className="about-meta-row">
            <span className="about-meta-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
                <path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" />
              </svg>
            </span>
            <span>
              <b>Last checked:</b> {lastCheckedISO ? formatDate(lastCheckedISO) : "—"}
            </span>
          </div>
          <div className="about-meta-row">
            <span className="about-meta-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
            </span>
            <span>
              <b>Last searched:</b> {formatDate(LAST_SEARCHED_ISO)} &nbsp;·&nbsp; <b>Next search:</b>{" "}
              {formatDate(NEXT_SEARCH_ISO)}
            </span>
            {SEARCH_CADENCE_IS_PROVISIONAL && (
              <span
                className="pill amber about-meta-flag"
                title="The re-search cadence is a provisional 6-month placeholder, not a confirmed schedule — see lib/config.ts."
              >
                Provisional cadence
              </span>
            )}
          </div>
        </div>
        <p className="about-supporter">
          RecMap is supported by the <b>MAGIC Evidence Ecosystem Foundation</b>.
        </p>
      </section>

      <section className="about-us-panel">
        <div className="about-us-header">
          <h2>Meet the core team</h2>
          <p>
            We come from a wide range of backgrounds and disciplines working towards a common goal to make
            reviewing clinical practice guidelines seamless.
          </p>
        </div>
        <div className="people-grid">
          {PROJECT_PEOPLE.map((person) => (
            <div key={person.initials} className="person-card">
              <div className="person-avatar">{person.initials}</div>
              <div className="person-name">{person.name}</div>
              <div className="person-org">{person.org}</div>
            </div>
          ))}
        </div>
        <div className="contact-wrap">
          <div className="contact-copy">
            <span className="eyebrow">About us</span>
            <h3>MAGIC Evidence Ecosystem Foundation</h3>
            <p>
              RecMap is developed and maintained by the MAGIC Evidence Ecosystem Foundation to make AI-related
              evidence and guideline comparisons easier to explore, compare, and interpret.
            </p>
          </div>
          <div className="contact-box">
            <span className="contact-label">Contact</span>
            <a href="https://www.magicevidence.org/" target="_blank" rel="noreferrer">
              magicevidence.org
            </a>
            <a href="mailto:info@magicevidence.org">info@magicevidence.org</a>
          </div>
        </div>
        <div className="foundation-signoff">MAGIC EVIDENCE ECOSYSTEM FOUNDATION</div>
      </section>

      <div className="about-body">
        {/* 1. What this is */}
        <section className="about-section" id="what-this-is">
          <h2>1. What this is</h2>
          <p>
            RecMap is an interactive evidence map built from an <b>umbrella review of clinical practice
            guidelines (CPGs)</b> that contain AI-based interventions. The term &ldquo;umbrella
            review&rdquo; usually refers to a review of existing systematic reviews — a high-level synthesis
            across other reviews. That is <b>not</b> what we mean by it here. In this project, an umbrella
            review refers instead to a review of existing clinical practice guidelines themselves: rather
            than re-synthesizing primary studies or systematic reviews, we systematically searched for and
            catalogued the CPGs that guideline-developing organisations have already published on AI-based
            interventions, then appraised each one.
          </p>
          <p>
            The results are presented as an <b>evidence map</b>: a visual, browsable representation of the
            existing evidence designed to identify knowledge gaps and guide future research or policy
            decisions, rather than to answer a single clinical question with a pooled estimate. Concretely,
            RecMap is an overview of existing guidelines addressing AI interventions in clinical practice,
            together with an evaluation of the methodological quality of those guidelines using AGREE&nbsp;II.
            The map is meant to surface where guidance is methodologically well founded and aligned with the
            underlying evidence, where guidelines disagree with one another, and where gaps in coverage
            remain.
          </p>
        </section>

        {/* 2. Why this design */}
        <section className="about-section" id="why-this-design">
          <h2>2. Why this design</h2>
          <p>
            We chose an umbrella-review design over a traditional systematic review because the project has
            two aims at once: mapping which clinical domains and which types of AI intervention are being
            addressed by guidance at all, and appraising the methodological rigour of that guidance with
            AGREE&nbsp;II across the whole guideline ecosystem — not just the strongest part of it. A
            traditional systematic review typically has a narrower focus than an umbrella review, and
            quality-based inclusion criteria would likely exclude CPGs that are topically relevant but
            methodologically weak. Excluding those guidelines would have hidden exactly the kind of gap this
            map is meant to expose: a topic area where guidance exists but is thin, poorly resourced, or
            not yet rigorously developed is still useful to know about, so weaker guidelines are appraised and
            shown on the map rather than screened out.
          </p>
        </section>

        {/* 3. Search & eligibility */}
        <section className="about-section" id="search-eligibility">
          <h2>3. Search &amp; eligibility</h2>
          <p>
            Guidelines were identified through a systematic search of biomedical databases (Medline, Embase)
            and of guideline repositories and databases maintained by major guideline networks and
            organisations, including ECRI Guideline Trust, the Guidelines International Network (G-I-N), the
            World Health Organization (WHO), the National Institute for Health and Care Excellence (NICE), and
            Guideline Central.
          </p>

          <div className="funnel-grid">
            <div className="funnel-col">
              <div className="funnel-col-label">Identification via databases &amp; registers</div>
              <FunnelBox title="Records identified through database searching" value="Medline n = 57 · Embase n = 74" />
              <FunnelArrow />
              <FunnelBox
                title="Records removed before screening"
                value="Duplicates removed: n = 48"
              />
              <div className="funnel-subnote">
                Automation-tool exclusions and other-reason exclusions for this step:{" "}
                <span className="pill amber funnel-badge-inline">not yet finalized</span>
              </div>
              <FunnelArrow />
              <FunnelBox title="Records screened" value="n = 91" />
              <div className="funnel-subnote">
                Records excluded: <span className="pill amber funnel-badge-inline">not yet finalized</span>
              </div>
              <FunnelArrow />
              <FunnelBox title="Reports sought for retrieval" finalized={false} />
              <FunnelArrow />
              <FunnelBox title="Reports not retrieved" finalized={false} />
              <FunnelArrow />
              <FunnelBox title="Reports assessed for eligibility" finalized={false} />
              <FunnelArrow />
              <FunnelBox title="Reports excluded, with reasons" finalized={false} />
            </div>

            <div className="funnel-col">
              <div className="funnel-col-label">Identification via other methods</div>
              <FunnelBox title="Records identified from other sources" value="ECRI n = 1149" />
              <div className="funnel-subnote">
                Also searched as sources: GIN, NICE, Guideline Central, WHO Guideline Database — counts for
                these: <span className="pill amber funnel-badge-inline">not yet finalized</span>
              </div>
              <FunnelArrow />
              <FunnelBox title="Reports sought for retrieval" finalized={false} />
              <FunnelArrow />
              <FunnelBox title="Reports assessed for eligibility" finalized={false} />
              <FunnelArrow />
              <FunnelBox title="Reports excluded, with reasons" finalized={false} />
            </div>
          </div>

          <div className="funnel-final-wrap">
            <FunnelArrow />
            <div className="funnel-final-row">
              <FunnelBox title="Studies included in review" finalized={false} />
              <FunnelBox title="Reports of included studies" finalized={false} />
            </div>
          </div>

          <p className="funnel-caveat">
            These are the search-funnel counts as recorded in the source PRISMA diagram at the time of
            writing. Several downstream counts had not yet been filled in when this page was written, and we
            show that plainly above rather than estimate a number — the 13 guidelines shipped in RecMap today
            are the guidelines that made it through this process so far, not a final, closed set.
          </p>

          <h3>Inclusion criteria</h3>
          <ul className="about-list">
            <li>Publications explicitly identified as a clinical practice guideline (CPG).</li>
            <li>
              Addresses interventions that involve AI tools (e.g., diagnostic algorithms, predictive models,
              decision support systems).
            </li>
            <li>Applies to human patients in any healthcare setting (e.g., primary, secondary, tertiary care).</li>
            <li>Published from 2020 onward, to reflect recent developments in AI.</li>
            <li>Availability: publicly available full text.</li>
          </ul>

          <h3>Exclusion criteria</h3>
          <ul className="about-list">
            <li>
              CPGs that do not include recommendations on interventions related to AI or machine learning
              applications.
            </li>
            <li>Duplicate publications, or publications superseded by an updated version.</li>
          </ul>
        </section>

        {/* 4. Data extraction & quality appraisal */}
        <section className="about-section" id="extraction-appraisal">
          <h2>4. How RecMap was made: extraction, appraisal &amp; synthesis</h2>
          <p>
            Each included source was converted into structured guideline and recommendation records. The extraction
            captured the recommendation wording, population, AI intervention, comparator, outcomes, direction,
            strength, recommendation type, grading approach, certainty, clinical area, AI domain, region, age group,
            equity and implementation information, coding fields, source provenance, and last-checked date. PICO was
            kept at recommendation level so users can inspect what the guideline actually addresses rather than only
            seeing a document-level label.
          </p>
          <p>
            The shipped 13 records retain human-derived <b>AGREE&nbsp;II</b> scores from the project source workbooks;
            the language model did not re-score them. AGREE&nbsp;II measures how rigorously the guideline was developed
            and reported, not whether an intervention works or whether the underlying evidence is certain.
          </p>
          <div className="dsec-plain about-note">
            <p>
              <b>GRADE and AGREE-REX are separate signals.</b> Source-reported certainty was retained and normalized
              for display as High, Moderate, Low, Low/Very low, Very low, or Not reported; normalization does not
              create a certainty judgment where the source did not report one. AGREE-REX was applied only to
              recommendations whose parent guideline passed the provisional 70% AGREE&nbsp;II gate. The nine eligible
              records carry two independent AI-generated first-pass AGREE-REX appraisals from the project workbook,
              not trained human appraisals or evidence of inter-rater reliability. Differences of two or more points
              are flagged for human review, and every score should be checked against the source guideline before use.
            </p>
          </div>
        </section>

        {/* 5. Evidence map / synthesis */}
        <section className="about-section" id="evidence-map">
          <h2>5. Evidence map &amp; synthesis</h2>
          <p>
            Recommendations are mapped along two axes: their <b>direction</b> (in favour, against, or no
            recommendation / insufficient evidence) and the <b>certainty of the underlying evidence</b>. The{" "}
            <a href="/map">Map</a> view plots every recommendation this way, clustered by clinical area, with
            each guideline&rsquo;s AGREE&nbsp;II score shown as a ring around its marker — so direction,
            evidence certainty, and methodological quality can be read together at a glance, rather than
            requiring three separate lookups.
          </p>
        </section>

        {/* 6. Pipeline transparency */}
        <section className="about-section" id="pipeline-transparency">
          <h2>6. Pipeline transparency</h2>
          <p>
            These figures are computed directly from the catalog currently shipped with RecMap, not
            hand-maintained — they will move as guidelines are added.
          </p>
          <div className="stat-grid">
            <div className="stat-tile">
              <div className="stat-value">{totalGuidelines}</div>
              <div className="stat-label">Guidelines</div>
            </div>
            <div className="stat-tile">
              <div className="stat-value">{totalRecommendations}</div>
              <div className="stat-label">Recommendation statements</div>
            </div>
            <div className="stat-tile">
              <div className="stat-value">{clinicalAreas.length}</div>
              <div className="stat-label">Clinical areas</div>
            </div>
            <div className="stat-tile">
              <div className="stat-value">{organizations.length}</div>
              <div className="stat-label">Organisations</div>
            </div>
          </div>
          <p className="about-lastchecked">
            Last checked: <b>{lastCheckedISO ? formatDate(lastCheckedISO) : "unknown"}</b>
          </p>
          <p className="about-lastchecked">
            Last searched: <b>{formatDate(LAST_SEARCHED_ISO)}</b> &middot; Next search:{" "}
            <b>{formatDate(NEXT_SEARCH_ISO)}</b>
            {SEARCH_CADENCE_IS_PROVISIONAL && (
              <span className="pill amber" style={{ marginLeft: 8 }}>
                Provisional cadence
              </span>
            )}
          </p>
          {SEARCH_CADENCE_IS_PROVISIONAL && (
            <p className="about-search-cadence-note">
              &ldquo;Last searched&rdquo; reflects the manuscript-in-preparation&rsquo;s description of the search
              running throughout the spring months of 2026; &ldquo;next search&rdquo; is a provisional 6-month
              cadence, not a confirmed re-search date. See lib/config.ts to update either once finalized.
            </p>
          )}
          <p>
            {newSinceIsMeaningful ? (
              <>
                <b>{newSinceCount}</b> guideline{newSinceCount === 1 ? "" : "s"} new since{" "}
                {formatDate(NEW_SINCE_BASELINE_ISO)}.
              </>
            ) : (
              <>
                We don&rsquo;t yet show a meaningful &ldquo;new since&rdquo; count: this is a v1 static
                dataset where every shipped guideline was checked on the same sweep date, so there is no
                real update cadence to compare against yet. This count will begin tracking once the guideline
                set starts updating on a schedule.
              </>
            )}
          </p>
        </section>

        {/* 7. Who built this */}
        <section className="about-section" id="who-built-this">
          <h2>7. Who built this</h2>
          <p>
            The umbrella review behind RecMap was led by <b>Tandekile Lubelwana Hafver</b>, PhD researcher at
            the MAGIC Evidence Ecosystem Foundation, with search-strategy support from{" "}
            <b>Marte Ødegaard</b>, academic librarian at Oslo University Library. Searching biomedical
            reference databases and guideline repositories required different approaches given how
            differently each source exposes metadata and full text, and the search strategy drew on
            methodological guidance from Filiatreault, Hodgins &amp; Witherspoon (2018) on constructing
            guideline searches.
          </p>
          <p>
            A full manuscript describing this umbrella review is in preparation. RecMap is the accompanying
            interactive evidence map — built to make the review&rsquo;s findings browsable while the paper
            itself is being written, rather than something released only after publication.
          </p>
          <p className="made-by">
            <b>Made by Tandekile Lubelwana Hafver.</b> RecMap brings the review, appraisal, and evidence map
            together in one practical tool for point-of-care use.
          </p>
        </section>

        {/* 8. Known limitations (v1) */}
        <section className="about-section" id="limitations">
          <h2>8. Known limitations (v1)</h2>
          <p>
            <b>Evidence depth is thin.</b> RecMap currently shows what a guideline recommends and how
            rigorously that guideline was developed, but it does not yet link to Summary-of-Findings tables,
            full Evidence-to-Decision tables, MAGICapp, or the underlying primary studies. For now, readers
            who want that depth need to consult the source guideline PDF directly — each guideline in the
            catalog links to its source document where one is on file.
          </p>
          <p>
            <b>Classification is first-pass, not an independent re-review.</b> Recommendation-type
            classification (Recommendation / Good Practice Statement / Additional Guidance / Research
            Recommendation) and GRADE-certainty normalization were derived from the extracted guideline text
            as a first-pass classification, not from an independent full-text re-review of every guideline.
            Individual classification notes are shown in the catalog wherever the source text needed
            interpretation.
          </p>
          <p>
            <b>Coverage is still narrow.</b> The current dataset covers {totalGuidelines} guidelines spanning{" "}
            {clinicalAreas.length} clinical areas. That is real breadth, not a single-topic pilot, but it is
            still a small slice of the guideline landscape — the dataset is expected to keep growing, and
            broader, more varied clinical coverage is an explicit next step rather than a finished goal.
          </p>
          <p>
            <b>The six audience lenses are not equally mature.</b> RecMap now renders every record through one of six
            audience lenses — point-of-care clinician, person with lived experience, policy/health-system
            decision-maker, researcher, guideline developer, and industry — each deciding which sections appear, in
            what order, under what headings, and how Ask phrases an answer. The clinician view has had by far the most
            design attention; the others are real, deliberately-designed surfaces rather than re-skins, but they are
            younger and will keep changing.
          </p>
          <p>
            <b>Two lenses are limited by what the source guidelines contain, not by RecMap.</b> The policy lens leans
            on AGREE&nbsp;II items 20 and 21 (resource implications, monitoring and auditing criteria), which are
            routinely the lowest-scoring items in any guideline corpus — so that view often reports &ldquo;the
            guideline did not address this&rdquo;. That is the honest finding, not a gap in the extraction. The
            lived-experience lens depends on AGREE&nbsp;II item 5 (whether the target population&rsquo;s views were
            sought), and on none of the 13 shipped guidelines having an equity analysis to show.
          </p>
          <p>
            <b>No patient decision aids are linked.</b> The lived-experience lens can tell a reader when a decision is
            genuinely theirs to make, but RecMap holds no decision aids to hand them, and none of the shipped
            guidelines link one.
          </p>
          <p>
            <b>No multi-language support yet.</b> RecMap is English-only at this stage.
          </p>
        </section>
      </div>

      <style>{`
        /* Headline figures panel (v3 snapshot). Sits between the hero and
           the team panel, so the first thing the page answers is "how much
           is in here, and how current is it". */
        .about-summary {
          border: 1px solid var(--line-200);
          border-radius: var(--card-radius);
          background: var(--surface);
          padding: 26px 28px 22px;
          margin-bottom: 26px;
        }
        .about-summary-lede {
          margin: 0 0 22px 0;
          font-size: 15px;
          line-height: 1.65;
          color: var(--ink-700);
        }
        .about-stats {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
        }
        .about-stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 22px 16px 20px;
          border: 1px solid var(--line-100);
          border-radius: 12px;
          background: var(--bg-alt);
          text-align: center;
        }
        .about-stat-icon {
          width: 54px;
          height: 54px;
          border-radius: 50%;
          background: var(--accent-bg);
          color: var(--brand-ink);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 2px;
        }
        .about-stat-icon svg { width: 26px; height: 26px; }
        .about-stat-value {
          font-size: 34px;
          font-weight: 800;
          line-height: 1;
          color: var(--brand-ink);
          font-variant-numeric: tabular-nums;
        }
        .about-stat-label {
          font-size: 13.5px;
          line-height: 1.35;
          color: var(--ink-700);
        }
        .about-meta {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 22px;
          padding-top: 20px;
          border-top: 1px solid var(--line-100);
        }
        .about-meta-row {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          font-size: 14px;
          color: var(--ink-700);
        }
        .about-meta-row b { font-weight: 600; color: var(--ink-600); }
        .about-meta-icon {
          width: 20px;
          height: 20px;
          flex-shrink: 0;
          color: var(--brand-ink);
          display: inline-flex;
        }
        .about-meta-icon svg { width: 100%; height: 100%; }
        .about-meta-flag { font-size: 11.5px; }
        .about-supporter {
          margin: 20px 0 0 0;
          padding-top: 18px;
          border-top: 1px solid var(--line-100);
          font-size: 14px;
          color: var(--ink-700);
        }
        @media (max-width: 900px) {
          .about-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 520px) {
          .about-stats { grid-template-columns: 1fr; }
          .about-summary { padding: 20px; }
        }
        .about-wrap {
          padding: 28px 0 60px 0;
          max-width: 780px;
          margin: 0 auto;
        }
        .about-us-panel {
          background: linear-gradient(180deg, rgba(5, 71, 72, 0.96) 0%, rgba(4, 78, 83, 0.96) 100%);
          color: #edf8f7;
          border-radius: 28px;
          padding: 42px 24px 28px;
          margin: 0 0 32px;
          box-shadow: 0 24px 50px rgba(5, 52, 58, 0.16);
        }
        .about-us-header {
          text-align: center;
          margin-bottom: 30px;
        }
        .about-us-header h2 {
          margin: 0;
          font-size: clamp(2.4rem, 3vw, 4rem);
          line-height: 1.1;
          letter-spacing: -0.04em;
          font-weight: 800;
          color: #f5fbfb;
        }
        .about-us-header p {
          margin: 10px 0 0;
          font-size: 1.1rem;
          color: rgba(236, 249, 248, 0.86);
          font-style: italic;
        }
        .people-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 26px 22px;
          align-items: start;
          margin-top: 18px;
        }
        .person-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          min-width: 0;
        }
        .person-avatar {
          width: 130px;
          height: 130px;
          border-radius: 50%;
          background: rgba(236, 244, 244, 0.78);
          color: rgba(8, 74, 74, 0.92);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2rem;
          font-weight: 700;
          letter-spacing: -0.05em;
          margin-bottom: 16px;
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.4);
        }
        .person-name {
          font-size: 1.05rem;
          font-weight: 700;
          color: #f7fbfa;
          line-height: 1.25;
          margin-bottom: 6px;
        }
        .person-org {
          font-size: 0.8rem;
          color: rgba(235, 245, 244, 0.8);
          line-height: 1.4;
          min-height: 2.8em;
        }
        .contact-wrap {
          margin-top: 32px;
          display: grid;
          grid-template-columns: 1.7fr 0.9fr;
          gap: 18px;
          align-items: end;
          border-top: 1px solid rgba(255, 255, 255, 0.2);
          padding-top: 24px;
        }
        .contact-copy .eyebrow {
          color: rgba(226, 244, 242, 0.8);
        }
        .contact-copy h3 {
          margin: 8px 0 8px;
          font-size: 1.2rem;
          color: #f7fbfa;
        }
        .contact-copy p {
          margin: 0;
          font-size: 0.95rem;
          line-height: 1.6;
          color: rgba(238, 248, 247, 0.84);
        }
        .contact-box {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 16px;
          padding: 16px 18px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .contact-label {
          font-size: 0.7rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(237, 249, 248, 0.7);
          font-weight: 700;
        }
        .contact-box a {
          color: #f5fbfb;
          text-decoration: underline;
          text-underline-offset: 2px;
          font-weight: 600;
        }
        .foundation-signoff {
          margin-top: 28px;
          text-align: center;
          color: rgba(233, 244, 243, 0.8);
          letter-spacing: 0.18em;
          font-size: 0.84rem;
          font-weight: 700;
          text-transform: uppercase;
        }
        .about-wrap {
          padding: 28px 0 60px 0;
          max-width: 780px;
          margin: 0 auto;
        }
        .about-hero {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding-bottom: 30px;
          border-bottom: 1px solid var(--line-100);
          margin-bottom: 30px;
        }
        .about-hero h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 700;
          color: var(--ink-900);
          line-height: 1.25;
        }
        .about-dek {
          margin: 0;
          font-size: 14.5px;
          line-height: 1.6;
          color: var(--ink-600);
          max-width: 640px;
        }
        .about-body {
          display: flex;
          flex-direction: column;
          gap: 38px;
        }
        .about-section h2 {
          margin: 0 0 12px 0;
          font-size: 18px;
          font-weight: 700;
          color: var(--ink-900);
        }
        .about-section h3 {
          margin: 18px 0 8px 0;
          font-size: 13px;
          font-weight: 700;
          color: var(--ink-700);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .about-section p {
          margin: 0 0 14px 0;
          font-size: 14.5px;
          line-height: 1.7;
          color: var(--ink-800);
          text-align: justify;
          hyphens: auto;
        }
        .about-section p:last-child {
          margin-bottom: 0;
        }
        .about-section a {
          font-weight: 600;
        }
        .about-list {
          margin: 0 0 14px 0;
          padding-left: 20px;
          font-size: 14.5px;
          line-height: 1.7;
          color: var(--ink-800);
        }
        .about-list li + li {
          margin-top: 6px;
        }
        .about-note {
          margin-top: 4px;
        }
        .about-note p {
          margin: 0;
        }

        /* ---- search funnel ---- */
        .funnel-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 28px;
          margin: 22px 0 18px 0;
        }
        .funnel-col {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
        }
        .funnel-col-label {
          font-size: 11px;
          font-weight: 700;
          color: var(--ink-500);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          text-align: center;
          margin-bottom: 6px;
        }
        .funnel-box {
          width: 100%;
          border: 1.5px solid var(--line-200);
          border-radius: 10px;
          background: var(--surface);
          padding: 10px 14px;
          text-align: center;
        }
        .funnel-box-open {
          border-style: dashed;
          border-color: var(--accent-border);
          background: var(--accent-bg);
        }
        .funnel-box-title {
          font-size: 12px;
          font-weight: 600;
          color: var(--ink-800);
          line-height: 1.4;
        }
        .funnel-box-value {
          margin-top: 4px;
          font-size: 12.5px;
          font-weight: 700;
          color: var(--ink-900);
          font-variant-numeric: tabular-nums;
        }
        .funnel-badge {
          margin-top: 6px;
        }
        .funnel-badge-inline {
          padding: 2px 8px;
          font-size: 10.5px;
        }
        .funnel-arrow {
          flex-shrink: 0;
        }
        .funnel-subnote {
          font-size: 11.5px;
          color: var(--ink-500);
          text-align: center;
          line-height: 1.5;
          padding: 0 4px;
        }
        .funnel-final-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          margin-bottom: 8px;
        }
        .funnel-final-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 28px;
          width: 100%;
        }
        .funnel-caveat {
          font-size: 12.5px !important;
          color: var(--ink-500) !important;
          line-height: 1.6 !important;
          border-top: 1px solid var(--line-100);
          padding-top: 14px;
          margin-top: 4px !important;
        }

        /* ---- pipeline stats ---- */
        .stat-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin: 4px 0 16px 0;
        }
        .stat-tile {
          border: 1px solid var(--line-200);
          border-radius: 12px;
          background: var(--surface);
          padding: 16px 14px;
          text-align: center;
        }
        .stat-value {
          font-size: 26px;
          font-weight: 800;
          color: var(--ink-900);
          font-variant-numeric: tabular-nums;
        }
        .stat-label {
          margin-top: 4px;
          font-size: 11.5px;
          font-weight: 600;
          color: var(--ink-500);
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
        .about-lastchecked {
          font-size: 13px !important;
          color: var(--ink-600) !important;
        }
        .about-lastchecked b {
          color: var(--ink-900);
        }
        .about-search-cadence-note {
          font-size: 12px !important;
          color: var(--ink-500) !important;
          max-width: 640px;
        }

        @media (max-width: 700px) {
          .funnel-grid,
          .funnel-final-row {
            grid-template-columns: 1fr;
          }
          .stat-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
    </section>
  );
}

export default function AboutPage() {
  return <LegacyAboutPage />;
}
