"use client";

import React, { useState } from "react";
import {
  Upload,
  File,
  Folder,
  Filter,
  MoreVertical,
  FileText,
  Download,
  Eye,
  Trash2,
  CheckCircle,
  MapPin,
  Globe,
  ArrowLeft,
} from "lucide-react";
import { CreateProjectModal } from "./create-project-modal";

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
  code?: string;
  country?: string;
  municipality?: string;
  fileType?: string;
  company?: string;
  clientName?: string;
  address?: string;
  cadastral?: string;
}

interface EnhancedProjectPanelProps {
  onFileSelect: (file: ProjectFile | null) => void;
  onProjectSelect: (project: Project) => void;
  selectedFile: ProjectFile | null;
  selectedProject: Project | null;
  projects: Project[];
  onViewModeChange: (mode: 'map' | 'viewer') => void;
  currentViewMode: 'map' | 'viewer';
  onProcessingComplete?: (urn: string, file: ProjectFile) => void;
  apiKey: string;
  onRequestCreateProject: () => void;
  onReturnToMapView: () => void;
  onShowHierarchy: () => void;
}

export function EnhancedProjectPanel({
  onFileSelect,
  onProjectSelect,
  selectedFile,
  selectedProject,
  projects,
  onViewModeChange,
  currentViewMode,
  onProcessingComplete,
  apiKey,
  onRequestCreateProject,
  onShowHierarchy,
  onReturnToMapView,
}: EnhancedProjectPanelProps) {

  const [activeTab, setActiveTab] = useState<'projects' | 'models'>('projects');
  const [files, setFiles] = useState<ProjectFile[]>([
    {
      id: "1",
      name: "SAM0001-ADD-SA1067001-ZZ-M3-S-S00001.rvt",
      type: "RVT",
      size: "8.8 MB",
      modified: "2 hours ago",
      isRVT: true,
      lat: 28.6139,
      lng: 77.2090,
      description: "Main building structural model (requires processing)"
    },
    {
      id: "2",
      name: "Building_Floor_Plan.dwg",
      type: "DWG",
      size: "1.2 MB",
      modified: "1 day ago",
      lat: 28.7041,
      lng: 77.1025,
    },
    {
      id: "3",
      name: "Structural_Model.ifc",
      type: "IFC",
      size: "15.6 MB",
      modified: "3 days ago",
      lat: 28.5355,
      lng: 77.3910,
    },
  ]);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectCode, setNewProjectCode] = useState("");
  const [newProjectCountry, setNewProjectCountry] = useState("");
  const [newProjectMunicipality, setNewProjectMunicipality] = useState("");
  const [newProjectAddress, setNewProjectAddress] = useState("");
  const [newProjectCadastral, setNewProjectCadastral] = useState("");
  const [clientCompany, setClientCompany] = useState("");
  const [clientSurname, setClientSurname] = useState("");
  const [clientName, setClientName] = useState("");
  const [newProjectFile, setNewProjectFile] = useState<File | null>(null);
  const [newProjectLat, setNewProjectLat] = useState<number | null>(null);
  const [newProjectLng, setNewProjectLng] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<string | null>(null);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [processingUrn, setProcessingUrn] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showProjectDetail, setShowProjectDetail] = useState(true);

  // Keep tabs state independent; when a project is selected we hide tabs
  // and show the project information view.


  const handleProcessingComplete = (urn: string, fileId: string) => {
    setFiles(prev => prev.map(file => 
      file.id === fileId 
        ? { ...file, urn } 
        : file
    ));
    
    if (onProcessingComplete) {
      const processedFile = files.find(f => f.id === fileId);
      if (processedFile) {
        onProcessingComplete(urn, processedFile);
      }
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setNewProjectFile(file);
    }
  };

  const handleProjectClick = (project: Project) => {
    onProjectSelect(project);
    setShowProjectDetail(true);
  };

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setCreateError(null);

    setTimeout(() => {
      try {
        const newProject: Project = {
          id: Date.now().toString(),
          name: newProjectName,
          code: newProjectCode,
          lat: newProjectLat || 0,
          lng: newProjectLng || 0,
          country: newProjectCountry,
          municipality: newProjectMunicipality,
          address: newProjectAddress,
          cadastral: newProjectCadastral,
          company: clientCompany,
          clientName: `${clientName} ${clientSurname}`.trim(),
          fileType: newProjectFile?.name.split('.').pop()?.toUpperCase() || 'Unknown',
        };

        setNewProjectName("");
        setNewProjectCode("");
        setNewProjectCountry("");
        setNewProjectMunicipality("");
        setNewProjectAddress("");
        setNewProjectCadastral("");
        setClientCompany("");
        setClientSurname("");
        setClientName("");
        setNewProjectFile(null);
        setNewProjectLat(null);
        setNewProjectLng(null);
        setIsCreating(false);
        
        onProjectSelect(newProject);
      } catch (error) {
        setCreateError("Failed to create project. Please try again.");
        setIsCreating(false);
      }
    }, 1500);
  };

  const handleFileClick = (file: ProjectFile) => {
    onFileSelect(file);
    if (file.isRVT && !file.urn) {
      setIsProcessing(true);
      setProcessingStep("Uploading file...");
      setProcessingError(null);
      setProcessingUrn(null);

      setTimeout(() => {
        setProcessingStep("Processing model...");
        setTimeout(() => {
          const mockUrn = `urn:adsk.objects:os.object:${Date.now()}`;
          setProcessingUrn(mockUrn);
          setProcessingStep("Model processed successfully!");
          handleProcessingComplete(mockUrn, file.id);
          setIsProcessing(false);
        }, 2000);
      }, 1000);
    }
  };

  const getFileIcon = (file: ProjectFile) => {
    switch (file.type.toLowerCase()) {
      case 'rvt':
        return <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white text-xs font-bold">RVT</div>;
      case 'dwg':
        return <div className="w-8 h-8 bg-green-600 rounded flex items-center justify-center text-white text-xs font-bold">DWG</div>;
      case 'ifc':
        return <div className="w-8 h-8 bg-purple-600 rounded flex items-center justify-center text-white text-xs font-bold">IFC</div>;
      default:
        return <FileText className="w-8 h-8 text-gray-400" />;
    }
  };

  const filteredProjects: Project[] = projects;
  const filteredFiles = files;
  const selectedProjectId: string | null = selectedProject ? selectedProject.id : null;

  return (
    <div className="h-full bg-gray-800 text-white flex flex-col w-80 min-w-80 max-w-80">
      <div className="p-4 border-b border-gray-700">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-white">My Projects</h2>
        </div>

        {/* Tabs - hidden when a project is selected */}
        {!selectedProject && (
          <div className="flex bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => { setActiveTab('projects'); setShowProjectDetail(true); }}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                activeTab === 'projects'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              <Globe className="w-4 h-4 inline mr-1" />
              Projects
            </button>
            <button
              onClick={() => { setActiveTab('models'); setShowProjectDetail(false); }}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                activeTab === 'models'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              <File className="w-4 h-4 inline mr-1" />
              Models
            </button>
          </div>
        )}


      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {selectedProject ? (
          // Project selected: show only project information view
            <div className="p-6 space-y-4">
              {/* Back to Google Earth Button */}
              <div className="mb-4">
                <button
                  onClick={onReturnToMapView}
                  className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Google Earth
                </button>
              </div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-gradient-to-br from-orange-500 to-purple-600">
                  <span className="text-white text-xl font-bold uppercase">{selectedProject.fileType || '?'}</span>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white mb-1">{selectedProject.name}</h3>
                  <span className="inline-block bg-gray-700 text-gray-300 text-xs rounded px-2 py-0.5 mr-2">{selectedProject.fileType || 'Unknown'}</span>
                  <span className="inline-block bg-blue-700 text-white text-xs rounded px-2 py-0.5">{selectedProject.code || 'No Code'}</span>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2 text-gray-300 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Company:</span>
                  <span className="text-gray-200">{selectedProject.company || <span className="italic text-gray-500">Not specified</span>}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Client:</span>
                  <span className="text-gray-200">{selectedProject.clientName || <span className="italic text-gray-500">Not specified</span>}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Location:</span>
                  <span className="text-gray-200">{selectedProject.country || '—'}, {selectedProject.municipality || '—'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Address:</span>
                  <span className="text-gray-200">{selectedProject.address || <span className="italic text-gray-500">Not specified</span>}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Cadastral:</span>
                  <span className="text-gray-200">{selectedProject.cadastral || <span className="italic text-gray-500">Not specified</span>}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Lat/Lng:</span>
                  <span className="text-gray-200">{selectedProject.lat}, {selectedProject.lng}</span>
                </div>
              </div>
              <div className="mb-2">
                <span className="font-semibold text-gray-300">Description:</span>
                
                {/* Mock Sensor Data Section */}
                <div className="mb-4 mt-2 p-3 bg-gray-900 border border-gray-700 rounded-lg text-sm shadow flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-blue-300">
                    <span>🌡️</span>
                    <span className="font-semibold">Temperature:</span>
                    <span className="text-white">22.5°C</span>
                  </div>
                  <div className="flex items-center gap-2 text-green-300">
                    <span>💧</span>
                    <span className="font-semibold">Humidity:</span>
                    <span className="text-white">45%</span>
                  </div>
                  <div className="flex items-center gap-2 text-yellow-300">
                    <span>🟢</span>
                    <span className="font-semibold">CO₂ Level:</span>
                    <span className="text-white">410 ppm</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-400">
                    <span>🔧</span>
                    <span className="font-semibold">Last Sensor Update:</span>
                    <span className="text-white">2025-07-15 14:32</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={onShowHierarchy}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-md transition-colors flex items-center justify-center"
                >
                  View Hierarchy
                </button>
              </div>
            </div>
        ) : (
          // No project selected: show tabs content
          activeTab === 'projects' ? (
            <div className="p-8 text-center text-gray-400">
              <Globe className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Select a model to view project details</p>
              <p className="text-sm mt-1">Go to Models tab to select a project model</p>
            </div>
          ) : (
            // Models Section - Show project cards that open 3D models
            <div className="p-4 space-y-2">
            {filteredProjects.map((project: Project) => (
              <div
                key={project.id}
                onClick={() => {
                  // When clicking on model, open 3D viewer and set project details
                  onProjectSelect(project);
                  onViewModeChange('viewer');
                  setShowProjectDetail(true);
                }}
                  className={`p-3 rounded-lg border cursor-pointer transition-all hover:bg-gray-700 flex items-center gap-3 ${
                    selectedProjectId === project.id
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-gray-600 hover:border-gray-500'
                }`}
              >
                {/* File type icon and badge */}
                <div className="flex flex-col items-center justify-center mr-2">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br from-orange-500 to-purple-600">
                    <span className="text-white text-lg font-bold uppercase">
                      {project.fileType || '?'}
                    </span>
                  </div>
                  <span className="mt-1 text-xs text-gray-400 uppercase tracking-wider">
                    {project.fileType || 'Unknown'}
                  </span>
                </div>
                {/* Project info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-medium text-sm truncate">
                      {project.name}
                    </h3>
                    {project.description && (
                      <span className="ml-2 px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded">
                        {project.description}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                    <span className="font-semibold text-blue-400">Code:</span> {project.code || '—'}
                    <span className="ml-2 font-semibold text-green-400">{project.lat && project.lng ? '📍' : ''}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                    <span>{project.country || '—'}, {project.municipality || '—'}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                    <span className="bg-gray-700 text-gray-300 px-2 py-0.5 rounded">{project.fileType || 'Unknown'}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onProjectSelect(project);
                      onViewModeChange('viewer');
                    }}
                    className="p-1 text-gray-400 hover:text-white"
                    title="View in 3D"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onProjectSelect(project);
                      onShowHierarchy();
                    }}
                    className="p-1 text-gray-400 hover:text-white"
                    title="View Hierarchy"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-network"><rect x="16" y="16" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="9" y="2" width="6" height="6" rx="1"/><path d="M5 16v-2a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2"/><path d="M12 12V8"/></svg>
                  </button>
                  {project.lat && project.lng && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onProjectSelect(project);
                        onViewModeChange('map');
                      }}
                      className="p-1 text-gray-400 hover:text-white"
                      title="Show on map"
                    >
                      <MapPin className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}

            {filteredProjects.length === 0 && (
              <div className="p-8 text-center text-gray-400">
                <Folder className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No models found</p>
                <p className="text-sm mt-1">Create some projects to see models here</p>
              </div>
            )}
            </div>
          )
        )}
      </div>

      {showCreateModal && (
        <CreateProjectModal
          show={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onProjectCreated={(project: any) => {
            setShowCreateModal(false);
          }}
          apiKey={apiKey}
        />
      )}
    </div>
  );
}
