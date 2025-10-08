"use client";

import React, { useEffect, useState } from "react";

// Minimal models
interface FMPanelProps { projectId?: string; viewer?: any; }
interface AssetRecord { id: string; category?: string; type?: string; brand?: string; model?: string; description?: string; location?: string; dbId?: number | null; }
interface SpaceRecord { id: string; level?: string; name?: string; area?: number; description?: string; }
interface ScheduledItem { id: string; discipline: string; category: string; code: string; asset: string; task: string; frequency: string; timeHours: string; }
interface TicketItem { id: string; requester: { name: string; surname: string; contact: string }; }
interface WorkOrderItem { id: string; status: "Open" | "Planned" | "In Progress" | "Resolved"; }

type Section =
  | { group: "assets"; item: "asset-list" | "create-asset" }
  | { group: "spaces"; item: "space-list" | "create-space" }
  | { group: "maintenance"; item: "scheduled" | "ticket" | "work-orders" };

const K = {
  assets: (pid?: string) => `fm-assets-${pid || 'global'}`,
  spaces: (pid?: string) => `fm-spaces-${pid || 'global'}`,
  scheduled: (pid?: string) => `fm-scheduled-${pid || 'global'}`,
  tickets: (pid?: string) => `fm-tickets-${pid || 'global'}`,
  workOrders: (pid?: string) => `fm-workorders-${pid || 'global'}`,
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
          <div className="grid grid-cols-1 gap-2">
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
        </div>
      </div>
    </div>
  );
}

const AssetList: React.FC<{ projectId?: string; viewer?: any; }> = ({ projectId, viewer }) => {
  const [rows] = useState<AssetRecord[]>(() => load(K.assets(projectId), [] as AssetRecord[]));
  const onRowClick = (r: AssetRecord) => { try { if (!viewer || r.dbId==null) return; viewer.select?.([r.dbId]); viewer.fitToView?.([r.dbId]); } catch {} };
  return (
    <div>
      <div className="p-4 border-b border-gray-800">
        <div className="text-white font-semibold text-sm">Asset List</div>
        <div className="text-[11px] text-gray-400">Category – Type – Brand – Model – Description – Location</div>
      </div>
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-800/90 backdrop-blur border-b border-gray-700 text-gray-300">
            <tr>
              <th className="text-left px-3 py-2">Category</th>
              <th className="text-left px-3 py-2">Type</th>
              <th className="text-left px-3 py-2">Brand</th>
              <th className="text-left px-3 py-2">Model</th>
              <th className="text-left px-3 py-2">Description</th>
              <th className="text-left px-3 py-2">Location</th>
            </tr>
          </thead>
          <tbody>
            {rows.length===0 ? (
              <tr><td colSpan={6} className="px-3 py-4 text-center text-gray-400">No assets. Use "Create new asset".</td></tr>
            ) : rows.map(r=> (
              <tr key={r.id} className="border-b border-gray-800 hover:bg-gray-800/60 cursor-pointer" onClick={()=>onRowClick(r)}>
                <td className="px-3 py-2 text-gray-100">{r.category||'-'}</td>
                <td className="px-3 py-2 text-gray-200">{r.type||'-'}</td>
                <td className="px-3 py-2 text-gray-200">{r.brand||'-'}</td>
                <td className="px-3 py-2 text-gray-200">{r.model||'-'}</td>
                <td className="px-3 py-2 text-gray-300">{r.description||'-'}</td>
                <td className="px-3 py-2 text-gray-300">{r.location||'-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const CreateAsset: React.FC<{ projectId?: string; }> = ({ projectId }) => {
  const [rows, setRows] = useState<AssetRecord[]>(() => load(K.assets(projectId), [] as AssetRecord[]));
  const [f,setF]=useState({ category:'', type:'', brand:'', model:'', description:'', location:'' });
  useEffect(()=>save(K.assets(projectId), rows),[rows,projectId]);
  const onSave=()=>{ const rec: AssetRecord = { id:`asset-${Date.now()}`, ...f, dbId:null }; setRows(prev=>[rec,...prev]); setF({ category:'', type:'', brand:'', model:'', description:'', location:'' }); };
  return (
    <div className="p-3 space-y-3">
      <div className="text-white font-semibold text-sm">Create New Asset</div>
      <div className="grid grid-cols-2 gap-2">
        {([['Category','category'],['Type','type'],['Brand','brand'],['Model','model']] as const).map(([label,key])=> (
          <div key={key}><label className="text-[12px] text-gray-300 block mb-1">{label}</label><input value={(f as any)[key]} onChange={e=>setF(v=>({...v,[key]:e.target.value}))} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm" /></div>
        ))}
        <div className="col-span-2"><label className="text-[12px] text-gray-300 block mb-1">Description</label><input value={f.description} onChange={e=>setF(v=>({...v,description:e.target.value}))} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm" /></div>
        <div className="col-span-2"><label className="text-[12px] text-gray-300 block mb-1">Location</label><input value={f.location} onChange={e=>setF(v=>({...v,location:e.target.value}))} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm" /></div>
      </div>
      <div><button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded" onClick={onSave}>Save Asset</button></div>
    </div>
  );
};

const SpaceList: React.FC<{ projectId?: string; }> = ({ projectId }) => {
  const [rows] = useState<SpaceRecord[]>(() => load(K.spaces(projectId), [] as SpaceRecord[]));
  return (
    <div>
      <div className="p-4 border-b border-gray-800"><div className="text-white font-semibold text-sm">Space List</div><div className="text-[11px] text-gray-400">Level – Room name – Area – Description</div></div>
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-800/90 backdrop-blur border-b border-gray-700 text-gray-300"><tr><th className="text-left px-3 py-2">Level</th><th className="text-left px-3 py-2">Room name</th><th className="text-left px-3 py-2">Area</th><th className="text-left px-3 py-2">Description</th></tr></thead>
          <tbody>
            {rows.length===0? <tr><td colSpan={4} className="px-3 py-4 text-center text-gray-400">No spaces. Use "Create new space".</td></tr> : rows.map(r=> (
              <tr key={r.id} className="border-b border-gray-800"><td className="px-3 py-2 text-gray-100">{r.level||'-'}</td><td className="px-3 py-2 text-gray-200">{r.name||'-'}</td><td className="px-3 py-2 text-gray-200">{r.area!=null?r.area:'-'}</td><td className="px-3 py-2 text-gray-300">{r.description||'-'}</td></tr>
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
  const [f,setF]=useState({ level:'', name:'', area:'', description:'' });
  const onSave=()=>{ const rec: SpaceRecord = { id:`space-${Date.now()}`, level:f.level||undefined, name:f.name||undefined, area: f.area?Number(f.area):undefined, description:f.description||undefined }; setRows(prev=>[rec,...prev]); setF({ level:'', name:'', area:'', description:'' }); };
  return (
    <div className="p-3 space-y-3">
      <div className="text-white font-semibold text-sm">Create New Space</div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className="text-[12px] text-gray-300 block mb-1">Level</label><input value={f.level} onChange={e=>setF(v=>({...v,level:e.target.value}))} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm" /></div>
        <div><label className="text-[12px] text-gray-300 block mb-1">Room name</label><input value={f.name} onChange={e=>setF(v=>({...v,name:e.target.value}))} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm" /></div>
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
  const [rows,setRows]=useState<TicketItem[]>(()=>load(K.tickets(projectId), [] as TicketItem[]));
  useEffect(()=>save(K.tickets(projectId), rows),[rows,projectId]);
  const [r,setR]=useState({ name:'', surname:'', contact:'' });
  const submit=()=>{ setRows(prev=>[{ id:`ticket-${Date.now()}`, requester:r },...prev]); setR({ name:'', surname:'', contact:'' }); };
  return (
    <div className="p-3 space-y-3">
      <div className="text-white font-semibold text-sm">Maintenance Ticket</div>
      <div className="grid grid-cols-2 gap-2">
        <input placeholder="Name" value={r.name} onChange={e=>setR(v=>({...v,name:e.target.value}))} className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm" />
        <input placeholder="Surname" value={r.surname} onChange={e=>setR(v=>({...v,surname:e.target.value}))} className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm" />
        <div className="col-span-2"><input placeholder="Contact" value={r.contact} onChange={e=>setR(v=>({...v,contact:e.target.value}))} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm" /></div>
      </div>
      <div className="flex gap-2"><button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded" onClick={submit}>Submit Ticket</button><button className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded" onClick={()=>setR({name:'',surname:'',contact:''})}>Reset</button></div>
      {rows.length>0 && <div className="text-[12px] text-gray-400">Last ticket requester: {rows[0].requester.name} {rows[0].requester.surname}</div>}
    </div>
  );
};

const WorkOrders: React.FC<{ projectId?: string; }> = ({ projectId }) => {
  const [rows,setRows]=useState<WorkOrderItem[]>(()=>load(K.workOrders(projectId), [] as WorkOrderItem[]));
  useEffect(()=>save(K.workOrders(projectId), rows),[rows,projectId]);
  const add=()=> setRows(prev=>[{ id:`wo-${Date.now()}`, status:'Open' },...prev]);
  return (
    <div className="p-3 space-y-3">
      <div className="text-white font-semibold text-sm">Work Orders / Service Requests</div>
      <button className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded" onClick={add}>Add dummy work order</button>
      <ul className="space-y-1 text-sm text-gray-200 max-h-64 overflow-auto">
        {rows.length===0 ? <li className="text-gray-400">No work orders yet.</li> : rows.map(r=> <li key={r.id} className="bg-gray-900/60 rounded px-2 py-1">{r.id} • {r.status}</li>)}
      </ul>
    </div>
  );
};
