"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import SignalPinMark from "@/components/SignalPinMark";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setPending(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const responseText = await res.text();
      let data: { error?: string } = {};
      try {
        data = responseText ? (JSON.parse(responseText) as { error?: string }) : {};
      } catch {
        throw new Error(`Signup failed (${res.status}). The server returned an invalid response.`);
      }
      if (!res.ok) throw new Error(data?.error || "Couldn't create your account.");
      try {
        window.localStorage.removeItem("recmap-ask-state");
        window.localStorage.removeItem("recmap-last-map-context");
      } catch {
        /* ignore */
      }
      router.push("/onboarding");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create your account.");
      setPending(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand-row">
          <SignalPinMark size={30} />
          <span className="wordmark auth-brand">RecMap</span>
        </div>
        <h1 className="auth-h1">Create your account</h1>
        <p className="auth-sub">
          Instant activation — there&rsquo;s no verification email, because this app doesn&rsquo;t have an email
          service connected. Use a password you&rsquo;ll remember; there&rsquo;s no reset flow yet either.
        </p>
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
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </label>
          <label>
            Confirm password
            <input
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </label>
          {error && <p className="auth-error">{error}</p>}
          <button type="submit" className="btn-primary auth-submit" disabled={pending}>
            {pending ? "Creating account…" : "Create account"}
          </button>
        </form>
        <p className="auth-switch">
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </div>
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
          font-size: 12.5px;
          line-height: 1.55;
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
      `}</style>
    </div>
  );
}
