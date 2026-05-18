"use client";

import React, { useState, useEffect } from "react";
import { SENSOR_TYPES, Sensor } from "@/app/context/sensor-context";

export interface SensorEditFormData {
  name: string;
  code: string;
  mark: string;
  model: string;
  room: string;
  link: string;
  sensorProvider: "ubibot" | "shelly" | "generic";
  ubibotChannelId: string;
  ubibotDeviceSerial: string;
  shellyDeviceId: string;
  shellyAuthKey: string;
  shellyIpAddress: string;
  shellyServerUri: string;
}

interface SensorEditFormProps {
  isOpen: boolean;
  sensor: Sensor | null;
  onSubmit: (formData: SensorEditFormData) => void;
  onCancel: () => void;
  loading?: boolean;
}

export function SensorEditForm({
  isOpen,
  sensor,
  onSubmit,
  onCancel,
  loading = false,
}: SensorEditFormProps) {
  const [formData, setFormData] = useState<SensorEditFormData>({
    name: "",
    code: "",
    mark: "",
    model: "",
    room: "",
    link: "",
    sensorProvider: "ubibot",
    ubibotChannelId: "",
    ubibotDeviceSerial: "",
    shellyDeviceId: "",
    shellyAuthKey: "",
    shellyIpAddress: "",
    shellyServerUri: "https://shelly-238-eu.shelly.cloud",
  });

  const [errors, setErrors] = useState<Partial<SensorEditFormData>>({});

  // Populate form with sensor data when modal opens
  useEffect(() => {
    if (isOpen && sensor) {
      setFormData({
        name: sensor.name || "",
        code: sensor.code || "",
        mark: sensor.mark || "",
        model: sensor.model || "",
        room: sensor.room || "",
        link: sensor.link || "",
        sensorProvider: sensor.sensorProvider || "ubibot",
        ubibotChannelId: sensor.ubibotChannelId || "",
        ubibotDeviceSerial: sensor.ubibotDeviceSerial || "",
        shellyDeviceId: sensor.shellyDeviceId || "",
        shellyAuthKey: sensor.shellyAuthKey || "",
        shellyIpAddress: sensor.shellyIpAddress || "",
        shellyServerUri: sensor.shellyServerUri || "https://shelly-238-eu.shelly.cloud",
      });
      setErrors({});
    }
  }, [isOpen, sensor]);

  const handleInputChange = (field: keyof SensorEditFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<SensorEditFormData> = {};

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

    // Only validate provider-specific fields for non-generic providers
    if (formData.sensorProvider === "shelly") {
      if (!formData.shellyDeviceId.trim()) {
        newErrors.shellyDeviceId = "Device ID is required";
      }
    }
    
    if (formData.sensorProvider === "ubibot") {
      if (!formData.ubibotChannelId.trim()) {
        newErrors.ubibotChannelId = "Channel ID is required for UbiBot sensors";
      }
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
    setErrors({});
    onCancel();
  };

  const sensorTypeInfo = sensor ? SENSOR_TYPES.find(t => t.name === sensor.type) : null;

  if (!isOpen || !sensor) return null;

  return (
    <div className="fixed inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-card rounded-lg p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-foreground">
            Edit Sensor
          </h2>
          <button
            onClick={handleCancel}
            className="text-muted-foreground hover:text-foreground transition-colors"
            disabled={loading}
          >
            ✕
          </button>
        </div>

        {/* Sensor Type Display */}
        <div className="mb-4 p-3 bg-muted rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Type:</span>
            {sensorTypeInfo && (
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: sensorTypeInfo.color }}
                />
                <span className="text-sm text-foreground font-medium">
                  {sensorTypeInfo.name} ({sensorTypeInfo.unit})
                </span>
              </div>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Sensor Provider Selection */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Sensor Provider *
            </label>
            <select
              value={formData.sensorProvider}
              onChange={(e) => handleInputChange("sensorProvider", e.target.value as "ubibot" | "shelly" | "generic")}
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            >
              <option value="ubibot">UbiBot</option>
              <option value="shelly">Shelly</option>
              <option value="generic">Generic</option>
            </select>
          </div>

          {/* Name Field */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              className={`w-full px-3 py-2 bg-muted border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.name ? "border-red-500" : "border-border"
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
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Code *
            </label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) => handleInputChange("code", e.target.value)}
              className={`w-full px-3 py-2 bg-muted border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.code ? "border-red-500" : "border-border"
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
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Mark *
            </label>
            <input
              type="text"
              value={formData.mark}
              onChange={(e) => handleInputChange("mark", e.target.value)}
              className={`w-full px-3 py-2 bg-muted border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.mark ? "border-red-500" : "border-border"
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
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Model *
            </label>
            <input
              type="text"
              value={formData.model}
              onChange={(e) => handleInputChange("model", e.target.value)}
              className={`w-full px-3 py-2 bg-muted border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.model ? "border-red-500" : "border-border"
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
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Room
            </label>
            <input
              type="text"
              value={formData.room}
              onChange={(e) => handleInputChange("room", e.target.value)}
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Room name"
              disabled={loading}
            />
          </div>

          {/* Link Field */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Link
            </label>
            <input
              type="url"
              value={formData.link}
              onChange={(e) => handleInputChange("link", e.target.value)}
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter documentation or reference link (optional)"
              disabled={loading}
            />
          </div>

          {/* UbiBot Configuration */}
          {formData.sensorProvider === "ubibot" && (
            <div className="pt-2 border-t border-border">
              <div className="text-sm font-medium text-foreground mb-2">UbiBot Configuration</div>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">
                    Channel ID *
                    <span className="text-xs text-muted-foreground ml-1">(e.g., 121744)</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formData.ubibotChannelId}
                    onChange={(e) => handleInputChange("ubibotChannelId", e.target.value)}
                    className={`w-full px-3 py-2 bg-muted border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.ubibotChannelId ? "border-red-500" : "border-border"
                    }`}
                    placeholder="Enter UbiBot Channel ID"
                    disabled={loading}
                  />
                  {errors.ubibotChannelId && (
                    <p className="text-red-400 text-xs mt-1">{errors.ubibotChannelId}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">
                    Device Serial
                    <span className="text-xs text-muted-foreground ml-1">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.ubibotDeviceSerial}
                    onChange={(e) => handleInputChange("ubibotDeviceSerial", e.target.value)}
                    className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter Device Serial (optional)"
                    disabled={loading}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Shelly Configuration */}
          {formData.sensorProvider === "shelly" && (
            <div className="pt-2 border-t border-border">
              <div className="text-sm font-medium text-foreground mb-2">Shelly Configuration</div>
              <div className="space-y-3">
                <input type="hidden" value={formData.shellyServerUri} />

                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">
                    Device ID *
                    <span className="text-xs text-muted-foreground ml-1">(e.g., 80b54e33e164)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.shellyDeviceId}
                    onChange={(e) => handleInputChange("shellyDeviceId", e.target.value)}
                    className={`w-full px-3 py-2 bg-muted border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.shellyDeviceId ? "border-red-500" : "border-border"
                    }`}
                    placeholder="Enter Shelly Device ID"
                    disabled={loading}
                  />
                  {errors.shellyDeviceId && (
                    <p className="text-red-400 text-xs mt-1">{errors.shellyDeviceId}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">
                    Authorization Cloud Key
                    <span className="text-xs text-muted-foreground ml-1">(optional - uses env default if empty)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.shellyAuthKey}
                    onChange={(e) => handleInputChange("shellyAuthKey", e.target.value)}
                    className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Leave empty to use default key"
                    disabled={loading}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Get from Shelly App → Device → Settings → Authorization Cloud Key</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">
                    IP Address
                    <span className="text-xs text-muted-foreground ml-1">(optional - for local fallback)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.shellyIpAddress}
                    onChange={(e) => handleInputChange("shellyIpAddress", e.target.value)}
                    className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., 192.168.1.29"
                    disabled={loading}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-foreground rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-border border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
