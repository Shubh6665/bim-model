"use client";

import { useState, useEffect } from "react";
import { DashboardHeader } from "./components/dashboard-header";
import { ThreeDViewer } from "./components/3d-viewer";
import { EnhancedProjectPanel } from "./components/enhanced-project-panel";
import { GoogleEarthMap } from "./components/google-earth-map";
import { useAuth } from "@/app/hooks/use-auth";
import { useRef } from "react";
import React from "react";
import { useSession } from "next-auth/react";
import { CreateProjectModal } from "./components/create-project-modal";

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
  fileType?: string;
}

export default function BIMDashboard() {
  const [selectedFile, setSelectedFile] = useState<ProjectFile | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [viewMode, setViewMode] = useState<'map' | 'viewer'>('map');
  const [projects, setProjects] = useState<Project[]>([]);
  const { logout } = useAuth();
  const { data: session } = useSession();
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Fetch projects from MongoDB on mount
  useEffect(() => {
    async function fetchProjects() {
      const res = await fetch("/api/projects");
      const data = await res.json();
      console.log('Fetched projects from MongoDB:', data);
      // Map MongoDB _id to id for frontend
      const mapped = (data.projects || []).map((p: any) => ({
        id: p._id || p.id,
        name: p.name,
        lat: p.location?.lat,
        lng: p.location?.lng,
        urn: p.urn,
        description: p.description || "",
        fileType: p.fileType,
      }));
      setProjects(mapped);
    }
    fetchProjects();
  }, []);

  // Google Maps API Key
  const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "YOUR_GOOGLE_MAPS_API_KEY";

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
      const project = projects.find(p => p.id === file.id || p.name === file.name.replace('.rvt', ''));
      if (project) {
        setSelectedProject(project);
      }
    }
    console.log("Selected file:", file);
  };

  const handleProcessingComplete = (urn: string, file: ProjectFile) => {
    console.log("Processing completed for file:", file.name, "URN:", urn);
    setSelectedFile(prev => prev ? { ...prev, urn } : null);
    // Update project in state with new URN
    setProjects(prev => prev.map(p => p.id === file.id ? { ...p, urn } : p));
  };

  const handleProjectSelect = (project: Project) => {
    setSelectedProject(project);
    // If project has URN, create file object with URN for instant viewing
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
    console.log("Selected project:", project);
  };

  // Handler to add new project after creation
  const handleProjectCreated = (newProject: Project) => {
    // Option 1: Fetch the updated project list from the backend
    // (Uncomment if you want to always fetch the latest)
    // fetchProjects();

    // Option 2: Add the new project to the state immediately
    setProjects(prev => [...prev, newProject]);
  };

  // Handler to open create project modal from empty state or panel
  const handleRequestCreateProject = () => {
    setShowCreateModal(true);
  };
  // Handler to close create project modal
  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Header */}
      <DashboardHeader onSignOut={handleSignOut} user={session?.user} />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {projects.length === 0 ? (
          // Empty state panel
          <div className="flex flex-1 items-center justify-center bg-gray-900">
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-12 flex flex-col items-center shadow-2xl">
              <svg className="w-16 h-16 text-blue-500 mb-6" fill="none" stroke="currentColor" viewBox="0 0 48 48">
                <rect x="8" y="8" width="32" height="32" rx="8" strokeWidth="4" />
                <path d="M24 16v16M16 24h16" strokeWidth="4" strokeLinecap="round" />
              </svg>
              <h2 className="text-2xl font-bold text-white mb-2">No Projects Yet</h2>
              <p className="text-gray-400 mb-6 text-center max-w-xs">Get started by creating your first BIM project. Upload your RVT file, set a location, and view your model in 3D!</p>
              <button
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg text-lg font-semibold shadow-lg transition-colors"
                onClick={handleRequestCreateProject}
              >
                + Create Project
              </button>
            </div>
          </div>
        ) : (
          <>
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
                    <button
                      onClick={() => setViewMode('viewer')}
                      className="bg-blue-500 hover:bg-blue-600 px-3 py-1 rounded text-sm transition-colors"
                    >
                      {selectedProject.urn ? "View 3D Model" : "Process & View 3D Model"}
                    </button>
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
              onProcessingComplete={handleProcessingComplete}
              apiKey={GOOGLE_MAPS_API_KEY}
              onRequestCreateProject={handleRequestCreateProject}
            />
          </>
        )}
        {/* Global Create Project Modal */}
        {showCreateModal && (
          <CreateProjectModal
            show={showCreateModal}
            onClose={handleCloseCreateModal}
            onProjectCreated={(project) => {
              handleProjectCreated(project);
              setShowCreateModal(false);
            }}
            apiKey={GOOGLE_MAPS_API_KEY}
          />
        )}
      </div>
    </div>
  );
}
