'use client';

import React, { useState, useEffect } from 'react';
import { X, Download, FileText, Image, File } from 'lucide-react';

interface FileViewerProps {
  file: {
    id: string;
    name: string;
    type: string;
    size: number;
    uploadedAt: string;
  } | null;
  projectId: string;
  onClose: () => void;
}

const FileViewer: React.FC<FileViewerProps> = ({ file, projectId, onClose }) => {
  const [fileUrl, setFileUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (file) {
      loadFile();
    }
  }, [file]);

  const loadFile = async () => {
    if (!file) return;
    
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`/api/projects/${projectId}/files/${file.id}/download`);
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setFileUrl(url);
      } else {
        setError('Failed to load file');
      }
    } catch (err) {
      setError('Error loading file');
      console.error('File load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const downloadFile = async () => {
    if (!file || !fileUrl) return;
    
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getFileExtension = (filename: string) => {
    return filename.split('.').pop()?.toLowerCase() || '';
  };

  const renderFileContent = () => {
    if (!file || !fileUrl) return null;
    
    const extension = getFileExtension(file.name);
    
    switch (extension) {
      case 'pdf':
        return (
          <iframe
            src={fileUrl}
            className="w-full h-full border-0"
            title={file.name}
          />
        );
      
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'bmp':
      case 'webp':
      case 'svg':
        return (
          <div className="flex items-center justify-center h-full bg-gray-50">
            <img
              src={fileUrl}
              alt={file.name}
              className="max-w-full max-h-full object-contain"
            />
          </div>
        );
      
      case 'txt':
      case 'md':
      case 'json':
      case 'xml':
      case 'csv':
        return (
          <iframe
            src={fileUrl}
            className="w-full h-full border-0 bg-white"
            title={file.name}
          />
        );
      
      case 'dwg':
      case 'dxf':
        return (
          <div className="flex flex-col items-center justify-center h-full bg-gray-50">
            <FileText className="w-16 h-16 text-blue-500 mb-4" />
            <p className="text-lg font-medium text-gray-700 mb-2">{file.name}</p>
            <p className="text-sm text-gray-500 mb-4">CAD File - {extension.toUpperCase()}</p>
            <button
              onClick={downloadFile}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download to View
            </button>
          </div>
        );
      
      case 'docx':
      case 'doc':
        return (
          <div className="flex flex-col items-center justify-center h-full bg-gray-50">
            <FileText className="w-16 h-16 text-blue-600 mb-4" />
            <p className="text-lg font-medium text-gray-700 mb-2">{file.name}</p>
            <p className="text-sm text-gray-500 mb-4">Word Document</p>
            <button
              onClick={downloadFile}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download to View
            </button>
          </div>
        );
      
      case 'xlsx':
      case 'xls':
        return (
          <div className="flex flex-col items-center justify-center h-full bg-gray-50">
            <FileText className="w-16 h-16 text-green-600 mb-4" />
            <p className="text-lg font-medium text-gray-700 mb-2">{file.name}</p>
            <p className="text-sm text-gray-500 mb-4">Excel Spreadsheet</p>
            <button
              onClick={downloadFile}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download to View
            </button>
          </div>
        );
      
      default:
        return (
          <div className="flex flex-col items-center justify-center h-full bg-gray-50">
            <File className="w-16 h-16 text-gray-500 mb-4" />
            <p className="text-lg font-medium text-gray-700 mb-2">{file.name}</p>
            <p className="text-sm text-gray-500 mb-4">
              {extension ? extension.toUpperCase() + ' File' : 'Unknown File Type'}
            </p>
            <button
              onClick={downloadFile}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download File
            </button>
          </div>
        );
    }
  };

  if (!file) return null;

  return (
    <div className="absolute inset-0 bg-white z-10 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gray-50">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-blue-500" />
          <div>
            <h3 className="font-medium text-gray-900">{file.name}</h3>
            <p className="text-sm text-gray-500">
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={downloadFile}
            disabled={!fileUrl}
            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded"
            title="Download"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
              <p className="text-gray-600">Loading file...</p>
            </div>
          </div>
        )}
        
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-white">
            <div className="text-center">
              <File className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <p className="text-red-600 mb-2">Failed to load file</p>
              <p className="text-gray-500 text-sm">{error}</p>
            </div>
          </div>
        )}
        
        {!loading && !error && renderFileContent()}
      </div>
    </div>
  );
};

export default FileViewer;
