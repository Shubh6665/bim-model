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
import type { ProjectModel } from "@/app/types/projects";

interface BIMPanelProps {
  onBackToProjects: () => void;
  onSave2DView?: (viewName: string) => void;
  onSave3DView?: (viewName: string) => void;
  onSaveCurrentView?: (viewName: string) => void;
  onFilterObjects?: (filters: FilterOptions) => void;
  onToggleSensors?: (visible: boolean) => void;
  sensorsVisible?: boolean;
  viewer?: any; // Forge viewer instance
  // Models toggle props
  models?: ProjectModel[];
  enabledModelIds?: Set<string>;
  onToggleModel?: (modelId: string) => void;
  onRestoreEnabledModelsVisibility?: (viewer: any) => void;
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

export const BIMPanel: React.FC<BIMPanelProps> = ({
  onBackToProjects,
  onSave2DView,
  onSave3DView,
  onSaveCurrentView,
  onFilterObjects,
  onToggleSensors,
  sensorsVisible,
  viewer,
  models,
  enabledModelIds,
  onToggleModel,
  onRestoreEnabledModelsVisibility,
}) => {
  const [activeCommand, setActiveCommand] = useState<string | null>("models");
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [viewName, setViewName] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [filterName, setFilterName] = useState('');
  const [filterCategory, setFilterCategory] = useState(''); // type filtering removed
  const [filterCategory2, setFilterCategory2] = useState(''); // optional second category (AND)
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState<boolean>(false);
  const [groupedByType, setGroupedByType] = useState<Record<string, { label: string; dbId: number }[]>>({});
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [modelHierarchy, setModelHierarchy] = useState<any[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());
  const [isHierarchyLoaded, setIsHierarchyLoaded] = useState(false);
  // In-memory index for the CURRENT model only (reset on model change)
  const [propertyIndexReady, setPropertyIndexReady] = useState(false);
  // Single-model legacy caches (kept for backward compatibility)
  const dbIdsCacheRef = useRef<number[]>([]);
  const propsCacheRef = useRef<Record<number, Record<string, string>>>({});

  // Multi-model aware caches
  // modelId -> dbIds[]
  const modelDbIdsRef = useRef<Map<number, number[]>>(new Map());
  // modelId -> { dbId -> props }
  const modelPropsRef = useRef<Map<number, Record<number, Record<string, string>>>>(new Map());
  // modelId -> Set(categories)
  const modelCategoriesRef = useRef<Map<number, Set<string>>>(new Map());
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

  // --- Safe viewer helpers -------------------------------------------------
  const safeRestoreAllVisibility = (v: any) => {
    try {
      if (!v) return;
      const model = v.model;
      const vm = v.impl?.visibilityManager;
      // Restore fragments visibility
      if (model?.getFragmentList) {
        const fl = model.getFragmentList();
        const n = fl.getCount?.() ?? 0;
        for (let i = 0; i < n; i++) fl.setVisibility(i, true);
      }
      // Restore node-off flags if possible
      if (model?.getObjectTree && vm && typeof vm.setNodeOff === 'function') {
        model.getObjectTree((tree: any) => {
          if (!tree) return;
          const root = tree.getRootId?.() ?? 1;
          const walk = (id: number) => { try { vm.setNodeOff(id, false); } catch {}; tree.enumNodeChildren(id, (c: number) => walk(c)); };
          walk(root);
          v.impl?.invalidate?.(true);
        });
      } else {
        v.impl?.invalidate?.(true);
      }
    } catch (e) {
      console.warn('[BIMPanel] safeRestoreAllVisibility failed', e);
    }
  };

  const safeFitToView = (v: any, ids?: number[] | undefined) => {
    try {
      if (!v) return;
      if (typeof v.fitToView === 'function') {
        if (Array.isArray(ids) && ids.length) v.fitToView(ids);
        else v.fitToView();
        return;
      }
      // Fallback: zoom to model bounding box
      const bbox = v.model?.getBoundingBox?.();
      if (bbox && v.navigation?.fitBounds) {
        v.navigation.fitBounds(true, bbox);
      } else {
        v.impl?.invalidate?.(true);
      }
    } catch (e) {
      console.warn('[BIMPanel] safeFitToView failed', e);
    }
  };

  // Reset all states when model changes
  useEffect(() => {
    if (!viewer?.model) return;
    
    setPropertyIndexReady(false);
  setAvailableCategories([]);
    setGroupedByType({});
    setExpandedGroups(new Set());
    setFilterCategory('');
    setFilterCategory2('');
  // type filter removed
    setFilterName('');
    setIsHierarchyLoaded(false);
    
    // Load hierarchy only once when model changes
    loadModelHierarchy();
  }, [viewer?.model]);

  // Build property index and categories when model loads or Filter panel opens
  useEffect(() => {
    const preindex = async () => {
      console.log('[BIMPanel] Filter panel useEffect triggered:', {
        activeCommand,
        hasViewer: !!viewer,
        hasModel: !!viewer?.model,
        modelId: viewer?.model?.id || 'none'
      });
      // Trigger category extraction if Filter panel is active AND model is loaded
      if (activeCommand === 'filter-objects' && viewer?.model) {
        console.log('[BIMPanel] Calling rebuildIndexAndCategories...');
        await rebuildIndexAndCategories();
      }
    };
    preindex();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCommand, viewer?.model]);

  // Also trigger category extraction when model loads if Filter panel is already open
  // NOTE: Removed duplicate effect that also depended on viewer?.model and
  // called rebuildIndexAndCategories(), as the previous effect already handles
  // the same condition (activeCommand === 'filter-objects' && viewer?.model).

    // removed types computation effect

  // Build hierarchical list per selected category (Type -> instances)
  useEffect(() => {
    const buildHierarchy = async () => {
      if (!viewer?.model) return;
      const ok = await ensurePropertyIndex();
      if (!ok) return;
      const cat = filterCategory || '';
      if (!cat) { setGroupedByType({}); return; }
      const propsCache = propsCacheRef.current;
      const typeFields = ['Type Name', 'Family and Type', 'Object Type', 'ObjectType', 'Family', 'Type'];
      const groups: Record<string, { label: string; dbId: number }[]> = {};
      for (const dbId of dbIdsCacheRef.current) {
        const props = propsCache[dbId] || {};
        if (!matchCategoryDynamic(props, cat)) continue;
        // derive type
        let t = '';
        for (const k of typeFields) { const v = props[k]; if (v) { t = String(v); break; } }
        if (!t) t = 'Unspecified';
        // derive label (prefer Name, fallback to node name), append [dbId]
        const name = props['Name'] || props['__nodeName'] || 'Unnamed';
        const label = `${name} [${dbId}]`;
        if (!groups[t]) groups[t] = [];
        groups[t].push({ label, dbId });
      }
      // Sort groups and limit items per group to keep UI light
      const sorted: Record<string, { label: string; dbId: number }[]> = {};
      Object.keys(groups).sort((a,b)=>a.localeCompare(b)).forEach((k) => {
        sorted[k] = groups[k]
          .sort((a,b)=>a.label.localeCompare(b.label))
          .slice(0, 80); // keep light
      });
      setGroupedByType(sorted);
      setExpandedGroups(new Set());
    };
    buildHierarchy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterCategory, propertyIndexReady]);

  // Helper: isolate with fallback
  const applyIsolation = (ids: number[]) => {
    if (!viewer) return;
    const unique = Array.from(new Set(ids.filter((n)=>Number.isFinite(n))));
    if (unique.length === 0) return;
    let ok = false;
    try {
      viewer.setGhosting?.(false);
      viewer.isolate?.(unique);
      ok = true;
    } catch {}
    if (!ok) {
      try {
        viewer.hideAll?.();
        unique.forEach((id)=>viewer.show?.(id));
      } catch {}
    }
    try { viewer.fitToView?.(unique); viewer.select?.(unique); } catch {}
  };

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
              // Show all hidden elements first (restores after 2D mode)
              safeRestoreAllVisibility(viewer);
              
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
              safeFitToView(viewer);
              
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
              safeFitToView(viewer);
            }
          } catch (error) {
            console.error('Error restoring 3D view:', error);
            // Fallback: just try fitToView if available
            try {
              safeFitToView(viewer);
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
  const getActiveModels = () => {
    if (!viewer) return [] as any[];
    // Gather all models known to the viewer
    const allModels: any[] = [];
    const vis = (viewer as any).getVisibleModels?.();
    if (Array.isArray(vis) && vis.length) {
      allModels.push(...vis);
    } else {
      const mq = (viewer as any).impl?.modelQueue?.();
      const all = typeof mq?.getModels === 'function' ? mq.getModels() : [];
      if (Array.isArray(all) && all.length) allModels.push(...all);
      else if (viewer.model) allModels.push(viewer.model);
    }

    // If no enabled set provided, keep existing behavior
    if (!enabledModelIds || enabledModelIds.size === 0) return allModels;

    // Build quick lookup from project-model id -> urn
    const projectByUrn = new Map<string, string>(); // urn -> projectModelId
    if (Array.isArray(models)) {
      for (const pm of models) {
        if (pm?.urn && pm?.id) projectByUrn.set(pm.urn, pm.id);
      }
    }

    // Filter: only models whose mapped project id is enabled
    const enabledModels = allModels.filter((m) => {
      const urn = getModelURN(m);
      const pmId = projectByUrn.get(urn);
      if (pmId) return enabledModelIds.has(pmId);
      // Fallback: if we couldn't map, include only if all models are enabled (conservative)
      return false;
    });

    console.log('[Filter] Active models filtered by enabledModelIds:', {
      total: allModels.length,
      enabled: enabledModels.length,
      enabledIds: Array.from(enabledModelIds || [])
    });
    return enabledModels;
  };

  const ensurePropertyIndex = async () => {
    if (!viewer) return false;
    const active = getActiveModels();
    if (!active.length) return false;
    if (propertyIndexReady && (dbIdsCacheRef.current.length > 0 || modelDbIdsRef.current.size > 0)) {
      return true;
    }
    return await rebuildIndexAndCategories();
  };

  // Helper to safely extract a model's URN across different viewer versions
  const getModelURN = (m: any): string => {
    try {
      return (
        m?.myData?.urn ||
        (typeof m?.getData === 'function' ? m.getData()?.urn : undefined) ||
        m?.urn ||
        (typeof m?.getData === 'function' ? m.getData()?.loadOptions?.documentUrn : undefined) ||
        ''
      );
    } catch {
      return '';
    }
  };

  // Build a fresh index for the current model and extract categories from model browser structure
  const rebuildIndexAndCategories = async () => {
    try {
      if (!viewer) return false;
      setCategoriesLoading(true);
      const activeModels = getActiveModels();
      modelDbIdsRef.current.clear();
      modelPropsRef.current.clear();
      modelCategoriesRef.current.clear();

      // For backward compatibility if only single model
      dbIdsCacheRef.current = [];
      propsCacheRef.current = {};

      const blocklist = new Set(['Category', 'Family Name', 'Family Type', 'Type Name', 'Document', 'Project Information', 'Views', 'Sheets', 'Groups']);
      const allCategoriesUnion = new Set<string>();

      for (const model of activeModels) {
        const tree = model.getInstanceTree?.();
        if (!tree) continue;

        await new Promise((resolve) => {
          if ((tree as any).nodeAccess) return resolve(true);
          const checkTree = () => {
            if ((tree as any).nodeAccess) resolve(true);
            else setTimeout(checkTree, 50);
          };
          checkTree();
        });

        const allDbIds: number[] = [];
        const rootId = tree.getRootId();
        const visited = new Set<number>();
        const categoriesForModel = new Set<string>();

        const walk = (nodeId: number, depth = 0) => {
          if (!nodeId || visited.has(nodeId)) return;
          visited.add(nodeId);
          let hasChild = false;
          tree.enumNodeChildren(nodeId, (c: number) => { hasChild = true; return false; });
          let hasFrags = false;
          tree.enumNodeFragments(nodeId, () => { hasFrags = true; return true; });
          if (!hasChild || hasFrags) allDbIds.push(nodeId);
          if (depth > 0) {
            const rawName = tree.getNodeName(nodeId);
            const cleaned = (rawName || '').replace(/\s*\(\d+\)$/, '').replace(/\s*\[\d+\]$/, '').trim();
            if (cleaned && cleaned.length > 2 && !blocklist.has(cleaned)) categoriesForModel.add(cleaned);
          }
          tree.enumNodeChildren(nodeId, (childId: number) => walk(childId, depth + 1));
        };
        walk(rootId);

        const batchSize = 2000;
        const propsCache: Record<number, Record<string, string>> = {};
        for (let i = 0; i < allDbIds.length; i += batchSize) {
          const batch = allDbIds.slice(i, i + batchSize);
          const results = await new Promise<any[]>((resolve, reject) => {
            model.getBulkProperties(batch, { propFilter: ['Category'] }, (data: any[]) => resolve(data), reject);
          });
          results.forEach((item) => {
            const map: Record<string, string> = {};
            (item.properties || []).forEach((p: any) => {
              if (p.displayName === 'Category' && p.displayValue) {
                const cleaned = String(p.displayValue).trim();
                if (cleaned && !blocklist.has(cleaned)) categoriesForModel.add(cleaned);
              }
              map[p.displayName] = String(p.displayValue ?? '');
            });
            if (typeof item.name === 'string') map['__nodeName'] = item.name;
            propsCache[item.dbId] = map;
          });
        }

        modelDbIdsRef.current.set(model.id, allDbIds);
        modelPropsRef.current.set(model.id, propsCache);
        modelCategoriesRef.current.set(model.id, categoriesForModel);

        // Maintain legacy caches for single-model code paths
        if (activeModels.length === 1) {
          dbIdsCacheRef.current = allDbIds;
          propsCacheRef.current = propsCache;
        }

        categoriesForModel.forEach((c) => allCategoriesUnion.add(c));
      }

      setPropertyIndexReady(true);
      const categoriesArr = Array.from(allCategoriesUnion).sort((a, b) => a.localeCompare(b));
      setAvailableCategories(categoriesArr);
      setCategoriesLoading(false);

      console.log('[Filter] Extracted categories (multi-model aware):', categoriesArr);
      return true;
    } catch (e) {
      console.error('[Filter] Failed to build index/categories:', e);
      setPropertyIndexReady(false);
      setAvailableCategories([]);
      setCategoriesLoading(false);
      return false;
    }
  };

  const norm = (s?: string) => (s || '').toLowerCase().trim();

  // Category matching uses dynamic categories derived from model properties
  const categoryFieldCandidates = ['Category', 'Element Category', 'IFC Class', 'IfcClass', 'System Type'];

  const matchCategoryDynamic = (props: Record<string, string>, selectedCategory: string) => {
    const selected = (selectedCategory || '').trim();
    const selNorm = norm(selected);
    if (!selNorm) return true;
    // 1) Exact match against common category fields
    for (const key of categoryFieldCandidates) {
      const v = props[key];
      if (v && norm(String(v)) === selNorm) return true;
    }
    // 2) Keyword heuristic (singular/plural)
    const base = selNorm.replace(/s$/i, ''); // walls -> wall
    const rx = new RegExp(`\\b${base}s?\\b`, 'i');
    const haystack = [
      props['Category'],
      props['Element Category'],
      props['IFC Class'],
      props['IfcClass'],
      props['System Type'],
      props['Name'],
      props['Family'],
      props['Family and Type'],
      props['Type Name'],
      props['Object Type'],
      props['ObjectType'],
      props['__nodeName']
    ].filter(Boolean).join(' | ');
    return rx.test(haystack);
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
  const searchDbIdsForKeywords = async (keywords: string[], attributeNames?: string[]): Promise<number[]> => {
    const found = new Set<number>();
    const activeModels = getActiveModels();
    
    for (const kw of keywords) {
      const res: number[] = await new Promise((resolve) => {
        viewer.search(
          kw,
          (dbIds: number[]) => resolve(dbIds || []),
          () => resolve([]),
          attributeNames
        );
      });
      
      // Filter search results to only include dbIds from active (enabled) models
      const filteredRes = res.filter(dbId => {
        return activeModels.some(model => {
          const modelDbIds = modelDbIdsRef.current.get(model.id) || [];
          return modelDbIds.includes(dbId);
        });
      });
      
      filteredRes.forEach(id => found.add(id));
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
    const catQ2 = filterCategory2; // optional second category (AND)
  // type filtering removed

    // If nothing entered, show all
  if (!nameQ && !catQ && !catQ2) {
      // Clear isolate state and show all
      try {
        if (viewer.isolate) viewer.isolate([]);
      } catch {}
      safeRestoreAllVisibility(viewer);
      if (viewer.clearSelection) viewer.clearSelection();
      return;
    }

    const fieldsForName = ['Name', '__nodeName', 'Family and Type', 'Type Name'];
  // const fieldsForType = ['Type Name', 'Family and Type', 'Object Type', 'ObjectType', 'Type']; // removed

    // Collect matches per model
    const perModelMatches: { model: any; ids: number[] }[] = [];
    const activeModels = getActiveModels();
    if (activeModels.length === 0) return;
    for (const model of activeModels) {
      const dbIds = modelDbIdsRef.current.get(model.id) || [];
      const propsCache = modelPropsRef.current.get(model.id) || {};
      const localMatches: number[] = [];
      for (const dbId of dbIds) {
        const props = (propsCache as any)[dbId] || {};
        const catOk = catQ ? matchCategoryDynamic(props, catQ) : true;
        const cat2Ok = catQ2 ? matchCategoryDynamic(props, catQ2) : true;
        if (!catOk || !cat2Ok) continue;
        const nameOk = nameQ ? matchText(props, fieldsForName, nameQ) : true;
        if (!nameOk) continue;
  // type filter removed
        localMatches.push(dbId);
      }
      if (localMatches.length) perModelMatches.push({ model, ids: localMatches });
    }

    const matched = perModelMatches.reduce((sum, s) => sum + s.ids.length, 0);
    if (matched === 0) {
      console.warn('[Filter] Property-index match returned 0. Trying search fallback...');
      let searchKeywords: string[] = [];
      if (catQ) searchKeywords = [catQ];
      if (catQ2) searchKeywords.push(catQ2);
      // Include text queries as well
      if (nameQ) searchKeywords.push(nameQ);
  // type filter removed
      // Search across common attributes and globally
      let foundPerModel: { model: any; ids: number[] }[] = [];
      if (searchKeywords.length > 0) {
        const globalFound = await searchDbIdsForKeywords(searchKeywords, [
          'Category', 'Element Category', 'Type Name', 'Family and Type', 'Family', 'Name', 'Object Type', 'ObjectType'
        ]);
        // globalFound has no model info; apply to all models heuristically
        if (globalFound.length) {
          for (const model of activeModels) foundPerModel.push({ model, ids: globalFound });
        } else {
          const globalFound2 = await searchDbIdsForKeywords(searchKeywords);
          if (globalFound2.length) for (const model of activeModels) foundPerModel.push({ model, ids: globalFound2 });
        }
      }
      if (foundPerModel.length === 0) {
        console.warn('[Filter] Fallback search also found 0. Restoring view.');
        safeRestoreAllVisibility(viewer);
        viewer.clearSelection?.();
        return;
      }
      perModelMatches.push(...foundPerModel);
    }

    // Aggregate isolate across models if possible
    const vm = (viewer as any).impl?.visibilityManager;
    if (vm?.aggregateIsolate && typeof vm.aggregateIsolate === 'function') {
      try {
        const payload = perModelMatches.map(s => ({ model: s.model, ids: Array.from(new Set(s.ids)) }));
        vm.aggregateIsolate(payload);
        viewer.fitToView?.();
        return;
      } catch (e) {
        console.warn('[Filter] aggregateIsolate failed, falling back to per-model isolate', e);
      }
    }

    // Fallback: isolate per model sequentially
      try {
        // Show all first to reset
        safeRestoreAllVisibility(viewer);
        for (const s of perModelMatches) {
          if (typeof viewer.isolate === 'function') {
            // @ts-ignore isolate(nodeIds, model?)
            viewer.isolate(s.ids, s.model);
          }
        }
        safeFitToView(viewer);
        return;
      } catch (e) {
        console.warn('[Filter] Per-model isolate failed, restoring view', e);
        safeRestoreAllVisibility(viewer);
      }

    // Multi-model isolation already handled above (aggregate/per-model). Legacy single-model
    // fragment-level isolation path removed.
  };

  const handleClearFilters = () => {
    setFilterName('');
    setFilterCategory('');
    setFilterCategory2('');
  // type filter removed
    
    if (viewer) {
      try {
        // If isolation protection is active from filtering, cancel it immediately
        try { (viewer as any).__isolationProtectionRestore?.(); } catch {}
        (viewer as any).__isolationProtectionActive = false;

        // 0) Hard reset viewer state (no reload). This clears selection, isolates, cut planes, explode, etc.
        try { (viewer as any).reset && (viewer as any).reset(); } catch {}

        // 1) Clear any isolate state and selection (defensive after reset)
        if (viewer.isolate) viewer.isolate([]);
        try { viewer.clearSelection(); } catch {}
        try { (viewer as any).select([]); } catch {}
        try { (viewer as any).impl?.selector?.setSelection([], (viewer as any).model); } catch {}
        try { (viewer as any).impl?.selector?.setAggregateSelection?.([]); } catch {}
        // Reset visual states that can bias the next frame
        try { (viewer as any).setCutPlanes && (viewer as any).setCutPlanes([]); } catch {}
        try { (viewer as any).explode && (viewer as any).explode(0); } catch {}
        try { (viewer as any).setGhosting && (viewer as any).setGhosting(false); } catch {}

        // 2) Force all nodes visible using visibilityManager (more reliable than showAll after hide/isolate chains)
        const model = viewer.model;
        if (viewer.impl?.visibilityManager && model?.getObjectTree) {
          try {
            model.getObjectTree((tree: any) => {
              if (!tree) return;
              const vm = viewer.impl.visibilityManager;
              const root = tree.getRootId?.() ?? 1;
              const walk = (id: number) => { try { vm.setNodeOff(id, false); } catch {}; tree.enumNodeChildren(id, (c: number) => walk(c)); };
              walk(root);
            });
          } catch {}
          try { viewer.impl.invalidate?.(true); } catch {}
          try { viewer.clearThemingColors(model); } catch {}
        } else {
          // Fallback
          safeRestoreAllVisibility(viewer);
        }

        // 3) Restore visibility for enabled models only
        if (typeof onRestoreEnabledModelsVisibility === 'function') {
          onRestoreEnabledModelsVisibility(viewer);
        } else {
          // Fallback: restore all models if callback not provided
          safeRestoreAllVisibility(viewer);
        }
        
        // 4) Invalidate and fit to enabled models' bounding box
        try { viewer.impl?.invalidate?.(true); } catch {}
        safeFitToView(viewer);
        try {
          let bbox: any = null;
          if (model && (model as any).getBoundingBox) {
            bbox = (model as any).getBoundingBox();
          } else if (model && (model as any).getData && (model as any).getData().bbox) {
            bbox = (model as any).getData().bbox;
          }
          if (bbox) {
            // Use navigation.fitBounds with immediate=true so it doesn't animate through intermediate states
            (viewer as any).navigation.fitBounds(true, bbox, false);
          } else if (typeof (viewer as any).fitToView === 'function') {
            // Fallback: fitToView on whole scene
            (viewer as any).fitToView(undefined, undefined, true);
          }
        } catch {}

        console.log('Cleared all filters. Restored full model visibility and camera fit.');
      } catch (e) {
        console.warn('Error clearing filters, falling back to showAll:', e);
        safeRestoreAllVisibility(viewer);
      }
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
        safeRestoreAllVisibility(viewer);
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
        safeRestoreAllVisibility(viewer);
      }
      
    } catch (error) {
      console.error('❌ Filter error:', error);
      // Restore all objects on error
      if (viewer) safeRestoreAllVisibility(viewer);
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
          <div className="space-y-1.5">
            <h3 className="text-base font-semibold mb-1 flex items-center gap-1 text-white">
              <Filter className="h-4 w-4" />
              Filter Objects
            </h3>

            {/* Category dropdown */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Category / Type</label>
              <select
                value={filterCategory || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setFilterCategory(val || '');
                  // removed type filter reset
                }}
                className="w-full bg-gray-800 border border-gray-700 text-gray-200 rounded px-2.5 py-1 text-sm mb-1"
              >
                <option value="">
                  {categoriesLoading && availableCategories.length === 0 ? 'Loading categories…' : 'Select category…'}
                </option>
                {availableCategories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Type dropdown removed */}

            {/* Search input */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Search</label>
              <input
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                placeholder="Search by name..."
                className="w-full bg-gray-800 border border-gray-700 text-gray-200 rounded px-2.5 py-1 text-sm"
              />
            </div>

            {/* AND Category dropdown */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center rounded bg-gray-700 text-gray-200 text-[10px] px-1.5 py-0.5">AND</span>
                <label className="block text-xs text-gray-400">Additional Category</label>
              </div>
              <select
                value={filterCategory2 || ''}
                onChange={(e) => setFilterCategory2(e.target.value || '')}
                className="w-full bg-gray-800 border border-gray-700 text-gray-200 rounded px-2.5 py-1 text-sm mb-1"
              >
                <option value="">(Optional) Select another category…</option>
                {availableCategories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Actions */}
            <div className="flex gap-1.5">
              <button
                onClick={handleApplyFilters}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-1.5 px-3 rounded-md transition-colors"
              >
                Apply Filters
              </button>
              <button
                onClick={() => {
                  // Single clear action restores full model without extra operations
                  handleClearFilters();
                }}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-medium py-1.5 px-3 rounded-md transition-colors"
              >
                Show All
              </button>
            </div>

            {/* Hierarchical list (Type -> Items) */}
            {filterCategory && Object.keys(groupedByType).length > 0 && (
              <div className="mt-2 space-y-1">
                {Object.entries(groupedByType).map(([typeName, items]) => {
                  const isOpen = expandedGroups.has(typeName);
                  return (
                    <div key={typeName} className="border border-gray-800 rounded-md overflow-hidden">
                      <div
                        className="flex items-center justify-between px-3 py-2 bg-gray-800 cursor-pointer hover:bg-gray-700"
                        onClick={() => {
                          const next = new Set(expandedGroups);
                          if (next.has(typeName)) next.delete(typeName); else next.add(typeName);
                          setExpandedGroups(next);
                        }}
                      >
                        <div className="flex items-center gap-2 text-sm text-gray-200">
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          <span className="font-medium">{typeName}</span>
                          <span className="text-gray-400">({items.length})</span>
                        </div>
                        <button
                          className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-white"
                          onClick={(e) => { e.stopPropagation(); applyIsolation(items.map(i => i.dbId)); }}
                        >
                          Isolate
                        </button>
                      </div>
                      {isOpen && (
                        <div className="max-h-56 overflow-auto divide-y divide-gray-800">
                          {items.map((it) => (
                            <button
                              key={it.dbId}
                              className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-gray-800"
                              title={it.label}
                              onClick={() => applyIsolation([it.dbId])}
                            >
                              {it.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
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

      case "models":
        return (
          <div className="space-y-2">
            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2 text-white">
              <Layers className="h-5 w-5" />
              Models
            </h3>
            {models && models.length > 0 ? (
              <div className="space-y-2">
                {(() => {
                  const groups: Record<string, ProjectModel[]> = {};
                  for (const m of models) {
                    const key = (m.discipline || 'other').toLowerCase();
                    (groups[key] ||= []).push(m);
                  }
                  const order = ['architecture','structure','mep','electrical','plumbing','hvac','other'];
                  const label: Record<string,string> = { architecture:'Architecture', structure:'Structure', mep:'MEP', electrical:'Electrical', plumbing:'Plumbing', hvac:'HVAC', other:'Other' };
                  return order.filter(d => groups[d]?.length).map((d) => (
                    <div key={d} className="border border-gray-800 rounded-md overflow-hidden">
                      <div className="px-3 py-2 bg-gray-800 flex items-center justify-between">
                        <span className="text-gray-200 text-sm">{label[d]}</span>
                        <span className="text-xs bg-gray-700 text-gray-300 rounded px-2 py-0.5">{groups[d].length}</span>
                      </div>
                      <ul className="divide-y divide-gray-800">
                        {groups[d].map((m) => {
                          const isOn = enabledModelIds ? enabledModelIds.has(m.id) : true;
                          return (
                            <li key={m.id} className="px-3 py-2 text-xs flex items-center justify-between">
                              <div className="min-w-0 mr-3">
                                <div className="truncate text-gray-200">{m.name}</div>
                                <div className="text-[10px] text-gray-400">{m.fileType || '—'}</div>
                              </div>
                              <button
                                className={`p-1.5 rounded-md border ${isOn ? 'text-green-400 border-green-400/30 hover:bg-green-500/10' : 'text-gray-400 border-gray-700 hover:bg-gray-700/50'}`}
                                onClick={() => onToggleModel && onToggleModel(m.id)}
                                title={isOn ? 'Hide model' : 'Show model'}
                              >
                                {isOn ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ));
                })()}
              </div>
            ) : (
              <div className="text-xs text-gray-400">No models available.</div>
            )}
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
    <div className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="p-4 border-b border-gray-800 flex flex-col items-center">
        <h2 className="text-xl font-bold text-white mb-3">BIM</h2>
        <button
          onClick={onBackToProjects}
          className="flex items-center gap-2 px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors w-full justify-center"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Project Info
        </button>
      </div>

      {/* Vertical menu (compact) */}
      <div className="p-3 space-y-1.5 border-b border-gray-800">
        <button
          onClick={() => setActiveCommand('models')}
          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md border text-sm ${activeCommand === 'models' ? 'bg-blue-600 text-white border-transparent' : 'bg-gray-800 text-gray-200 border-gray-700 hover:bg-gray-700'}`}
        >
          <Layers className="h-4 w-4" />
          <span className="font-medium">Models</span>
        </button>
        <button
          onClick={() => setActiveCommand('2d-views')}
          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md border text-sm ${activeCommand === '2d-views' ? 'bg-blue-600 text-white border-transparent' : 'bg-gray-800 text-gray-200 border-gray-700 hover:bg-gray-700'}`}
        >
          <Layers className="h-4 w-4" />
          <span className="font-medium">2D Views</span>
        </button>
        <button
          onClick={() => setActiveCommand('3d-views')}
          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md border text-sm ${activeCommand === '3d-views' ? 'bg-blue-600 text-white border-transparent' : 'bg-gray-800 text-gray-200 border-gray-700 hover:bg-gray-700'}`}
        >
          <Box className="h-4 w-4" />
          <span className="font-medium">3D Views</span>
        </button>
        <button
          onClick={() => setActiveCommand('save-view')}
          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md border text-sm ${activeCommand === 'save-view' ? 'bg-blue-600 text-white border-transparent' : 'bg-gray-800 text-gray-200 border-gray-700 hover:bg-gray-700'}`}
        >
          <Save className="h-4 w-4" />
          <span className="font-medium">Save View</span>
        </button>
        <button
          onClick={() => setActiveCommand('filter-objects')}
          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md border text-sm ${activeCommand === 'filter-objects' ? 'bg-blue-600 text-white border-transparent' : 'bg-gray-800 text-gray-200 border-gray-700 hover:bg-gray-700'}`}
        >
          <Filter className="h-4 w-4" />
          <span className="font-medium">Filter Objects</span>
        </button>
        <button
          onClick={() => setActiveCommand('view-sensors')}
          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md border text-sm ${activeCommand === 'view-sensors' ? 'bg-blue-600 text-white border-transparent' : 'bg-gray-800 text-gray-200 border-gray-700 hover:bg-gray-700'}`}
        >
          <Eye className="h-4 w-4" />
          <span className="font-medium">View Sensors</span>
        </button>
      </div>

      {/* Command Content */}
      <div className="flex-1 p-4 overflow-y-auto min-h-0">
        {renderCommandContent()}
      </div>
    </div>
  );
}
