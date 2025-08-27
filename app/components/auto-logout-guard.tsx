"use client";

import { useEffect } from "react";

// AutoLogoutGuard: ensures session is cleared when the tab/window is closed
// and provides a helper to force-clear cookies server-side when unload happens.
export default function AutoLogoutGuard() {
  useEffect(() => {
    const endpoint = "/api/auth/force-logout";
    let sent = false;

    // IMPORTANT: Do NOT auto-logout on refresh or normal navigation.
    // We only handle cross-tab session changes below.

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
      window.removeEventListener("storage", onStorage);
      window.clearTimeout(clearTimer);
    };
  }, []);

  return null;
}
