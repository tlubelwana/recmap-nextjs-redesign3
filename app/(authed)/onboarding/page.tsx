"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Persona } from "@/lib/db";
import { AUDIENCE_LIST, AUDIENCE_ORDER } from "@/lib/audienceLens";

/**
 * A first-use (and revisitable, via /onboarding directly) self-identification
 * step. Instead of a 1-5 Likert grid, the user selects any audiences that
 * describe them. The first selected audience becomes the primary lens, while
 * the full list is saved as the user's available persona set.
 *
 * The audiences, their descriptions, and the question each one is asking all
 * come from lib/audienceLens.ts — the same definitions that drive what the
 * detail view shows, how the Map arranges itself, and how Ask phrases an
 * answer. There is no second list to keep in sync.
 *
 * The answer sets the account's saved audience. It is not a lock-in: every
 * page carries a lens switcher, so any user can read the same record through
 * another audience's eyes without changing this.
 */
const AUDIENCES = AUDIENCE_LIST;

export default function OnboardingPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<Record<Persona, boolean>>(
    () => Object.fromEntries(AUDIENCE_ORDER.map((k) => [k, false])) as Record<(typeof AUDIENCES)[number]["key"], boolean>
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const selectedPersonas = AUDIENCE_ORDER.filter((key) => selected[key]);
  const hasSelection = selectedPersonas.length > 0;

  async function onSubmit() {
    if (!hasSelection) {
      setError("Select at least one audience before continuing.");
      return;
    }

    const personas = selectedPersonas;
    const persona = personas[0];
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/persona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona, personas }),
      });
      if (!res.ok) throw new Error((await res.json())?.error || "Couldn't save your answer.");
      router.push("/ask");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your answer.");
      setPending(false);
    }
  }

  return (
    <div className="onb-page">
      <div className="onb-card">
        <span className="eyebrow">Before we start</span>
        <h1 className="onb-h1">Which of these describes you?</h1>
        <p className="onb-sub">
          Select one or more audiences that fit you. RecMap uses your primary selection to decide which parts of a
          guideline you see first, how they&rsquo;re worded, how the Map arranges itself, and how Ask phrases an
          answer. You can switch to another audience&rsquo;s view at any time from the bar at the top of every page,
          and change this answer from your account menu.
        </p>

        <div className="onb-table-wrap">
          <table className="onb-table">
            <thead>
              <tr>
                <th scope="col" className="onb-th-audience">
                  Audience
                </th>
                <th scope="col" className="onb-th-select">
                  Select
                </th>
              </tr>
            </thead>
            <tbody>
              {AUDIENCES.map((a) => (
                <tr key={a.key}>
                  <th scope="row" className="onb-row-label">
                    <div className="onb-row-title">{a.label}</div>
                    <div className="onb-row-desc">{a.description}</div>
                    <div className="onb-row-q">&ldquo;{a.question}&rdquo;</div>
                  </th>
                  <td className="onb-select-cell">
                    <input
                      type="checkbox"
                      name={`persona-${a.key}`}
                      aria-label={`Select ${a.label}`}
                      checked={selected[a.key]}
                      onChange={() => setSelected((prev) => ({ ...prev, [a.key]: !prev[a.key] }))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {error && <p className="onb-error">{error}</p>}
        <button type="button" className="btn-primary onb-continue" onClick={onSubmit} disabled={pending}>
          {pending ? "Saving…" : "Continue"}
        </button>
      </div>

      <style jsx global>{`
        .onb-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-alt);
          padding: 24px;
        }
        .onb-card {
          width: 100%;
          max-width: 720px;
          background: var(--bg);
          border: 1px solid var(--line-200);
          border-radius: 16px;
          padding: 32px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.06);
        }
        .onb-h1 {
          font-size: 22px;
          font-weight: 700;
          color: var(--ink-900);
          margin: 8px 0 8px;
        }
        .onb-sub {
          font-size: 13px;
          line-height: 1.6;
          color: var(--ink-500);
          margin: 0 0 22px;
        }
        .onb-table-wrap {
          overflow-x: auto;
          margin-bottom: 20px;
        }
        .onb-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12.5px;
        }
        .onb-table th,
        .onb-table td {
          padding: 10px 8px;
          text-align: left;
          border-bottom: 1px solid var(--line-100);
          vertical-align: middle;
        }
        .onb-th-audience {
          text-align: left;
          min-width: 220px;
        }
        .onb-th-select {
          width: 86px;
          text-align: left;
        }
        thead th {
          font-weight: 600;
          color: var(--ink-500);
          font-size: 11px;
        }
        .onb-row-label {
          text-align: left;
          padding: 12px 8px;
        }
        .onb-row-title {
          font-weight: 700;
          color: var(--ink-900);
          font-size: 13px;
        }
        .onb-row-desc {
          font-weight: 400;
          color: var(--ink-500);
          font-size: 11.5px;
          line-height: 1.5;
          margin-top: 3px;
          max-width: 260px;
        }
        .onb-row-q {
          font-weight: 500;
          color: var(--ink-400);
          font-size: 11px;
          line-height: 1.45;
          margin-top: 4px;
          max-width: 260px;
          font-style: italic;
        }
        .onb-table input[type="checkbox"] {
          width: 17px;
          height: 17px;
          cursor: pointer;
        }
        .onb-select-cell {
          width: 86px;
          text-align: left;
        }
        .onb-error {
          font-size: 12.5px;
          color: var(--against);
          margin: 0 0 12px;
        }
        .onb-continue {
          justify-content: center;
        }
      `}</style>
    </div>
  );
}
