"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { load, save, K } from "../fm-panel-utils";
import type { SpaceRecord } from "../fm-panel-types";

interface SpaceListProps {
  projectId?: string;
  viewer?: any;
}

// EditSpaceFormInline component - inline edit form for spaces
const EditSpaceFormInline: React.FC<{
  space: SpaceRecord;
  projectId?: string;
  viewer?: any;
  onSave: () => void;
  onCancel: () => void;
}> = ({ space, projectId, viewer, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    level: space.level || '',
    name: space.name || '',
    area: space.area || '',
    description: space.description || '',
    building: space.building || '',
    spaceCode: space.spaceCode || ''
  });
  const [saving, setSaving] = useState(false);

  // Attempt to prefill building from model properties (if available) or project name
  useEffect(() => {
    let cancelled = false;
    const tryPrefill = async () => {
      if (formData.building && String(formData.building).trim() !== '') return;
      // First try: read building from the BIM model properties if we have the same model loaded
      try {
        if (viewer && space && space.dbId != null) {
          const props: any = await new Promise(resolve => {
            try { viewer.getProperties(space.dbId, resolve); } catch (e) { resolve(null); }
          });
          const getProp = (names: string[]) => {
            const lower = names.map(n => n.toLowerCase());
            const p = props?.properties?.find((p: any) => {
              const dn = p.displayName?.toLowerCase?.();
              return dn && (lower.includes(dn) || lower.some((n: string) => dn.includes(n)));
            });
            return p?.displayValue?.toString();
          };
          const b = getProp(['Building', 'Edificio', 'Building Name', 'BuildingName', 'Nome edificio']);
          if (b && !cancelled) {
            setFormData(d => ({ ...d, building: b }));
            return;
          }
        }
      } catch (err) {
        // ignore
      }

      // Fallback: fetch project metadata and use Project Name
      try {
        if (projectId) {
          const res = await fetch(`/api/projects/${projectId}`);
          if (res.ok) {
            const json = await res.json();
            const projName = json?.project?.name || json?.name || '';
            if (projName && !cancelled) setFormData(d => ({ ...d, building: projName }));
          }
        }
      } catch (err) { /* ignore */ }
    };
    tryPrefill();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [space, projectId, viewer]);

  const handleSave = async () => {
    setSaving(true);
    try {
      console.log(`[EditSpace] Saving space ${space.id} for project ${projectId}`, formData);
      const res = await fetch(`/api/projects/${projectId}/spaces/${space.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      console.log(`[EditSpace] Response status:`, res.status);
      if (res.ok) {
        const data = await res.json();
        console.log(`[EditSpace] Space updated successfully:`, data);
        onSave();
      } else {
        const errData = await res.text();
        console.error(`[EditSpace] Update failed with status ${res.status}:`, errData);
        alert(`Failed to update space: ${res.status}`);
      }
    } catch (err) {
      console.error('[EditSpace] Error:', err);
      alert('Error updating space');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-gray-400">Building</label>
        <input 
          type="text"
          value={formData.building}
          onChange={e => setFormData(d => ({ ...d, building: e.target.value }))}
          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white placeholder-gray-500"
          placeholder="Building"
        />
      </div>
      <div>
        <label className="text-xs text-gray-400">Level</label>
        <input 
          type="text"
          value={formData.level}
          onChange={e => setFormData(d => ({ ...d, level: e.target.value }))}
          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white placeholder-gray-500"
          placeholder="Level"
        />
      </div>
      <div>
        <label className="text-xs text-gray-400">Room Name</label>
        <input 
          type="text"
          value={formData.name}
          onChange={e => setFormData(d => ({ ...d, name: e.target.value }))}
          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white placeholder-gray-500"
          placeholder="Room Name"
        />
      </div>
      <div>
        <label className="text-xs text-gray-400">Area (m²)</label>
        <input 
          type="number"
          value={formData.area}
          onChange={e => setFormData(d => ({ ...d, area: e.target.value }))}
          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white placeholder-gray-500"
          placeholder="Area"
        />
      </div>
      <div>
        <label className="text-xs text-gray-400">Space Code</label>
        <input 
          type="text"
          value={formData.spaceCode}
          onChange={e => setFormData(d => ({ ...d, spaceCode: e.target.value }))}
          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white placeholder-gray-500"
          placeholder="Space Code"
        />
      </div>
      <div>
        <label className="text-xs text-gray-400">Description</label>
        <textarea 
          value={formData.description}
          onChange={e => setFormData(d => ({ ...d, description: e.target.value }))}
          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white placeholder-gray-500 resize-none"
          placeholder="Description"
          rows={3}
        />
      </div>
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 rounded text-xs bg-gray-700 hover:bg-gray-600 text-white"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-1.5 rounded text-xs bg-blue-700 hover:bg-blue-600 text-white disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
};

export 
const SpaceList: React.FC<{ projectId?: string; viewer?: any; }> = ({ projectId, viewer }) => {
  // Fetch from DB only - no localStorage caching
  const [rows, setRows] = useState<SpaceRecord[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState(0);
  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  // Delete modal
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; id?: string; name?: string }>({ open: false });
  // Edit modal
  const [editModal, setEditModal] = useState<{ open: boolean; space?: SpaceRecord }>({ open: false });
  
  // Track levels extension availability
  const [levelsExtension, setLevelsExtension] = useState<any>(null);

  // Effect to load/detect levels extension
  useEffect(() => {
    if (!viewer) return;
    let attempts = 0;
    const checkExt = () => {
      const ext = viewer.getExtension('Autodesk.AEC.LevelsExtension');
      if (ext && ext.floorSelector && Array.isArray(ext.floorSelector.floorData) && ext.floorSelector.floorData.length > 0) {
        console.log('[Spaces] Levels extension detected with floors:', ext.floorSelector.floorData);
        setLevelsExtension(ext);
        return true;
      }
      return false;
    };

    if (checkExt()) return;

    const interval = setInterval(() => {
      attempts++;
      if (checkExt() || attempts > 20) clearInterval(interval); // Try for 10 seconds
    }, 500);

    return () => clearInterval(interval);
  }, [viewer]);

  // Re-normalize levels when extension becomes available
  useEffect(() => {
    if (!levelsExtension || rows.length === 0) return;
    
    const floors = levelsExtension.floorSelector.floorData;
    if (!floors || floors.length === 0) return;

    const normalizeLevel = (lv: any) => {
      try {
        const s = lv != null ? String(lv) : '';
        if (!s) return undefined;
        // If it already looks like a name (contains letters), keep it
        if (/[a-zA-Z]/.test(s) && !/^\d+$/.test(s)) return s;
        
        const n = Number(s);
        if (!isNaN(n) && floors[n]?.name) return String(floors[n].name);
        const m = s.match(/(^|\D)(\d{1,2})(\D|$)/);
        if (m && floors[Number(m[2])]?.name) return String(floors[Number(m[2])].name);
        return s;
      } catch { return lv; }
    };

    setRows(prevRows => {
      let changed = false;
      const newRows = prevRows.map(r => {
        const newLevel = normalizeLevel(r.level);
        if (newLevel !== r.level) {
          changed = true;
          return { ...r, level: newLevel };
        }
        return r;
      });
      return changed ? newRows : prevRows;
    });
  }, [levelsExtension, rows.length]); // Depend on rows.length to trigger when rows are loaded

  // Persist spaces to local storage to avoid flicker on minimize/restore and enable instant load
  useEffect(() => {
    try {
      save(K.spaces(projectId), rows);
    } catch (e) {
      // ignore
    }
  }, [rows, projectId]);

  // Hydrate from localStorage on client after mount. This avoids SSR/CSR mismatch.
  useEffect(() => {
    try {
      const persisted: SpaceRecord[] = load(K.spaces(projectId), [] as SpaceRecord[]);
      if (Array.isArray(persisted) && persisted.length > 0 && rows.length === 0) {
        // Filter to current model (if known) to avoid cross-model mixing on hydrate
        let mg: string | undefined;
        try {
          const g = viewer?.model?.getData?.()?.guid;
          if (g && typeof g === 'string') mg = g; else {
            const mid = viewer?.model?.id;
            if (mid != null) mg = String(mid);
          }
          if (!mg && projectId) {
            const ctxRaw = localStorage.getItem(`fm-context-${projectId}`);
            if (ctxRaw) { const ctx = JSON.parse(ctxRaw || '{}'); if (ctx?.modelGuid) mg = String(ctx.modelGuid); }
          }
        } catch (e) {
          // ignore
        }
        const filtered = mg ? persisted.filter(r => r.source !== 'BIM_MODEL' || r.modelGuid === mg) : persisted;
        setRows(filtered);
      }
    } catch (e) {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Helper to get current model GUID (if viewer is present)
  // Get unique model identifier combining guid+urn to handle cases where multiple models have same guid
  const getCurrentModelGuid = React.useCallback((): string | undefined => {
    try {
      const g = viewer?.model?.getData?.()?.guid;
      const urn = viewer?.model?.getData?.()?.urn || (viewer?.impl?.model?.myData?.urn);
      
      // Create composite key: guid|urn to ensure uniqueness across different models
      let compositeKey = '';
      if (g && typeof g === 'string') {
        compositeKey = g;
        // Append URN hash to distinguish models with same guid
        if (urn && typeof urn === 'string') {
          compositeKey = `${g}|${urn}`;
        }
      } else {
        const mid = viewer?.model?.id;
        if (mid != null) {
          compositeKey = String(mid);
          if (urn && typeof urn === 'string') {
            compositeKey = `${mid}|${urn}`;
          }
        }
      }
      
      if (compositeKey) return compositeKey;
      
      // Fallback to persisted fm-context (standalone)
      try {
        const ctxRaw = projectId ? localStorage.getItem(`fm-context-${projectId}`) : null;
        if (ctxRaw) { const ctx = JSON.parse(ctxRaw || '{}'); if (ctx?.modelGuid) return String(ctx.modelGuid); }
      } catch {}
      return undefined;
    } catch { return undefined; }
  }, [viewer, projectId]);

  // Merge server-returned rows with persisted client-side rows to avoid losing locally extracted/prefilled fields
  const mergeWithPersisted = (normalized: SpaceRecord[]): SpaceRecord[] => {
    try {
      const persisted: SpaceRecord[] = load(K.spaces(projectId), [] as SpaceRecord[]);
      // Use getCurrentModelGuid for consistent composite key (guid|urn)
      const mg = getCurrentModelGuid();
      const map = new Map<string, SpaceRecord>();
      const keyOf = (r: SpaceRecord) => (
        r.source === 'BIM_MODEL' && r.dbId != null ? `BIM|${r.modelGuid || 'g'}|${r.dbId}` : `MAN|${r.id}`
      );
      // seed with server rows
      for (const r of normalized) map.set(keyOf(r), r);
      // overlay persisted non-empty values so we don't lose metrics/building filled by extract or user
      for (const p of persisted) {
        // Skip persisted BIM rows from other models to prevent cross-model mixing
        if (p.source === 'BIM_MODEL' && mg && p.modelGuid && p.modelGuid !== mg) {
          console.log(`[Spaces][merge] SKIP persisted BIM row from different model: dbId=${p.dbId}, name=${p.name}, modelGuid=${p.modelGuid} (current=${mg})`);
          continue;
        }
        const k = keyOf(p);
        const target = map.get(k);
        if (!target) {
          map.set(k, p);
          continue;
        }
        const out = { ...target } as SpaceRecord;
        // fields we want to preserve if persisted has them
        const prefer = ['building', 'area', 'perimeter', 'volume', 'occupancy', 'description', 'name', 'spaceCode'];
        for (const f of prefer) {
          const val = (p as any)[f];
          if (val != null && val !== '' && !(typeof val === 'number' && Number(val) === 0)) {
            (out as any)[f] = val;
          }
        }
        map.set(k, out);
      }
      return Array.from(map.values());
    } catch (err) {
      return normalized;
    }
  };

  // Load from backend (scoped by model when possible)
  useEffect(() => {
    const run = async () => {
      if (!projectId) return;
      try {
        const mg = getCurrentModelGuid();
        console.log(`[Spaces] Initial load with modelGuid=${mg}`);
        // Prepare floors for display normalization
        let floors: any[] = [];
        try {
          let ext = (viewer && typeof viewer.getExtension === 'function') ? viewer.getExtension('Autodesk.AEC.LevelsExtension') : null;
          if (!ext && viewer && typeof (viewer as any).loadExtension === 'function') {
            try { ext = await (viewer as any).loadExtension('Autodesk.AEC.LevelsExtension'); } catch {}
          }
          const fs = (ext as any)?.floorSelector;
          floors = Array.isArray(fs?.floorData) ? fs.floorData : [];
        } catch {}
        const normalizeLevel = (lv: any) => {
          try {
            const s = lv != null ? String(lv) : '';
            if (!s) return undefined;
            const n = Number(s);
            if (!isNaN(n) && floors[n]?.name) return String(floors[n].name);
            const m = s.match(/(^|\D)(\d{1,2})(\D|$)/);
            if (m && floors[Number(m[2])]?.name) return String(floors[Number(m[2])].name);
            return s;
          } catch { return lv; }
        };
        const inferLevelByDbId = (dbId?: number | null): string | undefined => {
          try {
            if (dbId == null || !viewer?.model) return undefined;
            const it = viewer.model.getData?.()?.instanceTree;
            const fragList = viewer.model.getFragmentList?.();
            const THREE = (window as any).THREE;
            if (!it || !fragList || !THREE) return undefined;
            const fragIds: number[] = [];
            it.enumNodeFragments(dbId, (fid: number) => fragIds.push(fid));
            if (!fragIds.length) return undefined;
            const bbox = new THREE.Box3();
            const tmp = new THREE.Box3();
            for (const fid of fragIds) { fragList.getWorldBounds(fid, tmp); bbox.union(tmp); }
            const zc = (bbox.min.z + bbox.max.z) / 2;
            let best: { name: string; dist: number } | null = null;
            for (const f of floors) {
              const zMin = Number(f?.zMin ?? -Infinity), zMax = Number(f?.zMax ?? Infinity);
              const dist = (zc < zMin) ? (zMin - zc) : (zc > zMax ? (zc - zMax) : 0);
              if (best == null || dist < best.dist) best = { name: String(f?.name || ''), dist };
            }
            return best?.name || undefined;
          } catch { return undefined; }
        };
        const url = `/api/projects/${projectId}/spaces`; // Fetch ALL spaces, filter client-side
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data)) {
          // Normalize ids
          let normalized: SpaceRecord[] = data.map((d: any) => ({
            id: d.id || d._id || d.idStr || `${d.source || 'BIM_MODEL'}-${d.dbId || d.name || Math.random()}`,
            level: normalizeLevel(d.level),
            name: d.name,
            area: d.area,
            perimeter: d.perimeter,
            volume: d.volume,
            occupancy: d.occupancy,
            spaceCode: d.spaceCode,
            building: d.building,
            description: d.description,
            source: d.source,
            dbId: d.dbId ?? null,
            modelGuid: d.modelGuid,
            footprint: d.footprint || undefined,
            conflictWithId: d.conflictWithId
          }));
          // Correct level using Z inference for BIM records where possible
          normalized = normalized.map(r => {
            if (r.source === 'BIM_MODEL' && r.dbId != null) {
              const byZ = inferLevelByDbId(r.dbId);
              if (byZ) return { ...r, level: byZ };
            }
            return r;
          });
          
          // STRICT client-side filter: use equivalence-aware modelGuid match
          const parseModelGuid = (s?: string) => {
            if (!s) return { raw: '', left: '', right: '' };
            const i = s.indexOf('|');
            return i === -1 ? { raw: s, left: s, right: '' } : { raw: s, left: s.slice(0, i), right: s.slice(i + 1) };
          };
          const isSameModelGuid = (a?: string, b?: string) => {
            if (!a || !b) return false; if (a === b) return true;
            const A = parseModelGuid(a), B = parseModelGuid(b);
            if (A.left && B.left && A.left === B.left) return true;
            if (A.right && B.right && A.right === B.right) return true;
            if (A.left && B.raw && B.raw.startsWith(A.left + '|')) return true;
            if (B.left && A.raw && A.raw.startsWith(B.left + '|')) return true;
            return false;
          };
          const clientFiltered = mg 
            ? normalized.filter(r => {
                // Always include MANUAL spaces regardless of modelGuid mismatch (unless explicitly tied to another model, but we'll be lenient)
                if (r.source === 'MANUAL') return true;
                // For BIM spaces, enforce strict modelGuid match
                return isSameModelGuid(r.modelGuid as any, mg);
              })
            : normalized;
          
          console.log(`[Spaces] Initial load: server returned ${normalized.length}, STRICT client-filtered to ${clientFiltered.length}`);
          // Merge with persisted to avoid losing locally extracted/prefilled fields
          const mergedClient = mergeWithPersisted(clientFiltered);
          setRows(mergedClient);
          try {
            const mgSave = getCurrentModelGuid();
            const toSave = mgSave ? mergedClient.filter(r => r.source !== 'BIM_MODEL' || r.modelGuid === mgSave) : mergedClient;
            save(K.spaces(projectId), toSave);
          } catch {}
        }
      } catch (err) { console.error(err); }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, viewer]);

  // Ensure current rows reflect only the current model's BIM spaces when viewer/model changes
  // AND clear localStorage to prevent stale data accumulation
  useEffect(() => {
    const mg = getCurrentModelGuid();
    if (!mg) return;
    
    setRows(prev => {
      const filtered = prev.filter(r => r.source !== 'BIM_MODEL' || r.modelGuid === mg);
      // Also update localStorage immediately to purge stale BIM spaces
      try {
        save(K.spaces(projectId), filtered);
      } catch {}
      return filtered;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const [spaceSearch, setSpaceSearch] = useState('');
  const [spaceSortBy, setSpaceSortBy] = useState<'name'|'level'|'area'|'perimeter'|'volume'|'occupancy'>('name');
  const [spaceSortDir, setSpaceSortDir] = useState<'asc'|'desc'>('asc');
  const pageClamped = Math.min(Math.max(1, page), totalPages);
  const startIndex = (pageClamped - 1) * pageSize;
  const endIndex = Math.min(rows.length, startIndex + pageSize);
  const filteredRowsSpaces = React.useMemo(() => {
    if (!spaceSearch) return rows;
    const q = spaceSearch.toLowerCase();
    return rows.filter(r => (
      (r.name || '').toLowerCase().includes(q) ||
      (r.spaceCode || '').toLowerCase().includes(q) ||
      (r.level || '').toLowerCase().includes(q) ||
      (r.building || '').toLowerCase().includes(q) ||
      (r.description || '').toLowerCase().includes(q)
    ));
  }, [rows, spaceSearch]);
  const sortedRowsSpaces = React.useMemo(() => {
    const arr = [...filteredRowsSpaces];
    const cmp = (a: any, b: any) => {
      const dir = spaceSortDir === 'asc' ? 1 : -1;
      const get = (r: any) => {
        switch (spaceSortBy) {
          case 'level': return (r.level || '').toString().toLowerCase();
          case 'area': return Number(r.area || 0);
          case 'perimeter': return Number(r.perimeter || 0);
          case 'volume': return Number(r.volume || 0);
          case 'occupancy': return Number(r.occupancy || 0);
          default: return (r.name || '').toString().toLowerCase();
        }
      };
      const va = get(a), vb = get(b);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    };
    return arr.sort(cmp);
  }, [filteredRowsSpaces, spaceSortBy, spaceSortDir]);
  const paginatedRows = sortedRowsSpaces.slice(startIndex, endIndex);

  const findRoomDbIds = async (): Promise<number[]> => {
    if (!viewer) return [];
    // Restrict to clear room/space categories only to avoid false positives
  const queries = ['Revit Rooms', 'Rooms', 'Spaces', 'Stanze', 'Spazi', 'Locali', 'Locale', 'Ambiente', 'Revit Stanze', 'Revit Locali'];
    const all = new Set<number>();
    for (const q of queries) {
      // eslint-disable-next-line no-await-in-loop
      const ids: number[] = await new Promise(resolve => {
        try {
          viewer.search(q, (dbids: number[]) => resolve(dbids || []), () => resolve([]), ['Category'], { searchHidden: true });
        } catch { resolve([]); }
      });
      console.log(`[Spaces] search '${q}' -> ${ids.length}`);
      ids.forEach(id => all.add(id));
    }
    console.log(`[Spaces] total unique dbIds found: ${all.size}`);
    return Array.from(all);
  };

  const extractRoomsFromBIM = async () => {
    if (!viewer) return;
    setIsExtracting(true);
    setExtractionProgress(1);
    try {
      const modelGuid = getCurrentModelGuid();
      console.log(`[Spaces] Extracting with composite modelGuid: ${modelGuid}`);
      // Prepare floor names and floors data for normalization
      let floorNames: string[] = [];
      let floors2: any[] = [];
      try {
        let ext = (viewer && typeof viewer.getExtension === 'function') ? viewer.getExtension('Autodesk.AEC.LevelsExtension') : null;
        if (!ext && viewer && typeof (viewer as any).loadExtension === 'function') {
          try { ext = await (viewer as any).loadExtension('Autodesk.AEC.LevelsExtension'); } catch {}
        }
        const fs = (ext as any)?.floorSelector;
        if (Array.isArray(fs?.floorData)) {
          floorNames = fs.floorData.map((f: any) => String(f?.name || ''));
          floors2 = fs.floorData;
        } else {
          floorNames = [];
          floors2 = [];
        }
      } catch {}
      const normalizeLevel = (lv: any) => {
        try {
          const s = lv != null ? String(lv) : '';
          if (!s) return undefined;
          const n = Number(s);
          if (!isNaN(n) && floorNames[n]) return floorNames[n];
          const m = s.match(/(^|\D)(\d{1,2})(\D|$)/);
          if (m && floorNames[Number(m[2])]) return floorNames[Number(m[2])];
          return s;
        } catch { return lv; }
      };
      const inferLevelByDbId = (dbId?: number | null): string | undefined => {
        try {
          if (dbId == null || !viewer?.model) return undefined;
          const it = viewer.model.getData?.()?.instanceTree;
          const fragList = viewer.model.getFragmentList?.();
          const THREE = (window as any).THREE;
          if (!it || !fragList || !THREE) return undefined;
          const fragIds: number[] = [];
          it.enumNodeFragments(dbId, (fid: number) => fragIds.push(fid));
          if (!fragIds.length) return undefined;
          const bbox = new THREE.Box3();
          const tmp = new THREE.Box3();
          for (const fid of fragIds) { fragList.getWorldBounds(fid, tmp); bbox.union(tmp); }
          const zc = (bbox.min.z + bbox.max.z) / 2;
          let best: { name: string; dist: number } | null = null;
          if (!Array.isArray(floors2) || floors2.length === 0) return undefined;
          for (const f of floors2) {
            const zMin = Number((f as any)?.zMin ?? -Infinity), zMax = Number((f as any)?.zMax ?? Infinity);
            const dist = (zc < zMin) ? (zMin - zc) : (zc > zMax ? (zc - zMax) : 0);
            if (best == null || dist < best.dist) best = { name: String((f as any)?.name || ''), dist };
          }
          return best?.name || undefined;
        } catch { return undefined; }
      };
      const dbids = await findRoomDbIds();
      if (!dbids || dbids.length === 0) {
        setExtractionProgress(100);
        setIsExtracting(false);
        return;
      }
      const propsList: any[] = [];
      // Try to read model-level Building/Project properties once and reuse as fallback
      let modelLevelBuilding: string | undefined;
      try {
        const rootId = viewer?.model?.getRootId ? viewer.model.getRootId() : null;
        if (rootId != null) {
          // eslint-disable-next-line no-await-in-loop
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
          modelLevelBuilding = getPropFrom(rootProps, ['Building', 'Edificio', 'Building Name', 'BuildingName', 'Nome edificio', 'Project Name', 'Project Name']);
        }
      } catch (err) {
        // ignore
      }
      console.log(`[Spaces] model-level building fallback='${modelLevelBuilding}'`);
      const total = dbids.length;
      for (let i = 0; i < total; i++) {
        // eslint-disable-next-line no-await-in-loop
        const p = await new Promise<any>(resolve => viewer.getProperties(dbids[i], resolve));
        propsList.push(p);
        const base = 5; // reserve first 5% for search
        const pct = base + Math.round(((i + 1) / total) * 75); // up to 80% during properties collection
        setExtractionProgress(Math.min(80, Math.max(base, pct)));
      }
      let kept = 0, skipped = 0;
      // Helper: robust numeric parsing with unit normalization and locale support
      const parseMeasure = (raw: any, kind: 'length' | 'area' | 'volume'): number | undefined => {
        if (raw == null) return undefined;
        if (typeof raw === 'number' && !isNaN(raw)) {
          // Auto-detect likely units based on magnitude
          if (kind === 'length') {
            // If > 100, likely mm; convert to m
            return raw > 100 ? raw / 1000 : raw;
          }
          if (kind === 'area') {
            // If > 1000, likely mm²; convert to m²
            return raw > 1000 ? raw / 1_000_000 : raw;
          }
          if (kind === 'volume') {
            // If > 10000, likely mm³; convert to m³
            return raw > 10000 ? raw / 1_000_000_000 : raw;
          }
          return raw;
        }
        let s = String(raw).trim();
        const sLower = s.toLowerCase();
        s = s.replace(/\u00A0/g, ' ').replace(/,/g, '.');
        const match = s.match(/-?[0-9]+(?:\.[0-9]+)?/g);
        if (!match || !match.length) return undefined;
        const num = parseFloat(match[match.length - 1]);
        if (!isFinite(num)) return undefined;
        const has = (u: string) => sLower.includes(u);
        if (kind === 'length') {
          if (has('mm')) return num / 1000;
          if (has('cm')) return num / 100;
          if (has('ft') || has('feet')) return num * 0.3048;
          // Auto-detect: if > 100, likely mm
          return num > 100 ? num / 1000 : num;
        }
        if (kind === 'area') {
          if (has('mm2') || has('mm^2') || has('mm²')) return num / 1_000_000;
          if (has('cm2') || has('cm^2') || has('cm²')) return num / 10_000;
          if (has('ft2') || has('ft^2') || has('ft²') || has('sf') || has('sq ft')) return num * 0.09290304;
          // Auto-detect: if > 1000, likely mm²
          return num > 1000 ? num / 1_000_000 : num;
        }
        // volume
        if (has('mm3') || has('mm^3') || has('mm³')) return num / 1_000_000_000;
        if (has('cm3') || has('cm^3') || has('cm³')) return num / 1_000_000;
        if (has('ft3') || has('ft^3') || has('ft³') || has('cf') || has('cu ft')) return num * 0.028316846592;
        // Auto-detect: if > 10000, likely mm³
        return num > 10000 ? num / 1_000_000_000 : num;
      };
      const candidates: SpaceRecord[] = propsList.map((p: any) => {
        const get = (names: string[]): string | undefined => {
          if (!p) return undefined;
          // Check direct properties first (for flattened objects)
          for (const n of names) {
            const k = n.toLowerCase();
            if ((p as any)[n] !== undefined) return (p as any)[n];
            if ((p as any)[k] !== undefined) return (p as any)[k];
            const foundKey = Object.keys(p).find(key => key.toLowerCase() === k);
            if (foundKey) return (p as any)[foundKey];
          }

          if (!Array.isArray(p.properties)) return undefined;
          const lower = names.map(n => n.toLowerCase());
          const prop = p.properties.find((x: any) => {
            const dn = x.displayName?.toLowerCase?.();
            return dn && (lower.includes(dn) || lower.some(n => dn.includes(n)));
          });
          return prop?.displayValue?.toString();
        };
        const category = get(['Category', 'Categoria']);
        const cat = category?.toString()?.trim()?.toLowerCase?.();
        
        // Log raw category for debugging
        console.log(`[Spaces][debug] dbId=${p?.dbId} raw category='${category}' normalized='${cat}'`);
        
        // Match category more flexibly - check if it contains room/space/locale keywords
        const isRoomCat = !!cat && (
          cat.includes('room') || 
          cat.includes('stanza') || 
          cat.includes('stanze') ||
          /^rooms?$/.test(cat) || 
          /^revit rooms?$/.test(cat)
        );
        const isSpaceCat = !!cat && (
          cat.includes('space') || 
          cat.includes('spazi') || 
          cat.includes('spazio') ||
          cat.includes('local') || 
          cat.includes('ambiente') ||
          /^spaces?$/.test(cat) || 
          /^locali?$/.test(cat)
        );
        
  const level = get(['Level', 'Reference Level', 'Livello', 'Livello di riferimento', 'Piano', 'Piano di riferimento']);
        const name = p?.name || get(['Name', 'Room Name', 'Space Name', 'Nome', 'Nome stanza', 'Nome spazio', 'Nome locale', 'Nome ambiente', 'Denominazione']);
        const code = get(['Number', 'Room Number', 'Space Number', 'Numero', 'Numero stanza', 'Numero spazio', 'Numero locale', 'Codice', 'Codice locale', 'Codice stanza', 'ID', 'ID locale', 'ID stanza']);
  const desc = get(['Comments', 'Description', 'Commenti', 'Descrizione']);
        
        // Try ALL possible property names for area/perimeter/volume/occupancy
        const areaStr = get([
          'Area', 'Superficie', 'Superficie utile', 'Superficie netta', 'Area utile', 'Area netta', 
          'Superficie (m²)', 'Gross Area', 'Area Computed', 'Computed Area', 'Room Area'
        ]);
        const areaNum = parseMeasure(areaStr, 'area');
        
        const perimeterStr = get([
          'Perimeter', 'Perimetro', 'Perimeter (Gross)', 'Room Perimeter', 'Gross Perimeter',
          'Computed Perimeter', 'Perimeter (m)', 'Room Perimeter (m)'
        ]);
        const perimeterNum = parseMeasure(perimeterStr, 'length');
        
        const volumeStr = get([
          'Volume', 'Volumetria', 'Volume Lordo', 'Gross Volume', 'GrossVolume', 'Room Volume', 'Computed Volume',
          'Net Volume', 'Room Volume (m³)', 'Room Volume (m3)'
        ]);
        let volumeNum = parseMeasure(volumeStr, 'volume');
        
        // Fallback: compute volume from area and unbounded height when explicit Volume is missing
        // Works for English ("Unbounded Height") and Italian ("Altezza non delimitata").
        if ((volumeNum == null || isNaN(Number(volumeNum)) || Number(volumeNum) === 0)) {
          const unboundedHeightStr = get(['Unbounded Height', 'Altezza non delimitata']);
          const heightNum = parseMeasure(unboundedHeightStr, 'length');
          if (heightNum != null && !isNaN(Number(heightNum))) {
            if (areaNum != null && !isNaN(Number(areaNum))) {
              volumeNum = Number(areaNum) * Number(heightNum);
            }
          }
        }
        
        const occupancyStr = get([
          'Occupancy', 'Occupazione', 'Numero persone', 'Number of People', 'Occupanti', 'People Count', 'Occupant'
        ]);
        const occupancyNum = occupancyStr ? (() => {
          const s = String(occupancyStr).replace(/\u00A0/g, ' ').replace(/,/g, '.');
          const m = s.match(/-?[0-9]+(?:\.[0-9]+)?/);
          return m ? Number(m[0]) : undefined;
        })() : undefined;

        let buildingStr = get(['Building', 'Edificio', 'Building Name', 'BuildingName', 'Nome edificio']);
        let usedFallback = false;
        if ((!buildingStr || String(buildingStr).trim() === '') && modelLevelBuilding) {
          buildingStr = modelLevelBuilding;
          usedFallback = true;
        }
        // debug building extraction (room-level and whether model-level fallback used)
        console.log(`[Spaces][extract] dbId=${p?.dbId} building='${buildingStr}' (fallback=${usedFallback}) area='${areaStr}' perimeter='${perimeterStr}' volume='${volumeStr}'`);

        // Filter: must be Rooms/Spaces category and have a name or code; Level/Area are optional (we'll include if missing)
        let skipReason: string | null = null;
        if (!(isRoomCat || isSpaceCat)) skipReason = `bad-category (category='${cat || ''}')`;
        else if (!((name && String(name).trim().length > 0) || (code && String(code).trim().length > 0))) {
          // As a last resort, synthesize a name from dbId to keep the room
          const dbId = p?.dbId;
          const labelBase = isRoomCat ? (cat?.includes('stan') ? 'Stanza' : 'Room') : (cat?.includes('local') ? 'Locale' : (cat?.includes('spaz') ? 'Spazio' : 'Space'));
          const synthetic = dbId != null ? `${labelBase} ${dbId}` : undefined;
          if (!synthetic) skipReason = `missing-name-and-number`;
          else {
            // Use synthetic name and accept
            (p as any).__syntheticName = synthetic;
          }
        }
        if (skipReason) {
          skipped++;
          console.warn(`[Spaces][skip] dbId=${p?.dbId} cat='${cat}' lvl='${level}' name='${name}' code='${code}' area='${areaStr}' reason=${skipReason}`);
          return null as any;
        }
        kept++;

        return {
          id: `space-${modelGuid || 'g'}-${p?.dbId ?? p?.externalId ?? Date.now()}`,
          level: normalizeLevel(level) || inferLevelByDbId(p?.dbId) || undefined,
          name: name || (p as any).__syntheticName || undefined,
          area: isNaN(Number(areaNum)) ? undefined : Number(areaNum),
          perimeter: isNaN(Number(perimeterNum)) ? undefined : Number(perimeterNum),
          volume: isNaN(Number(volumeNum)) ? undefined : Number(volumeNum),
          building: buildingStr || undefined,
          occupancy: isNaN(Number(occupancyNum)) ? undefined : Number(occupancyNum),
          spaceCode: code || undefined,
          description: desc || undefined,
          source: 'BIM_MODEL',
          dbId: p?.dbId ?? null,
          modelGuid: modelGuid
        } as SpaceRecord;
      }).filter(Boolean) as SpaceRecord[];
      console.log(`[Spaces] props processed=${propsList.length}, kept=${kept}, skipped=${skipped}`);

      // Deduplicate within this extraction by modelGuid+dbId
      const seen = new Map<string, SpaceRecord>();
      for (const r of candidates) {
        const key = (r.source === 'BIM_MODEL' && r.dbId != null)
          ? `BIM|${r.modelGuid || 'g'}|${r.dbId}`
          : `LVLNAME|${(r.level || '').toLowerCase()}|${(r.name || '').toLowerCase()}|${(r.spaceCode || '').toLowerCase()}`;
        if (!seen.has(key)) seen.set(key, r);
      }
      const newRows = Array.from(seen.values());
      setExtractionProgress(90);
  console.log(`[Spaces] deduped newRows=${newRows.length}`);

      // Prefer server upsert + refresh when a projectId is available
      if (projectId && newRows.length) {
        try {
          // Ensure volume is preserved in the payload
          const payload = newRows.map(r => ({
            ...r,
            volume: r.volume // Explicitly include volume
          }));

          await fetch(`/api/projects/${projectId}/spaces`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'upsertMany', spaces: payload })
          });
          const mg = getCurrentModelGuid();
          console.log(`[Spaces] Fetching from server with modelGuid=${mg}`);
          const res = await fetch(`/api/projects/${projectId}/spaces`); // Fetch ALL spaces, filter client-side
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) {
              const normalized: SpaceRecord[] = data.map((d: any) => ({
                id: d.id || d._id || d.idStr || `${d.source || 'BIM_MODEL'}-${d.dbId || d.name || Math.random()}`,
                level: d.level,
                name: d.name,
                area: d.area,
                perimeter: d.perimeter,
                volume: d.volume,
                occupancy: d.occupancy,
                spaceCode: d.spaceCode,
                building: d.building,
                description: d.description,
                source: d.source,
                dbId: d.dbId ?? null,
                modelGuid: d.modelGuid,
                footprint: d.footprint || undefined,
                conflictWithId: d.conflictWithId
              }));
              
              // STRICT client-side filter: use equivalence-aware modelGuid match (same as Initial Load)
              const parseModelGuid = (s?: string) => {
                if (!s) return { raw: '', left: '', right: '' };
                const i = s.indexOf('|');
                return i === -1 ? { raw: s, left: s, right: '' } : { raw: s, left: s.slice(0, i), right: s.slice(i + 1) };
              };
              const isSameModelGuid = (a?: string, b?: string) => {
                if (!a || !b) return false; if (a === b) return true;
                const A = parseModelGuid(a), B = parseModelGuid(b);
                if (A.left && B.left && A.left === B.left) return true;
                if (A.right && B.right && A.right === B.right) return true;
                if (A.left && B.raw && B.raw.startsWith(A.left + '|')) return true;
                if (B.left && A.raw && A.raw.startsWith(B.left + '|')) return true;
                return false;
              };

              const clientFiltered = mg 
                ? normalized.filter(r => {
                    // Always include MANUAL spaces regardless of modelGuid mismatch
                    if (r.source === 'MANUAL') return true;
                    // For BIM spaces, enforce strict modelGuid match
                    return isSameModelGuid(r.modelGuid as any, mg);
                  })
                : normalized;
              
              console.log(`[Spaces] Server returned ${normalized.length}, STRICT client-filtered to ${clientFiltered.length} for modelGuid=${mg}`);
              
              // CRITICAL FIX: We must NOT filter out spaces just because they weren't in the current extraction.
              // The user might be extracting floor by floor, or room by room.
              // We should keep everything returned by the server (clientFiltered), and just update the metrics
              // for the spaces that were part of this specific extraction (newRows).
              
              const enriched = clientFiltered.map(r => {
                // If it's a BIM space, check if we have fresh data for it in newRows
                if (r.source === 'BIM_MODEL' && r.dbId != null) {
                   const fresh = newRows.find(nr => nr.dbId === r.dbId && nr.modelGuid === r.modelGuid);
                   if (fresh) {
                     return {
                       ...r,
                       // Update metrics if they are better/newer in the fresh extraction
                       area: fresh.area ?? r.area,
                       perimeter: fresh.perimeter ?? r.perimeter,
                       volume: fresh.volume ?? r.volume,
                       occupancy: fresh.occupancy ?? r.occupancy,
                       level: fresh.level ?? r.level,
                       name: fresh.name ?? r.name
                     };
                   }
                }
                return r;
              });
              
              console.log(`[Spaces] Final list has ${enriched.length} spaces (merged DB + fresh extraction updates)`);
              
              // Re-normalize levels using the extension if available
              let finalRows = enriched;
              
              // Try to get levels extension again if not available
              if (!levelsExtension && viewer) {
                 try {
                   const ext = viewer.getExtension('Autodesk.AEC.LevelsExtension');
                   if (ext) setLevelsExtension(ext);
                 } catch {}
              }
              
              // Use either the state extension or try to get it directly
              const activeExt = levelsExtension || (viewer && viewer.getExtension ? viewer.getExtension('Autodesk.AEC.LevelsExtension') : null);
              
              if (activeExt && activeExt.floorSelector && Array.isArray(activeExt.floorSelector.floorData)) {
                 const floors = activeExt.floorSelector.floorData;
                 const normalizeLevel = (lv: any) => {
                    try {
                      const s = lv != null ? String(lv) : '';
                      if (!s) return undefined;
                      if (/[a-zA-Z]/.test(s) && !/^\d+$/.test(s)) return s;
                      const n = Number(s);
                      if (!isNaN(n) && floors[n]?.name) return String(floors[n].name);
                      const m = s.match(/(^|\D)(\d{1,2})(\D|$)/);
                      if (m && floors[Number(m[2])]?.name) return String(floors[Number(m[2])].name);
                      return s;
                    } catch { return lv; }
                 };
                 finalRows = enriched.map(r => ({ ...r, level: normalizeLevel(r.level) }));
              }

              const mergedEnriched = mergeWithPersisted(finalRows);
              setRows(mergedEnriched);
              try {
                const mgSave2 = getCurrentModelGuid();
                const toSave2 = mgSave2 ? mergedEnriched.filter(r => r.source !== 'BIM_MODEL' || r.modelGuid === mgSave2) : mergedEnriched;
                save(K.spaces(projectId), toSave2);
              } catch {}
            }
          }
          setExtractionProgress(100);
        } catch (e) {
          console.error('[Spaces] upsertMany/refresh failed', e);
        }
      } else if (!projectId) {
        // Fallback: local merge with dedupe (only when no projectId - for testing)
        const score = (r: SpaceRecord) => {
          let s = 0;
          if (r.source === 'MANUAL') s += 3;
          if (r.area && r.area > 0) s += 2;
          if (r.name) s += 1;
          if (r.spaceCode) s += 1;
          if (r.footprint && Array.isArray(r.footprint.points) && r.footprint.points.length >= 3) s += 2;
          return s;
        };
        // Keep only current-model BIM rows from existing list to avoid cross-model mixing
        const mg = getCurrentModelGuid();
        const existingFiltered = rows.filter(r => r.source !== 'BIM_MODEL' || r.modelGuid === mg);
        const all = [...existingFiltered, ...newRows];
        const map = new Map<string, SpaceRecord>();
        for (const r of all) {
          const key = (r.source === 'BIM_MODEL' && r.dbId != null)
            ? `BIM|${r.modelGuid || 'g'}|${r.dbId}`
            : `LVLNAME|${(r.level || '').toLowerCase()}|${(r.name || '').toLowerCase()}|${(r.spaceCode || '').toLowerCase()}`;
          const ex = map.get(key);
          if (!ex) map.set(key, r);
          else map.set(key, score(r) >= score(ex) ? r : ex);
        }
        const merged = Array.from(map.values());
        setRows(merged);
        try {
          const mgSave3 = getCurrentModelGuid();
          const toSave3 = mgSave3 ? merged.filter(r => r.source !== 'BIM_MODEL' || r.modelGuid === mgSave3) : merged;
          save(K.spaces(projectId), toSave3);
        } catch {}
        console.log(`[Spaces] local merge result: ${merged.length} rows`);
        setExtractionProgress(100);
      } else {
        // projectId present but no newRows: just reload from server for current model
        console.warn('[Spaces] No new rows extracted, reloading from server');
        try {
          const mg = getCurrentModelGuid();
          console.log(`[Spaces] No new rows - reloading from server with modelGuid=${mg}`);
          const res = await fetch(`/api/projects/${projectId}/spaces`); // Fetch ALL spaces, filter client-side
          if (res.ok) {
            const data = await res.json();
            const normalized: SpaceRecord[] = Array.isArray(data) ? data.map((d: any) => ({
              id: d.id || d._id || d.idStr || `${d.source || 'BIM_MODEL'}-${d.dbId || d.name || Math.random()}`,
              level: d.level,
              name: d.name,
              area: d.area,
              perimeter: d.perimeter,
              volume: d.volume,
              occupancy: d.occupancy,
              spaceCode: d.spaceCode,
              building: d.building,
              description: d.description,
              source: d.source,
              dbId: d.dbId ?? null,
              modelGuid: d.modelGuid,
              footprint: d.footprint || undefined,
              conflictWithId: d.conflictWithId
            })) : [];
            
            // STRICT client-side filter for safety - ONLY spaces from current model
            const parseModelGuid = (s?: string) => {
              if (!s) return { raw: '', left: '', right: '' };
              const i = s.indexOf('|');
              return i === -1 ? { raw: s, left: s, right: '' } : { raw: s, left: s.slice(0, i), right: s.slice(i + 1) };
            };
            const isSameModelGuid = (a?: string, b?: string) => {
              if (!a || !b) return false; if (a === b) return true;
              const A = parseModelGuid(a), B = parseModelGuid(b);
              if (A.left && B.left && A.left === B.left) return true;
              if (A.right && B.right && A.right === B.right) return true;
              if (A.left && B.raw && B.raw.startsWith(A.left + '|')) return true;
              if (B.left && A.raw && A.raw.startsWith(B.left + '|')) return true;
              return false;
            };
            const clientFiltered = mg 
              ? normalized.filter(r => {
                  // Always include MANUAL spaces regardless of modelGuid mismatch
                  if (r.source === 'MANUAL') return true;
                  // For BIM spaces, enforce strict modelGuid match
                  return isSameModelGuid(r.modelGuid as any, mg);
                })
              : normalized;
            
            console.log(`[Spaces] Server returned ${normalized.length}, STRICT client-filtered to ${clientFiltered.length} for modelGuid=${mg}`);
            // Nothing extracted this round; keep rows as-is but prefer persisted values
            setRows(mergeWithPersisted(clientFiltered));
          }
        } catch (e) {
          console.warn('[Spaces] reload after empty extraction failed', e);
        }
        setExtractionProgress(100);
      }
    } finally {
      setIsExtracting(false);
      // Reset the progress after a short delay so user sees 100%
      setTimeout(() => setExtractionProgress(0), 800);
    }
  };

  // Auto-refresh spaces when Space list opens (once per mount)
  const autoExtractSpacesOnceRef = React.useRef(false);
  useEffect(() => {
    // Disabled auto-extract per requirements: refresh only on explicit extract or space-created event
    // Keeping ref logic in case we re-enable later
    if (autoExtractSpacesOnceRef.current) return;
    autoExtractSpacesOnceRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, viewer]);

  // Listen for space-created events to refresh list
  useEffect(() => {
    const handleSpaceCreated = (e: CustomEvent) => {
      if (e.detail?.projectId !== projectId) return;
      const mg = getCurrentModelGuid();
      // Optimistic insert at top if event contains the space
      const spaceRaw = e.detail?.space as any;
      const space = (spaceRaw && spaceRaw.space) ? (spaceRaw.space as SpaceRecord) : (spaceRaw as SpaceRecord);
      if (space) {
        const parseModelGuid = (s?: string) => {
          if (!s) return { raw: '', left: '', right: '' };
          const i = s.indexOf('|');
          return i === -1 ? { raw: s, left: s, right: '' } : { raw: s, left: s.slice(0, i), right: s.slice(i + 1) };
        };
        const isSameModelGuid = (a?: string, b?: string) => {
          if (!a || !b) return false; if (a === b) return true;
          const A = parseModelGuid(a), B = parseModelGuid(b);
          if (A.left && B.left && A.left === B.left) return true;
          if (A.right && B.right && A.right === B.right) return true;
          if (A.left && B.raw && B.raw.startsWith(A.left + '|')) return true;
          if (B.left && A.raw && A.raw.startsWith(B.left + '|')) return true;
          return false;
        };
        const passes = !mg || !space.modelGuid || isSameModelGuid(space.modelGuid as any, mg);
        if (passes) {
          setRows(prev => [space, ...prev]);
        }
      }
      console.log('[SpaceList] Space created event received, reloading from DB');
      fetch(`/api/projects/${projectId}/spaces`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            // Prepare floors for normalization
            let floors: any[] = [] as any[];
            (async () => {
              try {
                let ext = (viewer && typeof viewer.getExtension === 'function') ? viewer.getExtension('Autodesk.AEC.LevelsExtension') : null;
                if (!ext && viewer && typeof (viewer as any).loadExtension === 'function') {
                  try { ext = await (viewer as any).loadExtension('Autodesk.AEC.LevelsExtension'); } catch {}
                }
                const fs = (ext as any)?.floorSelector;
                floors = Array.isArray(fs?.floorData) ? fs.floorData : [];
              } catch {}
              const normalizeLevel = (lv: any) => {
                try {
                  const s = lv != null ? String(lv) : '';
                  if (!s) return undefined;
                  const n = Number(s);
                  if (!isNaN(n) && floors[n]?.name) return String(floors[n].name);
                  const m = s.match(/(^|\D)(\d{1,2})(\D|$)/);
                  if (m && floors[Number(m[2])]?.name) return String(floors[Number(m[2])].name);
                  return s;
                } catch { return lv; }
              };
              const inferLevelByDbId = (dbId?: number | null): string | undefined => {
                try {
                  if (dbId == null || !viewer?.model) return undefined;
                  const it = viewer.model.getData?.()?.instanceTree;
                  const fragList = viewer.model.getFragmentList?.();
                  const THREE = (window as any).THREE;
                  if (!it || !fragList || !THREE) return undefined;
                  const fragIds: number[] = [];
                  it.enumNodeFragments(dbId, (fid: number) => fragIds.push(fid));
                  if (!fragIds.length) return undefined;
                  const bbox = new THREE.Box3();
                  const tmp = new THREE.Box3();
                  for (const fid of fragIds) { fragList.getWorldBounds(fid, tmp); bbox.union(tmp); }
                  const zc = (bbox.min.z + bbox.max.z) / 2;
                  let best: { name: string; dist: number } | null = null;
                  for (const f of floors) {
                    const zMin = Number(f?.zMin ?? -Infinity), zMax = Number(f?.zMax ?? Infinity);
                    const dist = (zc < zMin) ? (zMin - zc) : (zc > zMax ? (zc - zMax) : 0);
                    if (best == null || dist < best.dist) best = { name: String(f?.name || ''), dist };
                  }
                  return best?.name || undefined;
                } catch { return undefined; }
              };
              let normalized: SpaceRecord[] = data.map((d: any) => ({
                id: d.id || d._id || d.idStr || `${d.source || 'MANUAL'}-${d.dbId || d.name || Math.random()}`,
                level: normalizeLevel(d.level),
                name: d.name,
                area: d.area,
                perimeter: d.perimeter,
                volume: d.volume,
                occupancy: d.occupancy,
                spaceCode: d.spaceCode,
                building: d.building,
                description: d.description,
                source: d.source,
                dbId: d.dbId ?? null,
                modelGuid: d.modelGuid,
                footprint: d.footprint || undefined,
                conflictWithId: d.conflictWithId
              }));
              normalized = normalized.map(r => {
                if (r.source === 'BIM_MODEL' && r.dbId != null) {
                  const byZ = inferLevelByDbId(r.dbId);
                  if (byZ) return { ...r, level: byZ };
                }
                return r;
              });
              // STRICT filter: equivalence-aware modelGuid
              const parseModelGuid = (s?: string) => {
                if (!s) return { raw: '', left: '', right: '' };
                const i = s.indexOf('|');
                return i === -1 ? { raw: s, left: s, right: '' } : { raw: s, left: s.slice(0, i), right: s.slice(i + 1) };
              };
              const isSameModelGuid = (a?: string, b?: string) => {
                if (!a || !b) return false; if (a === b) return true;
                const A = parseModelGuid(a), B = parseModelGuid(b);
                if (A.left && B.left && A.left === B.left) return true;
                if (A.right && B.right && A.right === B.right) return true;
                if (A.left && B.raw && B.raw.startsWith(A.left + '|')) return true;
                if (B.left && A.raw && A.raw.startsWith(B.left + '|')) return true;
                return false;
              };
              const clientFiltered = mg 
                ? normalized.filter(r => {
                    // Always include MANUAL spaces regardless of modelGuid mismatch
                    if (r.source === 'MANUAL') return true;
                    // For BIM spaces, enforce strict modelGuid match
                    return isSameModelGuid(r.modelGuid as any, mg);
                  })
                : normalized;
              console.log(`[SpaceList] Reloaded after space-created: ${clientFiltered.length} spaces`);
              setRows(mergeWithPersisted(clientFiltered));
              })();
            }
          })
          .catch(err => console.error('[SpaceList] Failed to reload after space-created', err));
        };
        
        window.addEventListener('space-created', handleSpaceCreated as any);
        return () => window.removeEventListener('space-created', handleSpaceCreated as any);
      }, [projectId, getCurrentModelGuid]);

  const onRowClick = (r: SpaceRecord) => {
    try {
      if (!viewer || !r.dbId) return;
      // Isolate and fit to view the room
      if (viewer.isolate) viewer.isolate([r.dbId]);
      if (viewer.fitToView) viewer.fitToView([r.dbId]);
    } catch { }
  };

  const savedOverlayName = 'fm-saved-footprint';
  const clearSavedFootprint = () => {
    try {
      if (!viewer?.impl) return;
      const scn = (viewer.impl.overlayScenes || {})[savedOverlayName];
      const scene = scn?.scene;
      if (scene) {
        const children = [...scene.children];
        children.forEach(ch => scene.remove(ch));
        viewer.impl.invalidate(true);
      }
    } catch { }
  };

  const drawSavedFootprint = (fp?: { points?: { x: number; y: number; z?: number }[]; z?: number | null }) => {
    try {
      if (!viewer?.impl || !fp || !Array.isArray(fp.points) || fp.points.length < 3) { clearSavedFootprint(); return; }
      const pts = fp.points;
      const THREE = (window as any).THREE;
      if (!THREE) return;
      if (!(viewer.impl.overlayScenes || {})[savedOverlayName]) viewer.impl.createOverlayScene(savedOverlayName);
      clearSavedFootprint();
      const z = (fp.z != null ? fp.z : (pts[0]?.z ?? 0));

      // outline
      const closed = [...pts, pts[0]].map(p => new THREE.Vector3(p.x, p.y, z));
      const lineGeom = new THREE.BufferGeometry().setFromPoints(closed);
      const lineMat = new THREE.LineBasicMaterial({ color: 0x00aaff, linewidth: 3, depthTest: false, transparent: true, opacity: 0.9 });
      const line = new THREE.Line(lineGeom, lineMat);
      line.renderOrder = 1000;
      viewer.impl.addOverlay(savedOverlayName, line);

      // fill
      const shape = new THREE.Shape(pts.map(p => new THREE.Vector2(p.x, p.y)));
      const fillGeom = new THREE.ShapeGeometry(shape);
      const fillMat = new THREE.MeshBasicMaterial({ color: 0x00aaff, opacity: 0.18, transparent: true, depthWrite: false, depthTest: false });
      const mesh = new THREE.Mesh(fillGeom, fillMat);
      mesh.position.z = z;
      mesh.renderOrder = 999;
      viewer.impl.addOverlay(savedOverlayName, mesh);

      viewer.impl.invalidate(true);
    } catch { }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-3 border-b border-gray-800">
        <div className="text-white font-semibold text-sm">Space List</div>
          <div className="mt-2 grid grid-cols-1 gap-2">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Search rooms by name, code, level, building…"
                value={spaceSearch}
                onChange={e => { setSpaceSearch(e.target.value); setPage(1); }}
                className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs"
              />
              <select
                value={spaceSortBy}
                onChange={e => { setSpaceSortBy(e.target.value as any); setPage(1); }}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs"
                title="Sort By"
              >
                <option value="name">Sort by Name</option>
                <option value="level">Sort by Level</option>
                <option value="area">Sort by Area</option>
                <option value="perimeter">Sort by Perimeter</option>
                <option value="volume">Sort by Volume</option>
                <option value="occupancy">Sort by Occupancy</option>
              </select>
              <button
                onClick={() => setSpaceSortDir(d => d === 'asc' ? 'desc' : 'asc')}
                className="px-2 py-1.5 rounded text-xs bg-gray-700 hover:bg-gray-600 text-white"
                title="Toggle sort direction"
              >
                {spaceSortDir === 'asc' ? 'Asc' : 'Desc'}
              </button>
            </div>
          <button
            onClick={extractRoomsFromBIM}
            disabled={isExtracting}
            className={`w-full ${isExtracting ? 'bg-green-700/70' : 'bg-green-600 hover:bg-green-700'} text-white text-xs py-1.5 rounded`}
          >
            {isExtracting ? `Extracting Rooms… ${extractionProgress}%` : 'Extract Rooms from BIM'}
          </button>
          {isExtracting && (
            <div className="mt-2 h-1.5 bg-gray-700 rounded overflow-hidden">
              <div className="h-full bg-green-500 transition-all" style={{ width: `${Math.max(0, Math.min(100, extractionProgress))}%` }} />
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-800/90 backdrop-blur border-b border-gray-700 text-gray-300">
            <tr>
              <th className="text-left px-3 py-2">Level</th>
              <th className="text-left px-3 py-2">Room name</th>
              <th className="text-left px-3 py-2">Area (m²)</th>
              <th className="text-left px-3 py-2">Perimeter (m)</th>
              <th className="text-left px-3 py-2">Volume (m³)</th>
              <th className="text-left px-3 py-2">Occupancy</th>
              <th className="text-left px-3 py-2">Description</th>
              <th className="text-center px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-gray-400">No spaces. Use "Create new space" or extract from BIM.</td></tr>
            ) : paginatedRows.map(r => (
              <tr key={r.id} className="border-b border-gray-800 hover:bg-gray-800/50"
                  onMouseEnter={() => drawSavedFootprint(r.footprint || undefined)}
                  onMouseLeave={() => clearSavedFootprint()}>
                <td className="px-3 py-2 text-gray-100">{r.level || '-'}</td>
                <td className="px-3 py-2 text-gray-200 cursor-pointer hover:text-white" onClick={() => onRowClick(r)}>{r.name || '-'}</td>
                <td className="px-3 py-2 text-gray-200">{r.area != null ? (typeof r.area === 'string' ? parseFloat(r.area).toFixed(2) : r.area.toFixed(2)) : '-'}</td>
                <td className="px-3 py-2 text-gray-200">{r.perimeter != null ? Number(r.perimeter).toFixed(2) : '-'}</td>
                <td className="px-3 py-2 text-gray-200">{r.volume != null ? Number(r.volume).toFixed(2) : '-'}</td>
                <td className="px-3 py-2 text-gray-200">{r.occupancy != null ? Number(r.occupancy) : '-'}</td>
                <td className="px-3 py-2 text-gray-300">{r.description || '-'}</td>
                <td className="px-3 py-2 text-center flex gap-1 justify-center">
                  <button
                    onClick={() => setEditModal({ open: true, space: r })}
                    className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded"
                    title="Edit space"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteModal({ open: true, id: r.id, name: r.name })}
                    className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded"
                    title="Delete space"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Bottom Pagination Controls */}
      <div className="flex items-center justify-between px-2 py-2 text-[11px] text-gray-300 gap-2 border-t border-gray-800">
        <div className="flex items-center gap-2 min-w-0">
          <span className="whitespace-nowrap">Rows:</span>
          <select
            value={pageSize}
            onChange={e => { setPageSize(parseInt(e.target.value, 10)); setPage(1); }}
            className="h-6 bg-gray-800/80 border border-gray-700 rounded px-2 text-[11px] focus:outline-none focus:border-gray-500"
          >
            {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="flex-1 text-center text-gray-4 00 truncate">
          {sortedRowsSpaces.length === 0 ? '0' : `${startIndex + 1}-${Math.min(endIndex, sortedRowsSpaces.length)}`} of {sortedRowsSpaces.length}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={pageClamped <= 1}
            className={`h-6 w-6 grid place-items-center rounded border ${pageClamped <= 1 ? 'text-gray-500 border-gray-700' : 'text-white border-gray-600 hover:bg-gray-700'}`}
            aria-label="Previous page"
          >
            &#8249;
          </button>
          <span className="mx-1 whitespace-nowrap">{pageClamped}/{totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={pageClamped >= totalPages}
            className={`h-6 w-6 grid place-items-center rounded border ${pageClamped >= totalPages ? 'text-gray-500 border-gray-700' : 'text-white border-gray-600 hover:bg-gray-700'}`}
            aria-label="Next page"
          >
            &#8250;
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1001]" onClick={() => setDeleteModal({ open: false })}>
          <div className="bg-gray-900 border border-gray-700 rounded p-4 w-[360px]" onClick={e => e.stopPropagation()}>
            <div className="text-white text-sm font-semibold mb-2">Delete space?</div>
            <div className="text-xs text-gray-300 mb-4">Are you sure you want to permanently delete <span className="text-red-300">{deleteModal.name}</span>?</div>
            <div className="flex items-center justify-end gap-2">
              <button 
                className="px-3 py-1.5 rounded text-xs bg-gray-700 hover:bg-gray-600 text-white" 
                onClick={() => setDeleteModal({ open: false })}
              >
                Cancel
              </button>
              <button 
                className="px-3 py-1.5 rounded text-xs bg-red-700 hover:bg-red-600 text-white" 
                onClick={async () => {
                  try {
                    const res = await fetch(`/api/projects/${projectId}/spaces/${deleteModal.id}`, { method: 'DELETE' });
                    console.log(`[SpaceList] Delete response status:`, res.status);
                    if (res.ok) {
                      console.log(`[SpaceList] Space ${deleteModal.id} deleted successfully`);
                      setRows(rows.filter(x => x.id !== deleteModal.id));
                      setDeleteModal({ open: false });
                    } else {
                      const errData = await res.text();
                      console.error(`[SpaceList] Delete failed with status ${res.status}:`, errData);
                      alert(`Failed to delete space: ${res.status}`);
                    }
                  } catch (err) {
                    console.error('[SpaceList] Delete error:', err);
                    alert('Error deleting space');
                  }
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editModal.open && editModal.space && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1001]" onClick={() => setEditModal({ open: false })}>
          <div className="bg-gray-900 border border-gray-700 rounded p-4 w-[420px] max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="text-white text-sm font-semibold mb-3">Edit Space</div>
            <EditSpaceFormInline 
              space={editModal.space} 
              projectId={projectId}
              viewer={viewer}
              onSave={() => {
                setEditModal({ open: false });
                // Reload spaces from database to show updated values
                (async () => {
                  try {
                    console.log('[SpaceList] Reloading spaces after edit...');
                    const mg = getCurrentModelGuid();
                    const res = await fetch(`/api/projects/${projectId}/spaces`); // Fetch ALL spaces, filter client-side
                    if (res.ok) {
                      const data = await res.json();
                      console.log('[SpaceList] Reloaded spaces:', data.length, 'items');
                      if (Array.isArray(data)) {
                        // Prepare floor names for normalization
                        let floorNames: string[] = [];
                        try {
                          let ext = (viewer && typeof viewer.getExtension === 'function') ? viewer.getExtension('Autodesk.AEC.LevelsExtension') : null;
                          if (!ext && viewer && typeof (viewer as any).loadExtension === 'function') {
                            try { ext = await (viewer as any).loadExtension('Autodesk.AEC.LevelsExtension'); } catch {}
                          }
                          const fs = (ext as any)?.floorSelector;
                          floorNames = Array.isArray(fs?.floorData) ? fs.floorData.map((f: any) => String(f?.name || '')) : [];
                        } catch {}
                        const normalizeLevel = (lv: any) => {
                          try {
                            const s = lv != null ? String(lv) : '';
                            if (!s) return undefined;
                            const n = Number(s);
                            if (!isNaN(n) && floorNames[n]) return floorNames[n];
                            const m = s.match(/(^|\D)(\d{1,2})(\D|$)/);
                            if (m && floorNames[Number(m[2])]) return floorNames[Number(m[2])];
                            return s;
                          } catch { return lv; }
                        };
                        const normalized: SpaceRecord[] = data.map((d: any) => ({
                          id: d.id || d._id || d.idStr || `${d.source || 'MANUAL'}-${d.dbId || d.name || Math.random()}`,
                          level: normalizeLevel(d.level),
                          name: d.name,
                          area: d.area,
                          perimeter: d.perimeter,
                          volume: d.volume,
                          occupancy: d.occupancy,
                          spaceCode: d.spaceCode,
                          building: d.building,
                          description: d.description,
                          source: d.source,
                          dbId: d.dbId ?? null,
                          modelGuid: d.modelGuid,
                          footprint: d.footprint || undefined,
                          conflictWithId: d.conflictWithId
                        }));
                        // STRICT filter: only spaces from current model
                        const clientFiltered = mg
                          ? normalized.filter(r => {
                              if (r.source === 'BIM_MODEL') {
                                return r.modelGuid === mg;
                              } else {
                                return !r.modelGuid || r.modelGuid === mg;
                              }
                            })
                          : normalized;
                        console.log('[SpaceList] Normalized and setting rows:', clientFiltered.length);
                        setRows(mergeWithPersisted(clientFiltered));
                      }
                    } else {
                      console.error('[SpaceList] Reload failed with status:', res.status);
                    }
                  } catch (err) {
                    console.error('[SpaceList] Reload error:', err);
                  }
                })();
              }}
              onCancel={() => setEditModal({ open: false })}
            />
          </div>
        </div>
      )}
    </div>
  );
};

const CreateSpace: React.FC<{ projectId?: string; viewer?: any; standalone?: boolean; }> = ({ projectId, viewer, standalone }) => {
  const [rows, setRows] = useState<SpaceRecord[]>([]);
  // Don't read localStorage during SSR - hydrate draft on client after mount
  const [f, setF] = useState({ building: '', level: '', name: '', spaceCode: '', area: '', perimeter: '', description: '' });
  useEffect(() => {
    try {
      const saved = load(`fm-create-space-draft-${projectId || 'global'}`, {});
      if (saved) {
        console.log('[CreateSpace][draft] Loaded create-space draft from LS:', saved);
        setF(prev => ({ ...prev, ...saved }));
      }
    } catch { }
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
    save(`fm-create-space-draft-${projectId || 'global'}`, f);
  }, [f, projectId]);
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
          try {
            const sr = snapperRef.current.getSnapResult();
            if (sr) {
              const gp = (sr.getPoint && sr.getPoint()) || (sr.intersectPoint) || (sr.point) || null;
              if (gp && gp.x != null && gp.y != null && gp.z != null) {
                p = gp;
                console.log('[CreateSpace][onViewerClick] Snapped point:', p);
              }
            }
          } catch (e) {
            console.warn('[CreateSpace][onViewerClick] Snap failed:', e);
          }
        }
      } catch (e) {
        console.error('[CreateSpace][onViewerClick] Snapping error:', e);
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
          try {
            const sr = snapperRef.current.getSnapResult();
            if (sr) {
              const gp = (sr.getPoint && sr.getPoint()) || (sr.intersectPoint) || (sr.point) || null;
              if (gp && gp.x != null && gp.y != null && gp.z != null) p = gp;
            }
          } catch (e) {
            // ignore snap error
          }
        }
      } catch (e) {
        // ignore outer error
      }
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
        try {
          const pts2d = fp.points.map(p => ({ x: p.x, y: p.y }));
          const a = Math.abs(signedArea(pts2d));
          const per = polygonPerimeter2D(pts2d);
          computedPerimeterRef.current = per;
          console.log('[CreateSpace][remoteDone] Computed area/perimeter:', a, per);
          setF(prev => { const next = { ...prev, area: a.toFixed(2), perimeter: per.toFixed(2) } as any; console.log('[CreateSpace][remoteDone] Form after area/perimeter set', next); return next; });
        } catch {}
        // Prefill building and level and restore modal
        prefillBuildingAndLevel(fp?.z ?? null);
        setConfirmOpen(true);
        try { window.dispatchEvent(new Event('fm-modal-restore')); } catch {}
        try { save(footprintDraftKey, fp.points); } catch {}
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
  }, [isRemote]);
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
        
        // Clear form
        const emptyForm = { building: '', level: '', name: '', spaceCode: '', area: '', perimeter: '', description: '' };
        setF(emptyForm);
        save(`fm-create-space-draft-${projectId || 'global'}`, emptyForm);
        try { save(footprintDraftKey, []); } catch {}
        
        // Clear footprint
        setFootprint(null);
        cancelDrawing();
      } else {
        console.error('[CreateSpace] Failed to save space to DB');
      }
    } catch (e) {
      console.error('[CreateSpace] Error saving space:', e);
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
      <div className="flex items-center justify-between">
        <div className="text-white font-semibold text-sm">Create New Space</div>
        <button type="button" onClick={clearForm} className="px-2 py-1 rounded text-xs bg-gray-700 hover:bg-gray-600 text-white">Clear</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className="text-[12px] text-gray-300 block mb-1">Building</label><input value={f.building} onChange={e => { console.log('[CreateSpace][input] building change:', e.target.value); setF(v => ({ ...v, building: e.target.value })); }} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm" /></div>
        <div><label className="text-[12px] text-gray-300 block mb-1">Level</label><input value={f.level} onChange={e => { console.log('[CreateSpace][input] level change:', e.target.value); setF(v => ({ ...v, level: e.target.value })); }} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm" /></div>
        <div><label className="text-[12px] text-gray-300 block mb-1">Room name</label><input value={f.name} onChange={e => setF(v => ({ ...v, name: e.target.value }))} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm" /></div>
        <div><label className="text-[12px] text-gray-300 block mb-1">Space Code</label><input value={f.spaceCode} onChange={e => setF(v => ({ ...v, spaceCode: e.target.value }))} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm" /></div>
        <div><label className="text-[12px] text-gray-300 block mb-1">Area (m²)</label><input value={f.area} onChange={e => { console.log('[CreateSpace][input] area change:', e.target.value); setF(v => ({ ...v, area: e.target.value })); }} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm" /></div>
        <div><label className="text-[12px] text-gray-300 block mb-1">Perimeter (m)</label><input value={(f as any).perimeter} onChange={e => { console.log('[CreateSpace][input] perimeter change:', e.target.value); setF(v => ({ ...(v as any), perimeter: e.target.value } as any)); }} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm" /></div>
        <div className="col-span-2"><label className="text-[12px] text-gray-300 block mb-1">Description</label><input value={f.description} onChange={e => setF(v => ({ ...v, description: e.target.value }))} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm" /></div>
      </div>
      {/* Footprint Editor */}
      <div className="border-t border-gray-700 pt-3">
        <div className="text-xs text-gray-400 mb-2">2D Footprint (optional)</div>
        <div className="flex flex-wrap gap-2">
          <button onClick={startDrawing} disabled={(!!viewer === false && !isRemote) || drawing} className={`px-3 py-1.5 rounded text-xs ${(((!!viewer === false) && !isRemote) || drawing) ? 'bg-gray-700 text-gray-400' : 'bg-emerald-700 hover:bg-emerald-800 text-white'}`}>Start drawing</button>
          <button onClick={finishDrawing} disabled={!drawing || pointCount < 3} className={`px-3 py-1.5 rounded text-xs ${(!drawing || pointCount < 3) ? 'bg-gray-700 text-gray-400' : 'bg-blue-700 hover:bg-blue-800 text-white'}`}>Finish</button>
          <button onClick={undoLastPoint} disabled={!drawing || pointsRef.current.length === 0} className={`px-3 py-1.5 rounded text-xs ${(!drawing || pointsRef.current.length === 0) ? 'bg-gray-700 text-gray-400' : 'bg-yellow-700 hover:bg-yellow-800 text-white'}`}>Undo</button>
          <button type="button" onClick={cancelDrawing} disabled={!drawing && !footprint} className={`px-3 py-1.5 rounded text-xs ${(!drawing && !footprint) ? 'bg-gray-700 text-gray-400' : 'bg-red-700 hover:bg-red-800 text-white'}`}>Clear</button>
        </div>
        <div className="text-[11px] text-gray-500 mt-2">
          {drawing
            ? `Drawing... ${pointCount} point${pointCount !== 1 ? 's' : ''} added. Click to add more, Enter to finish, ESC to cancel.`
            : footprint
              ? `${footprint.points.length} points captured at z=${(footprint.z ?? 0).toFixed?.(2)}`
              : 'No footprint set.'}
        </div>
      </div>
      {confirmOpen && footprint && (
        <div className="mt-3 border border-gray-700 rounded p-2 bg-gray-900 text-xs text-gray-200">
          <div className="mb-2 font-semibold">Footprint Points (x, y, z):</div>
          <div className="max-h-40 overflow-auto space-y-1 bg-gray-950 p-2 rounded">
            {footprint.points.map((p, i) => (
              <div key={i} className="font-mono">{i + 1}. ({p.x.toFixed(3)}, {p.y.toFixed(3)}, {p.z.toFixed(3)})</div>
            ))}
          </div>
          <div className="mt-2"><button onClick={() => { console.log('[CreateSpace][confirmClose] Closing confirmation'); setConfirmOpen(false); }} className="px-3 py-1.5 rounded text-xs bg-gray-700 hover:bg-gray-600 text-white">Close</button></div>
        </div>
      )}
      <div><button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded" onClick={onSave}>Save Space</button></div>
    </div>
  );
};

