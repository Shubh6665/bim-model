"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import {
  sensorService,
  Sensor,
  SensorService,
} from "../services/sensor-service";

interface SensorContextType {
  sensors: Sensor[];
  selectedSensor: Sensor | null;
  isPlacementMode: boolean;
  placementSensorType: string | null;
  visibleSensorTypes: Set<string>;

  // Actions
  selectSensor: (sensor: Sensor | null) => void;
  enterPlacementMode: (sensorType: string) => void;
  exitPlacementMode: () => void;
  placeSensor: (
    position: { x: number; y: number; z: number },
    room?: string,
  ) => Sensor | null;
  removeSensor: (sensorId: string) => boolean;
  updateSensor: (sensorId: string, updates: Partial<Sensor>) => boolean;
  toggleSensorTypeVisibility: (sensorType: string) => void;
  filterSensorsByType: (sensorType: string | null) => Sensor[];
  highlightSensor: (sensorId: string) => void;
  clearSelection: () => void;

  // Service
  sensorService: SensorService;
}

const SensorContext = createContext<SensorContextType | undefined>(undefined);

interface SensorProviderProps {
  children: ReactNode;
}

export function SensorProvider({ children }: SensorProviderProps) {
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [selectedSensor, setSelectedSensor] = useState<Sensor | null>(null);
  const [isPlacementMode, setIsPlacementMode] = useState(false);
  const [placementSensorType, setPlacementSensorType] = useState<string | null>(
    null,
  );
  const [visibleSensorTypes, setVisibleSensorTypes] = useState<Set<string>>(
    new Set([
      "Temperature",
      "CO2",
      "Light",
      "Humidity",
      "Seismic and accelerometric",
      "Energy consuption",
    ]),
  );

  // Subscribe to sensor service updates
  useEffect(() => {
    const unsubscribe = sensorService.subscribe((updatedSensors) => {
      setSensors(updatedSensors);
    });

    // Load demo sensor data from public/sensors-demo.json
    fetch('/sensors-demo.json')
      .then(res => res.json())
      .then(demoSensors => {
        if (Array.isArray(demoSensors)) {
          // Only add sensors if the array is not empty
          if (demoSensors.length > 0) {
            demoSensors.forEach(sensor => sensorService.addSensor(sensor));
          }
        }
      })
      .catch(err => {
        console.warn('No demo sensor data loaded:', err);
      });

    return unsubscribe;
  }, []);

  // Select a sensor
  const selectSensor = (sensor: Sensor | null) => {
    setSelectedSensor(sensor);
    if (sensor) {
      sensorService.highlightSensor(sensor.id);
    } else {
      sensorService.clearSelection();
    }
  };

  // Enter sensor placement mode
  const enterPlacementMode = (sensorType: string) => {
    console.log("Entering placement mode for:", sensorType);
    setIsPlacementMode(true);
    setPlacementSensorType(sensorType);
    setSelectedSensor(null);
  };

  // Exit sensor placement mode
  const exitPlacementMode = () => {
    console.log("Exiting placement mode");
    setIsPlacementMode(false);
    setPlacementSensorType(null);
  };

  // Place a sensor at the specified position
  const placeSensor = (
    position: { x: number; y: number; z: number },
    room?: string,
  ): Sensor | null => {
    if (!placementSensorType) {
      console.warn("No sensor type selected for placement");
      return null;
    }

    try {
      const newSensor = sensorService.placeSensorAtPosition(
        placementSensorType,
        position,
        room,
      );
      exitPlacementMode();
      console.log("Sensor placed successfully:", newSensor);
      return newSensor;
    } catch (error) {
      console.error("Failed to place sensor:", error);
      exitPlacementMode(); // Exit placement mode even on error
      return null;
    }
  };

  // Remove a sensor
  const removeSensor = (sensorId: string): boolean => {
    const success = sensorService.removeSensor(sensorId);
    if (success && selectedSensor?.id === sensorId) {
      setSelectedSensor(null);
    }
    return success;
  };

  // Update a sensor
  const updateSensor = (
    sensorId: string,
    updates: Partial<Sensor>,
  ): boolean => {
    const success = sensorService.updateSensor(sensorId, updates);
    if (success && selectedSensor?.id === sensorId) {
      const updatedSensor = sensorService.getSensorById(sensorId);
      if (updatedSensor) {
        setSelectedSensor(updatedSensor);
      }
    }
    return success;
  };

  // Toggle sensor type visibility
  const toggleSensorTypeVisibility = (sensorType: string) => {
    const newVisibleTypes = new Set(visibleSensorTypes);
    if (newVisibleTypes.has(sensorType)) {
      newVisibleTypes.delete(sensorType);
    } else {
      newVisibleTypes.add(sensorType);
    }
    setVisibleSensorTypes(newVisibleTypes);
    sensorService.setSensorTypeVisibility(
      sensorType,
      newVisibleTypes.has(sensorType),
    );
  };

  // Filter sensors by type and visibility
  const filterSensorsByType = (sensorType: string | null): Sensor[] => {
    let filtered = sensors.filter((sensor) =>
      visibleSensorTypes.has(sensor.type),
    );

    if (sensorType) {
      filtered = filtered.filter((sensor) => sensor.type === sensorType);
    }

    return filtered;
  };

  // Highlight a sensor in the model
  const highlightSensor = (sensorId: string) => {
    const sensor = sensorService.getSensorById(sensorId);
    if (sensor) {
      selectSensor(sensor);
    }
  };

  // Clear sensor selection
  const clearSelection = () => {
    setSelectedSensor(null);
    sensorService.clearSelection();
  };

  const contextValue: SensorContextType = {
    sensors,
    selectedSensor,
    isPlacementMode,
    placementSensorType,
    visibleSensorTypes,

    selectSensor,
    enterPlacementMode,
    exitPlacementMode,
    placeSensor,
    removeSensor,
    updateSensor,
    toggleSensorTypeVisibility,
    filterSensorsByType,
    highlightSensor,
    clearSelection,

    sensorService,
  };

  return (
    <SensorContext.Provider value={contextValue}>
      {children}
    </SensorContext.Provider>
  );
}

// Hook to use the sensor context
export function useSensorContext() {
  const context = useContext(SensorContext);
  if (context === undefined) {
    throw new Error("useSensorContext must be used within a SensorProvider");
  }
  return context;
}

// Hook to use sensors with optional filtering
export function useSensors(filterType?: string) {
  const { sensors, visibleSensorTypes } = useSensorContext();

  return React.useMemo(() => {
    let filtered = sensors.filter((sensor) =>
      visibleSensorTypes.has(sensor.type),
    );

    if (filterType) {
      filtered = filtered.filter((sensor) => sensor.type === filterType);
    }

    return filtered;
  }, [sensors, visibleSensorTypes, filterType]);
}

// Hook to get sensor by ID
export function useSensor(sensorId: string | null) {
  const { sensors } = useSensorContext();

  return React.useMemo(() => {
    if (!sensorId) return null;
    return sensors.find((sensor) => sensor.id === sensorId) || null;
  }, [sensors, sensorId]);
}
