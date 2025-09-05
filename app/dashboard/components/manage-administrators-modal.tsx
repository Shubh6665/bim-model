"use client";
import React, { useEffect, useRef, useState } from "react";
import { Trash2, Calendar } from "lucide-react";

interface AdministratorEntry {
  email: string;
  company: string;
  status: 'approved';
  name?: string;
  approvedAt?: string; // ISO string returned by API
  expiresAt?: string;  // ISO string returned by API
}

export function ManageAdministratorsModal({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [administrators, setAdministrators] = useState<AdministratorEntry[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{ email: string; company: string; name?: string } | null>(null);
  const [editingExpireKey, setEditingExpireKey] = useState<string | null>(null);
  const todayYMD = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  // Draggable state
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number; dragging: boolean }>({ startX: 0, startY: 0, originX: 0, originY: 0, dragging: false });

  useEffect(() => {
    // center-ish on mount
    const w = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const h = typeof window !== 'undefined' ? window.innerHeight : 800;
    const width = 896; // ~max-w-4xl
    const x = Math.max(16, (w - width) / 2);
    const y = Math.max(24, h * 0.12);
    setPos({ x, y });
  }, []);

  const onMouseDownHeader = (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current.dragging = true;
    dragRef.current.startX = e.clientX;
    dragRef.current.startY = e.clientY;
    dragRef.current.originX = pos.x;
    dragRef.current.originY = pos.y;
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!dragRef.current.dragging) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPos((prev) => ({ x: dragRef.current.originX + dx, y: dragRef.current.originY + dy }));
  };

  const onMouseUp = () => {
    dragRef.current.dragging = false;
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch approved administrators
      const res = await fetch(`/api/admins?type=approved&t=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load administrators');
      setAdministrators(Array.isArray(data.approved) ? data.approved : []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  // After administrators load, raise notifications for due/soon expirations
  useEffect(() => {
    if (!administrators || administrators.length === 0) return;
    const today = new Date();
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    administrators.forEach(a => {
      if (!a.expiresAt) return;
      const exp = new Date(a.expiresAt);
      const sameDay = exp.getFullYear() === today.getFullYear() && exp.getMonth() === today.getMonth() && exp.getDate() === today.getDate();
      const isTomorrow = exp.getFullYear() === tomorrow.getFullYear() && exp.getMonth() === tomorrow.getMonth() && exp.getDate() === tomorrow.getDate();
      if (sameDay) {
        (window as any).postNotification?.({
          type: 'generic',
          title: 'Admin expiry reached',
          message: `${a.name || a.email} (${a.company}) expiry is today.`
        });
      } else if (isTomorrow) {
        (window as any).postNotification?.({
          type: 'generic',
          title: 'Admin expiry tomorrow',
          message: `${a.name || a.email} (${a.company}) will expire tomorrow.`
        });
      }
    });
  }, [administrators]);

  const removeAdmin = async (email: string, company: string) => {
    setBusyKey(`${email}|${company}`);
    setError(null);
    try {
      const res = await fetch('/api/admins', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, company, action: 'remove' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to remove administrator');
      
      // Optimistically remove the entry from the list
      setAdministrators((prev) => prev.filter((admin) => !(admin.email === email && admin.company === company)));
      
      // Trigger a global refresh of user permissions by dispatching a custom event
      // This will be caught by the dashboard header to refresh canCreate state
      window.dispatchEvent(new CustomEvent('admin-permissions-changed', { 
        detail: { removedEmail: email, removedCompany: company }
      }));
      
      // If the removed admin is the current user, show a notification that they need to refresh
      // We can't force a sign-out here since we don't have access to the session
      // The dashboard header will handle the session refresh
      
      // Refresh from server (non-blocking)
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusyKey(null);
    }
  };

  const fmt = (iso?: string) => {
    if (!iso) return '-';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString();
  };

  const toInputDate = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const setExpire = async (email: string, company: string, dateStr: string | null) => {
    setBusyKey(`${email}|${company}|expire`);
    setError(null);
    try {
      const res = await fetch('/api/admins', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, company, action: 'set-expire', expiresAt: dateStr })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to set expiration');
      // update in place
      setAdministrators(prev => prev.map(a =>
        (a.email === email && a.company === company)
          ? { ...a, expiresAt: dateStr || undefined }
          : a
      ));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60">
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-4xl"
        style={{ position: 'absolute', left: pos.x, top: pos.y }}
      >
        <div
          className="flex items-center justify-between p-4 border-b border-gray-700 cursor-move select-none"
          onMouseDown={onMouseDownHeader}
        >
          <h3 className="text-white font-semibold">Manage Administrators</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>
        <div className="p-4 max-h-[70vh] overflow-auto">
          {loading && <div className="text-gray-300">Loading administrators...</div>}
          {error && <div className="text-red-400 mb-2">{error}</div>}
          {!loading && administrators.length === 0 && (
            <div className="text-gray-400">No administrators found.</div>
          )}
          {!loading && administrators.length > 0 && (
            <div className="space-y-4">
              
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-700">
                    <th className="py-2 font-medium">Name</th>
                    <th className="py-2 font-medium">Email</th>
                    <th className="py-2 font-medium">Company</th>
                    <th className="py-2 font-medium">Start</th>
                    <th className="py-2 font-medium">Expire</th>
                    <th className="py-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {administrators.map((admin) => (
                    <tr key={`${admin.email}|${admin.company}`} className="border-t border-gray-800">
                      <td className="py-3 text-gray-200">
                        {admin.name || '-'}
                      </td>
                      <td className="py-3 text-gray-200">{admin.email}</td>
                      <td className="py-3 text-gray-200">{admin.company}</td>
                      <td className="py-3 text-gray-200">{fmt(admin.approvedAt)}</td>
                      <td className="py-3 text-gray-200">
                        {editingExpireKey !== `${admin.email}|${admin.company}` ? (
                          <div className="flex items-center gap-3">
                            <span>{admin.expiresAt ? fmt(admin.expiresAt) : '-'}</span>
                            <button
                              className="px-2 py-1 rounded bg-gray-800 border border-gray-700 hover:bg-gray-700 text-xs"
                              title="Change expire date"
                              onClick={() => setEditingExpireKey(`${admin.email}|${admin.company}`)}
                            >
                              <Calendar className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <input
                              type="date"
                              className="bg-gray-800 border border-gray-700 text-gray-200 rounded px-2 py-1 text-xs"
                              defaultValue={toInputDate(admin.expiresAt) || ''}
                              min={todayYMD()}
                              onChange={(e) => {
                                const v = e.target.value; // yyyy-mm-dd
                                const iso = v ? new Date(v + 'T00:00:00Z').toISOString() : '';
                                // Auto-save immediately when a date is picked
                                setExpire(admin.email, admin.company, v ? iso : null);
                                setEditingExpireKey(null);
                              }}
                              onBlur={(e) => {
                                const v = e.currentTarget.value.trim();
                                if (!v || v.includes('-')) return; // native format handled in onChange
                                // accept dd/mm/yyyy
                                const m = v.match(/^([0-3]?\d)\/([0-1]?\d)\/(\d{4})$/);
                                if (!m) { return; }
                                const dd = parseInt(m[1], 10);
                                const mm = parseInt(m[2], 10);
                                const yyyy = parseInt(m[3], 10);
                                const candidate = new Date(yyyy, mm - 1, dd);
                                const today = new Date();
                                const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                                if (isNaN(candidate.getTime()) || candidate < startOfToday) {
                                  setError('Please choose a date that is today or later.');
                                  return;
                                }
                                const iso = new Date(Date.UTC(yyyy, mm - 1, dd)).toISOString();
                                setExpire(admin.email, admin.company, iso);
                                setEditingExpireKey(null);
                              }}
                              placeholder="dd/mm/yyyy"
                            />
                            <button
                              className="px-2 py-1 rounded bg-gray-800 border border-gray-700 hover:bg-gray-700 text-xs"
                              title="Close without changes"
                              onClick={() => setEditingExpireKey(null)}
                            >
                              ✕
                            </button>
                            {admin.expiresAt && (
                              <button
                                className="text-xs text-gray-300 hover:text-white underline disabled:opacity-50"
                                onClick={() => { setExpire(admin.email, admin.company, null); setEditingExpireKey(null); }}
                                disabled={busyKey === `${admin.email}|${admin.company}|expire`}
                              >
                                Clear
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          className="inline-flex items-center gap-2 px-3 py-1 rounded bg-red-600 hover:bg-red-500 text-white disabled:opacity-60 disabled:cursor-not-allowed"
                          onClick={() => setConfirmTarget({ email: admin.email, company: admin.company, name: admin.name })}
                          disabled={busyKey === `${admin.email}|${admin.company}`}
                          title="Remove administrator access"
                        >
                          <Trash2 className="w-3 h-3" />
                          {busyKey === `${admin.email}|${admin.company}` ? 'Removing...' : 'Remove as Admin'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="p-4 border-t border-gray-700 text-right">
          <button onClick={onClose} className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 text-white">
            Close
          </button>
        </div>
        {confirmTarget && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-xl">
            <div className="bg-gray-800 border border-gray-700 rounded-lg w-full max-w-md mx-4 shadow-xl">
              <div className="p-4 border-b border-gray-700">
                <h4 className="text-white font-medium">Confirm removal</h4>
              </div>
              <div className="p-4 text-sm text-gray-200 space-y-2">
                <p>
                  Are you sure you want to remove
                  <span className="font-semibold"> {confirmTarget.name || confirmTarget.email}</span>
                  {' '}from company <span className="font-semibold">{confirmTarget.company}</span> as an administrator?
                </p>
                <p className="text-gray-400">This will revoke their administrator privileges for this company.</p>
              </div>
              <div className="p-4 border-t border-gray-700 flex items-center justify-end gap-2">
                <button
                  className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 text-white"
                  onClick={() => setConfirmTarget(null)}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 rounded bg-red-600 hover:bg-red-500 text-white disabled:opacity-60"
                  disabled={busyKey === `${confirmTarget.email}|${confirmTarget.company}`}
                  onClick={async () => {
                    const t = confirmTarget;
                    setConfirmTarget(null);
                    await removeAdmin(t.email, t.company);
                  }}
                >
                  {busyKey === `${confirmTarget.email}|${confirmTarget.company}` ? 'Removing...' : 'Yes'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
