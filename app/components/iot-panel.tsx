"use client";

import React, { useState, useEffect } from "react";

const SENSOR_TYPES = [
  { name: "Temperature", color: "bg-red-500" },
  { name: "CO2", color: "bg-green-500" },
  { name: "Light", color: "bg-yellow-400" },
  { name: "Humidity", color: "bg-blue-500" },
  { name: "Seismic and accelerometric", color: "bg-purple-500" },
  { name: "Energy consumption", color: "bg-teal-500" },
];

interface IoTPanelProps {
  onInsertSensor?: (sensorType: string | null) => void;
}

export function IoTPanel({ onInsertSensor }: IoTPanelProps) {
  const [mode, setMode] = useState<"all" | "insert">("all");
  const [selectedType, setSelectedType] = useState<string | null>(null);

  // Notify parent when insert mode/type changes
  useEffect(() => {
    if (mode === "insert" && selectedType && onInsertSensor) {
      onInsertSensor(selectedType);
    } else if (onInsertSensor) {
      onInsertSensor(null);
    }
    // Only run when mode or selectedType changes
  }, [mode, selectedType, onInsertSensor]);

  return (
    <div className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-800 flex flex-col items-center">
        <h2 className="text-2xl font-bold text-white mb-4 tracking-wide">IoT</h2>
        <div className="flex gap-4 w-full mb-4">
          <button
            className={`flex-1 py-2 rounded-lg font-semibold shadow transition ${mode === "all" ? "bg-blue-600 text-white" : "bg-gray-700 text-blue-300 hover:bg-gray-600"}`}
            onClick={() => { setMode("all"); setSelectedType(null); }}
          >
            All sensors
          </button>
          <button
            className={`flex-1 py-2 rounded-lg font-semibold shadow transition ${mode === "insert" ? "bg-blue-600 text-white" : "bg-gray-700 text-blue-300 hover:bg-gray-600"}`}
            onClick={() => setMode("insert")}
          >
            Insert new sensor
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2 w-full mb-2">
          {SENSOR_TYPES.map((type) => (
            <button
              key={type.name}
              className={`py-2 px-1 rounded text-xs font-medium border transition text-center truncate ${selectedType === type.name ? `${type.color} text-white border-blue-400` : "bg-gray-800 text-gray-200 border-gray-700 hover:bg-blue-800 hover:border-blue-500"}`}
              title={type.name}
              onClick={() => mode === "insert" ? setSelectedType(selectedType === type.name ? null : type.name) : undefined}
              disabled={mode !== "insert"}
            >
              {type.name.length > 18 ? type.name.split(" ")[0] : type.name}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        {mode === "all" ? (
          <div className="w-full text-center text-gray-400">
            {/* Placeholder for sensor list filtered by selectedType */}
            <p className="mt-8">All sensors will be listed here.<br />
            {selectedType ? `Filtering by: ${selectedType}` : ""}</p>
          </div>
        ) : (
          <div className="w-full text-center text-gray-400">
            {/* Placeholder for insert new sensor UI */}
            <p className="mt-8">Select a sensor type above, then click in the model to place it.</p>
            {selectedType && <p className="mt-2 text-blue-400">Placing: <span className="font-semibold">{selectedType}</span></p>}
          </div>
        )}
      </div>

      {/* Footer with BIM Logo */}
      <div className="p-4 border-t border-gray-800 flex justify-center">
        <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg px-6 py-3 flex items-center gap-3 shadow-lg">
          <span className="text-white font-bold text-lg tracking-wider">BIM Pro</span>
        </div>
      </div>
    </div>
  );
}

export default IoTPanel;
