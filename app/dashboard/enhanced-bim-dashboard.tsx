"use client";

import { useState, useEffect } from "react";
import { DashboardHeader } from "./components/dashboard-header";
import { ThreeDViewer } from "./components/3d-viewer";
import { EnhancedProjectPanel } from "./components/enhanced-project-panel";
import IoTPanel from "../components/iot-panel"; // Import the new IoTPanel
import ModelHierarchyPanel from "../components/model-hierarchy-panel"; // Import the new HierarchyPanel
import { BIMPanel } from "../components/bim-panel"; // Import the new BIMPanel
import { SensorProvider, useSensorContext } from "../context/sensor-context";
import { SensorInsertionForm, SensorFormData } from "../components/sensor-insertion-form";
import { GoogleEarthMap } from "./components/google-earth-map";
import { useAuth } from "@/app/hooks/use-auth";
import { useRef } from "react";
import React from "react";
import { useSession } from "next-auth/react";
import { CreateProjectModal } from "./components/create-project-modal";
import { ProjectInfoModal } from "./components/project-info-modal";

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

function BIMDashboard() {
  const [selectedFile, setSelectedFile] = useState<ProjectFile | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [viewMode, setViewMode] = useState<"map" | "viewer">("map");
  const [projects, setProjects] = useState<Project[]>([]);
  const { logout } = useAuth();
  const { data: session } = useSession();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showProjectInfo, setShowProjectInfo] = useState(false);
  const [viewer, setViewer] = useState<any>(null);
  const [iotExt, setIotExt] = useState<any>(null);
  const [activePanel, setActivePanel] = useState<
    "bim" | "iot" | "database" | "ai" | null
  >(null); // Initially no panel is active
  const [insertMode, setInsertMode] = useState<null | string>(null); // sensor type or null
  const [mockSensors, setMockSensors] = useState<any[]>([]); // for demo placement
  const [wireframeMode, setWireframeMode] = useState<boolean>(true); // Default to wireframe for IoT panel
  const [rightSidebarView, setRightSidebarView] = useState<'details' | 'hierarchy'>('details');
  const [showProjectPanel, setShowProjectPanel] = useState(true); // Show project panel initially
  const [sensorsVisible, setSensorsVisible] = useState(false); // Track sensor visibility

  // Use sensor context
  const {
    sensors,
    selectedSensor,
    isPlacementMode,
    placementSensorType,
    visibleSensorTypes,
    selectSensor,
    placeSensor,
    setCurrentProject,
    // Form-related state and functions
    showInsertionForm,
    pendingPosition,
    hideSensorForm,
    placeSensorWithDetails,
    loading: sensorLoading,
  } = useSensorContext();

  // Auto-switch to wireframe when IoT panel is active
  useEffect(() => {
    if (activePanel === "iot") {
      setWireframeMode(true); // Default to wireframe for better sensor visibility
    }
  }, [activePanel]);

  // Fetch projects from MongoDB on mount
  useEffect(() => {
    async function fetchProjects() {
      const res = await fetch("/api/projects");
      const data = await res.json();
      console.log("Fetched projects from MongoDB:", data);
      const mapped = (data.projects || []).map((p: any) => ({
        id: p._id || p.id,
        name: p.name,
        lat: p.location?.lat,
        lng: p.location?.lng,
        urn: p.urn,
        description: p.description || "",
        fileType: p.fileType,
        code: p.code,
        country: p.country,
        municipality: p.municipality,
        address: p.address,
        cadastral: p.cadastral,
        company: p.company,
        surname: p.surname,
        clientName: p.clientName,
      }));
      setProjects(mapped);
    }
    fetchProjects();
  }, []);

  const GOOGLE_MAPS_API_KEY =
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "YOUR_GOOGLE_MAPS_API_KEY";

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
      setViewMode("viewer");
      const project = projects.find(
        (p) => p.id === file.id || p.name === file.name.replace(".rvt", ""),
      );
      if (project) {
        setSelectedProject(project);
        setCurrentProject(project.id); // Set project in sensor context
      }
    }
    console.log("Selected file:", file);
  };

  const handleProcessingComplete = (urn: string, file: ProjectFile) => {
    console.log("Processing completed for file:", file.name, "URN:", urn);
    setSelectedFile((prev) => (prev ? { ...prev, urn } : null));
    setProjects((prev) =>
      prev.map((p) => (p.id === file.id ? { ...p, urn } : p)),
    );
  };

  const handleProjectSelect = (project: Project) => {
    setSelectedProject(project);
    setCurrentProject(project.id); // Set project in sensor context
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
      description: project.description,
    };
    setSelectedFile(file);
    setViewMode("viewer");
    console.log("Selected project:", project);
  };

  const handleProjectCreated = (newProject: Project) => {
    setProjects((prev) => [...prev, newProject]);
  };

  const handleRequestCreateProject = () => {
    setShowCreateModal(true);
  };

  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
  };

  // Handler for IoTPanel to trigger sensor placement
  const handleInsertSensor = (sensorType: string | null) => {
    setInsertMode(sensorType); // sensorType is null when not in insert mode
  };

  // Handler to exit insert mode after sensor placement
  const handleExitInsertMode = () => setInsertMode(null);

  // Called when ForgeViewer is ready
  const handleViewerReady = (viewerInstance: any, iotExtension: any) => {
    setViewer(viewerInstance);
    setIotExt(iotExtension);
  };

  // DataViz sensor handlers
  const handleSensorClick = (sensorId: string) => {
    console.log("Sensor clicked:", sensorId);
    // Find and select the sensor
    const sensor = sensors.find(s => s.id === sensorId);
    if (sensor) {
      selectSensor(sensor);
    }
  };

  const handleSensorPlaced = (sensorData: any) => {
    // Add the sensor to the context
    placeSensor(sensorData.position, sensorData.room);
  };

  // Handler for wireframe mode toggle
  const handleWireframeModeChange = (wireframe: boolean) => {
    console.log(`[Dashboard] Wireframe mode change requested: ${wireframe}`);
    console.log(`[Dashboard] Current wireframe state: ${wireframeMode}`);
    setWireframeMode(wireframe);
    console.log(`[Dashboard] Wireframe mode updated to: ${wireframe}`);
  };

  // Handler for sensor form submission
  const handleSensorFormSubmit = async (formData: SensorFormData) => {
    console.log("[Dashboard] Sensor form submitted:", formData);
    const newSensor = await placeSensorWithDetails(formData);
    if (newSensor) {
      console.log("[Dashboard] Sensor placed successfully:", newSensor.name);
      // Exit insert mode after successful placement
      setInsertMode(null);
    }
  };

  // Handler for sensor form cancellation
  const handleSensorFormCancel = () => {
    console.log("[Dashboard] Sensor form cancelled");
    hideSensorForm();
    setInsertMode(null);
  };

  // Handler for showing project information
  const handleShowProjectInfo = () => {
    console.log("[Dashboard] Show project info requested");
    setShowProjectInfo(true);
  };

  // Handler for BIM panel commands
  const handleBackToProjects = () => {
    setActivePanel(null);
    setShowProjectPanel(true);
  };

  const handleToggleSensors = (visible: boolean) => {
    setSensorsVisible(visible);
    // TODO: Implement actual sensor visibility toggle in viewer
  };

  const handleSaveCurrentView = (viewName: string) => {
    // TODO: Implement view saving functionality
    console.log(`Saving view: ${viewName}`);
  };

  const handleFilterObjects = (filters: any) => {
    // TODO: Implement object filtering in viewer
    console.log('Applying filters:', filters);
  };

  // Handler for closing project information modal
  const handleReturnToMapView = () => {
    setSelectedProject(null);
    setSelectedFile(null);
    setViewMode("map");
  };

  const handleCloseProjectInfo = () => {
    setShowProjectInfo(false);
  };

  // Handler for saving project information (if editing is enabled)
  const handleSaveProjectInfo = (updatedProject: Project) => {
    console.log("[Dashboard] Project info save requested:", updatedProject);
    // Update the selected project and projects list
    setSelectedProject(updatedProject);
    setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
    setShowProjectInfo(false);
  };

  // Handler for project updated from API
  const handleProjectUpdated = (updatedProject: Project) => {
    console.log("[Dashboard] Project updated from API:", updatedProject);
    // Update the selected project and projects list
    setSelectedProject(updatedProject);
    setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
    // Trigger any additional updates needed (e.g., refresh sensor context if needed)
  };

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Header */}
      <DashboardHeader
        onSignOut={handleSignOut}
        user={session?.user}
        activePanel={activePanel}
        onPanelChange={setActivePanel}
        onCreateProject={handleRequestCreateProject}
        selectedProject={selectedProject}
        onShowProjectInfo={handleShowProjectInfo}
      />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {projects.length === 0 ? (
          // Empty state panel
          <div className="flex flex-1 items-center justify-center bg-gray-900">
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-12 flex flex-col items-center shadow-2xl">
              <svg
                className="w-16 h-16 text-blue-500 mb-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 48 48"
              >
                <rect
                  x="8"
                  y="8"
                  width="32"
                  height="32"
                  rx="8"
                  strokeWidth="4"
                />
                <path
                  d="M24 16v16M16 24h16"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
              </svg>
              <h2 className="text-2xl font-bold text-white mb-2">
                No Projects Yet
              </h2>
              <p className="text-gray-400 mb-6 text-center max-w-xs">
                Get started by creating your first BIM project. Upload your RVT
                file, set a location, and view your model in 3D!
              </p>
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
              {/* <div className="absolute top-6 left-6 z-10 flex bg-black/70 backdrop-blur-sm rounded-lg p-1">
                <button
                  onClick={() => setViewMode("map")}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === "map" ? "bg-blue-500 text-white shadow-lg" : "text-gray-300 hover:text-white hover:bg-gray-700"}`}
                >
                  🌍 Earth View
                </button>
                <button
                  onClick={() => setViewMode("viewer")}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === "viewer" ? "bg-blue-500 text-white shadow-lg" : "text-gray-300 hover:text-white hover:bg-gray-700"}`}
                >
                  🏗️ 3D Model
                </button>
              </div> */}

              <div className="w-full h-full">
                {viewMode === "map" ? (
                  <GoogleEarthMap
                    projects={projects}
                    selectedProject={selectedProject}
                    onProjectSelect={handleProjectSelect}
                    apiKey={GOOGLE_MAPS_API_KEY}
                  />
                ) : (
                  <div className="relative w-full h-full">
                    <ThreeDViewer
                      selectedFile={selectedFile}
                      onViewerReady={handleViewerReady}
                      insertMode={insertMode}
                      onExitInsertMode={handleExitInsertMode}
                      onSensorClick={handleSensorClick}
                      activePanel={activePanel}
                      wireframeMode={wireframeMode}
                      onWireframeModeChange={handleWireframeModeChange}
                    />
                  </div>
                )}
              </div>

              {selectedProject && viewMode === "map" && (
                <div className="absolute bottom-6 left-6 bg-black/80 backdrop-blur-sm rounded-lg p-4 text-white max-w-sm">
                  <h3 className="font-semibold text-lg mb-2">
                    {selectedProject.name}
                  </h3>
                  <p className="text-gray-300 text-sm mb-3">
                    {selectedProject.description}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setViewMode("viewer")}
                      className="bg-blue-500 hover:bg-blue-600 px-3 py-1 rounded text-sm transition-colors"
                    >
                      {selectedProject.urn
                        ? "View 3D Model"
                        : "Process & View 3D Model"}
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

            {/* Right Panel - Conditional Rendering */}
            {activePanel === "bim" ? (
              <BIMPanel
                onBackToProjects={handleBackToProjects}
                onSaveCurrentView={handleSaveCurrentView}
                onFilterObjects={handleFilterObjects}
                onToggleSensors={handleToggleSensors}
                sensorsVisible={sensorsVisible}
                viewer={viewer}
              />
            ) : activePanel === "iot" ? (
              <IoTPanel 
                onInsertSensor={handleInsertSensor} 
                insertMode={insertMode}
                onSensorClick={handleSensorClick}
                wireframeMode={wireframeMode}
                onWireframeModeChange={handleWireframeModeChange}
              />
            ) : activePanel === "database" || activePanel === "ai" ? (
              // Placeholder for other panels like Database or AI
              <div className="w-80 bg-gray-800 border-l border-gray-700 flex items-center justify-center">
                <p className="text-gray-400">
                  Panel for {activePanel.toUpperCase()}
                </p>
              </div>
            ) : (
              // Show project panel when no active panel
              showProjectPanel && (
                rightSidebarView === 'details' ? (
                  <EnhancedProjectPanel
                    onShowHierarchy={() => setRightSidebarView('hierarchy')}
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
                    onReturnToMapView={handleReturnToMapView}
                  />
                ) : (
                  <ModelHierarchyPanel 
                    viewer={viewer} 
                    onClose={() => {
                      setRightSidebarView('details');
                      // Ensure the same project and file remain selected and model is fit to project root
                      if (viewer && viewer.model && viewer.fitToView) {
                        const tree = viewer.model.getData().instanceTree;
                        if (tree && tree.getRootId) {
                          const rootId = tree.getRootId();
                          viewer.fitToView([rootId], viewer.model);
                        }
                      }
                      // Optionally, you can re-select the project/file here if needed
                      // setSelectedProject(selectedProject); // already selected
                      // setSelectedFile(selectedFile); // already selected
                    }}
                  />
                )
              )
            )}
          </>
        )}
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
        
        {/* Project Information Modal */}
        <ProjectInfoModal
          project={selectedProject}
          isOpen={showProjectInfo}
          onClose={handleCloseProjectInfo}
          onSave={handleSaveProjectInfo}
          onProjectUpdated={handleProjectUpdated}
          isEditable={true} // Enable editing for allowed fields
        />
        
        {/* Sensor Insertion Form Modal */}
        <SensorInsertionForm
          isOpen={showInsertionForm}
          sensorType={placementSensorType || ""}
          position={pendingPosition}
          onSubmit={handleSensorFormSubmit}
          onCancel={handleSensorFormCancel}
          loading={sensorLoading}
        />
      </div>
    </div>
  );
}

export default function BIMDashboardWrapper() {
  return (
    <SensorProvider>
      <BIMDashboard />
    </SensorProvider>
  );
}
