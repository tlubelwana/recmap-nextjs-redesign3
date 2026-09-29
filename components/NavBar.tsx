"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { Guideline } from "@/lib/types";
import type { Persona } from "@/lib/db";
import { getLens } from "@/lib/audienceLens";
import { useAudienceLens } from "@/components/LensProvider";
import { formatDate } from "@/components/format";
import SignalPinMark from "@/components/SignalPinMark";
import { UPLOAD_FEATURE_ENABLED } from "@/lib/config";

function initials(email: string): string {
  const name = email.split("@")[0] || email;
  const parts = name.split(/[._-]+/).filter(Boolean);
  const chars = parts.length >= 2 ? parts[0][0] + parts[1][0] : name.slice(0, 2);
  return chars.toUpperCase();
}

const TABS = [
  { href: "/", label: "Home" },
  { href: "/ask", label: "Ask" },
  { href: "/map", label: "Explore" },
  { href: "/contextualisation", label: "Contextualise" },
  { href: "/implementation", label: "Implement" },
  { href: "/catalog", label: "Catalog" },
  { href: "/analytics", label: "Charts" },
  { href: "/history", label: "History" },
  { href: "/upload", label: "Upload" },
  { href: "/about", label: "About" },
  { href: "/features", label: "New features" },
  { href: "/help", label: "Instructions" },
];


export default function NavBar({ userEmail, persona, selectedPersonas = [] }: { userEmail?: string; persona?: Persona | null; selectedPersonas?: Persona[] }) {
  const { lens, isOverridden } = useAudienceLens();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [navSearch, setNavSearch] = useState("");
  const [summary, setSummary] = useState<{ count: number; orgs: number; lastCheckedISO: string | null } | null>(
    null
  );

  async function logout() {
    try {
      window.localStorage.removeItem("recmap-ask-state");
      window.localStorage.removeItem("recmap-last-map-context");
    } catch {
      /* ignore */
    }
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

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
        /* Nav freshness pill is a nice-to-have — fail silently. */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function submitNavSearch(event: React.FormEvent) {
    event.preventDefault();
    const query = navSearch.trim();
    if (!query) return;
    router.push(`/search?q=${encodeURIComponent(query)}`);
    setNavSearch("");
  }

  return (
    <div className="navbar">
      <div className="nav-left">
        <div className="brand-block">
          <Link href="/ask" className="brand" aria-label="RecMap home">
            <SignalPinMark size={42} />
            <span className="brand-name wordmark">RecMap</span>
          </Link>
          <span className="brand-audience">
            For {lens.plural}{isOverridden ? " (previewing)" : ""}
          </span>
        </div>
        <div className="tabs" role="tablist" aria-label="Sections">
          {TABS.map((tab) => {
            const selected = pathname === tab.href || (tab.href === "/ask" && pathname === "/");
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="tab"
                role="tab"
                aria-selected={selected}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
        <form className="nav-search" onSubmit={submitNavSearch}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            type="text"
            value={navSearch}
            onChange={(event) => setNavSearch(event.target.value)}
            placeholder="Search"
            aria-label="Search pages and features"
            autoComplete="off"
          />
        </form>
      </div>
      <div className="nav-right">
        <div className="freshness">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--favour)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12a9 9 0 1 1-3.6-7.2" />
            <path d="M21 3v6h-6" />
          </svg>
          <span>
            {summary
              ? `${summary.count} guideline${summary.count === 1 ? "" : "s"} · ${summary.orgs} organisation${summary.orgs === 1 ? "" : "s"}`
              : "AI in clinical guidelines"}
          </span>
        </div>
        <Link href="/about" className="pipeline-indicator" title="How this catalog is built and kept up to date">
          {summary?.lastCheckedISO ? `Last checked ${formatDate(summary.lastCheckedISO)}` : "Pipeline & methodology"}
        </Link>
        {userEmail && (
          <div className="account-menu-wrap">
            <button
              type="button"
              className="account-avatar"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={`Account menu for ${userEmail}`}
            >
              {initials(userEmail)}
            </button>
            {menuOpen && (
              <div className="account-menu" onMouseLeave={() => setMenuOpen(false)}>
                <div className="account-menu-header">
                  <div className="account-menu-email">{userEmail}</div>
                  {persona && <div className="account-menu-persona">{getLens(persona).label}</div>}
                </div>
                <Link href="/onboarding" onClick={() => setMenuOpen(false)}>
                  Change audience / persona
                </Link>
                <Link href="/help" onClick={() => setMenuOpen(false)}>
                  Instructions &amp; help
                </Link>
                <button type="button" onClick={logout}>
                  Sign out
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <style jsx global>{`
        .account-menu-wrap {
          position: relative;
        }
        .account-avatar {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: var(--brand);
          color: #fff;
          border: none;
          cursor: pointer;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 0.02em;
        }
        .account-avatar:hover {
          background: var(--brand-ink);
        }
        .account-menu {
          position: absolute;
          right: 0;
          top: calc(100% + 10px);
          background: var(--bg);
          border: 1px solid var(--line-200);
          border-radius: 14px;
          box-shadow: 0 12px 32px rgba(11, 35, 33, 0.14);
          display: flex;
          flex-direction: column;
          min-width: 220px;
          z-index: 20;
          overflow: hidden;
        }
        .account-menu-header {
          padding: 12px 14px;
          border-bottom: 1px solid var(--line-100);
          background: var(--bg-alt);
        }
        .account-menu-email {
          font-size: 12.5px;
          font-weight: 700;
          color: var(--ink-800);
        }
        .account-menu-persona {
          font-size: 11px;
          font-weight: 500;
          color: var(--ink-500);
          margin-top: 2px;
        }
        .account-menu a,
        .account-menu button {
          text-align: left;
          padding: 10px 14px;
          font-size: 12.5px;
          color: var(--ink-700);
          background: none;
          border: none;
          cursor: pointer;
        }
        .account-menu a:hover,
        .account-menu button:hover {
          background: var(--bg-alt);
        }
        .nav-search {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0;
          width: 36px;
          height: 36px;
          flex-shrink: 0;
          padding: 0;
          border: 1px solid var(--line-200);
          border-radius: 999px;
          background: var(--bg-alt);
          color: var(--ink-500);
          overflow: hidden;
          transition: width 0.18s ease;
        }
        .nav-search:focus-within {
          width: 180px;
          justify-content: flex-start;
          padding: 0 10px;
          border-color: var(--accent-border);
          box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.08);
        }
        .nav-search svg {
          width: 14px;
          height: 14px;
          flex-shrink: 0;
        }
        .nav-search input {
          width: 0;
          opacity: 0;
          border: none;
          background: transparent;
          color: var(--ink-800);
          font-size: 12.5px;
          outline: none;
          min-width: 0;
          transition: width 0.18s ease, opacity 0.18s ease;
        }
        .nav-search:focus-within input {
          width: 100%;
          opacity: 1;
          margin-left: 6px;
        }
        .nav-search input::placeholder {
          color: var(--ink-400);
        }
        .nav-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .pipeline-indicator {
          font-size: 11.5px;
          font-weight: 600;
          color: var(--ink-500);
          white-space: nowrap;
          padding: 6px 4px;
        }
        .pipeline-indicator:hover {
          color: var(--favour);
          text-decoration: none;
        }
        @media (max-width: 700px) {
          .pipeline-indicator {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
