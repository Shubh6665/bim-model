"use client";
import { useState } from "react";
import { User, Settings, LogOut, Bell, Search, Menu, ChevronDown } from "lucide-react";

interface DashboardHeaderProps {
  onSignOut: () => void;
  user?: any;
  activePanel: 'bim' | 'iot' | 'database' | 'ai'; // Added active panel state
  onPanelChange: (panel: 'bim' | 'iot' | 'database' | 'ai') => void; // Added panel change handler
}

export function DashboardHeader({ onSignOut, user, activePanel, onPanelChange }: DashboardHeaderProps) {
  const [notifications] = useState(3);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // Helper function for button styles
  const getButtonClass = (panel: 'bim' | 'iot' | 'database' | 'ai') => {
    return `px-3 py-2 rounded-md transition-colors ${
      activePanel === panel
        ? "text-white bg-gray-700/50" // Style for active button
        : "text-gray-300 hover:text-white hover:bg-gray-800"
    }`;
  };

  return (
    <header className="bg-gray-900 border-b border-gray-700 px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Left Section */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">BIM</span>
            </div>
            <h1 className="text-xl font-bold text-white">BIM Viewer Pro</h1>
          </div>
          <nav className="hidden md:flex items-center gap-1">
            <button className={getButtonClass('bim')} onClick={() => onPanelChange('bim')}>BIM</button>
            <button className={getButtonClass('iot')} onClick={() => onPanelChange('iot')}>IoT</button>
            <button className={getButtonClass('database')} onClick={() => onPanelChange('database')}>Database</button>
            <button className={getButtonClass('ai')} onClick={() => onPanelChange('ai')}>AI</button>
          </nav>
        </div>

        {/* Center Section */}
        <div className="hidden md:flex items-center flex-1 max-w-md mx-8">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search projects, models..."
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-600 text-white placeholder-gray-400 rounded-md focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-4">
          <button className="relative p-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded-md transition-colors">
            <Bell className="w-5 h-5" />
            {notifications > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {notifications}
              </span>
            )}
          </button>
          <button className="p-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded-md transition-colors">
            <Settings className="w-5 h-5" />
          </button>
          <div className="relative">
            <button
              className="flex items-center gap-2 p-2 hover:bg-gray-800 rounded-md transition-colors"
              onClick={() => setShowProfileMenu(!showProfileMenu)}
            >
              {user?.image ? (
                <img src={user.image} alt={user.name || "User"} className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">{user?.name ? user.name[0] : "U"}</span>
                </div>
              )}
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>
            {showProfileMenu && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50">
                <div className="p-3 border-b border-gray-700">
                  <p className="text-sm font-medium text-white">{user?.name || "User"}</p>
                  <p className="text-xs text-gray-400">{user?.email || "-"}</p>
                </div>
                <div className="py-1">
                  <button className="w-full flex items-center gap-2 px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-700 transition-colors">
                    <User className="w-4 h-4" />
                    <span>Profile</span>
                  </button>
                  <button className="w-full flex items-center gap-2 px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-700 transition-colors">
                    <Settings className="w-4 h-4" />
                    <span>Settings</span>
                  </button>
                  <div className="border-t border-gray-700 my-1"></div>
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