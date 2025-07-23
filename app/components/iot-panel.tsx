"use client";

import React, { useState } from "react";
import {
  Thermometer,
  Cloudy,
  Lightbulb,
  Droplets,
  Zap,
  Activity,
  Eye,
  EyeOff,
  Plus,
  Search,
  MapPin,
  Clock,
  Battery,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useSensorContext } from "../context/sensor-context";

const SENSOR_TYPES = [
  {
    name: "Temperature",
    icon: Thermometer,
    color: "text-red-400",
    bgColor: "bg-red-500/20",
    hoverColor: "hover:bg-red-500/30",
  },
  {
    name: "CO2",
    icon: Cloudy,
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/20",
    hoverColor: "hover:bg-yellow-500/30",
  },
  {
    name: "Light",
    icon: Lightbulb,
    color: "text-amber-400",
    bgColor: "bg-amber-500/20",
    hoverColor: "hover:bg-amber-500/30",
  },
  {
    name: "Humidity",
    icon: Droplets,
    color: "text-blue-400",
    bgColor: "bg-blue-500/20",
    hoverColor: "hover:bg-blue-500/30",
  },
  {
    name: "Seismic and accelerometric",
    icon: Activity,
    color: "text-purple-400",
    bgColor: "bg-purple-500/20",
    hoverColor: "hover:bg-purple-500/30",
  },
  {
    name: "Energy consuption",
    icon: Zap,
    color: "text-green-400",
    bgColor: "bg-green-500/20",
    hoverColor: "hover:bg-green-500/30",
  },
];

interface IoTPanelProps {
  onInsertSensor: (sensorType: string) => void;
}

export function IoTPanel({ onInsertSensor }: IoTPanelProps) {
  const {
    sensors,
    selectedSensor,
    isPlacementMode,
    placementSensorType,
    visibleSensorTypes,
    selectSensor,
    enterPlacementMode,
    removeSensor,
    toggleSensorTypeVisibility,
    clearSelection,
  } = useSensorContext();

  const [view, setView] = useState<"all" | "insert">("all");
  const [selectedSensorType, setSelectedSensorType] = useState<string | null>(
    null,
  );
  const [searchTerm, setSearchTerm] = useState("");

  // Filter sensors based on search term and selected type
  const filteredSensors = sensors.filter((sensor) => {
    const matchesSearch =
      sensor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sensor.room.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedSensorType
      ? sensor.type === selectedSensorType
      : true;
    const isVisible = visibleSensorTypes.has(sensor.type);
    return matchesSearch && matchesType && isVisible;
  });

  // Get sensor type configuration
  const getSensorTypeConfig = (type: string) => {
    return SENSOR_TYPES.find((s) => s.name === type) || SENSOR_TYPES[0];
  };

  // Handle sensor insertion
  const handleInsertSensor = (sensorType: string) => {
    enterPlacementMode(sensorType);
    onInsertSensor(sensorType);
    setView("all"); // Switch back to all sensors view after insertion
  };

  // Handle sensor removal
  const handleRemoveSensor = () => {
    if (selectedSensor) {
      removeSensor(selectedSensor.id);
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "Online":
        return "text-green-400";
      case "Warning":
        return "text-yellow-400";
      case "Offline":
        return "text-red-400";
      default:
        return "text-gray-400";
    }
  };

  // Get battery color
  const getBatteryColor = (level: number) => {
    if (level > 50) return "text-green-400";
    if (level > 20) return "text-yellow-400";
    return "text-red-400";
  };

  return (
    <div className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col h-full">
      {/* Custom Scrollbar Style */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #374151; border-radius: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #2563eb; }
        .custom-scrollbar { scrollbar-width: thin; scrollbar-color: #374151 #1f2937; }
      `}</style>

      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white tracking-wide">
            IoT Dashboard
          </h2>
          {selectedSensor && (
            <button
              onClick={() => selectSensor(null)}
              className="text-gray-400 hover:text-white text-sm"
            >
              ← Back
            </button>
          )}
        </div>

        {!selectedSensor && (
          <>
            {/* Main Action Buttons */}
            <div className="flex w-full gap-2 mb-4">
              <button
                onClick={() => setView("all")}
                className={`flex-1 px-4 py-2 rounded-md border transition font-medium ${
                  view === "all"
                    ? "bg-blue-600 border-blue-500 text-white"
                    : "bg-gray-700 border-gray-600 hover:bg-gray-600 text-gray-300"
                }`}
              >
                All sensors
              </button>
              <button
                onClick={() => setView("insert")}
                className={`flex-1 px-4 py-2 rounded-md border transition font-medium ${
                  view === "insert"
                    ? "bg-blue-600 border-blue-500 text-white"
                    : "bg-gray-700 border-gray-600 hover:bg-gray-600 text-gray-300"
                }`}
              >
                Insert new sensor
              </button>
            </div>

            {/* Search Bar */}
            {view === "all" && (
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search sensors..."
                  className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            )}

            {/* Placement Mode Indicator */}
            {isPlacementMode && (
              <div className="mb-4 p-3 bg-blue-600/20 border border-blue-500/50 rounded-lg">
                <div className="text-center">
                  <p className="text-blue-300 text-sm font-semibold mb-1">
                    🎯 Sensor Placement Mode Active
                  </p>
                  <p className="text-blue-200 text-xs mb-2">
                    Placing: {placementSensorType} sensor
                  </p>
                  <p className="text-blue-300 text-xs">
                    Click anywhere on the 3D model to place the sensor
                  </p>
                  <p className="text-gray-400 text-xs mt-1">
                    Press ESC to cancel
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Sensor Type Filter Buttons (below main buttons) */}
      {!selectedSensor && view === "all" && (
        <div className="px-4 py-3 border-b border-gray-700">
          <div className="grid grid-cols-2 gap-2">
            {SENSOR_TYPES.map((sensorType) => {
              const isVisible = visibleSensorTypes.has(sensorType.name);
              const sensorCount = sensors.filter(
                (s) => s.type === sensorType.name,
              ).length;
              const isSelected = selectedSensorType === sensorType.name;

              return (
                <button
                  key={sensorType.name}
                  onClick={() => {
                    if (isSelected) {
                      setSelectedSensorType(null);
                    } else {
                      setSelectedSensorType(sensorType.name);
                    }
                  }}
                  className={`p-2 rounded-lg border transition-all flex items-center gap-2 text-xs ${
                    isSelected
                      ? `${sensorType.bgColor} border-current ${sensorType.color} shadow-sm`
                      : "bg-gray-700 border-gray-600 hover:bg-gray-600 text-gray-300"
                  }`}
                >
                  <sensorType.icon className="w-4 h-4" />
                  <span className="flex-1 text-left truncate">
                    {sensorType.name === "Seismic and accelerometric"
                      ? "Seismic"
                      : sensorType.name === "Energy consuption"
                        ? "Energy"
                        : sensorType.name}
                  </span>
                  <span className="text-xs opacity-75">({sensorCount})</span>
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSensorTypeVisibility(sensorType.name);
                    }}
                    className="ml-1 hover:bg-gray-600 rounded p-0.5 cursor-pointer"
                  >
                    {isVisible ? (
                      <Eye className="w-3 h-3" />
                    ) : (
                      <EyeOff className="w-3 h-3" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {selectedSensor ? (
          // Sensor Details View
          <div className="p-4">
            <div className="bg-gray-700 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-3 mb-3">
                {React.createElement(
                  getSensorTypeConfig(selectedSensor.type).icon,
                  {
                    className: `w-6 h-6 ${getSensorTypeConfig(selectedSensor.type).color}`,
                  },
                )}
                <div>
                  <h3 className="text-white font-semibold">
                    {selectedSensor.name}
                  </h3>
                  <p className="text-gray-400 text-sm">{selectedSensor.type}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">
                    {selectedSensor.value}
                  </p>
                  <p className="text-gray-400 text-xs">Current Value</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    {selectedSensor.status === "Online" ? (
                      <Wifi className="w-4 h-4 text-green-400" />
                    ) : (
                      <WifiOff className="w-4 h-4 text-red-400" />
                    )}
                    <p
                      className={`font-semibold ${getStatusColor(selectedSensor.status)}`}
                    >
                      {selectedSensor.status}
                    </p>
                  </div>
                  <p className="text-gray-400 text-xs">Status</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">Location</span>
                  <div className="flex items-center gap-1 text-white text-sm">
                    <MapPin className="w-3 h-3" />
                    {selectedSensor.room}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">Position</span>
                  <span className="text-white text-sm">
                    X:{selectedSensor.position.x} Y:{selectedSensor.position.y}{" "}
                    Z:{selectedSensor.position.z}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">Battery</span>
                  <div className="flex items-center gap-1">
                    <Battery
                      className={`w-3 h-3 ${getBatteryColor(selectedSensor.batteryLevel)}`}
                    />
                    <span
                      className={`text-sm ${getBatteryColor(selectedSensor.batteryLevel)}`}
                    >
                      {selectedSensor.batteryLevel}%
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">Last Update</span>
                  <div className="flex items-center gap-1 text-white text-sm">
                    <Clock className="w-3 h-3" />
                    {selectedSensor.lastUpdate}
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors">
                View in Model
              </button>
              <button className="w-full bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-lg transition-colors">
                Configure Settings
              </button>
              <button
                onClick={handleRemoveSensor}
                className="w-full bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg transition-colors"
              >
                Remove Sensor
              </button>
            </div>
          </div>
        ) : view === "insert" ? (
          // Insert New Sensor View
          <div className="p-4">
            <h3 className="text-md font-semibold text-gray-200 mb-3">
              Select a sensor type to place:
            </h3>
            <div className="grid grid-cols-1 gap-3">
              {SENSOR_TYPES.map((sensor) => (
                <button
                  key={sensor.name}
                  onClick={() => handleInsertSensor(sensor.name)}
                  disabled={isPlacementMode}
                  className={`p-4 ${sensor.bgColor} rounded-lg border border-gray-600 text-white ${sensor.hoverColor} hover:border-gray-500 transition flex items-center gap-3 ${
                    isPlacementMode ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  <sensor.icon className={`w-6 h-6 ${sensor.color}`} />
                  <div className="text-left">
                    <span className="block font-medium">{sensor.name}</span>
                    <span className="text-xs text-gray-400">
                      {isPlacementMode
                        ? "Placement mode active"
                        : "Click to place in model"}
                    </span>
                  </div>
                  <Plus className="w-4 h-4 ml-auto opacity-50" />
                </button>
              ))}
            </div>
            {isPlacementMode && (
              <div className="mt-4 p-3 bg-yellow-600/20 border border-yellow-500/50 rounded-lg">
                <p className="text-yellow-300 text-sm text-center">
                  Complete current placement or press ESC to select another
                  sensor type
                </p>
              </div>
            )}
          </div>
        ) : (
          // All Sensors View
          <div className="p-4">
            {filteredSensors.length === 0 ? (
              <div className="text-center text-gray-400 py-8">
                <p>No sensors found.</p>
                {searchTerm && (
                  <p className="text-xs mt-2">
                    Try adjusting your search or filters.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredSensors.map((sensor) => {
                  const config = getSensorTypeConfig(sensor.type);
                  return (
                    <div
                      key={sensor.id}
                      onClick={() => selectSensor(sensor)}
                      className="p-3 rounded-lg border border-gray-600 hover:bg-gray-700 hover:border-gray-500 cursor-pointer transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${config.bgColor}`}>
                          <config.icon className={`w-4 h-4 ${config.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white font-medium text-sm truncate">
                            {sensor.name}
                          </h3>
                          <div className="flex items-center gap-2 mt-1 text-xs">
                            <span className="text-gray-400">{sensor.room}</span>
                            <span className="text-gray-600">•</span>
                            <span className={getStatusColor(sensor.status)}>
                              {sensor.status}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-semibold text-white block">
                            {sensor.value}
                          </span>
                          <div className="flex items-center gap-1 mt-1">
                            <Battery
                              className={`w-3 h-3 ${getBatteryColor(sensor.batteryLevel)}`}
                            />
                            <span
                              className={`text-xs ${getBatteryColor(sensor.batteryLevel)}`}
                            >
                              {sensor.batteryLevel}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer with BIM Logo */}
      {!selectedSensor && (
        <div className="p-4 border-t border-gray-700 text-center">
          <div className="flex items-center justify-center gap-2 text-gray-400">
            <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded flex items-center justify-center">
              <span className="text-white font-bold text-xs">BIM</span>
            </div>
            <span className="text-sm">BIM Viewer Pro</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default IoTPanel;
