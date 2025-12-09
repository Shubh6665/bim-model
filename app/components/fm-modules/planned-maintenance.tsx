"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { X, Wrench, ClipboardList, CalendarClock } from "lucide-react";
import { load, save, K, REVIT_CATEGORIES, IFCCLASSES_UNIQUE, stripRevitPrefix } from "../fm-panel-utils";
import { CATEGORY_MAPPING } from "../../services/asset-extraction-service";
import type { AssetRecord, ScheduledItem, WorkOrderItem } from "../fm-panel-types";

interface PlannedMaintenanceProps {
  projectId?: string;
  viewer?: any;
}

export 
const PlannedMaintenance: React.FC<{ projectId?: string; viewer?: any; }> = ({ projectId, viewer }) => {
  // Fetch from DB only - no localStorage caching
  const [scheduled, setScheduled] = useState<ScheduledItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<'asset' | 'tasks' | null>(null);
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const [editTaskInput, setEditTaskInput] = useState('');
  const [historyFor, setHistoryFor] = useState<ScheduledItem | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyOrders, setHistoryOrders] = useState<WorkOrderItem[]>([]);
  // Filters
  const [filters, setFilters] = useState<{ search: string; discipline: string; revitCategory: string; ifcClass: string; level: string; room: string }>(
    { search: '', discipline: 'all', revitCategory: 'all', ifcClass: 'all', level: 'all', room: 'all' }
  );
  // Cache of computed Level/Room for assets (viewer-assisted lookups)
  const [assetLocCache, setAssetLocCache] = useState<Record<string, { level?: string; room?: string }>>({});
  
  // Helper: find asset by label appearing in scheduled.asset list
  const findAssetByLabel = React.useCallback((label?: string): AssetRecord | undefined => {
    if (!label) return undefined;
    const key = String(label).trim().toLowerCase();
    // exact matches first
    let found = assets.find(a => (a.assetName || '').toLowerCase() === key || (a.assetCode || '').toLowerCase() === key);
    if (found) return found;
    // containment matches
    found = assets.find(a => (a.assetName || '').toLowerCase().includes(key) || (a.assetCode || '').toLowerCase().includes(key));
    return found;
  }, [assets]);

  // Expand rows: for items with multiple assets, create one row per asset
  const expandedRows = React.useMemo(() => {
    const out: Array<{ base: ScheduledItem; assetLabel: string; level: string; room: string; asset?: AssetRecord }>[] = [] as any;
    const rows: Array<{ base: ScheduledItem; assetLabel: string; level: string; room: string; asset?: AssetRecord } > = [];
    for (const s of scheduled) {
      const labels = Array.isArray(s.asset) ? s.asset : [s.asset].filter(Boolean) as string[];
      if (!labels.length) {
        rows.push({ base: s, assetLabel: '—', level: '—', room: '—', asset: undefined });
        continue;
      }
      for (const lab of labels) {
        const a = findAssetByLabel(lab);
        let level = '—';
        let room = '—';
        if (a?.location) {
          const loc = String(a.location);
          // Special handling for Italian "Piano Terra" which is often part of the level name but split by " - "
          if (loc.toLowerCase().includes('piano terra')) {
             level = loc; // The whole string is the level
             room = '—';  // No room info in this string
          } else {
             const parts = loc.split(' - ').map(p => p.trim()).filter(Boolean);
             if (parts.length >= 1) level = parts[0];
             if (parts.length >= 2) room = parts[1];
          }
        }
        // Use cached viewer-derived level/room when not available from location
        const cacheKey = a ? (a.id || `db-${a.dbId}`) : lab;
        if ((level === '—' || !level) && cacheKey && assetLocCache[cacheKey]?.level) level = assetLocCache[cacheKey].level as string;
        if ((room === '—' || !room) && cacheKey && assetLocCache[cacheKey]?.room) room = assetLocCache[cacheKey].room as string;
        rows.push({ base: s, assetLabel: lab, level, room, asset: a });
      }
    }
    return rows;
  }, [scheduled, findAssetByLabel, assetLocCache]);

  // Unique values for filter dropdowns
  const uniqueDisciplines = React.useMemo(() => Array.from(new Set(scheduled.map(s => s.discipline).filter(Boolean))) as string[], [scheduled]);
  // Use canonical Revit categories and IFC classes lists directly
  const uniqueRevitCategories = React.useMemo(() => REVIT_CATEGORIES, []);
  const uniqueIfcClasses = React.useMemo(() => IFCCLASSES_UNIQUE, []);
  const uniqueLevels = React.useMemo(() => Array.from(new Set(expandedRows.map(r => r.level).filter(v => v && v !== '—'))) as string[], [expandedRows]);
  const uniqueRooms = React.useMemo(() => Array.from(new Set(expandedRows.map(r => r.room).filter(v => v && v !== '—'))) as string[], [expandedRows]);

  // Apply filters
  const filteredRows = React.useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return expandedRows.filter(r => {
      if (filters.discipline !== 'all' && r.base.discipline !== filters.discipline) return false;
      // Revit Category filter: check asset.category first, fallback to scheduled.category
      if (filters.revitCategory !== 'all') {
        const cat = (r.asset?.category || r.base.category || '').toLowerCase();
        const sel = filters.revitCategory.toLowerCase();
        if (!(cat === sel || cat.includes(sel) || sel.includes(cat))) return false;
      }
      // IFC Class filter: match any candidate fields available on asset
      if (filters.ifcClass !== 'all') {
        const sel = filters.ifcClass.toLowerCase();
        const arr = (r.asset && (((r.asset as any).ifcCandidates as string[] | undefined) || [ (r.asset as any).ifcClass, (r.asset as any).ifcType, (r.asset as any).ifcPredefined ].filter(Boolean) as string[])) || [];
        const ok = arr.some(c => String(c || '').toLowerCase().includes(sel));
        if (!ok) return false;
      }
      if (filters.level !== 'all' && r.level !== filters.level) return false;
      if (filters.room !== 'all' && r.room !== filters.room) return false;
      if (search) {
        const blob = [r.assetLabel, r.base.code, r.base.category, r.base.discipline].join(' ').toLowerCase();
        if (!blob.includes(search)) return false;
      }
      return true;
    });
  }, [expandedRows, filters]);

  // Viewer selection for highlight
  const selectRowAssetInViewer = React.useCallback((row: { asset?: AssetRecord }) => {
    try {
      if (!viewer || !row.asset || row.asset.dbId == null) return;
      const allModels: any[] = typeof (viewer as any).getAllModels === 'function'
        ? ((viewer as any).getAllModels() || [])
        : [viewer.model].filter(Boolean);
      const target = (row.asset.modelId != null)
        ? (allModels.find(m => (typeof m.getModelId === 'function' ? m.getModelId() : m?.id) === row.asset!.modelId))
        : null;
      const m = target || viewer.model;
      if (!m) return;
      try {
        if (typeof (viewer as any).select === 'function') {
          (viewer as any).select([row.asset.dbId], m);
        }
        if (typeof (viewer as any).fitToView === 'function') {
          (viewer as any).fitToView([row.asset.dbId], m);
        }
      } catch {}
    } catch {}
  }, [viewer]);
  
  const [edit, setEdit] = useState<{ discipline: string; category: string; code: string; assetType: string; assetsText: string; tasksText: string; frequency: string; timeHours: string; level: string; room: string }>({
    discipline: '', category: '', code: '', assetType: '', assetsText: '', tasksText: '', frequency: '', timeHours: '', level: '', room: ''
  });

  const disciplineOptions = ['Architecture', 'Structure', 'Mechanical System', 'Electrical System', 'Plumbing System', 'Fire Protection', 'Elevator System', 'Safety', 'IT/Technology', 'Other'];
  const categoryOptions = React.useMemo(() => {
    return Object.entries(CATEGORY_MAPPING).map(([italian, mapping]) => `${italian} / ${mapping.english} (${mapping.ifc})`);
  }, []);

  // Load scheduled maintenance from database
  useEffect(() => {
    if (!projectId) {
      const loaded = load(K.scheduled(projectId), [] as ScheduledItem[]);
      setScheduled(loaded);
      return;
    }

    const fetchScheduledMaintenance = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/projects/${projectId}/scheduled-maintenance`);
        if (res.ok) {
          const data = await res.json();
          setScheduled(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error('Failed to load scheduled maintenance for planned view:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchScheduledMaintenance();
  }, [projectId]);

  // Load available assets
  useEffect(() => {
    if (!projectId) return;
    
    const fetchAssets = async () => {
      setAssetsLoading(true);
      try {
        const res = await fetch(`/api/projects/${projectId}/assets`);
        if (res.ok) {
          const data = await res.json();
          setAssets(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error('Failed to load assets:', err);
      } finally {
        setAssetsLoading(false);
      }
    };

    fetchAssets();
  }, [projectId]);

  // Viewer-assisted Level/Room enrichment for assets missing clear location
  useEffect(() => {
    let aborted = false;
    const run = async () => {
      try {
        if (!viewer || !assets || assets.length === 0) return;

        // Optimization: Only process assets that are actually used in the scheduled maintenance list
        const relevantAssets = new Set<AssetRecord>();
        scheduled.forEach(s => {
            const labels = Array.isArray(s.asset) ? s.asset : [s.asset].filter(Boolean) as string[];
            labels.forEach(lab => {
                const key = String(lab).trim().toLowerCase();
                // Exact match
                let found = assets.find(a => (a.assetName || '').toLowerCase() === key || (a.assetCode || '').toLowerCase() === key);
                // Containment match fallback
                if (!found) {
                    found = assets.find(a => (a.assetName || '').toLowerCase().includes(key) || (a.assetCode || '').toLowerCase().includes(key));
                }
                if (found) relevantAssets.add(found);
            });
        });
        const relevantAssetsArray = Array.from(relevantAssets);

        const allModels: any[] = typeof (viewer as any).getAllModels === 'function'
          ? ((viewer as any).getAllModels() || [])
          : [viewer.model].filter(Boolean);
        const modelById = (mid: number | undefined) => {
          if (mid == null) return viewer.model;
          return allModels.find(m => (typeof m.getModelId === 'function' ? m.getModelId() : m?.id) === mid) || viewer.model;
        };

        // Pick assets lacking level or room in location string
        const todo = relevantAssetsArray.filter(a => {
          const loc = String(a.location || '') || '';
          
          // Special check: if location is "0 - Piano Terra", we have level but we are missing room
          const isPianoTerra = loc.toLowerCase().includes('piano terra');
          
          const hasLevel = !!loc && loc.includes(' - ') ? true : !!loc; 
          const needLevel = !hasLevel;
          // If it's Piano Terra, we definitely need to look up the room
          const needRoom = !loc.includes(' - ') || isPianoTerra;
          
          const cacheKey = a.id || `db-${a.dbId}`;
          const cached = cacheKey && assetLocCache[cacheKey];
          return (needLevel || needRoom) && !cached && a.dbId != null;
        }).slice(0, 50); // Reduced batch size for responsiveness

        if (!todo.length) return;

        const next: Record<string, { level?: string; room?: string }> = {};
        for (const a of todo) {
          if (aborted) break;
          try {
            const m = modelById(a.modelId as number | undefined);
            if (!m || typeof m.getProperties !== 'function' || a.dbId == null) continue;
            const props: any = await new Promise(resolve => m.getProperties(a.dbId as number, resolve));
            const getProp = (names: string[]): string | undefined => {
              // Check names in order of priority to get the most descriptive value
              for (const name of names) {
                 const p = props?.properties?.find((p: any) => p.displayName?.toLowerCase() === name.toLowerCase());
                 if (p?.displayValue) return p.displayValue.toString();
              }
              return undefined;
            };

            // Prioritize descriptive level names for Italian models (Livello abaco often has full name)
            let level = getProp(['Livello abaco', 'Schedule Level', 'Livello', 'Base Level', 'Reference Level', 'Level', 'Piano']);
            
            // Prefer descriptive level: if numeric only, try alternative occurrences
            if (!level || /^\d+(\.\d+)?$/.test(level)) {
              try {
                const levelProps = (props?.properties || []).filter((p: any) => (p.displayName || '').toString().toLowerCase() === 'level');
                const preferred = levelProps.find((p: any) => p.type === 20 || (p.displayCategory || '').toString().toLowerCase() === 'constraints')
                  || levelProps[levelProps.length - 1];
                if (preferred && preferred.displayValue != null) level = preferred.displayValue.toString();
              } catch {}
            }

            let room = getProp(['Room','Space','Locale','Stanza']);
            
            // Fix: "Piano Terra" is a level, not a room. If room detects as a level name, ignore it.
            if (room && (/piano\s+terra/i.test(room) || (level && room === level))) {
                room = undefined;
            }

            if ((!room || room.trim() === '') && (window as any).sensorContext?.findRoomForObject) {
              try {
                const roomData = await (window as any).sensorContext.findRoomForObject(a.dbId);
                if (roomData?.roomName) room = roomData.roomName;
                else if (roomData?.name) room = roomData.name;
              } catch {}
            }

            const key = a.id || `db-${a.dbId}`;
            next[key] = { level, room };
            // Throttle slightly to keep UI smooth
            await new Promise(r => setTimeout(r, 5));
          } catch { }
        }

        if (!aborted && Object.keys(next).length) {
          setAssetLocCache(prev => ({ ...prev, ...next }));
        }
      } catch { }
    };
    run();
    return () => { aborted = true; };
  }, [viewer, assets, assetLocCache, scheduled]);

  // Open and load maintenance history for an item (within PlannedMaintenance)
  const openHistory = async (item: ScheduledItem) => {
    try {
      setHistoryFor(item);
      setHistoryLoading(true);
      let orders: WorkOrderItem[] = [];
      if (projectId) {
        try {
          const res = await fetch(`/api/projects/${projectId}/work-orders`);
          if (res.ok) {
            const data = await res.json();
            orders = Array.isArray(data) ? data : [];
          }
        } catch (e) {
          console.error('Failed to load work orders for history', e);
        }
      }
      if (!orders.length) {
        orders = load(K.workOrders(projectId), [] as WorkOrderItem[]);
      }
      const assetNames = Array.isArray(item.asset) ? item.asset : [item.asset].filter(Boolean) as string[];
      const code = item.code || '';
      const lowerAssets = new Set(assetNames.map(a => String(a).toLowerCase()));
      const filtered = orders.filter(o => {
        const asset = (o.asset || '').toLowerCase();
        const desc = (o.description || '').toLowerCase();
        const loc = (o.location || '').toLowerCase();
        const matchAsset = asset && [...lowerAssets].some(a => asset.includes(a));
        const matchCode = code && (asset.includes(code.toLowerCase()) || desc.includes(code.toLowerCase()) || loc.includes(code.toLowerCase()));
        return matchAsset || matchCode;
      });
      const toDate = (s?: string) => (s ? new Date(s).getTime() : 0);
      filtered.sort((a, b) => (toDate(b.resolvedAt) || toDate(b.updatedAt) || toDate(b.createdAt)) - (toDate(a.resolvedAt) || toDate(a.updatedAt) || toDate(a.createdAt)));
      setHistoryOrders(filtered);
    } finally {
      setHistoryLoading(false);
    }
  };

  const beginEditAsset = (item: ScheduledItem) => {
    setEditingId(item.id);
    setEditMode('asset');
    setEdit({
      discipline: item.discipline || '',
      category: item.category || '',
      code: item.code || '',
      assetType: item.category || '',
      assetsText: Array.isArray(item.asset) ? item.asset.join('\n') : (item.asset || ''),
      tasksText: Array.isArray(item.tasks) ? item.tasks.join('\n') : '',
      frequency: String(item.frequency ?? ''),
      timeHours: String(item.timeHours ?? ''),
      level: '',
      room: ''
    });
  };

  const beginEditTasks = (item: ScheduledItem) => {
    setEditingId(item.id);
    setEditMode('tasks');
    setEdit({
      discipline: item.discipline || '',
      category: item.category || '',
      code: item.code || '',
      assetType: item.category || '',
      assetsText: Array.isArray(item.asset) ? item.asset.join('\n') : (item.asset || ''),
      tasksText: Array.isArray(item.tasks) ? item.tasks.join('\n') : '',
      frequency: String(item.frequency ?? ''),
      timeHours: String(item.timeHours ?? ''),
      level: '',
      room: ''
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditMode(null);
    setEdit({ discipline: '', category: '', code: '', assetType: '', assetsText: '', tasksText: '', frequency: '', timeHours: '', level: '', room: '' });
  };

  const saveEdit = async (id: string) => {
    const updated: ScheduledItem = {
      id,
      discipline: edit.discipline.trim(),
      category: edit.category.trim(),
      code: edit.code.trim(),
      asset: edit.assetsText.split('\n').map(s => s.trim()).filter(Boolean),
      tasks: edit.tasksText.split('\n').map(s => s.trim()).filter(Boolean),
      frequency: Number(edit.frequency) || 0,
      timeHours: Number(edit.timeHours) || 0,
    };

    try {
      if (projectId) {
        const res = await fetch(`/api/projects/${projectId}/scheduled-maintenance?id=${encodeURIComponent(id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updated)
        });
        if (res.ok) {
          const data = await res.json();
          const saved = (data?.item as any) || updated;
          setScheduled(prev => prev.map(it => it.id === id ? saved : it));
        } else {
          setScheduled(prev => prev.map(it => it.id === id ? updated : it));
        }
      } else {
        setScheduled(prev => {
          const next = prev.map(it => it.id === id ? updated : it);
          save(K.scheduled(projectId), next);
          return next;
        });
      }
    } catch (err) {
      console.error('Failed to update planned maintenance item:', err);
    } finally {
      cancelEdit();
    }
  };

  return (
    <div className="p-3 space-y-3 h-full flex flex-col overflow-hidden">
      {loading ? (
        <div className="text-center text-gray-400 text-sm py-4">Loading planned maintenance...</div>
      ) : scheduled.length === 0 ? (
        <div className="text-gray-400 text-sm bg-gray-800/30 rounded-lg p-4 text-center">
          No planned maintenance tasks.
        </div>
      ) : (
        <div className="flex-1 overflow-auto pr-2">
          {/* Table Header */}
          <div className="sticky top-0 bg-gray-900/90 border border-gray-700 rounded-t-lg mb-0 backdrop-blur supports-[backdrop-filter]:backdrop-blur z-10">
            {/* Top Row: Actions and Filters combined in a cleaner layout */}
            <div className="p-3 border-b border-gray-700 space-y-3">
              <div className="flex items-center justify-between">
                 <h3 className="text-sm font-semibold text-white">Planned Maintenance</h3>
                 <div className="flex gap-2">
                    <input 
                      value={filters.search} 
                      onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))} 
                      placeholder="Search..." 
                      className="px-3 py-1.5 bg-gray-800 border border-gray-600 rounded text-xs text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none w-48" 
                    />
                 </div>
              </div>
              
              <div className="grid grid-cols-5 gap-3">
                <select value={filters.discipline} onChange={e => setFilters(prev => ({ ...prev, discipline: e.target.value }))} className="bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none">
                  <option value="all">All Disciplines</option>
                  {uniqueDisciplines.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <select value={filters.revitCategory} onChange={e => setFilters(prev => ({ ...prev, revitCategory: e.target.value }))} className="bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none">
                  <option value="all">All Categories</option>
                  {uniqueRevitCategories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={filters.ifcClass} onChange={e => setFilters(prev => ({ ...prev, ifcClass: e.target.value }))} className="bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none">
                  <option value="all">All IFC Classes</option>
                  {uniqueIfcClasses.map(ic => <option key={ic} value={ic}>{ic}</option>)}
                </select>
                <select value={filters.level} onChange={e => setFilters(prev => ({ ...prev, level: e.target.value }))} className="bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none">
                  <option value="all">All Levels</option>
                  {uniqueLevels.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
                <select value={filters.room} onChange={e => setFilters(prev => ({ ...prev, room: e.target.value }))} className="bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none">
                  <option value="all">All Rooms</option>
                  {uniqueRooms.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>

            {/* Column Headers */}
            <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-semibold text-gray-400 bg-gray-800/50">
              <div className="col-span-1 whitespace-nowrap">Actions</div>
              <div className="col-span-2 whitespace-nowrap">Discipline</div>
              <div className="col-span-2 whitespace-nowrap">Category</div>
              <div className="col-span-1 whitespace-nowrap">Asset Type</div>
              <div className="col-span-1 whitespace-nowrap">Code</div>
              <div className="col-span-1 whitespace-nowrap">Asset</div>
              <div className="col-span-1 whitespace-nowrap">Level</div>
              <div className="col-span-1 whitespace-nowrap">Room</div>
              <div className="col-span-1 whitespace-nowrap">Frequency</div>
              <div className="col-span-1 whitespace-nowrap">Time</div>
            </div>
          </div>

          {/* Table Rows */}
          <div className="space-y-0 border border-gray-700 border-t-0 rounded-b-lg overflow-hidden bg-gray-800/20">
            {filteredRows.map((row, idx) => (
              <div
                key={`${row.base.id}-${row.assetLabel}-${idx}`}
                className={`grid grid-cols-12 gap-2 px-3 py-2.5 items-center border-b border-gray-700/50 hover:bg-gray-700/20 transition-colors ${
                  idx === filteredRows.length - 1 ? 'border-b-0' : ''
                }`}
              >
                {/* Action Buttons */}
                <div className="col-span-1 flex gap-1 justify-start">
                  <button
                    onClick={() => beginEditAsset(row.base)}
                    className="p-1.5 rounded bg-blue-600/80 hover:bg-blue-500 text-white transition-colors"
                    title="Edit asset information"
                  >
                    <Wrench size={14} />
                  </button>
                  <button
                    onClick={() => beginEditTasks(row.base)}
                    className="p-1.5 rounded bg-green-600/80 hover:bg-green-500 text-white transition-colors"
                    title="Edit maintenance tasks"
                  >
                    <ClipboardList size={14} />
                  </button>
                  <button
                    onClick={() => openHistory(row.base)}
                    className="p-1.5 rounded bg-purple-600/80 hover:bg-purple-500 text-white transition-colors"
                    title="View maintenance history"
                  >
                    <CalendarClock size={14} />
                  </button>
                </div>

                {/* Discipline */}
                <div className="col-span-2 text-xs text-gray-200 truncate">
                  {row.base.discipline || '—'}
                </div>

                {/* Category */}
                <div className="col-span-2 text-xs text-gray-300 truncate">
                  {row.base.category || '—'}
                </div>

                {/* Asset Type */}
                <div className="col-span-1 text-xs text-gray-300 truncate">
                  {row.base.category?.split('/')[0].trim() || '—'}
                </div>

                {/* Code */}
                <div className="col-span-1 text-xs text-blue-300 font-mono truncate">
                  {row.base.code || '—'}
                </div>

                {/* Asset */}
                <div className="col-span-1 text-xs text-gray-300 truncate cursor-pointer hover:text-white" onClick={() => selectRowAssetInViewer(row)} title="Click to highlight in model">
                  {row.assetLabel || '—'}
                </div>

                {/* Level */}
                <div className="col-span-1 text-xs text-gray-400">
                  {row.level || '—'}
                </div>

                {/* Room */}
                <div className="col-span-1 text-xs text-gray-400">
                  {row.room || '—'}
                </div>

                {/* Frequency */}
                <div className="col-span-1 text-xs text-emerald-300 whitespace-nowrap">
                  {row.base.frequency}/yr
                </div>

                {/* Time */}
                <div className="col-span-1 text-xs text-emerald-300 whitespace-nowrap">
                  {row.base.timeHours}h
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingId && editMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-[900px] max-w-full bg-gray-900 border border-gray-700 rounded-lg shadow-2xl max-h-[90vh] overflow-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-gray-900 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
              <div className="text-lg font-semibold text-white">
                {editMode === 'asset' ? '✎ Edit Asset Information' : editMode === 'tasks' ? '📋 Edit Maintenance Tasks' : 'Edit'}
              </div>
              <button
                onClick={cancelEdit}
                className="p-1.5 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="px-6 py-4 space-y-4">
              {editMode === 'asset' ? (
                <>
                  {/* Asset Edit Form */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-300 block mb-2 font-medium">Discipline</label>
                      <select
                        value={edit.discipline}
                        onChange={e => setEdit(v => ({ ...v, discipline: e.target.value }))}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm hover:border-gray-600 focus:border-blue-500 focus:outline-none"
                      >
                        <option value="">Select Discipline</option>
                        {disciplineOptions.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm text-gray-300 block mb-2 font-medium">Category</label>
                      <select
                        value={edit.category}
                        onChange={e => setEdit(v => ({ ...v, category: e.target.value }))}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm hover:border-gray-600 focus:border-blue-500 focus:outline-none"
                      >
                        <option value="">Select Category</option>
                        {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm text-gray-300 block mb-2 font-medium">Code</label>
                      <input
                        type="text"
                        value={edit.code}
                        onChange={e => setEdit(v => ({ ...v, code: e.target.value }))}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm hover:border-gray-600 focus:border-blue-500 focus:outline-none"
                        placeholder="Enter asset code"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-300 block mb-2 font-medium">Asset Type</label>
                      <input
                        type="text"
                        value={edit.assetType}
                        onChange={e => setEdit(v => ({ ...v, assetType: e.target.value }))}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm hover:border-gray-600 focus:border-blue-500 focus:outline-none"
                        placeholder="Asset type"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm text-gray-300 block mb-2 font-medium">Assets</label>
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2 mb-3">
                        {(edit.assetsText.split('\n').map(s => s.trim()).filter(Boolean)).map((a, idx) => (
                          <div key={a + '-' + idx} className="inline-flex items-center bg-gray-800 text-gray-200 px-3 py-1 rounded text-sm border border-gray-700">
                            <span className="mr-2">{a}</span>
                            <button onClick={() => setEdit(v => ({ ...v, assetsText: v.assetsText.split('\n').map(s => s.trim()).filter(Boolean).filter((_, i) => i !== idx).join('\n') }))} className="text-red-400 hover:text-red-300 font-bold">×</button>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setShowAssetPicker(true)} className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm">Select from asset list</button>
                        <button onClick={() => setEdit(v => ({ ...v, assetsText: '' }))} className="px-3 py-2 rounded border border-gray-600 text-sm text-gray-200 hover:bg-gray-800">Clear</button>
                      </div>
                      <div>
                        <textarea
                          value={edit.assetsText}
                          onChange={e => setEdit(v => ({ ...v, assetsText: e.target.value }))}
                          className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm hover:border-gray-600 focus:border-blue-500 focus:outline-none"
                          placeholder="Enter assets (one per line)"
                          rows={3}
                        />
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Tasks Edit Form */}
                  <div>
                    <label className="text-sm text-gray-300 block mb-2 font-medium">Asset Code: {edit.code}</label>
                  </div>



                  <div>
                    <label className="text-sm text-gray-300 block mb-2 font-medium">Maintenance Tasks</label>
                    <div className="space-y-2">
                      <ul className="space-y-2 mb-3">
                        {(edit.tasksText.split('\n').map(s => s.trim()).filter(Boolean)).map((t, idx) => (
                          <li key={t + '-' + idx} className="flex items-center justify-between bg-gray-800 px-3 py-2 rounded text-sm text-gray-200 border border-gray-700">
                            <span className="flex-1">{t}</span>
                            <button onClick={() => setEdit(v => ({ ...v, tasksText: v.tasksText.split('\n').map(s => s.trim()).filter(Boolean).filter((_, i) => i !== idx).join('\n') }))} className="text-red-400 hover:text-red-300 ml-2 font-bold">Remove</button>
                          </li>
                        ))}
                      </ul>
                      <div className="flex gap-2">
                        <input
                          value={editTaskInput}
                          onChange={e => setEditTaskInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const t = editTaskInput.trim();
                              if (t) {
                                setEdit(v => ({ ...v, tasksText: (v.tasksText ? v.tasksText + '\n' : '') + t }));
                                setEditTaskInput('');
                              }
                            }
                          }}
                          placeholder="New task"
                          className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
                        />
                        <button
                          onClick={() => {
                            const t = editTaskInput.trim();
                            if (t) {
                              setEdit(v => ({ ...v, tasksText: (v.tasksText ? v.tasksText + '\n' : '') + t }));
                              setEditTaskInput('');
                            }
                          }}
                          className="px-3 py-2 rounded bg-green-600 hover:bg-green-700 text-white text-sm"
                        >
                          Add Task
                        </button>
                        <button onClick={() => setEdit(v => ({ ...v, tasksText: '' }))} className="px-3 py-2 rounded border border-gray-600 text-sm text-gray-200 hover:bg-gray-800">Clear</button>
                      </div>
                      <div>
                        <textarea
                          value={edit.tasksText}
                          onChange={e => setEdit(v => ({ ...v, tasksText: e.target.value }))}
                          className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm hover:border-gray-600 focus:border-blue-500 focus:outline-none"
                          placeholder="Enter tasks (one per line)"
                          rows={4}
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
                                <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-300 block mb-2 font-medium">Frequency (per year)</label>
                      <input
                        type="number"
                        value={edit.frequency}
                        onChange={e => setEdit(v => ({ ...v, frequency: e.target.value }))}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm hover:border-gray-600 focus:border-blue-500 focus:outline-none"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-300 block mb-2 font-medium">Time per Intervention (hours)</label>
                      <input
                        type="number"
                        value={edit.timeHours}
                        onChange={e => setEdit(v => ({ ...v, timeHours: e.target.value }))}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm hover:border-gray-600 focus:border-blue-500 focus:outline-none"
                        placeholder="0"
                      />
                    </div>
                  </div>
            </div>
            

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-gray-900 border-t border-gray-700 px-6 py-4 flex gap-2 justify-end">
              <button
                onClick={cancelEdit}
                className="px-4 py-2 text-sm rounded border border-gray-600 text-gray-200 hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => saveEdit(editingId!)}
                className="px-4 py-2 text-sm rounded bg-blue-600 hover:bg-blue-700 text-white transition-colors font-medium"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Asset Picker Modal */}
      {showAssetPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="w-[800px] max-w-full bg-gray-900 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-white font-semibold">Select assets (category: {edit.category || 'All'})</div>
              <button onClick={() => setShowAssetPicker(false)} className="px-2 py-1 rounded border border-gray-600 text-gray-200">Close</button>
            </div>
            <div className="h-[420px] overflow-auto">
              {assetsLoading ? (
                <div className="text-gray-400">Loading...</div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {(() => {
                    // Build token map like scheduled maintenance picker
                    const masterMap = new Map<string, string[]>();
                    for (const [italian, mapping] of Object.entries(CATEGORY_MAPPING)) {
                      const label = `${italian} / ${mapping.english} (${mapping.ifc})`;
                      masterMap.set(label, [italian, mapping.english, mapping.ifc].filter(Boolean) as string[]);
                    }
                    const tokens = masterMap.get(edit.category) || [];
                    const filtered = tokens.length
                      ? assets.filter(a => a.category && tokens.some(t => String(a.category).toLowerCase().includes(String(t).toLowerCase())))
                      : assets;
                    return filtered.map(a => {
                      const display = a.assetName || a.assetCode || a.id;
                      const already = edit.assetsText.split('\n').map(s => s.trim()).filter(Boolean).includes(display);
                      const canAdd = tokens.length === 0 || (a.category && tokens.some(t => String(a.category).toLowerCase().includes(String(t).toLowerCase())));
                      // Try to infer canonical label for this asset's category
                      let bestLabel: string | null = null;
                      for (const [label, toks] of masterMap.entries()) {
                        if (a.category && toks.some(t => String(a.category).toLowerCase().includes(String(t).toLowerCase()))) {
                          bestLabel = label;
                          break;
                        }
                      }
                      return (
                        <div key={a.id} className="flex items-center justify-between bg-gray-800/50 p-2 rounded border border-gray-700">
                          <div>
                            <div className="text-sm text-gray-200">{display}</div>
                            <div className="text-xs text-gray-400">{a.category} • {a.location || '—'}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              disabled={already || !canAdd}
                              onClick={() => {
                                const list = edit.assetsText.split('\n').map(s => s.trim()).filter(Boolean);
                                if (!list.includes(display)) {
                                  const next = [...list, display];
                                  setEdit(v => ({ ...v, assetsText: next.join('\n'), category: v.category || (bestLabel || '') }));
                                }
                              }}
                              className={`px-2 py-1 rounded text-white ${already ? 'bg-gray-600 cursor-not-allowed' : canAdd ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-700 cursor-not-allowed'}`}
                              title={already ? 'Already added' : canAdd ? 'Add asset' : 'Category mismatch'}
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {historyFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-[900px] max-w-full bg-gray-900 border border-gray-700 rounded-lg shadow-2xl max-h-[90vh] overflow-auto">
            <div className="sticky top-0 bg-gray-900 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
              <div className="text-lg font-semibold text-white">Maintenance History — {historyFor.code || historyFor.category}</div>
              <button onClick={() => { setHistoryFor(null); setHistoryOrders([]); }} className="p-1.5 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="px-6 py-4">
              {historyLoading ? (
                <div className="text-gray-400">Loading history…</div>
              ) : historyOrders.length === 0 ? (
                <div className="text-gray-400">No history found for selected asset(s).</div>
              ) : (
                <div className="space-y-2">
                  {historyOrders.map(h => (
                    <div key={h.id} className="bg-gray-800/50 rounded border border-gray-700 p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-200 font-medium">{h.requestId || h.id} • {h.asset || h.location || '—'}</div>
                        <div className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-200">{h.status}</div>
                      </div>
                      <div className="text-xs text-gray-300 mt-1">{h.description || '—'}</div>
                      <div className="text-xs text-gray-500 mt-1">Resolved: {h.resolvedAt || '—'}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}