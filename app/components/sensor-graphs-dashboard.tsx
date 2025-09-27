"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Sensor } from "@/app/context/sensor-context";

interface Props {
  sensor: Sensor;
  allSensors: Sensor[];
  onClose: () => void;
  projectId?: string | null;
}

type DailySeries = { timestamps: Date[]; temp?: number[]; rh?: number[] };

export default function SensorGraphsDashboard({ sensor, allSensors, onClose, projectId }: Props) {
  const [date, setDate] = useState(() => new Date());
  const [series, setSeries] = useState<DailySeries | null>(null);
  const [compareSensorId, setCompareSensorId] = useState<string | null>(null);
  const [compareSeries, setCompareSeries] = useState<DailySeries | null>(null);
  const [compareDate, setCompareDate] = useState<Date>(() => new Date());
  const [compareRoom, setCompareRoom] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<Date>(() => new Date());
  const centerColRef = useRef<HTMLDivElement | null>(null);
  const [chartWidth, setChartWidth] = useState<number>(800);
  const dateInputEl = useRef<HTMLInputElement | null>(null);

  const formatDate = (d: Date) => `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
  const dateInputValue = useMemo(() => {
    const y = date.getFullYear();
    const m = (date.getMonth()+1).toString().padStart(2,'0');
    const day = date.getDate().toString().padStart(2,'0');
    return `${y}-${m}-${day}`;
  }, [date]);

  const loadForSensor = async (target: Sensor, setter: (s: DailySeries|null)=>void, which: 'primary'|'compare', forDate?: Date) => {
    try {
      const baseDate = forDate || date;
      const start = new Date(baseDate); start.setHours(0,0,0,0);
      let end = new Date(start); end.setHours(23,59,59,999);
      // If loading today, align end to now so the latest sample equals current time
      const today = new Date();
      const isSameDay = start.getFullYear()===today.getFullYear() && start.getMonth()===today.getMonth() && start.getDate()===today.getDate();
      if (isSameDay) end = new Date();
      const params = new URLSearchParams({ start: start.toISOString(), end: end.toISOString(), resolution: '96' });
      if (projectId) params.set('projectId', projectId);
      const resp = await fetch(`/api/iot/samples?${params.toString()}`);
      if (!resp.ok) throw new Error(`Samples request failed (${resp.status})`);
      const json = await resp.json();
      const map = json.data || {};
      const rec = map[target.id] || map[String((target as any)._id)] || map[Object.keys(map).find(k=>k.includes(target.id)) || ''];
      if (!rec) throw new Error('No data for sensor');
      const timestamps: Date[] = (json.timestamps||[]).map((t: string) => new Date(t));
      setter({ timestamps, temp: rec.temp, rh: rec.rh });
      if (which==='primary') setError(null);
    } catch (e:any) {
      if (which==='primary') setError(e?.message || 'Failed to load data');
      setter(null);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadForSensor(sensor, setSeries, 'primary').finally(()=> setLoading(false));
  }, [sensor.id, date, projectId]);

  // Periodically append realtime point so gauges (derived from series) and charts move
  useEffect(() => {
    if (!projectId) return;
    // Only live-update when viewing today's date
    const start = new Date(date); start.setHours(0,0,0,0);
    const today = new Date();
    const isToday = start.getFullYear()===today.getFullYear() && start.getMonth()===today.getMonth() && start.getDate()===today.getDate();
    if (!isToday) return;
    let stopped = false;
    const tick = async () => {
      try {
        const resp = await fetch(`/api/iot/realtime?projectId=${projectId}`);
        if (!resp.ok) return;
        const json = await resp.json();
        const ts = new Date(json.timestamp || Date.now());
        // Primary sensor
        const upd = (json.updates || []).find((u: any) => u.id === sensor.id);
        if (upd) {
          const num = parseFloat(String(upd.value).replace(/[^0-9.+-]/g, ''));
          setSeries(prev => {
            if (!prev) return prev;
            const next: DailySeries = { 
              timestamps: [...prev.timestamps, ts],
              temp: prev.temp ? [...prev.temp, num] : prev.temp,
              rh: prev.rh ? [...prev.rh, prev.rh[prev.rh.length-1]] : prev.rh,
            };
            // keep last 200 points for performance
            if (next.timestamps.length > 200) {
              const drop = next.timestamps.length - 200;
              next.timestamps = next.timestamps.slice(drop);
              if (next.temp) next.temp = next.temp.slice(drop);
              if (next.rh) next.rh = next.rh.slice(drop);
            }
            return next;
          });
        }
        // Compare sensor (if selected and same-day B)
        if (compareSensorId && compareSeries) {
          const updB = (json.updates || []).find((u: any) => u.id === compareSensorId);
          if (updB) {
            const numB = parseFloat(String(updB.value).replace(/[^0-9.+-]/g, ''));
            setCompareSeries(prev => {
              if (!prev) return prev;
              const next: DailySeries = {
                timestamps: [...prev.timestamps, ts],
                temp: prev.temp ? [...prev.temp, numB] : prev.temp,
                rh: prev.rh ? [...prev.rh, prev.rh[prev.rh.length-1]] : prev.rh,
              };
              if (next.timestamps.length > 200) {
                const drop = next.timestamps.length - 200;
                next.timestamps = next.timestamps.slice(drop);
                if (next.temp) next.temp = next.temp.slice(drop);
                if (next.rh) next.rh = next.rh.slice(drop);
              }
              return next;
            });
          }
        }
      } catch {}
    };
    // initial tick and interval
    tick();
    const id = setInterval(tick, 15000);
    return () => { stopped = true; clearInterval(id); };
  }, [sensor.id, projectId, date, compareSensorId, !!compareSeries]);

  useEffect(() => {
    if (!compareSensorId) { setCompareSeries(null); return; }
    const s = allSensors.find(s=>s.id===compareSensorId);
    if (!s) return;
    loadForSensor(s, setCompareSeries, 'compare', compareDate);
  }, [compareSensorId, compareDate, projectId, allSensors]);

  const stats = useMemo(() => {
    if (!series?.temp || !series.rh) return null;
    const tMin = Math.min(...series.temp);
    const tMax = Math.max(...series.temp);
    const hMin = Math.min(...series.rh);
    const hMax = Math.max(...series.rh);
    const tCur = series.temp[series.temp.length-1];
    const hCur = series.rh[series.rh.length-1];
    return { tMin, tMax, hMin, hMax, tCur, hCur };
  }, [series]);

  // External Weather: simple day/night curve independent of indoor sensors
  const weatherData = useMemo(() => {
    const t = now;
    const minutes = t.getHours() * 60 + t.getMinutes();
    const phase = (minutes / 1440) * Math.PI * 2; // 0..2π across a day
    // Temperature swings cooler at night (~20°C) and warmer midday (~30°C)
    const temp = 25 + 5 * Math.sin(phase) + 1.5 * Math.sin(phase * 3 + 1);
    // Humidity opposite trend, with some variation
    let hum = 50 + 15 * Math.sin(phase + Math.PI) + 5 * Math.sin(phase * 2);
    hum = Math.max(20, Math.min(90, Math.round(hum)));
    const icon = temp > 30 ? '☀️' : temp > 22 ? '⛅' : '🌧️';
    return { temp: parseFloat(temp.toFixed(1)), hum, icon };
  }, [now]);

  // Simple heartbeat for live clock on header
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Observe center column width to keep charts within bounds
  useEffect(() => {
    const el = centerColRef.current;
    if (!el) return;
    const update = () => setChartWidth(Math.max(320, el.clientWidth));
    update();
    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    return () => ro.disconnect();
  }, [centerColRef]);

  const Gauge: React.FC<{ value?: number; min: number; max: number; label: string; unit?: string; gradient: string; dangerZones?: { from: number; to: number; color: string }[]; small?: boolean; }> = ({ value, min, max, label, unit, gradient, dangerZones=[], small=false }) => {
    const v = value ?? 0;
    const pct = Math.max(0, Math.min(1, (v - min) / (max - min || 1)));
    // Use exact semicircle sweep to match the SVG arc path: -180° to 0° (180° total)
    const startDeg = -180; const sweepDeg = 180;
    const angle = startDeg + sweepDeg * pct;
    const ticks = Array.from({ length: 6 }).map((_,i)=> min + (max-min)*i/5);
    const paddingCls = small ? 'p-3' : 'p-4';
    const minHCls = small ? 'min-h-[120px]' : 'min-h-[150px]';
    const sw = small ? 18 : 22; // arc thickness
    const needleW = small ? 5 : 6;
    const tickW = 3;
    const rArc = 90; // main arc radius
    const xL = 100 - rArc;
    const xR = 100 + rArc;
    const rTickInner = rArc - 14;
    const rTickOuter = rArc - 4;
    const rNeedle = rArc - 10;
    return (
      <div className={`bg-gray-900 border border-gray-700 rounded-xl ${paddingCls} ${minHCls} flex flex-col items-center justify-between shadow-inner`}>
        <div className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">{label}</div>
        <svg viewBox="0 0 200 120" className="w-full">
          <defs>
            <linearGradient id={gradient} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#dc2626" />
              <stop offset="50%" stopColor="#16a34a" />
              <stop offset="100%" stopColor="#dc2626" />
            </linearGradient>
          </defs>
          {dangerZones.map((dz,i)=>{ const a1 = (startDeg + sweepDeg*((dz.from-min)/(max-min)))*Math.PI/180; const a2 = (startDeg + sweepDeg*((dz.to-min)/(max-min)))*Math.PI/180; const x1=100 + rArc*Math.cos(a1); const y1=100 + rArc*Math.sin(a1); const x2=100 + rArc*Math.cos(a2); const y2=100 + rArc*Math.sin(a2); const large = (a2-a1)>Math.PI?1:0; return <path key={i} d={`M ${x1} ${y1} A ${rArc} ${rArc} 0 ${large} 1 ${x2} ${y2}`} stroke={dz.color} strokeWidth={sw-6} fill="none" opacity={0.35} /> })}
          {/* Track (true semicircle -180..0 deg) */}
          <path d={`M ${xL} 100 A ${rArc} ${rArc} 0 0 1 ${xR} 100`} stroke="#1f2937" strokeWidth={sw} fill="none" strokeLinecap="round" />
          {/* Foreground arc */}
          <path d={`M ${xL} 100 A ${rArc} ${rArc} 0 0 1 ${xR} 100`} stroke={`url(#${gradient})`} strokeWidth={sw} fill="none" strokeLinecap="round" />
          {ticks.map((t,i)=>{ const a=(startDeg+sweepDeg*i/5)*Math.PI/180; const x1=100 + (rTickInner)*Math.cos(a); const y1=100 + (rTickInner)*Math.sin(a); const x2=100 + (rTickOuter)*Math.cos(a); const y2=100 + (rTickOuter)*Math.sin(a); return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#374151" strokeWidth={tickW}/> })}
          <g transform={`rotate(${angle} 100 100)`}>
            <line x1={100} y1={100} x2={100 + rNeedle} y2={100} stroke="#e5e7eb" strokeWidth={needleW} strokeLinecap="round" />
            <circle cx={100} cy={100} r={6.5} fill="#e5e7eb" />
          </g>
          <text x={100} y={small? 80 : 74} textAnchor="middle" className="fill-white" style={{fontSize: small? '16px':'20px', fontWeight:800}}>{value?.toFixed(1)}{unit}</text>
          <text x={100} y={90} textAnchor="middle" className="fill-gray-300" style={{fontSize: '10px'}}>{min} / {max}{unit}</text>
        </svg>
      </div>
    );
  };

  const Cartesian: React.FC<{ mode: 'combined'|'temp'|'hum'; title: string; width: number; }> = ({ mode, title, width }) => {
    if (!series?.timestamps?.length || !series.temp || !series.rh) return <div className="flex items-center justify-center h-44 text-sm text-gray-500 bg-gray-900 border border-gray-700 rounded-xl">No data</div>;
    const w = Math.max(320, Math.floor(width)); const h = 260; const l=38; const r=12; const t=16; const b=32;
    const xs = series.timestamps.map(d=>d.getTime());
    const xMin = xs[0]; const xMax = xs[xs.length-1];
    const tMin = Math.min(...series.temp, ...(compareSeries?.temp||[]));
    const tMax = Math.max(...series.temp, ...(compareSeries?.temp||[]));
    const hMin = Math.min(...series.rh, ...(compareSeries?.rh||[]));
    const hMax = Math.max(...series.rh, ...(compareSeries?.rh||[]));
    const yMin = Math.min(tMin, hMin); const yMax = Math.max(tMax, hMax);
    const span = yMax - yMin || 1;
    const innerW = w-l-r; const innerH = h-t-b;
    const mapPoint = (time:number,val:number)=>{ const x = l + (innerW * (time - xMin)/(xMax - xMin || 1)); const y = t + innerH * (1 - (val - yMin)/span); return {x,y}; };
    const pathFor = (arr:number[]) => arr.map((v,i)=>{const p=mapPoint(xs[i],v);return `${i===0?'M':'L'}${p.x},${p.y}`}).join(' ');
    const primaryTempPath = pathFor(series.temp);
    const primaryHumPath = pathFor(series.rh);
    const compareTempPath = compareSeries?.temp? pathFor(compareSeries.temp): null;
    const compareHumPath = compareSeries?.rh? pathFor(compareSeries.rh): null;
    const startLabel = new Date(xs[0]); const midLabel = new Date((xMin+xMax)/2); const endLabel = new Date(xs[xs.length-1]);
    const timeFmt = (d:Date)=> `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
    const yTicks = Array.from({length:5}).map((_,i)=> yMin + (span)*i/4);
    return (
      <svg width={w} height={h} className="bg-gray-900 border border-gray-700 rounded-xl">
        <rect x={l} y={t} width={innerW} height={innerH} fill="#0b1220" stroke="#1f2937" />
        {yTicks.map((v,i)=>{const y=t+innerH*(1 - (v-yMin)/span);return <g key={i}><line x1={l} x2={l+innerW} y1={y} y2={y} stroke="#1f2937"/><text x={l-4} y={y+3} fontSize={10} fill="#64748b" textAnchor="end">{v.toFixed(0)}</text></g>;})}
        {[0,0.25,0.5,0.75,1].map(f=>{const x=l+innerW*f;return <line key={f} x1={x} x2={x} y1={t} y2={t+innerH} stroke="#1f2937"/>})}
        {(mode==='combined' || mode==='temp') && <path d={primaryTempPath} fill="none" stroke="#ef4444" strokeWidth={2.2} />}
        {(mode==='combined' || mode==='hum') && <path d={primaryHumPath} fill="none" stroke="#3b82f6" strokeWidth={2.2} />}
        {(mode!=='hum' && compareTempPath) && <path d={compareTempPath} fill="none" stroke="#f97316" strokeWidth={1.5} strokeDasharray="4 4" />}
        {(mode!=='temp' && compareHumPath) && <path d={compareHumPath} fill="none" stroke="#10b981" strokeWidth={1.5} strokeDasharray="4 4" />}
        <g>
          <rect x={l+8} y={t+8} width={260} height={42} rx={6} ry={6} fill="#111827" stroke="#1f2937" />
          {(mode==='combined' || mode==='temp') && (<>
            <circle cx={l+20} cy={t+20} r={5} fill="#ef4444" />
            <text x={l+32} y={t+24} fontSize={11} fill="#e5e7eb">Temp (°C)</text>
          </>)}
          {(mode==='combined' || mode==='hum') && (<>
            <circle cx={l+120} cy={t+20} r={5} fill="#3b82f6" />
            <text x={l+132} y={t+24} fontSize={11} fill="#e5e7eb">Humidity (%)</text>
          </>)}
          {compareSeries && (<>
            <rect x={l+8} y={t+30} width={260} height={20} fill="none" />
            {(mode!=='hum') && (<>
              <line x1={l+20} y1={t+40} x2={l+30} y2={t+40} stroke="#f97316" strokeWidth={2} strokeDasharray="4 4" />
              <text x={l+32} y={t+44} fontSize={10} fill="#fbbf24">Compare Temp</text>
            </>)}
            {(mode!=='temp') && (<>
              <line x1={l+120} y1={t+40} x2={l+130} y2={t+40} stroke="#10b981" strokeWidth={2} strokeDasharray="4 4" />
              <text x={l+132} y={t+44} fontSize={10} fill="#34d399">Compare Hum</text>
            </>)}
          </>)}
        </g>
        <text x={l} y={h-8} fontSize={11} fill="#94a3b8">{timeFmt(startLabel)}</text>
        <text x={l+innerW/2} y={h-8} fontSize={11} fill="#94a3b8" textAnchor="middle">{timeFmt(midLabel)}</text>
        <text x={l+innerW} y={h-8} fontSize={11} fill="#94a3b8" textAnchor="end">{timeFmt(endLabel)}</text>
      </svg>
    );
  };

  return (
    <div className="absolute inset-0 bg-gray-950/98 z-[1005] flex flex-col">
      {/* Top Header */}
      <div className="px-4 py-2 border-b border-gray-800 bg-gray-900/70">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-bold text-white">Sensor Graphs Dashboard</h3>
            <div className="text-xs text-gray-300 flex items-center gap-2">
              <div><span className="text-gray-400">Room:</span> <span className="font-semibold text-white">{sensor.room || '—'}</span></div>
              <div className="hidden sm:block">|</div>
              <div><span className="text-gray-400">Sensor:</span> <span className="font-semibold text-white">{sensor.name}</span></div>
              <div className="hidden sm:block">|</div>
              <div><span className="text-gray-400">Battery:</span> <span className="font-semibold text-white">{sensor.batteryLevel ?? 100}%</span></div>
              <div className="hidden sm:block">|</div>
              <div><span className="text-gray-400">Wi‑Fi:</span> <span className="font-semibold text-white">Good</span></div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Date pill (calendar style) on the left of this cluster */}
            <button
              onClick={()=>{ const el=dateInputEl.current as any; if(el?.showPicker) el.showPicker(); else el?.click(); }}
              className="px-3 py-1.5 rounded-xl bg-gray-800/70 border border-gray-700 text-sm text-gray-100 hover:bg-gray-700/60 transition flex items-center gap-2"
              title="Pick date"
            >
              <span>{formatDate(date)}</span>
              <span className="inline-block w-4 h-4 text-gray-300">📅</span>
            </button>
            <input ref={dateInputEl} type="date" className="absolute w-0 h-0 opacity-0 pointer-events-none" value={dateInputValue} onChange={e=>{ const d=new Date(e.target.value+ 'T00:00:00'); if(!isNaN(d.getTime())) setDate(d); }} />

            {/* Time label (hh:mm) where the old calendar input used to be */}
            <div className="px-3 py-1.5 rounded-xl bg-transparent border border-transparent text-base text-gray-200 font-semibold">
              {now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </div>

            {/* Circular close button with only an X */}
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-gray-700 hover:bg-gray-600 border border-gray-600 text-white text-lg flex items-center justify-center"
              aria-label="Close"
              title="Close"
            >
              ×
            </button>
          </div>
        </div>
      </div>

      {/* Body 3-column layout */}
      <div className="flex-1 grid grid-cols-12 gap-4 p-4 overflow-y-auto">
        {/* Left column: Gauges + Min/Max */}
        <div className="col-span-12 md:col-span-3 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Gauge label="Temp Current" value={stats?.tCur} min={0} max={50} unit="°C" gradient="gtemp" dangerZones={[{from:30,to:50,color:'#dc2626'}]} />
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 min-h-[150px] flex flex-col items-center justify-center">
              <div className="text-[11px] text-gray-400 uppercase tracking-wide mb-2">Hum. Current</div>
              <div className="text-4xl font-extrabold text-gray-100">{stats? stats.hCur.toFixed(0)+'%':'--'}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Gauge small label="Temp Min" value={stats?.tMin} min={0} max={50} unit="°C" gradient="gtempMin" />
            <Gauge small label="Temp Max" value={stats?.tMax} min={0} max={50} unit="°C" gradient="gtempMax" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 min-h-[120px] flex flex-col items-center justify-center">
              <div className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">Hum Min</div>
              <div className="text-3xl font-semibold text-gray-100">{stats? stats.hMin.toFixed(0)+'%':'--'}</div>
            </div>
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 min-h-[120px] flex flex-col items-center justify-center">
              <div className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">Hum Max</div>
              <div className="text-3xl font-semibold text-gray-100">{stats? stats.hMax.toFixed(0)+'%':'--'}</div>
            </div>
          </div>
        </div>

        {/* Center column: three graphs */}
        <div ref={centerColRef} className="col-span-12 md:col-span-6 space-y-4 min-w-0 overflow-x-hidden">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-gray-200">Temp + Hum Combined</h4>
              {compareSeries && <div className="text-[11px] text-amber-400">Comparing with: {allSensors.find(s=>s.id===compareSensorId)?.name}</div>}
            </div>
            <Cartesian mode="combined" title="Combined" width={chartWidth} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-gray-200">Temperature</h4>
            </div>
            <Cartesian mode="temp" title="Temperature" width={chartWidth} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-gray-200">Humidity</h4>
            </div>
            <Cartesian mode="hum" title="Humidity" width={chartWidth} />
          </div>
          <div className="text-[10px] text-gray-500">When you enable compare, dashed lines show the other sensor values.</div>
        </div>

        {/* Right column: Weather + Compare + Alerts */}
        <div className="col-span-12 md:col-span-3 space-y-4">
          {/* Weather (external, not indoor) */}
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-gray-400 uppercase">Weather</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Data</div>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-3xl">{weatherData.icon}</div>
              <div className="text-right">
                <div className="text-2xl font-bold text-white">{weatherData.temp.toFixed(1)}°C</div>
                <div className="text-[11px] text-gray-400">Humidity {weatherData.hum}%</div>
              </div>
            </div>
          </div>

          {/* Compare UI */}
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-3">
            <div className="text-xs font-semibold text-gray-400 mb-2 uppercase">Compare</div>
            {/* Row A: Base (current) */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <label className="block text-[11px] text-gray-400 mb-1">Date A</label>
                <input
                  type="date"
                  className="w-full bg-gray-800 border border-gray-700 rounded-md text-sm text-gray-200 px-2 py-1"
                  value={dateInputValue}
                  onChange={e=>{ const d=new Date(e.target.value+ 'T00:00:00'); if(!isNaN(d.getTime())) setDate(d); }}
                />
              </div>
              <div>
                <label className="block text-[11px] text-gray-400 mb-1">Room A</label>
                <div
                  className="w-full bg-gray-800/60 border border-gray-700 rounded-md text-sm text-gray-300 px-2 h-9 flex items-center whitespace-nowrap overflow-hidden text-ellipsis"
                  title={sensor.room || '—'}
                >
                  {sensor.room || '—'}
                </div>
              </div>
            </div>
            {/* Row B: Comparison selection */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <label className="block text-[11px] text-gray-400 mb-1">Date B</label>
                <input
                  type="date"
                  className="w-full bg-gray-800 border border-gray-700 rounded-md text-sm text-gray-200 px-2 py-1"
                  value={`${(compareDate.getFullYear())}-${(compareDate.getMonth()+1).toString().padStart(2,'0')}-${(compareDate.getDate()).toString().padStart(2,'0')}`}
                  onChange={e=>{ const d=new Date(e.target.value+ 'T00:00:00'); if(!isNaN(d.getTime())) setCompareDate(d); }}
                />
              </div>
              <div>
                <label className="block text-[11px] text-gray-400 mb-1">Room B</label>
                <select
                  value={compareRoom}
                  onChange={(e)=> setCompareRoom(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-md text-sm text-gray-200 px-2 py-1"
                >
                  <option value="">Select room</option>
                  {Array.from(new Set(allSensors.filter(s=> s.type===sensor.type && s.room && s.id!==sensor.id).map(s=> s.room))).map((room)=> (
                    <option key={room} value={room}>{room}</option>
                  ))}
                </select>
              </div>
            </div>
            {/* Actions */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => {
                  if (!compareRoom) { setCompareSensorId(null); setCompareSeries(null); return; }
                  const match = allSensors.find(s=> s.room===compareRoom && s.type===sensor.type);
                  if (match) {
                    setCompareSensorId(match.id);
                  } else {
                    setCompareSensorId(null);
                    setCompareSeries(null);
                  }
                }}
                className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-sm"
              >
                Compare
              </button>
              {compareSensorId ? (
                <button onClick={()=> { setCompareSensorId(null); setCompareSeries(null); }} className="text-[11px] text-red-400 hover:text-red-300">Clear</button>
              ) : <span className="text-[11px] text-gray-500">Same type: {sensor.type}</span>}
            </div>
          </div>

          {/* Alerts */}
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-3">
            <div className="text-xs font-semibold text-gray-400 mb-2 uppercase">Alerts</div>
            <div className="space-y-2">
              <div className="text-[11px] text-gray-500">(No alerts for selected date)</div>
            </div>
          </div>

          <div className="text-[10px] text-gray-500">Data is generated from mock API (/api/iot/samples). Date format dd/mm/yyyy as requested.</div>
        </div>
      </div>

      {loading && (<div className="absolute inset-0 flex items-center justify-center bg-gray-900/50"><div className="text-sm text-gray-300">Loading data…</div></div>)}
      {error && (<div className="absolute top-16 left-1/2 -translate-x-1/2 bg-red-600/90 text-white text-xs px-3 py-2 rounded-md shadow">{error}</div>)}
    </div>
  );
}
