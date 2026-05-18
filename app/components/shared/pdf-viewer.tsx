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
  const [showCommentInput, setShowCommentInput] = useState<{pageIndex: number, quads: Quad[], position: {x: number, y: number}, annotationId?: string} | null>(null);
  const [commentText, setCommentText] = useState('');
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [refreshKey, setRefreshKey] = useState(0);
  const annotationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Use the fileId path route for streaming into the viewer
  const fileUrl = useMemo(() => `/api/projects/${projectId}/files/${fileId}/download`, [projectId, fileId]);
  // Use annotated download URL for download action
  const downloadUrl = useMemo(() => `/api/projects/${projectId}/files/${fileId}/download-annotated`, [projectId, fileId]);

  const loadAnnotations = async () => {
    try {
      const url = `/api/projects/${projectId}/files/${fileId}/annotations`;
      console.log(`📍 Loading annotations from: ${url}`);
      
      const response = await fetch(url);
      console.log(`📥 Load response status: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`📦 Load response data:`, data);
        const annotationsArray = Array.isArray(data) ? data : (data.annotations || []);
        console.log(`🔄 Setting annotations:`, annotationsArray);
        setAnnotations(annotationsArray);
      } else {
        const errorText = await response.text();
        console.error('❌ Failed to load annotations:', response.status, errorText);
      }
    } catch (error) {
      console.error('❌ Load annotations error', error);
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
    console.log(`📊 Project ID: ${projectId}, File ID: ${fileId}`);
    
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

    console.log(`📤 Sending annotation data:`, data);

    try {
      const url = `/api/projects/${projectId}/files/${fileId}/annotations`;
      console.log(`📍 POST URL: ${url}`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      console.log(`📥 Response status: ${response.status}`);

      if (response.ok) {
        const payload = await response.json();
        console.log(`📦 Response payload:`, payload);
        const newAnnotation = payload?.annotation || payload; // API returns { annotation }, fallback for safety
        console.log(`✅ Annotation created successfully:`, newAnnotation);
        // Remove temporary annotation and add real one
        setAnnotations(prev => {
          const withoutTemp = prev.filter(a => !a._id?.startsWith('temp-'));
          const newState = newAnnotation ? [...withoutTemp, newAnnotation] : withoutTemp;
          console.log(`🔄 Updated annotations state:`, newState);
          return newState;
        });
        // Force immediate refresh
        setRefreshKey(prev => prev + 1);
      } else {
        const errorText = await response.text();
        console.error('❌ Failed to create annotation:', response.status, errorText);
      }
    } catch (error) {
      console.error('❌ Error creating annotation:', error);
    }
  };

  // Check if quads overlap with existing annotations
  const checkOverlap = useCallback((newQuads: Quad[], pageIndex: number, type: AnnotationType) => {
    const pageAnnotations = annotations.filter(a => a.pageIndex === pageIndex && a.type === type);
    
    for (const annotation of pageAnnotations) {
      for (const existingQuad of annotation.quads || []) {
        for (const newQuad of newQuads) {
          // Check if rectangles overlap
          const overlapX = Math.max(0, Math.min(existingQuad.x + existingQuad.width, newQuad.x + newQuad.width) - Math.max(existingQuad.x, newQuad.x));
          const overlapY = Math.max(0, Math.min(existingQuad.y + existingQuad.height, newQuad.y + newQuad.height) - Math.max(existingQuad.y, newQuad.y));
          const overlapArea = overlapX * overlapY;
          const newQuadArea = newQuad.width * newQuad.height;
          
          // If more than 50% of new quad overlaps with existing, consider it duplicate
          if (overlapArea / newQuadArea > 0.5) {
            return true;
          }
        }
      }
    }
    return false;
  }, [annotations]);

  // Optimized text selection handler for real-time annotations
  const handleTextSelection = useCallback(() => {
    if (!activeTool) return; // Only handle if a tool is active
    
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return;
    }

    const selectedText = selection.toString().trim();
    if (!selectedText || selectedText.length < 1) {
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
      .filter(rect => rect.width > 0.5 && rect.height > 0.5)
      .map(rect => ({
        x: Math.max(0, Math.min(1, (rect.left - pageRect.left) / pageRect.width)),
        y: Math.max(0, Math.min(1, (rect.top - pageRect.top) / pageRect.height)),
        width: Math.max(0.001, Math.min(1, rect.width / pageRect.width)),
        height: Math.max(0.001, Math.min(1, rect.height / pageRect.height)),
      }))
      .filter(quad => quad.width > 0 && quad.height > 0);

    if (quads.length === 0) return;

    // Check for overlaps before creating annotation
    if (activeTool !== 'comment' && checkOverlap(quads, pageIndex, activeTool)) {
      console.log(`⚠️ Skipping duplicate ${activeTool} on page ${pageIndex}`);
      // Clear selection and return
      setTimeout(() => {
        window.getSelection()?.removeAllRanges();
      }, 100);
      return;
    }

    console.log(`🎯 Quick ${activeTool} on page ${pageIndex}: "${selectedText.substring(0, 30)}..."`);
    
    // Handle different annotation types
    if (activeTool === 'comment') {
      // Open comment dialog directly without creating a temp annotation
      const firstRect = rects[0];
      setShowCommentInput({
        pageIndex,
        quads,
        position: { x: firstRect.left + firstRect.width / 2, y: firstRect.top }
      });
      // Don't clear selection for comments
    } else {
      // Take undo snapshot before applying the visual change
      saveToUndoStack();

      // Create annotation immediately - no temp annotation needed
      createAnnotation(pageIndex, quads, activeTool);
      
      // Clear selection only after annotation is created
      setTimeout(() => {
        window.getSelection()?.removeAllRanges();
      }, 100);
    }
  }, [activeTool, createAnnotation, saveToUndoStack, checkOverlap]);

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
  const updateAnnotation = async (annotationId: string, comment: string) => {
    try {
      const url = `/api/projects/${projectId}/files/${fileId}/annotations`;
      const data = { id: annotationId, comment };
      console.log(`📍 PUT URL: ${url}`);
      console.log(`📤 Update data:`, data);
      
      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      console.log(`📥 Update response status: ${response.status}`);
      
      if (response.ok) {
        const payload = await response.json();
        console.log(`📦 Update response payload:`, payload);
        const updatedAnnotation = payload?.annotation || payload;
        setAnnotations(prev => 
          prev.map(a => a._id === annotationId ? updatedAnnotation : a)
        );
        setRefreshKey(k => k + 1);
        console.log('✅ Annotation updated successfully');
      } else {
        const errorText = await response.text();
        console.error('❌ Failed to update annotation:', response.status, errorText);
      }
    } catch (error) {
      console.error('❌ Error updating annotation:', error);
    }
  };

  const handleCommentSubmit = useCallback(async () => {
    if (!showCommentInput || !commentText.trim()) return;

    saveToUndoStack();

    // If an annotationId is present, we're updating an existing annotation's comment
    if (showCommentInput.annotationId) {
      await updateAnnotation(showCommentInput.annotationId, commentText.trim());
    } else {
      // Otherwise, create a new annotation of type 'comment'
      await createAnnotation(
        showCommentInput.pageIndex,
        showCommentInput.quads,
        'comment',
        commentText.trim()
      );
    }
    
    setShowCommentInput(null);
    setCommentText('');
  }, [showCommentInput, commentText, createAnnotation, updateAnnotation, saveToUndoStack]);

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
    let selectionTimeout: NodeJS.Timeout | null = null;
    
    const handleMouseDown = (e: MouseEvent) => {
      // Only track if clicking inside PDF viewer area
      const target = e.target as Element;
      if (target.closest('.rpv-core__page-layer')) {
        isSelecting = true;
      }
    };
    
    const handleMouseUp = (e: MouseEvent) => {
      if (isSelecting && activeTool) {
        // Clear any existing timeout
        if (selectionTimeout) {
          clearTimeout(selectionTimeout);
        }
        
        // Delay to allow selection to complete
        selectionTimeout = setTimeout(() => {
          handleTextSelection();
          isSelecting = false;
        }, 50);
      } else {
        isSelecting = false;
      }
    };
    
    // Remove problematic selectionchange listener that interferes with text selection
    
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mouseup', handleMouseUp);
      if (selectionTimeout) {
        clearTimeout(selectionTimeout);
      }
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
                    onClick={() => {
                      setShowCommentInput({
                        pageIndex: annotation.pageIndex,
                        quads: annotation.quads,
                        position: { x: quad.x * 100, y: quad.y * 100 },
                        annotationId: annotation._id
                      });
                      setCommentText(annotation.comment || '');
                    }}
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
                    onClick={() => {
                      setShowCommentInput({
                        pageIndex: annotation.pageIndex,
                        quads: annotation.quads,
                        position: { x: quad.x * 100, y: quad.y * 100 },
                        annotationId: annotation._id
                      });
                      setCommentText(annotation.comment || '');
                    }}
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
                            className="text-muted-foreground hover:text-foreground transition-colors"
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
      <div className="flex items-center justify-between px-4 py-3 bg-card border-b border-border">
        <div className="flex items-center gap-3 min-w-0">
          <FileText className="w-5 h-5 text-blue-400" />
          <div className="text-foreground text-sm font-medium truncate">{fileName || 'Document'}</div>
        </div>
        <div className="flex items-center gap-2">
          {/* Undo/Redo buttons */}
          <button
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            className={`p-2 rounded-md hover:bg-muted text-muted-foreground transition-colors ${undoStack.length === 0 ? 'opacity-40 cursor-not-allowed' : ''}`}
            title="Undo (Ctrl+Z)"
          >
            <Undo className="w-4 h-4" />
          </button>
          <button
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            className={`p-2 rounded-md hover:bg-muted text-muted-foreground transition-colors ${redoStack.length === 0 ? 'opacity-40 cursor-not-allowed' : ''}`}
            title="Redo (Ctrl+Y)"
          >
            <Redo className="w-4 h-4" />
          </button>
          
          <div className="w-px h-5 bg-muted mx-2"></div>
          
          {/* Annotation Tools */}
          {(['highlight', 'underline', 'comment'] as AnnotationType[]).map((t) => {
            const isActive = activeTool === t;
            const onClick = () => setActiveTool(prev => (prev === t ? null : t));
            return (
              <button 
                key={t} 
                onClick={onClick} 
                title={`${toolLabel[t]} (Ctrl+${t.charAt(0).toUpperCase()})`} 
                className={`p-2 rounded-md transition-colors ${
                  isActive 
                    ? 'bg-blue-600 text-foreground hover:bg-blue-700' 
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {t === 'highlight' && <Highlighter className="w-4 h-4" />}
                {t === 'underline' && <UnderlineIcon className="w-4 h-4" />}
                {t === 'comment' && <MessageSquare className="w-4 h-4" />}
              </button>
            );
          })}
          
          <div className="w-px h-5 bg-muted mx-2"></div>
          
          <a
            href={downloadUrl}
            target="_blank"
            rel="noreferrer"
            className="p-2 rounded-md bg-green-600 text-foreground hover:bg-green-700 transition-colors"
            title="Download Annotated PDF"
          >
            <DownloadIcon className="w-4 h-4" />
          </a>
          <button 
            onClick={onClose} 
            className="p-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" 
            title="Close"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden bg-card relative">
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
            className="absolute bg-card border-2 border-border rounded-lg p-4 shadow-2xl z-50"
            style={{
              left: `${Math.max(20, Math.min(window.innerWidth - 320, showCommentInput.position.x - 150))}px`,
              top: `${Math.max(20, showCommentInput.position.y - 100)}px`,
              minWidth: '320px',
              boxShadow: '0 10px 30px rgba(0,0,0,0.7)'
            }}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-foreground">Add Comment</h3>
              <button
                onClick={() => {
                  setShowCommentInput(null);
                  setCommentText('');
                }}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Enter your comment..."
              className="w-full p-3 bg-muted border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-foreground placeholder-muted-foreground"
              rows={4}
              autoFocus
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => {
                  setShowCommentInput(null);
                  setCommentText('');
                }}
                className="px-4 py-2 text-sm bg-muted text-foreground rounded-lg hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCommentSubmit}
                disabled={!commentText.trim()}
                className="px-4 py-2 text-sm bg-blue-600 text-foreground rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Add Comment
              </button>
            </div>
          </div>
        )}
      </div>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-foreground">Loading PDF…</div>
      )}
    </div>
  );
}
