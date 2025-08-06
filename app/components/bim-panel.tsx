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
            
            // Clear any object isolation from 2D floor view
            viewer.clearSelection();
            viewer.showAll();
            
            // Reset any visibility filters
            const model = viewer.model;
            const tree = model.getInstanceTree();
            if (tree) {
              // Make sure all objects are visible
              tree.enumNodeChildren(tree.getRootId(), (dbid: number) => {
                viewer.show(dbid);
                return true;
              }, true);
            }
            
            // Switch to perspective view for better 3D experience
            viewer.setViewType(0); // 0 = PERSPECTIVE
            
            // Reset camera to show the entire model
            viewer.fitToView();
            
            // Reset any display modes that might have been set
            viewer.setDisplayMode(0); // 0 = SOLID mode
            
            // Force a complete redraw with all buffers
            viewer.impl.invalidate(true, true, true);
            viewer.impl.sceneUpdated(true);
            
            console.log('Successfully restored 3D view after leaving 2D mode');
          } catch (error) {
            console.error('Error restoring 3D view:', error);
            // Fallback: just show all and fit to view
            try {
              viewer.showAll();
              viewer.fitToView();
            } catch (fallbackError) {
              console.error('Fallback restoration also failed:', fallbackError);
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

  const handleApplyFilters = async () => {
    if (!viewer) {
      console.error('Viewer not available for filtering');
      return;
    }

    try {
      // First clear any existing filters and show all objects
      viewer.showAll();
      
      // If all filters are empty, just show everything
      if (!filterName && !filterCategory && !filterType) {
        console.log('No filters applied, showing all objects');
        return;
      }

      // Get all model elements
      const model = viewer.model;
      if (!model) {
        console.error('No model available for filtering');
        return;
      }

      const tree = model.getInstanceTree();
      const dbids: number[] = [];
      
      // Collect all leaf node dbids (actual geometry objects)
      if (tree && tree.enumNodeChildren) {
        tree.enumNodeChildren(tree.getRootId(), (dbid: number) => {
          // Only include leaf nodes (actual objects, not groups)
          if (tree.getChildCount(dbid) === 0) {
            dbids.push(dbid);
          }
          return true;
        }, true); // true for recursive enumeration
      }

      if (dbids.length === 0) {
        console.warn('No model elements found for filtering');
        return;
      }

      console.log(`Filtering through ${dbids.length} objects...`);

      // Get properties for all elements
      return new Promise<void>((resolve) => {
        model.getBulkProperties(dbids, ['Name', 'Category', 'Type', 'Family', 'Level'], (results: Array<{dbId: number, properties: Array<{displayName?: string, displayValue?: any}>}>) => {
          try {
            const visibleDbids: number[] = [];
            const hiddenDbids: number[] = [];
            
            results.forEach((result) => {
              const dbid = result.dbId;
              const props = result.properties || [];
              
              // Create a searchable text from all properties
              const searchableText = props.map(p => 
                `${p.displayName || ''} ${p.displayValue || ''}`
              ).join(' ').toLowerCase();
              
              // Check if element matches all active filters
              let matches = true;
              
              // Name filter - search in all property values
              if (filterName && matches) {
                const nameFilter = filterName.toLowerCase();
                matches = searchableText.includes(nameFilter) || 
                         props.some(p => 
                           (p.displayName?.toLowerCase().includes(nameFilter)) ||
                           (p.displayValue?.toString().toLowerCase().includes(nameFilter))
                         );
              }
              
              // Category filter - look for category-related properties
              if (filterCategory && matches) {
                const categoryFilter = filterCategory.toLowerCase();
                matches = props.some(p => {
                  const propName = p.displayName?.toLowerCase() || '';
                  const propValue = p.displayValue?.toString().toLowerCase() || '';
                  
                  // Check if it's a category-related property
                  if (propName.includes('category') || propName.includes('family') || propName.includes('type')) {
                    return propValue.includes(categoryFilter);
                  }
                  
                  // Also check for direct matches in common BIM categories
                  const categoryMappings = {
                    'walls': ['wall', 'mur', 'parete'],
                    'doors': ['door', 'porte', 'porta'],
                    'windows': ['window', 'fenêtre', 'finestra'],
                    'floors': ['floor', 'slab', 'sol', 'pavimento'],
                    'ceilings': ['ceiling', 'plafond', 'soffitto'],
                    'columns': ['column', 'colonne', 'colonna'],
                    'beams': ['beam', 'poutre', 'trave']
                  };
                  
                  const mappedTerms = categoryMappings[categoryFilter as keyof typeof categoryMappings] || [categoryFilter];
                  return mappedTerms.some(term => propValue.includes(term));
                });
              }
              
              // Type filter - look for type-related properties
              if (filterType && matches) {
                const typeFilter = filterType.toLowerCase();
                matches = props.some(p => {
                  const propName = p.displayName?.toLowerCase() || '';
                  const propValue = p.displayValue?.toString().toLowerCase() || '';
                  
                  if (propName.includes('type') || propName.includes('family')) {
                    return propValue.includes(typeFilter);
                  }
                  return false;
                });
              }
              
              if (matches) {
                visibleDbids.push(dbid);
              } else {
                hiddenDbids.push(dbid);
              }
            });
            
            // Apply visibility - hide non-matching objects
            if (hiddenDbids.length > 0) {
              viewer.hide(hiddenDbids);
            }
            
            // Fit to view the visible objects
            if (visibleDbids.length > 0) {
              viewer.fitToView(visibleDbids);
            }
            
            console.log(`Filter applied. Showing ${visibleDbids.length} of ${dbids.length} elements`);
            
          } catch (error) {
            console.error('Error processing filter results:', error);
          } finally {
            resolve();
          }
        });
      });
      
    } catch (error) {
      console.error('Error applying filters:', error);
    }
  };

  const handleClearFilters = async () => {
    setFilterName('');
    setFilterCategory('');
    setFilterType('');
    
    try {
      if (viewer) {
        // First show all elements
        await viewer.showAll();
        
        // Always switch to 3D view when clearing filters
        viewer.setViewType(0); // 0 = PERSPECTIVE
        
        // Reset camera to default position
        viewer.fitToView();
        
        // Force a complete redraw
        viewer.impl.invalidate(true, true, true);
        
        // If we were in 2D view mode, exit it
        if (activeCommand === '2d-views') {
          setActiveCommand(null);
        }
        
        console.log('Cleared all filters and restored 3D view');
      }
    } catch (error) {
      console.error('Error clearing filters:', error);
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
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Filter by Name
                </label>
                <input
                  type="text"
                  value={filterName}
                  onChange={(e) => setFilterName(e.target.value)}
                  placeholder="Enter object name..."
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white placeholder-gray-400"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Filter by Category
                </label>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white"
                >
                  <option value="" className="bg-gray-800 text-white">All Categories</option>
                  <option value="walls" className="bg-gray-800 text-white">Walls</option>
                  <option value="doors" className="bg-gray-800 text-white">Doors</option>
                  <option value="windows" className="bg-gray-800 text-white">Windows</option>
                  <option value="floors" className="bg-gray-800 text-white">Floors</option>
                  <option value="roofs" className="bg-gray-800 text-white">Roofs</option>
                  <option value="structural" className="bg-gray-800 text-white">Structural</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Filter by Type
                </label>
                <input
                  type="text"
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  placeholder="Enter object type..."
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white placeholder-gray-400"
                />
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={handleApplyFilters}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Apply Filters
                </button>
                <button
                  onClick={handleClearFilters}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Clear All
                </button>
              </div>
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
