"use client";

import React from "react";
import { useNotifications } from "@/app/context/notification-context";

function timeAgo(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function NotificationsMenu({ onClose }: { onClose: () => void }) {
  const { notifications, markRead, markAllRead, remove, clear, unreadCount } = useNotifications();

  return (
    <div className="absolute right-0 top-full mt-2 w-80 bg-popover/95 backdrop-blur-xl backdrop-saturate-150 border border-border/70 rounded-2xl shadow-[0_24px_50px_-12px_rgba(15,20,28,0.45),0_0_0_1px_rgba(255,255,255,0.03)_inset] z-50 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/60 bg-foreground/[0.02]">
        <div className="text-sm text-foreground font-medium">Notifications</div>
        <div className="flex items-center gap-2">
          {notifications.length > 0 && (
            <button
              onClick={() => clear()}
              className="text-xs text-red-400 hover:text-red-300"
              title="Clear all notifications"
            >
              Clear all
            </button>
          )}
          {unreadCount > 0 && (
            <button
              onClick={() => markAllRead()}
              className="text-xs text-blue-300 hover:text-blue-200"
              title="Mark all as read"
            >
              Mark all read
            </button>
          )}
          <button onClick={onClose} className="text-xs text-muted-foreground hover:text-muted-foreground">Close</button>
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="px-4 py-6 text-center text-muted-foreground text-sm">No notifications</div>
      ) : (
        <ul className="max-h-96 overflow-auto divide-y divide-border">
          {notifications.map((n) => (
            <li key={n.id} className={`px-3 py-3 hover:bg-muted/40 ${n.read ? "opacity-75" : ""}`}>
              <div className="flex items-start gap-3">
                <span className={`mt-0.5 inline-block w-2 h-2 rounded-full ${n.read ? "bg-muted" : "bg-blue-400"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-foreground truncate" title={n.title}>{n.title}</p>
                    <span className="text-[11px] text-muted-foreground flex-shrink-0">{timeAgo(n.timestamp)}</span>
                  </div>
                  {n.message && (
                    <p className="mt-0.5 text-xs text-muted-foreground leading-5 break-words">{n.message}</p>
                  )}
                  <div className="mt-2 flex items-center gap-3">
                    {!n.read && (
                      <button
                        onClick={() => markRead(n.id)}
                        className="text-xs text-blue-300 hover:text-blue-200"
                      >
                        Mark read
                      </button>
                    )}
                    <button
                      onClick={() => remove(n.id)}
                      className="text-xs text-red-300 hover:text-red-200"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
