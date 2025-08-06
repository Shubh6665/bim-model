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
}

export function ProjectInfoModal({ project, isOpen, onClose, onSave, isEditable = false }: ProjectInfoModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedProject, setEditedProject] = useState<Project | null>(null);

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

  const handleSave = () => {
    if (editedProject && onSave) {
      onSave(editedProject);
      setIsEditing(false);
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <Building className="w-6 h-6 text-blue-400" />
            <h2 className="text-xl font-semibold text-white">Project Information</h2>
          </div>
          <div className="flex items-center gap-2">
            {!isEditable && (
              <div className="flex items-center gap-2 px-3 py-1 bg-yellow-900/30 border border-yellow-600/30 rounded-md">
                <AlertCircle className="w-4 h-4 text-yellow-400" />
                <span className="text-sm text-yellow-300">Read Only</span>
              </div>
            )}
            {isEditable && !isEditing && (
              <button
                onClick={handleEdit}
                className="flex items-center gap-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
              >
                <Edit3 className="w-4 h-4" />
                <span>Edit</span>
              </button>
            )}
            {isEditing && (
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  className="flex items-center gap-2 px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors"
                >
                  <Save className="w-4 h-4" />
                  <span>Save</span>
                </button>
                <button
                  onClick={handleCancel}
                  className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded-md transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-white border-b border-gray-700 pb-2">Basic Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Project Name</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={currentProject?.name || ''}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-white bg-gray-700 px-3 py-2 rounded-md">{currentProject?.name || 'N/A'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Project Code</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={currentProject?.code || ''}
                    onChange={(e) => handleInputChange('code', e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-white bg-gray-700 px-3 py-2 rounded-md">{currentProject?.code || 'N/A'}</p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                {isEditing ? (
                  <textarea
                    value={currentProject?.description || ''}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    rows={3}
                    className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-white bg-gray-700 px-3 py-2 rounded-md min-h-[80px]">{currentProject?.description || 'No description available'}</p>
                )}
              </div>
            </div>
          </div>

          {/* Location Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-white border-b border-gray-700 pb-2 flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Location Information
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Country</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={currentProject?.country || ''}
                    onChange={(e) => handleInputChange('country', e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-white bg-gray-700 px-3 py-2 rounded-md">{currentProject?.country || 'N/A'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Municipality</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={currentProject?.municipality || ''}
                    onChange={(e) => handleInputChange('municipality', e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-white bg-gray-700 px-3 py-2 rounded-md">{currentProject?.municipality || 'N/A'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Address</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={currentProject?.address || ''}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-white bg-gray-700 px-3 py-2 rounded-md">{currentProject?.address || 'N/A'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Cadastral Reference</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={currentProject?.cadastral || ''}
                    onChange={(e) => handleInputChange('cadastral', e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-white bg-gray-700 px-3 py-2 rounded-md">{currentProject?.cadastral || 'N/A'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Latitude</label>
                {isEditing ? (
                  <input
                    type="number"
                    step="any"
                    value={currentProject?.lat || ''}
                    onChange={(e) => handleInputChange('lat', parseFloat(e.target.value) || 0)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-white bg-gray-700 px-3 py-2 rounded-md">{currentProject?.lat || 'N/A'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Longitude</label>
                {isEditing ? (
                  <input
                    type="number"
                    step="any"
                    value={currentProject?.lng || ''}
                    onChange={(e) => handleInputChange('lng', parseFloat(e.target.value) || 0)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-white bg-gray-700 px-3 py-2 rounded-md">{currentProject?.lng || 'N/A'}</p>
                )}
              </div>
            </div>
          </div>

          {/* Project Details */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-white border-b border-gray-700 pb-2 flex items-center gap-2">
              <User className="w-5 h-5" />
              Project Details
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Company</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={currentProject?.company || ''}
                    onChange={(e) => handleInputChange('company', e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-white bg-gray-700 px-3 py-2 rounded-md">{currentProject?.company || 'N/A'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Client Name</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={currentProject?.clientName || ''}
                    onChange={(e) => handleInputChange('clientName', e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-white bg-gray-700 px-3 py-2 rounded-md">{currentProject?.clientName || 'N/A'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">File Type</label>
                <p className="text-white bg-gray-700 px-3 py-2 rounded-md">{currentProject?.fileType || 'N/A'}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Project ID</label>
                <p className="text-gray-400 bg-gray-700 px-3 py-2 rounded-md font-mono text-sm">{currentProject?.id || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Technical Information */}
          {currentProject?.urn && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-white border-b border-gray-700 pb-2 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Technical Information
              </h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Model URN</label>
                <p className="text-gray-400 bg-gray-700 px-3 py-2 rounded-md font-mono text-sm break-all">{currentProject.urn}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
