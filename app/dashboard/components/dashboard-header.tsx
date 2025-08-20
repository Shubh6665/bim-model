"use client";
import { useState } from "react";
import { User, Home, LogOut, Bell, Search, Menu, ChevronDown, Info, Folder } from "lucide-react";

interface DashboardHeaderProps {
  onSignOut: () => void;
  user?: any;
  activePanel: 'bim' | 'iot' | 'database' | 'ai' | 'fm' | null; // Added FM
  onPanelChange: (panel: 'bim' | 'iot' | 'database' | 'ai' | 'fm') => void; // Added FM
  onCreateProject: () => void;
  selectedProject?: any;
  onShowProjectInfo?: () => void;
  onShowMyProjects?: () => void;
}

export function DashboardHeader({ onSignOut, user, activePanel, onPanelChange, onCreateProject, selectedProject, onShowProjectInfo, onShowMyProjects }: DashboardHeaderProps) {
  const [notifications] = useState(3);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // Helper function for button styles
  const getButtonClass = (panel: 'bim' | 'iot' | 'database' | 'ai' | 'fm') => {
    return `px-2.5 py-1 text-sm rounded transition-colors ${
      activePanel === panel
        ? "text-white bg-gray-700/50" // Style for active button
        : "text-gray-300 hover:text-white hover:bg-gray-800"
    }`;
  };

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
            onClick={onShowProjectInfo}
            title={selectedProject ? `Project Info: ${selectedProject.name}` : "Project Information"}
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
                  {/* Role badge (project-scoped if available) */}
                  {(() => {
                    // Determine role to show
                    const isOwner = !!selectedProject?.access?.owner || selectedProject?.access?.role === 'Owner';
                    const projRole = isOwner ? 'Owner' : (selectedProject?.access?.role || '');
                    const fallbackRole = user?.role === 'admin' ? 'Global Admin' : 'User';
                    const role = projRole || fallbackRole;
                    // Color mapping
                    const colorMap: Record<string, string> = {
                      'Owner': 'bg-purple-600/20 text-purple-300 border-purple-500/40',
                      'ProjectAdmin': 'bg-blue-600/20 text-blue-300 border-blue-500/40',
                      'General': 'bg-gray-600/20 text-gray-300 border-gray-500/40',
                      'BIM Specialist': 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40',
                      'BIM Coordinator': 'bg-teal-600/20 text-teal-300 border-teal-500/40',
                      'BIM Manager': 'bg-cyan-600/20 text-cyan-300 border-cyan-500/40',
                      'Designer': 'bg-pink-600/20 text-pink-300 border-pink-500/40',
                      'Facility Manager': 'bg-amber-600/20 text-amber-300 border-amber-500/40',
                      'Maintenance Team': 'bg-lime-600/20 text-lime-300 border-lime-500/40',
                      'Planner': 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40',
                      'Other': 'bg-slate-600/20 text-slate-300 border-slate-500/40',
                      'Global Admin': 'bg-red-600/20 text-red-300 border-red-500/40',
                      'User': 'bg-gray-600/20 text-gray-300 border-gray-500/40',
                    };
                    const cls = colorMap[role] || 'bg-gray-600/20 text-gray-300 border-gray-500/40';
                    return (
                      <div className="mt-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] border ${cls}`}>
                          {role}
                        </span>
                      </div>
                    );
                  })()}
                </div>
                <div className="py-1">
                  <button className="w-full flex items-center gap-2 px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-700 transition-colors">
                    <User className="w-4 h-4" />
                    <span>Profile</span>
                  </button>
                  <button className="w-full flex items-center gap-2 px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-700 transition-colors" onClick={() => { onShowMyProjects && onShowMyProjects(); setShowProfileMenu(false); }}>
                    <Folder className="w-4 h-4" />
                    <span>My Projects</span>
                  </button>
                  
                  <button 
                    className="w-full flex items-center gap-2 px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-700 transition-colors"
                    onClick={onShowProjectInfo}
                  >
                    <Info className="w-4 h-4" />
                    <span>Project Info</span>
                  </button>
                  <div className="border-t border-gray-700 my-1"></div>
                  {user && (
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
    </header>
  );
}