"use client";

// Floor Data View - Based on Autodesk Platform Services IoT Extensions Demo
// This class manages floor-based filtering and data management for 2D views

export interface FloorData {
  id: string;
  name: string;
  zMin: number;
  zMax: number;
  levelIndex: number;
}

export interface SensorData {
  id: string;
  type: string;
  location: {
    x: number;
    y: number;
    z: number;
  };
  objectId?: number;
  properties?: any;
}

export class FloorDataView {
  private _floor: FloorData | null = null;
  private _sensors = new Map<string, SensorData>();
  private _sensorsFilteredByFloor: Map<string, SensorData> | null = null;
  private _viewer: any = null;
  private _levelsExtension: any = null;

  constructor(viewer?: any) {
    this._viewer = viewer;
  }

  async initialize() {
    if (!this._viewer) {
      throw new Error('Viewer not available for FloorDataView initialization');
    }

    try {
      // Load the AEC Levels Extension for proper floor management
      this._levelsExtension = await this._viewer.loadExtension('Autodesk.AEC.LevelsExtension');
      console.log('✅ AEC Levels Extension loaded successfully');
      
      // Load sensors from API
      await this._loadSensors();
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize FloorDataView:', error);
      // Continue without levels extension if not available
      await this._loadSensors();
      return false;
    }
  }

  private async _loadSensors() {
    try {
      this._sensors.clear();
      
      // Get current project ID from context or localStorage
      const currentProjectId = localStorage.getItem('currentProjectId') || '1';
      
      const response = await fetch(`/api/iot/sensors?projectId=${currentProjectId}`);
      if (!response.ok) {
        throw new Error(`Failed to load sensors: ${response.statusText}`);
      }
      
      const sensors = await response.json();
      
      for (const sensor of sensors) {
        this._sensors.set(sensor.id.toString(), {
          id: sensor.id.toString(),
          type: sensor.type,
          location: {
            x: sensor.position_x || 0,
            y: sensor.position_y || 0,
            z: sensor.position_z || 0
          },
          objectId: sensor.object_id,
          properties: sensor
        });
      }
      
      console.log(`📡 Loaded ${this._sensors.size} sensors for floor filtering`);
      this._sensorsFilteredByFloor = null; // Reset filtered cache
      
    } catch (error) {
      console.error('❌ Error loading sensors:', error);
    }
  }

  // Floor property getter/setter - core of the filtering system
  get floor(): FloorData | null {
    return this._floor;
  }

  set floor(floor: FloorData | null) {
    console.log(`🏢 Setting floor to:`, floor);
    this._floor = floor;
    this._sensorsFilteredByFloor = null; // Reset cache when floor changes
  }

  // Get sensors filtered by current floor - core filtering logic
  getSensors(): Map<string, SensorData> {
    if (!this._sensorsFilteredByFloor) {
      this._sensorsFilteredByFloor = new Map();
      
      for (const [sensorId, sensor] of this._sensors.entries()) {
        // If no floor is selected, include all sensors
        if (!this._floor) {
          this._sensorsFilteredByFloor.set(sensorId, sensor);
        } else {
          // Filter sensors by floor z-range (key logic from reference)
          const sensorZ = sensor.location.z;
          if (sensorZ >= this._floor.zMin && sensorZ <= this._floor.zMax) {
            this._sensorsFilteredByFloor.set(sensorId, sensor);
            console.log(`✅ Sensor ${sensorId} included in floor ${this._floor.name} (z: ${sensorZ})`);
          } else {
            console.log(`❌ Sensor ${sensorId} excluded from floor ${this._floor.name} (z: ${sensorZ}, range: ${this._floor.zMin}-${this._floor.zMax})`);
          }
        }
      }
      
      console.log(`🔍 Filtered sensors for floor ${this._floor?.name || 'All'}: ${this._sensorsFilteredByFloor.size}/${this._sensors.size}`);
    }
    
    return this._sensorsFilteredByFloor;
  }

  // Get all available floors from the levels extension
  getAvailableFloors(): FloorData[] {
    if (!this._levelsExtension) {
      console.warn('⚠️ Levels extension not available, returning default floors');
      return this._getDefaultFloors();
    }

    try {
      const floorData = this._levelsExtension.floorSelector?.floorData || [];
      
      const floors: FloorData[] = floorData.map((floor: any, index: number) => ({
        id: `floor_${index}`,
        name: floor.name || `Level ${index}`,
        zMin: floor.zMin || (index * 3.5), // Default 3.5m floor height
        zMax: floor.zMax || ((index + 1) * 3.5),
        levelIndex: index
      }));

      console.log(`🏢 Found ${floors.length} floors from levels extension:`, floors);
      return floors;
      
    } catch (error) {
      console.error('❌ Error getting floors from levels extension:', error);
      return this._getDefaultFloors();
    }
  }

  private _getDefaultFloors(): FloorData[] {
    return [
      { id: 'basement', name: 'Basement', zMin: -5, zMax: 0, levelIndex: -1 },
      { id: 'ground', name: 'Ground Floor', zMin: 0, zMax: 3.5, levelIndex: 0 },
      { id: 'first', name: 'First Floor', zMin: 3.5, zMax: 7, levelIndex: 1 },
      { id: 'second', name: 'Second Floor', zMin: 7, zMax: 10.5, levelIndex: 2 }
    ];
  }

  // Select a specific floor and trigger filtering + native level interaction
  selectFloor(floorId: string | null) {
    if (!floorId) {
      this.floor = null;
      
      // If clearing floor selection, restore full 3D model view via native extension
      if (this._levelsExtension && this._levelsExtension.floorSelector) {
        try {
          console.log('🔄 Clearing floor selection in native levels extension');
          
          // Clear floor selection in native extension
          this._levelsExtension.floorSelector.selectFloor(-1, false);
          
          // Try to restore 3D view by triggering the "All Floors" or 3D view
          if (this._levelsExtension.floorSelector.restore3DView) {
            this._levelsExtension.floorSelector.restore3DView();
          } else if (this._levelsExtension.floorSelector.activateAllFloorsView) {
            this._levelsExtension.floorSelector.activateAllFloorsView();
          }
          
          console.log('✅ Successfully cleared floor selection and restored 3D view');
        } catch (error) {
          console.warn('⚠️ Could not clear floor selection in levels extension:', error);
          // Minimal fallback
          try { (this._viewer as any)?.setCutPlanes?.([], 'Autodesk.AEC.FloorSelector'); } catch {}
        }
      } else {
        try { (this._viewer as any)?.setCutPlanes?.([], 'Autodesk.AEC.FloorSelector'); } catch {}
      }
      return;
    }

    const availableFloors = this.getAvailableFloors();
    const selectedFloor = availableFloors.find(f => f.id === floorId);
    
    if (selectedFloor) {
      this.floor = selectedFloor;
      
      // Enhanced native levels extension integration
      if (this._levelsExtension && this._levelsExtension.floorSelector) {
        try {
          console.log(`🏢 Triggering native floor selection for level ${selectedFloor.levelIndex}: ${selectedFloor.name}`);
          
          // Select the floor in the native extension (highlights it)
          this._levelsExtension.floorSelector.selectFloor(selectedFloor.levelIndex, true);
          
        } catch (error) {
          console.warn('⚠️ Could not sync floor selection with levels extension:', error);
        }
      } else {
        console.log('⚠️ No levels extension available; skipping native selection');
      }
    } else {
      console.warn(`⚠️ Floor ${floorId} not found in available floors`);
    }
  }

  // Alternative methods to activate floor view when standard methods fail
  private tryAlternativeFloorActivation(_floor: FloorData) { /* no-op; simplified flow */ }

  // Manual restoration of 3D view
  private restore3DViewManually() {
    try {
      console.log('🔧 Manually restoring 3D view');
      
      // Show all model elements
      this._viewer.showAll();
      
      // Switch to perspective view
      this._viewer.setViewType(0); // 0 = PERSPECTIVE
      
      // Fit the entire model to view
      this._viewer.fitToView();
      
      console.log('✅ Manually restored 3D view');
    } catch (error) {
      console.error('❌ Error restoring 3D view manually:', error);
    }
  }

  // Manual floor view trigger as fallback
  private triggerFloorViewManually(_floor: FloorData) { /* no-op; simplified flow */ }

  // Setup floor change event listener (like in the reference)
  setupFloorChangeListener(onFloorChanged: (floor: FloorData | null) => void) {
    if (!this._levelsExtension) {
      console.warn('⚠️ Cannot setup floor change listener - levels extension not available');
      return;
    }

    try {
      this._levelsExtension.floorSelector.addEventListener(
        'Autodesk.AEC.FloorSelector.SELECTED_FLOOR_CHANGED', 
        ({ target, levelIndex }: any) => {
          console.log(`🔄 Floor changed via levels extension: ${levelIndex}`);
          
          if (levelIndex !== undefined && target.floorData) {
            const floorData = target.floorData[levelIndex];
            if (floorData) {
              const floor: FloorData = {
                id: `floor_${levelIndex}`,
                name: floorData.name || `Level ${levelIndex}`,
                zMin: floorData.zMin || (levelIndex * 3.5),
                zMax: floorData.zMax || ((levelIndex + 1) * 3.5),
                levelIndex: levelIndex
              };
              
              this.floor = floor;
              onFloorChanged(floor);
            }
          } else {
            this.floor = null;
            onFloorChanged(null);
          }
        }
      );
      
      console.log('✅ Floor change listener setup successfully');
    } catch (error) {
      console.error('❌ Error setting up floor change listener:', error);
    }
  }

  // Refresh sensors (for when project changes)
  async refreshSensors() {
    await this._loadSensors();
  }

  // Get viewer instance
  get viewer() {
    return this._viewer;
  }

  // Set viewer instance
  set viewer(viewer: any) {
    this._viewer = viewer;
  }

  // Cleanup
  dispose() {
    this._sensors.clear();
    this._sensorsFilteredByFloor = null;
    this._floor = null;
    this._viewer = null;
    this._levelsExtension = null;
  }
}
