"use client";

import React, { useEffect, useState, useRef } from "react";
import { X, Minimize2, ExternalLink, Building2, Square, Wrench, ClipboardList, CalendarClock, Package } from "lucide-react";

// Import utilities and types
import { load, save, K } from "./fm-panel-utils";
import type { FMPanelProps, Section, AssetRecord } from "./fm-panel-types";

// Import all extracted FM module components
import { AssetList } from "./fm-modules/asset-list";
import { CreateAsset } from "./fm-modules/create-asset";
import { SpaceList } from "./fm-modules/space-list";
import { CreateSpace } from "./fm-modules/create-space";
import { ScheduledMaintenance } from "./fm-modules/scheduled-maintenance";
import { TicketForm } from "./fm-modules/ticket-form";
import { ServiceRequests } from "./fm-modules/service-requests";
import { ServiceRequestsView } from "./fm-modules/service-requests-view";
import { MaintenanceReports } from "./fm-modules/maintenance-reports";
import { WorkOrders } from "./fm-modules/work-orders";
import { OngoingMaintenance } from "./fm-modules/ongoing-maintenance";
import { PendingApprovals } from "./fm-modules/pending-approvals";
import { FMFieldEditor } from "./fm-modules/fm-field-editor";
import { PlannedMaintenance } from "./fm-modules/planned-maintenance";
import { useUserRole } from "../hooks/useUserRole";
import { CATEGORY_MAPPING } from "../services/asset-extraction-service";

export default function FMPanel({ projectId, viewer, standalone, initialSection }: FMPanelProps) {
  const { role, isTM, isFM } = useUserRole(projectId);
  
  const defaultItemForGroup = (group: Section['group']): Section => {
    switch (group) {
      case 'assets': return { group: 'assets', item: 'asset-list' };
      case 'spaces': return { group: 'spaces', item: 'space-list' };
      case 'maintenance': return { group: 'maintenance', item: 'scheduled' };
      case 'work-orders': return { group: 'work-orders', item: 'service-requests' };
      case 'upcoming-activities': return { group: 'upcoming-activities', item: 'ongoing' };
      default: return { group: 'assets', item: 'asset-list' } as Section;
    }
  };

  const initialSectionState: Section = React.useMemo(() => {
    // 1) from prop if valid
    if (initialSection && (initialSection as any).group) {
      const s = initialSection as Section;
      // normalize: ensure item is set
      if (!(s as any).item) return defaultItemForGroup(s.group);
      return s;
    }
    // 2) from localStorage
    const loaded = load<Section | null>(K.uiSection(projectId), null);
    if (loaded && (loaded as any).group) {
      const ls = loaded as Section;
      if (!(ls as any).item) return defaultItemForGroup(ls.group);
      return ls;
    }
    // 3) fallback default
    return defaultItemForGroup('assets');
  }, [initialSection, projectId]);

  const [section, setSection] = useState<Section | null>(initialSectionState);
  const [showModal, setShowModal] = useState(false);
  const modalRef = React.useRef<HTMLDivElement | null>(null);
  const [modalPos, setModalPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [preSelectedAssets, setPreSelectedAssets] = useState<AssetRecord[]>([]);
  const [modalSize, setModalSize] = useState<{ width: number; height: number }>({ width: 1200, height: 800 });
  const [showModalMinimized, setShowModalMinimized] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const dragRef = React.useRef({ startMouseX: 0, startMouseY: 0, startX: 0, startY: 0 });
  const resizeRef = React.useRef({ startMouseX: 0, startMouseY: 0, startWidth: 0, startHeight: 0 });
  const isStandalone = !!standalone;
  // Persist section selection so it restores in new windows/tabs
  useEffect(() => {
    if (section) save(K.uiSection(projectId), section);
  }, [section, projectId]);
  const childWinRef = useRef<Window | null>(null);

  // Remote drawing bridge (main window only)
  const remoteActiveRef = useRef(false);
  const remotePointsRef = useRef<{ x: number; y: number; z: number }[]>([]);
  const remoteBaseZRef = useRef<number | null>(null);
  const remoteOverlay = 'fm-remote-footprint-preview';
  const remoteHoverRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const remoteSnapperRef = useRef<any>(null);
  // Remote placement (manual asset) bridge
  const remotePlaceActiveRef = useRef(false);
  const remotePlaceAssetRef = useRef<{ assetId: string; shape: 'cube' | 'sphere'; size: number } | null>(null);
  const remotePlaceOverlayElRef = useRef<HTMLElement | null>(null);
  const remotePlaceOverlayChildRef = useRef<HTMLElement | null>(null);
  const remotePlacePrevDisplayRef = useRef<string | null>(null);
  const remotePlacePrevBackdropRef = useRef<string | null>(null);
  const remotePlacePrevBgRef = useRef<string | null>(null);
  const remoteClearOverlay = () => {
    try {
      if (!viewer?.impl) return;
      const scn = (viewer.impl.overlayScenes || {})[remoteOverlay];
      const scene = scn?.scene;
      if (scene) {
        const children = [...scene.children];
        children.forEach(ch => scene.remove(ch));
        viewer.impl.invalidate(true);
      }
    } catch { }
  };
  // Remote helpers
  const remoteWorldOnZ = (clientX: number, clientY: number, z: number) => {
    const THREE = (window as any).THREE;
    if (!THREE || !viewer?.impl?.camera) return null;

    // Get proper canvas bounds
    const canvas = viewer.impl.canvas || viewer.container;
    const rect = canvas.getBoundingClientRect();

    // Normalize to [-1, 1] NDC space
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((clientY - rect.top) / rect.height) * 2 + 1;

    const camera = viewer.impl.camera;

    // Create ray from camera through mouse position
    const mouse = new THREE.Vector3(x, y, 0.5);
    mouse.unproject(camera);

    const origin = camera.position.clone();
    const dir = mouse.sub(origin).normalize();

    // Intersect ray with horizontal plane at z
    const EPS = 1e-6;
    if (Math.abs(dir.z) < EPS) return null; // parallel to plane

    const t = (z - origin.z) / dir.z;
    if (!isFinite(t) || t < 0) return null; // behind camera

    const point = origin.clone().add(dir.clone().multiplyScalar(t));
    return point;
  };
  const remoteIsNearFirst = (p: { x: number; y: number; z: number }, eps = 0.4) => {
    if (remotePointsRef.current.length < 1) return false;
    const a = remotePointsRef.current[0];
    const dx = p.x - a.x, dy = p.y - a.y;
    return Math.hypot(dx, dy) <= eps;
  };
  const remoteDrawPreview = () => {
    try {
      if (!viewer?.impl) return;
      if (!(viewer.impl.overlayScenes || {})[remoteOverlay]) viewer.impl.createOverlayScene(remoteOverlay);
      remoteClearOverlay();
      const pts = remotePointsRef.current;
      const hover = remoteHoverRef.current;
      const THREE = (window as any).THREE;
      if (!THREE) { viewer.impl.invalidate(true); return; }

      // Draw polyline through all clicked points (THICKER & DARKER)
      if (pts.length >= 2) {
        const geom = new THREE.BufferGeometry().setFromPoints(pts.map(p => new THREE.Vector3(p.x, p.y, p.z)));
        const mat = new THREE.LineBasicMaterial({ color: 0x00dd00, linewidth: 4, depthTest: false });
        const line = new THREE.Line(geom, mat);
        line.renderOrder = 999;
        viewer.impl.addOverlay(remoteOverlay, line);
      }

      // Draw preview line from LAST point to hover (THICKER)
      if (hover && pts.length >= 1) {
        const lastPt = pts[pts.length - 1];
        const previewGeom = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(lastPt.x, lastPt.y, lastPt.z),
          new THREE.Vector3(hover.x, hover.y, hover.z)
        ]);
        const previewMat = new THREE.LineBasicMaterial({ color: 0xff8800, linewidth: 4, depthTest: false, opacity: 0.8, transparent: true });
        const previewLine = new THREE.Line(previewGeom, previewMat);
        previewLine.renderOrder = 999;
        viewer.impl.addOverlay(remoteOverlay, previewLine);
      }

      // Draw closing line preview (back to first point) - THICKER & DARKER
      if (pts.length >= 3) {
        const closedPts = [...pts, pts[0]].map(p => new THREE.Vector3(p.x, p.y, p.z));
        const geom2 = new THREE.BufferGeometry().setFromPoints(closedPts);
        const line2 = new THREE.Line(geom2, new THREE.LineBasicMaterial({ color: 0x0088ff, linewidth: 4, depthTest: false, opacity: 0.7, transparent: true }));
        line2.renderOrder = 999;
        viewer.impl.addOverlay(remoteOverlay, line2);
        // Filled polygon for visibility (DARKER)
        const shape = new THREE.Shape(pts.map((p, i) => new THREE.Vector2(p.x, p.y)));
        const fillGeom = new THREE.ShapeGeometry(shape);
        const fillMat = new THREE.MeshBasicMaterial({ color: 0x00dd00, opacity: 0.25, transparent: true, depthWrite: false, depthTest: false });
        const mesh = new THREE.Mesh(fillGeom, fillMat);
        if (remoteBaseZRef.current != null) mesh.position.z = remoteBaseZRef.current;
        mesh.renderOrder = 998;
        viewer.impl.addOverlay(remoteOverlay, mesh);
      }
      viewer.impl.invalidate(true);
    } catch { }
  };
  const remoteOnViewerMove = (ev: MouseEvent) => {
    try {
      if (!viewer?.impl || !remoteActiveRef.current) return;
      if (remoteBaseZRef.current == null) {
        const hit = viewer.impl.hitTest(ev.clientX, ev.clientY, true);
        if (hit?.point?.z != null) remoteBaseZRef.current = hit.point.z; else {
          try { remoteBaseZRef.current = viewer.model?.getBoundingBox?.().min?.z ?? 0; } catch { remoteBaseZRef.current = 0; }
        }
      }
      const z = remoteBaseZRef.current ?? 0;
      const p = remoteWorldOnZ(ev.clientX, ev.clientY, z);
      if (!p) return;
      if (remotePointsRef.current.length >= 2 && remoteIsNearFirst(p)) {
        const a = remotePointsRef.current[0];
        remoteHoverRef.current = { x: a.x, y: a.y, z: a.z };
      } else {
        remoteHoverRef.current = { x: p.x, y: p.y, z };
      }
      remoteDrawPreview();
    } catch { }
  };
  const remoteOnViewerClick = (ev: MouseEvent) => {
    try {
      if (!viewer?.impl || !remoteActiveRef.current) return;
      console.log('[FMPanel][remoteOnViewerClick] Click detected, remoteActive:', remoteActiveRef.current);
      if (remoteBaseZRef.current == null) {
        const hit = viewer.impl.hitTest(ev.clientX, ev.clientY, true);
        if (hit?.point?.z != null) remoteBaseZRef.current = hit.point.z; else {
          try { remoteBaseZRef.current = viewer.model?.getBoundingBox?.().min?.z ?? 0; } catch { remoteBaseZRef.current = 0; }
        }
        console.log('[FMPanel][remoteOnViewerClick] Base Z initialized:', remoteBaseZRef.current);
      }
      const z = remoteBaseZRef.current ?? 0;
      let p = null as any;
      // Try snapper first
      try {
        if (remoteSnapperRef.current && typeof remoteSnapperRef.current.getSnapResult === 'function') {
          const sr = remoteSnapperRef.current.getSnapResult();
          if (sr) {
            const gp = (sr.getPoint && sr.getPoint()) || (sr.intersectPoint) || (sr.point) || null;
            if (gp && gp.x != null && gp.y != null && gp.z != null) {
              p = gp;
              console.log('[FMPanel][remoteOnViewerClick] Snapped point:', p);
            }
          }
        }
      } catch (e) {
        console.warn('[FMPanel][remoteOnViewerClick] Snap failed:', e);
      }
      if (!p) {
        p = remoteWorldOnZ(ev.clientX, ev.clientY, z);
        console.log('[FMPanel][remoteOnViewerClick] Fallback worldOnZ point:', p);
      }
      if (!p) return;
      if (remotePointsRef.current.length >= 3 && remoteIsNearFirst(p)) {
        // auto finish
        console.log('[FMPanel][remoteOnViewerClick] Near first point, finishing. Total points:', remotePointsRef.current.length);
        try { childWinRef.current?.postMessage?.({ type: 'FM_DRAW_DONE', points: remotePointsRef.current }, '*'); } catch { }
        remoteDetach();
        return;
      }
      const point = { x: p.x, y: p.y, z };
      remotePointsRef.current.push(point);
      console.log('[FMPanel][remoteOnViewerClick] Point added. Total:', remotePointsRef.current.length, 'Point:', point);
      childWinRef.current?.postMessage?.({ type: 'FM_DRAW_POINT', point }, '*');
      remoteDrawPreview();
    } catch (e) {
      console.error('[FMPanel][remoteOnViewerClick] Error:', e);
    }
  };
  const remoteOnViewerDblClick = (ev: MouseEvent) => {
    try {
      if (!viewer?.impl || !remoteActiveRef.current) return;
      if (remotePointsRef.current.length >= 3) {
        try { childWinRef.current?.postMessage?.({ type: 'FM_DRAW_DONE', points: remotePointsRef.current }, '*'); } catch { }
        remoteDetach();
      }
    } catch { }
  };
  const remoteAttach = async () => {
    try {
      if (!viewer || remoteActiveRef.current) {
        console.warn('[FMPanel][remoteAttach] Cannot attach: viewer:', !!viewer, 'already active:', remoteActiveRef.current);
        return;
      }
      console.log('[FMPanel][remoteAttach] Attaching remote drawing handlers');
      remotePointsRef.current = [];
      remoteBaseZRef.current = null;
      remoteHoverRef.current = null;
      remoteActiveRef.current = true;
      // Load snapper if not already loaded
      console.log('[FMPanel][remoteAttach] Loading snapper extensions...');
      try {
        const measureExt = await viewer.loadExtension?.('Autodesk.Measure');
        const maybeSnapper = measureExt?.getSnapper?.();
        if (maybeSnapper) {
          remoteSnapperRef.current = maybeSnapper;
          try { maybeSnapper.activateSnap?.(true); } catch {}
          console.log('[FMPanel][remoteAttach] Measure snapper activated');
        }
      } catch (e) {
        console.warn('[FMPanel][remoteAttach] Measure extension failed:', e);
      }
      try {
        if (!remoteSnapperRef.current) {
          await viewer.loadExtension?.('Autodesk.Snapping');
          const S = (window as any).Autodesk?.Viewing?.Extensions?.Snapping;
          if (S) {
            const sn = new S.Snapper(viewer, true);
            viewer.toolController?.registerTool?.(sn);
            viewer.toolController?.activateTool?.(sn.getName?.());
            try { sn.activateSnap?.(true); } catch {}
            remoteSnapperRef.current = sn;
            console.log('[FMPanel][remoteAttach] Snapping tool activated');
          }
        }
      } catch (e) {
        console.warn('[FMPanel][remoteAttach] Snapping extension failed:', e);
      }
      viewer.container?.addEventListener('click', remoteOnViewerClick as any, true);
      viewer.container?.addEventListener('mousemove', remoteOnViewerMove as any, true);
      viewer.container?.addEventListener('dblclick', remoteOnViewerDblClick as any, true);
      try { viewer.container && ((viewer.container as HTMLElement).style.cursor = 'crosshair'); } catch { }
      if (!viewer.impl.overlayScenes?.[remoteOverlay]) viewer.impl.createOverlayScene(remoteOverlay);
      console.log('[FMPanel][remoteAttach] Remote drawing activated, listeners attached');
    } catch (e) {
      console.error('[FMPanel][remoteAttach] Error:', e);
    }
  };
  const remoteDetach = () => {
    try {
      console.log('[FMPanel][remoteDetach] Detaching remote drawing handlers');
      if (!viewer) return;
      viewer.container?.removeEventListener('click', remoteOnViewerClick as any, true);
      viewer.container?.removeEventListener('mousemove', remoteOnViewerMove as any, true);
      viewer.container?.removeEventListener('dblclick', remoteOnViewerDblClick as any, true);
      try { viewer.container && ((viewer.container as HTMLElement).style.cursor = 'default'); } catch { }
      try { remoteSnapperRef.current?.deactivateSnap?.(); } catch {}
      try {
        const name = remoteSnapperRef.current?.getName?.();
        if (name) viewer.toolController?.deactivateTool?.(name);
      } catch {}
      remoteActiveRef.current = false;
      remoteHoverRef.current = null;
      remoteClearOverlay();
      console.log('[FMPanel][remoteDetach] Remote drawing deactivated');
    } catch (e) {
      console.error('[FMPanel][remoteDetach] Error:', e);
    }
  };

  // Remote placement handlers (single-point manual asset)
  const remotePlaceOnKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      try { (childWinRef.current as Window | null)?.postMessage?.({ type: 'FM_PLACE_CANCELLED' }, '*'); } catch { }
      // cleanup
      try { if (viewer?.container) { (viewer.container as HTMLElement).style.cursor = 'default'; } } catch { }
      viewer?.container?.removeEventListener('click', remotePlaceOnClick as any, true);
      window.removeEventListener('keydown', remotePlaceOnKeyDown as any, true);
      remotePlaceActiveRef.current = false;
      // restore overlay
      try {
        const ov = remotePlaceOverlayElRef.current;
        const ovChild = remotePlaceOverlayChildRef.current;
        if (ov) {
          ov.style.pointerEvents = '';
          if (remotePlacePrevBackdropRef.current != null) ov.style.backdropFilter = remotePlacePrevBackdropRef.current;
          if (remotePlacePrevBgRef.current != null) ov.style.background = remotePlacePrevBgRef.current;
          if (remotePlacePrevBgRef.current != null) ov.style.backgroundColor = remotePlacePrevBgRef.current;
        }
        if (ovChild) ovChild.style.display = remotePlacePrevDisplayRef.current ?? '';
      } catch { }
    }
  };
  const remotePlaceOnClick = async (ev: MouseEvent) => {
    try {
      if (!viewer || !remotePlaceActiveRef.current) return;
      const payload = remotePlaceAssetRef.current;
      const container = viewer.container as HTMLElement;
      const canvas = container.querySelector('canvas') as HTMLCanvasElement | null;
      // determine point and clicked dbId/model
      let pt: any = null;
      let locDbId: number | undefined;
      let locModel: any | undefined;
      const res = viewer.impl.hitTest(ev.clientX, ev.clientY, true);
      if (res && res.point) {
        pt = res.point;
        if (res.dbId != null && res.model) { locDbId = res.dbId; locModel = res.model; }
      }
      if (!pt) {
        // Fallback: use current aggregate selection center
        let dbId: number | undefined; let model: any = viewer.model;
        const agg: any[] | null = await new Promise(resolve => viewer.getAggregateSelection ? viewer.getAggregateSelection(resolve) : resolve(null));
        if (agg && agg.length > 0 && agg[0].selection?.length > 0) { dbId = agg[0].selection[0]; model = agg[0].model; }
        else { const sel = viewer.getSelection?.(); if (sel && sel.length > 0) dbId = sel[0]; }
        if (dbId != null && model) {
          const THREE = (window as any).THREE;
          const frags = model.getFragmentList?.();
          if (THREE && frags) {
            const box = new THREE.Box3();
            frags.enumNodeFragments(dbId, (fid: number) => {
              const fb = new THREE.Box3();
              frags.getWorldBounds(fid, fb);
              box.union(fb);
            });
            if (!box.isEmpty()) {
              pt = box.getCenter(new THREE.Vector3());
              locDbId = dbId; locModel = model;
            }
          }
        }
      }
      if (!pt) {
        // keep placing until user clicks a valid spot or selects an object
        return;
      }
      // Draw overlay in main viewer
      const THREE = (window as any).THREE;
      if (THREE) {
        if (!(viewer as any)._fmOverlayCreated) {
          viewer.impl.createOverlayScene('fm-placeholders');
          (viewer as any)._fmOverlayCreated = true;
        }
        const size = payload?.size ?? 0.3;
        const geom = (payload?.shape || 'cube') === 'sphere'
          ? new THREE.SphereGeometry(size / 2, 12, 12)
          : new THREE.BoxGeometry(size, size, size);
        const mat = new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.85 });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.set(pt.x, pt.y, pt.z);
        viewer.impl.addOverlay('fm-placeholders', mesh);
        viewer.impl.invalidate(true);
      }
      // derive human-friendly location
      let newLocation: string | undefined;
      try {
        if (locModel && locDbId != null) {
          const props: any = await new Promise(resolve => locModel.getProperties(locDbId!, resolve));
          const getVal = (names: string[]): string | undefined => {
            const lower = names.map(n => n.toLowerCase());
            const p = props?.properties?.find((p: any) => { const dn = p.displayName?.toLowerCase?.(); return dn && (lower.includes(dn) || lower.some(n => dn.includes(n))); });
            return p?.displayValue?.toString();
          };
          const building = getVal(['Building']);
          const level = getVal(['Level', 'Reference Level']);
          const room = getVal(['Room', 'Space']);
          const parts = [building, level, room].filter(Boolean) as string[];
          if (parts.length) newLocation = parts.join(' - ');
        }
      } catch { }
      // Fallback: AEC LevelsExtension by Z if properties didn't yield a level
      if (!newLocation) {
        try {
          const lev = await viewer.loadExtension?.('Autodesk.AEC.LevelsExtension');
          const floorData = lev?.floorSelector?.floorData;
          if (floorData && floorData.length) {
            const z = pt.z;
            const matched = floorData.find((f: any) => (z >= (f.zMin ?? -Infinity)) && (z <= (f.zMax ?? Infinity)));
            if (matched) newLocation = [matched.building || undefined, matched.name || matched.label || undefined].filter(Boolean).join(' - ');
          }
        } catch { }
      }
      // notify child window
      try {
        (childWinRef.current as Window | null)?.postMessage?.({
          type: 'FM_PLACE_DONE',
          assetId: payload?.assetId,
          point: { x: pt.x, y: pt.y, z: pt.z },
          location: newLocation
        }, '*');
      } catch { }
      // cleanup
      try { if (container) { container.style.cursor = 'default'; if (canvas) canvas.style.cursor = 'default'; } } catch { }
      viewer.container?.removeEventListener('click', remotePlaceOnClick as any, true);
      window.removeEventListener('keydown', remotePlaceOnKeyDown as any, true);
      remotePlaceActiveRef.current = false;
      // restore overlay
      try {
        const ov = remotePlaceOverlayElRef.current;
        const ovChild = remotePlaceOverlayChildRef.current;
        if (ov) ov.style.pointerEvents = '';
        if (ovChild) ovChild.style.display = remotePlacePrevDisplayRef.current ?? '';
      } catch { }
    } catch { }
  };
  const remotePlaceAttach = (payload: { assetId: string; shape: 'cube' | 'sphere'; size: number }) => {
    try {
      if (!viewer || remotePlaceActiveRef.current) return;
      remotePlaceAssetRef.current = payload;
      remotePlaceActiveRef.current = true;
      // crosshair cursor
      try { viewer.container && ((viewer.container as HTMLElement).style.cursor = 'crosshair'); } catch { }
      viewer.container?.addEventListener('click', remotePlaceOnClick as any, true);
      window.addEventListener('keydown', remotePlaceOnKeyDown as any, true);
    } catch { }
  };
  const remotePlaceDetach = () => {
    try {
      if (!viewer) return;
      viewer.container?.removeEventListener('click', remotePlaceOnClick as any, true);
      window.removeEventListener('keydown', remotePlaceOnKeyDown as any, true);
      try { viewer.container && ((viewer.container as HTMLElement).style.cursor = 'default'); } catch { }
      remotePlaceActiveRef.current = false;
      remotePlaceAssetRef.current = null;
      // restore overlay
      try {
        const ov = remotePlaceOverlayElRef.current;
        const ovChild = remotePlaceOverlayChildRef.current;
        if (ov) ov.style.pointerEvents = '';
        if (ovChild) ovChild.style.display = remotePlacePrevDisplayRef.current ?? '';
      } catch { }
    } catch { }
  };

  const modalTitle = React.useMemo(() => {
    if (!section) return 'FM';
    if (section.group === 'assets') return section.item === 'asset-list' ? 'Assets' : 'Assets';
    if (section.group === 'spaces') return section.item === 'space-list' ? 'Spaces' : 'Spaces';
    if (section.group === 'maintenance') {
      return section.item === 'scheduled' ? 'Maintenance' : ' Maintenance';
    }
    if (section.group === 'work-orders') {
      return section.item === 'service-requests' ? 'Work Orders' : 'Work Orders';
    }
    if (section.group === 'upcoming-activities') {
      return section.item === 'ongoing' ? 'Maintenance activities' : 
             section.item === 'archived' ? 'Maintenance Archived' : 'Maintenance activities';
    }
    return 'FM';
  }, [section]);

  // Initialize defaults and modal position
  useEffect(() => {
    // Default section in standalone mode
    if (isStandalone && !section) {
      setSection({ group: 'spaces', item: 'space-list' });
    }
    if (showModal) {
      try { setModalPos({ x: window.innerWidth / 2, y: window.innerHeight / 2 }); } catch { }
    }
  }, [showModal, isStandalone, section]);

  // If user switches section/menu while a panel is minimized, restore (close minimized) so new panel can open normally
  useEffect(() => {
    if (showModalMinimized) {
      setShowModalMinimized(false);
      // also close any open modal so the new section can open its panel freshly
      setShowModal(false);
    }
  }, [section]);

  // Allow feature panels (e.g., CreateSpace) to programmatically minimize/restore modal and adjust overlay blur
  const drawOverlayPrevRef = useRef<{ backdrop?: string; bg?: string; bgColor?: string } | null>(null);
  useEffect(() => {
    const onMin = () => {
      try {
        console.log('[FMPanel] fm-modal-minimize received');
        setShowModalMinimized(true);
        const ov = document.getElementById('fm-modal-overlay') as HTMLElement | null;
        if (ov) {
          drawOverlayPrevRef.current = { backdrop: ov.style.backdropFilter, bg: ov.style.background, bgColor: ov.style.backgroundColor };
          ov.style.pointerEvents = 'none';
          ov.style.backdropFilter = 'none';
          ov.style.background = 'transparent';
          ov.style.backgroundColor = 'transparent';
        }
      } catch {}
    };
    const onRestore = () => {
      try {
        console.log('[FMPanel] fm-modal-restore received');
        setShowModalMinimized(false);
        const ov = document.getElementById('fm-modal-overlay') as HTMLElement | null;
        if (ov) {
          const prev = drawOverlayPrevRef.current;
          ov.style.pointerEvents = '';
          if (prev) {
            ov.style.backdropFilter = prev.backdrop || '';
            ov.style.background = prev.bg || '';
            ov.style.backgroundColor = prev.bgColor || '';
          } else {
            ov.style.backdropFilter = '';
            ov.style.background = '';
            ov.style.backgroundColor = '';
          }
        }
      } catch {}
    };
    window.addEventListener('fm-modal-minimize', onMin as any);
    window.addEventListener('fm-modal-restore', onRestore as any);
    return () => {
      window.removeEventListener('fm-modal-minimize', onMin as any);
      window.removeEventListener('fm-modal-restore', onRestore as any);
    };
  }, []);

  // Bridge messages from child standalone window (only in main window)
  useEffect(() => {
    if (isStandalone) return; // child handles its own UI
    const onMsg = (e: MessageEvent) => {
      const d: any = e.data;
      if (!d || typeof d !== 'object') return;
      console.log('[FMPanel][onMsg] Received message from child:', d.type, d);
      if (d.type === 'FM_DRAW_START') {
        if (!viewer) {
          console.warn('[FMPanel][onMsg] No viewer, cancelling remote draw');
          try { (e.source as Window | null)?.postMessage?.({ type: 'FM_DRAW_CANCELLED', reason: 'NO_VIEWER' }, '*'); } catch { }
          return;
        }
        console.log('[FMPanel][onMsg] Starting remote drawing for child window');
        // Remember sender as our child window for point streaming
        try { childWinRef.current = (e.source as Window) || null; } catch { }
        remoteAttach();
      } else if (d.type === 'FM_DRAW_UNDO') {
        // Remove last point and update preview
        console.log('[FMPanel][onMsg] Undo last point. Before:', remotePointsRef.current.length);
        remotePointsRef.current.pop();
        console.log('[FMPanel][onMsg] After undo:', remotePointsRef.current.length);
        remoteDrawPreview();
      } else if (d.type === 'FM_DRAW_FINISH') {
        if (!viewer) return;
        const pts = remotePointsRef.current;
        console.log('[FMPanel][onMsg] Finish requested. Points:', pts.length);
        if (pts.length >= 3) {
          console.log('[FMPanel][onMsg] Sending FM_DRAW_DONE with', pts.length, 'points');
          try { (e.source as Window | null)?.postMessage?.({ type: 'FM_DRAW_DONE', points: pts }, '*'); } catch { }
        } else {
          console.warn('[FMPanel][onMsg] Not enough points, cancelling');
          try { (e.source as Window | null)?.postMessage?.({ type: 'FM_DRAW_CANCELLED', reason: 'NOT_ENOUGH_POINTS' }, '*'); } catch { }
        }
        remoteDetach();
      } else if (d.type === 'FM_DRAW_CANCEL') {
        console.log('[FMPanel][onMsg] Cancel requested');
        try { (e.source as Window | null)?.postMessage?.({ type: 'FM_DRAW_CANCELLED' }, '*'); } catch { }
        remoteDetach();
      } else if (d.type === 'FM_PLACE_START') {
        if (!viewer) {
          try { (e.source as Window | null)?.postMessage?.({ type: 'FM_PLACE_CANCELLED', reason: 'NO_VIEWER' }, '*'); } catch { }
          return;
        }
        try { childWinRef.current = (e.source as Window) || null; } catch { }
        // Disable modal overlay interactions and hide modal panel while placing from child window
        try {
          const ov = document.getElementById('fm-modal-overlay') as HTMLElement | null;
          remotePlaceOverlayElRef.current = ov;
          if (ov) {
            // store previous visual styles
            remotePlacePrevBackdropRef.current = ov.style.backdropFilter || '';
            remotePlacePrevBgRef.current = ov.style.background || ov.style.backgroundColor || '';
            // make overlay click-through and remove blur/background
            ov.style.pointerEvents = 'none';
            ov.style.backdropFilter = 'none';
            ov.style.background = 'transparent';
            ov.style.backgroundColor = 'transparent';
            const ovChild = ov.firstElementChild as HTMLElement | null;
            remotePlaceOverlayChildRef.current = ovChild;
            if (ovChild) {
              remotePlacePrevDisplayRef.current = ovChild.style.display || '';
              ovChild.style.display = 'none';
            }
          }
        } catch { }
        const payload = {
          assetId: d.assetId as string,
          shape: (d.shape as 'cube' | 'sphere') || 'cube',
          size: (typeof d.size === 'number' && d.size > 0 ? d.size : 0.3)
        };
        remotePlaceAttach(payload);
      } else if (d.type === 'FM_PLACE_CANCEL') {
        try { (e.source as Window | null)?.postMessage?.({ type: 'FM_PLACE_CANCELLED' }, '*'); } catch { }
        remotePlaceDetach();
      } else if (d.type === 'FM_SELECT_OBJECT_START') {
        // Handle object selection request from standalone ticket form
        if (!viewer) {
          try { (e.source as Window | null)?.postMessage?.({ type: 'FM_SELECTION_CANCELLED', reason: 'NO_VIEWER' }, '*'); } catch { }
          return;
        }

        try { childWinRef.current = (e.source as Window) || null; } catch { }

        // Get current selection
        viewer.getAggregateSelection?.((selectionData: any) => {
          // Handle both array and single model object
          let model: any;
          let selectedIds: number[] = [];

          if (Array.isArray(selectionData)) {
            if (selectionData.length === 0) {
              try { (e.source as Window | null)?.postMessage?.({ type: 'FM_SELECTION_CANCELLED', reason: 'NO_SELECTION' }, '*'); } catch { }
              return;
            }
            const firstItem = selectionData[0];
            model = firstItem.model;
            selectedIds = firstItem.selection || [];
          } else if (selectionData && selectionData.selector) {
            model = selectionData;
            selectedIds = model.selector?.getSelection?.() || [];
          } else {
            try { (e.source as Window | null)?.postMessage?.({ type: 'FM_SELECTION_CANCELLED', reason: 'NO_SELECTION' }, '*'); } catch { }
            return;
          }

          if (!selectedIds || selectedIds.length === 0) {
            try { (e.source as Window | null)?.postMessage?.({ type: 'FM_SELECTION_CANCELLED', reason: 'NO_SELECTION' }, '*'); } catch { }
            return;
          }

          const dbId = selectedIds[0];

          // Get object properties
          model.getProperties(dbId, (props: any) => {
            const getProp = (names: string[]): string | undefined => {
              const lower = names.map((n: string) => n.toLowerCase());
              const p = props?.properties?.find((p: any) => {
                const dn = p.displayName?.toLowerCase?.();
                return dn && (lower.includes(dn) || lower.some((n: string) => dn.includes(n)));
              });
              return p?.displayValue?.toString();
            };

            const name = props?.name || getProp(['Name', 'Nome']);
            const rawCategory = getProp(['Category', 'Categoria', 'OmniClass Title', 'Titolo OmniClass', 'Descrizione']);
            const ifcType = getProp(['Export Type to IFC As', 'Esporta tipo in formato IFC con nome', 'IFC Type', 'IfcClass']);
            const ifcPredefined = getProp(['IFC Predefined Type', 'Tipo predefinito IFC']);
            let level = getProp(['Level', 'Reference Level', 'Livello', 'Livello abaco']);
            if (!level || /^\d+(\.\d+)?$/.test(level)) {
              try {
                const levelProps = (props?.properties || []).filter((p: any) => (p.displayName || '').toString().toLowerCase() === 'level');
                const preferred = levelProps.find((p: any) => p.type === 20 || (p.displayCategory || '').toString().toLowerCase() === 'constraints')
                  || levelProps[levelProps.length - 1];
                if (preferred && preferred.displayValue != null) level = preferred.displayValue.toString();
              } catch {}
            }
            let room = getProp(['Room', 'Space', 'Locale']);
            const spaceCode = getProp(['Space Code', 'Number', 'Mark', 'Nome codice']);
            const building = getProp(['Building', 'Edificio']);

            // Use spatial bounding as fallback for room detection (check for empty string too)
            if ((!room || room.trim() === '') && (window as any).sensorContext?.findRoomForObject) {
              try {
                const roomData = (window as any).sensorContext.findRoomForObject(dbId);
                if (roomData?.name) {
                  room = roomData.name;
                  console.log('🏠 [Prefill] Using spatial bounding room:', room);
                }
              } catch (err) {
                console.warn('[Prefill] Spatial bounding fallback failed', err);
              }
            }

            // Build category with preference: IFC type -> mapped label; else mapped raw category -> IFC predefined -> raw
            let matchedCategory = '';
            if (ifcType) {
              const ic = ifcType.toString().toLowerCase();
              for (const [it, m] of Object.entries(CATEGORY_MAPPING)) {
                if (m.ifc.toLowerCase() === ic) { matchedCategory = `${it} / ${m.english} (${m.ifc})`; break; }
              }
              if (!matchedCategory) matchedCategory = ifcType;
            }
            if (!matchedCategory && rawCategory) {
              const rc = rawCategory.toString().toLowerCase();
              for (const [it, m] of Object.entries(CATEGORY_MAPPING)) {
                if (rc.includes(it.toLowerCase()) || rc.includes(m.english.toLowerCase()) || rc.includes(m.ifc.toLowerCase())) {
                  matchedCategory = `${it} / ${m.english} (${m.ifc})`; break;
                }
              }
              if (!matchedCategory) matchedCategory = rawCategory;
            }
            if (!matchedCategory && ifcPredefined) matchedCategory = ifcPredefined;

            // Send data back to standalone window
            try {
              (e.source as Window | null)?.postMessage?.({
                type: 'FM_SELECTION_DATA',
                item: name || `Object ${dbId}`,
                itemDbId: dbId,
                category: matchedCategory || rawCategory || '',
                building: building || '',
                level: level || '',
                room: room || '',
                spaceCode: spaceCode || ''
              }, '*');
            } catch (err) {
              console.error('[Selection] Error sending data', err);
            }
          });
        });
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [isStandalone, viewer]);

  const handleMouseMove = (ev: MouseEvent) => {
    const { startMouseX, startMouseY, startX, startY } = dragRef.current;
    const dx = ev.clientX - startMouseX;
    const dy = ev.clientY - startMouseY;
    let nx = startX + dx;
    let ny = startY + dy;
    const rect = modalRef.current?.getBoundingClientRect();
    if (rect) {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const halfW = rect.width / 2;
      const halfH = rect.height / 2;
      const pad = 12;
      const minX = halfW + pad;
      const maxX = vw - halfW - pad;
      const minY = halfH + pad;
      const maxY = vh - halfH - pad;
      nx = Math.max(minX, Math.min(maxX, nx));
      ny = Math.max(minY, Math.min(maxY, ny));
    }
    setModalPos({ x: nx, y: ny });
  };

  const handleMouseUp = () => {
    setDragging(false);
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  };

  const onHeaderMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current.startMouseX = e.clientX;
    dragRef.current.startMouseY = e.clientY;
    dragRef.current.startX = modalPos.x;
    dragRef.current.startY = modalPos.y;
    setDragging(true);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Resize handlers
  const handleResizeMove = (ev: MouseEvent) => {
    const { startMouseX, startMouseY, startWidth, startHeight } = resizeRef.current;
    const dx = ev.clientX - startMouseX;
    const dy = ev.clientY - startMouseY;
    const newWidth = Math.max(400, Math.min(window.innerWidth - 20, startWidth + dx));
    const newHeight = Math.max(300, Math.min(window.innerHeight - 20, startHeight + dy));
    setModalSize({ width: newWidth, height: newHeight });
  };

  const handleResizeUp = () => {
    setResizing(false);
    window.removeEventListener('mousemove', handleResizeMove);
    window.removeEventListener('mouseup', handleResizeUp);
  };

  const onResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current.startMouseX = e.clientX;
    resizeRef.current.startMouseY = e.clientY;
    resizeRef.current.startWidth = modalSize.width;
    resizeRef.current.startHeight = modalSize.height;
    setResizing(true);
    window.addEventListener('mousemove', handleResizeMove);
    window.addEventListener('mouseup', handleResizeUp);
  };

  // Render content based on selected section
  const renderSectionContent = () => {
    if (!section || !section.item) {
      // Show which menu is selected
      const menuName = section?.group === 'assets' ? 'Assets' :
        section?.group === 'spaces' ? 'Spaces' :
          section?.group === 'maintenance' ? 'Maintenance' :
            section?.group === 'work-orders' ? 'Work Orders' :
              section?.group === 'upcoming-activities' ? 'Maintenance activities' :
                'FM Tools';

      return (
        <div className="text-center py-8">
          <Building2 className="w-16 h-16 mx-auto mb-4 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-300 mb-2">{menuName}</h3>
          <p className="text-gray-500">Select a command from the submenu to get started</p>
        </div>
      );
    }

    if (section.group === 'assets' && section.item === 'asset-list') return <AssetList projectId={projectId} viewer={viewer} onScheduleMaintenance={(assets) => {
      setPreSelectedAssets(assets);
      setSection({ group: 'maintenance', item: 'scheduled' });
      if (!isStandalone) setShowModal(true);
    }} />;
    if (section.group === 'assets' && section.item === 'create-asset') return <CreateAsset projectId={projectId} viewer={viewer} />;
    if (section.group === 'spaces' && section.item === 'space-list') return <SpaceList projectId={projectId} viewer={viewer} />;
    if (section.group === 'spaces' && section.item === 'create-space') return <CreateSpace projectId={projectId} viewer={viewer} standalone={isStandalone} />;
  if (section.group === 'maintenance' && section.item === 'scheduled') return <ScheduledMaintenance projectId={projectId} viewer={viewer} preSelectedAssets={preSelectedAssets} onClearPreSelected={() => setPreSelectedAssets([])} />;
    if (section.group === 'maintenance' && section.item === 'ticket') return <TicketForm projectId={projectId} viewer={viewer} />;
    if (section.group === 'work-orders' && section.item === 'pending-approvals') return <PendingApprovals projectId={projectId} />;
    if (section.group === 'work-orders' && section.item === 'service-requests') return <ServiceRequests projectId={projectId} />;
    if (section.group === 'work-orders' && section.item === 'reports') return <MaintenanceReports projectId={projectId} />;
    if (section.group === 'work-orders' && section.item === 'fm-editor') return <FMFieldEditor projectId={projectId} />;
  if (section.group === 'upcoming-activities' && section.item === 'ongoing') return <OngoingMaintenance projectId={projectId} />;
  if (section.group === 'upcoming-activities' && section.item === 'planned') return <PlannedMaintenance projectId={projectId} viewer={viewer} />;
  if (section.group === 'upcoming-activities' && section.item === 'archived') return <OngoingMaintenance projectId={projectId} archived={true} />;

    return null;
  };

  // Sidebar menu (shared)
  const Sidebar = (
    <div className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col h-full">
      <div className="p-4 border-b border-gray-800">
        <h2 className="text-xl font-bold text-white mb-3 text-center">FM</h2>
      </div>

      {/* Vertical menu (BIM-style) - Top 5 headings only */}
      <div className="p-3 space-y-1.5 border-b border-gray-800">
        {/* Assets */}
        <button
          onClick={() => {
            setSection(defaultItemForGroup('assets'));
          }}
          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md border text-sm ${section?.group === 'assets' ? 'bg-blue-600 text-white border-transparent' : 'bg-gray-800 text-gray-200 border-gray-700 hover:bg-gray-700'}`}
        >
          <Package className="h-4 w-4" />
          <span className="font-medium">Assets</span>
        </button>

        {/* Spaces */}
        <button
          onClick={() => {
            setSection(defaultItemForGroup('spaces'));
          }}
          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md border text-sm ${section?.group === 'spaces' ? 'bg-blue-600 text-white border-transparent' : 'bg-gray-800 text-gray-200 border-gray-700 hover:bg-gray-700'}`}
        >
          <Square className="h-4 w-4" />
          <span className="font-medium">Spaces</span>
        </button>

        {/* Maintenance */}
        <button
          onClick={() => {
            setSection(defaultItemForGroup('maintenance'));
          }}
          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md border text-sm ${section?.group === 'maintenance' ? 'bg-blue-600 text-white border-transparent' : 'bg-gray-800 text-gray-200 border-gray-700 hover:bg-gray-700'}`}
        >
          <Wrench className="h-4 w-4" />
          <span className="font-medium">Maintenance</span>
        </button>

        {/* Work Orders */}
        <button
          onClick={() => {
            setSection(defaultItemForGroup('work-orders'));
          }}
          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md border text-sm ${section?.group === 'work-orders' ? 'bg-blue-600 text-white border-transparent' : 'bg-gray-800 text-gray-200 border-gray-700 hover:bg-gray-700'}`}
        >
          <ClipboardList className="h-4 w-4" />
          <span className="font-medium">Work orders</span>
        </button>

        {/* Upcoming Maintenance Activities */}
        <button
          onClick={() => {
            setSection(defaultItemForGroup('upcoming-activities'));
          }}
          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md border text-sm ${section?.group === 'upcoming-activities' ? 'bg-blue-600 text-white border-transparent' : 'bg-gray-800 text-gray-200 border-gray-700 hover:bg-gray-700'}`}
        >
          <CalendarClock className="h-4 w-4" />
          <span className="font-medium">Maintenance activities</span>
        </button>
      </div>

      {/* Content area - Shows submenu and content below the line */}
      <div className="flex-1 p-4 overflow-y-auto min-h-0">
        {section && (
          <div className="space-y-3">
            {/* Submenu Section Header - styled like BIM panel */}
            <div className="mb-2">
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2 text-white">
                {section.group === 'assets' && (<><Package className="h-5 w-5" />Asset Management</>)}
                {section.group === 'spaces' && (<><Square className="h-5 w-5" />Space Management</>)}
                {section.group === 'maintenance' && (<><Wrench className="h-5 w-5" />Maintenance Options</>)}
                {section.group === 'work-orders' && (<><ClipboardList className="h-5 w-5" />Work Order Management</>)}
                {section.group === 'upcoming-activities' && (<><CalendarClock className="h-5 w-5" />Activity Planning</>)}
              </h3>
            </div>

            {/* Submenu for selected group */}
            <div className="space-y-1.5">
              {section.group === 'assets' && (
                <>
                  <button
                    onClick={() => { setSection({ group: 'assets', item: 'asset-list' }); if (!isStandalone) setShowModal(true); }}
                    className={`w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${(isStandalone || showModal) && section.item === 'asset-list'
                      ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30'
                      : 'text-gray-300 hover:text-white hover:bg-gray-800/80 border border-transparent hover:border-gray-700'
                      }`}
                  >
                    Asset list
                  </button>
                  <button
                    onClick={() => { setSection({ group: 'assets', item: 'create-asset' }); if (!isStandalone) setShowModal(true); }}
                    className={`w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${(isStandalone || showModal) && section.item === 'create-asset'
                      ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30'
                      : 'text-gray-300 hover:text-white hover:bg-gray-800/80 border border-transparent hover:border-gray-700'
                      }`}
                  >
                    Create new asset
                  </button>
                </>
              )}
              {section.group === 'spaces' && (
                <>
                  <button
                    onClick={() => { setSection({ group: 'spaces', item: 'space-list' }); if (!isStandalone) setShowModal(true); }}
                    className={`w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${(isStandalone || showModal) && section.item === 'space-list'
                      ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30'
                      : 'text-gray-300 hover:text-white hover:bg-gray-800/80 border border-transparent hover:border-gray-700'
                      }`}
                  >
                    Space list
                  </button>
                  <button
                    onClick={() => { setSection({ group: 'spaces', item: 'create-space' }); if (!isStandalone) setShowModal(true); }}
                    className={`w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${(isStandalone || showModal) && section.item === 'create-space'
                      ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30'
                      : 'text-gray-300 hover:text-white hover:bg-gray-800/80 border border-transparent hover:border-gray-700'
                      }`}
                  >
                    Create new space
                  </button>
                </>
              )}
              {section.group === 'maintenance' && (
                <>
                  <button
                    onClick={() => { setSection({ group: 'maintenance', item: 'scheduled' }); if (!isStandalone) setShowModal(true); }}
                    className={`w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${(isStandalone || showModal) && section.item === 'scheduled'
                      ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30'
                      : 'text-gray-300 hover:text-white hover:bg-gray-800/80 border border-transparent hover:border-gray-700'
                      }`}
                  >
                    Scheduled maintenance
                  </button>
                  <button
                    onClick={() => { setSection({ group: 'maintenance', item: 'ticket' }); if (!isStandalone) setShowModal(true); }}
                    className={`w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${(isStandalone || showModal) && section.item === 'ticket'
                      ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30'
                      : 'text-gray-300 hover:text-white hover:bg-gray-800/80 border border-transparent hover:border-gray-700'
                      }`}
                  >
                    Ticket-based maintenance
                  </button>
                </>
              )}
              {section.group === 'work-orders' && (
                <>
                  <button
                    onClick={() => { setSection({ group: 'work-orders', item: 'service-requests' }); if (!isStandalone) setShowModal(true); }}
                    className={`w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${(isStandalone || showModal) && section.item === 'service-requests'
                      ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30'
                      : 'text-gray-300 hover:text-white hover:bg-gray-800/80 border border-transparent hover:border-gray-700'
                      }`}
                  >
                    Service requests
                  </button>
                  <button
                    onClick={() => { setSection({ group: 'work-orders', item: 'reports' }); if (!isStandalone) setShowModal(true); }}
                    className={`w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${(isStandalone || showModal) && section.item === 'reports'
                      ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30'
                      : 'text-gray-300 hover:text-white hover:bg-gray-800/80 border border-transparent hover:border-gray-700'
                      }`}
                  >
                    Maintenance reports
                  </button>
                </>
              )}
              {section.group === 'upcoming-activities' && (
                <>
                  <button
                    onClick={() => { setSection({ group: 'upcoming-activities', item: 'ongoing' }); if (!isStandalone) setShowModal(true); }}
                    className={`w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${(isStandalone || showModal) && section.item === 'ongoing'
                      ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30'
                      : 'text-gray-300 hover:text-white hover:bg-gray-800/80 border border-transparent hover:border-gray-700'
                      }`}
                  >
                    Ongoing maintenance
                  </button>
                  <button
                    onClick={() => { setSection({ group: 'upcoming-activities', item: 'planned' }); if (!isStandalone) setShowModal(true); }}
                    className={`w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${(isStandalone || showModal) && section.item === 'planned'
                      ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30'
                      : 'text-gray-300 hover:text-white hover:bg-gray-800/80 border border-transparent hover:border-gray-700'
                      }`}
                  >
                    Planned maintenance
                  </button>
                  <button
                    onClick={() => { setSection({ group: 'upcoming-activities', item: 'archived' }); if (!isStandalone) setShowModal(true); }}
                    className={`w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${(isStandalone || showModal) && section.item === 'archived'
                      ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30'
                      : 'text-gray-300 hover:text-white hover:bg-gray-800/80 border border-transparent hover:border-gray-700'
                      }`}
                  >
                    Maintenance Archived
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (isStandalone) {
    return (
      <div className="h-full w-full flex bg-gray-950">
        {Sidebar}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="p-4 border-b border-gray-800 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">{modalTitle}</h3>
          </div>
          <div className="p-4 flex-1 flex flex-col min-h-0 overflow-auto">
            {renderSectionContent()}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col h-full">
      {Sidebar}

      {showModal && !showModalMinimized && (
        // Make overlay pointer-events pass-through so the page can scroll while modal is open.
        <div id="fm-modal-overlay" className="fixed inset-0 backdrop-blur-sm bg-black/30 z-50 pointer-events-none">
          <div
            ref={modalRef}
            className="absolute bg-gray-800 rounded-lg shadow-xl mx-4 flex flex-col border border-gray-700 pointer-events-auto"
            style={{
              left: modalPos.x,
              top: modalPos.y,
              transform: 'translate(-50%, -50%)',
              width: `${modalSize.width}px`,
              height: `${modalSize.height}px`,
              maxWidth: 'calc(100vw - 20px)',
              maxHeight: 'calc(100vh - 20px)'
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between p-4 border-b border-gray-700 cursor-move select-none"
              onMouseDown={onHeaderMouseDown}
            >
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-white">{modalTitle}</h3>
              </div>
              <div className="flex items-center gap-2" onMouseDown={(e) => e.stopPropagation()}>
                <button
                  title={showModalMinimized ? 'Restore' : 'Minimize'}
                  onClick={() => setShowModalMinimized(s => !s)}
                  className="w-8 h-8 grid place-items-center rounded-full border border-gray-600 text-gray-300 hover:text-white hover:bg-gray-700"
                  aria-label="Minimize"
                >
                  <Minimize2 className="w-4 h-4" />
                </button>

                <button
                  title="Open in new window"
                  onClick={() => {
                    try {
                        // Capture minimal viewer context synchronously and persist so the standalone window can read it immediately
                        const getViewerContextSync = () => {
                          try {
                            const g = viewer?.model?.getData?.()?.guid || (viewer?.model?.id != null ? String(viewer.model.id) : undefined);
                            const urn = viewer?.model?.getData?.()?.urn || (viewer?.impl?.model?.myData?.urn);
                            
                            // Create composite modelGuid: guid|urn to ensure uniqueness
                            let modelGuid = '';
                            if (g && typeof g === 'string') {
                              modelGuid = g;
                              if (urn && typeof urn === 'string') {
                                modelGuid = `${g}|${urn}`;
                              }
                            }
                            
                            return { modelGuid, urn } as { modelGuid?: string; urn?: string };
                          } catch { return {}; }
                        };
                        try {
                          const ctxSync = getViewerContextSync();
                          if (projectId) {
                            try {
                              localStorage.setItem(`fm-context-${projectId}`, JSON.stringify(ctxSync));
                              console.log(`[Spaces][open] wrote fm-context-${projectId} =>`, ctxSync);
                            } catch {}
                          }
                        } catch { }

                        // Open window synchronously FIRST to avoid popup blockers
                        const features = `width=${Math.min(window.innerWidth-100, 1200)},height=${Math.min(window.innerHeight-100, 800)}`;
                        const s = encodeURIComponent(JSON.stringify(section));
                        const url = `${window.location.origin}/fm-standalone?section=${s}${projectId ? `&projectId=${projectId}` : ''}`;
                        const w = window.open(url, `_blank`, features);
                        if (w) childWinRef.current = w;

                        // Now capture prefill snapshot asynchronously and save to localStorage (non-blocking)
                        (async () => {
                          try {
                            const capturePrefillSnapshot = async (): Promise<Partial<AssetRecord> | null> => {
                              try {
                                if (!viewer) return null;
                                const getAgg = () => new Promise<any>((resolve) => viewer.getAggregateSelection ? viewer.getAggregateSelection(resolve) : resolve(null));
                                let dbId: number | undefined; let model: any = viewer.model;
                                const agg = await getAgg();
                                if (agg && agg.length > 0 && agg[0].selection?.length > 0) { dbId = agg[0].selection[0]; model = agg[0].model; }
                                else { const sel = viewer.getSelection?.(); if (sel && sel.length > 0) dbId = sel[0]; }
                                if (dbId == null || !model) return null;
                                const props: any = await new Promise(resolve => model.getProperties(dbId!, resolve));
                                const propArray: any[] = Array.isArray(props?.properties) ? props.properties : [];
                                const propsMap: Record<string, any> = {};
                                const propsLower: Record<string, any> = {};
                                for (const prop of propArray) {
                                  const name = (prop?.displayName ?? '').toString();
                                  if (!name) continue;
                                  const value = prop?.displayValue;
                                  propsMap[name] = value;
                                  propsLower[name.toLowerCase().trim()] = value;
                                }
                                const pick = (...keys: string[]): string | undefined => {
                                  for (const key of keys) {
                                    const direct = propsMap[key];
                                    if (direct !== undefined && direct !== null && direct !== '') return direct.toString();
                                    const lk = key.toLowerCase().trim();
                                    const lowerVal = propsLower[lk];
                                    if (lowerVal !== undefined && lowerVal !== null && lowerVal !== '') return lowerVal.toString();
                                  }
                                  return undefined;
                                };
                                const PROP_ALIASES: Record<string, string[]> = {
                                  brand: ['Manufacturer', 'Brand', 'Manufacturer Name', 'Produttore', 'Marca'],
                                  modelName: ['Model', 'Type Name', 'Model Number', 'Nome del tipo', 'Nome del tipo'],
                                  serial: ['Serial Number', 'Serial', 'Numero di serie'],
                                  installDate: ['Install Date', 'Installation Date', 'Data di installazione'],
                                  power: ['Power', 'Power Rating', 'kW', 'Dati elettrici', 'Alimentazione apparente'],
                                  capacity: ['Capacity', 'Capacità'],
                                  weight: ['Weight', 'Peso'],
                                  length: ['Length', 'Lunghezza'],
                                  width: ['Width', 'Larghezza'],
                                  height: ['Height', 'Thickness', 'Altezza'],
                                  material: ['Material', 'Structural Material', 'Materiale', 'Materiale strutturale'],
                                  level: ['Schedule Level','Livello abaco','Base Level','Reference Level','Livello di base','Livello superiore','Vincolo di base','Vincolo parte superiore','Base Constraint','Top Constraint','Constraint','Vincolo','Livello','Level','Piano','Piano Terra','Level 1'],
                                  room: ['Room', 'Space', 'Stanza', 'Locale', 'Space Code'],
                                  rawCategory: ['Category', 'Categoria', 'Type', 'Tipo', 'Nome del tipo', 'Category Name']
                                };
                                const pickAlias = (key: keyof typeof PROP_ALIASES) => pick(...PROP_ALIASES[key]);
                                const brand = pickAlias('brand');
                                const modelName = pickAlias('modelName');
                                const serial = pickAlias('serial');
                                const installDate = pickAlias('installDate');
                                const power = pickAlias('power');
                                const capacity = pickAlias('capacity');
                                const weight = pickAlias('weight');
                                const length = pickAlias('length');
                                const width = pickAlias('width');
                                const height = pickAlias('height');
                                const material = pickAlias('material');
                                const level = pickAlias('level');
                                const room = pickAlias('room');
                                const rawCategory = pickAlias('rawCategory') || pick('Category','Categoria','OmniClass Title','OmniClass','Tipo');
                                const mapToStandardCategoryLocal = (category?: string): string | undefined => {
                                  if (!category) return undefined;
                                  const cat = category.toLowerCase();
                                  for (const [it, m] of Object.entries(CATEGORY_MAPPING)) {
                                    if (cat.includes(it.toLowerCase()) || cat.includes(m.english.toLowerCase()) || cat.includes(m.ifc.toLowerCase())) {
                                      return `${it} / ${m.english} (${m.ifc})`;
                                    }
                                  }
                                  return category;
                                };
                                const category = mapToStandardCategoryLocal(rawCategory);
                                const dimensions = (length || width || height) ? `${length || ''} x ${width || ''} x ${height || ''}`.replace(/\s+x\s+x\s+/, '').trim() : undefined;
                                return {
                                  brand: brand || '',
                                  model: modelName || '',
                                  serialNumber: serial || '',
                                  installationDate: installDate || '',
                                  powerRating: power || '',
                                  capacity: capacity || '',
                                  weight: weight || '',
                                  dimensions: dimensions || '',
                                  material: material || '',
                                  location: [level, room].filter(Boolean).join(' - ') || '',
                                  category: category || ''
                                } as Partial<AssetRecord>;
                              } catch { return null; }
                            };
                            const prefill = await capturePrefillSnapshot();
                            if (projectId && prefill) {
                              try { localStorage.setItem(`fm-prefill-${projectId}`, JSON.stringify(prefill)); } catch {}
                            }
                          } catch (err) { console.error('Failed to capture context/prefill', err); }
                        })();
                        
                        // Close the current modal when opening new window
                        setShowModal(false);
                        setSection(s => s ? { ...s, item: null } : s);
                    } catch (err) { console.error('Failed to open standalone window', err); }
                  }}
                  className="w-8 h-8 grid place-items-center rounded-full border border-gray-600 text-gray-300 hover:text-white hover:bg-gray-700"
                  aria-label="Open in new window"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>

                <button
                  onClick={() => { setShowModal(false); setSection(s => s ? { ...s, item: null } : s); }}
                  className="w-8 h-8 grid place-items-center rounded-full border border-gray-600 text-gray-300 hover:text-white hover:bg-gray-700"
                  aria-label="Close"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            {/* Body - keep mounted; hide when minimized to avoid unmount/reload flicker */}
            <div className={`p-4 flex-1 flex flex-col min-h-0 overflow-auto ${showModalMinimized ? 'hidden' : ''}`}>
              {renderSectionContent()}
            </div>
            {/* Resize Handle */}
            <div
              onMouseDown={onResizeMouseDown}
              className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
              style={{
                background: 'linear-gradient(135deg, transparent 50%, rgba(156, 163, 175, 0.5) 50%)',
              }}
            />
          </div>
        </div>
      )}

      {/* Dock item when minimized */}
      {showModalMinimized && (
        <div className="fixed bottom-4 right-4 z-50">
          <button onClick={() => setShowModalMinimized(false)} title={modalTitle} className="group relative flex items-center gap-2 px-3 py-2 bg-gray-800/90 border border-gray-700 text-sm text-white rounded-lg shadow-lg hover:scale-105 transition-transform">
            <div className="w-8 h-8 bg-gray-900 rounded-full flex items-center justify-center ring-1 ring-gray-700">
              <span className="text-lg font-bold">{modalTitle?.[0] || 'F'}</span>
            </div>
            <div className="hidden group-hover:block text-xs text-gray-200">{modalTitle}</div>
          </button>
        </div>
      )}
    </div>
  );
}

