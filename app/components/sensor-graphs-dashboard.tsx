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
  const [chartHeight, setChartHeight] = useState<number>(150);
  const dateInputEl = useRef<HTMLInputElement | null>(null);
  // Live stats for gauges (independent of selected date)
  const [gaugeStats, setGaugeStats] = useState<{ tCur: number; hCur: number; tMin: number; tMax: number; hMin: number; hMax: number } | null>(null);

  const formatDate = (d: Date) => `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
  const dateInputValue = useMemo(() => {
    const y = date.getFullYear();
    const m = (date.getMonth()+1).toString().padStart(2,'0');
    const day = date.getDate().toString().padStart(2,'0');
    return `${y}-${m}-${day}`;
  }, [date]);
  const todayYmd = useMemo(() => {
    const t = new Date();
    const y = t.getFullYear();
    const m = (t.getMonth()+1).toString().padStart(2,'0');
    const d = t.getDate().toString().padStart(2,'0');
    return `${y}-${m}-${d}`;
  }, [now]);

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

  // Initialize gauge stats from today's samples and realtime (independent of selected date)
  useEffect(() => {
    const init = async () => {
      try {
        if (!projectId) return;
        const start = new Date(); start.setHours(0,0,0,0);
        const end = new Date();
        const params = new URLSearchParams({ start: start.toISOString(), end: end.toISOString(), resolution: '96' });
        params.set('projectId', String(projectId));
        const resp = await fetch(`/api/iot/samples?${params.toString()}`);
        if (!resp.ok) throw new Error('Failed to init gauge samples');
        const json = await resp.json();
        const map = json.data || {};
        const rec = map[sensor.id] || map[String((sensor as any)._id)] || map[Object.keys(map).find(k=>k.includes(sensor.id)) || ''];
        const tArr: number[] = rec?.temp || [];
        const hArr: number[] = rec?.rh || [];
        let tMin = tArr.length? Math.min(...tArr): 0;
        let tMax = tArr.length? Math.max(...tArr): 0;
        let hMin = hArr.length? Math.min(...hArr): 0;
        let hMax = hArr.length? Math.max(...hArr): 0;
        let tCur = tArr.length? tArr[tArr.length-1] : 0;
        let hCur = hArr.length? hArr[hArr.length-1] : 0;
        // Realtime for current point
        const rt = await fetch(`/api/iot/realtime?projectId=${projectId}`);
        if (rt.ok) {
          const rj = await rt.json();
          const upd = (rj.updates||[]).find((u:any)=> u.id===sensor.id);
          if (upd) {
            const num = parseFloat(String(upd.value).replace(/[^0-9.+-]/g, ''));
            if (!isNaN(num)) {
              tCur = num;
              tMin = tArr.length? Math.min(tMin, num) : num;
              tMax = tArr.length? Math.max(tMax, num) : num;
            }
          }
        }
        setGaugeStats({ tCur, hCur, tMin, tMax, hMin, hMax });
      } catch (e) {
        // ignore init errors
      }
    };
    init();
  }, [sensor.id, projectId]);

  // Poll realtime periodically to update gauge current (independent of selected date)
  useEffect(() => {
    if (!projectId) return;
    const id = setInterval(async () => {
      try {
        const rt = await fetch(`/api/iot/realtime?projectId=${projectId}`);
        if (!rt.ok) return;
        const rj = await rt.json();
        const upd = (rj.updates||[]).find((u:any)=> u.id===sensor.id);
        if (!upd) return;
        const num = parseFloat(String(upd.value).replace(/[^0-9.+-]/g, ''));
        if (isNaN(num)) return;
        setGaugeStats(prev => {
          if (!prev) return { tCur: num, hCur: 0, tMin: num, tMax: num, hMin: 0, hMax: 0 };
          const tMin = Math.min(prev.tMin || num, num);
          const tMax = Math.max(prev.tMax || num, num);
          return { ...prev, tCur: num, tMin, tMax };
        });
      } catch {}
    }, 10000);
    return () => clearInterval(id);
  }, [sensor.id, projectId]);

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
    
    // Calculate sunrise/sunset (simplified calculation for demo)
    const dayOfYear = Math.floor((t.getTime() - new Date(t.getFullYear(), 0, 0).getTime()) / 86400000);
    const lat = 28.6; // Delhi latitude for demo
    const declination = -23.45 * Math.cos(2 * Math.PI * (dayOfYear + 10) / 365.25);
    const hourAngle = Math.acos(-Math.tan(lat * Math.PI / 180) * Math.tan(declination * Math.PI / 180));
    const sunriseHour = 12 - (hourAngle * 180 / Math.PI) / 15;
    const sunsetHour = 12 + (hourAngle * 180 / Math.PI) / 15;
    
    const formatTime = (hour: number) => {
      const h = Math.floor(hour);
      const m = Math.floor((hour - h) * 60);
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };
    
    return { 
      temp: parseFloat(temp.toFixed(1)), 
      hum, 
      icon, 
      sunrise: formatTime(sunriseHour),
      sunset: formatTime(sunsetHour)
    };
  }, [now]);

  // Simple heartbeat for live clock on header
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Observe center column size to keep charts within bounds (width + per-chart height)
  useEffect(() => {
    const el = centerColRef.current;
    if (!el) return;
    const update = () => {
      setChartWidth(Math.max(320, el.clientWidth));
      // 3 charts stacked: account for 2 gaps (gap-2 = 8px) and per-chart header (~28px including margin)
      const gapTotal = 16; // 2 * 8px
      const headerPerChart = 28; // title + margins
      const headerTotal = headerPerChart * 3;
      const raw = el.clientHeight - gapTotal - headerTotal;
      const usable = Math.max(120, raw); // safeguard
      const each = Math.max(120, Math.floor(usable / 3));
      setChartHeight(each);
    };
    update();
    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    return () => ro.disconnect();
  }, [centerColRef]);

  const Gauge: React.FC<{ value?: number; min: number; max: number; label: string; unit?: string; color?: string; dangerZones?: { from: number; to: number; color: string }[]; small?: boolean; showMinMax?: boolean; }> = ({ value, min, max, label, unit = '', color = '#22c55e', dangerZones = [], small = false, showMinMax = false }) => {
    const v = value ?? 0;
    const pct = Math.max(0, Math.min(1, (v - min) / (max - min || 1)));
    const isPercentUnit = (unit || '').includes('%');
    
    // Exact geometry from reference image
    const centerX = 100;
    const centerY = 100;
    const outerRadius = 88;
    const innerRadius = 70; // Reduced gap between rings
    const outerStroke = 4;
    const innerStroke = 24; // Much thicker inner ring
    
    // Create semicircle paths
    const outerPath = `M ${centerX - outerRadius} ${centerY} A ${outerRadius} ${outerRadius} 0 0 1 ${centerX + outerRadius} ${centerY}`;
    const innerPath = `M ${centerX - innerRadius} ${centerY} A ${innerRadius} ${innerRadius} 0 0 1 ${centerX + innerRadius} ${centerY}`;
    
    const paddingCls = small ? 'p-3' : 'p-4';
    const minHCls = small ? 'min-h-[130px]' : 'min-h-[160px]';
    
    return (
      <div className={`bg-gray-900 border border-gray-700 rounded-xl ${paddingCls} ${minHCls} flex flex-col items-center justify-between shadow-inner`}>
        <svg viewBox="0 0 200 120" className="w-full">
          {/* Outer ring - 3 color segments */}
          <path d={outerPath} stroke="#38bdf8" strokeWidth={outerStroke} fill="none" strokeLinecap="round" pathLength="100" strokeDasharray="25 100" />
          <path d={outerPath} stroke="#22c55e" strokeWidth={outerStroke} fill="none" strokeLinecap="round" pathLength="100" strokeDasharray="50 100" strokeDashoffset="-25" />
          <path d={outerPath} stroke="#ef4444" strokeWidth={outerStroke} fill="none" strokeLinecap="round" pathLength="100" strokeDasharray="25 100" strokeDashoffset="-75" />
          
          {/* Inner thick ring - background track */}
          <path d={innerPath} stroke="#1f2937" strokeWidth={innerStroke} fill="none" />
          
          {/* Inner thick ring - progress fill */}
          <path d={innerPath} stroke={color} strokeWidth={innerStroke} fill="none" pathLength="100" strokeDasharray={`${pct * 100} 100`} />
          
          {/* Center value text */}
          <text x={centerX} y={centerY - 15} textAnchor="middle" className="fill-white" style={{ fontSize: small ? '20px' : '24px', fontWeight: 800 }}>
            {Number.isFinite(v) ? `${v.toFixed(isPercentUnit ? 0 : 1)}${unit}` : `—${unit}`}
          </text>
        </svg>
        <div className="text-[11px] text-gray-300 uppercase tracking-wide mt-1">{label}</div>
      </div>
    );
  };

  const Cartesian: React.FC<{ mode: 'combined'|'temp'|'hum'; title: string; width: number; height: number; }> = ({ mode, title, width, height }) => {
    if (!series?.timestamps?.length || !series.temp || !series.rh) return <div className="flex items-center justify-center h-full min-h-[120px] text-sm text-gray-500 bg-gray-900 border border-gray-700 rounded-xl">No data</div>;
    // Explicit canvas size (no letterboxing) - we still draw with margins
    const w = Math.max(320, width);
    const h = Math.max(120, height);
    const l = 38; const r = 12; const t = 20; const b = 30;
    
    const xs = series.timestamps.map(d=>d.getTime());
    const xMin = xs[0]; const xMax = xs[xs.length-1];
    const tMin = Math.min(...series.temp, ...(compareSeries?.temp||[]));
    const tMax = Math.max(...series.temp, ...(compareSeries?.temp||[]));
    const hMin = Math.min(...series.rh, ...(compareSeries?.rh||[]));
    const hMax = Math.max(...series.rh, ...(compareSeries?.rh||[]));
    const yMin = Math.min(tMin, hMin); const yMax = Math.max(tMax, hMax);
    const span = yMax - yMin || 1;
  const innerW = w - l - r; 
  const innerH = h - t - b;
    
    const mapPoint = (time:number,val:number)=>{ 
      const x = l + (innerW * (time - xMin)/(xMax - xMin || 1)); 
      const y = t + innerH * (1 - (val - yMin)/span); 
      return {x,y}; 
    };
    
    const pathFor = (arr:number[]) => arr.map((v,i)=>{const p=mapPoint(xs[i],v);return `${i===0?'M':'L'}${p.x},${p.y}`}).join(' ');
    const primaryTempPath = pathFor(series.temp);
    const primaryHumPath = pathFor(series.rh);
    const compareTempPath = compareSeries?.temp? pathFor(compareSeries.temp): null;
    const compareHumPath = compareSeries?.rh? pathFor(compareSeries.rh): null;
    const startLabel = new Date(xs[0]); const midLabel = new Date((xMin+xMax)/2); const endLabel = new Date(xs[xs.length-1]);
    const timeFmt = (d:Date)=> `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
    const yTicks = Array.from({length:5}).map((_,i)=> yMin + (span)*i/4);
    
    return (
      <svg 
        width={w}
        height={h}
        className="w-full bg-gray-900 border border-gray-700 rounded-xl block"
      >
          <rect x={l} y={t} width={innerW} height={innerH} fill="#0b1220" stroke="#1f2937" />
          {yTicks.map((v,i)=>{const y=t+innerH*(1 - (v-yMin)/span);return <g key={i}><line x1={l} x2={l+innerW} y1={y} y2={y} stroke="#1f2937"/><text x={l-4} y={y+3} fontSize={8} fill="#64748b" textAnchor="end">{v.toFixed(0)}</text></g>;})}
          {[0,0.25,0.5,0.75,1].map(f=>{const x=l+innerW*f;return <line key={f} x1={x} x2={x} y1={t} y2={t+innerH} stroke="#1f2937"/>})}
          {(mode==='combined' || mode==='temp') && <path d={primaryTempPath} fill="none" stroke="#ef4444" strokeWidth={2} />}
          {(mode==='combined' || mode==='hum') && <path d={primaryHumPath} fill="none" stroke="#3b82f6" strokeWidth={2} />}
          {(mode!=='hum' && compareTempPath) && <path d={compareTempPath} fill="none" stroke="#f97316" strokeWidth={1.5} strokeDasharray="3 3" />}
          {(mode!=='temp' && compareHumPath) && <path d={compareHumPath} fill="none" stroke="#10b981" strokeWidth={1.5} strokeDasharray="3 3" />}
          <g>
            <rect x={l+8} y={t+8} width={180} height={30} rx={4} ry={4} fill="#111827" stroke="#1f2937" />
            {(mode==='combined' || mode==='temp') && (<>
              <circle cx={l+18} cy={t+20} r={3} fill="#ef4444" />
              <text x={l+26} y={t+23} fontSize={9} fill="#e5e7eb">Temp (°C)</text>
            </>)}
            {(mode==='combined' || mode==='hum') && (<>
              <circle cx={l+100} cy={t+20} r={3} fill="#3b82f6" />
              <text x={l+108} y={t+23} fontSize={9} fill="#e5e7eb">Humidity (%)</text>
            </>)}
            {compareSeries && (<>
              {(mode!=='hum') && (<>
                <line x1={l+18} y1={t+30} x2={l+26} y2={t+30} stroke="#f97316" strokeWidth={1.5} strokeDasharray="3 3" />
                <text x={l+30} y={t+33} fontSize={8} fill="#fbbf24">Compare T</text>
              </>)}
              {(mode!=='temp') && (<>
                <line x1={l+100} y1={t+30} x2={l+108} y2={t+30} stroke="#10b981" strokeWidth={1.5} strokeDasharray="3 3" />
                <text x={l+112} y={t+33} fontSize={8} fill="#34d399">Compare H</text>
              </>)}
            </>)}
          </g>
          <text x={l} y={h-8} fontSize={9} fill="#94a3b8">{timeFmt(startLabel)}</text>
          <text x={l+innerW/2} y={h-8} fontSize={9} fill="#94a3b8" textAnchor="middle">{timeFmt(midLabel)}</text>
          <text x={l+innerW} y={h-8} fontSize={9} fill="#94a3b8" textAnchor="end">{timeFmt(endLabel)}</text>
      </svg>
    );
  };

  return (
    <div className="fixed left-0 right-0 bottom-0 top-16 bg-gray-950/98 z-[2000] flex flex-col">
      {/* Top Header */}
      <div className="px-4 py-2 border-b border-gray-800 bg-gray-900/70">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
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
            <input ref={dateInputEl} type="date" max={todayYmd} className="absolute w-0 h-0 opacity-0 pointer-events-none" value={dateInputValue} onChange={e=>{ const d=new Date(e.target.value+ 'T00:00:00'); const today=new Date(); today.setHours(0,0,0,0); if(!isNaN(d.getTime())) setDate(d>today? today : d); }} />

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
      <div className="flex-1 grid grid-cols-12 gap-3 p-3 overflow-hidden">
        {/* Left column: Current Condition + Temperature + Humidity */}
        <div className="col-span-12 md:col-span-3 flex flex-col h-full space-y-2 min-h-0">
          {/* Current Condition Section */}
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 flex-1 min-h-0">
            <div className="text-sm font-semibold text-white mb-2 text-center">Current Condition</div>
            <div className="grid grid-cols-2 gap-2 flex-1 min-h-0">
              {/* Indoor Temperature (Gauge) */}
              <Gauge
                label="Indoor"
                value={gaugeStats?.tCur ?? stats?.tCur ?? 23}
                min={0}
                max={50}
                unit=" °C"
                color="#22c55e"
                dangerZones={[{ from: 42.5, to: 50, color: '#ef4444' }]}
                small
              />

              {/* Outdoor Temperature (Gauge) */}
              <Gauge
                label="Outdoor"
                value={weatherData.temp}
                min={0}
                max={50}
                unit=" °C"
                color="#22c55e"
                dangerZones={[{ from: 42.5, to: 50, color: '#ef4444' }]}
                small
              />

              {/* Indoor Humidity (Gauge) */}
              <Gauge
                label="Indoor"
                value={gaugeStats?.hCur ?? stats?.hCur ?? 60}
                min={0}
                max={100}
                unit=" %H"
                color="#22c55e"
                dangerZones={[{ from: 85, to: 100, color: '#ef4444' }]}
                small
              />

              {/* Outdoor Humidity (Gauge) */}
              <Gauge
                label="Outdoor"
                value={weatherData.hum}
                min={0}
                max={100}
                unit=" %H"
                color="#22c55e"
                dangerZones={[{ from: 85, to: 100, color: '#ef4444' }]}
                small
              />
            </div>
          </div>

          {/* Temperature Min/Max Section */}
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 flex-shrink-0">
            <div className="text-sm font-semibold text-white mb-3 text-center">Temperature</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 text-center">
                <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">Min</div>
                <div className="text-lg font-bold text-blue-400">{Math.round(gaugeStats?.tMin ?? stats?.tMin ?? 0)}°C</div>
                <div className="text-xs text-gray-500 mt-1">00:00</div>
              </div>
              <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 text-center">
                <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">Max</div>
                <div className="text-lg font-bold text-red-400">{Math.round(gaugeStats?.tMax ?? stats?.tMax ?? 0)}°C</div>
                <div className="text-xs text-gray-500 mt-1">00:00</div>
              </div>
            </div>
          </div>

          {/* Humidity Min/Max Section */}
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 flex-shrink-0">
            <div className="text-sm font-semibold text-white mb-3 text-center">Humidity</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 text-center">
                <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">Min</div>
                <div className="text-lg font-bold text-blue-400">{Math.round(gaugeStats?.hMin ?? stats?.hMin ?? 0)}%</div>
                <div className="text-xs text-gray-500 mt-1">00:00</div>
              </div>
              <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 text-center">
                <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">Max</div>
                <div className="text-lg font-bold text-red-400">{Math.round(gaugeStats?.hMax ?? stats?.hMax ?? 0)}%</div>
                <div className="text-xs text-gray-500 mt-1">00:00</div>
              </div>
            </div>
          </div>
        </div>

        {/* Center column: three graphs */}
        <div ref={centerColRef} className="col-span-12 md:col-span-6 flex flex-col h-full min-w-0 overflow-hidden">
          {/* Container for all three graphs with dynamic height distribution */}
          <div className="flex-1 flex flex-col gap-2 min-h-0">
            {/* Combined Temperature + Humidity Graph */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-1 flex-shrink-0">
                <h4 className="text-sm font-semibold text-gray-200">Temperature & Humidity</h4>
                {compareSeries && <div className="text-xs text-gray-400">vs Compare Sensor</div>}
              </div>
              <div className="flex-1 min-h-0">
                <Cartesian mode="combined" title="Combined" width={chartWidth} height={chartHeight} />
              </div>
            </div>

            {/* Temperature Only Graph */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-1 flex-shrink-0">
                <h4 className="text-sm font-semibold text-gray-200">Temperature</h4>
              </div>
              <div className="flex-1 min-h-0">
                <Cartesian mode="temp" title="Temperature" width={chartWidth} height={chartHeight} />
              </div>
            </div>

            {/* Humidity Only Graph */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-1 flex-shrink-0">
                <h4 className="text-sm font-semibold text-gray-200">Humidity</h4>
              </div>
              <div className="flex-1 min-h-0">
                <Cartesian mode="hum" title="Humidity" width={chartWidth} height={chartHeight} />
              </div>
            </div>
          </div>
        </div>

        {/* Right column: Weather + Compare + Alerts */}
        <div className="col-span-12 md:col-span-3 flex flex-col h-full gap-3 min-h-0">
          {/* Weather (external, not indoor) */}
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 flex-1 min-h-0 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="text-xs font-semibold text-gray-400 uppercase">Weather Condition</div>
            </div>
            
            <div className="flex items-center justify-between mb-4">
              <div className="text-4xl">{weatherData.icon}</div>
              <div className="text-right">
                <div className="text-3xl font-bold text-white">{weatherData.temp.toFixed(1)}°C</div>
                <div className="text-sm text-gray-400">Humidity {weatherData.hum}%</div>
              </div>
            </div>
            
            <div className="flex-1 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                
                  <div className="text-xs text-gray-400 mb-1">Sunrise</div>
                  <div className="text-sm font-semibold text-white">{weatherData.sunrise}</div>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                 
                  <div className="text-xs text-gray-400 mb-1">Sunset</div>
                  <div className="text-sm font-semibold text-white">{weatherData.sunset}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Compare UI */}
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 flex-1">
            <div className="text-xs font-semibold text-gray-400 mb-2 uppercase">Compare</div>
            {/* Row A: Base (current) */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <label className="block text-[11px] text-gray-400 mb-1">Date A</label>
                <input
                  type="date"
                  className="w-full bg-gray-800 border border-gray-700 rounded-md text-sm text-gray-200 px-2 py-1"
                  max={todayYmd}
                  value={dateInputValue}
                  onChange={e=>{ const d=new Date(e.target.value+ 'T00:00:00'); const today=new Date(); today.setHours(0,0,0,0); if(!isNaN(d.getTime())) setDate(d>today? today : d); }}
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
                  max={todayYmd}
                  value={`${(compareDate.getFullYear())}-${(compareDate.getMonth()+1).toString().padStart(2,'0')}-${(compareDate.getDate()).toString().padStart(2,'0')}`}
                  onChange={e=>{ const d=new Date(e.target.value+ 'T00:00:00'); const today=new Date(); today.setHours(0,0,0,0); if(!isNaN(d.getTime())) setCompareDate(d>today? today : d); }}
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
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 flex-1">
            <div className="text-xs font-semibold text-gray-400 mb-3 uppercase">Active Alerts</div>
            <div className="space-y-2">
              <div className="flex items-center gap-3 bg-blue-900/30 border border-blue-700 rounded-lg p-3">
                <div className="w-2 h-2 bg-blue-400 rounded-full flex-shrink-0"></div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-blue-400">System Normal</div>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-red-900/30 border border-red-700 rounded-lg p-3">
                <div className="w-2 h-2 bg-red-400 rounded-full flex-shrink-0"></div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-red-400">Sensor Offline</div>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-yellow-900/30 border border-yellow-700 rounded-lg p-3">
                <div className="w-2 h-2 bg-yellow-400 rounded-full flex-shrink-0"></div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-yellow-400">Temperature High</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {loading && (<div className="absolute inset-0 flex items-center justify-center bg-gray-900/50"><div className="text-sm text-gray-300">Loading data…</div></div>)}
      {error && (<div className="absolute top-16 left-1/2 -translate-x-1/2 bg-red-600/90 text-white text-xs px-3 py-2 rounded-md shadow">{error}</div>)}
    </div>
  );
}
