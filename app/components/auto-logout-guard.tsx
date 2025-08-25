"use client";

import { useEffect } from "react";

// AutoLogoutGuard: ensures session is cleared when the tab/window is closed
// and provides a helper to force-clear cookies server-side when unload happens.
export default function AutoLogoutGuard() {
  useEffect(() => {
    const endpoint = "/api/auth/force-logout";
    let sent = false;

    const logoutWithBeacon = () => {
      if (sent) return;
      // Skip during intentional auth redirects
      try {
        if (sessionStorage.getItem("suppressAutoLogout") === "1") return;
      } catch {}
      try {
        const data = new Blob([JSON.stringify({ reason: "unload" })], { type: "application/json" });
        // Try beacon first (works reliably on unload)
        if (navigator.sendBeacon) {
          navigator.sendBeacon(endpoint, data);
        } else {
          // Fallback best-effort async request
          fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: "unload" }) }).catch(() => {});
        }
        sent = true;
      } catch {
        // ignore
      }
    };

    // On pagehide (fires once per navigation/close; better than beforeunload+unload)
    const onPageHide = () => logoutWithBeacon();
    window.addEventListener("pagehide", onPageHide);

    // Clear suppression shortly after mount to re-enable auto-logout
    const clearTimer = window.setTimeout(() => {
      try { sessionStorage.removeItem("suppressAutoLogout"); } catch {}
    }, 4000);

    // Listen for cross-tab session changes and log out this tab to avoid conflicts
    const onStorage = (e: StorageEvent) => {
      if (e.key !== "auth_session_change") return;
      // Another tab initiated a session change; log out here and reload
      try {
        fetch(endpoint, { method: "POST" }).finally(() => {
          window.location.reload();
        });
      } catch {
        window.location.reload();
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("storage", onStorage);
      window.clearTimeout(clearTimer);
    };
  }, []);

  return null;
}
