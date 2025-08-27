'use client';

import React, { useState, useEffect } from 'react';
import { X, Download, FileText, Image, File } from 'lucide-react';
import ForgeViewer from './forge-viewer';

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
  const [blobRef, setBlobRef] = useState<Blob | null>(null);

  // DWG/DXF via Forge Viewer
  const [forgeUrn, setForgeUrn] = useState<string>('');
  const [forgeToken, setForgeToken] = useState<string>('');
  const [forgeLoading, setForgeLoading] = useState<boolean>(false);
  const [forgeError, setForgeError] = useState<string>('');

  // Excel preview (SheetJS)
  const [excelHtml, setExcelHtml] = useState<string>('');
  const [excelSheets, setExcelSheets] = useState<string[]>([]);
  const [activeSheet, setActiveSheet] = useState<string>('');
  const [excelLoading, setExcelLoading] = useState<boolean>(false);
  const [excelError, setExcelError] = useState<string>('');

  useEffect(() => {
    if (file) {
      loadFile();
    }
  }, [file]);

  const loadFile = async () => {
    if (!file) return;
    
    // Reset state for new file
    setBlobRef(null);
    setForgeUrn('');
    setForgeToken('');
    setForgeError('');
    setForgeLoading(false);
    setExcelHtml('');
    setExcelSheets([]);
    setActiveSheet('');
    setExcelError('');
    setExcelLoading(false);
    setFileUrl(''); // Crucial: Reset URL to prevent using stale blob link

    setLoading(true);
    setError('');
    
    try {
      // Add cache-busting parameter to force fresh request
      const cacheBuster = Date.now();
      const response = await fetch(`/api/projects/${projectId}/files/${file.id}/download?t=${cacheBuster}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setBlobRef(blob);
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

  // Build an absolute URL for external viewers (Office/ShareCAD)
  const buildAbsoluteFileUrl = () => {
    if (!file) return '';
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      // Use the streaming GridFS endpoint to serve inline content
      const path = `/api/projects/${projectId}/files/${file.id}/download`;
      return origin ? `${origin}${path}` : path;
    } catch {
      return '';
    }
  };

  const renderFileContent = () => {
    if (!file) return null;
    
    const extension = getFileExtension(file.name);
    
    const absoluteUrl = buildAbsoluteFileUrl();

    switch (extension) {
      case 'pdf':
        // Use direct API endpoint with toolbar hidden for clean presentation
        const pdfUrl = `/api/projects/${projectId}/files/${file.id}/download?t=${Date.now()}`;
        return (
          <iframe
            src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
            className="w-full h-full border-0"
            title={file.name}
            style={{ background: 'white' }}
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
        // Autodesk Forge Viewer integration using cached/transient URN
        // Lazy-fetch URN and token when needed
        if (!forgeUrn && !forgeLoading && !forgeError) {
          setForgeLoading(true);
          (async () => {
            try {
              const urnRes = await fetch(`/api/projects/${projectId}/files/${file.id}/forge-urn`);
              if (!urnRes.ok) throw new Error(await urnRes.text());
              const urnData = await urnRes.json();
              setForgeUrn(urnData.urn);

              const tokenRes = await fetch('/api/forge/token');
              if (!tokenRes.ok) throw new Error(await tokenRes.text());
              const tokenData = await tokenRes.json();
              setForgeToken(tokenData.access_token || tokenData.token || tokenData);
            } catch (e: any) {
              console.error('Forge init failed:', e);
              setForgeError(e?.message || 'Forge initialization failed');
            } finally {
              setForgeLoading(false);
            }
          })();
        }

        if (forgeLoading) {
          return (
            <div className="absolute inset-0 flex items-center justify-center bg-white">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                <p className="text-gray-600">Preparing DWG preview…</p>
              </div>
            </div>
          );
        }

        if (forgeError) {
          return (
            <div className="flex flex-col items-center justify-center h-full bg-gray-50">
              <FileText className="w-16 h-16 text-blue-500 mb-4" />
              <p className="text-lg font-medium text-gray-700 mb-2">{file.name}</p>
              <p className="text-sm text-gray-500 mb-4">{forgeError}</p>
              <button
                onClick={downloadFile}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download to View
              </button>
            </div>
          );
        }

        if (forgeUrn && forgeToken) {
          return (
            <div className="w-full h-full">
              <ForgeViewer
                accessToken={forgeToken}
                urn={forgeUrn}
                activePanel="database"
              />
            </div>
          );
        }

        // Initial placeholder while fetching
        return (
          <div className="absolute inset-0 flex items-center justify-center bg-white">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
              <p className="text-gray-600">Loading DWG…</p>
            </div>
          </div>
        );
      
      case 'docx':
      case 'doc':
        // Use Microsoft Office Online viewer
        return absoluteUrl ? (
          <iframe
            src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(absoluteUrl)}`}
            className="w-full h-full border-0 bg-white"
            title={`Word Viewer - ${file.name}`}
          />
        ) : (
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
        // Local render using SheetJS
        const buildTableHtml = (rows: any[][]) => {
          const escape = (v: any) =>
            String(v ?? '')
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;');
          const header = rows[0] || [];
          const body = rows.slice(1);
          const ths = header
            .map((h) => `<th class=\"px-3 py-2 border border-gray-300 bg-gray-100 sticky top-0 z-10 text-left text-gray-800 text-sm\">${escape(h)}</th>`) 
            .join('');
          const trs = body
            .map((r, i) =>
              `<tr class=\"odd:bg-white even:bg-gray-50\">${r
                .map((c) => `<td class=\"px-3 py-2 border border-gray-200 text-sm text-gray-800\">${escape(c)}</td>`) 
                .join('')}</tr>`
            )
            .join('');
          return `<table class=\"min-w-full border-collapse\"><thead class=\"shadow-sm\"><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
        };

        if (!excelHtml && !excelLoading && !excelError && blobRef) {
          setExcelLoading(true);
          // Add delay to ensure blob is fully ready
          setTimeout(async () => {
            try {
              const XLSXMod = await import('xlsx');
              const XLSX: any = (XLSXMod as any).default || XLSXMod;
              
              // Wait for blob to be fully ready
              await new Promise(resolve => setTimeout(resolve, 100));
              const arrayBuffer = await blobRef.arrayBuffer();
              
              // Enhanced parsing options for better compatibility
              const workbook = XLSX.read(arrayBuffer, {
                type: 'array',
                cellDates: true,
                cellNF: false,
                cellText: false,
                codepage: 65001,
                raw: false,
                dateNF: 'yyyy-mm-dd',
                cellStyles: true,
                sheetStubs: false,
                defval: ''
              });
              
              const names: string[] = workbook.SheetNames || [];
              if (names.length === 0) throw new Error('No sheets found in Excel file');
              
              setExcelSheets(names);
              const first = names[0];
              setActiveSheet(first || '');
              const ws = first ? workbook.Sheets[first] : null;
              if (!ws) throw new Error('No sheet found');
              
              // Enhanced row parsing with better empty cell handling
              const rows: any[][] = XLSX.utils.sheet_to_json(ws, { 
                header: 1, 
                blankrows: false,
                defval: '',
                raw: false,
                dateNF: 'yyyy-mm-dd'
              });
              
              // Filter out completely empty rows
              const filteredRows = rows.filter(row => 
                row.some(cell => cell !== null && cell !== undefined && cell !== '')
              );
              
              if (filteredRows.length === 0) throw new Error('Sheet appears to be empty');
              
              const html = buildTableHtml(filteredRows);
              setExcelHtml(html);
            } catch (e: any) {
              console.error('Excel parse failed:', e);
              setExcelError(e?.message || 'Failed to parse Excel file');
            } finally {
              setExcelLoading(false);
            }
          }, 200);
        }

        if (excelLoading) {
          return (
            <div className="absolute inset-0 flex items-center justify-center bg-white">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto mb-2"></div>
                <p className="text-gray-600">Parsing Excel…</p>
              </div>
            </div>
          );
        }

        if (excelError) {
          return (
            <div className="flex flex-col items-center justify-center h-full bg-gray-50">
              <FileText className="w-16 h-16 text-green-600 mb-4" />
              <p className="text-lg font-medium text-gray-700 mb-2">{file.name}</p>
              <p className="text-sm text-gray-500 mb-4">{excelError}</p>
              <button
                onClick={downloadFile}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
            </div>
          );
        }

        if (excelHtml) {
          return (
            <div className="w-full h-full flex flex-col bg-white min-h-0">
              {/* Sheet tabs */}
              {excelSheets.length > 1 && (
                <div className="border-b px-3 py-2 bg-gray-50 flex gap-2 text-sm">
                  {excelSheets.map((s) => (
                    <button
                      key={s}
                      onClick={async () => {
                        try {
                          setExcelLoading(true);
                          const XLSXMod = await import('xlsx');
                          const XLSX: any = (XLSXMod as any).default || XLSXMod;
                          
                          // Wait for blob stability
                          await new Promise(resolve => setTimeout(resolve, 50));
                          const ab = await (blobRef as Blob).arrayBuffer();
                          
                          const wb = XLSX.read(ab, { 
                            type: 'array', 
                            cellDates: true, 
                            cellNF: false,
                            cellText: false,
                            codepage: 65001, 
                            raw: false,
                            dateNF: 'yyyy-mm-dd',
                            cellStyles: true,
                            sheetStubs: false,
                            defval: ''
                          });
                          
                          const ws = wb.Sheets[s];
                          if (!ws) throw new Error(`Sheet "${s}" not found`);
                          
                          const rows: any[][] = XLSX.utils.sheet_to_json(ws, { 
                            header: 1, 
                            blankrows: false,
                            defval: '',
                            raw: false,
                            dateNF: 'yyyy-mm-dd'
                          });
                          
                          // Filter out completely empty rows
                          const filteredRows = rows.filter(row => 
                            row.some(cell => cell !== null && cell !== undefined && cell !== '')
                          );
                          
                          if (filteredRows.length === 0) throw new Error(`Sheet "${s}" appears to be empty`);
                          
                          setExcelHtml(buildTableHtml(filteredRows));
                          setActiveSheet(s);
                        } catch (e: any) {
                          console.error('Sheet switch failed:', e);
                          setExcelError(e?.message || `Failed to load sheet "${s}"`);
                        } finally {
                          setExcelLoading(false);
                        }
                      }}
                      className={`px-3 py-1 rounded transition-colors ${activeSheet === s ? 'bg-white border border-gray-300 text-gray-900 font-medium' : 'text-gray-600 hover:bg-white/70 border border-transparent'}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
              {/* Table */}
              <div className="flex-1 overflow-auto min-h-0">
                <div className="p-3">
                  <div className="min-w-full" dangerouslySetInnerHTML={{ __html: excelHtml }} />
                </div>
              </div>
            </div>
          );
        }

        return (
          <div className="absolute inset-0 flex items-center justify-center bg-white">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto mb-2"></div>
              <p className="text-gray-600">Loading Excel…</p>
            </div>
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
    <div className="absolute inset-0 bg-white z-10 flex flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gray-50">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-blue-500" />
          <div>
            <h3 className="font-medium text-gray-900">{file.name}</h3>
            {Number.isFinite(file.size as number) && file.size > 0 ? (
              <p className="text-sm text-gray-500">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={downloadFile}
            disabled={!fileUrl}
            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
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
      <div className="flex-1 relative min-h-0">
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
