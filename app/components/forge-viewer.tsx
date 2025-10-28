"use client";

import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { useSensorContext } from "../context/sensor-context";
import { DataVizService, SensorSprite } from "../services/dataviz-service";
import { HeatmapService } from "../services/heatmap-service";
import EnergyDashboardOverlay from "./energy-dashboard-overlay";
import SensorGraphsDashboard from "./sensor-graphs-dashboard";
import PVSensorDashboard from "./pv-sensor-dashboard";
import SeismicSensorDashboard from "./seismic-sensor-dashboard";
import "./forge-viewer.css";
import type { ProjectModel } from "@/app/types/projects";

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
    projectLocation?: {
        latitude: number;
        longitude: number;
        address?: string;
        city?: string;
    };
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
    projectLocation,
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
    const levelsExtRef = useRef<any>(null);
    // Guard to ensure we only invoke onViewerReady once per initialization
    const hasFiredViewerReadyRef = useRef(false);
    // Track loaded overlay models by project model id (excluding primary)
    const overlayModelMapRef = useRef<Map<string, any>>(new Map());
    const prevOverlaySigRef = useRef<string>("");
    // Persistently remember which project model id is the true primary loaded into viewer.model
    const primaryModelIdRef = useRef<string | null>(null);
    // Prevent duplicate DataViz initialization attempts
    const dataVizInitInFlightRef = useRef(false);
    // Heatmap
    const heatmapRef = useRef<HeatmapService | null>(null);
    const [heatmapOn, setHeatmapOn] = useState(false);
    // Keep latest state accessible from toolbar button handler
    const heatmapOnRef = useRef(false);
    // Track when our per-level isolation logic is actively running, to suppress Properties panel
    const perLevelIsolationActiveRef = useRef(false);
    useEffect(() => {
        heatmapOnRef.current = heatmapOn;
        // Keep toolbar button visual in sync if it already exists
        try {
            const btn = heatmapBtnRef.current as any;
            if (btn?.container) {
                if (heatmapOn) btn.container.classList.add('active');
                else btn.container.classList.remove('active');
            }
        } catch {}
    }, [heatmapOn]);
    const heatmapBtnRef = useRef<any>(null);
    const [heatLegend, setHeatLegend] = useState<{ min: number; max: number; label: string; unit: string } | null>(null);
    const [heatmapChannel, setHeatmapChannel] = useState<string | null>(null);

    // Use sensor context
    const { sensors, selectedSensor, selectSensor, placeSensor, showSensorForm, getFilteredSensors, filteredSensorType, viewerOverlay, hideViewerOverlay, currentProjectId, updateSensorValues, setupRoomDetection, getRoomForDbId } = useSensorContext();
    
    // Real-time sensor updates
    useEffect(() => {
        if (!currentProjectId || activePanel !== 'iot') return;
        
        const updateRealtime = async () => {
            try {
                console.log(`[ForgeViewer] Fetching realtime updates for project ${currentProjectId}`);
                const resp = await fetch(`/api/iot/realtime?projectId=${currentProjectId}`);
                if (!resp.ok) {
                    console.warn(`[ForgeViewer] Realtime update failed: ${resp.status}`);
                    return;
                }
                const json = await resp.json();
                console.log(`[ForgeViewer] Received realtime updates:`, json.updates?.length || 0, 'sensors');
                
                if (json.updates && updateSensorValues) {
                    updateSensorValues(json.updates);
                }
            } catch (e) {
                console.warn(`[ForgeViewer] Realtime update error:`, e);
            }
        };
        
        // Initial update
        updateRealtime();
        
        // Update every 15 seconds
        const interval = setInterval(updateRealtime, 15000);
        return () => clearInterval(interval);
    }, [currentProjectId, activePanel, updateSensorValues]);
    // Draggable overlay state
    const overlayRef = useRef<HTMLDivElement | null>(null);
    const [overlayPos, setOverlayPos] = useState<{ x: number; y: number } | null>(null);
    const dragOffsetRef = useRef<{ dx: number; dy: number } | null>(null);
    const isDraggingRef = useRef(false);
    const wasDraggedRef = useRef(false);

    // Graph overlay state
    const [graphLoading, setGraphLoading] = useState(false);
    const [graphError, setGraphError] = useState<string | null>(null);
    const [graphTimestamps, setGraphTimestamps] = useState<Date[]>([]);
    const [graphSeries, setGraphSeries] = useState<{ temp: number[]; rh: number[]; co2: number[]; pressure: number[] } | null>(null);
    const [primaryKey, setPrimaryKey] = useState<'temp' | 'rh' | 'co2' | 'pressure'>('temp');

    // Map sensor type to primary data channel
    const getPrimaryChannel = (sensorType?: string): { key: 'temp'|'rh'|'co2'|'pressure', label: string, unit: string, color: string } => {
        const t = (sensorType || '').toLowerCase();
        if (t.includes('co2')) return { key: 'co2', label: 'CO2', unit: 'ppm', color: '#22c55e' };
        if (t.includes('humid')) return { key: 'rh', label: 'Relative humidity', unit: '%RH', color: '#3b82f6' };
        if (t.includes('press')) return { key: 'pressure', label: 'Barometric pressure', unit: 'hPa', color: '#f59e0b' };
        // default temperature
        return { key: 'temp', label: 'Temperature', unit: '°C', color: '#ef4444' };
    };

    // Helper to render a simple inline sparkline
    const renderSparkline = (label: string, unit: string, values: number[] | undefined, color: string, timestamps?: Date[]) => {
        if (!values || values.length === 0) return null;
        const w = 420; // wider for clarity
        const h = 180; // taller for clarity
        const lpad = 46; // left padding for Y-axis labels
        const rpad = 14;
        const tpad = 12;
        const bpad = 24; // bottom padding for time labels
        const min = Math.min(...values);
        const max = Math.max(...values);
        const span = max - min || 1;
        const innerW = w - lpad - rpad;
        const innerH = h - tpad - bpad;
        const stepX = innerW / Math.max(1, values.length - 1);
        const points: string = values
            .map((v, i) => {
                const x = lpad + i * stepX;
                const y = tpad + innerH * (1 - (v - min) / span);
                return `${x},${y}`;
            })
            .join(' ');
        const latest = values[values.length - 1];
        // Simple time labels: start, middle, end
        const makeTime = (d?: Date) => d ? `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}` : '';
        const t0 = timestamps && timestamps[0];
        const tm = timestamps && timestamps[Math.floor((timestamps.length - 1)/2)];
        const tn = timestamps && timestamps[timestamps.length - 1];
        // Threshold-based latest text color
        const lower = label.toLowerCase();
        let latestColor = "#ffffff";
        const valNum = typeof latest === 'number' ? latest : parseFloat(String(latest));
        if (!isNaN(valNum)) {
            if (lower.includes('temperature')) {
                // yellow ≥ 28, red ≥ 30
                latestColor = valNum >= 30 ? '#ef4444' : valNum >= 28 ? '#f59e0b' : '#ffffff';
            } else if (lower.includes('co2')) {
                // yellow ≥ 1000, red ≥ 1200
                latestColor = valNum >= 1200 ? '#ef4444' : valNum >= 1000 ? '#f59e0b' : '#ffffff';
            } else if (lower.includes('humidity')) {
                // yellow for 60-70 or 25-30, red for <25 or >70
                latestColor = (valNum > 70 || valNum < 25) ? '#ef4444' : (valNum >= 60 || valNum <= 30) ? '#f59e0b' : '#ffffff';
            }
        }
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <div style={{ color: '#d1d5db', fontSize: 12 }}>{label}</div>
                    <div style={{ color: latestColor, fontWeight: 800, fontSize: 14 }}>{latest}{unit ? ` ${unit}` : ''}</div>
                </div>
                <svg width={w} height={h} style={{ background: '#0b1220', border: '1px solid #1f2937', borderRadius: 8 }}>
                    {/* Plot area border */}
                    <rect x={lpad} y={tpad} width={innerW} height={innerH} rx={6} ry={6} fill="none" stroke="#111827" />
                    {/* Horizontal gridlines + Y-axis labels (left) */}
                    {Array.from({ length: 5 }).map((_, i) => {
                        const y = tpad + i * (innerH / 4);
                        const val = (max - (span / 4) * i).toFixed(0);
                        return (
                            <g key={i}>
                                <line x1={lpad} y1={y} x2={lpad + innerW} y2={y} stroke="#1f2937" strokeWidth="1" />
                                <text x={lpad - 6} y={y + 3} fill="#6b7280" fontSize="10" textAnchor="end">{val}</text>
                            </g>
                        );
                    })}
                    {/* Vertical gridlines */}
                    {Array.from({ length: 5 }).map((_, i) => {
                        const x = lpad + i * (innerW / 4);
                        return <line key={`v${i}`} x1={x} y1={tpad} x2={x} y2={tpad + innerH} stroke="#0f172a" strokeWidth="1" />
                    })}
                    {/* Polyline */}
                    <polyline fill="none" stroke={color} strokeWidth="2.5" points={points} />
                    {/* Markers every ~6th point to avoid clutter */}
                    {values.map((v, i) => {
                        if (i % Math.max(1, Math.floor(values.length / 12)) !== 0) return null;
                        const x = lpad + i * stepX;
                        const y = tpad + innerH * (1 - (v - min) / span);
                        const tt = timestamps && timestamps[i] ? `${makeTime(timestamps[i])} • ${v}${unit ? ` ${unit}` : ''}` : `${v}${unit ? ` ${unit}` : ''}`;
                        return (
                            <circle key={i} cx={x} cy={y} r={3} fill="#e5e7eb" stroke="#111827" strokeWidth="0.5">
                                <title>{tt}</title>
                            </circle>
                        )
                    })}
                    {timestamps && timestamps.length > 1 && (
                        <>
                            {/* time labels */}
                            <text x={lpad} y={h - 6} fill="#9ca3af" fontSize="11">{makeTime(t0)}</text>
                            <text x={lpad + innerW / 2 - 16} y={h - 6} fill="#9ca3af" fontSize="11">{makeTime(tm)}</text>
                            <text x={lpad + innerW - 34} y={h - 6} fill="#9ca3af" fontSize="11">{makeTime(tn)}</text>
                        </>
                    )}
                </svg>
            </div>
        );
    };

    // Fetch samples when the graphs overlay opens
    useEffect(() => {
        const load = async () => {
            if (!viewerOverlay || viewerOverlay.type !== 'graphs') return;
            const sensorId = viewerOverlay.sensor?.id;
            if (!sensorId) return;
            try {
                console.log(`[ForgeViewer] Loading graphs for sensor ${sensorId}`);
                setGraphLoading(true);
                setGraphError(null);
                setGraphSeries(null);
                // Default to last 6 hours window
                const end = new Date();
                const start = new Date(end.getTime() - 6 * 3600 * 1000);
                const params = new URLSearchParams({
                    start: start.toISOString(),
                    end: end.toISOString(),
                    resolution: '60',
                });
                if (currentProjectId) params.set('projectId', currentProjectId);
                console.log(`[ForgeViewer] Fetching samples with params:`, params.toString());
                const resp = await fetch(`/api/iot/samples?${params.toString()}`);
                if (!resp.ok) {
                    const txt = await resp.text().catch(() => '');
                    throw new Error(`Samples request failed: ${resp.status} ${txt}`);
                }
                const json = await resp.json();
                console.log(`[ForgeViewer] Received samples response:`, json);
                const timestamps: string[] = json.timestamps || [];
                const data = json.data || {};
                const sdata = data[sensorId];
                if (!sdata) {
                    console.warn(`[ForgeViewer] No data found for sensor ${sensorId}. Available sensors:`, Object.keys(data));
                    throw new Error('No data for selected sensor');
                }
                const primary = getPrimaryChannel(viewerOverlay.sensor?.type);
                setPrimaryKey(primary.key);
                console.log(`[ForgeViewer] Setting graph series for sensor ${sensorId}:`, sdata);
                setGraphTimestamps(timestamps.map((t: string) => new Date(t)));
                setGraphSeries({
                    temp: sdata.temp || [],
                    rh: sdata.rh || [],
                    co2: sdata.co2 || [],
                    pressure: sdata.pressure || [],
                });
            } catch (e: any) {
                console.error(`[ForgeViewer] Error loading graphs:`, e);
                setGraphError(e?.message || 'Failed to load samples');
            } finally {
                setGraphLoading(false);
            }
        };
        load();
        // Append realtime point every 5s when overlay is open
        const appendRealtime = async () => {
            try {
                if (!currentProjectId || !viewerOverlay?.sensor?.id) return;
                const resp = await fetch(`/api/iot/realtime?projectId=${currentProjectId}`);
                if (!resp.ok) return;
                const json = await resp.json();
                const upd = (json.updates || []).find((u: any) => u.id === viewerOverlay.sensor.id);
                if (!upd) return;
                // Parse numeric from value string
                const num = parseFloat(String(upd.value).replace(/[^0-9.+-]/g, ''));
                const now = new Date(json.timestamp || Date.now());
                setGraphTimestamps(prev => {
                    const next = [...prev, now];
                    // Keep last 120 points
                    return next.slice(-120);
                });
                setGraphSeries(prev => {
                    if (!prev) return prev;
                    const meta = getPrimaryChannel(viewerOverlay.sensor?.type);
                    const key = meta.key;
                    const next = { ...prev } as any;
                    next[key] = [...(next[key] || []), num].slice(-120);
                    return next;
                });
            } catch (e) {
                console.warn('[ForgeViewer] Failed to append realtime point', e);
            }
        };
        const rtInterval = setInterval(appendRealtime, 5000);
        return () => clearInterval(rtInterval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [viewerOverlay, currentProjectId]);

    // Reactively update heatmap when sensors or panel/flag changes
    useEffect(() => {
        const run = async () => {
            const viewerInstance = viewerRef.current;
            const svc = heatmapRef.current;
            if (!viewerInstance || !svc) return;
            // Only render heatmap when enabled and on IoT or BIM panels (adjust as needed)
            const shouldShow = heatmapOn && (activePanel === 'iot');
            console.log(`[ForgeViewer] Heatmap effect: heatmapOn=${heatmapOn}, activePanel=${activePanel}, shouldShow=${shouldShow}`);
            if (!shouldShow) {
                console.log(`[ForgeViewer] Hiding heatmap...`);
                svc.hideHeatmap();
                setHeatLegend(null);
                return;
            }
            // Prepare values from currently visible/filtered sensors
            try {
                console.log(`[ForgeViewer] Showing heatmap for channel: ${heatmapChannel}`);
                // Use selected channel; fall back to all if not selected
                const src = (sensors || []) as any[];
                const byChannel = heatmapChannel ? src.filter(s => s.type === heatmapChannel) : src;
                console.log(`[ForgeViewer] Heatmap sensors: ${byChannel.length} of ${src.length}`);
                await svc.updateAndShowHeatmap(byChannel as any);
                // Compute range for legend
                const nums: number[] = [];
                for (const s of byChannel) {
                    const n = parseFloat(String((s as any).value ?? ''));
                    if (!isNaN(n) && (s as any).roomId != null) nums.push(n);
                }
                if (nums.length) {
                    const min = Math.min(...nums);
                    const max = Math.max(...nums);
                    const pickType = heatmapChannel || (byChannel[0]?.type as string);
                    const meta = getPrimaryChannel(pickType);
                    setHeatLegend({ min, max, label: meta.label, unit: meta.unit });
                } else {
                    setHeatLegend(null);
                }
            } catch (e) {
                console.error('[ForgeViewer] Heatmap update failed', e);
            }
        };
        run();
    }, [heatmapOn, activePanel, sensors, filteredSensorType, heatmapChannel]);

    // Cleanup heatmap and button on unmount
    useEffect(() => {
        return () => {
            try { heatmapRef.current?.hideHeatmap(); } catch {}
            try {
                const v = viewerRef.current;
                const Autodesk = (window as any).Autodesk;
                const ui = Autodesk?.Viewing?.UI;
                if (v?.toolbar && ui && heatmapBtnRef.current) {
                    const ctrl = v.toolbar.getControl('bim-custom-tools');
                    if (ctrl) {
                        ctrl.removeControl('toggle-heatmap-btn');
                    }
                }
            } catch {}
        };
    }, []);

    // Helper to completely disable/enable an entire model using visibilityManager
    const setModelVisible = (model: any, visible: boolean) => {
        const modelId = model?.getModelId?.() || model?.id || 'unknown';
        console.group(`🔧 [setModelVisible] Setting visibility to ${visible} for model: ${modelId}`);
        try {
            if (!model || !viewer?.impl?.visibilityManager) {
                console.warn('   ⚠️  Model or visibilityManager not available. Aborting.');
                console.groupEnd();
                return;
            }
            
            const visibilityManager = viewer.impl.visibilityManager;
            
            if (!model.getObjectTree) {
                console.warn('   ⚠️  Model has no getObjectTree method. Some visibility operations may fail.');
            }
            
            if (!visible) {
                console.log('   -> Attempting to HIDE model completely.');
                
                // Method 1: Use viewer.hide() - robust for overlays
                try {
                    console.log('   [Method 1] Calling viewer.hide(model)');
                    viewer.hide(model);
                } catch (e) {
                    console.warn('   [Method 1] viewer.hide() failed:', e);
                }

                // Method 2: Direct model visibility setting
                try {
                    if (model.setVisible && typeof model.setVisible === 'function') {
                        console.log('   [Method 2] Calling model.setVisible(false)');
                        model.setVisible(false);
                    }
                } catch (e) {
                    console.warn('   [Method 2] model.setVisible() failed:', e);
                }
                
                // Method 3: Fragment-level hiding as backup
                try {
                    if (model.getFragmentList) {
                        const fragList = model.getFragmentList();
                        const count = fragList.getCount?.() ?? 0;
                        console.log(`   [Method 3] Setting ${count} fragments invisible`);
                        for (let i = 0; i < count; i++) {
                            fragList.setVisibility(i, false);
                        }
                        if (fragList.updateAnimTransforms) fragList.updateAnimTransforms();
                    }
                } catch (e) {
                    console.warn('   [Method 3] Fragment visibility failed:', e);
                }

            } else {
                console.log('   -> Attempting to SHOW model.');

                // Method 1: Use viewer.show() - robust for overlays
                try {
                    console.log('   [Method 1] Calling viewer.show(model)');
                    viewer.show(model);
                } catch (e) {
                    console.warn('   [Method 1] viewer.show() failed:', e);
                }

                // Method 2: Direct model visibility setting
                try {
                    if (model.setVisible && typeof model.setVisible === 'function') {
                        console.log('   [Method 2] Calling model.setVisible(true)');
                        model.setVisible(true);
                    }
                } catch (e) {
                    console.warn('   [Method 2] model.setVisible() failed:', e);
                }
                
                // Method 3: Fragment-level showing as backup
                try {
                    if (model.getFragmentList) {
                        const fragList = model.getFragmentList();
                        const count = fragList.getCount?.() ?? 0;
                        console.log(`   [Method 3] Setting ${count} fragments visible`);
                        for (let i = 0; i < count; i++) {
                            fragList.setVisibility(i, true);
                        }
                        if (fragList.updateAnimTransforms) fragList.updateAnimTransforms();
                    }
                } catch (e) {
                    console.warn('   [Method 3] Fragment visibility failed:', e);
                }
                
                // Method 4: Force mesh loading for visible models
                try {
                    if (model.loader && model.loader.loadGeometry && visible) {
                        console.log('   [Method 4] Forcing geometry loading for visible model');
                        // Force load all geometry for this model
                        const loader = model.loader;
                        if (loader.loadAllGeometry) {
                            loader.loadAllGeometry();
                        } else if (loader.loadGeometry) {
                            // Force load critical fragments
                            const fragList = model.getFragmentList();
                            if (fragList) {
                                const count = Math.min(fragList.getCount?.() ?? 0, 10000); // Limit to avoid overload
                                for (let i = 0; i < count; i += 100) { // Load every 100th fragment to start
                                    try {
                                        loader.loadGeometry(i);
                                    } catch {}
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.warn('   [Method 4] Geometry loading failed:', e);
                }
            }
            
            // Force viewer refresh and invalidation
            if (viewer.impl?.invalidate) {
                console.log('   -> Invalidating viewer state.');
                viewer.impl.invalidate(true, true, true);
            }
            
            console.log(`   ✅ Model ${visible ? 'ENABLED' : 'DISABLED'} - visibility operation completed.`);
        } catch (e) {
            console.error('   ❌ setModelVisible failed:', e);
        } finally {
            console.groupEnd();
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

    // Helper: match an element's Level to the selected floor robustly
    const levelMatchesFloor = (elemLevel: any, floor: { name: string; levelIndex: number }) => {
        if (elemLevel == null) return false;
        const el = String(elemLevel).trim();
        const fname = String(floor.name || '').trim();
        if (!el && !fname) return false;
        // Direct match on name
        if (fname && el === fname) return true;
        // Numeric match on level index (common in some Revit exports where Level is '5')
        if (el === String(floor.levelIndex)) return true;
        // Loose match: 'Level 5' contains 5
        if (/^level\s*\d+$/i.test(el)) {
            const num = el.replace(/[^0-9.-]/g, '');
            if (num && Number(num) === Number(floor.levelIndex)) return true;
        }
        return false;
    };

    // Helper: apply per-level isolation with category exclusions
    const applyPerLevelIsolation = async (v: any, floor: { name: string; zMin: number; zMax: number; levelIndex: number }) => {
        try {
            if (!v) return;
            console.group(`🧱 [PerLevelIsolation] Applying for '${floor.name}' [${floor.levelIndex}] z:[${floor.zMin.toFixed(2)}, ${floor.zMax.toFixed(2)}]`);
            perLevelIsolationActiveRef.current = true;

            // Turn off section capping to avoid visual lid
            try { v.prefs?.set?.('sectionCap', false); } catch {}

            // Reset any previous isolation/hide so we start from a clean slate
            try { v.isolate([]); } catch {}
            try { v.showAll(); } catch {}

            const models: any[] = (typeof v.getAllModels === 'function') ? (v.getAllModels() || []) : (v.model ? [v.model] : []);
            const EXCLUDE_CATS = new Set<string>([
                // Revit-specific names
                'Revit Ceilings', 'Revit Mass Floor', 'Revit Rooms','Piani', 'Revit Spaces', 'Soffitti' ,
                // Generic fallbacks
                'Ceilings', 'Ceiling', 'Roofs', 'Roof', 'Rooms', 'Spaces', 'Topography'
            ]);

            // We'll exclude Floors that are NOT on the selected level, but keep the current level's floor
            const FLOOR_CATS = new Set<string>(['Revit Floors', 'Floors']);

            for (const model of models) {
                const tree = model?.getInstanceTree?.();
                if (!tree) continue;
                const root = tree.getRootId?.() ?? 1;
                const dbIds: number[] = [];
                tree.enumNodeChildren(root, (id: number) => { dbIds.push(id); }, true);
                if (!dbIds.length) continue;
                // Helpers
                const fragList = model?.getFragmentList?.();
                const THREE = (window as any).THREE;
                const bandPad = 0.05; // 5cm tolerance
                const bandMin = floor.zMin - bandPad;
                const bandMax = floor.zMax + bandPad;
                const getNodeBbox = (nodeId: number) => {
                    try {
                        // Fast path (works on v7 for dbId)
                        const bb = model.getBoundingBox(nodeId);
                        if (bb && bb.min && bb.max) return bb;
                    } catch {}
                    // Fallback via fragments
                    if (!fragList || !THREE) return null;
                    const b = new THREE.Box3();
                    let has = false;
                    try {
                        fragList.enumNodeFragments(nodeId, (fragId: number) => {
                            const fb = new THREE.Box3();
                            fragList.getWorldBounds(fragId, fb);
                            if (!has) { b.copy(fb); has = true; } else { b.union(fb); }
                        }, true);
                    } catch {}
                    return has ? b : null;
                };

                await new Promise<void>((resolve) => {
                    try {
                        model.getBulkProperties(dbIds, { propFilter: ['Level', 'Category'] }, (elems: any[]) => {
                            const inLevel: number[] = [];
                            const toHide: number[] = [];

                            for (const e of elems) {
                                const props = e.properties || [];
                                const lvl = props.find((p: any) => p.displayName === 'Level')?.displayValue;
                                const cat = props.find((p: any) => p.displayName === 'Category')?.displayValue || '';
                                const catStr = String(cat);
                                const byLevel = levelMatchesFloor(lvl, floor);
                                const bb = getNodeBbox(e.dbId);
                                const byBand = bb ? (bb.max.z >= bandMin && bb.min.z <= bandMax) : false;

                                // Include rule: in z-band OR explicit Level match, but not in excluded categories
                                if ((byBand || byLevel) && !EXCLUDE_CATS.has(catStr)) {
                                    inLevel.push(e.dbId);
                                }

                                // Hide rule: exclude categories regardless of band
                                if (EXCLUDE_CATS.has(catStr)) {
                                    toHide.push(e.dbId);
                                } else if (FLOOR_CATS.has(catStr)) {
                                    // Floors from other levels act as ceilings
                                    if (!byLevel) {
                                        // If above band significantly, definitely hide
                                        if (bb && bb.min.z > bandMax - bandPad) {
                                            toHide.push(e.dbId);
                                        } else if (!byBand) {
                                            toHide.push(e.dbId);
                                        }
                                    }
                                }
                            }

                            try { v.isolate(inLevel, model); } catch {}
                            if (toHide.length) {
                                try { v.hide(toHide, model); } catch {}
                            }

                            console.log(`   • Model ${model?.id ?? model?.getModelId?.()} → isolate=${inLevel.length}, hide=${toHide.length}`);
                            resolve();
                        }, (err: any) => {
                            console.warn('[PerLevelIsolation] getBulkProperties failed', err);
                            resolve();
                        });
                    } catch (err) {
                        console.warn('[PerLevelIsolation] Bulk properties error', err);
                        resolve();
                    }
                });
            }
            try { v.fitToView?.(); } catch {}
            try { v.impl?.invalidate?.(true, true, true); } catch {}
            // Suppress Properties panel auto-open triggered by isolate
            try { v.getPropertyPanel?.()?.setVisible(false); } catch {}
            console.groupEnd();
        } catch (e) {
            console.error('[PerLevelIsolation] Failed', e);
        } finally {
            perLevelIsolationActiveRef.current = false;
        }
    };

    const clearPerLevelIsolation = (v: any) => {
    try {
        if (!v) return;
        console.group('🧱 [PerLevelIsolation] Clearing');
        try { v.isolate([]); } catch {}
        try { v.showAll(); } catch {}
        try { v.setCutPlanes?.([], 'Autodesk.AEC.FloorSelector'); } catch {}
        try { v.impl?.invalidate?.(true, true, true); } catch {}
        try { v.getPropertyPanel?.()?.setVisible(false); } catch {}
        console.groupEnd();
    } catch (e) {
        console.warn('[PerLevelIsolation] Clear failed', e);
    }
};

    // Global isolation-changed listener
    const isolationChangedHandler = () => {
        try {
            if (perLevelIsolationActiveRef.current) {
                viewerRef.current.getPropertyPanel?.()?.setVisible(false);
            }
        } catch (e) {
            console.warn('[PerLevelIsolation] Isolation changed handler failed', e);
        }
    };

    // Subscribe to isolation-changed to keep Properties panel hidden during our level isolation
    useEffect(() => {
        const v = viewerRef.current;
        const AV = (window as any)?.Autodesk?.Viewing;
        if (!v || !AV) return;
        v.addEventListener(AV.AGGREGATE_ISOLATION_CHANGED_EVENT, isolationChangedHandler);
        return () => {
            try { v.removeEventListener(AV.AGGREGATE_ISOLATION_CHANGED_EVENT, isolationChangedHandler); } catch {}
        };
    }, [modelLoaded]);

    // Apply model visibility according to enabledModelIds using complete disable/enable
    const applyModelVisibility = (v: any) => {
        console.groupCollapsed(`🚀 [applyModelVisibility] Applying visibility rules at ${new Date().toLocaleTimeString()}`);
        try {
            console.log('Received enabledModelIds:', enabledModelIds ? Array.from(enabledModelIds) : 'none');
            console.log('Viewer initialized:', isInitialized, 'Overlay models loaded:', overlayModelsLoaded);
            
            if (!enabledModelIds) {
                console.log('No enabledModelIds set. No changes will be made.');
                console.groupEnd();
                return;
            }

            if (enabledModelIds.size === 0) {
                console.log('enabledModelIds is empty. Hiding all models.');
            }
            
            // Handle primary model
            const primaryModel = v?.model;
            const truePrimaryId = primaryModelIdRef.current;
            console.log('Primary model info:', { hasModel: !!primaryModel, truePrimaryId, modelId: primaryModel?.getModelId?.() });
            
            if (primaryModel && truePrimaryId) {
                const shouldShow = enabledModelIds.has(truePrimaryId);
                console.log(`-> Processing Primary model '${truePrimaryId}': Should be ${shouldShow ? 'VISIBLE' : 'HIDDEN'}`);
                setModelVisible(primaryModel, shouldShow);
            } else {
                console.log('-> No primary model to process or its ID is not tracked.');
            }
            
            // Handle overlay models
            const overlays = overlayModelMapRef.current;
            console.log(`Processing ${overlays.size} overlay models...`);
            
            if (overlays && overlays.size > 0) {
                for (const [modelId, mdl] of overlays.entries()) {
                    const shouldShow = enabledModelIds.has(modelId as string);
                    console.log(`-> Processing Overlay model '${modelId}': Should be ${shouldShow ? 'VISIBLE' : 'HIDDEN'}`);
                    setModelVisible(mdl, shouldShow);
                }
            }
            
            // Fix camera and rendering after visibility changes
            setTimeout(() => {
                try {
                    console.log('🎥 [Camera Fix] Applying post-visibility camera and rendering fixes...');
                    
                    // Force viewer to recalculate bounds and fit to visible content
                    if (v && typeof v.fitToView === 'function') {
                        console.log('🎥 [Camera Fix] Calling fitToView() to focus on visible models');
                        v.fitToView();
                    }
                    
                    // Force a complete re-render
                    if (v?.impl) {
                        console.log('🎥 [Camera Fix] Forcing viewer invalidation and refresh');
                        if (v.impl.invalidate) {
                            v.impl.invalidate(true, true, true); // force refresh, clear caches, update transforms
                        }
                        if (v.impl.sceneUpdated) {
                            v.impl.sceneUpdated(true);
                        }
                        // Force render
                        if (v.impl.renderer && v.impl.renderer.needsRender) {
                            v.impl.renderer.needsRender = true;
                        }
                    }
                    
                    // Ensure proper ghosting and display settings
                    try {
                        if (v.setGhosting) v.setGhosting(false);
                        safeSetDisplayEdges(v, true);
                    } catch (e) {
                        console.warn('🎥 [Camera Fix] Display settings failed:', e);
                    }
                    
                    console.log('🎥 [Camera Fix] Camera and rendering fixes completed');
                } catch (e) {
                    console.error('🎥 [Camera Fix] Failed:', e);
                }
            }, 100); // Small delay to let visibility changes settle
            
            console.log('🚀 [applyModelVisibility] Model visibility control completed');
        } catch (e) {
            console.error('🚀 [applyModelVisibility] Failed:', e);
        } finally {
            console.groupEnd();
        }
    };

    // Helper: ensure AEC Levels extension is loaded and wired; optionally show the panel
    const ensureLevelsWired = async (showPanel: boolean) => {
        const v = viewerRef.current;
        const Autodesk = (window as any).Autodesk;
        if (!v || !Autodesk || !Autodesk.Viewing || !modelLoaded) return;
        try {
            const existing = (typeof v.getExtension === 'function') ? v.getExtension('Autodesk.AEC.LevelsExtension') : null;
            const levelsExt = existing || await v.loadExtension('Autodesk.AEC.LevelsExtension');
            if (!levelsExt) return;
            levelsExtRef.current = levelsExt;

            // Show/hide panel depending on context
            try { levelsExt.levelsPanel?.setVisible?.(!!showPanel); } catch {}

            // Optional: log floors
            try {
                const floors = levelsExt?.floorSelector?.floorData || [];
                if (floors && floors.length) {
                    console.log(`[ForgeViewer] Levels ready with ${floors.length} floors`);
                }
            } catch {}

            // Attach handler once
            try {
                const fs = levelsExt?.floorSelector;
                const EVT = 'Autodesk.AEC.FloorSelector.SELECTED_FLOOR_CHANGED';
                const EVT2 = 'Autodesk.AEC.FloorSelector.FLOOR_ACTIVATED';
                const handleIndex = (idx: number | undefined) => {
                    try {
                        const arr = levelsExt?.floorSelector?.floorData || [];
                        if (typeof idx === 'number' && arr[idx]) {
                            const fd = arr[idx];
                            const floor = { name: fd.name || `Level ${idx}`, zMin: fd.zMin ?? 0, zMax: fd.zMax ?? 0, levelIndex: idx };
                            applyPerLevelIsolation(v, floor);
                        } else {
                            clearPerLevelIsolation(v);
                        }
                    } catch (e) { console.warn('[ForgeViewer] handleIndex failed', e); }
                };
                const handler = ({ target, levelIndex }: any) => {
                    try {
                        if (typeof levelIndex === 'number') {
                            handleIndex(levelIndex);
                        } else {
                            const idx = fs?.getActiveFloor?.();
                            handleIndex(typeof idx === 'number' ? idx : undefined);
                        }
                    } catch (e) { console.warn('[ForgeViewer] Floor change handler failed', e); }
                };
                // avoid duplicates
                try { fs?.removeEventListener?.(EVT, (levelsExt as any).__floorHandler); } catch {}
                fs?.addEventListener?.(EVT, handler);
                (levelsExt as any).__floorHandler = handler;

                // Also listen to FLOOR_ACTIVATED (double-click activation in some builds)
                try { fs?.removeEventListener?.(EVT2, (levelsExt as any).__floorHandler2); } catch {}
                const handler2 = (ev: any) => {
                    try {
                        const idx = ev?.detail?.levelIndex;
                        handleIndex(typeof idx === 'number' ? idx : fs?.getActiveFloor?.());
                    } catch (e) { console.warn('[ForgeViewer] FLOOR_ACTIVATED handler failed', e); }
                };
                fs?.addEventListener?.(EVT2, handler2);
                (levelsExt as any).__floorHandler2 = handler2;

                // Monkey-patch selectFloor to always invoke our handler after native behavior
                try {
                    if (!(fs as any).__patchedSelect) {
                        const orig = fs.selectFloor?.bind(fs);
                        fs.selectFloor = (idx: number, highlight: boolean) => {
                            try { orig?.(idx, highlight); } catch {}
                            // Defer to let native state settle, then apply isolation
                            setTimeout(() => handleIndex(idx), 0);
                        };
                        (fs as any).__patchedSelect = true;
                    }
                } catch (e) { console.warn('[ForgeViewer] Failed to patch selectFloor', e); }

                // Debug helpers
                try {
                    (window as any).__PLI = {
                        apply: (idx: number) => {
                            const data = levelsExt?.floorSelector?.floorData || [];
                            const fd = typeof idx === 'number' ? data[idx] : null;
                            if (!fd) { console.warn('No floor at index', idx); return; }
                            const f = { name: fd.name || `Level ${idx}`, zMin: fd.zMin ?? 0, zMax: fd.zMax ?? 0, levelIndex: idx };
                            applyPerLevelIsolation(v, f);
                        },
                        clear: () => clearPerLevelIsolation(v),
                        getFloors: () => (levelsExt?.floorSelector?.floorData || []).map((f: any, i: number) => ({ i, name: f?.name, zMin: f?.zMin, zMax: f?.zMax }))
                    };
                    console.log('🔧 [ForgeViewer] __PLI debug helpers available: __PLI.getFloors(), __PLI.apply(index), __PLI.clear()');
                } catch {}
            } catch (e) {
                console.warn('[ForgeViewer] Failed to attach floor change handler', e);
            }
        } catch (e) {
            console.warn('[ForgeViewer] Failed to load/wire Levels extension:', e);
        }
    };

    // Always wire levels when model is ready (no panel by default)
    useEffect(() => {
        if (!modelLoaded) return;
        ensureLevelsWired(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [modelLoaded]);

    // On IoT panel switch, show/hide the panel and maintain wiring
    useEffect(() => {
        const v = viewerRef.current;
        const Autodesk = (window as any).Autodesk;
        if (!v || !Autodesk || !Autodesk.Viewing || !modelLoaded) return;

        const hideLevels = () => {
            try {
                const ext = levelsExtRef.current || (typeof v.getExtension === 'function' ? v.getExtension('Autodesk.AEC.LevelsExtension') : null);
                if (ext) {
                    try { ext.floorSelector?.restore3DView?.(); } catch {}
                    try { v?.setCutPlanes?.([], 'Autodesk.AEC.FloorSelector'); } catch {}
                    try { clearPerLevelIsolation(v); } catch {}
                    try { ext.levelsPanel?.setVisible?.(false); } catch {}
                }
            } catch {}
        };

        if (activePanel === 'iot') {
            ensureLevelsWired(true);
        } else {
            hideLevels();
        }
    }, [activePanel, modelLoaded]);

    // Dynamically reconcile overlay models without re-initializing primary
    useEffect(() => {
        const all = models || [];
        if (!all.length) return;
        const viewerInstance = viewerRef.current;

        // Determine the true primary by the id captured at initialization
        const truePrimaryId = primaryModelIdRef.current;
        // Build overlays from all models except the true primary id (fallback: exclude index 0 if unknown)
        const overlays = truePrimaryId
            ? all.filter(m => m.id !== truePrimaryId)
            : all.slice(1);

        // Build a stable signature of overlays (id + urn + transform)
        const overlaySig = overlays
            .map(m => `${m.id}|${m.urn}|${m.transform ? `${m.transform.tx||0},${m.transform.ty||0},${m.transform.tz||0},${m.transform.rx||0},${m.transform.ry||0},${m.transform.rz||0},${m.transform.sx||1},${m.transform.sy||1},${m.transform.sz||1}` : '0,0,0,0,0,0,1,1,1'}`)
            .join(';');

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

        // Compute diff: desired set is our overlays list
        const desired = new Map<string, ProjectModel>();
        for (const m of overlays) desired.set(m.id, m);
        const current = overlayModelMapRef.current;

        // Unload removed models
        for (const [id, mdl] of Array.from(current.entries())) {
            if (!desired.has(id)) {
                try {
                    if (viewerInstance && mdl) {
                        viewerInstance.unloadModel(mdl);
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
                console.log(`🔧 [${id}] Loading overlay model`);
                
                Autodesk.Viewing.Document.load(
                    `urn:${m.urn}`,
                    (doc: any) => {
                        // Load master views to include room data
                        const geom = doc.getRoot().getDefaultGeometry(true);
                        if (!geom) return resolve();
                        
                        // Apply enhanced loading options for independent model alignment
                        const opts: any = { 
                            keepCurrentModels: true,
                            applyRefPoint: true,  // Critical for BIM discipline alignment
                            isAEC: true,         // Enable AEC-specific alignment features
                            applyScaling: 'm',   // Use meter scaling for consistency
                            preserveView: false, // Don't preserve view when loading overlays
                            sharedPropertyDbPath: null // Prevent shared property dependencies
                        };
                        
                        // Use consistent globalOffset for coordinate system alignment
                        try {
                            const primary = viewerInstance?.model;
                            const pData = primary?.getData?.();
                            const THREE = (window as any).THREE;
                            if (THREE && pData?.globalOffset) {
                                const go = pData.globalOffset;
                                opts.globalOffset = new THREE.Vector3(go.x || 0, go.y || 0, go.z || 0);
                                console.log(`🔧 [${id}] Reconcile - Using reference globalOffset for independent alignment:`, opts.globalOffset);
                            } else if (THREE) {
                                opts.globalOffset = new THREE.Vector3(0, 0, 0);
                                console.log(`🔧 [${id}] Reconcile - Using origin globalOffset for independent positioning`);
                            }
                        } catch (e) {
                            console.warn(`🔧 [${id}] Reconcile - Failed to set reference globalOffset:`, e);
                        }
                        
                        const userTransform = buildMatrixFromTransform(m.transform || undefined);
                        if (userTransform) {
                            opts.placementTransform = userTransform;
                            console.log(`🔧 [${id}] Reconcile - Applied user transform:`, m.transform);
                        }
                        
                        viewerInstance.loadDocumentNode(doc, geom, opts).then((model: any) => {
                            current.set(id, model);
                            
                            // Enhanced alignment using proper globalOffset handling
                            try {
                                // Set visibility based on current enabledModelIds immediately
                                const shouldShow = (!enabledModelIds || enabledModelIds.size === 0)
                                    ? true
                                    : enabledModelIds.has(id);
                                console.log(`🔧 [${id}] Reconcile - Setting visibility: ${shouldShow}`);
                                setModelVisible(model, shouldShow);
                                if (viewerInstance?.impl?.invalidate) viewerInstance.impl.invalidate(true);
                            } catch (e) {
                                console.warn(`🔧 [${id}] Reconcile - Failed to set visibility:`, e);
                            }
                            resolve();
                        }).catch((err: any) => {
                            console.error(`🔧 [${id}] Reconcile - Failed to load overlay model:`, err);
                            resolve();
                        });
                    },
                    (err: any) => {
                        console.error(`🔧 [${id}] Reconcile - Failed to load document:`, err);
                        resolve();
                    }
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
            } else {
            }
        }
    }, [isInitialized, urn, models, loadedUrn]);

    // Initialize viewer and DataViz service (run once per component mount or access token change)
    useEffect(() => {
        const primaryUrn = models && models.length > 0 ? models[0].urn : urn;
        if (!viewerContainer.current || !accessToken || !primaryUrn) return;
        // Hard guard: if a viewer instance already exists, do NOT create another
        if (viewerRef.current) return;
        // Prevent multiple initializations
        if (initializationRef.current || initInFlightRef.current) return;
        initializationRef.current = true;
        initInFlightRef.current = true;
        // Set loadedUrn immediately to avoid re-entrancy before geometry event
        if (!loadedUrn) setLoadedUrn(primaryUrn);
        // Reset viewerReady guard for this initialization cycle
        hasFiredViewerReadyRef.current = false;

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
            const THREE = (window as any).THREE;
            
            console.log('🔧 [loadOverlayModels] Starting overlay model loading for', models.length - 1, 'models');
            
            for (let i = 1; i < models.length; i++) {
                const m = models[i];
                console.log(`🔧 [${m.id}] Loading overlay model`);
                
                await new Promise<void>((resolve) => {
                    Autodesk.Viewing.Document.load(
                        `urn:${m.urn}`,
                        (doc: any) => {
                            // Load master views to include room data
                            const geom = doc.getRoot().getDefaultGeometry(true);
                            if (!geom) return resolve();
                            
            // Build proper loading options for independent discipline alignment
            const opts: any = { 
                keepCurrentModels: true,
                applyRefPoint: true,  // Critical for BIM discipline alignment
                isAEC: true,         // Enable AEC-specific alignment features
                applyScaling: 'm',   // Use meter scaling for consistency
                preserveView: false, // Don't preserve view when loading overlays
                sharedPropertyDbPath: null // Prevent shared property dependencies
            };
            
            // Store reference globalOffset for consistent coordinate system
            let referenceGlobalOffset = null;
            
            // Get primary model's globalOffset for coordinate system reference
            try {
                const primary = viewerInstance?.model;
                const pData = primary?.getData?.();
                if (THREE && pData?.globalOffset) {
                    const go = pData.globalOffset;
                    referenceGlobalOffset = new THREE.Vector3(go.x || 0, go.y || 0, go.z || 0);
                    // Apply the same globalOffset to ensure coordinate system consistency
                    opts.globalOffset = referenceGlobalOffset.clone();
                    console.log(`🔧 [${m.id}] Using reference globalOffset for independent alignment:`, opts.globalOffset);
                } else {
                    // If no primary reference, use origin to ensure independent positioning
                    if (THREE) {
                        opts.globalOffset = new THREE.Vector3(0, 0, 0);
                        console.log(`🔧 [${m.id}] Using origin globalOffset for independent positioning`);
                    }
                }
            } catch (e) {
                console.warn(`🔧 [${m.id}] Failed to get reference globalOffset:`, e);
                // Fallback to origin
                if (THREE) {
                    opts.globalOffset = new THREE.Vector3(0, 0, 0);
                }
            }                            // Apply user transform if provided
                            const userTransform = buildMatrixFromTransform(m.transform || undefined);
                            if (userTransform) {
                                opts.placementTransform = userTransform;
                                console.log(`🔧 [${m.id}] Applied user transform:`, m.transform);
                            }
                            
                            viewerInstance.loadDocumentNode(doc, geom, opts).then((model: any) => {
                                try { 
                                    overlayModelMapRef.current.set(m.id, model); 
                                    console.log(`🔧 [${m.id}] Overlay model loaded independently`);
                                } catch (e) {
                                    console.warn(`🔧 [${m.id}] Failed to store overlay model:`, e);
                                }
                                
                                // Set initial visibility based on current enabledModelIds
                                try {
                                    const shouldShow = (!enabledModelIds || enabledModelIds.size === 0)
                                        ? true
                                        : enabledModelIds.has(m.id);
                                    console.log(`🔧 [${m.id}] Setting initial visibility: ${shouldShow}`);
                                    setModelVisible(model, shouldShow);
                                    
                                    // Force viewer update to apply visibility changes
                                    if (viewerInstance?.impl?.invalidate) {
                                        viewerInstance.impl.invalidate(true);
                                    }
                                } catch (e) {
                                    console.warn(`🔧 [${m.id}] Failed to set initial visibility:`, e);
                                }
                                
                                resolve();
                            }).catch((err: any) => {
                                console.error(`🔧 [${m.id}] Failed to load overlay model:`, err);
                                resolve();
                            });
                        },
                        (err: any) => {
                            console.error(`🔧 [${m.id}] Failed to load document:`, err);
                            resolve();
                        }
                    );
                });
            }
            setOverlayModelsLoaded(true);
            console.log('🔧 [loadOverlayModels] Completed loading all independent overlay models');
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
                
                // Add error handler for missing texture resources
                try {
                    viewerInstance.addEventListener(Autodesk.Viewing.ERROR_EVENT, (event: any) => {
                        // Suppress texture loading errors (404s) that don't affect model functionality
                        if (event.errorCode === 'NETWORK_FAILURE' || 
                            (event.message && event.message.includes('Failed to fetch resource')) ||
                            (event.url && event.url.includes('.png'))) {
                            console.warn('[ForgeViewer] Texture resource not found (suppressed):', event.url || event.message);
                            return; // Don't show these errors to the user
                        }
                        console.error('[ForgeViewer] Viewer error:', event);
                    });
                } catch (e) {
                    console.warn('[ForgeViewer] Could not add error handler:', e);
                }
                
                // Visual tuning: improve contrast and line visibility on init
                try {
                    safeSetDisplayEdges(viewerInstance, true);
                    if (viewerInstance.setGhosting) viewerInstance.setGhosting(false);
                    if (viewerInstance.setBackgroundColor) {
                        // Dark background for better DWG contrast
                        viewerInstance.setBackgroundColor(18, 18, 18, 18, 18, 18);
                    }
                } catch {}
                setViewer(viewerInstance);
                viewerRef.current = viewerInstance;
                
                // Make viewer globally accessible for asset testing
                if (typeof window !== 'undefined') {
                    (window as any).viewer = viewerInstance;
                    console.log('🔧 [ForgeViewer] Viewer made globally accessible as window.viewer');
                    try {
                        (window as any).__ASSETDBG = {
                            props: (dbIds: number | number[], keys?: string[]) => new Promise((resolve, reject) => {
                                const arr = Array.isArray(dbIds) ? dbIds : [dbIds];
                                const filter = keys && keys.length ? keys : undefined;
                                viewerInstance.model.getBulkProperties(arr, filter, (res: any[]) => {
                                    try { console.log('[__ASSETDBG][props]', res); } catch {}
                                    resolve(res);
                                }, (e: any) => reject(e));
                            }),
                            selection: (keys?: string[]) => {
                                const sel = viewerInstance.getSelection ? viewerInstance.getSelection() : [];
                                return (window as any).__ASSETDBG.props(sel, keys);
                            },
                            findDbId: (dbId: number) => {
                                const models = typeof viewerInstance.getAllModels === 'function' 
                                    ? viewerInstance.getAllModels() 
                                    : [viewerInstance.model].filter(Boolean);
                                console.log(`🔍 Searching for dbId ${dbId} across ${models.length} models...`);
                                models.forEach((m: any, idx: number) => {
                                    const mid = (typeof m.getModelId === 'function' ? m.getModelId() : m?.id) || idx;
                                    const tree = m.getInstanceTree?.();
                                    if (!tree) {
                                        console.log(`  Model ${mid}: No instance tree`);
                                        return;
                                    }
                                    try {
                                        const name = tree.getNodeName?.(dbId);
                                        if (name) {
                                            console.log(`  ✅ Model ${mid}: Found dbId ${dbId} - "${name}"`);
                                        } else {
                                            console.log(`  ❌ Model ${mid}: dbId ${dbId} not found`);
                                        }
                                    } catch (e) {
                                        console.log(`  ❌ Model ${mid}: Error checking dbId ${dbId}`, e);
                                    }
                                });
                            }
                        };
                        console.log('🔧 [ForgeViewer] __ASSETDBG available: __ASSETDBG.props(dbId[, keys]), __ASSETDBG.selection([keys]), __ASSETDBG.findDbId(dbId)');
                    } catch {}
                }
                
                // Check if primary model should be loaded
                const primaryId = (models && models.length > 0) ? models[0].id : null;
                const shouldLoadPrimary = !enabledModelIds || enabledModelIds.size === 0 || 
                                        (primaryId && enabledModelIds.has(primaryId));
                
                console.log('🔧 [Primary Model] Should load primary?', shouldLoadPrimary, 'primaryId:', primaryId);
                
                if (shouldLoadPrimary) {
                    console.log('📄 Current Model URN:', primaryUrn);
                    const documentId = `urn:${primaryUrn}`;
                    Autodesk.Viewing.Document.load(
                        documentId,
                        (doc: any) => {
                            // Load master views to include room data
                            const viewables = doc.getRoot().getDefaultGeometry(true);
                            if (viewables) {
                                // Apply enhanced loading options for primary model too
                                const primaryOpts: any = {
                                    applyRefPoint: true,  // Critical for BIM discipline alignment
                                    isAEC: true,         // Enable AEC-specific alignment features
                                    applyScaling: 'm'    // Use meter scaling for consistency
                                };
                                
                                console.log('🔧 [Primary Model] Loading with enhanced alignment options:', primaryOpts);
                                
                                viewerInstance.loadDocumentNode(doc, viewables, primaryOpts).then(() => {
                                    setIsLoading(false);
                                    // Capture the primary project model id once at initialization
                                    try {
                                        if (!primaryModelIdRef.current) {
                                            const initPrimaryId = (models && models.length > 0) ? models[0].id : null;
                                            primaryModelIdRef.current = initPrimaryId || null;
                                        }
                                    } catch {}
                                    // Wait for GEOMETRY_LOADED_EVENT before initializing DataViz
                                    viewerInstance.addEventListener(
                                        Autodesk.Viewing.GEOMETRY_LOADED_EVENT,
                                        async () => {
                                            setModelLoaded(true);
                                        // Ensure visual settings after geometry load
                                        try {
                                            safeSetDisplayEdges(viewerInstance, true);
                                            if (viewerInstance.setGhosting) viewerInstance.setGhosting(false);
                                            if (viewerInstance.setBackgroundColor) {
                                                viewerInstance.setBackgroundColor(18, 18, 18, 18, 18, 18);
                                            }
                                            // Fit model(s) to view for immediate clarity
                                            if (typeof viewerInstance.fitToView === 'function') {
                                                setTimeout(() => {
                                                    try { viewerInstance.fitToView(); } catch {}
                                                }, 0);
                                            }
                                        } catch {}
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
                                                
                                                // Setup room detection after viewer is ready
                                                console.log("🏠 [ForgeViewer] Setting up room detection...");
                                                await setupRoomDetection(viewerInstance);
                                                console.log("✅ [ForgeViewer] Room detection setup completed");

                                                // Create Heatmap toolbar button
                                                try {
                                                    const Autodesk = (window as any).Autodesk;
                                                    const ui = Autodesk?.Viewing?.UI;
                                                    if (viewerInstance?.toolbar && ui) {
                                                        // Use a dedicated custom control group so existing toolbar layout is not affected
                                                        const ctrlId = 'bim-custom-tools';
                                                        let ctrl = viewerInstance.toolbar.getControl(ctrlId);
                                                        if (!ctrl) {
                                                            ctrl = new ui.ControlGroup(ctrlId);
                                                            viewerInstance.toolbar.addControl(ctrl);
                                                        }
                                                        const btnId = 'toggle-heatmap-btn';
                                                        let btn = ctrl.getControl(btnId);
                                                        if (!btn) {
                                                            btn = new ui.Button(btnId);
                                                            // Ensure DOM id is set for CSS targeting
                                                            try { btn.container.id = btnId; } catch {}
                                                            btn.setToolTip('Toggle Room Heatmap');
                                                            // Create CSS-masked icon so color can be controlled via `color`
                                                            const iconWrapper = btn.container.querySelector('.adsk-button-icon') as HTMLElement;
                                                            if (iconWrapper) {
                                                                iconWrapper.innerHTML = '';
                                                                const iconEl = document.createElement('span');
                                                                iconEl.className = 'heatmap-mask-icon';
                                                                iconWrapper.appendChild(iconEl);
                                                            }
                                                            // Add hover and active states with CSS
                                                            const addHeatmapButtonStyles = () => {
                                                                const style = document.createElement('style');
                                                                style.textContent = `
                                                                    #toggle-heatmap-btn {
                                                                        transition: color 0.2s ease, box-shadow 0.2s ease;
                                                                        color: #ffffff; /* icon white by default */
                                                                    }
                                                                    /* Hover: draw blue outline inside without changing size */
                                                                    #toggle-heatmap-btn:hover {
                                                                        box-shadow: inset 0 0 0 2px #35b1ff !important;
                                                                        color: #35b1ff; /* icon cyan on hover */
                                                                    }
                                                                    /* Active: only cyan icon, no outline/background changes */
                                                                    #toggle-heatmap-btn.active {
                                                                        box-shadow: none !important;
                                                                        color: #35b1ff; /* icon cyan when active */
                                                                    }
                                                                    #toggle-heatmap-btn.active:hover {
                                                                        box-shadow: none !important; /* keep no border on hover when active */
                                                                    }
                                                                    /* Mask-based icon uses the button color */
                                                                    #toggle-heatmap-btn .heatmap-mask-icon {
                                                                        display: inline-block;
                                                                        width: 24px; /* match default viewer icon size */
                                                                        height: 24px;
                                                                        background-color: currentColor; /* takes from parent color */
                                                                        -webkit-mask: url('/heatmap.png') center / contain no-repeat;
                                                                        mask: url('/heatmap.png') center / contain no-repeat;
                                                                    }
                                                                `;
                                                                document.head.appendChild(style);
                                                            };
                                                            addHeatmapButtonStyles();
                                                            
                                                            btn.onClick = async () => {
                                                                const isActive = btn.container.classList.contains('active');
                                                                const next = !isActive;
                                                                console.log(`[ForgeViewer] Heatmap button clicked. isActive=${isActive} -> next=${next}`);
                                                                
                                                                // Initialize channel on first toggle ON
                                                                if (next) {
                                                                    // Prefer current filtered type, else first available type with room-linked sensors
                                                                    const availableTypes = Array.from(new Set((sensors || []).filter((s: any) => s?.roomId != null).map((s: any) => s.type))).filter(Boolean) as string[];
                                                                    const initial = filteredSensorType || availableTypes[0] || null;
                                                                    setHeatmapChannel(initial);
                                                                    console.log(`[ForgeViewer] Heatmap channel set to: ${initial}`);
                                                                }
                                                                setHeatmapOn(next);
                                                                
                                                                // Update button appearance
                                                                if (next) {
                                                                    btn.container.classList.add('active');
                                                                    console.log(`[ForgeViewer] Heatmap activated`);
                                                                } else {
                                                                    btn.container.classList.remove('active');
                                                                    console.log(`[ForgeViewer] Heatmap deactivated`);
                                                                }
                                                            };
                                                            ctrl.addControl(btn);
                                                            heatmapBtnRef.current = btn;
                                                        }
                                                    }
                                                } catch (e) {
                                                    console.warn('[ForgeViewer] Failed to create Heatmap toolbar button', e);
                                                }
                                            } catch (e) {
                                                console.warn("[ForgeViewer] onViewerReady threw on geometry load:", e);
                                            }
                                        }
                                        const needDataVizNow = (activePanel === 'iot') || (activePanel === 'bim' && sensorsVisible);
                                        // Skip DataViz initialization if not currently needed
                                        if (!needDataVizNow) {
                                            setIsInitialized(true); // model ready for other panels
                                            // Clear in-flight flag only after geometry is loaded
                                            initInFlightRef.current = false;
                                            return;
                                        }

                                        // Helper to wait for toolController to be ready, preventing race conditions on init
                                        const waitForToolController = (viewer: any, timeout = 5000): Promise<void> => {
                                            return new Promise((resolve, reject) => {
                                                const startTime = Date.now();
                                                const checkInterval = setInterval(() => {
                                                    if (viewer && viewer.toolController) {
                                                        clearInterval(checkInterval);
                                                        console.log('[ForgeViewer] toolController is ready.');
                                                        resolve();
                                                    } else if (Date.now() - startTime > timeout) {
                                                        clearInterval(checkInterval);
                                                        reject(new Error("Timed out waiting for toolController."));
                                                    }
                                                }, 100); // Poll every 100ms
                                            });
                                        };

                                        // Retry mechanism for DataViz initialization
                                        const initializeDataVizWithRetry = async (maxRetries = 3, delay = 500) => {
                                            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                                                // If already initialized or in-flight, stop
                                                if (isDataVizReady || dataVizService || dataVizInitInFlightRef.current) {
                                                    return true;
                                                }
                                                dataVizInitInFlightRef.current = true;

                                                // Validate viewer before attempting initialization
                                                if (!viewerInstance || !viewerInstance.loadExtension) {
                                                    if (attempt === maxRetries) {
                                                        dataVizInitInFlightRef.current = false;
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
                                                    try {
                                                        // Ensure room mapping is re-initialized now that DataViz is ready
                                                        await setupRoomDetection(viewerInstance);
                                                        console.log('✅ [ForgeViewer] Room mapping ensured after DataViz ready');
                                                    } catch {}
                                                    
                                                    // Heatmap feature removed
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
                                                        } catch (e) {
                                                            console.warn("[ForgeViewer] onViewerReady threw after DataViz ready:", e);
                                                        }
                                                    }
                                                    dataVizInitInFlightRef.current = false;
                                                    return true;
                                                } else {
                                                    if (attempt === maxRetries) {
                                                        dataVizInitInFlightRef.current = false;
                                                        return false;
                                                    }
                                                }
                                            }
                                            dataVizInitInFlightRef.current = false;
                                            return false;
                                        };
                                        try {
                                            // First, wait for the tool controller to be safely available
                                            await waitForToolController(viewerInstance);
                                            // Then, proceed with DataViz initialization
                                            await initializeDataVizWithRetry();
                                        } catch (err) {
                                            console.error('[ForgeViewer] Failed to initialize DataViz service due to toolController timeout:', err);
                                            setError('Failed to initialize IoT features.');
                                        }
                                        // Clear in-flight flag after we finish geometry + optional DataViz
                                        initInFlightRef.current = false;
                                    },
                                    { once: true }
                                );
                                // Do not clear in-flight here; wait for geometry event above
                            });
                        }
                    },
                    (error: any) => {
                        setError("Failed to load document: " + error.message);
                        initInFlightRef.current = false;
                    }
                );
                } else {
                    // Primary model not enabled - just set up viewer and load overlay models
                    console.log('🔧 [Primary Model] Skipping primary model load - not in enabled models');
                    setIsLoading(false);
                    setModelLoaded(true);
                    
                    // Capture the primary project model id reference anyway
                    try {
                        if (!primaryModelIdRef.current) {
                            const initPrimaryId = (models && models.length > 0) ? models[0].id : null;
                            primaryModelIdRef.current = initPrimaryId || null;
                        }
                    } catch {}
                    
                    // Load overlay models independently (use setTimeout to avoid async issues)
                    if (!overlayModelsLoaded) {
                        setTimeout(async () => {
                            try { 
                                await loadOverlayModels(); 
                            } catch (err) {
                                console.error('Failed to load overlay models:', err);
                            }
                        }, 0);
                    }
                    
                    // Fire onViewerReady for panels
                    if (!hasFiredViewerReadyRef.current && typeof onViewerReady === 'function') {
                        try {
                            onViewerReady(viewerInstance, null);
                            hasFiredViewerReadyRef.current = true;
                        } catch (e) {
                            console.warn("[ForgeViewer] onViewerReady threw on overlay-only load:", e);
                        }
                    }
                    
                    setIsInitialized(true);
                    initInFlightRef.current = false;
                }
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
            
            // Add global error handler to suppress texture loading errors
            const originalConsoleError = console.error;
            const errorHandler = (...args: any[]) => {
                const message = args.join(' ');
                // Suppress texture-related 404 errors
                if (message.includes('Failed to fetch resource') && 
                    message.includes('cdn.derivative.autodesk.com') &&
                    (message.includes('.png') || message.includes('.jpg') || message.includes('.jpeg'))) {
                    return; // Don't log these texture errors
                }
                originalConsoleError(...args);
            };
            console.error = errorHandler;
            
            // Cleanup error handler on unmount
            return () => {
                console.error = originalConsoleError;
            };
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
                    
                    // Heatmap feature removed - no extension to cleanup
                    viewerRef.current.finish();
                } catch (e) {
                    console.warn('[ForgeViewer] Error finishing viewer:', e);
                } finally {
                    viewerRef.current = null;
                }
            }
        };
    }, [accessToken]);

    // Reload primary model inside existing viewer when URN/models change (without creating a new viewer)
    useEffect(() => {
        const v = viewerRef.current;
        const Autodesk = (window as any).Autodesk;
        if (!v || !Autodesk || !Autodesk.Viewing) return;
        const primaryUrn = models && models.length > 0 ? models[0].urn : urn;
        if (!primaryUrn) return;
        if (loadedUrn === primaryUrn) return; // already loaded

        // Update flag to prevent concurrent reloads
        initInFlightRef.current = true;
        setLoadedUrn(primaryUrn);

        const docId = `urn:${primaryUrn}`;
        Autodesk.Viewing.Document.load(
            docId,
            (doc: any) => {
                // Load master views to include room data
                const geom = doc.getRoot().getDefaultGeometry(true);
                if (!geom) { initInFlightRef.current = false; return; }
                const opts: any = {
                    keepCurrentModels: false,
                    applyRefPoint: true,
                    isAEC: true,
                    applyScaling: 'm'
                };
                v.loadDocumentNode(doc, geom, opts).then(() => {
                    // Update primary model reference id so overlays exclude the correct primary after reload
                    try {
                        const newPrimaryId = (models && models.length > 0) ? models[0].id : null;
                        primaryModelIdRef.current = newPrimaryId || null;
                    } catch {}
                    // Unload any previous overlays and clear map; they will reconcile via other effect
                    try {
                        for (const mdl of overlayModelMapRef.current.values()) { try { v.unloadModel(mdl); } catch {} }
                        overlayModelMapRef.current.clear();
                        setOverlayModelsLoaded(false);
                    } catch {}
                    // Ensure view is fitted after load
                    try { setTimeout(() => { try { v.fitToView(); } catch {} }, 0); } catch {}
                }).finally(() => {
                    initInFlightRef.current = false;
                });
            },
            (_err: any) => {
                initInFlightRef.current = false;
            }
        );
    }, [urn, JSON.stringify(models?.map(m => ({ id: m.id, urn: m.urn }))) ]);

    // Late / on-demand DataViz initialization (e.g., BIM panel toggles sensorsVisible later)
    useEffect(() => {
        if (!viewer) return;
        if (isDataVizReady || dataVizService || dataVizInitInFlightRef.current) return; // already initializing/ready
        if (!modelLoaded) return; // wait for geometry
        const needDataVizNow = (activePanel === 'iot') || (activePanel === 'bim' && sensorsVisible);
        if (!needDataVizNow) return;
        let cancelled = false;
        (async () => {
            try {
                dataVizInitInFlightRef.current = true;
                const svc = new DataVizService(viewer);
                const ok = await svc.initialize();
                if (!ok || cancelled) return;
                setDataVizService(svc);
                setIsDataVizReady(true);
                try {
                    await setupRoomDetection(viewer);
                    console.log('✅ [ForgeViewer] Room mapping ensured after late DataViz init');
                } catch {}
                
                // Heatmap feature removed
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
                    } catch (e) {
                        console.warn('[ForgeViewer] onViewerReady threw after late DataViz init:', e);
                    }
                }
            } catch (e) {
                console.warn('[ForgeViewer] Late DataViz initialization failed:', e);
            } finally {
                dataVizInitInFlightRef.current = false;
                if (!cancelled) setIsInitialized(true); // ensure initialized flag
            }
        })();
        return () => { cancelled = true; };
    }, [viewer, modelLoaded, activePanel, sensorsVisible, isDataVizReady, dataVizService, onSensorClick, onViewerReady]);

    // Initialize HeatmapService after geometry is ready
    useEffect(() => {
        if (!viewerRef.current || !modelLoaded) return;
        if (!heatmapRef.current) {
            heatmapRef.current = new HeatmapService(viewerRef.current);
        }
    }, [modelLoaded]);

    // Handle click events for sensor placement - ALWAYS open form for any valid click
    const handleClick = useCallback(async (event: MouseEvent) => {
        if (!insertMode || !viewer) {
            return;
        }

        // Prevent default behavior and stop propagation to avoid DataViz interference
        event.preventDefault();
        event.stopPropagation();

        console.log('🎯 [Insert] Click intercepted in capture phase');
        
        const rect = viewerContainer.current?.getBoundingClientRect();
        if (!rect) return;

        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        const result = viewer.impl.hitTest(x, y, false);
        if (!result || !result.intersectPoint) {
            console.log('🎯 [Insert] No hit result - ignoring click');
            return;
        }

        const position = result.intersectPoint;
        const clickedDbId = (result as any).dbId;

        console.log(`🎯 [Insert] Valid click detected - position: (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)}), dbId: ${clickedDbId}`);
        // Immediate feedback: print dbId first
        console.log(`🖱️ [Click] dbId=${clickedDbId} (resolving room...)`);

        try {
            console.log('🔍 [Insert] Starting diagnostic logging...');
            // Insert-mode diagnostic logging (enhanced for any object) - NON-BLOCKING
            const diagnosticPromise = (async () => {
                try {
                    const mdl = (result as any).model || viewer.model;
                    if (mdl && clickedDbId != null) {
                        // Add timeout to prevent hanging
                        const props: any = await Promise.race([
                            new Promise((resolve) => mdl.getProperties(clickedDbId, resolve)),
                            new Promise((_, reject) => setTimeout(() => reject(new Error('Properties timeout')), 2000))
                        ]);
                        const propsArr = props?.properties || [];
                        const findVal = (name: string, category?: string) => {
                            const p = propsArr.find((pp: any) => pp.displayName === name && (!category || pp.displayCategory === category))
                                     || propsArr.find((pp: any) => pp.displayName === name);
                            return p?.displayValue;
                        };
                        const name = findVal('Name') || '(Unnamed)';
                        const category = findVal('Category') || '(Unknown)';
                        const area = findVal('Area');
                        const volume = findVal('Volume');
                        const level = findVal('Level', 'Constraints') || findVal('Level');
                        let roomInfo: any = null;
                        if (typeof getRoomForDbId === 'function') {
                            roomInfo = await getRoomForDbId(clickedDbId);
                        }
                        const isRoomSelf = String(category).toLowerCase().includes('room');
                        // Enhanced sensor placement logging with spatial context
                        if (isRoomSelf) {
                            console.log(`🎯 [Sensor Placement] dbId=${clickedDbId} → 🏠 PLACING IN ROOM: '${name}' (Level: ${level || 'Unknown'})`);
                        } else if (roomInfo?.roomName && roomInfo?.roomId != null) {
                            console.log(`🎯 [Sensor Placement] dbId=${clickedDbId} → 🏠 OBJECT IN ROOM: '${roomInfo.roomName}' (roomId=${roomInfo.roomId}) | Object: ${name} [${category}]`);
                        } else {
                            console.log(`🎯 [Sensor Placement] dbId=${clickedDbId} → 🚫 NO ROOM CONTEXT | Object: ${name} [${category || 'Unknown'}]`);
                        }
                        console.log(`📦 All Properties (${propsArr.length}):`, propsArr);
                        console.groupEnd();
                    }
                } catch (e) {
                    console.warn('[ForgeViewer] Insert-mode diagnostic logging failed (timeout or error)', e);
                }
            })();
            
            // Don't wait for diagnostic logging - continue immediately
            
            console.log('🔍 [Insert] Diagnostic logging completed, now calling showSensorForm...');
            console.log('🔍 [Insert] showSensorForm function:', typeof showSensorForm);
            console.log('🔍 [Insert] Position:', { x: position.x, y: position.y, z: position.z });
            console.log('🔍 [Insert] ClickedDbId:', clickedDbId);
            
            // ALWAYS show sensor insertion form for any valid click in insert mode
            console.log('📝 [Insert] Opening sensor form for placement');
            showSensorForm({ x: position.x, y: position.y, z: position.z }, clickedDbId);
            console.log('✅ [Insert] showSensorForm called successfully');
        } catch (error) {
            console.error("[ForgeViewer] Failed to handle sensor placement click:", error);
        }
    }, [insertMode, viewer, showSensorForm, getRoomForDbId]);

    // Setup click handler for sensor placement - use capture phase to intercept before DataViz
    useEffect(() => {
        if (!viewer || !insertMode) {
            // Remove click handler when not in insert mode
            const container = viewerContainer.current;
            if (container) {
                container.removeEventListener("click", handleClick, true); // Remove with capture
                container.style.cursor = "default";
            }
            return;
        }

        const container = viewerContainer.current;
        if (container) {
            // Use capture phase (true) to intercept clicks before DataViz extension
            container.addEventListener("click", handleClick, true);
            container.style.cursor = "crosshair";
            console.log('🎯 [Insert Mode] Click handler attached with capture=true');
        }

        return () => {
            if (container) {
                container.removeEventListener("click", handleClick, true); // Remove with capture
                container.style.cursor = "default";
            }
        };
    }, [viewer, insertMode, handleClick]);

    // Additional: detect clicks near sensor sprites to trigger selection (non-invasive)
    useEffect(() => {
        if (!viewer || insertMode || activePanel !== 'iot') return;

        const container = viewerContainer.current;
        if (!container) return;

        // Helper: log detailed diagnostics for clicked object
        const logSelectionDiagnostics = async (dbId: number, point?: { x: number; y: number; z: number }, modelArg?: any) => {
            try {
                const mdl = modelArg || viewer.model;
                if (!mdl) return;
                const props: any = await new Promise((resolve) => mdl.getProperties(dbId, resolve));
                const propsArr = props?.properties || [];
                const findVal = (name: string, category?: string) => {
                    const p = propsArr.find((pp: any) => pp.displayName === name && (!category || pp.displayCategory === category))
                             || propsArr.find((pp: any) => pp.displayName === name);
                    return p?.displayValue;
                };
                const name = findVal('Name') || '(Unnamed)';
                const category = findVal('Category') || '(Unknown)';
                const area = findVal('Area');
                const volume = findVal('Volume');
                const level = findVal('Level', 'Constraints') || findVal('Level');
                let roomInfo: any = null;
                if (typeof getRoomForDbId === 'function') {
                    roomInfo = await getRoomForDbId(dbId);
                }
                const isRoomSelf = String(category).toLowerCase().includes('room');
                // Enhanced one-line summary for quick verification per click
                if (isRoomSelf) {
                    console.log(`🖱️ [Click] dbId=${dbId} → 🏠 ROOM ITSELF: '${name}' (Level: ${level || 'Unknown'})`);
                } else if (roomInfo?.roomName && roomInfo?.roomId != null) {
                    console.log(`🖱️ [Click] dbId=${dbId} → 🏠 INSIDE ROOM: '${roomInfo.roomName}' (roomId=${roomInfo.roomId}, Level: ${roomInfo.levelName || 'Unknown'})`);
                } else {
                    console.log(`🖱️ [Click] dbId=${dbId} → 🚫 NO ROOM DETECTED (${category || 'Unknown Category'})`);
                }
                
                // COMPREHENSIVE PROPERTY DUMP - Show ALL available information
                console.group(`📋 [FULL PROPERTIES] dbId=${dbId} - ${name} [${category}]`);
                console.log('🏷️ Basic Info:', { 
                    dbId, 
                    name, 
                    category, 
                    level, 
                    area: area ? `${area} sq units` : 'N/A',
                    volume: volume ? `${volume} cu units` : 'N/A'
                });
                
                // Group properties by category for better readability
                const propsByCategory: { [key: string]: any[] } = {};
                propsArr.forEach((prop: any) => {
                    const cat = prop.displayCategory || 'Other';
                    if (!propsByCategory[cat]) propsByCategory[cat] = [];
                    propsByCategory[cat].push({
                        name: prop.displayName,
                        value: prop.displayValue,
                        units: prop.units || '',
                        type: prop.type || 'string'
                    });
                });
                
                // Log each category
                Object.keys(propsByCategory).sort().forEach(catName => {
                    console.groupCollapsed(`📁 ${catName} (${propsByCategory[catName].length} properties)`);
                    propsByCategory[catName].forEach(prop => {
                        const valueStr = prop.units ? `${prop.value} ${prop.units}` : prop.value;
                        console.log(`   ${prop.name}: ${valueStr}`);
                    });
                    console.groupEnd();
                });
                
                // Enhanced room relationship info with spatial analysis
                if (isRoomSelf) {
                    console.log('🏠 ROOM OBJECT (SELF):', { 
                        roomName: name, 
                        roomId: dbId, 
                        level: level || 'Unknown Level',
                        area: area ? `${area} sq units` : 'N/A',
                        volume: volume ? `${volume} cu units` : 'N/A',
                        spatialType: 'Room Element'
                    });
                } else if (roomInfo) {
                    console.log('🏠 SPATIAL CONTAINMENT DETECTED:', {
                        objectDbId: dbId,
                        objectName: name,
                        objectCategory: category,
                        enclosingRoom: {
                            roomId: roomInfo.roomId,
                            roomName: roomInfo.roomName,
                            levelName: roomInfo.levelName || 'Unknown Level'
                        },
                        detectionMethod: 'Bounding Box Containment',
                        spatialRelationship: 'Object Inside Room'
                    });
                } else {
                    console.log('🚫 NO ROOM RELATIONSHIP:', {
                        objectDbId: dbId,
                        objectName: name,
                        objectCategory: category,
                        spatialStatus: 'Not contained in any room',
                        possibleReasons: [
                            'Object is outside room boundaries',
                            'Room detection not available',
                            'Object is a structural element',
                            'Spatial calculation failed'
                        ]
                    });
                }
                
                console.groupEnd();
                console.groupCollapsed(`🧭 Selection Diagnostic • dbId=${dbId}`);
                if (point) console.log('📍 Intersect Point:', { x: +point.x.toFixed(4), y: +point.y.toFixed(4), z: +point.z.toFixed(4) });
                console.log('🧩 Object:', { name, category, level, area, volume });
                if (isRoomSelf) {
                    console.log('🏠 Room (self):', { roomName: name, roomId: dbId, level });
                } else if (roomInfo) {
                    console.log('🏠 Enclosing Room:', roomInfo);
                } else {
                    console.log('🏠 Enclosing Room: not found');
                }
                console.log(`📦 All Properties (${propsArr.length}):`, propsArr);
                console.groupEnd();
            } catch (e) {
                console.warn('[ForgeViewer] logSelectionDiagnostics failed', e);
            }
        };

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
            // Also run a standard hitTest to diagnose clicked BIM object
            try {
                const result = viewer.impl.hitTest(clickX, clickY, false);
                if (result && (result as any).dbId) {
                    const dbId = (result as any).dbId;
                    const pt = (result as any).intersectPoint;
                    // Immediate feedback: print dbId first
                    console.log(`🖱️ [Click] dbId=${dbId} (resolving room...)`);
                    // Fast room lookup with timeout (no properties needed)
                    (async () => {
                        try {
                            const roomInfo: any = await Promise.race([
                                (typeof getRoomForDbId === 'function' ? getRoomForDbId(dbId) : Promise.resolve(null)),
                                new Promise((_, reject) => setTimeout(() => reject(new Error('room-timeout')), 1500))
                            ]);
                            if (roomInfo?.roomName && roomInfo?.roomId != null) {
                                console.log(`🖱️ [Click] dbId=${dbId} → roomName='${roomInfo.roomName}', roomId=${roomInfo.roomId}`);
                            } else {
                                console.log(`🖱️ [Click] dbId=${dbId} → room: none`);
                            }
                        } catch {
                            // On timeout/error, still provide a none-line so user sees result
                            console.log(`🖱️ [Click] dbId=${dbId} → room: none`);
                        }
                    })();
                    // Continue with full diagnostics (may be slower due to properties)
                    logSelectionDiagnostics(dbId, pt, (result as any).model);
                }
            } catch {}
        };

        // Use capture phase to get the event before DataViz consumes it
        container.addEventListener('click', handleSensorPick, true);
        return () => {
            container.removeEventListener('click', handleSensorPick, true);
        };
    }, [viewer, insertMode, activePanel, getFilteredSensors, onSensorClick, onEmptyClick, getRoomForDbId]);

    // Global selection listener: log enclosing room for any selected object
    useEffect(() => {
        const v = viewerRef.current;
        const Autodesk = (window as any).Autodesk;
        if (!v || !Autodesk || !Autodesk.Viewing) return;

        const onAggSel = async (ev: any) => {
            try {
                const sels = ev?.selections || [];
                if (!sels.length) {
                    console.log('[Select] Selection cleared');
                    return;
                }
                for (const s of sels) {
                    const mdl = s.model || v.model;
                    const dbIds: number[] = s.dbIdArray || [];
                    // Immediate one-liners per dbId, independent of properties speed
                    for (const dbId of dbIds) {
                        console.log(`🖱️ [Click] dbId=${dbId} (resolving room...)`);
                        (async () => {
                            try {
                                const roomInfo: any = await Promise.race([
                                    (typeof getRoomForDbId === 'function' ? getRoomForDbId(dbId) : Promise.resolve(null)),
                                    new Promise((_, reject) => setTimeout(() => reject(new Error('room-timeout')), 1500))
                                ]);
                                if (roomInfo?.roomName && roomInfo?.roomId != null) {
                                    console.log(`🖱️ [Click] dbId=${dbId} → roomName='${roomInfo.roomName}', roomId=${roomInfo.roomId}`);
                                } else {
                                    console.log(`🖱️ [Click] dbId=${dbId} → room: none`);
                                }
                            } catch {
                                console.log(`🖱️ [Click] dbId=${dbId} → room: none`);
                            }
                        })();
                    }
                    for (const dbId of dbIds) {
                        let name: string | undefined = undefined;
                        let category: string | undefined = undefined;
                        try {
                            const props: any = await new Promise((resolve) => mdl.getProperties(dbId, resolve));
                            const arr = props?.properties || [];
                            name = arr.find((p: any) => p.displayName === 'Name')?.displayValue;
                            category = arr.find((p: any) => p.displayName === 'Category')?.displayValue;
                        } catch {}
                        let roomInfo: any = null;
                        try {
                            if (typeof getRoomForDbId === 'function') {
                                roomInfo = await getRoomForDbId(dbId);
                            }
                        } catch {}
                        if (roomInfo) {
                            console.log(`🏠 [Select] Object dbId=${dbId}${name?` (${name})`:''}${category?` [${category}]`:''} → Room: ${roomInfo.roomName} (dbId: ${roomInfo.roomId})`);
                        } else {
                            console.log(`ℹ️ [Select] Object dbId=${dbId}${name?` (${name})`:''}${category?` [${category}]`:''} → No enclosing room`);
                        }
                    }
                }
            } catch (e) {
                console.warn('[ForgeViewer] Selection logging failed', e);
            }
        };

        v.addEventListener(Autodesk.Viewing.AGGREGATE_SELECTION_CHANGED_EVENT, onAggSel);
        return () => v.removeEventListener(Autodesk.Viewing.AGGREGATE_SELECTION_CHANGED_EVENT, onAggSel);
    }, [viewer, getRoomForDbId]);

    // Update sensors when they change or when activePanel changes - with debouncing to prevent excessive calls
    useEffect(() => {
        if (!dataVizService || !isDataVizReady || !viewer) {
            return;
        }
        
        // Determine whether sensors should be shown based on panel and visibility flag
        const shouldShowSensors = (activePanel === 'iot') || (activePanel === 'bim' && sensorsVisible);
        if (!shouldShowSensors || !isInitialized) {
            return;
        }
        
        // Use longer delay to ensure DataViz service is fully ready for display
        const delay = 1000; // Increased delay to ensure model is fully loaded
        
        // Debounce sensor updates to prevent excessive re-initialization
        const timeoutId = setTimeout(() => {
            updateSensors();
        }, delay);
        
        return () => {
            clearTimeout(timeoutId);
        };
    }, [sensors.length, dataVizService, isDataVizReady, activePanel, isInitialized, filteredSensorType, sensorsVisible]); // Include filteredSensorType and sensorsVisible to trigger updates

    // Handle wireframe mode changes
    useEffect(() => {
        if (!viewer || !isInitialized) {
            return;
        }

        // Skip wireframe mode changes if not in IoT panel or BIM panel
        if (activePanel !== 'iot' && activePanel !== 'bim') {
            return;
        }


        try {
            (async () => {
                const modelsToProcess: any[] = [];
                const primary = viewer?.model;
                if (primary) modelsToProcess.push(primary);
                for (const mdl of overlayModelMapRef.current.values()) {
                    if (mdl) modelsToProcess.push(mdl);
                }

                // Respect enabledModelIds: only process models that are currently enabled if the set is provided
                const isEnabled = (modelId: string | null): boolean => {
                    if (!enabledModelIds || enabledModelIds.size === 0) return true;
                    if (!modelId) return false;
                    return enabledModelIds.has(modelId);
                };

                // Map models to their project ids so we can filter using enabledModelIds
                const modelIdMap = new Map<any, string | null>();
                // Primary id
                modelIdMap.set(primary, primaryModelIdRef.current);
                // Overlay ids
                for (const [id, mdl] of overlayModelMapRef.current.entries()) {
                    modelIdMap.set(mdl, id);
                }

                // Helper to collect leaf dbIds for a model
                const collectLeafDbIds = (mdl: any): Promise<number[]> => {
                    return new Promise((resolve) => {
                        const ids: number[] = [];
                        if (!mdl?.getObjectTree) return resolve(ids);
                        try {
                            mdl.getObjectTree((tree: any) => {
                                if (!tree) return resolve(ids);
                                const all: number[] = [];
                                const root = tree.getRootId?.() ?? 1;
                                const walk = (nodeId: number) => {
                                    all.push(nodeId);
                                    tree.enumNodeChildren(nodeId, (childId: number) => walk(childId));
                                };
                                walk(root);
                                const leaves = all.filter((nodeId) => {
                                    let hasChildren = false;
                                    tree.enumNodeChildren(nodeId, () => { hasChildren = true; });
                                    return !hasChildren && nodeId !== root;
                                });
                                resolve(leaves);
                            });
                        } catch {
                            resolve(ids);
                        }
                    });
                };

                if (wireframeMode) {
                    // Wireframe: keep model visibility as-is; hide leaf nodes per model to show only edges
                    safeSetDisplayEdges(viewer, true);
                    if (viewer?.setDisplayMode) viewer.setDisplayMode(1);
                    if (viewer?.setGhosting) viewer.setGhosting(true);

                    for (const mdl of modelsToProcess) {
                        const mid = modelIdMap.get(mdl) ?? null;
                        if (!isEnabled(mid)) continue; // skip disabled models
                        const leaves = await collectLeafDbIds(mdl);
                        if (leaves.length > 0 && viewer?.hide) {
                            try { viewer.hide(leaves, mdl); } catch {}
                        }
                    }
                } else {
                    // Solid: unhide the leaf nodes per model and use solid rendering
                    safeSetDisplayEdges(viewer, true);
                    if (viewer?.setDisplayMode) viewer.setDisplayMode(0);
                    if (viewer?.setGhosting) viewer.setGhosting(false);

                    for (const mdl of modelsToProcess) {
                        const mid = modelIdMap.get(mdl) ?? null;
                        if (!isEnabled(mid)) continue; // skip disabled models
                        const leaves = await collectLeafDbIds(mdl);
                        if (leaves.length > 0 && viewer?.show) {
                            try { viewer.show(leaves, mdl); } catch {}
                        }
                    }
                }
            })();
        } catch (error) {
            console.error('[ForgeViewer] Error setting wireframe mode:', error);
        }
    }, [wireframeMode, viewer, isInitialized, activePanel]);

    // Note: Sensor visibility toggle in BIM panel now only controls sensor sprites, not wireframe mode
    // Wireframe/solid mode is controlled by the dedicated wireframe toggle buttons    // Simple panel-based rendering control - don't interfere with BIM 2D functionality
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

    // BIM panel: always use solid mode, no wireframe
    useEffect(() => {
        if (!viewer || !isInitialized) return;
        if (activePanel !== 'bim') return;

        console.log('🏗️ [BIM Panel] Setting up solid mode only');

        try {
            // BIM panel always uses solid mode
            console.log('🏗️ [BIM Panel] Applying solid mode');
            
            // Apply current model visibility settings first
            applyModelVisibility(viewer);
            
            // Ensure solid rendering mode
            if (viewer?.setDisplayMode) {
                viewer.setDisplayMode(0); // Solid mode
            }
            
            // Disable ghosting
            if (viewer?.setGhosting) {
                viewer.setGhosting(false);
            }
            
            // Keep edges visible for better visibility
            safeSetDisplayEdges(viewer, true);
            
            console.log('🏗️ [BIM Panel] Solid mode applied successfully');
        } catch (error) {
            console.error('🏗️ [BIM Panel] Error setting solid mode:', error);
        }
    }, [activePanel, viewer, isInitialized, enabledModelIds]);

    // Handle model visibility based on enabledModelIds - complete disable/enable system
    // Handle model visibility based on enabledModelIds - complete disable/enable system
    useEffect(() => {
        console.groupCollapsed(`👁️ Visibility useEffect triggered at ${new Date().toLocaleTimeString()}`);
        console.log('Viewer ready:', !!viewer, 'Initialized:', isInitialized);
        console.log('enabledModelIds:', enabledModelIds ? Array.from(enabledModelIds) : 'undefined');
        console.log('Dependencies:', { enabledModelIds, viewer, isInitialized, overlayModelsLoaded });
        console.groupEnd();

        if (!viewer || !isInitialized) {
            return;
        }

        // Apply complete model visibility control
        applyModelVisibility(viewer);
        
    }, [enabledModelIds, viewer, isInitialized, overlayModelsLoaded]);

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
            return;
        }
        
        // Get filtered sensors based on current filter selection
        const filteredSensors = getFilteredSensors();
        
        try {
            // Clear existing sensors first
            await dataVizService.clearAllSensors();
            
            // Skip if no sensors to add
            if (filteredSensors.length === 0) {
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
                try {
                    await dataVizService.clearAllSensors();
                    await dataVizService.updateDisplay();
                } catch (e) {
                    console.warn('[ForgeViewer] Failed to clear sensors on panel switch', e);
                }
            })();
        }
    }, [activePanel, sensorsVisible, dataVizService, isDataVizReady, viewer, isInitialized]);

    // Auto-close behavior: only for the small 'info' overlay.
    // Do NOT auto-close the full-screen dashboards ('graphs' and 'statistics');
    // they must be closed explicitly via their Close button.
    useEffect(() => {
        if (!viewerOverlay || viewerOverlay.type !== 'info') return;
        
        const handleGlobalPointerDown = (event: PointerEvent) => {
            const container = viewerContainer.current;
            const overlayEl = overlayRef.current;
            if (!container) return;
            const target = event.target as Node | null;
            // If clicking inside viewer container OR inside the floating info overlay, do not hide
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
            {viewerOverlay && (viewerOverlay.type === 'info' || viewerOverlay.type === 'graphs') && (
                <div
                    ref={overlayRef}
                    style={{
                        position: "absolute",
                        ...(overlayPos
                            ? { left: overlayPos.x, top: overlayPos.y }
                            : { bottom: 120, right: 40 }),
                        minWidth: 480,
                        maxWidth: 560,
                        background: "#111827",
                        border: "1px solid #374151",
                        borderRadius: 12,
                        boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
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
                            {viewerOverlay.type === 'graphs' ? 'Sensor Graphs' : 'Sensor Information'}
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
                    {viewerOverlay.type === 'graphs' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div style={{ padding: '8px', background: '#0b1220', border: '1px solid #374151', borderRadius: 8 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <div style={{ width: 28, height: 28, borderRadius: 6, background: '#1f2937', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#93c5fd', fontWeight: 700 }}>🧪</div>
                                    <div>
                                        <div style={{ color: '#e5e7eb', fontWeight: 700, fontSize: 13 }}>Graphs</div>
                                        <div style={{ color: '#9ca3af', fontSize: 12 }}>This feature is coming soon.</div>
                                    </div>
                                </div>
                            </div>
                            <div style={{ padding: '8px', background: '#0b1220', border: '1px solid #374151', borderRadius: 8 }}>
                                <div style={{ color: '#9ca3af', fontSize: 12 }}>
                                    You can view sensor details via <strong style={{ color: '#e5e7eb' }}>Info</strong> and use <strong style={{ color: '#e5e7eb' }}>Statistics</strong> for Energy, FV (Photovoltaic), and Seismic sensors.
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
            
            {/* Full-width overlays */}
            {viewerOverlay && viewerOverlay.type === 'statistics' && viewerOverlay.sensor?.type === 'Energy consumption' && (
                <EnergyDashboardOverlay
                    sensor={viewerOverlay.sensor}
                    onClose={hideViewerOverlay}
                    projectLocation={projectLocation}
                />
            )}
            {viewerOverlay && viewerOverlay.type === 'statistics' && viewerOverlay.sensor && viewerOverlay.sensor.type === 'FV' && (
                <PVSensorDashboard
                    sensor={viewerOverlay.sensor as any}
                    allSensors={sensors as any}
                    onClose={hideViewerOverlay}
                    projectId={currentProjectId}
                />
            )}
            {viewerOverlay && viewerOverlay.type === 'statistics' && viewerOverlay.sensor && viewerOverlay.sensor.type === 'Seismic and accelerometric' && (
                <SeismicSensorDashboard
                    sensor={viewerOverlay.sensor as any}
                    allSensors={sensors as any}
                    onClose={hideViewerOverlay}
                    projectId={currentProjectId}
                />
            )}
            {viewerOverlay && viewerOverlay.type === 'statistics' && viewerOverlay.sensor && 
             viewerOverlay.sensor.type !== 'Energy consumption' && 
             viewerOverlay.sensor.type !== 'FV' && 
             viewerOverlay.sensor.type !== 'Seismic and accelerometric' && (
                <SensorGraphsDashboard
                    sensor={viewerOverlay.sensor as any}
                    allSensors={sensors as any}
                    onClose={hideViewerOverlay}
                    projectId={currentProjectId}
                />
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

            {/* Heatmaps Panel (IoT only) */}
            {activePanel === 'iot' && heatmapOn && (
                <div style={{
                    position: 'absolute',
                    top: 16,
                    right: 16,
                    background: 'rgba(15, 23, 42, 0.96)',
                    border: '1px solid #1f2937',
                    borderRadius: 12,
                    padding: 14,
                    width: 320,
                    color: '#e5e7eb',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.45)',
                    zIndex: 9
                }}>
                    <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 10, color: '#f3f4f6' }}>Heatmaps</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                        <div style={{ color: '#cbd5e1', fontSize: 13, minWidth: 70 }}>Channel</div>
                        <select
                            value={heatmapChannel || ''}
                            onChange={(e) => setHeatmapChannel(e.target.value || null)}
                            style={{
                                flex: 1,
                                background: '#0b1220',
                                border: '1px solid #334155',
                                color: '#e5e7eb',
                                borderRadius: 8,
                                padding: '8px 10px',
                                outline: 'none'
                            }}
                        >
                            {/* Build options from sensors that have roomId */}
                            {Array.from(new Set((sensors || []).filter((s: any) => s?.roomId != null).map((s: any) => s.type))).map((t: any) => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                        </select>
                    </div>
                    {heatLegend ? (
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: '#9ca3af', marginBottom: 6 }}>
                                <span>{heatLegend.min.toFixed(2)}{heatLegend.unit}</span>
                                <span>{((heatLegend.min + heatLegend.max)/2).toFixed(2)}{heatLegend.unit}</span>
                                <span>{heatLegend.max.toFixed(2)}{heatLegend.unit}</span>
                            </div>
                            <div style={{
                                width: '100%',
                                height: 16,
                                borderRadius: 6,
                                background: 'linear-gradient(90deg, #2563eb 0%, #22d3ee 20%, #22c55e 40%, #f59e0b 70%, #ef4444 100%)',
                                border: '1px solid #374151'
                            }} />
                            <div style={{ marginTop: 8, fontSize: 12, color: '#9ca3af' }}>Range • <span style={{ color: '#f9fafb' }}>{heatLegend.label}</span></div>
                        </>
                    ) : (
                        <div style={{ fontSize: 12, color: '#9ca3af' }}>No room-linked sensor values in this channel.</div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ForgeViewer;
