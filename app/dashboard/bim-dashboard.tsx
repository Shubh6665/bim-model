"use client";

import { useState } from "react";
import { DashboardHeader } from "./components/dashboard-header";
import { ThreeDViewer } from "./components/3d-viewer";
import { ProjectPanel } from "./components/project-panel";
import { useAuth } from "@/app/hooks/use-auth";

interface ProjectFile {
  id: string;
  name: string;
  type: string;
  size: string;
  modified: string;
  isRVT?: boolean;
}

export default function BIMDashboard() {
  const [selectedFile, setSelectedFile] = useState<ProjectFile | null>(null);
  const { logout } = useAuth();
  const [activePanel, setActivePanel] = useState<'bim' | 'iot' | 'database' | 'ai' | 'fm'>('bim');

  const handleSignOut = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const handleCreateProject = () => {
    // TODO: hook up to actual create project flow/modal
    console.log('Create Project clicked');
  };

  const handleFileSelect = (file: ProjectFile | null) => {
    setSelectedFile(file);
    console.log("Selected file:", file);
  };

  const handlePanelChange = (panel: 'bim' | 'iot' | 'database' | 'ai' | 'fm') => {
    setActivePanel(panel);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Header */}
      <DashboardHeader 
        onSignOut={handleSignOut} 
        activePanel={activePanel} 
        onPanelChange={handlePanelChange}
        onCreateProject={handleCreateProject}
      />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* 3D Viewer - Left Side */}
        <div className="flex-1 p-4">
          <ThreeDViewer selectedFile={selectedFile} />
        </div>

        {/* Right Panel - Project Files */}
        <ProjectPanel
          onFileSelect={handleFileSelect}
          selectedFile={selectedFile}
        />
      </div>
    </div>
  );
}
