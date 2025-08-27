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
import type { ProjectModel, Discipline } from "@/app/types/projects";

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
  models?: ProjectModel[];
  access?: { role?: string; packages?: string[]; owner?: boolean };
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
  // Federated overlay controls
  enabledModelIds?: Set<string>;
  onToggleModel?: (modelId: string) => void;
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
  enabledModelIds,
  onToggleModel,
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
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showProjectDetail, setShowProjectDetail] = useState(true);

  // Format coordinates to fit nicely in the info card
  const formatCoord = (n: number | undefined | null) =>
    typeof n === 'number' && isFinite(n) ? n.toFixed(4) : '—';

  // Keep tabs state independent; when a project is selected we hide tabs
  // and show the project information view.


  // Note: Processing completion is handled by ThreeDViewer via onModelProcessed.

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
    // Simply select the file. If it's an RVT without a URN, the ThreeDViewer
    // will render the RVTForgeInterface to perform real upload/translation/polling.
    onFileSelect(file);
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
          <h2 className="text-lg font-semibold text-white text-center">{selectedProject ? 'Project Info' : 'My Projects'}</h2>
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
                <div>
                  <h3 className="text-2xl font-bold text-white mb-1">{selectedProject.name}</h3>
                </div>
              </div>
              {/* Project info card - clean minimal */}
              <div className="text-sm bg-gray-900 border border-gray-700 rounded-lg p-4 shadow-sm">
                <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                  <div className="text-gray-400">Company</div>
                  <div className="text-gray-100 text-right truncate">{selectedProject.company || <span className="italic text-gray-500">Not specified</span>}</div>

                  <div className="text-gray-400">Client</div>
                  <div className="text-gray-100 text-right truncate">{selectedProject.clientName || <span className="italic text-gray-500">Not specified</span>}</div>

                  <div className="text-gray-400">Location</div>
                  <div className="text-gray-100 text-right truncate">{selectedProject.country || '—'}, {selectedProject.municipality || '—'}</div>

                  <div className="text-gray-400">Address</div>
                  <div className="text-gray-100 text-right truncate">{selectedProject.address || <span className="italic text-gray-500">Not specified</span>}</div>

                  <div className="text-gray-400">Cadastral</div>
                  <div className="text-gray-100 text-right truncate">{selectedProject.cadastral || <span className="italic text-gray-500">Not specified</span>}</div>

                  <div className="text-gray-400">Lat/Lng</div>
                  <div className="text-gray-100 text-right">{formatCoord(selectedProject.lat)}, {formatCoord(selectedProject.lng)}</div>
                </div>
              </div>

              {/* Models Uploaded - minimal, neat */}
              {selectedProject.models && selectedProject.models.length > 0 && (
                <div className="mt-4">
                  <div className="mb-2">
                    <h4 className="text-base font-semibold text-white">Models Uploaded</h4>
                  </div>
                  <div className="space-y-3">
                    {(() => {
                      const groups = selectedProject.models!.reduce<Record<Discipline, ProjectModel[]>>((acc: any, m) => {
                        const key = (m.discipline || 'other') as Discipline;
                        acc[key] = acc[key] || [];
                        acc[key].push(m);
                        return acc;
                      }, {} as Record<Discipline, ProjectModel[]>);
                      const order: Discipline[] = ['architecture','structure','mep','electrical','plumbing','hvac','other'];
                      const label: Record<Discipline,string> = { architecture:'Architecture', structure:'Structure', mep:'MEP', electrical:'Electrical', plumbing:'Plumbing', hvac:'HVAC', other:'Other' };
                      return order.filter(d => groups[d]?.length).map(d => (
                    <div key={d}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-indigo-300 text-sm`}>{label[d]}</span>
                        <span className={`text-[10px] rounded px-2 py-0.5 bg-gray-700 text-gray-200`}>{groups[d].length}</span>
                      </div>
                      <ul className="space-y-1">
                        {groups[d].map((m) => (
                          <li key={m.id} className="text-xs flex items-center gap-2 text-gray-200">
                            <span className={`inline-block w-1.5 h-1.5 rounded-full bg-gray-500`} />
                            <span className="truncate">{m.name}</span>
                            <span className="ml-auto text-[10px] text-gray-400">{m.fileType || '—'}</span>
                          </li>
                        ))}
                      </ul>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}
              {/* Description and sensor stats removed per request */}
              
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
                    <span className="text-white text-sm font-bold uppercase">{project.fileType || '?'}</span>
                  </div>
                  <span className="mt-1 text-[10px] text-gray-400">{project.code || ''}</span>
                </div>
                {/* Project info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-white truncate">{project.name}</h4>
                    <span className="text-[10px] bg-gray-700 text-gray-200 rounded px-1.5 py-0.5 ml-2 whitespace-nowrap">{project.country || ''}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-[10px] text-gray-400">{project.municipality || ''}</span>
                    {project.urn && (<span className="text-[10px] text-green-400">URN</span>)}
                  </div>
                  {/* Discipline badges */}
                  {project.models && project.models.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(() => {
                        const counts = project.models!.reduce<Record<Discipline, number>>((acc: any, m) => {
                          const key = (m.discipline || 'other') as Discipline;
                          acc[key] = (acc[key] || 0) + 1;
                          return acc;
                        }, {} as Record<Discipline, number>);
                        const order: Discipline[] = ['architecture','structure','mep','electrical','plumbing','hvac','other'];
                        const label: Record<Discipline,string> = { architecture:'Arch', structure:'Str', mep:'MEP', electrical:'Elec', plumbing:'Plumb', hvac:'HVAC', other:'Other' };
                        return order.filter(d => counts[d]).map(d => (
                          <span key={d} className="text-[10px] bg-gray-700 text-gray-200 rounded px-1.5 py-0.5">{label[d]}: {counts[d]}</span>
                        ));
                      })()}
                    </div>
                  )}
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
