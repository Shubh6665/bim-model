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
    activePanel?: 'bim' | 'iot' | 'database' | 'ai';
    wireframeMode?: boolean;
    onWireframeModeChange?: (wireframe: boolean) => void;
}

const ForgeViewer: React.FC<ForgeViewerProps> = ({
    accessToken,
    urn,
    insertMode,
    onSensorPlaced,
    onExitInsertMode,
    onSensorClick,
    activePanel,
    wireframeMode,
    onWireframeModeChange,
}) => {
    const viewerContainer = useRef<HTMLDivElement>(null);
    const [viewer, setViewer] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [dataVizService, setDataVizService] = useState<DataVizService | null>(null);
    const [isDataVizReady, setIsDataVizReady] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);
    const initializationRef = useRef(false);
    const [loadedUrn, setLoadedUrn] = useState<string | null>(null);
    
    // Use sensor context
    const { sensors, selectSensor, placeSensor } = useSensorContext();

    // Effect to force re-initialization when switching to IoT tab
    useEffect(() => {
        if (activePanel === 'iot' && urn && loadedUrn !== urn) {
            console.log("[ForgeViewer] IoT tab active and URN changed, forcing re-initialization");
            // Reset initialization state to force re-initialization
            setIsInitialized(false);
            setIsDataVizReady(false);
            setDataVizService(null);
            setViewer(null);
            initializationRef.current = false;
            setLoadedUrn(urn);
        }
    }, [activePanel, urn, loadedUrn]);

    // Update loadedUrn when model is successfully loaded
    useEffect(() => {
        if (isInitialized && urn && loadedUrn !== urn) {
            setLoadedUrn(urn);
            console.log("[ForgeViewer] Model successfully loaded, loadedUrn updated:", urn);
        }
    }, [isInitialized, urn, loadedUrn]);

    // Initialize viewer and DataViz service
    useEffect(() => {
        if (!viewerContainer.current || !accessToken || !urn) return;
        
        // Prevent multiple initializations for the same URN
        if (initializationRef.current && loadedUrn === urn) {
            console.log("[ForgeViewer] Already initialized with current URN, skipping");
            return;
        }
        
        initializationRef.current = true;
        console.log("[ForgeViewer] Starting initialization for URN:", urn);

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
            if (viewer) {
                viewer.finish();
                console.log("[ForgeViewer] Viewer finished.");
            }
        };
    }, [accessToken, urn, onSensorClick, loadedUrn]);

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

    // Update sensors when they change or when activePanel changes - with debouncing to prevent excessive calls
    useEffect(() => {
        if (!dataVizService || !isDataVizReady || !viewer) {
            console.log("[ForgeViewer] Skipping sensor update - service not ready");
            return;
        }
        
        // Only update sensors if we're in IoT mode and the model is fully loaded
        if (activePanel !== 'iot' || !isInitialized) {
            console.log("[ForgeViewer] Skipping sensor update - not in IoT mode or model not initialized");
            return;
        }
        
        console.log("[ForgeViewer] Sensor update triggered, sensors count:", sensors.length, "activePanel:", activePanel);
        
        // Use longer delay to ensure DataViz service is fully ready for display
        const delay = 1000; // Increased delay to ensure model is fully loaded
        
        // Debounce sensor updates to prevent excessive re-initialization
        const timeoutId = setTimeout(() => {
            updateSensors();
        }, delay);
        
        return () => {
            console.log("[ForgeViewer] Clearing sensor update timeout");
            clearTimeout(timeoutId);
        };
    }, [sensors.length, dataVizService, isDataVizReady, activePanel, isInitialized]); // Include isInitialized in dependency array

    // Handle wireframe mode changes
    useEffect(() => {
        if (!viewer || !isInitialized) {
            console.log("[ForgeViewer] Viewer not ready for wireframe mode control");
            return;
        }

        console.log(`[ForgeViewer] Setting wireframe mode: ${wireframeMode}`);

        try {
            if (wireframeMode) {
                // Enable wireframe mode - show edges and hide solid surfaces (same as IoT mode)
                viewer.setDisplayEdges(true);
                
                // Hide all model solid surfaces to create true wireframe effect
                viewer.model.getObjectTree((instanceTree: any) => {
                    if (instanceTree) {
                        const allDbIds: number[] = [];
                        
                        // Get all node IDs recursively
                        const collectAllNodeIds = (nodeId: number) => {
                            allDbIds.push(nodeId);
                            instanceTree.enumNodeChildren(nodeId, (childId: number) => {
                                collectAllNodeIds(childId);
                            });
                        };
                        
                        collectAllNodeIds(instanceTree.getRootId());
                        
                        // Filter to get only leaf nodes (actual components)
                        const leafNodeIds = allDbIds.filter(nodeId => {
                            let hasChildren = false;
                            instanceTree.enumNodeChildren(nodeId, () => {
                                hasChildren = true;
                            });
                            return !hasChildren;
                        });
                        
                        console.log(`[ForgeViewer] Wireframe mode: hiding ${leafNodeIds.length} solid components`);
                        
                        // Hide all leaf components to show only wireframe
                        if (leafNodeIds.length > 0) {
                            viewer.hide(leafNodeIds);
                        }
                    }
                });
                
                console.log("[ForgeViewer] Wireframe mode enabled - showing edges only");
            } else {
                // Solid mode - show solid surfaces but keep edges visible
                // Keep edges visible: viewer.setDisplayEdges(true) - don't turn off edges
                viewer.setDisplayEdges(true);
                // Ensure all model elements are visible when switching to solid mode
                viewer.showAll();
                console.log("[ForgeViewer] Solid mode enabled - showing all model elements with edges");
            }
        } catch (error) {
            console.error("[ForgeViewer] Error setting wireframe mode:", error);
        }
    }, [wireframeMode, viewer, isInitialized]);

    // Control model browser visibility based on active panel
    useEffect(() => {
        if (!viewer || !isInitialized) {
            console.log("[ForgeViewer] Viewer not ready for model browser visibility control");
            return;
        }

        console.log(`[ForgeViewer] Controlling model browser visibility for panel: ${activePanel}`);

        try {
            if (activePanel === 'iot') {
                // Hide all model elements (simulate turning off all eye icons in model browser)
                console.log("[ForgeViewer] Hiding all model elements for IoT mode");
                
                // Get all leaf node IDs (components that can be individually controlled)
                viewer.model.getObjectTree((instanceTree: any) => {
                    if (instanceTree) {
                        const allDbIds: number[] = [];
                        
                        // Get all leaf components (actual model elements)
                        instanceTree.enumNodeFragments(instanceTree.getRootId(), (fragId: number) => {
                            // This gets all fragments, but we need dbIds
                        }, true);
                        
                        // Alternative approach: get all node IDs recursively
                        const collectAllNodeIds = (nodeId: number) => {
                            allDbIds.push(nodeId);
                            instanceTree.enumNodeChildren(nodeId, (childId: number) => {
                                collectAllNodeIds(childId);
                            });
                        };
                        
                        collectAllNodeIds(instanceTree.getRootId());
                        
                        // Filter to get only leaf nodes (actual components)
                        const leafNodeIds = allDbIds.filter(nodeId => {
                            let hasChildren = false;
                            instanceTree.enumNodeChildren(nodeId, () => {
                                hasChildren = true;
                            });
                            return !hasChildren;
                        });
                        
                        console.log(`[ForgeViewer] Found ${leafNodeIds.length} leaf components to hide`);
                        
                        // Hide all leaf components (this simulates turning off eye icons)
                        if (leafNodeIds.length > 0) {
                            viewer.hide(leafNodeIds);
                            console.log(`[ForgeViewer] Hidden ${leafNodeIds.length} model components`);
                        }
                    }
                });
            } else {
                // Show all model elements (simulate turning on all eye icons in model browser)
                console.log("[ForgeViewer] Showing all model elements");
                
                // Show all previously hidden elements
                viewer.showAll();
                console.log("[ForgeViewer] Restored visibility for all model elements");
            }
        } catch (error) {
            console.error("[ForgeViewer] Error controlling model browser visibility:", error);
        }
    }, [activePanel, viewer, isInitialized]);

    const updateSensors = async () => {
        if (!dataVizService) {
            console.warn("[ForgeViewer] DataViz service not available");
            return;
        }
        
        // Additional check to ensure viewer renderer is ready
        if (!viewer || !viewer.model || !isInitialized) {
            console.warn("[ForgeViewer] Viewer not ready for sensor update, retrying in 500ms");
            setTimeout(() => updateSensors(), 500);
            return;
        }
        
        // Double-check that we're in IoT mode and model is initialized
        if (activePanel !== 'iot' || !isInitialized) {
            console.log("[ForgeViewer] Skipping sensor update - not in IoT mode or model not initialized");
            return;
        }
        
        console.log("[ForgeViewer] Updating sensors display with", sensors.length, "sensors, activePanel:", activePanel);
        
        try {
            // Clear existing sensors first
            await dataVizService.clearAllSensors();
            
            // Skip if no sensors to add
            if (sensors.length === 0) {
                console.log("[ForgeViewer] No sensors to display");
                await dataVizService.updateDisplay();
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
            
            // Wait longer before updating display to ensure all sensors are added and model is stable
            setTimeout(async () => {
                if (!viewer || !viewer.model || !isInitialized) {
                    console.warn("[ForgeViewer] Viewer not ready for final display update");
                    return;
                }
                
                // Double-check again that we're still in IoT mode
                if (activePanel !== 'iot') {
                    console.log("[ForgeViewer] No longer in IoT mode, skipping display update");
                    return;
                }
                
                // Single updateDisplay call after all sensors are added
                const success = await dataVizService.updateDisplay();
                if (success) {
                    console.log(`[ForgeViewer] Successfully updated display with ${sensors.length} sensors`);
                } else {
                    console.warn(`[ForgeViewer] Failed to update display`);
                }
            }, 500); // Increased delay
            
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
            {/* {process.env.NODE_ENV === 'development' && (
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
            )} */}
        </div>
    );
};

export default ForgeViewer;
