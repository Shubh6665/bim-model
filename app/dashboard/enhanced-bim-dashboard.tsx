"use client";

import { useState, useEffect } from "react";
import { DashboardHeader } from "./components/dashboard-header";
import { ThreeDViewer } from "./components/3d-viewer";
import { EnhancedProjectPanel } from "./components/enhanced-project-panel";
import { GoogleEarthMap } from "./components/google-earth-map";
import { useAuth } from "@/app/hooks/use-auth";

interface ProjectFile {
  id: string;
  name: string;
  type: string;
  size: string;
  modified: string;
  isRVT?: boolean;
  lat?: number;
  lng?: number;
  urn?: string;
  description?: string;
}

interface Project {
  id: string;
  name: string;
  lat: number;
  lng: number;
  urn?: string;
  description?: string;
}

export default function BIMDashboard() {
  const [selectedFile, setSelectedFile] = useState<ProjectFile | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [viewMode, setViewMode] = useState<'map' | 'viewer'>('map');
  const { logout } = useAuth();

  // Sample project data with geolocation
  const [projects] = useState<Project[]>([
    {
      id: "1",
      name: "SAM0001-ADD-SA1067001-ZZ-M3-S-S00001",
      lat: 28.6139,
      lng: 77.2090,
      urn: "urn:adsk.viewing:fs.file:dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6YnVja2V0L2tleQ",
      description: "Main building structural model"
    },
    {
      id: "2", 
      name: "Building Floor Plan Project",
      lat: 28.7041,
      lng: 77.1025,
      description: "Commercial building floor plans"
    },
    {
      id: "3",
      name: "Structural Model Complex",
      lat: 28.5355,
      lng: 77.3910,
      description: "Multi-story structural framework"
    },
    {
      id: "4",
      name: "Residential Tower",
      lat: 28.4595,
      lng: 77.0266,
      description: "High-rise residential project"
    }
  ]);

  // Google Maps API Key - Replace with your actual API key
  const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || 
    "YOUR_GOOGLE_MAPS_API_KEY"; // You'll need to set this in environment variables

  const handleSignOut = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const handleFileSelect = (file: ProjectFile | null) => {
    setSelectedFile(file);
    if (file) {
      setViewMode('viewer');
      // Find corresponding project if it exists
      const project = projects.find(p => p.name.includes(file.name.replace('.rvt', '')));
      if (project) {
        setSelectedProject(project);
      }
    }
    console.log("Selected file:", file);
  };

  const handleProjectSelect = (project: Project) => {
    setSelectedProject(project);
    
    // If project has URN, create a file object and switch to viewer
    if (project.urn) {
      const file: ProjectFile = {
        id: project.id,
        name: project.name + ".rvt",
        type: "RVT", 
        size: "8.8 MB",
        modified: "2 hours ago",
        isRVT: true,
        lat: project.lat,
        lng: project.lng,
        urn: project.urn,
        description: project.description
      };
      setSelectedFile(file);
      setViewMode('viewer');
    }
    
    console.log("Selected project:", project);
  };

  const toggleViewMode = () => {
    setViewMode(prev => prev === 'map' ? 'viewer' : 'map');
  };

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Header */}
      <DashboardHeader onSignOut={handleSignOut} />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side - Map or 3D Viewer */}
        <div className="flex-1 p-4 relative">
          {/* View Toggle Buttons */}
          <div className="absolute top-6 left-6 z-10 flex bg-black/70 backdrop-blur-sm rounded-lg p-1">
            <button
              onClick={() => setViewMode('map')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                viewMode === 'map'
                  ? 'bg-blue-500 text-white shadow-lg'
                  : 'text-gray-300 hover:text-white hover:bg-gray-700'
              }`}
            >
              🌍 Earth View
            </button>
            <button
              onClick={() => setViewMode('viewer')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                viewMode === 'viewer'
                  ? 'bg-blue-500 text-white shadow-lg'
                  : 'text-gray-300 hover:text-white hover:bg-gray-700'
              }`}
            >
              🏗️ 3D Model
            </button>
          </div>

          {/* Content Area */}
          <div className="w-full h-full">
            {viewMode === 'map' ? (
              <GoogleEarthMap
                projects={projects}
                selectedProject={selectedProject}
                onProjectSelect={handleProjectSelect}
                apiKey={GOOGLE_MAPS_API_KEY}
              />
            ) : (
              <ThreeDViewer selectedFile={selectedFile} />
            )}
          </div>

          {/* Project Info Overlay */}
          {selectedProject && viewMode === 'map' && (
            <div className="absolute bottom-6 left-6 bg-black/80 backdrop-blur-sm rounded-lg p-4 text-white max-w-sm">
              <h3 className="font-semibold text-lg mb-2">{selectedProject.name}</h3>
              <p className="text-gray-300 text-sm mb-3">{selectedProject.description}</p>
              <div className="flex gap-2">
                {selectedProject.urn && (
                  <button
                    onClick={() => setViewMode('viewer')}
                    className="bg-blue-500 hover:bg-blue-600 px-3 py-1 rounded text-sm transition-colors"
                  >
                    View 3D Model
                  </button>
                )}
                <button
                  onClick={() => setSelectedProject(null)}
                  className="bg-gray-600 hover:bg-gray-700 px-3 py-1 rounded text-sm transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel - Project Files */}
        <EnhancedProjectPanel
          onFileSelect={handleFileSelect}
          onProjectSelect={handleProjectSelect}
          selectedFile={selectedFile}
          selectedProject={selectedProject}
          projects={projects}
          onViewModeChange={setViewMode}
          currentViewMode={viewMode}
        />
      </div>
    </div>
  );
}
