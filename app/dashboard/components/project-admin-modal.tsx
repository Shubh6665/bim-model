"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/app/context/auth-context";
import { X, Building, Upload, Trash2, Save, Mail, CheckSquare, Edit3 } from "lucide-react";
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
  access?: { owner?: boolean; role?: string; packages?: string[] };
}

interface ProjectAdminModalProps {
  project: Project | null;
  isOpen: boolean;
  onClose: () => void;
  onProjectUpdated?: (updated: Project) => void;
}

type TabKey = "info" | "profile" | "access" | "upload" | "remove";

export function ProjectAdminModal({ project, isOpen, onClose, onProjectUpdated }: ProjectAdminModalProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("info");
  const [saving, setSaving] = useState(false); // For sending new invites
  const [updatingPackageId, setUpdatingPackageId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  // Editable fields for Project Information
  const [edited, setEdited] = useState<Project | null>(project);
  // Editing toggle for Project Information tab
  const [isEditingInfo, setIsEditingInfo] = useState(false);

  useEffect(() => {
    if (project) {
      setEdited({ ...project });
      setIsEditingInfo(false); // reset editing when project changes
    }
  }, [project]);

  // Do not early-return before declaring all hooks; guard rendering later

  const handleProjectField = (field: keyof Project, value: any) => {
    setEdited((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  // ---------------- Project-based Profile ----------------
  type UserProfile = {
    name?: string;
    surname?: string;
    role?: string; // read-only, project-specific role
    email?: string; // read-only
    society?: string;
    telephone?: string;
    avatarUrl?: string;
  };
  const [profile, setProfile] = useState<UserProfile>({});
  const [editedProfile, setEditedProfile] = useState<UserProfile>({});
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);

  const isProfileIncomplete = (p: UserProfile) => {
    const telOk = !p.telephone || /^\+?[0-9]{7,15}$/.test(p.telephone);
    return !p.name || !p.surname || !p.email || !telOk;
  };

  const loadProfile = async () => {
    if (!project) return;
    setProfileLoading(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/profile`);
      const data = await res.json();
      
      const p: UserProfile = {
        ...data.profile,
        email: user?.email || '',
        role: project.access?.role || 'User'
      };
      
      console.log('Profile loaded:', p, 'Project access:', project.access);
      
      setProfile(p);
      setEditedProfile({ ...p });
      
      // Check if profile is incomplete and show notice (non-intrusive: no auto-switch)
      if (isProfileIncomplete(p)) {
        setProfileNotice('Please complete your profile (name, surname, phone).');
      } else {
        setProfileNotice(null);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      // Fallback to default profile
      const defaultProfile = {
        email: user?.email || '',
        role: project.access?.role || 'User',
        name: '',
        surname: '',
        society: '',
        telephone: '',
        avatarUrl: ''
      };
      setProfile(defaultProfile);
      setEditedProfile({ ...defaultProfile });
      setProfileNotice('Please complete your profile (name, surname, phone).');
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !project) return;
    loadProfile();
    setIsEditingProfile(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, project]);

  const handleProfileField = (field: keyof UserProfile, value: any) => {
    setEditedProfile((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveProfile = async () => {
    if (!project || !editedProfile) return;
    setSaving(true);
    setError(null);
    try {
      // simple phone validation
      if (editedProfile.telephone && !/^\+?[0-9]{7,15}$/.test(editedProfile.telephone)) {
        throw new Error('Please enter a valid telephone number with optional +country code');
      }
      const res = await fetch(`/api/projects/${project.id}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editedProfile.name || '',
          surname: editedProfile.surname || '',
          society: editedProfile.society || '',
          telephone: editedProfile.telephone || '',
          avatarUrl: editedProfile.avatarUrl || '',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save profile');
      const savedProfile = {
        ...data.profile,
        email: user?.email || '',
        role: project.access?.role || 'User'
      };
      setProfile(savedProfile);
      setEditedProfile({ ...savedProfile });
      setProfileNotice(null);
      setIsEditingProfile(false);
    } catch (e: any) {
      setError(e.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelProfile = () => {
    setEditedProfile({ ...profile });
    setIsEditingProfile(false);
    setError(null);
  };

  // moved below after all dependencies are declared

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
      if (onProjectUpdated) onProjectUpdated({ ...(edited as Project), access: project.access });
      // exit edit mode on success
      setIsEditingInfo(false);
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
    "Project Admin",
    "Planner",
    "Other",
  ];

  // Invites list state
  const [invitesList, setInvitesList] = useState<any[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [canManageInvites, setCanManageInvites] = useState(true);

  // Access checks based on RBAC requirements
  const effectiveRole = project?.access?.role as string | undefined;
  // Display label: insert space for Project Admin
  const displayRoleLabel = effectiveRole === 'ProjectAdmin' ? 'Project Admin' : (effectiveRole || 'User');
  const isPlatformOwner = effectiveRole === 'PlatformOwner';
  const isAdministrator = effectiveRole === 'Administrator';
  const isProjectAdmin = effectiveRole === 'ProjectAdmin' || effectiveRole === 'Project Admin';
  const isUser = effectiveRole === 'User' || (!isPlatformOwner && !isAdministrator && !isProjectAdmin);
  const isOwnerScope = isPlatformOwner || isAdministrator;
  
  // RBAC Permissions according to requirements:
  // Create Project: Platform Owner, Administrator, Project Administrator
  const canCreateProject = !!(isPlatformOwner || isAdministrator || isProjectAdmin);
  
  // Delete Project: Platform Owner, Administrator ONLY (Project Admin CANNOT delete)
  const canDeleteProject = !!(isPlatformOwner || isAdministrator);
  
  // Update Project: Platform Owner, Administrator, Project Administrator
  const canUpdateProject = !!(isPlatformOwner || isAdministrator || isProjectAdmin);
  
  // Manage Access (invite users): Platform Owner, Administrator, Project Administrator
  const canManage = !!(isPlatformOwner || isAdministrator || isProjectAdmin);
  
  // Add/Delete Models: Platform Owner, Administrator, Project Administrator
  const canUploadOrReplace = !!(isPlatformOwner || isAdministrator || isProjectAdmin);
  const canRemoveModel = !!(isPlatformOwner || isAdministrator || isProjectAdmin);
  
  // Appoint Project Admin: Platform Owner, Administrator ONLY
  const canAppointProjectAdmin = !!(isPlatformOwner || isAdministrator);

  // Safely extract a string id from normalized 'id' (preferred) or Mongo ObjectId
  const getInviteId = (inv: any): string => {
    if (!inv) return '';
    if (typeof inv.id === 'string' && inv.id.length) return inv.id;
    const raw = inv._id;
    if (typeof raw === 'string') return raw;
    if (raw?.$oid) return raw.$oid;
    if (typeof raw?.toString === 'function') return raw.toString();
    return '';
  };

  // Invites list to display: owners/admins see all; project admins don't see their own invite row
  const displayInvites = useMemo(() => {
    if (isOwnerScope) return invitesList;
    const me = String(user?.email || '').toLowerCase();
    return invitesList.filter((inv) => String(inv?.invitee?.email || '').toLowerCase() !== me);
  }, [invitesList, isOwnerScope, user?.email]);

  const loadInvites = async () => {
    if (!project) return;
    setInvitesLoading(true);
    try {
      setError(null);
      const res = await fetch(`/api/projects/${project.id}/invites`);
      const json = await res.json();
      if (!res.ok) {
        // If user is not the owner, don't surface a scary error banner.
        if (res.status === 404 && (json?.error || '').toLowerCase().includes('not owner')) {
          setCanManageInvites(false);
          setInvitesList([]);
          setError(null);
          return;
        }
        throw new Error(json.error || 'Failed to load invites');
      }
      setInvitesList(Array.isArray(json.invites) ? json.invites : []);
      // Clear any previous transient errors on success
      setError(null);
      setCanManageInvites(true);
    } catch (e: any) {
      setError(e.message || 'Failed to load invites');
    } finally {
      setInvitesLoading(false);
    }
  };

  useEffect(() => {
    // Clear any stale errors on any tab switch
    setError(null);
    if (activeTab === 'access' && project) {
      // set capability based on role
      setCanManageInvites(canManage);
      if (canManage) {
        loadInvites();
      } else {
        // Do not call API if not allowed
        setInvitesList([]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, project?.id, canManage]);

  const handleRevokeInvite = async (inviteId: string) => {
    if (!project) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/invites?inviteId=${inviteId}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to revoke invite');
      await loadInvites();
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Failed to revoke invite');
    } finally {
      setSaving(false);
    }
  };

  type Pkg = 'BIM' | 'IoT' | 'Database' | 'AI' | 'FM';
  const toggleInvitePackage = (inviteId: string, pkg: Pkg) => {
    setInvitesList((prev) => prev.map((inv) => {
      if (getInviteId(inv) !== String(inviteId)) return inv;
      const current: string[] = Array.isArray(inv?.invitee?.packages) ? inv.invitee.packages : [];
      const has = current.includes(pkg);
      const next = has ? current.filter((p) => p !== pkg) : [...current, pkg];
      return { ...inv, invitee: { ...inv.invitee, packages: next } };
    }));
  };

  const saveInvitePackages = async (inviteId: string) => {
    if (!project) return;
    setUpdatingPackageId(inviteId);
    setError(null);
    try {
      const inv = invitesList.find((i) => getInviteId(i) === String(inviteId));
      const packages = Array.isArray(inv?.invitee?.packages) ? inv.invitee.packages : [];
      const role = String(inv?.invitee?.role || 'General');
      const res = await fetch(`/api/projects/${project.id}/invites`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteId, packages, role }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update packages');

      // Update the local state with the returned invite data for a faster UI update
      setInvitesList((prev) =>
        prev.map((invite) => (getInviteId(invite) === inviteId ? json.invite : invite))
      );
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Failed to update packages');
    } finally {
      setUpdatingPackageId(null);
    }
  };

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
      await loadInvites();
      setError(null);
    } catch (e: any) {
      setError(e.message || "Failed to send invite");
    } finally {
      setSaving(false);
    }
  };

  // Upload/Replace Model
  const [newModel, setNewModel] = useState<{ name: string; discipline: string; urn: string; fileType: string }>({
    name: "",
    discipline: "architecture",
    urn: "",
    fileType: "RVT",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [translating, setTranslating] = useState(false);

  const existingModels = useMemo(() => (project?.models || []), [project?.models]);

  // Capitalize helper: first letter uppercase, rest lowercase
  const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s);

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
              access: json.project.access || { owner: true, role: 'Owner', packages: ['BIM','IoT','Database','AI','FM'] },
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
  const [showConfirmRemove, setShowConfirmRemove] = useState(false);
  const [showConfirmDeleteProject, setShowConfirmDeleteProject] = useState(false);
  
  // Debug project access
  useEffect(() => {
    if (project) {
      console.log('[ProjectAdminModal] Project access:', {
        owner: project.access?.owner,
        role: project.access?.role,
        packages: project.access?.packages,
        fullAccess: project.access
      });
      console.log('[ProjectAdminModal] Full project:', project);
    }
  }, [project]);
  const handleRemoveModel = async () => {
    if (!project || !removeModelId) return;
    if (!canRemoveModel) {
      // UI should already disable, but guard anyway
      setError('You do not have permission to delete models');
      return;
    }
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
              access: json.project.access || { owner: true, role: 'Owner', packages: ['BIM','IoT','Database','AI','FM'] },
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

  const handleDeleteProject = async () => {
    if (!project) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete project");
      
      // Close modal and notify parent
      onClose();
      // Optionally refresh projects list or redirect
      window.location.reload(); // Simple approach - could be improved with proper state management
    } catch (e: any) {
      setError(e.message || "Failed to delete project");
    } finally {
      setSaving(false);
      setShowConfirmDeleteProject(false);
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
            <div>
              <h2 className="text-xl font-semibold text-white">Project Administration</h2>
              <p className="text-sm text-gray-400">Your role: {displayRoleLabel}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-5 pt-3">
          <div className="flex gap-2 overflow-x-auto pb-2">
            <button onClick={() => setActiveTab("info")} className={`px-3 py-1.5 text-sm rounded-md ${activeTab === "info" ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-gray-700"}`}>Project Information</button>
            <button onClick={() => setActiveTab("profile")} className={`px-3 py-1.5 text-sm rounded-md ${activeTab === "profile" ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-gray-700"}`}>Profile</button>
            {canManage && (
              <button onClick={() => setActiveTab("access")} className={`px-3 py-1.5 text-sm rounded-md ${activeTab === "access" ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-gray-700"}`}>Manage Access</button>
            )}
            {canUploadOrReplace && (
              <button onClick={() => setActiveTab("upload")} className={`px-3 py-1.5 text-sm rounded-md ${activeTab === "upload" ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-gray-700"}`}>Upload Model</button>
            )}
            {canRemoveModel && (
              <button onClick={() => setActiveTab("remove")} className={`px-3 py-1.5 text-sm rounded-md ${activeTab === "remove" ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-gray-700"}`}>Remove a Model</button>
            )}
          </div>
        </div>

        {/* Error bar */}
        {error && (
          <div className="mx-5 mt-2 px-3 py-2 bg-red-900/30 border border-red-700/40 rounded text-red-200 text-sm">{error}</div>
        )}
        {activeTab === 'profile' && profileNotice && (
          <div className="mx-5 mt-2 px-3 py-2 bg-yellow-900/30 border border-yellow-700/40 rounded text-yellow-200 text-sm flex items-start justify-between gap-3">
            <span>{profileNotice}</span>
            <button
              onClick={() => setProfileNotice(null)}
              className="text-yellow-200/80 hover:text-yellow-100 text-xs underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Content */}
        <div className="p-5 space-y-6 flex-1 overflow-y-auto">
          {activeTab === "profile" && (
            <div className="space-y-4">
              {profileLoading ? (
                <div className="text-sm text-gray-400">Loading profile…</div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-300 mb-1">Name</label>
                      <input 
                        value={editedProfile.name || ""} 
                        onChange={(e) => handleProfileField("name", e.target.value)} 
                        disabled={!isEditingProfile} 
                        className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white disabled:opacity-70" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-300 mb-1">Surname</label>
                      <input 
                        value={editedProfile.surname || ""} 
                        onChange={(e) => handleProfileField("surname", e.target.value)} 
                        disabled={!isEditingProfile} 
                        className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white disabled:opacity-70" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-500 mb-1">Email (read-only)</label>
                      <div className="px-3 py-2 bg-gray-700 rounded text-gray-300">{profile.email || user?.email}</div>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-500 mb-1">Role (read-only)</label>
                      <div className="px-3 py-2 bg-gray-700 rounded text-gray-300">{displayRoleLabel}</div>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-300 mb-1">Society</label>
                      <input 
                        value={editedProfile.society || ""} 
                        onChange={(e) => handleProfileField("society", e.target.value)} 
                        disabled={!isEditingProfile} 
                        className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white disabled:opacity-70" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-300 mb-1">Telephone (+countrycode)</label>
                      <input 
                        value={editedProfile.telephone || ""} 
                        onChange={(e) => handleProfileField("telephone", e.target.value)} 
                        disabled={!isEditingProfile} 
                        placeholder="+14151234567" 
                        className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white disabled:opacity-70" 
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm text-gray-300 mb-1">Avatar URL</label>
                      <input 
                        value={editedProfile.avatarUrl || ""} 
                        onChange={(e) => handleProfileField("avatarUrl", e.target.value)} 
                        disabled={!isEditingProfile} 
                        placeholder="https://.../avatar.png" 
                        className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white disabled:opacity-70" 
                      />
                      {editedProfile.avatarUrl ? (
                        <div className="mt-2 flex items-center gap-3">
                          <img src={editedProfile.avatarUrl} alt="avatar" className="w-14 h-14 rounded-full object-cover border border-gray-600" />
                          <span className="text-xs text-gray-400">Preview</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  
                  {/* Edit/Save/Cancel buttons */}
                  <div className="flex justify-end gap-2">
                    {!isEditingProfile ? (
                      <button 
                        onClick={() => setIsEditingProfile(true)} 
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
                      >
                        <Edit3 className="w-4 h-4" />
                        <span>Edit Profile</span>
                      </button>
                    ) : (
                      <>
                        <button 
                          onClick={handleCancelProfile} 
                          disabled={saving} 
                          className="px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-600 text-white rounded-md"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={handleSaveProfile} 
                          disabled={saving} 
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-md"
                        >
                          <Save className="w-4 h-4" />
                          <span>{saving ? 'Saving...' : 'Save Profile'}</span>
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
          {activeTab === "info" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Project Name</label>
                  <input value={edited?.name || ""} onChange={(e) => handleProjectField("name", e.target.value)} disabled={!isEditingInfo} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white disabled:opacity-70" />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Project Code</label>
                  <input value={edited?.code || ""} onChange={(e) => handleProjectField("code", e.target.value)} disabled={!isEditingInfo} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white disabled:opacity-70" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm text-gray-300 mb-1">Description</label>
                  <textarea value={edited?.description || ""} onChange={(e) => handleProjectField("description", e.target.value)} rows={3} disabled={!isEditingInfo} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white disabled:opacity-70" />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Country</label>
                  <input value={edited?.country || ""} onChange={(e) => handleProjectField("country", e.target.value)} disabled={!isEditingInfo} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white disabled:opacity-70" />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Municipality</label>
                  <input value={edited?.municipality || ""} onChange={(e) => handleProjectField("municipality", e.target.value)} disabled={!isEditingInfo} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white disabled:opacity-70" />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Address</label>
                  <input value={edited?.address || ""} onChange={(e) => handleProjectField("address", e.target.value)} disabled={!isEditingInfo} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white disabled:opacity-70" />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Cadastral</label>
                  <input value={edited?.cadastral || ""} onChange={(e) => handleProjectField("cadastral", e.target.value)} disabled={!isEditingInfo} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white disabled:opacity-70" />
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
                    <input value={edited?.company || ""} onChange={(e) => handleProjectField("company", e.target.value)} disabled={!isEditingInfo} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white disabled:opacity-70" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Client Name</label>
                    <input value={edited?.clientName || ""} onChange={(e) => handleProjectField("clientName", e.target.value)} disabled={!isEditingInfo} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white disabled:opacity-70" />
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
              {/* Bottom actions: Edit (when not editing), Save + Cancel (when editing) */}
              <div className="flex justify-between items-center gap-2">
                {canUpdateProject && (
                  <div className="flex gap-2">
                    {!isEditingInfo ? (
                      <button onClick={() => setIsEditingInfo(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md">
                        <Edit3 className="w-4 h-4" />
                        <span>Edit</span>
                      </button>
                    ) : (
                      <>
                        <button onClick={handleSaveInfo} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-md">
                          <Save className="w-4 h-4" />
                          <span>{saving ? "Saving..." : "Save"}</span>
                        </button>
                        <button onClick={() => { setEdited(project ? { ...project } : null); setIsEditingInfo(false); }} className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md">Cancel</button>
                      </>
                    )}
                  </div>
                )}
                {canDeleteProject && (
                  <button
                    onClick={() => setShowConfirmDeleteProject(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Project</span>
                  </button>
                )}
              </div>
              {!canUpdateProject && (
                <div className="px-3 py-2 bg-yellow-900/30 border border-yellow-700/40 rounded text-yellow-200 text-sm">
                  You can only view project information. Contact an Administrator or Project Admin to make changes.
                </div>
              )}
            </div>
          )}

          {activeTab === "access" && (
            <div className="space-y-4">
              {!canManageInvites && (
                <div className="px-3 py-2 bg-yellow-900/30 border border-yellow-700/40 rounded text-yellow-200 text-sm">
                  You don't have permission to manage access. You can view your assigned packages below.
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Name</label>
                  <input value={invite.name} onChange={(e) => setInvite({ ...invite, name: e.target.value })} disabled={!canManageInvites} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white disabled:opacity-60" />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Surname</label>
                  <input value={invite.surname} onChange={(e) => setInvite({ ...invite, surname: e.target.value })} disabled={!canManageInvites} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white disabled:opacity-60" />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Email</label>
                  <input type="email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} disabled={!canManageInvites} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white disabled:opacity-60" />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Role</label>
                  <select value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value })} disabled={!canManageInvites} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white disabled:opacity-60">
                    {roles.map((r) => {
                      const isPA = r === 'Project Admin';
                      return (
                        <option key={r} value={r} disabled={isPA && !canAppointProjectAdmin}>
                          {r}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm text-gray-300 mb-1">Society</label>
                  <input value={invite.society} onChange={(e) => setInvite({ ...invite, society: e.target.value })} disabled={!canManageInvites} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white disabled:opacity-60" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm text-gray-300 mb-2">Packages</label>
                  <div className="flex flex-wrap gap-3">
                    {(["BIM", "IoT", "Database", "AI", "FM"] as const).map((pkg) => (
                      <label key={pkg} className={`flex items-center gap-2 px-3 py-1.5 rounded-md border ${invite.packages[pkg] ? "bg-blue-600/20 border-blue-500 text-blue-200" : "bg-gray-700/50 border-gray-600 text-gray-300"}`}>
                        <input type="checkbox" checked={invite.packages[pkg]} onChange={(e) => setInvite({ ...invite, packages: { ...invite.packages, [pkg]: e.target.checked } })} disabled={!canManageInvites} />
                        <CheckSquare className="w-4 h-4" /> {pkg}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <button onClick={handleSendInvite} disabled={saving || !canManageInvites} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-md">
                  <Mail className="w-4 h-4" />
                  <span>{saving ? "Sending..." : "Send Invite"}</span>
                </button>
              </div>

              {/* Invites list */}
              <div className="pt-2 border-t border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-200">Invitations</h3>
                  <button onClick={loadInvites} className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded">Refresh</button>
                </div>
                {invitesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-sm text-gray-400">Loading invites…</div>
                  </div>
                ) : displayInvites.length === 0 ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-sm text-gray-400">No invites yet.</div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-300 border-b border-gray-700">
                          <th className="py-2 pr-3 font-semibold text-xs uppercase tracking-wider">Name</th>
                          <th className="py-2 pr-3 font-semibold text-xs uppercase tracking-wider">Email</th>
                          <th className="py-2 pr-3 font-semibold text-xs uppercase tracking-wider">Role</th>
                          <th className="py-2 pr-3 font-semibold text-xs uppercase tracking-wider">Status</th>
                          <th className="py-2 pr-3 font-semibold text-xs uppercase tracking-wider">Packages</th>
                          <th className="py-2 pr-3 font-semibold text-xs uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-700">
                        {displayInvites.map((inv) => {
                          const id = getInviteId(inv);
                          const pkgs: string[] = Array.isArray(inv?.invitee?.packages) ? inv.invitee.packages : [];
                          const isAccepted = inv.status === 'accepted';
                          return (
                            <tr key={id} className="hover:bg-gray-800/30 transition-colors">
                              <td className="py-2.5 pr-3 text-gray-200 text-sm font-medium">
                                {`${inv?.invitee?.name || ''} ${inv?.invitee?.surname || ''}`.trim() || '—'}
                              </td>
                              <td className="py-2.5 pr-3 text-gray-300 text-sm">
                                {inv?.invitee?.email}
                              </td>
                              <td className="py-2.5 pr-3">
                                <select
                                  value={inv?.invitee?.role || 'General'}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    setInvitesList((prev) => prev.map((row) => (
                                      getInviteId(row) === id ? { ...row, invitee: { ...row.invitee, role: value } } : row
                                    )));
                                  }}
                                  disabled={!canManageInvites}
                                  className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-gray-200 text-sm min-w-[120px] focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                >
                                  {roles.map((r) => {
                                    const isPA = r === 'Project Admin';
                                    return (
                                      <option key={r} value={r} disabled={isPA && !canAppointProjectAdmin}>
                                        {r}
                                      </option>
                                    );
                                  })}
                                </select>
                              </td>
                              <td className="py-2.5 pr-3">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                  isAccepted 
                                    ? 'bg-green-800/30 text-green-300' 
                                    : 'bg-yellow-800/30 text-yellow-300'
                                }`}>
                                  {inv.status}
                                </span>
                              </td>
                              <td className="py-2.5 pr-3">
                                <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
                                  {(['BIM', 'IoT', 'AI', 'FM', 'Database'] as Pkg[]).map((pkg) => (
                                    <label 
                                      key={pkg} 
                                      className={`flex items-center justify-center gap-1 px-2 py-1 rounded border text-xs cursor-pointer transition-all ${
                                        pkg === 'Database' ? 'col-span-2' : ''
                                      } ${
                                        pkgs.includes(pkg) 
                                          ? 'bg-blue-600/20 border-blue-500/50 text-blue-200' 
                                          : 'bg-gray-700/40 border-gray-600/50 text-gray-300'
                                      }`}
                                    >
                                      <input 
                                        type="checkbox" 
                                        checked={pkgs.includes(pkg)} 
                                        onChange={() => toggleInvitePackage(id, pkg)} 
                                        disabled={!canManageInvites}
                                        className="w-3 h-3 text-blue-500 bg-gray-700 border-gray-600 rounded"
                                      />
                                      {pkg}
                                    </label>
                                  ))}
                                </div>
                              </td>
                              <td className="py-2.5 pr-3">
                                <div className="flex gap-1.5">
                                  <button
                                    onClick={() => saveInvitePackages(id)}
                                    className="bg-blue-500 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-600 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors min-w-[60px] flex items-center justify-center"
                                    disabled={updatingPackageId === id}
                                  >
                                    {updatingPackageId === id ? (
                                      <div className="flex items-center gap-1">
                                        <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
                                      </div>
                                    ) : (
                                      'Save'
                                    )}
                                  </button>
                                  <button 
                                    onClick={() => handleRevokeInvite(id)} 
                                    disabled={!canManageInvites} 
                                    className="px-2.5 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                  >
                                    Revoke
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "upload" && (
            <div className="space-y-4">
              {!canUploadOrReplace && (
                <div className="px-3 py-2 bg-yellow-900/30 border border-yellow-700/40 rounded text-yellow-200 text-sm">
                  You don't have permission to upload or replace models.
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Model Description</label>
                  <input value={newModel.name} onChange={(e) => setNewModel({ ...newModel, name: e.target.value })} disabled={!canUploadOrReplace} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white disabled:opacity-60" />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Discipline</label>
                  <select value={newModel.discipline}
                          onChange={(e) => setNewModel({ ...newModel, discipline: e.target.value.toLowerCase() })}
                          disabled={!canUploadOrReplace}
                          className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white capitalize disabled:opacity-60">
                    {['architecture','structure','mep','electrical','plumbing','hvac','other'].map(d => (
                      <option key={d} value={d}>{capitalize(d)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Paste URN (optional)</label>
                  <input value={newModel.urn} onChange={(e) => setNewModel({ ...newModel, urn: e.target.value })} placeholder="urn:adsk.objects:..." disabled={!canUploadOrReplace} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white disabled:opacity-60" />
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
                    disabled={!canUploadOrReplace}
                  />
                  <label
                    htmlFor="modelFile"
                    className={`w-full flex items-center justify-between gap-3 px-3 py-3 rounded-md border border-dashed border-gray-600 ${canUploadOrReplace ? 'bg-gray-700 hover:bg-gray-600 cursor-pointer' : 'bg-gray-800 cursor-not-allowed opacity-60'} text-gray-200 transition-colors`}
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
                  <input value={newModel.fileType} onChange={(e) => setNewModel({ ...newModel, fileType: e.target.value })} disabled={!canUploadOrReplace} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white disabled:opacity-60" />
                </div>
              </div>
              {(uploading || translating) && (
                <div className="px-3 py-2 bg-blue-900/20 border border-blue-700/30 rounded text-blue-200 text-sm">
                  {uploading ? 'Uploading file to Forge...' : 'Starting translation...'}
                </div>
              )}
              <div className="flex justify-end">
                <button onClick={handleUploadOrReplace} disabled={saving || !canUploadOrReplace || !newModel.name || (!newModel.urn && !selectedFile)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-md">
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
                <select 
                  value={removeModelId} 
                  onChange={(e) => setRemoveModelId(e.target.value)} 
                  disabled={!canRemoveModel} 
                  className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-800"
                >
                  <option value="">-- Choose a model --</option>
                  {(project.models || []).map((m) => (
                    <option key={m.id} value={m.id}>{m.name} ({capitalize((m.discipline || 'other') as string)})</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end">
                <button onClick={() => setShowConfirmRemove(true)} disabled={saving || !removeModelId || !canRemoveModel} className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white rounded-md">
                  <Trash2 className="w-4 h-4" />
                  <span>{saving ? "Removing..." : "Remove"}</span>
                </button>
              </div>
              {showConfirmRemove && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
                  <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl w-full max-w-md mx-4">
                    <div className="p-4 border-b border-gray-700">
                      <h3 className="text-lg font-semibold text-white">Confirm Removal</h3>
                    </div>
                    <div className="p-4 text-gray-200">
                      Are you sure you want to remove this model?
                    </div>
                    <div className="p-4 flex justify-end gap-2 border-t border-gray-700">
                      <button onClick={() => setShowConfirmRemove(false)} className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md">Cancel</button>
                      <button onClick={async () => { setShowConfirmRemove(false); await handleRemoveModel(); }} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md">Yes</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Delete Project Confirmation Modal */}
      {showConfirmDeleteProject && (
        <div className="fixed inset-0 backdrop-blur-sm bg-black/50 flex items-center justify-center z-60">
          <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Delete Project</h3>
                <p className="text-sm text-gray-400">This action cannot be undone</p>
              </div>
            </div>
            <div className="mb-6">
              <p className="text-gray-300 mb-2">
                Are you sure you want to delete the project <strong>"{project?.name}"</strong>?
              </p>
              <p className="text-sm text-gray-400">
                This will permanently delete:
              </p>
              <ul className="text-sm text-gray-400 mt-2 ml-4 list-disc">
                <li>All project data and models</li>
                <li>All invitations and access permissions</li>
                <li>All associated IoT sensors and data</li>
              </ul>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmDeleteProject(false)}
                className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md transition-colors"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteProject}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors disabled:opacity-60"
                disabled={saving}
              >
                {saving ? "Deleting..." : "Delete Project"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
