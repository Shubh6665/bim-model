"use client";

import { useState } from "react";
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
}

export function EnhancedProjectPanel({
  onFileSelect,
  onProjectSelect,
  selectedFile,
  selectedProject,
  projects,
  onViewModeChange,
  currentViewMode,
}: EnhancedProjectPanelProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<'projects' | 'files'>('projects');
  const [files] = useState<ProjectFile[]>([
    {
      id: "1",
      name: "SAM0001-ADD-SA1067001-ZZ-M3-S-S00001.rvt",
      type: "RVT",
      size: "8.8 MB",
      modified: "2 hours ago",
      isRVT: true,
      lat: 28.6139,
      lng: 77.2090,
      urn: "urn:adsk.viewing:fs.file:sample",
      description: "Main building structural model"
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
        // Note: In real implementation, you'd handle file upload to server here
      });
    }
  };

  const handleProjectClick = (project: Project) => {
    onProjectSelect(project);
    if (project.urn) {
      // Create file object for projects with URN
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
    }
  };

  const handleFileClick = (file: ProjectFile) => {
    onFileSelect(file);
    if (file.lat && file.lng) {
      // Create project object for files with location
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
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Projects</h2>
          <label className="cursor-pointer">
            <input
              type="file"
              multiple
              accept=".rvt,.dwg,.ifc,.nwd,.nwc"
              className="hidden"
              onChange={handleFileUpload}
            />
            <Upload className="w-5 h-5 text-gray-400 hover:text-white transition-colors" />
          </label>
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
                      {project.urn && (
                        <span className="ml-auto bg-green-500/20 text-green-400 px-2 py-0.5 rounded">
                          3D Ready
                        </span>
                      )}
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
              {selectedProject.urn && (
                <div className="mt-3 p-2 bg-green-900/30 border border-green-600/30 rounded">
                  <div className="flex items-center text-green-300 text-xs">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    <span className="font-medium">3D Model Available</span>
                  </div>
                  <p className="text-xs text-green-200 mt-1">
                    This project has a 3D model ready for viewing.
                  </p>
                </div>
              )}
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
              {selectedFile.isRVT && (
                <div className="mt-3 p-2 bg-blue-900/30 border border-blue-600/30 rounded">
                  <div className="flex items-center text-blue-300 text-xs">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    <span className="font-medium">RVT File Ready</span>
                  </div>
                  <p className="text-xs text-blue-200 mt-1">
                    This RVT file can be processed and viewed using Autodesk Forge.
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
