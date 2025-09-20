"use client";

// Lightweight wrapper around APS DataViz APIs for room mapping
// Uses ModelStructureInfo to access LevelRoomsMap and room bounds.

export interface WorldPosition { x: number; y: number; z: number }

export interface RoomInfo {
  roomId: number; // dbId of the room element
  roomName: string;
  levelName?: string;
}

export class RoomMappingService {
  private viewer: any | null;
  private model: any | null;
  private structureInfo: any | null;
  private levelRoomsMap: any | null;
  private initializing = false;
  private roomCache: Map<number, RoomInfo> = new Map();
  private spatialCache: Map<string, number | null> = new Map();

  constructor(viewer?: any) {
    this.viewer = viewer || null;
    this.model = viewer?.model || null;
    this.structureInfo = null;
    this.levelRoomsMap = null;
    this.initializing = false;
  }

  async init(viewer: any) {
    this.viewer = viewer;
    this.model = viewer?.model || null;
    this.structureInfo = null;
    this.levelRoomsMap = null;
    if (this.initializing) return;
    this.initializing = true;

    try {
      if (!this.model) {
        console.warn("[RoomMapping] No model available for room mapping");
        return;
      }

      // Ensure DataVisualization extension is available (Core API lives under it)
      const w: any = window as any;
      let dvCore = w?.Autodesk?.DataVisualization?.Core;
      if (!dvCore) {
        try {
          await this.viewer.loadExtension?.('Autodesk.DataVisualization');
          dvCore = (window as any)?.Autodesk?.DataVisualization?.Core;
        } catch (e) {
          console.warn('[RoomMapping] Failed to load Autodesk.DataVisualization extension:', e);
        }
      }
      if (!dvCore) {
        console.warn('[RoomMapping] DataViz Core not available; will retry later');
        return;
      }

      const DataVizCore = dvCore;
      this.structureInfo = new DataVizCore.ModelStructureInfo(this.model);
      // getLevelRoomsMap reads room + level info generated from Revit master views
      this.levelRoomsMap = await this.structureInfo.getLevelRoomsMap();
      // Warm up internal structures by calling initialize with empty data
    } catch (err) {
      console.error("[RoomMapping] Failed to initialize room mapping:", err);
      this.structureInfo = null;
      this.levelRoomsMap = null;
    } finally {
      this.initializing = false;
    }
  }

  // Enhanced bounding box calculation for any object
  private getBoundingBox(dbId: number, model: any): any | null {
    try {
      const THREE = (window as any).THREE;
      if (!THREE || !model) return null;
      
      const tree = model.getInstanceTree();
      const frags = model.getFragmentList();
      if (!tree || !frags) return null;
      
      let nodeBounds = new THREE.Box3();
      let fragBounds = new THREE.Box3();
      
      tree.enumNodeFragments(dbId, (fragId: number) => {
        frags.getWorldBounds(fragId, fragBounds);
        nodeBounds.union(fragBounds);
      }, true);
      
      return nodeBounds.isEmpty() ? null : nodeBounds;
    } catch (err) {
      console.warn(`[RoomMapping] getBoundingBox failed for dbId=${dbId}:`, err);
      return null;
    }
  }

  // Find room for object using enhanced spatial containment with multiple test points
  async findRoomForObject(dbId: number): Promise<RoomInfo | null> {
    if (!this.viewer || !this.model) return null;
    
    // Check cache first
    const cacheKey = `obj-${dbId}`;
    if (this.spatialCache.has(cacheKey)) {
      const roomId = this.spatialCache.get(cacheKey);
      return roomId ? this.roomCache.get(roomId) || null : null;
    }
    
    try {
      const THREE = (window as any).THREE;
      if (!THREE) return null;
      
      // Get object's bounding box
      const objectBounds = this.getBoundingBox(dbId, this.model);
      if (!objectBounds) {
        this.spatialCache.set(cacheKey, null);
        return null;
      }
      
      // Generate multiple test points for better accuracy
      const testPoints = this.generateTestPoints(objectBounds, THREE);
      
      // Find all rooms in the model
      const roomDbIds = await this.findAllRooms();
      if (!roomDbIds || roomDbIds.length === 0) {
        this.spatialCache.set(cacheKey, null);
        return null;
      }
      
      // Score each room based on containment and proximity
      const roomScores: Array<{roomId: number, score: number, distance: number}> = [];
      
      for (const roomDbId of roomDbIds) {
        const roomBounds = this.getBoundingBox(roomDbId, this.model);
        if (!roomBounds) continue;
        
        const roomCenter = roomBounds.getCenter(new THREE.Vector3());
        let containmentScore = 0;
        let minDistance = Infinity;
        
        // Check each test point
        for (const point of testPoints) {
          const distance = point.distanceTo(roomCenter);
          minDistance = Math.min(minDistance, distance);
          
          if (roomBounds.containsPoint(point)) {
            containmentScore += 1;
          }
        }
        
        // Calculate composite score (prioritize containment, then proximity)
        const score = containmentScore * 1000 + (1 / (minDistance + 1)) * 100;
        
        if (score > 0) {
          roomScores.push({ roomId: roomDbId, score, distance: minDistance });
        }
      }
      
      // Sort by score (highest first) and get the best match
      roomScores.sort((a, b) => b.score - a.score);
      
      if (roomScores.length > 0) {
        const bestRoom = roomScores[0];
        const roomInfo = await this.getRoomInfo(bestRoom.roomId);
        
        if (roomInfo) {
          // Cache the result
          this.spatialCache.set(cacheKey, bestRoom.roomId);
          this.roomCache.set(bestRoom.roomId, roomInfo);
          return roomInfo;
        }
      }
      
      // No room found
      this.spatialCache.set(cacheKey, null);
      return null;
      
    } catch (err) {
      console.error(`[RoomMapping] findRoomForObject failed for dbId=${dbId}:`, err);
      this.spatialCache.set(cacheKey, null);
      return null;
    }
  }
  
  // Generate multiple test points from object bounds for better spatial analysis
  private generateTestPoints(bounds: any, THREE: any): any[] {
    const center = bounds.getCenter(new THREE.Vector3());
    const min = bounds.min;
    const max = bounds.max;
    
    // Generate 9 strategic test points:
    // 1. Object center (primary)
    // 2-5. Four corners at object's base level (z = min.z + 10% height)
    // 6-9. Four corners at object's mid level (z = center.z)
    
    const baseZ = min.z + (max.z - min.z) * 0.1; // 10% from bottom
    const midZ = center.z;
    
    return [
      // Primary center point
      center.clone(),
      
      // Base level corners
      new THREE.Vector3(min.x, min.y, baseZ),
      new THREE.Vector3(max.x, min.y, baseZ),
      new THREE.Vector3(min.x, max.y, baseZ),
      new THREE.Vector3(max.x, max.y, baseZ),
      
      // Mid level corners  
      new THREE.Vector3(min.x, min.y, midZ),
      new THREE.Vector3(max.x, min.y, midZ),
      new THREE.Vector3(min.x, max.y, midZ),
      new THREE.Vector3(max.x, max.y, midZ),
    ];
  }
  
  // Find all room dbIds in the model
  private async findAllRooms(): Promise<number[]> {
    return new Promise((resolve) => {
      if (!this.viewer) {
        resolve([]);
        return;
      }
      
      this.viewer.search(
        'Revit Rooms',
        (dbIds: number[]) => resolve(dbIds || []),
        (error: any) => {
          console.warn('[RoomMapping] Room search failed:', error);
          resolve([]);
        },
        ['Category'],
        { searchHidden: true }
      );
    });
  }
  
  // Get room information for a specific dbId
  private async getRoomInfo(dbId: number): Promise<RoomInfo | null> {
    // Check cache first
    if (this.roomCache.has(dbId)) {
      return this.roomCache.get(dbId) || null;
    }
    
    return new Promise((resolve) => {
      if (!this.viewer) {
        resolve(null);
        return;
      }
      
      this.viewer.getProperties(
        dbId,
        (result: any) => {
          try {
            const name = result.name || `Room ${dbId}`;
            const level = result.properties?.find((p: any) => 
              p.displayName === 'Level' || p.displayCategory === 'Constraints'
            )?.displayValue || 'Unknown Level';
            
            const roomInfo: RoomInfo = {
              roomId: dbId,
              roomName: name,
              levelName: level
            };
            
            // Cache the result
            this.roomCache.set(dbId, roomInfo);
            resolve(roomInfo);
          } catch (err) {
            console.warn(`[RoomMapping] Failed to parse room info for dbId=${dbId}:`, err);
            resolve(null);
          }
        },
        (error: any) => {
          console.warn(`[RoomMapping] getProperties failed for dbId=${dbId}:`, error);
          resolve(null);
        }
      );
    });
  }

  // Clear caches when model changes
  clearCache(): void {
    this.roomCache.clear();
    this.spatialCache.clear();
  }
  
  // Force clear cache and reinitialize (useful for testing new algorithms)
  forceRefresh(): void {
    this.clearCache();
    this.structureInfo = null;
    this.levelRoomsMap = null;
    this.initializing = false;
  }

  // Find the room containing a world-space point using DataViz helper
  findRoomAt(position: WorldPosition): RoomInfo | null {
    if (!position) return null;
    try {
      if (!this.structureInfo || !this.levelRoomsMap) {
        // Try lazy init once if viewer is present
        if (this.viewer && !this.initializing) {
          // Fire-and-forget; synchronous callers will still return null this time
          this.init(this.viewer);
        }
        console.warn('[RoomMapping] Not initialized; will retry after DataViz is ready');
        return null;
      }
      const DataVizCore = (window as any).Autodesk.DataVisualization.Core;
      // Build a temporary device to leverage generateSurfaceShadingData mapping
      const tempDevice = {
        id: `probe-${Date.now()}`,
        position,
        sensorTypes: ["temp"],
      };
      // generateSurfaceShadingData will assign the device to the right Room node
      const shadingData = this.structureInfo.generateSurfaceShadingData([tempDevice], this.levelRoomsMap);
      // The structure contains groups -> nodes (rooms) -> points (devices)
      // We only added a single device, so search for the node holding it
      const groups = shadingData?.getChildren?.() || shadingData?.children || [];
      for (const group of groups) {
        const nodes = group?.getChildren?.() || group?.children || [];
        for (const node of nodes) {
          const points = node?.getPoints?.() || node?.points || [];
          const hit = points?.find?.((p: any) => p?.id === tempDevice.id);
          if (hit) {
            const roomId = node?.dbId ?? node?.nodeId ?? node?.id;
            const name = node?.name || node?.id?.toString?.() || "Room";
            const levelName = group?.name;
            return { roomId: Number(roomId), roomName: String(name), levelName };
          }
        }
      }
      return null;
    } catch (err) {
      console.error("[RoomMapping] findRoomAt failed:", err);
      return null;
    }
  }
}
