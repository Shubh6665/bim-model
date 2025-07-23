// app/components/forge-iot-extension.ts

declare global {
  var Autodesk: any;
  var THREE: any;
}

interface SensorData {
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
}

interface ExtensionOptions {
  onSensorClick?: (sensorId: string) => void;
  onSensorPlaced?: (sensor: SensorData) => void;
  onError?: (error: string) => void;
}

export class IoTSensorExtension extends (globalThis.Autodesk?.Viewing
  ?.Extension || class {}) {
  private viewer: any;
  private sensors: Map<string, any> = new Map();
  private sensorMaterials: Map<string, any> = new Map();
  private currentInsertInfo: { sensorType: string } | null = null;
  private isInsertMode: boolean = false;
  private raycaster: any;
  private mouse: any;
  private options: ExtensionOptions;
  private selectedSensorId: string | null = null;
  private overlayScene: any;
  private overlayRenderer: any;
  private overlayCamera: any;

  constructor(viewer: any, options: ExtensionOptions = {}) {
    super(viewer, options);
    this.viewer = viewer;
    this.options = options;
    this.sensors = new Map();
    this.sensorMaterials = new Map();
    this.currentInsertInfo = null;
    this.isInsertMode = false;
    this.selectedSensorId = null;

    // Bind methods
    this._onMouseClick = this._onMouseClick.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);

    this.initializeMaterials();
  }

  async load() {
    console.log("Enhanced IoTSensorExtension loaded.");

    // Wait for viewer to be fully ready
    if (!this.isViewerReady()) {
      console.warn("Viewer not ready for IoT extension");
      return false;
    }

    // Setup overlay scene for sensors
    this.setupOverlayScene();

    // Load existing sensors
    await this.loadAllSensors();

    // Add event listeners
    this.viewer.addEventListener(
      globalThis.Autodesk?.Viewing?.CAMERA_CHANGE_EVENT,
      this.onCameraChange.bind(this),
    );

    return true;
  }

  unload() {
    console.log("IoTSensorExtension unloaded.");

    // Remove all sensors from scene
    this.clearAllSensors();

    // Remove event listeners
    this.exitInsertMode();
    this.viewer.removeEventListener(
      globalThis.Autodesk?.Viewing?.CAMERA_CHANGE_EVENT,
      this.onCameraChange.bind(this),
    );

    // Cleanup overlay
    if (this.overlayScene && this.overlayScene !== this.viewer.impl.scene) {
      try {
        if (
          this.viewer.impl.overlayScenes &&
          typeof this.viewer.impl.overlayScenes.removeScene === "function"
        ) {
          this.viewer.impl.overlayScenes.removeScene("iot-sensors");
        }
      } catch (error) {
        console.warn("Could not remove overlay scene:", error);
      }
    }

    return true;
  }

  private isViewerReady(): boolean {
    return !!(
      this.viewer &&
      this.viewer.impl &&
      this.viewer.impl.canvas &&
      this.viewer.impl.scene
    );
  }

  private initializeMaterials() {
    if (!globalThis.THREE) return;

    // Define materials for different sensor types and states
    const materialConfigs = {
      Temperature: { color: 0xef4444, name: "Temperature" },
      CO2: { color: 0xeab308, name: "CO2" },
      Light: { color: 0xf59e0b, name: "Light" },
      Humidity: { color: 0x3b82f6, name: "Humidity" },
      "Seismic and accelerometric": { color: 0xa855f7, name: "Seismic" },
      "Energy consuption": { color: 0x22c55e, name: "Energy" },
    };

    Object.entries(materialConfigs).forEach(([type, config]) => {
      // Normal state
      this.sensorMaterials.set(
        `${type}_normal`,
        new globalThis.THREE.MeshBasicMaterial({
          color: config.color,
          transparent: true,
          opacity: 0.8,
          side: globalThis.THREE.DoubleSide,
        }),
      );

      // Selected state
      this.sensorMaterials.set(
        `${type}_selected`,
        new globalThis.THREE.MeshBasicMaterial({
          color: config.color,
          transparent: true,
          opacity: 1.0,
          side: globalThis.THREE.DoubleSide,
        }),
      );

      // Offline state
      this.sensorMaterials.set(
        `${type}_offline`,
        new globalThis.THREE.MeshBasicMaterial({
          color: 0x6b7280,
          transparent: true,
          opacity: 0.5,
          side: globalThis.THREE.DoubleSide,
        }),
      );

      // Warning state
      this.sensorMaterials.set(
        `${type}_warning`,
        new globalThis.THREE.MeshBasicMaterial({
          color: 0xfbbf24,
          transparent: true,
          opacity: 0.9,
          side: globalThis.THREE.DoubleSide,
          emissive: 0x332200,
        }),
      );
    });
  }

  private setupOverlayScene() {
    if (!this.viewer?.impl || !globalThis.THREE) return;

    try {
      // Create overlay scene for sensors - use main scene if overlay not available
      this.overlayScene = new globalThis.THREE.Scene();

      // Try to add overlay scene if supported
      if (this.viewer.impl.createOverlayScene) {
        this.overlayScene = this.viewer.impl.createOverlayScene("iot-sensors");
      } else if (
        this.viewer.impl.overlayScenes &&
        typeof this.viewer.impl.overlayScenes.addScene === "function"
      ) {
        this.viewer.impl.overlayScenes.addScene(
          "iot-sensors",
          this.overlayScene,
        );
      } else {
        // Fallback: use main scene
        this.overlayScene = this.viewer.impl.scene;
        console.log("Using main scene for sensors (overlay not supported)");
      }
    } catch (error) {
      console.warn("Could not setup overlay scene:", error);
      // Fallback to main scene
      this.overlayScene = this.viewer.impl.scene;
    }
  }

  async loadAllSensors() {
    try {
      // In a real application, this would fetch from the API
      // For now, we'll work with the sensor context data
      console.log("IoT Extension ready to receive sensor data");
    } catch (error) {
      console.error("Error loading sensors:", error);
      this.options.onError?.("Failed to load sensors");
    }
  }

  public addSensor(sensorData: SensorData) {
    if (this.sensors.has(sensorData.id)) {
      this.updateSensor(sensorData);
      return;
    }

    const sensorMesh = this.createSensorMesh(sensorData);
    if (sensorMesh) {
      this.sensors.set(sensorData.id, sensorMesh);

      // Add to overlay scene if available, otherwise to main scene
      const targetScene = this.overlayScene || this.viewer.impl.scene;
      targetScene.add(sensorMesh);

      console.log(
        `Added sensor: ${sensorData.name} at position:`,
        sensorData.position,
      );
    }
  }

  public updateSensor(sensorData: SensorData) {
    const sensorMesh = this.sensors.get(sensorData.id);
    if (!sensorMesh) return;

    // Update material based on status and selection
    const material = this.getSensorMaterial(
      sensorData.type,
      sensorData.status,
      sensorData.id === this.selectedSensorId,
    );
    sensorMesh.material = material;

    // Update position if changed
    if (sensorData.modelPosition) {
      sensorMesh.position.set(
        sensorData.modelPosition.x,
        sensorData.modelPosition.y,
        sensorData.modelPosition.z,
      );
    }

    // Update user data
    sensorMesh.userData = {
      sensorId: sensorData.id,
      sensorType: sensorData.type,
      sensorData: sensorData,
    };
  }

  public removeSensor(sensorId: string) {
    const sensorMesh = this.sensors.get(sensorId);
    if (sensorMesh) {
      const targetScene = this.overlayScene || this.viewer.impl.scene;
      targetScene.remove(sensorMesh);
      this.sensors.delete(sensorId);

      if (this.selectedSensorId === sensorId) {
        this.selectedSensorId = null;
      }
    }
  }

  public selectSensor(sensorId: string | null) {
    // Clear previous selection
    if (this.selectedSensorId) {
      const prevSensor = this.sensors.get(this.selectedSensorId);
      if (prevSensor && prevSensor.userData.sensorData) {
        const material = this.getSensorMaterial(
          prevSensor.userData.sensorData.type,
          prevSensor.userData.sensorData.status,
          false,
        );
        prevSensor.material = material;
      }
    }

    // Set new selection
    this.selectedSensorId = sensorId;
    if (sensorId) {
      const sensor = this.sensors.get(sensorId);
      if (sensor && sensor.userData.sensorData) {
        const material = this.getSensorMaterial(
          sensor.userData.sensorData.type,
          sensor.userData.sensorData.status,
          true,
        );
        sensor.material = material;

        // Focus camera on sensor
        this.focusOnSensor(sensorId);
      }
    }
  }

  public clearAllSensors() {
    const targetScene = this.overlayScene || this.viewer.impl.scene;
    this.sensors.forEach((sensorMesh) => {
      targetScene.remove(sensorMesh);
    });
    this.sensors.clear();
    this.selectedSensorId = null;
  }

  private createSensorMesh(sensorData: SensorData) {
    if (!globalThis.THREE) return null;

    try {
      // Create sphere geometry for sensor
      const geometry = new globalThis.THREE.SphereGeometry(2, 16, 16);
      const material = this.getSensorMaterial(
        sensorData.type,
        sensorData.status,
        false,
      );

      const sensorMesh = new globalThis.THREE.Mesh(geometry, material);

      // Set position
      const position = sensorData.modelPosition || sensorData.position;
      sensorMesh.position.set(position.x, position.y, position.z);

      // Store sensor data
      sensorMesh.userData = {
        sensorId: sensorData.id,
        sensorType: sensorData.type,
        sensorData: sensorData,
        isSensor: true,
      };

      return sensorMesh;
    } catch (error) {
      console.error("Error creating sensor mesh:", error);
      return null;
    }
  }

  private getSensorMaterial(
    sensorType: string,
    status: string,
    isSelected: boolean,
  ) {
    let materialKey = `${sensorType}_normal`;

    if (isSelected) {
      materialKey = `${sensorType}_selected`;
    } else if (status === "Offline") {
      materialKey = `${sensorType}_offline`;
    } else if (status === "Warning") {
      materialKey = `${sensorType}_warning`;
    }

    return (
      this.sensorMaterials.get(materialKey) ||
      this.sensorMaterials.get("Temperature_normal")
    );
  }

  public enterInsertMode(sensorType: string) {
    if (!this.viewer || !this.viewer.impl || !this.viewer.impl.canvas) {
      console.warn("Cannot enter insert mode: viewer not ready");
      return;
    }

    this.currentInsertInfo = { sensorType };
    this.isInsertMode = true;

    // Add event listeners for insertion - use capture to intercept before Forge handlers
    const canvas = this.viewer.impl.canvas;
    canvas.addEventListener("click", this._onMouseClick, {
      capture: true,
      passive: false,
    });
    canvas.addEventListener("mousemove", this._onMouseMove, {
      capture: true,
      passive: true,
    });
    document.addEventListener("keydown", this._onKeyDown);

    // Change cursor
    canvas.style.cursor = "crosshair";

    // Disable Forge's default selection to prevent conflicts
    if (this.viewer.setDefaultNavigationTool) {
      this.viewer.setDefaultNavigationTool("dolly");
    }

    console.log(`Insert mode activated for ${sensorType} sensor`);
  }

  public exitInsertMode() {
    if (!this.isInsertMode) return;

    this.currentInsertInfo = null;
    this.isInsertMode = false;

    // Remove event listeners safely
    if (this.viewer && this.viewer.impl && this.viewer.impl.canvas) {
      const canvas = this.viewer.impl.canvas;
      canvas.removeEventListener("click", this._onMouseClick, true);
      canvas.removeEventListener("mousemove", this._onMouseMove, true);
      document.removeEventListener("keydown", this._onKeyDown);

      // Reset cursor
      canvas.style.cursor = "default";

      // Re-enable default navigation
      if (this.viewer.setDefaultNavigationTool) {
        this.viewer.setDefaultNavigationTool("orbit");
      }
    }

    console.log("Insert mode deactivated");
  }

  private _onMouseClick(event: MouseEvent) {
    if (!this.isInsertMode || !this.currentInsertInfo) return;

    // Prevent default behavior and stop propagation to avoid Forge conflicts
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const intersectionPoint = this.getIntersectionPoint(event);
    if (intersectionPoint) {
      this.placeSensorAtPoint(
        intersectionPoint,
        this.currentInsertInfo.sensorType,
      );
    }
  }

  private _onMouseMove(event: MouseEvent) {
    if (!this.isInsertMode || !this.viewer) return;
    // Mouse tracking for visual feedback if needed
  }

  private _onKeyDown(event: KeyboardEvent) {
    if (!this.isInsertMode) return;

    // Exit insert mode on Escape key
    if (event.key === "Escape") {
      this.exitInsertMode();
    }
  }

  private getIntersectionPoint(
    event: MouseEvent,
  ): { x: number; y: number; z: number } | null {
    if (!this.isViewerReady()) return null;

    try {
      const rect = this.viewer.impl.canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      // Simple placement strategy - use viewer bounds for consistent placement
      let basePosition = { x: 0, y: 0, z: 0 };

      try {
        const bounds = this.viewer.model?.getBoundingBox();
        if (bounds) {
          // Use getCenter() instead of deprecated center()
          const center = bounds.getCenter
            ? bounds.getCenter()
            : bounds.center();
          basePosition = { x: center.x, y: center.y, z: center.z };
        } else if (this.viewer.navigation?.getTarget) {
          const target = this.viewer.navigation.getTarget();
          basePosition = { x: target.x, y: target.y, z: target.z };
        }
      } catch (error) {
        console.warn(
          "Could not get model bounds, using default position:",
          error,
        );
        // Use a safe default
        basePosition = { x: 0, y: 0, z: 0 };
      }

      // Add offset based on mouse position for variety
      const offsetMultiplier = 50;
      const xOffset = (x / rect.width - 0.5) * offsetMultiplier;
      const zOffset = (y / rect.height - 0.5) * offsetMultiplier;

      return {
        x: basePosition.x + xOffset,
        y: basePosition.y + 5, // Slight elevation
        z: basePosition.z + zOffset,
      };
    } catch (error) {
      console.error("Error getting intersection point:", error);
      // Return a safe default position with random offset
      const offset = (Math.random() - 0.5) * 40;
      return { x: offset, y: 5, z: offset };
    }
  }

  private placeSensorAtPoint(
    position: { x: number; y: number; z: number },
    sensorType: string,
  ) {
    try {
      // Create new sensor data
      const newSensor: SensorData = {
        id: this.generateSensorId(),
        name: `${sensorType} Sensor ${this.sensors.size + 1}`,
        type: sensorType,
        status: "Online",
        value: this.getDefaultValue(sensorType),
        position: position,
        modelPosition: position,
        batteryLevel: 100,
        lastUpdate: "Just now",
        room: "Unknown Room",
      };

      // Add sensor to the extension
      this.addSensor(newSensor);

      // Notify parent component
      this.options.onSensorPlaced?.(newSensor);

      // Exit insert mode
      this.exitInsertMode();

      console.log(`Sensor placed successfully:`, newSensor);
    } catch (error) {
      console.error("Error placing sensor:", error);
      this.options.onError?.("Failed to place sensor");
    }
  }

  private getDefaultValue(sensorType: string): string {
    const defaults: { [key: string]: string } = {
      Temperature: "20.0°C",
      CO2: "400 ppm",
      Light: "500 lux",
      Humidity: "45%",
      "Seismic and accelerometric": "0.01g",
      "Energy consuption": "1.2 kW",
    };
    return defaults[sensorType] || "0";
  }

  private generateSensorId(): string {
    return `sensor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private focusOnSensor(sensorId: string) {
    const sensor = this.sensors.get(sensorId);
    if (!sensor || !this.viewer.navigation) return;

    try {
      const position = sensor.position;
      const target = new globalThis.THREE.Vector3(
        position.x,
        position.y,
        position.z,
      );

      // Move camera to focus on sensor
      this.viewer.navigation.setWorldPoint(target);
      this.viewer.fitToView([sensor]);
    } catch (error) {
      console.warn("Could not focus on sensor:", error);
    }
  }

  private onCameraChange() {
    // Update sensor visibility or LOD based on camera distance
    this.updateSensorLOD();
  }

  private updateSensorLOD() {
    if (!this.viewer.impl.camera) return;

    const cameraPosition = this.viewer.impl.camera.position;

    this.sensors.forEach((sensorMesh, sensorId) => {
      const distance = cameraPosition.distanceTo(sensorMesh.position);

      // Adjust sensor size based on distance
      const scale = Math.max(0.5, Math.min(2.0, 100 / distance));
      sensorMesh.scale.set(scale, scale, scale);
    });
  }

  // Public API methods for external interaction
  public getSensorCount(): number {
    return this.sensors.size;
  }

  public getSensorIds(): string[] {
    return Array.from(this.sensors.keys());
  }

  public getSensorPosition(
    sensorId: string,
  ): { x: number; y: number; z: number } | null {
    const sensor = this.sensors.get(sensorId);
    if (sensor) {
      return {
        x: sensor.position.x,
        y: sensor.position.y,
        z: sensor.position.z,
      };
    }
    return null;
  }

  public highlightSensorsOfType(sensorType: string, highlight: boolean) {
    this.sensors.forEach((sensorMesh, sensorId) => {
      if (sensorMesh.userData.sensorType === sensorType) {
        const sensorData = sensorMesh.userData.sensorData;
        if (sensorData) {
          const material = this.getSensorMaterial(
            sensorData.type,
            sensorData.status,
            highlight || sensorId === this.selectedSensorId,
          );
          sensorMesh.material = material;
        }
      }
    });
  }

  public setSensorVisibility(sensorType: string, visible: boolean) {
    this.sensors.forEach((sensorMesh) => {
      if (sensorMesh.userData.sensorType === sensorType) {
        sensorMesh.visible = visible;
      }
    });
  }
}

// Extension registration
if (globalThis.Autodesk?.Viewing?.theExtensionManager) {
  globalThis.Autodesk.Viewing.theExtensionManager.registerExtension(
    "IoTSensorExtension",
    IoTSensorExtension,
  );
}
