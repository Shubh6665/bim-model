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
      console.log("✅ [RoomMapping] LevelRoomsMap loaded");
    } catch (err) {
      console.error("[RoomMapping] Failed to initialize room mapping:", err);
      this.structureInfo = null;
      this.levelRoomsMap = null;
    } finally {
      this.initializing = false;
    }
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
