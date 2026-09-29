"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AudienceLensBar from "@/components/AudienceLensBar";
import CatalogCard from "@/components/CatalogCard";
import GuidelineDrawer from "@/components/GuidelineDrawer";
import { formatDate, uniqueSorted } from "@/components/format";
import type { Guideline, GuidelineGroup } from "@/lib/types";

function CatalogInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [guidelines, setGuidelines] = useState<Guideline[] | null>(null);
  const [groups, setGroups] = useState<GuidelineGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [orgFilter, setOrgFilter] = useState("");
  const [areaFilter, setAreaFilter] = useState("");
  const [agreeFilter, setAgreeFilter] = useState(0);
  const [worldRegionFilter, setWorldRegionFilter] = useState("");
  const [ageGroupFilter, setAgeGroupFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [gradingApproachFilter, setGradingApproachFilter] = useState("");

  const [selectedGuidelineId, setSelectedGuidelineId] = useState<string | null>(null);
  const [highlightRecId, setHighlightRecId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/guidelines")
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        return res.json() as Promise<{ guidelines: Guideline[]; groups: GuidelineGroup[] }>;
      })
      .then((data) => {
        if (!cancelled) {
          setGuidelines(data.guidelines);
          setGroups(data.groups);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load guidelines.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // The ?guideline= param historically carried a single recommendation's
  // flat `id` (that's still what CitedCard and the Map view link with).
  // Resolve it either as a guidelineId directly (a group card sets it that
  // way now) or, for backward compatibility, by looking up which group a
  // matching flat record belongs to — and in that case remember which
  // specific recommendation to highlight inside the drawer.
  useEffect(() => {
    const fromUrl = searchParams.get("guideline");
    if (!fromUrl || !groups || !guidelines) return;
    const asGroup = groups.find((g) => g.guidelineId === fromUrl);
    if (asGroup) {
      setSelectedGuidelineId(asGroup.guidelineId);
      setHighlightRecId(null);
      return;
    }
    const asRec = guidelines.find((g) => g.id === fromUrl);
    if (asRec) {
      setSelectedGuidelineId(asRec.guidelineId);
      setHighlightRecId(asRec.id);
    }
  }, [searchParams, groups, guidelines]);

  const orgs = useMemo(() => uniqueSorted((groups ?? []).map((g) => g.organization)), [groups]);
  const areas = useMemo(() => uniqueSorted((groups ?? []).map((g) => g.clinicalArea)), [groups]);
  const worldRegions = useMemo(() => uniqueSorted((groups ?? []).map((g) => g.worldRegion)), [groups]);
  const ageGroups = useMemo(
    () => uniqueSorted((groups ?? []).flatMap((g) => g.recommendations.map((r) => r.ageGroup))),
    [groups]
  );
  const gradingApproaches = useMemo(
    () => uniqueSorted((groups ?? []).flatMap((g) => g.recommendations.map((r) => r.gradingApproachLabel))),
    [groups]
  );
  const years = useMemo(
    () =>
      Array.from(new Set((groups ?? []).map((g) => g.year)))
        .sort((a, b) => b - a)
        .map(String),
    [groups]
  );

  const filtered = useMemo(() => {
    if (!groups) return [];
    const q = search.trim().toLowerCase();
    return groups.filter((g) => {
      if (orgFilter && g.organization !== orgFilter) return false;
      if (areaFilter && g.clinicalArea !== areaFilter) return false;
      if (agreeFilter && g.agree.overall7 < agreeFilter) return false;
      if (worldRegionFilter && g.worldRegion !== worldRegionFilter) return false;
      if (yearFilter && String(g.year) !== yearFilter) return false;
      if (ageGroupFilter && !g.recommendations.some((r) => r.ageGroup === ageGroupFilter)) return false;
      if (gradingApproachFilter && !g.recommendations.some((r) => r.gradingApproachLabel === gradingApproachFilter)) {
        return false;
      }
      if (q) {
        const hay = [
          g.organization,
          g.guidelineTitle,
          g.clinicalArea,
          ...g.recommendations.flatMap((r) => [r.recommendationText, r.aiDomain]),
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [groups, search, orgFilter, areaFilter, agreeFilter, worldRegionFilter, yearFilter, ageGroupFilter, gradingApproachFilter]);

  const selectedGroup = groups?.find((g) => g.guidelineId === selectedGuidelineId) ?? null;
  const cameFromMap = searchParams.get("from") === "map";

  const lastChecked = useMemo(() => {
    if (!groups || groups.length === 0) return null;
    return groups.reduce((latest, g) => (g.lastCheckedISO > latest ? g.lastCheckedISO : latest), groups[0].lastCheckedISO);
  }, [groups]);

  function openGroup(group: GuidelineGroup) {
    setSelectedGuidelineId(group.guidelineId);
    setHighlightRecId(null);
    router.replace(`/catalog?guideline=${encodeURIComponent(group.guidelineId)}`, { scroll: false });
  }
  function closeDrawer() {
    setSelectedGuidelineId(null);
    setHighlightRecId(null);
    router.replace("/catalog", { scroll: false });
  }

  return (
    <section>
      <AudienceLensBar />
      <div className="catalog-head">
        <div>
          <h1>Centralized catalog</h1>
          <p>Every AI-related recommendation we track, gathered from one place.</p>
        </div>
        <div className="catalog-head-actions">
          {cameFromMap && selectedGroup && (
            <button type="button" className="btn-primary" onClick={() => router.push("/map")}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5" />
                <path d="m11 18-6-6 6-6" />
              </svg>
              Back to Explore
            </button>
          )}
          <Link href="/upload" className="btn-primary">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
            Add a guideline
          </Link>
        </div>
      </div>

      {error && (
        <div className="state-block error">
          <p>Couldn&rsquo;t load the catalog: {error}</p>
          <button type="button" className="btn-outline" onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      )}

      {!error && !groups && (
        <div className="state-block">
          <div className="spinner" />
          <p>Loading guidelines…</p>
        </div>
      )}

      {groups && (
        <>
          <div className="catalog-filters">
            <div className="search-sm" style={{ width: 280 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search guidelines…"
                autoComplete="off"
              />
            </div>
            <select className="filter-select" value={orgFilter} onChange={(e) => setOrgFilter(e.target.value)}>
              <option value="">Organisation: all</option>
              {orgs.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
            <select className="filter-select" value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)}>
              <option value="">Clinical area: all</option>
              {areas.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <select
              className="filter-select"
              value={worldRegionFilter}
              onChange={(e) => setWorldRegionFilter(e.target.value)}
            >
              <option value="">World region: all</option>
              {worldRegions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <select className="filter-select" value={ageGroupFilter} onChange={(e) => setAgeGroupFilter(e.target.value)}>
              <option value="">Age group: all</option>
              {ageGroups.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <select className="filter-select" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
              <option value="">Publication year: all</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <select
              className="filter-select"
              value={gradingApproachFilter}
              onChange={(e) => setGradingApproachFilter(e.target.value)}
            >
              <option value="">Grading approach: all</option>
              {gradingApproaches.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
            <select
              className="filter-select"
              value={agreeFilter}
              onChange={(e) => setAgreeFilter(Number(e.target.value))}
            >
              <option value="0">AGREE&nbsp;II: any score</option>
              <option value="6">6.0+ / 7</option>
              <option value="5">5.0+ / 7</option>
              <option value="4">4.0+ / 7</option>
            </select>
            <span className="result-count">
              <b>{filtered.length}</b> of {groups.length}
            </span>
          </div>

          <div className="cat-grid">
            {filtered.length === 0 && <div className="no-catalog">No guidelines match these filters.</div>}
            {filtered.map((g) => (
              <CatalogCard key={g.guidelineId} group={g} onOpen={openGroup} />
            ))}
          </div>

          <div className="living-foot">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--favour)" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-3.6-7.2" />
              <path d="M21 3v6h-6" />
            </svg>
            <span>
              Living updates: new guidelines are checked for automatically. Uploaded guidelines appear here right
              after processing.
              {lastChecked && <> Catalog data last checked {formatDate(lastChecked)}.</>}
            </span>
          </div>
          <div className="living-foot" style={{ borderTop: "none", paddingTop: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-500)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6" />
            </svg>
            <span>
              Raw data sources:{" "}
              <a className="source-pdf-link" href="/data/excel/AI_recommendation_data.xlsx" target="_blank" rel="noopener noreferrer">
                recommendation dataset ↗
              </a>{" "}
              ·{" "}
              <a className="source-pdf-link" href="/data/excel/AGREEII_results.xlsx" target="_blank" rel="noopener noreferrer">
                AGREE&nbsp;II appraisals ↗
              </a>
            </span>
          </div>
        </>
      )}

      <GuidelineDrawer
        group={selectedGroup}
        highlightRecommendationId={highlightRecId}
        peers={guidelines ?? undefined}
        onClose={closeDrawer}
      />
    </section>
  );
}

export default function CatalogPage() {
  return (
    <Suspense
      fallback={
        <div className="state-block">
          <div className="spinner" />
          <p>Loading guidelines…</p>
        </div>
      }
    >
      <CatalogInner />
    </Suspense>
  );
}
