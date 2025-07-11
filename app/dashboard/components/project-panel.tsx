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
} from "lucide-react";

interface ProjectFile {
  id: string;
  name: string;
  type: string;
  size: string;
  modified: string;
  isRVT?: boolean;
}

interface ProjectPanelProps {
  onFileSelect: (file: ProjectFile | null) => void;
  selectedFile: ProjectFile | null;
}

export function ProjectPanel({
  onFileSelect,
  selectedFile,
}: ProjectPanelProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [files, setFiles] = useState<ProjectFile[]>([
    {
      id: "1",
      name: "SAM0001-ADD-SA1067001-ZZ-M3-S-S00001.rvt",
      type: "RVT",
      size: "8.8 MB",
      modified: "2 hours ago",
      isRVT: true,
    },
    {
      id: "2",
      name: "Building_Floor_Plan.dwg",
      type: "DWG",
      size: "1.2 MB",
      modified: "1 day ago",
    },
    {
      id: "3",
      name: "Structural_Model.ifc",
      type: "IFC",
      size: "15.6 MB",
      modified: "3 days ago",
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
        setFiles((prev) => [newFile, ...prev]);
      });
    }
  };

  const handleFileClick = (file: ProjectFile) => {
    onFileSelect(file);
  };

  const handleViewFile = (file: ProjectFile) => {
    onFileSelect(file);
  };

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
        <File className="w-4 h-4 text-gray-300" />
      </div>
    );
  };

  const getFileStatus = (file: ProjectFile) => {
    if (file.isRVT) {
      return (
        <div className="flex items-center text-xs text-orange-400">
          <CheckCircle className="w-3 h-3 mr-1" />
          <span>Ready for Forge</span>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">Project Files</h2>

        {/* Upload Section */}
        <div className="mb-4">
          <label className="flex items-center justify-center w-full p-3 border-2 border-dashed border-gray-600 rounded-lg cursor-pointer hover:border-blue-500 transition-colors">
            <input
              type="file"
              multiple
              accept=".rvt,.dwg,.ifc,.obj,.fbx,.gltf,.glb,.3dm,.skp"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Upload className="w-5 h-5 text-gray-400 mr-2" />
            <span className="text-sm text-gray-400">Upload BIM Files</span>
          </label>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search files..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* File List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-2">
          {filteredFiles.map((file) => (
            <div
              key={file.id}
              onClick={() => handleFileClick(file)}
              className={`flex items-center p-3 rounded-lg cursor-pointer transition-colors mb-1 ${
                selectedFile?.id === file.id
                  ? "bg-blue-600 text-white"
                  : "hover:bg-gray-700 text-gray-300"
              }`}
            >
              <div className="flex-shrink-0 mr-3">
                {getFileIcon(file)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                </div>
                <div className="flex items-center text-xs opacity-75">
                  <span className="bg-gray-600 px-1.5 py-0.5 rounded text-xs mr-2">
                    {file.type}
                  </span>
                  <span>{file.size}</span>
                  <span className="mx-1">•</span>
                  <span>{file.modified}</span>
                </div>
                {getFileStatus(file)}
              </div>

              <div className="flex items-center ml-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleViewFile(file);
                  }}
                  className="p-1 hover:bg-gray-600 rounded transition-colors"
                  title="View file"
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredFiles.length === 0 && (
          <div className="p-8 text-center text-gray-400">
            <Folder className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No files found</p>
            <p className="text-sm mt-1">Upload some BIM files to get started</p>
          </div>
        )}
      </div>

      {/* Info Panel */}
      {selectedFile && (
        <div className="p-4 border-t border-gray-700 bg-gray-850">
          <h3 className="text-sm font-semibold text-white mb-2">
            File Details
          </h3>
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
              <span className="text-gray-300">Modified:</span>{" "}
              {selectedFile.modified}
            </div>
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
        </div>
      )}
    </div>
  );
}
