"use client";

import React, { useEffect, useRef, useState } from "react";
import { DataVizService, SensorSprite } from "../services/dataviz-service";
import type { ProjectModel } from "@/app/types/projects";
import { useSensorContext } from "../context/sensor-context";

interface ForgeViewerProps {
    accessToken: string;
    urn: string;
    models?: ProjectModel[]; // optional federated models; if provided, first is primary
    enabledModelIds?: Set<string>; // Track which models should be visible
    insertMode?: string | null;
    onSensorPlaced?: (sensor: any) => void;
    onExitInsertMode?: () => void;
    onSensorClick?: (sensorId: string) => void;
    onEmptyClick?: () => void;
    activePanel?: 'bim' | 'iot' | 'database' | 'ai' | 'fm' | null;
    wireframeMode?: boolean;
    onWireframeModeChange?: (wireframe: boolean) => void;
    onViewerReady?: (viewer: any, iotExtension: any) => void;
    // When in BIM panel, controls whether sensors should be shown in the 3D model
    sensorsVisible?: boolean;
}

const ForgeViewer: React.FC<ForgeViewerProps> = ({
    accessToken,
    urn,
    models,
    enabledModelIds,
    insertMode,
    onSensorPlaced,
    onExitInsertMode,
    onSensorClick,
    onEmptyClick,
    activePanel,
    wireframeMode,
    onWireframeModeChange,
    onViewerReady,
    sensorsVisible,
}) => {
    const viewerContainer = useRef<HTMLDivElement>(null);
    const [viewer, setViewer] = useState<any>(null);
    // Keep a stable ref to the active viewer instance for reliable cleanup
    const viewerRef = useRef<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [dataVizService, setDataVizService] = useState<DataVizService | null>(null);
    const [isDataVizReady, setIsDataVizReady] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);
    const [modelLoaded, setModelLoaded] = useState(false); // tracks geometry loaded irrespective of DataViz
    const initializationRef = useRef(false);
    // Prevent overlapping Autodesk.Viewing.Document.load initializations
    const initInFlightRef = useRef(false);
    const [loadedUrn, setLoadedUrn] = useState<string | null>(null);
    const [overlayModelsLoaded, setOverlayModelsLoaded] = useState(false);
    // Guard to ensure we only invoke onViewerReady once per initialization
    const hasFiredViewerReadyRef = useRef(false);
    // Track loaded overlay models by project model id (excluding primary)
    const overlayModelMapRef = useRef<Map<string, any>>(new Map());
    const prevOverlaySigRef = useRef<string>("");
    // Persistently remember which project model id is the true primary loaded into viewer.model
    const primaryModelIdRef = useRef<string | null>(null);

    // Use sensor context
    const { sensors, selectedSensor, selectSensor, placeSensor, showSensorForm, getFilteredSensors, filteredSensorType, viewerOverlay, hideViewerOverlay } = useSensorContext();
    // Draggable overlay state
    const overlayRef = useRef<HTMLDivElement | null>(null);
    const [overlayPos, setOverlayPos] = useState<{ x: number; y: number } | null>(null);
    const dragOffsetRef = useRef<{ dx: number; dy: number } | null>(null);
    const isDraggingRef = useRef(false);
    const wasDraggedRef = useRef(false);

    // Helper to toggle an entire model's visibility by fragment
    const setModelVisible = (model: any, visible: boolean) => {
        console.log(`🔧 setModelVisible called: ${visible ? 'SHOW' : 'HIDE'} model`);
        try {
            if (!model?.getFragmentList) {
                console.warn('   ⚠️  Model has no getFragmentList method');
                return;
            }
            const fragList = model.getFragmentList();
            const count = fragList.getCount?.() ?? 0;
            console.log(`   📊 Processing ${count} fragments`);
            
            for (let i = 0; i < count; i++) {
                fragList.setVisibility(i, !!visible);
            }
            
            console.log(`   ✅ ${count} fragments set to ${visible ? 'VISIBLE' : 'HIDDEN'}`);
        } catch (e) {
            console.error('   ❌ setModelVisible failed:', e);
        }
    };

    // Safely toggle edge display, avoiding prefs null issues in some builds
    const safeSetDisplayEdges = (v: any, enabled: boolean) => {
        try {
            if (!v || typeof v.setDisplayEdges !== 'function') return;
            if (!v.prefs || !v.impl || !v.impl.prefs) return; // avoid this.prefs.set crash
            // Additional check for prefs.set method
            if (typeof v.prefs.set !== 'function') return;
            v.setDisplayEdges(!!enabled);
        } catch (e) {
            console.warn('[ForgeViewer] setDisplayEdges failed', e);
        }
    };

    // Helper: ensure viewer visibility manager is ready before calling showAll/visibility ops
    const canUseVisibility = (v: any) => !!(v && v.impl && v.impl.visibilityManager && typeof v.showAll === 'function');

    // Safer alternative to viewer.showAll() that avoids internal showAllLayers dependency
    const safeRestoreAllVisibility = (v: any) => {
        try {
            if (!v) return;
            const vm = v.impl?.visibilityManager;
            const model = v.model;
            if (model) {
                // Ensure all fragments are visible
                setModelVisible(model, true);
                // Ensure all nodes are turned on (not set off)
                if (model.getObjectTree && vm && typeof vm.setNodeOff === 'function') {
                    model.getObjectTree((tree: any) => {
                        if (!tree) return;
                        const walk = (nodeId: number) => {
                            try { vm.setNodeOff(nodeId, false); } catch {}
                            tree.enumNodeChildren(nodeId, (childId: number) => walk(childId));
                        };
                        const rootId = tree.getRootId?.() ?? 1;
                        walk(rootId);
                        v.impl?.invalidate?.(true);
                    });
                } else {
                    // Fallback: at least invalidate to reflect fragment visibility
                    v.impl?.invalidate?.(true);
                }
            }
        } catch (err) {
            console.warn('[ForgeViewer] safeRestoreAllVisibility failed', err);
        }
    };

    // Ensure primary and overlay models are visible according to enabledModelIds
    const restoreAllModelsVisibility = (v: any) => {
        try {
            // Primary model
            safeRestoreAllVisibility(v);
            // Overlay models (federated)
            const overlays = overlayModelMapRef.current;
            if (overlays && overlays.size > 0) {
                for (const [modelId, mdl] of overlays.entries()) {
                    // If enabledModelIds is not provided, default to showing all overlays
                    const shouldShow = !enabledModelIds || enabledModelIds.size === 0 || enabledModelIds.has(modelId as string);
                    setModelVisible(mdl, shouldShow);
                }
            }
            v.impl?.invalidate?.(true);
        } catch (e) {
            console.warn('[ForgeViewer] restoreAllModelsVisibility failed', e);
        }
    };

    // Effect to force re-initialization when switching to IoT tab
    useEffect(() => {
        const primaryUrn = models && models.length > 0 ? models[0].urn : urn;
        if (activePanel === 'iot' && primaryUrn && loadedUrn !== primaryUrn) {
            console.log("[ForgeViewer] IoT tab active and URN changed, forcing re-initialization");
            // Reset initialization state to force re-initialization
            setIsInitialized(false);
            setIsDataVizReady(false);
            setDataVizService(null);
            setViewer(null);
            initializationRef.current = false;
            setLoadedUrn(primaryUrn);
            setOverlayModelsLoaded(false);
        }
    }, [activePanel, urn, models, loadedUrn]);

    // Dynamically reconcile overlay models without re-initializing primary
    useEffect(() => {
        const all = models || [];
        if (!all.length) return;
        const primaryUrn = all[0].urn || urn;
        const viewerInstance = viewerRef.current;
        // Build overlays signature (exclude primary index 0)
        const overlaySig = all
            .slice(1)
            .map(m => `${m.id}|${m.urn}|${m.transform ? `${m.transform.tx||0},${m.transform.ty||0},${m.transform.tz||0},${m.transform.rx||0},${m.transform.ry||0},${m.transform.rz||0},${m.transform.sx||1},${m.transform.sy||1},${m.transform.sz||1}` : '0,0,0,0,0,0,1,1,1'}`)
            .join(';');
        // If primary is not the same as loadedUrn, let the main init effect handle re-init
        if (loadedUrn && primaryUrn && loadedUrn !== primaryUrn) {
            return;
        }
        if (!viewerInstance) {
            // No viewer yet; main init will load overlays after primary
            prevOverlaySigRef.current = overlaySig;
            return;
        }
        if (prevOverlaySigRef.current === overlaySig) return;
        prevOverlaySigRef.current = overlaySig;

        const Autodesk = (window as any).Autodesk;
        if (!Autodesk || !Autodesk.Viewing) return;

        const buildMatrixFromTransform = (t?: ProjectModel["transform"]) => {
            const THREE = (window as any).THREE;
            if (!THREE) return null;
            const tx = t?.tx ?? 0, ty = t?.ty ?? 0, tz = t?.tz ?? 0;
            const rx = (t?.rx ?? 0) * Math.PI / 180;
            const ry = (t?.ry ?? 0) * Math.PI / 180;
            const rz = (t?.rz ?? 0) * Math.PI / 180;
            const sx = t?.sx ?? 1, sy = t?.sy ?? 1, sz = t?.sz ?? 1;
            const m = new THREE.Matrix4();
            const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'XYZ'));
            m.compose(new THREE.Vector3(tx, ty, tz), q, new THREE.Vector3(sx, sy, sz));
            return m;
        };

        // Compute diff
        const desired = new Map<string, ProjectModel>();
        for (const m of all.slice(1)) desired.set(m.id, m);
        const current = overlayModelMapRef.current;

        // Unload removed models
        for (const [id, mdl] of Array.from(current.entries())) {
            if (!desired.has(id)) {
                try {
                    if (viewerInstance && mdl) {
                        viewerInstance.unloadModel(mdl);
                        console.log('[ForgeViewer] Overlay model unloaded:', id);
                    }
                } catch (e) {
                    console.warn('[ForgeViewer] Failed to unload overlay model', id, e);
                } finally {
                    current.delete(id);
                }
            }
        }

        // Load new or update transformed models
        const loadPromises: Promise<void>[] = [];
        for (const [id, m] of desired.entries()) {
            if (current.has(id)) {
                // TODO: If transform changed significantly, consider reload. For now, skip.
                continue;
            }
            loadPromises.push(new Promise<void>((resolve) => {
                Autodesk.Viewing.Document.load(
                    `urn:${m.urn}`,
                    (doc: any) => {
                        const geom = doc.getRoot().getDefaultGeometry();
                        if (!geom) return resolve();
                        const placementTransform = buildMatrixFromTransform(m.transform || undefined);
                        const opts: any = { keepCurrentModels: true };
                        if (placementTransform) opts.placementTransform = placementTransform;
                        viewerInstance.loadDocumentNode(doc, geom, opts).then((model: any) => {
                            current.set(id, model);
                            console.log('[ForgeViewer] Overlay model loaded (reconcile):', m.name, m.discipline);
                            resolve();
                        }).catch(() => resolve());
                    },
                    () => resolve()
                );
            }));
        }

        Promise.all(loadPromises).then(() => {
            setOverlayModelsLoaded(true);
        });
    }, [models, urn, loadedUrn]);

    // Update loadedUrn when model is successfully loaded - keep URN stable to prevent reinit
    useEffect(() => {
        const primaryUrn = models && models.length > 0 ? models[0].urn : urn;
        if (isInitialized && primaryUrn && loadedUrn !== primaryUrn) {
            // Only update if we haven't loaded any model yet, to prevent reinit on model toggles
            if (!loadedUrn) {
                setLoadedUrn(primaryUrn);
                console.log("[ForgeViewer] Model successfully loaded, loadedUrn updated:", primaryUrn);
            } else {
                console.log("[ForgeViewer] Skipping URN update to prevent reinit:", primaryUrn, "current:", loadedUrn);
            }
        }
    }, [isInitialized, urn, models, loadedUrn]);

    // Initialize viewer and DataViz service
    useEffect(() => {
        const primaryUrn = models && models.length > 0 ? models[0].urn : urn;
        if (!viewerContainer.current || !accessToken || !primaryUrn) return;
        // Prevent multiple initializations - once initialized, don't reinit for model toggles
        if (initializationRef.current && loadedUrn) {
            console.log("[ForgeViewer] Already initialized with URN:", loadedUrn, "skipping reinit for:", primaryUrn);
            return;
        }
        if (initInFlightRef.current) {
            console.log('[ForgeViewer] Initialization already in flight, skipping');
            return;
        }
        initializationRef.current = true;
        initInFlightRef.current = true;
        // Reset viewerReady guard for this initialization cycle
        hasFiredViewerReadyRef.current = false;
        console.log("[ForgeViewer] Starting initialization for URN:", primaryUrn);

        let viewerInstance: any = null;
        let dataVizSvc: DataVizService | null = null;

        const buildMatrixFromTransform = (t?: ProjectModel["transform"]) => {
            const THREE = (window as any).THREE;
            if (!THREE) return null;
            const tx = t?.tx ?? 0, ty = t?.ty ?? 0, tz = t?.tz ?? 0;
            const rx = (t?.rx ?? 0) * Math.PI / 180;
            const ry = (t?.ry ?? 0) * Math.PI / 180;
            const rz = (t?.rz ?? 0) * Math.PI / 180;
            const sx = t?.sx ?? 1, sy = t?.sy ?? 1, sz = t?.sz ?? 1;
            const m = new THREE.Matrix4();
            const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'XYZ'));
            m.compose(new THREE.Vector3(tx, ty, tz), q, new THREE.Vector3(sx, sy, sz));
            return m;
        };

        const loadOverlayModels = async () => {
            if (!models || models.length <= 1) return;
            const Autodesk = (window as any).Autodesk;
            for (let i = 1; i < models.length; i++) {
                const m = models[i];
                await new Promise<void>((resolve) => {
                    Autodesk.Viewing.Document.load(
                        `urn:${m.urn}`,
                        (doc: any) => {
                            const geom = doc.getRoot().getDefaultGeometry();
                            if (!geom) return resolve();
                            const placementTransform = buildMatrixFromTransform(m.transform || undefined);
                            const opts: any = { keepCurrentModels: true };
                            if (placementTransform) opts.placementTransform = placementTransform;
                            viewerInstance.loadDocumentNode(doc, geom, opts).then((model: any) => {
                                try { overlayModelMapRef.current.set(m.id, model); } catch {}
                                console.log('[ForgeViewer] Overlay model loaded:', m.name, m.discipline);
                                // Hide overlay model by default so only primary shows
                                setModelVisible(model, false);
                                resolve();
                            }).catch(() => resolve());
                        },
                        () => resolve()
                    );
                });
            }
            setOverlayModelsLoaded(true);
        };

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
                    initInFlightRef.current = false;
                    return;
                }
                setViewer(viewerInstance);
                viewerRef.current = viewerInstance;
                const documentId = `urn:${primaryUrn}`;
                Autodesk.Viewing.Document.load(
                    documentId,
                    (doc: any) => {
                        const viewables = doc.getRoot().getDefaultGeometry();
                        if (viewables) {
                            viewerInstance.loadDocumentNode(doc, viewables).then(() => {
                                setIsLoading(false);
                                // Capture the primary project model id once at initialization
                                try {
                                    if (!primaryModelIdRef.current) {
                                        const initPrimaryId = (models && models.length > 0) ? models[0].id : null;
                                        primaryModelIdRef.current = initPrimaryId || null;
                                        console.log('[ForgeViewer] Primary model id set:', primaryModelIdRef.current);
                                    }
                                } catch {}
                                // Wait for GEOMETRY_LOADED_EVENT before initializing DataViz
                                viewerInstance.addEventListener(
                                    Autodesk.Viewing.GEOMETRY_LOADED_EVENT,
                                    async () => {
                                        console.log("[ForgeViewer] Geometry loaded");
                                        setModelLoaded(true);
                                        // Load overlay models (federated) after primary geometry
                                        if (!overlayModelsLoaded) {
                                            try { await loadOverlayModels(); } catch {}
                                        }
                                        // Fire onViewerReady immediately upon geometry load so other panels (e.g., BIMPanel)
                                        // can access the instance tree without waiting for DataViz initialization.
                                        if (!hasFiredViewerReadyRef.current && typeof onViewerReady === 'function') {
                                            try {
                                                onViewerReady(viewerInstance, null);
                                                hasFiredViewerReadyRef.current = true;
                                                console.log("[ForgeViewer] onViewerReady fired on geometry load");
                                            } catch (e) {
                                                console.warn("[ForgeViewer] onViewerReady threw on geometry load:", e);
                                            }
                                        }
                                        const needDataVizNow = (activePanel === 'iot') || (activePanel === 'bim' && sensorsVisible);
                                        // Skip DataViz initialization if not currently needed
                                        if (!needDataVizNow) {
                                            console.log("[ForgeViewer] Skipping DataViz initialization (not needed yet)");
                                            setIsInitialized(true); // model ready for other panels
                                            return;
                                        }

                                        console.log("[ForgeViewer] Initializing DataViz service on geometry load");
                                        // Retry mechanism for DataViz initialization
                                        const initializeDataVizWithRetry = async (maxRetries = 3, delay = 500) => {
                                            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                                                console.log(`[ForgeViewer] DataViz initialization attempt ${attempt}/${maxRetries}`);
                                                
                                                // Validate viewer before attempting initialization
                                                if (!viewerInstance || !viewerInstance.loadExtension) {
                                                    console.error(`[ForgeViewer] Viewer not ready for DataViz initialization (attempt ${attempt})`);
                                                    if (attempt === maxRetries) {
                                                        console.error("[ForgeViewer] Failed to initialize DataViz service - viewer not ready");
                                                        return false;
                                                    }
                                                    // Wait before next attempt
                                                    await new Promise((resolve) => setTimeout(resolve, delay * attempt));
                                                    continue;
                                                }
                                                
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
                                                    // Optionally fire onViewerReady if it hasn't been fired yet
                                                    if (!hasFiredViewerReadyRef.current && typeof onViewerReady === 'function') {
                                                        try {
                                                            onViewerReady(viewerInstance, null);
                                                            hasFiredViewerReadyRef.current = true;
                                                            console.log("[ForgeViewer] onViewerReady fired after DataViz ready");
                                                        } catch (e) {
                                                            console.warn("[ForgeViewer] onViewerReady threw after DataViz ready:", e);
                                                        }
                                                    }
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
                                    { once: true }
                                );
                                // Clear in-flight flag once primary model and overlays have started loading
                                setTimeout(() => { initInFlightRef.current = false; }, 0);
                            });
                        }
                    },
                    (error: any) => {
                        setError("Failed to load document: " + error.message);
                        initInFlightRef.current = false;
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
            // Finish and cleanup the active viewer instance reliably via ref
            if (viewerRef.current) {
                try {
                    // First unload overlay models to be safe
                    try {
                        const v = viewerRef.current;
                        for (const mdl of overlayModelMapRef.current.values()) {
                            try { v.unloadModel(mdl); } catch {}
                        }
                        overlayModelMapRef.current.clear();
                    } catch {}
                    viewerRef.current.finish();
                    console.log("[ForgeViewer] Viewer finished.");
                } catch (e) {
                    console.warn('[ForgeViewer] Error finishing viewer:', e);
                } finally {
                    viewerRef.current = null;
                }
            }
        };
    }, [accessToken, urn, models, onSensorClick, loadedUrn, onViewerReady, activePanel, sensorsVisible]);

    // Late / on-demand DataViz initialization (e.g., BIM panel toggles sensorsVisible later)
    useEffect(() => {
        if (!viewer) return;
        if (isDataVizReady || dataVizService) return; // already initialized
        if (!modelLoaded) return; // wait for geometry
        const needDataVizNow = (activePanel === 'iot') || (activePanel === 'bim' && sensorsVisible);
        if (!needDataVizNow) return;
        let cancelled = false;
        (async () => {
            console.log('[ForgeViewer] Performing late DataViz initialization');
            try {
                const svc = new DataVizService(viewer);
                const ok = await svc.initialize();
                if (!ok || cancelled) return;
                setDataVizService(svc);
                setIsDataVizReady(true);
                // Setup sensor click handler
                svc.setupSensorClickHandler((dbId: number) => {
                    const sensorId = svc.getSensorByDbId(dbId);
                    if (sensorId && onSensorClick) onSensorClick(sensorId);
                });
                // Fire onViewerReady if not yet fired
                if (!hasFiredViewerReadyRef.current && typeof onViewerReady === 'function') {
                    try {
                        onViewerReady(viewer, null);
                        hasFiredViewerReadyRef.current = true;
                        console.log('[ForgeViewer] onViewerReady fired after late DataViz init');
                    } catch (e) {
                        console.warn('[ForgeViewer] onViewerReady threw after late DataViz init:', e);
                    }
                }
            } catch (e) {
                console.warn('[ForgeViewer] Late DataViz initialization failed:', e);
            } finally {
                if (!cancelled) setIsInitialized(true); // ensure initialized flag
            }
        })();
        return () => { cancelled = true; };
    }, [viewer, modelLoaded, activePanel, sensorsVisible, isDataVizReady, dataVizService, onSensorClick, onViewerReady]);

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
            // Show sensor insertion form instead of directly placing sensor
            showSensorForm({ x: position.x, y: position.y, z: position.z });
            console.log("[ForgeViewer] Showing sensor insertion form at position:", {
                x: position.x,
                y: position.y,
                z: position.z
            });
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

    // Additional: detect clicks near sensor sprites to trigger selection (non-invasive)
    useEffect(() => {
        if (!viewer || insertMode || activePanel !== 'iot') return;

        const container = viewerContainer.current;
        if (!container) return;

        const handleSensorPick = (event: MouseEvent) => {
            if (!viewer) return;
            // Compute click relative to canvas
            const rect = container.getBoundingClientRect();
            const clickX = event.clientX - rect.left;
            const clickY = event.clientY - rect.top;

            // Project each displayed sensor to screen and find nearest
            const THREE = (window as any).THREE;
            if (!THREE || !viewer.worldToClient) return;

            const displayedSensors = getFilteredSensors();
            let nearestSensorId: string | null = null;
            let nearestDistSq = Infinity;

            for (const sensor of displayedSensors) {
                const pos = sensor.modelPosition || sensor.position;
                if (!pos) continue;
                const world = new THREE.Vector3(pos.x, pos.y, pos.z);
                const screen = viewer.worldToClient(world);
                const dx = screen.x - clickX;
                const dy = screen.y - clickY;
                const distSq = dx * dx + dy * dy;
                if (distSq < nearestDistSq) {
                    nearestDistSq = distSq;
                    nearestSensorId = sensor.id;
                }
            }

            // If within threshold, treat as sensor click
            const thresholdPx = 20; // radius in pixels
            if (nearestSensorId && nearestDistSq <= thresholdPx * thresholdPx) {
                if (onSensorClick) onSensorClick(nearestSensorId);
            } else {
                if (onEmptyClick) onEmptyClick();
            }
        };

        container.addEventListener('click', handleSensorPick);
        return () => {
            container.removeEventListener('click', handleSensorPick);
        };
    }, [viewer, insertMode, activePanel, getFilteredSensors, onSensorClick, onEmptyClick]);

    // Update sensors when they change or when activePanel changes - with debouncing to prevent excessive calls
    useEffect(() => {
        if (!dataVizService || !isDataVizReady || !viewer) {
            console.log("[ForgeViewer] Skipping sensor update - service not ready");
            return;
        }
        
        // Determine whether sensors should be shown based on panel and visibility flag
        const shouldShowSensors = (activePanel === 'iot') || (activePanel === 'bim' && sensorsVisible);
        if (!shouldShowSensors || !isInitialized) {
            console.log("[ForgeViewer] Skipping sensor update - sensors not enabled for current panel or model not initialized");
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
    }, [sensors.length, dataVizService, isDataVizReady, activePanel, isInitialized, filteredSensorType, sensorsVisible]); // Include filteredSensorType and sensorsVisible to trigger updates

    // Handle wireframe mode changes
    useEffect(() => {
        if (!viewer || !isInitialized) {
            console.log("[ForgeViewer] Viewer not ready for wireframe mode control");
            return;
        }

        // Skip wireframe mode changes if not in IoT panel
        if (activePanel !== 'iot') {
            console.log("[ForgeViewer] Skipping wireframe mode - not in IoT panel");
            return;
        }

        console.log(`[ForgeViewer] Setting wireframe mode: ${wireframeMode}`);

        try {
            if (wireframeMode) {
                // Enable wireframe mode for IoT - hide solid surfaces and show only structural edges
                console.log('[ForgeViewer] Enabling wireframe mode for IoT panel - hiding solid components');
                
                // First ensure all enabled models (primary + overlays) are visible
                restoreAllModelsVisibility(viewer);
                
                // Enable edge display for wireframe effect
                safeSetDisplayEdges(viewer, true);
                
                // Get the object tree and hide all solid components to show only wireframe structure
                if (viewer?.model && viewer.model.getObjectTree) {
                    viewer.model.getObjectTree((instanceTree: any) => {
                        if (instanceTree) {
                            const allDbIds: number[] = [];
                            
                            // Collect all node IDs recursively
                            const collectAllNodeIds = (nodeId: number) => {
                                allDbIds.push(nodeId);
                                instanceTree.enumNodeChildren(nodeId, (childId: number) => {
                                    collectAllNodeIds(childId);
                                });
                            };
                            
                            // Start from root and collect all nodes
                            collectAllNodeIds(instanceTree.getRootId());
                            
                            // Filter to get only leaf nodes (actual geometry components)
                            const leafNodeIds = allDbIds.filter(nodeId => {
                                let hasChildren = false;
                                instanceTree.enumNodeChildren(nodeId, () => {
                                    hasChildren = true;
                                });
                                return !hasChildren && nodeId !== instanceTree.getRootId();
                            });
                            
                            console.log(`[ForgeViewer] Wireframe mode: hiding ${leafNodeIds.length} solid components to show structural wireframe`);
                            
                            // Hide all leaf components (solid surfaces) to show only wireframe structure
                            if (leafNodeIds.length > 0) {
                                if (viewer?.hide) viewer.hide(leafNodeIds);
                                
                                // Force wireframe rendering mode after hiding components
                                setTimeout(() => {
                                    if (viewer?.setDisplayMode) {
                                        viewer.setDisplayMode(1); // Wireframe/ghost mode
                                    }
                                    
                                    // Enable ghosting for wireframe effect
                                    if (viewer?.setGhosting) {
                                        viewer.setGhosting(true);
                                    }
                                    
                                    console.log(`[ForgeViewer] Wireframe mode activated - ${leafNodeIds.length} components hidden, showing structural edges only`);
                                }, 100);
                            }
                        }
                    });
                } else {
                    // Fallback: Use built-in wireframe mode
                    if (viewer?.setDisplayMode) {
                        viewer.setDisplayMode(1); // Wireframe mode
                    }
                    if (viewer?.setGhosting) {
                        viewer.setGhosting(true);
                    }
                }
                
                console.log("[ForgeViewer] Wireframe mode enabled - showing structural wireframe only");
            } else {
                // Solid mode - show full model with normal rendering
                console.log('[ForgeViewer] Enabling solid mode for IoT panel');
                
                // Restore visibility for primary and enabled overlay models
                restoreAllModelsVisibility(viewer);
                
                // Keep edges visible for better visibility in IoT mode
                safeSetDisplayEdges(viewer, true);
                
                // Use solid rendering mode
                if (viewer?.setDisplayMode) {
                    viewer.setDisplayMode(0); // Solid mode
                }
                
                // Disable ghosting
                if (viewer?.setGhosting) {
                    viewer.setGhosting(false);
                }
                
                console.log("[ForgeViewer] Solid mode enabled - showing full model with edges");
            }
        } catch (error) {
            console.error("[ForgeViewer] Error setting wireframe mode:", error);
        }
    }, [wireframeMode, viewer, isInitialized, activePanel]);

    // Apply the same wireframe effect as IoT panel when in BIM panel and sensorsVisible is ON.
    useEffect(() => {
        if (!viewer || !isInitialized) return;
        if (activePanel !== 'bim') return;

        try {
            if (sensorsVisible) {
                console.log('[ForgeViewer] BIM sensors visible - enabling IoT-style wireframe');
                
                // Do NOT reset visibility; only adjust rendering flags
                safeSetDisplayEdges(viewer, true);

                if (viewer.model && viewer.model.getObjectTree) {
                    viewer.model.getObjectTree((instanceTree: any) => {
                        if (!instanceTree) return;
                        
                        const allDbIds: number[] = [];
                        const collectAllNodeIds = (nodeId: number) => {
                            allDbIds.push(nodeId);
                            instanceTree.enumNodeChildren(nodeId, (childId: number) => collectAllNodeIds(childId));
                        };
                        collectAllNodeIds(instanceTree.getRootId());

                        const leafNodeIds = allDbIds.filter(nodeId => {
                            let hasChildren = false;
                            instanceTree.enumNodeChildren(nodeId, () => { hasChildren = true; });
                            return !hasChildren && nodeId !== instanceTree.getRootId();
                        });

                        if (leafNodeIds.length > 0) {
                            console.log(`[ForgeViewer] Hiding ${leafNodeIds.length} solid components for wireframe.`);
                            viewer.hide(leafNodeIds);
                            setTimeout(() => {
                                if (viewer.setDisplayMode) viewer.setDisplayMode(1); // wireframe
                                if (viewer.setGhosting) viewer.setGhosting(true);
                            }, 100);
                        } else {
                             if (viewer.setDisplayMode) viewer.setDisplayMode(1);
                             if (viewer.setGhosting) viewer.setGhosting(true);
                        }
                    });
                } else {
                    // Fallback for models without an instance tree
                    if (viewer.setDisplayMode) viewer.setDisplayMode(1);
                    if (viewer.setGhosting) viewer.setGhosting(true);
                }
            } else {
                console.log('[ForgeViewer] BIM sensors hidden - restoring solid mode');
                // Restore solid mode and show all elements.
                // This will also clear any active filtering.
                // Do NOT reset visibility; only adjust rendering flags
                safeSetDisplayEdges(viewer, true);
                if (viewer.setDisplayMode) viewer.setDisplayMode(0); // solid
                if (viewer.setGhosting) viewer.setGhosting(false);
            }
        } catch (error) {
            console.error('[ForgeViewer] Error applying BIM wireframe on sensor toggle:', error);
        }
    }, [sensorsVisible, activePanel, viewer, isInitialized]);    // Simple panel-based rendering control - don't interfere with BIM 2D functionality
    useEffect(() => {
        if (!viewer || !isInitialized) {
            console.log("[ForgeViewer] Viewer not ready for panel controls");
            return;
        }

        // Check if model is loaded
        if (!viewer.model) {
            console.log("[ForgeViewer] Model not loaded yet, skipping panel controls");
            return;
        }

        console.log(`[ForgeViewer] Active panel: ${activePanel}`);

        try {
            if (activePanel === 'iot') {
                // IoT panel - wireframe mode handles all visibility
                console.log("[ForgeViewer] IoT panel active - wireframe mode will control visibility");
                // Don't interfere - let wireframe mode handle everything
            } else {
                // Other panels (BIM, Database, AI) - ensure normal rendering but don't interfere with BIM's own 2D functionality
                console.log("[ForgeViewer] Non-IoT panel active - ensuring normal rendering mode");
                
                // Only set rendering modes, don't force show/hide (let BIM handle its own 2D views)
                if (viewer.setDisplayMode) {
                    viewer.setDisplayMode(0); // Solid mode
                }
                
                // Disable ghosting for normal view
                if (viewer.setGhosting) {
                    viewer.setGhosting(false);
                }
                
                // Ensure edges are visible
                safeSetDisplayEdges(viewer, true);
                
                console.log("[ForgeViewer] Normal rendering mode set for non-IoT panel");
            }
        } catch (error) {
            console.error("[ForgeViewer] Error in panel rendering control:", error);
        }
    }, [activePanel, viewer, isInitialized]);

    // Handle model visibility based on enabledModelIds
    useEffect(() => {
        console.log('[ForgeViewer] Model visibility effect triggered');
        console.log('  - viewer ready:', !!viewer);
        console.log('  - isInitialized:', isInitialized);
        console.log('  - models count:', models?.length || 0);
        console.log('  - enabledModelIds:', enabledModelIds ? Array.from(enabledModelIds) : 'null');
        console.log('  - overlayModelsLoaded:', overlayModelsLoaded);

        // Only require a ready viewer and initialized flag; handle even single-model cases
        if (!viewer || !isInitialized) {
            console.log('[ForgeViewer] Skipping model visibility - prerequisites not met');
            return;
        }
        if (!enabledModelIds || enabledModelIds.size === 0) {
            console.log('[ForgeViewer] Skipping model visibility - no enabled models');
            return;
        }

        console.log('🔄 [ForgeViewer] STARTING model visibility management');
        console.log('📋 Enabled models:', Array.from(enabledModelIds));
        console.log('📦 Available models:', (models || []).map(m => `${m.id} (${m.name} - ${m.discipline})`));

        try {
            // Get the true primary model instance and id captured at init
            const primaryModel = viewer.model;
            const truePrimaryId = primaryModelIdRef.current;
            const primaryInfo = truePrimaryId ? (((models || []).find(m => m.id === truePrimaryId)) || { name: 'Unknown' }) : null;

            // Handle primary model visibility against enabled set
            if (truePrimaryId && primaryModel) {
                const shouldShowPrimary = enabledModelIds.has(truePrimaryId);
                console.log(`🏗️  PRIMARY MODEL: ${primaryInfo?.name || 'Unknown'} (${truePrimaryId})`);
                console.log(`   Status: ${shouldShowPrimary ? '✅ SHOW' : '❌ HIDE'}`);
                console.log(`   Fragment count: ${primaryModel.getFragmentList?.()?.getCount?.() || 'unknown'}`);

                setModelVisible(primaryModel, shouldShowPrimary);

                if (shouldShowPrimary) {
                    console.log(`   ✅ Primary model ${truePrimaryId} set to VISIBLE`);
                } else {
                    console.log(`   ❌ Primary model ${truePrimaryId} set to HIDDEN`);
                }
            } else {
                console.log('[ForgeViewer] Primary model id not set yet; skipping primary visibility update');
            }

            // Handle overlay models visibility
            console.log(`🔗 OVERLAY MODELS: ${overlayModelMapRef.current.size} loaded`);
            for (const [modelId, overlayModel] of overlayModelMapRef.current.entries()) {
                // Skip if this overlay id matches the true primary id to avoid double-toggling
                if (truePrimaryId && modelId === truePrimaryId) continue;
                const modelInfo = (models || []).find(m => m.id === modelId);
                const shouldShow = enabledModelIds.has(modelId);
                
                console.log(`   🏗️  ${modelInfo?.name || 'Unknown'} (${modelId})`);
                console.log(`      Status: ${shouldShow ? '✅ SHOW' : '❌ HIDE'}`);
                console.log(`      Fragment count: ${overlayModel.getFragmentList?.()?.getCount?.() || 'unknown'}`);
                
                setModelVisible(overlayModel, shouldShow);
                
                if (shouldShow) {
                    console.log(`      ✅ Overlay model ${modelId} set to VISIBLE`);
                } else {
                    console.log(`      ❌ Overlay model ${modelId} set to HIDDEN`);
                }
            }

            // Force viewer refresh to apply visibility changes
            if (viewer.impl?.invalidate) {
                viewer.impl.invalidate(true);
                console.log('🔄 Viewer invalidated to apply visibility changes');
            }

            console.log('✅ [ForgeViewer] Model visibility management COMPLETED');

        } catch (error) {
            console.error('❌ [ForgeViewer] Error managing model visibility:', error);
            console.error('   Stack:', (error as Error).stack);
        }
    }, [enabledModelIds, viewer, isInitialized, models, overlayModelsLoaded]);

        // Effect to handle sensor highlighting when selectedSensor changes
    useEffect(() => {
        if (!dataVizService || !isDataVizReady || activePanel !== 'iot') {
            return;
        }

        if (selectedSensor) {
            console.log(`[ForgeViewer] Highlighting selected sensor: ${selectedSensor.name} (${selectedSensor.id})`);
            dataVizService.highlightSensor(selectedSensor.id);
        } else {
            console.log(`[ForgeViewer] Clearing sensor highlight`);
            dataVizService.clearHighlight();
        }
    }, [selectedSensor, dataVizService, isDataVizReady, activePanel]);

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
        
        // Double-check current mode allows sensors
        const shouldShowSensors = (activePanel === 'iot') || (activePanel === 'bim' && sensorsVisible);
        if (!shouldShowSensors || !isInitialized) {
            console.log("[ForgeViewer] Skipping sensor update - sensors not enabled for current panel or model not initialized");
            return;
        }
        
        // Get filtered sensors based on current filter selection
        const filteredSensors = getFilteredSensors();
        console.log("[ForgeViewer] Updating sensors display with", filteredSensors.length, "filtered sensors (total:", sensors.length, "), activePanel:", activePanel, "filter:", filteredSensorType);
        
        try {
            // Clear existing sensors first
            await dataVizService.clearAllSensors();
            
            // Skip if no sensors to add
            if (filteredSensors.length === 0) {
                console.log("[ForgeViewer] No filtered sensors to display");
                await dataVizService.updateDisplay();
                return;
            }
            
            // Add filtered sensors from context (without calling updateDisplay for each)
            for (const sensor of filteredSensors) {
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
            
            // Wait before updating display to ensure all sensors are added and model is stable
            setTimeout(async () => {
                if (!viewer || !viewer.model || !isInitialized) {
                    console.warn("[ForgeViewer] Viewer not ready for final display update");
                    return;
                }
                
                // Double-check again that sensors should still be shown
                const stillShouldShowSensors = (activePanel === 'iot') || (activePanel === 'bim' && sensorsVisible);
                if (!stillShouldShowSensors) {
                    console.log("[ForgeViewer] Sensors no longer enabled, skipping display update");
                    return;
                }
                
                // Single updateDisplay call after all sensors are added
                const success = await dataVizService.updateDisplay();
                if (success) {
                    console.log(`[ForgeViewer] Successfully updated display with ${filteredSensors.length} filtered sensors`);
                } else {
                    console.warn(`[ForgeViewer] Failed to update display`);
                }
            }, 500); // Increased delay
            
        } catch (error) {
            console.error("[ForgeViewer] Error updating sensors:", error);
        }
    };

    // When in BIM panel, react to sensorsVisible toggles by clearing sensors when hidden
    useEffect(() => {
        if (!dataVizService || !isDataVizReady || !viewer || !isInitialized) return;
        if (activePanel !== 'bim') return;
        (async () => {
            if (!sensorsVisible) {
                await dataVizService.clearAllSensors();
                await dataVizService.updateDisplay();
                console.log('[ForgeViewer] Cleared sensors due to BIM visibility toggle off');
            } else {
                // Trigger an update when toggled on
                updateSensors();
            }
        })();
    }, [sensorsVisible, activePanel, dataVizService, isDataVizReady, viewer, isInitialized]);

    // Method to clear all sensors (for debugging)
    const clearAllSensors = async () => {
        if (dataVizService) {
            await dataVizService.clearAllSensors();
            console.log("[ForgeViewer] All sensors cleared");
        }
    };

    // Clear sensors when switching to a panel where sensors should not be shown
    useEffect(() => {
        if (!dataVizService || !isDataVizReady || !viewer || !isInitialized) return;
        const shouldShow = (activePanel === 'iot') || (activePanel === 'bim' && sensorsVisible);
        if (!shouldShow) {
            (async () => {
                await dataVizService.clearAllSensors();
                await dataVizService.updateDisplay();
                console.log('[ForgeViewer] Cleared sensors due to panel change');
            })();
        }
    }, [activePanel, sensorsVisible, dataVizService, isDataVizReady, viewer, isInitialized]);

    if (error) {
        return (
            <div className="forge-viewer-error">
                <h3>Error</h3>
                <p>{error}</p>
            </div>
        );
    }

    // Close overlay when clicking anywhere outside the viewer container
    useEffect(() => {
        if (!viewerOverlay) return;
        const handleGlobalPointerDown = (event: PointerEvent) => {
            const container = viewerContainer.current;
            const overlayEl = overlayRef.current;
            if (!container) return;
            const target = event.target as Node | null;
            // If clicking inside viewer container OR inside overlay, do not hide
            if (target && (container.contains(target) || (overlayEl && overlayEl.contains(target)))) {
                return;
            }
            // Otherwise, clicked outside both → hide overlay
            hideViewerOverlay();
        };
        document.addEventListener('pointerdown', handleGlobalPointerDown, true);
        return () => {
            document.removeEventListener('pointerdown', handleGlobalPointerDown, true);
        };
    }, [viewerOverlay, hideViewerOverlay]);

    // Close overlay when switching away from IoT panel
    useEffect(() => {
        if (activePanel !== 'iot' && viewerOverlay) {
            hideViewerOverlay();
        }
    }, [activePanel, viewerOverlay, hideViewerOverlay]);

    // Ensure overlay is cleared on unmount
    useEffect(() => {
        return () => {
            hideViewerOverlay();
        };
    }, [hideViewerOverlay]);

    // Reset overlay position when overlay closes or changes
    useEffect(() => {
        if (!viewerOverlay) {
            setOverlayPos(null);
            isDraggingRef.current = false;
            dragOffsetRef.current = null;
        }
    }, [viewerOverlay]);

    const onOverlayHeaderPointerDown = (e: React.PointerEvent) => {
        if (!viewerContainer.current || !overlayRef.current) return;
        // Switch to positioned mode using current rect
        const containerRect = viewerContainer.current.getBoundingClientRect();
        const overlayRect = overlayRef.current.getBoundingClientRect();
        const startX = overlayRect.left - containerRect.left;
        const startY = overlayRect.top - containerRect.top;
        setOverlayPos({ x: startX, y: startY });
        dragOffsetRef.current = { dx: e.clientX - startX, dy: e.clientY - startY };
        isDraggingRef.current = true;
        wasDraggedRef.current = true;
        (e.target as Element).setPointerCapture?.(e.pointerId);
        e.preventDefault();
        e.stopPropagation();
    };

    const onOverlayHeaderPointerMove = (e: React.PointerEvent) => {
        if (!isDraggingRef.current || !viewerContainer.current || !overlayRef.current || !dragOffsetRef.current) return;
        const containerRect = viewerContainer.current.getBoundingClientRect();
        const overlayRect = overlayRef.current.getBoundingClientRect();
        let newX = e.clientX - dragOffsetRef.current.dx;
        let newY = e.clientY - dragOffsetRef.current.dy;
        // Clamp within container bounds
        const maxX = containerRect.width - overlayRect.width;
        const maxY = containerRect.height - overlayRect.height;
        newX = Math.max(0, Math.min(newX, maxX));
        newY = Math.max(0, Math.min(newY, maxY));
        setOverlayPos({ x: newX, y: newY });
        e.preventDefault();
        e.stopPropagation();
    };

    const onOverlayHeaderPointerUp = (e: React.PointerEvent) => {
        isDraggingRef.current = false;
        dragOffsetRef.current = null;
        (e.target as Element).releasePointerCapture?.(e.pointerId);
        e.preventDefault();
        e.stopPropagation();
    };

    // Helper: position overlay at center-right of container
    const positionOverlayCenterRight = () => {
        if (!viewerContainer.current || !overlayRef.current) return;
        const containerRect = viewerContainer.current.getBoundingClientRect();
        const overlayRect = overlayRef.current.getBoundingClientRect();
        const marginRight = 50; // px from right
        const x = Math.max(0, containerRect.width - overlayRect.width - marginRight);
        const y = Math.max(0, Math.round((containerRect.height - overlayRect.height) / 2));
        setOverlayPos({ x, y });
    };

    // When overlay opens initially, place it center-right (responsive)
    useEffect(() => {
        if (!viewerOverlay) return;
        wasDraggedRef.current = false;
        // Wait for overlay DOM to mount then measure
        const id = requestAnimationFrame(() => positionOverlayCenterRight());
        return () => cancelAnimationFrame(id);
    }, [viewerOverlay]);

    // Recompute on resize if user hasn't dragged it
    useEffect(() => {
        const onResize = () => {
            if (viewerOverlay && !wasDraggedRef.current) {
                positionOverlayCenterRight();
            }
        };
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, [viewerOverlay]);

    return (
        <div style={{ width: "100%", height: "100%", position: "relative" }}>
            <div
                ref={viewerContainer}
                style={{ width: "100%", height: "100vh", background: "#222" }}
            />
            {viewerOverlay && (
                <div
                    ref={overlayRef}
                    style={{
                        position: "absolute",
                        ...(overlayPos
                            ? { left: overlayPos.x, top: overlayPos.y }
                            : { bottom: 140, right: 50 }),
                        minWidth: 260,
                        maxWidth: 360,
                        background: "rgba(17,24,39,0.95)",
                        border: "1px solid #374151",
                        borderRadius: 8,
                        color: "#e5e7eb",
                        boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
                        zIndex: 1000,
                        padding: 12,
                        backdropFilter: "blur(6px)",
                        touchAction: 'none',
                        userSelect: 'none',
                        cursor: overlayPos ? 'default' : 'default',
                    }}
                >
                    <div
                        onPointerDown={onOverlayHeaderPointerDown}
                        onPointerMove={onOverlayHeaderPointerMove}
                        onPointerUp={onOverlayHeaderPointerUp}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, cursor: 'grab' }}
                    >
                        <div style={{ fontWeight: 700, fontSize: 14 }}>
                            {viewerOverlay.type === 'info' ? 'Sensor Information' : viewerOverlay.type === 'graphs' ? 'Sensor Graphs' : 'Sensor Statistics'}
                        </div>
                        <button onClick={hideViewerOverlay} title="Close"
                            style={{ width: 22, height: 22, borderRadius: 6, background: '#374151', color: '#9ca3af', border: 'none', cursor: 'pointer' }}>✕</button>
                    </div>
                    {viewerOverlay.type === 'info' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                            {/* Name (full width) */}
                            <div style={{ gridColumn: '1 / -1', padding: '6px 8px', background: '#0b1220', border: '1px solid #374151', borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <span style={{ color: '#9ca3af', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.3 }}>Name</span>
                                <span style={{ color: '#fff', fontWeight: 600, fontSize: 13, whiteSpace: 'normal', wordBreak: 'break-word' }}>{viewerOverlay.sensor.name || '-'}</span>
                            </div>
                            {/* Type */}
                            <div style={{ padding: '6px 8px', background: '#0b1220', border: '1px solid #374151', borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <span style={{ color: '#9ca3af', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.3 }}>Type</span>
                                <span style={{ color: '#fff', fontWeight: 600, fontSize: 13 }}>{viewerOverlay.sensor.type || '-'}</span>
                            </div>
                            {/* Value */}
                            <div style={{ padding: '6px 8px', background: '#0b1220', border: '1px solid #374151', borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <span style={{ color: '#9ca3af', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.3 }}>Value</span>
                                <span style={{ color: '#fff', fontWeight: 600, fontSize: 13 }}>{viewerOverlay.sensor.value ?? '-'}</span>
                            </div>
                            {/* Room */}
                            <div style={{ padding: '6px 8px', background: '#0b1220', border: '1px solid #374151', borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <span style={{ color: '#9ca3af', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.3 }}>Room</span>
                                <span style={{ color: '#fff', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{viewerOverlay.sensor.room || '-'}</span>
                            </div>
                            {/* Code */}
                            <div style={{ padding: '6px 8px', background: '#0b1220', border: '1px solid #374151', borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <span style={{ color: '#9ca3af', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.3 }}>Code</span>
                                <span style={{ color: '#fff', fontWeight: 600, fontSize: 13 }}>{viewerOverlay.sensor.code || '-'}</span>
                            </div>
                            {/* Mark */}
                            <div style={{ padding: '6px 8px', background: '#0b1220', border: '1px solid #374151', borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <span style={{ color: '#9ca3af', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.3 }}>Mark</span>
                                <span style={{ color: '#fff', fontWeight: 600, fontSize: 13 }}>{viewerOverlay.sensor.mark || '-'}</span>
                            </div>
                            {/* Model */}
                            <div style={{ padding: '6px 8px', background: '#0b1220', border: '1px solid #374151', borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <span style={{ color: '#9ca3af', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.3 }}>Model</span>
                                <span style={{ color: '#fff', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{viewerOverlay.sensor.model || '-'}</span>
                            </div>
                            {/* Link (full width if long) */}
                            <div style={{ gridColumn: '1 / -1', padding: '6px 8px', background: '#0b1220', border: '1px solid #374151', borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <span style={{ color: '#9ca3af', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.3 }}>Link</span>
                                {viewerOverlay.sensor.link ? (
                                    <a href={viewerOverlay.sensor.link} target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa', fontWeight: 600, fontSize: 13, textDecoration: 'underline', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {viewerOverlay.sensor.link}
                                    </a>
                                ) : (
                                    <span style={{ color: '#fff', fontWeight: 600, fontSize: 13 }}>-</span>
                                )}
                            </div>
                            {/* Battery */}
                            <div style={{ padding: '6px 8px', background: '#0b1220', border: '1px solid #374151', borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <span style={{ color: '#9ca3af', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.3 }}>Battery</span>
                                <span style={{ color: '#fff', fontWeight: 600, fontSize: 13 }}>{viewerOverlay.sensor.batteryLevel}%</span>
                            </div>
                        </div>
                    )}
                    {viewerOverlay.type !== 'info' && (
                        <div style={{ color: '#9ca3af', fontSize: 12 }}>
                            Coming soon.
                        </div>
                    )}
                </div>
            )}
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
