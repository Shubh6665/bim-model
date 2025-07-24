// Autodesk Forge Data Visualization & Sprites Extension
// Complete implementation following the Hindi-English descriptive API guide

declare global {
  interface Window {
    Autodesk: any;
    THREE: any;
  }
  var Autodesk: any;
  var THREE: any;
}

interface SpriteData {
  id?: string;
  dbId?: number;
  position: { x: number; y: number; z: number };
  style: {
    color?: string;
    url?: string;
    scale?: number;
  };
  name?: string;
  tooltip?: {
    enabled: boolean;
    html: string;
  };
  type?: string;
  status?: "active" | "inactive" | "warning" | "error";
  value?: number;
  unit?: string;
  room?: string;
  timestamp?: string;
}

interface DataVizOptions {
  onSpriteClick?: (spriteId: string, spriteData: SpriteData) => void;
  onSpritePlaced?: (spriteData: SpriteData) => void;
  onSpriteHover?: (spriteId: string, spriteData: SpriteData) => void;
  onError?: (error: string) => void;
  enableDragDrop?: boolean;
  dragDropConfig?: {
    allowedTypes: string[];
    dropZoneSelector?: string;
  };
}

// Sensor type configurations
const SENSOR_CONFIGS = {
  Temperature: {
    color: "#FF4444",
    icon: "🌡️",
    unit: "°C",
    iconUrl:
      "data:image/svg+xml;base64," +
      btoa(`
      <svg width="32" height="32" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="14" fill="#FF4444" stroke="white" stroke-width="2"/>
        <text x="16" y="20" text-anchor="middle" font-size="12" fill="white">T</text>
      </svg>
    `),
  },
  CO2: {
    color: "#44FF44",
    icon: "🌿",
    unit: "ppm",
    iconUrl:
      "data:image/svg+xml;base64," +
      btoa(`
      <svg width="32" height="32" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="14" fill="#44FF44" stroke="white" stroke-width="2"/>
        <text x="16" y="20" text-anchor="middle" font-size="12" fill="white">C</text>
      </svg>
    `),
  },
  Light: {
    color: "#FFFF44",
    icon: "💡",
    unit: "lux",
    iconUrl:
      "data:image/svg+xml;base64," +
      btoa(`
      <svg width="32" height="32" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="14" fill="#FFFF44" stroke="white" stroke-width="2"/>
        <text x="16" y="20" text-anchor="middle" font-size="12" fill="black">L</text>
      </svg>
    `),
  },
  Humidity: {
    color: "#4444FF",
    icon: "💧",
    unit: "%",
    iconUrl:
      "data:image/svg+xml;base64," +
      btoa(`
      <svg width="32" height="32" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="14" fill="#4444FF" stroke="white" stroke-width="2"/>
        <text x="16" y="20" text-anchor="middle" font-size="12" fill="white">H</text>
      </svg>
    `),
  },
  "Seismic and accelerometric": {
    color: "#FF44FF",
    icon: "📳",
    unit: "g",
    iconUrl:
      "data:image/svg+xml;base64," +
      btoa(`
      <svg width="32" height="32" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="14" fill="#FF44FF" stroke="white" stroke-width="2"/>
        <text x="16" y="20" text-anchor="middle" font-size="12" fill="white">S</text>
      </svg>
    `),
  },
  "Energy consuption": {
    color: "#44FFFF",
    icon: "⚡",
    unit: "kW",
    iconUrl:
      "data:image/svg+xml;base64," +
      btoa(`
      <svg width="32" height="32" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="14" fill="#44FFFF" stroke="white" stroke-width="2"/>
        <text x="16" y="20" text-anchor="middle" font-size="12" fill="black">E</text>
      </svg>
    `),
  },
};

// Base extension class
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

const ExtensionBase =
  (globalThis as any)?.Autodesk?.Viewing?.Extension || BaseExtension;

export class ForgeDataVizExtension extends ExtensionBase {
  private viewer: any;
  private dataVizExt: any = null;
  private sprites: Map<string, SpriteData> = new Map();
  private options: DataVizOptions = {};
  private isInsertMode: boolean = false;
  private currentInsertType: string | null = null;
  private visibleTypes: Set<string> = new Set();
  private selectedSpriteId: string | null = null;

  // Event handlers
  private clickHandler: ((event: MouseEvent) => void) | null = null;
  private keydownHandler: ((event: KeyboardEvent) => void) | null = null;
  private dragoverHandler: ((event: DragEvent) => void) | null = null;
  private dropHandler: ((event: DragEvent) => void) | null = null;

  constructor(viewer: any, options?: DataVizOptions) {
    super(viewer, options);
    this.viewer = viewer;
    this.options = options || {};

    // Initialize all sensor types as visible
    Object.keys(SENSOR_CONFIGS).forEach((type) => {
      this.visibleTypes.add(type);
    });
  }

  // 1. DataViz Extension शुरू करना
  async load(): Promise<boolean> {
    try {
      console.log("Loading DataViz Extension...");

      // Wait for viewer to be ready
      await this.waitForViewerReady();

      // Load Autodesk DataVisualization extension
      this.dataVizExt = await this.viewer.loadExtension(
        "Autodesk.DataVisualization",
      );

      if (!this.dataVizExt) {
        throw new Error("Failed to load Autodesk.DataVisualization extension");
      }

      console.log("DataVisualization extension loaded successfully");

      // Setup event listeners
      this.setupEventListeners();

      // Setup drag & drop if enabled
      if (this.options.enableDragDrop) {
        this.setupDragAndDrop();
      }

      return true;
    } catch (error) {
      console.error("Error loading DataViz Extension:", error);
      if (this.options.onError) {
        this.options.onError(`Failed to load extension: ${error}`);
      }
      return false;
    }
  }

  unload(): boolean {
    try {
      // Remove all sprites
      this.removeAllViewables();

      // Remove event listeners
      this.removeEventListeners();

      // Remove drag & drop handlers
      this.removeDragAndDrop();

      // Unload extension
      if (this.dataVizExt) {
        this.viewer.unloadExtension("Autodesk.DataVisualization");
        this.dataVizExt = null;
      }

      console.log("DataViz Extension unloaded");
      return true;
    } catch (error) {
      console.error("Error unloading DataViz Extension:", error);
      return false;
    }
  }

  // 2. Sprite/Icon Add करने का API
  async addViewables(
    spriteDataArray: SpriteData[],
    options: { type: string } = { type: "sprite" },
  ): Promise<boolean> {
    try {
      if (!this.dataVizExt) {
        throw new Error("DataVisualization extension not loaded");
      }

      const viewableData: any[] = [];

      spriteDataArray.forEach((spriteData, index) => {
        const id = spriteData.id || this.generateSpriteId();
        const dbId = spriteData.dbId || this.generateDbId();

        // Get sensor config
        const config = SENSOR_CONFIGS[
          spriteData.type as keyof typeof SENSOR_CONFIGS
        ] || {
          color: "#888888",
          icon: "•",
          unit: "",
          iconUrl:
            "data:image/svg+xml;base64," +
            btoa(`
            <svg width="32" height="32" xmlns="http://www.w3.org/2000/svg">
              <circle cx="16" cy="16" r="14" fill="#888888" stroke="white" stroke-width="2"/>
              <text x="16" y="20" text-anchor="middle" font-size="12" fill="white">•</text>
            </svg>
          `),
        };

        const viewableItem = {
          id: id,
          dbId: dbId,
          position: spriteData.position,
          style: {
            color: spriteData.style.color || config.color,
            url: spriteData.style.url || config.iconUrl,
            scale: spriteData.style.scale || 1.0,
          },
          name: spriteData.name || `${spriteData.type} Sensor`,
          tooltip: spriteData.tooltip || {
            enabled: true,
            html: `
              <div style="padding: 8px;">
                <strong>${spriteData.name || spriteData.type}</strong><br/>
                ${spriteData.value ? `Value: ${spriteData.value} ${config.unit}` : ""}<br/>
                ${spriteData.room ? `Room: ${spriteData.room}` : ""}<br/>
                ${spriteData.status ? `Status: ${spriteData.status}` : ""}
              </div>
            `,
          },
          type: spriteData.type,
          status: spriteData.status,
          value: spriteData.value,
          unit: spriteData.unit,
          room: spriteData.room,
          timestamp: spriteData.timestamp,
        };

        viewableData.push(viewableItem);
        this.sprites.set(id, viewableItem);
      });

      // Add sprites using DataViz extension
      await this.dataVizExt.addViewables(viewableData, { type: options.type });

      console.log(`Added ${viewableData.length} viewables`);
      return true;
    } catch (error) {
      console.error("Error adding viewables:", error);
      if (this.options.onError) {
        this.options.onError(`Failed to add sprites: ${error}`);
      }
      return false;
    }
  }

  // 3. Show/Hide Sprites API
  showHideViewables(show: boolean, occlusion: boolean = false): void {
    try {
      if (!this.dataVizExt) {
        console.warn("DataVisualization extension not loaded");
        return;
      }

      this.dataVizExt.showHideViewables(show, occlusion);
      console.log(`Sprites ${show ? "shown" : "hidden"}`);
    } catch (error) {
      console.error("Error showing/hiding viewables:", error);
    }
  }

  // 4. Remove All Sprites
  removeAllViewables(): void {
    try {
      if (!this.dataVizExt) {
        console.warn("DataVisualization extension not loaded");
        return;
      }

      this.dataVizExt.removeAllViewables();
      this.sprites.clear();
      this.selectedSpriteId = null;
      console.log("All viewables removed");
    } catch (error) {
      console.error("Error removing viewables:", error);
    }
  }

  // 5. Drag & Drop Setup
  private setupDragAndDrop(): void {
    const container = this.options.dragDropConfig?.dropZoneSelector
      ? document.querySelector(this.options.dragDropConfig.dropZoneSelector)
      : this.viewer.container;

    if (!container) {
      console.warn("Drop zone container not found");
      return;
    }

    // Prevent default drag behaviors
    this.dragoverHandler = (event: DragEvent) => {
      event.preventDefault();
      event.dataTransfer!.dropEffect = "copy";
    };

    // Handle drop events
    this.dropHandler = async (event: DragEvent) => {
      event.preventDefault();

      try {
        const sensorType =
          event.dataTransfer?.getData("sensorType") || "Temperature";
        const { x, y } = { x: event.clientX, y: event.clientY };

        // Get 3D position using hitTest
        const hitPoint = this.viewer.impl.hitTest(x, y, true);

        if (!hitPoint || !hitPoint.intersectPoint) {
          console.warn("Could not determine 3D position for drop");
          return;
        }

        // Create sprite data
        const spriteData: SpriteData = {
          position: hitPoint.intersectPoint,
          style: {},
          type: sensorType,
          name: `${sensorType} Sensor`,
          status: "active",
          room: this.getRoomFromPosition(hitPoint.intersectPoint),
          timestamp: new Date().toISOString(),
        };

        // Add the sprite
        await this.addViewables([spriteData], { type: "sprite" });

        // Notify callback
        if (this.options.onSpritePlaced) {
          this.options.onSpritePlaced(spriteData);
        }

        console.log("Sprite placed via drag & drop:", spriteData);
      } catch (error) {
        console.error("Error handling drop:", error);
      }
    };

    container.addEventListener("dragover", this.dragoverHandler);
    container.addEventListener("drop", this.dropHandler);
  }

  private removeDragAndDrop(): void {
    const container = this.options.dragDropConfig?.dropZoneSelector
      ? document.querySelector(this.options.dragDropConfig.dropZoneSelector)
      : this.viewer.container;

    if (container && this.dragoverHandler && this.dropHandler) {
      container.removeEventListener("dragover", this.dragoverHandler);
      container.removeEventListener("drop", this.dropHandler);
    }
  }

  // 6. Insert Mode for Manual Placement
  enterInsertMode(sensorType: string): void {
    this.isInsertMode = true;
    this.currentInsertType = sensorType;

    // Change cursor
    if (this.viewer && this.viewer.container) {
      this.viewer.container.style.cursor = "crosshair";
    }

    console.log(`Entered insert mode for: ${sensorType}`);
  }

  exitInsertMode(): void {
    this.isInsertMode = false;
    this.currentInsertType = null;

    // Reset cursor
    if (this.viewer && this.viewer.container) {
      this.viewer.container.style.cursor = "default";
    }

    console.log("Exited insert mode");
  }

  // 7. Sensor Type Visibility Control
  setSensorVisibility(sensorType: string, visible: boolean): void {
    if (visible) {
      this.visibleTypes.add(sensorType);
    } else {
      this.visibleTypes.delete(sensorType);
    }

    // Filter and update visible sprites
    this.updateVisibleSprites();
  }

  private updateVisibleSprites(): void {
    try {
      if (!this.dataVizExt) return;

      // Get all current viewables and filter by visibility
      const visibleSprites: any[] = [];

      this.sprites.forEach((sprite, id) => {
        if (this.visibleTypes.has(sprite.type || "")) {
          visibleSprites.push(sprite);
        }
      });

      // Remove all and re-add visible ones
      this.dataVizExt.removeAllViewables();
      if (visibleSprites.length > 0) {
        this.dataVizExt.addViewables(visibleSprites, { type: "sprite" });
      }
    } catch (error) {
      console.error("Error updating visible sprites:", error);
    }
  }

  // 8. Event Handling
  private setupEventListeners(): void {
    // Click handler for sprite interaction
    this.clickHandler = (event: MouseEvent) => {
      if (this.isInsertMode && this.currentInsertType) {
        this.handleInsertModeClick(event);
      }
    };

    // Keyboard handler
    this.keydownHandler = (event: KeyboardEvent) => {
      if (event.key === "Escape" && this.isInsertMode) {
        this.exitInsertMode();
      }
    };

    if (this.viewer && this.viewer.container) {
      this.viewer.container.addEventListener("click", this.clickHandler);
    }
    document.addEventListener("keydown", this.keydownHandler);

    // Viewer selection events
    this.viewer.addEventListener(
      "selectionChanged",
      this.onSelectionChanged.bind(this),
    );
  }

  private removeEventListeners(): void {
    if (this.clickHandler && this.viewer && this.viewer.container) {
      this.viewer.container.removeEventListener("click", this.clickHandler);
    }
    if (this.keydownHandler) {
      document.removeEventListener("keydown", this.keydownHandler);
    }

    if (this.viewer && this.viewer.removeEventListener) {
      this.viewer.removeEventListener(
        "selectionChanged",
        this.onSelectionChanged.bind(this),
      );
    }
  }

  private handleInsertModeClick(event: MouseEvent): void {
    try {
      const { x, y } = { x: event.clientX, y: event.clientY };
      const hitPoint = this.viewer.impl.hitTest(x, y, true);

      if (!hitPoint || !hitPoint.intersectPoint || !this.currentInsertType) {
        return;
      }

      const spriteData: SpriteData = {
        position: hitPoint.intersectPoint,
        style: {},
        type: this.currentInsertType,
        name: `${this.currentInsertType} Sensor`,
        status: "active",
        room: this.getRoomFromPosition(hitPoint.intersectPoint),
        timestamp: new Date().toISOString(),
      };

      this.addViewables([spriteData], { type: "sprite" });

      if (this.options.onSpritePlaced) {
        this.options.onSpritePlaced(spriteData);
      }

      // Exit insert mode after placing
      this.exitInsertMode();
    } catch (error) {
      console.error("Error handling insert mode click:", error);
    }
  }

  private onSelectionChanged(event: any): void {
    // Handle sprite selection
    const selection = this.viewer.getSelection();
    if (selection && selection.length > 0) {
      const dbId = selection[0];
      const spriteId = this.getSpriteIdByDbId(dbId);

      if (spriteId && this.options.onSpriteClick) {
        const spriteData = this.sprites.get(spriteId);
        if (spriteData) {
          this.options.onSpriteClick(spriteId, spriteData);
        }
      }
    }
  }

  // 9. Utility Methods
  private async waitForViewerReady(): Promise<void> {
    return new Promise((resolve) => {
      const checkReady = () => {
        if (
          this.viewer &&
          this.viewer.model &&
          this.viewer.model.isLoadDone()
        ) {
          resolve();
        } else {
          setTimeout(checkReady, 100);
        }
      };
      checkReady();
    });
  }

  private generateSpriteId(): string {
    return `sprite_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateDbId(): number {
    return Math.floor(Math.random() * 1000000) + 100000;
  }

  private getSpriteIdByDbId(dbId: number): string | null {
    for (const [id, sprite] of this.sprites.entries()) {
      if (sprite.dbId === dbId) {
        return id;
      }
    }
    return null;
  }

  private getRoomFromPosition(position: {
    x: number;
    y: number;
    z: number;
  }): string {
    // Simple room detection based on position
    // This should be enhanced with actual BIM data
    if (position.x > 0 && position.y > 0) {
      return "Room A";
    } else if (position.x < 0 && position.y > 0) {
      return "Room B";
    } else if (position.x < 0 && position.y < 0) {
      return "Room C";
    } else {
      return "Room D";
    }
  }

  // 10. Public API Methods
  public getSpriteCount(): number {
    return this.sprites.size;
  }

  public getAllSprites(): Map<string, SpriteData> {
    return new Map(this.sprites);
  }

  public getSpriteById(id: string): SpriteData | undefined {
    return this.sprites.get(id);
  }

  public updateSprite(id: string, updates: Partial<SpriteData>): boolean {
    try {
      const sprite = this.sprites.get(id);
      if (!sprite) {
        console.warn(`Sprite with id ${id} not found`);
        return false;
      }

      // Update sprite data
      const updatedSprite = { ...sprite, ...updates };
      this.sprites.set(id, updatedSprite);

      // Refresh display
      this.updateVisibleSprites();

      return true;
    } catch (error) {
      console.error("Error updating sprite:", error);
      return false;
    }
  }

  public removeSprite(id: string): boolean {
    try {
      if (!this.sprites.has(id)) {
        console.warn(`Sprite with id ${id} not found`);
        return false;
      }

      this.sprites.delete(id);
      this.updateVisibleSprites();

      if (this.selectedSpriteId === id) {
        this.selectedSpriteId = null;
      }

      return true;
    } catch (error) {
      console.error("Error removing sprite:", error);
      return false;
    }
  }

  public selectSprite(id: string | null): void {
    this.selectedSpriteId = id;

    if (id && this.sprites.has(id)) {
      const sprite = this.sprites.get(id)!;
      // Focus camera on sprite
      this.viewer.fitToView([sprite.dbId]);
    }
  }

  // 11. Animation Support
  public animateSprite(
    id: string,
    animation: "pulse" | "bounce" | "rotate",
  ): void {
    try {
      if (!this.dataVizExt || !this.sprites.has(id)) {
        return;
      }

      // Use DataViz invalidateViewables for animation
      this.dataVizExt.invalidateViewables();

      console.log(`Animating sprite ${id} with ${animation} effect`);
    } catch (error) {
      console.error("Error animating sprite:", error);
    }
  }

  // 12. Batch Operations
  public addSensorsByType(
    sensorType: string,
    positions: { x: number; y: number; z: number }[],
  ): Promise<boolean> {
    const sprites: SpriteData[] = positions.map((position, index) => ({
      position,
      style: {},
      type: sensorType,
      name: `${sensorType} Sensor ${index + 1}`,
      status: "active",
      timestamp: new Date().toISOString(),
    }));

    return this.addViewables(sprites, { type: "sprite" });
  }

  public getVisibleSensorTypes(): Set<string> {
    return new Set(this.visibleTypes);
  }

  public setAllSensorVisibility(visible: boolean): void {
    Object.keys(SENSOR_CONFIGS).forEach((type) => {
      this.setSensorVisibility(type, visible);
    });
  }
}

// Export sensor configurations for UI use
export { SENSOR_CONFIGS };
export type { SpriteData, DataVizOptions };
