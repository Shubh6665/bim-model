"use client";

import React, { useState, useEffect } from "react";
import { SENSOR_TYPES } from "@/app/context/sensor-context";

export interface SensorFormData {
  name: string;
  code: string;
  mark: string;
  model: string;
  room: string;
  link: string;
  type: string;
}

interface SensorInsertionFormProps {
  isOpen: boolean;
  sensorType: string;
  position: { x: number; y: number; z: number } | null;
  onSubmit: (formData: SensorFormData) => void;
  onCancel: () => void;
  loading?: boolean;
}

export function SensorInsertionForm({
  isOpen,
  sensorType,
  position,
  onSubmit,
  onCancel,
  loading = false,
}: SensorInsertionFormProps) {
  const [formData, setFormData] = useState<SensorFormData>({
    name: "",
    code: "",
    mark: "",
    model: "",
    room: "",
    link: "",
    type: sensorType,
  });

  const [errors, setErrors] = useState<Partial<SensorFormData>>({});

  // Reset form when modal opens/closes or sensor type changes
  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: `${sensorType} Sensor`,
        code: "",
        mark: "",
        model: "",
        room: "",
        link: "",
        type: sensorType,
      });
      setErrors({});
    }
  }, [isOpen, sensorType]);

  const handleInputChange = (field: keyof SensorFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<SensorFormData> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    }
    if (!formData.code.trim()) {
      newErrors.code = "Code is required";
    }
    if (!formData.mark.trim()) {
      newErrors.mark = "Mark is required";
    }
    if (!formData.model.trim()) {
      newErrors.model = "Model is required";
    }
    if (!formData.room.trim()) {
      newErrors.room = "Room is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  const handleCancel = () => {
    setFormData({
      name: "",
      code: "",
      mark: "",
      model: "",
      room: "",
      link: "",
      type: sensorType,
    });
    setErrors({});
    onCancel();
  };

  const sensorTypeInfo = SENSOR_TYPES.find(t => t.name === sensorType);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">
            Insert {sensorType} Sensor
          </h2>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-white transition-colors"
            disabled={loading}
          >
            ✕
          </button>
        </div>

        {position && (
          <div className="mb-4 p-3 bg-gray-700 rounded-lg">
            <p className="text-sm text-gray-300">
              Position: ({position.x.toFixed(2)}, {position.y.toFixed(2)}, {position.z.toFixed(2)})
            </p>
            {sensorTypeInfo && (
              <div className="flex items-center gap-2 mt-1">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: sensorTypeInfo.color }}
                />
                <span className="text-sm text-gray-300">
                  {sensorTypeInfo.name} ({sensorTypeInfo.unit})
                </span>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name Field */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              className={`w-full px-3 py-2 bg-gray-700 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.name ? "border-red-500" : "border-gray-600"
              }`}
              placeholder="Enter sensor name"
              disabled={loading}
            />
            {errors.name && (
              <p className="text-red-400 text-xs mt-1">{errors.name}</p>
            )}
          </div>

          {/* Code Field */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Code *
            </label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) => handleInputChange("code", e.target.value)}
              className={`w-full px-3 py-2 bg-gray-700 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.code ? "border-red-500" : "border-gray-600"
              }`}
              placeholder="Enter sensor code"
              disabled={loading}
            />
            {errors.code && (
              <p className="text-red-400 text-xs mt-1">{errors.code}</p>
            )}
          </div>

          {/* Mark Field */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Mark *
            </label>
            <input
              type="text"
              value={formData.mark}
              onChange={(e) => handleInputChange("mark", e.target.value)}
              className={`w-full px-3 py-2 bg-gray-700 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.mark ? "border-red-500" : "border-gray-600"
              }`}
              placeholder="Enter sensor mark"
              disabled={loading}
            />
            {errors.mark && (
              <p className="text-red-400 text-xs mt-1">{errors.mark}</p>
            )}
          </div>

          {/* Model Field */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Model *
            </label>
            <input
              type="text"
              value={formData.model}
              onChange={(e) => handleInputChange("model", e.target.value)}
              className={`w-full px-3 py-2 bg-gray-700 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.model ? "border-red-500" : "border-gray-600"
              }`}
              placeholder="Enter sensor model"
              disabled={loading}
            />
            {errors.model && (
              <p className="text-red-400 text-xs mt-1">{errors.model}</p>
            )}
          </div>

          {/* Room Field */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Room *
            </label>
            <input
              type="text"
              value={formData.room}
              onChange={(e) => handleInputChange("room", e.target.value)}
              className={`w-full px-3 py-2 bg-gray-700 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.room ? "border-red-500" : "border-gray-600"
              }`}
              placeholder="Enter room name"
              disabled={loading}
            />
            {errors.room && (
              <p className="text-red-400 text-xs mt-1">{errors.room}</p>
            )}
          </div>

          {/* Link Field */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Link
            </label>
            <input
              type="url"
              value={formData.link}
              onChange={(e) => handleInputChange("link", e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter documentation or reference link (optional)"
              disabled={loading}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Placing...
                </>
              ) : (
                "Place Sensor"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
