// IoT Sensor Extension using Autodesk DataVisualization API
// This replaces the custom Three.js implementation with the official APS DataVisualization extension

declare global {
  interface Window {
    Autodesk: any;
    THREE: any;
  }
  var Autodesk: any;
  var THREE: any;
}

interface SensorData {
  id: string;
  name: string;
  type: string;
  position: { x: number; y: number; z: number };
  modelPosition?: { x: number; y: number; z: number };
  status: "active" | "inactive" | "warning" | "error";
  value?: number;
  unit?: string;
  timestamp?: string;
  room?: string;
  description?: string;
}

interface ExtensionOptions {
  onSensorClick?: (sensorId: string) => void;
  onSensorPlaced?: (sensor: SensorData) => void;
  onError?: (error: string) => void;
}

// Define sensor type to color mapping
const SENSOR_COLORS = {
  Temperature: 0xff4444,
  CO2: 0x44ff44,
  Light: 0xffff44,
  Humidity: 0x4444ff,
  "Seismic and accelerometric": 0xff44ff,
  "Energy consuption": 0x44ffff,
  default: 0x888888,
};

// Define sensor type to icon mapping
const SENSOR_ICONS = {
  Temperature: "T",
  CO2: "C",
  Light: "L",
  Humidity: "H",
  "Seismic and accelerometric": "S",
  "Energy consuption": "E",
  default: "•",
};

// Base extension class for when Autodesk.Viewing.Extension is not available
class BaseExtension {
  viewer: any;
  constructor(viewer: any, options?: any) {
    this.viewer = viewer;
  }
  load(): boolean {
    return true;
  }
  unload(): boolean {
    return true;
  }
}

// Get the extension base class or fallback
const ExtensionBase =
  (globalThis as any)?.Autodesk?.Viewing?.Extension || BaseExtension;

export class IoTSensorExtension extends ExtensionBase {
  private viewer: any;
  private dataVizExt: any = null;
  private viewableData: any = null;
  private sensors: Map<string, any> = new Map();
  private sensorStyles: Map<string, any> = new Map();
  private currentInsertInfo: any = null;
  private isInsertMode: boolean = false;
  private options: ExtensionOptions = {};
  private selectedSensorId: string | null = null;
  private keydownHandler: ((event: KeyboardEvent) => void) | null = null;
  private clickHandler: ((event: MouseEvent) => void) | null = null;

  constructor(viewer: any, options?: ExtensionOptions) {
    super(viewer, options);
    this.viewer = viewer;
    this.options = options || {};
  }

  async load(): Promise<boolean> {
    try {
      // Wait for viewer to be ready
      if (!this.isViewerReady()) {
        await this.waitForViewerReady();
      }

      // Load the DataVisualization extension
      this.dataVizExt = await this.viewer.loadExtension(
        "Autodesk.DataVisualization",
      );

      if (!this.dataVizExt) {
        throw new Error("Failed to load DataVisualization extension");
      }

      // Initialize styles and viewable data
      this.initializeSensorStyles();
      this.initializeViewableData();

      // Set up event listeners
      this.setupEventListeners();

      console.log("IoT Sensor Extension loaded successfully");
      return true;
    } catch (error) {
      console.error("Error loading IoT Sensor Extension:", error);

      // Try to provide more specific error information
      let errorMessage = "Unknown error";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      }

      if (this.options.onError) {
        this.options.onError(`Failed to load extension: ${errorMessage}`);
      }
      return false;
    }
  }

  unload(): boolean {
    try {
      // Clear all sensors
      this.clearAllSensors();

      // Remove event listeners
      this.removeEventListeners();

      // Unload DataVisualization extension
      if (this.dataVizExt) {
        this.viewer.unloadExtension("Autodesk.DataVisualization");
        this.dataVizExt = null;
      }

      console.log("IoT Sensor Extension unloaded");
      return true;
    } catch (error) {
      console.error("Error unloading IoT Sensor Extension:", error);
      return false;
    }
  }

  private isViewerReady(): boolean {
    return (
      this.viewer &&
      this.viewer.model &&
      this.viewer.model.isLoadDone() &&
      (globalThis as any).THREE !== undefined
    );
  }

  private async waitForViewerReady(): Promise<void> {
    return new Promise((resolve) => {
      const checkReady = () => {
        if (this.isViewerReady()) {
          resolve();
        } else {
          setTimeout(checkReady, 100);
        }
      };
      checkReady();
    });
  }

  private initializeSensorStyles(): void {
    if (!this.dataVizExt || !(globalThis as any).THREE) return;

    const DataVizCore = (globalThis as any).Autodesk.DataVisualization.Core;

    // Create styles for each sensor type
    Object.keys(SENSOR_COLORS).forEach((sensorType) => {
      if (sensorType === "default") return;

      const color = new (globalThis as any).THREE.Color(
        SENSOR_COLORS[sensorType as keyof typeof SENSOR_COLORS],
      );

      // Create a simple sprite style
      const style = new DataVizCore.ViewableStyle(
        DataVizCore.ViewableType.SPRITE,
        color,
        this.createSensorIconDataURL(
          sensorType,
          `#${SENSOR_COLORS[sensorType as keyof typeof SENSOR_COLORS].toString(16).padStart(6, "0")}`,
        ),
      );

      this.sensorStyles.set(sensorType, style);
    });

    // Default style
    const defaultColor = new (globalThis as any).THREE.Color(
      SENSOR_COLORS.default,
    );
    const defaultStyle = new DataVizCore.ViewableStyle(
      DataVizCore.ViewableType.SPRITE,
      defaultColor,
      this.createSensorIconDataURL(
        "default",
        `#${SENSOR_COLORS.default.toString(16).padStart(6, "0")}`,
      ),
    );
    this.sensorStyles.set("default", defaultStyle);
  }

  private createSensorIconDataURL(
    sensorType: string,
    colorHex: string,
  ): string {
    try {
      const icon =
        SENSOR_ICONS[sensorType as keyof typeof SENSOR_ICONS] ||
        SENSOR_ICONS.default;

      // Ensure icon is a simple character to avoid encoding issues
      const safeIcon = icon.charAt(0) || "•";
      const svg = `
        <svg width="32" height="32" xmlns="http://www.w3.org/2000/svg">
          <circle cx="16" cy="16" r="14" fill="${colorHex}" stroke="white" stroke-width="2"/>
          <text x="16" y="20" text-anchor="middle" font-size="16" fill="white">${safeIcon}</text>
        </svg>
      `;

      // Use encodeURIComponent instead of btoa to handle Unicode characters
      return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    } catch (error) {
      console.warn("Error creating sensor icon:", error);
      // Return a simple fallback icon
      const fallbackSvg = `
        <svg width="32" height="32" xmlns="http://www.w3.org/2000/svg">
          <circle cx="16" cy="16" r="14" fill="${colorHex}" stroke="white" stroke-width="2"/>
          <circle cx="16" cy="16" r="4" fill="white"/>
        </svg>
      `;
      return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(fallbackSvg)}`;
    }
  }

  private initializeViewableData(): void {
    if (!this.dataVizExt) return;

    const DataVizCore = (globalThis as any).Autodesk.DataVisualization.Core;
    this.viewableData = new DataVizCore.ViewableData();
    this.viewableData.spriteSize = 24; // 24x24 pixel sprites
  }

  private setupEventListeners(): void {
    if (!this.viewer) return;

    // Set up click event listener for sensor selection
    this.viewer.addEventListener(
      (globalThis as any).Autodesk.Viewing.SELECTION_CHANGED_EVENT,
      this.onSelectionChanged.bind(this),
    );

    // Set up click event for placement mode
    this.viewer.addEventListener(
      (globalThis as any).Autodesk.Viewing.VIEWER_STATE_RESTORED_EVENT,
      this.onViewerStateRestored.bind(this),
    );

    // Set up ESC key handler for exiting insert mode
    this.keydownHandler = this.onKeyDown.bind(this);
    document.addEventListener("keydown", this.keydownHandler);
  }

  private removeEventListeners(): void {
    if (!this.viewer) return;

    this.viewer.removeEventListener(
      (globalThis as any).Autodesk.Viewing.SELECTION_CHANGED_EVENT,
      this.onSelectionChanged.bind(this),
    );
    this.viewer.removeEventListener(
      (globalThis as any).Autodesk.Viewing.VIEWER_STATE_RESTORED_EVENT,
      this.onViewerStateRestored.bind(this),
    );

    // Remove ESC key handler
    if (this.keydownHandler) {
      document.removeEventListener("keydown", this.keydownHandler);
      this.keydownHandler = null;
    }

    // Remove click handler if active
    this.removeClickHandler();
  }

  private onSelectionChanged(event: any): void {
    // Handle sensor selection from DataVisualization extension
    if (event && event.selections && event.selections.length > 0) {
      const dbIds = event.selections[0].dbIds;
      if (dbIds && dbIds.length > 0) {
        // Check if selected object is a sensor
        const sensorId = this.getSensorIdByDbId(dbIds[0]);
        if (sensorId && this.options.onSensorClick) {
          this.options.onSensorClick(sensorId);
        }
      }
    }
  }

  private onViewerStateRestored(): void {
    // Re-render sensors if needed
    this.refreshSensorDisplay();
  }

  private onKeyDown(event: KeyboardEvent): void {
    // Handle ESC key to exit insert mode
    if (event.key === "Escape" && this.isInsertMode) {
      console.log("ESC key pressed - exiting insert mode");
      this.exitInsertMode();
      event.preventDefault();
      event.stopPropagation();
    }
  }

  private getSensorIdByDbId(dbId: number): string | null {
    for (const [sensorId, viewable] of this.sensors.entries()) {
      if (viewable && viewable.dbId === dbId) {
        return sensorId;
      }
    }
    return null;
  }

  public async loadAllSensors(): Promise<void> {
    // This method can be called to reload all sensors
    this.refreshSensorDisplay();
  }

  public addSensor(sensorData: SensorData): void {
    if (!this.dataVizExt || !this.viewableData || !(globalThis as any).THREE) {
      console.warn("DataVisualization extension not ready");
      return;
    }

    try {
      if (this.sensors.has(sensorData.id)) {
        this.updateSensor(sensorData);
        return;
      }

      const DataVizCore = (globalThis as any).Autodesk.DataVisualization.Core;

      // Get or create style for this sensor type
      const style =
        this.sensorStyles.get(sensorData.type) ||
        this.sensorStyles.get("default");

      // Create position vector
      const position = sensorData.modelPosition || sensorData.position;
      const positionVector = new (globalThis as any).THREE.Vector3(
        position.x,
        position.y,
        position.z,
      );

      // Generate unique dbId for this sensor
      const dbId = this.generateDbId();

      // Create sprite viewable
      const spriteViewable = new DataVizCore.SpriteViewable(
        positionVector,
        style,
        dbId,
      );

      // Store additional data
      spriteViewable.userData = {
        sensorId: sensorData.id,
        sensorType: sensorData.type,
        sensorData: sensorData,
        isSensor: true,
      };

      // Add to viewable data
      this.viewableData.addViewable(spriteViewable);
      this.sensors.set(sensorData.id, spriteViewable);

      // Refresh display
      this.refreshSensorDisplay();

      console.log(`Added sensor: ${sensorData.name} at position:`, position);
    } catch (error) {
      console.error("Error adding sensor:", error);
      if (this.options.onError) {
        this.options.onError(`Failed to add sensor: ${error}`);
      }
    }
  }

  public updateSensor(sensorData: SensorData): void {
    if (!this.sensors.has(sensorData.id)) {
      this.addSensor(sensorData);
      return;
    }

    try {
      const spriteViewable = this.sensors.get(sensorData.id);
      if (spriteViewable) {
        // Update position if changed
        const position = sensorData.modelPosition || sensorData.position;
        spriteViewable.position.set(position.x, position.y, position.z);

        // Update user data
        spriteViewable.userData.sensorData = sensorData;

        // Update style if sensor type changed
        if (spriteViewable.userData.sensorType !== sensorData.type) {
          const newStyle =
            this.sensorStyles.get(sensorData.type) ||
            this.sensorStyles.get("default");
          spriteViewable.style = newStyle;
          spriteViewable.userData.sensorType = sensorData.type;
        }

        this.refreshSensorDisplay();
      }
    } catch (error) {
      console.error("Error updating sensor:", error);
    }
  }

  public removeSensor(sensorId: string): void {
    if (!this.sensors.has(sensorId)) return;

    try {
      const spriteViewable = this.sensors.get(sensorId);
      if (spriteViewable && this.viewableData) {
        this.viewableData.removeViewable(spriteViewable);
        this.sensors.delete(sensorId);
        this.refreshSensorDisplay();

        if (this.selectedSensorId === sensorId) {
          this.selectedSensorId = null;
        }
      }
    } catch (error) {
      console.error("Error removing sensor:", error);
    }
  }

  public selectSensor(sensorId: string | null): void {
    this.selectedSensorId = sensorId;

    if (sensorId && this.sensors.has(sensorId)) {
      const spriteViewable = this.sensors.get(sensorId);
      if (spriteViewable) {
        // Focus on the sensor
        this.focusOnSensor(spriteViewable);
      }
    }
  }

  public clearAllSensors(): void {
    try {
      this.sensors.clear();
      this.selectedSensorId = null;

      if (this.viewableData) {
        this.viewableData.clearViewables();
        this.refreshSensorDisplay();
      }
    } catch (error) {
      console.error("Error clearing sensors:", error);
    }
  }

  public enterInsertMode(sensorType: string): void {
    if (this.isInsertMode) {
      console.log("Already in insert mode, exiting first");
      this.exitInsertMode();
    }

    this.isInsertMode = true;
    this.currentInsertInfo = { sensorType };

    // Enable click-to-place functionality using container click event
    this.clickHandler = this.onViewerClick.bind(this);
    this.viewer.container.addEventListener("click", this.clickHandler);

    console.log(`Entered insert mode for ${sensorType} sensors`);
  }

  public exitInsertMode(): void {
    if (!this.isInsertMode) {
      console.log("Not in insert mode, nothing to exit");
      return;
    }

    this.isInsertMode = false;
    this.currentInsertInfo = null;

    // Disable click-to-place functionality
    this.removeClickHandler();

    console.log("Exited insert mode");
  }

  private removeClickHandler(): void {
    if (this.clickHandler && this.viewer && this.viewer.container) {
      this.viewer.container.removeEventListener("click", this.clickHandler);
      this.clickHandler = null;
      console.log("Click handler removed");
    }
  }

  private onViewerClick(event: MouseEvent): void {
    if (!this.isInsertMode || !this.currentInsertInfo) return;

    // Prevent default behavior to avoid conflicts
    event.preventDefault();
    event.stopPropagation();

    try {
      console.log("Viewer click detected in insert mode", event);
      const point = this.getIntersectionPoint(event);
      if (point) {
        console.log("Intersection point found:", point);
        this.placeSensorAtPoint(point);
      } else {
        console.log("No intersection point found");
      }
    } catch (error) {
      console.error("Error placing sensor:", error);
    }
  }

  private getIntersectionPoint(event: MouseEvent): any | null {
    if (!event || !this.viewer) return null;

    try {
      const clientX = event.clientX;
      const clientY = event.clientY;

      console.log("Click coordinates:", { clientX, clientY });

      // Use Forge Viewer's built-in method to get world coordinates
      const result = this.viewer.clientToWorld(clientX, clientY, true);

      if (result && result.point) {
        console.log("World intersection point:", result.point);
        return result.point;
      } else {
        console.log("No intersection found with clientToWorld");
        return null;
      }
    } catch (error) {
      console.warn("Could not get intersection point:", error);
    }

    return null;
  }

  private placeSensorAtPoint(point: any): void {
    if (!this.currentInsertInfo) return;

    console.log("Placing sensor at point:", point);

    const sensorData: SensorData = {
      id: this.generateSensorId(),
      name: `${this.currentInsertInfo.sensorType} Sensor`,
      type: this.currentInsertInfo.sensorType,
      position: { x: point.x, y: point.y, z: point.z },
      status: "active",
      timestamp: new Date().toISOString(),
    };

    console.log("Sensor placed successfully:", sensorData);

    // Call the callback first to let the context handle the sensor creation
    if (this.options.onSensorPlaced) {
      this.options.onSensorPlaced(sensorData);
    } else {
      // Fallback: add sensor directly if no callback
      this.addSensor(sensorData);
    }

    // Exit insert mode after placing sensor
    this.exitInsertMode();
  }

  private generateSensorId(): string {
    return `sensor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateDbId(): number {
    // Generate a unique dbId for the sprite viewable
    return Math.floor(Math.random() * 1000000) + 100000;
  }

  private focusOnSensor(spriteViewable: any): void {
    if (!spriteViewable || !this.viewer) return;

    try {
      const position = spriteViewable.position;
      const boundingBox = new (
        globalThis as any
      ).THREE.Box3().setFromCenterAndSize(
        position,
        new (globalThis as any).THREE.Vector3(10, 10, 10),
      );

      this.viewer.navigation.fitBounds(false, boundingBox);
    } catch (error) {
      console.error("Error focusing on sensor:", error);
    }
  }

  private refreshSensorDisplay(): void {
    if (!this.dataVizExt || !this.viewableData) return;

    try {
      // Render the viewable data
      this.dataVizExt.renderViewables(this.viewableData);
    } catch (error) {
      console.error("Error refreshing sensor display:", error);
    }
  }

  public getSensorCount(): number {
    return this.sensors.size;
  }

  public getSensorIds(): string[] {
    return Array.from(this.sensors.keys());
  }

  public getSensorPosition(
    sensorId: string,
  ): { x: number; y: number; z: number } | null {
    const spriteViewable = this.sensors.get(sensorId);
    if (spriteViewable && spriteViewable.position) {
      return {
        x: spriteViewable.position.x,
        y: spriteViewable.position.y,
        z: spriteViewable.position.z,
      };
    }
    return null;
  }

  public highlightSensorsOfType(sensorType: string, highlight: boolean): void {
    this.sensors.forEach((spriteViewable, sensorId) => {
      if (
        spriteViewable.userData &&
        spriteViewable.userData.sensorType === sensorType
      ) {
        // You can implement highlighting logic here
        // For example, change the sprite style or add an outline
      }
    });
  }

  public setSensorVisibility(sensorType: string, visible: boolean): void {
    this.sensors.forEach((spriteViewable, sensorId) => {
      if (
        spriteViewable.userData &&
        spriteViewable.userData.sensorType === sensorType
      ) {
        spriteViewable.visible = visible;
      }
    });
    this.refreshSensorDisplay();
  }
}

// Export for registration
export default IoTSensorExtension;
