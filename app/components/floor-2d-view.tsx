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
    if (!floorDataView) return;
    
    setIsLoading(true);
    console.log(`🏢 Selecting floor: ${floorId}`);
    
    try {
      // Select floor in data view
      floorDataView.selectFloor(floorId);
      
      const selectedFloor = floorId ? availableFloors.find(f => f.id === floorId) || null : null;
      setCurrentFloor(selectedFloor);
      
      // Update filtered sensors
      updateFilteredSensors(floorDataView, selectedFloor);
      
      // Switch to 2D orthographic view for floor plans
      if (selectedFloor && viewer) {
        await switch2DFloorView(selectedFloor);
      } else if (viewer) {
        // Return to 3D view when no floor selected
        await switch3DView();
      }
      
      onFloorChanged?.(selectedFloor);
      
    } catch (error) {
      console.error('❌ Error selecting floor:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const switch2DFloorView = async (floor: FloorData) => {
    if (!viewer) return;
    
    console.log(`📐 Switching to 2D view for ${floor.name}`);
    // Set up 2D orthographic view for the selected floor
    const camera = viewer.getCamera();
    const bbox = viewer.model.getBoundingBox();
    
    // Calculate floor center and appropriate camera position
    const floorCenter = {
      x: (bbox.min.x + bbox.max.x) / 2,
      y: (bbox.min.y + bbox.max.y) / 2,
      z: floor ? (floor.zMin + floor.zMax) / 2 : (bbox.min.z + bbox.max.z) / 2
    };
    
    // Calculate optimal camera positioning for angled top view
    const buildingWidth = bbox.max.x - bbox.min.x;
    const buildingDepth = bbox.max.y - bbox.min.y;
    const maxDimension = Math.max(buildingWidth, buildingDepth);
    const cameraDistance = maxDimension * 0.8;
    
    // Set camera for extreme left-side adjacent view with zoom
    // Position camera further left and slightly closer
    camera.position.set(
      floorCenter.x - cameraDistance * 2.0,  // Move even further to the left
      floorCenter.y - cameraDistance * 1.3,                         // Keep directly adjacent
      floorCenter.z + cameraDistance * 1.5   // Slightly lower for better angle
    );
    
    // Move camera slightly closer to the building
    camera.position.normalize().multiplyScalar(maxDimension * 0.7);
    
    camera.target.set(
      floorCenter.x,
      floorCenter.y,
      floorCenter.z
    );
    
    // Set up vector for angled view
    camera.up.set(0, 0, 1); // Z-up for better angled perspective
    
    // Switch to perspective view for better angled visualization
    viewer.setViewType(Autodesk.Viewing.CAMERA_TYPE.PERSPECTIVE);
    
    // Apply camera changes using correct API
    viewer.navigation.setCamera(camera);
    
    // Set appropriate field of view and fit to view
    setTimeout(() => {
      // Set field of view for better perspective
      camera.fov = 45; // Standard field of view for good perspective
      viewer.navigation.setCamera(camera);
      
      // Fit to view with less padding for a more zoomed-in view
      viewer.fitToView(null, 1.0); // No padding for maximum zoom
    }, 200);
    
    // Apply camera changes immediately
    viewer.navigation.setCamera(camera);
    viewer.impl.invalidate(true);
    
    // Hide model elements that are not on this floor (optional)
    await hideNonFloorElements(floor);
    
    console.log(`✅ Switched to 2D view for ${floor.name}`);
  };

  const switch3DView = async () => {
    if (!viewer) return;
    
    console.log('🎯 Switching to 3D view');
    
    try {
      // Show all model elements
      viewer.showAll();
      
      // Switch back to perspective view
      viewer.setViewType(Autodesk.Viewing.CAMERA_TYPE.PERSPECTIVE);
      
      // Fit to view to show entire model
      viewer.fitToView();
      
      console.log('✅ Switched to 3D view');
      
    } catch (error) {
      console.error('❌ Error switching to 3D view:', error);
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
    <div className="space-y-6">
      {/* Floor Selection */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2 text-white">
            <Building2 className="h-5 w-5" />
            Floor Selection
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleSensorVisibility}
              className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors text-gray-300"
              title={showSensors ? "Hide Sensors" : "Show Sensors"}
            >
              {showSensors ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 gap-2">
          {/* All Floors Option */}
          <button
            onClick={() => handleFloorSelect(null)}
            disabled={isLoading}
            className={`p-3 rounded-lg border text-left transition-colors ${
              !currentFloor
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'bg-gray-700 border-gray-600 hover:bg-gray-600 text-gray-200'
            } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">All Floors (3D View)</div>
                <div className="text-sm text-gray-400">
                  {filteredSensors.size} sensors total
                </div>
              </div>
              <Layers className="h-4 w-4" />
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
                disabled={isLoading}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  currentFloor?.id === floor.id
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-gray-700 border-gray-600 hover:bg-gray-600 text-gray-200'
                } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{floor.name}</div>
                    <div className="text-sm text-gray-400">
                      Level {floor.levelIndex} • Z: {floor.zMin.toFixed(1)}m - {floor.zMax.toFixed(1)}m
                      {currentFloor?.id === floor.id && ` • ${floorSensors} sensors`}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {floor.levelIndex > 0 && <ArrowUp className="h-4 w-4" />}
                    {floor.levelIndex < 0 && <ArrowDown className="h-4 w-4" />}
                    <Building2 className="h-4 w-4" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Floor Information */}
      {currentFloor && (
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
          <h4 className="font-semibold text-blue-800 mb-2">Current Floor: {currentFloor.name}</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-blue-600">Level Index:</span> {currentFloor.levelIndex}
            </div>
            <div>
              <span className="text-blue-600">Z Range:</span> {currentFloor.zMin.toFixed(1)}m - {currentFloor.zMax.toFixed(1)}m
            </div>
            <div>
              <span className="text-blue-600">Filtered Sensors:</span> {filteredSensors.size}
            </div>
            <div>
              <span className="text-blue-600">View Mode:</span> 2D Orthographic
            </div>
          </div>
        </div>
      )}

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
