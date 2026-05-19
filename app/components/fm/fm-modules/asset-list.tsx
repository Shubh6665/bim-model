"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { X, Upload, Download, Plus, Edit2, Trash2, Eye, EyeOff, Search, Filter, Columns, RefreshCw, Save, Check } from "lucide-react";
import PdfViewer from "../../shared/pdf-viewer";
import { load, save, K, stripRevitPrefix, pickEditable, clearAssetCache, EDITABLE_FIELDS, CLEARABLE_FIELDS, REVIT_CATEGORIES, IFCCLASSES_UNIQUE } from "../fm-panel-utils";
import { APSAssetExtractor, type APSAsset } from '../../../services/aps-asset-extractor';
import { ViewerLeafAssetExtractor, type ViewerAsset } from '../../../services/viewer-leaf-asset-extractor';
import { CATEGORY_MAPPING } from "../../../services/asset-extraction-service";
import type { AssetRecord, SpaceRecord } from "../fm-panel-types";

interface AssetListProps {
  projectId?: string;
  viewer?: any;
  onScheduleMaintenance?: (assets: AssetRecord[]) => void;
  initialAssetId?: string;
}

const AssetSizeInput = ({ value, onChange }: { value: number | undefined | null, onChange: (n: number | undefined) => void }) => {
  const [text, setText] = useState(value == null ? '' : String(value));
  
  useEffect(() => {
    const currentNum = parseFloat(text);
    if (value == null) {
        if (text !== '' && !isNaN(currentNum)) setText('');
    } else if (currentNum !== value) {
        setText(String(value));
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setText(val);
    if (val === '') {
        onChange(undefined);
    } else {
        const n = parseFloat(val);
        if (!isNaN(n)) {
            onChange(n);
        }
    }
  };

  return (
    <input
      type="number"
      step="0.1"
      onClick={e => e.stopPropagation()}
      value={text}
      onChange={handleChange}
      className="w-12 bg-card border border-border rounded px-1 py-0.5 text-[11px] text-foreground"
      placeholder="0.3"
    />
  );
};

export 
const AssetList: React.FC<AssetListProps> = ({ projectId, viewer, onScheduleMaintenance, initialAssetId }) => {
  const [rows, setRows] = useState<AssetRecord[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState(0);
  const [placingAssetId, setPlacingAssetId] = useState<string | null>(null);
  const pageStorageKey = `fm-assets-page-${projectId || 'global'}`;
  const [page, setPage] = useState<number>(() => {
    try {
      const raw = typeof window !== 'undefined' ? load(pageStorageKey, '1') : '1';
      const n = parseInt(String(raw), 10);
      return (Number.isFinite(n) && n > 0) ? n : 1;
    } catch { return 1; }
  });
  const [pageSize, setPageSize] = useState(10);
  const [jumpPage, setJumpPage] = useState<string>('');
  const [visibleFields, setVisibleFields] = useState({
    basic: true,
    identification: false,
    technical: false,
    documentation: false,
    lifecycle: false,
    maintenance: false,
    economic: false,
    compliance: false,
    relationships: false
  });
  const [filter, setFilter] = useState({ category: '', type: '', location: '', condition: '', classification: '', ifcClass: '', search: '', selectedOnly: false, selectedKeys: [] as string[] });
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);
  const showToast = (type: 'success' | 'error' | 'info', text: string) => {
    setToast({ type, text });
    window.setTimeout(() => setToast(null), 3500);
  };
  // Expose for inline handlers if needed
  (window as any).showToast = showToast;
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; id?: string; label?: string }>({ open: false });
  // Edit Asset modal
  const [editModal, setEditModal] = useState<{ open: boolean; id?: string }>({ open: false });
  const [editSection, setEditSection] = useState<'basic'|'identification'|'technical'|'documentation'|'lifecycle'|'maintenance'|'economic'|'compliance'|'relationships'|'qr'>('basic');



  const [edit, setEdit] = useState<Partial<AssetRecord>>({});
  // Sequential Edit queue for "Edit Selected"
  const [editQueue, setEditQueue] = useState<string[]>([]);
  const [editIndex, setEditIndex] = useState<number>(0);
  // Bulk Edit mode: when multiple assets selected with same category
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [bulkEditIds, setBulkEditIds] = useState<string[]>([]);
  const [bulkCategoryLabel, setBulkCategoryLabel] = useState<string>('');
  // PDF Viewer modal state
  const [pdfModal, setPdfModal] = useState<{ open: boolean; fileId?: string; fileName?: string }>({ open: false });

  const saveAssetToBackend = async (asset: AssetRecord) => {
    if (!projectId) return;
    try {
      await fetch(`/api/projects/${projectId}/assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(asset)
      });
    } catch (e) {
      console.error('Failed to save asset', e);
    }
  };

  const pickEditable = (r: Partial<AssetRecord>): Partial<AssetRecord> => {
    const out: Partial<AssetRecord> = {};
    for (const k of EDITABLE_FIELDS) {
      const v = (r as any)[k];
      if (v !== undefined) (out as any)[k] = v as any;
    }
    return out;
  };
  

  const openEditAsset = (row: AssetRecord) => {
    // Ensure we are NOT in bulk edit or sequential multi-edit mode when explicitly editing a single row
    setBulkEditMode(false);
    setBulkEditIds([]);
    setBulkCategoryLabel('');
    setEditQueue([]);
    setEditIndex(0);
    setEditModal({ open: true, id: row.id });
    // Prefill form with asset data, normalizing category to remove Revit prefix
    // Explicitly include 'id' so that CreateAsset knows which asset is being edited (needed for QR generation)
    const editData = { ...pickEditable(row), id: row.id };
    // Debug: log picked vs raw assetCode to help troubleshoot missing values
    try { console.log('📝 [openEditAsset] row.assetCode:', (row as any).assetCode, 'picked.assetCode:', (editData as any).assetCode); } catch {}

    // If assetCode is missing from the picked editable fields, attempt a safe fallback
    // This mirrors the Asset Code computation used during extraction (projectCode + level)
    if (!((editData as any).assetCode) || String((editData as any).assetCode).trim() === '') {
      let finalCode = (row as any).assetCode;
      if (!finalCode) {
        // Try to compute from project code + level found on the row
        const projectCode = (row as any).projectCode;
        const loc = (row as any).location || '';
        const levelRaw = String(loc).split(' - ')[0] || '';
        if (projectCode && levelRaw) {
          const m = String(levelRaw).match(/^(-?\d+)/);
          if (m) {
            const num = parseInt(m[1], 10);
            const levelCode = num >= 0 ? num.toString().padStart(2, '0') : `G${Math.abs(num)}`;
            finalCode = `${projectCode}-${levelCode}`;
            console.log('🧩 [openEditAsset] Fallback computed assetCode:', finalCode);
          }
        }
      }
      if (!finalCode) finalCode = '@';
      (editData as any).assetCode = finalCode;
    }
    setEdit(editData);
    setEditSection('basic');
  };

  // Handle initialAssetId prop to open edit modal
  useEffect(() => {
    if (initialAssetId && rows.length > 0) {
      const asset = rows.find(a => a.id === initialAssetId);
      if (asset) {
        openEditAsset(asset);
      }
    }
  }, [initialAssetId, rows]);

  // If asset is not in the current page, try fetching it directly by id and open edit
  useEffect(() => {
    const run = async () => {
      if (!initialAssetId || !projectId) return;
      const exists = rows.some(r => r.id === initialAssetId);
      if (exists) return;
      try {
        const res = await fetch(`/api/projects/${projectId}/assets?id=${encodeURIComponent(initialAssetId)}`);
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        const asset: AssetRecord | undefined = Array.isArray(data)
          ? (data[0] as AssetRecord | undefined)
          : (data?.asset || data);
        if (asset && asset.id) {
          setRows(prev => (prev.some(r => r.id === asset.id) ? prev : [asset, ...prev]));
          // Give React a tick to render the new row before opening modal
          setTimeout(() => openEditAsset(asset), 0);
        }
      } catch (err) {
        console.warn('[AssetList] fetch by id failed', err);
      }
    };
    run();
  }, [initialAssetId, projectId, rows]);

  const persistEditToBackend = async (id: string, fields: Partial<AssetRecord>) => {
    if (!projectId) return;

    const asset = rows.find(r => r.id === id);
    console.log('📤 [persistEditToBackend] Attempting to save edit...');
    console.log('📤 [persistEditToBackend] Asset ID:', id);
    console.log('📤 [persistEditToBackend] Fields to update:', fields);

    if (!asset) {
      console.warn('⚠️ [persistEditToBackend] Asset not found in current rows; skipping backend save');
      return;
    }

    try {
      // Build a full payload so the server upsert doesn't null-out fields we don't send
      // For BIM assets, server upserts by (projectId, source=BIM_MODEL, modelGuid, dbId)
      // For MANUAL assets, server upserts by _id when id is provided
      const isBim = asset.source === 'BIM_MODEL';
      const payload: any = {
        ...(asset as any),
        ...fields,
      };

      if (isBim) {
        payload.source = 'BIM_MODEL';
        payload.modelGuid = asset.modelGuid;
        payload.dbId = asset.dbId;
        // We now preserve payload.id if it exists, so backend can use it for reliable lookup
      } else {
        payload.source = 'MANUAL';
        payload.id = id; // manual path uses _id filter
      }

      // Delegate to central save helper to ensure consistent upsert semantics
      try {
        await saveAssetToBackend(payload as AssetRecord);
        console.log('✅ [persistEditToBackend] Delegated saveAssetToBackend succeeded');
      } catch (e) {
        console.warn('⚠️ [persistEditToBackend] Delegated saveAssetToBackend failed', e);
      }
    } catch (err) {
      console.error('❌ [persistEditToBackend] Error:', err);
    }
  };

  const saveEditAsset = async () => {
    const id = editModal.id;
    if (!id) { setEditModal({ open: false }); return; }
    try {
      const fields = pickEditable(edit);
      // Keep the asset source as-is (BIM stays BIM, Manual stays Manual)
      // userEdited flag ensures changes persist across merges
      const current = rows.find(r => r.id === id);
      const oldConflict = current?.conflictWithId;
      // Clear conflicts but don't convert source
      const mergedFields = { ...fields, conflictWithId: undefined } as Partial<AssetRecord>;

      setRows(prev => {
        // First update this record
        let next = prev.map(r => r.id === id ? { ...r, ...mergedFields, userEdited: true } : r);
        // Clear conflicts on any counterpart that pointed to this id; hide and link counterparts to this edited record
        next = next.map(r => {
          if (r.id !== id && (r.conflictWithId === id || (oldConflict && r.id === oldConflict))) {
            return { ...r, conflictWithId: undefined, hidden: true, linkedAssetId: id };
          }
          return r;
        });
        return next;
      });
      showToast('success', 'Asset updated');
      // Persist to local immediately (handled by rows effect) and try backend
      await persistEditToBackend(id, mergedFields);
      // Persist any BIM counterparts we modified locally (hidden/link + clear conflict)
      try {
        const counterparts = rows.filter(r => r.id !== id && (r.conflictWithId === id || (oldConflict && r.id === oldConflict)));
        await Promise.allSettled(counterparts.map(c => {
          const upd: Partial<AssetRecord> = { conflictWithId: undefined, hidden: true, linkedAssetId: id } as any;
          return persistEditToBackend(c.id, upd);
        }));
      } catch {}
      // Also persist counterpart conflict cleanup to localStorage
      try {
        const key = K.assets(projectId);
        const currentLs = load(key, [] as AssetRecord[]);
        const updated = currentLs.map(r => {
          if (r.id === id) return { ...r, ...mergedFields, userEdited: true };
          if (r.conflictWithId === id || (oldConflict && r.id === oldConflict)) {
            return { ...r, conflictWithId: undefined, hidden: true, linkedAssetId: id } as any;
          }
          return r;
        });
        save(key, updated);
      } catch {}
    } catch (e) {
      showToast('error', 'Failed to update asset');
    } finally {
      setEditModal({ open: false });
    }
  };
  
  // Start sequential edit over selected assets or bulk edit if same category
  const startSequentialEdit = () => {
    try {
      const idsOrdered = filteredRows.map(r => r.id).filter(id => selectedIds.has(id));
      const ids = idsOrdered.length ? idsOrdered : Array.from(selectedIds.values());
      if (!ids.length) return;
      
      // Get all selected assets
      const selectedAssets = rows.filter(r => ids.includes(r.id));
      
      // Group assets by category
      const categoryMap = new Map<string, string[]>();
      selectedAssets.forEach(a => {
        const cat = a.category || 'Uncategorized';
        if (!categoryMap.has(cat)) categoryMap.set(cat, []);
        categoryMap.get(cat)!.push(a.id);
      });
      
      // Find the most common category (largest group)
      let dominantCategory = '';
      let dominantIds: string[] = [];
      let maxCount = 0;
      
      categoryMap.forEach((assetIds, cat) => {
        if (assetIds.length > maxCount) {
          maxCount = assetIds.length;
          dominantCategory = cat;
          dominantIds = assetIds;
        }
      });
      
      if (maxCount === 0) {
        showToast('error', 'Assets must have a category to bulk edit. Please assign categories first.');
        return;
      }
      
      // If there are assets from other categories, show warning
      if (categoryMap.size > 1) {
        showToast('info', `Found assets from ${categoryMap.size} categories. Editing ${dominantIds.length} assets from "${dominantCategory}" category.`);
      }
      
      // Enable bulk edit mode for ALL selected assets if > 1
      if (ids.length > 1) {
        // Determine if we have mixed categories
        const categories = Array.from(new Set(selectedAssets.map(a => a.category).filter(Boolean)));
        const mixedCategories = categories.length > 1;
        const displayCategory = mixedCategories ? 'Mixed Categories' : (categories[0] || 'Uncategorized');
        
        console.log(`📋 [Bulk Edit] Starting bulk edit for ${ids.length} assets. Categories: ${categories.join(', ')}`);
        
        setBulkEditMode(true);
        setBulkEditIds(ids);
        setBulkCategoryLabel(displayCategory);
        
        // Prefill bulk edit form with aggregated values
        const bulkAssets = rows.filter(r => ids.includes(r.id));
        const uniq = (key: keyof AssetRecord) => Array.from(new Set(bulkAssets.map(a => (a as any)[key]).filter(v => v != null && v !== '')));
        const allSame = (key: keyof AssetRecord): string => {
          const u = uniq(key);
          return u.length === 1 ? String(u[0]) : '';
        };
        // For mixed categories, we don't prefill category unless they are all same
        const initCategory = mixedCategories ? '' : (stripRevitPrefix(categories[0]) || categories[0] || '');
        
        const init: Partial<AssetRecord> = {
          category: initCategory,
          type: allSame('type') || '',
          ifcClass: allSame('ifcClass') || '',
          // Don't join names/ids for bulk edit prefill as it looks messy in input
          assetName: '', 
          elementId: '',
          ifcGuid: ''
        };
        setEdit(init);
        setEditModal({ open: true, id: `bulk-${ids[0]}` }); // Special ID to indicate bulk mode
      } else if (ids.length === 1) {
        // Only one asset selected - use standard single edit
        setEditQueue(ids);
        setEditIndex(0);
        const first = rows.find(r => r.id === ids[0]);
        if (!first) return;
        openEditAsset(first);
      }
    } catch {}
  };
  

  const isHexObjectId = (id?: string) => !!id && /^[a-f0-9]{24}$/i.test(id);

  const confirmDelete = (row: AssetRecord) => {
    if (row.source !== 'MANUAL') return; // safety
    const label = row.assetName || row.assetCode || row.model || row.brand || row.category || 'this asset';
    setDeleteModal({ open: true, id: row.id, label });
  };

  const performDelete = async () => {
    const id = deleteModal.id;
    if (!id) { setDeleteModal({ open: false }); return; }

    console.log('🗑️ [performDelete] Deleting asset with ID:', id);
    console.log('🗑️ [performDelete] Current rows before delete:', rows.length);

    try {
      // Optimistically remove from UI
      setRows(prev => {
        const filtered = prev.filter(a => a.id !== id);
        console.log('🗑️ [performDelete] setRows - Filtered rows:', filtered.length);
        console.log('🗑️ [performDelete] setRows - Remaining userEdited assets:', filtered.filter(a => (a as any).userEdited).length);
        return filtered;
      });
      
      const updatedRows = rows.filter(a => a.id !== id);
      save(K.assets(projectId), updatedRows);
      console.log('🗑️ [performDelete] Saved to localStorage - count:', updatedRows.length);

      // Delete from backend if we have a valid ObjectId and projectId
      if (projectId && isHexObjectId(id)) {
        console.log('🗑️ [performDelete] Deleting from backend...');
        const res = await fetch(`/api/projects/${projectId}/assets?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (!res.ok) {
          const txt = await res.text().catch(() => '');
          console.warn('⚠️ [AssetList] Backend delete failed:', res.status, txt);
          showToast('error', 'Failed to delete from server — removed locally');
        } else {
          console.log('✅ [performDelete] Backend delete successful');
          showToast('success', 'Asset deleted');
        }
      } else {
        console.log('🗑️ [performDelete] Local-only deletion (not a backend ID)');
        // Local-only deletion
        showToast('success', 'Asset deleted locally');
      }
    } catch (e) {
      console.error('❌ [AssetList] Delete error', e);
      showToast('error', 'Delete failed');
    } finally {
      setDeleteModal({ open: false });
    }
  };

  // Helper: deduplicate BIM assets (by dbId) and keep best record; manual assets by id
  const dedupeAssets = React.useCallback((arr: AssetRecord[]): AssetRecord[] => {
    console.log('🔄 [dedupeAssets] Input array length:', arr.length);
    console.log('🔄 [dedupeAssets] Assets with userEdited flag:', arr.filter(a => (a as any).userEdited).length);
    
    const score = (x: AssetRecord) => {
      // Prioritize user-edited assets heavily
      if ((x as any).userEdited === true) return 10000;
      const fields: (keyof AssetRecord)[] = [
        'assetCode','assetName','category','type','brand','model','serialNumber','installationDate',
        'material','dimensions','weight','capacity','powerRating','location','description'
      ];
      let n = 0; for (const f of fields) if ((x as any)[f]) n++;
      return n;
    };
    const map = new Map<string, AssetRecord>();
    for (const a of arr) {
      const key = (a.source === 'BIM_MODEL' && a.dbId != null)
        ? `BIM|${a.modelGuid || 'g'}|${a.dbId}`
        : `ID|${a.id}`;
      const ex = map.get(key);
      
      if (!ex) {
        map.set(key, a);
      } else {
        const aScore = score(a);
        const exScore = score(ex);
        const winner = aScore >= exScore ? a : ex;
        if (a.userEdited || ex.userEdited) {
          console.log(`🔄 [dedupeAssets] Dedup conflict for key ${key}:`, {
            existing: { id: ex.id, source: ex.source, userEdited: (ex as any).userEdited, score: exScore, assetName: ex.assetName },
            new: { id: a.id, source: a.source, userEdited: (a as any).userEdited, score: aScore, assetName: a.assetName },
            winner: winner.id
          });
        }
        map.set(key, winner);
      }
    }
    
    const result = Array.from(map.values());
    console.log('🔄 [dedupeAssets] Output array length:', result.length);
    console.log('🔄 [dedupeAssets] Output assets with userEdited:', result.filter(a => (a as any).userEdited).length);
    
    return result;
  }, []);

  const getCurrentModelGuid = React.useCallback((): string | undefined => {
    try {
      const g = viewer?.model?.getData?.()?.guid;
      if (g && typeof g === 'string') return g;
      const mid = viewer?.model?.id;
      if (mid != null) return String(mid);
      // Fallback to context stored when opening standalone window
      try {
        const ctxRaw = projectId ? localStorage.getItem(`fm-context-${projectId}`) : null;
        if (ctxRaw) { const ctx = JSON.parse(ctxRaw || '{}'); if (ctx?.modelGuid) return String(ctx.modelGuid); }
      } catch {}
      return undefined;
    } catch { return undefined; }
  }, [viewer]);

  // Treat modelGuid variants as equivalent:
  // - plain guid/id (e.g., '1' or 'a1b2c3')
  // - composite 'guid|urn'
  // - any string ending with '|urn'
  const parseModelGuid = (mg?: string) => {
    if (!mg) return { raw: '', left: '', right: '' };
    const raw = String(mg);
    const i = raw.indexOf('|');
    if (i === -1) return { raw, left: raw, right: '' };
    return { raw, left: raw.slice(0, i), right: raw.slice(i + 1) };
  };
  const isSameModelGuid = (a?: string, b?: string): boolean => {
    if (!a || !b) return false;
    if (a === b) return true;
    const A = parseModelGuid(a);
    const B = parseModelGuid(b);
    if (A.left && B.left && A.left === B.left) return true;
    if (A.right && B.right && A.right === B.right) return true;
    // Allow matching when one is composite and the other is its left part
    if (A.left && B.raw && B.raw.startsWith(A.left + '|')) return true;
    if (B.left && A.raw && A.raw.startsWith(B.left + '|')) return true;
    return false;
  };

  const filterAssetsForCurrentModel = React.useCallback((arr: AssetRecord[]): AssetRecord[] => {
    const g = getCurrentModelGuid();
    if (!g) return arr; // if no model, do not filter
    // Include manual always; BIM only when modelGuid matches current model (equivalence-aware)
    return arr.filter(a => a.source !== 'BIM_MODEL' || isSameModelGuid(a.modelGuid, g));
  }, [getCurrentModelGuid]);

  // Build master category labels from CATEGORY_MAPPING used in Ticket-based Maintenance
  const assetCategoryMasterOptions: string[] = React.useMemo(() => {
    const opts: string[] = [];
    for (const [it, m] of Object.entries(CATEGORY_MAPPING)) {
      opts.push(`${it} / ${m.english} (${m.ifc})`);
    }
    return opts.sort();
  }, []);

  // Map of master label -> tokens [italian, english, ifc]
  const masterCategoryTokens = React.useMemo(() => {
    const map = new Map<string, string[]>();
    for (const [italian, mapping] of Object.entries(CATEGORY_MAPPING)) {
      const label = `${italian} / ${mapping.english} (${mapping.ifc})`;
      map.set(label, [italian, mapping.english, mapping.ifc].filter(Boolean) as string[]);
    }
    return map;
  }, []);

  // Use module-level REVIT_CATEGORIES for filters (replaces previous dynamic category construction)
  const assetCategories: string[] = React.useMemo(() => REVIT_CATEGORIES, []);

  // Load assets from backend ONLY - no localStorage fallback for data
  useEffect(() => {
    const loadFromBackend = async () => {
      if (!projectId) {
        console.log('📭 [AssetList] No projectId, skipping load');
        return;
      }

      const currentGuid = getCurrentModelGuid();
      console.log(`🔄 [AssetList] Loading assets from DB for project: ${projectId}, modelGuid: ${currentGuid || 'all'}`);
      
      try {
        const url = currentGuid 
          ? `/api/projects/${projectId}/assets?modelGuid=${encodeURIComponent(currentGuid)}`
          : `/api/projects/${projectId}/assets`;
          
        const res = await fetch(url);
        
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : [];
          console.log(`✅ [AssetList] Loaded ${list.length} assets from DB`);
          
          const filtered = filterAssetsForCurrentModel(list);
          const deduped = dedupeAssets(filtered);
          setRows(deduped);
        } else {
          console.error(`❌ [AssetList] DB returned status ${res.status}`);
          setRows([]);
        }
      } catch (e) {
        console.error('❌ [AssetList] DB load failed', e);
        setRows([]);
      }
    };
    loadFromBackend();
  }, [projectId]);

  // Deduplicate any duplicates on initial load
  useEffect(() => {
    setRows(prev => {
      const unique = Array.from(new Map(prev.map(a => [a.id, a])).values());
      return unique;
    });
  }, [projectId]);

  // Save page number to cache for UX continuity
  useEffect(() => {
    if (page > 0) {
      save(pageStorageKey, page);
    }
  }, [page, pageStorageKey]);

  // Refresh assets from localStorage when component becomes visible (to sync with CreateAsset)
  useEffect(() => {
    // Refresh only on explicit create events (no visibilitychange auto-refresh). Backend preferred.
    const refreshFromBackendOrCache = async () => {
      try {
        const guid = getCurrentModelGuid();
        if (projectId && guid) {
          const res = await fetch(`/api/projects/${projectId}/assets?modelGuid=${encodeURIComponent(guid)}`);
          if (res && res.ok) {
            const data = await res.json();
            const list = Array.isArray(data) ? data : [];
            // Merge with cached local to preserve richer fields (IFC, manual overrides)
            const cachedAll = load(K.assets(projectId), [] as AssetRecord[]);
            const cached = cachedAll.filter(a => a.source !== 'BIM_MODEL' || a.modelGuid === guid);
            const mergedById = list.map(b => {
              const c = cached.find(x => x.id === b.id);
              if (!c) return b;
              const merged: any = { ...b };
              const isEdited = (c as any).userEdited === true;
              const isManual = (c as any).source === 'MANUAL';
              for (const key of Object.keys(c)) {
                const val = (c as any)[key];
                if (isEdited && (EDITABLE_FIELDS as any).includes(key)) {
                  merged[key] = val; // user edited fields always win
                } else if (isManual && (CLEARABLE_FIELDS as any).includes(key)) {
                  merged[key] = val; // allow nulls to clear
                } else if (val !== null && val !== undefined && val !== '') {
                  merged[key] = val;
                }
              }
              // Preserve critical flags and state
              if (isEdited) merged.userEdited = true;
              if ((c as any).hidden === true) merged.hidden = true;
              if ((c as any).linkedAssetId) merged.linkedAssetId = (c as any).linkedAssetId;
              if ((c as any).conflictWithId === undefined) merged.conflictWithId = undefined;
              return merged as AssetRecord;
            });
            const cachedOnly = cached.filter(c => !list.find(b => b.id === c.id));
            const finalList = [...mergedById, ...cachedOnly];
            const filtered = filterAssetsForCurrentModel(finalList);
            const deduped = dedupeAssets(filtered);
            console.log(`🔄 [AssetList] Refresh from backend: merged ${list.length} backend with ${cached.length} cached -> ${deduped.length}`);
            setRows(deduped);
            save(K.assets(projectId), deduped);
            return;
          }
        }
        // Fallback: use local cache only (no backend or fetch failed)
        const cached = load(K.assets(projectId), [] as AssetRecord[]);
        const filtered = filterAssetsForCurrentModel(cached);
        const deduped = dedupeAssets(filtered);
        console.log(`🔄 [AssetList] Refresh from cache: ${deduped.length} assets`);
        setRows(deduped);
      } catch (e) {
        console.error('❌ [AssetList] Error during refresh:', e);
      }
    };

    const handleAssetCreated = () => { void refreshFromBackendOrCache(); };
  const handleAssetUpdated = () => { void refreshFromBackendOrCache(); };

    // Do not auto-refresh on mount; initial load is handled by loadFromBackend above.
  window.addEventListener('asset-created', handleAssetCreated);
  window.addEventListener('asset-updated', handleAssetUpdated);

    return () => {
      window.removeEventListener('asset-created', handleAssetCreated);
      window.removeEventListener('asset-updated', handleAssetUpdated);
    };
  }, [projectId, rows.length]);

  // BIM Asset Extraction
  const extractAssetsFromBIM = async () => {
    // If viewer is missing (standalone), try APS fallback using stored URN
    const tryAPS = async (): Promise<boolean> => {
      try {
        const ctxRaw = projectId ? localStorage.getItem(`fm-context-${projectId}`) : null;
        const ctx = ctxRaw ? JSON.parse(ctxRaw) : {};
        const urn: string | undefined = ctx?.urn;
        if (!urn) return false;
        setIsExtracting(true);
        setExtractionProgress(1);
        const extractor = new APSAssetExtractor(urn);
        const result = await extractor.extractAllAssets((progress) => setExtractionProgress(Math.min(99, Math.max(1, progress))));
        const currentGuid = ctx?.modelGuid || getCurrentModelGuid();
        const newAssets: AssetRecord[] = result.assets.map((a) => ({
          id: `aps-${a.modelGuid}-${a.objectId}`,
          assetName: a.name,
          category: a.category,
          type: a.type,
          brand: a.brand,
          model: a.model,
          serialNumber: a.serialNumber,
          material: a.material,
          location: a.location,
          source: 'BIM_MODEL',
          dbId: a.objectId,
          modelGuid: a.modelGuid || currentGuid,
        }));
        // Upsert to backend when projectId exists
        if (projectId && newAssets.length) {
          await fetch(`/api/projects/${projectId}/assets`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'upsertMany', assets: newAssets })
          }).catch(() => {});
          // Reload list
          const res = await fetch(`/api/projects/${projectId}/assets${currentGuid ? `?modelGuid=${encodeURIComponent(currentGuid)}` : ''}`);
          if (res.ok) {
            const data = await res.json();
            const list = Array.isArray(data) ? data : [];
            // Merge with cached local to preserve edited fields
            const currentCachedAll = load(K.assets(projectId), [] as AssetRecord[]);
            const currentGuid = ctx?.modelGuid || getCurrentModelGuid();
            const cached = currentCachedAll.filter(a => a.source !== 'BIM_MODEL' || a.modelGuid === currentGuid);
            const mergedById = list.map(b => {
              const c = cached.find(x => x.id === b.id) || {} as any;
              const merged: any = { ...b };
              const isEdited = (c as any).userEdited === true;
              const isManual = (c as any).source === 'MANUAL';
              for (const [key, val] of Object.entries(c)) {
                if ((EDITABLE_FIELDS as any).includes(key) && isEdited) merged[key] = val;
                else if (isManual && (CLEARABLE_FIELDS as any).includes(key)) merged[key] = val;
              }
              // Preserve critical flags and state
              if (isEdited) merged.userEdited = true;
              if ((c as any).hidden === true) merged.hidden = true;
              if ((c as any).linkedAssetId) merged.linkedAssetId = (c as any).linkedAssetId;
              if ((c as any).conflictWithId === undefined) merged.conflictWithId = undefined;
              return merged as AssetRecord;
            });
            const cachedOnly = cached.filter(c => !list.find(b => b.id === c.id));
            const finalList = [...mergedById, ...cachedOnly];
            const filtered = filterAssetsForCurrentModel(finalList);
            const deduped = dedupeAssets(filtered);
            setRows(deduped);
            save(K.assets(projectId), deduped);
          }
        } else {
          // Local-only update
          setRows(prev => dedupeAssets(filterAssetsForCurrentModel([...prev, ...newAssets])));
        }
        setExtractionProgress(100);
        setTimeout(() => setExtractionProgress(0), 800);
        setIsExtracting(false);
        return true;
      } catch (e) {
        console.warn('[AssetList] APS fallback extraction failed', e);
        setIsExtracting(false);
        return false;
      }
    };

    if (!viewer || !viewer.model) {
      const ok = await tryAPS();
      if (!ok) showToast('error', 'No BIM model loaded. Open from the main window or ensure context includes URN.');
      return;
    }

    setIsExtracting(true);
    setExtractionProgress(0);

    try {
      console.log('🚀 [AssetList] Starting VIEWER LEAF NODE asset extraction (proven approach)...');
      console.log('📋 [AssetList] Viewer info:', {
        hasViewer: !!viewer,
        hasModel: !!viewer?.model,
        hasGetAllModels: typeof viewer?.getAllModels === 'function',
        hasInstanceTree: typeof viewer?.model?.getInstanceTree === 'function'
      });

      // Use proven viewer-based leaf node extraction
      const extractor = new ViewerLeafAssetExtractor(viewer);
      const viewerAssets = await extractor.extractAssets((progress) => {
        setExtractionProgress(progress.progress);
        console.log(`📊 [${progress.stage}] ${progress.message} (${progress.current}/${progress.total})`);
      });

      console.log(`✅ [AssetList] Extraction complete: ${viewerAssets.length} assets`);
      
      // Log detailed extraction summary
      console.log('📊 [AssetList] Extraction summary:', {
        totalAssetsExtracted: viewerAssets.length,
        hasCategoryData: viewerAssets.length > 0 && viewerAssets.some(a => a.category),
        hasNameData: viewerAssets.length > 0 && viewerAssets.some(a => a.name),
        hasTypeData: viewerAssets.length > 0 && viewerAssets.some(a => a.type),
        categories: Array.from(new Set(viewerAssets.map(a => a.category))).slice(0, 10)
      });
      
      // Log sample of extracted names for debugging
      try {
        const samples = viewerAssets.slice(0, 5).map(a => ({ 
          dbId: a.dbId, 
          name: a.name, 
          type: a.type, 
          category: a.category,
          family: a.family,
          brand: a.brand,
          model: a.model
        }));
        console.log('[AssetList] First 5 extracted assets:', samples);
        
        // Log any assets with missing critical data
        const incomplete = viewerAssets.filter(a => !a.name || !a.category);
        if (incomplete.length > 0) {
          console.warn(`[AssetList] ⚠️ ${incomplete.length} assets missing name or category:`, incomplete.slice(0, 3));
        }
      } catch (e) {
        console.error('[AssetList] Error logging sample assets:', e);
      }

      console.log('🔄 [AssetList] Converting viewer assets to AssetRecord format...');
      
      // STEP 1: Determine Global Project Code (Backend first, then BIM model fallback)
      let globalProjectCode: string | undefined;
      try {
        // 1A. Try to fetch project metadata from backend (authoritative source)
        if (projectId) {
          try {
            console.log(`🔎 [AssetList] Fetching project metadata for projectId=${projectId} to obtain code...`);
            const res = await fetch(`/api/projects/${projectId}`);
            if (res.ok) {
              const data = await res.json();
              const backendCode = data?.project?.code;
              if (backendCode) {
                globalProjectCode = String(backendCode).trim();
                console.log(`   ✅ [AssetList] Global Project Code obtained from backend: "${globalProjectCode}"`);
              } else {
                console.warn('   ⚠️ [AssetList] Backend project response has no code field');
              }
            } else {
              console.warn(`   ⚠️ [AssetList] Backend project fetch failed (status ${res.status})`);
            }
          } catch (err) {
            console.error('   ❌ [AssetList] Error fetching backend project metadata:', err);
          }
        } else {
          console.warn('   ⚠️ [AssetList] No projectId provided; skipping backend project code fetch');
        }

        // 1B. If backend did not yield a code, search BIM models for Project Information element
        if (!globalProjectCode) {
          console.log('🔎 [AssetList] Searching for Project Information across ALL loaded BIM models (fallback)...');
          const allModels = viewer.getAllModels();
          console.log(`   [AssetList] Found ${allModels.length} models to search.`);

          // Potential category/name variants for international/localized Revit setups
          const projectInfoSearchTerms = [
            'Project Information', // English
            'Informazioni progetto', // Italian (possible)
            'Informazioni Progetto',
            'Dati Progetto'
          ];
          const projectCodeAliases = ['Project Code','Codice Progetto','Project Number','Numero Progetto','Commessa'];

          for (const model of allModels) {
            let found = false;
            for (const term of projectInfoSearchTerms) {
              const projectInfoIds = await new Promise<number[]>((resolve) => {
                model.search(
                  term,
                  (ids: number[]) => resolve(ids),
                  () => resolve([]),
                  ['Category'],
                  { searchHidden: true }
                );
              });
              if (projectInfoIds.length > 0) {
                console.log(`   ✅ Found Project Information term="${term}" in model ${model.id} (matches: ${projectInfoIds.length})`);
                const pProps: any = await new Promise(resolve => model.getProperties(projectInfoIds[0], resolve));
                if (pProps?.properties) {
                  const pMap: Record<string, any> = {};
                  pProps.properties.forEach((p: any) => { if (p.displayName) pMap[p.displayName] = p.displayValue; });
                  for (const k of projectCodeAliases) {
                    if (pMap[k]) {
                      globalProjectCode = pMap[k];
                      console.log(`   ✅ Successfully extracted Global Project Code from BIM: "${globalProjectCode}" (key: ${k})`);
                      found = true;
                      break;
                    }
                  }
                  if (!found) {
                    console.warn(`   ⚠️ Project Information element exists but none of the code aliases matched. Keys: ${Object.keys(pMap).join(', ')}`);
                  }
                }
              }
              if (found) break; // stop trying other terms for this model
            }
            if (globalProjectCode) break; // stop searching other models once found
          }

          if (!globalProjectCode) {
            console.warn('   ⚠️ No Project Information element containing a recognizable Project Code was found in ANY BIM model.');
          }
        }
      } catch (e) {
        console.error('   ❌ A critical error occurred while determining Global Project Code:', e);
      }
      
      console.log(`🔄 [AssetList] Global Project Code: ${globalProjectCode || '(not found)'}`);
      console.log('🔄 [AssetList] Now converting ${viewerAssets.length} assets...\n');
      
      const currentGuid = getCurrentModelGuid();
      const newAssets: AssetRecord[] = viewerAssets.map((asset: ViewerAsset) => {
        const props = asset.properties || {} as Record<string, any>;
        const propsLower: Record<string, any> = {};
        for (const k of Object.keys(props)) propsLower[k.toLowerCase().trim()] = props[k];
        const pick = (...keys: string[]) => {
          for (const k of keys) {
            if (props[k] !== undefined) return props[k];
            const lk = k.toLowerCase().trim();
            if (propsLower[lk] !== undefined) return propsLower[lk];
          }
          return undefined;
        };

        // Log instance name extraction for debugging
        const instanceNameDebug = {
          'asset.name': asset.name,
          'Name': props['Name'],
          'Nome': props['Nome'],
          'Mark': props['Mark'],
          'Contrassegno': props['Contrassegno'],
          'dbId': asset.dbId,
          'category': asset.category,
          'type': asset.type
        };
        if (asset.name?.includes('Element') || !asset.name) {
          console.log('[AssetList][map] Instance name for dbId', asset.dbId, ':', instanceNameDebug);
        }

        // Brand must coincide with Manufacturer attribute - default to 'Unknown' if not found
        const brand = asset.brand || pick('Manufacturer','Produttore','Brand','Marca','Fabbricante','Costruttore') || 'Unknown';
        // Model must coincide with Model attribute - default to 'Unknown' if not found
        const model = asset.model || pick('Model','Modello','Type Name','Nome del tipo') || 'Unknown';
        // Serial number - remove Mark fallback, only use Serial Number attributes
        const serial = asset.serialNumber || pick('Serial Number','Numero di Serie','Numero di serie','Matricola','Seriale') || undefined;
        const installDate = props['Install Date'] || props['Installation Date'] || undefined;
        const power = props['Power'] || props['Power Rating'] || props['kW'] || undefined;
        const capacity = props['Capacity'] || undefined;
        const weight = props['Weight'] || undefined;
        const length = props['Length'] || undefined;
        const width = props['Width'] || undefined;
        const height = props['Height'] || props['Thickness'] || undefined;
        const dimensions = (length || width || height) ? `${length || ''} x ${width || ''} x ${height || ''}`.replace(/\s+x\s+x\s+/, '').trim() : undefined;

        // Robust level fallback from properties if asset.level is missing or not descriptive
        const levelFromProps = pick(
          'Schedule Level','Livello abaco',
          'Base Level','Reference Level',
          'Livello di base','Livello superiore',
          'Vincolo di base','Vincolo parte superiore',
          'Base Constraint','Top Constraint','Constraint','Vincolo',
          'Livello','Level','Piano','Piano Terra','Level 1','Base Constraint'
        );
        const levelForLocation = (asset.level && String(asset.level).trim()) ? asset.level : levelFromProps;

        try {
          if (brand === 'Unknown' || model === 'Unknown' || !serial) {
            console.log('[AssetList][map][missing] dbId:', asset.dbId, {
              category: asset.category,
              brand, model, serial,
              keys: Object.keys(props)
            });
          }
        } catch {}

        // Normalize IFC fields from multilingual Revit properties
        // IFC Class: Read directly from IfcExportType attribute first
        // Common keys seen: 'IfcExportType', 'IFC Export Type', 'IFC Class', 'IfcClass', 'Classe IFC',
        // 'Esporta tipo in formato IFC con nome' (Italian: Export type to IFC with name),
        // 'Tipo predefinito IFC' (Predefined Type), 'IfcGUID'
        const ifcGuid = pick('IfcGUID','IFC GUID','IFC GlobalId','GlobalId');
        const ifcClass = pick(
          'IfcExportType',  // Primary: Read directly from IfcExportType attribute
          'IFC Export Type',
          'IFC Class','IfcClass','Classe IFC',
          'Esporta tipo in formato IFC con nome',
          'Esporta in formato IFC con nome',
          'Esporta tipo in IFC con nome',
          'Export type in IFC with name',
          'Export type to IFC as name',
          'Export IFC Type'
        ) || asset.ifcExportType || 'Unknown';  // Fall back to ifcExportType from viewer asset, then default to 'Unknown'
        const ifcType = pick('IFC Type','IfcType','Tipo IFC');
        const ifcPredefined = pick('Predefined Type','PredefinedType','Tipo predefinito IFC','Tipo: Tipo predefinito IFC');
        const ifcCandidates = [ifcClass, ifcType, ifcPredefined]
          .map(v => (v == null ? undefined : String(v)))
          .filter(Boolean) as string[];

        // Determine asset classification from category
        let assetClassification: AssetRecord['assetClassification'] = 'OTHER';
        const catLower = (asset.category || '').toLowerCase();
        if (/(structural|column|beam|wall|floor|slab)/.test(catLower)) assetClassification = 'STRUCTURAL';
        else if (/(door|window|stair|roof|ceiling)/.test(catLower)) assetClassification = 'ARCHITECTURAL';
        else if (/(mechanical|electrical|plumbing|duct|pipe|hvac|fixture|equipment|terminal)/.test(catLower)) assetClassification = 'MEP';
        else if (/(furniture|casework)/.test(catLower)) assetClassification = 'FURNITURE';
        else if (/equipment/.test(catLower)) assetClassification = 'EQUIPMENT';

        // Extract description from IFC metadata (Description attribute)
        // Priority: 1) Description attribute 2) asset.name with bracket parsing 3) type 4) category
        const descriptionFromMetadata = pick('Description', 'Descrizione', 'Description attribute');
        
        // Parse asset.name to extract name and code from brackets
        // Examples: "White Porcelain Plate [997068]" or "POR-ASB-Emergenza-01 [169069]"
        let parsedAssetName = asset.name || '';
        let parsedAssetCode = '';
        
        const nameMatch = (asset.name || '').match(/^(.+?)\s*\[(\d+)\]\s*$/);
        if (nameMatch) {
          // Name contains [ID] pattern
          parsedAssetName = nameMatch[1].trim();
          parsedAssetCode = nameMatch[2];
        }

        // --- Asset Code Logic ---
        console.log(`🔍 [AssetList Extract] Processing asset dbId: ${asset.dbId}, name: ${asset.name}`);
        
        // Priority 1: explicit Asset Code parameter from BIM
        const assetCodeFromParam = pick('Asset Code','Codice Asset','Codice Bene','Sigla');
        console.log(`   ✅ Step 1 - Asset Code from parameter: ${assetCodeFromParam || '(not found)'}`);

        // Priority 2: compute from Project Code + Level if parameter missing
        let finalAssetCode = assetCodeFromParam || '';

        if (!finalAssetCode) {
          // Try to get project code from element properties first
          let projectCode = pick('Project Code','Codice Progetto','Project Number','Numero Progetto','Commessa');
          console.log(`   ✅ Step 2a - Project Code from element: ${projectCode || '(not found)'}`);

          // If not found on element, use the globally fetched Project Code
          if (!projectCode && globalProjectCode) {
            projectCode = globalProjectCode;
            console.log(`   ✅ Step 2b - Using global Project Code: ${projectCode}`);
          }

          // Normalize level into a string safely (handle numbers or objects)
          const levelRaw = (() => {
            if (typeof levelForLocation === 'string') return levelForLocation.trim();
            if (typeof levelForLocation === 'number') return String(levelForLocation);
            if (levelForLocation && typeof levelForLocation === 'object') {
              const dv = (levelForLocation as any).displayValue || (levelForLocation as any).value || (levelForLocation as any).name;
              if (dv) return String(dv).trim();
            }
            return '';
          })();
          console.log(`   ✅ Step 3 - Level string (normalized): ${levelRaw || '(not found)'}`);

          // Compute level code from levelRaw (e.g. "0 - Piano Terra", "1 - Piano Primo", "-1 - Piano Interrato 1")
          if (projectCode && levelRaw) {
            let levelCode = '';
            const m = String(levelRaw).match(/^(-?\d+)/);
            if (m) {
              const num = parseInt(m[1], 10);
              console.log(`   ✅ Step 4 - Extracted level number: ${num}`);
              if (num >= 0) {
                levelCode = num.toString().padStart(2, '0');
              } else {
                levelCode = `G${Math.abs(num)}`;
              }
              console.log(`   ✅ Step 5 - Level code generated: ${levelCode}`);
            } else {
              console.log(`   ⚠️ Step 4 - Could not extract level number from: "${levelRaw}"`);
            }
            if (levelCode) {
              finalAssetCode = `${projectCode}-${levelCode}`;
              console.log(`   ✅ Step 6 - Final Asset Code computed: ${finalAssetCode}`);
            }
          } else {
            if (!projectCode) console.log(`   ⚠️ Cannot compute Asset Code - Project Code missing`);
            if (!levelRaw) console.log(`   ⚠️ Cannot compute Asset Code - Level missing`);
          }
        }

        // Priority 3: if still empty, use '@'
        if (!finalAssetCode) {
          finalAssetCode = '@';
          console.log(`   ⚠️ Step 7 - Fallback to '@' - no code could be determined`);
        }

        console.log(`   ✅ FINAL Asset Code: ${finalAssetCode}\n`);
        
        // Asset Name Priority: 1) Description from IFC metadata 2) Parsed asset.name 3) Type 4) Category 5) Default
        const finalAssetName = (descriptionFromMetadata && String(descriptionFromMetadata).trim()) 
          || parsedAssetName 
          || asset.type 
          || asset.category 
          || 'Unknown Asset';

        return {
          id: `viewer-${currentGuid}-${asset.dbId}`,
          dbId: asset.dbId,
          assetCode: finalAssetCode,
          elementId: asset.elementId,
          assetName: finalAssetName,
          category: asset.category,
          type: asset.type,
          brand,
          model,
          serialNumber: serial,
          installationDate: installDate,
          assetClassification,
          powerRating: power,
          capacity,
          weight,
          dimensions,
          material: asset.material,
          location: [levelForLocation, (() => {
            // Try to resolve Room via sensorContext if missing from properties
            let resolvedRoom = asset.room;
            if ((!resolvedRoom || resolvedRoom === '—') && (window as any).sensorContext?.findRoomForObject) {
              try {
                // Note: findRoomForObject is async, but we are in a sync map callback.
                // We can't await here easily without refactoring extraction to be fully async per-item.
                // However, if the room mapper is fast/cached, we might get lucky or we rely on PlannedMaintenance to fill it in later.
                // For now, we'll skip the async call here to avoid Promise objects in the location string.
                // The PlannedMaintenance module has its own async enrichment logic which will catch this.
                
                // If we really needed it here, we'd have to make the map callback async and use Promise.all.
                // Given the complexity, we'll let PlannedMaintenance handle the spatial lookup.
              } catch (e) {
                // console.warn(`   ⚠️ Failed to resolve room via sensorContext for dbId ${asset.dbId}`, e);
              }
            }
            return resolvedRoom;
          })()].filter(Boolean).join(' - ') || 'Unknown Location',
          description: `Asset extracted from BIM model`,
          condition: 'Good',
          source: 'BIM_MODEL',
          // IFC metadata for filtering
          ifcGuid: ifcGuid ? String(ifcGuid) : undefined,
          ifcClass: String(ifcClass),  // Always use ifcClass value (defaults to 'Unknown' from extraction)
          ifcType: ifcType ? String(ifcType) : undefined,
          ifcPredefined: ifcPredefined ? String(ifcPredefined) : undefined,
          ifcCandidates: ifcCandidates.length ? ifcCandidates : undefined,
          // Force-align to the currently loaded model/viewable GUID so UI filtering matches
          modelGuid: currentGuid,
          modelId: (asset as any).modelId
        } as AssetRecord;
      });

  console.log(`✅ [AssetList] Converted ${newAssets.length} assets`);

      // Merge with existing manual assets
  console.log('🔄 [AssetList] Merging with existing assets...');
  const existingManualAssets = rows.filter(r => r.source === 'MANUAL');
  const keyOf = (a: AssetRecord) => `${(a.category || '').toLowerCase()}|${(a.location || '').toLowerCase()}|${(a.model || a.assetName || '').toLowerCase()}`;

      // Basic conflict detection (manual vs BIM)
      const manualMap = new Map<string, AssetRecord>();
      existingManualAssets.forEach(a => manualMap.set(keyOf(a), a));
      newAssets.forEach(a => {
        const m = manualMap.get(keyOf(a));
        if (m) {
          a.conflictWithId = m.id;
          m.conflictWithId = a.id;
        }
      });

      // Merge newly extracted BIM assets with any locally cached or backend-loaded versions
      // Prefer existing values for editable fields (backend values or local edits) so extraction doesn't overwrite
      // IMPORTANT: Also check localStorage directly to get latest edits made after extraction started
      const localStorageAssets = load(K.assets(projectId), [] as AssetRecord[]);
      const allExistingAssets = [...rows, ...localStorageAssets.filter(lsa => !rows.find(r => r.id === lsa.id))];
      
      // Merge extracted assets with any existing rows. Match by id OR by stable BIM key (modelGuid+dbId).
      // If an existing record is found prefer its id (this may be a DB ObjectId) so we keep continuity
      // between local cache and backend records. Also preserve editable fields and userEdited flag.
      const newAssetsMerged = newAssets.map(a => {
        const byId = allExistingAssets.find(r => r.id === a.id);
        const byDbId = allExistingAssets.find(r => r.source === 'BIM_MODEL' && r.dbId != null && a.dbId != null && r.dbId === a.dbId && r.modelGuid === a.modelGuid);
        const old = byId || byDbId;
        if (!old) return a;
        const merged: any = { ...a, id: old.id };
        for (const key of EDITABLE_FIELDS) {
          const v = (old as any)[key];
          if (v !== undefined && v !== null && v !== '') merged[key] = v;
        }
        if ((old as any).userEdited) merged.userEdited = true;
        // Clear any conflicts that were on the old version
        merged.conflictWithId = undefined;
        return merged as AssetRecord;
      });

      // Replace BIM assets with the current model's assets; keep manual assets
      // But HIDE manual assets that conflict with edited BIM assets
      const editedBimIds = new Set(newAssetsMerged.filter(a => a.userEdited).map(a => a.id));
      const existingManualAssetsFiltered = existingManualAssets.map(m => {
        // If this manual asset conflicts with an edited BIM asset, hide it
        if (m.conflictWithId && editedBimIds.has(m.conflictWithId)) {
          return { ...m, hidden: true, linkedAssetId: m.conflictWithId, conflictWithId: undefined };
        }
        return m;
      });
      
      const combined = [...existingManualAssetsFiltered, ...newAssetsMerged];

      // Deduplicate by stable id to avoid React duplicate key warnings (e.g., "universal-4087")
      const uniqueById = Array.from(new Map(combined.map(a => [a.id, a])).values());

      console.log(`✅ [AssetList] Merged: ${uniqueById.length} total assets (${existingManualAssets.length} manual, ${newAssets.length} new BIM)`);

      // Immediately update UI and local cache to avoid blocking on network (with dedupe)
      // Filter to the currently loaded model for BIM assets
      const onlyCurrentModel = filterAssetsForCurrentModel(uniqueById);
      const dedupedAfterExtract = dedupeAssets(onlyCurrentModel);
      if (dedupedAfterExtract.length !== uniqueById.length) {
        console.log(`🧹 [AssetList] Filtered+Deduped after extract: ${uniqueById.length} -> ${dedupedAfterExtract.length}`);
      }
      setRows(dedupedAfterExtract);
      save(K.assets(projectId), dedupedAfterExtract);

      console.log('✅ [AssetList] Asset extraction complete — UI updated. Starting background save...');

      const breakdown = Object.entries(
        newAssets.reduce((acc, asset) => {
          const type = asset.assetClassification || 'Other';
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      ).map(([type, count]) => `${type}: ${count}`).join(' • ');

      showToast('success', `Extracted ${newAssets.length} assets. ${breakdown}`);

      // Background persist with timeouts (non-blocking)
      (async () => {
        if (!projectId) {
          console.warn('⚠️ [AssetList] No projectId provided, skipping backend save');
          return;
        }
        try {
          const timeoutMs = 15000;
          const withTimeout = (signal?: AbortSignal) => {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort('timeout'), timeoutMs);
            const composite = signal ? new AbortController() : controller;
            return { controller, timer };
          };

          console.log(`💾 [AssetList] BG save ${newAssetsMerged.length} assets to backend (projectId: ${projectId})...`);
          const saveCtrl = new AbortController();
          const saveTimer = setTimeout(() => saveCtrl.abort('timeout'), 60000);
          const saveRes = await fetch(`/api/projects/${projectId}/assets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // IMPORTANT: send merged assets so backend stores user fields too
            body: JSON.stringify({ action: 'replaceForModel', modelGuid: currentGuid, assets: newAssetsMerged }),
            signal: saveCtrl.signal
          }).catch(err => { throw err; });
          clearTimeout(saveTimer);

          if (!saveRes.ok) {
            const errorText = await saveRes.text().catch(() => '');
            console.warn('⚠️ [AssetList] BG save failed:', saveRes.status, errorText);
            return;
          }

          // Small delay then background refresh
          await new Promise(r => setTimeout(r, 500));
          const reloadCtrl = new AbortController();
          const reloadTimer = setTimeout(() => reloadCtrl.abort('timeout'), 30000);
          const guid = getCurrentModelGuid();
          const res = await fetch(`/api/projects/${projectId}/assets${guid ? `?modelGuid=${encodeURIComponent(guid)}` : ''}` as any, { signal: reloadCtrl.signal }).catch(err => { throw err; });
          clearTimeout(reloadTimer);

          if (res && res.ok) {
            const data = await res.json();
            const list = Array.isArray(data) ? data : [];

            // Merge backend-reloaded list with cached/local (to preserve richer fields like IFC)
            const currentGuid2 = getCurrentModelGuid();
            const cachedAll = load(K.assets(projectId), [] as AssetRecord[]);
            const cached = cachedAll.filter(a => a.source !== 'BIM_MODEL' || a.modelGuid === currentGuid2);

            const mergedById = list.map(b => {
              const c = cached.find(x => x.id === b.id);
              if (!c) return b;
              const merged: any = { ...b };
              const isEdited = (c as any).userEdited === true;
              const isManual = (c as any).source === 'MANUAL';
              for (const key of Object.keys(c)) {
                const val = (c as any)[key];
                if (isEdited && (EDITABLE_FIELDS as any).includes(key)) {
                  merged[key] = val; // user edited fields always win
                } else if (isManual && (CLEARABLE_FIELDS as any).includes(key)) {
                  merged[key] = val; // allow nulls to clear
                } else if (val !== null && val !== undefined && val !== '') {
                  merged[key] = val;
                }
              }
              // Preserve critical flags and state
              if (isEdited) merged.userEdited = true;
              if ((c as any).hidden === true) merged.hidden = true;
              if ((c as any).linkedAssetId) merged.linkedAssetId = (c as any).linkedAssetId;
              if ((c as any).conflictWithId === undefined) merged.conflictWithId = undefined;
              return merged as AssetRecord;
            });
            const cachedOnly = cached.filter(c => !list.find(b => b.id === c.id));
            const finalList = [...mergedById, ...cachedOnly];

            const filtered = filterAssetsForCurrentModel(finalList);
            const deduped = dedupeAssets(filtered);
            console.log(`✅ [AssetList] BG reload merged ${list.length} backend with ${cached.length} cached -> ${finalList.length} (filtered ${filtered.length}, deduped ${deduped.length})`);
            setRows(deduped);
            // Persist the merged (richer) list so periodic refresh keeps IFC fields
            save(K.assets(projectId), deduped);
          } else {
            console.warn('⚠️ [AssetList] BG reload failed or aborted');
          }
        } catch (e) {
          console.warn('⚠️ [AssetList] Background persist/reload aborted or failed', e);
        }
      })();

    } catch (error) {
      console.error('❌ [AssetList] Asset extraction failed:', error);
      showToast('error', 'Failed to extract assets. Check console for details.');
    } finally {
      console.log('🏁 [AssetList] Extraction process finished');
      setIsExtracting(false);
      // Reset progress a tick later to avoid flicker
      setTimeout(() => setExtractionProgress(0), 250);
    }
  };

  // Auto-refresh assets when FM > Asset list opens (once per mount)
  const autoExtractOnceRef = React.useRef(false);
  useEffect(() => {
    // Remove auto-extract on open to avoid unintentional refreshes and page resets.
    // User must click 'Extract from BIM' to refresh assets.
    if (autoExtractOnceRef.current) return;
    autoExtractOnceRef.current = true;
  }, []);

  const onRowClick = (r: AssetRecord) => {
    try {
      if (!viewer) return;
      if (r.dbId != null) {
        // Prefer selecting in the model the asset came from
        const allModels: any[] = typeof (viewer as any).getAllModels === 'function'
          ? ((viewer as any).getAllModels() || [])
          : [viewer.model].filter(Boolean);
        const target = (r.modelId != null)
          ? (allModels.find(m => (typeof m.getModelId === 'function' ? m.getModelId() : m?.id) === r.modelId))
          : null;

        const trySelectInModel = (m: any) => {
          if (!m) return false;
          const mid = (typeof m.getModelId === 'function' ? m.getModelId() : m?.id);
          console.log(`[FM][select] Trying dbId ${r.dbId} in model ${mid} (asset.modelId=${r.modelId})`);
          try {
            // Check if dbId exists in this model's instance tree
            const tree = m.getInstanceTree?.();
            if (!tree) {
              console.log(`[FM][select] Model ${mid} has no instance tree, skipping`);
              return false;
            }
            
            // Verify dbId exists in this model
            let exists = false;
            try {
              tree.enumNodeChildren(r.dbId as number, () => { exists = true; }, false);
              if (!exists) {
                // Check if dbId itself is valid (leaf or parent)
                const name = tree.getNodeName?.(r.dbId as number);
                exists = !!name;
              }
            } catch {}
            
            if (!exists) {
              console.log(`[FM][select] dbId ${r.dbId} not found in model ${mid}`);
              return false;
            }
            
            console.log(`[FM][select] Found dbId ${r.dbId} in model ${mid}, selecting...`);
            
            // Ensure model is visible
            try { viewer.show?.(m); } catch {}
            try { m?.setVisible?.(true); } catch {}
            // Restore fragment visibility if the overlay was hidden via fragment-level ops
            try {
              const fragList = m?.getFragmentList?.();
              const count = fragList?.getCount?.() ?? 0;
              if (count > 0) {
                for (let i = 0; i < count; i++) { try { fragList.setVisibility(i, true); } catch {} }
                try { fragList.updateAnimTransforms?.(); } catch {}
              }
            } catch {}
            
            // Clear and select
            viewer.clearSelection?.();
            viewer.select?.([r.dbId as number], m);
            viewer.fitToView?.([r.dbId as number], m);
            
            // Force viewer refresh
            try { viewer.impl?.invalidate?.(true, true, true); } catch {}
            
            console.log(`[FM][select] ✅ Selected dbId ${r.dbId} in model ${mid}`);
            return true;
          } catch (e) { 
            console.warn(`[FM][select] Failed to select dbId ${r.dbId} in model ${mid}:`, e);
            return false; 
          }
        };

        let selected = false;
        if (target) {
          // If we have a stored modelId, ONLY try that specific model (dbIds are not unique across models!)
          selected = trySelectInModel(target);
          if (!selected) {
            console.warn(`[FM][select] Asset has modelId ${r.modelId} but dbId ${r.dbId} not found in that model. Skipping fallback to avoid selecting wrong object.`);
          }
        } else {
          // No stored modelId - try all models as fallback (legacy assets)
          console.log(`[FM][select] No modelId stored for dbId ${r.dbId}, trying all models...`);
          for (const m of allModels) { if (trySelectInModel(m)) { selected = true; break; } }
        }
        if (!selected) { 
          console.warn(`[FM][select] Could not select dbId ${r.dbId} in any model`);
          viewer.select?.([r.dbId as number]); 
          viewer.fitToView?.([r.dbId as number]); 
        }
        return;
      }
      // Manual asset: frame placeholder if available
      if (r.placeholderX != null && r.placeholderY != null && r.placeholderZ != null) {
        const THREE = (window as any).THREE;
        const size = r.placeholderSize ?? 0.3;
        if (THREE && viewer.navigation?.fitBounds) {
          const half = Math.max(size, 0.3);
          const min = new THREE.Vector3(r.placeholderX - half, r.placeholderY - half, r.placeholderZ - half);
          const max = new THREE.Vector3(r.placeholderX + half, r.placeholderY + half, r.placeholderZ + half);
          const bbox = new THREE.Box3(min, max);
          viewer.navigation.fitBounds(true, bbox);
          viewer.impl?.invalidate(true);
        }
      }
    } catch { }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(prev => {
      const ids = paginatedRows.map(r => r.id);
      const allSelected = ids.length > 0 && ids.every(id => prev.has(id));
      const next = new Set(prev);
      if (allSelected) ids.forEach(id => next.delete(id)); else ids.forEach(id => next.add(id));
      return next;
    });
  };

  // Conflict resolution modal state
  const [conflictModal, setConflictModal] = useState<{ open: boolean; manualId?: string; bimId?: string }>({ open: false });

  const openConflictResolver = (row: AssetRecord) => {
    const otherId = row.conflictWithId;
    if (!otherId) return;
    const other = rows.find(x => x.id === otherId);
    if (!other) return;
    const manual = row.source === 'MANUAL' ? row : (other.source === 'MANUAL' ? other : undefined);
    const bim = row.source === 'BIM_MODEL' ? row : (other.source === 'BIM_MODEL' ? other : undefined);
    if (!manual || !bim) return;
    setConflictModal({ open: true, manualId: manual.id, bimId: bim.id });
  };

  const resolveLink = () => {
    if (!conflictModal.manualId || !conflictModal.bimId) return;
    setRows(prev => prev.map(r => {
      if (r.id === conflictModal.manualId) return { ...r, linkedAssetId: conflictModal.bimId, conflictWithId: undefined };
      if (r.id === conflictModal.bimId) return { ...r, conflictWithId: undefined };
      return r;
    }));
    setConflictModal({ open: false });
  };

  const resolveMerge = () => {
    if (!conflictModal.manualId || !conflictModal.bimId) return;
    setRows(prev => {
      const manual = prev.find(r => r.id === conflictModal.manualId)!;
      const bim = prev.find(r => r.id === conflictModal.bimId)!;
      const merged: AssetRecord = {
        ...manual,
        brand: manual.brand || bim.brand,
        model: manual.model || bim.model,
        serialNumber: manual.serialNumber || bim.serialNumber,
        installationDate: manual.installationDate || bim.installationDate,
        material: manual.material || bim.material,
        dimensions: manual.dimensions || bim.dimensions,
        weight: manual.weight || bim.weight,
        capacity: manual.capacity || bim.capacity,
        powerRating: manual.powerRating || bim.powerRating,
        description: manual.description || bim.description,
        conflictWithId: undefined,
        linkedAssetId: bim.id
      };
      return prev.map(r => {
        if (r.id === manual.id) return merged;
        if (r.id === bim.id) return { ...r, hidden: true, conflictWithId: undefined };
        return r;
      });
    });
    setConflictModal({ open: false });
  };

  const resolveKeepBoth = () => {
    if (!conflictModal.manualId || !conflictModal.bimId) return;
    setRows(prev => prev.map(r => (r.id === conflictModal.manualId || r.id === conflictModal.bimId) ? { ...r, conflictWithId: undefined } : r));
    setConflictModal({ open: false });
  };

  const toggleField = (field: keyof typeof visibleFields) => {
    setVisibleFields(prev => ({ ...prev, [field]: !prev[field] }));
  };

  // Build distinct option lists for dropdown filters
  const distinct = {
    // Use sanitized category labels (no leading 'Revit' prefix)
    categories: Array.from(new Set(rows.map(r => stripRevitPrefix(r.category)).filter(Boolean))).sort() as string[],
    types: Array.from(new Set(rows.map(r => r.type).filter(Boolean))).sort() as string[],
    locations: Array.from(new Set(rows.map(r => r.location).filter(Boolean))).sort() as string[],
    // conditions removed from UI per request; keep computed list in case used elsewhere
    conditions: Array.from(new Set(rows.map(r => r.condition).filter(Boolean))).sort() as string[],
    classifications: Array.from(new Set(rows.map(r => r.assetClassification).filter(Boolean))).sort() as string[]
  };

  // Apply filters with smart category matching against master CATEGORY_MAPPING labels
  const filteredRows = rows.filter(r => {
    if (r.hidden) return false;
    // Free-text search across multiple fields
    const q = (filter.search || '').trim().toLowerCase();
    if (q) {
      const sourceText = r.source === 'BIM_MODEL' ? 'bim' : 'manual';
      const cat = (stripRevitPrefix(r.category) || '').toString().toLowerCase();
      const name = (r.assetName || '').toString().toLowerCase();
      const code = (r.assetCode || '').toString().toLowerCase();
      const brand = (r.brand || '').toString().toLowerCase();
      const model = (r.model || '').toString().toLowerCase();
      const cond = (r.condition || '').toString().toLowerCase();
      const type = (r.type || '').toString().toLowerCase();
      const ifcArr = (((r as any).ifcCandidates as string[] | undefined) || [ (r as any).ifcClass, (r as any).ifcType, (r as any).ifcPredefined ].filter(Boolean)) as string[];
      const ifcText = ifcArr.map(x => String(x || '')).join(' ').toLowerCase();
      const hay = `${cat} ${name} ${code} ${brand} ${model} ${cond} ${type} ${ifcText} ${sourceText}`;
      if (!hay.includes(q)) return false;
    }
    if (filter.category) {
      if (masterCategoryTokens.has(filter.category)) {
        const tokens = (masterCategoryTokens.get(filter.category) || []).map(t => String(t).toLowerCase());
        const cat = (r.category || '').toLowerCase();
        const match = tokens.some(t => t && (cat.includes(t) || t.includes(cat)));
        if (!match) return false;
      } else {
        // Non-master selection. Normalize and map Italian -> English/IFC.
        const rawSel = filter.category;
        const selLower = rawSel.toLowerCase();
        const selNoRevit = selLower.replace(/^revit\s+/, '').trim();

        // Try exact Italian key match (case-insensitive)
        const itKey = Object.keys(CATEGORY_MAPPING).find(k => k.toLowerCase() === selNoRevit);
        // Or try English match against mapping.english
        const enEntry = itKey ? null : Object.entries(CATEGORY_MAPPING).find(([, m]: any) => (m?.english || '').toLowerCase() === selNoRevit);
        const keyUsed = itKey || (enEntry ? enEntry[0] : undefined);
        const mapping: any = keyUsed ? (CATEGORY_MAPPING as any)[keyUsed] : undefined;

        if (mapping) {
          // Build robust token set: italian, english, ifc + their 'revit ' prefixed variants
          const baseTokens = [keyUsed, mapping.english, mapping.ifc].filter(Boolean) as string[];
          const tokens = Array.from(new Set(
            baseTokens.flatMap(t => [String(t).toLowerCase(), `revit ${String(t).toLowerCase()}`])
          ));
          const cat = (r.category || '').toLowerCase();
          const match = tokens.some((t: string) => t && (cat.includes(t) || t.includes(cat)));
          if (!match) return false;
        } else {
          // Fallback: try with and without 'revit ' prefix
          const cat = (r.category || '').toLowerCase();
          const candidates = [selLower, selNoRevit, `revit ${selNoRevit}`];
          const ok = candidates.some(sel => cat === sel || cat.includes(sel) || sel.includes(cat));
          if (!ok) return false;
        }
      }
    }
    if (filter.type && !r.type?.toLowerCase().includes(filter.type.toLowerCase())) return false;
    if (filter.location && !r.location?.toLowerCase().includes(filter.location.toLowerCase())) return false;
    // filter.condition UI removed; logic preserved if state is set programmatically
    if (filter.condition && !r.condition?.toLowerCase().includes(filter.condition.toLowerCase())) return false;
    // IFC class filter for table view
    if (filter.ifcClass) {
      const sel = (filter.ifcClass || '').toString().trim().toLowerCase();
      const norm = (s: string) => s.replace(/[^a-z0-9]/gi, '').toLowerCase();
      const selNorm = norm(sel);
      // Synonyms: map certain IFC classes to their common predefined type tokens
      const synonymMap: Record<string, string[]> = {
        'ifccovering': ['ceiling', 'flooring', 'cladding', 'roofing', 'sleeving', 'wrapping']
      };
      const synonyms = new Set<string>([sel, ...(synonymMap[sel] || [])]);
      // Start from ifcCandidates (ignoring empty/Unknown), then ALWAYS add fallbacks
      const rawCands = ((((r as any).ifcCandidates as any[] | undefined) || []).map(x => String(x)) ) as string[];
      const base = rawCands.filter(c => {
        const s = String(c || '').trim();
        return s && s.toLowerCase() !== 'unknown';
      });
      const extras = [
        String((r as any).ifcClass || ''),
        String((r as any).ifcType || ''),
        String((r as any).ifcPredefined || ''),
        // Also consider asset type text as projects sometimes embed IFC token here
        String(r.type || ''),
        // Fallbacks: IFC often appears embedded in category label
        String(r.category || ''),
        String(stripRevitPrefix(r.category) || '')
      ].filter(Boolean) as string[];
      const candidatesArr = Array.from(new Set([...(base as string[]), ...extras]));
      const anyHit = candidatesArr.some(c => {
        const cand = String(c || '').toLowerCase();
        const candNorm = norm(cand);
        // Check against selection and known synonyms
        for (const s of synonyms) {
          const sNorm = norm(s);
          if (cand === s || cand.includes(s) || s.includes(cand) || candNorm === sNorm || candNorm.includes(sNorm) || sNorm.includes(candNorm)) return true;
        }
        return false;
      });
      if (!anyHit) return false;
    }
    if (filter.classification && (r.assetClassification || '').toLowerCase() !== filter.classification.toLowerCase()) return false;
    // When "Show Selected" is enabled, only include rows matching current selection keys
    if (filter.selectedOnly) {
      const keys = new Set(filter.selectedKeys || []);
      const did = r.dbId != null ? String(r.dbId) : '';
      if (!did) return false; // only BIM-backed assets can match
      const mid = (r as any).modelId != null ? String((r as any).modelId) : '';
      const key1 = mid ? `${mid}:${did}` : '';
      const key2 = `*:${did}`;
      if (!(key1 && keys.has(key1)) && !keys.has(key2)) return false;
    }
    return true;
  });

  // Sorting state for Asset List
  const [sortKey, setSortKey] = useState<string>('assetName');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const getComparable = (r: AssetRecord, key: string): string => {
    try {
      if (key === 'source') return r.source === 'BIM_MODEL' ? 'BIM' : 'Manual';
      if (key === 'category') return (stripRevitPrefix(r.category) || '').toString();
      if (key === 'ifcClass') return ((r as any).ifcClass || 'Unknown').toString();
      return ((r as any)[key] ?? '').toString();
    } catch { return ''; }
  };

  const compareStr = (a: string, b: string): number => {
    const aa = a.trim().toLowerCase();
    const bb = b.trim().toLowerCase();
    const aEmpty = aa.length === 0;
    const bEmpty = bb.length === 0;
    if (aEmpty && bEmpty) return 0;
    if (aEmpty) return 1; // empty goes to end for asc
    if (bEmpty) return -1;
    return aa.localeCompare(bb, undefined, { numeric: false, sensitivity: 'base' });
  };

  const sortedRows = React.useMemo(() => {
    const arr = [...filteredRows];
    if (!sortKey) return arr;
    arr.sort((ra, rb) => {
      const va = getComparable(ra, sortKey);
      const vb = getComparable(rb, sortKey);
      const cmp = compareStr(va, vb);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [filteredRows, sortKey, sortDir]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortIndicator = (key: string) => (sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '');

  // Reset page when filters or page size change
  useEffect(() => { setPage(1); }, [filter.category, filter.type, filter.location, filter.condition, filter.classification, filter.ifcClass, filter.search, filter.selectedOnly, filter.selectedKeys, pageSize]);

  // Persist page number per project so minimize/maximize (or remount) keeps the same page
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') localStorage.setItem(pageStorageKey, String(page));
    } catch {}
  }, [page, pageStorageKey]);

  // Debug aid: log IFC filtering stats when user selects an IFC class
  useEffect(() => {
    if (!filter.ifcClass) return;
    try {
      const sel = filter.ifcClass.toLowerCase();
      const withIfc = rows.filter(r => (r as any).ifcClass || (r as any).ifcType || (r as any).ifcPredefined || (r as any).ifcCandidates?.length);
      const matches = rows.filter(r => {
        const arr = ((r as any).ifcCandidates as string[] | undefined) || [ (r as any).ifcClass, (r as any).ifcType, (r as any).ifcPredefined ].filter(Boolean);
        return (arr as string[]).some(c => {
          const cc = String(c || '').toLowerCase();
          return cc === sel || cc.includes(sel) || sel.includes(cc);
        });
      });
      const sample = withIfc.slice(0, 5).map(r => ({ id: r.id, ifcClass: (r as any).ifcClass, ifcType: (r as any).ifcType, ifcPredefined: (r as any).ifcPredefined, cand: (r as any).ifcCandidates }));
      console.log('[IFC Filter][debug]', {
        selected: filter.ifcClass,
        totalRows: rows.length,
        withIfcFields: withIfc.length,
        matches: matches.length,
        sample
      });
    } catch {}
  }, [filter.ifcClass, rows]);

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const pageClamped = Math.min(page, totalPages);
  const startIndex = (pageClamped - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedRows = sortedRows.slice(startIndex, endIndex);

  // Build selection keys from viewer selection (multi-model safe): `${modelId}:${dbId}` and fallback `*:${dbId}`
  const getCurrentSelectionKeys = React.useCallback(async (): Promise<string[]> => {
    try {
      if (!viewer) return [];
      const uniq = new Set<string>();
      const agg: any = await new Promise(resolve => viewer.getAggregateSelection ? viewer.getAggregateSelection(resolve) : resolve(null));
      if (Array.isArray(agg) && agg.length > 0) {
        for (const item of agg) {
          const sel: number[] = Array.isArray(item?.selection) ? item.selection : [];
          const model = item?.model;
          const mid = model ? String((typeof model.getModelId === 'function' ? model.getModelId() : model.id) ?? '') : '';
          for (const id of sel) { uniq.add(`${mid}:${id}`); uniq.add(`*:${id}`); }
        }
      } else {
        const sel: number[] = viewer.getSelection?.() || [];
        const model = viewer.model;
        const mid = model ? String((typeof model.getModelId === 'function' ? model.getModelId() : model.id) ?? '') : '';
        for (const id of sel) { uniq.add(`${mid}:${id}`); uniq.add(`*:${id}`); }
      }
      return Array.from(uniq.values());
    } catch { return []; }
  }, [viewer]);

  const toggleShowSelected = async () => {
    try {
      if (!viewer) return;
      if (!filter.selectedOnly) {
        const keys = await getCurrentSelectionKeys();
        if (!keys.length) { showToast('info', 'Select one or more objects in the model first'); return; }
        setFilter(f => ({ ...f, selectedOnly: true, selectedKeys: keys }));
      } else {
        setFilter(f => ({ ...f, selectedOnly: false, selectedKeys: [] }));
      }
    } catch {}
  };

  const applyFilterToViewer = () => {
    if (!viewer || filteredRows.length === 0) return;
    const dbIds = filteredRows.filter(r => r.dbId != null).map(r => r.dbId as number);
    if (dbIds.length > 0) {
      viewer.isolate?.(dbIds);
      viewer.fitToView?.(dbIds);
    }
  };

  // Export CSV of selected or filtered assets
  const exportCSV = () => {
    const headers = [
      'id', 'assetCode', 'assetName', 'category', 'type', 'brand', 'model', 'serialNumber', 'installationDate',
      'material', 'dimensions', 'weight', 'capacity', 'powerRating', 'location', 'condition', 'source'
    ];
    // Prefer explicitly checkbox-selected rows; otherwise export the currently filtered rows
    const data = (selectedIds.size > 0)
      ? rows.filter(r => selectedIds.has(r.id))
      : filteredRows;

    if (data.length === 0) { showToast('info', 'No assets to export'); return; }

    const lines = [headers.join(',')];
    data.forEach(r => {
      const vals = headers.map(h => {
        let v = (r as any)[h];
        // sanitize category column for export
        if (h === 'category') v = stripRevitPrefix(v);
        const s = (v == null ? '' : String(v));
        return '"' + s.replace(/"/g, '""') + '"';
      });
      lines.push(vals.join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'asset_register.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  // Manual asset placement (placeholder geometry)
  const placeManual = (r: AssetRecord) => {
    // Remote placement if we're in the standalone control window (no viewer)
    if (!viewer) {
      setPlacingAssetId(r.id);
      try {
        const opener = (window as any).opener as Window | null;
        if (!opener) return;
        // Temporarily minimize/slide this window to the side
        const old = { x: window.screenX, y: window.screenY, w: window.outerWidth, h: window.outerHeight };
        try {
          const sw = window.screen?.availWidth || 1280;
          const sh = window.screen?.availHeight || 800;
          const targetW = Math.max(360, Math.min(480, Math.floor(sw * 0.32)));
          const targetH = Math.max(260, Math.min(420, Math.floor(sh * 0.35)));
          window.resizeTo(targetW, targetH);
          window.moveTo(sw - targetW - 10, 10);
        } catch { }
        // One-off listener for placement result
        const onMsg = (e: MessageEvent) => {
          const d: any = e.data;
          if (!d || typeof d !== 'object') return;
          if (d.type === 'FM_PLACE_DONE' && d.assetId === r.id && d.point) {
            try {
              const updated = { ...r, placeholderX: d.point.x, placeholderY: d.point.y, placeholderZ: d.point.z, location: d.location ?? r.location };
              setRows(prev => prev.map(a => a.id === r.id ? updated : a));
              saveAssetToBackend(updated);
            } finally {
              window.removeEventListener('message', onMsg);
              // restore window
              try { window.resizeTo(old.w, old.h); window.moveTo(old.x, old.y); window.focus(); } catch { }
              setPlacingAssetId(null);
            }
          } else if (d.type === 'FM_PLACE_CANCELLED') {
            window.removeEventListener('message', onMsg);
            try { window.resizeTo(old.w, old.h); window.moveTo(old.x, old.y); window.focus(); } catch { }
            setPlacingAssetId(null);
          }
        };
        window.addEventListener('message', onMsg);
        // Send start with preferred shape/size
        const shape = (r.placeholderShape || 'cube') as 'cube' | 'sphere';
        const size = (r.placeholderSize ?? 0.3) as number;
        opener.postMessage({ type: 'FM_PLACE_START', assetId: r.id, shape, size }, '*');
      } catch { }
      return;
    }
    // In-viewer placement (main window)
    setPlacingAssetId(r.id);
    // Keep overlay visible but allow click-through, remove blur/backdrop, and hide modal content
    let overlayEl: HTMLElement | null = null;
    let overlayChildEl: HTMLElement | null = null;
    let prevChildDisplay: string | null = null;
    let prevBackdrop: string | null = null;
    let prevBg: string | null = null;
    try {
      overlayEl = document.getElementById('fm-modal-overlay');
      if (overlayEl) {
        // store and clear visuals
        prevBackdrop = overlayEl.style.backdropFilter || '';
        prevBg = overlayEl.style.background || overlayEl.style.backgroundColor || '';
        overlayEl.style.pointerEvents = 'none';
        overlayEl.style.backdropFilter = 'none';
        overlayEl.style.background = 'transparent';
        overlayEl.style.backgroundColor = 'transparent';
        overlayChildEl = overlayEl.firstElementChild as HTMLElement | null;
        if (overlayChildEl) {
          prevChildDisplay = overlayChildEl.style.display || '';
          overlayChildEl.style.display = 'none';
        }
      }
    } catch { }
    const container = viewer.container as HTMLElement;
    // Ensure crosshair cursor globally for the viewer container
    try {
      if (!document.getElementById('fm-placing-style')) {
        const style = document.createElement('style');
        style.id = 'fm-placing-style';
        style.textContent = `.fm-placing, .fm-placing * { cursor: crosshair !important; }`;
        document.head.appendChild(style);
      }
    } catch { }
    container.classList.add('fm-placing');
    container.style.cursor = 'crosshair';
    const canvas = container.querySelector('canvas') as HTMLCanvasElement | null;
    if (canvas) canvas.style.cursor = 'crosshair';

    const finish = () => {
      container.removeEventListener('click', onClick, true);
      window.removeEventListener('keydown', onKeyDown, true);
      container.style.cursor = 'default';
      if (canvas) canvas.style.cursor = 'default';
      container.classList.remove('fm-placing');
      // Restore modal overlay and button state
      try {
        if (overlayEl) {
          overlayEl.style.pointerEvents = '';
          if (prevBackdrop != null) overlayEl.style.backdropFilter = prevBackdrop;
          if (prevBg != null) { overlayEl.style.background = prevBg; overlayEl.style.backgroundColor = prevBg; }
        }
        if (overlayChildEl) overlayChildEl.style.display = prevChildDisplay ?? '';
      } catch { }
      setPlacingAssetId(null);
    };
    const onClick = async (ev: MouseEvent) => {
      try {
        let pt: any = null;
        let locDbId: number | undefined;
        let locModel: any | undefined;
        const res = viewer.impl.hitTest(ev.clientX, ev.clientY, true);
        if (res && res.point) {
          pt = res.point;
          if (res.dbId != null && res.model) { locDbId = res.dbId; locModel = res.model; }
        } else {
          // Fallback: place on currently selected object center (aggregate safe)
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
          if (!pt) {
            // keep placing until user clicks a valid spot or select an object
            showToast('info', 'Click a surface or select an object, then click to place. ESC to cancel.');
            return;
          }
        }
        // draw overlay using chosen shape and size
        const THREE = (window as any).THREE;
        if (THREE) {
          if (!(viewer as any)._fmOverlayCreated) {
            viewer.impl.createOverlayScene('fm-placeholders');
            (viewer as any)._fmOverlayCreated = true;
          }
          const size = r.placeholderSize ?? 0.3;
          const geom = (r.placeholderShape || 'cube') === 'sphere'
            ? new THREE.SphereGeometry(size / 2, 12, 12)
            : new THREE.BoxGeometry(size, size, size);
          const mat = new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.85 });
          const mesh = new THREE.Mesh(geom, mat);
          mesh.position.set(pt.x, pt.y, pt.z);
          viewer.impl.addOverlay('fm-placeholders', mesh);
          viewer.impl.invalidate(true);
        }
        // derive location from properties if possible (Level / Room / Building)
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

        // store coordinates (and location if found)
        const currentAsset = rows.find(a => a.id === r.id) || r;
        const updated = { ...currentAsset, placeholderX: pt.x, placeholderY: pt.y, placeholderZ: pt.z, location: newLocation ?? currentAsset.location };
        setRows(prev => prev.map(a => a.id === r.id ? updated : a));
        saveAssetToBackend(updated);
        finish();
      } catch { }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        container.removeEventListener('click', onClick, true);
        window.removeEventListener('keydown', onKeyDown, true);
        container.style.cursor = 'default';
        if (canvas) canvas.style.cursor = 'default';
        container.classList.remove('fm-placing');
        try {
          if (overlayEl) {
            overlayEl.style.pointerEvents = '';
            if (prevBackdrop != null) overlayEl.style.backdropFilter = prevBackdrop;
            if (prevBg != null) { overlayEl.style.background = prevBg; overlayEl.style.backgroundColor = prevBg; }
          }
          if (overlayChildEl) overlayChildEl.style.display = prevChildDisplay ?? '';
        } catch { }
        setPlacingAssetId(null);
      }
    };
    container.addEventListener('click', onClick, true);
    window.addEventListener('keydown', onKeyDown, true);
  };

  // Persist asset rows on change (dedicated effect avoids stale saves)
  useEffect(() => {
    save(K.assets(projectId), rows);
  }, [rows, projectId]);

  // Rehydrate overlays from saved rows (after refresh or any change)
  useEffect(() => {
    if (!viewer) return;
    const THREE = (window as any).THREE;
    if (!THREE) return;
    try {
      const overlayName = 'fm-placeholders';
      if (!(viewer as any)._fmOverlayCreated) {
        viewer.impl.createOverlayScene(overlayName);
        (viewer as any)._fmOverlayCreated = true;
      }
      const overlayScenes = (viewer.impl.overlayScenes || {}) as any;
      const scn = overlayScenes[overlayName];
      const scene = scn?.scene;
      if (!scene) return;

      // Lazily init placeholder map on viewer
      const vAny: any = viewer;
      if (!vAny._fmPlaceholderMap) vAny._fmPlaceholderMap = new Map<string, any>();
      const map: Map<string, any> = vAny._fmPlaceholderMap as Map<string, any>;

      // Remove any temporary meshes (no assetId)
      try {
        const toRemove: any[] = [];
        for (const ch of scene.children) {
          if (!ch?.userData || !ch.userData.assetId) toRemove.push(ch);
        }
        toRemove.forEach(m => scene.remove(m));
      } catch { }

      // Build a set of desired IDs
      const desiredIds = new Set<string>();
      rows.forEach(r => {
        if (r.placeholderX != null && r.placeholderY != null && r.placeholderZ != null) {
          desiredIds.add(r.id);
          const size = r.placeholderSize ?? 0.3;
          const shape = (r.placeholderShape || 'cube') as 'cube' | 'sphere';
          let mesh = map.get(r.id);
          if (!mesh) {
            const geom = shape === 'sphere'
              ? new THREE.SphereGeometry(size / 2, 12, 12)
              : new THREE.BoxGeometry(size, size, size);
            const mat = new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.85 });
            mesh = new THREE.Mesh(geom, mat);
            mesh.userData = {
              ...(mesh.userData || {}),
              assetId: r.id,
              geomBaseSize: size,
              shape
            };
            mesh.position.set(r.placeholderX, r.placeholderY, r.placeholderZ);
            scene.add(mesh);
            map.set(r.id, mesh);
          } else {
            // Update shape if changed
            if (mesh.userData?.shape !== shape) {
              try {
                mesh.geometry?.dispose?.();
              } catch {}
              mesh.geometry = shape === 'sphere'
                ? new THREE.SphereGeometry(size / 2, 12, 12)
                : new THREE.BoxGeometry(size, size, size);
              mesh.userData.shape = shape;
              mesh.userData.geomBaseSize = size;
              mesh.scale.set(1, 1, 1);
            }
            // Update position
            const p = mesh.position;
            if (p.x !== r.placeholderX || p.y !== r.placeholderY || p.z !== r.placeholderZ) {
              mesh.position.set(r.placeholderX, r.placeholderY, r.placeholderZ);
            }
            // Update size via scale, relative to base geom size
            const base = Number(mesh.userData?.geomBaseSize) || size || 0.3;
            const scale = (size || 0.3) / base;
            mesh.scale.set(scale, scale, scale);
          }
        }
      });

      // Remove meshes that are no longer present
      for (const [id, mesh] of [...map.entries()]) {
        if (!desiredIds.has(id)) {
          try { scene.remove(mesh); } catch { }
          map.delete(id);
        }
      }

      // Maintain selection highlight if any
      try {
        const vAny2: any = viewer;
        const selId: string | null = vAny2._fmSelectedPlaceholderId || null;
        for (const [id, mesh] of map.entries()) {
          const mat: any = mesh.material;
          if (mat && mat.color) {
            if (selId && selId === id) mat.color.setHex(0x00ffff); else mat.color.setHex(0xffcc00);
            mat.needsUpdate = true;
          }
        }
      } catch { }

      viewer.impl.invalidate(true);
    } catch { }
  }, [viewer, rows]);

  // Enable selecting, dragging (move) and resizing (wheel/keys) of placeholders in the overlay
  useEffect(() => {
    if (!viewer) return;
    const THREE = (window as any).THREE;
    if (!THREE) return;
    const overlayName = 'fm-placeholders';
    const vAny: any = viewer;
    if (!vAny._fmOverlayCreated) return; // wait until created by other effect

    const overlayScenes = (viewer.impl.overlayScenes || {}) as any;
    const scn = overlayScenes[overlayName];
    const scene = scn?.scene;
    if (!scene) return;

    if (!vAny._fmPlaceholderMap) vAny._fmPlaceholderMap = new Map<string, any>();
    const map: Map<string, any> = vAny._fmPlaceholderMap as Map<string, any>;
    const raycaster = new THREE.Raycaster();
    const container = viewer.container as HTMLElement;

    const getIntersections = (clientX: number, clientY: number) => {
      const rect = (viewer.impl.canvas || container).getBoundingClientRect();
      const ndc = {
        x: ((clientX - rect.left) / rect.width) * 2 - 1,
        y: -((clientY - rect.top) / rect.height) * 2 + 1
      };
      // Prefer public API camera when available (Forge returns THREE.Camera)
      const camera = (viewer.getCamera?.() || viewer.impl.camera) as any;
      if (!camera) return [] as any[];

      try {
        const THREE = (window as any).THREE;
        const v = new THREE.Vector3(ndc.x, ndc.y, 0.5);
        let origin: any;
        let dir: any;
        if ((camera as any).isPerspectiveCamera) {
          v.unproject(camera);
          origin = camera.position.clone();
          dir = v.sub(origin).normalize();
        } else if ((camera as any).isOrthographicCamera) {
          // For ortho, origin is the unprojected point on near plane, dir is camera forward
          origin = new THREE.Vector3(ndc.x, ndc.y, -1).unproject(camera);
          dir = camera.getWorldDirection(new THREE.Vector3()).normalize();
        } else {
          // Fallback: try unproject-style ray
          v.unproject(camera);
          origin = camera.position?.clone ? camera.position.clone() : new THREE.Vector3(0, 0, 0);
          dir = v.sub(origin).normalize();
        }
        raycaster.set(origin, dir);
      } catch {
        return [] as any[];
      }
      // Only test against meshes that are placeholders
      const objs = [...map.values()];
      return raycaster.intersectObjects(objs, false) as any[];
    };

    const highlightSelection = (id: string | null) => {
      vAny._fmSelectedPlaceholderId = id || null;
      for (const [mid, mesh] of map.entries()) {
        const mat: any = mesh.material;
        if (mat && mat.color) {
          if (id && id === mid) mat.color.setHex(0x00ffff); else mat.color.setHex(0xffcc00);
          mat.needsUpdate = true;
        }
      }
      viewer.impl.invalidate(true);
    };

    let dragging: null | { id: string; dzPlane: number; cursorOffset?: any } = null;

    const worldOnZ = (clientX: number, clientY: number, z: number) => {
      const rect = (viewer.impl.canvas || container).getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((clientY - rect.top) / rect.height) * 2 + 1;
      const camera = viewer.impl.camera;
      if (!camera) return null;
      const mouse = new THREE.Vector3(x, y, 0.5); mouse.unproject(camera);
      const origin = camera.position.clone();
      const dir = mouse.sub(origin).normalize();
      const EPS = 1e-6;
      if (Math.abs(dir.z) < EPS) return null;
      const t = (z - origin.z) / dir.z;
      if (!isFinite(t) || t < 0) return null;
      return origin.clone().add(dir.multiplyScalar(t));
    };

    const onPointerDown = (ev: MouseEvent) => {
      try {
        const ints = getIntersections(ev.clientX, ev.clientY);
        if (ints && ints.length) {
          ev.stopPropagation();
          ev.preventDefault();
          const hit = ints[0];
          const mesh = hit.object as any;
          const id = mesh?.userData?.assetId as string | undefined;
          if (!id) return;
          highlightSelection(id);
          if (ev.button === 0) {
            // start dragging
            const dz = mesh.position?.z ?? 0;
            const p = hit.point || new THREE.Vector3(mesh.position.x, mesh.position.y, dz);
            const offset = new THREE.Vector3(mesh.position.x - p.x, mesh.position.y - p.y, 0);
            dragging = { id, dzPlane: dz, cursorOffset: offset };
            try { viewer.setNavigationLock?.(true); } catch { }
          }
        }
      } catch { }
    };

    const onPointerMove = (ev: MouseEvent) => {
      if (!dragging) return;
      try {
        ev.stopPropagation();
        ev.preventDefault();
        const id = dragging.id;
        const mesh: any = map.get(id);
        if (!mesh) return;
        // Prefer hitTest against model to stick to surfaces
        const res = viewer.impl.hitTest(ev.clientX, ev.clientY, true);
        let pt = res?.point || worldOnZ(ev.clientX, ev.clientY, dragging.dzPlane);
        if (!pt) return;
        const nx = pt.x + (dragging.cursorOffset?.x || 0);
        const ny = pt.y + (dragging.cursorOffset?.y || 0);
        mesh.position.set(nx, ny, dragging.dzPlane);
        // Persist live to rows
        setRows(prev => prev.map(r => r.id === id ? { ...r, placeholderX: nx, placeholderY: ny, placeholderZ: dragging!.dzPlane } : r));
        viewer.impl.invalidate(true);
      } catch { }
    };

    const onPointerUp = (ev: MouseEvent) => {
      if (!dragging) return;
      ev.stopPropagation();
      ev.preventDefault();
      dragging = null;
      try { viewer.setNavigationLock?.(false); } catch { }
    };

    const adjustSize = (id: string, delta: number) => {
      const mesh: any = map.get(id);
      if (!mesh) return;
      const currentBase = Number(mesh.userData?.geomBaseSize) || (rows.find(r => r.id === id)?.placeholderSize ?? 0.3) || 0.3;
      const currentSize = (rows.find(r => r.id === id)?.placeholderSize ?? currentBase) as number;
      let next = currentSize * (1 + delta);
      next = Math.max(0.05, Math.min(10, next));
      const scale = next / currentBase;
      mesh.scale.set(scale, scale, scale);
      // Persist to rows
      setRows(prev => prev.map(r => r.id === id ? { ...r, placeholderSize: next } : r));
      viewer.impl.invalidate(true);
    };

    const onWheel = (ev: WheelEvent) => {
      const selId: string | null = (vAny._fmSelectedPlaceholderId || null) as string | null;
      if (!selId) return;
      // Resize inversely with deltaY
      ev.stopPropagation();
      ev.preventDefault();
      const delta = -ev.deltaY * 0.001; // small increments
      adjustSize(selId, delta);
    };

    const onKeyDown = (ev: KeyboardEvent) => {
      const selId: string | null = (vAny._fmSelectedPlaceholderId || null) as string | null;
      if (!selId) return;
      if (ev.key === '+' || ev.key === '=' ) { ev.preventDefault(); adjustSize(selId, 0.05); }
      if (ev.key === '-' || ev.key === '_' ) { ev.preventDefault(); adjustSize(selId, -0.05); }
      if (ev.key === 'Escape') { highlightSelection(null); }
    };

    container.addEventListener('mousedown', onPointerDown, true);
    window.addEventListener('mousemove', onPointerMove, true);
    window.addEventListener('mouseup', onPointerUp, true);
    container.addEventListener('wheel', onWheel, { capture: true, passive: false } as any);
    window.addEventListener('keydown', onKeyDown, true);

    return () => {
      container.removeEventListener('mousedown', onPointerDown, true);
      window.removeEventListener('mousemove', onPointerMove, true);
      window.removeEventListener('mouseup', onPointerUp, true);
      container.removeEventListener('wheel', onWheel as any, true as any);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [viewer, rows]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="text-foreground font-semibold text-sm">Asset List</div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] px-2 py-0.5 rounded bg-card border border-border text-muted-foreground">{rows.length} items</span>
          </div>
        </div>

        {/* BIM Asset Extraction */}
        <div className="mb-2 space-y-2">
          <button
            onClick={extractAssetsFromBIM}
            disabled={isExtracting}
            className={`w-full text-xs py-2 px-3 rounded-md font-medium transition ${isExtracting
              ? 'bg-muted text-muted-foreground cursor-not-allowed'
              : 'bg-green-600 hover:bg-green-700 text-foreground'
              }`}
          >
            {isExtracting ? `Extracting... ${extractionProgress.toFixed(0)}%` : 'Extract from BIM'}
          </button>
          {isExtracting && (
            <div className="bg-card rounded-full h-1">
              <div
                className="bg-green-500 h-1 rounded-full transition-all duration-300"
                style={{ width: `${extractionProgress}%` }}
              />
            </div>
          )}
        </div>

        {/* In-memory Edit Asset modal trigger is per-row in Actions column below */}

        {/* Controls: Show/Hide & Filters toggles */}
        <div className="grid grid-cols-2 gap-2">
          <button
            className={`w-full inline-flex items-center justify-center gap-1 text-xs px-2 py-1 rounded border ${fieldsOpen ? 'text-foreground border-border bg-muted' : 'text-muted-foreground border-border bg-card/60 hover:bg-muted'}`}
            onClick={() => { if (fieldsOpen) { setFieldsOpen(false); } else { setFieldsOpen(true); setFiltersOpen(false); } }}
          >
            Show/Hide Fields
          </button>
          <button
            className={`w-full inline-flex items-center justify-center gap-1 text-xs px-2 py-1 rounded border ${filtersOpen ? 'text-foreground border-border bg-muted' : 'text-muted-foreground border-border bg-card/60 hover:bg-muted'}`}
            onClick={() => { if (filtersOpen) { setFiltersOpen(false); } else { setFiltersOpen(true); setFieldsOpen(false); } }}
          >
            Filters
          </button>
        </div>

        {/* Full-width content panels below */}
        {fieldsOpen && (
          <div className="mt-2 p-2 text-xs bg-card/60 rounded border border-border w-full">
            <div className="grid grid-cols-2 gap-2">
              {/* Basic checkbox - always checked and disabled */}
              <label className="flex items-center gap-1 text-muted-foreground cursor-not-allowed opacity-75">
                <input
                  type="checkbox"
                  checked={true}
                  disabled={true}
                  className="w-3 h-3"
                />
                <span>Basic</span>
              </label>
              
              {[
                ['Identification', 'identification'],
                ['Technical', 'technical'],
                ['Documentation', 'documentation'],
                ['Lifecycle', 'lifecycle'],
                ['Maintenance', 'maintenance'],
                ['Economic', 'economic'],
                ['Compliance', 'compliance'],
                ['Relationships', 'relationships']
              ].map(([label, key]) => (
                <label key={key} className="flex items-center gap-1 text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={visibleFields[key as keyof typeof visibleFields]}
                    onChange={() => toggleField(key as keyof typeof visibleFields)}
                    className="w-3 h-3"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {filtersOpen && (
          <div className="mt-2 p-2 bg-card/60 rounded border border-border w-full">
            <div className="grid grid-cols-3 gap-2">
              <select value={filter.category} onChange={e => setFilter(f => ({ ...f, category: e.target.value }))} className="w-full bg-card border border-border rounded px-2 py-1 text-foreground text-xs">
                <option value="">Revit Categories</option>
                {assetCategories.map(cat => {
                  const isMaster = assetCategoryMasterOptions.includes(cat);
                  return (
                    <option key={cat} value={cat}>
                      {cat}{!isMaster ? '' : ''}
                    </option>
                  );
                })}
              </select>
              {/* IFC Class Filter (next to Revit Categories) */}
              <select value={filter.ifcClass} onChange={e => setFilter(f => ({ ...f, ifcClass: e.target.value }))} className="w-full bg-card border border-border rounded px-2 py-1 text-foreground text-xs">
                <option value="">Ifc Class</option>
                {IFCCLASSES_UNIQUE.map(ic => <option key={ic} value={ic}>{ic}</option>)}
              </select>
              <select value={filter.type} onChange={e => setFilter(f => ({ ...f, type: e.target.value }))} className="w-full bg-card border border-border rounded px-2 py-1 text-foreground text-xs">
                <option value="">All Types</option>
                {distinct.types.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
              <select value={filter.location} onChange={e => setFilter(f => ({ ...f, location: e.target.value }))} className="w-full bg-card border border-border rounded px-2 py-1 text-foreground text-xs">
                <option value="">All Locations</option>
                {distinct.locations.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
              <select value={filter.classification} onChange={e => setFilter(f => ({ ...f, classification: e.target.value }))} className="w-full bg-card border border-border rounded px-2 py-1 text-foreground text-xs">
                <option value="">All Classifications</option>
                {distinct.classifications.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
              <button
                onClick={toggleShowSelected}
                className={`w-full text-foreground text-xs py-1 rounded ${filter.selectedOnly ? 'bg-amber-600 hover:bg-amber-700' : 'bg-muted hover:bg-muted'}`}
              >
                Show Selected
              </button>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 w-full">
              <input
                placeholder="Search by category, name, code, brand, model, condition, IFC class, type, source"
                value={filter.search}
                onChange={e => setFilter(f => ({ ...f, search: e.target.value }))}
                className="w-full bg-card border border-border rounded px-2 py-1 text-foreground text-xs"
              />
              <button
                onClick={exportCSV}
                className="w-full bg-muted hover:bg-muted text-foreground text-xs py-1 rounded"
              >
                Export CSV
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-card/90 backdrop-blur border-b border-border text-muted-foreground">
            <tr>
              <th className="px-2 py-1.5 w-8">
                <input
                  type="checkbox"
                  checked={paginatedRows.length > 0 && paginatedRows.every(r => selectedIds.has(r.id))}
                  onChange={toggleSelectAll}
                />
              </th>
              {visibleFields.basic && (
                <>
                  <th className="text-left px-2 py-1.5 cursor-pointer select-none" onClick={() => handleSort('source')}>Source{sortIndicator('source')}</th>
                  <th className="text-left px-2 py-1.5 cursor-pointer select-none" onClick={() => handleSort('category')}>Category{sortIndicator('category')}</th>
                  <th className="text-left px-2 py-1.5 cursor-pointer select-none" onClick={() => handleSort('type')}>Type{sortIndicator('type')}</th>
                  <th className="text-left px-2 py-1.5 cursor-pointer select-none" onClick={() => handleSort('brand')}>Brand{sortIndicator('brand')}</th>
                  <th className="text-left px-2 py-1.5 cursor-pointer select-none" onClick={() => handleSort('model')}>Model{sortIndicator('model')}</th>
                  <th className="text-left px-2 py-1.5 cursor-pointer select-none" onClick={() => handleSort('ifcClass')}>Ifc Class{sortIndicator('ifcClass')}</th>
                </>
              )}
              {visibleFields.identification && (
                <>
                  <th className="text-left px-2 py-1.5 cursor-pointer select-none" onClick={() => handleSort('assetCode')}>Code{sortIndicator('assetCode')}</th>
                  <th className="text-left px-2 py-1.5 cursor-pointer select-none" onClick={() => handleSort('assetName')}>Name{sortIndicator('assetName')}</th>
                  <th className="text-left px-2 py-1.5 cursor-pointer select-none" onClick={() => handleSort('serialNumber')}>Serial{sortIndicator('serialNumber')}</th>
                  <th className="text-left px-2 py-1.5 cursor-pointer select-none" onClick={() => handleSort('installationDate')}>Install Date{sortIndicator('installationDate')}</th>
                </>
              )}
              {visibleFields.technical && (
                <>
                  <th className="text-left px-2 py-1.5 cursor-pointer select-none" onClick={() => handleSort('material')}>Material{sortIndicator('material')}</th>
                  <th className="text-left px-2 py-1.5 cursor-pointer select-none" onClick={() => handleSort('dimensions')}>Dimensions{sortIndicator('dimensions')}</th>
                  <th className="text-left px-2 py-1.5 cursor-pointer select-none" onClick={() => handleSort('capacity')}>Capacity{sortIndicator('capacity')}</th>
                </>
              )}
              {visibleFields.documentation && (
                <>
                  <th className="text-left px-2 py-1.5 cursor-pointer select-none" onClick={() => handleSort('manuals')}>Manuals{sortIndicator('manuals')}</th>
                  <th className="text-left px-2 py-1.5 cursor-pointer select-none" onClick={() => handleSort('warranties')}>Warranties{sortIndicator('warranties')}</th>
                </>
              )}
              {visibleFields.lifecycle && (
                <>
                  <th className="text-left px-2 py-1.5 cursor-pointer select-none" onClick={() => handleSort('condition')}>Condition{sortIndicator('condition')}</th>
                  <th className="text-left px-2 py-1.5 cursor-pointer select-none" onClick={() => handleSort('expectedLife')}>Expected Life{sortIndicator('expectedLife')}</th>
                </>
              )}
              {visibleFields.economic && (
                <>
                  <th className="text-left px-2 py-1.5 cursor-pointer select-none" onClick={() => handleSort('purchaseCost')}>Purchase Cost{sortIndicator('purchaseCost')}</th>
                  <th className="text-left px-2 py-1.5 cursor-pointer select-none" onClick={() => handleSort('maintenanceCost')}>Maintenance Cost{sortIndicator('maintenanceCost')}</th>
                </>
              )}
              {visibleFields.compliance && (
                <>
                  <th className="text-left px-2 py-1.5 cursor-pointer select-none" onClick={() => handleSort('regulations')}>Regulations{sortIndicator('regulations')}</th>
                  <th className="text-left px-2 py-1.5 cursor-pointer select-none" onClick={() => handleSort('safetyNotes')}>Safety{sortIndicator('safetyNotes')}</th>
                </>
              )}
              {visibleFields.relationships && (
                <>
                  <th className="text-left px-2 py-1.5 cursor-pointer select-none" onClick={() => handleSort('suppliers')}>Suppliers{sortIndicator('suppliers')}</th>
                </>
              )}
              <th className="text-left px-2 py-1.5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={20} className="px-3 py-4 text-center text-muted-foreground">
                  {filter.category || filter.type || filter.location || filter.ifcClass || filter.classification
                    ? 'No assets available'
                    : 'No assets. Use "Create new asset".'}
                </td>
              </tr>
            ) : paginatedRows.map(r => (
              <tr key={r.id} className="border-b border-border hover:bg-card/60 cursor-pointer" onClick={() => onRowClick(r)}>
                <td className="px-2 py-1.5 w-8" onClick={e => e.stopPropagation()}>
                  <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSelect(r.id)} />
                </td>
                {visibleFields.basic && (
                  <>
                    <td className="px-2 py-1.5">
                      <span className={`text-xs px-2 py-0.5 rounded ${r.source === 'BIM_MODEL'
                        ? 'bg-green-900/40 text-green-300'
                        : 'bg-blue-900/40 text-blue-300'
                        }`}>
                        {r.source === 'BIM_MODEL' ? 'BIM' : 'Manual'}
                      </span>
                      {r.conflictWithId && <span className="ml-2 text-[10px] text-red-300">⚠ Conflict</span>}
                    </td>
                    <td className="px-2 py-1.5 text-foreground">{stripRevitPrefix(r.category) || '-'}</td>
                    <td className="px-2 py-1.5 text-foreground">{r.type || '-'}</td>
                    <td className="px-2 py-1.5 text-foreground">{r.brand || '-'}</td>
                    <td className="px-2 py-1.5 text-foreground">{r.model || '-'}</td>
                    <td className="px-2 py-1.5 text-foreground">{r.ifcClass || 'Unknown'}</td>
                  </>
                )}
                {visibleFields.identification && (
                  <>
                    <td className="px-2 py-1.5 text-foreground">{r.assetCode || '-'}</td>
                    <td className="px-2 py-1.5 text-foreground">{r.assetName || '-'}</td>
                    <td className="px-2 py-1.5 text-foreground">{r.serialNumber || '-'}</td>
                    <td className="px-2 py-1.5 text-foreground">{r.installationDate || '-'}</td>
                  </>
                )}
                {visibleFields.technical && (
                  <>
                    <td className="px-2 py-1.5 text-foreground">{r.material || '-'}</td>
                    <td className="px-2 py-1.5 text-foreground">{r.dimensions || '-'}</td>
                    <td className="px-2 py-1.5 text-foreground">{r.capacity || '-'}</td>
                  </>
                )}
                {visibleFields.documentation && (
                  <>
                    <td className="px-2 py-1.5 text-foreground">
                      {r.manuals ? (
                        <div className="flex flex-wrap gap-1">
                          {r.manuals.split(', ').map((fileName, idx) => (
                            <button
                              key={idx}
                              onClick={(e) => { 
                                e.stopPropagation();
                                const openFile = async () => {
                                  try {
                                    const response = await fetch(`/api/projects/${projectId}/files/by-name?fileName=${encodeURIComponent(fileName)}`);
                                    if (response.ok) {
                                      const fileRecord = await response.json();
                                      setPdfModal({ open: true, fileId: fileRecord._id || fileRecord.fileId, fileName: fileName });
                                    } else {
                                      showToast('error', `File "${fileName}" not found`);
                                    }
                                  } catch (err) {
                                    console.error('Error opening file:', err);
                                    showToast('error', 'Failed to open file');
                                  }
                                };
                                openFile();
                              }}
                              className="text-blue-400 hover:text-blue-300 underline text-xs break-all"
                              title={`Open ${fileName}`}
                            >
                              {fileName}
                            </button>
                          ))}
                        </div>
                      ) : '-'}
                    </td>
                    <td className="px-2 py-1.5 text-foreground">{r.warranties || '-'}</td>
                  </>
                )}
                {visibleFields.lifecycle && (
                  <>
                    <td className="px-2 py-1.5 text-foreground">{r.condition || '-'}</td>
                    <td className="px-2 py-1.5 text-foreground">{r.expectedLife || '-'}</td>
                  </>
                )}
                {visibleFields.economic && (
                  <>
                    <td className="px-2 py-1.5 text-foreground">{r.purchaseCost || '-'}</td>
                    <td className="px-2 py-1.5 text-foreground">{r.maintenanceCost || '-'}</td>
                  </>
                )}
                {visibleFields.compliance && (
                  <>
                    <td className="px-2 py-1.5 text-foreground">{r.regulations || '-'}</td>
                    <td className="px-2 py-1.5 text-foreground">{r.safetyNotes || '-'}</td>
                  </>
                )}
                {visibleFields.relationships && (
                  <>
                    <td className="px-2 py-1.5 text-foreground">{r.suppliers || '-'}</td>
                  </>
                )}
                <td className="px-2 py-1.5">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); openEditAsset(r); }}
                      title="Edit Asset"
                      className="inline-flex items-center justify-center h-6 px-2 rounded border text-[11px] bg-amber-100 border-amber-400 text-amber-900 hover:bg-amber-200 dark:bg-amber-800/30 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-800/50"
                    >Edit</button>
                    {r.source === 'MANUAL' && (
                      <>
                      <select
                        value={r.placeholderShape || 'cube'}
                        onClick={e => e.stopPropagation()}
                        onChange={e => { 
                          e.stopPropagation(); 
                          const val = e.target.value as 'cube' | 'sphere'; 
                          const updated = { ...r, placeholderShape: val };
                          setRows(prev => prev.map(x => x.id === r.id ? updated : x)); 
                          saveAssetToBackend(updated);
                        }}
                        className="bg-card border border-border rounded px-1 py-0.5 text-[11px] text-foreground"
                      >
                        <option value="cube">Cube</option>
                        <option value="sphere">Sphere</option>
                      </select>
                      <AssetSizeInput
                        value={r.placeholderSize}
                        onChange={n => { 
                          const updated = { ...r, placeholderSize: n };
                          setRows(prev => prev.map(x => x.id === r.id ? updated : x)); 
                          saveAssetToBackend(updated);
                        }}
                      />
                      <button
                        onClick={(e) => { e.stopPropagation(); placeManual(r); }}
                        disabled={placingAssetId === r.id}
                        className={`text-xs text-foreground px-2 py-0.5 rounded ${placingAssetId === r.id ? 'bg-muted cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'}`}
                      >
                        {placingAssetId === r.id ? 'Placing…' : (r.placeholderX == null ? 'Place' : 'Re-place')}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); confirmDelete(r); }}
                        title="Delete"
                        className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded border text-[12px] font-bold bg-red-900/30 border-red-700 text-red-300 hover:bg-red-800/40"
                      >
                        ×
                      </button>
                      </>
                    )}
                    {r.conflictWithId && (
                      <button onClick={(e) => { e.stopPropagation(); openConflictResolver(r); }} className="ml-2 text-[10px] text-red-300 underline">Resolve</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Conflict Resolution Modal */}
      {conflictModal.open && (
        <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded p-3 resize overflow-auto" style={{ width: '320px', minWidth: '280px', minHeight: '200px' }}>
            <div className="text-foreground text-sm font-semibold mb-2">Resolve Conflict</div>
            <div className="text-xs text-muted-foreground mb-2">Choose how to resolve the BIM vs Manual conflict.</div>
            <div className="grid grid-cols-1 gap-2">
              <button className="bg-emerald-700 hover:bg-emerald-600 text-foreground text-xs py-1 rounded" onClick={resolveLink}>Link (keep both)</button>
              <button className="bg-blue-700 hover:bg-blue-600 text-foreground text-xs py-1 rounded" onClick={resolveMerge}>Merge into Manual (hide BIM)</button>
              <button className="bg-muted hover:bg-muted text-foreground text-xs py-1 rounded" onClick={resolveKeepBoth}>Keep both (dismiss)</button>
              <button className="bg-red-800 hover:bg-red-700 text-foreground text-xs py-1 rounded" onClick={() => setConflictModal({ open: false })}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-[1000]">
          <div className={`px-3 py-2 rounded text-xs shadow border ${toast.type === 'success' ? 'bg-emerald-800/80 text-emerald-100 border-emerald-700' :
            toast.type === 'error' ? 'bg-red-800/80 text-red-100 border-red-700' :
              'bg-card/80 text-foreground border-border'
            }`}>
            {toast.text}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal.open && (
        <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-[1001]" onClick={() => setDeleteModal({ open: false })}>
          <div className="bg-card border border-border rounded p-3 w-[320px]" onClick={e => e.stopPropagation()}>
            <div className="text-foreground text-sm font-semibold mb-2">Delete asset?</div>
            <div className="text-xs text-muted-foreground mb-3">Are you sure you want to permanently delete <span className="text-red-300">{deleteModal.label}</span>?</div>
            <div className="flex items-center justify-end gap-2">
              <button className="px-3 py-1.5 rounded text-xs bg-muted hover:bg-muted text-foreground" onClick={() => setDeleteModal({ open: false })}>Cancel</button>
              <button className="px-3 py-1.5 rounded text-xs bg-red-700 hover:bg-red-600 text-foreground" onClick={performDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Asset Modal - reuse CreateAsset UI so the edit dialog is identical to create */}
      {editModal.open && (
        <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-[1001]" onClick={() => { setEditModal({ open: false }); setEditQueue([]); setEditIndex(0); setBulkEditMode(false); setBulkEditIds([]); setBulkCategoryLabel(''); }}>
          <div className="bg-card border border-border rounded p-3 w-[1100px] max-w-[98vw] max-h-[90vh] overflow-auto resize" style={{ minWidth: '640px', minHeight: '420px', resize: 'both' }} onClick={e => e.stopPropagation()}>
            <CreateAsset
              projectId={projectId}
              viewer={viewer}
              title={bulkEditMode ? `Bulk Edit ${bulkEditIds.length} Assets${bulkCategoryLabel ? ` — ${bulkCategoryLabel}` : ''}` : `Edit Asset${editQueue.length > 1 ? ` (${editIndex+1}/${editQueue.length})` : ''}`}
              initial={edit}
              mode="edit"
              bulkEditMode={bulkEditMode}
              onSaveOverride={async (rec) => {
                try {
                  if (bulkEditMode) {
                    // BULK EDIT: Apply changes to all selected assets
                    console.log('📋 [Bulk Edit Override] Starting bulk edit for', bulkEditIds.length, 'assets');
                    console.log('📋 [Bulk Edit Override] Received form data:', rec);
                    
                    // Determine which fields the user actually intended to change.
                    // CreateAsset now passes a `__touched` array when called via onSaveOverride.
                    const touchedKeys = (rec as any).__touched as string[] | undefined;
                    const forbiddenFields = ['assetCode', 'assetName', 'id', 'dbId', 'source', 'elementId', 'ifcGuid'];

                    let filledFields: Partial<AssetRecord> = {};
                    if (Array.isArray(touchedKeys) && touchedKeys.length > 0) {
                      // Respect explicit user interaction even if field value is empty string (clearing a value)
                      touchedKeys.forEach(k => {
                        if (forbiddenFields.includes(k)) return;
                        if ((rec as any).hasOwnProperty(k)) (filledFields as any)[k] = (rec as any)[k];
                      });
                    } else {
                      // Fallback: use non-empty values (legacy behavior)
                      filledFields = Object.entries(rec)
                        .filter(([_key, value]) => value !== '' && value !== undefined && value !== null)
                        .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {} as Partial<AssetRecord>);
                      forbiddenFields.forEach(f => delete (filledFields as any)[f]);
                    }
                    // Defensive: ensure __touched not included
                    delete (filledFields as any)['__touched'];
                    
                    console.log('📋 [Bulk Edit Override] Filled fields to apply:', filledFields);
                    
                    console.log('📋 [Bulk Edit Override] Final fields to apply (forbidden removed):', filledFields);
                    console.log('📋 [Bulk Edit Override] Target IDs:', bulkEditIds);
                    
                    setRows(prev => {
                      let next = prev.map(r => 
                        bulkEditIds.includes(r.id) 
                          ? { ...r, ...filledFields, userEdited: true } 
                          : r
                      );
                      console.log('📋 [Bulk Edit Override] Updated rows in state');
                      
                      // Save to localStorage immediately to ensure we don't save empty array
                      try {
                        const key = K.assets(projectId);
                        save(key, next);
                        console.log('💾 [Bulk Edit Override] Saved to localStorage');
                      } catch {}
                      
                      return next;
                    });
                    
                    // Persist to backend for each asset
                    try {
                      await Promise.allSettled(
                        bulkEditIds.map(id => persistEditToBackend(id, filledFields))
                      );
                    } catch {}
                    
                    try { window.dispatchEvent(new CustomEvent('asset-updated', { detail: { projectId } })); } catch {}
                    showToast('success', `Bulk edit applied to ${bulkEditIds.length} assets`);
                    
                    // Close modal and reset bulk edit mode
                    setEditModal({ open: false });
                    setBulkEditMode(false);
                    setBulkEditIds([]);
                    setSelectedIds(new Set());
                  } else {
                    // SINGLE EDIT (original sequential logic)
                    console.log('�🔧 [Edit Override] Starting save for asset:', editModal.id);
                    console.log('🔧 [Edit Override] Received form data:', rec);
                    
                    const id = editModal.id;
                    if (!id) { setEditModal({ open: false }); return; }
                    try {
                      // Use 'rec' (the form data passed from CreateAsset) instead of 'edit' (stale state)
                      const fields = pickEditable(rec);
                      // Keep the asset source as-is (BIM stays BIM, Manual stays Manual)
                      // userEdited flag ensures changes persist across merges
                      const current = rows.find(r => r.id === id);
                      const oldConflict = current?.conflictWithId;
                      // Clear conflicts but don't convert source
                      const mergedFields = { ...fields, conflictWithId: undefined } as Partial<AssetRecord>;

                      setRows(prev => {
                        // First update this record
                        let next = prev.map(r => r.id === id ? { ...r, ...mergedFields, userEdited: true } : r);
                        // Clear conflicts on any counterpart that pointed to this id; hide and link counterparts to this edited record
                        next = next.map(r => {
                          if (r.id !== id && (r.conflictWithId === id || (oldConflict && r.id === oldConflict))) {
                            return { ...r, conflictWithId: undefined, hidden: true, linkedAssetId: id };
                          }
                          return r;
                        });
                        return next;
                      });
                      showToast('success', 'Asset updated');
                      // Persist to local immediately (handled by rows effect) and try backend
                      await persistEditToBackend(id, mergedFields);
                      // Persist any BIM counterparts we modified locally (hidden/link + clear conflict)
                      try {
                        const counterparts = rows.filter(r => r.id !== id && (r.conflictWithId === id || (oldConflict && r.id === oldConflict)));
                        await Promise.allSettled(counterparts.map(c => {
                          const upd: Partial<AssetRecord> = { conflictWithId: undefined, hidden: true, linkedAssetId: id } as any;
                          return persistEditToBackend(c.id, upd);
                        }));
                      } catch {}
                      // Also persist counterpart conflict cleanup to localStorage
                      try {
                        const key = K.assets(projectId);
                        const currentLs = load(key, [] as AssetRecord[]);
                        const updated = currentLs.map(r => {
                          if (r.id === id) return { ...r, ...mergedFields, userEdited: true };
                          if (r.conflictWithId === id || (oldConflict && r.id === oldConflict)) {
                            return { ...r, conflictWithId: undefined, hidden: true, linkedAssetId: id } as any;
                          }
                          return r;
                        });
                        save(key, updated);
                      } catch {}
                    } catch (e) {
                      showToast('error', 'Failed to update asset');
                    } finally {
                      setEditModal({ open: false });
                    }
                  }
                } catch (err) {
                  console.error('[EditModal] onSaveOverride error', err);
                  showToast('error', 'Failed to update asset' + (bulkEditMode ? 's' : ''));
                  throw err;
                }
              }}
            />
          </div>
        </div>
      )}

      {/* Bottom Action Bar: Edit Selected (sequential) and Schedule Maintenance */}
      {selectedIds.size > 0 && (
        <div className="px-2 py-1.5 border-t border-border flex justify-end gap-2">
          <button
            onClick={startSequentialEdit}
            className="text-[11px] py-1 px-2 rounded border border-amber-400 bg-amber-100 hover:bg-amber-200 text-amber-900 dark:border-amber-500 dark:bg-amber-600/20 dark:hover:bg-amber-600/40 dark:text-amber-200 transition"
            title="Edit selected assets one by one"
          >
            Edit Selected ({selectedIds.size})
          </button>
          {onScheduleMaintenance && (
            <button
              onClick={() => {
                const selectedAssets = rows.filter(r => selectedIds.has(r.id));
                onScheduleMaintenance(selectedAssets);
              }}
              className="text-[11px] py-1 px-2 rounded border border-blue-500 bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 transition"
            >
              Schedule Maintenance ({selectedIds.size})
            </button>
          )}
        </div>
      )}

      {/* Bottom Pagination Controls */}
      <div className="flex items-center justify-between px-2 py-2 text-[11px] text-muted-foreground gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="whitespace-nowrap">Rows:</span>
          <select
            value={pageSize}
            onChange={e => setPageSize(parseInt(e.target.value, 10))}
            className="h-6 bg-card/80 border border-border rounded px-2 text-[11px] focus:outline-none focus:border-border"
          >
            {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="flex-1 text-center text-muted-foreground truncate">
          {filteredRows.length === 0 ? '0' : `${startIndex + 1}-${Math.min(endIndex, filteredRows.length)}`} of {filteredRows.length}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={pageClamped <= 1}
            className={`h-6 w-6 grid place-items-center rounded border ${pageClamped <= 1 ? 'text-muted-foreground border-border' : 'text-foreground border-border hover:bg-muted'}`}
            aria-label="Previous page"
          >
            &#8249;
          </button>
          <span className="mx-1 whitespace-nowrap">{pageClamped}/{totalPages}</span>
          <div className="mx-2 flex items-center gap-1">
            <input
              type="number"
              min={1}
              max={totalPages}
              value={jumpPage}
              onChange={e => setJumpPage(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const n = Math.max(1, Math.min(totalPages, Number(e.currentTarget.value || 1)));
                  setPage(n);
                  setJumpPage('');
                }
              }}
              placeholder="#"
              className="w-12 h-6 text-xs bg-card border border-border rounded px-1 text-foreground"
            />
            <button
              onClick={() => {
                const n = Math.max(1, Math.min(totalPages, Number(jumpPage || pageClamped)));
                setPage(n);
                setJumpPage('');
              }}
              className="h-6 px-2 rounded bg-muted hover:bg-muted text-foreground text-xs"
            >Go</button>
          </div>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={pageClamped >= totalPages}
            className={`h-6 w-6 grid place-items-center rounded border ${pageClamped >= totalPages ? 'text-muted-foreground border-border' : 'text-foreground border-border hover:bg-muted'}`}
            aria-label="Next page"
          >
            &#8250;
          </button>
        </div>
      </div>

      {/* PDF Viewer Modal */}
      {pdfModal.open && pdfModal.fileId && projectId && (
        <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-[1002]" onClick={() => setPdfModal({ open: false })}>
          <div className="bg-card border border-border rounded w-[95vw] h-[95vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex-1 overflow-hidden">
              <PdfViewer
                projectId={projectId}
                fileId={pdfModal.fileId}
                fileName={pdfModal.fileName}
                onClose={() => setPdfModal({ open: false })}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const CreateAsset: React.FC<{ projectId?: string; viewer?: any; title?: string; initial?: Partial<AssetRecord>; onSaveOverride?: (asset: AssetRecord) => Promise<void>; mode?: 'create'|'edit'; bulkEditMode?: boolean }> = ({ projectId, viewer, title, initial, onSaveOverride, mode = 'create', bulkEditMode = false }) => {
  // A clean empty form used when entering bulk edit or resetting edit mode
  const EMPTY_FORM: Partial<AssetRecord> = {
    category: '', type: '', brand: '', model: '', description: '', location: '',
    assetCode: '', assetName: '', serialNumber: '', installationDate: '',
    material: '', dimensions: '', weight: '', capacity: '', powerRating: '',
    manuals: '', warranties: '', certifications: '',
    condition: '', serviceDate: '', expectedLife: '',
    maintenanceSchedule: '', lastService: '', nextService: '',
    purchaseCost: '', maintenanceCost: '',
    regulations: '', safetyNotes: '',
    parentAsset: '', suppliers: '',
    // identification fields that might exist
    elementId: undefined as any,
    dbId: undefined as any,
  };
  const [rows, setRows] = useState<AssetRecord[]>(() => load(K.assets(projectId), [] as AssetRecord[]));
  const [activeSection, setActiveSection] = useState<'identification' | 'technical' | 'documentation' | 'lifecycle' | 'maintenance' | 'economic' | 'compliance' | 'relationships' | 'qr'>('identification');
  const [f, setF] = useState<Partial<AssetRecord>>(() => {
    // Load from localStorage on init
    const saved = load(`fm-create-asset-draft-${projectId || 'global'}`, {});
    return {
      ...EMPTY_FORM,
      ...saved,
      ...(initial || {})
    };
  });

  // Track which fields the user actually touched/modified in the form.
  // This is important for bulk-edit: an empty string can mean "user cleared this field",
  // whereas absence of touch means "don't change this field".
  const [touched, setTouched] = useState<Set<string>>(() => new Set());

  // If `mode`/`bulkEditMode`/`initial` change, keep form in correct state
  useEffect(() => {
    if (mode === 'edit') {
      if (bulkEditMode) {
        // Bulk edit should start from aggregated initial values passed by parent
        setF({ ...EMPTY_FORM, ...(initial as Partial<AssetRecord> || {}) });
        setTouched(new Set());
      } else if (initial) {
        // Single edit should reflect the asset being edited (hard reset rather than merge)
        setF({ ...EMPTY_FORM, ...(initial as Partial<AssetRecord>) });
        setTouched(new Set());
      }
    }
  }, [mode, bulkEditMode, initial]);


  // Auto-save draft to localStorage on every field change (only in create mode)
  useEffect(() => {
    if (mode === 'create' && !bulkEditMode) {
      save(`fm-create-asset-draft-${projectId || 'global'}`, f);
    }
  }, [f, projectId, mode, bulkEditMode]);

  useEffect(() => save(K.assets(projectId), rows), [rows, projectId]);

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const onSave = async () => {
    console.log('💾 [CreateAsset onSave] Starting save...');
    console.log('💾 [CreateAsset onSave] mode:', mode);
    console.log('💾 [CreateAsset onSave] onSaveOverride exists:', !!onSaveOverride);
    console.log('💾 [CreateAsset onSave] Form data (f):', f);
    console.log('💾 [CreateAsset onSave] bulkEditMode:', bulkEditMode);
    
    // Validate required fields - but NOT for bulk edit (in bulk edit, empty fields mean "don't change")
    if (!bulkEditMode && !f.assetName && !f.brand && !f.model) {
      setSaveError('Please provide at least Asset Name, Brand, or Model');
      setTimeout(() => setSaveError(null), 3000);
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      // If caller provided an override handler (edit mode), use it and skip default upsert
      // In edit mode, pass ONLY the editable fields, not a new asset record
      if (onSaveOverride) {
        console.log('✅ [CreateAsset onSave] EDIT MODE - calling onSaveOverride');
        console.log('✅ [CreateAsset onSave] Passing form fields:', f);
        try {
          // Pass just the form fields along with touched metadata - the override handler will merge with existing asset
          const payload = { ...(f as AssetRecord), __touched: Array.from(touched) } as any;
          await onSaveOverride(payload);
          console.log('✅ [CreateAsset onSave] onSaveOverride completed successfully');
          setSaveSuccess(true);
          setTimeout(() => setSaveSuccess(false), 1800);
          setIsSaving(false);
          // Clear touched after a successful save so subsequent bulk edits start fresh
          setTouched(new Set());
          return;
        } catch (err) {
          console.error('[CreateAsset] onSaveOverride failed', err);
          setSaveError('Failed to save asset via override');
          setTimeout(() => setSaveError(null), 3000);
          setIsSaving(false);
          return;
        }
      }

      // CREATE MODE: Build a new asset record
      console.log('🆕 [CreateAsset onSave] CREATE MODE - building new MANUAL asset');
      const rec: AssetRecord = {
        ...f as AssetRecord,
        id: `asset-${Date.now()}`,
        dbId: null,
        source: 'MANUAL',
        // Condition must be explicitly selected - no default fallback
        condition: f.condition || undefined
      };

      console.log('🔍 [CreateAsset] Form data being saved:', f);
      console.log('🔍 [CreateAsset] Asset record being created:', rec);

      // Safety: if in edit mode but no override provided, do NOT create a new asset
      if (mode === 'edit' && !onSaveOverride) {
        console.warn('[CreateAsset] Edit mode without onSaveOverride - blocking create to avoid duplicates');
        setSaveError('Cannot save edit at the moment. Please retry.');
        setTimeout(() => setSaveError(null), 3000);
        setIsSaving(false);
        return;
      }

      // Save to backend if projectId is available
      if (projectId) {
        console.log(`💾 [CreateAsset] Saving asset to backend for project: ${projectId}`, rec);
        try {
          const res = await fetch(`/api/projects/${projectId}/assets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(rec)
          });

          if (res.ok) {
            const result = await res.json();
            console.log('✅ [CreateAsset] Asset saved to backend successfully:', result);

            // Merge backend response with original record to preserve all form data
            const backendAsset = result?.asset || result || {};
            const savedAsset = {
              ...rec, // Keep all form data
              ...backendAsset, // Override with backend fields (id, timestamps, etc.)
              id: backendAsset.id || backendAsset._id || rec.id // Ensure we have an ID
            };

            console.log('🔄 [CreateAsset] Merged asset for display:', savedAsset);

            setRows(prev => [savedAsset, ...prev]);

            // Also update localStorage to sync with AssetList
            const currentAssets = load(K.assets(projectId), [] as AssetRecord[]);
            const updatedAssets = [savedAsset, ...currentAssets.filter(a => a.id !== savedAsset.id)];
            save(K.assets(projectId), updatedAssets);

            // Show success message
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);

            // Dispatch custom event to notify AssetList
            window.dispatchEvent(new CustomEvent('asset-created'));
          } else {
            const errorText = await res.text();
            console.error('❌ [CreateAsset] Backend save failed:', res.status, errorText);
            throw new Error(`Save failed: ${res.status}`);
          }
        } catch (backendError) {
          console.error('❌ [CreateAsset] Backend error, falling back to local storage:', backendError);
          // Fallback to local storage
          setRows(prev => [rec, ...prev]);

          // Update localStorage to sync with AssetList
          const currentAssets = load(K.assets(projectId), [] as AssetRecord[]);
          const updatedAssets = [rec, ...currentAssets.filter(a => a.id !== rec.id)];
          save(K.assets(projectId), updatedAssets);

          setSaveError('Saved locally (backend unavailable)');
          setTimeout(() => setSaveError(null), 3000);

          // Dispatch custom event to notify AssetList
          window.dispatchEvent(new CustomEvent('asset-created'));
        }
      } else {
        // No projectId, save locally only
        console.log('💾 [CreateAsset] No projectId, saving locally only', rec);
        setRows(prev => [rec, ...prev]);

        // Update localStorage to sync with AssetList
        const currentAssets = load(K.assets(projectId), [] as AssetRecord[]);
        const updatedAssets = [rec, ...currentAssets.filter(a => a.id !== rec.id)];
        save(K.assets(projectId), updatedAssets);

        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);

        // Dispatch custom event to notify AssetList
        window.dispatchEvent(new CustomEvent('asset-created'));
      }

      // Clear draft after successful save
      const emptyForm = {
        category: '', type: '', brand: '', model: '', description: '', location: '',
        assetCode: '', assetName: '', serialNumber: '', installationDate: '', elementId: '', ifcGuid: '', ifcClass: '',
        material: '', dimensions: '', weight: '', capacity: '', powerRating: '',
        manuals: '', warranties: '', certifications: '',
        condition: '', serviceDate: '', expectedLife: '',
        maintenanceSchedule: '', lastService: '', nextService: '',
        purchaseCost: '', maintenanceCost: '',
        regulations: '', safetyNotes: '',
        parentAsset: '', suppliers: ''
      };
      setF(emptyForm);
      save(`fm-create-asset-draft-${projectId || 'global'}`, emptyForm);

    } catch (error) {
      console.error('❌ [CreateAsset] Save error:', error);
      setSaveError('Failed to save asset. Please try again.');
      setTimeout(() => setSaveError(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const sections = [
    { key: 'identification' as const, label: 'Identification & Registry' },
    { key: 'technical' as const, label: 'Technical & Construction' },
    { key: 'documentation' as const, label: 'Documentation' },
    { key: 'lifecycle' as const, label: 'Status & Lifecycle' },
    { key: 'economic' as const, label: 'Economic Aspects' },
    { key: 'compliance' as const, label: 'Compliance & Safety' },
    { key: 'relationships' as const, label: 'Links & Relationships' },
    { key: 'qr' as const, label: f.qrCode ? 'View QR Code' : 'Create QR Code' }
  ];

  const updateField = (key: keyof AssetRecord, value: any) => {
    setF(v => ({ ...v, [key]: value }));
    setTouched(s => {
      const next = new Set(Array.from(s));
      next.add(String(key));
      return next;
    });
  };

  // Use Revit categories from REVIT_CATEGORIES (same as Asset List filter dropdown)
  const categoryOptions: string[] = React.useMemo(() => {
    return REVIT_CATEGORIES;
  }, []);

  const mapToStandardCategory = (category?: string): string | undefined => {
    if (!category) return undefined;
    // Strip 'Revit' prefix if present
    const stripped = stripRevitPrefix(category);
    if (!stripped) return category;
    
    // Try to find exact match in REVIT_CATEGORIES (case-insensitive)
    const cat = stripped.toLowerCase();
    const match = REVIT_CATEGORIES.find(rc => rc.toLowerCase() === cat);
    if (match) return match;
    
    // Try partial match
    const partialMatch = REVIT_CATEGORIES.find(rc => rc.toLowerCase().includes(cat) || cat.includes(rc.toLowerCase()));
    return partialMatch || category;
  };

  const qrImageUrl = (code?: string, size = 400) => {
    if (!code) return '';
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(code)}`;
  };

  // Helper to get the full QR payload (URL) for display/export
  const getQrPayload = () => {
    const code = (f as any).qrCode as string | undefined;
    if (!code) return undefined;
    
    const baseUrl = window.location.origin;
    const sectionParam = encodeURIComponent(JSON.stringify({ group: 'assets', item: 'asset-list' }));
    const assetId = (f as any).id;
    
    // If we have an asset ID, generate the full URL. Otherwise fallback to just the code.
    // Note: f.id is now explicitly passed from openEditAsset
    return assetId 
      ? `${baseUrl}/fm-standalone?projectId=${projectId || ''}&section=${sectionParam}&assetId=${assetId}`
      : code;
  };

  const generateQr = async () => {
    if ((f as any).qrCode) return; // already generated
    try {
      const code = (typeof crypto !== 'undefined' && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : `qr-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
      const generatedAt = new Date().toISOString();
      setF(v => ({ ...v, qrCode: code as any, qrGeneratedAt: generatedAt as any }));
      // Persist immediately in edit mode so QR is permanent without requiring manual Save
      try {
        if (mode === 'edit' && onSaveOverride) {
          await onSaveOverride({ qrCode: code as any, qrGeneratedAt: generatedAt as any } as AssetRecord);
        }
      } catch (persistErr) {
        console.warn('⚠️ [CreateAsset] Failed to persist QR immediately', persistErr);
      }
    } catch (e) {
      console.error('❌ [AssetList] generateQr error', e);
    }
  };

  const exportQrPdf = () => {
    const code = (f as any).qrCode as string | undefined;
    if (!code) return;
    
    const qrData = getQrPayload() || code;

    const url = qrImageUrl(qrData, 800);
    const title = (f.assetName || 'asset-qr');
    const w = window.open('', '_blank') as Window | null;
    if (!w) return;
    const html = `<!doctype html><html><head><title>${title}</title><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body style="display:flex;flex-direction:column;align-items:center;justify-content:center;margin:0;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#111;background:#fff;">` +
      `<h3 style="margin-bottom:8px;">${title}</h3>` +
      `<img src="${url}" style="width:360px;height:360px;object-fit:contain;border:1px solid #ddd;padding:8px;background:#fff;"/>` +
      `<div style="margin-top:12px;font-size:12px;color:#444;">QR: ${code}</div>` +
      `<div style="margin-top:4px;font-size:10px;color:#888;">Scan to edit asset</div>` +
      `</body></html>`;
    w.document.open();
    w.document.write(html);
    w.document.close();
    setTimeout(() => { try { w.print(); } catch {} }, 500);
  };

  // Prefill from current model selection
  const prefillFromSelection = async () => {
    try {
      if (!viewer) {
        // Fallback: prefill from stored context when viewer is not available (standalone window)
        try {
          const raw = projectId ? localStorage.getItem(`fm-prefill-${projectId}`) : null;
          const snap = JSON.parse(raw || '{}') as Partial<AssetRecord>;
          setF(v => ({ ...v, ...snap }));
          return;
        } catch {}
        return;
      }
      const getAgg = () => new Promise<any>((resolve) => viewer.getAggregateSelection ? viewer.getAggregateSelection(resolve) : resolve(null));
      let dbId: number | undefined; let model: any = viewer.model;
      const agg = await getAgg();
      if (agg && agg.length > 0 && agg[0].selection?.length > 0) { dbId = agg[0].selection[0]; model = agg[0].model; }
      else { const sel = viewer.getSelection?.(); if (sel && sel.length > 0) dbId = sel[0]; }
      if (dbId == null || !model) return;
      const props: any = await new Promise(resolve => model.getProperties(dbId!, resolve));
      const propArray: any[] = Array.isArray(props?.properties) ? props.properties : [];

      // Flatten properties for easier multilingual lookups
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

      // Accept a broad set of property display names (English + Italian + common variants)
      const PROP_ALIASES: Record<string, string[]> = {
        brand: ['Manufacturer', 'Brand', 'Manufacturer Name', 'Produttore', 'Marca'],
        modelName: ['Model', 'Modello'],
        serial: ['Serial Number', 'Serial', 'Numero di serie'],
        elementId: ['ElementId', 'Element Id', 'ElementId', 'ID'],
        ifcGuid: ['IfcGUID', 'IFC GUID', 'IFC GlobalId', 'GlobalId'],
        ifcClass: ['IfcClass', 'IFC Class', 'Classe IFC', 'Esporta tipo in formato IFC con nome', 'Tipo: Tipo predefinito IFC'],
        installDate: ['Install Date', 'Installation Date', 'Data di installazione'],
        power: ['Power', 'Power Rating', 'kW', 'Dati elettrici', 'Alimentazione apparente'],
        capacity: ['Capacity', 'Capacità'],
        weight: ['Weight', 'Peso'],
        length: ['Length', 'Lunghezza'],
        width: ['Width', 'Larghezza'],
        height: ['Height', 'Thickness', 'Altezza'],
        material: ['Material', 'Structural Material', 'Materiale', 'Materiale strutturale'],
        level: [
          'Schedule Level', 'Livello abaco',
          'Base Level', 'Reference Level',
          'Livello di base', 'Livello superiore',
          'Vincolo di base', 'Vincolo parte superiore',
          'Base Constraint', 'Top Constraint', 'Constraint', 'Vincolo',
          'Livello', 'Level', 'Piano', 'Piano Terra', 'Level 1'
        ],
        room: ['Room', 'Space', 'Stanza', 'Locale', 'Space Code'],
        rawCategory: ['Category', 'Categoria', 'Type', 'Tipo', 'Nome del tipo', 'Category Name']
      };

      const pickAlias = (key: keyof typeof PROP_ALIASES) => pick(...PROP_ALIASES[key]);

      const brand = pickAlias('brand') || 'Unknown';
      const modelName = pickAlias('modelName') || 'Unknown';
      const serial = pickAlias('serial');
      const elementId = pickAlias('elementId');
      const ifcGuid = pickAlias('ifcGuid');
      const ifcClass = pickAlias('ifcClass');
      const installDate = pickAlias('installDate');
      const power = pickAlias('power');
      const capacity = pickAlias('capacity');
      const weight = pickAlias('weight');
      const length = pickAlias('length');
      const width = pickAlias('width');
      const height = pickAlias('height');
      const material = pickAlias('material');
      // Level needs to fall back to raw pick directly (prefers descriptive fields)
      const level = pickAlias('level');
      const room = pickAlias('room');
      const rawCategory = pickAlias('rawCategory') || pick('Category', 'Categoria', 'OmniClass Title', 'OmniClass', 'Tipo');
      const category = mapToStandardCategory(rawCategory);
      const dimensions = (length || width || height) ? `${length || ''} x ${width || ''} x ${height || ''}`.replace(/\s+x\s+x\s+/, '').trim() : undefined;

      setF(v => ({
        ...v,
        // Replace with new selection data (clear fields if not present in new selection)
        brand: brand,
        model: modelName,
        serialNumber: serial || '',
        elementId: elementId || '',
        ifcGuid: ifcGuid || '',
        ifcClass: ifcClass || '',
        installationDate: installDate || '',
        powerRating: power || '',
        capacity: capacity || '',
        weight: weight || '',
        dimensions: dimensions || '',
        material: material || '',
        location: [level, room].filter(Boolean).join(' - ') || '',
        category: category || '',
        description: 'Asset extracted from BIM model'
      }));
    } catch { }
  };

  // Clear all form fields (Create New Asset)
  const clearForm = () => {
    const emptyForm = {
      category: '', type: '', brand: '', model: '', description: '', location: '',
      assetCode: '', assetName: '', serialNumber: '', installationDate: '', elementId: '', ifcGuid: '', ifcClass: '',
      material: '', dimensions: '', weight: '', capacity: '', powerRating: '',
      manuals: '', warranties: '', certifications: '',
      condition: '', serviceDate: '', expectedLife: '',
      maintenanceSchedule: '', lastService: '', nextService: '',
      purchaseCost: '', maintenanceCost: '',
      regulations: '', safetyNotes: '',
      parentAsset: '', suppliers: ''
    } as Partial<AssetRecord>;
    setF(emptyForm);
    save(`fm-create-asset-draft-${projectId || 'global'}`, emptyForm);
  };

  // Standalone auto-prefill on mount if viewer is not present
  useEffect(() => {
    if (!viewer) {
      // Try immediately from local snapshot; if empty, nothing happens
      prefillFromSelection();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-3 space-y-3 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div className="text-foreground font-semibold text-sm">{title || (mode === 'edit' ? 'Edit Asset' : 'Create New Asset')}</div>
        <div className="flex items-center gap-2">
          {mode !== 'edit' && (
            <button
              className="text-[11px] px-2 py-1 rounded border border-border bg-card/60 hover:bg-muted text-foreground"
              onClick={clearForm}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Bulk Edit Notification */}
      {bulkEditMode && (
        <div className="px-2 py-2 bg-blue-900/40 border border-blue-700 rounded text-blue-200 text-xs">
          
          <div>Fields left empty will not be changed. Asset Code and Asset Name cannot be bulk edited.</div>
        </div>
      )}

      {/* Section selector */}
      <div className="flex gap-1 overflow-x-auto pb-2">
        {sections.map(sec => (
          <button
            key={sec.key}
            onClick={() => setActiveSection(sec.key)}
            className={`text-xs px-2 py-1 rounded whitespace-nowrap ${activeSection === sec.key
              ? 'bg-blue-600 text-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted'
              }`}
          >
            {sec.label}
          </button>
        ))}
      </div>

      {/* Fields by section */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {activeSection === 'identification' && (
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-[11px] text-muted-foreground block mb-1">Discipline</label>
              <select value={f.assetClassification || ''} onChange={e => updateField('assetClassification', e.target.value as any)} className="w-full bg-card border border-border rounded px-2 py-1.5 text-foreground text-xs">
                <option value="">Select discipline</option>
                <option value="ARCHITECTURAL">Architecture</option>
                <option value="STRUCTURAL">Structure</option>
                <option value="MEP">Mechanical System</option>
                <option value="MEP">Electrical System</option>
                <option value="MEP">Plumbing System</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div><label className="text-[11px] text-muted-foreground block mb-1">Category</label>
              <select value={f.category || ''} onChange={e => updateField('category', e.target.value)} className="w-full bg-card border border-border rounded px-2 py-1.5 text-foreground text-xs">
                <option value="">Select category</option>
                {f.category && !categoryOptions.includes(f.category) && (
                  <option key={f.category} value={f.category}>{f.category} (current)</option>
                )}
                {categoryOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
            <div><label className="text-[11px] text-muted-foreground block mb-1">Asset Name {bulkEditMode && <span className="text-red-400"></span>}</label><input disabled={bulkEditMode} placeholder="Description attribute" value={f.assetName || ''} onChange={e => updateField('assetName', e.target.value)} className={`w-full bg-card border border-border rounded px-2 py-1.5 text-foreground text-xs ${bulkEditMode ? 'opacity-50 cursor-not-allowed' : ''}`} /></div>
            <div><label className="text-[11px] text-muted-foreground block mb-1">Asset Code</label><input disabled={bulkEditMode} value={f.assetCode || ''} onChange={e => updateField('assetCode', e.target.value)} className={`w-full bg-card border border-border rounded px-2 py-1.5 text-foreground text-xs ${bulkEditMode ? 'opacity-50 cursor-not-allowed' : ''}`} /></div>
            <div><label className="text-[11px] text-muted-foreground block mb-1">BIM ID (ElementId)</label><input disabled={bulkEditMode} value={f.elementId || ''} onChange={e => updateField('elementId' as any, e.target.value)} placeholder="Unique BIM Element ID" className={`w-full bg-card border border-border rounded px-2 py-1.5 text-foreground text-xs ${bulkEditMode ? 'opacity-50 cursor-not-allowed' : ''}`} /></div>
            <div><label className="text-[11px] text-muted-foreground block mb-1">IFC GUID</label><input disabled={bulkEditMode} value={f.ifcGuid || ''} onChange={e => updateField('ifcGuid', e.target.value)} placeholder="IFC Global ID" className={`w-full bg-card border border-border rounded px-2 py-1.5 text-foreground text-xs ${bulkEditMode ? 'opacity-50 cursor-not-allowed' : ''}`} /></div>
            <div><label className="text-[11px] text-muted-foreground block mb-1">Brand</label><input placeholder="Manufacturer attribute (default: Unknown)" value={f.brand || ''} onChange={e => updateField('brand', e.target.value)} className="w-full bg-card border border-border rounded px-2 py-1.5 text-foreground text-xs" /></div>
            <div><label className="text-[11px] text-muted-foreground block mb-1">Model</label><input placeholder="Model attribute (default: Unknown)" value={f.model || ''} onChange={e => updateField('model', e.target.value)} className="w-full bg-card border border-border rounded px-2 py-1.5 text-foreground text-xs" /></div>
            <div><label className="text-[11px] text-muted-foreground block mb-1">Type</label><input value={f.type || ''} onChange={e => updateField('type', e.target.value)} className="w-full bg-card border border-border rounded px-2 py-1.5 text-foreground text-xs" /></div>
            <div><label className="text-[11px] text-muted-foreground block mb-1">Ifc Class</label>
              <select value={f.ifcClass || ''} onChange={e => updateField('ifcClass', e.target.value)} className="w-full bg-card border border-border rounded px-2 py-1.5 text-foreground text-xs">
                <option value="">Select Ifc Class</option>
                {f.ifcClass && !IFCCLASSES_UNIQUE.includes(f.ifcClass) && (
                  <option key={f.ifcClass} value={f.ifcClass}>{f.ifcClass} (current)</option>
                )}
                {IFCCLASSES_UNIQUE.map(ic => <option key={ic} value={ic}>{ic}</option>)}
              </select>
            </div>
            <div><label className="text-[11px] text-muted-foreground block mb-1">Serial Number</label><input value={f.serialNumber || ''} onChange={e => updateField('serialNumber', e.target.value)} className="w-full bg-card border border-border rounded px-2 py-1.5 text-foreground text-xs" /></div>
            <div><label className="text-[11px] text-muted-foreground block mb-1">Installation Date</label><input type="date" value={f.installationDate || ''} onChange={e => updateField('installationDate', e.target.value)} className="w-full bg-card border border-border rounded px-2 py-1.5 text-foreground text-xs" /></div>
            <div className="col-span-2"><label className="text-[11px] text-muted-foreground block mb-1">Description</label><textarea value={f.description || ''} onChange={e => updateField('description', e.target.value)} placeholder="Asset extracted from BIM model" className="w-full bg-card border border-border rounded px-2 py-1.5 text-foreground text-xs" rows={2} /></div>
          </div>
        )}

        {activeSection === 'technical' && (
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-[11px] text-muted-foreground block mb-1">Material</label><input value={f.material || ''} onChange={e => updateField('material', e.target.value)} className="w-full bg-card border border-border rounded px-2 py-1.5 text-foreground text-xs" /></div>
            <div><label className="text-[11px] text-muted-foreground block mb-1">Dimensions</label><input value={f.dimensions || ''} onChange={e => updateField('dimensions', e.target.value)} placeholder="L x W x H" className="w-full bg-card border border-border rounded px-2 py-1.5 text-foreground text-xs" /></div>
            <div><label className="text-[11px] text-muted-foreground block mb-1">Weight</label><input value={f.weight || ''} onChange={e => updateField('weight', e.target.value)} placeholder="kg" className="w-full bg-card border border-border rounded px-2 py-1.5 text-foreground text-xs" /></div>
            <div><label className="text-[11px] text-muted-foreground block mb-1">Capacity</label><input value={f.capacity || ''} onChange={e => updateField('capacity', e.target.value)} className="w-full bg-card border border-border rounded px-2 py-1.5 text-foreground text-xs" /></div>
            <div className="col-span-2"><label className="text-[11px] text-muted-foreground block mb-1">Power Rating</label><input value={f.powerRating || ''} onChange={e => updateField('powerRating', e.target.value)} placeholder="kW" className="w-full bg-card border border-border rounded px-2 py-1.5 text-foreground text-xs" /></div>
          </div>
        )}

        {activeSection === 'documentation' && (
          <div className="grid grid-cols-1 gap-2">
            <div>
              <label className="text-[11px] text-muted-foreground block mb-1">Manuals</label>
              <div className="space-y-2">
                <input 
                  type="file" 
                  multiple 
                  onChange={async (e) => { 
                    const files = e.target.files; 
                    if (files && projectId) {
                      try {
                        const fileNames: string[] = [];
                        
                        // Upload each file
                        for (const file of Array.from(files)) {
                          const formData = new FormData();
                          formData.append('file', file);
                          
                          const response = await fetch(`/api/projects/${projectId}/files`, {
                            method: 'POST',
                            body: formData
                          });
                          
                          if (response.ok) {
                            const fileRecord = await response.json();
                            fileNames.push(file.name);
                            console.log(`✅ Uploaded file: ${file.name}`);
                          } else {
                            console.error(`Failed to upload ${file.name}`);
                          }
                        }
                        
                        if (fileNames.length > 0) {
                          updateField('manuals', fileNames.join(', '));
                        }
                      } catch (err) {
                        console.error('Error uploading files:', err);
                      }
                      // Reset input so user can upload same file again if needed
                      e.target.value = '';
                    }
                  }} 
                  placeholder="Select one or more files" 
                  className="w-full bg-card border border-border rounded px-2 py-1.5 text-foreground text-xs" 
                />
                {f.manuals && (
                  <div className="bg-muted/40 border border-border rounded px-2 py-1.5 text-[11px] text-muted-foreground">
                    <div className="font-semibold text-muted-foreground mb-1">Uploaded files:</div>
                    <div className="text-muted-foreground whitespace-pre-wrap break-words">{f.manuals}</div>
                    <button
                      type="button"
                      onClick={() => updateField('manuals', '')}
                      className="mt-2 text-xs text-red-400 hover:text-red-300 underline"
                    >
                      Clear files
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div><label className="text-[11px] text-muted-foreground block mb-1">Warranties</label><input value={f.warranties || ''} onChange={e => updateField('warranties', e.target.value)} placeholder="Expiry date / terms" className="w-full bg-card border border-border rounded px-2 py-1.5 text-foreground text-xs" /></div>
            <div><label className="text-[11px] text-muted-foreground block mb-1">Certifications</label><input value={f.certifications || ''} onChange={e => updateField('certifications', e.target.value)} placeholder="ISO, CE, etc." className="w-full bg-card border border-border rounded px-2 py-1.5 text-foreground text-xs" /></div>
          </div>
        )}

        {activeSection === 'lifecycle' && (
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-[11px] text-muted-foreground block mb-1">Condition</label>
              <select value={f.condition || ''} onChange={e => updateField('condition', e.target.value)} className="w-full bg-card border border-border rounded px-2 py-1.5 text-foreground text-xs">
                <option value="">Select</option>
                <option value="Excellent">Excellent</option>
                <option value="Good">Good</option>
                <option value="Fair">Fair</option>
                <option value="Poor">Poor</option>
                <option value="Critical">Critical</option>
              </select>
            </div>
            <div><label className="text-[11px] text-muted-foreground block mb-1">Service Date</label><input type="date" value={f.serviceDate || ''} onChange={e => updateField('serviceDate', e.target.value)} className="w-full bg-card border border-border rounded px-2 py-1.5 text-foreground text-xs" /></div>
            <div className="col-span-2"><label className="text-[11px] text-muted-foreground block mb-1">Expected Life</label><input value={f.expectedLife || ''} onChange={e => updateField('expectedLife', e.target.value)} placeholder="Years" className="w-full bg-card border border-border rounded px-2 py-1.5 text-foreground text-xs" /></div>
          </div>
        )}

        {activeSection === 'economic' && (
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-[11px] text-muted-foreground block mb-1">Purchase Cost</label><input value={f.purchaseCost || ''} onChange={e => updateField('purchaseCost', e.target.value)} placeholder="€" className="w-full bg-card border border-border rounded px-2 py-1.5 text-foreground text-xs" /></div>
            <div><label className="text-[11px] text-muted-foreground block mb-1">Maintenance Cost</label><input value={f.maintenanceCost || ''} onChange={e => updateField('maintenanceCost', e.target.value)} placeholder="€/year" className="w-full bg-card border border-border rounded px-2 py-1.5 text-foreground text-xs" /></div>
          </div>
        )}

        {activeSection === 'compliance' && (
          <div className="grid grid-cols-1 gap-2">
            <div><label className="text-[11px] text-muted-foreground block mb-1">Regulations</label><input value={f.regulations || ''} onChange={e => updateField('regulations', e.target.value)} placeholder="Regulatory requirements" className="w-full bg-card border border-border rounded px-2 py-1.5 text-foreground text-xs" /></div>
            <div><label className="text-[11px] text-muted-foreground block mb-1">Safety Notes</label><textarea value={f.safetyNotes || ''} onChange={e => updateField('safetyNotes', e.target.value)} placeholder="Safety precautions" className="w-full bg-card border border-border rounded px-2 py-1.5 text-foreground text-xs" rows={3} /></div>
          </div>
        )}

        {activeSection === 'relationships' && (
          <div className="grid grid-cols-1 gap-2">
            <div><label className="text-[11px] text-muted-foreground block mb-1">Parent Asset</label><input value={f.parentAsset || ''} onChange={e => updateField('parentAsset', e.target.value)} placeholder="Related parent asset" className="w-full bg-card border border-border rounded px-2 py-1.5 text-foreground text-xs" /></div>
            <div><label className="text-[11px] text-muted-foreground block mb-1">Suppliers</label><input value={f.suppliers || ''} onChange={e => updateField('suppliers', e.target.value)} placeholder="Supplier contacts" className="w-full bg-card border border-border rounded px-2 py-1.5 text-foreground text-xs" /></div>
          </div>
        )}
        {activeSection === 'qr' && (
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="text-[11px] text-muted-foreground block mb-1">{(f as any).qrCode ? 'View QR Code' : 'Create QR Code'}</label>
              <div className="bg-card border border-border rounded p-3 flex flex-col items-center gap-3">
                {(f as any).qrCode ? (
                  <>
                    <img src={qrImageUrl(getQrPayload(), 400)} alt="QR Code" className="w-40 h-40 bg-card p-2" />
                    <div className="text-xs text-muted-foreground">Generated: {(f as any).qrGeneratedAt ? new Date((f as any).qrGeneratedAt).toLocaleString() : '—'}</div>
                    <div className="flex gap-2">
                      <button className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-foreground text-sm" onClick={exportQrPdf}>Export / Print as PDF</button>
                      <button className="px-3 py-1.5 rounded bg-muted hover:bg-muted text-foreground text-sm" onClick={() => { const u = qrImageUrl(getQrPayload(), 800); window.open(u, '_blank'); }}>Open Image</button>
                      <button className="px-3 py-1.5 rounded bg-muted hover:bg-muted text-foreground text-sm" onClick={() => { navigator.clipboard?.writeText(String(getQrPayload())); try { (window as any).showToast?.('success', 'Link copied!'); } catch {} }}>Copy Link</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-xs text-muted-foreground mb-2">No QR code generated yet. Click the button below to generate a unique, permanent QR for this asset. Once created it cannot be modified.</div>
                    <div className="flex gap-2">
                      <button className="px-3 py-1.5 rounded text-sm font-semibold bg-green-600 hover:bg-green-700 text-foreground" onClick={generateQr}>Generate QR Code</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Success/Error Messages */}
      {(saveSuccess || saveError) && (
        <div className={`p-3 rounded-lg border ${saveSuccess
          ? 'bg-green-500/10 border-green-500/50 text-green-400'
          : 'bg-red-500/10 border-red-500/50 text-red-400'
          }`}>
          <div className="flex items-center gap-2">
            {saveSuccess ? (
              <>
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <div className="font-semibold text-sm">Asset Created Successfully!</div>
                  <div className="text-xs mt-1 opacity-90">
                    {projectId ? 'Asset saved to project and available in Asset List' : 'Asset saved locally'}
                  </div>
                </div>
              </>
            ) : (
              <>
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <div className="font-semibold text-sm">Save Error</div>
                  <div className="text-xs mt-1 opacity-90">{saveError}</div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="border-t border-border pt-3">
        <button
          className={`w-full px-4 py-2 rounded text-sm font-semibold transition-colors ${isSaving
            ? 'bg-muted text-muted-foreground cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700 text-foreground'
            }`}
          onClick={onSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <div className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-border border-t-transparent rounded-full animate-spin"></div>
              Saving Asset...
            </div>
          ) : (
            'Save Asset'
          )}
        </button>
      </div>
    </div>
  );
};

// Inline form for editing spaces
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
            const p = props?.properties?.find((p: any) => { const dn = p.displayName?.toLowerCase?.(); return dn && (lower.includes(dn) || lower.some(n => dn.includes(n))); });
            return p?.displayValue?.toString();
          };
          const b = getProp(['Building', 'Edificio', 'Building Name', 'BuildingName', 'Nome edificio', 'Nome edificio']);
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
        <label className="text-xs text-muted-foreground">Building</label>
        <input 
          type="text"
          value={formData.building}
          onChange={e => setFormData(d => ({ ...d, building: e.target.value }))}
          className="w-full bg-card border border-border rounded px-2 py-1.5 text-xs text-foreground placeholder-muted-foreground"
          placeholder="Building"
        />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Level</label>
        <input 
          type="text"
          value={formData.level}
          onChange={e => setFormData(d => ({ ...d, level: e.target.value }))}
          className="w-full bg-card border border-border rounded px-2 py-1.5 text-xs text-foreground placeholder-muted-foreground"
          placeholder="Level"
        />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Room Name</label>
        <input 
          type="text"
          value={formData.name}
          onChange={e => setFormData(d => ({ ...d, name: e.target.value }))}
          className="w-full bg-card border border-border rounded px-2 py-1.5 text-xs text-foreground placeholder-muted-foreground"
          placeholder="Room Name"
        />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Area (m²)</label>
        <input 
          type="number"
          value={formData.area}
          onChange={e => setFormData(d => ({ ...d, area: e.target.value }))}
          className="w-full bg-card border border-border rounded px-2 py-1.5 text-xs text-foreground placeholder-muted-foreground"
          placeholder="Area"
        />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Space Code</label>
        <input 
          type="text"
          value={formData.spaceCode}
          onChange={e => setFormData(d => ({ ...d, spaceCode: e.target.value }))}
          className="w-full bg-card border border-border rounded px-2 py-1.5 text-xs text-foreground placeholder-muted-foreground"
          placeholder="Space Code"
        />
      </div>
      <div>
        <label className="text-xs text-muted-foreground block mb-1">Description</label>
        <textarea 
          value={formData.description}
          onChange={e => setFormData(d => ({ ...d, description: e.target.value }))}
          className="w-full bg-card border border-border rounded px-2 py-1.5 text-xs text-foreground placeholder-muted-foreground resize-none"
          placeholder="Description"
          rows={3}
        />
      </div>
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 rounded text-xs bg-muted hover:bg-muted text-foreground"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-1.5 rounded text-xs bg-blue-700 hover:bg-blue-600 text-foreground disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
};

