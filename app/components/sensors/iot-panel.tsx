"use client";

import React, { useState, useEffect } from "react";
import { useSensorContext, SENSOR_TYPES } from "../../context/sensor-context";

const SENSOR_TYPE_COLORS = {
  "Temp & Hum": "bg-red-500",
  "CO2": "bg-green-500", 
  "Light": "bg-yellow-400",
  "FV": "bg-blue-500",
  "Seismic and accelerometric": "bg-purple-500",
  "Energy consumption": "bg-teal-500",
};

interface IoTPanelProps {
  onInsertSensor?: (sensorType: string | null) => void;
  insertMode?: string | null;
  onSensorClick?: (sensorId: string) => void;
  wireframeMode?: boolean;
  onWireframeModeChange?: (wireframe: boolean) => void;
  // When a sensor is selected in the 3D viewer, only that sensor should be shown
  selectedSensorIdFromViewer?: string | null;
}

export function IoTPanel({ onInsertSensor, insertMode, onSensorClick, wireframeMode, onWireframeModeChange, selectedSensorIdFromViewer }: IoTPanelProps) {
  const [mode, setMode] = useState<"all" | "insert">("all");
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [showMoreInfo, setShowMoreInfo] = useState<string | null>(null);
  const [showInfoDetail, setShowInfoDetail] = useState<string | null>(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState<string | null>(null);
  
  // Use sensor context
  const {
    sensors,
    selectedSensor,
    isPlacementMode,
    placementSensorType,
    visibleSensorTypes,
    filteredSensorType,
    loading,
    error,
    selectSensor,
    enterPlacementMode,
    exitPlacementMode,
    toggleSensorTypeVisibility,
    filterSensorsByType,
    getFilteredSensors,
    removeSensor,
    showViewerOverlay
  } = useSensorContext();

  // Reset selectedType and mode when insertMode is exited
  useEffect(() => {
    if (insertMode === null) {
      setSelectedType(null);
      setMode("all");
      exitPlacementMode();
    }
  }, [insertMode, exitPlacementMode]);

  // Handle sensor type selection for insertion
  const handleSensorTypeSelect = (sensorType: string) => {
    if (mode === "insert") {
      setSelectedType(sensorType);
      enterPlacementMode(sensorType);
      if (onInsertSensor) {
        onInsertSensor(sensorType);
      }
    } else {
      // Filter sensors by type in "all" mode
      filterSensorsByType(filteredSensorType === sensorType ? null : sensorType);
    }
  };

  // Function to actually trigger wireframe mode (like clicking the button)
  const triggerWireframeMode = () => {
    console.log('[IoTPanel] Triggering ACTUAL wireframe mode function');
    onWireframeModeChange?.(true);
    // Force a small delay to ensure the wireframe rendering processes
    setTimeout(() => {
      console.log('[IoTPanel] Wireframe mode should now be active in viewer');
      // Double trigger to ensure it's applied
      onWireframeModeChange?.(true);
    }, 250);
  };

  // Function to actually trigger solid mode (like clicking the button)  
  const triggerSolidMode = () => {
    console.log('[IoTPanel] Triggering ACTUAL solid mode function');
    onWireframeModeChange?.(false);
    // Small delay for consistency
    setTimeout(() => {
      onWireframeModeChange?.(false);
    }, 100);
  };

  // Handle mode change
  const handleModeChange = (newMode: "all" | "insert") => {
    setMode(newMode);
    if (newMode === "all") {
      setSelectedType(null);
      exitPlacementMode();
      if (onInsertSensor) {
        onInsertSensor(null);
      }
      // Switch to wireframe mode when entering "All sensors" mode for better sensor visibility
      console.log('[IoTPanel] Switching to wireframe mode (All sensors mode)');
      setTimeout(() => {
        triggerWireframeMode();
      }, 100); // Small delay to ensure mode change is processed
    } else if (newMode === "insert") {
      // Switch to solid mode when entering insert mode for better precision
      console.log('[IoTPanel] Switching to solid mode (Insert mode)');
      setTimeout(() => {
        triggerSolidMode();
      }, 100); // Small delay to ensure mode change is processed
    }
  };

  // Get filtered sensors for display
  let displaySensors = getFilteredSensors();
  if (selectedSensorIdFromViewer) {
    const clicked = sensors.find(s => s.id === selectedSensorIdFromViewer);
    displaySensors = clicked ? [clicked] : [];
  }

  return (
    <div className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-800 flex flex-col items-center">
        <h2 className="text-xl font-bold text-white mb-3">IoT</h2>
        <div className="flex gap-3 w-full mb-4">
          <button
            className={`flex-1 py-2 px-3 text-sm rounded-md font-medium shadow transition ${mode === "all" ? "bg-blue-600 text-white" : "bg-gray-700 text-blue-300 hover:bg-gray-600"}`}
            onClick={() => handleModeChange("all")}
          >
            All sensors
          </button>
          <button
            className={`flex-1 py-2 px-3 text-sm rounded-md font-medium shadow transition ${mode === "insert" ? "bg-blue-600 text-white" : "bg-gray-700 text-blue-300 hover:bg-gray-600"}`}
            onClick={() => handleModeChange("insert")}
          >
            Insert new sensor
          </button>
        </div>
        
        {/* Wireframe Toggle */}
        <div className="w-full mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-300 font-medium">View Mode</span>
            <span className="text-xs text-gray-400">
              {wireframeMode ? "Wireframe" : "Solid"}
            </span>
          </div>
          <div className="flex gap-2 w-full">
            <button
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-200 ${
                wireframeMode 
                  ? "bg-blue-600 text-white shadow-md" 
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
              onClick={() => {
                console.log('[IoTPanel] Wireframe button clicked');
                triggerWireframeMode();
              }}
              title={"Wireframe mode - Shows model structure for better sensor visibility"}
            >
              🔲 Wireframe
            </button>
            <button
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-200 ${
                !wireframeMode 
                  ? "bg-blue-600 text-white shadow-md" 
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
              onClick={() => {
                console.log('[IoTPanel] Solid button clicked');
                triggerSolidMode();
              }}
              title="Solid mode - Shows complete model appearance"
            >
              🏗️ Solid
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-2 w-full mb-2">
          {SENSOR_TYPES.map((type) => {
            const isSelected = mode === "insert" ? selectedType === type.name : filteredSensorType === type.name;
            const colorClass = SENSOR_TYPE_COLORS[type.name as keyof typeof SENSOR_TYPE_COLORS] || "bg-gray-500";
            
            return (
              <button
                key={type.name}
                className={`py-2 px-1 rounded text-xs font-medium border transition text-center truncate ${
                  isSelected 
                    ? `${colorClass} text-white border-blue-400` 
                    : "bg-gray-800 text-gray-200 border-gray-700 hover:bg-blue-800 hover:border-blue-500"
                }`}
                title={type.name}
                onClick={() => handleSensorTypeSelect(type.name)}
              >
                {type.name.length > 18 ? type.name.split(" ")[0] : type.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col px-4">
        <style jsx>{`
          .iot-scrollbar::-webkit-scrollbar {
            width: 6px;
          }
          .iot-scrollbar::-webkit-scrollbar-thumb {
            background: #2563eb; /* Tailwind blue-600 */
            border-radius: 6px;
          }
          .iot-scrollbar::-webkit-scrollbar-track {
            background: #111827; /* Tailwind gray-900 */
          }
          .iot-scrollbar {
            scrollbar-width: thin;
            scrollbar-color: #2563eb #111827;
          }
        `}</style>
        {mode === "all" ? (
          <div className="flex-1 px-2 overflow-y-auto iot-scrollbar">
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-semibold text-white">
                  {filteredSensorType ? `${filteredSensorType} Sensors` : "All Sensors"}
                </h3>
                <span className="text-sm text-gray-400">{displaySensors.length} sensors</span>
              </div>
              {filteredSensorType && (
                <button
                  onClick={() => filterSensorsByType(null)}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  Clear filter
                </button>
              )}
            </div>
            
            {loading ? (
              <div className="text-center text-gray-400 py-8">
                Loading sensors...
              </div>
            ) : error ? (
              <div className="text-center text-red-400 py-8">
                Error: {error}
              </div>
            ) : displaySensors.length === 0 ? (
              <div className="text-center text-gray-400 py-8">
                {filteredSensorType ? `No ${filteredSensorType} sensors found` : "No sensors found"}
              </div>
            ) : (
              <div className="space-y-2">
                {displaySensors.map((sensor) => {
                  const sensorTypeData = SENSOR_TYPES.find(t => t.name === sensor.type);
                  const colorClass = SENSOR_TYPE_COLORS[sensor.type as keyof typeof SENSOR_TYPE_COLORS] || "bg-gray-500";
                  
                  return (
                    <div
                      key={sensor.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedSensor?.id === sensor.id
                          ? "border-blue-400 bg-blue-900/30"
                          : "border-gray-700 bg-gray-800 hover:border-gray-600 hover:bg-gray-750"
                      }`}
                      onClick={() => {
                        selectSensor(sensor);
                        if (onSensorClick) {
                          onSensorClick(sensor.id);
                        }
                      }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${colorClass}`}></div>
                          <span className="text-white font-medium text-sm">{sensor.name}</span>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded ${
                          sensor.status === "Online" ? "bg-green-600 text-green-100" :
                          sensor.status === "Warning" ? "bg-yellow-600 text-yellow-100" :
                          "bg-red-600 text-red-100"
                        }`}>
                          {sensor.status}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 space-y-1">
                        <div>Type: {sensor.type}</div>
                        <div>Value: {sensor.value}</div>
                        <div>Room: {sensor.room}</div>
                        <div>Battery: {sensor.batteryLevel}%</div>
                      </div>
                      {selectedSensor?.id === sensor.id && (
                        <div className="mt-2 pt-2 border-t border-gray-600">
                          <div className="flex justify-between items-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowMoreInfo(showMoreInfo === sensor.id ? null : sensor.id);
                              }}
                              className="text-xs text-blue-400 hover:text-blue-300"
                            >
                              More Info
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowRemoveConfirm(sensor.id);
                              }}
                              className="text-xs text-red-400 hover:text-red-300"
                            >
                              Remove Sensor
                            </button>
                          </div>
                          
                          {/* More Info Menu */}
                          {showMoreInfo === sensor.id && (
                            <div className="mt-2 p-2 bg-gradient-to-br from-gray-800 to-gray-900 rounded-md border border-gray-600 shadow">
                              <div className="space-y-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    showViewerOverlay(sensor, 'info');
                                    setShowMoreInfo(null);
                                  }}
                                  className="flex items-center gap-1 w-full text-left text-xs text-gray-300 hover:text-white py-1 px-2 hover:bg-gradient-to-r hover:from-blue-600 hover:to-indigo-600 rounded-md transition-all duration-200"
                                >
                                  <span className="font-medium">Info</span>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    showViewerOverlay(sensor, 'graphs');
                                  }}
                                  className="flex items-center gap-1 w-full text-left text-xs text-gray-300 hover:text-white py-1 px-2 hover:bg-gradient-to-r hover:from-green-600 hover:to-emerald-600 rounded-md transition-all duration-200"
                                >
                                  <span className="font-medium">Graphs</span>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // Always open 'statistics' overlay; viewer will decide which full-screen dashboard to show
                                    showViewerOverlay(sensor, 'statistics');
                                  }}
                                  className="flex items-center gap-1 w-full text-left text-xs text-gray-300 hover:text-white py-1 px-2 hover:bg-gradient-to-r hover:from-purple-600 hover:to-violet-600 rounded-md transition-all duration-200"
                                >
                                  <span className="font-medium">Statistics</span>
                                </button>
                              </div>
                            </div>
                          )}
                          
                          {/* Detailed Info Panel */}
                          {showInfoDetail === sensor.id && (
                            <div className="mt-3 p-4 bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg border border-gray-600 shadow-lg">
                              <div className="flex justify-between items-center mb-4">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                                    <span className="text-white text-xs font-bold">i</span>
                                  </div>
                                  <h4 className="text-sm font-semibold text-white">Sensor Information</h4>
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowInfoDetail(null);
                                  }}
                                  className="w-6 h-6 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                                >
                                  ✕
                                </button>
                              </div>
                              <div className="space-y-3 text-sm">
                                <div className="flex items-center justify-between p-2 bg-gray-900 border border-gray-700 rounded-lg">
                                  <span className="font-semibold text-gray-300">Name:</span>
                                  <span className="text-white">{sensor.name}</span>
                                </div>
                                <div className="flex items-center justify-between p-2 bg-gray-900 border border-gray-700 rounded-lg">
                                  <span className="font-semibold text-gray-300">Code:</span>
                                  <span className="text-white">{sensor.code || <span className="italic text-gray-500">Not specified</span>}</span>
                                </div>
                                <div className="flex items-center justify-between p-2 bg-gray-900 border border-gray-700 rounded-lg">
                                  <span className="font-semibold text-gray-300">Mark:</span>
                                  <span className="text-white">{sensor.mark || <span className="italic text-gray-500">Not specified</span>}</span>
                                </div>
                                <div className="flex items-center justify-between p-2 bg-gray-900 border border-gray-700 rounded-lg">
                                  <span className="font-semibold text-gray-300">Model:</span>
                                  <span className="text-white">{sensor.model || <span className="italic text-gray-500">Not specified</span>}</span>
                                </div>
                                <div className="flex items-center justify-between p-2 bg-gray-900 border border-gray-700 rounded-lg">
                                  <span className="font-semibold text-gray-300">Room:</span>
                                  <span className="text-white">{sensor.room}</span>
                                </div>
                                <div className="flex items-center justify-between p-2 bg-gray-900 border border-gray-700 rounded-lg">
                                  <span className="font-semibold text-gray-300">Link:</span>
                                  <span className="text-blue-400 hover:text-blue-300 cursor-pointer underline decoration-dotted">
                                    {sensor.link || <span className="italic text-gray-500 no-underline">Not specified</span>}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}
                          
                          {/* Remove Confirmation Dialog */}
                          {showRemoveConfirm === sensor.id && (
                            <div className="mt-3 p-4 bg-gradient-to-br from-red-900/40 to-red-800/40 border border-red-500/50 rounded-lg shadow-lg backdrop-blur-sm">
                              <div className="flex items-center gap-2 mb-3">
                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center">
                                  <span className="text-white text-xs font-bold">!</span>
                                </div>
                                <div className="text-sm font-semibold text-white">Are you sure?</div>
                              </div>
                              <p className="text-xs text-gray-300 mb-4">This action cannot be undone. The sensor will be permanently removed.</p>
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowRemoveConfirm(null);
                                  }}
                                  className="px-3 py-2 bg-gradient-to-r from-gray-600 to-gray-700 text-gray-300 hover:from-gray-500 hover:to-gray-600 hover:text-white rounded-lg text-xs font-medium transition-all duration-200 shadow-sm"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeSensor(sensor.id);
                                    setShowRemoveConfirm(null);
                                  }}
                                  className="px-3 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white hover:from-red-500 hover:to-red-600 rounded-lg text-xs font-medium transition-all duration-200 shadow-sm"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col justify-center text-center text-gray-400">
            <p className="mb-4">Select a sensor type above, then click in the model to place it.</p>
            {selectedType && (
              <div className="mb-4">
                <p className="text-blue-400 mb-2">Placing: <span className="font-semibold">{selectedType}</span></p>
                <button
                  onClick={() => handleModeChange("all")}
                  className="text-sm text-gray-500 hover:text-gray-400"
                >
                  Cancel placement
                </button>
              </div>
            )}
            {isPlacementMode && (
              <div className="text-green-400 text-sm">
                ✓ Placement mode active - click in the model
              </div>
            )}
          </div>
        )}
      </div>
      
    </div>
  );
}

export default IoTPanel;
