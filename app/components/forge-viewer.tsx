"use client";

import React, { useEffect, useRef, useState } from "react";

const SENSOR_TYPE_COLORS: Record<string, string> = {
    Temperature: "#ef4444",
    CO2: "#22c55e",
    Light: "#fde047",
    Humidity: "#3b82f6",
    "Seismic and accelerometric": "#a21caf",
    "Energy consumption": "#14b8a6",
};

// Remove PNG path logic
// function getIconUrl(type: string) { ... }

interface ForgeViewerProps {
    accessToken: string;
    urn: string;
    insertMode?: string | null; // sensor type or null
    onSensorPlaced?: (sensor: any) => void;
    onExitInsertMode?: () => void; // NEW PROP
}

const ForgeViewer: React.FC<ForgeViewerProps> = ({
    accessToken,
    urn,
    insertMode,
    onSensorPlaced,
    onExitInsertMode, // NEW PROP
}) => {
    const viewerContainer = useRef<HTMLDivElement>(null);
    const [viewer, setViewer] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [dataVizExt, setDataVizExt] = useState<any>(null);
    const [viewableData, setViewableData] = useState<any>(null);
    const [sensorStyles, setSensorStyles] = useState<Record<string, any>>({});
    const [placedSensors, setPlacedSensors] = useState<any[]>([]);
    const [allSprites, setAllSprites] = useState<any[]>([]); // Track all sprites manually

    // On mount: load viewer and DataViz
    useEffect(() => {
        if (!viewerContainer.current || !accessToken || !urn) return;

        let viewerInstance: any = null;
        let dataViz: any = null;
        let viewableDataObj: any = null;
        let styles: Record<string, any> = {};

        const initializeViewer = () => {
            const Autodesk = (window as any).Autodesk;
            if (!Autodesk || !Autodesk.Viewing) {
                setError("Forge Viewer SDK not loaded");
                return;
            }

            const options = {
                env: "AutodeskProduction",
                getAccessToken: (callback: (token: string, expire: number) => void) => {
                    callback(accessToken, 3600);
                },
            };

            Autodesk.Viewing.Initializer(options, () => {
                viewerInstance = new Autodesk.Viewing.GuiViewer3D(viewerContainer.current);
                const startedCode = viewerInstance.start();
                
                if (startedCode > 0) {
                    setError("Failed to create a Viewer: WebGL not supported.");
                    return;
                }

                setViewer(viewerInstance);
                const documentId = `urn:${urn}`;
                
                Autodesk.Viewing.Document.load(
                    documentId,
                    (doc: any) => {
                        const viewables = doc.getRoot().getDefaultGeometry();
                        if (viewables) {
                            viewerInstance.loadDocumentNode(doc, viewables).then(async () => {
                                setIsLoading(false);
                                await new Promise((resolve) => setTimeout(resolve, 1000));

                                // Load DataViz extension
                                try {
                                    dataViz = await viewerInstance.loadExtension("Autodesk.DataVisualization");
                                    setDataVizExt(dataViz);
                                    console.log("[DataViz] Extension loaded:", dataViz);

                                    // Set up styles for each sensor type (color only, no iconUrl)
                                    const DataVizCore = (window as any).Autodesk.DataVisualization.Core;
                                    for (const type of Object.keys(SENSOR_TYPE_COLORS)) {
                                        const color = new (window as any).THREE.Color(SENSOR_TYPE_COLORS[type]);
                                        styles[type] = new DataVizCore.ViewableStyle(
                                            DataVizCore.ViewableType.SPRITE,
                                            color
                                        );
                                        console.log(`[DataViz] Created style for ${type}:`, styles[type]);
                                    }
                                    setSensorStyles(styles);

                                    // Create ONE ViewableData instance that will hold all sprites
                                    viewableDataObj = new DataVizCore.ViewableData();
                                    viewableDataObj.spriteSize = 64; // Safe default size
                                    viewableDataObj.screenSpace = false; // World space = fixed in 3D
                                    setViewableData(viewableDataObj);
                                    console.log("[DataViz] ViewableData created:", viewableDataObj);

                                } catch (err) {
                                    setError("Failed to load Data Visualization extension");
                                    console.error("[DataViz] Error loading extension:", err);
                                }
                            });
                        } else {
                            setError("No viewable content found");
                            setIsLoading(false);
                        }
                    },
                    (errorCode: any) => {
                        setError(`Failed to load document: ${errorCode}`);
                        setIsLoading(false);
                    }
                );
            });
        };

        // Load Forge Viewer SDK if not already loaded
        if (!(window as any).Autodesk) {
            const script = document.createElement("script");
            script.src = "https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/viewer3D.min.js";
            script.onload = initializeViewer;
            script.onerror = () => setError("Failed to load Forge Viewer SDK");
            document.head.appendChild(script);

            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.type = "text/css";
            link.href = "https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/style.min.css";
            document.head.appendChild(link);
        } else {
            initializeViewer();
        }

        return () => {
            if (viewerInstance) {
                viewerInstance.finish();
            }
        };
    }, [accessToken, urn]);

    // Insert mode: listen for clicks and add sprites
    useEffect(() => {
        if (!viewer || !dataVizExt || !viewableData || !insertMode || !sensorStyles[insertMode]) {
            return;
        }
        
        console.log(`[ForgeViewer] Insert mode enabled for type: ${insertMode}`);
        const handleClick = (event: MouseEvent) => {
            const rect = viewerContainer.current?.getBoundingClientRect();
            if (!rect) return;

            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            const hit = viewer.hitTest(x, y, true);

            console.log(`[ForgeViewer] Click detected at (${x}, ${y}), hit:`, hit);
            if (hit && hit.intersectPoint) {
                const style = sensorStyles[insertMode];
                if (!style) {
                    console.error(`[ForgeViewer] No style found for type: ${insertMode}`);
                    return;
                }
                const position = hit.intersectPoint;
                // Add new sensor to placedSensors state (do NOT clear previous sensors)
                setPlacedSensors(prev => [
                    ...prev,
                    {
                        id: `sensor_${Date.now()}`,
                        type: insertMode,
                        position: { x: position.x, y: position.y, z: position.z },
                        color: SENSOR_TYPE_COLORS[insertMode] || "#888"
                    }
                ]);

                // After placing, exit insert mode so user must re-select from sidebar
                setTimeout(() => {
                    console.log(`[ForgeViewer] Exiting insert mode after placement.`);
                    if (onExitInsertMode) onExitInsertMode(); // Notify parent to exit insert mode
                }, 100);
            }
        };

        const container = viewerContainer.current;
        if (container) {
            container.addEventListener("click", handleClick);
            container.style.cursor = "crosshair";
        }

        return () => {
            if (container) {
                container.removeEventListener("click", handleClick);
                container.style.cursor = "default";
            }
        };
    }, [viewer, dataVizExt, viewableData, insertMode, sensorStyles, onExitInsertMode]);

    // Rebuild all sprites whenever placedSensors changes
    useEffect(() => {
        if (!dataVizExt || !viewableData || !sensorStyles || Object.keys(sensorStyles).length === 0) return;
        const DataVizCore = (window as any).Autodesk.DataVisualization.Core;
        const THREE = (window as any).THREE;

        // Create a new ViewableData instance
        const newViewableData = new DataVizCore.ViewableData();
        newViewableData.spriteSize = viewableData.spriteSize || 64;
        newViewableData.screenSpace = viewableData.screenSpace;

        // Add all sprites from placedSensors (each keeps its own type/color)
        placedSensors.forEach(sensor => {
            const style = sensorStyles[sensor.type];
            if (!style) {
                console.error(`[ForgeViewer] No style found for sensor type: ${sensor.type}`);
                return;
            }
            const sprite = new DataVizCore.SpriteViewable(
                new THREE.Vector3(sensor.position.x, sensor.position.y, sensor.position.z),
                style,
                sensor.id
            );
            newViewableData.addViewable(sprite);
        });

        // Refresh visualization
        newViewableData.finish().then(() => {
            dataVizExt.removeAllViewables();
            dataVizExt.addViewables(newViewableData);
            setViewableData(newViewableData); // Update state
        });
    }, [placedSensors, dataVizExt, viewableData, sensorStyles]);

    // Method to clear all sensors (if needed)
    const clearAllSensors = () => {
        if (dataVizExt && viewableData) {
            dataVizExt.removeAllViewables();
            // Create a new ViewableData instance with same settings
            const DataVizCore = (window as any).Autodesk.DataVisualization.Core;
            const newViewableData = new DataVizCore.ViewableData();
            newViewableData.spriteSize = viewableData.spriteSize;
            newViewableData.screenSpace = viewableData.screenSpace;
            // Do NOT set occlusion to false, so occlusion is enabled (sprites hidden behind geometry)
            setViewableData(newViewableData);
            setAllSprites([]);
            setPlacedSensors([]);
        }
    };

    // Method to remove specific sensor by ID (if needed)
    const removeSensor = (sensorId: string) => {
        const sensorIndex = placedSensors.findIndex(sensor => sensor.id === sensorId);
        if (sensorIndex !== -1 && viewableData && dataVizExt) {
            // Remove from viewable data
            const spriteToRemove = allSprites[sensorIndex];
            if (spriteToRemove) {
                viewableData.removeViewable(spriteToRemove);
                
                // Update states
                setAllSprites(prev => prev.filter((_, index) => index !== sensorIndex));
                setPlacedSensors(prev => prev.filter(sensor => sensor.id !== sensorId));
                
                // Refresh visualization
                viewableData.finish().then(() => {
                    dataVizExt.removeAllViewables();
                    dataVizExt.addViewables(viewableData);
                });
            }
        }
    };

    if (error) {
        return (
            <div className="forge-viewer-error">
                <h3>Error</h3>
                <p>{error}</p>
            </div>
        );
    }

    return (
        <div style={{ width: "100%", height: "100%", position: "relative" }}>
            <div
                ref={viewerContainer}
                style={{ width: "100%", height: "100vh", background: "#222" }}
            />
            {isLoading && (
                <div style={{ 
                    position: "absolute", 
                    top: 0, 
                    left: 0, 
                    width: "100%", 
                    height: "100%", 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "center", 
                    background: "rgba(0,0,0,0.5)", 
                    color: "#fff", 
                    zIndex: 10 
                }}>
                    Loading model...
                </div>
            )}
            
            {/* Debug info - remove in production */}
            {process.env.NODE_ENV === 'development' && (
                <div style={{
                    position: "absolute",
                    top: 10,
                    left: 10,
                    background: "rgba(0,0,0,0.7)",
                    color: "white",
                    padding: "10px",
                    borderRadius: "5px",
                    fontSize: "12px",
                    zIndex: 1000
                }}>
                    <div>Placed Sensors: {placedSensors.length}</div>
                    <div>Insert Mode: {insertMode || "None"}</div>
                    <button 
                        onClick={clearAllSensors}
                        style={{
                            marginTop: "5px",
                            padding: "2px 6px",
                            background: "#ff4444",
                            border: "none",
                            borderRadius: "3px",
                            color: "white",
                            cursor: "pointer"
                        }}
                    >
                        Clear All
                    </button>
                </div>
            )}
        </div>
    );
};

export default ForgeViewer;