"use client";

import React, { useEffect, useRef, useState } from "react";
import { X, User, Edit3, Save, XCircle, ImagePlus, Trash2, Loader2 } from "lucide-react";

type RoleInfo = {
  roleLabel: string;
  isOwner: boolean;
};

interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
  email?: string;
  roleInfo?: RoleInfo; // from selectedProject/access or platform owner
  projectId?: string; // when provided, load/save project-scoped profile
}

interface ProfileData {
  name: string;
  surname: string;
  email: string;
  society: string;
  telephone: string;
  avatarUrl: string;
}

export function ProfileModal({ open, onClose, email, roleInfo, projectId }: ProfileModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [edited, setEdited] = useState<ProfileData | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    let aborted = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const endpoint = projectId ? `/api/projects/${projectId}/profile` : "/api/users/me";
        const res = await fetch(endpoint);
        const json = await res.json();
        if (aborted) return;
        if (!res.ok) throw new Error(json?.error || "Failed to load profile");
        const p = json?.profile as ProfileData;
        // Ensure email is filled from prop when project-scoped
        const normalized: ProfileData = {
          name: p?.name || '',
          surname: p?.surname || '',
          email: p?.email || email || '',
          society: p?.society || '',
          telephone: p?.telephone || '',
          avatarUrl: p?.avatarUrl || ''
        };
        setProfile(normalized);
        setEdited(normalized);
        setIsEditing(false);
      } catch (e: any) {
        if (aborted) return;
        setError(e?.message || "Failed to load profile");
      } finally {
        if (!aborted) setLoading(false);
      }
    })();
    return () => {
      aborted = true;
    };
  }, [open, projectId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      <div
        className="absolute inset-0 backdrop-blur-sm bg-black/30"
        onClick={onClose}
      />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl bg-gray-800 rounded-lg border border-gray-700 shadow-2xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-blue-400" />
              <h3 className="text-lg font-semibold text-white">Profile</h3>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6">
            {loading && (
              <div className="text-sm text-gray-400">Loading profile…</div>
            )}
            {error && (
              <div className="mb-3 px-3 py-2 bg-red-900/30 border border-red-700/40 rounded text-red-200 text-sm">
                {error}
              </div>
            )}
            {profile && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-400 mb-2">Name</div>
                    {isEditing ? (
                      <input
                        value={edited?.name || ''}
                        onChange={(e) => setEdited((prev) => prev ? { ...prev, name: e.target.value } : prev)}
                        className="w-full px-3 py-2 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <div className="px-3 py-2 rounded bg-gray-700 text-gray-200 border border-gray-600">{profile.name || '-'}</div>
                    )}
                  </div>
                  <div>
                    <div className="text-sm text-gray-400 mb-2">Surname</div>
                    {isEditing ? (
                      <input
                        value={edited?.surname || ''}
                        onChange={(e) => setEdited((prev) => prev ? { ...prev, surname: e.target.value } : prev)}
                        className="w-full px-3 py-2 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <div className="px-3 py-2 rounded bg-gray-700 text-gray-200 border border-gray-600">{profile.surname || '-'}</div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-400 mb-2">Email (read-only)</div>
                    <div className="px-3 py-2 rounded bg-gray-700 text-gray-200 border border-gray-600">{profile.email || email}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-400 mb-2">Role (read-only)</div>
                    <div className="px-3 py-2 rounded bg-gray-700 text-gray-200 border border-gray-600">{roleInfo?.roleLabel || "User"}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-400 mb-2">Society</div>
                    {isEditing ? (
                      <input
                        value={edited?.society || ''}
                        onChange={(e) => setEdited((prev) => prev ? { ...prev, society: e.target.value } : prev)}
                        className="w-full px-3 py-2 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <div className="px-3 py-2 rounded bg-gray-700 text-gray-200 border border-gray-600">{profile.society || '-'}</div>
                    )}
                  </div>
                  <div>
                    <div className="text-sm text-gray-400 mb-2">Telephone (+countrycode)</div>
                    {isEditing ? (
                      <input
                        value={edited?.telephone || ''}
                        onChange={(e) => setEdited((prev) => prev ? { ...prev, telephone: e.target.value } : prev)}
                        className="w-full px-3 py-2 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="+14151234567"
                      />
                    ) : (
                      <div className="px-3 py-2 rounded bg-gray-700 text-gray-200 border border-gray-600">{profile.telephone || '-'}</div>
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-sm text-gray-400 mb-2">Avatar URL</div>
                  {isEditing ? (
                    <div className="flex gap-2">
                      <input
                        value={edited?.avatarUrl || ''}
                        onChange={(e) => setEdited((prev) => prev ? { ...prev, avatarUrl: e.target.value } : prev)}
                        className="flex-1 px-3 py-2 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="https://.../avatar.png"
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-2 rounded bg-gray-600 hover:bg-gray-500 border border-gray-600 text-gray-200"
                        title="Upload photo"
                        disabled={uploadingAvatar}
                      >
                        {uploadingAvatar ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            setUploadingAvatar(true);
                            const fd = new FormData();
                            fd.append('file', file);
                            const res = await fetch('/api/uploads/avatar', { method: 'POST', body: fd });
                            const json = await res.json();
                            if (!res.ok) throw new Error(json?.error || 'Upload failed');
                            const url = json?.url as string;
                            setEdited(prev => prev ? { ...prev, avatarUrl: url } : prev);
                          } catch (e: any) {
                            setError(e?.message || 'Failed to upload avatar');
                          } finally {
                            setUploadingAvatar(false);
                            if (fileInputRef.current) fileInputRef.current.value = '';
                          }
                        }}
                      />
                    </div>
                  ) : (
                    <div className="px-3 py-2 rounded bg-gray-700 text-gray-200 border border-gray-600">{profile.avatarUrl || '-'}</div>
                  )}
                </div>

                <div className="flex justify-end">
                  {!loading && profile && (
                    isEditing ? (
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            if (!edited) return;
                            // Optional client-side phone validation to match API
                            if (edited.telephone && !/^\+?[0-9]{7,15}$/.test(edited.telephone)) {
                              setError('Invalid telephone number. Use digits with optional leading +country code.');
                              return;
                            }
                            setSaving(true);
                            setError(null);
                            try {
                              const endpoint = projectId ? `/api/projects/${projectId}/profile` : '/api/users/me';
                              const method = projectId ? 'PUT' : 'PUT';
                              const payload = {
                                name: edited.name || '',
                                surname: edited.surname || '',
                                society: edited.society || '',
                                telephone: edited.telephone || '',
                                avatarUrl: edited.avatarUrl || ''
                              };
                              const res = await fetch(endpoint, {
                                method,
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(payload)
                              });
                              const json = await res.json();
                              if (!res.ok) throw new Error(json?.error || 'Failed to save profile');
                              const p = json?.profile as ProfileData;
                              const normalized: ProfileData = {
                                name: p?.name || '',
                                surname: p?.surname || '',
                                email: p?.email || email || '',
                                society: p?.society || '',
                                telephone: p?.telephone || '',
                                avatarUrl: p?.avatarUrl || ''
                              };
                              setProfile(normalized);
                              setEdited(normalized);
                              setIsEditing(false);
                            } catch (e: any) {
                              setError(e?.message || 'Failed to save profile');
                            } finally {
                              setSaving(false);
                            }
                          }}
                          className="px-4 py-2 text-sm rounded bg-green-600 text-white hover:bg-green-500 disabled:opacity-60"
                          disabled={saving}
                        >
                          {saving ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={() => { setEdited(profile); setIsEditing(false); setError(null); }}
                          className="px-4 py-2 text-sm rounded bg-gray-600 text-gray-200 hover:bg-gray-500"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setIsEditing(true); setEdited(profile); setError(null); }}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-500"
                      >
                        <Edit3 className="w-4 h-4" />
                        Edit Profile
                      </button>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
