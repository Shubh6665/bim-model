"use client";

import React, { useState } from "react";
import {
  Search,
  Thermometer,
  Video,
  Wind,
  Lightbulb,
  Cloudy,
  MoreVertical,
} from "lucide-react";

// Mock data for IoT devices
const iotDevices = [
  {
    id: "1",
    name: "Living Room Thermostat",
    type: "Temperature",
    status: "Online",
    value: "23.5°C",
    icon: Thermometer,
    color: "text-orange-400",
  },
  {
    id: "2",
    name: "Main Door Camera",
    type: "Security",
    status: "Online",
    value: "Live",
    icon: Video,
    color: "text-blue-400",
  },
  {
    id: "3",
    name: "Kitchen CO₂ Sensor",
    type: "Air Quality",
    status: "Warning",
    value: "850 ppm",
    icon: Cloudy,
    color: "text-yellow-400",
  },
  {
    id: "4",
    name: "Bedroom Smart Light",
    type: "Lighting",
    status: "Offline",
    value: "Off",
    icon: Lightbulb,
    color: "text-gray-500",
  },
  {
    id: "5",
    name: "HVAC Air Flow Sensor",
    type: "Ventilation",
    status: "Online",
    value: "15 m/s",
    icon: Wind,
    color: "text-cyan-400",
  },
];

export function IoTPanel() {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredDevices = iotDevices.filter((device) =>
    device.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col">
       {/* Custom Scrollbar Style */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #374151; border-radius: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #2563eb; }
        .custom-scrollbar { scrollbar-width: thin; scrollbar-color: #374151 #1f2937; }
      `}</style>
      
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">IoT Devices</h2>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search devices..."
            className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Content List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
        {filteredDevices.map((device) => (
          <div
            key={device.id}
            className="p-3 rounded-lg border border-gray-600 hover:bg-gray-700 hover:border-gray-500 cursor-pointer transition-all flex items-center gap-4"
          >
            <div className={`p-2 rounded-full bg-gray-900/50 ${device.color}`}>
              <device.icon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-medium text-sm truncate">
                {device.name}
              </h3>
              <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                <span>{device.type}</span>
                <span className="text-gray-600">•</span>
                <span
                  className={
                    device.status === "Online"
                      ? "text-green-400"
                      : device.status === "Warning"
                      ? "text-yellow-400"
                      : "text-red-400"
                  }
                >
                  {device.status}
                </span>
              </div>
            </div>
            <div className="text-right">
                <span className="text-sm font-semibold text-white">{device.value}</span>
            </div>
          </div>
        ))}
        {filteredDevices.length === 0 && (
          <div className="p-8 text-center text-gray-400">
            <p>No devices found.</p>
          </div>
        )}
      </div>
    </div>
  );
}