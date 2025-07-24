"use client";

import React, { useEffect, useRef, useState } from "react";
import { DataVizService, SensorSprite } from "../services/dataviz-service";
import { useSensorContext } from "../context/sensor-context";

interface ForgeViewerProps {
    accessToken: string;
    urn: string;
    insertMode?: string | null;
    onSensorPlaced?: (sensor: any) => void;
    onExitInsertMode?: () => void;
    onSensorClick?: (sensorId: string) => void;
}

const ForgeViewer: React.FC<ForgeViewerProps> = ({
    accessToken,
    urn,
    insertMode,
    onSensorPlaced,
    onExitInsertMode,
    onSensorClick,
}) => {
    const viewerContainer = useRef<HTMLDivElement>(null);
    const [viewer, setViewer] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [dataVizService, setDataVizService] = useState<DataVizService | null>(null);
    const [isDataVizReady, setIsDataVizReady] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);
    const initializationRef = useRef(false);
    
    // Use sensor context
    const { sensors, selectSensor, placeSensor } = useSensorContext();

    // Initialize viewer and DataViz service
    useEffect(() => {
        if (!viewerContainer.current || !accessToken || !urn) return;
        
        // Prevent multiple initializations
        if (initializationRef.current) {
            console.log("[ForgeViewer] Already initialized, skipping");
            return;
        }
        
        initializationRef.current = true;
        console.log("[ForgeViewer] Starting initialization");

        let viewerInstance: any = null;
        let dataVizSvc: DataVizService | null = null;

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
                            viewerInstance.loadDocumentNode(doc, viewables).then(() => {
                                setIsLoading(false);
                                
                                // Wait for GEOMETRY_LOADED_EVENT before initializing DataViz
                                viewerInstance.addEventListener(
                                    Autodesk.Viewing.GEOMETRY_LOADED_EVENT,
                                    async () => {
                                        console.log("[ForgeViewer] Geometry loaded, initializing DataViz service");
                                        
                                        // Retry mechanism for DataViz initialization
                                        const initializeDataVizWithRetry = async (maxRetries = 3, delay = 500) => {
                                            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                                                console.log(`[ForgeViewer] DataViz initialization attempt ${attempt}/${maxRetries}`);
                                                
                                                // Wait before each attempt
                                                await new Promise((resolve) => setTimeout(resolve, delay * attempt));
                                                
                                                // Initialize DataViz service
                                                dataVizSvc = new DataVizService(viewerInstance);
                                                const initialized = await dataVizSvc.initialize();
                                                
                                                if (initialized) {
                                                    setDataVizService(dataVizSvc);
                                                    setIsDataVizReady(true);
                                                    setIsInitialized(true);
                                                    
                                                    // Setup sensor click handler
                                                    dataVizSvc.setupSensorClickHandler((dbId: number) => {
                                                        const sensorId = dataVizSvc?.getSensorByDbId(dbId);
                                                        if (sensorId && onSensorClick) {
                                                            onSensorClick(sensorId);
                                                        }
                                                    });
                                                    
                                                    console.log("[ForgeViewer] DataViz service ready after", attempt, "attempts");
                                                    return true;
                                                } else {
                                                    console.warn(`[ForgeViewer] DataViz initialization attempt ${attempt} failed`);
                                                    if (attempt === maxRetries) {
                                                        console.error("[ForgeViewer] Failed to initialize DataViz service after all attempts");
                                                        return false;
                                                    }
                                                }
                                            }
                                            return false;
                                        };
                                        
                                        await initializeDataVizWithRetry();
                                    },
                                    { once: true } // Only fire once
                                );
                            });
                        }
                    },
                    (error: any) => {
                        setError("Failed to load document: " + error.message);
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
    }, [accessToken, urn, onSensorClick]);

    // Handle click events for sensor placement
    const handleClick = async (event: MouseEvent) => {
        if (!insertMode || !viewer || !dataVizService || !isDataVizReady) {
            console.log("[ForgeViewer] Click ignored - not ready for placement");
            return;
        }

        // Prevent default behavior
        event.preventDefault();
        event.stopPropagation();

        console.log(`[ForgeViewer] Handling click for ${insertMode} sensor placement`);
        
        const rect = viewerContainer.current?.getBoundingClientRect();
        if (!rect) return;

        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        const result = viewer.impl.hitTest(x, y, false);
        if (!result || !result.intersectPoint) {
            console.log("[ForgeViewer] No intersection point found at click location");
            return;
        }

        const position = result.intersectPoint;
        console.log("[ForgeViewer] Placing sensor at position:", {
            x: position.x,
            y: position.y,
            z: position.z
        });

        try {
            // Use sensor context to place sensor
            const newSensor = await placeSensor(
                { x: position.x, y: position.y, z: position.z },
                "Unknown Room"
            );
            
            if (newSensor) {
                console.log("[ForgeViewer] Sensor placed successfully:", newSensor.name);
                if (onSensorPlaced) {
                    onSensorPlaced(newSensor);
                }
                
                // Exit insert mode after placing
                if (onExitInsertMode) {
                    onExitInsertMode();
                }
            } else {
                console.warn("[ForgeViewer] Failed to place sensor - no sensor returned");
            }
        } catch (error) {
            console.error("[ForgeViewer] Failed to place sensor:", error);
        }
    };

    // Setup click handler for sensor placement
    useEffect(() => {
        if (!viewer || !insertMode) {
            // Remove click handler when not in insert mode
            const container = viewerContainer.current;
            if (container) {
                container.removeEventListener("click", handleClick);
                container.style.cursor = "default";
            }
            return;
        }

        console.log(`[ForgeViewer] Setting up click handler for ${insertMode} sensor placement`);
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
    }, [viewer, insertMode, dataVizService, isDataVizReady]);

    // Update sensors when they change - with debouncing to prevent excessive calls
    useEffect(() => {
        if (!dataVizService || !isDataVizReady || !viewer) {
            console.log("[ForgeViewer] Skipping sensor update - service not ready");
            return;
        }
        
        console.log("[ForgeViewer] Sensor update triggered, sensors count:", sensors.length);
        
        // Use longer delay to ensure DataViz service is fully ready for display
        const delay = 800; // Consistent delay for all sensor updates
        
        // Debounce sensor updates to prevent excessive re-initialization
        const timeoutId = setTimeout(() => {
            updateSensors();
        }, delay);
        
        return () => {
            console.log("[ForgeViewer] Clearing sensor update timeout");
            clearTimeout(timeoutId);
        };
    }, [sensors.length, dataVizService, isDataVizReady]); // Keep dependency array consistent

    const updateSensors = async () => {
        if (!dataVizService) {
            console.warn("[ForgeViewer] DataViz service not available");
            return;
        }
        
        console.log("[ForgeViewer] Updating sensors display with", sensors.length, "sensors");
        
        try {
            // Clear existing sensors first
            await dataVizService.clearAllSensors();
            
            // Skip if no sensors to add
            if (sensors.length === 0) {
                console.log("[ForgeViewer] No sensors to display");
                return;
            }
            
            // Add all sensors from context (without calling updateDisplay for each)
            for (const sensor of sensors) {
                // Generate a more reliable dbId
                const dbId = sensor.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                
                const sensorSprite: SensorSprite = {
                    id: sensor.id,
                    type: sensor.type,
                    position: sensor.modelPosition || sensor.position,
                    color: sensor.color || "#ffffff",
                    dbId: dbId,
                };
                
                console.log(`[ForgeViewer] Adding sensor ${sensor.name} at position:`, sensorSprite.position);
                await dataVizService.addSensor(sensorSprite);
            }
            
            // Single updateDisplay call after all sensors are added
            const success = await dataVizService.updateDisplay();
            if (success) {
                console.log(`[ForgeViewer] Successfully updated display with ${sensors.length} sensors`);
            } else {
                console.warn(`[ForgeViewer] Failed to update display`);
            }
            
        } catch (error) {
            console.error("[ForgeViewer] Error updating sensors:", error);
        }
    };

    // Method to clear all sensors (for debugging)
    const clearAllSensors = async () => {
        if (dataVizService) {
            await dataVizService.clearAllSensors();
            console.log("[ForgeViewer] All sensors cleared");
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
                    <div>Sensors: {sensors.length}</div>
                    <div>Insert Mode: {insertMode || "None"}</div>
                    <div>DataViz Ready: {isDataVizReady ? "Yes" : "No"}</div>
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
