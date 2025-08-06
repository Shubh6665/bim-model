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
  private highlightedSensorId: string | null = null;

  constructor(viewer: any) {
    this.viewer = viewer;
  }

  async initialize(): Promise<boolean> {
    try {
      if (!this.viewer) {
        console.error('[DataViz] Viewer is null during initialization');
        return false;
      }

      // Check if viewer has necessary methods and is properly initialized
      if (typeof this.viewer.loadExtension !== 'function') {
        console.error('[DataViz] Viewer does not have loadExtension method');
        return false;
      }

      // Check if viewer has a valid model and is fully loaded
      if (!this.viewer.model || !this.viewer.impl) {
        console.error('[DataViz] Viewer model or impl not ready for DataViz initialization');
        return false;
      }

      // Additional check for viewer readiness
      if (!this.viewer.impl.canvas || !this.viewer.impl.glrenderer) {
        console.error('[DataViz] Viewer canvas or renderer not ready');
        return false;
      }

      console.log("[DataViz] Starting DataViz extension initialization");

      // Load DataVisualization extension with additional error handling
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
      console.warn("[DataViz] Cannot highlight sensor - service not initialized");
      return;
    }

    try {
      // Clear any existing highlights first
      this.clearHighlight();
      
      const sprite = this.sprites.get(sensorId);
      if (sprite) {
        console.log(`[DataViz] Highlighting sensor ${sensorId} with dbId ${sprite.dbId}`);
        
        // Store the currently highlighted sensor
        this.highlightedSensorId = sensorId;
        
        // Smooth transition for highlighting
        this.animateHighlight(sprite);
        
        // Disable camera movement to prevent excessive model shifting
        // this.smoothFocusOnSensor(sensorId);
      } else {
        console.warn(`[DataViz] Sensor sprite not found for ID: ${sensorId}`);
      }
    } catch (error) {
      console.error(`[DataViz] Failed to highlight sensor ${sensorId}:`, error);
    }
  }
  
  clearHighlight(): void {
    if (!this.isInitialized || !this.dataVizExt) {
      return;
    }

    try {
      // Clear DataViz extension highlights
      if (this.dataVizExt.clearHighlight) {
        this.dataVizExt.clearHighlight();
      }
      
      // Force immediate viewer refresh to show unhighlight
      if (this.viewer && this.viewer.impl) {
        this.viewer.impl.invalidate(true, true, true);
        this.viewer.impl.sceneUpdated(true);
        console.log('[DataViz] Forced viewer refresh for unhighlight');
      }
      
      // Also try DataViz specific refresh
      if (this.dataVizExt && this.dataVizExt.invalidate) {
        this.dataVizExt.invalidate();
      }
      
      // Reset previously highlighted sensor appearance with smooth transition
      if (this.highlightedSensorId) {
        const sprite = this.sprites.get(this.highlightedSensorId);
        if (sprite) {
          this.animateUnhighlight(sprite);
        }
        this.highlightedSensorId = null;
      }
    } catch (error) {
      console.error("[DataViz] Failed to clear highlight:", error);
    }
  }

  private animateHighlight(sprite: any): void {
    try {
      // Only use DataViz extension highlighting - NO scaling or movement
      if (this.dataVizExt && this.dataVizExt.highlightViewables) {
        this.dataVizExt.highlightViewables([sprite.dbId]);
        console.log(`[DataViz] Highlighted sensor with dbId: ${sprite.dbId}`);
      }
      
      // Force immediate viewer refresh to show highlight
      if (this.viewer && this.viewer.impl) {
        this.viewer.impl.invalidate(true, true, true);
        this.viewer.impl.sceneUpdated(true);
        console.log('[DataViz] Forced viewer refresh for highlight');
      }
      
      // Also try DataViz specific refresh
      if (this.dataVizExt && this.dataVizExt.invalidate) {
        this.dataVizExt.invalidate();
      }
      
    } catch (error) {
      console.error("[DataViz] Failed to animate highlight:", error);
    }
  }

  private animateUnhighlight(sprite: any): void {
    try {
      // Remove pulsing animation first
      if (sprite.setAnimation) {
        sprite.setAnimation(null);
      }
      
      // Smooth scale animation from current scale back to 1.0
      this.smoothScale(sprite, 1.5, 1.0, 200); // 200ms duration
      
    } catch (error) {
      console.error("[DataViz] Failed to animate unhighlight:", error);
    }
  }

  private smoothScale(sprite: any, fromScale: number, toScale: number, duration: number): void {
    if (!sprite.setScale) return;
    
    const startTime = Date.now();
    const scaleDiff = toScale - fromScale;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Use easeOutCubic for smooth transition
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const currentScale = fromScale + (scaleDiff * easeProgress);
      
      sprite.setScale(currentScale);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }

  private smoothFocusOnSensor(sensorId: string): void {
    const sprite = this.sprites.get(sensorId);
    if (!sprite || !this.viewer || !sprite.position) {
      return;
    }

    try {
      const targetPosition = new (globalThis as any).THREE.Vector3(
        sprite.position.x,
        sprite.position.y,
        sprite.position.z
      );

      // Get current camera position
      const camera = this.viewer.getCamera();
      const currentTarget = this.viewer.getTarget();
      
      // Smooth camera transition
      this.smoothCameraTransition(currentTarget, targetPosition, 800); // 800ms duration
      
    } catch (error) {
      console.warn("[DataViz] Could not smoothly focus on sensor:", error);
      // Fallback to instant focus
      this.focusOnSensor(sensorId);
    }
  }

  private smoothCameraTransition(fromTarget: any, toTarget: any, duration: number): void {
    if (!this.viewer || !this.viewer.navigation) return;
    
    const startTime = Date.now();
    const targetDiff = {
      x: toTarget.x - fromTarget.x,
      y: toTarget.y - fromTarget.y,
      z: toTarget.z - fromTarget.z
    };
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Use easeInOutQuad for smooth camera movement
      const easeProgress = progress < 0.5 
        ? 2 * progress * progress 
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      
      const currentTarget = new (globalThis as any).THREE.Vector3(
        fromTarget.x + (targetDiff.x * easeProgress),
        fromTarget.y + (targetDiff.y * easeProgress),
        fromTarget.z + (targetDiff.z * easeProgress)
      );
      
      if (this.viewer.navigation.setTarget) {
        this.viewer.navigation.setTarget(currentTarget);
      }
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }
  
  private focusOnSensor(sensorId: string): void {
    const sprite = this.sprites.get(sensorId);
    if (!sprite || !this.viewer) {
      return;
    }

    try {
      const position = sprite.worldPosition;
      if (position && this.viewer.navigation) {
        // Create a smooth camera transition to the sensor
        const THREE = (window as any).THREE;
        if (THREE) {
          const targetPosition = new THREE.Vector3(position.x, position.y, position.z);
          
          // Set camera target with smooth transition
          if (this.viewer.navigation.setTarget) {
            this.viewer.navigation.setTarget(targetPosition);
          }
          
          // Optionally adjust camera distance for better view
          if (this.viewer.navigation.setDistance) {
            this.viewer.navigation.setDistance(50); // Adjust as needed
          }
        }
      }
    } catch (error) {
      console.warn(`[DataViz] Could not focus on sensor ${sensorId}:`, error);
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
      console.warn('[DataViz] Viewer not available for click handler setup');
      return;
    }

    console.log('[DataViz] Setting up sensor click handlers');

    try {
      // Use proper Forge viewer click event
      this.viewer.addEventListener(
        (window as any).Autodesk.Viewing.VIEWER_CLICK_EVENT,
        (event: any) => {
          console.log('[DataViz] VIEWER_CLICK_EVENT triggered:', event);
          
          // Try multiple hit testing approaches
          if (event.clientX !== undefined && event.clientY !== undefined) {
            const result = this.viewer.impl.hitTest(event.clientX, event.clientY, false);
            if (result && result.dbId) {
              console.log('[DataViz] Hit test result:', result);
              // Check if this dbId corresponds to a sensor sprite
              for (const [sensorId, sprite] of this.sprites) {
                if (sprite.dbId === result.dbId) {
                  console.log(`[DataViz] Sensor clicked via hit test: ${sensorId}`);
                  onSensorClick(result.dbId);
                  return;
                }
              }
            }
          }
        }
      );

      // Also try canvas click events as backup
      if (this.viewer.impl && this.viewer.impl.canvas) {
        this.viewer.impl.canvas.addEventListener('click', (event: MouseEvent) => {
          console.log('[DataViz] Canvas click event:', event);
          
          const rect = this.viewer.impl.canvas.getBoundingClientRect();
          const x = event.clientX - rect.left;
          const y = event.clientY - rect.top;
          
          const result = this.viewer.impl.hitTest(x, y, false);
          if (result && result.dbId) {
            console.log('[DataViz] Canvas hit test result:', result);
            // Check if this dbId corresponds to a sensor sprite
            for (const [sensorId, sprite] of this.sprites) {
              if (sprite.dbId === result.dbId) {
                console.log(`[DataViz] Sensor clicked via canvas: ${sensorId}`);
                onSensorClick(result.dbId);
                return;
              }
            }
          }
        });
      }

      // Primary selection event handler
      this.viewer.addEventListener(
        (window as any).Autodesk.Viewing.SELECTION_CHANGED_EVENT,
        (event: any) => {
          console.log('[DataViz] Selection changed:', event);
          const selection = event.dbIdArray;
          if (selection && selection.length > 0) {
            const dbId = selection[0];
            // Check if this dbId corresponds to a sensor sprite
            for (const [sensorId, sprite] of this.sprites) {
              if (sprite.dbId === dbId) {
                console.log(`[DataViz] Sensor selected via selection: ${sensorId}`);
                onSensorClick(dbId);
                return;
              }
            }
          }
        }
      );

      // Additional fallback using aggregate selection
      this.viewer.addEventListener(
        (window as any).Autodesk.Viewing.AGGREGATE_SELECTION_CHANGED_EVENT,
        (event: any) => {
          console.log('[DataViz] Aggregate selection changed:', event);
          if (event.selections && event.selections.length > 0) {
            const selection = event.selections[0];
            if (selection.dbIdArray && selection.dbIdArray.length > 0) {
              const dbId = selection.dbIdArray[0];
              for (const [sensorId, sprite] of this.sprites) {
                if (sprite.dbId === dbId) {
                  console.log(`[DataViz] Sensor selected via aggregate: ${sensorId}`);
                  onSensorClick(dbId);
                  return;
                }
              }
            }
          }
        }
      );

      console.log('[DataViz] Click handlers setup complete');
    } catch (error) {
      console.error('[DataViz] Error setting up sensor click handler:', error);
    }
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
