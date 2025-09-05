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
  const { notifications, markRead, markAllRead, remove, unreadCount } = useNotifications();

  return (
    <div className="absolute right-0 top-full mt-2 w-80 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700 bg-gray-800/80 backdrop-blur">
        <div className="text-sm text-gray-200 font-medium">Notifications</div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={() => markAllRead()}
              className="text-xs text-blue-300 hover:text-blue-200"
              title="Mark all as read"
            >
              Mark all read
            </button>
          )}
          <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-300">Close</button>
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="px-4 py-6 text-center text-gray-400 text-sm">No notifications</div>
      ) : (
        <ul className="max-h-96 overflow-auto divide-y divide-gray-700">
          {notifications.map((n) => (
            <li key={n.id} className={`px-3 py-3 hover:bg-gray-700/40 ${n.read ? "opacity-75" : ""}`}>
              <div className="flex items-start gap-3">
                <span className={`mt-0.5 inline-block w-2 h-2 rounded-full ${n.read ? "bg-gray-500" : "bg-blue-400"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-white truncate" title={n.title}>{n.title}</p>
                    <span className="text-[11px] text-gray-400 flex-shrink-0">{timeAgo(n.timestamp)}</span>
                  </div>
                  {n.message && (
                    <p className="mt-0.5 text-xs text-gray-300 leading-5 break-words">{n.message}</p>
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
