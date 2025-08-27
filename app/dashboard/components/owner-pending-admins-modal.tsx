"use client";
import React, { useEffect, useState } from "react";

interface PendingEntry { email: string; company: string; status: 'pending'; }

export function OwnerPendingAdminsModal({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<PendingEntry[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      // Disable cache and add a cache-busting query param to always get fresh data
      const res = await fetch(`/api/admins?t=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load pending admins');
      setEntries(Array.isArray(data.pending) ? data.pending : []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const act = async (email: string, company: string, action: 'approve'|'reject') => {
    setBusyKey(`${email}|${company}`);
    setError(null);
    try {
      const res = await fetch('/api/admins', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, company, action })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');
      // Optimistically remove the processed entry to avoid flicker
      setEntries((prev) => prev.filter((e) => !(e.email === email && e.company === company)));
      // Then refresh from server (non-blocking)
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl mx-4">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h3 className="text-white font-semibold">Manage Pending Company Admins</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>
        <div className="p-4 max-h-[70vh] overflow-auto">
          {loading && <div className="text-gray-300">Loading...</div>}
          {error && <div className="text-red-400 mb-2">{error}</div>}
          {!loading && entries.length === 0 && (
            <div className="text-gray-400">No pending admin requests.</div>
          )}
          {!loading && entries.length > 0 && (
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="text-gray-400">
                  <th className="py-2">Email</th>
                  <th className="py-2">Company</th>
                  <th className="py-2">Status</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={`${e.email}|${e.company}`} className="border-t border-gray-800">
                    <td className="py-2 text-gray-200">{e.email}</td>
                    <td className="py-2 text-gray-200">{e.company}</td>
                    <td className="py-2"><span className="px-2 py-0.5 rounded bg-amber-600/20 text-amber-300 border border-amber-500/30">{e.status}</span></td>
                    <td className="py-2 text-right">
                      <button
                        className="px-3 py-1 rounded bg-green-600 hover:bg-green-500 text-white mr-2 disabled:opacity-60"
                        onClick={() => act(e.email, e.company, 'approve')}
                        disabled={busyKey === `${e.email}|${e.company}`}
                      >Approve</button>
                      <button
                        className="px-3 py-1 rounded bg-red-600 hover:bg-red-500 text-white disabled:opacity-60"
                        onClick={() => act(e.email, e.company, 'reject')}
                        disabled={busyKey === `${e.email}|${e.company}`}
                      >Reject</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="p-4 border-t border-gray-700 text-right">
          <button onClick={onClose} className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 text-white">Close</button>
        </div>
      </div>
    </div>
  );
}
