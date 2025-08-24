"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

function SignupForm() {
  const sp = useSearchParams();
  const router = useRouter();

  const invitedEmail = sp.get("email");
  const inviteToken = sp.get("token");
  const projectId = sp.get("projectId");

  const [email, setEmail] = useState(invitedEmail || "");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [otp, setOtp] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const isInviteFlow = useMemo(() => Boolean(invitedEmail && inviteToken), [invitedEmail, inviteToken]);

  useEffect(() => {
    if (invitedEmail) setEmail(invitedEmail);
  }, [invitedEmail]);

  const sendOtp = async () => {
    setError(null);
    setInfo(null);
    if (!email) return setError("Email required");
    setSendingOtp(true);
    try {
      const res = await fetch("/api/auth/otp/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to send OTP");
      setInfo("OTP sent. Check your email.");
    } catch (e: any) {
      setError(e?.message || "Failed to send OTP");
    } finally {
      setSendingOtp(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (password.length < 6) return setError("Password must be at least 6 characters");
    if (password !== confirm) return setError("Passwords do not match");
    setLoading(true);
    try {
      const payload: any = {
        email,
        password,
        firstName,
        lastName,
      };
      if (isInviteFlow) {
        payload.inviteToken = inviteToken;
        payload.projectId = projectId;
      } else {
        payload.requireOtp = true;
        payload.otpCode = otp;
      }
      const res = await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Signup failed");

      // Login with the same email
      const login = await signIn("credentials", { email, password, redirect: false });
      if (!login?.ok) throw new Error(login?.error || "Login failed");

      // If invite, call accept endpoint to finalize (idempotent)
      if (isInviteFlow && inviteToken) {
        await fetch(`/api/invites/accept?token=${encodeURIComponent(inviteToken)}${projectId ? `&projectId=${encodeURIComponent(projectId!)}` : ""}`);
      }

      window.location.href = "/dashboard";
    } catch (e: any) {
      setError(e?.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0b0b0b", color: "#eee" }}>
      <div style={{ width: 480, maxWidth: "95%", background: "#111827", border: "1px solid #1f2937", borderRadius: 12, padding: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>Create your account</h1>
        {isInviteFlow ? (
          <div style={{ marginBottom: 12, background: "#0c4a6e", border: "1px solid #075985", color: "#e0f2fe", padding: 10, borderRadius: 8 }}>
            You are accepting an invitation for <b>{invitedEmail}</b>. Email is locked.
          </div>
        ) : (
          <div style={{ marginBottom: 12, background: "#0f766e", border: "1px solid #115e59", color: "#ccfbf1", padding: 10, borderRadius: 8 }}>
            Verify your email with an OTP to complete signup.
          </div>
        )}

        <form onSubmit={onSubmit}>
          <label htmlFor="email" style={{ display: "block", fontSize: 14, marginBottom: 6 }}>Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@company.com"
            required
            disabled={isInviteFlow}
            style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #374151", background: isInviteFlow ? "#0b1224" : "#0f172a", color: "#e5e7eb" }}
          />

          <div style={{ display: isInviteFlow ? 'none' : 'block' }}>
            <div style={{ height: 10 }} />
            <button type="button" onClick={sendOtp} disabled={sendingOtp || !email} style={{ background: sendingOtp ? '#4b5563' : '#334155', color: '#e5e7eb', border: 0, padding: '8px 12px', borderRadius: 8 }}>
              {sendingOtp ? 'Sending OTP…' : 'Send OTP'}
            </button>
            <div style={{ height: 10 }} />
            <label htmlFor="otp" style={{ display: "block", fontSize: 14, marginBottom: 6 }}>OTP</label>
            <input id="otp" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="6-digit code" style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #374151", background: "#0f172a", color: "#e5e7eb" }} />
          </div>

          <div style={{ height: 12 }} />
          <label htmlFor="firstName" style={{ display: "block", fontSize: 14, marginBottom: 6 }}>First name</label>
          <input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="John" style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #374151", background: "#0f172a", color: "#e5e7eb" }} />

          <div style={{ height: 12 }} />
          <label htmlFor="lastName" style={{ display: "block", fontSize: 14, marginBottom: 6 }}>Last name</label>
          <input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #374151", background: "#0f172a", color: "#e5e7eb" }} />

          <div style={{ height: 12 }} />
          <label htmlFor="password" style={{ display: "block", fontSize: 14, marginBottom: 6 }}>Password</label>
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #374151", background: "#0f172a", color: "#e5e7eb" }} />

          <div style={{ height: 12 }} />
          <label htmlFor="confirm" style={{ display: "block", fontSize: 14, marginBottom: 6 }}>Confirm password</label>
          <input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" required style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #374151", background: "#0f172a", color: "#e5e7eb" }} />

          {error && <div style={{ marginTop: 12, background: '#7f1d1d', border: '1px solid #991b1b', color: '#fee2e2', padding: 10, borderRadius: 8 }}>{error}</div>}
          {info && <div style={{ marginTop: 12, background: '#064e3b', border: '1px solid #065f46', color: '#d1fae5', padding: 10, borderRadius: 8 }}>{info}</div>}

          <div style={{ height: 16 }} />
          <button type="submit" disabled={loading} style={{ width: '100%', background: loading ? '#4b5563' : '#10b981', color: '#0b0b0b', padding: '10px 16px', borderRadius: 8, border: 0, cursor: loading ? 'default' : 'pointer', fontWeight: 700 }}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0b0b0b", color: "#eee" }}>
        <div>Loading...</div>
      </div>
    }>
      <SignupForm />
    </Suspense>
  );
}
