"use client";
import { useEffect, useState } from "react";
import { User, Home, LogOut, Bell, Menu, ChevronDown, Info, Folder, UserPlus, Users, BookOpen } from "lucide-react";
import { useNotifications } from "@/app/context/notification-context";
import { NotificationsMenu } from "./notifications-menu";
import { OwnerPendingAdminsModal } from "./owner-pending-admins-modal";
import { ProfileModal } from "./profile-modal";
import { AdminRequestModal } from "./admin-request-modal";
import { ManageAdministratorsModal } from "./manage-administrators-modal";
import { ThemeToggle } from "@/app/components/ui/theme-toggle";

interface DashboardHeaderProps {
  onSignOut: () => void;
  user?: any;
  activePanel: 'bim' | 'iot' | 'database' | 'ai' | 'fm' | 'vt' | null; // Added FM and VT
  onPanelChange: (panel: 'bim' | 'iot' | 'database' | 'ai' | 'fm' | 'vt') => void; // Added FM and VT
  onCreateProject: () => void;
  selectedProject?: any;
  onShowProjectInfo?: () => void;
  onShowMyProjects?: () => void;
  platformOwner?: boolean;
}

export function DashboardHeader({ onSignOut, user, activePanel, onPanelChange, onCreateProject, selectedProject, onShowProjectInfo, onShowMyProjects, platformOwner }: DashboardHeaderProps) {
  const { unreadCount } = useNotifications();
  const [showNotifications, setShowNotifications] = useState(false);
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
  const getButtonClass = (panel: 'bim' | 'iot' | 'database' | 'ai' | 'fm' | 'vt') => {
    return `px-4 py-1.5 text-sm rounded-full font-medium transition-all duration-300 ${
      activePanel === panel
        ? "text-foreground bg-gradient-to-r from-blue-500/20 to-purple-500/20 shadow-[0_0_20px_rgba(59,130,246,0.15)] border border-primary/30" // Style for active button
        : "text-muted-foreground hover:text-foreground hover:bg-accent border border-transparent"
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
    <>
      <header className="bg-card/80 backdrop-blur-2xl border-b border-border px-6 py-3 shadow-[0_4px_40px_rgba(0,0,0,0.2)] relative z-50">
        <div className="flex items-center justify-between">
        {/* Left Section */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.5)]">
              <span className="text-primary-foreground font-bold text-xs">AP</span>
            </div>
            <h1 className="text-lg font-semibold text-foreground tracking-wide">Adaptivity Platform</h1>
          </div>
        </div>

        {/* Center Section - Navigation */}
        <div className="absolute left-1/2 transform -translate-x-1/2">
          <nav className="hidden md:flex items-center gap-1.5 bg-background/40 p-1 rounded-full border border-border/50">
            <button className={getButtonClass('bim')} onClick={() => onPanelChange('bim')}>BIM</button>
            <button className={getButtonClass('iot')} onClick={() => onPanelChange('iot')}>IoT</button>
            <button className={getButtonClass('database')} onClick={() => onPanelChange('database')}>Database</button>
            <button className={getButtonClass('ai')} onClick={() => onPanelChange('ai')}>AI</button>
            <button className={getButtonClass('vt')} onClick={() => onPanelChange('vt')}>VT</button>
            <button className={getButtonClass('fm')} onClick={() => onPanelChange('fm')}>FM</button>
          </nav>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <div className="relative">
            <button
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-full transition-all duration-300 relative"
              onClick={() => setShowNotifications((v) => !v)}
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-destructive text-[10px] text-destructive-foreground rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            {showNotifications && (
              <NotificationsMenu onClose={() => setShowNotifications(false)} />
            )}
          </div>
          <button
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-full transition-all duration-300"
            onClick={() => onShowMyProjects && onShowMyProjects()}
            title="My Projects"
          >
            <Home className="w-4 h-4" />
          </button>
          <div className="relative">
            <button
              className="flex items-center gap-2 px-2 py-1.5 rounded-full hover:bg-accent transition-all duration-300"
              onClick={() => setShowProfileMenu(!showProfileMenu)}
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-primary-foreground text-xs font-medium shadow-[0_0_10px_rgba(37,99,235,0.4)] border border-primary/30">
                {user?.name?.[0]?.toUpperCase() || 'U'}
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            {showProfileMenu && (
              <div className="absolute right-0 top-full mt-3 w-64 bg-popover/95 backdrop-blur-xl border border-border rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] z-50 overflow-hidden">
                <div className="p-4 border-b border-border/50 bg-gradient-to-b from-foreground/[0.02] to-transparent">
                  <p className="text-sm font-semibold text-popover-foreground tracking-wide">{user?.name || "User"}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{user?.email || "-"}</p>
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
                      'General': 'bg-muted/20 text-muted-foreground border-border/40',
                    };
                    const roleCls = colorMap[role] || 'bg-muted/20 text-muted-foreground border-border/40';
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
                  <button className="w-full flex items-center gap-2 px-3 py-2 text-popover-foreground/80 hover:text-popover-foreground hover:bg-accent transition-colors" onClick={() => { setShowProfileModal(true); setShowProfileMenu(false); }}>
                    <User className="w-4 h-4" />
                    <span>Profile</span>
                  </button>
                  <button className="w-full flex items-center gap-2 px-3 py-2 text-popover-foreground/80 hover:text-popover-foreground hover:bg-accent transition-colors" onClick={() => { onShowMyProjects && onShowMyProjects(); setShowProfileMenu(false); }}>
                    <Folder className="w-4 h-4" />
                    <span>My Projects</span>
                  </button>
                  
                  {/* Manage Administrators - Platform Owner only */}
                  {platformOwner && (
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 text-popover-foreground/80 hover:text-popover-foreground hover:bg-accent transition-colors"
                      onClick={() => { setShowManageAdministratorsModal(true); setShowProfileMenu(false); }}
                    >
                      <Users className="w-4 h-4" />
                      <span>Manage Administrators</span>
                    </button>
                  )}
                  
                  {canManagePendingAdmins && (
                    <button
                      className="w-full flex items-center justify-between px-3 py-2 text-popover-foreground/80 hover:text-popover-foreground hover:bg-accent transition-colors"
                      onClick={() => { setShowPendingAdminsModal(true); setShowProfileMenu(false); }}
                    >
                      <span className="flex items-center gap-2">
                        <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-muted-foreground text-[10px] text-muted-foreground">PA</span>
                        <span>Pending Admins</span>
                      </span>
                      {pendingAdminsCount > 0 && (
                        <span
                          className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-yellow-400 text-foreground text-[10px] font-bold"
                          title={`${pendingAdminsCount} pending`}
                        >
                          !
                        </span>
                      )}
                    </button>
                  )}

                  <button 
                    className="w-full flex items-center gap-2 px-3 py-2 text-popover-foreground/80 hover:text-popover-foreground hover:bg-accent transition-colors"
                    onClick={onShowProjectInfo}
                  >
                    <Info className="w-4 h-4" />
                    <span>Project Info</span>
                  </button>

                  <a
                    href="/manual"
                    target="_blank"
                    rel="noreferrer"
                    className="w-full flex items-center gap-2 px-3 py-2 text-popover-foreground/80 hover:text-popover-foreground hover:bg-accent transition-colors"
                    onClick={() => setShowProfileMenu(false)}
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>User Manual</span>
                  </a>
                  
                  {/* Request Administrator Access - show for non-Platform Owner and non-Administrator users */}
                  {user && !platformOwner && !canCreate && (
                    <button 
                      className="w-full flex items-center gap-2 px-3 py-2 text-popover-foreground/80 hover:text-popover-foreground hover:bg-accent transition-colors"
                      onClick={() => { setShowAdminRequestModal(true); setShowProfileMenu(false); }}
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Request Admin Access</span>
                    </button>
                  )}
                  
                  <div className="border-t border-border my-1"></div>
                  {user && canCreate && (
                    <button
                      onClick={onCreateProject}
                      className="w-full flex items-center gap-2 px-3 py-2 text-primary hover:text-primary hover:bg-accent transition-colors"
                    >
                      <span className="w-4 h-4 flex items-center justify-center">+</span>
                      <span>Create Project</span>
                    </button>
                  )}
                  <button
                    className="w-full flex items-center gap-2 px-3 py-2 text-destructive hover:text-destructive hover:bg-accent transition-colors"
                    onClick={onSignOut}
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
          <button className="md:hidden p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors">
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </div>
      </header>
      
      {showProfileMenu && <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)}></div>}
      {showNotifications && <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)}></div>}
      
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
    </>
  );
}