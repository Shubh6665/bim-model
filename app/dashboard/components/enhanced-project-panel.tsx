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

interface EnhancedProjectPanelProps {
  onFileSelect: (file: ProjectFile | null) => void;
  onProjectSelect: (project: Project) => void;
  selectedFile: ProjectFile | null;
  selectedProject: Project | null;
  projects: Project[];
  onViewModeChange: (mode: 'map' | 'viewer') => void;
  currentViewMode: 'map' | 'viewer';
  onProcessingComplete?: (urn: string, file: ProjectFile) => void;
  onProjectCreated?: (newProject: Project) => void;
  showCreateModal?: boolean;
  onRequestCreateProject?: () => void;
  hidePanel?: boolean;
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
  onProjectCreated,
  showCreateModal,
  onRequestCreateProject,
  hidePanel,
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
  const [newProjectFile, setNewProjectFile] = useState<File | null>(null);
  const [newProjectLat, setNewProjectLat] = useState<number | null>(null);
  const [newProjectLng, setNewProjectLng] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<string | null>(null);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [processingUrn, setProcessingUrn] = useState<string | null>(null);

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
      if (onProjectCreated) {
        onProjectCreated({
          id: saveData.project._id || saveData.project.id,
          name: saveData.project.name,
          lat: saveData.project.location.lat,
          lng: saveData.project.location.lng,
          urn: saveData.project.urn,
          description: saveData.project.description || "",
        });
      }
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

  if (hidePanel) return <>{/* Only render modal if hidePanel is true */}{showCreateModal && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <form
        className="bg-gray-900 p-6 rounded-lg shadow-lg w-full max-w-md relative"
        onSubmit={handleCreateProject}
        style={{ minWidth: 320 }}
      >
        <h3 className="text-lg font-semibold text-white mb-4">Create New Project</h3>
        <label className="block text-gray-300 mb-2">Project Name</label>
        <input
          type="text"
          className="w-full mb-3 px-3 py-2 rounded bg-gray-800 border border-gray-700 text-white"
          value={newProjectName}
          onChange={e => setNewProjectName(e.target.value)}
          required
        />
        <label className="block text-gray-300 mb-2">BIM File</label>
        <div className="mb-3">
          <label
            htmlFor="bim-upload"
            className={`flex items-center justify-center w-full px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer transition-colors
              ${newProjectFile ? 'border-green-500 bg-green-900/10' : 'border-blue-500 bg-gray-800 hover:bg-blue-900/20'}
            `}
            tabIndex={0}
          >
            {newProjectFile ? (
              <span className="flex items-center gap-2 text-green-400 font-medium">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                {newProjectFile.name}
              </span>
            ) : (
              <span className="flex items-center gap-2 text-blue-300 font-medium">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                Click or drag RVT, IFC, DWG, or NWD file here
              </span>
            )}
            <input
              id="bim-upload"
              type="file"
              accept=".rvt,.ifc,.dwg,.nwd"
              className="hidden"
              onChange={e => setNewProjectFile(e.target.files?.[0] || null)}
              required
            />
          </label>
        </div>
        <label className="block text-gray-300 mb-2">Location (lat, lng)</label>
        <div className="flex flex-wrap gap-2 mb-3 w-full">
          <input
            type="number"
            step="any"
            placeholder="Latitude"
            className="flex-1 min-w-0 px-3 py-2 rounded bg-gray-800 border border-gray-700 text-white"
            value={newProjectLat ?? ""}
            onChange={e => setNewProjectLat(Number(e.target.value))}
            required
            style={{ minWidth: 0 }}
          />
          <input
            type="number"
            step="any"
            placeholder="Longitude"
            className="flex-1 min-w-0 px-3 py-2 rounded bg-gray-800 border border-gray-700 text-white"
            value={newProjectLng ?? ""}
            onChange={e => setNewProjectLng(Number(e.target.value))}
            required
            style={{ minWidth: 0 }}
          />
        </div>
        {createError && <div className="text-red-400 mb-2 text-sm">{createError}</div>}
        {/* Processing UI */}
        {isProcessing && (
          <div className="mb-3 p-3 bg-gray-800 border border-blue-700 rounded text-blue-300 flex flex-col gap-2">
            <span className="font-medium">{processingStep || "Processing..."}</span>
            <span className="text-xs text-blue-200">This may take a few minutes for large files.</span>
            {processingUrn && <span className="text-green-400 text-xs">URN: {processingUrn}</span>}
            {processingError && <span className="text-red-400 text-xs">{processingError}</span>}
          </div>
        )}
        {processingError && !isProcessing && (
          <div className="mb-3 p-3 bg-red-900 border border-red-700 rounded text-red-300">
            <span className="font-medium">{processingError}</span>
          </div>
        )}
        <div className="flex gap-2 mt-4">
          <button
            type="submit"
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded disabled:opacity-60"
            disabled={isCreating || isProcessing}
          >
            {isCreating || isProcessing ? "Processing..." : "Create Project"}
          </button>
          <button
            type="button"
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded"
            onClick={() => onRequestCreateProject && onRequestCreateProject()}
            disabled={isCreating || isProcessing}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )}</>;

  return (
    <div className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col">
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
            onClick={() => setActiveTab('projects')}
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
            onClick={() => setActiveTab('files')}
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
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'projects' ? (
          // Projects List
          <div className="p-4 space-y-2">
            {filteredProjects.map((project) => (
              <div
                key={project.id}
                onClick={() => handleProjectClick(project)}
                className={`p-3 rounded-lg border cursor-pointer transition-all hover:bg-gray-700 ${
                  selectedProject?.id === project.id
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-gray-600 hover:border-gray-500'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-medium text-sm truncate">
                      {project.name}
                    </h3>
                    <p className="text-gray-400 text-xs mt-1 line-clamp-2">
                      {project.description}
                    </p>
                    <div className="flex items-center mt-2 text-xs text-gray-500">
                      <MapPin className="w-3 h-3 mr-1" />
                      <span>{project.lat.toFixed(4)}, {project.lng.toFixed(4)}</span>
                      <span className="ml-auto bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded">
                        Ready to Process
                      </span>
                    </div>
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

      {/* Info Panel */}
      {(selectedFile || selectedProject) && (
        <div className="p-4 border-t border-gray-700 bg-gray-850">
          <h3 className="text-sm font-semibold text-white mb-2">
            {activeTab === 'projects' ? 'Project Details' : 'File Details'}
          </h3>
          
          {selectedProject && activeTab === 'projects' && (
            <div className="space-y-2 text-xs text-gray-400">
              <div>
                <span className="text-gray-300">Name:</span> {selectedProject.name}
              </div>
              <div>
                <span className="text-gray-300">Location:</span> {selectedProject.lat.toFixed(4)}, {selectedProject.lng.toFixed(4)}
              </div>
              <div>
                <span className="text-gray-300">Description:</span> {selectedProject.description}
              </div>
              <div className="mt-3 p-2 bg-orange-900/30 border border-orange-600/30 rounded">
                <div className="flex items-center text-orange-300 text-xs">
                  <span className="w-3 h-3 mr-1">⚡</span>
                  <span className="font-medium">Ready for Processing</span>
                </div>
                <p className="text-xs text-orange-200 mt-1">
                  Click to process and view this project's 3D model.
                </p>
              </div>
            </div>
          )}

          {selectedFile && activeTab === 'files' && (
            <div className="space-y-2 text-xs text-gray-400">
              <div>
                <span className="text-gray-300">Name:</span> {selectedFile.name}
              </div>
              <div>
                <span className="text-gray-300">Type:</span> {selectedFile.type}
              </div>
              <div>
                <span className="text-gray-300">Size:</span> {selectedFile.size}
              </div>
              <div>
                <span className="text-gray-300">Modified:</span> {selectedFile.modified}
              </div>
              {selectedFile.lat && selectedFile.lng && (
                <div>
                  <span className="text-gray-300">Location:</span> {selectedFile.lat.toFixed(4)}, {selectedFile.lng.toFixed(4)}
                </div>
              )}
              {selectedFile.isRVT && !selectedFile.urn && (
                <div className="mt-3 p-2 bg-yellow-900/30 border border-yellow-600/30 rounded">
                  <div className="flex items-center text-yellow-300 text-xs">
                    <span className="w-3 h-3 mr-1">⚡</span>
                    <span className="font-medium">RVT File - Ready for Processing</span>
                  </div>
                  <p className="text-xs text-yellow-200 mt-1">
                    Click to upload and process this RVT file using Autodesk Forge.
                  </p>
                </div>
              )}
              {selectedFile.isRVT && selectedFile.urn && (
                <div className="mt-3 p-2 bg-green-900/30 border border-green-600/30 rounded">
                  <div className="flex items-center text-green-300 text-xs">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    <span className="font-medium">RVT File - Processed & Ready</span>
                  </div>
                  <p className="text-xs text-green-200 mt-1">
                    This RVT file has been processed and is ready for 3D viewing.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
