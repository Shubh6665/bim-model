/**
 * DataVisualization Service
 * Handles Autodesk DataVisualization extension for IoT sensor sprites
 */

export interface SensorSprite {
  id: string;
  type: string;
  position: { x: number; y: number; z: number };
  color: string;
  dbId: number;
}

export class DataVizService {
  private viewer: any;
  private dataVizExt: any;
  private viewableData: any;
  private sensorStyles: Record<string, any> = {};
  private sprites: Map<string, any> = new Map();
  private isInitialized = false;

  constructor(viewer: any) {
    this.viewer = viewer;
  }

  async initialize(): Promise<boolean> {
    try {
      if (!this.viewer) {
        throw new Error('Viewer not available');
      }

      console.log("[DataViz] Starting DataViz extension initialization");

      // Load DataVisualization extension
      this.dataVizExt = await this.viewer.loadExtension("Autodesk.DataVisualization");
      console.log("[DataViz] Extension loaded successfully");

      // Initialize ViewableData with EXPLICIT world-space configuration
      const DataVizCore = (window as any).Autodesk.DataVisualization.Core;
      
      // Create ViewableData with explicit world-space settings
      this.viewableData = new DataVizCore.ViewableData();
      
      // CRITICAL: Configure for world-space positioning
      this.viewableData.spriteSize = 24;
      
      // Force world-space mode - sprites should NOT move with camera
      Object.defineProperty(this.viewableData, 'screenSpace', {
        value: false,
        writable: false,
        configurable: false
      });
      
      // Enable occlusion - sprites should be hidden behind geometry
      Object.defineProperty(this.viewableData, 'occluded', {
        value: true,
        writable: false,
        configurable: false
      });
      
      // Create styles for each sensor type
      await this.createSensorStyles();
      
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error("[DataViz] Failed to initialize:", error);
      return false;
    }
  }

  private isViewerReady(): boolean {
    try {
      // Simplified readiness check - match reference implementation
      return !!(this.viewer && 
               this.viewer.impl && 
               this.viewer.impl.renderer && 
               this.viewer.impl.scene && 
               this.viewer.model && 
               this.viewer.model.isLoadDone());
    } catch (error) {
      console.warn("[DataViz] Error checking viewer readiness:", error);
      return false;
    }
  }

  private async createSensorStyles(): Promise<void> {
    const DataVizCore = (window as any).Autodesk.DataVisualization.Core;
    const THREE = (window as any).THREE;

    const sensorTypes = [
      { name: "Temperature", color: "#ef4444" },
      { name: "CO2", color: "#22c55e" },
      { name: "Light", color: "#fde047" },
      { name: "Humidity", color: "#3b82f6" },
      { name: "Seismic and accelerometric", color: "#a21caf" },
      { name: "Energy consumption", color: "#14b8a6" },
    ];

    for (const sensorType of sensorTypes) {
      const color = new THREE.Color(sensorType.color);
      // Create sprite style with proper world-space configuration
      const spriteIconUrl = `${window.location.origin}/sensor-icon.svg`;
      this.sensorStyles[sensorType.name] = new DataVizCore.ViewableStyle(
        DataVizCore.ViewableType.SPRITE,
        color,
        spriteIconUrl
      );
      console.log(`[DataViz] Created sprite style for ${sensorType.name} with color ${sensorType.color}`);
    }

    console.log("[DataViz] All sensor styles created:", Object.keys(this.sensorStyles));
  }

  async addSensor(sensor: SensorSprite): Promise<boolean> {
    if (!this.isInitialized || !this.viewableData) {
      console.warn("[DataViz] Service not initialized");
      return false;
    }

    try {
      const DataVizCore = (window as any).Autodesk.DataVisualization.Core;
      const THREE = (window as any).THREE;
      
      const style = this.sensorStyles[sensor.type];
      if (!style) {
        console.error(`[DataViz] No style found for sensor type: ${sensor.type}`);
        return false;
      }

      // Create THREE.js Vector3 position with proper depth offset
      const position = new THREE.Vector3(sensor.position.x, sensor.position.y, sensor.position.z);
      
      // Create proper SpriteViewable with world-space positioning
      const sprite = new DataVizCore.SpriteViewable(position, style, sensor.dbId);
      
      // CRITICAL: Configure sprite for proper 3D depth rendering
      if (sprite.setScreenSpace) {
        sprite.setScreenSpace(false); // Ensure world-space positioning
      }
      if (sprite.setOccluded) {
        sprite.setOccluded(true); // Enable occlusion - sprite hidden behind geometry
      }
      
      // Additional depth configuration for proper 3D positioning
      if (sprite.setDepthTest) {
        sprite.setDepthTest(true); // Enable depth testing
      }
      if (sprite.setDepthWrite) {
        sprite.setDepthWrite(true); // Enable depth writing
      }
      
      // Set sprite to render at the exact 3D position with proper Z-buffer testing
      sprite.worldPosition = position;

      // Add to ViewableData
      this.viewableData.addViewable(sprite);
      this.sprites.set(sensor.id, sprite);
      
      console.log(`[DataViz] Added world-space sensor ${sensor.id} at position:`, sensor.position);
      return true;
    } catch (error) {
      console.error(`[DataViz] Failed to add sensor ${sensor.id}:`, error);
      return false;
    }
  }

  async removeSensor(sensorId: string): Promise<boolean> {
    if (!this.isInitialized || !this.viewableData) {
      return false;
    }

    try {
      const sprite = this.sprites.get(sensorId);
      if (sprite) {
        this.viewableData.removeViewable(sprite);
        this.sprites.delete(sensorId);
        console.log(`[DataViz] Removed sensor sprite: ${sensorId}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error("[DataViz] Failed to remove sensor:", error);
      return false;
    }
  }

  async updateDisplay(): Promise<boolean> {
    if (!this.isInitialized || !this.dataVizExt || !this.viewableData) {
      console.warn("[DataViz] Service not initialized");
      return false;
    }

    try {
      // Comprehensive readiness check - don't proceed if not ready
      if (!this.isViewerReady()) {
        console.warn("[DataViz] Viewer renderer not ready, skipping update");
        // Don't retry automatically to prevent infinite loops
        return false;
      }

      console.log(`[DataViz] Updating display with ${this.sprites.size} sprites`);
      
      // Clear existing viewables first
      try {
        this.dataVizExt.removeAllViewables();
      } catch (removeError) {
        console.warn("[DataViz] Error removing viewables:", removeError);
      }
      
      // Skip if no sprites to display
      if (this.sprites.size === 0) {
        console.log("[DataViz] No sprites to display");
        return true;
      }
      
      // Finish ViewableData preparation
      await this.viewableData.finish();
      
      // Final safety check before adding viewables
      if (!this.viewer.impl.renderer) {
        console.error("[DataViz] Renderer became unavailable during update");
        return false;
      }
      
      // Add viewables to the extension
      this.dataVizExt.addViewables(this.viewableData);
      
      // Configure extension for world-space rendering with proper depth
      if (this.dataVizExt.setScreenSpace) {
        this.dataVizExt.setScreenSpace(false); // Force world-space
      }
      
      // CRITICAL: Enable proper 3D depth testing and occlusion
      if (this.dataVizExt.setOccluded) {
        this.dataVizExt.setOccluded(true); // Sprites hidden behind geometry
      }
      if (this.dataVizExt.setDepthTest) {
        this.dataVizExt.setDepthTest(true); // Enable Z-buffer depth testing
      }
      if (this.dataVizExt.setDepthWrite) {
        this.dataVizExt.setDepthWrite(true); // Enable depth buffer writing
      }
      
      // Force depth buffer configuration at renderer level
      if (this.viewer.impl && this.viewer.impl.renderer) {
        const renderer = this.viewer.impl.renderer;
        if (renderer.getContext) {
          const gl = renderer.getContext();
          if (gl) {
            gl.enable(gl.DEPTH_TEST);
            gl.depthFunc(gl.LEQUAL);
            console.log('[DataViz] Enabled WebGL depth testing for sprites');
          }
        }
      }
      
      // Show viewables with occlusion enabled
      this.dataVizExt.showHideViewables(true, true);
      
      console.log(`[DataViz] Successfully displayed ${this.sprites.size} world-space sensors with occlusion`);
      return true;
      
    } catch (error) {
      console.error("[DataViz] Failed to update display:", error);
      return false;
    }
  }

  async clearAllSensors(): Promise<void> {
    if (!this.isInitialized || !this.dataVizExt) {
      return;
    }

    try {
      // Remove all viewables from display
      this.dataVizExt.removeAllViewables();
      this.sprites.clear();
      
      // Recreate ViewableData with EXPLICIT world-space configuration
      const DataVizCore = (window as any).Autodesk.DataVisualization.Core;
      
      // Create ViewableData with explicit world-space settings
      this.viewableData = new DataVizCore.ViewableData();
      
      // CRITICAL: Configure for world-space positioning
      this.viewableData.spriteSize = 24;
      
      // Force world-space mode - sprites should NOT move with camera
      Object.defineProperty(this.viewableData, 'screenSpace', {
        value: false,
        writable: false,
        configurable: false
      });
      
      // Enable occlusion - sprites should be hidden behind geometry
      Object.defineProperty(this.viewableData, 'occluded', {
        value: true,
        writable: false,
        configurable: false
      });
      
      console.log("[DataViz] All sensors cleared and ViewableData recreated");
    } catch (error) {
      console.error("[DataViz] Failed to clear sensors:", error);
    }
  }

  highlightSensor(sensorId: string): void {
    if (!this.isInitialized || !this.dataVizExt) {
      return;
    }

    const sprite = this.sprites.get(sensorId);
    if (sprite) {
      this.dataVizExt.highlightViewables([sprite.dbId]);
    }
  }

  clearHighlights(): void {
    if (!this.isInitialized || !this.dataVizExt) {
      return;
    }

    this.dataVizExt.clearHighlightedViewables();
  }

  setupSensorClickHandler(onSensorClick: (dbId: number) => void): void {
    if (!this.viewer) {
      return;
    }

    this.viewer.addEventListener(
      (window as any).Autodesk.Viewing.SELECTION_CHANGED_EVENT,
      (event: any) => {
        const selection = event.dbIdArray;
        if (selection && selection.length > 0) {
          const dbId = selection[0];
          // Check if this dbId corresponds to a sensor sprite
          for (const [sensorId, sprite] of this.sprites) {
            if (sprite.dbId === dbId) {
              onSensorClick(dbId);
              break;
            }
          }
        }
      }
    );
  }

  getSensorByDbId(dbId: number): string | null {
    for (const [sensorId, sprite] of this.sprites) {
      if (sprite.dbId === dbId) {
        return sensorId;
      }
    }
    return null;
  }

  isReady(): boolean {
    return this.isInitialized && !!this.dataVizExt && !!this.viewableData && this.isViewerReady();
  }
}
