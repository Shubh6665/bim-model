"use client";

import React, { useEffect, useState } from "react";
import { SENSOR_CONFIGS, type SpriteData } from "./forge-dataviz-extension";

interface DataVizIntegrationProps {
  viewer: any;
  sensors: any[];
  selectedSensor: any;
  onSensorClick?: (sensor: any) => void;
  onSensorPlaced?: (sensor: any) => void;
  isPlacementMode?: boolean;
  placementSensorType?: string | null;
  visibleSensorTypes?: Set<string>;
}

const DataVizIntegration: React.FC<DataVizIntegrationProps> = ({
  viewer,
  sensors,
  selectedSensor,
  onSensorClick,
  onSensorPlaced,
  isPlacementMode,
  placementSensorType,
  visibleSensorTypes = new Set(Object.keys(SENSOR_CONFIGS)),
}) => {
  const [dataVizExt, setDataVizExt] = useState<any>(null);
  const [isExtensionReady, setIsExtensionReady] = useState(false);

  // Initialize DataViz extension
  useEffect(() => {
    if (!viewer) return;

    const initializeDataViz = async () => {
      try {
        // Check if extension is already loaded
        let extension = viewer.getExtension("Autodesk.DataVisualization");

        if (!extension) {
          // Load the extension
          extension = await viewer.loadExtension("Autodesk.DataVisualization");
        }

        if (extension) {
          setDataVizExt(extension);
          setIsExtensionReady(true);
          console.log("DataVisualization extension ready");
        }
      } catch (error) {
        console.error("Failed to initialize DataViz extension:", error);
      }
    };

    // Wait a bit for viewer to be fully ready
    const timer = setTimeout(initializeDataViz, 1000);
    return () => clearTimeout(timer);
  }, [viewer]);

  // Convert sensor data to sprite format
  const convertSensorToSprite = (sensor: any): SpriteData => {
    const config = SENSOR_CONFIGS[
      sensor.type as keyof typeof SENSOR_CONFIGS
    ] || {
      color: "#888888",
      icon: "•",
      unit: "",
      iconUrl: "",
    };

    return {
      id: sensor.id,
      dbId: sensor.dbId || Math.floor(Math.random() * 1000000),
      position: sensor.position,
      style: {
        color: config.color,
        url: config.iconUrl,
        scale: 1.0,
      },
      name: sensor.name,
      type: sensor.type,
      status: sensor.status?.toLowerCase() as
        | "active"
        | "inactive"
        | "warning"
        | "error",
      value: sensor.value ? parseFloat(sensor.value) : undefined,
      unit: sensor.unit || config.unit,
      room: sensor.room,
      timestamp: sensor.lastUpdate || new Date().toISOString(),
      tooltip: {
        enabled: true,
        html: `
          <div style="padding: 8px; background: rgba(0,0,0,0.8); color: white; border-radius: 4px;">
            <strong>${sensor.name}</strong><br/>
            <span style="color: #60A5FA;">Type:</span> ${sensor.type}<br/>
            ${sensor.value ? `<span style="color: #60A5FA;">Value:</span> ${sensor.value} ${sensor.unit || config.unit}<br/>` : ""}
            <span style="color: #60A5FA;">Room:</span> ${sensor.room}<br/>
            <span style="color: #60A5FA;">Status:</span> <span style="color: ${getStatusColor(sensor.status)}">${sensor.status}</span>
          </div>
        `,
      },
    };
  };

  // Get status color for tooltip
  const getStatusColor = (status: string): string => {
    switch (status?.toLowerCase()) {
      case "online":
      case "active":
        return "#10B981";
      case "warning":
        return "#F59E0B";
      case "offline":
      case "error":
        return "#EF4444";
      default:
        return "#6B7280";
    }
  };

  // Update sprites when sensors change
  useEffect(() => {
    if (!dataVizExt || !isExtensionReady) return;

    const updateSprites = async () => {
      try {
        // Clear existing sprites
        dataVizExt.removeAllViewables();

        // Convert sensors to sprites and filter by visibility
        const visibleSprites = sensors
          .filter((sensor) => visibleSensorTypes.has(sensor.type))
          .map(convertSensorToSprite);

        if (visibleSprites.length > 0) {
          // Add sprites to viewer
          await dataVizExt.addViewables(visibleSprites, { type: "sprite" });
          console.log(`Added ${visibleSprites.length} sprites to DataViz`);
        }
      } catch (error) {
        console.error("Error updating DataViz sprites:", error);
      }
    };

    updateSprites();
  }, [sensors, dataVizExt, isExtensionReady, visibleSensorTypes]);

  // Handle placement mode
  useEffect(() => {
    if (!dataVizExt || !isExtensionReady || !viewer) return;

    const handleViewerClick = (event: any) => {
      if (!isPlacementMode || !placementSensorType) return;

      try {
        const { clientX, clientY } = event;
        const hitPoint = viewer.impl?.hitTest(clientX, clientY, true);

        if (hitPoint && hitPoint.intersectPoint) {
          // Create new sensor data
          const newSensorData = {
            id: `sensor_${Date.now()}`,
            name: `${placementSensorType} Sensor`,
            type: placementSensorType,
            position: hitPoint.intersectPoint,
            room: determineRoom(hitPoint.intersectPoint),
            status: "Online",
            value: generateRandomValue(placementSensorType),
            unit: getSensorUnit(placementSensorType),
            lastUpdate: new Date().toISOString(),
          };

          // Notify parent component
          if (onSensorPlaced) {
            onSensorPlaced(newSensorData);
          }

          console.log("Sensor placed via DataViz:", newSensorData);
        }
      } catch (error) {
        console.error("Error placing sensor:", error);
      }
    };

    if (isPlacementMode) {
      if (viewer && viewer.container) {
        viewer.container.addEventListener("click", handleViewerClick);
        viewer.container.style.cursor = "crosshair";
      }
    } else {
      if (viewer && viewer.container) {
        viewer.container.removeEventListener("click", handleViewerClick);
        viewer.container.style.cursor = "default";
      }
    }

    return () => {
      if (viewer && viewer.container) {
        viewer.container.removeEventListener("click", handleViewerClick);
        viewer.container.style.cursor = "default";
      }
    };
  }, [
    dataVizExt,
    isExtensionReady,
    isPlacementMode,
    placementSensorType,
    viewer,
    onSensorPlaced,
  ]);

  // Handle sprite selection
  useEffect(() => {
    if (!dataVizExt || !viewer) return;

    const handleSelectionChanged = (event: any) => {
      const selection = viewer.getSelection();
      if (selection && selection.length > 0) {
        const dbId = selection[0];

        // Find sensor by dbId
        const sensor = sensors.find((s) => s.dbId === dbId);
        if (sensor && onSensorClick) {
          onSensorClick(sensor);
        }
      }
    };

    if (viewer && viewer.addEventListener) {
      viewer.addEventListener("selectionChanged", handleSelectionChanged);
    }

    return () => {
      if (viewer && viewer.removeEventListener) {
        viewer.removeEventListener("selectionChanged", handleSelectionChanged);
      }
    };
  }, [dataVizExt, viewer, sensors, onSensorClick]);

  // Utility functions
  const determineRoom = (position: {
    x: number;
    y: number;
    z: number;
  }): string => {
    // Simple room detection based on position
    if (position.x > 0 && position.y > 0) return "Room A";
    if (position.x < 0 && position.y > 0) return "Room B";
    if (position.x < 0 && position.y < 0) return "Room C";
    return "Room D";
  };

  const generateRandomValue = (sensorType: string): string => {
    switch (sensorType) {
      case "Temperature":
        return (18 + Math.random() * 12).toFixed(1);
      case "CO2":
        return (300 + Math.random() * 500).toFixed(0);
      case "Light":
        return (100 + Math.random() * 400).toFixed(0);
      case "Humidity":
        return (30 + Math.random() * 40).toFixed(1);
      case "Seismic and accelerometric":
        return (Math.random() * 2).toFixed(3);
      case "Energy consuption":
        return (Math.random() * 10).toFixed(2);
      default:
        return "0";
    }
  };

  const getSensorUnit = (sensorType: string): string => {
    const config = SENSOR_CONFIGS[sensorType as keyof typeof SENSOR_CONFIGS];
    return config?.unit || "";
  };

  // Public methods for external control
  const showAllSprites = () => {
    if (dataVizExt) {
      dataVizExt.showHideViewables(true, false);
    }
  };

  const hideAllSprites = () => {
    if (dataVizExt) {
      dataVizExt.showHideViewables(false, false);
    }
  };

  const clearAllSprites = () => {
    if (dataVizExt) {
      dataVizExt.removeAllViewables();
    }
  };

  const getSpriteCount = (): number => {
    return sensors.filter((sensor) => visibleSensorTypes.has(sensor.type))
      .length;
  };

  // Methods available for external access
  // Can be exposed via props or context if needed

  // Status indicator component
  const StatusIndicator = () => {
    if (!isExtensionReady) {
      return (
        <div className="absolute bottom-4 left-4 bg-yellow-600/80 backdrop-blur-sm rounded-lg px-3 py-2 text-white text-sm">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-yellow-300 rounded-full animate-pulse"></div>
            DataViz Loading...
          </div>
        </div>
      );
    }

    return (
      <div className="absolute bottom-4 left-4 bg-green-600/80 backdrop-blur-sm rounded-lg px-3 py-2 text-white text-sm">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-300 rounded-full"></div>
          DataViz Ready ({getSpriteCount()} sprites)
        </div>
      </div>
    );
  };

  // Quick action buttons
  const QuickActions = () => {
    if (!isExtensionReady) return null;

    return (
      <div className="absolute top-4 right-4 flex gap-2 z-50">
        <button
          onClick={showAllSprites}
          className="bg-green-600/80 hover:bg-green-700/80 backdrop-blur-sm text-white px-3 py-2 rounded-lg text-sm transition-colors"
          title="Show All Sprites"
        >
          👁️ Show
        </button>
        <button
          onClick={hideAllSprites}
          className="bg-red-600/80 hover:bg-red-700/80 backdrop-blur-sm text-white px-3 py-2 rounded-lg text-sm transition-colors"
          title="Hide All Sprites"
        >
          🙈 Hide
        </button>
        <button
          onClick={clearAllSprites}
          className="bg-orange-600/80 hover:bg-orange-700/80 backdrop-blur-sm text-white px-3 py-2 rounded-lg text-sm transition-colors"
          title="Clear All Sprites"
        >
          🗑️ Clear
        </button>
      </div>
    );
  };

  return (
    <>
      <StatusIndicator />
      <QuickActions />
    </>
  );
};

export default DataVizIntegration;
