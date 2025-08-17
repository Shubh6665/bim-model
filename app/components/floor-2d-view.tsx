"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Building2, Eye, EyeOff, Layers, ArrowUp, ArrowDown } from 'lucide-react';
import { FloorDataView, FloorData, SensorData } from './floor-data-view';

// Autodesk Forge Viewer type declarations
declare global {
  namespace Autodesk {
    namespace Viewing {
      const CAMERA_TYPE: {
        PERSPECTIVE: number;
        ORTHOGRAPHIC: number;
      };
    }
  }
}

// Types for floor data
interface Floor {
  id: string;
  name: string;
  levelIndex: number;
  zMin: number;
  zMax: number;
}

interface Floor2DViewProps {
  viewer?: any;
  onFloorChanged?: (floor: FloorData | null) => void;
  onSensorClicked?: (sensorId: string) => void;
}

export function Floor2DView({ viewer, onFloorChanged, onSensorClicked }: Floor2DViewProps) {
  const [floorDataView, setFloorDataView] = useState<FloorDataView | null>(null);
  const [availableFloors, setAvailableFloors] = useState<FloorData[]>([]);
  const [currentFloor, setCurrentFloor] = useState<FloorData | null>(null);
  const [filteredSensors, setFilteredSensors] = useState<Map<string, SensorData>>(new Map());
  const [isInitialized, setIsInitialized] = useState(false);
  const [showSensors, setShowSensors] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  
  const initializationRef = useRef(false);

  // Initialize floor data view when viewer is available
  useEffect(() => {
    if (viewer && !initializationRef.current) {
      initializationRef.current = true;
      initializeFloorDataView();
    }
  }, [viewer]);

  const initializeFloorDataView = async () => {
    if (!viewer) return;
    
    setIsLoading(true);
    console.log('🏗️ Initializing Floor 2D View...');
    
    try {
      const dataView = new FloorDataView(viewer);
      const levelsExtensionLoaded = await dataView.initialize();
      
      setFloorDataView(dataView);
      
      // Get available floors
      const floors = dataView.getAvailableFloors();
      setAvailableFloors(floors);
      console.log(`🏢 Available floors:`, floors);
      
      // Setup floor change listener if levels extension is available
      if (levelsExtensionLoaded) {
        dataView.setupFloorChangeListener((floor: FloorData | null) => {
          console.log(`🔄 Floor changed to:`, floor);
          setCurrentFloor(floor);
          updateFilteredSensors(dataView, floor);
          onFloorChanged?.(floor);
        });
      }
      
      // Initialize with all sensors (no floor selected)
      updateFilteredSensors(dataView, null);
      setIsInitialized(true);
      
    } catch (error) {
      console.error('❌ Error initializing Floor 2D View:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateFilteredSensors = (dataView: FloorDataView, floor: FloorData | null) => {
    if (!dataView) return;
    
    // Set the floor in data view (triggers filtering)
    dataView.floor = floor;
    
    // Get filtered sensors
    const sensors = dataView.getSensors();
    setFilteredSensors(new Map(sensors));
    
    console.log(`📡 Updated filtered sensors: ${sensors.size} sensors for floor ${floor?.name || 'All'}`);
  };

  const handleFloorSelect = async (floorId: string | null) => {
    if (!floorDataView || !viewer) {
      console.warn('❌ Floor data view or viewer not available');
      return;
    }
    
    setIsLoading(true);
    console.log(`🏢 Selecting floor: ${floorId || 'All Floors'} - Connecting to native levels toolbar`);
    
    try {
      // Clear any previous selections
      viewer.clearSelection();
      
      // IMPORTANT: Use the enhanced selectFloor method that connects to native levels extension
      // This method will trigger the exact same behavior as clicking on the native levels toolbar
      floorDataView.selectFloor(floorId);
      
      const selectedFloor = floorId ? availableFloors.find(f => f.id === floorId) || null : null;
      setCurrentFloor(selectedFloor);
      
      // Update filtered sensors
      updateFilteredSensors(floorDataView, selectedFloor);
      
      // Additional native level selection trigger - try multiple methods to ensure it works
      if (selectedFloor && viewer.loadedExtensions && viewer.loadedExtensions['Autodesk.AEC.LevelsExtension']) {
        const levelsExt = viewer.loadedExtensions['Autodesk.AEC.LevelsExtension'];
        
        try {
          // Method 1: Direct floor selector interaction
          if (levelsExt.floorSelector) {
            console.log(`🔧 Triggering native level ${selectedFloor.levelIndex} via floorSelector`);
            
            // Select the floor (highlights it)
            levelsExt.floorSelector.selectFloor(selectedFloor.levelIndex, true);
            
            // Small delay then trigger the view change (simulates double-click)
            setTimeout(() => {
              try {
                // Try different methods to activate the floor view
                if (levelsExt.floorSelector.onFloorDoubleClick) {
                  levelsExt.floorSelector.onFloorDoubleClick(selectedFloor.levelIndex);
                  console.log(`✅ Triggered floor view via onFloorDoubleClick`);
                } else if (levelsExt.floorSelector.activateFloorView) {
                  levelsExt.floorSelector.activateFloorView(selectedFloor.levelIndex);
                  console.log(`✅ Triggered floor view via activateFloorView`);
                } else {
                  // Fallback: dispatch custom event
                  const event = new CustomEvent('floorViewActivated', {
                    detail: { levelIndex: selectedFloor.levelIndex, floorData: selectedFloor }
                  });
                  levelsExt.floorSelector.dispatchEvent(event);
                  console.log(`✅ Triggered floor view via custom event`);
                }
              } catch (error) {
                console.warn('⚠️ Native floor view trigger failed, using manual method:', error);
                // Manual fallback handled by selectFloor method
              }
            }, 100);
          }
          
          // Method 2: Try to programmatically click the native level button
          setTimeout(() => {
            try {
              const levelButtons = document.querySelectorAll('.adsk-button-icon[title*="Level"], .toolbar-vertical-group button[title*="Level"]');
              const targetButton = Array.from(levelButtons).find(btn => 
                btn.getAttribute('title')?.includes(selectedFloor.name) ||
                btn.getAttribute('title')?.includes(`Level ${selectedFloor.levelIndex}`)
              ) as HTMLElement;
              
              if (targetButton) {
                console.log(`🖱️ Found and clicking native level button for ${selectedFloor.name}`);
                targetButton.click();
                
                // Double-click to activate floor view
                setTimeout(() => {
                  const event = new MouseEvent('dblclick', {
                    view: window,
                    bubbles: true,
                    cancelable: true
                  });
                  targetButton.dispatchEvent(event);
                  console.log(`✅ Double-clicked native level button`);
                }, 50);
              }
            } catch (error) {
              console.warn('⚠️ Could not find or click native level button:', error);
            }
          }, 200);
          
        } catch (error) {
          console.warn('⚠️ Error with native levels extension interaction:', error);
        }
      }
      
      console.log(`✅ Floor selection completed: ${selectedFloor?.name || 'All Floors'}`);
      
      // Small delay to allow native extension to process
      await new Promise(resolve => setTimeout(resolve, 300));
      
    } catch (error) {
      console.error('❌ Error selecting floor:', error);
      
      // Fallback: manual view switching if native method fails
      const selectedFloor = floorId ? availableFloors.find(f => f.id === floorId) || null : null;
      if (!floorId) {
        await switch3DView();
      } else if (selectedFloor) {
        await switch2DFloorView(selectedFloor);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Enhanced double-click handler for floors
  const handleFloorDoubleClick = (floorId: string | null) => {
    console.log('Double-clicking floor:', floorId);
    
    // If this is the currently active floor, switch back to 3D view
    if (floorId === currentFloor?.id || (floorId === null && !currentFloor)) {
      console.log('Switching back to 3D view via double-click');
      
      try {
        // Method 1: Use native levels extension API to restore 3D view
        const levelsExt = viewer?.getExtension('Autodesk.AEC.LevelsExtension') as any;
        if (levelsExt?.floorSelector) {
          console.log('Restoring 3D view via levels extension');
          levelsExt.floorSelector.restore3DView();
          
          // Also untick any native toolbar buttons
          setTimeout(() => {
            const nativeButtons = document.querySelectorAll('[data-automation-id="toolbar-levelsExtensionTool"] button');
            nativeButtons.forEach((btn: any) => {
              if (btn.classList.contains('active') || btn.classList.contains('selected')) {
                btn.click();
              }
            });
          }, 100);
        }
        
        // Method 2: Clear our internal state
        setCurrentFloor(null);
        floorDataView?.selectFloor(null);
        
      } catch (error) {
        console.error('Error in double-click 3D restoration:', error);
      }
    } else {
      // If it's not the current floor, just select it normally
      handleFloorSelect(floorId);
    }
  };

  const switch2DFloorView = async (floor: FloorData) => {
    if (!viewer) return;
    
    console.log(`📐 Switching to 2D view for ${floor.name}`);
    
    try {
      // Get current camera to maintain some settings
      const currentCamera = viewer.getCamera();
      const bbox = viewer.model.getBoundingBox();
      
      // Calculate floor center
      const floorCenter = {
        x: (bbox.min.x + bbox.max.x) / 2,
        y: (bbox.min.y + bbox.max.y) / 2,
        z: (floor.zMin + floor.zMax) / 2
      };
      
      // Calculate optimal camera positioning
      const buildingWidth = bbox.max.x - bbox.min.x;
      const buildingDepth = bbox.max.y - bbox.min.y;
      const maxDimension = Math.max(buildingWidth, buildingDepth);
      const cameraDistance = maxDimension * 0.8;
      
      // Create a new camera position for this floor
      const newCamera = viewer.getCamera();
      
      // Position camera for a good view of the floor
      newCamera.position.set(
        floorCenter.x - cameraDistance * 2.0,  // Left side view
        floorCenter.y - cameraDistance * 1.3,  // Slight angle
        floorCenter.z + cameraDistance * 0.8   // Slightly elevated
      );
      
      // Set the target to the center of the floor
      newCamera.target.set(
        floorCenter.x,
        floorCenter.y,
        floorCenter.z
      );
      
      // Maintain Z-up for consistency
      newCamera.up.set(0, 0, 1);
      
      // Apply the new camera settings
      viewer.navigation.setCamera(newCamera);
      
      // Switch to perspective view
      viewer.setViewType(0); // 0 = PERSPECTIVE, 1 = ORTHOGRAPHIC
      
      // Show only the current floor
      await hideNonFloorElements(floor);
      
      // Fit to view with a small delay
      setTimeout(() => {
        try {
          viewer.fitToView(null, 1.0);
        } catch (error) {
          console.error('Error fitting to view:', error);
        }
      }, 100);
      
      console.log(`✅ Switched to 2D view for ${floor.name}`);
      
    } catch (error) {
      console.error('❌ Error in switch2DFloorView:', error);
      // Fallback to 3D view on error
      await switch3DView();
    }
  };

  const switch3DView = async () => {
    if (!viewer) return;
    
    console.log('🎯 Switching to 3D view - Showing all model elements');
    
    try {
      // First reset any isolation
      await viewer.isolate([]);
      
      // Show all objects
      viewer.showAll();
      
      // Get the model and ensure it's loaded
      const model = viewer.model;
      if (model) {
        try {
          // Try to get all model fragments
          const frags = viewer.impl.getRenderProxy(model, model.getRootId());
          if (frags) {
            // Force update the scene
            viewer.impl.sceneUpdated(true);
          }
        } catch (e) {
          console.warn('Could not update scene directly:', e);
        }
      }
      
      // Switch to perspective view
      viewer.setViewType(0); // 0 = PERSPECTIVE
      
      // Force a complete redraw
      viewer.impl.invalidate(true, true, true);
      
      // Try to show all elements again after a short delay
      setTimeout(() => {
        try {
          viewer.showAll();
          viewer.isolate([]);
          
          // Try to fit the view
          viewer.fitToView();
          
          // Force another redraw
          viewer.impl.invalidate(true, true, true);
          
          console.log('✅ Successfully showed all model elements in 3D view');
          
        } catch (error) {
          console.warn('Error in delayed show all:', error);
        }
      }, 300);
      
    } catch (error) {
      console.error('❌ Error in switch3DView:', error);
      
      // Final fallback - try basic reset
      try {
        console.log('🔄 Trying final fallback');
        viewer.showAll();
        viewer.isolate([]);
        viewer.setViewType(0);
        
        // Try to reset the view completely
        const ext = viewer.getExtension('Autodesk.Viewing.SceneBuilder');
        if (ext) {
          ext.showAll();
        }
        
        viewer.fitToView();
      } catch (finalError) {
        console.error('❌ Final fallback failed:', finalError);
      }
    }
  };

  const hideNonFloorElements = async (floor: FloorData) => {
    if (!viewer || !viewer.model) return;
    
    try {
      const instanceTree = viewer.model.getInstanceTree();
      if (!instanceTree) return;
      
      const allNodes: number[] = [];
      const floorNodes: number[] = [];
      
      // Get all nodes
      instanceTree.enumNodeChildren(instanceTree.getRootId(), (nodeId: number) => {
        allNodes.push(nodeId);
      }, true);
      
      // Filter nodes by floor elevation (simplified approach)
      for (const nodeId of allNodes) {
        try {
          const bounds = viewer.model.getBoundingBox(nodeId);
          if (bounds && bounds.min && bounds.max) {
            const nodeZ = (bounds.min.z + bounds.max.z) / 2;
            
            // Include nodes that are within the floor's Z range
            if (nodeZ >= floor.zMin && nodeZ <= floor.zMax) {
              floorNodes.push(nodeId);
            }
          }
        } catch (error) {
          // Skip nodes that can't be processed
        }
      }
      
      if (floorNodes.length > 0) {
        // Hide all, then show only floor nodes
        viewer.hideAll();
        viewer.show(floorNodes);
        console.log(`👁️ Showing ${floorNodes.length} floor elements for ${floor.name}`);
      }
      
    } catch (error) {
      console.error('❌ Error filtering floor elements:', error);
    }
  };

  const handleSensorClick = (sensorId: string) => {
    console.log(`📡 Sensor clicked: ${sensorId}`);
    onSensorClicked?.(sensorId);
  };

  const toggleSensorVisibility = () => {
    setShowSensors(!showSensors);
    console.log(`👁️ Sensor visibility: ${!showSensors ? 'shown' : 'hidden'}`);
  };

  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-300">Initializing 2D Floor View...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Floor Selection */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-3">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold flex items-center gap-2 text-white">
            <Building2 className="h-4 w-4" />
            Floor Selection
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleSensorVisibility}
              className="p-1 rounded-md bg-gray-700 hover:bg-gray-600 transition-colors text-gray-300"
              title={showSensors ? "Hide Sensors" : "Show Sensors"}
            >
              {showSensors ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 gap-1.5">
          {/* All Floors Option */}
          <button
            onClick={() => handleFloorSelect(null)}
            onDoubleClick={() => handleFloorDoubleClick(null)}
            disabled={isLoading}
            className={`p-2 rounded-md border text-left transition-colors ${
              !currentFloor
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'bg-gray-700 border-gray-600 hover:bg-gray-600 text-gray-200'
            } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">All Floors (3D View)</div>
                <div className="text-xs text-gray-400">
                  {filteredSensors.size} sensors total
                </div>
              </div>
              <Layers className="h-3 w-3" />
            </div>
          </button>
          
          {/* Individual Floor Options */}
          {availableFloors.map((floor) => {
            const floorSensors = floorDataView?.floor?.id === floor.id
              ? filteredSensors.size
              : 0;
            return (
              <button
                key={floor.id}
                onClick={() => handleFloorSelect(floor.id)}
                onDoubleClick={() => handleFloorDoubleClick(floor.id)}
                disabled={isLoading}
                className={`p-2 rounded-md border text-left transition-colors ${
                  currentFloor?.id === floor.id
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-gray-700 border-gray-600 hover:bg-gray-600 text-gray-200'
                } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">{floor.name}</div>
                    <div className="text-xs text-gray-400">
                      Level {floor.levelIndex} • Z: {floor.zMin.toFixed(1)}m - {floor.zMax.toFixed(1)}m
                      {currentFloor?.id === floor.id && ` • ${floorSensors} sensors`}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {floor.levelIndex > 0 && <ArrowUp className="h-3 w-3" />}
                    {floor.levelIndex < 0 && <ArrowDown className="h-3 w-3" />}
                    <Building2 className="h-3 w-3" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sensor List for Current Floor */}
      {showSensors && filteredSensors.size > 0 && (
        <div className="bg-white rounded-lg border p-4">
          <h4 className="font-semibold mb-3">
            Sensors on {currentFloor?.name || 'All Floors'} ({filteredSensors.size})
          </h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {Array.from(filteredSensors.entries()).map(([sensorId, sensor]) => (
              <button
                key={sensorId}
                onClick={() => handleSensorClick(sensorId)}
                className="w-full p-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-left transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{sensor.type} Sensor</div>
                    <div className="text-xs text-gray-600">
                      ID: {sensorId} • Z: {sensor.location.z.toFixed(1)}m
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    ({sensor.location.x.toFixed(1)}, {sensor.location.y.toFixed(1)})
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading Indicator */}
      {isLoading && (
        <div className="flex items-center justify-center p-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mr-2"></div>
          <span className="text-gray-600">Processing floor view...</span>
        </div>
      )}
    </div>
  );
}
