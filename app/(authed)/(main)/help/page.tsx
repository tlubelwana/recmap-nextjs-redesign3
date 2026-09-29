"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { VIDEO_WALKTHROUGH_URL } from "@/lib/config";

const HELP_SECTIONS = [
  { id: "video", label: "Video walkthrough", keywords: "video walkthrough tutorial narrated walkthrough demo" },
  { id: "accounts", label: "Accounts & sign-in", keywords: "accounts sign in login email password reset signup account access" },
  { id: "audience", label: "Audiences & the six lenses", keywords: "audience lens lenses point of care clinician lived experience policy researcher guideline developer industry" },
  { id: "ask", label: "Using Ask", keywords: "ask question questions answer answers plain-language guidelines disagreement" },
  { id: "scores", label: "Reading AGREE II, AGREE-REX, and GRADE", keywords: "agree ii agree-rex grade certainty appraisal score scores interpretation" },
  { id: "map", label: "Using the Map", keywords: "map comparison chart recommendations direction disagreement evidence" },
  { id: "catalog", label: "Using the Catalog", keywords: "catalog guideline guidelines reference list recommendations evidence scores" },
  { id: "history", label: "History & feedback", keywords: "history feedback saved questions revisit answers thumbs up thumbs down" },
  { id: "charts", label: "Charts", keywords: "charts histograms summary plots aggree distribution recommendation counts" },
  { id: "upload", label: "Uploading a guideline", keywords: "upload uploading guideline files admin workflow" },
  { id: "scope", label: "Scope & human-verification checkpoints", keywords: "scope human verification checkpoints outside scope needs human review medical advice" },
  { id: "understandability", label: "Why RecMap is built this way", keywords: "why recmap is built this way usability honeycomb useful usable desirable findable accessible credible valuable" },
];

export default function HelpPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");

  const searchQuery = searchTerm.trim().toLowerCase();
  const visibleSectionIds = useMemo(() => {
    if (!searchQuery) return HELP_SECTIONS.map((section) => section.id);
    const terms = searchQuery.split(/\s+/).filter(Boolean);
    return HELP_SECTIONS.filter((section) => {
      const haystack = `${section.label} ${section.keywords}`.toLowerCase();
      return terms.every((term) => haystack.includes(term));
    }).map((section) => section.id);
  }, [searchQuery]);

  function goBack() {
    if (window.history.length > 1 && document.referrer.startsWith(window.location.origin)) {
      router.back();
      return;
    }
    router.push("/ask");
  }

  return (
    <section className="help-wrap">
      <header className="help-hero">
        <button type="button" className="btn-primary help-back" onClick={goBack}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#ffffff"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M19 12H5" />
            <path d="m11 18-6-6 6-6" />
          </svg>
          Back
        </button>
        <span className="eyebrow">Instructions</span>
        <h1>How to use RecMap</h1>
        <p className="help-dek">
          A full walkthrough of every tab, how appraisal scores work, and — just as important — what RecMap
          can&rsquo;t reliably tell you.
        </p>
      </header>

      <div className="help-search-wrap">
        <label className="search-sm help-search" htmlFor="help-search-input">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            id="help-search-input"
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search help…"
            autoComplete="off"
          />
        </label>
      </div>

      <nav className="help-toc" aria-label="Sections">
        {HELP_SECTIONS.filter((section) => !searchQuery || visibleSectionIds.includes(section.id)).map((section) => (
          <a key={section.id} href={`#${section.id}`}>
            {section.label}
          </a>
        ))}
      </nav>

      {searchQuery && visibleSectionIds.length === 0 && (
        <div className="help-empty-state">
          <p>No help matches for “{searchTerm}”. Try “ask”, “account”, “grade”, or “upload”.</p>
        </div>
      )}

      <div className="help-body">
        {(!searchQuery || visibleSectionIds.includes("video")) && (
        <section className="help-section" id="video">
          <h2>1. Video walkthrough</h2>
          {VIDEO_WALKTHROUGH_URL ? (
            <p>
              <a href={VIDEO_WALKTHROUGH_URL} target="_blank" rel="noreferrer">
                Watch the narrated walkthrough →
              </a>
            </p>
          ) : (
            <p>
              A narrated video walkthrough is in production and will be linked here once it&rsquo;s ready. In the
              meantime, this page covers everything the video will — every tab, every score, and what to do if
              you&rsquo;re not sure whether to trust an answer.
            </p>
          )}
        </section>
        )}

        {(!searchQuery || visibleSectionIds.includes("accounts")) && (
        <section className="help-section" id="accounts">
          <h2>2. Accounts &amp; sign-in</h2>
          <p>
            RecMap accounts use an email address and a password you choose — there is no third-party sign-in.
            Create one from the <Link href="/signup">sign-up page</Link>; your history and audience preference are
            then tied to that account and follow you across sessions.
          </p>
          <p>
            <b>There is currently no email-based password reset.</b> RecMap doesn&rsquo;t send email (there&rsquo;s
            no mail service wired up), so if you forget your password today the only fix is creating a new account.
            If you need this changed, the fix is to connect a real transactional-email provider (e.g. an API key for
            a service like Postmark or Resend) — that&rsquo;s the one piece of the accounts system that genuinely
            needs an external service, since RecMap can&rsquo;t send email on its own.
          </p>
          <p>Your password is never stored in plain text — only a salted, one-way hash of it is kept.</p>
        </section>
        )}

        {(!searchQuery || visibleSectionIds.includes("audience")) && (
        <section className="help-section" id="audience">
          <h2>3. Choosing your audience &mdash; and the six lenses</h2>
          <p>
            The first time you sign in, RecMap asks you to rate how closely you match six audiences on a 1-5 scale.
            Whichever you rate highest becomes your <b>saved audience</b>. Every page then carries a lens bar at the
            top: it names the audience the page is currently written for, states the question that audience is asking,
            and lets you read the same record through any of the other five without changing your account. The dot
            marks your own. &ldquo;Reset to my audience&rdquo; puts it back.
          </p>
          <p>
            A lens is not a theme. Switching it changes <b>which sections appear and in what order</b>, the headings
            they appear under, the framing sentence above each recommendation, the summary figures on every catalog
            card, how the Map arranges itself, the standing caveat, and how <Link href="/ask">Ask</Link> writes its
            answers. What it never changes is the data underneath: a lens reorders, renames, translates and hides,
            but no lens invents a fact, and no lens softens one.
          </p>
          <table className="help-table">
            <thead>
              <tr>
                <th>Lens</th>
                <th>The question it asks</th>
                <th>What it puts first</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Point-of-care clinician</td>
                <td>What do I do for the patient in front of me?</td>
                <td>The recommendation, its direction and strength, then GRADE certainty.</td>
              </tr>
              <tr>
                <td>Person with lived experience</td>
                <td>What does this mean for my life &mdash; and how much of it is my call?</td>
                <td>
                  A plain-language rendering: what it is, how much is your call, how sure they are, who was studied,
                  whether patients were asked, and questions to take to your own clinician.
                </td>
              </tr>
              <tr>
                <td>Policy / health-system</td>
                <td>What will it cost, will it work here, can I measure it, and can I defend it?</td>
                <td>
                  A decision brief built from AGREE&nbsp;II items 18&ndash;21 (barriers, tools, resource implications,
                  monitoring criteria), AGREE-REX Implementability, equity, and editorial independence.
                </td>
              </tr>
              <tr>
                <td>Researcher</td>
                <td>Where is the evidence thin, and where do guidelines disagree?</td>
                <td>
                  Statement type, grading approach, certainty, currency, strength&ndash;certainty discordance,
                  appraiser agreement, and other guidelines taking a different direction.
                </td>
              </tr>
              <tr>
                <td>Guideline developer</td>
                <td>How was this built, and does it hold up?</td>
                <td>The AGREE&nbsp;II domain and item breakdown first, then AGREE-REX, then the recommendation.</td>
              </tr>
              <tr>
                <td>Industry (pharma / device)</td>
                <td>Where is the standard of care moving, and what evidence would move it?</td>
                <td>
                  The current position and how stable it is, the comparator and outcomes new evidence would have to
                  address, currency, and divergence between organisations.
                </td>
              </tr>
            </tbody>
          </table>
          <h3>What the plain-language lens will and won&rsquo;t do</h3>
          <p>
            The lived-experience view is generated from the same fields as every other view, by fixed rules in{" "}
            <code>lib/plainLanguage.ts</code> &mdash; no sentence is written by a model at the moment you read it.
            It never uses the word &ldquo;weak&rdquo; for a weak/conditional recommendation, because the word tests
            badly with readers and is not what GRADE means; it renders that as &ldquo;the majority of people in this
            situation would want this, but many would not&rdquo;. It never turns a conditional recommendation into an
            instruction, never drops the uncertainty to read more cleanly, and always keeps the guideline&rsquo;s own
            wording one click away. Where a guideline did not seek patients&rsquo; views, it says so &mdash; silence
            there would read as a yes.
          </p>
          <h3>A deliberate limit on the industry lens</h3>
          <p>
            The industry view is an evidence-gap and standard-of-care tracking surface. It holds no person-level data
            at all: RecMap does not list guideline authors or panellists, does not link individuals to disclosures,
            funding, trial sites or contact details, and does not score any organisation on how easily its
            recommendations could be changed. Conflict of interest appears only as AGREE&nbsp;II Domain 6, at the
            level of the guideline document. Gaps that argue against a technology are shown exactly as prominently as
            gaps that favour one.
          </p>
        </section>
        )}

        {(!searchQuery || visibleSectionIds.includes("ask")) && (
        <section className="help-section" id="ask">
          <h2>4. Using Ask</h2>
          <p>
            Type a plain-language question about an AI-based recommendation — e.g. &ldquo;Should I use AI for
            colorectal cancer screening?&rdquo; — and RecMap answers using only the guidelines in its catalog, never
            from general knowledge about a specific guideline it wasn&rsquo;t given. Every answer that draws on a
            specific guideline names both the organisation and the guideline title, with a source card underneath so
            you can see exactly where a claim came from and open the full record.
          </p>
          <p>
            If the cited guidelines actually disagree with each other, Ask breaks down why — differing evidence
            cutoffs, differing values placed on benefits vs. harms, population differences, and so on — rather than
            just noting a disagreement in passing.
          </p>
        </section>
        )}

        {(!searchQuery || visibleSectionIds.includes("scores")) && (
        <section className="help-section" id="scores">
          <h2>5. Reading AGREE II, AGREE-REX, and GRADE</h2>
          <p>
            RecMap uses three different instruments, and they measure different things — mixing them up is the most
            common way to misread a guideline&rsquo;s trustworthiness:
          </p>
          <table className="help-table">
            <thead>
              <tr>
                <th>Instrument</th>
                <th>What it measures</th>
                <th>Where to see it</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><b>AGREE II</b></td>
                <td>How rigorously the whole guideline was developed (process, not evidence quality).</td>
                <td>Catalog card, Map, guideline detail</td>
              </tr>
              <tr>
                <td><b>GRADE certainty</b></td>
                <td>How much confidence to place in the underlying body of evidence itself.</td>
                <td>Guideline detail, Ask answers</td>
              </tr>
              <tr>
                <td><b>AGREE-REX</b></td>
                <td>
                  How trustworthy one specific recommendation is to apply — its applicability, alignment with
                  patient/clinician values, and real-world implementability.
                </td>
                <td>Guideline detail (when eligible), Map</td>
              </tr>
            </tbody>
          </table>
          <p>
            <b>AGREE-REX is always an AI-generated first-pass appraisal</b> — two independent automated appraisal
            passes over the guideline text, with any item where the two passes differed by 2 or more points flagged
            for human review. It is not a substitute for trained human appraisers, and every score should be checked
            against the source guideline before being used for a real decision. RecMap only runs AGREE-REX on
            recommendations whose parent guideline already cleared an AGREE II quality threshold — a recommendation
            that doesn&rsquo;t clear that gate shows as &ldquo;not eligible,&rdquo; not as a missing or zero score.
          </p>
          <p>
            When you ask Ask specifically about an AGREE score, it gives you a short plain-language read on what the
            number means, then points you to the Map for the full domain-by-domain breakdown rather than trying to
            reproduce every number in prose.
          </p>
        </section>
        )}

        {(!searchQuery || visibleSectionIds.includes("map")) && (
        <section className="help-section" id="map">
          <h2>6. Using the Map</h2>
          <p>
            The Map is a visual, filterable comparison of every recommendation in the catalog — direction (for /
            against / neutral), AGREE II score, and AGREE-REX score where available, plotted so you can see at a
            glance where guidelines agree and where they diverge. Arriving from an Ask answer pre-filters the Map to
            the guidelines that answer cited.
          </p>
        </section>
        )}

        {(!searchQuery || visibleSectionIds.includes("catalog")) && (
        <section className="help-section" id="catalog">
          <h2>7. Using the Catalog</h2>
          <p>
            The Catalog is the full reference list, one card per source guideline document, expandable to every
            individual recommendation statement extracted from it, with AGREE II, GRADE, equity, and coding detail
            for each.
          </p>
        </section>
        )}

        {(!searchQuery || visibleSectionIds.includes("history")) && (
        <section className="help-section" id="history">
          <h2>8. History &amp; feedback</h2>
          <p>
            Every question you ask in Ask is saved to your <Link href="/history">History</Link> tab, most recent
            first, so you can track what you&rsquo;ve already asked and revisit an answer without re-typing the
            question. Each answer has a thumbs up / thumbs down — this durably records which answers users judged
            good or bad, which is the real, honest scope of &ldquo;learning from feedback&rdquo; here: RecMap
            doesn&rsquo;t retrain a model on your feedback today (that would need a training pipeline this app
            doesn&rsquo;t have), but every rating is stored against the exact question and answer it was given for,
            so that signal exists to act on rather than being discarded.
          </p>
        </section>
        )}

        {(!searchQuery || visibleSectionIds.includes("charts")) && (
        <section className="help-section" id="charts">
          <h2>9. Charts</h2>
          <p>
            The Charts tab lets you generate histograms and simple summary plots straight from the catalog data —
            AGREE II score distribution, recommendation direction counts, guidelines per organisation, and more —
            without needing a separate spreadsheet tool.
          </p>
        </section>
        )}

        {(!searchQuery || visibleSectionIds.includes("upload")) && (
        <section className="help-section" id="upload">
          <h2>10. Uploading a guideline</h2>
          <p>
            Guideline uploads are disabled in the standard user experience. RecMap uses a curated catalog so new
            material can be checked, appraised, and transparently labelled before it becomes part of the evidence
            map. An administrator can enable a controlled upload workflow for a specific deployment with
            <code>NEXT_PUBLIC_UPLOAD_FEATURE_ENABLED=true</code>; uploaded appraisals must still be treated as
            estimates until human verification is complete.
          </p>
        </section>
        )}

        {(!searchQuery || visibleSectionIds.includes("scope")) && (
        <section className="help-section" id="scope">
          <h2>11. Scope &amp; human-verification checkpoints</h2>
          <p>
            RecMap&rsquo;s scope is deliberately narrow: AI-related recommendations in clinical practice guidelines,
            and how to interpret their appraisal. It is not a general medical-advice tool, and it will say so rather
            than stretch an answer to sound helpful. Two signals tell you when to be more careful with an answer:
          </p>
          <ul>
            <li>
              <b>&ldquo;Outside RecMap&rsquo;s scope&rdquo;</b> — the question fell outside what the catalog can
              ground an answer in; RecMap explains why rather than guessing.
            </li>
            <li>
              <b>&ldquo;Needs human review&rdquo;</b> — the answer required interpretation or extrapolation (e.g.
              reconciling two AGREE-REX appraisers, judging real-world implementability) that a person should
              double-check before it&rsquo;s used for an actual decision. Think of this as the built-in
              quality-checkpoint: it&rsquo;s the mechanism that keeps RecMap from silently drifting into answering
              things it can&rsquo;t actually support, and it&rsquo;s exactly where a human appraiser, clinician, or
              guideline methodologist should look first.
            </li>
          </ul>
          <p>
            If RecMap genuinely doesn&rsquo;t have the data to answer something, it says so plainly instead of
            guessing — &ldquo;RecMap doesn&rsquo;t have data on this&rdquo; is a correct, honest answer, not a
            failure.
          </p>
        </section>
        )}

        {(!searchQuery || visibleSectionIds.includes("understandability")) && (
        <section className="help-section" id="understandability">
          <h2>12. Why RecMap is built this way</h2>
          <p>
            Getting an AI-related recommendation right isn&rsquo;t only about the score being accurate — it&rsquo;s
            about whether a real user can find it, understand it, and actually act on it. That&rsquo;s the same
            territory Peter Morville&rsquo;s <i>User Experience Honeycomb</i> maps out for usability more broadly:
            an answer needs to be <b>useful</b>, <b>usable</b>, <b>desirable</b>, <b>findable</b>,{" "}
            <b>accessible</b>, <b>credible</b>, and <b>valuable</b> all at once, not just correct in isolation.
            RecMap&rsquo;s design choices map onto those facets directly: recommendation text is kept short and
            plain-language rather than reproduced verbatim from dense guideline PDFs (usable, accessible); every
            claim is traceable to its source organisation and guideline (findable, credible); scores are shown with
            their real caveats rather than as bare numbers (credible); and the persona-tailored framing exists so the
            same underlying evidence is <i>valuable</i> to a point-of-care clinician and a policy-maker without
            either having to dig through content meant for the other. That&rsquo;s also why implementability — one
            of AGREE-REX&rsquo;s three domains — gets its own explicit caveat rather than being folded silently into
            an overall number: a recommendation can be clinically sound and still fail in practice if it&rsquo;s not
            implementable, exactly the gap usability testing exists to catch.
          </p>
        </section>
        )}
      </div>

      <style jsx global>{`
        .help-wrap {
          padding: 28px 0 60px 0;
          max-width: 780px;
          margin: 0 auto;
        }
        .help-hero {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding-bottom: 24px;
          border-bottom: 1px solid var(--line-100);
          margin-bottom: 20px;
        }
        .help-back {
          align-self: flex-start;
          margin-bottom: 2px;
        }
        .help-hero h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 700;
          color: var(--ink-900);
          line-height: 1.25;
        }
        .help-dek {
          margin: 0;
          font-size: 14.5px;
          line-height: 1.6;
          color: var(--ink-600);
          max-width: 640px;
        }
        .help-search-wrap {
          margin-bottom: 16px;
        }
        .help-search {
          width: 100%;
          max-width: 520px;
        }
        .help-search input {
          width: 100%;
          border: none;
          background: transparent;
          color: var(--ink-800);
          font-size: 14px;
          outline: none;
        }
        .help-empty-state {
          margin: 0 0 18px 0;
          padding: 14px 16px;
          border: 1px solid var(--line-200);
          border-radius: 10px;
          background: var(--bg-alt);
          color: var(--ink-700);
        }
        .help-empty-state p {
          margin: 0;
          font-size: 14px;
          line-height: 1.6;
        }
        .help-toc {
          display: flex;
          flex-wrap: wrap;
          gap: 8px 14px;
          padding: 14px 16px;
          background: var(--bg-alt);
          border: 1px solid var(--line-200);
          border-radius: 10px;
          margin-bottom: 30px;
        }
        .help-toc a {
          font-size: 12.5px;
          font-weight: 600;
          color: var(--favour);
        }
        .help-body {
          display: flex;
          flex-direction: column;
          gap: 30px;
        }
        .help-section h2 {
          font-size: 17px;
          font-weight: 700;
          color: var(--ink-900);
          margin: 0 0 10px 0;
        }
        .help-section p {
          font-size: 14px;
          line-height: 1.65;
          color: var(--ink-700);
          margin: 0 0 10px 0;
          text-align: justify;
          hyphens: auto;
        }
        .help-section ul {
          margin: 0 0 10px 0;
          padding-left: 20px;
        }
        .help-section li {
          font-size: 14px;
          line-height: 1.65;
          color: var(--ink-700);
          margin-bottom: 8px;
        }
        .help-table {
          width: 100%;
          border-collapse: collapse;
          margin: 4px 0 16px 0;
          font-size: 13px;
        }
        .help-table th,
        .help-table td {
          border: 1px solid var(--line-200);
          padding: 8px 10px;
          text-align: left;
          vertical-align: top;
        }
        .help-table th {
          background: var(--bg-alt);
          font-weight: 700;
          color: var(--ink-800);
        }
        .help-table td {
          color: var(--ink-700);
        }
        @media (max-width: 700px) {
          .help-wrap {
            padding: 20px 16px 48px;
          }
        }
      `}</style>
    </section>
  );
}
