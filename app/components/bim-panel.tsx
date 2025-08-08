"use client";

import React, { useState, useEffect, useRef } from "react";

// Declare Autodesk global for TypeScript
declare const Autodesk: any;
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Save,
  Filter,
  Layers,
  Building,
  Box,
  Search,
  X,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { Floor2DView } from "./floor-2d-view";
import { FloorData } from "./floor-data-view";

interface BIMPanelProps {
  onBackToProjects: () => void;
  onSave2DView?: (viewName: string) => void;
  onSave3DView?: (viewName: string) => void;
  onSaveCurrentView?: (viewName: string) => void;
  onFilterObjects?: (filters: FilterOptions) => void;
  onToggleSensors?: (visible: boolean) => void;
  sensorsVisible?: boolean;
  viewer?: any; // Forge viewer instance
}

interface FilterOptions {
  name?: string;
  category?: string;
  type?: string;
}

interface SavedView {
  id: string;
  name: string;
  type: '2d' | '3d';
  timestamp: string;
  viewState?: {
    position: any;
    target: any;
    up: any;
    fov: number;
    orthoScale: number;
    isPerspective: boolean;
  };
}

export function BIMPanel({
  onBackToProjects,
  onSave2DView,
  onSave3DView,
  onSaveCurrentView,
  onFilterObjects,
  onToggleSensors,
  sensorsVisible = false,
  viewer,
}: BIMPanelProps) {
  const [activeCommand, setActiveCommand] = useState<string | null>(null);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [viewName, setViewName] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [filterName, setFilterName] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterType, setFilterType] = useState('');
  const [modelHierarchy, setModelHierarchy] = useState<any[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());
  const [isHierarchyLoaded, setIsHierarchyLoaded] = useState(false);
  // Cached property index for robust filtering across models
  const [propertyIndexReady, setPropertyIndexReady] = useState(false);
  const dbIdsCacheRef = useRef<number[]>([]);
  const propsCacheRef = useRef<Record<number, Record<string, string>>>({});
  const buildingFieldsRef = useRef<string[]>([
    'Category',
    'Element Category',
    'Type Name',
    'Family',
    'Family and Type',
    'IfcClass',
    'IFC Class',
    'Name',
    'System Type',
    'Object Type',
    'ObjectType',
    'Type'
  ]);

  // Debug: Log viewer object when it changes
  useEffect(() => {
    if (viewer) {
      console.log('[BIMPanel] Viewer object received:', {
        hasSetDisplayMode: typeof viewer.setDisplayMode === 'function',
        hasSetGhosting: typeof viewer.setGhosting === 'function',
        hasSetDisplayEdges: typeof viewer.setDisplayEdges === 'function',
        hasSetViewType: typeof viewer.setViewType === 'function',
        hasModel: !!viewer.model,
        hasImpl: !!viewer.impl,
        viewerType: viewer.constructor?.name || 'Unknown',
        hasGetSelection: typeof viewer.getSelection === 'function',
        hasShowAll: typeof viewer.showAll === 'function'
      });
      
      // Also log available methods for debugging
      if (viewer.impl) {
        console.log('[BIMPanel] Viewer.impl methods:', Object.getOwnPropertyNames(viewer.impl).filter(name => typeof viewer.impl[name] === 'function').slice(0, 15));
      }
    } else {
      console.log('[BIMPanel] No viewer object received');
    }
  }, [viewer]);

  // Load model hierarchy when viewer is ready
  useEffect(() => {
    if (viewer && viewer.model && !isHierarchyLoaded) {
      loadModelHierarchy();
    }
  }, [viewer?.model, isHierarchyLoaded]); // Only depend on model, not entire viewer object

  // Proactively build property index when user opens Filter panel
  useEffect(() => {
    const preindex = async () => {
      if (activeCommand === 'filter-objects' && viewer?.model) {
        await ensurePropertyIndex();
      }
    };
    preindex();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCommand, viewer?.model]);

  const loadModelHierarchy = async () => {
    if (!viewer || !viewer.model) {
      console.warn('Viewer or model not available');
      return;
    }
    
    console.log('🏗️ Loading complete model hierarchy from instance tree...');
    
    try {
      const model = viewer.model;
      const tree = model.getInstanceTree();
      
      if (!tree) {
        console.warn('No instance tree available');
        return;
      }
      
      // Wait for tree to be fully loaded
      await new Promise((resolve) => {
        if (tree.nodeAccess) {
          resolve(true);
        } else {
          const checkTree = () => {
            if (tree.nodeAccess) {
              resolve(true);
            } else {
              setTimeout(checkTree, 100);
            }
          };
          checkTree();
        }
      });
      
      console.log('🌳 Instance tree ready, building complete hierarchy...');
      
      // Build complete hierarchy from instance tree - collect ALL meaningful nodes
      const hierarchy: any[] = [];
      const rootId = tree.getRootId();
      const processedNodes = new Set<number>();
      
      // Function to recursively collect all nodes with meaningful names
      const collectMeaningfulNodes = (nodeId: number, depth: number = 0) => {
        if (processedNodes.has(nodeId)) return;
        processedNodes.add(nodeId);
        
        const nodeName = tree.getNodeName(nodeId);
        
        // Skip root and nodes without names, but explore deeper
        if (nodeId !== rootId && nodeName && nodeName.trim()) {
          // Count all children recursively
          let totalChildCount = 0;
          const countChildren = (id: number) => {
            tree.enumNodeChildren(id, (childId: number) => {
              totalChildCount++;
              countChildren(childId);
              return true;
            });
          };
          countChildren(nodeId);
          
          // Check if this looks like a category (has children or meaningful name)
          const categoryPatterns = /\b(wall|door|window|floor|roof|column|beam|slab|foundation|ceiling|stairs|ramp|furniture|equipment|electrical|mechanical|plumbing|structural|architectural)\w*/i;
          const isLikelyCategory = totalChildCount > 0 || categoryPatterns.test(nodeName);
          
          if (isLikelyCategory || depth <= 3) { // Include nodes up to depth 3 to catch categories
            hierarchy.push({
              id: `node-${nodeId}`,
              name: nodeName.trim(),
              dbId: nodeId,
              isCategory: true,
              selected: false,
              childCount: totalChildCount,
              depth: depth
            });
            
            console.log(`  📁 Found: ${nodeName} (${totalChildCount} children) at depth ${depth}`);
          }
        }
        
        // Continue exploring children regardless
        tree.enumNodeChildren(nodeId, (childId: number) => {
          collectMeaningfulNodes(childId, depth + 1);
          return true;
        });
      };
      
      // Start collection from root
      collectMeaningfulNodes(rootId, 0);
      
      // Sort by name for better organization
      hierarchy.sort((a, b) => {
        // Put categories with more children first
        if (a.childCount !== b.childCount) {
          return b.childCount - a.childCount;
        }
        return a.name.localeCompare(b.name);
      });
      
      console.log(`✅ Complete model hierarchy loaded: ${hierarchy.length} categories`);
      hierarchy.forEach(cat => {
        console.log(`  📁 ${cat.name} (${cat.childCount} elements) [ID: ${cat.dbId}]`);
      });
      
      setModelHierarchy(hierarchy);
      setIsHierarchyLoaded(true);
      
    } catch (error) {
      console.error('❌ Error loading model hierarchy:', error);
      
      // Fallback: create a simple placeholder hierarchy
      console.log('🔄 Creating fallback hierarchy...');
      const fallbackHierarchy = [
        {
          id: 'fallback-all',
          name: 'All Model Elements',
          dbId: -1,
          isCategory: true,
          selected: false,
          childCount: 0
        }
      ];
      
      setModelHierarchy(fallbackHierarchy);
      setIsHierarchyLoaded(true);
    }
  };


  // Load saved views from localStorage on component mount
  useEffect(() => {
    const saved = localStorage.getItem('bim-saved-views');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        console.log('Loaded saved views:', parsed);
        setSavedViews(parsed);
      } catch (error) {
        console.error('Error loading saved views:', error);
      }
    } else {
      console.log('No saved views found in localStorage');
    }
  }, []);

  // Save views to localStorage whenever savedViews changes
  useEffect(() => {
    console.log('Saving views to localStorage:', savedViews);
    localStorage.setItem('bim-saved-views', JSON.stringify(savedViews));
  }, [savedViews]);

  // Manage 2D floor plan flag based on active command
  useEffect(() => {
    if (activeCommand === '2d-views') {
      // Set flag when entering 2D views mode
      (window as any).is2DFloorPlanActive = true;
      localStorage.setItem('bim-active-command', '2d-views');
    } else {
      // Clear flag when leaving 2D views mode
      (window as any).is2DFloorPlanActive = false;
      localStorage.removeItem('bim-active-command');
      
      // When switching away from 2D view, restore full 3D model
      if (viewer && viewer.model) {
        // Small delay to ensure the command change is processed
        setTimeout(() => {
          try {
            console.log('Restoring 3D model from 2D view...');
            
            // Check if viewer has proper visibility manager before proceeding
            if (viewer.impl && viewer.impl.visibilityManager) {
              // Show all hidden elements first
              viewer.showAll();
              
              // Reset view to 3D perspective
              if (viewer.setViewType && typeof viewer.setViewType === 'function') {
                viewer.setViewType(0); // 0 = PERSPECTIVE
              }
              
              // Force 3D mode by setting camera position
              const camera = viewer.getCamera();
              if (viewer.model && viewer.model.getBoundingBox) {
                const bounds = viewer.model.getBoundingBox();
                const center = bounds.getCenter();
                
                // Set camera to 3D perspective position
                const distance = bounds.getBoundingSphere().radius * 2;
              }
              
              // Reset camera to show the entire model
              viewer.fitToView();
              
              // Reset any display modes that might have been set
              if (viewer.setDisplayMode && typeof viewer.setDisplayMode === 'function') {
                viewer.setDisplayMode(0); // 0 = SOLID mode
              }
              
              // Force a complete redraw with all buffers
              if (viewer.impl) {
                if (viewer.impl.invalidate && typeof viewer.impl.invalidate === 'function') {
                  viewer.impl.invalidate(true, true, true);
                }
                if (viewer.impl.sceneUpdated && typeof viewer.impl.sceneUpdated === 'function') {
                  viewer.impl.sceneUpdated(true);
                }
              }
              
              console.log('Successfully restored 3D view after leaving 2D mode');
            } else {
              console.warn('Viewer visibility manager not ready, using basic restoration');
              // Basic restoration without showAll
              if (viewer.fitToView && typeof viewer.fitToView === 'function') {
                viewer.fitToView();
              }
            }
          } catch (error) {
            console.error('Error restoring 3D view:', error);
            // Fallback: just try fitToView if available
            try {
              if (viewer.fitToView && typeof viewer.fitToView === 'function') {
                viewer.fitToView();
              }
            } catch (fallbackError) {
              console.warn('Fallback restoration also failed:', fallbackError);
            }
          }
        }, 150); // Slightly longer delay for better reliability
      }
    }

    // Cleanup on unmount
    return () => {
      (window as any).is2DFloorPlanActive = false;
      localStorage.removeItem('bim-active-command');
    };
  }, [activeCommand, viewer]);

  const handleSaveView = () => {
    if (!viewName.trim() || !viewer) {
      setSaveMessage('Please enter a view name');
      setTimeout(() => setSaveMessage(''), 3000);
      return;
    }
    
    try {
      // Get current camera state from Forge Viewer
      const camera = viewer.getCamera();
      
      // Convert THREE.js vectors to simple objects for serialization
      const viewState = {
        position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
        target: { x: camera.target.x, y: camera.target.y, z: camera.target.z },
        up: { x: camera.up.x, y: camera.up.y, z: camera.up.z },
        fov: camera.fov,
        orthoScale: camera.orthoScale || 1,
        isPerspective: camera.isPerspective !== false // Default to true if undefined
      };
      
      console.log('Saving view state:', viewState);
      
      const newView: SavedView = {
        id: `view-${Date.now()}`,
        name: viewName.trim(),
        type: '3d',
        timestamp: new Date().toISOString(),
        viewState: viewState
      };
      
      // Update state with the new view
      setSavedViews(prev => {
        const updated = [newView, ...prev];
        console.log('Updated saved views:', updated);
        return updated;
      });
      
      onSaveCurrentView?.(viewName);
      
      // Show success message
      setSaveMessage(`✅ View "${viewName}" saved successfully!`);
      setViewName('');
      
      // Clear message after 3 seconds
      setTimeout(() => setSaveMessage(''), 3000);
      
    } catch (error) {
      console.error('Error saving view:', error);
      setSaveMessage('❌ Error saving view. Please check console for details.');
      setTimeout(() => setSaveMessage(''), 3000);
    }
  };

  // Build a property index for all nodes (leaf nodes) with bulk properties
  const ensurePropertyIndex = async () => {
    if (!viewer || !viewer.model) return false;
    if (propertyIndexReady && dbIdsCacheRef.current.length > 0) {
      console.log('[Filter] Using cached property index');
      return true;
    }

    try {
      const model = viewer.model;
      const tree = model.getInstanceTree();
      if (!tree) return false;

      // Collect ALL node ids to maximize match coverage
      const allDbIds: number[] = [];
      const visited = new Set<number>();
      const rootId = tree.getRootId();
      const walk = (id: number) => {
        if (visited.has(id)) return;
        visited.add(id);
        allDbIds.push(id);
        tree.enumNodeChildren(id, (childId: number) => {
          walk(childId);
          return true;
        });
      };
      walk(rootId);

      // Fetch bulk properties in batches
      // Fetch ALL properties so vendor-specific names are covered
      const batchSize = 2000;
      const propsCache: Record<number, Record<string, string>> = {};
      for (let i = 0; i < allDbIds.length; i += batchSize) {
        const batch = allDbIds.slice(i, i + batchSize);
        const results = await new Promise<any[]>((resolve, reject) => {
          // Passing null for attributes requests all properties
          model.getBulkProperties(batch, null, (data: any[]) => resolve(data), reject);
        });
        results.forEach((item) => {
          const map: Record<string, string> = {};
          (item.properties || []).forEach((p: any) => {
            if (typeof p.displayName === 'string' && p.displayName) {
              map[p.displayName] = String(p.displayValue ?? '');
            }
          });
          // Always include name field as well
          if (typeof item.name === 'string') map['__nodeName'] = item.name;
          propsCache[item.dbId] = map;
        });
      }

      dbIdsCacheRef.current = allDbIds;
      propsCacheRef.current = propsCache;
      setPropertyIndexReady(true);
      console.log(`[Filter] Indexed ${allDbIds.length} nodes with ALL properties.`);
      return true;
    } catch (e) {
      console.error('[Filter] Failed to build property index:', e);
      setPropertyIndexReady(false);
      return false;
    }
  };

  const norm = (s?: string) => (s || '').toLowerCase().trim();

  // Category keywords across languages/vendors
  const categoryKeywords: Record<string, string[]> = {
    walls: ['wall', 'walls', 'parete', 'muro', 'muri', 'ifcwall'],
    doors: ['door', 'porta', 'porte', 'ifcdoor'],
    windows: ['window', 'finestra', 'finestre', 'ifcwindow'],
    floors: ['floor', 'pavimento', 'slab', 'ifcfloorslab', 'ifcslab', 'piano'],
    roofs: ['roof', 'tetto', 'copertura', 'ifcroof'],
    structural: ['struct', 'trave', 'pilastro', 'beam', 'column', 'ifccolumn', 'ifcbeam', 'brace']
  };

  const matchCategory = (props: Record<string, string>, cat: string) => {
    const keys = categoryKeywords[cat] || [cat];
    const v = [
      props['Category'],
      props['Element Category'],
      props['IfcClass'],
      props['IFC Class'],
      props['Type Name'],
      props['Family and Type'],
      props['Family'],
      props['System Type'],
      props['Object Type'],
      props['ObjectType'],
      props['__nodeName']
    ].map(norm).join(' | ');
    return keys.some(k => v.includes(norm(k)));
  };

  const matchText = (props: Record<string, string>, keyCandidates: string[], q: string) => {
    const qn = norm(q);
    if (!qn) return true;
    for (const key of keyCandidates) {
      const val = props[key];
      if (val && norm(val).includes(qn)) return true;
    }
    return false;
  };

  // Fallback: use Forge viewer.search to find dbIds by keywords
  const searchDbIdsForKeywords = async (keywords: string[], attributeNames?: string[]) => {
    if (!viewer) return [] as number[];
    const found = new Set<number>();
    for (const kw of keywords) {
      const res: number[] = await new Promise((resolve) => {
        viewer.search(
          kw,
          (dbIds: number[]) => resolve(dbIds || []),
          () => resolve([]),
          attributeNames
        );
      });
      res.forEach(id => found.add(id));
    }
    return Array.from(found);
  };

  const handleApplyFilters = async () => {
    if (!viewer || !viewer.model) {
      console.warn('Viewer not ready for filtering');
      return;
    }
    const ok = await ensurePropertyIndex();
    if (!ok) {
      console.warn('Property index not available; aborting filter');
      return;
    }

    const nameQ = filterName;
    const catQ = filterCategory; // expects one of the predefined values
    const typeQ = filterType;

    // If nothing entered, show all
    if (!nameQ && !catQ && !typeQ) {
      // Clear isolate state and show all
      try {
        if (viewer.isolate) viewer.isolate([]);
      } catch {}
      if (viewer.showAll) viewer.showAll();
      if (viewer.clearSelection) viewer.clearSelection();
      return;
    }

    const fieldsForName = ['Name', '__nodeName', 'Family and Type', 'Type Name'];
    const fieldsForType = ['Type Name', 'Family and Type', 'Object Type', 'ObjectType', 'Type'];

    const matched: number[] = [];
    const propsCache = propsCacheRef.current;
    for (const dbId of dbIdsCacheRef.current) {
      const props = propsCache[dbId] || {};
      const catOk = catQ ? matchCategory(props, catQ) : true;
      if (!catOk) continue;
      const nameOk = nameQ ? matchText(props, fieldsForName, nameQ) : true;
      if (!nameOk) continue;
      const typeOk = typeQ ? matchText(props, fieldsForType, typeQ) : true;
      if (!typeOk) continue;
      matched.push(dbId);
    }

    if (matched.length === 0) {
      console.warn('[Filter] Property-index match returned 0. Trying search fallback...');
      let searchKeywords: string[] = [];
      if (catQ) searchKeywords = categoryKeywords[catQ] || [catQ];
      // Include text queries as well
      if (nameQ) searchKeywords.push(nameQ);
      if (typeQ) searchKeywords.push(typeQ);
      // Search across common attributes and globally
      let found: number[] = [];
      if (searchKeywords.length > 0) {
        found = await searchDbIdsForKeywords(searchKeywords, [
          'Category', 'Element Category', 'Type Name', 'Family and Type', 'Family', 'Name', 'Object Type', 'ObjectType'
        ]);
        if (found.length === 0) {
          found = await searchDbIdsForKeywords(searchKeywords); // global search
        }
      }
      if (found.length === 0) {
        console.warn('[Filter] Fallback search also found 0. Restoring view.');
        viewer.showAll?.();
        viewer.clearSelection?.();
        return;
      }
      matched.push(...found);
    }

    // De-duplicate and sanitize
    const uniqueMatched = Array.from(new Set(matched.filter((n) => Number.isFinite(n))));
    if (uniqueMatched.length === 0) {
      viewer.showAll?.();
      viewer.clearSelection?.();
      return;
    }

    // Apply by isolating matched nodes for performance, with robust fallback
    let isolated = false;
    try {
      if (viewer.setGhosting) viewer.setGhosting(false);
      viewer.isolate(uniqueMatched);
      isolated = true;
    } catch (e) {
      console.warn('[Filter] isolate threw, will fallback:', e);
    }
    if (!isolated) {
      try {
        viewer.hideAll?.();
        uniqueMatched.forEach((id) => viewer.show?.(id));
      } catch (e2) {
        console.error('[Filter] hide/show fallback failed:', e2);
      }
    }
    try {
      viewer.fitToView?.(uniqueMatched);
      viewer.select?.(uniqueMatched);
    } catch {}
    console.log(`[Filter] Applied. Showing ${uniqueMatched.length} elements. Fallback used: ${!isolated}`);
  };

  const handleClearFilters = () => {
    setFilterName('');
    setFilterCategory('');
    setFilterType('');
    
    if (viewer) {
      viewer.showAll();
      viewer.clearSelection();
      console.log('Cleared all filters and showing all model elements');
    }
  };

  // Tree node functions
  const toggleNodeSelection = (node: any) => {
    const newSelected = new Set(selectedNodes);
    const nodeKey = node.id;
    
    if (newSelected.has(nodeKey)) {
      newSelected.delete(nodeKey);
    } else {
      newSelected.add(nodeKey);
    }
    
    setSelectedNodes(newSelected);
    
    // Apply filter based on selection
    applyHierarchyFilter(newSelected);
  };
  
  const applyHierarchyFilter = (selectedNodeIds: Set<string>) => {
    if (!viewer || !viewer.model) {
      console.warn('Viewer or model not available for filtering');
      return;
    }

    console.log('🔍 Applying hierarchy filter...');
    
    try {
      if (selectedNodeIds.size === 0) {
        // No selection - show all objects
        viewer.showAll();
        viewer.clearSelection();
        console.log('✅ Showing all objects');
        return;
      }
      
      const model = viewer.model;
      const tree = model.getInstanceTree();
      
      if (!tree) {
        console.warn('No instance tree available for filtering');
        return;
      }
      
      // Get selected categories from model hierarchy
      const selectedCategories = Array.from(selectedNodeIds).map(id => {
        const category = modelHierarchy.find(cat => cat.id === id);
        return category;
      }).filter(Boolean);
      
      if (selectedCategories.length === 0) {
        console.warn('⚠️ No valid categories selected');
        return;
      }
      
      console.log('📂 Selected categories:', selectedCategories.map(c => c.name));
      
      // Collect all dbIds that should be visible
      const visibleDbIds: number[] = [];
      
      selectedCategories.forEach(category => {
        if (category.dbId && category.dbId !== -1) {
          // Add the category node itself
          visibleDbIds.push(category.dbId);
          
          // Add all children recursively
          const collectChildren = (nodeId: number) => {
            tree.enumNodeChildren(nodeId, (childId: number) => {
              visibleDbIds.push(childId);
              collectChildren(childId); // Recursively collect grandchildren
              return true;
            });
          };
          
          collectChildren(category.dbId);
        }
      });
      
      // Remove duplicates
      const uniqueVisibleDbIds = [...new Set(visibleDbIds)];
      
      console.log(`📊 Found ${uniqueVisibleDbIds.length} objects to show`);
      
      if (uniqueVisibleDbIds.length > 0) {
        // Hide all objects first
        viewer.hideAll();
        
        // Show only selected objects
        viewer.show(uniqueVisibleDbIds);
        
        // Focus on visible objects
        viewer.fitToView(uniqueVisibleDbIds);
        
        // Highlight the visible objects
        viewer.select(uniqueVisibleDbIds);
        
        console.log(`✅ Applied filter: showing ${uniqueVisibleDbIds.length} objects`);
      } else {
        console.warn('⚠️ No objects found for selected categories');
        viewer.showAll();
      }
      
    } catch (error) {
      console.error('❌ Filter error:', error);
      // Restore all objects on error
      if (viewer && viewer.showAll) {
        viewer.showAll();
      }
    }
  };

  const handleRestoreView = (view: SavedView) => {
    if (!viewer || !view.viewState) {
      console.error('Viewer not ready or invalid view state');
      return;
    }
    
    try {
      console.log('Restoring view:', view);
      const { viewState } = view;
      
      // Make sure we're in 3D view when restoring a view
      if (activeCommand === '2d-views') {
        setActiveCommand(null); // Exit 2D view mode
      }
      
      // Small delay to ensure view mode change takes effect
      setTimeout(() => {
        try {
          const camera = viewer.getCamera();
          
          // Restore camera position and settings
          if (viewState.position) {
            camera.position.set(
              viewState.position.x || 0,
              viewState.position.y || 0,
              viewState.position.z || 0
            );
          }
          
          if (viewState.target) {
            camera.target.set(
              viewState.target.x || 0,
              viewState.target.y || 0,
              viewState.target.z || 0
            );
          }
          
          if (viewState.up) {
            camera.up.set(
              viewState.up.x || 0,
              viewState.up.y || 0,
              viewState.up.z || 1 // Default to Z-up
            );
          }
          
          // Restore camera settings
          if (viewState.fov !== undefined) camera.fov = viewState.fov;
          if (viewState.orthoScale !== undefined) camera.orthoScale = viewState.orthoScale;
          if (viewState.isPerspective !== undefined) camera.isPerspective = viewState.isPerspective;
          
          // Apply the camera changes
          viewer.navigation.setCamera(camera);
          viewer.setViewType(camera.isPerspective ? 0 : 1); // 0 = PERSPECTIVE, 1 = ORTHOGRAPHIC
          
          // Force a complete redraw
          viewer.impl.invalidate(true, true, true);
          
          console.log('View restored successfully');
          
        } catch (error) {
          console.error('Error during view restoration:', error);
        }
      }, 100);
      
      console.log(`Restored view: ${view.name}`);
    } catch (error) {
      console.error('Error restoring view:', error);
    }
  };

  // Render tree node component
  const renderTreeNode = (node: any, depth: number = 0) => {
    const nodeKey = node.id;
    const isSelected = selectedNodes.has(nodeKey);
    
    return (
      <div key={nodeKey} className="select-none">
        <div 
          className={`flex items-center py-2 px-2 rounded cursor-pointer hover:bg-gray-700 ${
            isSelected ? 'bg-blue-600 text-white' : 'text-gray-300'
          }`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => toggleNodeSelection(node)}
            className="mr-3 accent-blue-500"
          />
          
          <div className="flex items-center gap-2 flex-1">
            {node.isCategory ? (
              <Building className="w-4 h-4 text-yellow-500" />
            ) : (
              <Box className="w-4 h-4 text-gray-400" />
            )}
            
            <span className="text-sm font-medium flex-1" title={node.name}>
              {node.name}
            </span>
            
            {node.childCount !== undefined && node.childCount > 0 && (
              <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded">
                {node.childCount}
              </span>
            )}
            
            {node.depth !== undefined && (
              <span className="text-xs text-gray-500">
                L{node.depth}
              </span>
            )}
            
            {node.dbId && node.dbId !== -1 && (
              <span className="text-xs text-gray-500">
                {node.dbId}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderCommandContent = () => {
    switch (activeCommand) {
      case "2d-views":
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-white">
              <Layers className="h-5 w-5" />
              2D Floor Views
            </h3>
            
            <Floor2DView 
              viewer={viewer}
              onFloorChanged={(floor: FloorData | null) => {
                console.log('Floor changed in BIM panel:', floor);
                // Additional floor change handling can be added here
              }}
              onSensorClicked={(sensorId: string) => {
                console.log('Sensor clicked in 2D view:', sensorId);
                // Handle sensor selection in 2D view
              }}
            />
          </div>
        );

      case "3d-views":
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-white">
              <Box className="h-5 w-5" />
              Saved 3D Views
            </h3>
            
            {savedViews.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Box className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                <p className="text-gray-300">No saved views</p>
                <p className="text-sm text-gray-500">Use "Save View" to capture your current camera position</p>
              </div>
            ) : (
              <div className="space-y-2">
                {savedViews.map((view) => (
                  <div key={view.id} className="bg-gray-800 border border-gray-700 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-white">{view.name}</h4>
                      <span className="text-xs text-gray-400">
                        {new Date(view.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">
                        {new Date(view.timestamp).toLocaleTimeString()}
                      </span>
                      <button
                        onClick={() => handleRestoreView(view)}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1 rounded transition-colors"
                      >
                        Restore View
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case "save-view":
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-white">
              <Save className="h-5 w-5" />
              Save Current View
            </h3>
            
            {saveMessage && (
              <div className={`p-3 rounded-lg ${
                saveMessage.includes('Error') 
                  ? 'bg-red-900/50 border border-red-700 text-red-300' 
                  : 'bg-green-900/50 border border-green-700 text-green-300'
              }`}>
                <div className="flex items-center gap-2">
                  {saveMessage.includes('Error') ? (
                    <AlertCircle className="h-4 w-4" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                  {saveMessage}
                </div>
              </div>
            )}
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  View Name
                </label>
                <input
                  type="text"
                  value={viewName}
                  onChange={(e) => setViewName(e.target.value)}
                  placeholder="Enter view name..."
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white placeholder-gray-400"
                />
              </div>
              
              <button
                onClick={handleSaveView}
                disabled={!viewName.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Save Current View
              </button>
            </div>
          </div>
        );

      case "filter-objects":
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-white">
              <Filter className="h-5 w-5" />
              Filter Objects
            </h3>

            {/* Category chips */}
            <div className="flex flex-wrap gap-2">
              {[
                { key: '', label: 'All' },
                { key: 'walls', label: 'Walls' },
                { key: 'doors', label: 'Doors' },
                { key: 'windows', label: 'Windows' },
                { key: 'floors', label: 'Floors' },
                { key: 'roofs', label: 'Roofs' },
                { key: 'structural', label: 'Structural' }
              ].map(chip => (
                <button
                  key={chip.key || 'all'}
                  onClick={() => setFilterCategory(chip.key)}
                  className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                    filterCategory === chip.key
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-gray-800 text-gray-200 border-gray-700 hover:bg-gray-700'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {/* Text filters */}
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Name contains</label>
                <input
                  type="text"
                  value={filterName}
                  onChange={(e) => setFilterName(e.target.value)}
                  placeholder="e.g. Generic, Curtain, Slab..."
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white placeholder-gray-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Type contains</label>
                <input
                  type="text"
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  placeholder="e.g. Basic Wall, Single-Flush, Window Family..."
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white placeholder-gray-400"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={handleApplyFilters}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Apply Filters
              </button>
              <button
                onClick={() => {
                  handleClearFilters();
                  if (viewer) viewer.showAll();
                }}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Show All
              </button>
            </div>
          </div>
        );

      case "view-sensors":
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-white">
              <Eye className="h-5 w-5" />
              View Sensors
            </h3>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg border border-gray-700">
                <div>
                  <div className="font-medium text-white">Sensor Visibility</div>
                </div>
                <button
                  onClick={() => onToggleSensors?.(!sensorsVisible)}
                  className={`p-2 rounded-lg transition-colors ${
                    sensorsVisible 
                      ? 'bg-green-600 text-white hover:bg-green-700' 
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {sensorsVisible ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="text-center py-8">
            <Building className="w-16 h-16 mx-auto mb-4 text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-300 mb-2">BIM Tools</h3>
            <p className="text-gray-500">Select a command from above to get started</p>
          </div>
        );
    }
  };

  return (
    <div className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-800 flex flex-col items-center">
        <h2 className="text-xl font-bold text-white mb-3">BIM</h2>
        <button
          onClick={onBackToProjects}
          className="flex items-center gap-2 px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors w-full justify-center"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Projects
        </button>
      </div>

      {/* Command Buttons */}
      <div className="p-4 border-b border-gray-800">
        <div className="grid grid-cols-1 gap-2">
          <button
            onClick={() => setActiveCommand(activeCommand === '2d-views' ? null : '2d-views')}
            className={`flex items-center gap-2 p-2 rounded-lg text-left transition-colors ${
              activeCommand === '2d-views'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-800 text-gray-200 hover:bg-gray-700 border border-gray-700'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span className="font-medium text-sm">2D Views</span>
          </button>

          <button
            onClick={() => setActiveCommand(activeCommand === '3d-views' ? null : '3d-views')}
            className={`flex items-center gap-2 p-2 rounded-lg text-left transition-colors ${
              activeCommand === '3d-views'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-800 text-gray-200 hover:bg-gray-700 border border-gray-700'
            }`}
          >
            <Box className="h-4 w-4" />
            <span className="font-medium text-sm">3D Views</span>
          </button>

          <button
            onClick={() => setActiveCommand(activeCommand === 'save-view' ? null : 'save-view')}
            className={`flex items-center gap-2 p-2 rounded-lg text-left transition-colors ${
              activeCommand === 'save-view'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-800 text-gray-200 hover:bg-gray-700 border border-gray-700'
            }`}
          >
            <Save className="h-4 w-4" />
            <span className="font-medium text-sm">Save View</span>
          </button>

          <button
            onClick={() => setActiveCommand(activeCommand === 'filter-objects' ? null : 'filter-objects')}
            className={`flex items-center gap-2 p-2 rounded-lg text-left transition-colors ${
              activeCommand === 'filter-objects'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-800 text-gray-200 hover:bg-gray-700 border border-gray-700'
            }`}
          >
            <Filter className="h-4 w-4" />
            <span className="font-medium text-sm">Filter Objects</span>
          </button>

          <button
            onClick={() => setActiveCommand(activeCommand === 'view-sensors' ? null : 'view-sensors')}
            className={`flex items-center gap-2 p-2 rounded-lg text-left transition-colors ${
              activeCommand === 'view-sensors'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-800 text-gray-200 hover:bg-gray-700 border border-gray-700'
            }`}
          >
            <Eye className="h-4 w-4" />
            <span className="font-medium text-sm">View Sensors</span>
          </button>
        </div>
      </div>

      {/* Command Content */}
      <div className="flex-1 p-4 overflow-y-auto">
        {renderCommandContent()}
      </div>
    </div>
  );
}
