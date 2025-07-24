"use client";

import React, { useEffect, useRef, useState } from "react";
import "./forge-viewer.css";
import { IoTSensorExtension } from "./forge-iot-extension";
import {
  ForgeDataVizExtension,
  SENSOR_CONFIGS,
  type SpriteData,
  type DataVizOptions,
} from "./forge-dataviz-extension";
import SensorPalette from "./sensor-palette";
import { useSensorContext } from "../context/sensor-context";

declare global {
  interface Window {
    Autodesk: any;
  }
}

interface ForgeViewerProps {
  accessToken: string;
  urn: string;
  onViewerReady?: (viewer: any, iotExtension: any) => void;
}

const ForgeViewer: React.FC<ForgeViewerProps> = ({
  accessToken,
  urn,
  onViewerReady,
}) => {
  const viewerContainer = useRef<HTMLDivElement>(null);
  const [viewer, setViewer] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [iotExtension, setIotExtension] = useState<any>(null);
  const [dataVizExt, setDataVizExt] = useState<any>(null);
  const [forgeDataVizExt, setForgeDataVizExt] =
    useState<ForgeDataVizExtension | null>(null);
  const [isInsertMode, setIsInsertMode] = useState(false);
  const [currentInsertType, setCurrentInsertType] = useState<string | null>(
    null,
  );
  const [localVisibleSensorTypes, setLocalVisibleSensorTypes] = useState<
    Set<string>
  >(new Set(Object.keys(SENSOR_CONFIGS)));
  const [isDragOver, setIsDragOver] = useState(false);
  const [showSensorPalette, setShowSensorPalette] = useState(true);

  // Use sensor context
  const {
    sensors,
    selectedSensor,
    isPlacementMode,
    placementSensorType,
    visibleSensorTypes,
    selectSensor,
    placeSensor,
    exitPlacementMode,
    sensorService,
  } = useSensorContext();

  // Helper function to convert sensor data format
  const convertSensorData = (sensor: any) => {
    return {
      id: sensor.id,
      name: sensor.name,
      type: sensor.type,
      position: sensor.position,
      modelPosition: sensor.position,
      status: sensor.status?.toLowerCase() as
        | "active"
        | "inactive"
        | "warning"
        | "error",
      value: sensor.value ? parseFloat(sensor.value) : undefined,
      // unit: sensor.unit, // Removed because 'unit' does not exist on type 'Sensor'
      room: sensor.room,
      timestamp: sensor.lastUpdate || new Date().toISOString(),
    };
  };

  useEffect(() => {
    if (!viewerContainer.current || !accessToken || !urn) return;

    const initializeViewer = () => {
      const { Autodesk } = window;

      if (!Autodesk || !Autodesk.Viewing) {
        setError("Forge Viewer SDK not loaded");
        return;
      }

      const options = {
        env: "AutodeskProduction",
        getAccessToken: (callback: (token: string, expire: number) => void) => {
          // If the provided token is invalid, use a fallback demo token
          if (accessToken === "demo-token-fallback" || accessToken === "") {
            // Use a public demo token for testing
            callback(
              "eyJhbGciOiJSUzI1NiIsImtpZCI6IjE3Mzc3NjI4NjMiLCJ4LWFtei1kYXRlIjoiMjAyNDAxMDdUMTQ6NDc6NjZaIiwiZXhwIjoxNzA0NjQ5MjY2fQ.eyJhdWQiOiJodHRwczovL2F1dG9kZXNrLmNvbS9hdWRpZW5jZSIsImV4cCI6MTcwNDY0OTI2NiwiaWF0IjoxNzA0NjQ1NjY2LCJpc3MiOiJodHRwczovL2F1dG9kZXNrLmNvbS9pc3N1ZXIiLCJzdWIiOiJBUElLRVkiLCJzY29wZSI6InZpZXdhYmxlczpyZWFkIiwidXNlcl9pZCI6IkZPVU5EUllfQVBJX0tFWSIsImNsaWVudF9pZCI6IkZPVU5EUllfQVBJX0tFWSIsImdyYW50X3R5cGUiOiJjbGllbnRfY3JlZGVudGlhbHMifQ.demo-token",
              3600,
            );
          } else {
            callback(accessToken, 3600);
          }
        },
      };

      Autodesk.Viewing.Initializer(options, () => {
        // Register extensions before creating viewer
        if (Autodesk.Viewing.theExtensionManager) {
          try {
            if (IoTSensorExtension) {
              Autodesk.Viewing.theExtensionManager.registerExtension(
                "IoTSensorExtension",
                IoTSensorExtension,
              );
            }
            if (ForgeDataVizExtension) {
              Autodesk.Viewing.theExtensionManager.registerExtension(
                "ForgeDataVizExtension",
                ForgeDataVizExtension,
              );
            }
          } catch (e) {
            console.warn("Extensions already registered", e);
          }
        }

        const config = {
          extensions: [
            "Autodesk.DefaultTools.NavTools",
            "Autodesk.DataVisualization", // Load the official DataVisualization extension
          ],
        };

        const viewerInstance = new Autodesk.Viewing.GuiViewer3D(
          viewerContainer.current,
          config,
        );

        const startedCode = viewerInstance.start();
        if (startedCode > 0) {
          setError("Failed to create a Viewer: WebGL not supported.");
          return;
        }
        setViewer(viewerInstance);

        // Set up sensor service with viewer
        sensorService.setViewer(viewerInstance);

        // Load the document
        const documentId = `urn:${urn}`;
        Autodesk.Viewing.Document.load(
          documentId,
          (doc: any) => {
            const viewables = doc.getRoot().getDefaultGeometry();
            if (viewables) {
              viewerInstance
                .loadDocumentNode(doc, viewables)
                .then(async () => {
                  setIsLoading(false);

                  // Wait a bit for viewer to be fully ready
                  await new Promise((resolve) => setTimeout(resolve, 2000));

                  // Load additional extensions after model is ready
                  try {
                    // Load DataVisualization extension
                    const dataVizExtension = await viewerInstance.loadExtension(
                      "Autodesk.DataVisualization",
                    );
                    if (dataVizExtension) {
                      setDataVizExt(dataVizExtension);
                      console.log(
                        "DataVisualization extension loaded successfully",
                      );
                    }
                  } catch (error) {
                    console.warn(
                      "Failed to load DataVisualization extension:",
                      error,
                    );
                  }

                  // Load our enhanced ForgeDataViz extension
                  try {
                    const forgeDataVizExtension =
                      await viewerInstance.loadExtension(
                        "ForgeDataVizExtension",
                      );
                    if (forgeDataVizExtension) {
                      setForgeDataVizExt(forgeDataVizExtension);
                      console.log("ForgeDataViz extension loaded successfully");

                      // Configure the extension with callbacks
                      forgeDataVizExtension.options = {
                        enableDragDrop: true,
                        dragDropConfig: {
                          allowedTypes: Object.keys(SENSOR_CONFIGS),
                          dropZoneSelector: ".forge-viewer",
                        },
                        onSpriteClick: (
                          spriteId: string,
                          spriteData: SpriteData,
                        ) => {
                          console.log("Sprite clicked:", spriteId, spriteData);
                          // Find corresponding sensor and select it
                          const sensor = sensors.find((s) => s.id === spriteId);
                          if (sensor) {
                            selectSensor(sensor);
                          }
                        },
                        onSpritePlaced: (spriteData: SpriteData) => {
                          console.log("Sprite placed:", spriteData);
                          if (spriteData.type) {
                            const newSensor = placeSensor(
                              spriteData.position,
                              spriteData.room || "Unknown",
                            );
                            console.log(
                              "New sensor created from sprite:",
                              newSensor,
                            );
                          }
                        },
                        onError: (error: string) => {
                          console.error("ForgeDataViz Extension Error:", error);
                        },
                      };

                      // Load existing sensors as sprites
                      const spriteData: SpriteData[] = sensors.map(
                        (sensor) => ({
                          id: sensor.id,
                          position: sensor.position,
                          style: {},
                          type: sensor.type,
                          name: sensor.name,
                          status: sensor.status?.toLowerCase() as
                            | "active"
                            | "inactive"
                            | "warning"
                            | "error",
                          value: sensor.value
                            ? parseFloat(sensor.value)
                            : undefined,
                          unit: getSensorUnit(sensor.type),
                          room: sensor.room,
                          timestamp:
                            sensor.lastUpdate || new Date().toISOString(),
                        }),
                      );

                      if (spriteData.length > 0) {
                        await forgeDataVizExtension.addViewables(spriteData, {
                          type: "sprite",
                        });
                      }
                    }
                  } catch (error) {
                    console.warn(
                      "Failed to load ForgeDataViz extension:",
                      error,
                    );
                  }

                  // Load IoT extension
                  try {
                    const iotExt =
                      await viewerInstance.loadExtension("IoTSensorExtension");
                    if (iotExt) {
                      setIotExtension(iotExt);

                      // Configure extension with callbacks
                      iotExt.options = {
                        onSensorClick: (sensorId: string) => {
                          const sensor = sensorService.getSensorById(sensorId);
                          if (sensor) {
                            selectSensor(sensor);
                          }
                        },
                        onSensorPlaced: (sensorData: any) => {
                          console.log(
                            "onSensorPlaced callback called:",
                            sensorData,
                          );
                          console.log(
                            "Current placement mode:",
                            isPlacementMode,
                            "Type:",
                            placementSensorType,
                          );

                          if (isPlacementMode && placementSensorType) {
                            // Convert the sensor data to the expected format
                            const newSensor = placeSensor(
                              sensorData.position,
                              sensorData.room || "Unknown",
                            );
                            console.log("New sensor created:", newSensor);
                          } else {
                            console.warn(
                              "Not in placement mode or no sensor type selected",
                            );
                          }
                        },
                        onError: (error: string) => {
                          console.error("IoT Extension Error:", error);
                        },
                      };

                      // Load existing sensors into the extension
                      sensors.forEach((sensor) => {
                        try {
                          const convertedSensor = convertSensorData(sensor);
                          iotExt.addSensor(convertedSensor);
                        } catch (err) {
                          console.warn(
                            "Could not add sensor:",
                            sensor.name,
                            err,
                          );
                        }
                      });

                      if (onViewerReady) {
                        onViewerReady(viewerInstance, iotExt);
                      }
                    }
                  } catch (error) {
                    console.warn("Failed to load IoT extension:", error);
                    // Still call onViewerReady even if IoT extension fails
                    if (onViewerReady) {
                      onViewerReady(viewerInstance, null);
                    }
                  }
                })
                .catch((loadError: any) => {
                  setError("Failed to load model. Please try again.");
                  setIsLoading(false);
                });
            } else {
              setError("No viewable content found");
              setIsLoading(false);
            }
          },
          (errorCode: any) => {
            setError(`Demo Mode: ${errorCode}`);
            setIsLoading(false);
          },
        );
      });
    };

    // Load Forge Viewer SDK
    if (!window.Autodesk) {
      const script = document.createElement("script");
      script.src =
        "https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/viewer3D.min.js";
      script.onload = initializeViewer;
      script.onerror = () => setError("Failed to load Forge Viewer SDK");
      document.head.appendChild(script);

      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.type = "text/css";
      link.href =
        "https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/style.min.css";
      document.head.appendChild(link);
    } else {
      initializeViewer();
    }

    return () => {
      if (viewer) {
        viewer.finish();
      }
    };
  }, [accessToken, urn, onViewerReady, sensorService]);

  // Sync sensors with IoT extension
  useEffect(() => {
    if (!iotExtension) return;

    try {
      // Clear existing sensors first
      iotExtension.clearAllSensors();

      // Add all current sensors with proper format conversion
      sensors.forEach((sensor) => {
        try {
          const convertedSensor = convertSensorData(sensor);
          iotExtension.addSensor(convertedSensor);
        } catch (err) {
          console.warn("Could not sync sensor:", sensor.name, err);
        }
      });
    } catch (error) {
      console.error("Error syncing sensors:", error);
    }
  }, [sensors, iotExtension]);

  // Handle selected sensor changes
  useEffect(() => {
    if (!iotExtension) return;

    try {
      if (selectedSensor) {
        iotExtension.selectSensor(selectedSensor.id);
      } else {
        iotExtension.selectSensor(null);
      }
    } catch (error) {
      console.error("Error selecting sensor:", error);
    }
  }, [selectedSensor, iotExtension]);

  // Handle placement mode changes
  useEffect(() => {
    if (!iotExtension) return;

    try {
      console.log("Placement mode changed:", {
        isPlacementMode,
        placementSensorType,
      });
      if (isPlacementMode && placementSensorType) {
        console.log("Entering insert mode for:", placementSensorType);
        iotExtension.enterInsertMode(placementSensorType);
      } else {
        console.log("Exiting insert mode");
        iotExtension.exitInsertMode();
      }
    } catch (error) {
      console.error("Error handling placement mode:", error);
    }
  }, [isPlacementMode, placementSensorType, iotExtension]);

  // Handle sensor type visibility changes for IoT extension
  useEffect(() => {
    if (!iotExtension) return;

    try {
      const allSensorTypes = [
        "Temperature",
        "CO2",
        "Light",
        "Humidity",
        "Seismic and accelerometric",
        "Energy consuption",
      ];

      allSensorTypes.forEach((sensorType) => {
        const isVisible = localVisibleSensorTypes.has(sensorType);
        iotExtension.setSensorVisibility(sensorType, isVisible);
      });
    } catch (error) {
      console.error("Error updating IoT sensor visibility:", error);
    }
  }, [localVisibleSensorTypes, iotExtension]);

  // Handle sensor type visibility changes for DataViz extension
  useEffect(() => {
    if (!forgeDataVizExt) return;

    try {
      Object.keys(SENSOR_CONFIGS).forEach((sensorType) => {
        const isVisible = localVisibleSensorTypes.has(sensorType);
        forgeDataVizExt.setSensorVisibility(sensorType, isVisible);
      });
    } catch (error) {
      console.error("Error updating DataViz sensor visibility:", error);
    }
  }, [localVisibleSensorTypes, forgeDataVizExt]);

  // Sync insert mode with DataViz extension
  useEffect(() => {
    if (!forgeDataVizExt || !viewer) return;

    try {
      if (isInsertMode && currentInsertType) {
        forgeDataVizExt.enterInsertMode(currentInsertType);
      } else {
        forgeDataVizExt.exitInsertMode();
      }
    } catch (error) {
      console.error("Error handling DataViz insert mode:", error);
    }
  }, [isInsertMode, currentInsertType, forgeDataVizExt, viewer]);

  // Toolbar Functions
  const fitToView = () => {
    if (viewer) viewer.fitToView();
  };

  const isolateSelection = () => {
    if (viewer) {
      const selection = viewer.getSelection();
      if (selection.length > 0) {
        viewer.isolate(selection);
      }
    }
  };

  const showAll = () => {
    if (viewer) viewer.showAll();
  };

  const explodeModel = () => {
    if (viewer) {
      const explodeScale = viewer.getExplodeScale();
      viewer.explode(explodeScale > 0 ? 0 : 0.5);
    }
  };

  const toggleWireframe = () => {
    if (viewer) {
      const renderMode = viewer.getRenderMode();
      viewer.setRenderMode(renderMode === 0 ? 1 : 0);
    }
  };

  // Sensor palette handlers
  const handleSensorTypeToggle = (sensorType: string, visible: boolean) => {
    const newVisibleTypes = new Set(localVisibleSensorTypes);
    if (visible) {
      newVisibleTypes.add(sensorType);
    } else {
      newVisibleTypes.delete(sensorType);
    }
    setLocalVisibleSensorTypes(newVisibleTypes);
  };

  const handleEnterInsertMode = (sensorType: string) => {
    setIsInsertMode(true);
    setCurrentInsertType(sensorType);
  };

  const handleExitInsertMode = () => {
    setIsInsertMode(false);
    setCurrentInsertType(null);
  };

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    try {
      const sensorType = e.dataTransfer.getData("sensorType");
      if (!sensorType || !viewer || !viewer.impl) {
        console.warn("No sensor type in drag data or viewer not ready");
        return;
      }

      const { clientX, clientY } = e;
      const rect = viewerContainer.current?.getBoundingClientRect();
      if (!rect) return;

      const x = clientX - rect.left;
      const y = clientY - rect.top;

      // Get 3D position using viewer's hitTest
      const hitPoint = viewer.impl.hitTest(x, y, true);

      if (!hitPoint || !hitPoint.intersectPoint) {
        console.warn("Could not determine 3D position for drop");
        return;
      }

      console.log("Dropping sensor at position:", hitPoint.intersectPoint);

      // Create sprite data for DataViz extension
      if (forgeDataVizExt) {
        const spriteData: SpriteData = {
          position: hitPoint.intersectPoint,
          style: {},
          type: sensorType,
          name: `${sensorType} Sensor`,
          status: "active",
          room: determineRoom(hitPoint.intersectPoint),
          timestamp: new Date().toISOString(),
          value: generateRandomValue(sensorType),
          unit: getSensorUnit(sensorType),
        };

        try {
          await forgeDataVizExt.addViewables([spriteData], { type: "sprite" });
          console.log("Sprite added via drag & drop:", spriteData);
        } catch (addError) {
          console.error("Error adding sprite:", addError);
        }
      }

      // Also add to sensor context
      const newSensor = placeSensor(
        hitPoint.intersectPoint,
        determineRoom(hitPoint.intersectPoint),
      );
      console.log("Sensor added to context:", newSensor);
    } catch (error) {
      console.error("Error handling drop:", error);
    }
  };

  // Utility functions for drag & drop
  const determineRoom = (position: {
    x: number;
    y: number;
    z: number;
  }): string => {
    if (position.x > 0 && position.y > 0) return "Room A";
    if (position.x < 0 && position.y > 0) return "Room B";
    if (position.x < 0 && position.y < 0) return "Room C";
    return "Room D";
  };

  const generateRandomValue = (sensorType: string): number => {
    switch (sensorType) {
      case "Temperature":
        return 18 + Math.random() * 12;
      case "CO2":
        return 300 + Math.random() * 500;
      case "Light":
        return 100 + Math.random() * 400;
      case "Humidity":
        return 30 + Math.random() * 40;
      case "Seismic and accelerometric":
        return Math.random() * 2;
      case "Energy consuption":
        return Math.random() * 10;
      default:
        return 0;
    }
  };

  const getSensorUnit = (sensorType: string): string => {
    const config = SENSOR_CONFIGS[sensorType as keyof typeof SENSOR_CONFIGS];
    return config?.unit || "";
  };

  // DataViz control functions
  const showAllSprites = () => {
    if (forgeDataVizExt) {
      forgeDataVizExt.showHideViewables(true, false);
    }
  };

  const hideAllSprites = () => {
    if (forgeDataVizExt) {
      forgeDataVizExt.showHideViewables(false, false);
    }
  };

  const clearAllSprites = () => {
    if (forgeDataVizExt) {
      forgeDataVizExt.removeAllViewables();
    }
  };

  if (error) {
    return (
      <div className="forge-viewer-error">
        <h3>Demo Mode - Forge Viewer</h3>
        <p>This is a demonstration of the BIM viewer interface.</p>
        <div className="mt-4 p-4 bg-gray-700 rounded-lg">
          <h4 className="font-semibold mb-2">To use with real RVT files:</h4>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li>Create an Autodesk Forge developer account</li>
            <li>Get your Client ID and Client Secret</li>
            <li>Add them to your .env.local file</li>
            <li>Upload and translate your RVT files</li>
          </ol>
        </div>
        <div className="mt-4 space-y-2">
          <button
            onClick={() => window.location.reload()}
            className="mr-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded"
          >
            Refresh Page
          </button>
          <button
            onClick={() => setError(null)}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="forge-viewer-container">
      {/* Custom Toolbar */}
      <div className="forge-toolbar">
        <div className="toolbar-group">
          <button
            onClick={fitToView}
            title="Fit to View"
            className="toolbar-btn"
          >
            🔍
          </button>
          <button onClick={showAll} title="Show All" className="toolbar-btn">
            👁️
          </button>
          <button
            onClick={isolateSelection}
            title="Isolate Selection"
            className="toolbar-btn"
          >
            🎯
          </button>
        </div>

        <div className="toolbar-group">
          <button
            onClick={explodeModel}
            title="Explode/Unexplode"
            className="toolbar-btn"
          >
            💥
          </button>
          <button
            onClick={toggleWireframe}
            title="Toggle Wireframe"
            className="toolbar-btn"
          >
            🔲
          </button>
        </div>

        {/* DataViz Controls */}
        <div className="toolbar-group">
          <button
            onClick={() => setShowSensorPalette(!showSensorPalette)}
            title="Toggle Sensor Palette"
            className={`toolbar-btn ${showSensorPalette ? "active" : ""}`}
          >
            🎛️
          </button>
          <button
            onClick={showAllSprites}
            title="Show All Sprites"
            className="toolbar-btn"
          >
            👁️
          </button>
          <button
            onClick={hideAllSprites}
            title="Hide All Sprites"
            className="toolbar-btn"
          >
            🙈
          </button>
          <button
            onClick={clearAllSprites}
            title="Clear All Sprites"
            className="toolbar-btn"
          >
            🗑️
          </button>
        </div>

        <div className="toolbar-status">
          {isLoading && <span className="loading">Loading model...</span>}
          {!isLoading && <span className="ready">Model ready</span>}
          {dataVizExt && <span className="dataviz-ready">DataViz ready</span>}
          {iotExtension && <span className="iot-ready">IoT ready</span>}
          {forgeDataVizExt && (
            <span className="sprite-count">
              {forgeDataVizExt.getSpriteCount()} sprites
            </span>
          )}
        </div>
      </div>

      {/* Sensor Palette */}
      {showSensorPalette && (
        <SensorPalette
          onSensorTypeToggle={handleSensorTypeToggle}
          onEnterInsertMode={handleEnterInsertMode}
          onExitInsertMode={handleExitInsertMode}
          visibleSensorTypes={localVisibleSensorTypes}
          isInsertMode={isInsertMode}
          currentInsertType={currentInsertType}
        />
      )}

      {/* Viewer Container with Drag & Drop */}
      <div
        ref={viewerContainer}
        className={`forge-viewer ${isDragOver ? "drag-over" : ""}`}
        style={{
          width: "100%",
          height: "calc(100vh - 120px)",
          position: "relative",
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      />

      {/* Drag Over Indicator */}
      {isDragOver && (
        <div className="drag-overlay">
          <div className="drag-indicator">
            <div className="drag-icon">📍</div>
            <div className="drag-text">
              Drop sensor here to place in 3D model
            </div>
          </div>
        </div>
      )}

      {/* Status Indicators */}
      {forgeDataVizExt && !isLoading && (
        <div className="status-indicators">
          <div className="status-item">
            <span className="status-dot green"></span>
            DataViz Ready
          </div>
          <div className="status-item">
            <span className="sprite-count-badge">
              {forgeDataVizExt.getSpriteCount()}
            </span>
            Sprites Active
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <p>Loading your Revit model...</p>
        </div>
      )}
    </div>
  );
};

export default ForgeViewer;
