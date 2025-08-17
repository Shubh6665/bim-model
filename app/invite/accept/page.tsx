"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession, signIn } from "next-auth/react";

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

    // If not authenticated, go to sign-in first and come back here
    if (authStatus === "unauthenticated") {
      const callbackUrl = typeof window !== "undefined" ? window.location.href : `/invite/accept?token=${encodeURIComponent(token)}&projectId=${encodeURIComponent(projectId)}`;
      signIn("google", { callbackUrl });
      return;
    }
    if (authStatus === "authenticated") {
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
