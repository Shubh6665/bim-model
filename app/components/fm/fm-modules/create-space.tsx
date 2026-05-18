"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Save } from "lucide-react";
import { load, save, K } from "../fm-panel-utils";
import type { SpaceRecord } from "../fm-panel-types";

interface CreateSpaceProps {
  projectId?: string;
  viewer?: any;
  standalone?: boolean;
}

export 
const CreateSpace: React.FC<{ projectId?: string; viewer?: any; standalone?: boolean; }> = ({ projectId, viewer, standalone }) => {
  const [rows, setRows] = useState<SpaceRecord[]>([]);
  // Don't read localStorage during SSR - hydrate draft on client after mount
  const [f, setF] = useState({ building: '', level: '', name: '', spaceCode: '', area: '', perimeter: '', description: '' });
  const [isLoaded, setIsLoaded] = useState(false);
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({ show: false, message: '', type: 'success' });

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
  };
  
  // First, hydrate from localStorage on mount or when projectId changes
  useEffect(() => {
    try {
      const draftKey = `fm-create-space-draft-${projectId || 'global'}`;
      const saved = load(draftKey, {});
      if (saved && Object.keys(saved).length > 0) {
        console.log('[CreateSpace][draft] Loaded create-space draft from LS:', saved);
        setF(prev => ({ ...prev, ...saved }));
      }
    } catch { }
    setIsLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const [projectName, setProjectName] = useState<string>('');

  // Load project metadata (name) so we can prefill Building
  useEffect(() => {
    if (!projectId) return;
    (async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}`);
        if (res.ok) {
          const json = await res.json();
          setProjectName(json?.project?.name || json?.name || '');
        }
      } catch (err) {
        console.warn('[CreateSpace] Could not load project metadata', err);
      }
    })();
  }, [projectId]);

  // (removed misplaced openHistory from CreateSpace)

  // (moved) openHistory was accidentally placed here before; removed from this component.

  // When projectName becomes available, prefill building if empty
  useEffect(() => {
    if (projectName && (!f.building || f.building.trim() === '')) {
      console.log('[CreateSpace][prefill] Building from project name:', projectName);
      setF(prev => { const next = { ...prev, building: projectName }; console.log('[CreateSpace][prefill] Form after project-name building set', next); return next; });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectName]);

  // Auto-save draft to localStorage on every field change
  useEffect(() => {
    if (!isLoaded) return;
    const draftKey = `fm-create-space-draft-${projectId || 'global'}`;
    save(draftKey, f);
    console.log('[CreateSpace][autoSave] Saved draft to LS:', f);
  }, [f, projectId, isLoaded]);
  // Footprint drawing state
  const [drawing, setDrawing] = useState(false);
  const [pointCount, setPointCount] = useState(0);
  const [footprint, setFootprint] = useState<{ points: { x: number; y: number; z: number }[]; z?: number; levelIndex?: number } | null>(null);
  const pointsRef = useRef<{ x: number; y: number; z: number }[]>([]);
  const baseZRef = useRef<number | null>(null);
  const overlayName = 'fm-footprint-editor';
  const isRemote = !viewer && !!standalone; // standalone window without viewer
  const hoverRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const snapperRef = useRef<any>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const footprintDraftKey = `fm-footprint-draft-${projectId || 'global'}`;
  const computedPerimeterRef = useRef<number | null>(null);
  const suppressAutoFillRef = useRef<boolean>(false);
  const logFormState = (where: string) => { try { console.log('[CreateSpace][form]', where, { building: f.building, level: f.level, area: f.area, perimeter: (f as any).perimeter, name: f.name, spaceCode: f.spaceCode }); } catch {} };
  useEffect(() => { logFormState('state changed'); // trace every form update
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f]);

  // Keep a ref to the current form state to avoid stale closures in event listeners without re-binding
  const formRef = useRef(f);
  useEffect(() => { formRef.current = f; }, [f]);

  // Restore footprint from localStorage when panel opens again (after minimize/restore)
  useEffect(() => {
    try {
      const saved: any = load(footprintDraftKey, []);
      console.log('[CreateSpace][restore] Footprint from LS:', Array.isArray(saved) ? saved.length : 'invalid');
      if (Array.isArray(saved) && saved.length >= 3) {
        pointsRef.current = saved.map((p: any) => ({ x: Number(p.x), y: Number(p.y), z: Number(p.z) }));
        setPointCount(pointsRef.current.length);
        const pts = sanitizePolygon(pointsRef.current);
        setFootprint({ points: [...pts], z: pts[0]?.z, levelIndex: undefined });
        if (viewer?.impl) drawFinalPolygon(pts);
        setConfirmOpen(true);
        console.log('[CreateSpace][restore] Restored footprint and opened confirmation');
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, viewer]);

  const clearOverlay = () => {
    try {
      if (!viewer?.impl) return;
      const scn = (viewer.impl.overlayScenes || {})[overlayName];
      const scene = scn?.scene;
      if (scene) {
        const children = [...scene.children];
        children.forEach(ch => scene.remove(ch));
        viewer.impl.invalidate(true);
      }
    } catch { }
  };

  const drawFinalPolygon = (pts: { x: number; y: number; z: number }[]) => {
    try {
      if (!viewer?.impl || pts.length < 3) return;
      if (!(viewer.impl.overlayScenes || {})[overlayName]) viewer.impl.createOverlayScene(overlayName);
      clearOverlay();
      pts = sanitizePolygon(pts);
      const THREE = (window as any).THREE;
      if (!THREE) return;

      // Draw final closed polygon with THICK DARK GREEN lines
      const closedPts = [...pts, pts[0]].map(p => new THREE.Vector3(p.x, p.y, p.z));
      const geom = new THREE.BufferGeometry().setFromPoints(closedPts);
      const mat = new THREE.LineBasicMaterial({ color: 0x00aa00, linewidth: 5, depthTest: false });
      const line = new THREE.Line(geom, mat);
      line.renderOrder = 999;
      viewer.impl.addOverlay(overlayName, line);

      // Filled polygon (darker green)
      const shape = new THREE.Shape(pts.map(p => new THREE.Vector2(p.x, p.y)));
      const fillGeom = new THREE.ShapeGeometry(shape);
      const fillMat = new THREE.MeshBasicMaterial({ color: 0x00dd00, opacity: 0.3, transparent: true, depthWrite: false, depthTest: false });
      const mesh = new THREE.Mesh(fillGeom, fillMat);
      if (baseZRef.current != null) mesh.position.z = baseZRef.current;
      mesh.renderOrder = 998;
      viewer.impl.addOverlay(overlayName, mesh);

      viewer.impl.invalidate(true);
    } catch { }
  };

  const drawPreview = () => {
    try {
      if (!viewer?.impl) return;
      if (!(viewer.impl.overlayScenes || {})[overlayName]) {
        viewer.impl.createOverlayScene(overlayName);
      }
      clearOverlay();
      const pts = pointsRef.current; // use raw for line preview to avoid jumpy feedback
      const hover = hoverRef.current;
      const THREE = (window as any).THREE;
      if (!THREE) { viewer.impl.invalidate(true); return; }

      // Draw polyline through all clicked points (THICKER & DARKER)
      if (pts.length >= 2) {
        const geom = new THREE.BufferGeometry().setFromPoints(pts.map(p => new THREE.Vector3(p.x, p.y, p.z)));
        const mat = new THREE.LineBasicMaterial({ color: 0x00dd00, linewidth: 4, depthTest: false });
        const line = new THREE.Line(geom, mat);
        line.renderOrder = 999;
        viewer.impl.addOverlay(overlayName, line);
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
        viewer.impl.addOverlay(overlayName, previewLine);
      }

      // Draw closing line preview (back to first point) - THICKER & DARKER
      if (pts.length >= 3) {
        const clean = sanitizePolygon(pts);
        const closedPts = [...clean, clean[0]].map(p => new THREE.Vector3(p.x, p.y, p.z));
        const geom2 = new THREE.BufferGeometry().setFromPoints(closedPts);
        const line2 = new THREE.Line(geom2, new THREE.LineBasicMaterial({ color: 0x0088ff, linewidth: 4, depthTest: false, opacity: 0.7, transparent: true }));
        line2.renderOrder = 999;
        viewer.impl.addOverlay(overlayName, line2);
        // Filled polygon for visibility (DARKER)
        const shape = new THREE.Shape(clean.map((p, i) => new THREE.Vector2(p.x, p.y)));
        const fillGeom = new THREE.ShapeGeometry(shape);
        const fillMat = new THREE.MeshBasicMaterial({ color: 0x00dd00, opacity: 0.25, transparent: true, depthWrite: false, depthTest: false });
        const mesh = new THREE.Mesh(fillGeom, fillMat);
        if (baseZRef.current != null) mesh.position.z = baseZRef.current;
        mesh.renderOrder = 998;
        viewer.impl.addOverlay(overlayName, mesh);
      }
      viewer.impl.invalidate(true);
    } catch { }
  };

  // Compute world point on constant Z plane from screen xy
  const worldOnZ = (clientX: number, clientY: number, z: number) => {
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

    const point = origin.clone().add(dir.multiplyScalar(t));
    return point;
  };

  const isNearFirst = (p: { x: number; y: number; z: number }, eps = 0.25) => {
    if (pointsRef.current.length < 1) return false;
    const a = pointsRef.current[0];
    const dx = p.x - a.x, dy = p.y - a.y;
    return Math.hypot(dx, dy) <= eps;
  };

  const almostEqual = (a: number, b: number, eps = 1e-3) => Math.abs(a - b) <= eps;
  const dedupeAndSimplify = (pts: { x: number; y: number; z: number }[], eps = 1e-3) => {
    if (!Array.isArray(pts) || pts.length === 0) return [] as typeof pts;
    // remove consecutive duplicates (within eps)
    const out: { x: number; y: number; z: number }[] = [];
    for (const p of pts) {
      const last = out[out.length - 1];
      if (!last || !(almostEqual(last.x, p.x, eps) && almostEqual(last.y, p.y, eps))) out.push(p);
    }
    // if last equals first, drop last duplicate
    if (out.length >= 2) {
      const f = out[0], l = out[out.length - 1];
      if (almostEqual(f.x, l.x, eps) && almostEqual(f.y, l.y, eps)) out.pop();
    }
    // drop colinear points
    const colinear = (a: any, b: any, c: any, tol = 1e-6) => {
      const abx = b.x - a.x, aby = b.y - a.y;
      const bcx = c.x - b.x, bcy = c.y - b.y;
      return Math.abs(abx * bcy - aby * bcx) <= tol;
    };
    const simp: typeof out = [];
    for (let i = 0; i < out.length; i++) {
      const prev = out[(i - 1 + out.length) % out.length];
      const curr = out[i];
      const next = out[(i + 1) % out.length];
      if (!colinear(prev, curr, next)) simp.push(curr);
    }
    return simp;
  };
  const signedArea = (pts: { x: number; y: number }[]) => {
    let s = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      s += a.x * b.y - b.x * a.y;
    }
    return 0.5 * s;
  };
  const polygonPerimeter2D = (pts: { x: number; y: number }[]): number => {
    if (!Array.isArray(pts) || pts.length < 2) return 0;
    let sum = 0;
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % n];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      sum += Math.hypot(dx, dy);
    }
    return sum;
  };
  const prefillBuildingAndLevel = async (zHint?: number | null) => {
    try {
      if (!viewer) return;
      console.log('[CreateSpace][prefill] Start. zHint=', zHint);
      if (!f.building || String(f.building).trim() === '') {
        try {
          const rootId = viewer?.model?.getRootId ? viewer.model.getRootId() : null;
          if (rootId != null) {
            const rootProps: any = await new Promise(resolve => { try { viewer.getProperties(rootId, resolve); } catch { resolve(null); } });
            const getPropFrom = (propsObj: any, names: string[]) => {
              if (!propsObj || !Array.isArray(propsObj.properties)) return undefined;
              const lower = names.map(n => n.toLowerCase());
              const p = propsObj.properties.find((p: any) => {
                const dn = p.displayName?.toLowerCase?.();
                return dn && (lower.includes(dn) || lower.some(n => dn.includes(n)));
              });
              return p?.displayValue?.toString?.();
            };
            const building = getPropFrom(rootProps, ['Building', 'Edificio', 'Building Name', 'Nome edificio', 'Project Name']);
            if (building) { setF(prev => ({ ...prev, building })); console.log('[CreateSpace][prefill] Building from model root:', building); }
          }
        } catch {}
      }
      try {
        let ext = (typeof viewer.getExtension === 'function') ? viewer.getExtension('Autodesk.AEC.LevelsExtension') : null;
        if (!ext && typeof (viewer as any).loadExtension === 'function') {
          try { ext = await (viewer as any).loadExtension('Autodesk.AEC.LevelsExtension'); } catch {}
        }
        const fs = (ext as any)?.floorSelector;
        const floors = fs?.floorData || [];
        console.log('[CreateSpace][prefill] Floors available:', floors?.length, floors);
        let levelName = '';
        // Prefer active floor
        const idx = typeof fs?.getActiveFloor === 'function' ? fs.getActiveFloor() : undefined;
        console.log('[CreateSpace][prefill] Active floor idx:', idx);
        if (typeof idx === 'number' && floors[idx]?.name) levelName = floors[idx].name;
        // Fallback: infer by z if available
        if (!levelName && floors?.length && (zHint != null)) {
          const z = Number(zHint);
          console.log('[CreateSpace][prefill] Inferring by zHint:', z);
          let best: { name: string; dist: number } | null = null;
          for (const fdata of floors) {
            const zMin = Number(fdata?.zMin ?? 0), zMax = Number(fdata?.zMax ?? 0);
            const dist = (z < zMin) ? (zMin - z) : (z > zMax ? (z - zMax) : 0);
            if (best == null || dist < best.dist) best = { name: String(fdata?.name || ''), dist };
          }
          levelName = best?.name || '';
        }
        if (levelName) { setF(prev => ({ ...prev, level: levelName })); console.log('[CreateSpace][prefill] Level set to:', levelName); }
      } catch (e) { console.warn('[CreateSpace][prefill] Level prefill failed', e); }
    } catch {}
  };
  const sanitizePolygon = (pts: { x: number; y: number; z: number }[]) => {
    let arr = dedupeAndSimplify(pts);
    if (arr.length < 3) return arr;
    // 2-opt untangle: remove self-intersections by reversing subpaths
    const cross = (p1: any, p2: any, p3: any, p4: any) => {
      const d = (a: any, b: any, c: any) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
      const o1 = d(p1, p2, p3);
      const o2 = d(p1, p2, p4);
      const o3 = d(p3, p4, p1);
      const o4 = d(p3, p4, p2);
      if (o1 === 0 && o2 === 0 && o3 === 0 && o4 === 0) return false;
      return (o1 * o2 < 0) && (o3 * o4 < 0);
    };
    const untangle = (poly: typeof arr) => {
      const n = poly.length;
      if (n < 4) return poly;
      let improved = true;
      let guard = 0;
      while (improved && guard++ < 50) {
        improved = false;
        for (let i = 0; i < n; i++) {
          const i2 = (i + 1) % n;
          for (let j = i + 2; j < n; j++) {
            const j2 = (j + 1) % n;
            // skip adjacent and wraparound pair
            if (i === j2) continue;
            if (cross(poly[i], poly[i2], poly[j], poly[j2])) {
              // reverse between i2..j inclusive
              const a = i2;
              const b = j;
              const segment = poly.slice(a, b + 1).reverse();
              poly = [...poly.slice(0, a), ...segment, ...poly.slice(b + 1)];
              improved = true;
            }
          }
        }
      }
      return poly;
    };
    arr = untangle(arr);
    // ensure consistent winding (CCW) for fill
    if (signedArea(arr) < 0) arr = [...arr].reverse();
    return arr;
  };
  // After footprint changes, ensure form fields are filled if still empty
  useEffect(() => {
    try {
      if (suppressAutoFillRef.current) {
        console.log('[CreateSpace][footprintEffect] Suppressed autofill due to manual form clear');
        suppressAutoFillRef.current = false;
        return;
      }
      if (!footprint || !Array.isArray(footprint.points) || footprint.points.length < 3) return;
      // Fill area/perimeter if missing
      const needArea = !f.area;
      const needPer = !(f as any).perimeter;
      if (needArea || needPer) {
        const pts2d = footprint.points.map(p => ({ x: p.x, y: p.y }));
        const a = Math.abs(signedArea(pts2d));
        const per = polygonPerimeter2D(pts2d);
        computedPerimeterRef.current = per;
        console.log('[CreateSpace][footprintEffect] Recomputed area/perimeter:', a, per);
        setF(prev => ({
          ...prev,
          area: needArea ? a.toFixed(2) : prev.area,
          perimeter: needPer ? per.toFixed(2) : (prev as any).perimeter
        } as any));
      }
      // Fill level if still empty (prefer z from footprint)
      if (!f.level) {
        prefillBuildingAndLevel(footprint.z ?? baseZRef.current ?? null);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [footprint]);

  const onViewerClick = (ev: MouseEvent) => {
    try {
      if (!viewer?.impl) return;
      // Initialize base Z from first hit or ground if needed
      if (baseZRef.current == null) {
        const hit = viewer.impl.hitTest(ev.clientX, ev.clientY, true);
        if (hit?.point?.z != null) baseZRef.current = hit.point.z; else {
          try { baseZRef.current = viewer.model?.getBoundingBox?.().min?.z ?? 0; } catch { baseZRef.current = 0; }
        }
        console.log('[CreateSpace][onViewerClick] Base Z initialized:', baseZRef.current);
      }
      const z = baseZRef.current ?? 0;
      let p = null as any;
      try {
        if (snapperRef.current && typeof snapperRef.current.getSnapResult === 'function') {
          const sr = snapperRef.current.getSnapResult();
          if (sr) {
            const gp = (sr.getPoint && sr.getPoint()) || (sr.intersectPoint) || (sr.point) || null;
            if (gp && gp.x != null && gp.y != null && gp.z != null) {
              p = gp;
              console.log('[CreateSpace][onViewerClick] Snapped point:', p);
            }
          }
        }
      } catch (e) {
        console.warn('[CreateSpace][onViewerClick] Snap failed:', e);
      }
      if (!p) {
        p = worldOnZ(ev.clientX, ev.clientY, z);
        console.log('[CreateSpace][onViewerClick] Fallback worldOnZ point:', p);
      }
      if (!p) return;
      if (pointsRef.current.length >= 3 && isNearFirst(p)) {
        console.log('[CreateSpace][onViewerClick] Near first point, finishing drawing');
        finishDrawing();
        return;
      }
      pointsRef.current.push({ x: p.x, y: p.y, z });
      setPointCount(pointsRef.current.length);
      try { save(footprintDraftKey, pointsRef.current); } catch {}
      console.log('[CreateSpace][onViewerClick] Point added. Total:', pointsRef.current.length, 'Point:', p);
      drawPreview();
    } catch (e) {
      console.error('[CreateSpace][onViewerClick] Error:', e);
    }
  };

  const onViewerMove = (ev: MouseEvent) => {
    try {
      if (!viewer?.impl || !drawing) return;
      if (baseZRef.current == null) {
        const hit = viewer.impl.hitTest(ev.clientX, ev.clientY, true);
        if (hit?.point?.z != null) baseZRef.current = hit.point.z; else {
          try { baseZRef.current = viewer.model?.getBoundingBox?.().min?.z ?? 0; } catch { baseZRef.current = 0; }
        }
      }
      const z = baseZRef.current ?? 0;
      let p = null as any;
      try {
        if (snapperRef.current && typeof snapperRef.current.getSnapResult === 'function') {
          const sr = snapperRef.current.getSnapResult();
          if (sr) {
            const gp = (sr.getPoint && sr.getPoint()) || (sr.intersectPoint) || (sr.point) || null;
            if (gp && gp.x != null && gp.y != null && gp.z != null) p = gp;
          }
        }
      } catch {}
      if (!p) p = worldOnZ(ev.clientX, ev.clientY, z);
      if (!p) return;
      // snap-to-start preview
      if (pointsRef.current.length >= 2 && isNearFirst(p)) {
        const a = pointsRef.current[0];
        hoverRef.current = { x: a.x, y: a.y, z: a.z };
      } else {
        hoverRef.current = { x: p.x, y: p.y, z };
      }
      drawPreview();
    } catch { }
  };

  const onViewerDblClick = (ev: MouseEvent) => {
    try {
      if (!viewer?.impl || !drawing) return;
      if (pointsRef.current.length >= 3) finishDrawing();
    } catch { }
  };

  const onKeyDown = (ev: KeyboardEvent) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      finishDrawing();
      setConfirmOpen(true);
    } else if (ev.key === 'Escape') {
      ev.preventDefault();
      cancelDrawing();
    }
  };

  const startDrawing = async () => {
    console.log('[CreateSpace][startDrawing] Called. viewer:', !!viewer, 'isRemote:', isRemote);
    if (!viewer) {
      // Remote drawing: request main window to start capture
      try {
        console.log('[CreateSpace][startDrawing] Remote mode: sending FM_DRAW_START to opener');
        (window as any).opener?.postMessage?.({ type: 'FM_DRAW_START' }, '*');
        setFootprint(null);
        pointsRef.current = [];
        baseZRef.current = null;
        setDrawing(true);
        setPointCount(0);
        console.log('[CreateSpace][startDrawing] Remote: minimizing popup window');
        try { 
          if (window.opener) {
            window.opener.focus();
          }
          window.blur();
        } catch (e) {
          console.warn('[CreateSpace][startDrawing] Failed to minimize popup:', e);
        }
      } catch (e) {
        console.error('[CreateSpace][startDrawing] Remote mode error:', e);
      }
      return;
    }
    try {
      console.log('[CreateSpace][startDrawing] Main window mode: initializing drawing');
      setFootprint(null);
      pointsRef.current = [];
      baseZRef.current = null;
      hoverRef.current = null;
      setDrawing(true);
      setPointCount(0);
      console.log('[CreateSpace][startDrawing] Loading snapper extensions...');
      // Prefer Measure extension's snapper
      try {
        const measureExt = await viewer.loadExtension?.('Autodesk.Measure');
        const maybeSnapper = measureExt?.getSnapper?.();
        if (maybeSnapper) {
          snapperRef.current = maybeSnapper;
          try { maybeSnapper.activateSnap?.(true); } catch {}
          console.log('[CreateSpace][startDrawing] Measure snapper activated');
        }
      } catch (e) {
        console.warn('[CreateSpace][startDrawing] Measure extension failed:', e);
      }
      // Fallback: standalone snapping tool
      try {
        if (!snapperRef.current) {
          await viewer.loadExtension?.('Autodesk.Snapping');
          const S = (window as any).Autodesk?.Viewing?.Extensions?.Snapping;
          if (S) {
            const sn = new S.Snapper(viewer, true);
            viewer.toolController?.registerTool?.(sn);
            viewer.toolController?.activateTool?.(sn.getName?.());
            try { sn.activateSnap?.(true); } catch {}
            snapperRef.current = sn;
            console.log('[CreateSpace][startDrawing] Snapping tool activated');
          }
        }
      } catch (e) {
        console.warn('[CreateSpace][startDrawing] Snapping extension failed:', e);
      }
      viewer.container?.addEventListener('click', onViewerClick as any, true);
      viewer.container?.addEventListener('mousemove', onViewerMove as any, true);
      viewer.container?.addEventListener('dblclick', onViewerDblClick as any, true);
      window.addEventListener('keydown', onKeyDown as any, true);
      if (!viewer.impl.overlayScenes?.[overlayName]) viewer.impl.createOverlayScene(overlayName);
      // Force crosshair cursor
      if (viewer.container) {
        const container = viewer.container as HTMLElement;
        container.style.cursor = 'crosshair';
        container.style.setProperty('cursor', 'crosshair', 'important');
      }
      console.log('[CreateSpace][startDrawing] Drawing mode activated, listeners attached');
      try { window.dispatchEvent(new Event('fm-modal-minimize')); } catch {}
    } catch (e) {
      console.error('[CreateSpace][startDrawing] Error in main mode:', e);
    }
  };

  const finishDrawing = () => {
    try {
      console.log('[CreateSpace][finishDrawing] Called. isRemote:', isRemote, 'pointsRef.current.length:', pointsRef.current.length);
      if (isRemote) {
        // Ask main window to finalize and send us the points
        console.log('[CreateSpace][finishDrawing] Remote: sending FM_DRAW_FINISH to opener');
        (window as any).opener?.postMessage?.({ type: 'FM_DRAW_FINISH' }, '*');
        setDrawing(false);
        try { window.focus?.(); } catch {}
        return;
      }
      setDrawing(false);
      viewer?.container?.removeEventListener('click', onViewerClick as any, true);
      viewer?.container?.removeEventListener('mousemove', onViewerMove as any, true);
      viewer?.container?.removeEventListener('dblclick', onViewerDblClick as any, true);
      window.removeEventListener('keydown', onKeyDown as any, true);
      // Restore cursor
      if (viewer?.container) {
        const container = viewer.container as HTMLElement;
        container.style.cursor = 'default';
        container.style.removeProperty('cursor');
      }
      try { snapperRef.current?.deactivateSnap?.(); } catch {}
      try {
        const name = snapperRef.current?.getName?.();
        if (name) viewer.toolController?.deactivateTool?.(name);
      } catch {}
      const raw = pointsRef.current;
      console.log('[CreateSpace][finishDrawing] Raw points before sanitize:', raw.length);
      let pts = sanitizePolygon(raw);
      console.log('[CreateSpace][finishDrawing] Sanitized points:', pts.length);
      if (pts.length >= 3) {
        const fp = { points: [...pts], z: baseZRef.current ?? undefined, levelIndex: undefined };
        try { save(footprintDraftKey, fp.points); } catch {}
        // compute area/perimeter and prefill area field
        const a = Math.abs(signedArea(pts));
        const per = polygonPerimeter2D(pts);
        computedPerimeterRef.current = per;
        console.log('[CreateSpace][finishDrawing] Computed area/perimeter:', a, per);
        setF(prev => { const next = { ...prev, area: a.toFixed(2), perimeter: per.toFixed(2) } as any; console.log('[CreateSpace][finishDrawing] Form after area/perimeter set', next); return next; });
        // Prefill building/level
        prefillBuildingAndLevel(baseZRef.current);
        setFootprint(fp);
        drawFinalPolygon(pts);
        setConfirmOpen(true);
        try { window.dispatchEvent(new Event('fm-modal-restore')); } catch {}
        console.log('[CreateSpace][finishDrawing] Footprint set and confirmation opened:', fp);
      } else {
        // not enough points
        console.warn('[CreateSpace][finishDrawing] Not enough points after sanitize');
        setFootprint(null);
        clearOverlay();
      }
    } catch (e) {
      console.error('[CreateSpace][finishDrawing] Error:', e);
    }
  };

  const cancelDrawing = () => {
    try {
      if (isRemote) {
        (window as any).opener?.postMessage?.({ type: 'FM_DRAW_CANCEL' }, '*');
      }
      setDrawing(false);
      pointsRef.current = [];
      baseZRef.current = null;
      viewer?.container?.removeEventListener('click', onViewerClick as any, true);
      viewer?.container?.removeEventListener('mousemove', onViewerMove as any, true);
      viewer?.container?.removeEventListener('dblclick', onViewerDblClick as any, true);
      window.removeEventListener('keydown', onKeyDown as any, true);
      try { snapperRef.current?.deactivateSnap?.(); } catch {}
      try {
        const name = snapperRef.current?.getName?.();
        if (name) viewer.toolController?.deactivateTool?.(name);
      } catch {}
      clearOverlay();
      // Ensure footprint and confirmation are cleared too
      setFootprint(null);
      setConfirmOpen(false);
      try { save(footprintDraftKey, []); } catch {}
      try { window.dispatchEvent(new Event('fm-modal-restore')); } catch {}
      try { (viewer?.container as HTMLElement).style.cursor = 'default'; } catch { }
    } catch { }
  };

  const undoLastPoint = () => {
    try {
      if (!drawing) return;
      if (isRemote) {
        (window as any).opener?.postMessage?.({ type: 'FM_DRAW_UNDO' }, '*');
        // locally reflect count for button state
        pointsRef.current.pop();
        setPointCount(pointsRef.current.length);
        return;
      }
      pointsRef.current.pop();
      setPointCount(pointsRef.current.length);
      drawPreview();
    } catch { }
  };

  // Cleanup on unmount or viewer change
  useEffect(() => {
    return () => {
      try {
        viewer?.container?.removeEventListener('click', onViewerClick as any, true);
        viewer?.container?.removeEventListener('mousemove', onViewerMove as any, true);
        window.removeEventListener('keydown', onKeyDown as any, true);
        clearOverlay();
      } catch { }
    };
  }, [viewer]);

  // Remote drawing: receive points and completion from main window
  useEffect(() => {
    if (!isRemote) return;
    console.log('[CreateSpace][useEffect] Setting up remote message listener');
    const onMsg = (e: MessageEvent) => {
      const d: any = e.data;
      if (!d || typeof d !== 'object') return;
      console.log('[CreateSpace][onMsg] Received message:', d.type, d);
      if (d.type === 'FM_DRAW_POINT' && d.point) {
        try {
          const p = d.point as { x: number; y: number; z: number };
          pointsRef.current.push(p);
          setPointCount(pointsRef.current.length);
          try { save(footprintDraftKey, pointsRef.current); } catch {}
          // keep latest summary for UI
          setFootprint(prev => ({ points: [...pointsRef.current], z: pointsRef.current[0]?.z, levelIndex: undefined }));
          console.log('[CreateSpace][onMsg] Point added remotely. Total:', pointsRef.current.length);
        } catch (e) {
          console.error('[CreateSpace][onMsg] Error adding point:', e);
        }
      } else if (d.type === 'FM_DRAW_DONE' && Array.isArray(d.points)) {
        console.log('[CreateSpace][onMsg] Drawing done. Points received:', d.points.length);
        setDrawing(false);
        pointsRef.current = d.points;
        setPointCount(d.points.length);
        const fp = { points: [...d.points], z: d.points[0]?.z, levelIndex: undefined };
        setFootprint(fp);
        
        // compute area/perimeter and prefill area
        let aStr = formRef.current.area;
        let pStr = (formRef.current as any).perimeter;
        
        try {
          const pts2d = fp.points.map(p => ({ x: p.x, y: p.y }));
          const a = Math.abs(signedArea(pts2d));
          const per = polygonPerimeter2D(pts2d);
          computedPerimeterRef.current = per;
          aStr = a.toFixed(2);
          pStr = per.toFixed(2);
          console.log('[CreateSpace][remoteDone] Computed area/perimeter:', a, per);
          setF(prev => { const next = { ...prev, area: aStr, perimeter: pStr } as any; console.log('[CreateSpace][remoteDone] Form after area/perimeter set', next); return next; });
        } catch {}
        
        // Prefill building and level and restore modal
        prefillBuildingAndLevel(fp?.z ?? null);
        setConfirmOpen(true);
        try { window.dispatchEvent(new Event('fm-modal-restore')); } catch {}
        try { save(footprintDraftKey, fp.points); } catch {}
        
        // Re-save form to ensure it's persisted with updated area/perimeter AND existing fields
        const draftKey = `fm-create-space-draft-${projectId || 'global'}`;
        const updatedForm = { ...formRef.current, area: aStr, perimeter: pStr };
        try { save(draftKey, updatedForm); } catch {}
        console.log('[CreateSpace][onMsg] Footprint set from remote:', fp);
      } else if (d.type === 'FM_DRAW_CANCELLED') {
        console.log('[CreateSpace][onMsg] Drawing cancelled remotely');
        setDrawing(false);
        pointsRef.current = [];
        setPointCount(0);
        setFootprint(null);
      }
    };
    window.addEventListener('message', onMsg);
    return () => {
      console.log('[CreateSpace][useEffect] Removing remote message listener');
      window.removeEventListener('message', onMsg);
    };
  }, [isRemote, projectId]); // Removed f from dependencies, using formRef
  const onSave = async () => {
    const rec: SpaceRecord = {
      id: `space-${Date.now()}`,
      building: f.building || undefined,
      level: f.level || undefined,
      name: f.name || undefined,
      spaceCode: f.spaceCode || undefined,
      area: f.area ? Number(f.area) : undefined,
      description: f.description || undefined,
      source: 'MANUAL',
      dbId: null,
      modelGuid: (() => {
        try {
          const data = viewer?.model?.getData?.();
          const g = data?.guid;
          const urn = data?.urn || (viewer as any)?.impl?.model?.myData?.urn;
          if (g && urn) return `${g}|${urn}`;
          if (g) return g;
          const mid = (viewer as any)?.model?.id;
          return mid != null ? String(mid) : undefined;
        } catch { return undefined; }
      })(),
      perimeter: (computedPerimeterRef.current != null) ? computedPerimeterRef.current : (f as any).perimeter ? Number((f as any).perimeter) : undefined
    };
    
    if (!projectId) {
      console.warn('[CreateSpace] No projectId - space not saved to DB');
      return;
    }
    
    try {
      const res = await fetch(`/api/projects/${projectId}/spaces`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ ...rec, footprint: footprint || null }) 
      });
      
      if (res.ok) {
        let saved: any = null; try { saved = await res.json(); } catch {}
        console.log('[CreateSpace] Space saved to DB successfully');
        // Trigger a refresh event so SpaceList reloads
        const savedSpace = saved?.space || saved || rec;
        window.dispatchEvent(new CustomEvent('space-created', { detail: { projectId, space: savedSpace } }));
        
        showToast('New room/space saved', 'success');

        // Clear form but keep building
        const emptyForm = { building: f.building, level: '', name: '', spaceCode: '', area: '', perimeter: '', description: '' };
        setF(emptyForm);
        save(`fm-create-space-draft-${projectId || 'global'}`, emptyForm);
        try { save(footprintDraftKey, []); } catch {}
        
        // Clear footprint
        setFootprint(null);
        cancelDrawing();
      } else {
        console.error('[CreateSpace] Failed to save space to DB');
        showToast('Failed to save space', 'error');
      }
    } catch (e) {
      console.error('[CreateSpace] Error saving space:', e);
      showToast('Error saving space', 'error');
    }
  };
  const clearForm = () => {
    try {
      suppressAutoFillRef.current = true;
      const next = { building: f.building || '', level: '', name: '', spaceCode: '', area: '', perimeter: '', description: '' } as any;
      setF(next);
      computedPerimeterRef.current = null;
      try { save(`fm-create-space-draft-${projectId || 'global'}`, next); } catch {}
      console.log('[CreateSpace][form] Cleared form fields (kept building)', next);
    } catch {}
  };

  return (
    <div className="p-3 space-y-3">
      {/* Toast Notification */}
      {toast.show && (
        <div className={`fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 duration-300 ${
          toast.type === 'success' 
            ? 'bg-green-600' 
            : 'bg-red-600'
        } text-foreground px-6 py-4 rounded-lg shadow-2xl border border-border/20 backdrop-blur-sm min-w-[320px]`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1">
              <p className="font-semibold text-sm">{toast.type === 'success' ? 'Success' : 'Error'}</p>
              <p className="text-sm opacity-90">{toast.message}</p>
            </div>
            <button 
              onClick={() => setToast({ show: false, message: '', type: 'success' })}
              className="text-foreground/80 hover:text-foreground transition-colors text-xl font-bold leading-none"
            >
              &times;
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="text-foreground font-semibold text-sm">Create New Space</div>
        <button type="button" onClick={clearForm} className="px-2 py-1 rounded text-xs bg-muted hover:bg-muted text-foreground">Clear</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className="text-[12px] text-muted-foreground block mb-1">Building</label><input value={f.building} onChange={e => { console.log('[CreateSpace][input] building change:', e.target.value); setF(v => ({ ...v, building: e.target.value })); }} className="w-full bg-card border border-border rounded px-2 py-1.5 text-foreground text-sm" /></div>
        <div><label className="text-[12px] text-muted-foreground block mb-1">Level</label><input value={f.level} onChange={e => { console.log('[CreateSpace][input] level change:', e.target.value); setF(v => ({ ...v, level: e.target.value })); }} className="w-full bg-card border border-border rounded px-2 py-1.5 text-foreground text-sm" /></div>
        <div><label className="text-[12px] text-muted-foreground block mb-1">Room name</label><input value={f.name} onChange={e => setF(v => ({ ...v, name: e.target.value }))} className="w-full bg-card border border-border rounded px-2 py-1.5 text-foreground text-sm" /></div>
        <div><label className="text-[12px] text-muted-foreground block mb-1">Space Code</label><input value={f.spaceCode} onChange={e => setF(v => ({ ...v, spaceCode: e.target.value }))} className="w-full bg-card border border-border rounded px-2 py-1.5 text-foreground text-sm" /></div>
        <div><label className="text-[12px] text-muted-foreground block mb-1">Area (m²)</label><input value={f.area} onChange={e => { console.log('[CreateSpace][input] area change:', e.target.value); setF(v => ({ ...v, area: e.target.value })); }} className="w-full bg-card border border-border rounded px-2 py-1.5 text-foreground text-sm" /></div>
        <div><label className="text-[12px] text-muted-foreground block mb-1">Perimeter (m)</label><input value={(f as any).perimeter} onChange={e => { console.log('[CreateSpace][input] perimeter change:', e.target.value); setF(v => ({ ...(v as any), perimeter: e.target.value } as any)); }} className="w-full bg-card border border-border rounded px-2 py-1.5 text-foreground text-sm" /></div>
        <div className="col-span-2"><label className="text-[12px] text-muted-foreground block mb-1">Description</label><input value={f.description} onChange={e => setF(v => ({ ...v, description: e.target.value }))} className="w-full bg-card border border-border rounded px-2 py-1.5 text-foreground text-sm" /></div>
      </div>
      {/* Footprint Editor */}
      <div className="border-t border-border pt-3">
        <div className="text-xs text-muted-foreground mb-2">2D Footprint (optional)</div>
        <div className="flex flex-wrap gap-2">
          <button onClick={startDrawing} disabled={(!!viewer === false && !isRemote) || drawing} className={`px-3 py-1.5 rounded text-xs ${(((!!viewer === false) && !isRemote) || drawing) ? 'bg-muted text-muted-foreground' : 'bg-emerald-700 hover:bg-emerald-800 text-foreground'}`}>Start drawing</button>
          <button onClick={finishDrawing} disabled={!drawing || pointCount < 3} className={`px-3 py-1.5 rounded text-xs ${(!drawing || pointCount < 3) ? 'bg-muted text-muted-foreground' : 'bg-blue-700 hover:bg-blue-800 text-foreground'}`}>Finish</button>
          <button onClick={undoLastPoint} disabled={!drawing || pointsRef.current.length === 0} className={`px-3 py-1.5 rounded text-xs ${(!drawing || pointsRef.current.length === 0) ? 'bg-muted text-muted-foreground' : 'bg-yellow-700 hover:bg-yellow-800 text-foreground'}`}>Undo</button>
          <button type="button" onClick={cancelDrawing} disabled={!drawing && !footprint} className={`px-3 py-1.5 rounded text-xs ${(!drawing && !footprint) ? 'bg-muted text-muted-foreground' : 'bg-red-700 hover:bg-red-800 text-foreground'}`}>Clear</button>
        </div>
        <div className="text-[11px] text-muted-foreground mt-2">
          {drawing
            ? `Drawing... ${pointCount} point${pointCount !== 1 ? 's' : ''} added. Click to add more, Enter to finish, ESC to cancel.`
            : footprint
              ? `${footprint.points.length} points captured at z=${(footprint.z ?? 0).toFixed?.(2)}`
              : 'No footprint set.'}
        </div>
      </div>
      {confirmOpen && footprint && (
        <div className="mt-3 border border-border rounded p-2 bg-card text-xs text-foreground">
          <div className="mb-2 font-semibold">Footprint Points (x, y, z):</div>
          <div className="max-h-40 overflow-auto space-y-1 bg-background p-2 rounded">
            {footprint.points.map((p, i) => (
              <div key={i} className="font-mono">{i + 1}. ({p.x.toFixed(3)}, {p.y.toFixed(3)}, {p.z.toFixed(3)})</div>
            ))}
          </div>
          <div className="mt-2"><button onClick={() => { console.log('[CreateSpace][confirmClose] Closing confirmation'); setConfirmOpen(false); }} className="px-3 py-1.5 rounded text-xs bg-muted hover:bg-muted text-foreground">Close</button></div>
        </div>
      )}
      <div><button className="bg-blue-600 hover:bg-blue-700 text-foreground px-4 py-2 rounded" onClick={onSave}>Save Space</button></div>
    </div>
  );
};

