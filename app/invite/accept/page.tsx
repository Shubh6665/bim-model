"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession, signIn, signOut } from "next-auth/react";

function AcceptInviteContent() {
  const params = useSearchParams();
  const router = useRouter();
  const { status: authStatus } = useSession();

  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    const token = params.get("token");
    const projectId = params.get("projectId");

    if (!token || !projectId) {
      setStatus("error");
      setMessage("Missing token or projectId in URL.");
      return;
    }

    const accept = async () => {
      try {
        setStatus("loading");
        const res = await fetch(`/api/invites/accept?token=${encodeURIComponent(token)}&projectId=${encodeURIComponent(projectId)}`);
        const json = await res.json();

        // Require auth with invited email
        if (res.status === 401 && json?.requiresAuth) {
          const invitedEmail = json?.invitedEmail as string | undefined;
          const callbackUrl = typeof window !== "undefined" ? window.location.href : `/invite/accept?token=${encodeURIComponent(token)}&projectId=${encodeURIComponent(projectId)}`;
          const lower = (invitedEmail || '').toLowerCase();
          const isGmail = lower.endsWith('@gmail.com') || lower.endsWith('@googlemail.com');
          if (isGmail) {
            // Show auth panel with invited email and a retry option; avoid auto-trigger loop
            router.replace(`/?mode=login&email=${encodeURIComponent(invitedEmail || '')}&token=${encodeURIComponent(token)}${projectId ? `&projectId=${encodeURIComponent(projectId)}` : ''}&wrong=1`);
          } else if (invitedEmail) {
            // Non-Google email: check if user exists → route to homepage auth panel with mode
            try {
              const existsRes = await fetch(`/api/users/exists?email=${encodeURIComponent(invitedEmail)}`);
              const existsJson = await existsRes.json();
              const userExists = !!existsJson?.exists;
              const mode = userExists ? 'login' : 'signup';
              router.replace(`/?mode=${mode}&email=${encodeURIComponent(invitedEmail)}&token=${encodeURIComponent(token)}${projectId ? `&projectId=${encodeURIComponent(projectId)}` : ''}`);
            } catch {
              // Fallback to signup mode on homepage
              router.replace(`/?mode=signup&email=${encodeURIComponent(invitedEmail)}&token=${encodeURIComponent(token)}${projectId ? `&projectId=${encodeURIComponent(projectId)}` : ''}`);
            }
          } else {
            // Fallback to generic login page
            await signIn(undefined, { callbackUrl } as any);
          }
          return;
        }
        // Wrong account signed in: sign out and prompt correct one
        if (res.status === 403 && json?.error === 'wrong_account') {
          const invitedEmail = json?.invitedEmail as string | undefined;
          const callbackUrl = typeof window !== "undefined" ? window.location.href : `/invite/accept?token=${encodeURIComponent(token)}&projectId=${encodeURIComponent(projectId)}`;
          await signOut({ redirect: false });
          const lower = (invitedEmail || '').toLowerCase();
          const isGmail = lower.endsWith('@gmail.com') || lower.endsWith('@googlemail.com');
          if (isGmail) {
            await signIn("google", {
              callbackUrl,
              login_hint: invitedEmail,
              prompt: "select_account",
            } as any);
          } else if (invitedEmail) {
            // Non-Google email: check if user exists → route to homepage auth panel with mode
            try {
              const existsRes = await fetch(`/api/users/exists?email=${encodeURIComponent(invitedEmail)}`);
              const existsJson = await existsRes.json();
              const userExists = !!existsJson?.exists;
              const mode = userExists ? 'login' : 'signup';
              router.replace(`/?mode=${mode}&email=${encodeURIComponent(invitedEmail)}&token=${encodeURIComponent(token)}${projectId ? `&projectId=${encodeURIComponent(projectId)}` : ''}`);
            } catch {
              router.replace(`/?mode=signup&email=${encodeURIComponent(invitedEmail)}&token=${encodeURIComponent(token)}${projectId ? `&projectId=${encodeURIComponent(projectId)}` : ''}`);
            }
          } else {
            await signIn(undefined, { callbackUrl } as any);
          }
          return;
        }

        if (!res.ok || !json.success) {
          throw new Error(json.error || "Failed to accept invite");
        }
        setStatus("success");
        setMessage("Invitation accepted. Redirecting to dashboard...");
        setTimeout(() => router.replace("/dashboard"), 1500);
      } catch (e: any) {
        setStatus("error");
        setMessage(e?.message || "Failed to accept invite");
      }
    };

    // If not authenticated, we still call accept(); server will respond 401 with invitedEmail and we will redirect with login_hint.
    if (authStatus === "authenticated") {
      accept();
    }
    if (authStatus === "unauthenticated") {
      accept();
    }
  }, [params, router, authStatus]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0b0b0b", color: "#eee" }}>
      <div style={{ maxWidth: 520, width: "100%", padding: 24, background: "#111827", border: "1px solid #1f2937", borderRadius: 12 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Accepting Invitation</h1>
        {status === "loading" && <p>Processing your invite…</p>}
        {status === "success" && <p>{message}</p>}
        {status === "error" && (
          <div>
            <p style={{ color: "#fca5a5" }}>{message}</p>
            <p style={{ marginTop: 12 }}>
              You can return to the <a href="/dashboard" style={{ color: "#60a5fa" }}>dashboard</a>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0b0b0b", color: "#eee" }}>
        <div style={{ maxWidth: 520, width: "100%", padding: 24, background: "#111827", border: "1px solid #1f2937", borderRadius: 12 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Loading...</h1>
          <p>Preparing invitation acceptance...</p>
        </div>
      </div>
    }>
      <AcceptInviteContent />
    </Suspense>
  );
}
