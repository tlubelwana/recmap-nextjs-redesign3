"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Guideline } from "@/lib/types";
import { formatDate } from "@/components/format";
import { useAudienceLens } from "@/components/LensProvider";

/**
 * The slim white bar across the top of the content column in the v3 shell.
 * Everything that used to sit on the right-hand side of the old NavBar
 * lives here: catalog search, the freshness/pipeline indicator, and a link
 * to help. The account chip moved down into the sidebar's footer, which is
 * where the v3 snapshots put it.
 */
export default function AppTopBar() {
  const router = useRouter();
  const { lens, isOverridden } = useAudienceLens();
  const [navSearch, setNavSearch] = useState("");
  const [summary, setSummary] = useState<{ count: number; orgs: number; lastCheckedISO: string | null } | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;
    fetch("/api/guidelines")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { guidelines: Guideline[] } | null) => {
        if (cancelled || !data) return;
        const orgs = new Set(data.guidelines.map((g) => g.organization));
        const lastCheckedISO = data.guidelines.reduce<string | null>((latest, g) => {
          if (!g.lastCheckedISO) return latest;
          if (!latest || g.lastCheckedISO > latest) return g.lastCheckedISO;
          return latest;
        }, null);
        setSummary({ count: data.guidelines.length, orgs: orgs.size, lastCheckedISO });
      })
      .catch(() => {
        /* The freshness pill is a nice-to-have — fail silently. */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const query = navSearch.trim();
    if (!query) return;
    router.push(`/search?q=${encodeURIComponent(query)}`);
    setNavSearch("");
  }

  return (
    <header className="app-topbar">
      <form className="topbar-search" onSubmit={submitSearch} role="search">
        <svg
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
          type="text"
          value={navSearch}
          onChange={(event) => setNavSearch(event.target.value)}
          placeholder="Search for a condition, intervention, or guideline…"
          aria-label="Search guidelines"
          autoComplete="off"
        />
      </form>

      <div className="topbar-right">
        <span className="topbar-lens">
          For {lens.plural}
          {isOverridden ? " (previewing)" : ""}
        </span>
        <span className="topbar-freshness">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 12a9 9 0 1 1-3.6-7.2" />
            <path d="M21 3v6h-6" />
          </svg>
          {summary
            ? `${summary.count} guideline${summary.count === 1 ? "" : "s"} · ${summary.orgs} organisation${
                summary.orgs === 1 ? "" : "s"
              }`
            : "AI in clinical guidelines"}
        </span>
        <Link
          href="/about"
          className="topbar-pipeline"
          title="How this catalog is built and kept up to date"
        >
          {summary?.lastCheckedISO ? `Last checked ${formatDate(summary.lastCheckedISO)}` : "Pipeline & methodology"}
        </Link>
        <Link href="/help" className="topbar-help" aria-label="Instructions and help">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M9.4 9.4a2.7 2.7 0 1 1 3.6 2.5c-.6.3-1 .8-1 1.5v.4" />
            <path d="M12 17.1v.4" />
          </svg>
          <span>Help</span>
        </Link>
      </div>
    </header>
  );
}
