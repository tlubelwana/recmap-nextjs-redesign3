"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import SignalPinMark from "@/components/SignalPinMark";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const responseText = await res.text();
      let data: { error?: string } = {};
      try {
        data = responseText ? (JSON.parse(responseText) as { error?: string }) : {};
      } catch {
        throw new Error(`Sign-in failed (${res.status}). The server returned an invalid response.`);
      }
      if (!res.ok) throw new Error(data?.error || "Couldn't sign in.");
      try {
        window.localStorage.removeItem("recmap-ask-state");
        window.localStorage.removeItem("recmap-last-map-context");
      } catch {
        /* ignore */
      }
      router.push("/onboarding");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't sign in.");
      setPending(false);
    }
  }

  async function enterDemo() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/demo", { method: "POST" });
      const responseText = await res.text();
      const data = responseText ? (JSON.parse(responseText) as { error?: string }) : {};
      if (!res.ok) throw new Error(data.error || "Couldn't start demo access.");
      router.push("/ask");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start demo access.");
      setPending(false);
    }
  }

  return (
    <div className="auth-card">
      <div className="auth-brand-row">
        <SignalPinMark size={30} />
        <span className="wordmark auth-brand">RecMap</span>
      </div>
      <h1 className="auth-h1">Sign in</h1>
      <p className="auth-sub">Use the email and password you signed up with.</p>
      <form onSubmit={onSubmit} className="auth-form">
        <label>
          Email
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoFocus />
        </label>
        <label>
          Password
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        {error && <p className="auth-error">{error}</p>}
        <button type="submit" className="btn-primary auth-submit" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
      {DEMO_MODE && (
        <button type="button" className="btn-outline auth-submit" onClick={enterDemo} disabled={pending}>
          Continue as demo
        </button>
      )}
      <p className="auth-switch">
        No account yet? <Link href="/signup">Create one</Link>
      </p>
      <p className="auth-footnote">
        There is no “forgot password” flow yet — this app has no email service connected. See the{" "}
        <Link href="/help#accounts">instructions</Link> for what to do if you&rsquo;re locked out.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="auth-page">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
      <style jsx global>{`
        .auth-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-alt);
          padding: 24px;
        }
        .auth-card {
          width: 100%;
          max-width: 380px;
          background: var(--bg);
          border: 1px solid var(--line-200);
          border-radius: 16px;
          padding: 32px 28px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.06);
        }
        .auth-brand {
          font-size: 20px;
          font-weight: 800;
          color: var(--brand);
          display: block;
        }
        .auth-h1 {
          font-size: 22px;
          font-weight: 700;
          color: var(--ink-900);
          margin: 14px 0 4px;
        }
        .auth-sub {
          font-size: 13px;
          color: var(--ink-500);
          margin: 0 0 20px;
        }
        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .auth-form label {
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 12.5px;
          font-weight: 600;
          color: var(--ink-700);
        }
        .auth-form input {
          font: inherit;
          font-size: 14px;
          padding: 10px 12px;
          border: 1px solid var(--line-200);
          border-radius: 8px;
          background: var(--bg);
          color: var(--ink-900);
        }
        .auth-form input:focus {
          outline: none;
          border-color: var(--brand);
        }
        .auth-error {
          font-size: 12.5px;
          color: var(--against);
          margin: 0;
        }
        .auth-submit {
          margin-top: 4px;
          justify-content: center;
        }
        .auth-switch {
          text-align: center;
          font-size: 13px;
          color: var(--ink-600);
          margin-top: 18px;
        }
        .auth-footnote {
          font-size: 11px;
          line-height: 1.6;
          color: var(--ink-500);
          margin-top: 16px;
          padding-top: 14px;
          border-top: 1px solid var(--line-100);
        }
      `}</style>
    </div>
  );
}
