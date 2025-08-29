"use client";

import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { Worker, Viewer } from '@react-pdf-viewer/core';
import { highlightPlugin } from '@react-pdf-viewer/highlight';
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/highlight/lib/styles/index.css';
import { FileText, Highlighter, Underline as UnderlineIcon, MessageSquare, Download as DownloadIcon, X as CloseIcon, Undo, Redo, X } from 'lucide-react';

interface Quad {
  x: number; // 0..1
  y: number; // 0..1 from top
  width: number; // 0..1
  height: number; // 0..1
}

export type AnnotationType = 'highlight' | 'underline' | 'comment';

interface PdfAnnotation {
  _id?: string;
  pageIndex: number;
  type: AnnotationType;
  quads: Quad[];
  comment?: string;
  authorEmail?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface PdfViewerProps {
  projectId: string;
  fileId: string;
  fileName?: string;
  onClose: () => void;
}

const toolLabel: Record<AnnotationType, string> = {
  highlight: 'Highlight',
  underline: 'Underline',
  comment: 'Comment',
};

export default function PdfViewer({ projectId, fileId, fileName, onClose }: PdfViewerProps) {
  const [activeTool, setActiveTool] = useState<AnnotationType | null>(null);
  const [annotations, setAnnotations] = useState<PdfAnnotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [undoStack, setUndoStack] = useState<PdfAnnotation[][]>([]);
  const [redoStack, setRedoStack] = useState<PdfAnnotation[][]>([]);
  const [showCommentInput, setShowCommentInput] = useState<{pageIndex: number, quads: Quad[], position: {x: number, y: number}} | null>(null);
  const [commentText, setCommentText] = useState('');
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [refreshKey, setRefreshKey] = useState(0);
  const annotationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Use the fileId path route for streaming into the viewer
  const fileUrl = useMemo(() => `/api/projects/${projectId}/files/${fileId}/download`, [projectId, fileId]);
  // Provide a direct download URL (query-based) for the Download action
  const downloadUrl = useMemo(() => `/api/projects/${projectId}/files/download?fileId=${fileId}`, [projectId, fileId]);

  const loadAnnotations = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/files/${fileId}/annotations`);
      if (response.ok) {
        const data = await response.json();
        const annotationsArray = Array.isArray(data) ? data : (data.annotations || []);
        setAnnotations(annotationsArray);
      }
    } catch (error) {
      console.error('Load annotations error', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (fileId && projectId) {
      loadAnnotations();
    }
  }, [fileId, projectId]);

  const saveToUndoStack = useCallback(() => {
    setUndoStack(prev => [...prev, [...annotations]]);
    setRedoStack([]); // Clear redo stack when new action is performed
  }, [annotations]);

  const createAnnotation = async (pageIndex: number, quads: Quad[], type: AnnotationType, comment?: string) => {
    console.log(`🚀 Creating annotation: Page ${pageIndex}, Type: ${type}`);
    
    // Validate quads
    const validQuads = quads.filter(q => 
      q && typeof q.x === 'number' && typeof q.y === 'number' && 
      typeof q.width === 'number' && typeof q.height === 'number' &&
      !isNaN(q.x) && !isNaN(q.y) && !isNaN(q.width) && !isNaN(q.height) &&
      q.width > 0 && q.height > 0
    );
    
    if (validQuads.length === 0) {
      console.error('❌ No valid quads for annotation');
      return;
    }
    
    // Note: Undo snapshot is taken at the interaction handler level
    
    const data = {
      pageIndex,
      type,
      quads: validQuads,
      comment: comment || '',
      authorEmail: 'user@example.com' 
    };

    try {
      const response = await fetch(`/api/projects/${projectId}/files/${fileId}/annotations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (response.ok) {
        const newAnnotation = await response.json();
        console.log(`✅ Annotation created successfully`);
        // Remove temporary annotation and add real one
        setAnnotations(prev => {
          const withoutTemp = prev.filter(a => !a._id?.startsWith('temp-'));
          return [...withoutTemp, newAnnotation];
        });
        // Force immediate refresh
        setRefreshKey(prev => prev + 1);
      } else {
        const errorText = await response.text();
        console.error('Failed to create annotation:', response.status, errorText);
      }
    } catch (error) {
      console.error('Error creating annotation:', error);
    }
  };

  // Optimized text selection handler for real-time annotations
  const handleTextSelection = useCallback(() => {
    if (!activeTool) return; // Only handle if a tool is active
    
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return;
    }

    const selectedText = selection.toString().trim();
    if (!selectedText || selectedText.length < 2) {
      return;
    }

    // Get selection range and find page quickly
    const range = selection.getRangeAt(0);
    const rects = Array.from(range.getClientRects());
    
    if (rects.length === 0) return;

    // Find page element more efficiently
    let pageElement = range.startContainer.parentElement;
    while (pageElement && !pageElement.classList.contains('rpv-core__page-layer')) {
      pageElement = pageElement.parentElement;
    }
    
    if (!pageElement) return;

    // Get page index faster
    const pageAttr = pageElement.getAttribute('data-page-number');
    const pageIndex = pageAttr ? parseInt(pageAttr, 10) : 
                     Array.from(document.querySelectorAll('.rpv-core__page-layer')).indexOf(pageElement);
    
    if (pageIndex === -1) return;

    const pageRect = pageElement.getBoundingClientRect();
    
    // Convert rects to quads more efficiently
    const quads = rects
      .filter(rect => rect.width > 1 && rect.height > 1)
      .map(rect => ({
        x: Math.max(0, Math.min(1, (rect.left - pageRect.left) / pageRect.width)),
        y: Math.max(0, Math.min(1, (rect.top - pageRect.top) / pageRect.height)),
        width: Math.max(0.001, Math.min(1, rect.width / pageRect.width)),
        height: Math.max(0.001, Math.min(1, rect.height / pageRect.height)),
      }))
      .filter(quad => quad.width > 0 && quad.height > 0);

    if (quads.length === 0) return;

    console.log(`🎯 Quick ${activeTool} on page ${pageIndex}: "${selectedText.substring(0, 30)}..."`);
    
    // Clear any existing timeout
    if (annotationTimeoutRef.current) {
      clearTimeout(annotationTimeoutRef.current);
    }
    
    // Handle different annotation types
    if (activeTool === 'comment') {
      // Open comment dialog directly without creating a temp annotation
      const firstRect = rects[0];
      setShowCommentInput({
        pageIndex,
        quads,
        position: { x: firstRect.left + firstRect.width / 2, y: firstRect.top }
      });
    } else {
      // Immediate visual feedback - add temp annotation for highlight/underline
      const tempId = `temp-${Date.now()}-${Math.random()}`;
      const tempAnnotation: PdfAnnotation = {
        _id: tempId,
        pageIndex,
        type: activeTool,
        quads,
        comment: '',
        authorEmail: 'user@example.com'
      };

      // Take undo snapshot before applying the visual change
      saveToUndoStack();

      // Add immediately for instant feedback
      setAnnotations(prev => [...prev, tempAnnotation]);
      setRefreshKey(prev => prev + 1);

      // Debounce the save operation
      annotationTimeoutRef.current = setTimeout(() => {
        createAnnotation(pageIndex, quads, activeTool).then(() => {
          // Remove temp annotation after real one is saved
          setAnnotations(prev => prev.filter(a => a._id !== tempId));
        });
      }, 100); // Very short debounce for responsiveness
    }
    
    // Clear selection immediately for better UX
    setTimeout(() => {
      window.getSelection()?.removeAllRanges();
    }, 50);
  }, [activeTool, createAnnotation]);

  // Undo/Redo functions
  const handleUndo = useCallback(async () => {
    if (undoStack.length === 0) return;
    
    const previousState = undoStack[undoStack.length - 1];
    const currentState = [...annotations];
    
    setRedoStack(prev => [...prev, currentState]);
    setUndoStack(prev => prev.slice(0, -1));
    setAnnotations(previousState);
    setRefreshKey(prev => prev + 1);
  }, [undoStack, annotations]);

  const handleRedo = useCallback(async () => {
    if (redoStack.length === 0) return;
    
    const nextState = redoStack[redoStack.length - 1];
    const currentState = [...annotations];
    
    setUndoStack(prev => [...prev, currentState]);
    setRedoStack(prev => prev.slice(0, -1));
    setAnnotations(nextState);
    setRefreshKey(prev => prev + 1);
  }, [redoStack, annotations]);

  // Handle comment submission
  const handleCommentSubmit = useCallback(async () => {
    if (!showCommentInput || !commentText.trim()) return;
    
    // Take undo snapshot before creating a real comment annotation
    saveToUndoStack();

    await createAnnotation(
      showCommentInput.pageIndex,
      showCommentInput.quads,
      'comment',
      commentText.trim()
    );
    
    setShowCommentInput(null);
    setCommentText('');
  }, [showCommentInput, commentText, createAnnotation, saveToUndoStack]);

  // Toggle comment expansion
  const toggleCommentExpansion = useCallback((annotationId: string) => {
    setExpandedComments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(annotationId)) {
        newSet.delete(annotationId);
      } else {
        newSet.add(annotationId);
      }
      return newSet;
    });
  }, []);

  // Keyboard shortcuts for tool switching and undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'z':
            e.preventDefault();
            if (e.shiftKey) {
              handleRedo();
            } else {
              handleUndo();
            }
            break;
          case 'y':
            e.preventDefault();
            handleRedo();
            break;
          case 'h':
          case 'H':
            e.preventDefault();
            setActiveTool(prev => (prev === 'highlight' ? null : 'highlight'));
            break;
          case 'u':
          case 'U':
            e.preventDefault();
            setActiveTool(prev => (prev === 'underline' ? null : 'underline'));
            break;
          case 'c':
          case 'C':
            e.preventDefault();
            setActiveTool(prev => (prev === 'comment' ? null : 'comment'));
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  // Optimized event listeners for better performance
  useEffect(() => {
    let isSelecting = false;
    
    const handleMouseDown = () => {
      isSelecting = true;
    };
    
    const handleMouseUp = () => {
      if (isSelecting && activeTool) {
        setTimeout(handleTextSelection, 10);
      }
      isSelecting = false;
    };
    
    const handleSelectionChange = () => {
      // Only handle if we're actively selecting and have a tool
      if (isSelecting && activeTool) {
        handleTextSelection();
      }
    };
    
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('selectionchange', handleSelectionChange);
    
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('selectionchange', handleSelectionChange);
      if (annotationTimeoutRef.current) {
        clearTimeout(annotationTimeoutRef.current);
      }
    };
  }, [handleTextSelection, activeTool]);

  // Memoize page annotations to prevent unnecessary recalculations
  const annotationsByPage = useMemo(() => {
    const byPage: Record<number, PdfAnnotation[]> = {};
    if (Array.isArray(annotations)) {
      annotations.forEach(annotation => {
        const pageIndex = annotation.pageIndex >= 0 ? annotation.pageIndex : 0;
        
        if (annotation.quads && annotation.quads.length > 0) {
          if (!byPage[pageIndex]) {
            byPage[pageIndex] = [];
          }
          byPage[pageIndex].push({
            ...annotation,
            pageIndex: pageIndex
          });
        }
      });
    }
    return byPage;
  }, [annotations, refreshKey]); // Include refreshKey for force updates

  // Optimized render functions for highlight plugin
  const renderHighlightTarget = useCallback(() => <div></div>, []);
  const renderHighlightContent = useCallback(() => <div></div>, []);
  
  const renderHighlights = useCallback((props: any) => {
    const pageIndex = props.pageIndex;
    const pageAnnotations = annotationsByPage[pageIndex] || [];
    
    if (pageAnnotations.length === 0) {
      return <div key={`empty-${pageIndex}-${refreshKey}`}></div>;
    }

    return (
      <div key={`highlights-${pageIndex}-${refreshKey}`} style={{ 
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 100
      }}>
        {pageAnnotations.map((annotation, index) => (
          <React.Fragment key={`annotation-${annotation._id || index}-${pageIndex}-${refreshKey}`}>
            {annotation.quads?.map((quad, quadIndex) => {
              // Validate quad data
              if (!quad || typeof quad.x !== 'number' || typeof quad.y !== 'number' || 
                  typeof quad.width !== 'number' || typeof quad.height !== 'number' ||
                  isNaN(quad.x) || isNaN(quad.y) || isNaN(quad.width) || isNaN(quad.height) ||
                  quad.width <= 0 || quad.height <= 0) {
                return null;
              }

              const highlightStyle = {
                position: 'absolute' as const,
                left: `${Math.max(0, Math.min(100, quad.x * 100))}%`,
                top: `${Math.max(0, Math.min(100, quad.y * 100))}%`,
                width: `${Math.max(0.1, Math.min(100, quad.width * 100))}%`,
                height: `${Math.max(0.1, Math.min(100, quad.height * 100))}%`,
                pointerEvents: 'none' as const,
                zIndex: 50
              };

              if (annotation.type === 'highlight') {
                return (
                  <div
                    key={`highlight-${annotation._id}-${quadIndex}`}
                    style={{
                      ...highlightStyle,
                      backgroundColor: annotation._id?.startsWith('temp-') ? 'rgba(255, 255, 0, 0.8)' : 'rgba(255, 255, 0, 0.6)',
                      border: `2px solid ${annotation._id?.startsWith('temp-') ? 'rgba(255, 255, 0, 1)' : 'rgba(255, 255, 0, 0.8)'}`,
                      transition: annotation._id?.startsWith('temp-') ? 'none' : 'all 0.2s ease',
                    }}
                    title={annotation.comment || 'Highlight'}
                  />
                );
              } else if (annotation.type === 'underline') {
                return (
                  <div
                    key={`underline-${annotation._id}-${quadIndex}`}
                    style={{
                      ...highlightStyle,
                      borderBottom: annotation._id?.startsWith('temp-') ? '4px solid rgba(255, 0, 0, 1)' : '4px solid red',
                      height: '4px',
                      top: `${Math.max(0, Math.min(100, (quad.y + quad.height) * 100))}%`,
                      backgroundColor: annotation._id?.startsWith('temp-') ? 'rgba(255, 0, 0, 0.4)' : 'rgba(255, 0, 0, 0.2)',
                      transition: annotation._id?.startsWith('temp-') ? 'none' : 'all 0.2s ease',
                    }}
                    title={annotation.comment || 'Underline'}
                  />
                );
              } else if (annotation.type === 'comment') {
                const isExpanded = expandedComments.has(annotation._id || '');
                const isNearRightEdge = quad.x > 0.5;
                const commentPosition = isNearRightEdge ? 'right' : 'left';
                
                return (
                  <React.Fragment key={`comment-${annotation._id}-${quadIndex}`}>
                    {/* Comment highlight area */}
                    <div
                      style={{
                        ...highlightStyle,
                        backgroundColor: 'rgba(0, 100, 255, 0.4)',
                        border: '2px solid rgba(0, 100, 255, 0.8)',
                      }}
                    />
                    {/* Comment icon positioned at page edge */}
                    <div
                      style={{
                        position: 'absolute',
                        left: commentPosition === 'right' ? '95%' : '2%',
                        top: `${Math.max(2, Math.min(95, quad.y * 100))}%`,
                        width: '24px',
                        height: '24px',
                        backgroundColor: '#1f2937',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        pointerEvents: 'auto',
                        zIndex: 200,
                        boxShadow: '0 3px 8px rgba(0,0,0,0.5)',
                        border: '2px solid #374151'
                      }}
                      onClick={() => toggleCommentExpansion(annotation._id || '')}
                      title="Click to view comment"
                    >
                      <MessageSquare className="w-3 h-3 text-blue-400" />
                    </div>
                    {/* Expanded comment box */}
                    {isExpanded && (
                      <div
                        style={{
                          position: 'absolute',
                          left: commentPosition === 'right' ? '65%' : '5%',
                          top: `${Math.max(2, Math.min(75, quad.y * 100 + 5))}%`,
                          minWidth: '250px',
                          maxWidth: '300px',
                          backgroundColor: '#1f2937',
                          border: '2px solid #374151',
                          borderRadius: '12px',
                          padding: '12px',
                          boxShadow: '0 6px 20px rgba(0,0,0,0.6)',
                          pointerEvents: 'auto',
                          zIndex: 300,
                          fontSize: '13px',
                          color: '#e5e7eb'
                        }}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <span className="font-semibold text-blue-400">Comment</span>
                          <button
                            onClick={() => toggleCommentExpansion(annotation._id || '')}
                            className="text-gray-400 hover:text-gray-200 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-sm leading-relaxed">{annotation.comment || 'No comment text'}</p>
                      </div>
                    )}
                  </React.Fragment>
                );
              }
              return null;
            })}
          </React.Fragment>
        ))}
      </div>
    );
  }, [annotationsByPage, refreshKey, expandedComments, toggleCommentExpansion]);

  const highlightPluginInstance = highlightPlugin({
    renderHighlightTarget,
    renderHighlightContent,
    renderHighlights,
  });

  return (
    <div className="flex flex-col w-full h-full">
      <div className="flex items-center justify-between px-3 py-2 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-gray-300" />
          <div className="text-white text-sm font-medium truncate">{fileName || 'Document'}</div>
          {activeTool && (
            <div className="px-2 py-1 bg-blue-600 text-white text-xs rounded">
              {toolLabel[activeTool]} Mode
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* Undo/Redo buttons */}
          <button
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            className={`p-2 rounded hover:bg-gray-700 text-gray-200 ${undoStack.length === 0 ? 'opacity-50 cursor-not-allowed' : 'bg-gray-800'}`}
            title="Undo (Ctrl+Z)"
          >
            <Undo className="w-4 h-4" />
          </button>
          <button
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            className={`p-2 rounded hover:bg-gray-700 text-gray-200 ${redoStack.length === 0 ? 'opacity-50 cursor-not-allowed' : 'bg-gray-800'}`}
            title="Redo (Ctrl+Y)"
          >
            <Redo className="w-4 h-4" />
          </button>
          
          <div className="w-px h-6 bg-gray-600 mx-1"></div>
          
          {/* Annotation Tools */}
          {(['highlight', 'underline', 'comment'] as AnnotationType[]).map((t) => {
            const isActive = activeTool === t;
            const common = 'p-2 rounded hover:bg-gray-700 text-gray-200 transition-colors';
            const activeCls = isActive ? 'bg-blue-600 text-white hover:bg-blue-600' : 'bg-gray-800';
            const onClick = () => setActiveTool(prev => (prev === t ? null : t));
            return (
              <button 
                key={t} 
                onClick={onClick} 
                title={`${toolLabel[t]} (Ctrl+${t.charAt(0).toUpperCase()})`} 
                className={`${common} ${activeCls}`}
              >
                {t === 'highlight' && <Highlighter className="w-4 h-4" />}
                {t === 'underline' && <UnderlineIcon className="w-4 h-4" />}
                {t === 'comment' && <MessageSquare className="w-4 h-4" />}
              </button>
            );
          })}
          
          <div className="w-px h-6 bg-gray-600 mx-1"></div>
          
          <a
            href={downloadUrl}
            target="_blank"
            rel="noreferrer"
            className="p-2 rounded bg-green-600 text-white hover:bg-green-700"
            title="Download"
          >
            <DownloadIcon className="w-4 h-4" />
          </a>
          <button onClick={onClose} className="p-2 rounded bg-red-600 text-white hover:bg-red-700" title="Close">
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden bg-gray-800 relative">
        <Worker workerUrl={`https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js`}>
          <Viewer 
            fileUrl={fileUrl} 
            plugins={[highlightPluginInstance]} 
            onDocumentLoad={() => {
              setLoading(false);
            }} 
          />
        </Worker>
        
        {/* Comment Input Dialog */}
        {showCommentInput && (
          <div
            className="absolute bg-gray-800 border-2 border-gray-600 rounded-lg p-4 shadow-2xl z-50"
            style={{
              left: `${Math.max(20, Math.min(window.innerWidth - 320, showCommentInput.position.x - 150))}px`,
              top: `${Math.max(20, showCommentInput.position.y - 100)}px`,
              minWidth: '320px',
              boxShadow: '0 10px 30px rgba(0,0,0,0.7)'
            }}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-gray-100">Add Comment</h3>
              <button
                onClick={() => {
                  setShowCommentInput(null);
                  setCommentText('');
                }}
                className="text-gray-400 hover:text-gray-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Enter your comment..."
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-100 placeholder-gray-400"
              rows={4}
              autoFocus
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => {
                  setShowCommentInput(null);
                  setCommentText('');
                }}
                className="px-4 py-2 text-sm bg-gray-600 text-gray-200 rounded-lg hover:bg-gray-500 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCommentSubmit}
                disabled={!commentText.trim()}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Add Comment
              </button>
            </div>
          </div>
        )}
      </div>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-white">Loading PDF…</div>
      )}
    </div>
  );
}
