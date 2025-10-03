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

type DailySeries = { 
  timestamps: Date[]; 
  power?: number[];      // Power Generation in kW
  voltage?: number[];    // Voltage in V
  current?: number[];    // Current in A
  efficiency?: number[]; // Efficiency in %
  energy?: number[];     // Cumulative Energy in kWh
};

export default function PVSensorDashboard({ sensor, allSensors, onClose, projectId, standalone = false }: Props) {
  const [date, setDate] = useState(() => new Date());
  const [series, setSeries] = useState<DailySeries | null>(null);
  // Remove combinedSeries - combined will use powerSeries data directly
  const [powerSeries, setPowerSeries] = useState<DailySeries | null>(null);
  const [voltageSeries, setVoltageSeries] = useState<DailySeries | null>(null);
  const [energySeries, setEnergySeries] = useState<DailySeries | null>(null);
  const [compareSensorId, setCompareSensorId] = useState<string | null>(null);
  const [compareSeries, setCompareSeries] = useState<DailySeries | null>(null);
  const [compareDate, setCompareDate] = useState<Date>(() => new Date());
  const [compareRoom, setCompareRoom] = useState<string>("");
  const [compareDateA, setCompareDateA] = useState<Date>(() => new Date());
  const [compareDateB, setCompareDateB] = useState<Date>(() => new Date());
  const [compareRoomA, setCompareRoomA] = useState<string>("");
  const [compareRoomB, setCompareRoomB] = useState<string>("");
  const [isCompareMode, setIsCompareMode] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<Date>(() => new Date());
  const centerColRef = useRef<HTMLDivElement | null>(null);
  const [chartWidth, setChartWidth] = useState<number>(800);
  const [chartHeight, setChartHeight] = useState<number>(200);
  const dateInputEl = useRef<HTMLInputElement | null>(null);
  const [gaugeStats, setGaugeStats] = useState<{ 
    powerCur: number; voltageCur: number; currentCur: number; efficiencyCur: number;
    powerMin: number; powerMax: number; voltageMin: number; voltageMax: number;
    powerMinTime?: string; powerMaxTime?: string; voltageMinTime?: string; voltageMaxTime?: string;
  } | null>(null);
  
  const [powerScale, setPowerScale] = useState<"D" | "W" | "M" | "Y">("D");
  const [voltageScale, setVoltageScale] = useState<"D" | "W" | "M" | "Y">("D");
  const [energyScale, setEnergyScale] = useState<"D" | "W" | "M" | "Y">("D");

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

  // Generate realistic PV mock data based on time of day
  const generatePVMockData = (start: Date, end: Date, resolution: number): DailySeries => {
    const timestamps: Date[] = [];
    const power: number[] = [];
    const voltage: number[] = [];
    const current: number[] = [];
    const efficiency: number[] = [];
    const energy: number[] = [];
    
    const duration = end.getTime() - start.getTime();
    const interval = duration / resolution;
    let cumulativeEnergy = 0;
    
    for (let i = 0; i <= resolution; i++) {
      const timestamp = new Date(start.getTime() + i * interval);
      timestamps.push(timestamp);
      
      const hour = timestamp.getHours() + timestamp.getMinutes() / 60;
      
      // Solar power follows a bell curve during daylight hours (6 AM to 6 PM)
      let powerValue = 0;
      let efficiencyValue = 0;
      
      if (hour >= 6 && hour <= 18) {
        // Peak at noon (12:00)
        const solarPosition = (hour - 6) / 12; // 0 to 1 over daylight hours
        const bellCurve = Math.sin(solarPosition * Math.PI);
        
        // Power generation: 0-15 kW (typical residential solar system)
        powerValue = bellCurve * 12 * (0.85 + Math.random() * 0.3);
        
        // Efficiency: 15-22% (typical PV panel efficiency)
        efficiencyValue = 15 + bellCurve * 7 + (Math.random() - 0.5) * 2;
      } else {
        // No power generation at night
        powerValue = 0;
        efficiencyValue = 0;
      }
      
      // Voltage: typically 200-400V for grid-tied systems
      const voltageValue = powerValue > 0 ? 320 + (Math.random() - 0.5) * 40 : 0;
      
      // Current: P = V * I, so I = P / V (in kW and V, so multiply by 1000)
      const currentValue = voltageValue > 0 ? (powerValue * 1000) / voltageValue : 0;
      
      // Energy: cumulative kWh (power * time interval in hours)
      if (i > 0) {
        const intervalHours = interval / (1000 * 60 * 60);
        cumulativeEnergy += powerValue * intervalHours;
      }
      
      power.push(parseFloat(powerValue.toFixed(2)));
      voltage.push(parseFloat(voltageValue.toFixed(1)));
      current.push(parseFloat(currentValue.toFixed(2)));
      efficiency.push(parseFloat(efficiencyValue.toFixed(1)));
      energy.push(parseFloat(cumulativeEnergy.toFixed(2)));
    }
    
    return { timestamps, power, voltage, current, efficiency, energy };
  };

  const loadForSensor = async (target: Sensor, setter: (s: DailySeries|null)=>void, which: 'primary'|'compare', forDate?: Date, scale: "D" | "W" | "M" | "Y" = "D") => {
    try {
      const baseDate = forDate || date;
      let start = new Date(baseDate);
      let end = new Date(baseDate);
      let resolution = 96;
      
      switch (scale) {
        case "D":
          start.setHours(0,0,0,0);
          end.setHours(23,59,59,999);
          resolution = 96;
          break;
        case "W":
          const dayOfWeek = start.getDay();
          start.setDate(start.getDate() - dayOfWeek);
          start.setHours(0,0,0,0);
          end = new Date(start);
          end.setDate(end.getDate() + 6);
          end.setHours(23,59,59,999);
          resolution = 168;
          break;
        case "M":
          start.setDate(1);
          start.setHours(0,0,0,0);
          end = new Date(start);
          end.setMonth(end.getMonth() + 1);
          end.setDate(0);
          end.setHours(23,59,59,999);
          resolution = 720;
          break;
        case "Y":
          start.setMonth(0, 1);
          start.setHours(0,0,0,0);
          end = new Date(start);
          end.setFullYear(end.getFullYear() + 1);
          end.setDate(0);
          end.setHours(23,59,59,999);
          resolution = 8760;
          break;
      }
      
      const today = new Date();
      const isSameDay = start.getFullYear()===today.getFullYear() && start.getMonth()===today.getMonth() && start.getDate()===today.getDate() && scale === "D";
      if (isSameDay) end = new Date();
      
      // Generate mock data for PV sensors
      const mockData = generatePVMockData(start, end, resolution);
      setter(mockData);
      if (which==='primary') setError(null);
    } catch (e:any) {
      if (which==='primary') setError(e?.message || 'Failed to load data');
      setter(null);
    }
  };

  useEffect(() => {
    if (isCompareMode) return;
    setLoading(true);
    loadForSensor(sensor, setSeries, 'primary', date, "D").finally(() => setLoading(false));
  }, [sensor.id, date, projectId, isCompareMode]);

  // Power graph - independent
  useEffect(() => {
    if (isCompareMode) return;
    loadForSensor(sensor, setPowerSeries, 'primary', date, powerScale);
  }, [sensor.id, date, projectId, powerScale, isCompareMode]);

  // Voltage graph - independent
  useEffect(() => {
    if (isCompareMode) return;
    loadForSensor(sensor, setVoltageSeries, 'primary', date, voltageScale);
  }, [sensor.id, date, projectId, voltageScale, isCompareMode]);

  // Energy graph - independent
  useEffect(() => {
    if (isCompareMode) return;
    loadForSensor(sensor, setEnergySeries, 'primary', date, energyScale);
  }, [sensor.id, date, projectId, energyScale, isCompareMode]);

  useEffect(() => {
    const init = async () => {
      try {
        const start = new Date(); 
        start.setHours(0,0,0,0);
        const end = new Date();
        
        const mockData = generatePVMockData(start, end, 96);
        const pArr = mockData.power || [];
        const vArr = mockData.voltage || [];
        const cArr = mockData.current || [];
        const eArr = mockData.efficiency || [];
        
        let powerMin = pArr.length ? Math.min(...pArr) : 0;
        let powerMax = pArr.length ? Math.max(...pArr) : 0;
        let voltageMin = vArr.length ? Math.min(...vArr.filter(v => v > 0)) : 0;
        let voltageMax = vArr.length ? Math.max(...vArr) : 0;
        let powerCur = pArr.length ? pArr[pArr.length-1] : 0;
        let voltageCur = vArr.length ? vArr[vArr.length-1] : 0;
        let currentCur = cArr.length ? cArr[cArr.length-1] : 0;
        let efficiencyCur = eArr.length ? eArr[eArr.length-1] : 0;
        
        const formatTime = (date: Date) => 
          `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        
        let powerMinTime = '00:00', powerMaxTime = '00:00', voltageMinTime = '00:00', voltageMaxTime = '00:00';
        
        if (pArr.length && mockData.timestamps.length) {
          const powerMinIndex = pArr.findIndex(p => p === powerMin);
          const powerMaxIndex = pArr.findIndex(p => p === powerMax);
          if (powerMinIndex >= 0 && mockData.timestamps[powerMinIndex]) powerMinTime = formatTime(mockData.timestamps[powerMinIndex]);
          if (powerMaxIndex >= 0 && mockData.timestamps[powerMaxIndex]) powerMaxTime = formatTime(mockData.timestamps[powerMaxIndex]);
        }
        
        if (vArr.length && mockData.timestamps.length) {
          const voltageMinIndex = vArr.findIndex(v => v === voltageMin);
          const voltageMaxIndex = vArr.findIndex(v => v === voltageMax);
          if (voltageMinIndex >= 0 && mockData.timestamps[voltageMinIndex]) voltageMinTime = formatTime(mockData.timestamps[voltageMinIndex]);
          if (voltageMaxIndex >= 0 && mockData.timestamps[voltageMaxIndex]) voltageMaxTime = formatTime(mockData.timestamps[voltageMaxIndex]);
        }
        
        setGaugeStats({ powerCur, voltageCur, currentCur, efficiencyCur, powerMin, powerMax, voltageMin, voltageMax, powerMinTime, powerMaxTime, voltageMinTime, voltageMaxTime });
      } catch (e) {
        // ignore init errors
      }
    };
    init();
  }, [sensor.id, projectId]);

  useEffect(() => {
    if (!compareSensorId) { setCompareSeries(null); return; }
    const s = allSensors.find(s=>s.id===compareSensorId);
    if (!s) return;
    loadForSensor(s, setCompareSeries, 'compare', compareDate);
  }, [compareSensorId, compareDate, projectId, allSensors]);

  const stats = useMemo(() => {
    if (!series?.power || !series.voltage || !series.timestamps) return null;
    
    const powerMin = Math.min(...series.power);
    const powerMax = Math.max(...series.power);
    const voltageMin = Math.min(...series.voltage.filter(v => v > 0));
    const voltageMax = Math.max(...series.voltage);
    const powerCur = series.power[series.power.length-1];
    const voltageCur = series.voltage[series.voltage.length-1];
    
    const powerMinIndex = series.power.findIndex(p => p === powerMin);
    const powerMaxIndex = series.power.findIndex(p => p === powerMax);
    const voltageMinIndex = series.voltage.findIndex(v => v === voltageMin);
    const voltageMaxIndex = series.voltage.findIndex(v => v === voltageMax);
    
    const formatTime = (date: Date) => 
      `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    
    const powerMinTime = powerMinIndex >= 0 ? formatTime(series.timestamps[powerMinIndex]) : '00:00';
    const powerMaxTime = powerMaxIndex >= 0 ? formatTime(series.timestamps[powerMaxIndex]) : '00:00';
    const voltageMinTime = voltageMinIndex >= 0 ? formatTime(series.timestamps[voltageMinIndex]) : '00:00';
    const voltageMaxTime = voltageMaxIndex >= 0 ? formatTime(series.timestamps[voltageMaxIndex]) : '00:00';
    
    return { powerMin, powerMax, voltageMin, voltageMax, powerCur, voltageCur, powerMinTime, powerMaxTime, voltageMinTime, voltageMaxTime };
  }, [series]);

  const weatherData = useMemo(() => {
    const t = now;
    const hour = t.getHours() + t.getMinutes() / 60;
    
    // Solar irradiance (W/m²) - follows sun position
    let irradiance = 0;
    if (hour >= 6 && hour <= 18) {
      const solarPosition = (hour - 6) / 12;
      irradiance = Math.sin(solarPosition * Math.PI) * 1000;
    }
    
    // Cloud coverage affects irradiance
    const cloudCover = 20 + Math.random() * 30; // 20-50%
    irradiance *= (1 - cloudCover / 100);
    
    const temp = 25 + 5 * Math.sin((hour / 24) * Math.PI * 2);
    const icon = irradiance > 700 ? '☀️' : irradiance > 300 ? '⛅' : '☁️';
    
    return { 
      irradiance: Math.round(irradiance), 
      cloudCover: Math.round(cloudCover),
      temp: parseFloat(temp.toFixed(1)), 
      icon 
    };
  }, [now]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Width observer only
  useEffect(() => {
    const el = centerColRef.current;
    if (!el) return;
    const updateWidth = () => setChartWidth(Math.max(320, el.clientWidth - 32));
    updateWidth();
    const ro = new ResizeObserver(() => updateWidth());
    ro.observe(el);
    return () => ro.disconnect();
  }, [centerColRef]);

  const Gauge: React.FC<{ value?: number; min: number; max: number; label: string; unit?: string; color?: string; dangerZones?: { from: number; to: number; color: string }[]; small?: boolean; showMinMax?: boolean; }> = ({ value, min, max, label, unit = '', color = '#22c55e', dangerZones = [], small = false, showMinMax = false }) => {
    const v = value ?? 0;
    const pct = Math.max(0, Math.min(1, (v - min) / (max - min || 1)));
    const isPercentUnit = (unit || '').includes('%');
    
    const centerX = 100;
    const centerY = 100;
    const outerRadius = 88;
    const innerRadius = 70;
    const outerStroke = 4;
    const innerStroke = 24;
    
    const outerPath = `M ${centerX - outerRadius} ${centerY} A ${outerRadius} ${outerRadius} 0 0 1 ${centerX + outerRadius} ${centerY}`;
    const innerPath = `M ${centerX - innerRadius} ${centerY} A ${innerRadius} ${innerRadius} 0 0 1 ${centerX + innerRadius} ${centerY}`;
    
    const paddingCls = small ? 'p-1 md:p-1.5' : 'p-4';
    const minHCls = small ? 'min-h-[80px] md:min-h-[90px]' : 'min-h-[160px]';
    
    return (
      <div className={`bg-gray-900 border border-gray-700 rounded-xl ${paddingCls} ${minHCls} flex flex-col items-center shadow-inner w-full overflow-hidden`}>
        <svg viewBox="0 0 200 120" className="w-full flex-1 max-h-[80px] md:max-h-[90px]">
          <path d={outerPath} stroke="#38bdf8" strokeWidth={outerStroke} fill="none" strokeLinecap="round" pathLength="100" strokeDasharray="25 100" />
          <path d={outerPath} stroke="#22c55e" strokeWidth={outerStroke} fill="none" strokeLinecap="round" pathLength="100" strokeDasharray="50 100" strokeDashoffset="-25" />
          <path d={outerPath} stroke="#ef4444" strokeWidth={outerStroke} fill="none" strokeLinecap="round" pathLength="100" strokeDasharray="25 100" strokeDashoffset="-75" />
          <path d={innerPath} stroke="#1f2937" strokeWidth={innerStroke} fill="none" />
          <path d={innerPath} stroke={color} strokeWidth={innerStroke} fill="none" pathLength="100" strokeDasharray={`${pct * 100} 100`} />
          <text x={centerX} y={centerY - 15} textAnchor="middle" className="fill-white" style={{ fontSize: small ? '16px' : '24px', fontWeight: 800 }}>
            {Number.isFinite(v) ? `${v.toFixed(isPercentUnit ? 0 : 1)}${unit}` : `—${unit}`}
          </text>
        </svg>
        <div className="text-[8px] md:text-[10px] text-gray-300 uppercase tracking-wide -mt-0.5 truncate w-full text-center">{label}</div>
      </div>
    );
  };

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
          title={k === "D" ? "Day" : k === "W" ? "Week" : k === "M" ? "Month" : "Year"}
        >
          {k}
        </button>
      ))}
    </div>
  );

  const WiFiSignal: React.FC<{ strength: number; size?: number }> = ({ strength, size = 16 }) => {
    const getColor = () => {
      if (strength >= 4) return '#22c55e';
      if (strength >= 3) return '#eab308';
      if (strength >= 2) return '#f97316';
      if (strength >= 1) return '#ef4444';
      return '#6b7280';
    };

    const color = getColor();
    const viewBoxSize = 24;
    const centerX = 12;
    const centerY = 20;

    return (
      <svg width={size} height={size} viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`} className="inline-block">
        <circle cx={centerX} cy={centerY} r="1.5" fill={strength >= 1 ? color : '#374151'} />
        <path d={`M ${centerX - 3} ${centerY - 2} A 4 4 0 0 1 ${centerX + 3} ${centerY - 2}`} stroke={strength >= 2 ? color : '#374151'} strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <path d={`M ${centerX - 5} ${centerY - 4} A 7 7 0 0 1 ${centerX + 5} ${centerY - 4}`} stroke={strength >= 3 ? color : '#374151'} strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <path d={`M ${centerX - 7} ${centerY - 6} A 10 10 0 0 1 ${centerX + 7} ${centerY - 6}`} stroke={strength >= 4 ? color : '#374151'} strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <path d={`M ${centerX - 9} ${centerY - 8} A 13 13 0 0 1 ${centerX + 9} ${centerY - 8}`} stroke={strength >= 4 ? color : '#374151'} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      </svg>
    );
  };

  const Cartesian: React.FC<{ mode: 'combined'|'power'|'voltage'|'energy'; title: string; width: number; height: number; data: DailySeries | null; scale: "D" | "W" | "M" | "Y"; voltageData?: DailySeries | null; }> = ({ mode, title, width, height, data, scale, voltageData }) => {
    const [hoverX, setHoverX] = useState<number | null>(null);
    const [hoverIndex, setHoverIndex] = useState<number | null>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    
    // For combined mode, use voltageData if provided, otherwise fallback to data.voltage
    const effectiveVoltageData = mode === 'combined' && voltageData ? voltageData.voltage : data?.voltage;
    
    // Energy mode validation
    if (mode === 'energy' && (!data?.timestamps?.length || !data.energy)) {
      return <div className="flex items-center justify-center h-full min-h-[120px] text-sm text-gray-500 bg-gray-900 border border-gray-700 rounded-xl">No energy data</div>;
    }
    
    if (!data?.timestamps?.length || (!data.power && mode !== 'energy') || (!effectiveVoltageData && mode !== 'energy')) {
      return <div className="flex items-center justify-center h-full min-h-[120px] text-sm text-gray-500 bg-gray-900 border border-gray-700 rounded-xl">No data</div>;
    }
    
    const w = Math.max(320, width);
    const h = Math.max(120, height);
    const l = 38; const r = 12; const t = 20; const b = 30;
    
    const xs = data.timestamps.map(d=>d.getTime());
    const xMin = xs[0]; const xMax = xs[xs.length-1];
    
    const energyMin = mode === 'energy' && data.energy ? Math.min(...data.energy) : 0;
    const energyMax = mode === 'energy' && data.energy ? Math.max(...data.energy) : 0;
    const powerMin = data.power ? Math.min(...(data.power || []), ...(compareSeries?.power||[])) : 0;
    const powerMax = data.power ? Math.max(...(data.power || []), ...(compareSeries?.power||[])) : 0;
    const voltageMin = effectiveVoltageData ? Math.min(...(effectiveVoltageData?.filter(v => v > 0) || []), ...(compareSeries?.voltage?.filter(v => v > 0)||[])) : 0;
    const voltageMax = effectiveVoltageData ? Math.max(...(effectiveVoltageData || []), ...(compareSeries?.voltage||[])) : 0;
    
    let yMin, yMax, span;
    if (mode === 'energy') {
      // Energy is cumulative, always starts from 0
      const dataRange = energyMax - energyMin;
      const paddingPercent = 0.15;
      const padding = Math.max(0.5, dataRange * paddingPercent);
      
      yMin = 0;
      yMax = energyMax + padding;
    } else if (mode === 'power') {
      // Always keep baseline at zero for solar power (0 kW at night is valid)
      const dataRange = powerMax - powerMin;
      const paddingPercent = 0.15; // 15% padding on top only
      const padding = Math.max(0.5, dataRange * paddingPercent);
      
      yMin = 0; // Always start from zero for power
      yMax = powerMax + padding;
    } else if (mode === 'voltage') {
      // For voltage graph, work with scaled values (voltage/30) for proper display
      // Always keep baseline at zero for solar voltage (0V at night is valid)
      const scaledVoltageMin = voltageMin / 30;
      const scaledVoltageMax = voltageMax / 30;
      const dataRange = scaledVoltageMax - scaledVoltageMin;
      const paddingPercent = 0.15; // 15% padding on top only
      const padding = Math.max(0.5, dataRange * paddingPercent);
      
      yMin = 0; // Always start from zero for voltage
      yMax = scaledVoltageMax + padding;
    } else {
      yMin = Math.min(powerMin, voltageMin / 30);
      yMax = Math.max(powerMax, voltageMax / 30);
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
    const primaryEnergyPath = mode === 'energy' && data.energy ? pathFor(data.energy) : '';
    const primaryPowerPath = data.power ? pathFor(data.power!) : '';
    const primaryVoltagePath = effectiveVoltageData ? pathFor(effectiveVoltageData!.map(v => v / 30)) : ''; // Scale voltage for display
    const comparePowerPath = compareSeries?.power ? pathFor(compareSeries.power): null;
    const compareVoltagePath = compareSeries?.voltage ? pathFor(compareSeries.voltage.map(v => v / 30)): null;
    
    let xLabels: { position: number; label: string }[] = [];
    
    switch (scale) {
      case "D":
        const startHour = new Date(xs[0]).getHours();
        const endHour = new Date(xs[xs.length - 1]).getHours();
        const dataSpanHours = (xs[xs.length - 1] - xs[0]) / (1000 * 60 * 60);
        
        let hourStep = 2;
        if (dataSpanHours <= 6) hourStep = 1;
        else if (dataSpanHours <= 12) hourStep = 2;
        else hourStep = 3;
        
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
        
      case "W":
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
        
      case "M":
        const startDateM = new Date(xs[0]);
        const endDateM = new Date(xs[xs.length - 1]);
        const startDay = startDateM.getDate();
        const endDay = endDateM.getDate();
        const monthSpan = endDay - startDay + 1;
        
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
        
      case "Y":
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
    
    let yTicks;
    if (mode === 'power') {
      yTicks = Array.from({length:6}).map((_,i)=> Math.round((yMin + (span)*i/5) * 10) / 10);
    } else if (mode === 'voltage') {
      // Generate ticks based on scaled values but display actual voltage
      const numTicks = 5;
      yTicks = [];
      for (let i = 0; i <= numTicks; i++) {
        const scaledTickValue = yMin + (span * i / numTicks);
        yTicks.push(scaledTickValue);
      }
      yTicks = [...new Set(yTicks)].sort((a, b) => a - b);
    } else {
      yTicks = Array.from({length:6}).map((_,i)=> Math.round((yMin + (span)*i/5) * 10) / 10);
    }
    
    const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
      if (!svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      
      if (mouseX < l || mouseX > l + innerW) {
        setHoverX(null);
        setHoverIndex(null);
        return;
      }
      
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
      
      const snapX = mapPoint(xs[closestIdx], data.power![closestIdx]).x;
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
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full rounded-xl"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <rect x={0} y={0} width={w} height={h} fill="#0a0a0a" />
        <rect x={l} y={t} width={innerW} height={innerH} fill="#000000" stroke="#1f2937" />
        {yTicks.map((v,i)=>{
          const y=t+innerH*(1 - (v-yMin)/span);
          // For voltage mode, display actual voltage (scaled * 30), for energy display kWh with k suffix
          let displayValue: string;
          if (mode === 'voltage') {
            displayValue = Math.round(v * 30).toString();
          } else if (mode === 'energy') {
            // Format energy values with k suffix if >= 1000
            if (v >= 1000) {
              displayValue = (v / 1000).toFixed(1) + 'k';
            } else {
              displayValue = v.toFixed(1);
            }
          } else {
            displayValue = v.toFixed(mode === 'power' ? 1 : 0);
          }
          return <g key={i}><line x1={l} x2={l+innerW} y1={y} y2={y} stroke="#1f2937"/><text x={l-4} y={y+3} fontSize={9} fill="#ffffff" textAnchor="end">{displayValue}</text></g>;
        })}
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
        {mode === 'energy' && <path d={primaryEnergyPath} fill="none" stroke="#10b981" strokeWidth={2.5} />}
        {(mode==='combined' || mode==='power') && <path d={primaryPowerPath} fill="none" stroke="#fbbf24" strokeWidth={2} />}
        {(mode==='combined' || mode==='voltage') && <path d={primaryVoltagePath} fill="none" stroke="#3b82f6" strokeWidth={2} />}
        {(mode!=='voltage' && comparePowerPath) && <path d={comparePowerPath} fill="none" stroke="#f97316" strokeWidth={1.5} strokeDasharray="3 3" />}
        {(mode!=='power' && compareVoltagePath) && <path d={compareVoltagePath} fill="none" stroke="#10b981" strokeWidth={1.5} strokeDasharray="3 3" />}
        
        {xLabels.map((labelInfo, index) => (
          <text 
            key={index}
            x={labelInfo.position} 
            y={h-8} 
            fontSize={10} 
            fill="#ffffff" 
            textAnchor="middle"
          >
            {labelInfo.label}
          </text>
        ))}
        
        {hoverX !== null && hoverIndex !== null && (
          <g>
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
            
            {mode === 'energy' && data.energy && (
              <>
                <circle cx={hoverX > l + innerW / 2 ? hoverX - 110 : hoverX + 30} cy={t + 42} r={3} fill="#10b981" />
                <text x={hoverX > l + innerW / 2 ? hoverX - 100 : hoverX + 40} y={t + 45} fontSize={10} fill="#f3f4f6" fontWeight="600">
                  {data.energy[hoverIndex].toFixed(2)} kWh
                </text>
              </>
            )}
            
            {(mode === 'combined' || mode === 'power') && (
              <>
                <circle cx={hoverX > l + innerW / 2 ? hoverX - 110 : hoverX + 30} cy={t + 42} r={3} fill="#fbbf24" />
                <text x={hoverX > l + innerW / 2 ? hoverX - 100 : hoverX + 40} y={t + 45} fontSize={10} fill="#f3f4f6" fontWeight="600">
                  {data.power![hoverIndex].toFixed(1)} kW
                </text>
              </>
            )}
            
            {(mode === 'combined' || mode === 'voltage') && (
              <>
                <circle cx={hoverX > l + innerW / 2 ? hoverX - 110 : hoverX + 30} cy={mode === 'combined' ? t + 60 : t + 42} r={3} fill="#3b82f6" />
                <text x={hoverX > l + innerW / 2 ? hoverX - 100 : hoverX + 40} y={mode === 'combined' ? t + 63 : t + 45} fontSize={10} fill="#f3f4f6" fontWeight="600">
                  {effectiveVoltageData![hoverIndex].toFixed(0)} V
                </text>
              </>
            )}
            
            {mode === 'energy' && data.energy && (
              <circle cx={hoverX} cy={mapPoint(xs[hoverIndex], data.energy[hoverIndex]).y} r={4} fill="#10b981" stroke="#1f2937" strokeWidth={2} />
            )}
            
            {(mode === 'combined' || mode === 'power') && data.power && (
              <circle cx={hoverX} cy={mapPoint(xs[hoverIndex], data.power![hoverIndex]).y} r={4} fill="#fbbf24" stroke="#1f2937" strokeWidth={2} />
            )}
            
            {(mode === 'combined' || mode === 'voltage') && effectiveVoltageData && (
              <circle cx={hoverX} cy={mapPoint(xs[hoverIndex], effectiveVoltageData![hoverIndex] / 30).y} r={4} fill="#3b82f6" stroke="#1f2937" strokeWidth={2} />
            )}
          </g>
        )}
      </svg>
    );
  };

  return (
    <div className={standalone ? "h-full w-full bg-gray-950 flex flex-col" : "fixed left-0 right-0 bottom-0 top-16 bg-gray-950/98 z-[2000] flex flex-col"}>
      <div className="px-2 md:px-4 py-1.5 md:py-2 border-b border-gray-800 bg-gray-900/70">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold text-white">Photovoltaic Sensor Dashboard</h3>
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

            <div className="hidden md:flex px-3 py-1.5 rounded-xl bg-transparent border border-transparent text-sm md:text-base text-gray-200 font-semibold">
              {now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </div>

            {!standalone && (
              <button
                onClick={() => {
                  const roomName = sensor?.room ? encodeURIComponent(sensor.room.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '-')) : 'unknown-room';
                  const sensorName = sensor?.name ? encodeURIComponent(sensor.name.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '-')) : 'unknown-sensor';
                  const url = `/pv-dashboard/${roomName}/${sensorName}?id=${sensor?.id || ''}&projectId=${projectId || ''}`;
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

      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-3 p-2 md:p-3 min-h-0 max-h-full overflow-hidden">
        <div className="col-span-1 md:col-span-3 flex flex-col h-auto md:h-full space-y-2 min-h-0">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-2 md:p-3 flex-shrink-0 md:flex-1 md:min-h-0 overflow-hidden">
            <div className="text-sm md:text-md font-semibold text-white mb-1.5 md:mb-2 text-center">Solar Conditions</div>
            <div className="grid grid-cols-2 py-3 gap-1 md:gap-1.5 w-full">
              <Gauge label="Power" value={gaugeStats?.powerCur ?? stats?.powerCur ?? 0} min={0} max={15} unit=" kW" color="#fbbf24" small />
              <Gauge label="Voltage" value={gaugeStats?.voltageCur ?? stats?.voltageCur ?? 0} min={0} max={500} unit=" V" color="#3b82f6" small />
              <Gauge label="Current" value={gaugeStats?.currentCur ?? 0} min={0} max={50} unit=" A" color="#10b981" small />
              <Gauge label="Efficiency" value={gaugeStats?.efficiencyCur ?? 0} min={0} max={25} unit="%" color="#22c55e" small />
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-700 rounded-xl p-2 md:p-3 flex-shrink-0 overflow-hidden">
            <div className="text-xs md:text-sm font-semibold text-white mb-1.5 md:mb-2 text-center">Power Generation</div>
            <div className="grid grid-cols-2 gap-1 md:gap-1.5 w-full">
              <Gauge label="Min" value={gaugeStats?.powerMin ?? stats?.powerMin ?? 0} min={0} max={15} unit=" kW" color="#3b82f6" small />
              <Gauge label="Max" value={gaugeStats?.powerMax ?? stats?.powerMax ?? 0} min={0} max={15} unit=" kW" color="#fbbf24" small />
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-700 rounded-xl p-2 md:p-3 flex-shrink-0 overflow-hidden">
            <div className="text-xs md:text-sm font-semibold text-white mb-1.5 md:mb-2 text-center">Voltage Levels</div>
            <div className="grid grid-cols-2 gap-1 md:gap-1.5 w-full">
              <Gauge label="Min" value={gaugeStats?.voltageMin ?? stats?.voltageMin ?? 0} min={0} max={500} unit=" V" color="#3b82f6" small />
              <Gauge label="Max" value={gaugeStats?.voltageMax ?? stats?.voltageMax ?? 0} min={0} max={500} unit=" V" color="#3b82f6" small />
            </div>
          </div>
        </div>

        <div ref={centerColRef} className="col-span-1 md:col-span-6 flex flex-col h-auto md:h-full min-w-0 overflow-hidden">
          {/* Container for three graphs with dynamic height distribution */}
          <div className="flex-1 flex flex-col gap-1.5 md:gap-2 min-h-0">
            {/* Energy Production Graph */}
            <div className="flex-1 flex flex-col min-h-[180px] md:min-h-0 bg-gray-900 border border-gray-700 rounded-xl p-2 md:p-3 overflow-hidden">
              <div className="flex items-center justify-between mb-1.5 md:mb-2 flex-shrink-0">
                <div className="text-xs md:text-sm font-semibold text-white">Energy Production (kWh)</div>
                <ScaleSwitch currentScale={energyScale} setScale={setEnergyScale} />
              </div>
              <div className="flex-1 min-h-0 relative">
                <Cartesian mode="energy" title="Energy" width={chartWidth} height={chartHeight} data={energySeries} scale={energyScale} />
              </div>
            </div>

            {/* Power Generation Graph */}
            <div className="flex-1 flex flex-col min-h-[180px] md:min-h-0 bg-gray-900 border border-gray-700 rounded-xl p-2 md:p-3 overflow-hidden">
              <div className="flex items-center justify-between mb-1.5 md:mb-2 flex-shrink-0">
                <div className="text-xs md:text-sm font-semibold text-white">Power Generation (kW)</div>
                <ScaleSwitch currentScale={powerScale} setScale={setPowerScale} />
              </div>
              <div className="flex-1 min-h-0 relative">
                <Cartesian mode="power" title="Power" width={chartWidth} height={chartHeight} data={powerSeries} scale={powerScale} />
              </div>
            </div>

            {/* Voltage Only Graph */}
            <div className="flex-1 flex flex-col min-h-[180px] md:min-h-0 bg-gray-900 border border-gray-700 rounded-xl p-2 md:p-3 overflow-hidden">
              <div className="flex items-center justify-between mb-1.5 md:mb-2 flex-shrink-0">
                <div className="text-xs md:text-sm font-semibold text-white">Voltage (V)</div>
                <ScaleSwitch currentScale={voltageScale} setScale={setVoltageScale} />
              </div>
              <div className="flex-1 min-h-0 relative">
                <Cartesian mode="voltage" title="Voltage" width={chartWidth} height={chartHeight} data={voltageSeries} scale={voltageScale} />
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-1 md:col-span-3 flex flex-col h-auto md:h-full gap-2 md:gap-3 min-h-0">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-2 md:p-3 flex-shrink-0 md:flex-1 md:min-h-0 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-xs md:text-sm font-semibold text-white truncate">Weather & Irradiance</div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-2 text-center">
                <div className="text-2xl md:text-3xl mb-1">{weatherData.icon}</div>
                <div className="text-[10px] md:text-xs text-gray-400">Solar Conditions</div>
              </div>
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-2">
                <div className="text-[10px] md:text-xs text-gray-400 truncate ">Temperature</div>
                <div className="text-md md:text-base font-bold text-white truncate mt-3">{weatherData.temp}°C</div>
              </div>
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-2">
                <div className="text-[10px] md:text-xs text-gray-400 truncate">Irradiance</div>
                <div className="text-sm md:text-base font-bold text-white truncate">{weatherData.irradiance} W/m²</div>
              </div>
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-2">
                <div className="text-[10px] md:text-xs text-gray-400 truncate">Cloud Cover</div>
                <div className="text-sm md:text-base font-bold text-white truncate">{weatherData.cloudCover}%</div>
              </div>
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-2">
                <div className="text-[10px] md:text-xs text-gray-400 truncate">Sunrise</div>
                <div className="text-sm md:text-base font-bold text-orange-400 truncate">06:15 AM</div>
              </div>
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-2">
                <div className="text-[10px] md:text-xs text-gray-400 truncate">Sunset</div>
                <div className="text-sm md:text-base font-bold text-purple-400 truncate">06:45 PM</div>
              </div>
            </div>
          </div>

          {/* Performance Metrics Card */}
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-2 md:p-3 flex-shrink-0 overflow-hidden">
            <div className="text-xs md:text-sm font-semibold text-white mb-1.5 md:mb-2">Performance Metrics</div>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-2">
                <div className="text-[10px] md:text-xs text-gray-400 truncate">Today's Energy</div>
                <div className="text-sm md:text-base font-bold text-green-400 truncate">
                  {energySeries?.energy && energySeries.energy.length > 0 
                    ? energySeries.energy[energySeries.energy.length - 1].toFixed(1) 
                    : '0.0'} kWh
                </div>
              </div>
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-2">
                <div className="text-[10px] md:text-xs text-gray-400 truncate">Avg Efficiency</div>
                <div className="text-sm md:text-base font-bold text-yellow-400 truncate">
                  {series?.efficiency && series.efficiency.length > 0
                    ? (series.efficiency.reduce((a, b) => a + b, 0) / series.efficiency.filter(e => e > 0).length).toFixed(1)
                    : '0.0'}%
                </div>
              </div>
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-2">
                <div className="text-[10px] md:text-xs text-gray-400 truncate">Peak Power</div>
                <div className="text-sm md:text-base font-bold text-orange-400 truncate">
                  {(gaugeStats?.powerMax ?? stats?.powerMax ?? 0).toFixed(1)} kW
                </div>
              </div>
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-2">
                <div className="text-[10px] md:text-xs text-gray-400 truncate">Uptime</div>
                <div className="text-sm md:text-base font-bold text-blue-400 truncate">99.8%</div>
              </div>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-700 rounded-xl p-2 md:p-3 flex-shrink-0 md:flex-1 md:min-h-0 flex flex-col overflow-hidden">
            <div className="text-xs md:text-sm font-semibold text-white mb-1.5 md:mb-2">Active Alerts</div>
            <div className="space-y-1.5 overflow-y-auto flex-1 min-h-0">
              <div className="flex items-center gap-2 bg-green-900/30 border border-green-700 rounded-lg p-2 overflow-hidden">
                <div className="w-1.5 h-1.5 bg-green-400 rounded-full flex-shrink-0"></div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs md:text-sm font-medium text-green-400 truncate">System Normal</div>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-blue-900/30 border border-blue-700 rounded-lg p-2 overflow-hidden">
                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full flex-shrink-0"></div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs md:text-sm font-medium text-blue-400 truncate">Optimal Production</div>
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
