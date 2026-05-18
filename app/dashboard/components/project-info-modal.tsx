"use client";

import React, { useState } from "react";
import { X, MapPin, Building, User, Calendar, FileText, Edit3, Save, AlertCircle } from "lucide-react";

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

interface ProjectInfoModalProps {
  project: Project | null;
  isOpen: boolean;
  onClose: () => void;
  onSave?: (updatedProject: Project) => void;
  isEditable?: boolean;
  onProjectUpdated?: (updatedProject: Project) => void;
}

export function ProjectInfoModal({ project, isOpen, onClose, onSave, isEditable = true, onProjectUpdated }: ProjectInfoModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedProject, setEditedProject] = useState<Project | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  React.useEffect(() => {
    if (project) {
      setEditedProject({ ...project });
    }
  }, [project]);

  if (!isOpen || !project) return null;

  const handleEdit = () => {
    setIsEditing(true);
    setEditedProject({ ...project });
  };

  const handleSave = async () => {
    if (!editedProject) return;
    
    setIsSaving(true);
    setSaveError(null);
    
    try {
      // Call API to update project
      const response = await fetch(`/api/projects/${editedProject.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editedProject.name,
          description: editedProject.description,
          code: editedProject.code,
          country: editedProject.country,
          municipality: editedProject.municipality,
          address: editedProject.address,
          cadastral: editedProject.cadastral,
          company: editedProject.company,
          clientName: editedProject.clientName,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update project');
      }
      
      const result = await response.json();
      
      // Update local state
      if (onSave) {
        onSave(editedProject);
      }
      
      // Notify parent component
      if (onProjectUpdated) {
        onProjectUpdated(editedProject);
      }
      
      setIsEditing(false);
      console.log('Project updated successfully:', result.message);
      
    } catch (error: any) {
      console.error('Error updating project:', error);
      setSaveError(error.message || 'Failed to update project');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedProject({ ...project });
  };

  const handleInputChange = (field: keyof Project, value: string | number) => {
    if (editedProject) {
      setEditedProject({
        ...editedProject,
        [field]: value
      });
    }
  };

  const currentProject = isEditing ? editedProject : project;

  return (
    <div className="fixed inset-0 backdrop-blur-sm bg-background/40 flex items-center justify-center z-50">
      <div className="bg-card rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <Building className="w-6 h-6 text-blue-400" />
            <h2 className="text-xl font-semibold text-foreground">Project Information</h2>
          </div>
          <div className="flex items-center gap-2">
            {saveError && (
              <div className="flex items-center gap-2 px-3 py-1 bg-red-900/30 border border-red-600/30 rounded-md">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <span className="text-sm text-red-300">{saveError}</span>
              </div>
            )}
            {isEditable && !isEditing && (
              <button
                onClick={handleEdit}
                className="flex items-center gap-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-foreground rounded-md transition-colors"
              >
                <Edit3 className="w-4 h-4" />
                <span>Edit</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 flex-1 overflow-y-auto">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-foreground border-b border-border pb-2">Basic Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">Project Name</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={currentProject?.name || ''}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="w-full bg-muted border border-border rounded-md px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-foreground bg-muted px-3 py-2 rounded-md">{currentProject?.name || 'N/A'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">Project Code</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={currentProject?.code || ''}
                    onChange={(e) => handleInputChange('code', e.target.value)}
                    className="w-full bg-muted border border-border rounded-md px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-foreground bg-muted px-3 py-2 rounded-md">{currentProject?.code || 'N/A'}</p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-muted-foreground mb-2">Description</label>
                {isEditing ? (
                  <textarea
                    value={currentProject?.description || ''}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    rows={3}
                    className="w-full bg-muted border border-border rounded-md px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-foreground bg-muted px-3 py-2 rounded-md min-h-[80px]">{currentProject?.description || 'No description available'}</p>
                )}
              </div>
            </div>
          </div>

          {/* Location Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-foreground border-b border-border pb-2 flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Location Information
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">Country</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={currentProject?.country || ''}
                    onChange={(e) => handleInputChange('country', e.target.value)}
                    className="w-full bg-muted border border-border rounded-md px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-foreground bg-muted px-3 py-2 rounded-md">{currentProject?.country || 'N/A'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">Municipality</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={currentProject?.municipality || ''}
                    onChange={(e) => handleInputChange('municipality', e.target.value)}
                    className="w-full bg-muted border border-border rounded-md px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-foreground bg-muted px-3 py-2 rounded-md">{currentProject?.municipality || 'N/A'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">Address</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={currentProject?.address || ''}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    className="w-full bg-muted border border-border rounded-md px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-foreground bg-muted px-3 py-2 rounded-md">{currentProject?.address || 'N/A'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">Cadastral Reference</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={currentProject?.cadastral || ''}
                    onChange={(e) => handleInputChange('cadastral', e.target.value)}
                    className="w-full bg-muted border border-border rounded-md px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-foreground bg-muted px-3 py-2 rounded-md">{currentProject?.cadastral || 'N/A'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">Latitude</label>
                <div className="relative">
                  <p className="text-muted-foreground bg-muted px-3 py-2 rounded-md">{currentProject?.lat || 'N/A'}</p>
                  <span className="absolute right-2 top-2 text-xs text-muted-foreground">Read-only</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">Longitude</label>
                <div className="relative">
                  <p className="text-muted-foreground bg-muted px-3 py-2 rounded-md">{currentProject?.lng || 'N/A'}</p>
                  <span className="absolute right-2 top-2 text-xs text-muted-foreground">Read-only</span>
                </div>
              </div>
            </div>
          </div>

          {/* Project Details */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-foreground border-b border-border pb-2 flex items-center gap-2">
              <User className="w-5 h-5" />
              Project Details
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">Company</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={currentProject?.company || ''}
                    onChange={(e) => handleInputChange('company', e.target.value)}
                    className="w-full bg-muted border border-border rounded-md px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-foreground bg-muted px-3 py-2 rounded-md">{currentProject?.company || 'N/A'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">Client Name</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={currentProject?.clientName || ''}
                    onChange={(e) => handleInputChange('clientName', e.target.value)}
                    className="w-full bg-muted border border-border rounded-md px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-foreground bg-muted px-3 py-2 rounded-md">{currentProject?.clientName || 'N/A'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">File Type</label>
                <div className="relative">
                  <p className="text-muted-foreground bg-muted px-3 py-2 rounded-md">{currentProject?.fileType || 'N/A'}</p>
                  <span className="absolute right-2 top-2 text-xs text-muted-foreground">Read-only</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">Project ID</label>
                <div className="relative">
                  <p className="text-muted-foreground bg-muted px-3 py-2 rounded-md font-mono text-sm">{currentProject?.id || 'N/A'}</p>
                  <span className="absolute right-2 top-2 text-xs text-muted-foreground">Read-only</span>
                </div>
              </div>
            </div>
          </div>

          {/* Technical Information */}
          {currentProject?.urn && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-foreground border-b border-border pb-2 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Technical Information
              </h3>
              
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">Model URN</label>
                <div className="relative">
                  <p className="text-muted-foreground bg-muted px-3 py-2 rounded-md font-mono text-sm break-all">{currentProject.urn}</p>
                  <span className="absolute right-2 top-2 text-xs text-muted-foreground">Read-only</span>
                </div>
              </div>
            </div>
          )}

          {/* Action buttons (non-sticky) */}
          {isEditing && (
            <div className="pt-4 border-t border-border flex items-center justify-end gap-2">
              <button
                onClick={handleCancel}
                className="px-4 py-2 bg-muted hover:bg-muted text-foreground rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-muted disabled:cursor-not-allowed text-foreground rounded-md transition-colors"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Saving...' : 'Save'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
