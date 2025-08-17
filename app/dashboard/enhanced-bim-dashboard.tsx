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
import type { ProjectModel } from "@/app/types/projects";
import { ProjectAdminModal } from "./components/project-admin-modal";

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
  code?: string;
  country?: string;
  municipality?: string;
  address?: string;
  cadastral?: string;
  company?: string;
  surname?: string;
  clientName?: string;
  models?: ProjectModel[];
  access?: { role?: string; packages?: string[]; owner?: boolean };
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
    "bim" | "iot" | "database" | "ai" | "fm" | null
  >(null); // Added 'fm'
  const [insertMode, setInsertMode] = useState<null | string>(null); // sensor type or null
  const [mockSensors, setMockSensors] = useState<any[]>([]); // for demo placement
  const [wireframeMode, setWireframeMode] = useState<boolean>(true); // Default to wireframe for IoT panel
  const [rightSidebarView, setRightSidebarView] = useState<'details' | 'hierarchy'>('details');
  const [showProjectPanel, setShowProjectPanel] = useState(true); // Show project panel initially
  const [sensorsVisible, setSensorsVisible] = useState(false); // Track sensor visibility
  const [showOnlySelectedOnMap, setShowOnlySelectedOnMap] = useState<boolean>(false); // Filter map to selected project after back
  const [noAccessMsg, setNoAccessMsg] = useState<string | null>(null);
  // When a sensor is clicked in the 3D viewer, we store its ID here to filter IoT panel
  const [viewerSelectedSensorId, setViewerSelectedSensorId] = useState<string | null>(null);
  // Federated overlay: track which models are enabled for overlay
  const [enabledModelIds, setEnabledModelIds] = useState<Set<string>>(new Set());
  const lastProcessedProjectId = useRef<string | null>(null);

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
      console.log('[Dashboard] IoT panel activated - setting wireframe mode to true');
      setWireframeMode(true); // Default to wireframe for better sensor visibility
      
      // Ensure the viewer receives the wireframe mode change with multiple triggers
      setTimeout(() => {
        console.log('[Dashboard] Triggering wireframe mode for IoT panel (first trigger)');
        setWireframeMode(true); // Force trigger wireframe mode again
      }, 300); // Delay to ensure panel and viewer are ready
      
      // Additional trigger to ensure wireframe mode is applied
      setTimeout(() => {
        console.log('[Dashboard] Triggering wireframe mode for IoT panel (second trigger)');
        setWireframeMode(false); // Toggle to force re-application
        setTimeout(() => {
          setWireframeMode(true); // Set back to wireframe
          console.log('[Dashboard] Wireframe mode should now be properly applied');
        }, 100);
      }, 600); // Second trigger after more delay
    }
  }, [activePanel]);

  // Fetch projects from MongoDB on mount
  useEffect(() => {
    async function fetchProjects() {
      const res = await fetch("/api/projects");
      const data = await res.json();
      console.log("Fetched projects from MongoDB:", data);
      const mapped = (data.projects || []).map((p: any) => ({
        id: String(p._id || p.id),
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
        models: Array.isArray(p.models) ? p.models : [],
        access: p.access || undefined,
      }));
      setProjects(mapped);
    }
    fetchProjects();
  }, []);

  // When a project is selected, set a sensible default for enabled models (once)
  useEffect(() => {
    const projectId = selectedProject?.id;
    const models = selectedProject?.models || [];

    // Only run this logic if the project ID has changed
    if (projectId && projectId !== lastProcessedProjectId.current) {
      console.log(`[Dashboard] New project selected (${projectId}), setting default model visibility.`);
      lastProcessedProjectId.current = projectId;

      if (models.length === 0) {
        setEnabledModelIds(new Set());
        return;
      }

      // Prefer architecture models; if none, fallback to the first in order
      const archIds = models.filter(m => (m.discipline || '').toLowerCase() === 'architecture').map(m => m.id);
      if (archIds.length > 0) {
        setEnabledModelIds(new Set(archIds));
      } else {
        setEnabledModelIds(new Set([models[0].id]));
      }
    } else if (!projectId) {
      // If no project is selected, clear everything
      lastProcessedProjectId.current = null;
      setEnabledModelIds(new Set());
    }
  }, [selectedProject]); // Depend on the whole project object to detect changes

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
      setShowOnlySelectedOnMap(false);
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
    setShowOnlySelectedOnMap(false);
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

  // Toggle model enablement for overlay
  const handleToggleModel = (modelId: string) => {
    console.log('🎛️  [Dashboard] MODEL TOGGLE REQUESTED');
    console.log('   Model ID:', modelId);
    
    setEnabledModelIds((prev) => {
      const next = new Set(prev);
      const isCurrentlyEnabled = next.has(modelId);
      
      console.log('   Current state:', isCurrentlyEnabled ? 'ENABLED' : 'DISABLED');
      console.log('   Currently enabled models:', Array.from(prev));
      console.log('   Total enabled count:', prev.size);

      // If trying to disable the only enabled model, block the action
      if (isCurrentlyEnabled && next.size === 1) {
        console.warn('⚠️  [Models] BLOCKED: At least one model must remain enabled. Enable another model before disabling this one.');
        return prev; // no change
      }

      if (isCurrentlyEnabled) {
        console.log('   🔴 DISABLING model:', modelId);
        next.delete(modelId);
      } else {
        console.log('   🟢 ENABLING model:', modelId);
        
        // WORKAROUND: Auto-enable Architecture when enabling any other model
        // This prevents overlay loading errors that occur when Architecture is off
        const architectureModel = selectedProject?.models?.find(m => 
          m.discipline === 'architecture' || m.name?.toLowerCase().includes('architecture')
        );
        
        if (architectureModel && !next.has(architectureModel.id) && modelId !== architectureModel.id) {
          console.log('   🏗️  AUTO-ENABLING Architecture to support overlay:', architectureModel.id);
          next.add(architectureModel.id);
        }
        
        next.add(modelId);
      }
      
      console.log('   ✅ New enabled models:', Array.from(next));
      console.log('   📊 New total count:', next.size);
      
      return next;
    });
  };

  // Compute the list of models to render in the viewer, keep a deterministic order
  const orderedEnabledModels: ProjectModel[] | undefined = React.useMemo(() => {
    if (!selectedProject?.models) return undefined;
    const order: Record<string, number> = { architecture: 0, structure: 1, mep: 2, electrical: 3, plumbing: 4, hvac: 5, other: 6 } as any;
    const filtered = selectedProject.models.filter(m => enabledModelIds.has(m.id));
    return filtered.sort((a, b) => (order[a.discipline || 'other'] ?? 99) - (order[b.discipline || 'other'] ?? 99));
  }, [selectedProject?.models, enabledModelIds]);

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

  // Viewer-originated sensor click: select and set filter for IoT panel
  const handleViewerSensorClick = (sensorId: string) => {
    console.log("[Viewer] Sensor clicked:", sensorId);
    // Set filter immediately to ensure IoTPanel reacts even if sensors array hasn't refreshed yet
    setViewerSelectedSensorId(sensorId);
    const sensor = sensors.find(s => s.id === sensorId);
    if (sensor) {
      selectSensor(sensor);
    }
  };

  // Panel-originated sensor click: select only (no filtering)
  const handlePanelSensorClick = (sensorId: string) => {
    console.log("[Panel] Sensor clicked:", sensorId);
    const sensor = sensors.find(s => s.id === sensorId);
    if (sensor) {
      selectSensor(sensor);
      // Do NOT set viewerSelectedSensorId here, to avoid triggering filtering from panel clicks
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
    
    // Toggle sensor visibility in the viewer
    if (activePanel === 'iot') {
      // If we're in IoT panel, this affects the IoT sensors
      // The sensor visibility is handled by the IoT panel itself
      console.log(`Sensors visibility toggled: ${visible}`);
    } else {
      // In BIM panel, this could toggle any placed sensors
      console.log(`BIM sensor visibility toggled: ${visible}`);
    }
  };

  const handleSaveCurrentView = (viewName: string) => {
    console.log(`View '${viewName}' saved successfully`);
    // The actual saving is handled in the BIM panel component
  };

  const handleFilterObjects = (filters: any) => {
    console.log('Object filters applied:', filters);
    // The actual filtering is handled in the BIM panel component
  };

  // Handler for closing project information modal
  const handleReturnToMapView = () => {
    // Return to map showing only the current project
    setViewMode("map");
    setShowOnlySelectedOnMap(true);
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

  // Handler: show the default projects dashboard (map + right panel with tabs)
  const handleShowMyProjects = () => {
    setActivePanel(null);
    setSelectedProject(null);
    setSelectedFile(null);
    setViewMode("map");
    setRightSidebarView('details');
    setShowProjectPanel(true);
    setShowOnlySelectedOnMap(false);
  };

  // Map panel -> package name
  const panelToPackage: Record<NonNullable<typeof activePanel>, string> = {
    bim: 'BIM',
    iot: 'IoT',
    database: 'Database',
    ai: 'AI',
    fm: 'FM',
  } as const;

  const canAccessPanel = (panel: NonNullable<typeof activePanel>) => {
    // No project selected → allow navigation (will show project panel)
    if (!selectedProject) return true;
    // Owners have full access
    if (selectedProject?.access?.owner) return true;
    const pkg = panelToPackage[panel];
    const granted = selectedProject?.access?.packages || [];
    return granted.includes(pkg);
  };

  const handlePanelChange = (panel: typeof activePanel) => {
    if (!panel) { setActivePanel(null); return; }
    if (!canAccessPanel(panel)) {
      setNoAccessMsg(`You do not have access to the ${panel.toUpperCase()} section for this project.`);
      // Auto-clear message after a short delay
      setTimeout(() => setNoAccessMsg(null), 3000);
      return;
    }
    
    // WORKAROUND: Auto-enable Architecture when switching to IoT panel
    // This prevents crashes when IoT panel tries to access viewer without Architecture
    if (panel === 'iot' && selectedProject?.models) {
      const architectureModel = selectedProject.models.find(m => 
        m.discipline === 'architecture' || m.name?.toLowerCase().includes('architecture')
      );
      
      if (architectureModel && !enabledModelIds.has(architectureModel.id)) {
        console.log('🏗️  [IoT Panel] AUTO-ENABLING Architecture to prevent crashes:', architectureModel.id);
        setEnabledModelIds(prev => {
          const next = new Set(prev);
          next.add(architectureModel.id);
          return next;
        });
      }
    }
    
    setActivePanel(panel);
  };

  // Header expects non-null panels; wrap with a typed adapter
  const handleHeaderPanelChange = (panel: 'bim' | 'iot' | 'database' | 'ai' | 'fm') => {
    handlePanelChange(panel);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Header */}
      <DashboardHeader
        onSignOut={handleSignOut}
        user={session?.user}
        activePanel={activePanel}
        onPanelChange={handleHeaderPanelChange}
        onCreateProject={handleRequestCreateProject}
        selectedProject={selectedProject}
        onShowProjectInfo={handleShowProjectInfo}
        onShowMyProjects={handleShowMyProjects}
      />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {noAccessMsg && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-4 py-2 rounded shadow-lg border border-red-400">
            {noAccessMsg}
          </div>
        )}
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
                    projects={showOnlySelectedOnMap && selectedProject ? [selectedProject] : projects}
                    selectedProject={selectedProject}
                    onProjectSelect={handleProjectSelect}
                    apiKey={GOOGLE_MAPS_API_KEY}
                  />
                ) : (
                  <div className="relative w-full h-full">
                    <ThreeDViewer
                      selectedFile={selectedFile}
                      models={orderedEnabledModels}
                      enabledModelIds={enabledModelIds}
                      onViewerReady={handleViewerReady}
                      insertMode={insertMode}
                      onExitInsertMode={handleExitInsertMode}
                      onSensorClick={handleViewerSensorClick}
                      onEmptyClick={() => {}}
                      activePanel={activePanel}
                      wireframeMode={wireframeMode}
                      onWireframeModeChange={handleWireframeModeChange}
                      sensorsVisible={sensorsVisible}
                    />
                  </div>
                )}
              </div>


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
                models={selectedProject?.models}
                enabledModelIds={enabledModelIds}
                onToggleModel={handleToggleModel}
              />
            ) : activePanel === "iot" ? (
              <IoTPanel 
                onInsertSensor={handleInsertSensor} 
                insertMode={insertMode}
                onSensorClick={handlePanelSensorClick}
                wireframeMode={wireframeMode}
                onWireframeModeChange={handleWireframeModeChange}
                selectedSensorIdFromViewer={viewerSelectedSensorId}
              />
            ) : activePanel === "database" || activePanel === "ai" || activePanel === "fm" ? (
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
                    enabledModelIds={enabledModelIds}
                    onToggleModel={handleToggleModel}
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
        
        {/* Project Administration Modal (multi-tab) */}
        <ProjectAdminModal
          project={selectedProject}
          isOpen={showProjectInfo}
          onClose={handleCloseProjectInfo}
          onProjectUpdated={handleProjectUpdated}
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
