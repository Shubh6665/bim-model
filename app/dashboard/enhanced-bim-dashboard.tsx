"use client";

import { useState, useEffect } from "react";
import { DashboardHeader } from "./components/dashboard-header";
import { ThreeDViewer } from "./components/3d-viewer";
import { EnhancedProjectPanel } from "./components/enhanced-project-panel";
import IoTPanel from "../components/iot-panel"; // Import the new IoTPanel
import ModelHierarchyPanel from "../components/model-hierarchy-panel"; // Import the new HierarchyPanel
import { BIMPanel } from "../components/bim-panel"; // Import the new BIMPanel
import { DatabasePanel } from "../components/database-panel"; // Import the new DatabasePanel
import FMPanel from "../components/fm-panel";
import FileViewer from "../components/file-viewer";
import dynamic from "next/dynamic";
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
import { NotificationProvider } from "../context/notification-context";

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

// PdfViewer is heavy and uses pdfjs; disable SSR to avoid server-side canvas issues
const PdfViewer = dynamic(() => import("../components/pdf-viewer"), { ssr: false });

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
  const [wireframeMode, setWireframeMode] = useState<boolean>(false); // Default to solid; IoT panel will switch to wireframe on activation
  const [rightSidebarView, setRightSidebarView] = useState<'details' | 'hierarchy'>('details');
  const [showProjectPanel, setShowProjectPanel] = useState(true); // Show project panel initially
  const [sensorsVisible, setSensorsVisible] = useState(false); // Track sensor visibility
  const [showOnlySelectedOnMap, setShowOnlySelectedOnMap] = useState<boolean>(false); // Filter map to selected project after back
  const [noAccessMsg, setNoAccessMsg] = useState<string | null>(null);
  const [canCreateProjectPerm, setCanCreateProjectPerm] = useState<boolean>(false);
  // When a sensor is clicked in the 3D viewer, we store its ID here to filter IoT panel
  const [viewerSelectedSensorId, setViewerSelectedSensorId] = useState<string | null>(null);
  // File viewer state
  const [openFile, setOpenFile] = useState<{
    id: string;
    name: string;
    type: string;
    size: number;
    uploadedAt: string;
  } | null>(null);
  // Federated overlay: track which models are enabled for overlay
  const [enabledModelIds, setEnabledModelIds] = useState<Set<string>>(new Set());
  const lastProcessedProjectId = useRef<string | null>(null);
  // Guard to prevent duplicate "Show All" invocations in quick succession (e.g., StrictMode/dev)
  const showAllGuardRef = useRef<number>(0);
  // Guard to prevent duplicate toggle invocations in dev mode
  const toggleGuardRef = useRef<number>(0);

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

  // Auto-switch rendering mode on panel changes
  useEffect(() => {
    if (activePanel === "iot") {
      // Prefer wireframe in IoT for better sensor visibility
      setWireframeMode(true);
      // Ensure the viewer receives the wireframe mode change with multiple triggers
      setTimeout(() => {
        setWireframeMode(true); // Force trigger wireframe mode again
      }, 300);
      // Additional trigger to ensure wireframe mode is applied
      setTimeout(() => {
        setWireframeMode(false); // Toggle to force re-application
        setTimeout(() => {
          setWireframeMode(true); // Set back to wireframe
        }, 100);
      }, 600);
    } else if (activePanel === "bim" || activePanel === "database") {
      // Entering BIM or Database should default to solid 3D mode for better viewing
      setWireframeMode(false);
      
      // For Database panel, also restore full model visibility like "Show All Objects"
      if (activePanel === "database" && viewer && viewer.model) {
        console.log('[Dashboard] Database panel activated - restoring full model visibility');
        setTimeout(() => {
          try {
            // Call the viewer's showAll function to restore complete model visibility
            if (typeof viewer.showAll === 'function') {
              viewer.showAll();
            }
            // Also invalidate to ensure rendering is updated
            if (viewer.impl && viewer.impl.invalidate) {
              viewer.impl.invalidate(true);
            }
          } catch (error) {
            console.warn('[Dashboard] Error restoring model visibility:', error);
          }
        }, 250);
      }
    }
  }, [activePanel, viewer]);

  // Fetch projects from MongoDB on mount
  useEffect(() => {
    async function fetchProjects() {
      const res = await fetch("/api/projects");
      const data = await res.json();
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

  // Fetch permission to create projects
  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        const r = await fetch('/api/projects/can-create');
        if (aborted) return;
        if (r.ok) {
          const j = await r.json();
          setCanCreateProjectPerm(!!j?.canCreate);
        } else {
          setCanCreateProjectPerm(false);
        }
      } catch {
        if (aborted) return;
        setCanCreateProjectPerm(false);
      }
    })();
    return () => { aborted = true; };
  }, []);

  // When a project is selected, set a sensible default for enabled models (once)
  useEffect(() => {
    const projectId = selectedProject?.id;
    const models = selectedProject?.models || [];

    // Only run this logic if the project ID has changed AND enabledModelIds is empty
    if (projectId && projectId !== lastProcessedProjectId.current && enabledModelIds.size === 0) {
      console.log('🏗️ [Dashboard] Setting initial enabled models for new project:', projectId);
      lastProcessedProjectId.current = projectId;

      if (models.length === 0) {
        setEnabledModelIds(new Set());
        return;
      }

      // Prefer architecture models; if none, fallback to the first in order
      const archIds = models.filter(m => (m.discipline || '').toLowerCase() === 'architecture').map(m => m.id);
      if (archIds.length > 0) {
        console.log('🏗️ [Dashboard] Enabling architecture models by default:', archIds);
        setEnabledModelIds(new Set(archIds));
      } else {
        console.log('🏗️ [Dashboard] Enabling first model by default:', models[0].id);
        setEnabledModelIds(new Set([models[0].id]));
      }
    } else if (!projectId) {
      // If no project is selected, clear everything
      console.log('🏗️ [Dashboard] Clearing enabled models - no project selected');
      lastProcessedProjectId.current = null;
      setEnabledModelIds(new Set());
    } else if (projectId && projectId !== lastProcessedProjectId.current) {
      // Project changed but we already have enabled models - just update the ref
      console.log('🏗️ [Dashboard] Project changed but keeping existing enabled models:', Array.from(enabledModelIds));
      lastProcessedProjectId.current = projectId;
    }
  }, [selectedProject, enabledModelIds.size]); // Also depend on enabledModelIds size

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
  };

  const handleProcessingComplete = (urn: string, file: ProjectFile) => {
    setSelectedFile((prev) => (prev ? { ...prev, urn } : null));
    setProjects((prev) =>
      prev.map((p) => (p.id === file.id ? { ...p, urn } : p)),
    );
  };


  const handleProjectSelect = (project: Project) => {
    setSelectedProject(project);
    setCurrentProject(project.id); // Set project in sensor context
    setShowOnlySelectedOnMap(false);
    
    // Check if project has any processed models with URNs
    let existingUrn: string | undefined = undefined;
    if (project.models && project.models.length > 0) {
      const archModel = project.models.find(m => m.discipline === 'architecture' && m.urn);
      if (archModel) {
        existingUrn = archModel.urn;
      } else {
        const anyModelWithUrn = project.models.find(m => m.urn);
        if (anyModelWithUrn) {
          existingUrn = anyModelWithUrn.urn;
        }
      }
    }
    
    // Fallback to legacy project-level URN
    if (!existingUrn) {
      existingUrn = project.urn;
    }
    
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
  };

  // Toggle model enablement for overlay
  const handleToggleModel = (modelId: string) => {
    // Re-entrancy guard: suppress duplicate calls within 250ms
    const now = Date.now();
    if (toggleGuardRef.current && (now - toggleGuardRef.current) < 250) {
      return;
    }
    toggleGuardRef.current = now;
    setTimeout(() => { toggleGuardRef.current = 0; }, 300);

    
    setEnabledModelIds((prev) => {
      const next = new Set(prev);
      const isCurrentlyEnabled = next.has(modelId);
      

      // If trying to disable the only enabled model, block the action
      if (isCurrentlyEnabled && next.size === 1) {
        console.warn('⚠️  [Models] BLOCKED: At least one model must remain enabled. Enable another model before disabling this one.');
        return prev; // no change
      }

      if (isCurrentlyEnabled) {
        next.delete(modelId);
      } else {
        next.add(modelId);
      }
      
      
      return next;
    });
  };

  // Compute the list of models to render in the viewer, keep a deterministic order
  const orderedModels: ProjectModel[] | undefined = React.useMemo(() => {
    if (!selectedProject?.models) return undefined;
    // The viewer needs the full list of models to manage them.
    // We should not filter them here. Visibility is controlled by `enabledModelIds`.
    return selectedProject.models;
  }, [selectedProject?.models]);

  // Derive if the current user is a Platform Owner (from any project access role)
  const isPlatformOwner = React.useMemo(() => {
    return projects.some((p: any) => p?.access?.role === 'PlatformOwner');
  }, [projects]);

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
    // Set filter immediately to ensure IoTPanel reacts even if sensors array hasn't refreshed yet
    setViewerSelectedSensorId(sensorId);
    const sensor = sensors.find(s => s.id === sensorId);
    if (sensor) {
      selectSensor(sensor);
    }
  };

  // Panel-originated sensor click: select only (no filtering)
  const handlePanelSensorClick = (sensorId: string) => {
    const sensor = sensors.find(s => s.id === sensorId);
    if (sensor) {
      selectSensor(sensor);
      // Do NOT set viewerSelectedSensorId here, to avoid triggering filtering from panel clicks
    }
  };

  // Viewer empty click: clear selection and IoT panel filter
  const handleViewerEmptyClick = () => {
    setViewerSelectedSensorId(null);
    selectSensor(null);
  };

  const handleSensorPlaced = (sensorData: any) => {
    // Add the sensor to the context
    placeSensor(sensorData.position, sensorData.room);
  };

  // Handler for wireframe mode toggle
  const handleWireframeModeChange = (enabled: boolean) => {
    setWireframeMode(enabled);
  };

  const handleFileOpen = (file: any) => {
    setOpenFile({
      id: file.id,
      name: file.name,
      type: file.type,
      size: file.size,
      uploadedAt: file.uploadedAt
    });
  };

  const handleFileClose = () => {
    setOpenFile(null);
  };

  // Handler for sensor form submission
  const handleSensorFormSubmit = async (formData: SensorFormData) => {
    const newSensor = await placeSensorWithDetails(formData);
    if (newSensor) {
      // Exit insert mode after successful placement
      setInsertMode(null);
    }
  };

  // Handler for sensor form cancellation
  const handleSensorFormCancel = () => {
    hideSensorForm();
    setInsertMode(null);
  };

  // Handler for showing project information
  const handleShowProjectInfo = () => {
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
    } else {
      // In BIM panel, this could toggle any placed sensors
    }
  };

  const handleSaveCurrentView = (viewName: string) => {
    // The actual saving is handled in the BIM panel component
  };

  const handleFilterObjects = (filters: any) => {
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
    // Update the selected project and projects list
    setSelectedProject(updatedProject);
    setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
    setShowProjectInfo(false);
  };

  // Handler for project updated from API
  const handleProjectUpdated = (updatedProject: Project) => {
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
    // Owners and Platform Owners have full access
    if (selectedProject?.access?.owner) return true;
    if (selectedProject?.access?.role === 'PlatformOwner') return true;
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
    // Close any open file if switching away from Database panel
    if (panel !== 'database') {
      setOpenFile(null);
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
        platformOwner={isPlatformOwner}
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
              {session?.user && canCreateProjectPerm && (
                <button
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg text-lg font-semibold shadow-lg transition-colors"
                  onClick={handleRequestCreateProject}
                >
                  + Create Project
                </button>
              )}
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
                      models={orderedModels}
                      enabledModelIds={enabledModelIds}
                      onViewerReady={handleViewerReady}
                      insertMode={insertMode}
                      onExitInsertMode={handleExitInsertMode}
                      onSensorClick={handleViewerSensorClick}
                      onEmptyClick={handleViewerEmptyClick}
                      activePanel={activePanel}
                      wireframeMode={wireframeMode}
                      onWireframeModeChange={handleWireframeModeChange}
                      sensorsVisible={sensorsVisible}
                      selectedProject={selectedProject ? {
                        lat: selectedProject.lat,
                        lng: selectedProject.lng,
                        address: selectedProject.address,
                        municipality: selectedProject.municipality,
                        country: selectedProject.country
                      } : undefined}
                    />
                    {openFile && (
                      /\.pdf$/i.test(openFile.name) ? (
                        <div className="absolute inset-0 bg-gray-900 z-10 flex flex-col">
                          <div className="flex-1 min-h-0">
                            <PdfViewer
                              projectId={selectedProject?.id || ''}
                              fileId={openFile.id}
                              fileName={openFile.name}
                              onClose={handleFileClose}
                            />
                          </div>
                        </div>
                      ) : (
                        <FileViewer
                          file={openFile}
                          projectId={selectedProject?.id || ''}
                          onClose={handleFileClose}
                        />
                      )
                    )}
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
                onRestoreEnabledModelsVisibility={(viewer) => {
                  // Re-entrancy guard: suppress duplicate calls within 350ms
                  const now = Date.now();
                  if (showAllGuardRef.current && (now - showAllGuardRef.current) < 350) {
                    console.log('🔄 [Show All] Duplicate call suppressed');
                    return;
                  }
                  showAllGuardRef.current = now;
                  setTimeout(() => { showAllGuardRef.current = 0; }, 400);

                  // Restore visibility for all currently enabled models immediately
                  if (!viewer || !selectedProject?.models || !enabledModelIds.size) return;
                  
                  
                  // Force immediate visibility update by triggering the effect synchronously
                  console.log('🔄 [Dashboard] View Sensors clicked - forcing visibility refresh');
                  setTimeout(() => {
                    setEnabledModelIds(prev => {
                      console.log('🔄 [Dashboard] Current enabled models during refresh:', Array.from(prev));
                      const current = new Set(prev);
                      return current;
                    });
                  }, 0);
                  
                  // Also invalidate viewer to apply changes immediately
                  if (viewer.impl?.invalidate) {
                    viewer.impl.invalidate(true);
                  }
                }}
                wireframeMode={wireframeMode}
                onWireframeModeChange={handleWireframeModeChange}
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
            ) : activePanel === "database" ? (
              selectedProject ? (
                <DatabasePanel
                  projectId={selectedProject.id}
                  onFileOpen={handleFileOpen}
                  openFileId={openFile?.id || null}
                />
              ) : (
                <div className="w-80 bg-gray-800 border-l border-gray-700 flex items-center justify-center">
                  <p className="text-gray-400">Select a project to view files</p>
                </div>
              )
            ) : activePanel === "fm" ? (
              <FMPanel
                projectId={selectedProject?.id}
                viewer={viewer}
              />
            ) : activePanel === "ai" ? (
              // Placeholder for AI panel
              <div className="w-80 bg-gray-800 border-l border-gray-700 flex items-center justify-center">
                <p className="text-gray-400">Panel for AI</p>
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
                    platformOwner={isPlatformOwner}
                    canCreate={canCreateProjectPerm}
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
  const { data: wrapperSession } = useSession();
  return (
    <NotificationProvider userEmail={wrapperSession?.user?.email || null}>
      <SensorProvider>
        <BIMDashboard />
      </SensorProvider>
    </NotificationProvider>
  );
}
