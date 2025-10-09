"use client";

import React, { useEffect, useState } from "react";
import { UniversalAssetExtractor, UniversalAsset } from "../services/universal-asset-extractor";

// Extended models
interface FMPanelProps { projectId?: string; viewer?: any; }

// Extended Asset Record with all fields from asset_register_facility_manager_template_extended
interface AssetRecord { 
  id: string; 
  // Identification and Registry
  assetCode?: string;
  assetName?: string;
  category?: string; 
  type?: string; 
  brand?: string; 
  model?: string; 
  serialNumber?: string;
  installationDate?: string;
  // Classification (from universal extractor)
  assetClassification?: 'STRUCTURAL' | 'ARCHITECTURAL' | 'MEP' | 'FURNITURE' | 'EQUIPMENT' | 'OTHER';
  // Technical and Construction Data
  material?: string;
  dimensions?: string;
  weight?: string;
  capacity?: string;
  powerRating?: string;
  // Documentation
  manuals?: string;
  warranties?: string;
  certifications?: string;
  // Status and Lifecycle
  condition?: string;
  serviceDate?: string;
  expectedLife?: string;
  // Maintenance Management
  maintenanceSchedule?: string;
  lastService?: string;
  nextService?: string;
  // Economic Aspects
  purchaseCost?: string;
  maintenanceCost?: string;
  // Compliance and Safety
  regulations?: string;
  safetyNotes?: string;
  // Links and Relationships
  parentAsset?: string;
  location?: string;
  suppliers?: string;
  description?: string; 
  dbId?: number | null;
  source?: 'BIM_MODEL' | 'MANUAL';
  // Optional 3D placeholder for manual assets
  placeholderX?: number;
  placeholderY?: number;
  placeholderZ?: number;
  placeholderShape?: 'cube' | 'sphere';
  // Conflict indicator
  conflictWithId?: string;
}

interface SpaceRecord { 
  id: string; 
  level?: string; 
  name?: string; 
  area?: number; 
  spaceCode?: string;
  building?: string;
  description?: string; 
}

interface ScheduledItem { 
  id: string; 
  discipline: string; 
  category: string; 
  code: string; 
  asset: string; 
  task: string; 
  frequency: string; 
  timeHours: string; 
}

interface TicketItem { 
  id: string; 
  ticketCode?: string;
  qrCode?: string;
  requester: { 
    name: string; 
    surname: string; 
    contact: string; 
  };
  location?: {
    building?: string;
    level?: string;
    room?: string;
    spaceCode?: string;
  };
  intervention?: {
    discipline?: string;
    category?: string;
    item?: string;
    descriptionShort?: string;
    descriptionDetailed?: string;
    attachments?: string[];
  };
  status?: "Open" | "Planned" | "In Progress" | "Resolved";
  createdAt?: string;
}

interface WorkOrderItem { 
  id: string; 
  requestId?: string;
  requester?: string;
  contact?: string;
  location?: string;
  interventionDetails?: string;
  discipline?: string;
  category?: string;
  description?: string;
  attachments?: string[];
  asset?: string;
  responsibleTechnician?: string;
  company?: string;
  status: "Open" | "Planned" | "In Progress" | "Resolved"; 
  sourceTicketId?: string;
}

type Section =
  | { group: "assets"; item: "asset-list" | "create-asset" }
  | { group: "spaces"; item: "space-list" | "create-space" }
  | { group: "maintenance"; item: "scheduled" | "ticket" | "work-orders" | "service-requests" | "reports" | "upcoming" | "ongoing" | "planned" };

const K = {
  assets: (pid?: string) => `fm-assets-${pid || 'global'}`,
  spaces: (pid?: string) => `fm-spaces-${pid || 'global'}`,
  scheduled: (pid?: string) => `fm-scheduled-${pid || 'global'}`,
  tickets: (pid?: string) => `fm-tickets-${pid || 'global'}`,
  workOrders: (pid?: string) => `fm-workorders-${pid || 'global'}`,
  serviceRequests: (pid?: string) => `fm-servicereq-${pid || 'global'}`,
  reports: (pid?: string) => `fm-reports-${pid || 'global'}`,
  upcoming: (pid?: string) => `fm-upcoming-${pid || 'global'}`,
  ongoing: (pid?: string) => `fm-ongoing-${pid || 'global'}`,
  planned: (pid?: string) => `fm-planned-${pid || 'global'}`,
};

function load<T>(key: string, def: T): T { if (typeof window === 'undefined') return def; try { const v = localStorage.getItem(key); return v ? JSON.parse(v) as T : def; } catch { return def; } }
function save<T>(key: string, val: T) { if (typeof window === 'undefined') return; try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }

const MenuButton: React.FC<{ label: string; active?: boolean; onClick: () => void }>=({label,active,onClick})=> (
  <button onClick={onClick} className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${active? 'bg-blue-600/20 text-blue-300 border border-blue-500/30':'text-gray-300 hover:text-white hover:bg-gray-800'}`}>{label}</button>
);

export default function FMPanel({ projectId, viewer }: FMPanelProps) {
  const [section, setSection] = useState<Section>({ group: 'assets', item: 'asset-list' });

  return (
    <div className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col h-full">
      <div className="p-4 border-b border-gray-800">
        <h2 className="text-xl font-bold text-white mb-3 text-center">FM</h2>
        <div className="flex gap-3 w-full">
          {(() => {
            const Btn = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
              <button
                className={`flex-1 py-2 px-3 text-sm rounded-md font-medium shadow transition ${active ? 'bg-blue-600 text-white' : 'bg-gray-700 text-blue-300 hover:bg-gray-600'}`}
                onClick={onClick}
              >
                {label}
              </button>
            );
            return (
              <>
                <Btn
                  label="Assets"
                  active={section.group === 'assets'}
                  onClick={() => setSection(prev => ({ group: 'assets', item: prev.group === 'assets' ? prev.item : 'asset-list' }))}
                />
                <Btn
                  label="Spaces"
                  active={section.group === 'spaces'}
                  onClick={() => setSection(prev => ({ group: 'spaces', item: prev.group === 'spaces' ? prev.item : 'space-list' }))}
                />
                <Btn
                  label="Maintenance"
                  active={section.group === 'maintenance'}
                  onClick={() => setSection(prev => ({ group: 'maintenance', item: prev.group === 'maintenance' ? prev.item : 'scheduled' }))}
                />
              </>
            );
          })()}
        </div>
      </div>

      {/* Sub-menu for the active group only */}
      <div className="p-2 border-b border-gray-800">
        {section.group === 'assets' && (
          <div className="grid grid-cols-2 gap-2">
            <MenuButton label="Asset list" active={section.item==='asset-list'} onClick={()=>setSection({group:'assets',item:'asset-list'})} />
            <MenuButton label="Create new asset" active={section.item==='create-asset'} onClick={()=>setSection({group:'assets',item:'create-asset'})} />
          </div>
        )}
        {section.group === 'spaces' && (
          <div className="grid grid-cols-1 gap-2">
            <MenuButton label="Space list" active={section.item==='space-list'} onClick={()=>setSection({group:'spaces',item:'space-list'})} />
            <MenuButton label="Create new space" active={section.item==='create-space'} onClick={()=>setSection({group:'spaces',item:'create-space'})} />
          </div>
        )}
        {section.group === 'maintenance' && (
          <div className="grid grid-cols-1 gap-2">
            <MenuButton label="Scheduled maintenance" active={section.item==='scheduled'} onClick={()=>setSection({group:'maintenance',item:'scheduled'})} />
            <MenuButton label="Ticket-based maintenance" active={section.item==='ticket'} onClick={()=>setSection({group:'maintenance',item:'ticket'})} />
            <MenuButton label="Work orders" active={section.item==='work-orders'} onClick={()=>setSection({group:'maintenance',item:'work-orders'})} />
            <MenuButton label="Service requests" active={section.item==='service-requests'} onClick={()=>setSection({group:'maintenance',item:'service-requests'})} />
            <MenuButton label="Maintenance reports" active={section.item==='reports'} onClick={()=>setSection({group:'maintenance',item:'reports'})} />
            <MenuButton label="Upcoming maintenance" active={section.item==='upcoming'} onClick={()=>setSection({group:'maintenance',item:'upcoming'})} />
            <MenuButton label="Ongoing maintenance" active={section.item==='ongoing'} onClick={()=>setSection({group:'maintenance',item:'ongoing'})} />
            <MenuButton label="Planned maintenance" active={section.item==='planned'} onClick={()=>setSection({group:'maintenance',item:'planned'})} />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-hidden flex flex-col px-4">
        <div className="flex-1 overflow-y-auto">
          {section.group==='assets' && section.item==='asset-list' && <AssetList projectId={projectId} viewer={viewer} />}
          {section.group==='assets' && section.item==='create-asset' && <CreateAsset projectId={projectId} />}
          {section.group==='spaces' && section.item==='space-list' && <SpaceList projectId={projectId} />}
          {section.group==='spaces' && section.item==='create-space' && <CreateSpace projectId={projectId} />}
          {section.group==='maintenance' && section.item==='scheduled' && <ScheduledMaintenance projectId={projectId} />}
          {section.group==='maintenance' && section.item==='ticket' && <TicketForm projectId={projectId} />}
          {section.group==='maintenance' && section.item==='work-orders' && <WorkOrders projectId={projectId} />}
          {section.group==='maintenance' && section.item==='service-requests' && <ServiceRequests projectId={projectId} />}
          {section.group==='maintenance' && section.item==='reports' && <MaintenanceReports projectId={projectId} />}
          {section.group==='maintenance' && section.item==='upcoming' && <UpcomingMaintenance projectId={projectId} />}
          {section.group==='maintenance' && section.item==='ongoing' && <OngoingMaintenance projectId={projectId} />}
          {section.group==='maintenance' && section.item==='planned' && <PlannedMaintenance projectId={projectId} />}
        </div>
      </div>
    </div>
  );
}

const AssetList: React.FC<{ projectId?: string; viewer?: any; }> = ({ projectId, viewer }) => {
  const [rows, setRows] = useState<AssetRecord[]>(() => load(K.assets(projectId), [] as AssetRecord[]));
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState(0);
  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
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
  const [filter, setFilter] = useState({ category: '', type: '', location: '', condition: '', classification: '' });
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  
  // Deduplicate any pre-existing duplicates on initial load
  useEffect(() => {
    setRows(prev => {
      const unique = Array.from(new Map(prev.map(a => [a.id, a])).values());
      if (unique.length !== prev.length) {
        save(K.assets(projectId), unique);
        return unique;
      }
      return prev;
    });
  }, [projectId]);
  
  // BIM Asset Extraction
  const extractAssetsFromBIM = async () => {
    if (!viewer || !viewer.model) {
      alert('No BIM model loaded. Please load a model first.');
      return;
    }

    setIsExtracting(true);
    setExtractionProgress(0);

    try {
      const { UniversalAssetExtractor } = await import('../services/universal-asset-extractor');
      const extractor = new UniversalAssetExtractor(viewer);
      
      const universalAssets = await extractor.extractUniversalAssets((progress, found, total) => {
        setExtractionProgress(progress);
      });

      // Helper to get property by display names
      const getProp = (props: any[], names: string[]): string | undefined => {
        const lower = names.map(n => n.toLowerCase());
        const p = props?.find(p => {
          const dn = p.displayName?.toLowerCase?.();
          if (!dn) return false;
          return lower.includes(dn) || lower.some(n => dn.includes(n));
        });
        return p?.displayValue?.toString();
      };

      // Convert UniversalAsset to AssetRecord format with enrichment
      const newAssets: AssetRecord[] = universalAssets.map(asset => {
        const props = (asset as any).properties || [];
        const brand = getProp(props, ['Manufacturer', 'Brand', 'Manufacturer Name']) || asset.family || 'Unknown';
        const model = getProp(props, ['Model', 'Type Name', 'Model Number']) || asset.type || 'Unknown';
        const serial = getProp(props, ['Serial Number', 'Serial']) || undefined;
        const installDate = getProp(props, ['Install Date', 'Installation Date']) || undefined;
        const power = getProp(props, ['Power', 'Power Rating', 'kW']) || undefined;
        const capacity = getProp(props, ['Capacity']) || undefined;
        const weight = getProp(props, ['Weight']) || undefined;
        const length = getProp(props, ['Length']) || undefined;
        const width = getProp(props, ['Width']) || undefined;
        const height = getProp(props, ['Height', 'Thickness']) || undefined;
        const dimensions = (length || width || height) ? `${length||''} x ${width||''} x ${height||''}`.replace(/\s+x\s+x\s+/,'').trim() : undefined;

        return {
          id: asset.id,
          dbId: asset.dbId,
          assetCode: `BIM-${asset.dbId}`,
          assetName: asset.name,
          category: asset.category,
          type: asset.type,
          brand,
          model,
          serialNumber: serial,
          installationDate: installDate,
          assetClassification: (asset as any).assetType,
          powerRating: power,
          capacity,
          weight,
          dimensions,
          material: asset.material,
          location: asset.location,
          description: `${asset.assetType} asset extracted from BIM model (${asset.confidence} confidence)`,
          condition: 'Good', // Default for BIM assets
          source: 'BIM_MODEL'
        } as AssetRecord;
      });

      // Merge with existing manual assets
      const existingManualAssets = rows.filter(r => r.source === 'MANUAL');
      const keyOf = (a: AssetRecord) => `${(a.category||'').toLowerCase()}|${(a.location||'').toLowerCase()}|${(a.model||a.assetName||'').toLowerCase()}`;

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

      // Keep existing non-manual (older BIM) assets separate to allow override by new extraction
      const others = rows.filter(r => r.source !== 'MANUAL');

      // Combine in order so that later entries override earlier ones for the same id
      // Order: previous BIM/others -> manual -> newly extracted BIM
      const combined = [...others, ...existingManualAssets, ...newAssets];

      // Deduplicate by stable id to avoid React duplicate key warnings (e.g., "universal-4087")
      const uniqueById = Array.from(new Map(combined.map(a => [a.id, a])).values());

      setRows(uniqueById);
      save(K.assets(projectId), uniqueById);
      
      alert(`✅ Successfully extracted ${newAssets.length} assets from BIM model!\n\nBreakdown:\n${
        Object.entries(
          newAssets.reduce((acc, asset) => {
            const type = asset.description?.includes('STRUCTURAL') ? 'Structural' :
                        asset.description?.includes('ARCHITECTURAL') ? 'Architectural' :
                        asset.description?.includes('MEP') ? 'MEP' :
                        asset.description?.includes('EQUIPMENT') ? 'Equipment' :
                        asset.description?.includes('FURNITURE') ? 'Furniture' : 'Other';
            acc[type] = (acc[type] || 0) + 1;
            return acc;
          }, {} as Record<string, number>)
        ).map(([type, count]) => `• ${type}: ${count}`).join('\n')
      }`);

    } catch (error) {
      console.error('Asset extraction failed:', error);
      alert('❌ Failed to extract assets from BIM model. Please check console for details.');
    } finally {
      setIsExtracting(false);
      setExtractionProgress(0);
    }
  };
  
  const onRowClick = (r: AssetRecord) => { 
    try { 
      if (!viewer || r.dbId==null) return; 
      viewer.select?.([r.dbId]); 
      viewer.fitToView?.([r.dbId]); 
    } catch {} 
  };
  
  const toggleField = (field: keyof typeof visibleFields) => {
    setVisibleFields(prev => ({ ...prev, [field]: !prev[field] }));
  };
  
  // Build distinct option lists for dropdown filters
  const distinct = {
    categories: Array.from(new Set(rows.map(r => r.category).filter(Boolean))).sort() as string[],
    types: Array.from(new Set(rows.map(r => r.type).filter(Boolean))).sort() as string[],
    locations: Array.from(new Set(rows.map(r => r.location).filter(Boolean))).sort() as string[],
    conditions: Array.from(new Set(rows.map(r => r.condition).filter(Boolean))).sort() as string[],
    classifications: Array.from(new Set(rows.map(r => r.assetClassification).filter(Boolean))).sort() as string[]
  };

  const filteredRows = rows.filter(r => {
    if (filter.category && !r.category?.toLowerCase().includes(filter.category.toLowerCase())) return false;
    if (filter.type && !r.type?.toLowerCase().includes(filter.type.toLowerCase())) return false;
    if (filter.location && !r.location?.toLowerCase().includes(filter.location.toLowerCase())) return false;
    if (filter.condition && !r.condition?.toLowerCase().includes(filter.condition.toLowerCase())) return false;
    if (filter.classification && (r.assetClassification||'').toLowerCase() !== filter.classification.toLowerCase()) return false;
    return true;
  });

  // Reset page when filters or page size change
  useEffect(() => { setPage(1); }, [filter.category, filter.type, filter.location, filter.condition, filter.classification, pageSize]);

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const pageClamped = Math.min(page, totalPages);
  const startIndex = (pageClamped - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedRows = filteredRows.slice(startIndex, endIndex);
  
  const applyFilterToViewer = () => {
    if (!viewer || filteredRows.length === 0) return;
    const dbIds = filteredRows.filter(r => r.dbId != null).map(r => r.dbId as number);
    if (dbIds.length > 0) {
      viewer.isolate?.(dbIds);
      viewer.fitToView?.(dbIds);
    }
  };

  // Export CSV of current assets
  const exportCSV = () => {
    const headers = [
      'id','assetCode','assetName','category','type','brand','model','serialNumber','installationDate',
      'material','dimensions','weight','capacity','powerRating','location','condition','source'
    ];
    const lines = [headers.join(',')];
    rows.forEach(r => {
      const vals = headers.map(h => {
        const v = (r as any)[h];
        const s = (v==null?'' : String(v));
        return '"' + s.replace(/"/g,'""') + '"';
      });
      lines.push(vals.join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'asset_register.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  // Manual asset placement (placeholder cube)
  const placeManual = (r: AssetRecord) => {
    if (!viewer) return;
    const container = viewer.container as HTMLElement;
    container.style.cursor = 'crosshair';
    const onClick = (ev: MouseEvent) => {
      container.removeEventListener('click', onClick, true);
      container.style.cursor = 'default';
      try {
        const res = viewer.impl.hitTest(ev.clientX, ev.clientY, true);
        if (!res || !res.point) return;
        const pt = res.point;
        // draw cube overlay
        const THREE = (window as any).THREE;
        if (THREE) {
          if (!(viewer as any)._fmOverlayCreated) {
            viewer.impl.createOverlayScene('fm-placeholders');
            (viewer as any)._fmOverlayCreated = true;
          }
          const geom = new THREE.BoxGeometry(0.3,0.3,0.3);
          const mat = new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.85 });
          const mesh = new THREE.Mesh(geom, mat);
          mesh.position.set(pt.x, pt.y, pt.z);
          viewer.impl.addOverlay('fm-placeholders', mesh);
          viewer.impl.invalidate(true);
        }
        // store coordinates
        setRows(prev => prev.map(a => a.id===r.id ? { ...a, placeholderX: pt.x, placeholderY: pt.y, placeholderZ: pt.z, placeholderShape: 'cube' } : a));
        save(K.assets(projectId), rows);
      } catch {}
    };
    container.addEventListener('click', onClick, true);
  };
  
  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-gray-800">
        <div className="flex items-center justify-between mb-2">
          <div className="text-white font-semibold text-sm">Asset List</div>
          <span className="text-[11px] px-2 py-0.5 rounded bg-gray-800 border border-gray-700 text-gray-300">{rows.length} items</span>
        </div>
        
        {/* BIM Asset Extraction */}
        <div className="mb-2">
          <button 
            onClick={extractAssetsFromBIM}
            disabled={isExtracting}
            className={`w-full text-xs py-2 px-3 rounded-md font-medium transition ${
              isExtracting 
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed' 
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {isExtracting ? `Extracting... ${extractionProgress.toFixed(0)}%` : 'Extract from BIM'}
          </button>
          {isExtracting && (
            <div className="mt-1 bg-gray-800 rounded-full h-1">
              <div 
                className="bg-green-500 h-1 rounded-full transition-all duration-300"
                style={{ width: `${extractionProgress}%` }}
              />
            </div>
          )}
        </div>

        {/* Controls: Show/Hide & Filters toggles */}
        <div className="grid grid-cols-2 gap-2">
          <button
            className={`w-full inline-flex items-center justify-center gap-1 text-xs px-2 py-1 rounded border ${fieldsOpen ? 'text-white border-gray-500 bg-gray-700' : 'text-gray-300 border-gray-700 bg-gray-800/60 hover:bg-gray-700'}`}
            onClick={() => { setFieldsOpen(true); setFiltersOpen(false); }}
          >
            Show/Hide Fields
          </button>
          <button
            className={`w-full inline-flex items-center justify-center gap-1 text-xs px-2 py-1 rounded border ${filtersOpen ? 'text-white border-gray-500 bg-gray-700' : 'text-gray-300 border-gray-700 bg-gray-800/60 hover:bg-gray-700'}`}
            onClick={() => { setFiltersOpen(true); setFieldsOpen(false); }}
          >
            Filters
          </button>
        </div>

        {/* Full-width content panels below */}
        {fieldsOpen && (
          <div className="mt-2 p-2 text-xs bg-gray-900/60 rounded border border-gray-800 w-full">
            <div className="grid grid-cols-2 gap-2">
              {[
                ['Basic', 'basic'],
                ['Identification', 'identification'],
                ['Technical', 'technical'],
                ['Documentation', 'documentation'],
                ['Lifecycle', 'lifecycle'],
                ['Maintenance', 'maintenance'],
                ['Economic', 'economic'],
                ['Compliance', 'compliance'],
                ['Relationships', 'relationships']
              ].map(([label, key]) => (
                <label key={key} className="flex items-center gap-1 text-gray-300">
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
          <div className="mt-2 p-2 bg-gray-900/60 rounded border border-gray-800 w-full">
            <div className="grid grid-cols-2 gap-2">
              <select value={filter.category} onChange={e=>setFilter(f=>({...f,category:e.target.value}))} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-xs">
                <option value="">All Categories</option>
                {distinct.categories.map(v=> <option key={v} value={v}>{v}</option>)}
              </select>
              <select value={filter.type} onChange={e=>setFilter(f=>({...f,type:e.target.value}))} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-xs">
                <option value="">All Types</option>
                {distinct.types.map(v=> <option key={v} value={v}>{v}</option>)}
              </select>
              <select value={filter.location} onChange={e=>setFilter(f=>({...f,location:e.target.value}))} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-xs">
                <option value="">All Locations</option>
                {distinct.locations.map(v=> <option key={v} value={v}>{v}</option>)}
              </select>
              <select value={filter.condition} onChange={e=>setFilter(f=>({...f,condition:e.target.value}))} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-xs">
                <option value="">All Conditions</option>
                {distinct.conditions.map(v=> <option key={v} value={v}>{v}</option>)}
              </select>
              <select value={filter.classification} onChange={e=>setFilter(f=>({...f,classification:e.target.value}))} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-xs col-span-2">
                <option value="">All Classifications</option>
                {distinct.classifications.map(v=> <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 w-full">
              <button 
                onClick={applyFilterToViewer}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs py-1 rounded"
              >
                Apply to Model
              </button>
              <button 
                onClick={exportCSV}
                className="w-full bg-gray-700 hover:bg-gray-600 text-white text-xs py-1 rounded"
              >
                Export CSV
              </button>
            </div>
          </div>
        )}
      </div>
      
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-gray-800/90 backdrop-blur border-b border-gray-700 text-gray-300">
            <tr>
              {visibleFields.basic && (
                <>
                  <th className="text-left px-2 py-1.5">Source</th>
                  <th className="text-left px-2 py-1.5">Category</th>
                  <th className="text-left px-2 py-1.5">Type</th>
                  <th className="text-left px-2 py-1.5">Brand</th>
                  <th className="text-left px-2 py-1.5">Model</th>
                  <th className="text-left px-2 py-1.5">Actions</th>
                </>
              )}
              {visibleFields.identification && (
                <>
                  <th className="text-left px-2 py-1.5">Code</th>
                  <th className="text-left px-2 py-1.5">Name</th>
                  <th className="text-left px-2 py-1.5">Serial</th>
                  <th className="text-left px-2 py-1.5">Install Date</th>
                </>
              )}
              {visibleFields.technical && (
                <>
                  <th className="text-left px-2 py-1.5">Material</th>
                  <th className="text-left px-2 py-1.5">Dimensions</th>
                  <th className="text-left px-2 py-1.5">Capacity</th>
                </>
              )}
              {visibleFields.documentation && (
                <>
                  <th className="text-left px-2 py-1.5">Manuals</th>
                  <th className="text-left px-2 py-1.5">Warranties</th>
                </>
              )}
              {visibleFields.lifecycle && (
                <>
                  <th className="text-left px-2 py-1.5">Condition</th>
                  <th className="text-left px-2 py-1.5">Expected Life</th>
                </>
              )}
              {visibleFields.maintenance && (
                <>
                  <th className="text-left px-2 py-1.5">Last Service</th>
                  <th className="text-left px-2 py-1.5">Next Service</th>
                </>
              )}
              {visibleFields.economic && (
                <>
                  <th className="text-left px-2 py-1.5">Purchase Cost</th>
                  <th className="text-left px-2 py-1.5">Maintenance Cost</th>
                </>
              )}
              {visibleFields.compliance && (
                <>
                  <th className="text-left px-2 py-1.5">Regulations</th>
                  <th className="text-left px-2 py-1.5">Safety</th>
                </>
              )}
              {visibleFields.relationships && (
                <>
                  <th className="text-left px-2 py-1.5">Location</th>
                  <th className="text-left px-2 py-1.5">Suppliers</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {filteredRows.length===0 ? (
              <tr><td colSpan={20} className="px-3 py-4 text-center text-gray-400">No assets. Use "Create new asset".</td></tr>
            ) : paginatedRows.map(r=> (
              <tr key={r.id} className="border-b border-gray-800 hover:bg-gray-800/60 cursor-pointer" onClick={()=>onRowClick(r)}>
                {visibleFields.basic && (
                  <>
                    <td className="px-2 py-1.5">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        r.source === 'BIM_MODEL' 
                          ? 'bg-green-900/40 text-green-300' 
                          : 'bg-blue-900/40 text-blue-300'
                      }`}>
                        {r.source === 'BIM_MODEL' ? 'BIM' : 'Manual'}
                      </span>
                      {r.conflictWithId && <span className="ml-2 text-[10px] text-red-300">⚠ Conflict</span>}
                    </td>
                    <td className="px-2 py-1.5 text-gray-100">{r.category||'-'}</td>
                    <td className="px-2 py-1.5 text-gray-200">{r.type||'-'}</td>
                    <td className="px-2 py-1.5 text-gray-200">{r.brand||'-'}</td>
                    <td className="px-2 py-1.5 text-gray-200">{r.model||'-'}</td>
                    <td className="px-2 py-1.5">
                      {r.source === 'MANUAL' && (
                        <button 
                          onClick={(e)=>{ e.stopPropagation(); placeManual(r); }}
                          className="text-xs bg-purple-600 hover:bg-purple-700 text-white px-2 py-0.5 rounded"
                        >
                          {r.placeholderX==null ? 'Place' : 'Re-place'}
                        </button>
                      )}
                    </td>
                  </>
                )}
                {visibleFields.identification && (
                  <>
                    <td className="px-2 py-1.5 text-gray-200">{r.assetCode||'-'}</td>
                    <td className="px-2 py-1.5 text-gray-200">{r.assetName||'-'}</td>
                    <td className="px-2 py-1.5 text-gray-200">{r.serialNumber||'-'}</td>
                    <td className="px-2 py-1.5 text-gray-200">{r.installationDate||'-'}</td>
                  </>
                )}
                {visibleFields.technical && (
                  <>
                    <td className="px-2 py-1.5 text-gray-200">{r.material||'-'}</td>
                    <td className="px-2 py-1.5 text-gray-200">{r.dimensions||'-'}</td>
                    <td className="px-2 py-1.5 text-gray-200">{r.capacity||'-'}</td>
                  </>
                )}
                {visibleFields.documentation && (
                  <>
                    <td className="px-2 py-1.5 text-gray-200">{r.manuals||'-'}</td>
                    <td className="px-2 py-1.5 text-gray-200">{r.warranties||'-'}</td>
                  </>
                )}
                {visibleFields.lifecycle && (
                  <>
                    <td className="px-2 py-1.5 text-gray-200">{r.condition||'-'}</td>
                    <td className="px-2 py-1.5 text-gray-200">{r.expectedLife||'-'}</td>
                  </>
                )}
                {visibleFields.maintenance && (
                  <>
                    <td className="px-2 py-1.5 text-gray-200">{r.lastService||'-'}</td>
                    <td className="px-2 py-1.5 text-gray-200">{r.nextService||'-'}</td>
                  </>
                )}
                {visibleFields.economic && (
                  <>
                    <td className="px-2 py-1.5 text-gray-200">{r.purchaseCost||'-'}</td>
                    <td className="px-2 py-1.5 text-gray-200">{r.maintenanceCost||'-'}</td>
                  </>
                )}
                {visibleFields.compliance && (
                  <>
                    <td className="px-2 py-1.5 text-gray-200">{r.regulations||'-'}</td>
                    <td className="px-2 py-1.5 text-gray-200">{r.safetyNotes||'-'}</td>
                  </>
                )}
                {visibleFields.relationships && (
                  <>
                    <td className="px-2 py-1.5 text-gray-200">{r.location||'-'}</td>
                    <td className="px-2 py-1.5 text-gray-200">{r.suppliers||'-'}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Bottom Pagination Controls */}
      <div className="flex items-center justify-between px-2 py-2 text-[11px] text-gray-300 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="whitespace-nowrap">Rows:</span>
          <select 
            value={pageSize} 
            onChange={e=>setPageSize(parseInt(e.target.value,10))} 
            className="h-6 bg-gray-800/80 border border-gray-700 rounded px-2 text-[11px] focus:outline-none focus:border-gray-500"
          >
            {[10,20,50,100].map(n=> <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="flex-1 text-center text-gray-400 truncate">
          {filteredRows.length===0? '0' : `${startIndex+1}-${Math.min(endIndex, filteredRows.length)}`} of {filteredRows.length}
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={()=>setPage(p=>Math.max(1,p-1))} 
            disabled={pageClamped<=1} 
            className={`h-6 w-6 grid place-items-center rounded border ${pageClamped<=1?'text-gray-500 border-gray-700':'text-white border-gray-600 hover:bg-gray-700'}`}
            aria-label="Previous page"
          >
            &#8249;
          </button>
          <span className="mx-1 whitespace-nowrap">{pageClamped}/{totalPages}</span>
          <button 
            onClick={()=>setPage(p=>Math.min(totalPages,p+1))} 
            disabled={pageClamped>=totalPages} 
            className={`h-6 w-6 grid place-items-center rounded border ${pageClamped>=totalPages?'text-gray-500 border-gray-700':'text-white border-gray-600 hover:bg-gray-700'}`}
            aria-label="Next page"
          >
            &#8250;
          </button>
        </div>
      </div>
    </div>
  );
};

const CreateAsset: React.FC<{ projectId?: string; }> = ({ projectId }) => {
  const [rows, setRows] = useState<AssetRecord[]>(() => load(K.assets(projectId), [] as AssetRecord[]));
  const [activeSection, setActiveSection] = useState<'identification' | 'technical' | 'documentation' | 'lifecycle' | 'maintenance' | 'economic' | 'compliance' | 'relationships'>('identification');
  const [f,setF]=useState<Partial<AssetRecord>>({ 
    category:'', type:'', brand:'', model:'', description:'', location:'',
    assetCode:'', assetName:'', serialNumber:'', installationDate:'',
    material:'', dimensions:'', weight:'', capacity:'', powerRating:'',
    manuals:'', warranties:'', certifications:'',
    condition:'', serviceDate:'', expectedLife:'',
    maintenanceSchedule:'', lastService:'', nextService:'',
    purchaseCost:'', maintenanceCost:'',
    regulations:'', safetyNotes:'',
    parentAsset:'', suppliers:''
  });
  
  useEffect(()=>save(K.assets(projectId), rows),[rows,projectId]);
  
  const onSave=()=>{ 
    const rec: AssetRecord = { 
      ...f as AssetRecord,
      id:`asset-${Date.now()}`,
      dbId:null,
      source: 'MANUAL'
    }; 
    setRows(prev=>[rec,...prev]); 
    setF({ 
      category:'', type:'', brand:'', model:'', description:'', location:'',
      assetCode:'', assetName:'', serialNumber:'', installationDate:'',
      material:'', dimensions:'', weight:'', capacity:'', powerRating:'',
      manuals:'', warranties:'', certifications:'',
      condition:'', serviceDate:'', expectedLife:'',
      maintenanceSchedule:'', lastService:'', nextService:'',
      purchaseCost:'', maintenanceCost:'',
      regulations:'', safetyNotes:'',
      parentAsset:'', suppliers:''
    }); 
  };
  
  const sections = [
    { key: 'identification' as const, label: 'Identification & Registry' },
    { key: 'technical' as const, label: 'Technical & Construction' },
    { key: 'documentation' as const, label: 'Documentation' },
    { key: 'lifecycle' as const, label: 'Status & Lifecycle' },
    { key: 'maintenance' as const, label: 'Maintenance Management' },
    { key: 'economic' as const, label: 'Economic Aspects' },
    { key: 'compliance' as const, label: 'Compliance & Safety' },
    { key: 'relationships' as const, label: 'Links & Relationships' }
  ];
  
  const updateField = (key: keyof AssetRecord, value: string) => {
    setF(v => ({ ...v, [key]: value }));
  };
  
  return (
    <div className="p-3 space-y-3 h-full flex flex-col">
      <div className="text-white font-semibold text-sm">Create New Asset</div>
      
      {/* Section selector */}
      <div className="flex gap-1 overflow-x-auto pb-2">
        {sections.map(sec => (
          <button
            key={sec.key}
            onClick={() => setActiveSection(sec.key)}
            className={`text-xs px-2 py-1 rounded whitespace-nowrap ${
              activeSection === sec.key 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
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
            <div><label className="text-[11px] text-gray-300 block mb-1">Asset Code</label><input value={f.assetCode||''} onChange={e=>updateField('assetCode',e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" /></div>
            <div><label className="text-[11px] text-gray-300 block mb-1">Asset Name</label><input value={f.assetName||''} onChange={e=>updateField('assetName',e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" /></div>
            <div><label className="text-[11px] text-gray-300 block mb-1">Category</label><input value={f.category||''} onChange={e=>updateField('category',e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" /></div>
            <div><label className="text-[11px] text-gray-300 block mb-1">Type</label><input value={f.type||''} onChange={e=>updateField('type',e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" /></div>
            <div><label className="text-[11px] text-gray-300 block mb-1">Brand</label><input value={f.brand||''} onChange={e=>updateField('brand',e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" /></div>
            <div><label className="text-[11px] text-gray-300 block mb-1">Model</label><input value={f.model||''} onChange={e=>updateField('model',e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" /></div>
            <div><label className="text-[11px] text-gray-300 block mb-1">Serial Number</label><input value={f.serialNumber||''} onChange={e=>updateField('serialNumber',e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" /></div>
            <div><label className="text-[11px] text-gray-300 block mb-1">Installation Date</label><input type="date" value={f.installationDate||''} onChange={e=>updateField('installationDate',e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" /></div>
            <div className="col-span-2"><label className="text-[11px] text-gray-300 block mb-1">Description</label><textarea value={f.description||''} onChange={e=>updateField('description',e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" rows={2} /></div>
          </div>
        )}
        
        {activeSection === 'technical' && (
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-[11px] text-gray-300 block mb-1">Material</label><input value={f.material||''} onChange={e=>updateField('material',e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" /></div>
            <div><label className="text-[11px] text-gray-300 block mb-1">Dimensions</label><input value={f.dimensions||''} onChange={e=>updateField('dimensions',e.target.value)} placeholder="L x W x H" className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" /></div>
            <div><label className="text-[11px] text-gray-300 block mb-1">Weight</label><input value={f.weight||''} onChange={e=>updateField('weight',e.target.value)} placeholder="kg" className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" /></div>
            <div><label className="text-[11px] text-gray-300 block mb-1">Capacity</label><input value={f.capacity||''} onChange={e=>updateField('capacity',e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" /></div>
            <div className="col-span-2"><label className="text-[11px] text-gray-300 block mb-1">Power Rating</label><input value={f.powerRating||''} onChange={e=>updateField('powerRating',e.target.value)} placeholder="kW" className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" /></div>
          </div>
        )}
        
        {activeSection === 'documentation' && (
          <div className="grid grid-cols-1 gap-2">
            <div><label className="text-[11px] text-gray-300 block mb-1">Manuals</label><input value={f.manuals||''} onChange={e=>updateField('manuals',e.target.value)} placeholder="Link or file reference" className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" /></div>
            <div><label className="text-[11px] text-gray-300 block mb-1">Warranties</label><input value={f.warranties||''} onChange={e=>updateField('warranties',e.target.value)} placeholder="Expiry date / terms" className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" /></div>
            <div><label className="text-[11px] text-gray-300 block mb-1">Certifications</label><input value={f.certifications||''} onChange={e=>updateField('certifications',e.target.value)} placeholder="ISO, CE, etc." className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" /></div>
          </div>
        )}
        
        {activeSection === 'lifecycle' && (
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-[11px] text-gray-300 block mb-1">Condition</label>
              <select value={f.condition||''} onChange={e=>updateField('condition',e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs">
                <option value="">Select</option>
                <option value="Excellent">Excellent</option>
                <option value="Good">Good</option>
                <option value="Fair">Fair</option>
                <option value="Poor">Poor</option>
                <option value="Critical">Critical</option>
              </select>
            </div>
            <div><label className="text-[11px] text-gray-300 block mb-1">Service Date</label><input type="date" value={f.serviceDate||''} onChange={e=>updateField('serviceDate',e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" /></div>
            <div className="col-span-2"><label className="text-[11px] text-gray-300 block mb-1">Expected Life</label><input value={f.expectedLife||''} onChange={e=>updateField('expectedLife',e.target.value)} placeholder="Years" className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" /></div>
          </div>
        )}
        
        {activeSection === 'maintenance' && (
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2"><label className="text-[11px] text-gray-300 block mb-1">Maintenance Schedule</label><input value={f.maintenanceSchedule||''} onChange={e=>updateField('maintenanceSchedule',e.target.value)} placeholder="Weekly, Monthly, Annually" className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" /></div>
            <div><label className="text-[11px] text-gray-300 block mb-1">Last Service</label><input type="date" value={f.lastService||''} onChange={e=>updateField('lastService',e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" /></div>
            <div><label className="text-[11px] text-gray-300 block mb-1">Next Service</label><input type="date" value={f.nextService||''} onChange={e=>updateField('nextService',e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" /></div>
          </div>
        )}
        
        {activeSection === 'economic' && (
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-[11px] text-gray-300 block mb-1">Purchase Cost</label><input value={f.purchaseCost||''} onChange={e=>updateField('purchaseCost',e.target.value)} placeholder="€" className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" /></div>
            <div><label className="text-[11px] text-gray-300 block mb-1">Maintenance Cost</label><input value={f.maintenanceCost||''} onChange={e=>updateField('maintenanceCost',e.target.value)} placeholder="€/year" className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" /></div>
          </div>
        )}
        
        {activeSection === 'compliance' && (
          <div className="grid grid-cols-1 gap-2">
            <div><label className="text-[11px] text-gray-300 block mb-1">Regulations</label><input value={f.regulations||''} onChange={e=>updateField('regulations',e.target.value)} placeholder="Regulatory requirements" className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" /></div>
            <div><label className="text-[11px] text-gray-300 block mb-1">Safety Notes</label><textarea value={f.safetyNotes||''} onChange={e=>updateField('safetyNotes',e.target.value)} placeholder="Safety precautions" className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" rows={3} /></div>
          </div>
        )}
        
        {activeSection === 'relationships' && (
          <div className="grid grid-cols-1 gap-2">
            <div><label className="text-[11px] text-gray-300 block mb-1">Parent Asset</label><input value={f.parentAsset||''} onChange={e=>updateField('parentAsset',e.target.value)} placeholder="Related parent asset" className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" /></div>
            <div><label className="text-[11px] text-gray-300 block mb-1">Location</label><input value={f.location||''} onChange={e=>updateField('location',e.target.value)} placeholder="Building, Floor, Room" className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" /></div>
            <div><label className="text-[11px] text-gray-300 block mb-1">Suppliers</label><input value={f.suppliers||''} onChange={e=>updateField('suppliers',e.target.value)} placeholder="Supplier contacts" className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" /></div>
          </div>
        )}
      </div>
      
      <div className="border-t border-gray-800 pt-3">
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm w-full" onClick={onSave}>Save Asset</button>
      </div>
    </div>
  );
};

const SpaceList: React.FC<{ projectId?: string; }> = ({ projectId }) => {
  const [rows] = useState<SpaceRecord[]>(() => load(K.spaces(projectId), [] as SpaceRecord[]));
  return (
    <div>
      <div className="p-4 border-b border-gray-800">
        <div className="text-white font-semibold text-sm">Space List</div>
        <div className="text-[11px] text-gray-400">Building – Level – Room name – Space Code – Area – Description</div>
      </div>
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-800/90 backdrop-blur border-b border-gray-700 text-gray-300">
            <tr>
              <th className="text-left px-3 py-2">Building</th>
              <th className="text-left px-3 py-2">Level</th>
              <th className="text-left px-3 py-2">Room name</th>
              <th className="text-left px-3 py-2">Space Code</th>
              <th className="text-left px-3 py-2">Area</th>
              <th className="text-left px-3 py-2">Description</th>
            </tr>
          </thead>
          <tbody>
            {rows.length===0? (
              <tr><td colSpan={6} className="px-3 py-4 text-center text-gray-400">No spaces. Use "Create new space".</td></tr>
            ) : rows.map(r=> (
              <tr key={r.id} className="border-b border-gray-800">
                <td className="px-3 py-2 text-gray-100">{r.building||'-'}</td>
                <td className="px-3 py-2 text-gray-100">{r.level||'-'}</td>
                <td className="px-3 py-2 text-gray-200">{r.name||'-'}</td>
                <td className="px-3 py-2 text-gray-200">{r.spaceCode||'-'}</td>
                <td className="px-3 py-2 text-gray-200">{r.area!=null?r.area:'-'}</td>
                <td className="px-3 py-2 text-gray-300">{r.description||'-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const CreateSpace: React.FC<{ projectId?: string; }> = ({ projectId }) => {
  const [rows,setRows]=useState<SpaceRecord[]>(()=>load(K.spaces(projectId), [] as SpaceRecord[]));
  useEffect(()=>save(K.spaces(projectId), rows),[rows,projectId]);
  const [f,setF]=useState({ building:'', level:'', name:'', spaceCode:'', area:'', description:'' });
  const onSave=()=>{ 
    const rec: SpaceRecord = { 
      id:`space-${Date.now()}`, 
      building:f.building||undefined,
      level:f.level||undefined, 
      name:f.name||undefined, 
      spaceCode:f.spaceCode||undefined,
      area: f.area?Number(f.area):undefined, 
      description:f.description||undefined 
    }; 
    setRows(prev=>[rec,...prev]); 
    setF({ building:'', level:'', name:'', spaceCode:'', area:'', description:'' }); 
  };
  return (
    <div className="p-3 space-y-3">
      <div className="text-white font-semibold text-sm">Create New Space</div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className="text-[12px] text-gray-300 block mb-1">Building</label><input value={f.building} onChange={e=>setF(v=>({...v,building:e.target.value}))} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm" /></div>
        <div><label className="text-[12px] text-gray-300 block mb-1">Level</label><input value={f.level} onChange={e=>setF(v=>({...v,level:e.target.value}))} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm" /></div>
        <div><label className="text-[12px] text-gray-300 block mb-1">Room name</label><input value={f.name} onChange={e=>setF(v=>({...v,name:e.target.value}))} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm" /></div>
        <div><label className="text-[12px] text-gray-300 block mb-1">Space Code</label><input value={f.spaceCode} onChange={e=>setF(v=>({...v,spaceCode:e.target.value}))} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm" /></div>
        <div><label className="text-[12px] text-gray-300 block mb-1">Area (m²)</label><input value={f.area} onChange={e=>setF(v=>({...v,area:e.target.value}))} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm" /></div>
        <div className="col-span-2"><label className="text-[12px] text-gray-300 block mb-1">Description</label><input value={f.description} onChange={e=>setF(v=>({...v,description:e.target.value}))} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm" /></div>
      </div>
      <div><button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded" onClick={onSave}>Save Space</button></div>
    </div>
  );
};

const ScheduledMaintenance: React.FC<{ projectId?: string; }> = ({ projectId }) => {
  const [rows,setRows]=useState<ScheduledItem[]>(()=>load(K.scheduled(projectId), [] as ScheduledItem[]));
  useEffect(()=>save(K.scheduled(projectId), rows),[rows,projectId]);
  const [f,setF]=useState({ discipline:'', category:'', code:'', asset:'', task:'', frequency:'', timeHours:'' });
  const add=()=>{ setRows(prev=>[{ id:`sched-${Date.now()}`, ...f },...prev]); setF({ discipline:'', category:'', code:'', asset:'', task:'', frequency:'', timeHours:'' }); };
  return (
    <div className="p-3 space-y-3">
      <div className="text-white font-semibold text-sm">Scheduled Maintenance</div>
      <div className="grid grid-cols-2 gap-2">
        <select value={f.discipline} onChange={e=>setF(v=>({...v,discipline:e.target.value}))} className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm"><option value="">Discipline</option>{['Architecture','Structure','Mechanical System','Electrical System','Plumbing System','Fire Protection','Elevator System','Safety','IT/Technology','Other'].map(d=> <option key={d} value={d}>{d}</option>)}</select>
        <input placeholder="Category (Categorie_Classi)" value={f.category} onChange={e=>setF(v=>({...v,category:e.target.value}))} className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm" />
        <input placeholder="Code" value={f.code} onChange={e=>setF(v=>({...v,code:e.target.value}))} className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm" />
        <input placeholder="Asset" value={f.asset} onChange={e=>setF(v=>({...v,asset:e.target.value}))} className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm" />
        <div className="col-span-2"><input placeholder="Task (comma-separated)" value={f.task} onChange={e=>setF(v=>({...v,task:e.target.value}))} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm" /></div>
        <input placeholder="Frequency (n/year)" value={f.frequency} onChange={e=>setF(v=>({...v,frequency:e.target.value}))} className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm" />
        <input placeholder="Time (hours)" value={f.timeHours} onChange={e=>setF(v=>({...v,timeHours:e.target.value}))} className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm" />
      </div>
      <div><button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded" onClick={add}>Add</button></div>
      {rows.length>0 && <ul className="space-y-1 text-sm text-gray-200 max-h-48 overflow-auto">{rows.map(r=> <li key={r.id} className="bg-gray-900/60 rounded px-2 py-1">[{r.discipline}] {r.category} • {r.asset} • {r.task} • {r.frequency}/y • {r.timeHours}h</li>)}</ul>}
    </div>
  );
};

const TicketForm: React.FC<{ projectId?: string; }> = ({ projectId }) => {
  const [tickets,setTickets]=useState<TicketItem[]>(()=>load(K.tickets(projectId), [] as TicketItem[]));
  const [workOrders,setWorkOrders]=useState<WorkOrderItem[]>(()=>load(K.workOrders(projectId), [] as WorkOrderItem[]));
  
  useEffect(()=>save(K.tickets(projectId), tickets),[tickets,projectId]);
  useEffect(()=>save(K.workOrders(projectId), workOrders),[workOrders,projectId]);
  
  const [form,setForm]=useState({
    // Requester
    name:'', surname:'', contact:'',
    // Location
    building:'', level:'', room:'', spaceCode:'',
    // Intervention
    discipline:'', category:'', item:'', descriptionShort:'', descriptionDetailed:'',
    attachments: [] as string[]
  });
  
  const disciplines = ['Architecture','Structure','Mechanical','Electrical','Plumbing','Fire Protection','Elevator','Safety','IT/Technology','Other'];
  
  const generateCode = () => {
    const timestamp = Date.now();
    const code = `TKT-${timestamp}`;
    const qrData = `TICKET:${code}|REQUESTER:${form.name} ${form.surname}|CONTACT:${form.contact}|LOCATION:${form.building}-${form.level}-${form.room}`;
    return { code, qrData };
  };
  
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const fileNames = Array.from(files).map(f => f.name);
      setForm(v => ({ ...v, attachments: [...v.attachments, ...fileNames] }));
    }
  };
  
  const submit=()=>{ 
    const { code, qrData } = generateCode();
    const ticket: TicketItem = {
      id: `ticket-${Date.now()}`,
      ticketCode: code,
      qrCode: qrData,
      requester: {
        name: form.name,
        surname: form.surname,
        contact: form.contact
      },
      location: {
        building: form.building,
        level: form.level,
        room: form.room,
        spaceCode: form.spaceCode
      },
      intervention: {
        discipline: form.discipline,
        category: form.category,
        item: form.item,
        descriptionShort: form.descriptionShort,
        descriptionDetailed: form.descriptionDetailed,
        attachments: form.attachments
      },
      status: 'Open',
      createdAt: new Date().toISOString()
    };
    
    setTickets(prev=>[ticket,...prev]);
    
    // Create corresponding work order
    const workOrder: WorkOrderItem = {
      id: `wo-${Date.now()}`,
      requestId: code,
      requester: `${form.name} ${form.surname}`,
      contact: form.contact,
      location: `${form.building} - ${form.level} - ${form.room}`,
      interventionDetails: form.descriptionDetailed,
      discipline: form.discipline,
      category: form.category,
      description: form.descriptionShort,
      attachments: form.attachments,
      asset: form.item,
      status: 'Open',
      sourceTicketId: ticket.id
    };
    setWorkOrders(prev=>[workOrder,...prev]);
    
    // Show code to user
    alert(`Ticket Created!\nCode: ${code}\nQR Data: ${qrData}\n\nThis ticket has been sent to the Maintenance Team.`);
    
    resetForm();
  };
  
  const resetForm = () => {
    setForm({
      name:'', surname:'', contact:'',
      building:'', level:'', room:'', spaceCode:'',
      discipline:'', category:'', item:'', descriptionShort:'', descriptionDetailed:'',
      attachments: []
    });
  };
  
  return (
    <div className="p-3 space-y-3 h-full flex flex-col overflow-y-auto">
      <div className="text-white font-semibold text-sm">Maintenance Ticket</div>
      
      {/* Requester Section */}
      <div className="border-b border-gray-700 pb-3">
        <div className="text-xs text-gray-400 mb-2">Requester</div>
        <div className="grid grid-cols-2 gap-2">
          <input placeholder="Name" value={form.name} onChange={e=>setForm(v=>({...v,name:e.target.value}))} className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" />
          <input placeholder="Surname" value={form.surname} onChange={e=>setForm(v=>({...v,surname:e.target.value}))} className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" />
          <div className="col-span-2"><input placeholder="Contact (email / phone)" value={form.contact} onChange={e=>setForm(v=>({...v,contact:e.target.value}))} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" /></div>
        </div>
      </div>
      
      {/* Location Section */}
      <div className="border-b border-gray-700 pb-3">
        <div className="text-xs text-gray-400 mb-2">Location of Intervention</div>
        <div className="grid grid-cols-2 gap-2">
          <input placeholder="Building" value={form.building} onChange={e=>setForm(v=>({...v,building:e.target.value}))} className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" />
          <input placeholder="Level" value={form.level} onChange={e=>setForm(v=>({...v,level:e.target.value}))} className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" />
          <input placeholder="Room" value={form.room} onChange={e=>setForm(v=>({...v,room:e.target.value}))} className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" />
          <input placeholder="Space Code" value={form.spaceCode} onChange={e=>setForm(v=>({...v,spaceCode:e.target.value}))} className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" />
        </div>
      </div>
      
      {/* Intervention Section */}
      <div className="border-b border-gray-700 pb-3">
        <div className="text-xs text-gray-400 mb-2">Intervention Identification</div>
        <div className="grid grid-cols-1 gap-2">
          <select value={form.discipline} onChange={e=>setForm(v=>({...v,discipline:e.target.value}))} className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs">
            <option value="">Select Discipline</option>
            {disciplines.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <input placeholder="Category (from Categorie_Classi)" value={form.category} onChange={e=>setForm(v=>({...v,category:e.target.value}))} className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" />
          <input placeholder="Item (select from model)" value={form.item} onChange={e=>setForm(v=>({...v,item:e.target.value}))} className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" />
          <input placeholder="Short Description" value={form.descriptionShort} onChange={e=>setForm(v=>({...v,descriptionShort:e.target.value}))} className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" />
          <textarea placeholder="Detailed Description" value={form.descriptionDetailed} onChange={e=>setForm(v=>({...v,descriptionDetailed:e.target.value}))} className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" rows={3} />
          
          {/* File Attachments */}
          <div>
            <label className="text-xs text-gray-400 block mb-1">Attached Files</label>
            <input type="file" multiple onChange={handleFileUpload} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" />
            {form.attachments.length > 0 && (
              <div className="mt-2 space-y-1">
                {form.attachments.map((file, idx) => (
                  <div key={idx} className="text-xs text-gray-400 flex justify-between items-center bg-gray-900/60 px-2 py-1 rounded">
                    <span>{file}</span>
                    <button onClick={() => setForm(v => ({ ...v, attachments: v.attachments.filter((_, i) => i !== idx) }))} className="text-red-400 hover:text-red-300">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Action Buttons */}
      <div className="flex gap-2 pt-2">
        <button className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-xs" onClick={generateCode}>Generate Code & QR</button>
        <button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-xs" onClick={submit}>Submit Ticket</button>
        <button className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded text-xs" onClick={resetForm}>Reset</button>
      </div>
      
      {tickets.length>0 && (
        <div className="text-xs text-gray-400 pt-2 border-t border-gray-700">
          Last ticket: {tickets[0].ticketCode} - {tickets[0].requester.name} {tickets[0].requester.surname}
        </div>
      )}
    </div>
  );
};

const WorkOrders: React.FC<{ projectId?: string; }> = ({ projectId }) => {
  const [rows,setRows]=useState<WorkOrderItem[]>(()=>load(K.workOrders(projectId), [] as WorkOrderItem[]));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<WorkOrderItem>>({});
  
  useEffect(()=>save(K.workOrders(projectId), rows),[rows,projectId]);
  
  const startEdit = (row: WorkOrderItem) => {
    setEditingId(row.id);
    setEditForm(row);
  };
  
  const saveEdit = () => {
    if (editingId) {
      setRows(prev => prev.map(r => r.id === editingId ? { ...r, ...editForm } : r));
      setEditingId(null);
      setEditForm({});
    }
  };
  
  const updateStatus = (id: string, status: WorkOrderItem['status']) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, status } : r));
  };
  
  return (
    <div className="p-3 space-y-3 h-full flex flex-col">
      <div className="text-white font-semibold text-sm">Work Orders / Service Requests</div>
      <div className="text-xs text-gray-400">
        <span className="text-gray-500">Gray fields</span> are from tickets. 
        <span className="text-blue-400 ml-2">Blue fields</span> are managed by Maintenance Team.
      </div>
      
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-gray-800/90 backdrop-blur border-b border-gray-700 text-gray-300">
            <tr>
              <th className="text-left px-2 py-1.5">Request ID</th>
              <th className="text-left px-2 py-1.5">Requester</th>
              <th className="text-left px-2 py-1.5">Contact</th>
              <th className="text-left px-2 py-1.5">Location</th>
              <th className="text-left px-2 py-1.5">Discipline</th>
              <th className="text-left px-2 py-1.5">Category</th>
              <th className="text-left px-2 py-1.5">Description</th>
              <th className="text-left px-2 py-1.5">Asset</th>
              <th className="text-left px-2 py-1.5">Technician</th>
              <th className="text-left px-2 py-1.5">Company</th>
              <th className="text-left px-2 py-1.5">Status</th>
              <th className="text-left px-2 py-1.5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length===0 ? (
              <tr><td colSpan={12} className="px-3 py-4 text-center text-gray-400">No work orders yet. Create tickets to generate work orders.</td></tr>
            ) : rows.map(r=> {
              const isEditing = editingId === r.id;
              return (
                <tr key={r.id} className="border-b border-gray-800 hover:bg-gray-800/40">
                  {/* Gray-shaded: from ticket */}
                  <td className="px-2 py-1.5 text-gray-500">{r.requestId||'-'}</td>
                  <td className="px-2 py-1.5 text-gray-500">{r.requester||'-'}</td>
                  <td className="px-2 py-1.5 text-gray-500">{r.contact||'-'}</td>
                  <td className="px-2 py-1.5 text-gray-500">{r.location||'-'}</td>
                  <td className="px-2 py-1.5 text-gray-500">{r.discipline||'-'}</td>
                  <td className="px-2 py-1.5 text-gray-500">{r.category||'-'}</td>
                  <td className="px-2 py-1.5 text-gray-500">{r.description||'-'}</td>
                  <td className="px-2 py-1.5 text-gray-500">{r.asset||'-'}</td>
                  
                  {/* Blue-shaded: managed by maintenance team */}
                  <td className="px-2 py-1.5">
                    {isEditing ? (
                      <input 
                        value={editForm.responsibleTechnician||''} 
                        onChange={e=>setEditForm(f=>({...f,responsibleTechnician:e.target.value}))}
                        className="w-full bg-gray-800 border border-blue-500 rounded px-1 py-0.5 text-blue-300 text-xs"
                      />
                    ) : (
                      <span className="text-blue-300">{r.responsibleTechnician||'-'}</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    {isEditing ? (
                      <input 
                        value={editForm.company||''} 
                        onChange={e=>setEditForm(f=>({...f,company:e.target.value}))}
                        className="w-full bg-gray-800 border border-blue-500 rounded px-1 py-0.5 text-blue-300 text-xs"
                      />
                    ) : (
                      <span className="text-blue-300">{r.company||'-'}</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    {isEditing ? (
                      <select 
                        value={editForm.status||r.status} 
                        onChange={e=>setEditForm(f=>({...f,status:e.target.value as WorkOrderItem['status']}))}
                        className="w-full bg-gray-800 border border-blue-500 rounded px-1 py-0.5 text-blue-300 text-xs"
                      >
                        <option value="Open">Open</option>
                        <option value="Planned">Planned</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Resolved">Resolved</option>
                      </select>
                    ) : (
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        r.status==='Open' ? 'bg-yellow-900/40 text-yellow-300' :
                        r.status==='Planned' ? 'bg-blue-900/40 text-blue-300' :
                        r.status==='In Progress' ? 'bg-purple-900/40 text-purple-300' :
                        'bg-green-900/40 text-green-300'
                      }`}>{r.status}</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    {isEditing ? (
                      <div className="flex gap-1">
                        <button onClick={saveEdit} className="bg-green-600 hover:bg-green-700 text-white px-2 py-0.5 rounded text-xs">Save</button>
                        <button onClick={()=>{setEditingId(null);setEditForm({})}} className="bg-gray-600 hover:bg-gray-700 text-white px-2 py-0.5 rounded text-xs">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={()=>startEdit(r)} className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-0.5 rounded text-xs">Edit</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Service Requests (similar to Work Orders but can have different workflow)
const ServiceRequests: React.FC<{ projectId?: string; }> = ({ projectId }) => {
  const [rows] = useState<WorkOrderItem[]>(()=>load(K.serviceRequests(projectId), [] as WorkOrderItem[]));
  return (
    <div className="p-3 space-y-3">
      <div className="text-white font-semibold text-sm">Service Requests</div>
      <div className="text-xs text-gray-400">Service requests are handled similarly to work orders.</div>
      {rows.length === 0 ? (
        <div className="text-gray-400 text-sm">No service requests yet.</div>
      ) : (
        <ul className="space-y-1 text-sm text-gray-200">
          {rows.map(r => <li key={r.id} className="bg-gray-900/60 rounded px-2 py-1">{r.requestId} • {r.status}</li>)}
        </ul>
      )}
    </div>
  );
};

// Maintenance Reports
const MaintenanceReports: React.FC<{ projectId?: string; }> = ({ projectId }) => {
  const [scheduled] = useState<ScheduledItem[]>(()=>load(K.scheduled(projectId), [] as ScheduledItem[]));
  const [workOrders] = useState<WorkOrderItem[]>(()=>load(K.workOrders(projectId), [] as WorkOrderItem[]));
  
  const totalScheduled = scheduled.length;
  const totalWorkOrders = workOrders.length;
  const openOrders = workOrders.filter(w => w.status === 'Open').length;
  const inProgressOrders = workOrders.filter(w => w.status === 'In Progress').length;
  const resolvedOrders = workOrders.filter(w => w.status === 'Resolved').length;
  
  return (
    <div className="p-3 space-y-4">
      <div className="text-white font-semibold text-sm">Maintenance Reports</div>
      
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-800/60 rounded p-3">
          <div className="text-xs text-gray-400">Scheduled Tasks</div>
          <div className="text-2xl text-white font-bold">{totalScheduled}</div>
        </div>
        <div className="bg-gray-800/60 rounded p-3">
          <div className="text-xs text-gray-400">Total Work Orders</div>
          <div className="text-2xl text-white font-bold">{totalWorkOrders}</div>
        </div>
        <div className="bg-yellow-900/30 rounded p-3">
          <div className="text-xs text-yellow-400">Open Orders</div>
          <div className="text-2xl text-yellow-300 font-bold">{openOrders}</div>
        </div>
        <div className="bg-purple-900/30 rounded p-3">
          <div className="text-xs text-purple-400">In Progress</div>
          <div className="text-2xl text-purple-300 font-bold">{inProgressOrders}</div>
        </div>
        <div className="col-span-2 bg-green-900/30 rounded p-3">
          <div className="text-xs text-green-400">Resolved Orders</div>
          <div className="text-2xl text-green-300 font-bold">{resolvedOrders}</div>
        </div>
      </div>
      
      <div className="border-t border-gray-700 pt-3">
        <div className="text-xs text-gray-400">Reports generated at: {new Date().toLocaleString()}</div>
      </div>
    </div>
  );
};

// Upcoming Maintenance Activities
const UpcomingMaintenance: React.FC<{ projectId?: string; }> = ({ projectId }) => {
  const [scheduled] = useState<ScheduledItem[]>(()=>load(K.scheduled(projectId), [] as ScheduledItem[]));
  const [workOrders] = useState<WorkOrderItem[]>(()=>load(K.workOrders(projectId), [] as WorkOrderItem[]));
  
  const upcomingScheduled = scheduled.slice(0, 10); // Show next 10
  const plannedOrders = workOrders.filter(w => w.status === 'Planned');
  
  return (
    <div className="p-3 space-y-3">
      <div className="text-white font-semibold text-sm">Upcoming Maintenance Activities</div>
      
      <div className="space-y-2">
        <div className="text-xs text-gray-400 font-semibold">Scheduled Maintenance</div>
        {upcomingScheduled.length === 0 ? (
          <div className="text-gray-500 text-xs">No scheduled maintenance.</div>
        ) : (
          <ul className="space-y-1">
            {upcomingScheduled.map(s => (
              <li key={s.id} className="bg-blue-900/20 rounded px-2 py-1.5 text-xs text-gray-200">
                <span className="font-semibold text-blue-300">[{s.discipline}]</span> {s.asset} • {s.task}
                <div className="text-xs text-gray-400 mt-0.5">{s.frequency}/year • {s.timeHours}h</div>
              </li>
            ))}
          </ul>
        )}
      </div>
      
      <div className="space-y-2 border-t border-gray-700 pt-3">
        <div className="text-xs text-gray-400 font-semibold">Planned Work Orders</div>
        {plannedOrders.length === 0 ? (
          <div className="text-gray-500 text-xs">No planned work orders.</div>
        ) : (
          <ul className="space-y-1">
            {plannedOrders.map(w => (
              <li key={w.id} className="bg-gray-800/60 rounded px-2 py-1.5 text-xs text-gray-200">
                <span className="font-semibold">{w.requestId}</span> • {w.description}
                <div className="text-xs text-gray-400 mt-0.5">Technician: {w.responsibleTechnician || 'Unassigned'}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

// Ongoing Maintenance
const OngoingMaintenance: React.FC<{ projectId?: string; }> = ({ projectId }) => {
  const [workOrders] = useState<WorkOrderItem[]>(()=>load(K.workOrders(projectId), [] as WorkOrderItem[]));
  const ongoingOrders = workOrders.filter(w => w.status === 'In Progress');
  
  return (
    <div className="p-3 space-y-3">
      <div className="text-white font-semibold text-sm">Ongoing Maintenance</div>
      
      {ongoingOrders.length === 0 ? (
        <div className="text-gray-400 text-sm">No ongoing maintenance activities.</div>
      ) : (
        <ul className="space-y-2">
          {ongoingOrders.map(w => (
            <li key={w.id} className="bg-purple-900/20 rounded p-3">
              <div className="flex justify-between items-start mb-2">
                <span className="font-semibold text-purple-300">{w.requestId}</span>
                <span className="text-xs bg-purple-900/40 text-purple-300 px-2 py-0.5 rounded">{w.status}</span>
              </div>
              <div className="text-sm text-gray-200">{w.description}</div>
              <div className="text-xs text-gray-400 mt-2">
                <div>Location: {w.location}</div>
                <div>Technician: {w.responsibleTechnician || 'Unassigned'}</div>
                <div>Company: {w.company || 'N/A'}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// Planned Maintenance
const PlannedMaintenance: React.FC<{ projectId?: string; }> = ({ projectId }) => {
  const [scheduled] = useState<ScheduledItem[]>(()=>load(K.scheduled(projectId), [] as ScheduledItem[]));
  
  // Group by discipline
  const byDiscipline = scheduled.reduce((acc, item) => {
    const disc = item.discipline || 'Other';
    if (!acc[disc]) acc[disc] = [];
    acc[disc].push(item);
    return acc;
  }, {} as Record<string, ScheduledItem[]>);
  
  return (
    <div className="p-3 space-y-3">
      <div className="text-white font-semibold text-sm">Planned Maintenance</div>
      <div className="text-xs text-gray-400">Organized by discipline</div>
      
      {Object.keys(byDiscipline).length === 0 ? (
        <div className="text-gray-400 text-sm">No planned maintenance tasks.</div>
      ) : (
        <div className="space-y-3">
          {Object.entries(byDiscipline).map(([discipline, items]) => (
            <details key={discipline} className="bg-gray-800/40 rounded p-2">
              <summary className="cursor-pointer text-sm text-blue-300 font-semibold">
                {discipline} ({items.length})
              </summary>
              <ul className="mt-2 space-y-1 pl-3">
                {items.map(item => (
                  <li key={item.id} className="text-xs text-gray-200 border-l-2 border-gray-700 pl-2 py-1">
                    <div className="font-semibold">{item.asset}</div>
                    <div className="text-gray-400">{item.task}</div>
                    <div className="text-gray-500 text-xs mt-0.5">
                      {item.frequency}/year • {item.timeHours}h • Code: {item.code}
                    </div>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      )}
    </div>
  );
};
