"use client";

import React, { useEffect, useMemo, useState } from "react";
import { X, Building, Upload, Trash2, Save, Mail, CheckSquare } from "lucide-react";
import type { ProjectModel } from "@/app/types/projects";

interface Project {
  id: string;
  name: string;
  lat: number;
  lng: number;
  urn?: string;
  description?: string;
  code?: string;
  country?: string;
  municipality?: string;
  fileType?: string;
  company?: string;
  clientName?: string;
  address?: string;
  cadastral?: string;
  models?: ProjectModel[];
}

interface ProjectAdminModalProps {
  project: Project | null;
  isOpen: boolean;
  onClose: () => void;
  onProjectUpdated?: (updated: Project) => void;
}

type TabKey = "info" | "access" | "upload" | "remove";

export function ProjectAdminModal({ project, isOpen, onClose, onProjectUpdated }: ProjectAdminModalProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("info");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editable fields for Project Information
  const [edited, setEdited] = useState<Project | null>(project);

  useEffect(() => {
    if (project) setEdited({ ...project });
  }, [project]);

  // Do not early-return before declaring all hooks; guard rendering later

  const handleProjectField = (field: keyof Project, value: any) => {
    setEdited((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const handleSaveInfo = async () => {
    if (!edited || !project) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: edited.name,
          description: edited.description,
          code: edited.code,
          country: edited.country,
          municipality: edited.municipality,
          address: edited.address,
          cadastral: edited.cadastral,
          company: edited.company,
          clientName: edited.clientName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update project");
      if (onProjectUpdated) onProjectUpdated(edited);
    } catch (e: any) {
      setError(e.message || "Failed to update project");
    } finally {
      setSaving(false);
    }
  };

  // Manage Access state
  const [invite, setInvite] = useState({
    name: "",
    surname: "",
    email: "",
    role: "General",
    society: "",
    packages: {
      BIM: true,
      IoT: false,
      Database: false,
      AI: false,
      FM: false,
    } as Record<"BIM" | "IoT" | "Database" | "AI" | "FM", boolean>,
  });
  const roles = [
    "BIM Specialist",
    "BIM Coordinator",
    "BIM Manager",
    "Contractor",
    "Designer",
    "Facility Manager",
    "General",
    "Maintenance Team",
    "PA",
    "Planner",
    "Other",
  ];

  const handleSendInvite = async () => {
    if (!project) return;
    setSaving(true);
    setError(null);
    try {
      const selectedPackages = Object.entries(invite.packages)
        .filter(([_, v]) => v)
        .map(([k]) => k);
      const res = await fetch(`/api/projects/${project.id}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: invite.name,
          surname: invite.surname,
          email: invite.email,
          role: invite.role,
          society: invite.society,
          packages: selectedPackages,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send invite");
      // Reset form on success
      setInvite({
        name: "",
        surname: "",
        email: "",
        role: "General",
        society: "",
        packages: { BIM: true, IoT: false, Database: false, AI: false, FM: false },
      });
    } catch (e: any) {
      setError(e.message || "Failed to send invite");
    } finally {
      setSaving(false);
    }
  };

  // Upload/Replace Model
  const [newModel, setNewModel] = useState<{ name: string; discipline: string; urn: string; fileType: string }>({
    name: "",
    discipline: "Architecture",
    urn: "",
    fileType: "RVT",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [translating, setTranslating] = useState(false);

  const existingModels = useMemo(() => (project?.models || []), [project?.models]);

  const extToFileType = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (!ext) return newModel.fileType || 'RVT';
    if (ext === 'rvt') return 'RVT';
    if (ext === 'ifc') return 'IFC';
    if (ext === 'nwd' || ext === 'nwc') return ext.toUpperCase();
    if (ext === 'dwg') return 'DWG';
    return ext.toUpperCase();
  };

  const handleUploadOrReplace = async () => {
    if (!project) return;
    setSaving(true);
    setError(null);
    try {
      // If a file is selected, upload to Forge to obtain URN first
      let finalUrn = newModel.urn?.trim();
      let finalFileType = newModel.fileType;
      if (selectedFile) {
        setUploading(true);
        // 1) INIT signed URL
        const initRes = await fetch(`/api/forge/upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ init: true, fileName: selectedFile.name }),
        });
        const initJson = await initRes.json();
        if (!initRes.ok) throw new Error(initJson.error || 'Failed to init upload');

        // 2) Upload to S3 signed URL
        const putRes = await fetch(initJson.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: selectedFile,
        });
        if (!putRes.ok) throw new Error('Failed to upload file');

        // 3) COMPLETE to get objectId and URN
        const completeRes = await fetch(`/api/forge/upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ complete: true, fileName: selectedFile.name, uploadKey: initJson.uploadKey }),
        });
        const completeJson = await completeRes.json();
        if (!completeRes.ok) throw new Error(completeJson.error || 'Failed to complete upload');
        finalUrn = completeJson.urn;
        finalFileType = extToFileType(selectedFile.name);

        // 4) Start translation
        setTranslating(true);
        const transRes = await fetch(`/api/forge/translate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ urn: finalUrn }),
        });
        const transJson = await transRes.json();
        if (!transRes.ok) throw new Error(transJson.error || 'Failed to start translation');
      }

      // check for same-name + same-discipline model for replacement
      const same = existingModels.find((m) => 
        m.name.trim().toLowerCase() === newModel.name.trim().toLowerCase() &&
        (m.discipline || 'Other').toLowerCase() === (newModel.discipline || 'Other').toLowerCase()
      );
      if (same) {
        // replace -> PATCH existing model's urn/fileType/discipline/name
        const res = await fetch(`/api/projects/${project.id}/models/${same.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: newModel.name,
            urn: finalUrn,
            fileType: finalFileType,
            discipline: newModel.discipline,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to replace model");
      } else {
        // add new
        const res = await fetch(`/api/projects/${project.id}/models`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: newModel.name,
            urn: finalUrn,
            fileType: finalFileType,
            discipline: newModel.discipline,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to add model");
      }
      // refresh project in parent if desired
      if (onProjectUpdated) {
        try {
          const res = await fetch(`/api/projects/${project.id}`);
          const json = await res.json();
          if (res.ok && json.project) {
            onProjectUpdated({
              id: json.project._id || project.id,
              name: json.project.name,
              lat: json.project.location?.lat,
              lng: json.project.location?.lng,
              urn: json.project.urn,
              description: json.project.description,
              code: json.project.code,
              country: json.project.country,
              municipality: json.project.municipality,
              address: json.project.address,
              cadastral: json.project.cadastral,
              company: json.project.company,
              clientName: json.project.clientName,
              fileType: json.project.fileType,
              models: Array.isArray(json.project.models) ? json.project.models : [],
            });
          }
        } catch {}
      }
      // clear
      setNewModel({ name: "", discipline: "architecture", urn: "", fileType: "RVT" });
      setSelectedFile(null);
    } catch (e: any) {
      setError(e.message || "Model operation failed");
    } finally {
      setUploading(false);
      setTranslating(false);
      setSaving(false);
    }
  };

  // Remove model
  const [removeModelId, setRemoveModelId] = useState<string>("");
  const handleRemoveModel = async () => {
    if (!project || !removeModelId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/models/${removeModelId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove model");
      // refresh
      if (onProjectUpdated) {
        try {
          const res = await fetch(`/api/projects/${project.id}`);
          const json = await res.json();
          if (res.ok && json.project) {
            onProjectUpdated({
              id: json.project._id || project.id,
              name: json.project.name,
              lat: json.project.location?.lat,
              lng: json.project.location?.lng,
              urn: json.project.urn,
              description: json.project.description,
              code: json.project.code,
              country: json.project.country,
              municipality: json.project.municipality,
              address: json.project.address,
              cadastral: json.project.cadastral,
              company: json.project.company,
              clientName: json.project.clientName,
              fileType: json.project.fileType,
              models: Array.isArray(json.project.models) ? json.project.models : [],
            });
          }
        } catch {}
      }
      setRemoveModelId("");
    } catch (e: any) {
      setError(e.message || "Failed to remove model");
    } finally {
      setSaving(false);
    }
  };

  // Safe guard just before rendering
  if (!isOpen || !project) return null;

  return (
    <div className="fixed inset-0 backdrop-blur-sm bg-black/20 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl mx-4 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <Building className="w-6 h-6 text-blue-400" />
            <h2 className="text-xl font-semibold text-white">Project Administration</h2>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-5 pt-3">
          <div className="flex gap-2 overflow-x-auto pb-2">
            <button onClick={() => setActiveTab("info")} className={`px-3 py-1.5 text-sm rounded-md ${activeTab === "info" ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-gray-700"}`}>Project Information</button>
            <button onClick={() => setActiveTab("access")} className={`px-3 py-1.5 text-sm rounded-md ${activeTab === "access" ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-gray-700"}`}>Manage Access</button>
            <button onClick={() => setActiveTab("upload")} className={`px-3 py-1.5 text-sm rounded-md ${activeTab === "upload" ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-gray-700"}`}>Upload Model</button>
            <button onClick={() => setActiveTab("remove")} className={`px-3 py-1.5 text-sm rounded-md ${activeTab === "remove" ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-gray-700"}`}>Remove a Model</button>
          </div>
        </div>

        {/* Error bar */}
        {error && (
          <div className="mx-5 mt-2 px-3 py-2 bg-red-900/30 border border-red-700/40 rounded text-red-200 text-sm">{error}</div>
        )}

        {/* Content */}
        <div className="p-5 space-y-6 flex-1 overflow-y-auto">
          {activeTab === "info" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Project Name</label>
                  <input value={edited?.name || ""} onChange={(e) => handleProjectField("name", e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white" />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Project Code</label>
                  <input value={edited?.code || ""} onChange={(e) => handleProjectField("code", e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm text-gray-300 mb-1">Description</label>
                  <textarea value={edited?.description || ""} onChange={(e) => handleProjectField("description", e.target.value)} rows={3} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white" />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Country</label>
                  <input value={edited?.country || ""} onChange={(e) => handleProjectField("country", e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white" />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Municipality</label>
                  <input value={edited?.municipality || ""} onChange={(e) => handleProjectField("municipality", e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white" />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Address</label>
                  <input value={edited?.address || ""} onChange={(e) => handleProjectField("address", e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white" />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Cadastral</label>
                  <input value={edited?.cadastral || ""} onChange={(e) => handleProjectField("cadastral", e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white" />
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-1">Latitude (read-only)</label>
                  <div className="px-3 py-2 bg-gray-700 rounded text-gray-300">{project.lat}</div>
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-1">Longitude (read-only)</label>
                  <div className="px-3 py-2 bg-gray-700 rounded text-gray-300">{project.lng}</div>
                </div>
              </div>

              {/* Project Details (match previous modal) */}
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Company</label>
                    <input value={edited?.company || ""} onChange={(e) => handleProjectField("company", e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Client Name</label>
                    <input value={edited?.clientName || ""} onChange={(e) => handleProjectField("clientName", e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 mb-1">File Type (read-only)</label>
                    <div className="px-3 py-2 bg-gray-700 rounded text-gray-300">{project.fileType || 'N/A'}</div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 mb-1">Project ID (read-only)</label>
                    <div className="px-3 py-2 bg-gray-700 rounded text-gray-300 font-mono text-sm">{project.id}</div>
                  </div>
                </div>
              </div>

              {/* Technical Information (URN) */}
              {project.urn && (
                <div className="space-y-2">
                  <label className="block text-sm text-gray-500 mb-1">Model URN (read-only)</label>
                  <div className="px-3 py-2 bg-gray-700 rounded text-gray-300 font-mono text-xs break-all">{project.urn}</div>
                </div>
              )}
              <div className="flex justify-end">
                <button onClick={handleSaveInfo} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-md">
                  <Save className="w-4 h-4" />
                  <span>{saving ? "Saving..." : "Save"}</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === "access" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Name</label>
                  <input value={invite.name} onChange={(e) => setInvite({ ...invite, name: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white" />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Surname</label>
                  <input value={invite.surname} onChange={(e) => setInvite({ ...invite, surname: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white" />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Email</label>
                  <input type="email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white" />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Role</label>
                  <select value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white">
                    {roles.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm text-gray-300 mb-1">Society</label>
                  <input value={invite.society} onChange={(e) => setInvite({ ...invite, society: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm text-gray-300 mb-2">Packages</label>
                  <div className="flex flex-wrap gap-3">
                    {(["BIM", "IoT", "Database", "AI", "FM"] as const).map((pkg) => (
                      <label key={pkg} className={`flex items-center gap-2 px-3 py-1.5 rounded-md border ${invite.packages[pkg] ? "bg-blue-600/20 border-blue-500 text-blue-200" : "bg-gray-700/50 border-gray-600 text-gray-300"}`}>
                        <input type="checkbox" checked={invite.packages[pkg]} onChange={(e) => setInvite({ ...invite, packages: { ...invite.packages, [pkg]: e.target.checked } })} />
                        <CheckSquare className="w-4 h-4" /> {pkg}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <button onClick={handleSendInvite} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-md">
                  <Mail className="w-4 h-4" />
                  <span>{saving ? "Sending..." : "Send Invite"}</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === "upload" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Model Name</label>
                  <input value={newModel.name} onChange={(e) => setNewModel({ ...newModel, name: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white" />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Discipline</label>
                  <select value={newModel.discipline} onChange={(e) => setNewModel({ ...newModel, discipline: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white">
                    {['architecture','structure','mep','electrical','plumbing','hvac','other'].map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Paste URN (optional)</label>
                  <input value={newModel.urn} onChange={(e) => setNewModel({ ...newModel, urn: e.target.value })} placeholder="urn:adsk.objects:..." className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white" />
                  <p className="text-xs text-gray-400 mt-1">Option A: Paste URN directly</p>
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Or select a file</label>
                  <input
                    id="modelFile"
                    type="file"
                    accept=".rvt,.ifc,.nwd,.nwc,.dwg"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      setSelectedFile(f);
                      if (f) {
                        // try to infer fileType for user visibility
                        const inferred = extToFileType(f.name);
                        setNewModel((prev) => ({ ...prev, fileType: inferred }));
                      }
                    }}
                  />
                  <label
                    htmlFor="modelFile"
                    className="w-full flex items-center justify-between gap-3 px-3 py-3 rounded-md border border-dashed border-gray-600 bg-gray-700 hover:bg-gray-600 text-gray-200 cursor-pointer transition-colors"
                    title="Click to choose a file"
                  >
                    <span className="truncate">
                      {selectedFile ? selectedFile.name : 'No file selected'}
                    </span>
                    <span className="shrink-0 inline-flex items-center gap-2 text-sm text-gray-300">
                      <Upload className="w-4 h-4" /> Choose file
                    </span>
                  </label>
                  <p className="text-xs text-gray-400 mt-1">Option B: Upload file to Forge, we will generate URN and start translation.</p>
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">File Type</label>
                  <input value={newModel.fileType} onChange={(e) => setNewModel({ ...newModel, fileType: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white" />
                </div>
              </div>
              {(uploading || translating) && (
                <div className="px-3 py-2 bg-blue-900/20 border border-blue-700/30 rounded text-blue-200 text-sm">
                  {uploading ? 'Uploading file to Forge...' : 'Starting translation...'}
                </div>
              )}
              <div className="flex justify-end">
                <button onClick={handleUploadOrReplace} disabled={saving || !newModel.name || (!newModel.urn && !selectedFile)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-md">
                  <Upload className="w-4 h-4" />
                  <span>{saving ? "Submitting..." : "Upload / Replace"}</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === "remove" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-2">Select Model to Remove</label>
                <select value={removeModelId} onChange={(e) => setRemoveModelId(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white">
                  <option value="">-- Choose a model --</option>
                  {(project.models || []).map((m) => (
                    <option key={m.id} value={m.id}>{m.name} ({m.discipline || 'other'})</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end">
                <button onClick={handleRemoveModel} disabled={saving || !removeModelId} className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white rounded-md">
                  <Trash2 className="w-4 h-4" />
                  <span>{saving ? "Removing..." : "Remove"}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
