"use client";

import { useMemo, useState } from "react";

const SEARCHABLE_ITEMS = [
  { title: "Ask", href: "/ask", keywords: "ask question answer recommendations clinical practice guidelines" },
  { title: "Explore", href: "/map", keywords: "explore map matrix charts details list comparison guideline disagreement across organisations" },
  { title: "Catalog", href: "/catalog", keywords: "catalog guideline list evidence scores aggree grade recommendations" },
  { title: "Charts", href: "/map?view=charts", keywords: "charts analytics histograms summary plots evidence distribution" },
  { title: "History", href: "/history", keywords: "history questions answers saved prior searches feedback" },
  { title: "Instructions", href: "/help", keywords: "instructions help guide how to use recmap usage walkthrough" },
  { title: "Upload", href: "/upload", keywords: "upload guidance add guideline new evidence admin" },
  { title: "About", href: "/about", keywords: "about methodology overview recap how recmap works" },
  { title: "Onboarding", href: "/onboarding", keywords: "onboarding audience persona change user lens profile" },
];

export default function SearchPage() {
  const [query, setQuery] = useState("");

  const queryText = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!queryText) return SEARCHABLE_ITEMS;

    const terms = queryText.split(/\s+/).filter(Boolean);
    return SEARCHABLE_ITEMS.filter((item) => {
      const haystack = `${item.title} ${item.keywords}`.toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }, [queryText]);

  return (
    <section className="search-page-shell">
      <div className="search-page-header">
        <span className="eyebrow">Search</span>
        <h1>Find a page or feature</h1>
        <p>Search across RecMap pages and tools.</p>
      </div>

      <label className="search-sm search-page-box" htmlFor="recmap-global-search">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
        <input
          id="recmap-global-search"
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search pages, tools, or help topics…"
          autoComplete="off"
        />
      </label>

      {queryText && results.length === 0 && (
        <div className="search-page-empty">
          <p>No pages match “{query}”. Try “ask”, “catalog”, “help”, or “account”.</p>
        </div>
      )}

      <div className="search-results">
        {results.map((item) => (
          <a key={item.href} href={item.href} className="search-result-card">
            <span className="search-result-title">{item.title}</span>
            <span className="search-result-meta">{item.keywords}</span>
          </a>
        ))}
      </div>

      <style jsx global>{`
        .search-page-shell {
          max-width: 900px;
          margin: 0 auto;
          padding: 28px 0 52px;
        }
        .search-page-header {
          margin-bottom: 18px;
        }
        .search-page-header h1 {
          margin: 8px 0 6px;
          font-size: 30px;
          line-height: 1.2;
          color: var(--ink-900);
        }
        .search-page-header p {
          margin: 0;
          color: var(--ink-600);
          font-size: 14px;
          line-height: 1.6;
        }
        .search-page-box {
          width: 100%;
          max-width: 760px;
          margin-bottom: 18px;
        }
        .search-page-empty {
          margin: 0 0 18px;
          padding: 14px 16px;
          border-radius: 10px;
          background: var(--bg-alt);
          border: 1px solid var(--line-200);
          color: var(--ink-700);
          font-size: 14px;
        }
        .search-results {
          display: grid;
          gap: 12px;
        }
        .search-result-card {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: 16px 18px;
          border-radius: 14px;
          border: 1px solid var(--line-200);
          background: var(--bg);
          color: var(--ink-800);
          text-decoration: none;
          transition: border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
        }
        .search-result-card:hover {
          border-color: var(--favour);
          box-shadow: 0 12px 24px rgba(11, 35, 33, 0.06);
          transform: translateY(-1px);
        }
        .search-result-title {
          font-size: 16px;
          font-weight: 700;
        }
        .search-result-meta {
          font-size: 12.5px;
          color: var(--ink-600);
          line-height: 1.5;
        }
      `}</style>
    </section>
  );
}
