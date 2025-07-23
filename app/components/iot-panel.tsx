"use client";

import React, { useState } from "react";
import { Thermometer, Cloudy, Lightbulb, Droplets, Zap, Activity } from 'lucide-react';

const SENSOR_TYPES = [
    { name: 'Temperature', icon: Thermometer },
    { name: 'CO2', icon: Cloudy },
    { name: 'Light', icon: Lightbulb },
    { name: 'Humidity', icon: Droplets },
    { name: 'Seismic', icon: Activity },
    { name: 'Energy', icon: Zap },
];

interface IoTPanelProps {
    onInsertSensor: (sensorType: string) => void;

}

export function IoTPanel({ onInsertSensor}: IoTPanelProps) {
    const [view, setView] = useState<'all' | 'insert'>('all');
    const disabledClasses = "disabled:opacity-50 disabled:cursor-not-allowed";
    return (
        <div className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col h-full">
            {/* Header */}
            <div className="p-4 border-b border-gray-700 flex flex-col items-center">
                <div className="flex items-center justify-between w-full mb-4">
                    <h2 className="text-xl font-bold text-white tracking-wide">IoT Dashboard</h2>
                </div>
                <div className="flex w-full gap-2 mb-2">
                    <button
                        onClick={() => setView('all')}
                        
                        className={`flex-1 px-4 py-2 rounded-md border transition font-medium ${view === 'all' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-700 border-gray-600 hover:bg-gray-600 text-gray-300'} ${disabledClasses}`}
                    >
                        All sensors
                    </button>
                    <button
                        onClick={() => setView('insert')}
                        
                        className={`flex-1 px-4 py-2 rounded-md border transition font-medium ${view === 'insert' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-700 border-gray-600 hover:bg-gray-600 text-gray-300'} ${disabledClasses}`}
                    >
                        Insert new sensor
                    </button>
                </div>
            </div>
            {/* Conditional Content */}
            <div className="flex-1 overflow-y-auto p-4">
                {view === 'insert' ? (
                    <div>
                        <h3 className="text-md font-semibold text-gray-200 mb-3">Select a sensor type to place:</h3>
                        <div className="grid grid-cols-2 gap-3">
                            {SENSOR_TYPES.map(sensor => (
                                <button
                                    key={sensor.name}
                                    onClick={() => onInsertSensor(sensor.name)}
                                    
                                    className={`p-4 bg-gray-700 rounded-lg border border-gray-600 text-white hover:bg-blue-600 hover:border-blue-500 transition flex flex-col items-center justify-center gap-2 ${disabledClasses}`}
                                >
                                    <sensor.icon className="w-6 h-6" />
                                    <span className="text-sm font-medium">{sensor.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="text-center text-gray-400 pt-10">
                        <p>Showing all placed sensors.</p>
                        <p className="text-sm mt-2">(List of sensors will appear here)</p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default IoTPanel;
