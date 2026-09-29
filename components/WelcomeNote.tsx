"use client";

import Link from "next/link";
import { useState } from "react";

/** Shown once per account (server decides whether to render this at all,
 *  based on user.welcomeSeen — see app/(authed)/layout.tsx), pointing new
 *  users at the instruction manual before they start clicking around. */
export default function WelcomeNote() {
  const [dismissed, setDismissed] = useState(false);
  const [pending, setPending] = useState(false);

  if (dismissed) return null;

  async function dismiss() {
    setPending(true);
    setDismissed(true); // optimistic — don't make the user wait on the network
    try {
      await fetch("/api/auth/welcome-seen", { method: "POST" });
    } catch {
      // Best-effort — worst case it shows again next session, which is fine.
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="welcome-note">
      <div>
        <b>Welcome to RecMap.</b> It appraises AI-related recommendations in clinical practice guidelines and lets
        you ask plain-language questions about them.{" "}
        <Link href="/help">Read the instructions</Link> for a full walkthrough, including what RecMap can and
        can&rsquo;t reliably answer.
      </div>
      <button type="button" onClick={dismiss} disabled={pending} aria-label="Dismiss welcome note">
        ✕
      </button>
      <style jsx global>{`
        .welcome-note {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          background: var(--accent-bg);
          border: 1px solid var(--accent-border);
          color: var(--ink-700);
          border-radius: 10px;
          padding: 12px 14px;
          font-size: 13px;
          line-height: 1.6;
          margin: 16px 24px 0;
        }
        .welcome-note button {
          background: none;
          border: none;
          color: var(--ink-500);
          cursor: pointer;
          font-size: 14px;
          padding: 0 2px;
          flex-shrink: 0;
        }
      `}</style>
    </div>
  );
}
