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
  magnitude?: number[];      // Magnitude (Richter scale)
  frequency?: number[];      // Frequency in Hz
  acceleration?: number[];   // Acceleration in m/s²
  displacement?: number[];   // Displacement in mm
};

export default function SeismicSensorDashboard({ sensor, allSensors, onClose, projectId, standalone = false }: Props) {
  const [date, setDate] = useState(() => new Date());
  const [series, setSeries] = useState<DailySeries | null>(null);
  // Remove combinedSeries - combined will use magnitudeSeries data directly
  const [magnitudeSeries, setMagnitudeSeries] = useState<DailySeries | null>(null);
  const [accelerationSeries, setAccelerationSeries] = useState<DailySeries | null>(null);
  const [frequencySeries, setFrequencySeries] = useState<DailySeries | null>(null);
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
  // Single chart drawing height (inner SVG height basis) – dynamically computed
  const [chartHeight, setChartHeight] = useState<number>(220);
  // Container height for each chart card (includes padding, title etc.)
  const [chartContainerHeight, setChartContainerHeight] = useState<number>(220);
  const dateInputEl = useRef<HTMLInputElement | null>(null);
  const [gaugeStats, setGaugeStats] = useState<{ 
    magnitudeCur: number; frequencyCur: number; accelerationCur: number; displacementCur: number;
    magnitudeMin: number; magnitudeMax: number; accelerationMin: number; accelerationMax: number;
    frequencyAvg: number; displacementMax: number;
    magnitudeMinTime?: string; magnitudeMaxTime?: string; accelerationMinTime?: string; accelerationMaxTime?: string;
  } | null>(null);
  
  const [seismicEvents, setSeismicEvents] = useState<Array<{time: string, magnitude: number, status: string}>>([]);
  
  const [magnitudeScale, setMagnitudeScale] = useState<"D" | "W" | "M" | "Y">("D");
  const [accelerationScale, setAccelerationScale] = useState<"D" | "W" | "M" | "Y">("D");
  const [frequencyScale, setFrequencyScale] = useState<"D" | "W" | "M" | "Y">("D");

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

  // Generate realistic Seismic mock data
  const generateSeismicMockData = (start: Date, end: Date, resolution: number): DailySeries => {
    const timestamps: Date[] = [];
    const magnitude: number[] = [];
    const frequency: number[] = [];
    const acceleration: number[] = [];
    const displacement: number[] = [];
    
    const duration = end.getTime() - start.getTime();
    const interval = duration / resolution;
    
    // Simulate occasional seismic events
    const eventProbability = 0.02; // 2% chance of elevated activity at any point
    let inEvent = false;
    let eventDuration = 0;
    
    for (let i = 0; i <= resolution; i++) {
      const timestamp = new Date(start.getTime() + i * interval);
      timestamps.push(timestamp);
      
      // Determine if we're in a seismic event
      if (!inEvent && Math.random() < eventProbability) {
        inEvent = true;
        eventDuration = Math.floor(Math.random() * 10) + 5; // Event lasts 5-15 samples
      }
      
      if (inEvent) {
        eventDuration--;
        if (eventDuration <= 0) inEvent = false;
      }
      
      let magnitudeValue, frequencyValue, accelerationValue, displacementValue;
      
      if (inEvent) {
        // During seismic event - higher values
        const eventIntensity = Math.random() * 0.5 + 0.5; // 0.5 to 1.0
        magnitudeValue = 0.5 + eventIntensity * 2.5 + (Math.random() - 0.5) * 0.3; // 0.5-3.3 Richter
        frequencyValue = 1 + eventIntensity * 15 + (Math.random() - 0.5) * 2; // 1-18 Hz
        accelerationValue = 0.05 + eventIntensity * 0.5 + (Math.random() - 0.5) * 0.05; // 0.05-0.6 m/s²
        displacementValue = 0.5 + eventIntensity * 5 + (Math.random() - 0.5) * 0.5; // 0.5-6 mm
      } else {
        // Background noise - low values
        magnitudeValue = 0.1 + Math.random() * 0.3; // 0.1-0.4 Richter (micro-seismic)
        frequencyValue = 0.1 + Math.random() * 1; // 0.1-1.1 Hz
        accelerationValue = 0.001 + Math.random() * 0.01; // 0.001-0.011 m/s²
        displacementValue = 0.01 + Math.random() * 0.1; // 0.01-0.11 mm
      }
      
      magnitude.push(parseFloat(magnitudeValue.toFixed(2)));
      frequency.push(parseFloat(frequencyValue.toFixed(2)));
      acceleration.push(parseFloat(accelerationValue.toFixed(3)));
      displacement.push(parseFloat(displacementValue.toFixed(2)));
    }
    
    return { timestamps, magnitude, frequency, acceleration, displacement };
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
      
      // Generate mock data for Seismic sensors
      const mockData = generateSeismicMockData(start, end, resolution);
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

  // Magnitude graph - independent
  useEffect(() => {
    if (isCompareMode) return;
    loadForSensor(sensor, setMagnitudeSeries, 'primary', date, magnitudeScale);
  }, [sensor.id, date, projectId, magnitudeScale, isCompareMode]);

  // Acceleration graph - independent
  useEffect(() => {
    if (isCompareMode) return;
    loadForSensor(sensor, setAccelerationSeries, 'primary', date, accelerationScale);
  }, [sensor.id, date, projectId, accelerationScale, isCompareMode]);

  // Frequency graph - independent
  useEffect(() => {
    if (isCompareMode) return;
    loadForSensor(sensor, setFrequencySeries, 'primary', date, frequencyScale);
  }, [sensor.id, date, projectId, frequencyScale, isCompareMode]);

  useEffect(() => {
    const init = async () => {
      try {
        const start = new Date(); 
        start.setHours(0,0,0,0);
        const end = new Date();
        
        const mockData = generateSeismicMockData(start, end, 96);
        const mArr = mockData.magnitude || [];
        const fArr = mockData.frequency || [];
        const aArr = mockData.acceleration || [];
        const dArr = mockData.displacement || [];
        
        let magnitudeMin = mArr.length ? Math.min(...mArr) : 0;
        let magnitudeMax = mArr.length ? Math.max(...mArr) : 0;
        let accelerationMin = aArr.length ? Math.min(...aArr) : 0;
        let accelerationMax = aArr.length ? Math.max(...aArr) : 0;
        let magnitudeCur = mArr.length ? mArr[mArr.length-1] : 0;
        let frequencyCur = fArr.length ? fArr[fArr.length-1] : 0;
        let accelerationCur = aArr.length ? aArr[aArr.length-1] : 0;
        let displacementCur = dArr.length ? dArr[dArr.length-1] : 0;
        let frequencyAvg = fArr.length ? fArr.reduce((a, b) => a + b, 0) / fArr.length : 0;
        let displacementMax = dArr.length ? Math.max(...dArr) : 0;
        
        const formatTime = (date: Date) => 
          `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        
        let magnitudeMinTime = '00:00', magnitudeMaxTime = '00:00', accelerationMinTime = '00:00', accelerationMaxTime = '00:00';
        
        if (mArr.length && mockData.timestamps.length) {
          const magnitudeMinIndex = mArr.findIndex(m => m === magnitudeMin);
          const magnitudeMaxIndex = mArr.findIndex(m => m === magnitudeMax);
          if (magnitudeMinIndex >= 0 && mockData.timestamps[magnitudeMinIndex]) magnitudeMinTime = formatTime(mockData.timestamps[magnitudeMinIndex]);
          if (magnitudeMaxIndex >= 0 && mockData.timestamps[magnitudeMaxIndex]) magnitudeMaxTime = formatTime(mockData.timestamps[magnitudeMaxIndex]);
        }
        
        if (aArr.length && mockData.timestamps.length) {
          const accelerationMinIndex = aArr.findIndex(a => a === accelerationMin);
          const accelerationMaxIndex = aArr.findIndex(a => a === accelerationMax);
          if (accelerationMinIndex >= 0 && mockData.timestamps[accelerationMinIndex]) accelerationMinTime = formatTime(mockData.timestamps[accelerationMinIndex]);
          if (accelerationMaxIndex >= 0 && mockData.timestamps[accelerationMaxIndex]) accelerationMaxTime = formatTime(mockData.timestamps[accelerationMaxIndex]);
        }
        
        // Generate event history (events with magnitude > 2.0)
        const events: Array<{time: string, magnitude: number, status: string}> = [];
        for (let i = 0; i < mArr.length; i++) {
          if (mArr[i] > 2.0) {
            const eventStatus = mArr[i] >= 4.0 ? 'Major' : mArr[i] >= 3.0 ? 'Moderate' : 'Minor';
            events.push({
              time: formatTime(mockData.timestamps[i]),
              magnitude: mArr[i],
              status: eventStatus
            });
          }
        }
        setSeismicEvents(events.slice(-6)); // Keep last 6 events
        
        setGaugeStats({ magnitudeCur, frequencyCur, accelerationCur, displacementCur, magnitudeMin, magnitudeMax, accelerationMin, accelerationMax, frequencyAvg, displacementMax, magnitudeMinTime, magnitudeMaxTime, accelerationMinTime, accelerationMaxTime });
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
    if (!series?.magnitude || !series.acceleration || !series.timestamps) return null;
    
    const magnitudeMin = Math.min(...series.magnitude);
    const magnitudeMax = Math.max(...series.magnitude);
    const accelerationMin = Math.min(...series.acceleration);
    const accelerationMax = Math.max(...series.acceleration);
    const magnitudeCur = series.magnitude[series.magnitude.length-1];
    const accelerationCur = series.acceleration[series.acceleration.length-1];
    
    const magnitudeMinIndex = series.magnitude.findIndex(m => m === magnitudeMin);
    const magnitudeMaxIndex = series.magnitude.findIndex(m => m === magnitudeMax);
    const accelerationMinIndex = series.acceleration.findIndex(a => a === accelerationMin);
    const accelerationMaxIndex = series.acceleration.findIndex(a => a === accelerationMax);
    
    const formatTime = (date: Date) => 
      `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    
    const magnitudeMinTime = magnitudeMinIndex >= 0 ? formatTime(series.timestamps[magnitudeMinIndex]) : '00:00';
    const magnitudeMaxTime = magnitudeMaxIndex >= 0 ? formatTime(series.timestamps[magnitudeMaxIndex]) : '00:00';
    const accelerationMinTime = accelerationMinIndex >= 0 ? formatTime(series.timestamps[accelerationMinIndex]) : '00:00';
    const accelerationMaxTime = accelerationMaxIndex >= 0 ? formatTime(series.timestamps[accelerationMaxIndex]) : '00:00';
    
    return { magnitudeMin, magnitudeMax, accelerationMin, accelerationMax, magnitudeCur, accelerationCur, magnitudeMinTime, magnitudeMaxTime, accelerationMinTime, accelerationMaxTime };
  }, [series]);

  const seismicStatus = useMemo(() => {
    const mag = gaugeStats?.magnitudeCur ?? stats?.magnitudeCur ?? 0;
    
    let status, color, description;
    if (mag < 1) {
      status = "Stable";
      color = "green";
      description = "Micro-seismic activity";
    } else if (mag < 2) {
      status = "Minor";
      color = "blue";
      description = "Minor vibrations detected";
    } else if (mag < 3) {
      status = "Moderate";
      color = "yellow";
      description = "Moderate seismic activity";
    } else {
      status = "Alert";
      color = "red";
      description = "Significant activity detected";
    }
    
    return { status, color, description };
  }, [gaugeStats, stats]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Width observer (only width now) + listen to viewport resize for dynamic height recalculation
  useEffect(() => {
    const el = centerColRef.current;
    if (!el) return;
    const updateWidth = () => setChartWidth(Math.max(320, el.clientWidth - 32));
    updateWidth();
    const ro = new ResizeObserver(() => updateWidth());
    ro.observe(el);
    return () => ro.disconnect();
  }, [centerColRef]);

  // Simple fixed height approach - no dynamic calculation
  useEffect(() => {
    // Set fixed, reasonable heights that work on most screens
    setChartContainerHeight(200); // Fixed container height
    setChartHeight(200); // Fixed inner SVG height to match sensor-graphs
  }, []);  const Gauge: React.FC<{ value?: number; min: number; max: number; label: string; unit?: string; color?: string; dangerZones?: { from: number; to: number; color: string }[]; small?: boolean; showMinMax?: boolean; }> = ({ value, min, max, label, unit = '', color = '#22c55e', dangerZones = [], small = false, showMinMax = false }) => {
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
            {Number.isFinite(v) ? `${v.toFixed(isPercentUnit ? 0 : unit.includes('m/s') ? 3 : 2)}${unit}` : `—${unit}`}
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

  const Cartesian: React.FC<{ mode: 'combined'|'magnitude'|'acceleration'|'frequency'; title: string; width: number; height: number; data: DailySeries | null; scale: "D" | "W" | "M" | "Y"; accelerationData?: DailySeries | null; }> = ({ mode, title, width, height, data, scale, accelerationData }) => {
    const [hoverX, setHoverX] = useState<number | null>(null);
    const [hoverIndex, setHoverIndex] = useState<number | null>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    
    // For combined mode, use accelerationData if provided, otherwise fallback to data.acceleration
    const effectiveAccelerationData = mode === 'combined' && accelerationData ? accelerationData.acceleration : data?.acceleration;
    
    // For frequency mode, check if frequency data exists
    if (mode === 'frequency') {
      if (!data?.timestamps?.length || !data.frequency) return <div className="flex items-center justify-center h-full min-h-[120px] text-sm text-gray-500 bg-gray-900 border border-gray-700 rounded-xl">No data</div>;
    } else if (!data?.timestamps?.length || !data.magnitude || !effectiveAccelerationData) {
      return <div className="flex items-center justify-center h-full min-h-[120px] text-sm text-gray-500 bg-gray-900 border border-gray-700 rounded-xl">No data</div>;
    }
    
    const w = Math.max(320, width);
    const h = Math.max(120, height);
    const l = 38; const r = 12; const t = 20; const b = 30;
    
    const xs = data.timestamps.map(d=>d.getTime());
    const xMin = xs[0]; const xMax = xs[xs.length-1];
    const magnitudeMin = Math.min(...(data.magnitude || []), ...(compareSeries?.magnitude||[]));
    const magnitudeMax = Math.max(...(data.magnitude || []), ...(compareSeries?.magnitude||[]));
    const accelerationMin = Math.min(...(effectiveAccelerationData || []), ...(compareSeries?.acceleration||[]));
    const accelerationMax = Math.max(...(effectiveAccelerationData || []), ...(compareSeries?.acceleration||[]));
    const frequencyMin = Math.min(...(data.frequency || []), ...(compareSeries?.frequency||[]));
    const frequencyMax = Math.max(...(data.frequency || []), ...(compareSeries?.frequency||[]));
    
    let yMin, yMax, span;
    if (mode === 'magnitude') {
      // Dynamic Y-axis with proper padding for balanced visualization
      const dataRange = magnitudeMax - magnitudeMin;
      const paddingPercent = 0.15; // 15% padding on both sides
      const padding = Math.max(0.2, dataRange * paddingPercent);
      
      // If all values are very close to zero, keep zero baseline
      if (magnitudeMin < 0.5) {
        yMin = 0;
        yMax = magnitudeMax + padding;
      } else {
        // Dynamic min/max for better visualization of higher values
        yMin = Math.max(0, magnitudeMin - padding);
        yMax = magnitudeMax + padding;
      }
    } else if (mode === 'acceleration') {
      // Dynamic Y-axis with proper padding for balanced visualization
      const dataRange = accelerationMax - accelerationMin;
      const paddingPercent = 0.15; // 15% padding on both sides
      const padding = Math.max(0.01, dataRange * paddingPercent);
      
      // If all values are very close to zero, keep zero baseline
      if (accelerationMin < 0.005) {
        yMin = 0;
        yMax = accelerationMax + padding;
      } else {
        // Dynamic min/max for better visualization of higher values
        yMin = Math.max(0, accelerationMin - padding);
        yMax = accelerationMax + padding;
      }
    } else if (mode === 'frequency') {
      // Dynamic Y-axis for frequency with proper padding
      const dataRange = frequencyMax - frequencyMin;
      const paddingPercent = 0.15; // 15% padding on both sides
      const padding = Math.max(0.5, dataRange * paddingPercent);
      
      // Keep zero baseline for frequency
      yMin = 0;
      yMax = frequencyMax + padding;
    } else {
      yMin = 0;
      yMax = Math.max(magnitudeMax, accelerationMax * 3);
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
    const primaryMagnitudePath = data.magnitude ? pathFor(data.magnitude!) : '';
    const primaryFrequencyPath = data.frequency ? pathFor(data.frequency!) : '';
    // Scale acceleration only in combined mode for visibility comparison
    const primaryAccelerationPath = mode === 'combined' 
      ? pathFor(effectiveAccelerationData!.map(a => a * 3))
      : (effectiveAccelerationData ? pathFor(effectiveAccelerationData!) : '');
    const compareMagnitudePath = compareSeries?.magnitude ? pathFor(compareSeries.magnitude): null;
    const compareFrequencyPath = compareSeries?.frequency ? pathFor(compareSeries.frequency): null;
    const compareAccelerationPath = compareSeries?.acceleration 
      ? (mode === 'combined' 
          ? pathFor(compareSeries.acceleration.map(a => a * 3))
          : pathFor(compareSeries.acceleration))
      : null;
    
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
    if (mode === 'magnitude') {
      yTicks = Array.from({length:6}).map((_,i)=> Math.round((yMin + (span)*i/5) * 100) / 100);
    } else if (mode === 'acceleration') {
      const numTicks = 5;
      yTicks = [];
      for (let i = 0; i <= numTicks; i++) {
        const tickValue = yMin + (span * i / numTicks);
        yTicks.push(Math.round(tickValue * 1000) / 1000);
      }
      yTicks = [...new Set(yTicks)].sort((a, b) => a - b);
    } else {
      yTicks = Array.from({length:6}).map((_,i)=> Math.round((yMin + (span)*i/5) * 100) / 100);
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
      
      const snapX = mapPoint(xs[closestIdx], data.magnitude![closestIdx]).x;
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
        {yTicks.map((v,i)=>{const y=t+innerH*(1 - (v-yMin)/span);return <g key={i}><line x1={l} x2={l+innerW} y1={y} y2={y} stroke="#1f2937"/><text x={l-4} y={y+3} fontSize={9} fill="#ffffff" textAnchor="end">{v.toFixed(2)}</text></g>;})}
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
        {(mode==='combined' || mode==='magnitude') && <path d={primaryMagnitudePath} fill="none" stroke="#ef4444" strokeWidth={2} />}
        {(mode==='combined' || mode==='acceleration') && <path d={primaryAccelerationPath} fill="none" stroke="#3b82f6" strokeWidth={2} />}
        {mode==='frequency' && <path d={primaryFrequencyPath} fill="none" stroke="#f97316" strokeWidth={2} />}
        {(mode!=='acceleration' && mode!=='frequency' && compareMagnitudePath) && <path d={compareMagnitudePath} fill="none" stroke="#f97316" strokeWidth={1.5} strokeDasharray="3 3" />}
        {(mode!=='magnitude' && mode!=='frequency' && compareAccelerationPath) && <path d={compareAccelerationPath} fill="none" stroke="#10b981" strokeWidth={1.5} strokeDasharray="3 3" />}
        {(mode==='frequency' && compareFrequencyPath) && <path d={compareFrequencyPath} fill="none" stroke="#fbbf24" strokeWidth={1.5} strokeDasharray="3 3" />}
        
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
            
            {(mode === 'combined' || mode === 'magnitude') && (
              <>
                <circle cx={hoverX > l + innerW / 2 ? hoverX - 110 : hoverX + 30} cy={t + 42} r={3} fill="#ef4444" />
                <text x={hoverX > l + innerW / 2 ? hoverX - 100 : hoverX + 40} y={t + 45} fontSize={10} fill="#f3f4f6" fontWeight="600">
                  M {data.magnitude![hoverIndex].toFixed(2)}
                </text>
              </>
            )}
            
            {(mode === 'combined' || mode === 'acceleration') && (
              <>
                <circle cx={hoverX > l + innerW / 2 ? hoverX - 110 : hoverX + 30} cy={mode === 'combined' ? t + 60 : t + 42} r={3} fill="#3b82f6" />
                <text x={hoverX > l + innerW / 2 ? hoverX - 100 : hoverX + 40} y={mode === 'combined' ? t + 63 : t + 45} fontSize={10} fill="#f3f4f6" fontWeight="600">
                  {effectiveAccelerationData![hoverIndex].toFixed(3)} m/s²
                </text>
              </>
            )}
            
            {mode === 'frequency' && data.frequency && (
              <>
                <circle cx={hoverX > l + innerW / 2 ? hoverX - 110 : hoverX + 30} cy={t + 42} r={3} fill="#f97316" />
                <text x={hoverX > l + innerW / 2 ? hoverX - 100 : hoverX + 40} y={t + 45} fontSize={10} fill="#f3f4f6" fontWeight="600">
                  {data.frequency![hoverIndex].toFixed(2)} Hz
                </text>
              </>
            )}
            
            {(mode === 'combined' || mode === 'magnitude') && (
              <circle cx={hoverX} cy={mapPoint(xs[hoverIndex], data.magnitude![hoverIndex]).y} r={4} fill="#ef4444" stroke="#1f2937" strokeWidth={2} />
            )}
            
            {(mode === 'combined' || mode === 'acceleration') && (
              <circle cx={hoverX} cy={mapPoint(xs[hoverIndex], mode === 'combined' ? effectiveAccelerationData![hoverIndex] * 3 : effectiveAccelerationData![hoverIndex]).y} r={4} fill="#3b82f6" stroke="#1f2937" strokeWidth={2} />
            )}
            
            {mode === 'frequency' && data.frequency && (
              <circle cx={hoverX} cy={mapPoint(xs[hoverIndex], data.frequency![hoverIndex]).y} r={4} fill="#f97316" stroke="#1f2937" strokeWidth={2} />
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
            <h3 className="text-lg font-bold text-white">Seismic Sensor Dashboard</h3>
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
                  const url = `/seismic-dashboard/${roomName}/${sensorName}?id=${sensor?.id || ''}&projectId=${projectId || ''}`;
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

      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-3 p-2 md:p-3 overflow-hidden">
        <div className="col-span-1 md:col-span-3 flex flex-col h-auto md:h-full space-y-2 min-h-0">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-2 md:p-3 flex-shrink-0 md:flex-1 md:min-h-0 overflow-hidden">
            <div className="text-sm md:text-md font-semibold text-white mb-1.5 md:mb-2 text-center">Seismic Activity</div>
            <div className="grid grid-cols-2 py-3 gap-1 md:gap-1.5 w-full">
              <Gauge label="Magnitude" value={gaugeStats?.magnitudeCur ?? stats?.magnitudeCur ?? 0} min={0} max={5} unit="" color="#ef4444" small />
              <Gauge label="Frequency" value={gaugeStats?.frequencyCur ?? 0} min={0} max={20} unit=" Hz" color="#fbbf24" small />
              <Gauge label="Acceleration" value={gaugeStats?.accelerationCur ?? 0} min={0} max={1} unit="m/s²" color="#3b82f6" small />
              <Gauge label="Displacement" value={gaugeStats?.displacementCur ?? 0} min={0} max={10} unit=" mm" color="#10b981" small />
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-700 rounded-xl p-2 md:p-3 flex-shrink-0 overflow-hidden">
            <div className="text-xs md:text-sm font-semibold text-white mb-1.5 md:mb-2 text-center">Magnitude Range</div>
            <div className="grid grid-cols-2 gap-1 md:gap-1.5 w-full">
              <Gauge label="Min" value={gaugeStats?.magnitudeMin ?? stats?.magnitudeMin ?? 0} min={0} max={5} unit="" color="#3b82f6" small />
              <Gauge label="Max" value={gaugeStats?.magnitudeMax ?? stats?.magnitudeMax ?? 0} min={0} max={5} unit="" color="#ef4444" small />
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-700 rounded-xl p-2 md:p-3 flex-shrink-0 overflow-hidden">
            <div className="text-xs md:text-sm font-semibold text-white mb-1.5 md:mb-2 text-center">Acceleration Range</div>
            <div className="grid grid-cols-2 gap-1 md:gap-1.5 w-full">
              <Gauge label="Min" value={gaugeStats?.accelerationMin ?? stats?.accelerationMin ?? 0} min={0} max={1} unit="m/s²" color="#3b82f6" small />
              <Gauge label="Max" value={gaugeStats?.accelerationMax ?? stats?.accelerationMax ?? 0} min={0} max={1} unit="m/s²" color="#3b82f6" small />
            </div>
          </div>
        </div>

        <div ref={centerColRef} className="col-span-1 md:col-span-6 flex flex-col h-auto md:h-full min-w-0 overflow-hidden">
          {/* Container for three graphs with dynamic height distribution */}
          <div className="flex-1 flex flex-col gap-1.5 md:gap-2 min-h-0">
            {/* Magnitude Graph */}
            <div className="flex-1 flex flex-col min-h-[180px] md:min-h-0 bg-gray-900 border border-gray-700 rounded-xl p-2 md:p-3 overflow-hidden">
              <div className="flex items-center justify-between mb-1.5 md:mb-2 flex-shrink-0">
                <div className="text-xs md:text-sm font-semibold text-white">Magnitude (Richter Scale)</div>
                <ScaleSwitch currentScale={magnitudeScale} setScale={setMagnitudeScale} />
              </div>
              <div className="flex-1 min-h-0 relative">
                <Cartesian mode="magnitude" title="Magnitude" width={chartWidth} height={chartHeight} data={magnitudeSeries} scale={magnitudeScale} />
              </div>
            </div>

            {/* Acceleration Graph */}
            <div className="flex-1 flex flex-col min-h-[180px] md:min-h-0 bg-gray-900 border border-gray-700 rounded-xl p-2 md:p-3 overflow-hidden">
              <div className="flex items-center justify-between mb-1.5 md:mb-2 flex-shrink-0">
                <div className="text-xs md:text-sm font-semibold text-white">Acceleration (m/s²)</div>
                <ScaleSwitch currentScale={accelerationScale} setScale={setAccelerationScale} />
              </div>
              <div className="flex-1 min-h-0 relative">
                <Cartesian mode="acceleration" title="Acceleration" width={chartWidth} height={chartHeight} data={accelerationSeries} scale={accelerationScale} />
              </div>
            </div>

            {/* Frequency Graph */}
            <div className="flex-1 flex flex-col min-h-[180px] md:min-h-0 bg-gray-900 border border-gray-700 rounded-xl p-2 md:p-3 overflow-hidden">
              <div className="flex items-center justify-between mb-1.5 md:mb-2 flex-shrink-0">
                <div className="text-xs md:text-sm font-semibold text-white">Frequency (Hz)</div>
                <ScaleSwitch currentScale={frequencyScale} setScale={setFrequencyScale} />
              </div>
              <div className="flex-1 min-h-0 relative">
                <Cartesian mode="frequency" title="Frequency" width={chartWidth} height={chartHeight} data={frequencySeries} scale={frequencyScale} />
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-1 md:col-span-3 flex flex-col h-auto md:h-full gap-2 md:gap-3 min-h-0">
          {/* Displacement & Frequency Stats Card - Smaller */}
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-2 md:p-3 flex-shrink-0 md:flex-1 md:min-h-0 overflow-hidden">
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-xs md:text-sm font-semibold text-white truncate">Performance Stats</div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-2">
                <div className="text-[10px] md:text-xs text-gray-400 truncate">Current Displacement</div>
                <div className="text-sm md:text-base font-bold text-white truncate">{(gaugeStats?.displacementCur ?? 0).toFixed(2)} mm</div>
              </div>
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-2">
                <div className="text-[10px] md:text-xs text-gray-400 truncate">Peak Displacement</div>
                <div className="text-sm md:text-base font-bold text-white truncate">{(gaugeStats?.displacementMax ?? 0).toFixed(2)} mm</div>
              </div>
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-2">
                <div className="text-[10px] md:text-xs text-gray-400 truncate">Current Frequency</div>
                <div className="text-sm md:text-base font-bold text-white truncate">{(gaugeStats?.frequencyCur ?? 0).toFixed(2)} Hz</div>
              </div>
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-2">
                <div className="text-[10px] md:text-xs text-gray-400 truncate">Avg Frequency</div>
                <div className="text-sm md:text-base font-bold text-white truncate">{(gaugeStats?.frequencyAvg ?? 0).toFixed(2)} Hz</div>
              </div>
            </div>
          </div>

          {/* Event History Card - Equal height with Alerts */}
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-2 md:p-3 flex-shrink-0 md:flex-1 md:min-h-0 flex flex-col overflow-hidden">
            <div className="text-xs md:text-sm font-semibold text-white mb-1.5 md:mb-2">Event History</div>
            <div className="space-y-1 overflow-y-auto flex-1">
              {seismicEvents.length > 0 ? seismicEvents.map((event, idx) => {
                const eventColor = event.status === 'Major' ? 'red' : event.status === 'Moderate' ? 'yellow' : 'green';
                const eventIcon = event.status === 'Major' ? '🔴' : event.status === 'Moderate' ? '🟡' : '🟢';
                return (
                  <div key={idx} className={`flex items-center justify-between gap-2 bg-${eventColor}-900/20 border border-${eventColor}-700/50 rounded-lg p-1.5`}>
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <span className="text-xs">{eventIcon}</span>
                      <div className="flex-1 min-w-0">
                        <div className={`text-[10px] md:text-xs font-medium text-${eventColor}-400 truncate`}>{event.status}</div>
                        <div className="text-[9px] md:text-[10px] text-gray-400">{event.time}</div>
                      </div>
                    </div>
                    <div className="text-xs font-bold text-white whitespace-nowrap">M {event.magnitude.toFixed(2)}</div>
                  </div>
                );
              }) : (
                <div className="flex items-center justify-center h-full text-xs text-gray-500">No significant events</div>
              )}
            </div>
          </div>

          {/* Active Alerts Card - Equal height with Event History */}
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-2 md:p-3 flex-shrink-0 md:flex-1 md:min-h-0 flex flex-col overflow-hidden">
            <div className="text-xs md:text-sm font-semibold text-white mb-1.5 md:mb-2">Active Alerts</div>
            <div className="space-y-1.5 md:space-y-2">
              <div className={`flex items-center gap-2 bg-${seismicStatus.color}-900/30 border border-${seismicStatus.color}-700 rounded-lg p-2`}>
                <div className={`w-1.5 h-1.5 bg-${seismicStatus.color}-400 rounded-full flex-shrink-0`}></div>
                <div className="flex-1">
                  <div className={`text-xs md:text-sm font-medium text-${seismicStatus.color}-400`}>{seismicStatus.status}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-blue-900/30 border border-blue-700 rounded-lg p-2">
                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full flex-shrink-0"></div>
                <div className="flex-1">
                  <div className="text-xs md:text-sm font-medium text-blue-400">Monitoring Active</div>
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
