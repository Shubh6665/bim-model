"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from "react";

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
  showSensorForm: (position: { x: number; y: number; z: number }) => void;
  hideSensorForm: () => void;
  placeSensorWithDetails: (formData: {
    name: string;
    code: string;
    mark: string;
    model: string;
    room: string;
    link: string;
    type: string;
  }) => Promise<Sensor | null>;
  removeSensor: (sensorId: string) => Promise<boolean>;
  updateSensor: (sensorId: string, updates: Partial<Sensor>) => Promise<boolean>;
  toggleSensorTypeVisibility: (sensorType: string) => void;
  filterSensorsByType: (sensorType: string | null) => void;
  getFilteredSensors: () => Sensor[];
  refreshSensors: () => Promise<void>;
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
  // Form state
  const [showInsertionForm, setShowInsertionForm] = useState(false);
  const [pendingPosition, setPendingPosition] = useState<{ x: number; y: number; z: number } | null>(null);

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
      const sensorData = {
        name: `${placementSensorType} Sensor ${Date.now()}`,
        type: placementSensorType,
        status: "Online" as const,
        value: "0",
        position,
        batteryLevel: 100,
        lastUpdate: new Date().toISOString(),
        room: room || "Unknown Room",
        color: SENSOR_TYPES.find(t => t.name === placementSensorType)?.color,
        projectId: currentProjectId || "unknown",
        modelPosition: position,
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
      console.log("Sensor placed successfully:", newSensor);
      return newSensor;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to place sensor');
      console.error("Failed to place sensor:", err);
      exitPlacementMode();
      return null;
    } finally {
      setLoading(false);
    }
  }, [placementSensorType, exitPlacementMode]);

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
  const showSensorForm = useCallback((position: { x: number; y: number; z: number }) => {
    setPendingPosition(position);
    setShowInsertionForm(true);
  }, []);

  const hideSensorForm = useCallback(() => {
    setShowInsertionForm(false);
    setPendingPosition(null);
  }, []);

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
      const sensorData = {
        name: formData.name,
        type: formData.type,
        status: "Online" as const,
        value: "0",
        position: pendingPosition,
        batteryLevel: 100,
        lastUpdate: new Date().toISOString(),
        room: formData.room,
        color: SENSOR_TYPES.find(t => t.name === formData.type)?.color,
        projectId: currentProjectId || "unknown",
        modelPosition: pendingPosition,
        // Additional form fields
        code: formData.code,
        mark: formData.mark,
        model: formData.model,
        link: formData.link || undefined,
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
      console.log("Sensor placed successfully:", newSensor);
      return newSensor;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to place sensor');
      console.error("Failed to place sensor:", err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [pendingPosition, currentProjectId, hideSensorForm, exitPlacementMode]);

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
