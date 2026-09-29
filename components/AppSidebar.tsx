"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Persona } from "@/lib/db";
import { getLens } from "@/lib/audienceLens";
import { useAudienceLens } from "@/components/LensProvider";

/**
 * The v3 shell's primary navigation: a dark-teal rail down the left side,
 * replacing the horizontal tab bar the app used through v2. Route list and
 * order are unchanged from the old NavBar TABS array — this is a visual
 * restructure, not a change to the information architecture.
 *
 * Icons are hand-rolled 20px stroke SVGs rather than an icon package: no
 * icon library is installed and the environment can't reliably add one
 * (see lib/db.ts on why npm installs are unavailable here), so the same
 * approach the analytics page takes for charts applies here.
 */

function initials(email: string): string {
  const name = email.split("@")[0] || email;
  const parts = name.split(/[._-]+/).filter(Boolean);
  const chars = parts.length >= 2 ? parts[0][0] + parts[1][0] : name.slice(0, 2);
  return chars.toUpperCase();
}

type IconProps = { d: string[] };

function Icon({ d }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {d.map((path, i) => (
        <path key={i} d={path} />
      ))}
    </svg>
  );
}

const ICONS: Record<string, string[]> = {
  home: ["M3 10.5 12 3l9 7.5", "M5 9.5V21h14V9.5", "M10 21v-6h4v6"],
  ask: ["M21 12a8 8 0 0 1-8 8H7l-4 3v-7.5A8 8 0 0 1 11 4h2a8 8 0 0 1 8 8Z", "M9.5 10a2.5 2.5 0 1 1 3 2.45V14"],
  map: ["M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5Z", "M9 4v13", "M15 6.5v13"],
  contextualise: ["M12 3v18", "M4 8h16", "M7 8l-3 6a3.2 3.2 0 0 0 6 0Z", "M17 8l-3 6a3.2 3.2 0 0 0 6 0Z"],
  implement: [
    "M14.5 5.5a3.5 3.5 0 0 0 4.6 4.6l-8.6 8.6a2.2 2.2 0 0 1-3.1-3.1Z",
    "M5 19l1.5-1.5",
  ],
  catalog: ["M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5Z", "M4 5.5v15", "M8 7.5h8"],
  reports: [
    "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z",
    "M14 3v5h5",
    "M9 13h6M9 16.5h4",
  ],
  charts: ["M4 20V10", "M10 20V4", "M16 20v-7", "M3 20h18"],
  history: ["M3.5 12a8.5 8.5 0 1 0 2.6-6.1", "M3.5 4.5V9H8", "M12 8v4.5l3 1.8"],
  upload: ["M12 16V4", "M8 7.5 12 3.5l4 4", "M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"],
  about: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M12 11v6", "M12 7.6v.6"],
  features: [
    "M12 3.5 13.9 8l4.6 1.9-4.6 1.9L12 16.4 10.1 11.8 5.5 9.9 10.1 8Z",
    "M18.5 16.5l.7 1.7 1.8.8-1.8.8-.7 1.7-.7-1.7-1.8-.8 1.8-.8Z",
  ],
  help: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M9.4 9.4a2.7 2.7 0 1 1 3.6 2.5c-.6.3-1 .8-1 1.5v.5", "M12 17.2v.5"],
  settings: ["M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z", "M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2 2 2 0 1 1-4 0 1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 15a2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 4a2 2 0 1 1 4 0a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 21 11a2 2 0 1 1 0 4Z"],
};

interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
}

/**
 * HOME sits above the groups, the way a home affordance usually does.
 *
 * NOTE: app/(authed)/(main)/page.tsx currently redirects to /ask, so this
 * row and Ask land on the same screen. It's kept because people look for a
 * home button and the wordmark alone isn't an obvious one — but the two
 * rows will stay redundant until "/" becomes a landing page of its own.
 * The selected-state logic below reflects that: with the redirect in
 * place, `pathname` is never "/", so Ask is what highlights.
 */
const HOME: NavItem = { href: "/", label: "Home", icon: "home" };

/**
 * WORKFLOW — the path through a single question, in the order it's walked:
 * ask it, look at what came back, decide whether it transfers to your
 * setting, work out what implementing it would take, then write it up.
 */
const WORKFLOW: NavItem[] = [
  { href: "/ask", label: "Ask", icon: "ask" },
  { href: "/map", label: "Explore", icon: "map" },
  { href: "/contextualisation", label: "Contextualise", icon: "contextualise" },
  { href: "/implementation", label: "Implement", icon: "implement" },
  { href: "/reports", label: "Reports", icon: "reports" },
];

/** LIBRARY — the whole collection and your own history with it, rather
 *  than steps in answering one question. */
const LIBRARY: NavItem[] = [
  { href: "/catalog", label: "Catalog", icon: "catalog" },
  { href: "/history", label: "History", icon: "history" },
  // Upload is an intake explainer, not a working step, and it only tells a
  // full story where controlled intake is switched on.
  { href: "/upload", label: "Upload", icon: "upload" },
];

/** REFERENCE — what this is and how to use it. */
const REFERENCE: NavItem[] = [
  { href: "/about", label: "About", icon: "about" },
  { href: "/features", label: "New features", icon: "features" },
  { href: "/help", label: "Instructions", icon: "help" },
];

export default function AppSidebar({
  userEmail,
  persona,
}: {
  userEmail?: string;
  persona?: Persona | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { lens } = useAudienceLens();
  const [menuOpen, setMenuOpen] = useState(false);

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

  function renderItem(item: NavItem) {
    const selected = pathname === item.href || (item.href === "/ask" && pathname === "/");
    return (
      <Link
        key={item.href}
        href={item.href}
        className="rail-item"
        aria-current={selected ? "page" : undefined}
      >
        <span className="rail-icon">
          <Icon d={ICONS[item.icon]} />
        </span>
        <span className="rail-label">{item.label}</span>
      </Link>
    );
  }

  return (
    <aside className="app-rail">
      <Link href="/ask" className="rail-brand" aria-label="RecMap home">
        <span className="rail-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 2.6c-3.6 0-6.5 2.9-6.5 6.5 0 4.7 6.5 12.3 6.5 12.3s6.5-7.6 6.5-12.3c0-3.6-2.9-6.5-6.5-6.5Z"
              fill="currentColor"
            />
            <path
              d="M9.2 9.3l2 2 3.6-3.6"
              stroke="#0d4d50"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className="rail-wordmark">RecMap</span>
      </Link>

      <nav className="rail-nav" aria-label="Main">
        {renderItem(HOME)}
        <div className="rail-divider" role="presentation" />
        <div className="rail-group-label">Workflow</div>
        {WORKFLOW.map(renderItem)}
        <div className="rail-divider" role="presentation" />
        <div className="rail-group-label">Library</div>
        {LIBRARY.map(renderItem)}
        <div className="rail-divider" role="presentation" />
        <div className="rail-group-label">Reference</div>
        {REFERENCE.map(renderItem)}
      </nav>

      <div className="rail-foot">
        {userEmail && (
          <div className="rail-account">
            <button
              type="button"
              className="rail-account-btn"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
            >
              <span className="rail-avatar">{initials(userEmail)}</span>
              <span className="rail-account-text">
                <span className="rail-account-name">{userEmail.split("@")[0]}</span>
                <span className="rail-account-sub">{persona ? getLens(persona).label : lens.label}</span>
              </span>
              <svg
                className={`rail-chevron${menuOpen ? " open" : ""}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            {menuOpen && (
              <div className="rail-menu">
                <div className="rail-menu-email">{userEmail}</div>
                <Link href="/onboarding" onClick={() => setMenuOpen(false)}>
                  Change audience
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
    </aside>
  );
}
