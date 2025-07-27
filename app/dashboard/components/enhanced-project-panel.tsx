"use client";

import React, { useState } from "react";
import {
  Upload,
  File,
  Folder,
  Search,
  Filter,
  MoreVertical,
  FileText,
  Download,
  Eye,
  Trash2,
  CheckCircle,
  MapPin,
  Globe,
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
}: EnhancedProjectPanelProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<'projects' | 'files'>('projects');
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
      // No URN initially - this will trigger the processing workflow
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
  // Location fields
  const [newProjectCountry, setNewProjectCountry] = useState("");
  const [newProjectMunicipality, setNewProjectMunicipality] = useState("");
  const [newProjectAddress, setNewProjectAddress] = useState("");
  const [newProjectCadastral, setNewProjectCadastral] = useState("");
  // Client/Manager fields
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
  const [showProjectDetail, setShowProjectDetail] = useState(false);

  const handleProcessingComplete = (urn: string, fileId: string) => {
    // Update the file with the new URN
    setFiles(prev => prev.map(file => 
      file.id === fileId 
        ? { ...file, urn } 
        : file
    ));
    
    // Call the parent callback if provided
    const updatedFile = files.find(f => f.id === fileId);
    if (onProcessingComplete && updatedFile) {
      onProcessingComplete(urn, { ...updatedFile, urn });
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = event.target.files;
    if (uploadedFiles) {
      Array.from(uploadedFiles).forEach((file) => {
        const newFile: ProjectFile = {
          id: Date.now().toString() + Math.random(),
          name: file.name,
          type: file.name.split(".").pop()?.toUpperCase() || "UNKNOWN",
          size: (file.size / (1024 * 1024)).toFixed(1) + " MB",
          modified: "Just now",
          isRVT: file.name.toLowerCase().endsWith(".rvt"),
        };
        setFiles((prev) => [newFile, ...prev]);
      });
    }
  };

  const handleProjectClick = (project: Project) => {
    if (project.urn) {
      // Load instantly if URN exists
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
      onFileSelect(file);
      onProjectSelect(project);
      setShowProjectDetail(true);
    } else {
      // Prompt for file upload/location if no URN
      setNewProjectName(project.name);
      setNewProjectLat(project.lat);
      setNewProjectLng(project.lng);
      // setShowCreateModal(true); // This is now handled by the parent's hidePanel prop
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setCreateError(null);
    setIsProcessing(false);
    setProcessingStep(null);
    setProcessingError(null);
    setProcessingUrn(null);
    try {
      if (!newProjectName || !newProjectFile || newProjectLat == null || newProjectLng == null) {
        setCreateError("All fields are required");
        setIsCreating(false);
        return;
      }
      // 1. Upload file to Forge
      setIsProcessing(true);
      setProcessingStep("Uploading file to Forge...");
      const uploadForm = new FormData();
      uploadForm.append("file", newProjectFile);
      const uploadRes = await fetch("/api/forge/upload", {
        method: "POST",
        body: uploadForm,
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok || !uploadData.urn) throw new Error(uploadData.error || "Upload failed");
      const urn = uploadData.urn;
      setProcessingStep("Starting translation...");
      // 2. Start translation
      const translateRes = await fetch("/api/forge/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urn }),
      });
      const translateData = await translateRes.json();
      if (!translateRes.ok) throw new Error(translateData.error || "Translation failed");
      // 3. Poll for status
      setProcessingStep("Waiting for conversion...");
      let status = "pending";
      let pollCount = 0;
      while (status !== "success" && pollCount < 60) { // up to 5 min
        await new Promise(res => setTimeout(res, 5000));
        const statusRes = await fetch(`/api/forge/status/${urn}`);
        const statusData = await statusRes.json();
        if (statusData.status === "success") {
          status = "success";
          break;
        } else if (statusData.status === "failed") {
          throw new Error("Forge translation failed");
        }
        pollCount++;
      }
      if (status !== "success") throw new Error("Forge translation timed out");
      setProcessingStep("Saving project to database...");
      setProcessingUrn(urn);
      // 4. Save project to DB
      const saveRes = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newProjectName,
          urn,
          lat: newProjectLat,
          lng: newProjectLng,
          description: "",
        }),
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok) throw new Error(saveData.error || "Failed to save project");
      // The original code had onProjectCreated here, but it's not defined in the props.
      // Assuming it's meant to be handled by the parent or removed if not needed.
      // For now, removing it as it's not in the EnhancedProjectPanelProps.
      setNewProjectName("");
      setNewProjectFile(null);
      setNewProjectLat(null);
      setNewProjectLng(null);
      setIsProcessing(false);
      setProcessingStep(null);
      setProcessingUrn(null);
    } catch (err: any) {
      setProcessingError(err.message);
      setIsProcessing(false);
      setIsCreating(false);
    } finally {
      setIsCreating(false);
    }
  };

  const handleFileClick = (file: ProjectFile) => {
    onFileSelect(file);
    
    // If file has location data, create corresponding project
    if (file.lat && file.lng) {
      const project: Project = {
        id: file.id,
        name: file.name.replace('.rvt', ''),
        lat: file.lat,
        lng: file.lng,
        urn: file.urn,
        description: file.description
      };
      onProjectSelect(project);
    }
  };

  const filteredProjects = projects.filter((project) =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredFiles = files.filter((file) =>
    file.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getFileIcon = (file: ProjectFile) => {
    if (file.isRVT) {
      return (
        <div className="w-8 h-8 bg-orange-500 rounded flex items-center justify-center">
          <FileText className="w-4 h-4 text-white" />
        </div>
      );
    }
    return (
      <div className="w-8 h-8 bg-gray-600 rounded flex items-center justify-center">
        <File className="w-4 h-4 text-white" />
      </div>
    );
  };

  return (
    <div className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col">
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #374151;
          border-radius: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #2563eb;
        }
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #374151 #1f2937;
        }
      `}</style>
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Projects</h2>
          <button
            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
            onClick={onRequestCreateProject}
          >
            + Create Project
          </button>
        </div>

        {/* Tabs */}
        <div className="flex bg-gray-700 rounded-lg p-1">
          <button
            onClick={() => { setActiveTab('projects'); setShowProjectDetail(false); }}
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
            onClick={() => { setActiveTab('files'); setShowProjectDetail(false); }}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
              activeTab === 'files'
                ? 'bg-blue-500 text-white'
                : 'text-gray-300 hover:text-white'
            }`}
          >
            <File className="w-4 h-4 inline mr-1" />
            Files
          </button>
        </div>

        {/* Search */}
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder={`Search ${activeTab}...`}
            className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {activeTab === 'projects' && showProjectDetail && selectedProject ? (
          // Project Detail View
          <div className="p-6 space-y-4">
            <button
              className="mb-4 px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600 text-sm"
              onClick={() => setShowProjectDetail(false)}
            >
              ← Back to Projects
            </button>
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
                  <span>⏰</span>
                  <span className="font-semibold">Last Sensor Update:</span>
                  <span className="text-white">2025-07-15 14:32</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-4 flex gap-3">
              <button
                onClick={onShowHierarchy}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-md transition-colors flex items-center justify-center"
              >
                View Hierarchy
              </button>
            </div>
          </div>
        ) : activeTab === 'projects' ? (
          // Projects List
          <div className="p-4 space-y-2">
            {filteredProjects.map((project) => (
              <div
                key={project.id}
                onClick={() => handleProjectClick(project)}
                className={`p-3 rounded-lg border cursor-pointer transition-all hover:bg-gray-700 flex items-center gap-3 ${
                  selectedProject?.id === project.id && showProjectDetail
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-gray-600 hover:border-gray-500'
                }`}
              >
                {/* File type icon and badge */}
                <div className="flex flex-col items-center justify-center mr-2">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br from-orange-500 to-purple-600">
                    {/* File type icon */}
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
              </div>
            ))}

            {filteredProjects.length === 0 && (
              <div className="p-8 text-center text-gray-400">
                <Globe className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No projects found</p>
                <p className="text-sm mt-1">Add project locations to get started</p>
              </div>
            )}
          </div>
        ) : (
          // Files List  
          <div className="p-4 space-y-2">
            {filteredFiles.map((file) => (
              <div
                key={file.id}
                onClick={() => handleFileClick(file)}
                className={`p-3 rounded-lg border cursor-pointer transition-all hover:bg-gray-700 ${
                  selectedFile?.id === file.id
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-gray-600 hover:border-gray-500'
                }`}
              >
                <div className="flex items-center gap-3">
                  {getFileIcon(file)}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-medium text-sm truncate">
                      {file.name}
                    </h3>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-gray-400 text-xs">{file.size}</span>
                      <span className="text-gray-500 text-xs">{file.modified}</span>
                    </div>
                    {file.isRVT && !file.urn && (
                      <div className="flex items-center mt-1 text-xs text-yellow-500">
                        <span>⚡ Ready for processing</span>
                      </div>
                    )}
                    {file.isRVT && file.urn && (
                      <div className="flex items-center mt-1 text-xs text-green-500">
                        <span>✅ Processed & ready</span>
                      </div>
                    )}
                    {file.lat && file.lng && (
                      <div className="flex items-center mt-1 text-xs text-gray-500">
                        <MapPin className="w-3 h-3 mr-1" />
                        <span>Located on map</span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFileClick(file);
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
                        handleFileClick(file);
                        onShowHierarchy();
                      }}
                      className="p-1 text-gray-400 hover:text-white"
                      title="View Hierarchy"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-network"><rect x="16" y="16" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="9" y="2" width="6" height="6" rx="1"/><path d="M5 16v-2a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2"/><path d="M12 12V8"/></svg>
                    </button>
                    {file.lat && file.lng && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFileClick(file);
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
              </div>
            ))}

            {filteredFiles.length === 0 && (
              <div className="p-8 text-center text-gray-400">
                <Folder className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No files found</p>
                <p className="text-sm mt-1">Upload some BIM files to get started</p>
              </div>
            )}
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateProjectModal
          show={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onProjectCreated={(project: any) => {
            // Add project to list, close modal
            // Optionally trigger parent callback if needed
            setShowCreateModal(false);
          }}
          apiKey={apiKey}
        />
      )}
    </div>
  );
}
