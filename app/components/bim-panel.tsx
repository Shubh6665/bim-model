"use client";

import React, { useState } from "react";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Save,
  Filter,
  Layers,
  Building,
  Box,
  Search,
  X,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

interface BIMPanelProps {
  onBackToProjects: () => void;
  onSave2DView?: (viewName: string) => void;
  onSave3DView?: (viewName: string) => void;
  onSaveCurrentView?: (viewName: string) => void;
  onFilterObjects?: (filters: FilterOptions) => void;
  onToggleSensors?: (visible: boolean) => void;
  sensorsVisible?: boolean;
  viewer?: any; // Forge viewer instance
}

interface FilterOptions {
  name?: string;
  category?: string;
  type?: string;
}

interface SavedView {
  id: string;
  name: string;
  type: '2d' | '3d';
  timestamp: string;
}

export function BIMPanel({
  onBackToProjects,
  onSave2DView,
  onSave3DView,
  onSaveCurrentView,
  onFilterObjects,
  onToggleSensors,
  sensorsVisible = false,
  viewer,
}: BIMPanelProps) {
  const [activeCommand, setActiveCommand] = useState<string | null>(null);
  const [filterName, setFilterName] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterType, setFilterType] = useState("");
  const [viewName, setViewName] = useState("");
  const [savedViews, setSavedViews] = useState<SavedView[]>([
    { id: "1", name: "Main Entrance", type: "3d", timestamp: "2024-01-15 10:30" },
    { id: "2", name: "Ground Floor Plan", type: "2d", timestamp: "2024-01-15 09:15" },
    { id: "3", name: "Structural Overview", type: "3d", timestamp: "2024-01-14 16:45" },
  ]);
  const [floors] = useState([
    { id: "ground", name: "Ground Floor", level: 0 },
    { id: "first", name: "First Floor", level: 1 },
    { id: "second", name: "Second Floor", level: 2 },
    { id: "basement", name: "Basement", level: -1 },
  ]);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const handleSaveView = () => {
    if (!viewName.trim()) return;
    
    const newView: SavedView = {
      id: Date.now().toString(),
      name: viewName,
      type: "3d",
      timestamp: new Date().toLocaleString(),
    };
    
    setSavedViews(prev => [newView, ...prev]);
    onSaveCurrentView?.(viewName);
    setViewName("");
    setSaveMessage("View saved successfully!");
    setTimeout(() => setSaveMessage(null), 3000);
  };

  const handleApplyFilters = () => {
    const filters: FilterOptions = {};
    if (filterName) filters.name = filterName;
    if (filterCategory) filters.category = filterCategory;
    if (filterType) filters.type = filterType;
    
    onFilterObjects?.(filters);
  };

  const handleClearFilters = () => {
    setFilterName("");
    setFilterCategory("");
    setFilterType("");
    onFilterObjects?.({});
  };

  const renderCommandContent = () => {
    switch (activeCommand) {
      case "2d-views":
        return (
          <div className="p-4">
            <h3 className="text-white font-medium mb-4">Building Floors</h3>
            <div className="space-y-2">
              {floors.map((floor) => (
                <button
                  key={floor.id}
                  className="w-full flex items-center justify-between p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                  onClick={() => {
                    // TODO: Implement floor view switching
                    console.log(`Switching to ${floor.name}`);
                  }}
                >
                  <div className="flex items-center gap-3">
                    <Building className="w-5 h-5 text-blue-400" />
                    <span className="text-white">{floor.name}</span>
                  </div>
                  <span className="text-gray-400 text-sm">Level {floor.level}</span>
                </button>
              ))}
            </div>
          </div>
        );

      case "3d-views":
        return (
          <div className="p-4">
            <h3 className="text-white font-medium mb-4">Saved 3D Views</h3>
            <div className="space-y-2">
              {savedViews.filter(view => view.type === "3d").map((view) => (
                <button
                  key={view.id}
                  className="w-full flex items-center justify-between p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                  onClick={() => {
                    // TODO: Implement view restoration
                    console.log(`Loading view: ${view.name}`);
                  }}
                >
                  <div className="flex items-center gap-3">
                    <Box className="w-5 h-5 text-green-400" />
                    <div className="text-left">
                      <div className="text-white">{view.name}</div>
                      <div className="text-gray-400 text-xs">{view.timestamp}</div>
                    </div>
                  </div>
                  <Eye className="w-4 h-4 text-gray-400" />
                </button>
              ))}
            </div>
          </div>
        );

      case "save-view":
        return (
          <div className="p-4">
            <h3 className="text-white font-medium mb-4">Save Current View</h3>
            {saveMessage && (
              <div className="mb-4 p-3 bg-green-600/20 border border-green-500/30 rounded-lg flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <span className="text-green-400 text-sm">{saveMessage}</span>
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-gray-300 text-sm mb-2">View Name</label>
                <input
                  type="text"
                  value={viewName}
                  onChange={(e) => setViewName(e.target.value)}
                  placeholder="Enter view name..."
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={handleSaveView}
                disabled={!viewName.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-4 py-2 rounded-lg text-white transition-colors"
              >
                Save View
              </button>
            </div>
          </div>
        );

      case "filter-objects":
        return (
          <div className="p-4">
            <h3 className="text-white font-medium mb-4">Filter BIM Objects</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-gray-300 text-sm mb-2">Object Name</label>
                <input
                  type="text"
                  value={filterName}
                  onChange={(e) => setFilterName(e.target.value)}
                  placeholder="Search by name..."
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-gray-300 text-sm mb-2">Category</label>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Categories</option>
                  <option value="walls">Walls</option>
                  <option value="doors">Doors</option>
                  <option value="windows">Windows</option>
                  <option value="floors">Floors</option>
                  <option value="roofs">Roofs</option>
                  <option value="structural">Structural</option>
                  <option value="mechanical">Mechanical</option>
                  <option value="electrical">Electrical</option>
                </select>
              </div>
              <div>
                <label className="block text-gray-300 text-sm mb-2">Type</label>
                <input
                  type="text"
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  placeholder="Filter by type..."
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleApplyFilters}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-white transition-colors"
                >
                  Apply Filters
                </button>
                <button
                  onClick={handleClearFilters}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded-lg text-white transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        );

      case "view-sensors":
        return (
          <div className="p-4">
            <h3 className="text-white font-medium mb-4">Sensor Visibility</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span className="text-white">IoT Sensors</span>
                </div>
                <button
                  onClick={() => onToggleSensors?.(!sensorsVisible)}
                  className={`p-2 rounded-lg transition-colors ${
                    sensorsVisible
                      ? "bg-blue-600 text-white"
                      : "bg-gray-600 text-gray-400"
                  }`}
                >
                  {sensorsVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              </div>
              <div className="p-3 bg-gray-700/50 rounded-lg">
                <p className="text-gray-300 text-sm">
                  {sensorsVisible 
                    ? "Sensors are currently visible on the model. Click the eye icon to hide them."
                    : "Sensors are currently hidden. Click the eye icon to show them on the model."
                  }
                </p>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="p-8 text-center text-gray-400">
            <Layers className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Select a command to get started</p>
            <p className="text-sm mt-1">Choose from the options above</p>
          </div>
        );
    }
  };

  return (
    <div className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold">BIM Commands</h2>
          <button
            onClick={onBackToProjects}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300 hover:text-white transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Projects
          </button>
        </div>

        {/* Command Buttons */}
        <div className="space-y-2">
          <button
            onClick={() => setActiveCommand(activeCommand === "2d-views" ? null : "2d-views")}
            className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
              activeCommand === "2d-views"
                ? "bg-blue-600 text-white"
                : "bg-gray-700 hover:bg-gray-600 text-gray-300"
            }`}
          >
            <Building className="w-5 h-5" />
            <span>2D Views</span>
          </button>

          <button
            onClick={() => setActiveCommand(activeCommand === "3d-views" ? null : "3d-views")}
            className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
              activeCommand === "3d-views"
                ? "bg-blue-600 text-white"
                : "bg-gray-700 hover:bg-gray-600 text-gray-300"
            }`}
          >
            <Box className="w-5 h-5" />
            <span>3D Views</span>
          </button>

          <button
            onClick={() => setActiveCommand(activeCommand === "save-view" ? null : "save-view")}
            className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
              activeCommand === "save-view"
                ? "bg-blue-600 text-white"
                : "bg-gray-700 hover:bg-gray-600 text-gray-300"
            }`}
          >
            <Save className="w-5 h-5" />
            <span>Save View</span>
          </button>

          <button
            onClick={() => setActiveCommand(activeCommand === "filter-objects" ? null : "filter-objects")}
            className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
              activeCommand === "filter-objects"
                ? "bg-blue-600 text-white"
                : "bg-gray-700 hover:bg-gray-600 text-gray-300"
            }`}
          >
            <Filter className="w-5 h-5" />
            <span>Filter Objects</span>
          </button>

          <button
            onClick={() => setActiveCommand(activeCommand === "view-sensors" ? null : "view-sensors")}
            className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
              activeCommand === "view-sensors"
                ? "bg-blue-600 text-white"
                : "bg-gray-700 hover:bg-gray-600 text-gray-300"
            }`}
          >
            {sensorsVisible ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
            <span>View Sensors</span>
          </button>
        </div>
      </div>

      {/* Command Content */}
      <div className="flex-1 overflow-y-auto">
        {renderCommandContent()}
      </div>
    </div>
  );
}
