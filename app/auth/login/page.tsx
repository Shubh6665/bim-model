"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";

export default function LoginPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const qpEmail = sp.get("email") || "";
  const token = sp.get("token") || "";
  const projectId = sp.get("projectId") || "";

  const [email, setEmail] = useState(qpEmail);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-trigger Google for Gmail invited emails
  const autoRef = useRef(false);
  useEffect(() => {
    if (autoRef.current) return;
    const lower = (qpEmail || '').toLowerCase();
    const isGmail = /@gmail\.com$|@googlemail\.com$/i.test(lower);
    if (token && isGmail) {
      autoRef.current = true;
      const callbackUrl = `/invite/accept?token=${encodeURIComponent(token)}${projectId ? `&projectId=${encodeURIComponent(projectId)}` : ''}`;
      signIn("google", { callbackUrl, login_hint: qpEmail, prompt: 'select_account' } as any);
    }
  }, [token, qpEmail, projectId]);

  const onCredentialsSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await signIn("credentials", { email, password, redirect: false, callbackUrl: "/dashboard" });
      if (res?.ok) {
        // If this login came from an invite, finalize acceptance before redirecting
        if (token) {
          try {
            const acceptUrl = `/api/invites/accept?token=${encodeURIComponent(token)}${projectId ? `&projectId=${encodeURIComponent(projectId)}` : ""}`;
            await fetch(acceptUrl);
          } catch {}
        }
        window.location.href = "/dashboard";
      } else {
        setError(res?.error || "Invalid email or password.");
      }
    } catch (err: any) {
      setError(err?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0b0b0b", color: "#eee" }}>
      <div style={{ width: 420, maxWidth: "90%", background: "#111827", border: "1px solid #1f2937", borderRadius: 12, padding: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>Sign in</h1>

        <button
          onClick={() => {
            const callbackUrl = token
              ? `/invite/accept?token=${encodeURIComponent(token)}${projectId ? `&projectId=${encodeURIComponent(projectId)}` : ''}`
              : "/dashboard";
            signIn("google", { callbackUrl });
          }}
          style={{ width: "100%", background: "#2563eb", color: "#fff", padding: "10px 16px", borderRadius: 8, border: 0, cursor: "pointer", fontWeight: 600 }}
        >
          Continue with Google
        </button>

        <div style={{ height: 16 }} />
        <div style={{ opacity: 0.7, fontSize: 12, textAlign: "center" }}>or</div>
        <div style={{ height: 16 }} />

        <form onSubmit={onCredentialsSignIn}>
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
          <label htmlFor="password" style={{ display: "block", fontSize: 14, marginBottom: 6 }}>Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #374151", background: "#0f172a", color: "#e5e7eb" }}
          />
          <div style={{ height: 12 }} />
          <button
            type="submit"
            disabled={loading}
            style={{ width: "100%", background: loading ? "#4b5563" : "#10b981", color: "#0b0b0b", padding: "10px 16px", borderRadius: 8, border: 0, cursor: loading ? "default" : "pointer", fontWeight: 700 }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        {error && (
          <div style={{ marginTop: 12, background: "#7f1d1d", border: "1px solid #991b1b", color: "#fee2e2", padding: 10, borderRadius: 8 }}>{error}</div>
        )}

        <div style={{ marginTop: 12, fontSize: 12, opacity: 0.9 }}>
          New here? <Link href="/auth/signup" style={{ color: "#93c5fd", textDecoration: "underline" }}>Create an account</Link>
        </div>
      </div>
    </div>
  );
}
