"use client";

// HeatmapService: Professional APS-style surface shading heatmap using official Autodesk DataVisualization APIs
// Uses ModelStructureInfo.generateSurfaceShadingData() and proper surface shading workflow

export interface HeatmapSensorLike {
  id: string;
  type?: string;
  value?: string | number;
  roomId?: number; // Revit Room dbId
}

export class HeatmapService {
  private viewer: any;
  private model: any | null = null;
  private initialized = false;
  private dataVizExt: any = null;
  private levelRoomsMap: any = null;
  private surfaceShadingData: any = null;
  private structureInfo: any = null;

  constructor(viewer: any) {
    this.viewer = viewer;
    this.model = viewer?.model || null;
  }

  public isReady(): boolean { return !!this.initialized; }

  // Helper method to find room by ID in levelRoomsMap
  private findRoomById(roomId: number): any {
    if (!this.levelRoomsMap) return null;
    
    console.log(`[HeatmapService] DEBUG - Looking for room ${roomId} in levelRoomsMap structure`);
    console.log(`[HeatmapService] DEBUG - LevelRoomsMap keys:`, Object.keys(this.levelRoomsMap));
    console.log(`[HeatmapService] DEBUG - LevelRoomsMap methods:`, Object.getOwnPropertyNames(Object.getPrototypeOf(this.levelRoomsMap)));
    
    // Try different possible structures
    if (this.levelRoomsMap.children) {
      for (const level of this.levelRoomsMap.children) {
        if (level.children) {
          for (const room of level.children) {
            console.log(`[HeatmapService] DEBUG - Checking room: id=${room.id}, dbId=${room.dbId}`);
            if (room.id === roomId || room.dbId === roomId) {
              console.log(`[HeatmapService] DEBUG - Found room ${roomId}!`);
              return room;
            }
          }
        }
      }
    }
    
    // Try different LevelRoomsMap API methods
    const possibleMethods = ['getRoomById', 'getNodeById', 'findRoomById', 'findNodeById'];
    for (const methodName of possibleMethods) {
      if (typeof this.levelRoomsMap[methodName] === 'function') {
        try {
          const room = this.levelRoomsMap[methodName](roomId);
          if (room) {
            console.log(`[HeatmapService] DEBUG - Found room ${roomId} via ${methodName}!`);
            return room;
          }
        } catch (e) {
          console.warn(`[HeatmapService] DEBUG - ${methodName} failed:`, e);
        }
      }
    }
    
    // Try iterating through all levels and rooms using API methods
    if (typeof this.levelRoomsMap.getAllRooms === 'function') {
      try {
        const allRooms = this.levelRoomsMap.getAllRooms();
        for (const room of allRooms) {
          if (room.id === roomId || room.dbId === roomId) {
            console.log(`[HeatmapService] DEBUG - Found room ${roomId} via getAllRooms!`);
            return room;
          }
        }
      } catch (e) {
        console.warn(`[HeatmapService] DEBUG - getAllRooms failed:`, e);
      }
    }
    
    console.warn(`[HeatmapService] DEBUG - Room ${roomId} not found in any structure`);
    return null;
  }

  public async initialize(): Promise<boolean> {
    try {
      if (!this.viewer || !this.model) return false;
      
      // Load DataVisualization extension (Core APIs live under this namespace)
      this.dataVizExt = await this.viewer.loadExtension('Autodesk.DataVisualization');
      if (!this.dataVizExt) {
        console.error('[HeatmapService] Failed to load DataVisualization extension');
        return false;
      }

      // Build level-rooms map for surface shading using ModelStructureInfo
      await this.buildLevelRoomsMap();
      
      this.initialized = true;
      console.log('✅ [HeatmapService] Initialized using official APS surface shading approach.');
      return true;
    } catch (e) {
      console.error('[HeatmapService] initialize failed', e);
      return false;
    }
  }

  // Build level-rooms mapping required for surface shading using DataViz Core
  private async buildLevelRoomsMap(): Promise<void> {
    try {
      const w: any = window as any;
      const dvCore = w?.Autodesk?.DataVisualization?.Core;
      if (!dvCore) {
        console.warn('[HeatmapService] DataVisualization.Core not available yet');
        return;
      }
      // Create ModelStructureInfo for this model
      this.structureInfo = new dvCore.ModelStructureInfo(this.model);
      // Obtain LevelRoomsMap from the model
      this.levelRoomsMap = await this.structureInfo.getLevelRoomsMap();
      if (!this.levelRoomsMap) {
        console.warn('[HeatmapService] LevelRoomsMap not available');
        return;
      }
      console.log('✅ [HeatmapService] LevelRoomsMap ready for surface shading');
    } catch (e) {
      console.warn('[HeatmapService] Failed to build level-rooms map:', e);
    }
  }

  // Create device list for surface shading from sensor data
  private createDeviceList(sensors: HeatmapSensorLike[]): any[] {
    const deviceList: any[] = [];
    
    for (const sensor of sensors || []) {
      if (sensor.roomId != null) {
        const value = (typeof sensor.value === 'number') ? sensor.value : parseFloat(String(sensor.value ?? ''));
        if (!isNaN(value)) {
          const device = {
            id: sensor.id,
            position: { x: 0, y: 0, z: 0 }, // Position not critical for room-based shading
            sensorTypes: [sensor.type || 'temperature'],
            roomId: sensor.roomId
          };
          deviceList.push(device);
          console.log(`[HeatmapService] DEBUG - Created device: ${JSON.stringify(device)}`);
        }
      }
    }
    
    console.log(`[HeatmapService] DEBUG - Total devices created: ${deviceList.length}`);
    return deviceList;
  }

  // Create data view for surface shading with getSensorValue callback
  private createDataView(sensors: HeatmapSensorLike[]): any {
    const sensorMap = new Map<string, HeatmapSensorLike>();
    for (const sensor of sensors || []) {
      sensorMap.set(sensor.id, sensor);
    }

    return {
      getSensors: () => {
        return Array.from(sensorMap.values()).map(s => ({ id: s.id, type: s.type || 'temperature' }));
      },
      getChannels: () => {
        const channels = Array.from(new Set(sensors.map(s => s.type || 'temperature')));
        return channels.map(ch => ({ id: ch, name: ch, unit: '°C' }));
      },
      getSamples: () => {
        // Return current timestamp samples
        const now = Date.now();
        return sensors.map(s => ({
          sensorId: s.id,
          timestamp: now,
          value: (typeof s.value === 'number') ? s.value : parseFloat(String(s.value ?? ''))
        }));
      },
      getSensorValue: (sensorId: string, channelId: string, timestamp: number) => {
        const sensor = sensorMap.get(sensorId);
        if (!sensor) return undefined;
        
        const value = (typeof sensor.value === 'number') ? sensor.value : parseFloat(String(sensor.value ?? ''));
        return isNaN(value) ? undefined : value;
      }
    };
  }

  // Update and render heatmap using official APS surface shading
  public async updateAndShowHeatmap(sensors: HeatmapSensorLike[]): Promise<void> {
    if (!this.initialized) {
      const ok = await this.initialize();
      if (!ok) return;
    }
    
    if (!this.viewer || !this.model || !this.dataVizExt) return;
    if (!this.structureInfo || !this.levelRoomsMap) {
      // Try to (re)build level-rooms map lazily if not ready yet
      await this.buildLevelRoomsMap();
      if (!this.structureInfo || !this.levelRoomsMap) {
        console.warn('[HeatmapService] Surface shading prerequisites not ready');
        return;
      }
    }

    // Clear previous surface shading
    this.hideHeatmap();

    // Filter sensors with valid room IDs and values
    const validSensors = sensors.filter(s => 
      s.roomId != null && 
      !isNaN((typeof s.value === 'number') ? s.value : parseFloat(String(s.value ?? '')))
    );
    
    // DEBUG: Log sensor room mapping
    console.log('[HeatmapService] DEBUG - Sensor room mapping:');
    validSensors.forEach(s => {
      console.log(`  Sensor ${s.id}: roomId=${s.roomId}, value=${s.value}, type=${s.type}`);
    });
    
    if (validSensors.length === 0) {
      console.warn('[HeatmapService] No valid room-linked sensor values to render');
      return;
    }

    try {
      // Create device list and data view
      const deviceList = this.createDeviceList(validSensors);
      const dataView = this.createDataView(validSensors);
      
      console.log(`[HeatmapService] Creating surface shading for ${deviceList.length} devices`);

      // OFFICIAL APS DOCUMENTATION PATTERN - ONLY SENSOR ROOMS
      console.log(`[HeatmapService] Using official APS pattern for SENSOR ROOMS ONLY...`);
      
      const DataVizCore = (window as any)?.Autodesk?.DataVisualization?.Core;
      if (!DataVizCore) {
        console.warn('[HeatmapService] DataVisualization.Core not available on window');
        return;
      }
      const devices: any[] = [];
      
      // Step 1: Create devices ONLY for rooms that have sensors
      for (const sensor of validSensors) {
        const roomId = sensor.roomId;
        
        // Find the specific room for this sensor
        let targetRoom = null;
        for (let lvl in this.levelRoomsMap) {
          const rooms = this.levelRoomsMap[lvl];
          if (rooms && Array.isArray(rooms)) {
            for (const room of rooms) {
              if (room && (room.id === roomId || room.dbId === roomId)) {
                targetRoom = room;
                break;
              }
            }
          }
          if (targetRoom) break;
        }
        
        if (targetRoom && targetRoom.bounds) {
          const center = targetRoom.bounds.getCenter ? targetRoom.bounds.getCenter() : targetRoom.bounds.center();
          const device = {
            id: sensor.id, // Use actual sensor ID
            position: center,
            sensorTypes: ['temperature'],
            type: 'temperature'
          };
          devices.push(device);
          targetRoom.addDevice(device);
          console.log(`[HeatmapService] ✅ Associated sensor ${sensor.id} with room: ${targetRoom.name || targetRoom.id} [roomId=${roomId}]`);
        } else {
          console.warn(`[HeatmapService] ❌ Room ${roomId} not found for sensor ${sensor.id}`);
        }
      }
      
      console.log(`[HeatmapService] Created ${devices.length} devices for SENSOR ROOMS ONLY`);
      
      if (devices.length === 0) {
        console.warn('[HeatmapService] No sensor rooms found - cannot render heatmap');
        return;
      }
      
      // Step 2: Generate surface shading data (Official Pattern)
      const structureInfo = new DataVizCore.ModelStructureInfo(this.model);
      const shadingData = await structureInfo.generateSurfaceShadingData(devices, this.levelRoomsMap);
      
      // Step 3: Setup surface shading (Official Pattern)
      await this.dataVizExt.setupSurfaceShading(this.model, shadingData);
      
      // Step 4: Register colors (Official Pattern)
      const colors = [0x0000ff, 0x00ff00, 0xffff00, 0xff0000]; // Blue to Red gradient
      this.dataVizExt.registerSurfaceShadingColors('temperature', colors);
      
      // Step 5: Create MINIMAL LevelRoomsMap with ONLY sensor rooms
      console.log(`[HeatmapService] Creating minimal LevelRoomsMap with SENSOR ROOMS ONLY`);
      
      const minimalLevelRoomsMap: any = {};
      const sensorRoomIds = validSensors.map(s => s.roomId);
      console.log(`[HeatmapService] Sensor room IDs: ${sensorRoomIds.join(', ')}`);
      
      // Build minimal map with only sensor rooms
      for (let lvl in this.levelRoomsMap) {
        const rooms = this.levelRoomsMap[lvl];
        if (rooms && Array.isArray(rooms)) {
          const sensorRooms = rooms.filter(room => 
            room && sensorRoomIds.includes(room.id || room.dbId)
          );
          if (sensorRooms.length > 0) {
            minimalLevelRoomsMap[lvl] = sensorRooms;
            console.log(`[HeatmapService] Level ${lvl}: ${sensorRooms.length} sensor rooms`);
          }
        }
      }
      
      // Re-generate surface shading data with minimal map
      const minimalShadingData = await structureInfo.generateSurfaceShadingData(devices, minimalLevelRoomsMap);
      await this.dataVizExt.setupSurfaceShading(this.model, minimalShadingData);
      
      // Render with minimal level map (only sensor room levels)
      const minimalLevelNames = Object.keys(minimalLevelRoomsMap);
      console.log(`[HeatmapService] Rendering ONLY levels with sensors: ${minimalLevelNames.join(', ')}`);
      
      this.dataVizExt.renderSurfaceShading(minimalLevelNames, 'temperature', (deviceId: string, sensorType: string) => {
        const sensor = validSensors.find(s => s.id === deviceId);
        if (sensor && sensor.value != null) {
          const temp = (typeof sensor.value === 'number') ? sensor.value : parseFloat(String(sensor.value));
          console.log(`[HeatmapService] Returning temperature ${temp}°C for sensor ${deviceId}`);
          return temp;
        }
        return 20; // Default fallback
      });
      
      console.log(`[HeatmapService] ✅ Surface shading updated for ${devices.length} SENSOR ROOMS ONLY (no white overlay on other areas)`);
    } catch (e) {
      console.error('[HeatmapService] Failed to render surface shading:', e);
    }
  }

  public hideHeatmap(): void {
    try {
      console.log('[HeatmapService] Hiding heatmap...');
      if (this.dataVizExt && this.model) {
        // Hide surface shading
        if (typeof this.dataVizExt.hideSurfaceShading === 'function') {
          this.dataVizExt.hideSurfaceShading();
          console.log('[HeatmapService] ✅ Surface shading hidden via hideSurfaceShading()');
        } else if (typeof this.dataVizExt.removeSurfaceShading === 'function') {
          this.dataVizExt.removeSurfaceShading();
          console.log('[HeatmapService] ✅ Surface shading removed via removeSurfaceShading()');
        } else if (typeof this.dataVizExt.clearSurfaceShading === 'function') {
          this.dataVizExt.clearSurfaceShading();
          console.log('[HeatmapService] ✅ Surface shading cleared via clearSurfaceShading()');
        } else {
          console.warn('[HeatmapService] No hide/remove/clear method found for surface shading');
        }
        this.surfaceShadingData = null;
      } else {
        console.warn('[HeatmapService] DataViz extension or model not available for hiding');
      }
    } catch (e) {
      console.error('[HeatmapService] hideHeatmap failed', e);
    }
  }
}
