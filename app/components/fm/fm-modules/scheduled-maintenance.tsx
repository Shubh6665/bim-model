"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { X } from "lucide-react";
import { load, save, K, REVIT_CATEGORIES, IFCCLASSES_UNIQUE, stripRevitPrefix } from "../fm-panel-utils";
import { CATEGORY_MAPPING } from "../../../services/asset-extraction-service";
import type { AssetRecord, ScheduledItem, WorkOrderItem } from "../fm-panel-types";

interface ScheduledMaintenanceProps {
  projectId?: string;
  viewer?: any;
  preSelectedAssets?: AssetRecord[];
  onClearPreSelected?: () => void;
}

export 
const ScheduledMaintenance: React.FC<{ projectId?: string; viewer?: any; preSelectedAssets?: AssetRecord[]; onClearPreSelected?: () => void; }> = ({ projectId, viewer, preSelectedAssets, onClearPreSelected }) => {
  // Prepare category options from CATEGORY_MAPPING
  const categoryOptions = React.useMemo(() => {
    return Object.entries(CATEGORY_MAPPING).map(([italian, mapping]) => ({
      value: `${italian} / ${mapping.english} (${mapping.ifc})`,
      label: `${italian} / ${mapping.english} (${mapping.ifc})`
    }));
  }, []);

  // Fetch from DB only - no localStorage caching
  const [rows, setRows] = useState<ScheduledItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const [assetSearch, setAssetSearch] = useState('');
  const [assetCategoryFilter, setAssetCategoryFilter] = useState('');
  const [assetIfcClassFilter, setAssetIfcClassFilter] = useState('');
  const [assetSortBy, setAssetSortBy] = useState<'name' | 'category' | 'location'>('name');

  // Store previously filled values to enable inheritance
  const [previousFormValues, setPreviousFormValues] = useState({ discipline: '', revitCategory: '', ifcClass: '' });
  const [f, setF] = useState({ discipline: '', revitCategory: '', ifcClass: '', code: '', asset: '', frequency: '', timeHours: '' });
  const [selectedAssets, setSelectedAssets] = useState<{ label: string; type?: string; id?: string; assetRecord?: AssetRecord }[]>([]);
  const [allowedAssetType, setAllowedAssetType] = useState<string | null>(null);
  const [currentTask, setCurrentTask] = useState('');
  const [tasks, setTasks] = useState<string[]>([]);
  const [errors, setErrors] = useState({ discipline: '', category: '', code: '', asset: '', frequency: '', timeHours: '', tasks: '' });
  const [submitMessage, setSubmitMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const inferDiscipline = React.useCallback((rec?: AssetRecord): string => {
    const c = `${rec?.category || ''} ${rec?.type || ''}`.toLowerCase();
    const i = `${rec?.ifcClass || rec?.ifcType || rec?.ifcPredefined || ''}`.toLowerCase();
    const has = (s: string) => c.includes(s) || i.includes(s);
    if (has('fire') || has('antincend') || has('ifcfiresuppression') || has('ifcalarm')) return 'Fire Protection';
    if (has('duct') || has('hvac') || has('air') || has('mechanical') || has('spaceheater') || has('ifcduct') || has('ifcairterminal')) return 'Mechanical System';
    if (has('pipe') || has('plumb') || has('idr') || has('sanit') || has('valve') || has('ifcpipe') || has('ifcvalve') || has('flow terminal')) return 'Plumbing System';
    if (has('electric') || has('light') || has('cable') || has('switch') || has('distribution control') || has('ifcelectrical') || has('ifclightfixture') || has('ifcswitching')) return 'Electrical System';
    if (has('elevator') || has('lift') || has('ascensor') || has('ifctransport')) return 'Elevator System';
    if (has('beam') || has('column') || has('slab') || has('reinf') || has('truss') || has('structur') || has('footing') || has('frame') || has('ifcbeam') || has('ifccolumn') || has('ifcslab') || has('ifcreinforc') || has('ifcfooting') || has('ifcmember')) return 'Structure';
    if (has('door') || has('window') || has('wall') || has('roof') || has('furniture') || has('ceiling') || has('stair') || has('railing') || has('floor') || has('room') || has('space')) return 'Architecture';
    if (has('audiovis') || has('communication') || has('dati') || has('data')) return 'IT/Technology';
    return 'Other';
  }, []);

  // Initialize form with draft (unsaved) values first, fallback to previously submitted values
  useEffect(() => {
    const draftKey = `fm-scheduled-maintenance-draft-${projectId || 'global'}`;
    const previousKey = `fm-scheduled-maintenance-previous-${projectId || 'global'}`;
    const savedDraft = load(draftKey, { discipline: '', revitCategory: '', ifcClass: '' });
    const savedPrevious = load(previousKey, { discipline: '', revitCategory: '', ifcClass: '' });
    // Prefer draft if any of the fields are non-empty, else use previous
    const source = (savedDraft.discipline || savedDraft.revitCategory || savedDraft.ifcClass) ? savedDraft : savedPrevious;
    setPreviousFormValues(savedPrevious); // keep previous stored separately
    setF(prev => ({
      ...prev,
      discipline: source.discipline,
      revitCategory: source.revitCategory,
      ifcClass: source.ifcClass
    }));
  }, [projectId]);

  // Autosave draft of inheritance fields on change (without needing submission)
  useEffect(() => {
    const draftKey = `fm-scheduled-maintenance-draft-${projectId || 'global'}`;
    // Debounce save to avoid excessive writes
    const handle = setTimeout(() => {
      try {
        const draft = { discipline: f.discipline, revitCategory: f.revitCategory, ifcClass: f.ifcClass };
        save(draftKey, draft);
      } catch {}
    }, 300);
    return () => clearTimeout(handle);
  }, [f.discipline, f.revitCategory, f.ifcClass, projectId]);

  // Load scheduled maintenance from API
  useEffect(() => {
    if (!projectId) {
      // Fallback to localStorage for non-project mode
      const loaded = load(K.scheduled(projectId), [] as ScheduledItem[]);
      const migrated = loaded.map(item => {
        if (!item.tasks && (item as any).task) {
          const legacyTask = (item as any).task as string;
          return { ...item, tasks: legacyTask.split(',').map(t => t.trim()).filter(Boolean) };
        }
        return item;
      });
      setRows(migrated);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/projects/${projectId}/scheduled-maintenance`);
        if (res.ok) {
          const data = await res.json();
          setRows(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error('Failed to load scheduled maintenance:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [projectId]);

  // Load assets from API for picker
  useEffect(() => {
    if (!projectId || assetsLoaded) return;

    // local helpers (same logic as AssetList) -------------------------------------------------
    const dedupeAssetsLocal = (arr: AssetRecord[]): AssetRecord[] => {
      const score = (x: AssetRecord) => {
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
        if (!ex) map.set(key, a);
        else map.set(key, score(a) >= score(ex) ? a : ex);
      }
      return Array.from(map.values());
    };

    const getCurrentModelGuidLocal = (): string | undefined => {
      try {
        const g = viewer?.model?.getData?.()?.guid;
        if (g && typeof g === 'string') return g;
        const mid = viewer?.model?.id;
        return (mid != null) ? String(mid) : undefined;
      } catch { return undefined; }
    };

    const filterAssetsForCurrentModelLocal = (arr: AssetRecord[]): AssetRecord[] => {
      const g = getCurrentModelGuidLocal();
      if (!g) return arr;
      return arr.filter(a => a.source !== 'BIM_MODEL' || a.modelGuid === g);
    };

    const fetchAssets = async () => {
      setAssetsLoading(true);
      try {
        const currentGuid = getCurrentModelGuidLocal();
        if (!currentGuid) {
          // fallback: use cached and dedupe
          const cachedAll = load(K.assets(projectId), [] as AssetRecord[]);
          const filtered = filterAssetsForCurrentModelLocal(cachedAll);
          const deduped = dedupeAssetsLocal(filtered);
          setAssets(deduped);
          setAssetsLoaded(true);
          return;
        }

        const res = await fetch(`/api/projects/${projectId}/assets?modelGuid=${encodeURIComponent(currentGuid)}`);
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : [];

          // Merge backend list with cached assets in localStorage so we don't lose richer local fields
          const cachedAll = load(K.assets(projectId), [] as AssetRecord[]);
          const cached = cachedAll.filter(a => a.source !== 'BIM_MODEL' || a.modelGuid === currentGuid);
          const mergedById = list.map(b => {
            const c = cached.find(x => x.id === b.id);
            if (!c) return b;
            const merged: any = { ...b };
            for (const key of Object.keys(c)) {
              const val = (c as any)[key];
              if (val !== null && val !== undefined && val !== '') merged[key] = val;
            }
            return merged as AssetRecord;
          });
          const cachedOnly = cached.filter(c => !list.find(b => b.id === c.id));
          const finalList = [...mergedById, ...cachedOnly];

          const filtered = filterAssetsForCurrentModelLocal(finalList);
          const deduped = dedupeAssetsLocal(filtered);
          setAssets(deduped);
          setAssetsLoaded(true);
        }
      } catch (err) {
        console.error('Failed to load assets:', err);
      } finally {
        setAssetsLoading(false);
      }
    };
    fetchAssets();
  }, [projectId, assetsLoaded]);

  // Handle pre-selected assets from Asset List
  useEffect(() => {
    if (preSelectedAssets && preSelectedAssets.length > 0) {
      const formattedAssets = preSelectedAssets.map(asset => ({
        label: asset.assetCode?.trim() ? asset.assetCode : asset.type?.trim() ? asset.type : asset.assetName?.trim() ? asset.assetName : asset.category || asset.id,
        type: asset.type || asset.category,
        id: asset.id,
        assetRecord: asset
      }));

      setSelectedAssets(formattedAssets);
      if (formattedAssets[0]?.type) setAllowedAssetType(formattedAssets[0].type || null);

      // 1. Infer Revit Category
      const categories = preSelectedAssets.map(a => a.category).filter(Boolean) as string[];
      if (categories.length > 0) {
        const firstCategory = categories[0];
        const allSame = categories.every(c => c === firstCategory);
        if (allSame && firstCategory && firstCategory !== 'Unknown') {
          for (const [italian, mapping] of Object.entries(CATEGORY_MAPPING)) {
            const label = `${italian} / ${mapping.english} (${mapping.ifc})`;
            const tokens = [italian, mapping.english, mapping.ifc].filter(Boolean);
            if (tokens.some(t => String(firstCategory).toLowerCase().includes(String(t).toLowerCase()))) {
              setF(prev => ({ ...prev, revitCategory: label }));
              break;
            }
          }
        }
      }

      // 2. Infer IFC Class (handling 'Unknown' values)
      const ifcCandidates = preSelectedAssets.map(a => {
        // Try explicit IFC fields first, ignoring 'Unknown'
        let candidate = (a.ifcClass && a.ifcClass !== 'Unknown') ? a.ifcClass : 
                        (a.ifcType && a.ifcType !== 'Unknown') ? a.ifcType : 
                        (a.ifcPredefined && a.ifcPredefined !== 'Unknown') ? a.ifcPredefined : null;
        
        if (candidate) return candidate;

        // Fallback: infer from Category
        const cat = a.category || '';
        if (cat && cat !== 'Unknown') {
          for (const [italian, mapping] of Object.entries(CATEGORY_MAPPING)) {
            const tokens = [italian, mapping.english, mapping.ifc].filter(Boolean);
            if (tokens.some(t => String(cat).toLowerCase().includes(String(t).toLowerCase()))) return mapping.ifc;
          }
        }
        return '';
      }).filter(Boolean) as string[];

      if (ifcCandidates.length > 0) {
        const firstIfc = ifcCandidates[0];
        const allSameIfc = ifcCandidates.every(ic => String(ic).toLowerCase() === String(firstIfc).toLowerCase());
        if (allSameIfc) setF(prev => ({ ...prev, ifcClass: firstIfc }));
      }

      const inferredDisciplines = preSelectedAssets.map(a => inferDiscipline(a)).filter(Boolean) as string[];
      if (inferredDisciplines.length > 0) {
        const d0 = inferredDisciplines[0];
        const allSameD = inferredDisciplines.every(d => d === d0);
        if (allSameD) setF(prev => ({ ...prev, discipline: d0 }));
      }

      if (onClearPreSelected) onClearPreSelected();
    }
  }, [preSelectedAssets, onClearPreSelected]);

  // Filtered assets for picker
  const filteredAssets = React.useMemo(() => {
    let result = assets;

    // Apply search filter
    if (assetSearch.trim()) {
      const search = assetSearch.toLowerCase();
      result = result.filter(a =>
        a.assetName?.toLowerCase().includes(search) ||
        a.assetCode?.toLowerCase().includes(search) ||
        a.category?.toLowerCase().includes(search) ||
        a.location?.toLowerCase().includes(search) ||
        a.type?.toLowerCase().includes(search) ||
        a.brand?.toLowerCase().includes(search)
      );
    }

    // Apply category filter
    if (assetCategoryFilter) {
      // Build master label -> tokens map (italian, english, ifc)
      const masterMap = new Map<string, string[]>();
      for (const [italian, mapping] of Object.entries(CATEGORY_MAPPING)) {
        const label = `${italian} / ${mapping.english} (${mapping.ifc})`;
        masterMap.set(label, [italian, mapping.english, mapping.ifc].filter(Boolean) as string[]);
      }

      if (masterMap.has(assetCategoryFilter)) {
        const tokens = masterMap.get(assetCategoryFilter) || [];
        result = result.filter(a => {
          if (!a.category) return false;
          const cat = String(a.category).toLowerCase();
          // Match if any token appears in asset.category (case-insensitive) or equals
          return tokens.some(t => t && cat.includes(String(t).toLowerCase()));
        });
      } else {
        // Extra (non-master) categories: exact match
        result = result.filter(a => a.category === assetCategoryFilter);
      }
    }

    // Apply IFC class filter (picker)
    if (assetIfcClassFilter) {
      const sel = assetIfcClassFilter.toLowerCase();
      result = result.filter(a => {
        const candidate = `${(a as any).ifcClass || (a as any).ifcType || (a as any).ifcPredefined || a.category || ''}`.toLowerCase();
        return candidate === sel || candidate.includes(sel) || sel.includes(candidate);
      });
    }

    // Apply sorting
    result = [...result].sort((a, b) => {
      switch (assetSortBy) {
        case 'name':
          return (a.assetName || '').localeCompare(b.assetName || '');
        case 'category':
          return (a.category || '').localeCompare(b.category || '');
        case 'location':
          return (a.location || '').localeCompare(b.location || '');
        default:
          return 0;
      }
    });

    return result;
  }, [assets, assetSearch, assetCategoryFilter, assetIfcClassFilter, assetSortBy]);

  // Get category list for filter: start with master categoryOptions (labels), then add any extra categories found in assets
  // master labels are like "Italian / English (IFC)"; assets may have raw categories — include them too and mark as extra
  const assetCategories = React.useMemo(() => REVIT_CATEGORIES, []);

  const AssetListSelectionModal: React.FC<{
    projectId?: string;
    viewer?: any;
    initialCategory?: string;
    initialIfcClass?: string;
    multi?: boolean;
    onClose: () => void;
    onConfirm: (assets: AssetRecord[]) => void;
  }> = ({ projectId, viewer, initialCategory, initialIfcClass, multi = true, onClose, onConfirm }) => {
    const [assets, setAssets] = useState<AssetRecord[]>([]);
    const [assetsLoading, setAssetsLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState(initialCategory || '');
    const [ifcFilter, setIfcFilter] = useState(initialIfcClass || '');
    const [sortBy, setSortBy] = useState<'name' | 'category' | 'location'>('name');
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const tableRef = useRef<HTMLTableElement | null>(null);

    // Update filters when initial values change (when modal is opened with different form selections)
    useEffect(() => {
      let cat = initialCategory || '';
      // If initialCategory is in the format "Italian / English (IFC)", extract the Italian part
      // This matches the format constructed in ScheduledMaintenance: \`\${italian} / \${mapping.english} (\${mapping.ifc})\`
      if (cat && cat.includes(' / ') && cat.includes('(')) {
        const parts = cat.split(' / ');
        if (parts.length > 0) {
           cat = parts[0].trim();
        }
      }
      setCategoryFilter(cat);
      setIfcFilter(initialIfcClass || '');
    }, [initialCategory, initialIfcClass]);

    // Column widths state for resizable columns
    const [columnWidths, setColumnWidths] = useState({
      checkbox: 56,
      source: 100,
      category: 160,
      assetCode: 150,
      assetName: 200,
      type: 160,
      brand: 130,
      model: 130
    });

    // Column order utilities to support left-edge resizing of previous column
    const COL_KEYS: Array<keyof typeof columnWidths> = ['checkbox','source','category','assetCode','assetName','type','brand','model'];
    const prevKey = (key: keyof typeof columnWidths): keyof typeof columnWidths | null => {
      const idx = COL_KEYS.indexOf(key);
      if (idx > 0) return COL_KEYS[idx - 1];
      return null;
    };

    // Persist widths so user sizing sticks while using the app
    const COL_WIDTHS_STORAGE_KEY = React.useMemo(() => `fm-sched-assetlist-colwidths-${projectId || 'global'}`, [projectId]);
    useEffect(() => {
      try {
        const saved = localStorage.getItem(COL_WIDTHS_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === 'object') {
            setColumnWidths(prev => ({ ...prev, ...parsed }));
          }
        }
      } catch {}
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [COL_WIDTHS_STORAGE_KEY]);
    useEffect(() => {
      try { localStorage.setItem(COL_WIDTHS_STORAGE_KEY, JSON.stringify(columnWidths)); } catch {}
    }, [COL_WIDTHS_STORAGE_KEY, columnWidths]);

    // Reusable column resize starter for headers (Windows-like)
    const startColumnResize = (key: keyof typeof columnWidths, minWidth = 60) => (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startWidth = columnWidths[key];

      const onMouseMove = (ev: MouseEvent) => {
        const diff = ev.clientX - startX;
        setColumnWidths(prev => ({ ...prev, [key]: Math.max(minWidth, Math.round(startWidth + diff)) }));
      };
      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        try {
          document.body.style.cursor = '';
          document.body.classList.remove('select-none');
        } catch {}
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      try {
        document.body.style.cursor = 'col-resize';
        document.body.classList.add('select-none');
      } catch {}
    };

    // Auto-fit a column width based on header + sample cell content (Windows-like double-click)
    const autoFitColumn = (key: keyof typeof columnWidths) => {
      try {
        const ctxCanvas = document.createElement('canvas');
        const ctx = ctxCanvas.getContext('2d');
        if (!ctx) return;
        // Approximate font used in table
        const computedFont = getComputedStyle(document.body).font || '12px Inter, ui-sans-serif, system-ui';
        ctx.font = computedFont;

        const headerTextMap: Record<keyof typeof columnWidths, string> = {
          checkbox: '',
          source: 'Source',
          category: 'Category',
          assetCode: 'Asset Code',
          assetName: 'Asset Name',
          type: 'Type',
          brand: 'Brand',
          model: 'Model'
        };
        const getCellText = (a: AssetRecord, k: keyof typeof columnWidths): string => {
          switch (k) {
            case 'source': return a.source === 'BIM_MODEL' ? 'BIM' : 'Manual';
            case 'category': return stripRevitPrefix(a.category) || '-';
            case 'assetCode': return a.assetCode || '-';
            case 'assetName': return a.assetName || '-';
            case 'type': return a.type || '-';
            case 'brand': return a.brand || '-';
            case 'model': return a.model || '-';
            default: return '';
          }
        };

        const sample = filtered.slice(0, 150); // sample up to 150 rows for performance
        let maxPx = ctx.measureText(headerTextMap[key] || '').width;
        for (const a of sample) {
          const w = ctx.measureText(getCellText(a, key)).width;
          if (w > maxPx) maxPx = w;
        }
        // Add padding and safety margins: cell padding left/right + truncation buffer
        const paddingPx = 24; // ~12px left + 12px right
        const minMap: Partial<Record<keyof typeof columnWidths, number>> = { checkbox: 44, source: 80, category: 120, assetCode: 120, assetName: 140, type: 120, brand: 100, model: 100 };
        const maxMap: Partial<Record<keyof typeof columnWidths, number>> = { checkbox: 72, source: 220, category: 420, assetCode: 360, assetName: 480, type: 360, brand: 320, model: 320 };
        const nextWidth = Math.round(maxPx + paddingPx);
        const clamped = Math.max(minMap[key] ?? 60, Math.min(maxMap[key] ?? 600, nextWidth));
        setColumnWidths(prev => ({ ...prev, [key]: clamped }));
      } catch {}
    };

    // Helpers adapted from Asset List and Scheduled Maintenance loaders
    const dedupeAssetsLocal = (arr: AssetRecord[]): AssetRecord[] => {
      const score = (x: AssetRecord) => {
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
        if (!ex) map.set(key, a); else map.set(key, score(a) >= score(ex) ? a : ex);
      }
      return Array.from(map.values());
    };
    const getCurrentModelGuidLocal = (): string | undefined => {
      try {
        const g = viewer?.model?.getData?.()?.guid;
        if (g && typeof g === 'string') return g;
        const mid = viewer?.model?.id;
        return (mid != null) ? String(mid) : undefined;
      } catch { return undefined; }
    };
    const filterAssetsForCurrentModelLocal = (arr: AssetRecord[]): AssetRecord[] => {
      const g = getCurrentModelGuidLocal();
      if (!g) return arr;
      return arr.filter(a => a.source !== 'BIM_MODEL' || a.modelGuid === g);
    };

    useEffect(() => {
      if (!projectId) return;
      const fetchAssets = async () => {
        setAssetsLoading(true);
        try {
          const currentGuid = getCurrentModelGuidLocal();
          const cachedAll = load(K.assets(projectId), [] as AssetRecord[]);
          let base: AssetRecord[] = [];

          if (currentGuid) {
            const res = await fetch(`/api/projects/${projectId}/assets?modelGuid=${encodeURIComponent(currentGuid)}`);
            if (res.ok) {
              const json = await res.json();
              const list = Array.isArray(json) ? json : [];
              const cached = cachedAll.filter(a => a.source !== 'BIM_MODEL' || a.modelGuid === currentGuid);
              const merged = list.map((b: any) => {
                const c = cached.find(x => x.id === b.id);
                if (!c) return b;
                const m: any = { ...b };
                for (const key of Object.keys(c)) {
                  const val = (c as any)[key];
                  if (val !== null && val !== undefined && val !== '') m[key] = val;
                }
                return m as AssetRecord;
              });
              const cachedOnly = cached.filter(c => !list.find((b: any) => b.id === c.id));
              base = [...merged, ...cachedOnly];
            } else {
              base = cachedAll;
            }
          } else {
            base = cachedAll;
          }

          const filtered = filterAssetsForCurrentModelLocal(base);
          const deduped = dedupeAssetsLocal(filtered);
          console.log('[AssetListSelectionModal] Assets loaded:', {
            totalCount: deduped.length,
            samples: deduped.slice(0, 3).map(a => ({
              id: a.id,
              assetName: a.assetName,
              assetCode: a.assetCode,
              category: a.category,
              type: a.type
            }))
          });
          setAssets(deduped);
        } catch (err) {
          console.error('[AssetListSelectionModal] Failed to load assets:', err);
          // Fallback to cached assets on error
          const cachedAll = load(K.assets(projectId), [] as AssetRecord[]);
          const filtered = filterAssetsForCurrentModelLocal(cachedAll);
          const deduped = dedupeAssetsLocal(filtered);
          setAssets(deduped);
        } finally {
          setAssetsLoading(false);
        }
      };
      // Load assets immediately when modal opens
      setAssets([]);
      fetchAssets();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId]);

    const filtered = React.useMemo(() => {
      let result = assets;
      if (search.trim()) {
        const s = search.toLowerCase();
        result = result.filter(a =>
          a.assetName?.toLowerCase().includes(s) ||
          a.assetCode?.toLowerCase().includes(s) ||
          a.category?.toLowerCase().includes(s) ||
          a.location?.toLowerCase().includes(s) ||
          a.type?.toLowerCase().includes(s) ||
          a.brand?.toLowerCase().includes(s)
        );
      }
      if (categoryFilter) {
        // Find English equivalent from CATEGORY_MAPPING if Italian category is selected
        const mapping = Object.entries(CATEGORY_MAPPING).find(([italian]) => italian === categoryFilter);
        const englishEquivalent = mapping ? mapping[1].english : null;
        const ifcEquivalent = mapping ? mapping[1].ifc : null;
        
        result = result.filter(a => {
          const assetCategory = (a.category || '').toLowerCase();
          const filterLower = categoryFilter.toLowerCase();
          
          // Match if:
          // 1. Exact match with selected category (Italian)
          // 2. Contains selected category name
          // 3. Matches English equivalent (e.g., "Porte" matches "Door", "Doors")
          // 4. Matches IFC equivalent
          const matchesItalian = (a.category || '') === categoryFilter || assetCategory.includes(filterLower);
          const matchesEnglish = englishEquivalent && assetCategory.includes(englishEquivalent.toLowerCase());
          const matchesIfc = ifcEquivalent && assetCategory.includes(ifcEquivalent.toLowerCase());
          
          return matchesItalian || matchesEnglish || matchesIfc;
        });
      }
      if (ifcFilter) {
        const sel = ifcFilter.toLowerCase();
        result = result.filter(a => {
          const cand = `${(a as any).ifcClass || (a as any).ifcType || (a as any).ifcPredefined || a.category || ''}`.toLowerCase();
          return cand === sel || cand.includes(sel) || sel.includes(cand);
        });
      }
      result = [...result].sort((a, b) => {
        switch (sortBy) {
          case 'category': return (a.category || '').localeCompare(b.category || '');
          case 'location': return (a.location || '').localeCompare(b.location || '');
          default: return (a.assetName || '').localeCompare(b.assetName || '');
        }
      });
      return result;
    }, [assets, search, categoryFilter, ifcFilter, sortBy]);

    const toggle = (id: string) => {
      setSelected(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else {
          if (!multi) next.clear();
          next.add(id);
        }
        return next;
      });
    };

    const confirm = () => {
      const picked = filtered.filter(a => selected.has(a.id));
      console.log('[AssetListSelectionModal.confirm] picked assets count:', picked.length);
      picked.forEach((asset, idx) => {
        console.log(`[AssetListSelectionModal] Picked asset ${idx}:`, {
          id: asset.id,
          assetName: asset.assetName,
          assetCode: asset.assetCode,
          category: asset.category,
          type: asset.type,
          location: asset.location,
          source: asset.source,
          dbId: asset.dbId
        });
      });
      onConfirm(picked);
      onClose();
    };

    return (
      <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50" onClick={onClose}>
        <div className="bg-card rounded-lg p-4 w-full max-w-6xl flex flex-col resize overflow-auto" style={{ minWidth: '600px', minHeight: '560px', maxHeight: 'calc(100vh - 40px)', maxWidth: 'calc(100vw - 40px)' }} onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-foreground font-semibold">Asset List</h3>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-2xl">&times;</button>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-2 items-center">
            <input
              placeholder="Search assets by name, code, category, location, type, brand..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full max-w-[760px] bg-muted border border-border rounded-md px-3 text-foreground text-sm h-9"
            />
            <div className="flex gap-2 items-center w-full">
              <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="flex-1 min-w-[140px] bg-muted border border-border rounded-md px-3 text-foreground text-sm h-9">
                <option value="">Revit Categories</option>
                {REVIT_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              <select value={ifcFilter} onChange={e => setIfcFilter(e.target.value)} className="flex-1 min-w-[140px] bg-muted border border-border rounded-md px-3 text-foreground text-sm h-9">
                <option value="">Ifc Class</option>
                {IFCCLASSES_UNIQUE.map(ic => <option key={ic} value={ic}>{ic}</option>)}
              </select>
              <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="flex-1 min-w-[120px] bg-muted border border-border rounded-md px-3 text-foreground text-sm h-9">
                <option value="name">Name (A-Z)</option>
                <option value="category">Category (A-Z)</option>
                <option value="location">Location (A-Z)</option>
              </select>
              <div className="px-3 h-9 flex items-center bg-muted/50 rounded text-xs text-muted-foreground">
                {filtered.length} item{filtered.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto border border-border rounded">
            {assetsLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
                <div className="text-muted-foreground text-sm">Loading assets...</div>
              </div>
            ) : (
              <table ref={tableRef} className="w-full text-xs" style={{ tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: `${columnWidths.checkbox}px` }} />
                  <col style={{ width: `${columnWidths.source}px` }} />
                  <col style={{ width: `${columnWidths.category}px` }} />
                  <col style={{ width: `${columnWidths.assetCode}px` }} />
                  <col style={{ width: `${columnWidths.assetName}px` }} />
                  <col style={{ width: `${columnWidths.type}px` }} />
                  <col style={{ width: `${columnWidths.brand}px` }} />
                  <col style={{ width: `${columnWidths.model}px` }} />
                </colgroup>
                <thead className="sticky top-0 bg-card/90 backdrop-blur border-b border-border text-muted-foreground">
                  <tr>
                    <th className="py-1.5 relative group" style={{ paddingLeft: '6px', paddingRight: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div className="w-full h-full flex items-center px-3 py-2 rounded-md bg-card/60">
                        <input className="h-4 w-4" type="checkbox" onChange={e => {
                          const allIds = filtered.map(a => a.id);
                          setSelected(prev => {
                            const next = new Set<string>();
                            if (e.target.checked) allIds.forEach(id => next.add(id));
                            return next;
                          });
                        }} />
                      </div>
                      {/* Right edge handle for current column */}
                      <div
                        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-10"
                        onMouseDown={startColumnResize('checkbox', 40)}
                        onDoubleClick={() => autoFitColumn('checkbox')}
                      />
                    </th>
                    <th className="text-left py-1.5 relative group" style={{ paddingLeft: '8px', paddingRight: '8px' }}>
                      <div className="w-full h-full flex items-center px-3 py-2 rounded-md bg-card/60 border border-border">
                        Source
                      </div>
                      {/* Left edge handle resizes previous column */}
                      <div
                        className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize z-10"
                        onMouseDown={(e) => { const k = prevKey('source'); if (k) startColumnResize(k, 60)(e as any); }}
                        onDoubleClick={() => { const k = prevKey('source'); if (k) autoFitColumn(k); }}
                      />
                      {/* Right edge handle for current column */}
                      <div
                        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-10"
                        onMouseDown={startColumnResize('source', 60)}
                        onDoubleClick={() => autoFitColumn('source')}
                      />
                    </th>
                    <th className="text-left py-1.5 relative group" style={{ paddingLeft: '8px', paddingRight: '8px' }}>
                      <div className="w-full h-full flex items-center px-3 py-2 rounded-md bg-card/60 border border-border">
                        Category
                      </div>
                      <div
                        className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize z-10"
                        onMouseDown={(e) => { const k = prevKey('category'); if (k) startColumnResize(k, 60)(e as any); }}
                        onDoubleClick={() => { const k = prevKey('category'); if (k) autoFitColumn(k); }}
                      />
                      <div
                        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-10"
                        onMouseDown={startColumnResize('category', 80)}
                        onDoubleClick={() => autoFitColumn('category')}
                      />
                    </th>
                    <th className="text-left py-1.5 relative group" style={{ paddingLeft: '8px', paddingRight: '8px' }}>
                      <div className="w-full h-full flex items-center px-3 py-2 rounded-md bg-card/60 border border-border">
                        Asset Code
                      </div>
                      <div
                        className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize z-10"
                        onMouseDown={(e) => { const k = prevKey('assetCode'); if (k) startColumnResize(k, 60)(e as any); }}
                        onDoubleClick={() => { const k = prevKey('assetCode'); if (k) autoFitColumn(k); }}
                      />
                      <div
                        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-10"
                        onMouseDown={startColumnResize('assetCode', 80)}
                        onDoubleClick={() => autoFitColumn('assetCode')}
                      />
                    </th>
                    <th className="text-left py-1.5 relative group" style={{ paddingLeft: '8px', paddingRight: '8px' }}>
                      <div className="w-full h-full flex items-center px-3 py-2 rounded-md bg-card/60 border border-border">
                        Asset Name
                      </div>
                      <div
                        className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize z-10"
                        onMouseDown={(e) => { const k = prevKey('assetName'); if (k) startColumnResize(k, 60)(e as any); }}
                        onDoubleClick={() => { const k = prevKey('assetName'); if (k) autoFitColumn(k); }}
                      />
                      <div
                        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-10"
                        onMouseDown={startColumnResize('assetName', 80)}
                        onDoubleClick={() => autoFitColumn('assetName')}
                      />
                    </th>
                    <th className="text-left py-1.5 relative group" style={{ paddingLeft: '8px', paddingRight: '8px' }}>
                      <div className="w-full h-full flex items-center px-3 py-2 rounded-md bg-card/60 border border-border">
                        Type
                      </div>
                      <div
                        className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize z-10"
                        onMouseDown={(e) => { const k = prevKey('type'); if (k) startColumnResize(k, 60)(e as any); }}
                        onDoubleClick={() => { const k = prevKey('type'); if (k) autoFitColumn(k); }}
                      />
                      <div
                        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-10"
                        onMouseDown={startColumnResize('type', 80)}
                        onDoubleClick={() => autoFitColumn('type')}
                      />
                    </th>
                    <th className="text-left py-1.5 relative group" style={{ paddingLeft: '8px', paddingRight: '8px' }}>
                      <div className="w-full h-full flex items-center px-3 py-2 rounded-md bg-card/60 border border-border">
                        Brand
                      </div>
                      <div
                        className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize z-10"
                        onMouseDown={(e) => { const k = prevKey('brand'); if (k) startColumnResize(k, 60)(e as any); }}
                        onDoubleClick={() => { const k = prevKey('brand'); if (k) autoFitColumn(k); }}
                      />
                      <div
                        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-10"
                        onMouseDown={startColumnResize('brand', 80)}
                        onDoubleClick={() => autoFitColumn('brand')}
                      />
                    </th>
                    <th className="text-left py-1.5 relative group" style={{ paddingLeft: '8px', paddingRight: '8px' }}>
                      <div className="w-full h-full flex items-center px-3 py-2 rounded-md bg-card/60 border border-border">
                        Model
                      </div>
                      <div
                        className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize z-10"
                        onMouseDown={(e) => { const k = prevKey('model'); if (k) startColumnResize(k, 60)(e as any); }}
                        onDoubleClick={() => { const k = prevKey('model'); if (k) autoFitColumn(k); }}
                      />
                      <div
                        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-10"
                        onMouseDown={startColumnResize('model', 80)}
                        onDoubleClick={() => autoFitColumn('model')}
                      />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">No assets</td>
                    </tr>
                  ) : filtered.map(a => (
                    <tr key={a.id} className="border-b border-border hover:bg-card/60">
                      <td style={{ paddingLeft: '6px', paddingRight: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }} className="py-1.5">
                        <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggle(a.id)} />
                      </td>
                      <td style={{ paddingLeft: '8px', paddingRight: '8px' }} className="py-1.5">
                        <span className={`text-xs px-2 py-0.5 rounded ${a.source === 'BIM_MODEL' ? 'bg-green-900/40 text-green-300' : 'bg-blue-900/40 text-blue-300'}`}>
                          {a.source === 'BIM_MODEL' ? 'BIM' : 'Manual'}
                        </span>
                      </td>
                      <td style={{ paddingLeft: '8px', paddingRight: '8px' }} className="py-1.5 text-foreground truncate" title={stripRevitPrefix(a.category) || '-'}>{stripRevitPrefix(a.category) || '-'}</td>
                      <td style={{ paddingLeft: '8px', paddingRight: '8px' }} className="py-1.5 text-foreground truncate" title={a.assetCode || '-'}>{a.assetCode || '-'}</td>
                      <td style={{ paddingLeft: '8px', paddingRight: '8px' }} className="py-1.5 text-foreground truncate" title={a.assetName || '-'}>{a.assetName || '-'}</td>
                      <td style={{ paddingLeft: '8px', paddingRight: '8px' }} className="py-1.5 text-foreground truncate" title={a.type || '-'}>{a.type || '-'}</td>
                      <td style={{ paddingLeft: '8px', paddingRight: '8px' }} className="py-1.5 text-foreground truncate" title={a.brand || '-'}>{a.brand || '-'}</td>
                      <td style={{ paddingLeft: '8px', paddingRight: '8px' }} className="py-1.5 text-foreground truncate" title={a.model || '-'}>{a.model || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div className="text-xs text-muted-foreground">{selected.size} selected</div>
            <div className="flex gap-2">
              <button onClick={onClose} className="px-3 py-1.5 rounded text-xs bg-muted hover:bg-muted text-foreground">Cancel</button>
              <button onClick={confirm} disabled={selected.size === 0} className={`px-3 py-1.5 rounded text-xs ${selected.size === 0 ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-foreground'}`}>Add Selected</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const addTask = () => {
    if (currentTask.trim()) {
      setTasks(prev => [...prev, currentTask.trim()]);
      setCurrentTask('');
      // Clear task-related error immediately
      setErrors(prev => ({ ...prev, tasks: '' }));
      setSubmitMessage(null);
    }
  };

  const removeTask = (index: number) => {
    setTasks(prev => prev.filter((_, i) => i !== index));
  };

  const selectAsset = (asset: AssetRecord) => {
    const label = asset.assetName || asset.assetCode || `Asset ${asset.id}`;
    const type = asset.type || asset.category || '';

    // Enforce match against currently selected Revit Category / Ifc Class
    const matchesFormCategory = () => {
      // Build master label -> tokens map (italian, english, ifc)
      const masterMap = new Map<string, string[]>();
      for (const [italian, mapping] of Object.entries(CATEGORY_MAPPING)) {
        const label = `${italian} / ${mapping.english} (${mapping.ifc})`;
        masterMap.set(label, [italian, mapping.english, mapping.ifc].filter(Boolean) as string[]);
      }
      let ok = true;
      if (f.revitCategory) {
        const tokens = masterMap.get(f.revitCategory) || [];
        const cat = (asset.category || '').toLowerCase();
        ok = tokens.some(t => t && cat.includes(String(t).toLowerCase()));
      }
      if (ok && f.ifcClass) {
        const sel = f.ifcClass.toLowerCase();
        const candidate = `${(asset as any).ifcClass || (asset as any).ifcType || (asset as any).ifcPredefined || asset.category || ''}`.toLowerCase();
        ok = candidate === sel || candidate.includes(sel) || sel.includes(candidate);
      }
      return ok;
    };

    if (!matchesFormCategory()) {
      setSubmitMessage({ type: 'error', text: 'Asset does not match the selected Revit Category / Ifc Class.' });
      return;
    }

    // Enforce same type as first selected asset
    if (allowedAssetType && type !== allowedAssetType) {
      setSubmitMessage({ type: 'error', text: `Only assets of type "${allowedAssetType}" can be added. This asset is "${type}".` });
      return;
    }

    setSelectedAssets(prev => {
      if (prev.some(p => p.label === label)) return prev;
      return [...prev, { label, type, id: asset.id }];
    });
    // Set allowed type if first asset
    if (!allowedAssetType) setAllowedAssetType(type || null);
    setF(v => ({ ...v, asset: '' }));
    setShowAssetPicker(false);
    setAssetSearch('');
    setAssetCategoryFilter('');
    setAssetSortBy('name');
    // Clear asset validation error when selected
    setErrors(prev => ({ ...prev, asset: '' }));
    setSubmitMessage(null);
  };

  const validateAndAdd = async () => {
    setSubmitMessage(null);
    const newErrors: any = { discipline: '', category: '', code: '', asset: '', frequency: '', timeHours: '', tasks: '' };
    let hasError = false;

  // Required fields validation
  if (!f.discipline) { newErrors.discipline = 'Required'; hasError = true; }
  // At least one of Revit Category or Ifc Class must be selected
  if (!f.revitCategory && !f.ifcClass) { newErrors.category = 'Select Revit Category or Ifc Class'; hasError = true; }
    if (!f.code || !f.code.trim()) { newErrors.code = 'Required'; hasError = true; }
  // legacy single-asset field removed; validate using selectedAssets
  // if any assets must be selected, ensure selectedAssets is non-empty
  if (selectedAssets.length === 0) { newErrors.asset = 'Required'; hasError = true; }

    // Validate frequency
    const freq = parseFloat(f.frequency as any);
    if (!f.frequency || isNaN(freq) || freq <= 0) { newErrors.frequency = 'Required (n/year, must be > 0)'; hasError = true; }

    // Validate timeHours
    const hours = parseFloat(f.timeHours as any);
    if (!f.timeHours || isNaN(hours) || hours <= 0) { newErrors.timeHours = 'Required (hours, must be > 0)'; hasError = true; }

  // Validate tasks
  if (tasks.length === 0) { newErrors.tasks = 'Please add at least one task.'; hasError = true; }
  // Validate assets
  if (selectedAssets.length === 0) { newErrors.asset = 'Please select at least one asset.'; hasError = true; }

    setErrors(newErrors);
    if (hasError) {
      setSubmitMessage({ type: 'error', text: 'Please fix the highlighted fields.' });
      return;
    }

    // Build new item
    const combinedCategory = [f.revitCategory, f.ifcClass].filter(Boolean).join(' | ');
    const newItem: ScheduledItem = {
      id: `sched-${Date.now()}`,
      discipline: f.discipline,
      category: combinedCategory,
      code: f.code,
      asset: selectedAssets.map(s => s.label),
      tasks: tasks,
      frequency: freq,
      timeHours: hours
    };

    // Prevent duplicate (all fields equal including tasks order)
    const arraysEqual = (a: string[], b: string[]) => {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) if (a[i].trim().toLowerCase() !== b[i].trim().toLowerCase()) return false;
      return true;
    };

    const duplicate = rows.some(r => {
      const assetsEqual = arraysEqual(r.asset || [], newItem.asset || []);
      return (
        (r.discipline || '') === (newItem.discipline || '') &&
        (r.category || '') === (newItem.category || '') &&
        (r.code || '').trim() === (newItem.code || '').trim() &&
        assetsEqual &&
        arraysEqual(r.tasks || [], newItem.tasks || []) &&
        Number(r.frequency) === Number(newItem.frequency) &&
        Number(r.timeHours) === Number(newItem.timeHours)
      );
    });

    if (duplicate) {
      setSubmitMessage({ type: 'error', text: 'This scheduled maintenance already exists.' });
      return;
    }

    // Save to API if projectId exists
    setLoading(true);
    try {
      if (projectId) {
        const res = await fetch(`/api/projects/${projectId}/scheduled-maintenance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newItem)
        });

        if (res.ok) {
          const result = await res.json();
          const saved = result?.item || newItem;
          setRows(prev => [saved, ...prev]);
        } else {
          // Fallback to local state if API fails
          setRows(prev => [newItem, ...prev]);
        }
      } else {
        // localStorage fallback for non-project mode
        setRows(prev => {
          const updated = [newItem, ...prev];
          save(K.scheduled(projectId), updated);
          return updated;
        });
      }
      setSubmitMessage({ type: 'success', text: 'Scheduled maintenance added.' });
    } catch (err) {
      console.error('Failed to save scheduled maintenance:', err);
      setRows(prev => [newItem, ...prev]);
      setSubmitMessage({ type: 'error', text: 'Failed to save — saved locally.' });
    } finally {
      setLoading(false);
    }

    // Store current values for inheritance (both in state and localStorage)
    const previousValues = {
      discipline: f.discipline,
      revitCategory: f.revitCategory,
      ifcClass: f.ifcClass
    };
    setPreviousFormValues(previousValues);
    save(`fm-scheduled-maintenance-previous-${projectId || 'global'}`, previousValues);

    // Reset form but inherit Discipline, Revit Category, IFC Class AND Selected Assets
    setF({ 
      discipline: f.discipline, 
      revitCategory: f.revitCategory, 
      ifcClass: f.ifcClass, 
      code: '', 
      asset: f.asset, 
      frequency: '', 
      timeHours: '' 
    });
    setTasks([]);
    setCurrentTask('');
    // Keep selected assets for multiple insertions
    // setSelectedAssets([]); 
    setErrors({ discipline: '', category: '', code: '', asset: '', frequency: '', timeHours: '', tasks: '' });
  };

  return (
    <div className="p-3 space-y-3">
      <div className="text-foreground font-semibold text-sm">Scheduled Maintenance</div>
      <div className="grid grid-cols-2 gap-2">
        {/* Discipline Dropdown */}
        <div>
          <label className="text-[11px] text-muted-foreground block mb-1">Discipline *</label>
          <select
            value={f.discipline}
            onChange={e => { setF(v => ({ ...v, discipline: e.target.value })); setErrors(prev => ({ ...prev, discipline: '' })); setSubmitMessage(null); }}
            className={`w-full bg-card border rounded px-2 py-1.5 text-foreground text-sm ${errors.discipline ? 'border-red-500' : 'border-border'}`}
          >
            <option value="">Select Discipline</option>
            {['Architecture', 'Structure', 'Mechanical System', 'Electrical System', 'Plumbing System', 'Fire Protection', 'Elevator System', 'Safety', 'IT/Technology', 'Other'].map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          {errors.discipline && <div className="text-[10px] text-red-400 mt-1">{errors.discipline}</div>}
        </div>

        {/* Revit Category Dropdown */}
        <div>
          <label className="text-[11px] text-muted-foreground block mb-1">Revit Category</label>
          <select
            value={f.revitCategory}
            onChange={e => { setF(v => ({ ...v, revitCategory: e.target.value })); setErrors(prev => ({ ...prev, category: '' })); setSubmitMessage(null); }}
            className={`w-full bg-card border rounded px-2 py-1.5 text-foreground text-sm ${errors.category ? 'border-red-500' : 'border-border'}`}
          >
            <option value="">Select Revit Category</option>
            {categoryOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {errors.category && <div className="text-[10px] text-red-400 mt-1">{errors.category}</div>}
        </div>

        {/* IFC Class Dropdown */}
        <div>
          <label className="text-[11px] text-muted-foreground block mb-1">Ifc Class</label>
          <select
            value={f.ifcClass}
            onChange={e => { setF(v => ({ ...v, ifcClass: e.target.value })); setErrors(prev => ({ ...prev, category: '' })); setSubmitMessage(null); }}
            className={`w-full bg-card border rounded px-2 py-1.5 text-foreground text-sm ${errors.category ? 'border-red-500' : 'border-border'}`}
          >
            <option value="">Select Ifc Class</option>
            {IFCCLASSES_UNIQUE.map(ic => (
              <option key={ic} value={ic}>{ic}</option>
            ))}
          </select>
          {errors.category && <div className="text-[10px] text-red-400 mt-1">{errors.category}</div>}
        </div>

        {/* Code */}
        <div>
          <label className="text-[11px] text-muted-foreground block mb-1">Code *</label>
          <input
            placeholder="Alphanumeric code"
            value={f.code}
            onChange={e => { setF(v => ({ ...v, code: e.target.value })); setErrors(prev => ({ ...prev, code: '' })); setSubmitMessage(null); }}
            className={`w-full bg-card border rounded px-2 py-1.5 text-foreground text-sm ${errors.code ? 'border-red-500' : 'border-border'}`}
          />
          {errors.code && <div className="text-[10px] text-red-400 mt-1">{errors.code}</div>}
        </div>

        {/* Assets with Picker (multiple) */}
        <div>
          <label className="text-[11px] text-muted-foreground block mb-1">Assets *</label>
          <div className={`w-full bg-card border rounded px-2 py-1.5 text-foreground text-sm ${errors.asset ? 'border-red-500' : 'border-border'}`}>
            <div className="flex gap-2 overflow-x-auto py-1">
              {selectedAssets.length === 0 && <div className="text-muted-foreground">No assets selected</div>}
              {selectedAssets.map((a, idx) => {
                const rec = a.assetRecord as any as AssetRecord | undefined;
                const revit = (() => {
                  const raw = rec?.category || '';
                  for (const [it, m] of Object.entries(CATEGORY_MAPPING)) {
                    const tokens = [it, m.english, m.ifc].filter(Boolean) as string[];
                    if (tokens.some(t => raw.toLowerCase().includes(String(t).toLowerCase()))) return `${it} / ${m.english} (${m.ifc})`;
                  }
                  return raw;
                })();
                const ifc = rec?.ifcClass || rec?.ifcType || rec?.ifcPredefined || (() => {
                  const raw = rec?.category || '';
                  for (const [it, m] of Object.entries(CATEGORY_MAPPING)) {
                    const tokens = [it, m.english, m.ifc].filter(Boolean) as string[];
                    if (tokens.some(t => raw.toLowerCase().includes(String(t).toLowerCase()))) return m.ifc;
                  }
                  return '';
                })();
                const disc = inferDiscipline(rec);
                return (
                  <div key={(a.id || a.label) + '-' + idx} className="flex items-center bg-card/60 px-3 py-1 rounded whitespace-nowrap mr-2">
                    <div className="flex flex-col mr-2">
                      <span className="text-sm text-foreground max-w-xs overflow-hidden text-ellipsis">{a.label}</span>
                     
                    </div>
                    <button onClick={() => {
                      setSelectedAssets(prev => prev.filter(x => x.label !== a.label));
                      setTimeout(() => {
                        setSelectedAssets(curr => {
                          if (curr.length === 0) setAllowedAssetType(null);
                          return curr;
                        });
                      }, 0);
                    }} className="text-red-400 hover:text-red-300 text-sm">×</button>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex gap-2">
              {projectId && (
                <button
                  type="button"
                  onClick={() => {
                    // Auto-apply category/IFC filters based on form selection
                    try {
                      if (f.revitCategory) setAssetCategoryFilter(f.revitCategory);
                      if (f.ifcClass) setAssetIfcClassFilter(f.ifcClass);
                    } catch {}
                    setShowAssetPicker(true);
                  }}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-foreground rounded text-xs whitespace-nowrap"
                >
                  Select from List
                </button>
              )}
              <div className="text-xs text-muted-foreground self-center">You can add multiple assets. Click × to remove.</div>
            </div>
          </div>
          {errors.asset && <div className="text-[10px] text-red-400 mt-1">{errors.asset}</div>}
        </div>

        {/* Frequency (numeric) */}
        <div>
          <label className="text-[11px] text-muted-foreground block mb-1">Frequency (n/year) *</label>
          <input
            type="number"
            min="0"
            step="0.1"
            placeholder="e.g., 12"
            value={f.frequency}
            onChange={e => { setF(v => ({ ...v, frequency: e.target.value })); setErrors(prev => ({ ...prev, frequency: '' })); setSubmitMessage(null); }}
            className={`w-full bg-card border rounded px-2 py-1.5 text-foreground text-sm ${errors.frequency ? 'border-red-500' : 'border-border'}`}
          />
          {errors.frequency && <div className="text-[10px] text-red-400 mt-0.5">{errors.frequency}</div>}
        </div>

        {/* Time (hours, numeric) */}
        <div>
          <label className="text-[11px] text-muted-foreground block mb-1">Time (hours) *</label>
          <input
            type="number"
            min="0"
            step="0.5"
            placeholder="e.g., 2"
            value={f.timeHours}
            onChange={e => { setF(v => ({ ...v, timeHours: e.target.value })); setErrors(prev => ({ ...prev, timeHours: '' })); setSubmitMessage(null); }}
            className={`w-full bg-card border rounded px-2 py-1.5 text-foreground text-sm ${errors.timeHours ? 'border-red-500' : 'border-border'}`}
          />
          {errors.timeHours && <div className="text-[10px] text-red-400 mt-0.5">{errors.timeHours}</div>}
        </div>
      </div>

      {/* Multi-Task Input */}
      <div className="border-t border-border pt-3">
        <label className="text-[11px] text-muted-foreground block mb-1">Tasks (multiple allowed) *</label>
        <div className="flex gap-2">
          <input
            placeholder="Enter task description"
            value={currentTask}
            onChange={e => setCurrentTask(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTask(); } }}
            className="flex-1 bg-card border border-border rounded px-2 py-1.5 text-foreground text-sm"
          />
          <button
            onClick={addTask}
            disabled={!currentTask.trim()}
            className={`px-3 py-1.5 rounded text-sm ${currentTask.trim() ? 'bg-emerald-600 hover:bg-emerald-700 text-foreground' : 'bg-muted text-muted-foreground cursor-not-allowed'}`}
          >
            Add Task
          </button>
        </div>
        {tasks.length > 0 && (
          <div className="mt-2 space-y-1">
            {tasks.map((task, idx) => (
              <div key={idx} className="flex items-center justify-between bg-card/60 rounded px-2 py-1.5 text-sm text-foreground">
                <span className="flex-1">{idx + 1}. {task}</span>
                <button
                  onClick={() => removeTask(idx)}
                  className="text-red-400 hover:text-red-300 ml-2 font-bold"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        {tasks.length === 0 && <div className="text-[10px] text-red-400 mt-1">{errors.tasks || 'No tasks added yet'}</div>}
      </div>

      {submitMessage && (
        <div className={`p-2 rounded ${submitMessage.type === 'error' ? 'bg-red-700/30 border border-red-600 text-red-200' : 'bg-green-700/20 border border-green-600 text-green-200'}`}>
          {submitMessage.text}
        </div>
      )}

      <div>
        <button
          className={`px-4 py-2 rounded text-foreground ${loading ? 'bg-muted cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
          onClick={validateAndAdd}
          disabled={loading}
        >
          {loading ? 'Adding...' : 'Add Scheduled Maintenance'}
        </button>
      </div>

      {/* Asset Picker Modal (replaced with the same Asset List UI + selection checkboxes) */}
      {showAssetPicker && (
        <AssetListSelectionModal
          projectId={projectId}
          viewer={viewer}
          initialCategory={f.revitCategory}
          initialIfcClass={f.ifcClass}
          multi={true}
          onClose={() => setShowAssetPicker(false)}
          onConfirm={(picked) => {
            console.log('[ScheduledMaintenance] onConfirm: picked assets count =', picked.length);
            picked.forEach((asset, idx) => {
              console.log(`[ScheduledMaintenance] Asset ${idx}:`, {
                id: asset.id,
                assetName: asset.assetName,
                assetCode: asset.assetCode,
                category: asset.category,
                type: asset.type,
                location: asset.location,
                source: asset.source
              });
            });
            
            const next = picked.map(asset => {
              // Display Asset Code in the Assets section (as per client requirement)
              // Priority: assetCode > type > assetName > category
              const displayName = asset.assetCode?.trim() 
                ? asset.assetCode 
                : asset.type?.trim() 
                ? asset.type 
                : asset.assetName?.trim()
                ? asset.assetName
                : asset.category || `Asset ${asset.id}`;
              
              console.log(`[ScheduledMaintenance] Mapping asset to displayName (Asset Code): "${displayName}"`, {
                assetCode: asset.assetCode,
                type: asset.type,
                assetName: asset.assetName,
                category: asset.category
              });
              
              return {
                label: displayName,
                type: asset.type || asset.category || '',
                id: asset.id,
                // Store full asset record for reference
                assetRecord: asset
              };
            });
            
            console.log('[ScheduledMaintenance] Mapped next items:', next.map(n => ({ label: n.label, id: n.id })));
            
            setSelectedAssets(prev => {
              const map = new Map<string, any>();
              [...prev, ...next].forEach(a => map.set((a.id || a.label)!, a));
              const result = Array.from(map.values());
              console.log('[ScheduledMaintenance] Updated selectedAssets count:', result.length);
              return result;
            });
            if (!allowedAssetType && next[0]?.type) setAllowedAssetType(next[0].type || null);
            setSubmitMessage(null);
            setErrors(prev => ({ ...prev, asset: '' }));
          }}
        />
      )}
    </div>
  );
};

