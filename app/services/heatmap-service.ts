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
  private levelRoomsMap: Map<string, any[]> = new Map();
  private surfaceShadingData: any = null;

  constructor(viewer: any) {
    this.viewer = viewer;
    this.model = viewer?.model || null;
  }

  public isReady(): boolean { return !!this.initialized; }

  public async initialize(): Promise<boolean> {
    try {
      if (!this.viewer || !this.model) return false;
      
      // Load DataVisualization extension
      this.dataVizExt = await this.viewer.loadExtension('Autodesk.DataVisualization');
      if (!this.dataVizExt) {
        console.error('[HeatmapService] Failed to load DataVisualization extension');
        return false;
      }

      // Build level-rooms map for surface shading
      await this.buildLevelRoomsMap();
      
      this.initialized = true;
      console.log('✅ [HeatmapService] Initialized using official APS surface shading approach.');
      return true;
    } catch (e) {
      console.error('[HeatmapService] initialize failed', e);
      return false;
    }
  }

  // Build level-rooms mapping required for surface shading
  private async buildLevelRoomsMap(): Promise<void> {
    try {
      // Load AEC extension for room detection
      const aecExt = await this.viewer.loadExtension('Autodesk.AEC');
      if (!aecExt) {
        console.warn('[HeatmapService] AEC extension not available, using fallback room detection');
        return;
      }

      const aecModelData = await aecExt.getAecModelData(this.model);
      if (!aecModelData || !aecModelData.levels) {
        console.warn('[HeatmapService] No AEC model data available');
        return;
      }

      // Build rooms map by level
      this.levelRoomsMap.clear();
      for (const level of aecModelData.levels) {
        const rooms: any[] = [];
        if (level.rooms) {
          for (const room of level.rooms) {
            rooms.push({
              id: room.id,
              name: room.name || `Room ${room.id}`,
              dbId: room.id
            });
          }
        }
        this.levelRoomsMap.set(level.name || `Level ${level.guid}`, rooms);
        console.log(`[HeatmapService] Level "${level.name}": ${rooms.length} rooms`);
      }
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
          deviceList.push({
            id: sensor.id,
            position: { x: 0, y: 0, z: 0 }, // Position not critical for room-based shading
            sensorTypes: [sensor.type || 'temperature'],
            roomId: sensor.roomId
          });
        }
      }
    }
    
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

    // Clear previous surface shading
    this.hideHeatmap();

    // Filter sensors with valid room IDs and values
    const validSensors = sensors.filter(s => 
      s.roomId != null && 
      !isNaN((typeof s.value === 'number') ? s.value : parseFloat(String(s.value ?? '')))
    );
    
    if (validSensors.length === 0) {
      console.warn('[HeatmapService] No valid room-linked sensor values to render');
      return;
    }

    try {
      // Create device list and data view
      const deviceList = this.createDeviceList(validSensors);
      const dataView = this.createDataView(validSensors);
      
      console.log(`[HeatmapService] Creating surface shading for ${deviceList.length} devices`);

      // Generate surface shading data using official API
      const ModelStructureInfo = (window as any).Autodesk?.DataVisualization?.Core?.ModelStructureInfo;
      if (!ModelStructureInfo) {
        console.error('[HeatmapService] ModelStructureInfo not available');
        return;
      }

      this.surfaceShadingData = await ModelStructureInfo.generateSurfaceShadingData(
        deviceList,
        this.levelRoomsMap
      );

      if (!this.surfaceShadingData) {
        console.error('[HeatmapService] Failed to generate surface shading data');
        return;
      }

      // Setup surface shading
      await this.dataVizExt.setupSurfaceShading(this.model, this.surfaceShadingData);

      // Render surface shading with data view
      await this.dataVizExt.renderSurfaceShading(
        'temperature', // channel ID
        dataView.getSensorValue.bind(dataView),
        { 
          min: Math.min(...validSensors.map(s => (typeof s.value === 'number') ? s.value : parseFloat(String(s.value ?? '')))),
          max: Math.max(...validSensors.map(s => (typeof s.value === 'number') ? s.value : parseFloat(String(s.value ?? ''))))
        }
      );

      console.log(`[HeatmapService] Surface shading rendered for ${validSensors.length} sensors`);
    } catch (e) {
      console.error('[HeatmapService] Failed to render surface shading:', e);
    }
  }

  public hideHeatmap(): void {
    try {
      if (this.dataVizExt && this.model) {
        // Hide surface shading
        this.dataVizExt.hideSurfaceShading();
        this.surfaceShadingData = null;
      }
    } catch (e) {
      console.warn('[HeatmapService] hideHeatmap failed', e);
    }
  }
}
