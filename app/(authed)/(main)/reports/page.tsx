"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import AudienceLensBar from "@/components/AudienceLensBar";
import DivergencePanel from "@/components/DivergencePanel";
import Markdown from "@/components/Markdown";
import { useQuestionScope, type HistoryOption } from "@/components/QuestionScope";
import { directionLabel, directionVisual, formatDate, orgInitials, uniqueSorted } from "@/components/format";
import { useAudienceLens } from "@/components/LensProvider";
import { currency, findAgreeItem, itemVerdict, AGREE_ITEM_RESOURCE } from "@/lib/audienceLens";
import {
  assessTransfer,
  readImplementation,
  TRANSFER_RUNG_META,
  type TransferRung,
} from "@/lib/transferability";
import { AGREE_GATE_THRESHOLD_PCT, passesAgreeGate } from "@/lib/config";
import type { ChatResponseBody, DivergenceAnalysis, Guideline } from "@/lib/types";

/**
 * Reports — a short, printable brief for one question.
 *
 * Two halves, deliberately separated in the UI so a reader always knows
 * which is which:
 *
 *  1. A written summary from the existing /api/chat endpoint (no new
 *     backend route — the same grounded, lens-aware call the Ask page
 *     makes), carrying the same "needs human review" and scope flags.
 *  2. Four sections computed here from the catalog records the answer
 *     cited: what the guidelines say, how much to trust them, where they
 *     disagree, and what is missing. These are arithmetic over data
 *     already on file — no interpretation, no model involved — so every
 *     figure is traceable to a record.
 *
 * Nothing here fabricates a finding. Where the catalog has no answer (no
 * equity assessment, no AGREE-REX appraisal, no coverage for a
 * population), the report says so rather than omitting the row.
 */

interface ReportState {
  query: string;
  answerMarkdown: string;
  guidelineIds: string[];
  divergence?: DivergenceAnalysis;
  inScope: boolean;
  needsHumanReview: boolean;
  generatedAt: string;
}

function ReportsInner() {
  const { lens, isOverridden } = useAudienceLens();
  const [catalog, setCatalog] = useState<Guideline[] | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const { scope, setScope, history, historyError } = useQuestionScope();
  const [selectedId, setSelectedId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ReportState | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [myRegion, setMyRegion] = useState("");
  const lensKeyRef = useRef(lens.key);
  lensKeyRef.current = lens.key;

  useEffect(() => {
    let cancelled = false;
    fetch("/api/guidelines")
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        return res.json() as Promise<{ guidelines: Guideline[] }>;
      })
      .then((data) => {
        if (!cancelled) setCatalog(data.guidelines);
      })
      .catch((err: unknown) => {
        if (!cancelled) setCatalogError(err instanceof Error ? err.message : "Failed to load the catalog.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const byId = useMemo(() => {
    const m = new Map<string, Guideline>();
    (catalog ?? []).forEach((g) => m.set(g.id, g));
    return m;
  }, [catalog]);

  /** The records the answer actually cited — the report's evidence base. */
  const cited = useMemo(() => {
    if (!report) return [];
    return report.guidelineIds.map((id) => byId.get(id)).filter((g): g is Guideline => Boolean(g));
  }, [report, byId]);

  /**
   * Build the report from an interaction that already happened.
   *
   * The question was asked on Ask, so there is no reason to ask it again:
   * History already holds the answer text, the cited records and the
   * scope/review flags for every question this user has put to RecMap.
   * Re-running the model would spend a call and — because generation isn't
   * deterministic — could produce a summary that no longer matches what
   * the clinician actually read.
   *
   * The one case that does need a call is a deep link whose question isn't
   * in this user's history (a shared URL, say). That falls through to
   * /api/chat, the same grounded call Ask makes.
   */
  function reportFromHistory(entry: HistoryOption & Partial<ChatResponseBody>) {
    setError(null);
    setReport({
      query: entry.query,
      answerMarkdown: entry.answerMarkdown ?? "",
      guidelineIds: entry.guidelineIds ?? [],
      divergence: entry.divergence,
      inScope: entry.inScope !== false,
      needsHumanReview: Boolean(entry.needsHumanReview),
      generatedAt: new Date().toISOString(),
    });
  }

  async function generate() {
    if (pending) return;
    const entry = history.find((h) => h.id === selectedId);
    if (entry) {
      reportFromHistory(entry as HistoryOption & Partial<ChatResponseBody>);
      return;
    }
    // Deep-linked question with no stored answer — ask once, then report.
    const q = (scope.query ?? "").trim();
    if (!q) return;
    setPending(true);
    setError(null);
    setReport(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, history: [], lens: lensKeyRef.current }),
      });
      const data = (await res.json()) as ChatResponseBody & { error?: string };
      if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
      setReport({
        query: q,
        answerMarkdown: data.answerMarkdown ?? "",
        guidelineIds: data.guidelineIds ?? [],
        divergence: data.divergence,
        inScope: data.inScope !== false,
        needsHumanReview: Boolean(data.needsHumanReview),
        generatedAt: new Date().toISOString(),
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't generate the report.");
    } finally {
      setPending(false);
    }
  }

  /** A deep link (from Ask, Map, Contextualise or Implement) selects its
   *  question as soon as history loads, so the button is ready to press. */
  useEffect(() => {
    if (selectedId || !scope.query || history.length === 0) return;
    const match = history.find((h) => h.query === scope.query);
    if (match) setSelectedId(match.id);
  }, [scope.query, history, selectedId]);

  // --- Section 1: what the guidelines say -------------------------------
  const directionCounts = useMemo(() => {
    const c = { for: 0, against: 0, neutral: 0 };
    cited.forEach((g) => {
      c[directionVisual(g.direction)] += 1;
    });
    return c;
  }, [cited]);

  // --- Section 2: how much to trust it ----------------------------------
  const trust = useMemo(() => {
    if (cited.length === 0) return null;
    const agreeMean = cited.reduce((s, g) => s + g.agree.overall7, 0) / cited.length;
    const clearedGate = cited.filter((g) => passesAgreeGate(g.agree.overall7)).length;
    const aiAppraised = cited.filter((g) => g.uploaded?.agreeScoresEstimated).length;
    const rexAppraised = cited.filter((g) => g.agreeRex.status === "appraised").length;
    const certainty = new Map<string, number>();
    cited.forEach((g) => certainty.set(g.gradeCertaintyLabel, (certainty.get(g.gradeCertaintyLabel) ?? 0) + 1));
    const ungraded = cited.filter((g) => g.gradingApproach !== "GRADE").length;
    return {
      agreeMean,
      agreePct: Math.round((agreeMean / 7) * 100),
      clearedGate,
      aiAppraised,
      rexAppraised,
      ungraded,
      certainty: Array.from(certainty.entries()).sort((a, b) => b[1] - a[1]),
    };
  }, [cited]);

  // --- Section: the landscape the Map view shows -------------------------
  const landscape = useMemo(() => {
    if (cited.length === 0) return null;
    return {
      areas: uniqueSorted(cited.map((g) => g.clinicalArea)),
      regions: uniqueSorted(cited.map((g) => g.worldRegion)),
      orgs: uniqueSorted(cited.map((g) => g.organization)),
      years: cited.map((g) => g.year).sort((a, b) => a - b),
      types: uniqueSorted(cited.map((g) => g.recommendationTypeLabel)),
    };
  }, [cited]);

  const regionOptions = useMemo(
    () =>
      uniqueSorted((catalog ?? []).map((g) => g.worldRegion)).filter((r) => r !== "Global / multinational"),
    [catalog]
  );

  // --- Section: does it transfer (the Contextualise workflow) -----------
  const transfer = useMemo(() => {
    if (cited.length === 0) return null;
    const rows = cited.map((g) => ({ guideline: g, ...assessTransfer(g, myRegion) }));
    const counts: Record<TransferRung, number> = { adopt: 0, adapt: 0, adapt_caution: 0 };
    rows.forEach((r) => {
      counts[r.rung] += 1;
    });
    return { rows: rows.sort((a, b) => a.failures - b.failures), counts };
  }, [cited, myRegion]);

  // --- Section: what implementing it takes (the Implement workflow) -----
  const implementation = useMemo(() => {
    if (cited.length === 0) return null;
    const reads = cited.map((g) => ({ guideline: g, ...readImplementation(g) }));
    const perItem = ["barriers", "tools", "resources", "monitoring"].map((key) => {
      const scores = reads
        .map((r) => r.items.find((i) => i.key === key)?.item?.score)
        .filter((v): v is number => typeof v === "number");
      const mean = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      return {
        key,
        label: reads[0].items.find((i) => i.key === key)?.label ?? key,
        mean,
        wellAddressed: scores.filter((v) => v > 5).length,
        n: scores.length,
      };
    });
    const withRex = reads.filter((r) => r.implementability !== null);
    const implMean =
      withRex.length > 0
        ? withRex.reduce((sum, r) => sum + (r.implementability ?? 0), 0) / withRex.length
        : null;
    return { reads, perItem, implMean, withRexCount: withRex.length };
  }, [cited]);

  // --- Section 4: what's missing ----------------------------------------
  const gaps = useMemo(() => {
    if (cited.length === 0) return null;
    const equityUnassessed = cited.filter((g) => !g.equity.evaluated).length;
    const overdue = cited.filter((g) => currency(g).tone === "overdue");
    const ageing = cited.filter((g) => currency(g).tone === "ageing");
    const noCost = cited.filter((g) => {
      const item = findAgreeItem(g.agree, AGREE_ITEM_RESOURCE);
      return itemVerdict(item?.score).tone === "absent";
    }).length;
    const notEligible = cited.filter((g) => g.agreeRex.status === "not_eligible").length;
    const uncoded = cited.filter((g) => !g.coding.icd11 && !g.coding.snomedCt).length;
    return { equityUnassessed, overdue, ageing, noCost, notEligible, uncoded };
  }, [cited]);

  function downloadBlob(content: string, type: string, filename: string) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function slug(text: string): string {
    return (
      text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || "report"
    );
  }

  /**
   * The whole report as Markdown — the format that actually survives being
   * pasted into a manuscript, an email or a wiki. Rebuilt from state
   * rather than scraped from the DOM, so it carries the real numbers and
   * every caveat rather than whatever happened to be on screen.
   */
  function exportReportMarkdown() {
    if (!report) return;
    const L: string[] = [];
    L.push(`# ${report.query}`);
    L.push("");
    L.push(
      `*RecMap report · generated ${formatDate(report.generatedAt)} · written for ${lens.label} · ${cited.length} guideline${cited.length === 1 ? "" : "s"} cited${catalog ? ` of ${catalog.length} in the catalog` : ""}.*`
    );
    L.push("");
    if (!report.inScope) {
      L.push("> **Outside RecMap's scope.** This question isn't something the catalog can answer reliably.");
      L.push("");
    }
    if (report.needsHumanReview) {
      L.push(
        "> **Needs human review.** This summary required interpretation beyond raw catalog facts. Have a person check it before it informs a decision."
      );
      L.push("");
    }

    L.push("## Summary");
    L.push("");
    L.push(report.answerMarkdown.trim());
    L.push("");
    L.push(
      "*Written by RecMap's assistant from the cited records only. Everything below is arithmetic over the catalog — no model involved.*"
    );
    L.push("");

    if (cited.length > 0) {
      L.push("## 1 · What the guidelines say");
      L.push("");
      const dirLine = (["for", "against", "neutral"] as const)
        .filter((d) => directionCounts[d] > 0)
        .map(
          (d) =>
            `${directionCounts[d]} ${d === "for" ? "in favour" : d === "against" ? "against" : "neutral / no recommendation"}`
        )
        .join(" · ");
      L.push(dirLine);
      L.push("");
      for (const g of cited) {
        L.push(`### ${g.organization} (${g.year}) — ${g.clinicalArea}`);
        L.push("");
        L.push(`> ${g.recommendationText}`);
        L.push("");
        L.push(
          `- Direction: ${directionLabel(g)}\n- Type: ${g.recommendationTypeLabel}\n- Strength: ${g.strength}\n- GRADE certainty: ${g.gradeCertaintyLabel}\n- AGREE II: ${g.agree.overall7.toFixed(2)}/7 (${Math.round((g.agree.overall7 / 7) * 100)}%)\n- Guideline: ${g.guidelineTitle}`
        );
        L.push("");
      }

      if (landscape) {
        L.push("## 2 · The landscape");
        L.push("");
        L.push(
          `${landscape.orgs.length} organisation(s) across ${landscape.regions.length} world region(s), covering ${landscape.areas.length} clinical area(s), published ${landscape.years[0] === landscape.years[landscape.years.length - 1] ? `in ${landscape.years[0]}` : `between ${landscape.years[0]} and ${landscape.years[landscape.years.length - 1]}`}.`
        );
        L.push("");
        L.push(`- Clinical areas: ${landscape.areas.join(", ")}`);
        L.push(`- World regions: ${landscape.regions.join(", ")}`);
        L.push(`- Statement types: ${landscape.types.join(", ")}`);
        L.push("");
        L.push(
          "*A narrow spread is itself a finding: guidance drawn from one region or one organisation tells you less about international consensus than the number of citations suggests.*"
        );
        L.push("");
      }

      if (trust) {
        L.push("## 3 · How much to trust it");
        L.push("");
        L.push(`- Mean AGREE II: ${trust.agreePct}% (${trust.agreeMean.toFixed(1)}/7)`);
        L.push(`- Cleared the ${AGREE_GATE_THRESHOLD_PCT}% quality gate: ${trust.clearedGate} of ${cited.length}`);
        L.push(`- Have an AGREE-REX appraisal: ${trust.rexAppraised} of ${cited.length}`);
        L.push(`- Appraised by the AI pipeline rather than a human reviewer: ${trust.aiAppraised}`);
        L.push(`- Certainty of evidence: ${trust.certainty.map(([l, n]) => `${n} × ${l}`).join(", ")}`);
        if (trust.ungraded > 0) {
          L.push(`- ${trust.ungraded} did not use GRADE, so their certainty cannot be pooled with the rest.`);
        }
        L.push("");
        L.push(
          "*AGREE II measures how rigorously each guideline was developed. It is not a measure of how strong the underlying evidence is — that is what GRADE certainty says, and the two often disagree.*"
        );
        L.push("");
      }

      L.push("## 4 · Where they disagree");
      L.push("");
      if (report.divergence?.hasDivergence && report.divergence.reasons.length > 0) {
        for (const r of report.divergence.reasons) {
          const names = r.guidelineIds
            .map((id) => byId.get(id))
            .filter(Boolean)
            .map((g) => `${g!.organization} ${g!.year}`)
            .join("; ");
          L.push(`**${r.categoryLabel}** — ${r.explanation}`);
          if (names) L.push(`Sources: ${names}`);
          L.push("");
        }
      } else if (directionCounts.for > 0 && directionCounts.against > 0) {
        L.push(
          "The cited guidelines point in different directions, but RecMap could not trace the disagreement to a specific cause in the data. Read the recommendations side by side before concluding they conflict — they may be answering subtly different questions."
        );
        L.push("");
      } else {
        L.push("No material disagreement was found among the cited guidelines on this question.");
        L.push("");
      }

      if (transfer) {
        L.push("## 5 · Does it transfer to your setting?");
        L.push("");
        L.push(
          myRegion
            ? `Assessed against: ${myRegion}.`
            : "No region selected, so the context-fit check passes by default; placement reflects currency, development rigour and values fit only."
        );
        L.push("");
        for (const row of transfer.rows) {
          L.push(
            `### ${row.guideline.organization} (${row.guideline.year}) — ${TRANSFER_RUNG_META[row.rung].label}`
          );
          L.push("");
          for (const sig of row.signals) {
            L.push(`- ${sig.ok ? "PASS" : "CHECK"} — **${sig.label}:** ${sig.detail}`);
          }
          L.push("");
        }
        L.push(
          "*A reading aid built from the catalog's own appraisal data, not a validated contextualisation instrument, and no substitute for a local panel working through ADAPTE or GRADE-ADOLOPMENT properly.*"
        );
        L.push("");
      }

      if (implementation) {
        L.push("## 6 · What implementing it would take");
        L.push("");
        for (const item of implementation.perItem) {
          L.push(`- ${item.label}: mean ${item.mean.toFixed(1)}/7 (${item.wellAddressed} of ${item.n} well addressed)`);
        }
        L.push(
          implementation.implMean !== null
            ? `- AGREE-REX implementability: mean ${implementation.implMean.toFixed(1)}/7 across ${implementation.withRexCount} appraised recommendation(s)`
            : "- AGREE-REX implementability: no cited recommendation has an appraisal, so feasibility is unknown here — not zero"
        );
        L.push(
          `- Equity: ${cited.filter((g) => g.equity.evaluated).length} of ${cited.length} assessed differential impact on any PROGRESS-Plus dimension`
        );
        L.push("");
        L.push(
          "*AGREE II domain 5 is the weakest domain in most published guidelines, so low scores here are the norm rather than an anomaly — and they are exactly the gap an implementation team inherits.*"
        );
        L.push("");
      }

      if (gaps) {
        L.push("## 7 · What's missing");
        L.push("");
        L.push(
          `- ${gaps.equityUnassessed} of ${cited.length} did not assess differential impact on any PROGRESS-Plus dimension.`
        );
        L.push(
          `- ${gaps.noCost} of ${cited.length} barely addressed resource implications (AGREE II item 20).`
        );
        L.push(`- ${gaps.notEligible} of ${cited.length} did not clear the quality gate.`);
        L.push(`- ${gaps.uncoded} of ${cited.length} carry no ICD-11 or SNOMED CT code.`);
        if (gaps.overdue.length > 0) {
          L.push(
            `- ${gaps.overdue.length} likely overdue for review: ${gaps.overdue.map((g) => `${g.organization} ${g.year}`).join(", ")}.`
          );
        }
        if (gaps.ageing.length > 0) {
          L.push(
            `- ${gaps.ageing.length} approaching review age: ${gaps.ageing.map((g) => `${g.organization} ${g.year}`).join(", ")}.`
          );
        }
        L.push("");
        L.push(
          "*A gap here is a statement about what the source guidelines address, not a fault in RecMap's extraction.*"
        );
        L.push("");
      }
    }

    L.push("---");
    L.push("");
    L.push(
      "RecMap report — not a substitute for professional medical advice, and not an independently reviewed appraisal. Verify every cited recommendation against its source before it informs a decision."
    );

    downloadBlob(L.join("\n"), "text/markdown;charset=utf-8", `recmap-report-${slug(report.query)}.md`);
  }

  /** The cited records as CSV, for anyone who wants the numbers in a sheet. */
  function exportReportCsv() {
    if (!report) return;
    const esc = (v: string | number) => {
      const t = String(v);
      return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
    };
    const header = [
      "Organisation",
      "Year",
      "Guideline",
      "Clinical area",
      "Recommendation",
      "Direction",
      "Type",
      "Strength",
      "GRADE certainty",
      "Grading approach",
      "AGREE II (/7)",
      "AGREE II (%)",
      "Cleared quality gate",
      "AGREE-REX status",
      "Equity evaluated",
      "Region",
      "Last checked",
    ];
    const rows = cited.map((g) => [
      g.organization,
      g.year,
      g.guidelineTitle,
      g.clinicalArea,
      g.recommendationText,
      directionLabel(g),
      g.recommendationTypeLabel,
      g.strength,
      g.gradeCertaintyLabel,
      g.gradingApproachLabel,
      g.agree.overall7.toFixed(2),
      Math.round((g.agree.overall7 / 7) * 100),
      passesAgreeGate(g.agree.overall7) ? "yes" : "no",
      g.agreeRex.status,
      g.equity.evaluated ? "yes" : "no",
      g.region,
      g.lastCheckedISO,
    ]);
    const lines = [
      `# RecMap report — cited records`,
      `# Question: ${report.query}`,
      `# Generated ${report.generatedAt} · written for ${lens.label}`,
      `# ${cited.length} of ${catalog?.length ?? 0} catalog records cited`,
      `# AGREE II measures development rigour, not strength of evidence; GRADE certainty is the separate evidence judgement.`,
      header.map(esc).join(","),
      ...rows.map((r) => r.map(esc).join(",")),
    ];
    downloadBlob(lines.join("\n"), "text/csv;charset=utf-8", `recmap-report-${slug(report.query)}.csv`);
  }

  function printReport() {
    window.print();
  }

  return (
    <div className="rep-wrap">
      <AudienceLensBar />

      <header className="rep-head">
        <span className="eyebrow">Reports</span>
        <h1>Build a short report from one question</h1>
        <p className="rep-dek">
          Pick a question you&rsquo;ve already asked and press Generate. The report pulls together the whole
          workflow in one document: the answer from Ask, the landscape the Map shows, how far the appraisals
          support it, where the guidelines disagree, whether they transfer to your setting, what implementing them
          would take, and what none of them covers. Written for <b>{lens.label}</b>
          {isOverridden ? " (previewing)" : ""} — switch audience above to rebuild it for someone else.
        </p>
      </header>

      {/* No question box here on purpose. The question was asked on Ask,
          the answer is already in History, and Map / Contextualise /
          Implement have explored it — this page reports on that
          interaction rather than starting a new one. */}
      <div className="rep-pick">
        <label>
          <span>Report on</span>
          <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
            <option value="">Choose a question you&rsquo;ve asked…</option>
            {history.map((h) => (
              <option key={h.id} value={h.id}>
                {h.query.length > 90 ? `${h.query.slice(0, 88)}…` : h.query}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="btn-primary"
          onClick={generate}
          disabled={pending || (!selectedId && !scope.query)}
        >
          {pending ? "Generating…" : "Generate report"}
        </button>
        {scope.query && !selectedId && (
          <span className="rep-pick-note">
            From your last answer: &ldquo;{scope.query.length > 70 ? `${scope.query.slice(0, 68)}…` : scope.query}
            &rdquo;
          </span>
        )}
      </div>

      {history.length === 0 && !historyError && !scope.query && (
        <div className="state-block">
          <p>
            You haven&rsquo;t asked anything yet. <Link href="/ask">Ask a question</Link> — the report is built from
            that answer, the guidelines it cites, and what Contextualise and Implement say about them.
          </p>
        </div>
      )}

      {catalogError && (
        <div className="state-block error">
          <p>Couldn&rsquo;t load the catalog ({catalogError}). The report can&rsquo;t cite records without it.</p>
        </div>
      )}

      {pending && (
        <div className="state-block">
          <div className="spinner" />
          <p>Reading the catalog and drafting the summary…</p>
        </div>
      )}

      {error && (
        <div className="state-block error">
          <p>{error}</p>
        </div>
      )}

      {!report && !pending && !error && (
        <div className="state-block">
          <p>
            No report yet. Ask a question above — or open one from your{" "}
            <Link href="/history">history</Link>.
          </p>
        </div>
      )}

      {report && (
        <article className="rep-doc">
          <div className="rep-doc-head">
            <div>
              <h2>{report.query}</h2>
              <div className="rep-meta">
                Generated {formatDate(report.generatedAt)} · for {lens.label} · {cited.length} guideline
                {cited.length === 1 ? "" : "s"} cited
                {catalog ? ` of ${catalog.length} in the catalog` : ""}
              </div>
            </div>
            <div className="rep-actions">
              <div className="map-export">
                <button
                  type="button"
                  className="btn-outline rep-print"
                  onClick={() => setExportOpen((v) => !v)}
                  aria-expanded={exportOpen}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 4v10" />
                    <path d="m8 10.5 4 4 4-4" />
                    <path d="M5 17v1.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V17" />
                  </svg>
                  Export
                </button>
                {exportOpen && (
                  <div className="map-export-menu" onMouseLeave={() => setExportOpen(false)}>
                    <button
                      type="button"
                      onClick={() => {
                        exportReportMarkdown();
                        setExportOpen(false);
                      }}
                    >
                      <b>Report (Markdown)</b>
                      <span>The whole report as text, with every caveat, ready to paste</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        exportReportCsv();
                        setExportOpen(false);
                      }}
                      disabled={cited.length === 0}
                    >
                      <b>Cited records (CSV)</b>
                      <span>
                        The {cited.length} cited record{cited.length === 1 ? "" : "s"} with scores, for a spreadsheet
                      </span>
                    </button>
                  </div>
                )}
              </div>
            <button type="button" className="btn-outline rep-print" onClick={printReport}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M7 9V4h10v5" />
                <path d="M7 19H5.5A1.5 1.5 0 0 1 4 17.5V11a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6.5a1.5 1.5 0 0 1-1.5 1.5H17" />
                <path d="M7 15h10v5H7z" />
              </svg>
              Print / PDF
            </button>
            </div>
          </div>

          {!report.inScope && (
            <div className="scope-note">
              <b>Outside RecMap&rsquo;s scope.</b> This question isn&rsquo;t something the catalog can answer
              reliably — the summary below explains why. The data sections are empty because nothing was cited.
            </div>
          )}
          {report.needsHumanReview && (
            <div className="review-note">
              ⚠ This summary required interpretation beyond raw catalog facts. Have a person check it before it
              informs a decision.
            </div>
          )}

          <section className="rep-section">
            <h3>Summary</h3>
            <div className="rep-prose">
              <Markdown text={report.answerMarkdown} />
            </div>
            <p className="rep-source-note">
              Written by RecMap&rsquo;s assistant from the cited records only. Everything below this line is
              arithmetic over the catalog — no model involved.
            </p>
          </section>

          {cited.length > 0 && (
            <>
              <section className="rep-section">
                <h3>1 · What the guidelines say</h3>
                <div className="rep-dirbar">
                  {(["for", "against", "neutral"] as const).map((d) =>
                    directionCounts[d] > 0 ? (
                      <span className={`rep-dirchip dir-${d}`} key={d}>
                        <b>{directionCounts[d]}</b>{" "}
                        {d === "for" ? "in favour" : d === "against" ? "against" : "neutral / no recommendation"}
                      </span>
                    ) : null
                  )}
                </div>
                <div className="rep-rows">
                  {cited.map((g) => (
                    <div className="rep-row" key={g.id}>
                      <span className="rep-org" title={g.organization}>
                        {orgInitials(g.organization)}
                      </span>
                      <div className="rep-row-body">
                        <div className="rep-row-head">
                          <b>{g.organization}</b> · {g.year} · {g.clinicalArea}
                        </div>
                        <p className="rep-quote">&ldquo;{g.recommendationText}&rdquo;</p>
                        <div className="rep-row-tags">
                          <span className={`rep-tag dir-${directionVisual(g.direction)}`}>{directionLabel(g)}</span>
                          <span className="rep-tag">{g.recommendationTypeLabel}</span>
                          <span className="rep-tag">Strength: {g.strength}</span>
                          <span className="rep-tag">GRADE: {g.gradeCertaintyLabel}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {landscape && (
                <section className="rep-section">
                  <h3>2 · The landscape</h3>
                  <p className="rep-inline-list">
                    The cited recommendations come from <b>{landscape.orgs.length}</b> organisation
                    {landscape.orgs.length === 1 ? "" : "s"} across <b>{landscape.regions.length}</b> world region
                    {landscape.regions.length === 1 ? "" : "s"}, covering <b>{landscape.areas.length}</b> clinical
                    area{landscape.areas.length === 1 ? "" : "s"}, published{" "}
                    {landscape.years[0] === landscape.years[landscape.years.length - 1]
                      ? `in ${landscape.years[0]}`
                      : `between ${landscape.years[0]} and ${landscape.years[landscape.years.length - 1]}`}
                    .
                  </p>
                  <div className="rep-facets">
                    <div>
                      <span className="rep-facet-k">Clinical areas</span>
                      <span className="rep-facet-v">{landscape.areas.join(" · ")}</span>
                    </div>
                    <div>
                      <span className="rep-facet-k">World regions</span>
                      <span className="rep-facet-v">{landscape.regions.join(" · ")}</span>
                    </div>
                    <div>
                      <span className="rep-facet-k">Statement types</span>
                      <span className="rep-facet-v">{landscape.types.join(" · ")}</span>
                    </div>
                  </div>
                  <p className="rep-source-note">
                    A narrow spread here is itself a finding: guidance drawn from one region or one organisation
                    tells you less about international consensus than the number of citations suggests.{" "}
                    <Link href="/map">See these on the map</Link>.
                  </p>
                </section>
              )}

              {trust && (
                <section className="rep-section">
                  <h3>3 · How much to trust it</h3>
                  <div className="rep-stats">
                    <div className="rep-stat">
                      <span className="rep-stat-v">
                        {trust.agreePct}% <small>· {trust.agreeMean.toFixed(1)}/7</small>
                      </span>
                      <span className="rep-stat-k">Mean AGREE II across the cited guidelines</span>
                    </div>
                    <div className="rep-stat">
                      <span className="rep-stat-v">
                        {trust.clearedGate} / {cited.length}
                      </span>
                      <span className="rep-stat-k">Cleared the {AGREE_GATE_THRESHOLD_PCT}% quality gate</span>
                    </div>
                    <div className="rep-stat">
                      <span className="rep-stat-v">
                        {trust.rexAppraised} / {cited.length}
                      </span>
                      <span className="rep-stat-k">Have a recommendation-level AGREE-REX appraisal</span>
                    </div>
                    <div className="rep-stat">
                      <span className="rep-stat-v">{trust.aiAppraised}</span>
                      <span className="rep-stat-k">Appraised by the AI pipeline rather than a human reviewer</span>
                    </div>
                  </div>
                  <div className="rep-inline-list">
                    <b>Certainty of evidence:</b>{" "}
                    {trust.certainty.map(([label, n], i) => (
                      <span key={label}>
                        {i > 0 ? ", " : ""}
                        {n} × {label}
                      </span>
                    ))}
                    {trust.ungraded > 0 && (
                      <>
                        {" "}
                        · <b>{trust.ungraded}</b> did not use GRADE, so their certainty cannot be pooled with the
                        rest.
                      </>
                    )}
                  </div>
                  <p className="rep-source-note">
                    AGREE II measures how rigorously each guideline was <i>developed</i>. It is not a measure of how
                    strong the underlying evidence is — that is what GRADE certainty says, and the two often
                    disagree.
                  </p>
                </section>
              )}

              <section className="rep-section">
                <h3>4 · Where they disagree</h3>
                {report.divergence?.hasDivergence ? (
                  <DivergencePanel divergence={report.divergence} guidelineById={(id) => byId.get(id)} />
                ) : (
                  <p className="rep-empty">
                    {directionCounts.for > 0 && directionCounts.against > 0
                      ? "The cited guidelines point in different directions, but RecMap could not trace the disagreement to a specific cause in the data. Read the recommendations above side by side before concluding they conflict — they may be answering subtly different questions."
                      : "No material disagreement was found among the cited guidelines on this question."}
                  </p>
                )}
              </section>

              {transfer && (
                <section className="rep-section">
                  <div className="rep-section-head">
                    <h3>5 · Does it transfer to your setting?</h3>
                    <label className="rep-region">
                      <span>Your region</span>
                      <select value={myRegion} onChange={(e) => setMyRegion(e.target.value)}>
                        <option value="">Not specified</option>
                        {regionOptions.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="rep-dirbar">
                    {(["adopt", "adapt", "adapt_caution"] as const).map((r) =>
                      transfer.counts[r] > 0 ? (
                        <span className={`rep-dirchip tone-${TRANSFER_RUNG_META[r].tone}`} key={r}>
                          <b>{transfer.counts[r]}</b> {TRANSFER_RUNG_META[r].label.toLowerCase()}
                        </span>
                      ) : null
                    )}
                  </div>
                  {!myRegion && (
                    <p className="rep-empty">
                      No region selected, so the context-fit check passes by default and the placement below
                      reflects currency, development rigour and values fit only.
                    </p>
                  )}
                  <div className="rep-rows">
                    {transfer.rows.map(({ guideline, rung, signals }) => (
                      <div className={`rep-row tone-${TRANSFER_RUNG_META[rung].tone}`} key={guideline.id}>
                        <span className="rep-org" title={guideline.organization}>
                          {orgInitials(guideline.organization)}
                        </span>
                        <div className="rep-row-body">
                          <div className="rep-row-head">
                            <b>{guideline.organization}</b> · {guideline.year} —{" "}
                            <b>{TRANSFER_RUNG_META[rung].label}</b>
                          </div>
                          <ul className="rep-signals">
                            {signals.map((sig) => (
                              <li key={sig.label} className={sig.ok ? "ok" : "no"}>
                                <b>{sig.label}:</b> {sig.detail}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="rep-source-note">
                    A reading aid built from the catalog&rsquo;s own appraisal data, not a validated
                    contextualisation instrument, and no substitute for a local panel working through ADAPTE or
                    GRADE-ADOLOPMENT properly. <Link href="/contextualisation">Open the full ladder</Link>.
                  </p>
                </section>
              )}

              {implementation && (
                <section className="rep-section">
                  <h3>6 · What implementing it would take</h3>
                  <div className="rep-stats">
                    {implementation.perItem.map((item) => (
                      <div className="rep-stat" key={item.key}>
                        <span className="rep-stat-v">
                          {item.mean.toFixed(1)}
                          <small>/7</small>
                        </span>
                        <span className="rep-stat-k">
                          {item.label} — {item.wellAddressed} of {item.n} well addressed
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="rep-inline-list">
                    <b>Feasibility:</b>{" "}
                    {implementation.implMean !== null ? (
                      <>
                        AGREE-REX implementability averages {implementation.implMean.toFixed(1)}/7 across the{" "}
                        {implementation.withRexCount} appraised recommendation
                        {implementation.withRexCount === 1 ? "" : "s"}.
                      </>
                    ) : (
                      <>
                        none of the cited recommendations has an AGREE-REX appraisal, so feasibility is unknown
                        here — not zero.
                      </>
                    )}{" "}
                    <b>Equity:</b> {cited.filter((g) => g.equity.evaluated).length} of {cited.length} assessed
                    differential impact on any PROGRESS-Plus dimension.
                  </div>
                  <p className="rep-source-note">
                    AGREE II domain 5 is the weakest domain in most published guidelines, so low scores here are the
                    norm rather than an anomaly — and they are exactly the gap an implementation team inherits.{" "}
                    <Link href="/implementation">Open the full breakdown</Link>.
                  </p>
                </section>
              )}

              {gaps && (
                <section className="rep-section">
                  <h3>7 · What&rsquo;s missing</h3>
                  <ul className="rep-gaps">
                    <li>
                      <b>{gaps.equityUnassessed} of {cited.length}</b> did not assess differential impact on any
                      PROGRESS-Plus dimension. Any equity consequence of adopting this is currently unexamined.
                    </li>
                    <li>
                      <b>{gaps.noCost} of {cited.length}</b> barely addressed resource implications (AGREE II item
                      20), so the cost of implementing this is not established by the guidance itself.
                    </li>
                    <li>
                      <b>{gaps.notEligible} of {cited.length}</b> did not clear the quality gate, so no
                      recommendation-level trust score exists for them.
                    </li>
                    <li>
                      <b>{gaps.uncoded} of {cited.length}</b> carry no ICD-11 or SNOMED CT code, which limits how far
                      they can be matched or compared computationally.
                    </li>
                    {gaps.overdue.length > 0 && (
                      <li>
                        <b>{gaps.overdue.length}</b> published more than five years ago and likely overdue for
                        review: {gaps.overdue.map((g) => `${orgInitials(g.organization)} ${g.year}`).join(", ")}.
                      </li>
                    )}
                    {gaps.ageing.length > 0 && (
                      <li>
                        <b>{gaps.ageing.length}</b> approaching review age (3–5 years):{" "}
                        {gaps.ageing.map((g) => `${orgInitials(g.organization)} ${g.year}`).join(", ")}.
                      </li>
                    )}
                  </ul>
                  <p className="rep-source-note">
                    A gap here is a statement about what the source guidelines address, not a fault in RecMap&rsquo;s
                    extraction.
                  </p>
                </section>
              )}
            </>
          )}

          <footer className="rep-foot">
            RecMap report · generated {formatDate(report.generatedAt)} · not a substitute for professional medical
            advice, and not an independently reviewed appraisal. Verify every cited recommendation against its
            source before it informs a decision.
          </footer>
        </article>
      )}

      <style jsx global>{`
        .rep-wrap { padding: 20px 0 60px 0; }
        .rep-head {
          padding: 8px 0 20px 0;
          border-bottom: 1px solid var(--line-100);
          margin-bottom: 22px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .rep-head h1 {
          margin: 0;
          font-size: 27px;
          font-weight: 700;
          color: var(--ink-900);
        }
        .rep-dek {
          margin: 0;
          font-size: 14px;
          line-height: 1.65;
          color: var(--ink-600);
        }
        .rep-pick {
          display: flex;
          align-items: flex-end;
          flex-wrap: wrap;
          gap: 12px 16px;
          padding: 16px 18px;
          border: 1px solid var(--line-200);
          border-radius: var(--card-radius);
          background: var(--surface);
          margin-bottom: 22px;
        }
        .rep-pick label { display: flex; flex-direction: column; gap: 5px; flex: 1 1 420px; min-width: 0; }
        .rep-pick label span {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--ink-500);
        }
        .rep-pick select {
          border: 1px solid var(--line-200);
          border-radius: 9px;
          padding: 10px 12px;
          font-size: 13px;
          background: var(--bg);
          color: var(--ink-800);
          width: 100%;
        }
        .rep-pick .btn-primary { border-radius: 9px; padding: 11px 22px; flex-shrink: 0; }
        .rep-pick-note { flex-basis: 100%; font-size: 12.5px; color: var(--ink-500); }

        .rep-doc {
          border: 1px solid var(--line-200);
          border-radius: var(--card-radius);
          background: var(--surface);
          padding: 28px 32px 24px;
        }
        .rep-doc-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 18px;
          padding-bottom: 18px;
          border-bottom: 1px solid var(--line-100);
          margin-bottom: 4px;
        }
        .rep-doc-head h2 {
          margin: 0 0 5px 0;
          font-size: 22px;
          font-weight: 700;
          color: var(--ink-900);
          line-height: 1.3;
        }
        .rep-meta { font-size: 12.5px; color: var(--ink-500); }
        .rep-print { display: inline-flex; align-items: center; gap: 8px; flex-shrink: 0; }
        .rep-print svg { width: 16px; height: 16px; }
        .rep-actions { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
        .rep-actions .map-export { position: relative; }
        .rep-actions .map-export-menu {
          position: absolute;
          right: 0;
          top: calc(100% + 8px);
          width: 300px;
          background: var(--surface);
          border: 1px solid var(--line-200);
          border-radius: 12px;
          box-shadow: 0 14px 34px rgba(6, 30, 32, 0.16);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          z-index: 20;
          text-align: left;
        }
        .rep-actions .map-export-menu button {
          display: flex;
          flex-direction: column;
          gap: 3px;
          padding: 12px 15px;
          border: none;
          background: none;
          text-align: left;
          cursor: pointer;
        }
        .rep-actions .map-export-menu button + button { border-top: 1px solid var(--line-100); }
        .rep-actions .map-export-menu button:hover:not(:disabled) { background: var(--bg-alt); }
        .rep-actions .map-export-menu button:disabled { opacity: 0.5; cursor: not-allowed; }
        .rep-actions .map-export-menu b { font-size: 13px; color: var(--ink-900); }
        .rep-actions .map-export-menu span { font-size: 11.5px; line-height: 1.45; color: var(--ink-500); }
        .rep-section-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          flex-wrap: wrap;
          margin-bottom: 14px;
        }
        .rep-section-head h3 { margin: 0; }
        .rep-region { display: flex; align-items: center; gap: 8px; }
        .rep-region span {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--ink-500);
        }
        .rep-region select {
          border: 1px solid var(--line-200);
          border-radius: 8px;
          padding: 7px 10px;
          font-size: 12.5px;
          background: var(--surface);
          color: var(--ink-800);
        }
        .rep-facets { display: flex; flex-direction: column; gap: 8px; margin: 12px 0 0; }
        .rep-facets > div { display: flex; gap: 12px; align-items: baseline; }
        .rep-facet-k {
          flex: 0 0 130px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--ink-500);
        }
        .rep-facet-v { font-size: 13px; line-height: 1.55; color: var(--ink-700); }
        .rep-row.tone-good { border-left: 3px solid var(--favour); }
        .rep-row.tone-warn { border-left: 3px solid var(--brand); }
        .rep-row.tone-stop { border-left: 3px solid var(--against); }
        .rep-signals { margin: 8px 0 0; padding-left: 18px; display: flex; flex-direction: column; gap: 5px; }
        .rep-signals li { font-size: 12.5px; line-height: 1.55; color: var(--ink-600); }
        .rep-signals li.no { color: var(--ink-800); }
        .rep-signals li.no::marker { color: var(--against); }
        .rep-signals li.ok::marker { color: var(--favour); }
        .rep-dirchip.tone-good { background: var(--favour-bg); color: var(--favour); border-color: var(--favour-border); }
        .rep-dirchip.tone-warn { background: var(--accent-bg); color: var(--brand-ink); border-color: var(--accent-border); }
        .rep-dirchip.tone-stop { background: var(--against-bg); color: var(--against); border-color: var(--against-border); }
        .rep-section { padding: 22px 0; border-bottom: 1px solid var(--line-100); }
        .rep-section:last-of-type { border-bottom: none; }
        .rep-section h3 {
          margin: 0 0 14px 0;
          font-size: 17px;
          font-weight: 700;
          color: var(--ink-900);
        }
        .rep-prose { font-size: 14.5px; line-height: 1.7; color: var(--ink-800); }
        .rep-source-note {
          margin: 14px 0 0 0;
          font-size: 12px;
          line-height: 1.6;
          color: var(--ink-500);
        }
        .rep-dirbar { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 16px; }
        .rep-dirchip {
          font-size: 13px;
          padding: 9px 16px;
          border-radius: 999px;
          border: 1px solid var(--line-200);
        }
        .rep-dirchip b { font-weight: 800; }
        .rep-dirchip.dir-for { background: var(--favour-bg); color: var(--favour); border-color: var(--favour-border); }
        .rep-dirchip.dir-against { background: var(--against-bg); color: var(--against); border-color: var(--against-border); }
        .rep-dirchip.dir-neutral { background: var(--neutral-bg); color: var(--neutral); border-color: var(--neutral-border); }
        .rep-rows { display: flex; flex-direction: column; gap: 12px; }
        .rep-row {
          display: flex;
          gap: 14px;
          padding: 14px 16px;
          border: 1px solid var(--line-100);
          border-radius: 10px;
          background: var(--bg-alt);
        }
        .rep-org {
          flex-shrink: 0;
          width: 40px;
          height: 40px;
          border-radius: 9px;
          background: var(--surface);
          border: 1px solid var(--line-200);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11.5px;
          font-weight: 800;
          color: var(--ink-600);
        }
        .rep-row-body { min-width: 0; }
        .rep-row-head { font-size: 13px; color: var(--ink-600); }
        .rep-quote {
          margin: 6px 0 8px 0;
          font-size: 13.5px;
          line-height: 1.6;
          color: var(--ink-800);
        }
        .rep-row-tags { display: flex; flex-wrap: wrap; gap: 6px; }
        .rep-tag {
          font-size: 11px;
          font-weight: 600;
          padding: 4px 9px;
          border-radius: 6px;
          background: var(--surface);
          border: 1px solid var(--line-200);
          color: var(--ink-600);
        }
        .rep-tag.dir-for { color: var(--favour); border-color: var(--favour-border); }
        .rep-tag.dir-against { color: var(--against); border-color: var(--against-border); }
        .rep-tag.dir-neutral { color: var(--neutral); border-color: var(--neutral-border); }
        .rep-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
          margin-bottom: 14px;
        }
        .rep-stat {
          border: 1px solid var(--line-100);
          border-radius: 10px;
          padding: 14px 16px;
          background: var(--bg-alt);
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .rep-stat-v {
          font-size: 21px;
          font-weight: 700;
          color: var(--ink-900);
          font-variant-numeric: tabular-nums;
        }
        .rep-stat-v small { font-size: 12px; font-weight: 600; color: var(--ink-500); }
        .rep-stat-k { font-size: 12px; line-height: 1.45; color: var(--ink-600); }
        .rep-inline-list { font-size: 13.5px; line-height: 1.65; color: var(--ink-700); }
        .rep-empty { margin: 0; font-size: 13.5px; line-height: 1.65; color: var(--ink-600); }
        .rep-gaps { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 9px; }
        .rep-gaps li { font-size: 13.5px; line-height: 1.6; color: var(--ink-700); }
        .rep-foot {
          margin-top: 18px;
          padding-top: 16px;
          border-top: 1px solid var(--line-100);
          font-size: 11.5px;
          line-height: 1.6;
          color: var(--ink-500);
        }

        /* Print: the report alone, on white, with the shell stripped out. */
        @media print {
          .app-rail,
          .app-topbar,
          .site-footer,
          .rep-head,
          .rep-pick,
          .rep-actions,
          .lensbar { display: none !important; }
          .app-shell, .app-column, .main { display: block; padding: 0; margin: 0; max-width: none; }
          .rep-doc { border: none; padding: 0; }
          .rep-section { break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<div className="state-block">Loading…</div>}>
      <ReportsInner />
    </Suspense>
  );
}
