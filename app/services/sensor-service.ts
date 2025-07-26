"use client";

// Type declaration for THREE.js global
declare global {
  var THREE: any;
}

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
  modelPosition?: { x: number; y: number; z: number }; // Position in the 3D model
}

export interface SensorType {
  name: string;
  icon: any;
  color: string;
  bgColor: string;
  hoverColor: string;
}

export class SensorService {
  private sensors: Sensor[] = [];
  private listeners: Array<(sensors: Sensor[]) => void> = [];
  private viewer: any = null;
  private selectedSensorId: string | null = null;

  constructor() {
    // Initialize with mock data
    this.sensors = [
      {
        id: "1",
        name: "Office Temperature Sensor",
        type: "Temperature",
        status: "Online",
        value: "22.5°C",
        position: { x: 100, y: 200, z: 50 },
        batteryLevel: 85,
        lastUpdate: "2 min ago",
        room: "Office A-101",
        color: "#ef4444",
        modelPosition: { x: 100, y: 200, z: 50 },
      },
      {
        id: "2",
        name: "Main Hall CO2 Monitor",
        type: "CO2",
        status: "Online",
        value: "420 ppm",
        position: { x: 150, y: 300, z: 80 },
        batteryLevel: 92,
        lastUpdate: "1 min ago",
        room: "Main Hall",
        color: "#eab308",
        modelPosition: { x: 150, y: 300, z: 80 },
      },
      {
        id: "3",
        name: "Conference Room Light",
        type: "Light",
        status: "Warning",
        value: "850 lux",
        position: { x: 80, y: 150, z: 60 },
        batteryLevel: 45,
        lastUpdate: "5 min ago",
        room: "Conference Room B",
        color: "#f59e0b",
        modelPosition: { x: 80, y: 150, z: 60 },
      },
      {
        id: "4",
        name: "Storage Humidity Sensor",
        type: "Humidity",
        status: "Offline",
        value: "65%",
        position: { x: 200, y: 100, z: 40 },
        batteryLevel: 12,
        lastUpdate: "2 hours ago",
        room: "Storage Room",
        color: "#3b82f6",
        modelPosition: { x: 200, y: 100, z: 40 },
      },
      {
        id: "5",
        name: "Building Seismic Monitor",
        type: "Seismic and accelerometric",
        status: "Online",
        value: "0.02g",
        position: { x: 120, y: 250, z: 30 },
        batteryLevel: 78,
        lastUpdate: "30 sec ago",
        room: "Foundation Level",
        color: "#a855f7",
        modelPosition: { x: 120, y: 250, z: 30 },
      },
      {
        id: "6",
        name: "HVAC Energy Monitor",
        type: "Energy consuption",
        status: "Online",
        value: "2.4 kW",
        position: { x: 180, y: 180, z: 90 },
        batteryLevel: 100,
        lastUpdate: "1 min ago",
        room: "Mechanical Room",
        color: "#22c55e",
        modelPosition: { x: 180, y: 180, z: 90 },
      },
    ];
  }

  // Set the Forge viewer instance
  setViewer(viewer: any) {
    this.viewer = viewer;
    this.renderSensorsInModel();
  }

  // Subscribe to sensor data changes
  subscribe(callback: (sensors: Sensor[]) => void) {
    this.listeners.push(callback);
    callback(this.sensors); // Initial call
    return () => {
      this.listeners = this.listeners.filter(
        (listener) => listener !== callback,
      );
    };
  }

  // Notify all listeners of changes
  private notifyListeners() {
    this.listeners.forEach((listener) => listener(this.sensors));
  }

  // Get all sensors
  getSensors(): Sensor[] {
    return this.sensors;
  }

  // Get sensor by ID
  getSensorById(id: string): Sensor | undefined {
    return this.sensors.find((sensor) => sensor.id === id);
  }

  // Get sensors by type
  getSensorsByType(type: string): Sensor[] {
    return this.sensors.filter((sensor) => sensor.type === type);
  }

  // Add a new sensor
  addSensor(sensor: Omit<Sensor, "id" | "lastUpdate">): Sensor {
    const newSensor: Sensor = {
      ...sensor,
      id: this.generateId(),
      lastUpdate: "Just now",
    };

    this.sensors.push(newSensor);
    this.notifyListeners();
    this.renderSensorInModel(newSensor);

    return newSensor;
  }

  // Update sensor data
  updateSensor(id: string, updates: Partial<Sensor>): boolean {
    const index = this.sensors.findIndex((sensor) => sensor.id === id);
    if (index === -1) return false;

    this.sensors[index] = {
      ...this.sensors[index],
      ...updates,
      lastUpdate: "Just now",
    };

    this.notifyListeners();
    this.updateSensorInModel(this.sensors[index]);

    return true;
  }

  // Remove a sensor
  removeSensor(id: string): boolean {
    const index = this.sensors.findIndex((sensor) => sensor.id === id);
    if (index === -1) return false;

    this.sensors.splice(index, 1);
    this.notifyListeners();
    this.removeSensorFromModel(id);

    return true;
  }

  // Place sensor at specific position in model
  placeSensorAtPosition(
    sensorType: string,
    position: { x: number; y: number; z: number },
    room?: string,
  ): Sensor {
    const sensorColors = {
      Temperature: "#ef4444",
      CO2: "#eab308",
      Light: "#f59e0b",
      Humidity: "#3b82f6",
      "Seismic and accelerometric": "#a855f7",
      "Energy consuption": "#22c55e",
    };

    const sensorDefaults = {
      Temperature: { unit: "°C", defaultValue: "20.0" },
      CO2: { unit: "ppm", defaultValue: "400" },
      Light: { unit: "lux", defaultValue: "500" },
      Humidity: { unit: "%", defaultValue: "45" },
      "Seismic and accelerometric": { unit: "g", defaultValue: "0.01" },
      "Energy consuption": { unit: "kW", defaultValue: "1.2" },
    };

    const defaults = sensorDefaults[
      sensorType as keyof typeof sensorDefaults
    ] || { unit: "", defaultValue: "0" };

    return this.addSensor({
      name: `${sensorType} Sensor ${this.sensors.length + 1}`,
      type: sensorType,
      status: "Online",
      value: `${defaults.defaultValue}${defaults.unit}`,
      position,
      modelPosition: position,
      batteryLevel: 100,
      room: room || "Unknown Room",
      color: sensorColors[sensorType as keyof typeof sensorColors] || "#6b7280",
    });
  }

  // Highlight sensor in model
  highlightSensor(sensorId: string) {
    const sensor = this.getSensorById(sensorId);
    if (!sensor || !this.viewer) return;

    this.selectedSensorId = sensorId;
    this.renderSensorsInModel(); // Re-render to show selection

    // Center camera on sensor if viewer supports it
    if (this.viewer.navigation && sensor.modelPosition) {
      try {
        // Use Forge Viewer's safe navigation methods
        if (this.viewer.navigation.setTarget) {
          this.viewer.navigation.setTarget(
            new (globalThis as any).THREE.Vector3(
              sensor.modelPosition.x,
              sensor.modelPosition.y,
              sensor.modelPosition.z,
            ),
          );
        } else if (this.viewer.fitToView) {
          // Alternative: fit to view if setTarget not available
          this.viewer.fitToView();
        }
      } catch (error) {
        console.warn("Could not focus on sensor position:", error);
      }
    }
  }

  // Clear sensor selection
  clearSelection() {
    this.selectedSensorId = null;
    this.renderSensorsInModel();
  }

  // Filter sensors by visibility
  setSensorTypeVisibility(sensorType: string, visible: boolean) {
    // This would be implemented to work with the IoT panel's visibility toggles
    // For now, we'll just re-render the sensors
    this.renderSensorsInModel();
  }

  // Render all sensors in the 3D model
  private renderSensorsInModel() {
    if (!this.viewer || !this.viewer.impl || !this.viewer.impl.scene) return;

    try {
      // Clear existing sensor markers
      this.clearSensorMarkersFromModel();

      // Render each sensor
      this.sensors.forEach((sensor) => {
        this.renderSensorInModel(sensor);
      });
    } catch (error) {
      console.warn("Error rendering sensors in model:", error);
    }
  }

  // Render a single sensor in the model
  private renderSensorInModel(sensor: Sensor) {
    if (!this.viewer || !this.viewer.impl || !sensor.modelPosition) return;

    try {
      // Check if Three.js is available
      if (!(globalThis as any).THREE) {
        console.warn("Three.js not available for sensor rendering");
        return;
      }

      // Create a simple sphere geometry for the sensor
      const geometry = new (globalThis as any).THREE.SphereGeometry(2, 16, 16);
      const colorHex = sensor.color
        ? parseInt(sensor.color.replace("#", ""), 16)
        : 0x6b7280;
      const material = new (globalThis as any).THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: sensor.id === this.selectedSensorId ? 1.0 : 0.8,
      });

      const sensorMesh = new (globalThis as any).THREE.Mesh(geometry, material);
      sensorMesh.position.set(
        sensor.modelPosition.x,
        sensor.modelPosition.y,
        sensor.modelPosition.z,
      );

      // Add hover effects and click handling
      sensorMesh.userData = {
        sensorId: sensor.id,
        type: "sensor-marker",
      };

      // Add to scene safely
      const targetScene = this.viewer.impl.scene;
      if (targetScene && targetScene.add) {
        targetScene.add(sensorMesh);

        // Store reference for later removal
        if (!this.viewer.sensorMarkers) {
          this.viewer.sensorMarkers = new Map();
        }
        this.viewer.sensorMarkers.set(sensor.id, sensorMesh);
      }
    } catch (error) {
      console.warn("Could not render sensor in model:", error);
    }
  }

  // Update sensor visualization in model
  private updateSensorInModel(sensor: Sensor) {
    if (!this.viewer || !this.viewer.sensorMarkers) return;

    try {
      const mesh = this.viewer.sensorMarkers.get(sensor.id);
      if (mesh && mesh.material) {
        // Update color based on status
        const colorHex = sensor.color
          ? parseInt(sensor.color.replace("#", ""), 16)
          : 0x6b7280;
        mesh.material.color.setHex(colorHex);
        mesh.material.opacity = sensor.id === this.selectedSensorId ? 1.0 : 0.8;
      }
    } catch (error) {
      console.warn("Could not update sensor in model:", error);
    }
  }

  // Remove sensor from model
  private removeSensorFromModel(sensorId: string) {
    if (!this.viewer || !this.viewer.sensorMarkers) return;

    try {
      const mesh = this.viewer.sensorMarkers.get(sensorId);
      if (mesh && this.viewer.impl && this.viewer.impl.scene) {
        this.viewer.impl.scene.remove(mesh);
        this.viewer.sensorMarkers.delete(sensorId);
      }
    } catch (error) {
      console.warn("Could not remove sensor from model:", error);
    }
  }

  // Clear all sensor markers from model
  private clearSensorMarkersFromModel() {
    if (!this.viewer || !this.viewer.sensorMarkers) return;

    try {
      this.viewer.sensorMarkers.forEach((mesh: any) => {
        if (this.viewer.impl && this.viewer.impl.scene) {
          this.viewer.impl.scene.remove(mesh);
        }
      });
      this.viewer.sensorMarkers.clear();
    } catch (error) {
      console.warn("Could not clear sensor markers:", error);
    }
  }

  // Handle click on model to place sensor
  handleModelClick(
    intersectionPoint: { x: number; y: number; z: number },
    sensorType: string,
  ) {
    // This will be called when user clicks on the model while in sensor placement mode
    return this.placeSensorAtPosition(sensorType, intersectionPoint);
  }

  // Handle click on existing sensor in model
  handleSensorClick(sensorId: string): Sensor | null {
    const sensor = this.getSensorById(sensorId);
    if (sensor) {
      this.highlightSensor(sensorId);
      return sensor;
    }
    return null;
  }

  // Generate unique ID
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Get sensor type colors
  static getSensorTypeColors() {
    return {
      Temperature: "#ef4444",
      CO2: "#eab308",
      Light: "#f59e0b",
      Humidity: "#3b82f6",
      "Seismic and accelerometric": "#a855f7",
      "Energy consuption": "#22c55e",
    };
  }

  // Simulate real-time sensor data updates
  startSimulation() {
    setInterval(() => {
      this.sensors.forEach((sensor) => {
        if (sensor.status === "Online") {
          // Simulate value changes
          let newValue = sensor.value;
          const baseValue = parseFloat(sensor.value);

          if (!isNaN(baseValue)) {
            const variation = (Math.random() - 0.5) * 2; // -1 to 1
            const newBaseValue = baseValue + variation;

            switch (sensor.type) {
              case "Temperature":
                newValue = `${newBaseValue.toFixed(1)}°C`;
                break;
              case "CO2":
                newValue = `${Math.max(300, Math.floor(newBaseValue))} ppm`;
                break;
              case "Light":
                newValue = `${Math.max(0, Math.floor(newBaseValue))} lux`;
                break;
              case "Humidity":
                newValue = `${Math.max(0, Math.min(100, Math.floor(newBaseValue)))}%`;
                break;
              case "Seismic and accelerometric":
                newValue = `${Math.max(0, parseFloat(newBaseValue.toFixed(3)))}g`;
                break;
              case "Energy consuption":
                newValue = `${Math.max(0, parseFloat(newBaseValue.toFixed(1)))} kW`;
                break;
            }

            this.updateSensor(sensor.id, {
              value: newValue,
              lastUpdate: "Just now",
            });
          }
        }
      });
    }, 10000); // Update every 10 seconds
  }
}

// Global sensor service instance
export const sensorService = new SensorService();
