"use client";

import React, { useState } from "react";
import { SENSOR_CONFIGS } from "./forge-dataviz-extension";

interface SensorPaletteProps {
  onSensorTypeToggle?: (sensorType: string, visible: boolean) => void;
  onEnterInsertMode?: (sensorType: string) => void;
  onExitInsertMode?: () => void;
  visibleSensorTypes?: Set<string>;
  isInsertMode?: boolean;
  currentInsertType?: string | null;
}

const SensorPalette: React.FC<SensorPaletteProps> = ({
  onSensorTypeToggle,
  onEnterInsertMode,
  onExitInsertMode,
  visibleSensorTypes = new Set(Object.keys(SENSOR_CONFIGS)),
  isInsertMode = false,
  currentInsertType = null,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [draggedType, setDraggedType] = useState<string | null>(null);

  // Handle drag start for sensor types
  const handleDragStart = (event: React.DragEvent<HTMLDivElement>, sensorType: string) => {
    event.dataTransfer.setData('sensorType', sensorType);
    event.dataTransfer.effectAllowed = 'copy';
    setDraggedType(sensorType);

    // Create a visual drag image
    const dragImage = document.createElement('div');
    dragImage.innerHTML = SENSOR_CONFIGS[sensorType as keyof typeof SENSOR_CONFIGS].icon;
    dragImage.style.fontSize = '24px';
    dragImage.style.position = 'absolute';
    dragImage.style.top = '-1000px';
    document.body.appendChild(dragImage);

    event.dataTransfer.setDragImage(dragImage, 12, 12);

    setTimeout(() => {
      document.body.removeChild(dragImage);
    }, 0);
  };

  const handleDragEnd = () => {
    setDraggedType(null);
  };

  // Handle visibility toggle
  const handleToggleVisibility = (sensorType: string) => {
    const isVisible = visibleSensorTypes.has(sensorType);
    if (onSensorTypeToggle) {
      onSensorTypeToggle(sensorType, !isVisible);
    }
  };

  // Handle insert mode
  const handleInsertMode = (sensorType: string) => {
    if (isInsertMode && currentInsertType === sensorType) {
      onExitInsertMode?.();
    } else {
      onEnterInsertMode?.(sensorType);
    }
  };

  return (
    <div className="sensor-palette-container fixed right-4 top-20 z-50 bg-gray-800 rounded-lg shadow-xl border border-gray-600 min-w-[280px]">
      {/* Header */}
      <div
        className="flex items-center justify-between p-3 border-b border-gray-600 cursor-pointer hover:bg-gray-700"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h3 className="text-white font-semibold flex items-center">
          <span className="mr-2">🎛️</span>
          Sensor Palette
        </h3>
        <div className="text-white text-sm">
          {isExpanded ? '▼' : '▲'}
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="p-3">
          {/* Instructions */}
          <div className="mb-4 p-2 bg-blue-900/30 rounded border border-blue-500/30">
            <p className="text-blue-200 text-xs">
              <strong>Usage:</strong><br/>
              • Drag & drop sensors to 3D model<br/>
              • Click 📍 to enter placement mode<br/>
              • Click 👁️ to toggle visibility
            </p>
          </div>

          {/* Global Controls */}
          <div className="mb-4 flex gap-2">
            <button
              onClick={() => {
                Object.keys(SENSOR_CONFIGS).forEach(type => {
                  onSensorTypeToggle?.(type, true);
                });
              }}
              className="flex-1 px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded"
            >
              Show All
            </button>
            <button
              onClick={() => {
                Object.keys(SENSOR_CONFIGS).forEach(type => {
                  onSensorTypeToggle?.(type, false);
                });
              }}
              className="flex-1 px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded"
            >
              Hide All
            </button>
          </div>

          {/* Exit Insert Mode Button */}
          {isInsertMode && (
            <div className="mb-4">
              <button
                onClick={onExitInsertMode}
                className="w-full px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded flex items-center justify-center"
              >
                <span className="mr-2">❌</span>
                Exit Placement Mode
              </button>
            </div>
          )}

          {/* Sensor Types List */}
          <div className="space-y-2">
            {Object.entries(SENSOR_CONFIGS).map(([sensorType, config]) => {
              const isVisible = visibleSensorTypes.has(sensorType);
              const isCurrentInsert = isInsertMode && currentInsertType === sensorType;
              const isDragging = draggedType === sensorType;

              return (
                <div
                  key={sensorType}
                  className={`sensor-item border rounded p-2 transition-all ${
                    isDragging
                      ? 'border-blue-400 bg-blue-900/30'
                      : isCurrentInsert
                      ? 'border-yellow-400 bg-yellow-900/30'
                      : isVisible
                      ? 'border-gray-500 bg-gray-700'
                      : 'border-gray-600 bg-gray-800 opacity-50'
                  }`}
                >
                  {/* Draggable Sensor Icon */}
                  <div
                    draggable={true}
                    onDragStart={(e) => handleDragStart(e, sensorType)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center mb-2 cursor-grab active:cursor-grabbing ${
                      isDragging ? 'opacity-50' : ''
                    }`}
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white mr-3"
                      style={{ backgroundColor: config.color }}
                    >
                      <span className="text-xs font-bold">
                        {sensorType.charAt(0)}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="text-white font-medium text-sm">
                        {sensorType}
                      </div>
                      <div className="text-gray-400 text-xs">
                        {config.icon} {config.unit}
                      </div>
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="flex gap-1">
                    {/* Placement Mode Button */}
                    <button
                      onClick={() => handleInsertMode(sensorType)}
                      className={`flex-1 px-2 py-1 rounded text-xs transition-colors ${
                        isCurrentInsert
                          ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                          : 'bg-gray-600 hover:bg-gray-500 text-white'
                      }`}
                      title="Enter placement mode"
                    >
                      📍 {isCurrentInsert ? 'Placing...' : 'Place'}
                    </button>

                    {/* Visibility Toggle */}
                    <button
                      onClick={() => handleToggleVisibility(sensorType)}
                      className={`px-2 py-1 rounded text-xs transition-colors ${
                        isVisible
                          ? 'bg-green-600 hover:bg-green-700 text-white'
                          : 'bg-gray-600 hover:bg-gray-500 text-gray-300'
                      }`}
                      title={isVisible ? 'Hide sensors' : 'Show sensors'}
                    >
                      {isVisible ? '👁️' : '🙈'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="mt-4 pt-3 border-t border-gray-600">
            <div className="text-gray-400 text-xs text-center">
              Drag sensors to BIM model or use placement mode
            </div>
          </div>
        </div>
      )}

      {/* Drag feedback */}
      {draggedType && (
        <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-60">
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <div className="bg-black/70 text-white px-3 py-2 rounded text-sm">
              Drag {draggedType} to 3D model
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SensorPalette;
