"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from "react";
import { RoomMappingService } from '@/app/services/room-mapping';

export interface Sensor {
  id: string;
  name: string;
  type: string;
  status: "Online" | "Offline" | "Warning";
  value: string;
  position: { x: number; y: number; z: number };
  batteryLevel: number;
  lastUpdate: string;
  room: string;
  roomId?: number;
  roomData?: any;
  color?: string;
  projectId?: string;
  modelPosition?: { x: number; y: number; z: number };
  // Additional fields for detailed sensor information
  code?: string;
  mark?: string;
  model?: string;
  link?: string;
}

export const SENSOR_TYPES = [
  { name: "Temperature", color: "#ef4444", unit: "°C" },
  { name: "CO2", color: "#22c55e", unit: "ppm" },
  { name: "Light", color: "#fde047", unit: "lux" },
  { name: "Humidity", color: "#3b82f6", unit: "%" },
  { name: "Seismic and accelerometric", color: "#a21caf", unit: "g" },
  { name: "Energy consumption", color: "#14b8a6", unit: "kWh" },
];

interface SensorContextType {
  // State
  sensors: Sensor[];
  selectedSensor: Sensor | null;
  isPlacementMode: boolean;
  placementSensorType: string | null;
  visibleSensorTypes: Set<string>;
  filteredSensorType: string | null;
  loading: boolean;
  error: string | null;
  currentProjectId: string | null;
  // Viewer overlay state
  viewerOverlay: { type: 'info' | 'graphs' | 'statistics'; sensor: Sensor } | null;
  // Form state
  showInsertionForm: boolean;
  pendingPosition: { x: number; y: number; z: number } | null;

  // Actions
  selectSensor: (sensor: Sensor | null) => void;
  enterPlacementMode: (sensorType: string) => void;
  exitPlacementMode: () => void;
  setCurrentProject: (projectId: string | null) => void;
  placeSensor: (
    position: { x: number; y: number; z: number },
    room?: string,
  ) => Promise<Sensor | null>;
  // New form-based sensor placement
  showSensorForm: (position: { x: number; y: number; z: number }, dbId?: number) => void;
  hideSensorForm: () => void;
  placeSensorWithDetails: (formData: {
    name: string;
    code: string;
    mark: string;
    model: string;
    room: string;
    link: string;
    type: string;
    externalId: string;
    devsn: string;
  }) => Promise<Sensor | null>;
  removeSensor: (sensorId: string) => Promise<boolean>;
  updateSensor: (sensorId: string, updates: Partial<Sensor>) => Promise<boolean>;
  toggleSensorTypeVisibility: (sensorType: string) => void;
  filterSensorsByType: (sensorType: string | null) => void;
  getFilteredSensors: () => Sensor[];
  refreshSensors: () => Promise<void>;
  // Viewer overlay actions
  showViewerOverlay: (sensor: Sensor, type: 'info' | 'graphs' | 'statistics') => void;
  hideViewerOverlay: () => void;
  // Real-time updates
  updateSensorValues: (updates: Array<{ id: string; value: string; status: string; lastUpdate: string }>) => void;
  // Room detection
  setupRoomDetection: (viewer: any) => Promise<void>;
  getRoomForPosition: (position: { x: number; y: number; z: number }) => any | null;
  getRoomForDbId: (dbId: number) => Promise<any | null>;
  // Helper for forms: best-effort room info for the current pending placement
  getRoomForPending: () => Promise<any | null>;
  // Force refresh room mapping algorithm
  refreshRoomMapping: () => void;
}

const SensorContext = createContext<SensorContextType | undefined>(undefined);

interface SensorProviderProps {
  children: ReactNode;
}

export function SensorProvider({ children }: SensorProviderProps) {
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [selectedSensor, setSelectedSensor] = useState<Sensor | null>(null);
  const [isPlacementMode, setIsPlacementMode] = useState(false);
  const [placementSensorType, setPlacementSensorType] = useState<string | null>(null);
  const [visibleSensorTypes, setVisibleSensorTypes] = useState<Set<string>>(
    new Set(SENSOR_TYPES.map(type => type.name))
  );
  const [filteredSensorType, setFilteredSensorType] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  // Viewer overlay
  const [viewerOverlay, setViewerOverlay] = useState<{ type: 'info' | 'graphs' | 'statistics'; sensor: Sensor } | null>(null);
  // Form state
  const [showInsertionForm, setShowInsertionForm] = useState(false);
  const [pendingPosition, setPendingPosition] = useState<{ x: number; y: number; z: number } | null>(null);
  
  // Official APS room mapping service
  const [roomMapper, setRoomMapper] = useState<RoomMappingService | null>(null);
  // Track clicked object dbId and viewer instance for hierarchy-based room detection
  const [pendingDbId, setPendingDbId] = useState<number | null>(null);
  const [viewerInstance, setViewerInstance] = useState<any>(null);

  // Load sensors from API (project-specific)
  const refreshSensors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Only fetch sensors if we have a current project
      if (!currentProjectId) {
        setSensors([]);
        return;
      }
      
      const response = await fetch(`/api/iot/sensors?projectId=${currentProjectId}`);
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        console.warn(`[SensorContext] sensors GET failed: ${response.status} ${response.statusText} body=${text}`);
        if (response.status === 401) {
          // Not authenticated – treat as empty for now (middleware will redirect on protected pages)
          setSensors([]);
          setError('Not authenticated');
          return;
        }
        if (response.status === 403) {
          // Invited user without IoT package – show empty, avoid crash
          setSensors([]);
          setError('No IoT access for this project');
          return;
        }
        throw new Error('Failed to fetch sensors');
      }
      const fetchedSensors = await response.json();
      setSensors(fetchedSensors);
      console.log(`[SensorContext] Loaded ${fetchedSensors.length} sensors for project ${currentProjectId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching sensors:', err);
    } finally {
      setLoading(false);
    }
  }, [currentProjectId]);

  // Load sensors on mount
  useEffect(() => {
    refreshSensors();
  }, [refreshSensors]);

  // Select a sensor
  const selectSensor = useCallback((sensor: Sensor | null) => {
    setSelectedSensor(sensor);
  }, []);

  // Enter sensor placement mode
  const enterPlacementMode = useCallback((sensorType: string) => {
    console.log("Entering placement mode for:", sensorType);
    setIsPlacementMode(true);
    setPlacementSensorType(sensorType);
    setSelectedSensor(null);
  }, []);

  // Exit sensor placement mode
  const exitPlacementMode = useCallback(() => {
    console.log("Exiting placement mode");
    setIsPlacementMode(false);
    setPlacementSensorType(null);
  }, []);

  // Set current project (triggers sensor reload)
  const setCurrentProject = useCallback((projectId: string | null) => {
    console.log(`[SensorContext] Switching to project: ${projectId}`);
    setCurrentProjectId(projectId);
    setSelectedSensor(null); // Clear selection when switching projects
    exitPlacementMode(); // Exit placement mode when switching projects
  }, []);

  // Place a sensor at the specified position
  const placeSensor = useCallback(async (
    position: { x: number; y: number; z: number },
    room?: string,
  ): Promise<Sensor | null> => {
    if (!placementSensorType) {
      console.warn("No sensor type selected for placement");
      return null;
    }

    setLoading(true);
    setError(null);
    
    try {
      // Detect room using room detector
      let detectedRoom = room || "Unknown Room";
      let roomInfo = null;
      
      if (roomMapper) {
        console.log("🔍 [SensorContext] Detecting room for sensor position...");
        roomInfo = roomMapper.findRoomAt(position);
        
        if (roomInfo) {
          detectedRoom = roomInfo.roomName;
          console.log(`✅ [SensorContext] Sensor linked to room: ${detectedRoom} (dbId: ${roomInfo.roomId})`);
          console.log(`📍 [SensorContext] Room level:`, roomInfo.levelName);
        } else {
          console.warn("❌ [SensorContext] No room detected for sensor position");
        }
      } else {
        console.warn("⚠️ [SensorContext] Room mapping not initialized");
      }

      const sensorData = {
        name: `${placementSensorType} Sensor ${Date.now()}`,
        type: placementSensorType,
        status: "Online" as const,
        value: "0",
        position,
        batteryLevel: 100,
        lastUpdate: new Date().toISOString(),
        room: detectedRoom,
        color: SENSOR_TYPES.find(t => t.name === placementSensorType)?.color,
        projectId: currentProjectId || "unknown",
        modelPosition: position,
        // Add room metadata if detected
        ...(roomInfo && {
          roomId: roomInfo.roomId,
          roomData: {
            name: roomInfo.roomName,
            dbId: roomInfo.roomId,
            properties: { levelName: roomInfo.levelName }
          }
        })
      };

      const response = await fetch('/api/iot/sensors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sensorData),
      });

      if (!response.ok) {
        throw new Error('Failed to create sensor');
      }

      const newSensor = await response.json();
      setSensors(prev => [...prev, newSensor]);
      exitPlacementMode();
      
      // Enhanced console logging with room info
      console.log("🎯 [SensorContext] Sensor placed successfully:", {
        sensorId: newSensor.id,
        sensorName: newSensor.name,
        sensorType: newSensor.type,
        position: position,
        room: detectedRoom,
        roomId: roomInfo?.roomId,
  roomLevel: roomInfo?.levelName
      });
      
      return newSensor;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to place sensor');
      console.error("Failed to place sensor:", err);
      exitPlacementMode();
      return null;
    } finally {
      setLoading(false);
    }
  }, [placementSensorType, exitPlacementMode, roomMapper, currentProjectId]);

  // Remove a sensor
  const removeSensor = useCallback(async (sensorId: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/iot/sensors?id=${sensorId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete sensor');
      }

      setSensors(prev => prev.filter(sensor => sensor.id !== sensorId));
      if (selectedSensor?.id === sensorId) {
        setSelectedSensor(null);
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove sensor');
      console.error('Failed to remove sensor:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [selectedSensor]);

  // Update a sensor
  const updateSensor = useCallback(async (
    sensorId: string,
    updates: Partial<Sensor>,
  ): Promise<boolean> => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/iot/sensors?id=${sensorId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error('Failed to update sensor');
      }

      const updatedSensor = await response.json();
      setSensors(prev => prev.map(sensor => 
        sensor.id === sensorId ? updatedSensor : sensor
      ));
      
      if (selectedSensor?.id === sensorId) {
        setSelectedSensor(updatedSensor);
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update sensor');
      console.error('Failed to update sensor:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [selectedSensor]);

  // Toggle sensor type visibility
  const toggleSensorTypeVisibility = useCallback((sensorType: string) => {
    setVisibleSensorTypes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sensorType)) {
        newSet.delete(sensorType);
      } else {
        newSet.add(sensorType);
      }
      return newSet;
    });
  }, []);

  // Filter sensors by type
  const filterSensorsByType = useCallback((sensorType: string | null) => {
    setFilteredSensorType(sensorType);
  }, []);

  // Get filtered sensors
  const getFilteredSensors = useCallback((): Sensor[] => {
    let filtered = sensors.filter(sensor => visibleSensorTypes.has(sensor.type));
    
    if (filteredSensorType) {
      filtered = filtered.filter(sensor => sensor.type === filteredSensorType);
    }
    
    return filtered;
  }, [sensors, visibleSensorTypes, filteredSensorType]);

  // Form-related functions
  const showSensorForm = useCallback((position: { x: number; y: number; z: number }, dbId?: number) => {
    console.log('[SensorContext] showSensorForm() called', {
      position: { x: +position.x.toFixed(3), y: +position.y.toFixed(3), z: +position.z.toFixed(3) },
      dbId: typeof dbId === 'number' ? dbId : null,
      isPlacementMode,
      placementSensorType,
    });
    setPendingPosition(position);
    setPendingDbId((typeof dbId === 'number') ? dbId : null);
    // Fresh unhighlight to avoid lingering selection/glow
    try {
      if (viewerInstance?.clearSelection) viewerInstance.clearSelection();
      if (viewerInstance?.impl?.invalidate) viewerInstance.impl.invalidate(true);
    } catch {}
    setShowInsertionForm(true);
    console.log('[SensorContext] Insertion form state -> open');
  }, [viewerInstance, isPlacementMode, placementSensorType]);

  const hideSensorForm = useCallback(() => {
    console.log('[SensorContext] hideSensorForm() called - closing insertion form');
    setShowInsertionForm(false);
    setPendingPosition(null);
  }, []);

  // Viewer overlay actions
  const showViewerOverlay = useCallback((sensor: Sensor, type: 'info' | 'graphs' | 'statistics') => {
    setViewerOverlay({ sensor, type });
  }, []);

  const hideViewerOverlay = useCallback(() => {
    setViewerOverlay(null);
  }, []);

  // Room detection functions
  const setupRoomDetection = useCallback(async (viewer: any) => {
    console.log('🏠 [SensorContext] Initializing APS room mapping...');
    try {
      setViewerInstance(viewer);
      const svc = roomMapper || new RoomMappingService(viewer);
      await svc.init(viewer);
      if (!roomMapper) setRoomMapper(svc);
      console.log('✅ [SensorContext] Room mapping ready');
    } catch (e) {
      console.warn('[SensorContext] Room mapping initialization failed', e);
    }
  }, [roomMapper]);

  // Force refresh room mapping (useful when algorithm is updated)
  const refreshRoomMapping = useCallback(() => {
    if (roomMapper) {
      roomMapper.forceRefresh();
    }
  }, [roomMapper]);

  const getRoomForPosition = useCallback((position: { x: number; y: number; z: number }) => {
    if (!roomMapper) {
      console.warn("Room mapping not initialized");
      return null;
    }
    // 1) Try exact point
    let info = roomMapper.findRoomAt(position);
    if (info) return info;
    // 2) Fallback slightly below (helps when clicking furniture surfaces)
    const fallback = { x: position.x, y: position.y, z: position.z - 0.3 };
    info = roomMapper.findRoomAt(fallback);
    if (info) {
      console.log('✅ [SensorContext] Fallback below point succeeded for room detection');
    }
    return info;
  }, [roomMapper]);

  // Enhanced room detection using spatial containment
  const findRoomForDbId = useCallback(async (dbId: number): Promise<any | null> => {
    try {
      const v = viewerInstance;
      const model = v?.model;
      if (!v || !model) return null;

      // First check if the object itself is a room
      const props = await new Promise<any>((resolve, reject) => {
        v.getProperties(dbId, resolve, reject);
      });
      
      const category = props?.properties?.find((p: any) => 
        p.displayName === 'Category' || p.displayCategory === 'Identity Data'
      )?.displayValue;
      
      if (String(category).toLowerCase().includes('room')) {
        const name = props.name || `Room ${dbId}`;
        const level = props.properties?.find((p: any) => 
          p.displayName === 'Level' || p.displayCategory === 'Constraints'
        )?.displayValue;
        console.log(`🏠 [SensorContext] Object ${dbId} is a room itself: ${name}`);
        return { roomId: dbId, roomName: name, levelName: level };
      }

      // If not a room, use spatial containment to find enclosing room
      if (roomMapper && typeof roomMapper.findRoomForObject === 'function') {
        console.log(`🔍 [SensorContext] Checking spatial containment for object ${dbId}...`);
        const roomInfo = await roomMapper.findRoomForObject(dbId);
        if (roomInfo) {
          console.log(`🏠 [SensorContext] Found enclosing room via spatial containment: ${roomInfo.roomName} (dbId: ${roomInfo.roomId})`);
          return roomInfo;
        } else {
          console.log(`🚫 [SensorContext] No enclosing room found for object ${dbId}`);
        }
      }
      
      return null;
    } catch (e) {
      console.warn('[SensorContext] findRoomForDbId failed', e);
      return null;
    }
  }, [viewerInstance, roomMapper]);

  // Enhanced room detection: try hierarchy first, then geometric, with flexible fallback
  const getRoomForPending = useCallback(async (): Promise<any | null> => {
    try {
      let info: any = null;
      
      // Strategy 1: Check if clicked object itself is a room or has room hierarchy
      if (pendingDbId != null) {
        info = await findRoomForDbId(pendingDbId);
        if (info) {
          console.log(`🏠 [SensorContext] Room detected via hierarchy: ${info.roomName} (dbId: ${info.roomId})`);
          return info;
        }
      }
      
      // Strategy 2: Geometric room detection at position
      if (pendingPosition && roomMapper) {
        info = getRoomForPosition(pendingPosition);
        if (info) {
          console.log(`🏠 [SensorContext] Room detected geometrically: ${info.roomName} (dbId: ${info.roomId})`);
          return info;
        }
      }
      
      console.log(`ℹ️ [SensorContext] No room detected - sensor can be placed on any object`);
      return null;
    } catch (e) {
      console.warn('[SensorContext] getRoomForPending failed', e);
      return null;
    }
  }, [pendingDbId, pendingPosition, roomMapper, findRoomForDbId, getRoomForPosition]);

  const placeSensorWithDetails = useCallback(async (formData: {
    name: string;
    code: string;
    mark: string;
    model: string;
    room: string;
    link: string;
    type: string;
  }): Promise<Sensor | null> => {
    if (!pendingPosition) {
      console.error('No pending position for sensor placement');
      return null;
    }

    setLoading(true);
    setError(null);
    
    try {
      // Enhanced flexible sensor placement logic
      const userRoomText = (formData.room || '').trim();
      let finalRoom = "";
      let roomInfo: any = null;

      if (userRoomText) {
        // User manually entered room name - respect it completely
        finalRoom = userRoomText;
        console.log(`✍️ [SensorContext] Using user-provided room: "${finalRoom}"`);
        
        // Still try to get metadata for heatmap linking if possible
        if (pendingDbId != null) {
          roomInfo = await findRoomForDbId(pendingDbId);
        }
        if (!roomInfo && roomMapper) {
          roomInfo = getRoomForPosition(pendingPosition);
        }
        if (roomInfo) {
          console.log(`📎 [SensorContext] Room metadata attached for heatmap: dbId=${roomInfo.roomId}`);
        }
      } else {
        // Auto-detect room if available, but allow sensor placement anywhere
        if (pendingDbId != null) {
          roomInfo = await findRoomForDbId(pendingDbId);
          if (roomInfo) {
            finalRoom = roomInfo.roomName;
            console.log(`🏠 [SensorContext] Auto-detected room via hierarchy: ${finalRoom} (dbId: ${roomInfo.roomId})`);
          }
        }

        if (!roomInfo && roomMapper) {
          console.log("🔍 [SensorContext] Trying geometric room detection...");
          roomInfo = getRoomForPosition(pendingPosition);
          if (roomInfo) {
            finalRoom = roomInfo.roomName;
            console.log(`🏠 [SensorContext] Auto-detected room geometrically: ${finalRoom} (dbId: ${roomInfo.roomId})`);
          }
        }

        if (!roomInfo) {
          // No room detected - sensor can still be placed on any object
          finalRoom = "Unassigned"; // Generic fallback
          console.log(`🔧 [SensorContext] No room detected - placing sensor on object (bridge/equipment mode)`);
        }
      }

      const sensorData = {
        name: formData.name,
        type: formData.type,
        status: "Online" as const,
        value: "0",
        position: pendingPosition,
        batteryLevel: 100,
        lastUpdate: new Date().toISOString(),
        room: finalRoom, // User input OR auto-detected OR "Unassigned" for flexible placement
        color: SENSOR_TYPES.find(t => t.name === formData.type)?.color,
        projectId: currentProjectId || "unknown",
        modelPosition: pendingPosition,
        // Additional form fields
        code: formData.code,
        mark: formData.mark,
        model: formData.model,
        link: formData.link || undefined,
        // Add room metadata if detected
        ...(roomInfo && {
          roomId: roomInfo.roomId,
          roomData: {
            name: roomInfo.roomName,
            dbId: roomInfo.roomId,
            properties: { levelName: roomInfo.levelName }
          }
        })
      };

      const response = await fetch('/api/iot/sensors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sensorData),
      });

      if (!response.ok) {
        throw new Error('Failed to create sensor');
      }

      const newSensor = await response.json();
      setSensors(prev => [...prev, newSensor]);
      hideSensorForm();
      exitPlacementMode();
      
      // Enhanced console logging with flexible placement info
      console.log("🎯 [SensorContext] Sensor placed successfully:", {
        sensorId: newSensor.id,
        sensorName: newSensor.name,
        sensorType: newSensor.type,
        position: pendingPosition,
        room: finalRoom,
        roomId: roomInfo?.roomId,
        roomLevel: roomInfo?.levelName,
        placementMode: roomInfo ? 'room-linked' : 'object-attached'
      });
      
      return newSensor;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to place sensor');
      console.error("Failed to place sensor:", err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [pendingPosition, pendingDbId, currentProjectId, hideSensorForm, exitPlacementMode, roomMapper, getRoomForPosition, findRoomForDbId]);

  // Update sensor values in real-time
  const updateSensorValues = useCallback((updates: Array<{ id: string; value: string; status: string; lastUpdate: string }>) => {
    console.log(`[SensorContext] Updating ${updates.length} sensor values`);
    setSensors(prev => {
      const updated = [...prev];
      for (const update of updates) {
        const index = updated.findIndex(s => s.id === update.id);
        if (index >= 0) {
          updated[index] = {
            ...updated[index],
            value: update.value,
            status: update.status as "Online" | "Offline" | "Warning",
            lastUpdate: update.lastUpdate,
          };
          console.log(`[SensorContext] Updated sensor ${update.id}: ${update.value} (${update.status})`);
        }
      }
      return updated;
    });
  }, []);

  // (moved room detection helpers above)

  const contextValue: SensorContextType = {
    sensors,
    selectedSensor,
    isPlacementMode,
    placementSensorType,
    visibleSensorTypes,
    filteredSensorType,
    loading,
    error,
    currentProjectId,
    // Viewer overlay state
    viewerOverlay,
    // Form state
    showInsertionForm,
    pendingPosition,
    // Actions
    selectSensor,
    enterPlacementMode,
    exitPlacementMode,
    setCurrentProject,
    placeSensor,
    // Form actions
    showSensorForm,
    hideSensorForm,
    placeSensorWithDetails,
    removeSensor,
    updateSensor,
    toggleSensorTypeVisibility,
    filterSensorsByType,
    getFilteredSensors,
    refreshSensors,
    // Overlay actions
    showViewerOverlay,
    hideViewerOverlay,
    // Real-time updates
    updateSensorValues,
    // Room detection functions
    setupRoomDetection,
    getRoomForPosition,
    getRoomForDbId: findRoomForDbId,
    getRoomForPending,
    refreshRoomMapping,
  };

  return (
    <SensorContext.Provider value={contextValue}>
      {children}
    </SensorContext.Provider>
  );
}

export function useSensorContext() {
  const context = useContext(SensorContext);
  if (context === undefined) {
    throw new Error("useSensorContext must be used within a SensorProvider");
  }
  return context;
}
