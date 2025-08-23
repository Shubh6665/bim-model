"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      const callbackUrl = "/dashboard";
      const res = await signIn("email", { email, callbackUrl, redirect: false });
      if (res?.ok) {
        setSent(true);
      } else {
        setError(res?.error || "Failed to send magic link. Please try again.");
      }
    } catch (err: any) {
      setError(err?.message || "Something went wrong.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0b0b0b", color: "#eee" }}>
      <div style={{ width: 420, maxWidth: "90%", background: "#111827", border: "1px solid #1f2937", borderRadius: 12, padding: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>Sign in</h1>

        <button
          onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
          style={{ width: "100%", background: "#2563eb", color: "#fff", padding: "10px 16px", borderRadius: 8, border: 0, cursor: "pointer", fontWeight: 600 }}
        >
          Continue with Google
        </button>

        <div style={{ height: 16 }} />

        <div style={{ opacity: 0.7, fontSize: 12, textAlign: "center" }}>or</div>

        <div style={{ height: 16 }} />

        {sent ? (
          <div style={{ background: "#064e3b", border: "1px solid #065f46", color: "#d1fae5", padding: 12, borderRadius: 8 }}>
            We sent a magic link to <b>{email}</b>. Check your inbox.
          </div>
        ) : (
          <form onSubmit={onEmailSignIn}>
            <label htmlFor="email" style={{ display: "block", fontSize: 14, marginBottom: 6 }}>Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              required
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #374151", background: "#0f172a", color: "#e5e7eb" }}
            />
            <div style={{ height: 12 }} />
            <button
              type="submit"
              disabled={sending}
              style={{ width: "100%", background: sending ? "#4b5563" : "#10b981", color: "#0b0b0b", padding: "10px 16px", borderRadius: 8, border: 0, cursor: sending ? "default" : "pointer", fontWeight: 700 }}
            >
              {sending ? "Sending…" : "Send magic link"}
            </button>
          </form>
        )}

        {error && (
          <div style={{ marginTop: 12, background: "#7f1d1d", border: "1px solid #991b1b", color: "#fee2e2", padding: 10, borderRadius: 8 }}>{error}</div>
        )}

        <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
          You can sign in with any email domain. If your email is Gmail, you can also use Google sign-in.
        </div>
      </div>
    </div>
  );
}
