"use client";

import React, { useEffect, useRef, useState } from "react";
import "./forge-viewer.css";
import { IoTSensorExtension } from "./forge-iot-extension";
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
      unit: sensor.unit,
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
        // Register the IoT extension before creating viewer
        if (Autodesk.Viewing.theExtensionManager && IoTSensorExtension) {
          try {
            Autodesk.Viewing.theExtensionManager.registerExtension(
              "IoTSensorExtension",
              IoTSensorExtension,
            );
          } catch (e) {
            console.warn("IoT extension already registered");
          }
        }

        const config = {
          extensions: [
            "Autodesk.DefaultTools.NavTools",
            "Autodesk.DataVisualization", // Load the official DataVisualization extension
            "IoTSensorExtension", // Our custom wrapper
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

                  // Wait a bit for extensions to fully load
                  await new Promise((resolve) => setTimeout(resolve, 1000));

                  // Get the DataVisualization extension
                  const dataVizExtension = viewerInstance.getExtension(
                    "Autodesk.DataVisualization",
                  );
                  if (dataVizExtension) {
                    setDataVizExt(dataVizExtension);
                    console.log(
                      "DataVisualization extension loaded successfully",
                    );
                  } else {
                    console.warn("DataVisualization extension not loaded");
                  }

                  // Get IoT extension and set up sensor integration
                  const iotExt =
                    viewerInstance.getExtension("IoTSensorExtension");
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
                        if (isPlacementMode && placementSensorType) {
                          // Convert the sensor data to the expected format
                          placeSensor(
                            sensorData.position,
                            sensorData.room || "Unknown",
                          );
                          exitPlacementMode();
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
                        console.warn("Could not add sensor:", sensor.name, err);
                      }
                    });

                    if (onViewerReady) {
                      onViewerReady(viewerInstance, iotExt);
                    }
                  } else {
                    console.warn("IoT extension not loaded");
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
      if (isPlacementMode && placementSensorType) {
        iotExtension.enterInsertMode(placementSensorType);
      } else {
        iotExtension.exitInsertMode();
      }
    } catch (error) {
      console.error("Error handling placement mode:", error);
    }
  }, [isPlacementMode, placementSensorType, iotExtension]);

  // Handle sensor type visibility changes
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
        const isVisible = visibleSensorTypes.has(sensorType);
        iotExtension.setSensorVisibility(sensorType, isVisible);
      });
    } catch (error) {
      console.error("Error updating sensor visibility:", error);
    }
  }, [visibleSensorTypes, iotExtension]);

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

        <div className="toolbar-status">
          {isLoading && <span className="loading">Loading model...</span>}
          {!isLoading && <span className="ready">Model ready</span>}
          {dataVizExt && <span className="dataviz-ready">DataViz ready</span>}
          {iotExtension && <span className="iot-ready">IoT ready</span>}
        </div>
      </div>

      {/* Viewer Container */}
      <div
        ref={viewerContainer}
        className="forge-viewer"
        style={{
          width: "100%",
          height: "calc(100vh - 120px)",
          position: "relative",
        }}
      />

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
