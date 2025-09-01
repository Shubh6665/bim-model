"use client";
import { useEffect, useState } from "react";
import { User, Home, LogOut, Bell, Search, Menu, ChevronDown, Info, Folder, UserPlus, Users } from "lucide-react";
import { OwnerPendingAdminsModal } from "./owner-pending-admins-modal";
import { ProfileModal } from "./profile-modal";
import { AdminRequestModal } from "./admin-request-modal";
import { ManageAdministratorsModal } from "./manage-administrators-modal";

interface DashboardHeaderProps {
  onSignOut: () => void;
  user?: any;
  activePanel: 'bim' | 'iot' | 'database' | 'ai' | 'fm' | null; // Added FM
  onPanelChange: (panel: 'bim' | 'iot' | 'database' | 'ai' | 'fm') => void; // Added FM
  onCreateProject: () => void;
  selectedProject?: any;
  onShowProjectInfo?: () => void;
  onShowMyProjects?: () => void;
  platformOwner?: boolean;
}

export function DashboardHeader({ onSignOut, user, activePanel, onPanelChange, onCreateProject, selectedProject, onShowProjectInfo, onShowMyProjects, platformOwner }: DashboardHeaderProps) {
  const [notifications] = useState(3);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showPendingAdminsModal, setShowPendingAdminsModal] = useState(false);
  const [showManageAdministratorsModal, setShowManageAdministratorsModal] = useState(false);
  const [canManagePendingAdmins, setCanManagePendingAdmins] = useState<boolean>(false);
  const [pendingAdminsCount, setPendingAdminsCount] = useState<number>(0);
  const [canCreate, setCanCreate] = useState<boolean>(!!platformOwner);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showAdminRequestModal, setShowAdminRequestModal] = useState(false);

  // Probe capability and fetch count: Only Platform Owner can access /api/admins
  useEffect(() => {
    if (!showProfileMenu) return;
    let aborted = false;
    (async () => {
      try {
        const res = await fetch('/api/admins', { method: 'GET' });
        if (aborted) return;
        setCanManagePendingAdmins(res.ok);
        if (res.ok) {
          const data = await res.json();
          const count = Array.isArray(data?.pending) ? data.pending.length : 0;
          setPendingAdminsCount(count);
        } else {
          setPendingAdminsCount(0);
        }
      } catch {
        if (aborted) return;
        setCanManagePendingAdmins(false);
        setPendingAdminsCount(0);
      }
    })();
    return () => { aborted = true; };
  }, [showProfileMenu]);

  // Probe if user can create project (Administrator or PlatformOwner)
  // Run proactively on mount and when user/platformOwner changes, not only when menu opens
  useEffect(() => {
    let aborted = false;
    const checkCanCreate = async () => {
      try {
        // Platform owner always can create
        if (platformOwner) {
          setCanCreate(true);
          return;
        }
        const r = await fetch(`/api/projects/can-create?t=${Date.now()}`, { cache: 'no-store' });
        if (aborted) return;
        if (r.ok) {
          const j = await r.json();
          setCanCreate(!!j?.canCreate);
        } else {
          setCanCreate(false);
        }
      } catch {
        if (aborted) return;
        setCanCreate(false);
      }
    };

    checkCanCreate();
    return () => { aborted = true; };
  }, [user?.email, platformOwner]);

  // Listen for admin permission changes and refresh canCreate state
  useEffect(() => {
    const handleAdminPermissionsChanged = (event: CustomEvent) => {
      // If the current user's admin access was removed, refresh their permissions
      const { removedEmail } = event.detail;
      if (user?.email && removedEmail && user.email.toLowerCase() === removedEmail.toLowerCase()) {
        // Show immediate notification and refresh permissions
        alert('Your administrator access has been removed. The page will refresh to update your permissions.');
        
        // Force a page refresh to get fresh session data
        // This is necessary because JWT tokens cache user permissions
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        // For other users, just refresh the canCreate state
        setTimeout(async () => {
          try {
            if (platformOwner) {
              setCanCreate(true);
              return;
            }
            const r = await fetch(`/api/projects/can-create?t=${Date.now()}`, { cache: 'no-store' });
            if (r.ok) {
              const j = await r.json();
              setCanCreate(!!j?.canCreate);
            } else {
              setCanCreate(false);
            }
          } catch {
            setCanCreate(false);
          }
        }, 500);
      }
    };

    window.addEventListener('admin-permissions-changed', handleAdminPermissionsChanged as EventListener);
    return () => {
      window.removeEventListener('admin-permissions-changed', handleAdminPermissionsChanged as EventListener);
    };
  }, [user?.email, platformOwner]);

  // Helper function for button styles
  const getButtonClass = (panel: 'bim' | 'iot' | 'database' | 'ai' | 'fm') => {
    return `px-2.5 py-1 text-sm rounded transition-colors ${
      activePanel === panel
        ? "text-white bg-gray-700/50" // Style for active button
        : "text-gray-300 hover:text-white hover:bg-gray-800"
    }`;
  };

  // Compute role info for profile modal
  // If a project is selected, use its access.role. Otherwise:
  // - PlatformOwner => PlatformOwner
  // - If canCreate is true (approved Administrator, possibly global '(unspecified)') => Administrator
  // - Else General
  const effectiveRole: string = selectedProject?.access?.role || (platformOwner ? 'PlatformOwner' : (canCreate ? 'Administrator' : 'General'));
  const baseRoleLabel: string = effectiveRole === 'ProjectAdmin' ? 'Project Admin' : effectiveRole;
  const projectDisplayRole: string | undefined = selectedProject?.access?.displayRole;
  const roleLabel: string = projectDisplayRole && selectedProject ? projectDisplayRole : baseRoleLabel;
  const isOwnerFlag: boolean = !!selectedProject?.access?.owner;

  return (
    <header className="bg-gray-900 border-b border-gray-700 px-4 py-2.5">
      <div className="flex items-center justify-between">
        {/* Left Section */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xs">BIM</span>
            </div>
            <h1 className="text-lg font-bold text-white">BIM Viewer Pro</h1>
          </div>
          <nav className="hidden md:flex items-center gap-0.5">
            <button className={getButtonClass('bim')} onClick={() => onPanelChange('bim')}>BIM</button>
            <button className={getButtonClass('iot')} onClick={() => onPanelChange('iot')}>IoT</button>
            <button className={getButtonClass('database')} onClick={() => onPanelChange('database')}>Database</button>
            <button className={getButtonClass('ai')} onClick={() => onPanelChange('ai')}>AI</button>
            <button className={getButtonClass('fm')} onClick={() => onPanelChange('fm')}>FM</button>
          </nav>
        </div>

        {/* Center Section */}
        <div className="hidden md:flex items-center flex-1 max-w-md mx-4">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
            <input
              type="text"
              placeholder="Search projects, models..."
              className="w-full bg-gray-800 border border-gray-700 rounded-md py-1.5 pl-8 pr-3 text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-2">
          <button className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full transition-colors relative">
            <Bell className="w-4 h-4" />
            {notifications > 0 && (
              <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full"></span>
            )}
          </button>
          <button 
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full transition-colors"
            onClick={() => onShowMyProjects && onShowMyProjects()}
            title="My Projects"
          >
            <Home className="w-4 h-4" />
          </button>
          <div className="relative">
            <button
              className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-gray-800 transition-colors"
              onClick={() => setShowProfileMenu(!showProfileMenu)}
            >
              <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-medium">
                {user?.name?.[0]?.toUpperCase() || 'U'}
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </button>
            {showProfileMenu && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50">
                <div className="p-3 border-b border-gray-700">
                  <p className="text-sm font-medium text-white">{user?.name || "User"}</p>
                  <p className="text-xs text-gray-400">{user?.email || "-"}</p>
                  {/* RBAC Role badges (project-scoped or global PlatformOwner) */}
                  {(() => {
                    // If no project selected:
                    // - PlatformOwner => PlatformOwner
                    // - Approved Administrator (canCreate) => Administrator
                    // - Else General
                    const role: string = selectedProject?.access?.role || (platformOwner ? 'PlatformOwner' : (canCreate ? 'Administrator' : 'General'));
                    const displayRoleRaw: string | undefined = selectedProject?.access?.displayRole;
                    const isOwner: boolean = !!selectedProject?.access?.owner;
                    // Color mapping for known roles
                    const colorMap: Record<string, string> = {
                      'PlatformOwner': 'bg-purple-600/20 text-purple-300 border-purple-500/40',
                      'Administrator': 'bg-red-600/20 text-red-300 border-red-500/40',
                      'AdministratorPending': 'bg-amber-600/20 text-amber-200 border-amber-500/40',
                      'ProjectAdmin': 'bg-blue-600/20 text-blue-300 border-blue-500/40',
                      'General': 'bg-gray-600/20 text-gray-300 border-gray-500/40',
                    };
                    const roleCls = colorMap[role] || 'bg-gray-600/20 text-gray-300 border-gray-500/40';
                    // If a project-specific displayRole exists (e.g., BIM Manager), prefer it for label.
                    const displayRoleBase = role === 'ProjectAdmin' ? 'Project Admin' : role;
                    const displayRole = (displayRoleRaw && displayRoleRaw.trim().length > 0) ? displayRoleRaw : displayRoleBase;
                    const ownerCls = 'bg-fuchsia-600/20 text-fuchsia-300 border-fuchsia-500/40';
                    return (
                      <div className="mt-2 flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] border ${roleCls}`}>
                          {displayRole}
                        </span>
                        {isOwner && role !== 'Owner' && role !== 'PlatformOwner' && (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] border ${ownerCls}`}>
                            Owner
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </div>
                <div className="py-1">
                  <button className="w-full flex items-center gap-2 px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-700 transition-colors" onClick={() => { setShowProfileModal(true); setShowProfileMenu(false); }}>
                    <User className="w-4 h-4" />
                    <span>Profile</span>
                  </button>
                  <button className="w-full flex items-center gap-2 px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-700 transition-colors" onClick={() => { onShowMyProjects && onShowMyProjects(); setShowProfileMenu(false); }}>
                    <Folder className="w-4 h-4" />
                    <span>My Projects</span>
                  </button>
                  
                  {/* Manage Administrators - Platform Owner only */}
                  {platformOwner && (
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-700 transition-colors"
                      onClick={() => { setShowManageAdministratorsModal(true); setShowProfileMenu(false); }}
                    >
                      <Users className="w-4 h-4" />
                      <span>Manage Administrators</span>
                    </button>
                  )}
                  
                  {canManagePendingAdmins && (
                    <button
                      className="w-full flex items-center justify-between px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-700 transition-colors"
                      onClick={() => { setShowPendingAdminsModal(true); setShowProfileMenu(false); }}
                    >
                      <span className="flex items-center gap-2">
                        <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-gray-500 text-[10px] text-gray-300">PA</span>
                        <span>Pending Admins</span>
                      </span>
                      {pendingAdminsCount > 0 && (
                        <span
                          className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-yellow-400 text-gray-900 text-[10px] font-bold"
                          title={`${pendingAdminsCount} pending`}
                        >
                          !
                        </span>
                      )}
                    </button>
                  )}

                  <button 
                    className="w-full flex items-center gap-2 px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-700 transition-colors"
                    onClick={onShowProjectInfo}
                  >
                    <Info className="w-4 h-4" />
                    <span>Project Info</span>
                  </button>
                  
                  {/* Request Administrator Access - show for non-Platform Owner and non-Administrator users */}
                  {user && !platformOwner && !canCreate && (
                    <button 
                      className="w-full flex items-center gap-2 px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-700 transition-colors"
                      onClick={() => { setShowAdminRequestModal(true); setShowProfileMenu(false); }}
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Request Admin Access</span>
                    </button>
                  )}
                  
                  <div className="border-t border-gray-700 my-1"></div>
                  {user && canCreate && (
                    <button 
                      onClick={onCreateProject}
                      className="w-full flex items-center gap-2 px-3 py-2 text-blue-400 hover:text-blue-300 hover:bg-gray-700 transition-colors"
                    >
                      <span className="w-4 h-4 flex items-center justify-center">+</span>
                      <span>Create Project</span>
                    </button>
                  )}
                  <button
                    className="w-full flex items-center gap-2 px-3 py-2 text-red-400 hover:text-red-300 hover:bg-gray-700 transition-colors"
                    onClick={onSignOut}
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
          <button className="md:hidden p-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded-md transition-colors">
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </div>
      {showProfileMenu && <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)}></div>}
      {showPendingAdminsModal && (
        <OwnerPendingAdminsModal onClose={() => setShowPendingAdminsModal(false)} />
      )}
      {showManageAdministratorsModal && (
        <ManageAdministratorsModal onClose={() => setShowManageAdministratorsModal(false)} />
      )}
      <AdminRequestModal 
        show={showAdminRequestModal} 
        onClose={() => setShowAdminRequestModal(false)} 
      />
      <ProfileModal 
        open={showProfileModal} 
        onClose={() => setShowProfileModal(false)} 
        email={user?.email}
        roleInfo={{ roleLabel, isOwner: isOwnerFlag }}
        projectId={selectedProject?._id || selectedProject?.id}
      />
    </header>
  );
}