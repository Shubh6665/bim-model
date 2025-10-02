"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Sensor } from "@/app/context/sensor-context";

interface Props {
  sensor: Sensor;
  allSensors: Sensor[];
  onClose: () => void;
  projectId?: string | null;
  standalone?: boolean;
}

type DailySeries = { timestamps: Date[]; temp?: number[]; rh?: number[] };

export default function SensorGraphsDashboard({ sensor, allSensors, onClose, projectId, standalone = false }: Props) {
  const [date, setDate] = useState(() => new Date());
  const [series, setSeries] = useState<DailySeries | null>(null);
  const [combinedSeries, setCombinedSeries] = useState<DailySeries | null>(null);
  const [tempSeries, setTempSeries] = useState<DailySeries | null>(null);
  const [humSeries, setHumSeries] = useState<DailySeries | null>(null);
  const [compareSensorId, setCompareSensorId] = useState<string | null>(null);
  const [compareSeries, setCompareSeries] = useState<DailySeries | null>(null);
  const [compareDate, setCompareDate] = useState<Date>(() => new Date());
  const [compareRoom, setCompareRoom] = useState<string>("");
  // Separate states for compare section
  const [compareDateA, setCompareDateA] = useState<Date>(() => new Date());
  const [compareDateB, setCompareDateB] = useState<Date>(() => new Date());
  const [compareRoomA, setCompareRoomA] = useState<string>("");
  const [compareRoomB, setCompareRoomB] = useState<string>("");
  // State to track if we're in comparison mode
  const [isCompareMode, setIsCompareMode] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<Date>(() => new Date());
  const centerColRef = useRef<HTMLDivElement | null>(null);
  const [chartWidth, setChartWidth] = useState<number>(800);
  const [chartHeight, setChartHeight] = useState<number>(150);
  const dateInputEl = useRef<HTMLInputElement | null>(null);
  // Live stats for gauges (independent of selected date)
  const [gaugeStats, setGaugeStats] = useState<{ tCur: number; hCur: number; tMin: number; tMax: number; hMin: number; hMax: number; tMinTime?: string; tMaxTime?: string; hMinTime?: string; hMaxTime?: string } | null>(null);
  
  // Time period scales for each graph
  const [combinedScale, setCombinedScale] = useState<"D" | "W" | "M" | "Y">("D");
  const [tempScale, setTempScale] = useState<"D" | "W" | "M" | "Y">("D");
  const [humScale, setHumScale] = useState<"D" | "W" | "M" | "Y">("D");

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

  const loadForSensor = async (target: Sensor, setter: (s: DailySeries|null)=>void, which: 'primary'|'compare', forDate?: Date, scale: "D" | "W" | "M" | "Y" = "D") => {
    try {
      const baseDate = forDate || date;
      let start = new Date(baseDate);
      let end = new Date(baseDate);
      let resolution = '96'; // Default for daily
      
      // Adjust date range based on scale
      switch (scale) {
        case "D":
          start.setHours(0,0,0,0);
          end.setHours(23,59,59,999);
          resolution = '96'; // 15-min intervals for day
          break;
        case "W":
          // Start of week (Sunday)
          const dayOfWeek = start.getDay();
          start.setDate(start.getDate() - dayOfWeek);
          start.setHours(0,0,0,0);
          end = new Date(start);
          end.setDate(end.getDate() + 6);
          end.setHours(23,59,59,999);
          resolution = '168'; // Hourly for week
          break;
        case "M":
          // Start of month
          start.setDate(1);
          start.setHours(0,0,0,0);
          end = new Date(start);
          end.setMonth(end.getMonth() + 1);
          end.setDate(0);
          end.setHours(23,59,59,999);
          resolution = '720'; // Daily for month
          break;
        case "Y":
          // Start of year
          start.setMonth(0, 1);
          start.setHours(0,0,0,0);
          end = new Date(start);
          end.setFullYear(end.getFullYear() + 1);
          end.setDate(0);
          end.setHours(23,59,59,999);
          resolution = '8760'; // Daily for year
          break;
      }
      
      // If loading today, align end to now so the latest sample equals current time
      const today = new Date();
      const isSameDay = start.getFullYear()===today.getFullYear() && start.getMonth()===today.getMonth() && start.getDate()===today.getDate() && scale === "D";
      if (isSameDay) end = new Date();
      
      const params = new URLSearchParams({ start: start.toISOString(), end: end.toISOString(), resolution });
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
    // Skip loading when in comparison mode
    if (isCompareMode) return;
    
    setLoading(true);
    // Load data for each graph with its respective scale
    Promise.all([
      loadForSensor(sensor, setSeries, 'primary', date, "D"), // Keep original for compatibility
      loadForSensor(sensor, setCombinedSeries, 'primary', date, combinedScale),
      loadForSensor(sensor, setTempSeries, 'primary', date, tempScale),
      loadForSensor(sensor, setHumSeries, 'primary', date, humScale)
    ]).finally(() => setLoading(false));
  }, [sensor.id, date, projectId, combinedScale, tempScale, humScale, isCompareMode]);

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
        const timestamps: Date[] = (json.timestamps||[]).map((t: string) => new Date(t));
        
        let tMin = tArr.length? Math.min(...tArr): 0;
        let tMax = tArr.length? Math.max(...tArr): 0;
        let hMin = hArr.length? Math.min(...hArr): 0;
        let hMax = hArr.length? Math.max(...hArr): 0;
        let tCur = tArr.length? tArr[tArr.length-1] : 0;
        let hCur = hArr.length? hArr[hArr.length-1] : 0;
        
        // Find timestamps when min/max occurred
        const formatTime = (date: Date) => 
          `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        
        let tMinTime = '00:00', tMaxTime = '00:00', hMinTime = '00:00', hMaxTime = '00:00';
        
        if (tArr.length && timestamps.length) {
          const tMinIndex = tArr.findIndex(t => t === tMin);
          const tMaxIndex = tArr.findIndex(t => t === tMax);
          if (tMinIndex >= 0 && timestamps[tMinIndex]) tMinTime = formatTime(timestamps[tMinIndex]);
          if (tMaxIndex >= 0 && timestamps[tMaxIndex]) tMaxTime = formatTime(timestamps[tMaxIndex]);
        }
        
        if (hArr.length && timestamps.length) {
          const hMinIndex = hArr.findIndex(h => h === hMin);
          const hMaxIndex = hArr.findIndex(h => h === hMax);
          if (hMinIndex >= 0 && timestamps[hMinIndex]) hMinTime = formatTime(timestamps[hMinIndex]);
          if (hMaxIndex >= 0 && timestamps[hMaxIndex]) hMaxTime = formatTime(timestamps[hMaxIndex]);
        }
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
        setGaugeStats({ tCur, hCur, tMin, tMax, hMin, hMax, tMinTime, tMaxTime, hMinTime, hMaxTime });
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
          if (!prev) return { tCur: num, hCur: 0, tMin: num, tMax: num, hMin: 0, hMax: 0, tMinTime: '00:00', tMaxTime: '00:00', hMinTime: '00:00', hMaxTime: '00:00' };
          const tMin = Math.min(prev.tMin || num, num);
          const tMax = Math.max(prev.tMax || num, num);
          const now = new Date();
          const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
          
          // Update timestamps only if we have new min/max values
          let tMinTime = prev.tMinTime || '00:00';
          let tMaxTime = prev.tMaxTime || '00:00';
          
          if (num < (prev.tMin || num)) tMinTime = currentTime;
          if (num > (prev.tMax || num)) tMaxTime = currentTime;
          
          return { ...prev, tCur: num, tMin, tMax, tMinTime, tMaxTime };
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
    if (!series?.temp || !series.rh || !series.timestamps) return null;
    
    const tMin = Math.min(...series.temp);
    const tMax = Math.max(...series.temp);
    const hMin = Math.min(...series.rh);
    const hMax = Math.max(...series.rh);
    const tCur = series.temp[series.temp.length-1];
    const hCur = series.rh[series.rh.length-1];
    
    // Find timestamps when min/max occurred
    const tMinIndex = series.temp.findIndex(t => t === tMin);
    const tMaxIndex = series.temp.findIndex(t => t === tMax);
    const hMinIndex = series.rh.findIndex(h => h === hMin);
    const hMaxIndex = series.rh.findIndex(h => h === hMax);
    
    const formatTime = (date: Date) => 
      `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    
    const tMinTime = tMinIndex >= 0 ? formatTime(series.timestamps[tMinIndex]) : '00:00';
    const tMaxTime = tMaxIndex >= 0 ? formatTime(series.timestamps[tMaxIndex]) : '00:00';
    const hMinTime = hMinIndex >= 0 ? formatTime(series.timestamps[hMinIndex]) : '00:00';
    const hMaxTime = hMaxIndex >= 0 ? formatTime(series.timestamps[hMaxIndex]) : '00:00';
    
    return { tMin, tMax, hMin, hMax, tCur, hCur, tMinTime, tMaxTime, hMinTime, hMaxTime };
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
    
    const paddingCls = small ? 'p-2' : 'p-4';
    const minHCls = small ? 'min-h-[110px]' : 'min-h-[160px]';
    
    return (
      <div className={`bg-gray-900 border border-gray-700 rounded-xl ${paddingCls} ${minHCls} flex flex-col items-center shadow-inner`}>
        <svg viewBox="0 0 200 120" className="w-full flex-1">
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
        <div className="text-[11px] text-gray-300 uppercase tracking-wide -mt-1">{label}</div>
      </div>
    );
  };

  // Small inline scale switch used in each chart header
  const ScaleSwitch: React.FC<{
    currentScale: "D" | "W" | "M" | "Y";
    setScale: (scale: "D" | "W" | "M" | "Y") => void;
  }> = ({ currentScale, setScale }) => (
    <div className="flex items-center gap-1">
      {(["D","W","M","Y"] as const).map(k => (
        <button
          key={k}
          onClick={() => setScale(k)}
          className={`px-2 py-0.5 rounded border text-[10px] font-semibold transition ${
            currentScale === k
              ? "bg-blue-600 border-blue-500 text-white"
              : "bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"
          }`}
          title={
            k === "D" ? "Day" : k === "W" ? "Week" : k === "M" ? "Month" : "Year"
          }
        >
          {k}
        </button>
      ))}
    </div>
  );

  // WiFi Signal Strength Component
  const WiFiSignal: React.FC<{ strength: number; size?: number }> = ({ strength, size = 16 }) => {
    // strength: 0-4 (0 = no signal, 4 = excellent)
    const getColor = () => {
      if (strength >= 4) return '#22c55e'; // Green - Excellent
      if (strength >= 3) return '#eab308'; // Yellow - Good  
      if (strength >= 2) return '#f97316'; // Orange - Fair
      if (strength >= 1) return '#ef4444'; // Red - Poor
      return '#6b7280'; // Gray - No signal
    };

    const color = getColor();
    const viewBoxSize = 24;
    const centerX = 12;
    const centerY = 20;

    return (
      <svg width={size} height={size} viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`} className="inline-block">
        {/* Base triangle/dot */}
        <circle 
          cx={centerX} 
          cy={centerY} 
          r="1.5" 
          fill={strength >= 1 ? color : '#374151'}
        />
        
        {/* Arc 1 - Smallest */}
        <path 
          d={`M ${centerX - 3} ${centerY - 2} A 4 4 0 0 1 ${centerX + 3} ${centerY - 2}`}
          stroke={strength >= 2 ? color : '#374151'} 
          strokeWidth="1.5" 
          fill="none"
          strokeLinecap="round"
        />
        
        {/* Arc 2 - Medium */}
        <path 
          d={`M ${centerX - 5} ${centerY - 4} A 7 7 0 0 1 ${centerX + 5} ${centerY - 4}`}
          stroke={strength >= 3 ? color : '#374151'} 
          strokeWidth="1.5" 
          fill="none"
          strokeLinecap="round"
        />
        
        {/* Arc 3 - Large */}
        <path 
          d={`M ${centerX - 7} ${centerY - 6} A 10 10 0 0 1 ${centerX + 7} ${centerY - 6}`}
          stroke={strength >= 4 ? color : '#374151'} 
          strokeWidth="1.5" 
          fill="none"
          strokeLinecap="round"
        />
        
        {/* Arc 4 - Largest */}
        <path 
          d={`M ${centerX - 9} ${centerY - 8} A 13 13 0 0 1 ${centerX + 9} ${centerY - 8}`}
          stroke={strength >= 4 ? color : '#374151'} 
          strokeWidth="1.5" 
          fill="none"
          strokeLinecap="round"
        />
      </svg>
    );
  };

  const Cartesian: React.FC<{ mode: 'combined'|'temp'|'hum'; title: string; width: number; height: number; data: DailySeries | null; scale: "D" | "W" | "M" | "Y"; }> = ({ mode, title, width, height, data, scale }) => {
    const [hoverX, setHoverX] = useState<number | null>(null);
    const [hoverIndex, setHoverIndex] = useState<number | null>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    
    if (!data?.timestamps?.length || !data.temp || !data.rh) return <div className="flex items-center justify-center h-full min-h-[120px] text-sm text-gray-500 bg-gray-900 border border-gray-700 rounded-xl">No data</div>;
    // Explicit canvas size (no letterboxing) - we still draw with margins
    const w = Math.max(320, width);
    const h = Math.max(120, height);
    const l = 38; const r = 12; const t = 20; const b = 30;
    
    const xs = data.timestamps.map(d=>d.getTime());
    const xMin = xs[0]; const xMax = xs[xs.length-1];
    const tMin = Math.min(...(data.temp || []), ...(compareSeries?.temp||[]));
    const tMax = Math.max(...(data.temp || []), ...(compareSeries?.temp||[]));
    const hMin = Math.min(...(data.rh || []), ...(compareSeries?.rh||[]));
    const hMax = Math.max(...(data.rh || []), ...(compareSeries?.rh||[]));
    
    // Determine Y-axis range based on chart mode
    let yMin, yMax, span;
    if (mode === 'temp') {
      yMin = tMin - 2; // Add some padding
      yMax = tMax + 2;
    } else if (mode === 'hum') {
      // For humidity, create a focused range around the actual data
      const humRange = hMax - hMin;
      const padding = Math.max(5, humRange * 0.2); // At least 5% padding or 20% of range
      yMin = Math.max(0, hMin - padding);
      yMax = Math.min(100, hMax + padding);
      
      // If the range is too small (less than 20%), expand it
      if ((yMax - yMin) < 20) {
        const center = (hMin + hMax) / 2;
        yMin = Math.max(0, center - 10);
        yMax = Math.min(100, center + 10);
      }
    } else { // combined mode
      // For combined mode, normalize both temp and humidity to show variations clearly
      // Use a range that accommodates both with appropriate scaling
      const tempPadding = (tMax - tMin || 1) * 0.1;
      const humPadding = (hMax - hMin || 1) * 0.2;
      
      // Create a unified scale that shows both clearly
      const tempMin = tMin - tempPadding;
      const tempMax = tMax + tempPadding;
      const humMin = Math.max(0, hMin - humPadding);
      const humMax = Math.min(100, hMax + humPadding);
      
      // Use a range that includes both comfortably
      yMin = Math.min(tempMin, humMin);
      yMax = Math.max(tempMax, humMax);
      
      // Ensure minimum range for visibility
      if ((yMax - yMin) < 30) {
        const center = (yMin + yMax) / 2;
        yMin = center - 15;
        yMax = center + 15;
      }
    }
    span = yMax - yMin || 1;
  const innerW = w - l - r; 
  const innerH = h - t - b;
    
    const mapPoint = (time:number,val:number)=>{ 
      const x = l + (innerW * (time - xMin)/(xMax - xMin || 1)); 
      const y = t + innerH * (1 - (val - yMin)/span); 
      return {x,y}; 
    };
    
    const pathFor = (arr:number[]) => arr.map((v,i)=>{const p=mapPoint(xs[i],v);return `${i===0?'M':'L'}${p.x},${p.y}`}).join(' ');
    const primaryTempPath = pathFor(data.temp!);
    const primaryHumPath = pathFor(data.rh!);
    const compareTempPath = compareSeries?.temp? pathFor(compareSeries.temp): null;
    const compareHumPath = compareSeries?.rh? pathFor(compareSeries.rh): null;
    
    // Generate all X-axis labels based on scale and actual data range
    let xLabels: { position: number; label: string }[] = [];
    
    switch (scale) {
      case "D": // Day: Show hourly times based on actual data range
        const startHour = new Date(xs[0]).getHours();
        const endHour = new Date(xs[xs.length - 1]).getHours();
        const dataSpanHours = (xs[xs.length - 1] - xs[0]) / (1000 * 60 * 60); // hours
        
        // Determine step size based on data span
        let hourStep = 2;
        if (dataSpanHours <= 6) hourStep = 1;
        else if (dataSpanHours <= 12) hourStep = 2;
        else hourStep = 3;
        
        // Generate labels for actual time range
        for (let hour = Math.floor(startHour / hourStep) * hourStep; hour <= endHour + hourStep; hour += hourStep) {
          if (hour > 23) break;
          const timeInMs = new Date(xs[0]).setHours(hour, 0, 0, 0);
          if (timeInMs < xs[0] || timeInMs > xs[xs.length - 1]) continue;
          
          const timePos = (timeInMs - xMin) / (xMax - xMin);
          const x = l + innerW * timePos;
          xLabels.push({
            position: x,
            label: `${hour.toString().padStart(2,'0')}:00`
          });
        }
        break;
        
      case "W": // Week: Show days based on actual data range
        const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
        const startDate = new Date(xs[0]);
        const endDate = new Date(xs[xs.length - 1]);
        const currentDate = new Date(startDate);
        
        while (currentDate <= endDate) {
          const dayOfWeek = currentDate.getDay();
          const timePos = (currentDate.getTime() - xMin) / (xMax - xMin);
          const x = l + innerW * timePos;
          xLabels.push({
            position: x,
            label: weekDays[dayOfWeek]
          });
          currentDate.setDate(currentDate.getDate() + 1);
        }
        break;
        
      case "M": // Month: Show dates based on actual data range
        const startDateM = new Date(xs[0]);
        const endDateM = new Date(xs[xs.length - 1]);
        const startDay = startDateM.getDate();
        const endDay = endDateM.getDate();
        const monthSpan = endDay - startDay + 1;
        
        // Determine step size based on month span
        let dayStep = monthSpan <= 7 ? 1 : monthSpan <= 15 ? 3 : 5;
        
        for (let day = Math.ceil(startDay / dayStep) * dayStep; day <= endDay; day += dayStep) {
          const testDate = new Date(startDateM.getFullYear(), startDateM.getMonth(), day);
          if (testDate < startDateM || testDate > endDateM) continue;
          
          const timePos = (testDate.getTime() - xMin) / (xMax - xMin);
          const x = l + innerW * timePos;
          xLabels.push({
            position: x,
            label: day.toString()
          });
        }
        break;
        
      case "Y": // Year: Show months based on actual data range
        const monthAbbrevs = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
        const startDateY = new Date(xs[0]);
        const endDateY = new Date(xs[xs.length - 1]);
        const startMonth = startDateY.getMonth();
        const endMonth = endDateY.getMonth();
        const startYear = startDateY.getFullYear();
        const endYear = endDateY.getFullYear();
        
        for (let year = startYear; year <= endYear; year++) {
          const monthStart = year === startYear ? startMonth : 0;
          const monthEnd = year === endYear ? endMonth : 11;
          
          for (let month = monthStart; month <= monthEnd; month++) {
            const testDate = new Date(year, month, 1);
            const timePos = (testDate.getTime() - xMin) / (xMax - xMin);
            const x = l + innerW * timePos;
            xLabels.push({
              position: x,
              label: monthAbbrevs[month]
            });
          }
        }
        break;
        
      default:
        xLabels = [];
    }
    
    // Generate appropriate Y-axis ticks based on mode
    let yTicks;
    if (mode === 'temp') {
      yTicks = Array.from({length:6}).map((_,i)=> Math.round(yMin + (span)*i/5));
    } else if (mode === 'hum') {
      // For humidity, create evenly spaced ticks with nice round numbers
      const numTicks = 5;
      yTicks = [];
      for (let i = 0; i <= numTicks; i++) {
        const tickValue = yMin + (span * i / numTicks);
        yTicks.push(Math.round(tickValue));
      }
      // Remove duplicates and sort
      yTicks = [...new Set(yTicks)].sort((a, b) => a - b);
    } else { // combined
      yTicks = Array.from({length:6}).map((_,i)=> Math.round(yMin + (span)*i/5));
    }
    
    const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
      if (!svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      
      // Check if mouse is within chart area
      if (mouseX < l || mouseX > l + innerW) {
        setHoverX(null);
        setHoverIndex(null);
        return;
      }
      
      // Find closest data point
      const ratio = (mouseX - l) / innerW;
      const timeAtMouse = xMin + ratio * (xMax - xMin);
      let closestIdx = 0;
      let minDist = Math.abs(xs[0] - timeAtMouse);
      
      for (let i = 1; i < xs.length; i++) {
        const dist = Math.abs(xs[i] - timeAtMouse);
        if (dist < minDist) {
          minDist = dist;
          closestIdx = i;
        }
      }
      
      const snapX = mapPoint(xs[closestIdx], data.temp![closestIdx]).x;
      setHoverX(snapX);
      setHoverIndex(closestIdx);
    };
    
    const handleMouseLeave = () => {
      setHoverX(null);
      setHoverIndex(null);
    };
    
    return (
      <svg 
        ref={svgRef}
        width={w}
        height={h}
        className="w-full bg-gray-900 border border-gray-700 rounded-xl block"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
          <rect x={l} y={t} width={innerW} height={innerH} fill="#0b1220" stroke="#1f2937" />
          {/* Y-axis grid lines and labels */}
          {yTicks.map((v,i)=>{const y=t+innerH*(1 - (v-yMin)/span);return <g key={i}><line x1={l} x2={l+innerW} y1={y} y2={y} stroke="#1f2937"/><text x={l-4} y={y+3} fontSize={8} fill="#64748b" textAnchor="end">{v.toFixed(0)}</text></g>;})}
          {/* X-axis grid lines aligned with labels */}
          {xLabels.map((labelInfo, index) => (
            <line 
              key={index}
              x1={labelInfo.position} 
              x2={labelInfo.position} 
              y1={t} 
              y2={t+innerH} 
              stroke="#1f2937"
              strokeWidth={0.5}
            />
          ))}
          {(mode==='combined' || mode==='temp') && <path d={primaryTempPath} fill="none" stroke="#ef4444" strokeWidth={2} />}
          {(mode==='combined' || mode==='hum') && <path d={primaryHumPath} fill="none" stroke="#3b82f6" strokeWidth={2} />}
          {(mode!=='hum' && compareTempPath) && <path d={compareTempPath} fill="none" stroke="#f97316" strokeWidth={1.5} strokeDasharray="3 3" />}
          {(mode!=='temp' && compareHumPath) && <path d={compareHumPath} fill="none" stroke="#10b981" strokeWidth={1.5} strokeDasharray="3 3" />}
          
          {/* Render all X-axis labels */}
          {xLabels.map((labelInfo, index) => (
            <text 
              key={index}
              x={labelInfo.position} 
              y={h-8} 
              fontSize={9} 
              fill="#94a3b8" 
              textAnchor="middle"
            >
              {labelInfo.label}
            </text>
          ))}
          
          {/* Hover crosshair and tooltip */}
          {hoverX !== null && hoverIndex !== null && (
            <g>
              {/* Vertical crosshair line */}
              <line 
                x1={hoverX} 
                x2={hoverX} 
                y1={t} 
                y2={t + innerH} 
                stroke="#60a5fa" 
                strokeWidth={1.5} 
                strokeDasharray="4 4"
                opacity={0.8}
              />
              
              {/* Tooltip background */}
              <rect 
                x={hoverX > l + innerW / 2 ? hoverX - 130 : hoverX + 10} 
                y={t + 10} 
                width={120} 
                height={compareSeries ? (mode === 'combined' ? 110 : 75) : (mode === 'combined' ? 70 : 50)} 
                rx={6} 
                fill="#1f2937" 
                stroke="#374151" 
                strokeWidth={1.5}
                opacity={0.95}
              />
              
              {/* Tooltip content */}
              <text 
                x={hoverX > l + innerW / 2 ? hoverX - 70 : hoverX + 70} 
                y={t + 26} 
                fontSize={10} 
                fill="#9ca3af" 
                textAnchor="middle"
              >
                {(() => {
                  const hoverDate = new Date(xs[hoverIndex]);
                  switch (scale) {
                    case "D": 
                      return `${hoverDate.getHours().toString().padStart(2,'0')}:${hoverDate.getMinutes().toString().padStart(2,'0')}`;
                    case "W": 
                      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                      return `${dayNames[hoverDate.getDay()]} ${hoverDate.getDate()}/${hoverDate.getMonth() + 1}`;
                    case "M": 
                      return `${hoverDate.getDate()}/${hoverDate.getMonth() + 1}/${hoverDate.getFullYear()}`;
                    case "Y": 
                      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                      return `${monthNames[hoverDate.getMonth()]} ${hoverDate.getFullYear()}`;
                    default: return '';
                  }
                })()}
              </text>
              
              {/* Primary sensor values */}
              {(mode === 'combined' || mode === 'temp') && (
                <>
                  <circle 
                    cx={hoverX > l + innerW / 2 ? hoverX - 110 : hoverX + 30} 
                    cy={t + 42} 
                    r={3} 
                    fill="#ef4444" 
                  />
                  <text 
                    x={hoverX > l + innerW / 2 ? hoverX - 100 : hoverX + 40} 
                    y={t + 45} 
                    fontSize={10} 
                    fill="#f3f4f6" 
                    fontWeight="600"
                  >
                    {data.temp![hoverIndex].toFixed(1)}°C
                  </text>
                </>
              )}
              
              {(mode === 'combined' || mode === 'hum') && (
                <>
                  <circle 
                    cx={hoverX > l + innerW / 2 ? hoverX - 110 : hoverX + 30} 
                    cy={mode === 'combined' ? t + 60 : t + 42} 
                    r={3} 
                    fill="#3b82f6" 
                  />
                  <text 
                    x={hoverX > l + innerW / 2 ? hoverX - 100 : hoverX + 40} 
                    y={mode === 'combined' ? t + 63 : t + 45} 
                    fontSize={10} 
                    fill="#f3f4f6" 
                    fontWeight="600"
                  >
                    {data.rh![hoverIndex].toFixed(1)}%
                  </text>
                </>
              )}
              
              {/* Compare sensor values */}
              {compareSeries && (
                <>
                  {/* Divider line */}
                  <line 
                    x1={hoverX > l + innerW / 2 ? hoverX - 120 : hoverX + 20} 
                    x2={hoverX > l + innerW / 2 ? hoverX - 20 : hoverX + 120} 
                    y1={mode === 'combined' ? t + 72 : t + 54} 
                    y2={mode === 'combined' ? t + 72 : t + 54} 
                    stroke="#374151" 
                    strokeWidth={1}
                  />
                  
                  {(mode === 'combined' || mode === 'temp') && compareSeries.temp && (
                    <>
                      <circle 
                        cx={hoverX > l + innerW / 2 ? hoverX - 110 : hoverX + 30} 
                        cy={mode === 'combined' ? t + 84 : t + 66} 
                        r={3} 
                        fill="#f97316" 
                      />
                      <text 
                        x={hoverX > l + innerW / 2 ? hoverX - 100 : hoverX + 40} 
                        y={mode === 'combined' ? t + 87 : t + 69} 
                        fontSize={10} 
                        fill="#fbbf24" 
                        fontWeight="600"
                      >
                        {compareSeries.temp[hoverIndex]?.toFixed(1) || '—'}°C
                      </text>
                    </>
                  )}
                  
                  {(mode === 'combined' || mode === 'hum') && compareSeries.rh && (
                    <>
                      <circle 
                        cx={hoverX > l + innerW / 2 ? hoverX - 110 : hoverX + 30} 
                        cy={mode === 'combined' ? t + 102 : t + 66} 
                        r={3} 
                        fill="#10b981" 
                      />
                      <text 
                        x={hoverX > l + innerW / 2 ? hoverX - 100 : hoverX + 40} 
                        y={mode === 'combined' ? t + 105 : t + 69} 
                        fontSize={10} 
                        fill="#34d399" 
                        fontWeight="600"
                      >
                        {compareSeries.rh[hoverIndex]?.toFixed(1) || '—'}%
                      </text>
                    </>
                  )}
                </>
              )}
              
              {/* Data point markers - Primary sensor */}
              {(mode === 'combined' || mode === 'temp') && (
                <circle 
                  cx={hoverX} 
                  cy={mapPoint(xs[hoverIndex], data.temp![hoverIndex]).y} 
                  r={4} 
                  fill="#ef4444" 
                  stroke="#1f2937" 
                  strokeWidth={2}
                />
              )}
              
              {(mode === 'combined' || mode === 'hum') && (
                <circle 
                  cx={hoverX} 
                  cy={mapPoint(xs[hoverIndex], data.rh![hoverIndex]).y} 
                  r={4} 
                  fill="#3b82f6" 
                  stroke="#1f2937" 
                  strokeWidth={2}
                />
              )}
              
              {/* Data point markers - Compare sensor */}
              {compareSeries && (
                <>
                  {(mode === 'combined' || mode === 'temp') && compareSeries.temp && compareSeries.temp[hoverIndex] !== undefined && (
                    <circle 
                      cx={hoverX} 
                      cy={mapPoint(xs[hoverIndex], compareSeries.temp[hoverIndex]).y} 
                      r={4} 
                      fill="#f97316" 
                      stroke="#1f2937" 
                      strokeWidth={2}
                    />
                  )}
                  
                  {(mode === 'combined' || mode === 'hum') && compareSeries.rh && compareSeries.rh[hoverIndex] !== undefined && (
                    <circle 
                      cx={hoverX} 
                      cy={mapPoint(xs[hoverIndex], compareSeries.rh[hoverIndex]).y} 
                      r={4} 
                      fill="#10b981" 
                      stroke="#1f2937" 
                      strokeWidth={2}
                    />
                  )}
                </>
              )}
            </g>
          )}
      </svg>
    );
  };

  return (
    <div className={standalone ? "h-full w-full bg-gray-950 flex flex-col" : "fixed left-0 right-0 bottom-0 top-16 bg-gray-950/98 z-[2000] flex flex-col"}>
      {/* Top Header */}
      <div className="px-2 md:px-4 py-1.5 md:py-2 border-b border-gray-800 bg-gray-900/70">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold text-white">Sensor Graphs Dashboard</h3>
            <div className="text-xs text-gray-300 flex items-center gap-2">
              <div><span className="text-gray-400">Room:</span> <span className="font-semibold text-white">{sensor.room || '—'}</span></div>
              <div className="hidden sm:block">|</div>
              <div><span className="text-gray-400">Sensor:</span> <span className="font-semibold text-white">{sensor.name}</span></div>
              <div className="hidden sm:block">|</div>
              <div><span className="text-gray-400">Battery:</span> <span className="font-semibold text-white">{sensor.batteryLevel ?? 100}% </span></div>
              <div className="hidden sm:block">|</div>
              <div className="flex items-center gap-1.5">
                <span className="text-gray-400">Wi‑Fi:</span> 
                <div className="flex items-center mb-1">
                 <WiFiSignal strength={sensor.batteryLevel ? (sensor.batteryLevel > 75 ? 4 : sensor.batteryLevel > 50 ? 3 : sensor.batteryLevel > 25 ? 2 : 1) : 4} size={16} />
                </div>
                <span className="font-semibold text-white">
                  {sensor.batteryLevel ? (sensor.batteryLevel > 75 ? 'Excellent' : sensor.batteryLevel > 50 ? 'Good' : sensor.batteryLevel > 25 ? 'Fair' : 'Poor') : 'Excellent'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
            {/* Date pill (calendar style) on the left of this cluster */}
            <button
              onClick={()=>{ const el=dateInputEl.current as any; if(el?.showPicker) el.showPicker(); else el?.click(); }}
              className="px-2 md:px-3 py-1 md:py-1.5 rounded-lg md:rounded-xl bg-gray-800/70 border border-gray-700 text-xs md:text-sm text-gray-100 hover:bg-gray-700/60 transition flex items-center gap-1 md:gap-2"
              title="Pick date"
            >
              <span className="hidden sm:inline">{formatDate(date)}</span>
              <span className="inline sm:hidden text-[10px]">{date.getDate()}/{date.getMonth()+1}</span>
              <span className="inline-block w-3 h-3 md:w-4 md:h-4 text-gray-300">📅</span>
            </button>
            <input ref={dateInputEl} type="date" max={todayYmd} className="absolute w-0 h-0 opacity-0 pointer-events-none" value={dateInputValue} onChange={e=>{ const d=new Date(e.target.value+ 'T00:00:00'); const today=new Date(); today.setHours(0,0,0,0); if(!isNaN(d.getTime())) setDate(d>today? today : d); }} />

            {/* Time label (hh:mm) where the old calendar input used to be */}
            <div className="hidden md:flex px-3 py-1.5 rounded-xl bg-transparent border border-transparent text-sm md:text-base text-gray-200 font-semibold">
              {now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </div>

            {/* Pop Out and Close buttons */}
            {!standalone && (
              <button
                onClick={() => {
                  const roomName = sensor?.room ? encodeURIComponent(sensor.room.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '-')) : 'unknown-room';
                  const sensorName = sensor?.name ? encodeURIComponent(sensor.name.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '-')) : 'unknown-sensor';
                  const url = `/sensor-dashboard/${roomName}/${sensorName}?id=${sensor?.id || ''}&projectId=${projectId || ''}`;
                  window.open(url, '_blank', 'width=1600,height=1000,scrollbars=yes,resizable=yes');
                }}
                className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-blue-600 hover:bg-blue-500 border border-blue-500 text-white text-base md:text-lg flex items-center justify-center flex-shrink-0"
                aria-label="Open in new window"
                title="Open in new window"
              >
                ⧉
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gray-700 hover:bg-gray-600 border border-gray-600 text-white text-base md:text-lg flex items-center justify-center flex-shrink-0"
              aria-label="Close"
              title="Close"
            >
              ×
            </button>
          </div>
        </div>
      </div>

      {/* Body 3-column layout */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-3 p-2 md:p-3 overflow-hidden">
        {/* Left column: Current Condition + Temperature + Humidity */}
        <div className="col-span-1 md:col-span-3 flex flex-col h-auto md:h-full space-y-2 min-h-0">
          {/* Current Condition Section */}
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-2 md:p-3 flex-shrink-0 md:flex-1 md:min-h-0">
            <div className="text-sm md:text-md font-semibold text-white mb-2 text-center">Current Condition</div>
            <div className="grid grid-cols-2 gap-2 md:gap-3">
              {/* Indoor Temperature (Gauge) */}
              <Gauge
                label="Indoor"
                value={gaugeStats?.tCur ?? stats?.tCur ?? 23}
                min={0}
                max={50}
                unit="°C"
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
                unit="°C"
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
                unit="%"
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
                unit="%"
                color="#22c55e"
                dangerZones={[{ from: 85, to: 100, color: '#ef4444' }]}
                small
              />
            </div>
          </div>

          {/* Temperature Min/Max Section */}
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-2 md:p-3 flex-shrink-0">
            <div className="text-sm md:text-md font-semibold text-white mb-2 text-center">Temperature</div>
            <div className="grid grid-cols-2 gap-2">
              {/* Temperature Min Gauge */}
              <div className="relative">
                <Gauge
                  label="Min"
                  value={gaugeStats?.tMin ?? stats?.tMin ?? 0}
                  min={0}
                  max={50}
                  unit="°C"
                  color="#3b82f6"
                  dangerZones={[{ from: 0, to: 5, color: '#06b6d4' }]}
                  small
                />
               
              </div>
              
              {/* Temperature Max Gauge */}
              <div className="relative">
                <Gauge
                  label="Max"
                  value={gaugeStats?.tMax ?? stats?.tMax ?? 0}
                  min={0}
                  max={50}
                  unit="°C"
                  color="#ef4444"
                  dangerZones={[{ from: 42.5, to: 50, color: '#dc2626' }]}
                  small
                />
                
              </div>
            </div>
          </div>

          {/* Humidity Min/Max Section */}
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-2 md:p-3 flex-shrink-0">
            <div className="text-sm md:text-md font-semibold text-white mb-2 text-center">Humidity</div>
            <div className="grid grid-cols-2 gap-2">
              {/* Humidity Min Gauge */}
              <div className="relative">
                <Gauge
                  label="Min"
                  value={gaugeStats?.hMin ?? stats?.hMin ?? 0}
                  min={0}
                  max={100}
                  unit="%"
                  color="#3b82f6"
                  dangerZones={[{ from: 0, to: 20, color: '#06b6d4' }]}
                  small
                />
                
              </div>
              
              {/* Humidity Max Gauge */}
              <div className="relative">
                <Gauge
                  label="Max"
                  value={gaugeStats?.hMax ?? stats?.hMax ?? 0}
                  min={0}
                  max={100}
                  unit="%"
                  color="#ef4444"
                  dangerZones={[{ from: 85, to: 100, color: '#dc2626' }]}
                  small
                />
                
              </div>
            </div>
          </div>
        </div>

        {/* Center column: three graphs */}
        <div ref={centerColRef} className="col-span-1 md:col-span-6 flex flex-col h-auto md:h-full min-w-0 overflow-hidden">
          {/* Container for all three graphs with dynamic height distribution */}
          <div className="flex-1 flex flex-col gap-1.5 md:gap-2 min-h-0">
            {/* Combined Temperature + Humidity Graph */}
            <div className="flex-1 flex flex-col min-h-[120px] md:min-h-0">
              <div className="flex items-center justify-between mb-1 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm md:text-md font-semibold text-white">Temperature & Humidity</h4>
                  {compareSeries && (
                    <div className="text-xs text-gray-400">
                      {compareRoomA} ({formatDate(compareDateA)}) vs {compareRoomB} ({formatDate(compareDateB)})
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  
                  <ScaleSwitch currentScale={combinedScale} setScale={setCombinedScale} />
                </div>
              </div>
              <div className="flex-1 min-h-0">
                <Cartesian mode="combined" title="Combined" width={chartWidth} height={chartHeight} data={combinedSeries} scale={combinedScale} />
              </div>
            </div>

            {/* Temperature Only Graph */}
            <div className="flex-1 flex flex-col min-h-[120px] md:min-h-0">
              <div className="flex items-center justify-between mb-1 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm md:text-md font-semibold text-white">Temperature</h4>
                  {compareSeries && (
                    <div className="text-xs text-gray-400">
                      {compareRoomA} ({formatDate(compareDateA)}) vs {compareRoomB} ({formatDate(compareDateB)})
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
              
                  <ScaleSwitch currentScale={tempScale} setScale={setTempScale} />
                </div>
              </div>
              <div className="flex-1 min-h-0">
                <Cartesian mode="temp" title="Temperature" width={chartWidth} height={chartHeight} data={tempSeries} scale={tempScale} />
              </div>
            </div>

            {/* Humidity Only Graph */}
            <div className="flex-1 flex flex-col min-h-[120px] md:min-h-0">
              <div className="flex items-center justify-between mb-1 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm md:text-md font-semibold text-white">Humidity</h4>
                  {compareSeries && (
                    <div className="text-xs text-gray-400">
                      {compareRoomA} ({formatDate(compareDateA)}) vs {compareRoomB} ({formatDate(compareDateB)})
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  
                  <ScaleSwitch currentScale={humScale} setScale={setHumScale} />
                </div>
              </div>
              <div className="flex-1 min-h-0">
                <Cartesian mode="hum" title="Humidity" width={chartWidth} height={chartHeight} data={humSeries} scale={humScale} />
              </div>
            </div>
          </div>
        </div>

        {/* Right column: Weather + Compare + Alerts */}
        <div className="col-span-1 md:col-span-3 flex flex-col h-auto md:h-full gap-2 md:gap-3 min-h-0">
          {/* Weather (external, not indoor) */}
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-2 md:p-3 flex-shrink-0 md:flex-1 md:min-h-0 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm md:text-base font-semibold text-white">Weather Condition</div>
            </div>
            
            <div className="flex items-center justify-between mb-2">
              <div className="text-4xl">{weatherData.icon}</div>
              <div className="text-right">
                <div className="text-3xl font-bold text-white">{weatherData.temp.toFixed(1)}°C</div>
                <div className="text-sm text-gray-400">Humidity {weatherData.hum}%</div>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gray-800/50 rounded-lg p-2 text-center">
                
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
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-2 md:p-3 flex-shrink-0 md:flex-1">
            <div className="text-sm md:text-base font-semibold text-white mb-2">Compare</div>
            {/* Row A: Independent date selection */}
            <div className="grid grid-cols-2 gap-1.5 md:gap-2 mb-2">
              <div>
                <label className="block text-[10px] md:text-[11px] text-gray-400 mb-1">Date A</label>
                <input
                  type="date"
                  className="w-full bg-gray-800 border border-gray-700 rounded-md text-xs md:text-sm text-gray-200 px-1.5 md:px-2 py-1"
                  max={todayYmd}
                  value={`${(compareDateA.getFullYear())}-${(compareDateA.getMonth()+1).toString().padStart(2,'0')}-${(compareDateA.getDate()).toString().padStart(2,'0')}`}
                  onChange={e=>{ const d=new Date(e.target.value+ 'T00:00:00'); const today=new Date(); today.setHours(0,0,0,0); if(!isNaN(d.getTime())) setCompareDateA(d>today? today : d); }}
                />
              </div>
              <div>
                <label className="block text-[10px] md:text-[11px] text-gray-400 mb-1">Room A</label>
                <select
                  value={compareRoomA}
                  onChange={(e)=> setCompareRoomA(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-md text-xs md:text-sm text-gray-200 px-1.5 md:px-2 py-1"
                >
                  <option value="">Select room</option>
                  {Array.from(new Set(allSensors.filter(s=> s.type===sensor.type && s.room).map(s=> s.room))).map((room)=> (
                    <option key={room} value={room}>{room}</option>
                  ))}
                </select>
              </div>
            </div>
            {/* Row B: Comparison selection */}
            <div className="grid grid-cols-2 gap-1.5 md:gap-2 mb-2">
              <div>
                <label className="block text-[10px] md:text-[11px] text-gray-400 mb-1">Date B</label>
                <input
                  type="date"
                  className="w-full bg-gray-800 border border-gray-700 rounded-md text-xs md:text-sm text-gray-200 px-1.5 md:px-2 py-1"
                  max={todayYmd}
                  value={`${(compareDateB.getFullYear())}-${(compareDateB.getMonth()+1).toString().padStart(2,'0')}-${(compareDateB.getDate()).toString().padStart(2,'0')}`}
                  onChange={e=>{ const d=new Date(e.target.value+ 'T00:00:00'); const today=new Date(); today.setHours(0,0,0,0); if(!isNaN(d.getTime())) setCompareDateB(d>today? today : d); }}
                />
              </div>
              <div>
                <label className="block text-[10px] md:text-[11px] text-gray-400 mb-1">Room B</label>
                <select
                  value={compareRoomB}
                  onChange={(e)=> setCompareRoomB(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-md text-xs md:text-sm text-gray-200 px-1.5 md:px-2 py-1"
                >
                  <option value="">Select room</option>
                  {Array.from(new Set(allSensors.filter(s=> s.type===sensor.type && s.room).map(s=> s.room))).map((room)=> (
                    <option key={room} value={room}>{room}</option>
                  ))}
                </select>
              </div>
            </div>
            {/* Actions */}
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={async () => {
                  if (!compareRoomA || !compareRoomB) { 
                    setCompareSensorId(null); 
                    setCompareSeries(null); 
                    setIsCompareMode(false);
                    return; 
                  }
                  
                  // Enter comparison mode
                  setIsCompareMode(true);
                  
                  // Load data for Room A (main data) with Date A
                  const sensorA = allSensors.find(s=> s.room===compareRoomA && s.type===sensor.type);
                  if (sensorA) {
                    // Load Room A data as primary data
                    await loadForSensor(sensorA, setSeries, 'primary', compareDateA);
                    await loadForSensor(sensorA, setCombinedSeries, 'primary', compareDateA, combinedScale);
                    await loadForSensor(sensorA, setTempSeries, 'primary', compareDateA, tempScale);
                    await loadForSensor(sensorA, setHumSeries, 'primary', compareDateA, humScale);
                  }
                  
                  // Load data for Room B (comparison data) with Date B
                  setCompareDate(compareDateB);
                  setCompareRoom(compareRoomB);
                  
                  const sensorB = allSensors.find(s=> s.room===compareRoomB && s.type===sensor.type);
                  if (sensorB) {
                    setCompareSensorId(sensorB.id);
                  } else {
                    setCompareSensorId(null);
                    setCompareSeries(null);
                  }
                }}
                className={`px-3 py-1.5 rounded-md text-white text-sm transition-colors ${
                  !compareRoomA || !compareRoomB
                    ? 'bg-gray-600 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-500'
                }`}
                disabled={!compareRoomA || !compareRoomB}
              >
                <span className="text-xs md:text-sm">Compare</span>
              </button>
              {compareSensorId ? (
                <button onClick={async ()=> { 
                  // Clear comparison state
                  setCompareSensorId(null); 
                  setCompareSeries(null); 
                  setCompareRoom(""); 
                  setCompareRoomA("");
                  setCompareRoomB("");
                  setIsCompareMode(false);
                  
                  // Reload data for the header date and current sensor
                  await loadForSensor(sensor, setSeries, 'primary', date);
                  await loadForSensor(sensor, setCombinedSeries, 'primary', date, combinedScale);
                  await loadForSensor(sensor, setTempSeries, 'primary', date, tempScale);
                  await loadForSensor(sensor, setHumSeries, 'primary', date, humScale);
                }} className="text-[10px] md:text-[11px] text-red-400 hover:text-red-300 whitespace-nowrap">Clear</button>
              ) : <span className="text-[10px] md:text-[11px] text-gray-500 whitespace-nowrap">Both rooms required</span>}
            </div>
          </div>

          {/* Alerts */}
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-2 md:p-3 flex-shrink-0 md:flex-1">
            <div className="text-sm md:text-base font-semibold text-white mb-2">Active Alerts</div>
            <div className="space-y-1.5 md:space-y-2">
              <div className="flex items-center gap-2 bg-blue-900/30 border border-blue-700 rounded-lg p-2">
                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full flex-shrink-0"></div>
                <div className="flex-1">
                  <div className="text-xs md:text-sm font-medium text-blue-400">System Normal</div>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-red-900/30 border border-red-700 rounded-lg p-2">
                <div className="w-1.5 h-1.5 bg-red-400 rounded-full flex-shrink-0"></div>
                <div className="flex-1">
                  <div className="text-xs md:text-sm font-medium text-red-400">Sensor Offline</div>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-yellow-900/30 border border-yellow-700 rounded-lg p-2">
                <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full flex-shrink-0"></div>
                <div className="flex-1">
                  <div className="text-xs md:text-sm font-medium text-yellow-400">Temperature High</div>
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
