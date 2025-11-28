"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

export type NotificationType =
  | "role_assigned"
  | "role_modified"
  | "access_removed"
  | "file_uploaded"
  | "user_added"
  | "file_modified"
  | "maintenance_ticket"
  | "generic";

export interface AppNotification {
  id: string; // uuid
  type: NotificationType;
  title: string;
  message?: string;
  timestamp: number; // ms
  read: boolean;
  meta?: Record<string, any>;
}

interface NotificationContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  add: (n: Omit<AppNotification, "id" | "timestamp" | "read"> & Partial<Pick<AppNotification, "message" | "meta">>) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  remove: (id: string) => void;
  clear: () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

const STORAGE_KEY_PREFIX = "bim.notifications.";

function useStorageKey(userKey?: string | null) {
  return useMemo(() => `${STORAGE_KEY_PREFIX}${userKey ?? "guest"}`, [userKey]);
}

function uuid() {
  // Simple uuid v4-ish
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function NotificationProvider({ children, userEmail }: { children: React.ReactNode; userEmail?: string | null }) {
  const storageKey = useStorageKey(userEmail);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const initialisedRef = useRef(false);

  // Load from database and localStorage
  useEffect(() => {
    const loadNotifications = async () => {
      try {
        // Try to fetch from database first
        if (userEmail) {
          const res = await fetch('/api/notifications');
          if (res.ok) {
            const dbNotifications: AppNotification[] = await res.json();
            setNotifications(dbNotifications.sort((a, b) => b.timestamp - a.timestamp));
            initialisedRef.current = true;
            return;
          }
        }
        
        // Fallback to localStorage
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const parsed: AppNotification[] = JSON.parse(raw);
          setNotifications(parsed.sort((a, b) => b.timestamp - a.timestamp));
        } else {
          setNotifications([]);
        }
      } catch {
        // Fallback to localStorage on error
        try {
          const raw = localStorage.getItem(storageKey);
          if (raw) {
            const parsed: AppNotification[] = JSON.parse(raw);
            setNotifications(parsed.sort((a, b) => b.timestamp - a.timestamp));
          } else {
            setNotifications([]);
          }
        } catch {
          setNotifications([]);
        }
      }
      initialisedRef.current = true;
    };
    
    loadNotifications();
  }, [storageKey, userEmail]);

  // Persist to localStorage
  useEffect(() => {
    if (!initialisedRef.current) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(notifications));
    } catch {
      // ignore storage errors
    }
  }, [notifications, storageKey]);

  const add = useCallback<NotificationContextValue["add"]>((n) => {
    setNotifications(prev => [
      {
        id: uuid(),
        type: n.type ?? "generic",
        title: n.title ?? "Notification",
        message: n.message,
        timestamp: Date.now(),
        read: false,
        meta: n.meta,
      },
      ...prev,
    ]);
  }, []);

  const markRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => (n.read ? n : { ...n, read: true })));
  }, []);

  const remove = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clear = useCallback(async () => {
    try {
      if (userEmail) {
        await fetch('/api/notifications', { method: 'DELETE' });
      }
      setNotifications([]);
    } catch (error) {
      console.error('Failed to clear notifications:', error);
      setNotifications([]);
    }
  }, [userEmail]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const value = useMemo<NotificationContextValue>(() => ({
    notifications,
    unreadCount,
    add,
    markRead,
    markAllRead,
    remove,
    clear,
  }), [notifications, unreadCount, add, markRead, markAllRead, remove, clear]);

  // Listen to global custom events to convert platform events into notifications
  useEffect(() => {
    const handler = (e: Event) => {
      try {
        const ce = e as CustomEvent<any>;
        const detail = ce.detail || {};
        const type = ce.type as NotificationType | string;
        switch (type) {
          case "role-assigned":
            add({ type: "role_assigned", title: "Role assigned", message: detail?.message || `You were assigned a role in project ${detail?.projectName || ""}` });
            break;
          case "role-modified":
            add({ type: "role_modified", title: "Role modified", message: detail?.message || `Your role in project ${detail?.projectName || ""} was modified` });
            break;
          case "access-removed":
            add({ type: "access_removed", title: "Access removed", message: detail?.message || `Your access to project ${detail?.projectName || ""} was removed` });
            break;
          case "file-uploaded":
            add({ type: "file_uploaded", title: "File uploaded", message: detail?.message || `${detail?.fileName || "A file"} was uploaded` });
            break;
          case "file-modified":
            add({ type: "file_modified", title: "File modified", message: detail?.message || `${detail?.fileName || "A file"} was modified` });
            break;
          case "user-added":
            add({ type: "user_added", title: "User added", message: detail?.message || `A new user was added to ${detail?.projectName || "the project"}` });
            break;
          default:
            break;
        }
      } catch {
        // ignore
      }
    };

    const eventTypes = [
      "role-assigned",
      "role-modified",
      "access-removed",
      "file-uploaded",
      "file-modified",
      "user-added",
    ];
    eventTypes.forEach(t => window.addEventListener(t, handler as EventListener));
    return () => {
      eventTypes.forEach(t => window.removeEventListener(t, handler as EventListener));
    };
  }, [add]);

  // Expose a global test helper and seed a welcome notification once per user (non-intrusive)
  useEffect(() => {
    // Helper: window.postNotification({ type, title, message, meta })
    (window as any).postNotification = (detail: Partial<AppNotification> & { type?: NotificationType; title?: string }) => {
      add({
        type: (detail.type as NotificationType) || 'generic',
        title: detail.title || 'Notification',
        message: detail.message,
        meta: detail.meta,
      });
    };

    // Dev-only keyboard shortcut: Ctrl/Cmd + Shift + N to add a sample notification
    const handleKey = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;
      if (cmdOrCtrl && e.shiftKey && (e.key === 'N' || e.key === 'n')) {
        add({ type: 'generic', title: 'Test notification', message: 'This is a test notification.' });
      }
    };
    window.addEventListener('keydown', handleKey);

    // Seed a single welcome notification per user (stored flag)
    const seedKey = `${storageKey}.seeded`;
    try {
      const seeded = localStorage.getItem(seedKey);
      if (!seeded) {
        add({ type: 'generic', title: 'Welcome', message: 'Welcome to BIM Viewer Platform.' });
        localStorage.setItem(seedKey, '1');
      }
    } catch {
      // ignore
    }

    return () => {
      window.removeEventListener('keydown', handleKey);
    };
  }, [add, storageKey]);

  return (
    <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
}
