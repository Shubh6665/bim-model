"use client";

import React, { useState, useEffect } from "react";
import { useSensorContext, SENSOR_TYPES } from "../context/sensor-context";

const SENSOR_TYPE_COLORS = {
  "Temperature": "bg-red-500",
  "CO2": "bg-green-500", 
  "Light": "bg-yellow-400",
  "Humidity": "bg-blue-500",
  "Seismic and accelerometric": "bg-purple-500",
  "Energy consumption": "bg-teal-500",
};

interface IoTPanelProps {
  onInsertSensor?: (sensorType: string | null) => void;
  insertMode?: string | null;
  onSensorClick?: (sensorId: string) => void;
  wireframeMode?: boolean;
  onWireframeModeChange?: (wireframe: boolean) => void;
}

export function IoTPanel({ onInsertSensor, insertMode, onSensorClick, wireframeMode, onWireframeModeChange }: IoTPanelProps) {
  const [mode, setMode] = useState<"all" | "insert">("all");
  const [selectedType, setSelectedType] = useState<string | null>(null);
  
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
    removeSensor
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
    }, 150);
  };

  // Function to actually trigger solid mode (like clicking the button)
  const triggerSolidMode = () => {
    console.log('[IoTPanel] Triggering ACTUAL solid mode function');
    onWireframeModeChange?.(false);
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
      // Switch back to wireframe mode when returning to "All sensors"
      console.log('[IoTPanel] Switching back to wireframe mode (All sensors)');
      triggerWireframeMode();
    } else if (newMode === "insert") {
      // Switch to solid mode when entering insert mode
      console.log('[IoTPanel] Switching to solid mode (Insert mode)');
      triggerSolidMode();
    }
  };

  // Get filtered sensors for display
  const displaySensors = getFilteredSensors();

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
                mode === "insert" 
                  ? "bg-gray-600 text-gray-400 cursor-not-allowed" // Disabled during insertion
                  : wireframeMode 
                    ? "bg-blue-600 text-white shadow-md" 
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
              onClick={() => mode !== "insert" && onWireframeModeChange?.(true)}
              disabled={mode === "insert"}
              title={mode === "insert" ? "Wireframe mode disabled during sensor insertion" : "Wireframe mode - Shows model structure for better sensor visibility"}
            >
              🔲 Wireframe
            </button>
            <button
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-200 ${
                !wireframeMode 
                  ? "bg-blue-600 text-white shadow-md" 
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
              onClick={() => onWireframeModeChange?.(false)}
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
                        <div>Value: {sensor.value} {sensorTypeData?.unit || ""}</div>
                        <div>Room: {sensor.room}</div>
                        <div>Battery: {sensor.batteryLevel}%</div>
                      </div>
                      {selectedSensor?.id === sensor.id && (
                        <div className="mt-2 pt-2 border-t border-gray-600">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeSensor(sensor.id);
                            }}
                            className="text-xs text-red-400 hover:text-red-300"
                          >
                            Remove Sensor
                          </button>
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

      {/* Footer with BIM Logo */}
      <div className="px-4 py-2 border-t border-gray-800 flex justify-center">
        <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg px-6 py-1 flex items-center gap-3 shadow-lg">
          <span className="text-white font-bold text-lg tracking-wider">BIM Pro</span>
        </div>
      </div>
    </div>
  );
}

export default IoTPanel;
