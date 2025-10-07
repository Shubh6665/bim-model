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
  power?: number[];
  voltage?: number[];
  current?: number[];
  efficiency?: number[];
  energy?: number[];
  production?: number[];
};

type EconomicParams = {
  selfConsumptionRate: number;
  avgDailyLoad: number;
  gridPrice: number;
  sellingPrice: number;
  forecastTrend: number;
};

type ForecastPeriod = 'monthly' | 'annual' | 'custom';

type KPIData = {
  yieldEnergy: number;
  efficiency: number;
  directSelfUseRate: number;
  exportedEnergy: number;
  gridConsumption: number;
  income: number;
  saving: number;
  bill: number;
};

// Standalone SettingsPanel Component
interface SettingsPanelProps {
  economicParams: EconomicParams;
  setEconomicParams: React.Dispatch<React.SetStateAction<EconomicParams>>;
  onClose: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ economicParams, setEconomicParams, onClose }) => {
  const [gridPriceText, setGridPriceText] = React.useState(String(economicParams.gridPrice));
  const [sellingPriceText, setSellingPriceText] = React.useState(String(economicParams.sellingPrice));
  
  return (
  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[3000] flex items-center justify-center" onClick={onClose}>
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 max-w-md w-full m-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">⚙️</span>
          <h3 className="text-base font-semibold text-white">System Parameters</h3>
        </div>
        <button 
          onClick={onClose} 
          className="w-8 h-8 rounded-full bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-400 hover:text-white flex items-center justify-center transition text-xl leading-none"
          aria-label="Close"
        >
          ×
        </button>
      </div>
      
      <div className="space-y-4">
        {/* Self-consumption slider with controls */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-gray-300">Self-Consumption Rate</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEconomicParams({ ...economicParams, selfConsumptionRate: Math.max(0, economicParams.selfConsumptionRate - 5) })}
                className="w-7 h-7 rounded bg-gray-700 hover:bg-gray-600 border border-gray-600 text-white font-bold flex items-center justify-center transition text-sm"
                title="Decrease by 5%"
              >
                −
              </button>
              <input
                type="text"
                inputMode="numeric"
                value={economicParams.selfConsumptionRate}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  setEconomicParams({ ...economicParams, selfConsumptionRate: Math.min(100, Math.max(0, val)) });
                }}
                className="w-16 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-center text-sm font-semibold"
                placeholder="70"
              />
              <span className="text-xs text-gray-400 font-medium">%</span>
              <button
                type="button"
                onClick={() => setEconomicParams({ ...economicParams, selfConsumptionRate: Math.min(100, economicParams.selfConsumptionRate + 5) })}
                className="w-7 h-7 rounded bg-gray-700 hover:bg-gray-600 border border-gray-600 text-white font-bold flex items-center justify-center transition text-sm"
                title="Increase by 5%"
              >
                +
              </button>
            </div>
          </div>
          <div className="relative pt-4">
            <input
              type="range"
              min={0}
              max={100}
              value={economicParams.selfConsumptionRate}
              onChange={(e) => setEconomicParams({ ...economicParams, selfConsumptionRate: Number(e.target.value) })}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
            <div
              className="absolute -top-1.5 translate-x-[-50%] px-1.5 py-0.5 rounded bg-blue-600 text-white text-[10px] font-semibold pointer-events-none"
              style={{ left: `calc(${economicParams.selfConsumptionRate}%)` }}
            >
              {economicParams.selfConsumptionRate}%
            </div>
            <div className="flex justify-between text-[10px] text-gray-300 mt-1">
              {[0,25,50,75,100].map((v)=> (
                <button
                  key={v}
                  type="button"
                  onClick={() => setEconomicParams({ ...economicParams, selfConsumptionRate: v })}
                  className={`px-1.5 py-0.5 rounded transition ${economicParams.selfConsumptionRate===v ? 'bg-blue-600 text-white' : 'bg-transparent text-gray-300 hover:bg-gray-800'}`}
                  aria-label={`Set to ${v}%`}
                  title={`${v}%`}
                >
                  {v}%
                </button>
              ))}
            </div>
            <div className="relative h-2 mt-1">
              <div className="absolute inset-x-0 top-0 h-[2px] bg-gray-700" />
              <div className="absolute left-0 top-0 h-2 w-[2px] bg-gray-500" />
              <div className="absolute left-1/4 top-0 h-2 w-[2px] bg-gray-500" />
              <div className="absolute left-1/2 top-0 h-2 w-[2px] bg-gray-500" />
              <div className="absolute left-3/4 top-0 h-2 w-[2px] bg-gray-500" />
              <div className="absolute right-0 top-0 h-2 w-[2px] bg-gray-500" />
            </div>
          </div>
        </div>
        
        {/* 2-column compact inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-300 block mb-1">Average Daily Load (kWh)</label>
            <input
              type="text"
              inputMode="decimal"
              value={economicParams.avgDailyLoad}
              onChange={(e) => {
                const val = e.target.value.replace(',', '.');
                const num = parseFloat(val);
                setEconomicParams({ ...economicParams, avgDailyLoad: isNaN(num) ? 0 : num });
              }}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
              placeholder="e.g. 15"
            />
          </div>
          <div>
            <label className="text-xs text-gray-300 block mb-1">Grid Energy Price (€/kWh)</label>
            <input
              type="text"
              inputMode="decimal"
              value={gridPriceText}
              onChange={(e) => {
                const val = e.target.value.replace(',', '.');
                // Allow typing decimal values
                if (val === '' || /^[0-9]*\.?[0-9]*$/.test(val)) {
                  setGridPriceText(val);
                  const num = parseFloat(val);
                  if (!isNaN(num)) {
                    setEconomicParams({ ...economicParams, gridPrice: num });
                  }
                }
              }}
              onBlur={() => {
                // On blur, sync with actual value
                setGridPriceText(String(economicParams.gridPrice));
              }}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
              placeholder="e.g. 0.25"
            />
          </div>
          <div>
            <label className="text-xs text-gray-300 block mb-1">Selling Price (€/kWh)</label>
            <input
              type="text"
              inputMode="decimal"
              value={sellingPriceText}
              onChange={(e) => {
                const val = e.target.value.replace(',', '.');
                // Allow typing decimal values
                if (val === '' || /^[0-9]*\.?[0-9]*$/.test(val)) {
                  setSellingPriceText(val);
                  const num = parseFloat(val);
                  if (!isNaN(num)) {
                    setEconomicParams({ ...economicParams, sellingPrice: num });
                  }
                }
              }}
              onBlur={() => {
                // On blur, sync with actual value
                setSellingPriceText(String(economicParams.sellingPrice));
              }}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
              placeholder="e.g. 0.10"
            />
          </div>
          <div>
            <label className="text-xs text-gray-300 block mb-1">Forecast Trend (% daily)</label>
            <input
              type="text"
              inputMode="decimal"
              value={economicParams.forecastTrend}
              onChange={(e) => {
                const val = e.target.value.replace(',', '.');
                const num = parseFloat(val);
                setEconomicParams({ ...economicParams, forecastTrend: isNaN(num) ? 0 : num });
              }}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
              placeholder="e.g. 2"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
  );
};

export default function PVSensorDashboard({ sensor, allSensors, onClose, projectId, standalone = false }: Props) {
  const [date, setDate] = useState(() => new Date());
  const [series, setSeries] = useState<DailySeries | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<Date>(() => new Date());
  const centerColRef = useRef<HTMLDivElement | null>(null);
  const [chartWidth, setChartWidth] = useState<number>(800);
  const [chartHeight, setChartHeight] = useState<number>(200);
  const dateInputEl = useRef<HTMLInputElement | null>(null);
  
  const [viewScale, setViewScale] = useState<"D" | "W" | "M" | "Y">("D");
  const [showSettings, setShowSettings] = useState(false);
  const [forecastPeriod, setForecastPeriod] = useState<ForecastPeriod>('monthly');
  const [customForecastDays, setCustomForecastDays] = useState(90);
  
  const [economicParams, setEconomicParams] = useState<EconomicParams>({
    selfConsumptionRate: 70,
    avgDailyLoad: 15,
    gridPrice: 0.25,
    sellingPrice: 0.10,
    forecastTrend: 0,
  });

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

  const generatePVMockData = (start: Date, end: Date, resolution: number, scale: "D" | "W" | "M" | "Y" = "D"): DailySeries => {
    const timestamps: Date[] = [];
    const power: number[] = [];
    const voltage: number[] = [];
    const current: number[] = [];
    const efficiency: number[] = [];
    const energy: number[] = [];
    const production: number[] = [];
    
    const duration = end.getTime() - start.getTime();
    const interval = duration / resolution;
    let cumulativeEnergy = 0;
    
    for (let i = 0; i <= resolution; i++) {
      const timestamp = new Date(start.getTime() + i * interval);
      timestamps.push(timestamp);
      
      const hour = timestamp.getHours() + timestamp.getMinutes() / 60;
      const dayOfYear = Math.floor((timestamp.getTime() - new Date(timestamp.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
      const seasonalFactor = 0.7 + 0.3 * Math.sin((dayOfYear / 365) * 2 * Math.PI - Math.PI / 2);
      
      let powerValue = 0;
      let efficiencyValue = 0;
      let dailyProduction = 0;
      
      if (scale === "D") {
        if (hour >= 6 && hour <= 18) {
          const solarPosition = (hour - 6) / 12;
          const bellCurve = Math.sin(solarPosition * Math.PI);
          powerValue = bellCurve * 12 * (0.85 + Math.random() * 0.3) * seasonalFactor;
          efficiencyValue = 15 + bellCurve * 7 + (Math.random() - 0.5) * 2;
        }
      } else {
        dailyProduction = (8 + Math.random() * 4) * seasonalFactor;
        powerValue = dailyProduction;
      }
      
      const voltageValue = powerValue > 0 ? 320 + (Math.random() - 0.5) * 40 : 0;
      const currentValue = voltageValue > 0 ? (powerValue * 1000) / voltageValue : 0;
      
      if (i > 0 && scale === "D") {
        const intervalHours = interval / (1000 * 60 * 60);
        cumulativeEnergy += powerValue * intervalHours;
      } else if (scale !== "D") {
        cumulativeEnergy += dailyProduction;
      }
      
      power.push(parseFloat(powerValue.toFixed(2)));
      voltage.push(parseFloat(voltageValue.toFixed(1)));
      current.push(parseFloat(currentValue.toFixed(2)));
      efficiency.push(parseFloat(efficiencyValue.toFixed(1)));
      energy.push(parseFloat(cumulativeEnergy.toFixed(2)));
      production.push(parseFloat((scale === "D" ? powerValue : dailyProduction).toFixed(2)));
    }
    
    return { timestamps, power, voltage, current, efficiency, energy, production };
  };

  const loadForSensor = async (target: Sensor, setter: (s: DailySeries|null)=>void, forDate?: Date, scale: "D" | "W" | "M" | "Y" = "D") => {
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
          resolution = 7;
          break;
        case "M":
          start.setDate(1);
          start.setHours(0,0,0,0);
          end = new Date(start);
          end.setMonth(end.getMonth() + 1);
          end.setDate(0);
          end.setHours(23,59,59,999);
          resolution = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
          break;
        case "Y":
          start.setMonth(0, 1);
          start.setHours(0,0,0,0);
          end = new Date(start);
          end.setFullYear(end.getFullYear() + 1);
          end.setDate(0);
          end.setHours(23,59,59,999);
          resolution = 12;
          break;
      }
      
      const today = new Date();
      const isSameDay = start.getFullYear()===today.getFullYear() && start.getMonth()===today.getMonth() && start.getDate()===today.getDate() && scale === "D";
      if (isSameDay) end = new Date();
      
      const mockData = generatePVMockData(start, end, resolution, scale);
      setter(mockData);
      setError(null);
    } catch (e:any) {
      setError(e?.message || 'Failed to load data');
      setter(null);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadForSensor(sensor, setSeries, date, viewScale).finally(() => setLoading(false));
  }, [sensor.id, date, projectId, viewScale]);

  const calculateKPIs = useMemo((): KPIData | null => {
    if (!series?.energy || series.energy.length === 0) return null;
    
    const yieldEnergy = series.energy[series.energy.length - 1];
    const avgEfficiency = series.efficiency && series.efficiency.length > 0
      ? series.efficiency.reduce((a, b) => a + b, 0) / series.efficiency.filter(e => e > 0).length
      : 18;
    
    const selfConsumption = yieldEnergy * (economicParams.selfConsumptionRate / 100);
    const exportedEnergy = yieldEnergy - selfConsumption;
    const gridConsumption = Math.max(0, economicParams.avgDailyLoad - selfConsumption);
    
    const income = exportedEnergy * economicParams.sellingPrice;
    const saving = selfConsumption * economicParams.gridPrice;
    const bill = (gridConsumption * economicParams.gridPrice) - income;
    
    return {
      yieldEnergy,
      efficiency: avgEfficiency,
      directSelfUseRate: economicParams.selfConsumptionRate,
      exportedEnergy,
      gridConsumption,
      income,
      saving,
      bill,
    };
  }, [series, economicParams]);
  
  const calculateForecast = useMemo(() => {
    if (!series?.production || series.production.length < 3) return null;
    
    const recentProduction = series.production.slice(-3);
    const avgProduction = recentProduction.reduce((a, b) => a + b, 0) / recentProduction.length;
    
    const daysToForecast = forecastPeriod === 'monthly' ? 30 : forecastPeriod === 'annual' ? 365 : customForecastDays;
    
    let totalIncome = 0;
    let totalSaving = 0;
    
    for (let day = 1; day <= daysToForecast; day++) {
      const trendFactor = Math.pow(1 + (economicParams.forecastTrend / 100), day);
      const forecastProduction = avgProduction * trendFactor;
      
      const selfConsumption = forecastProduction * (economicParams.selfConsumptionRate / 100);
      const exported = forecastProduction - selfConsumption;
      
      totalIncome += exported * economicParams.sellingPrice;
      totalSaving += selfConsumption * economicParams.gridPrice;
    }
    
    return {
      income: totalIncome,
      saving: totalSaving,
      total: totalIncome + totalSaving,
      days: daysToForecast,
    };
  }, [series, economicParams, forecastPeriod, customForecastDays]);

  const liveStats = useMemo(() => {
    if (!series?.power || !series.voltage || !series.timestamps) return null;
    
    const powerCur = series.power[series.power.length-1];
    const voltageCur = series.voltage[series.voltage.length-1];
    const currentCur = series.current ? series.current[series.current.length-1] : 0;
    const efficiencyCur = series.efficiency ? series.efficiency[series.efficiency.length-1] : 0;
    
    return { powerCur, voltageCur, currentCur, efficiencyCur };
  }, [series]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const el = centerColRef.current;
    if (!el) return;
    const updateWidth = () => setChartWidth(Math.max(320, el.clientWidth - 32));
    updateWidth();
    const ro = new ResizeObserver(() => updateWidth());
    ro.observe(el);
    return () => ro.disconnect();
  }, [centerColRef]);

  const KPICard: React.FC<{ label: string; value: number; unit: string; color?: string; icon?: string }> = ({ label, value, unit, color = '#22c55e', icon }) => {
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-gray-400 uppercase tracking-wide">{label}</div>
          {icon && <span className="text-lg">{icon}</span>}
        </div>
        <div className="text-2xl font-bold" style={{ color }}>
          {value.toFixed(unit === '€' ? 2 : unit === '%' ? 1 : 1)}
          <span className="text-sm ml-1 text-gray-400">{unit}</span>
        </div>
      </div>
    );
  };

  const ScaleSwitch: React.FC<{
    currentScale: "D" | "W" | "M" | "Y";
    setScale: (scale: "D" | "W" | "M" | "Y") => void;
  }> = ({ currentScale, setScale }) => (
    <div className="flex items-center gap-1">
      {(["D","W","M","Y"] as const).map((k) => (
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


  const EconomicChart: React.FC<{ 
    mode: 'production'|'distribution'|'grid'|'economic'; 
    title: string; 
    width: number; 
    height: number; 
    data: DailySeries | null; 
    scale: "D" | "W" | "M" | "Y";
    kpis: KPIData | null;
  }> = ({ mode, title, width, height, data, scale, kpis }) => {
    const [hoverX, setHoverX] = useState<number | null>(null);
    const [hoverIndex, setHoverIndex] = useState<number | null>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    
    if (!data?.timestamps?.length || !data.production) {
      return <div className="flex items-center justify-center h-full min-h-[120px] text-sm text-gray-500">No data</div>;
    }
    
    const w = Math.max(320, width);
    const h = Math.max(120, height);
    const l = 48; const r = 12; const t = 20; const b = 30;
    
    const xs = data.timestamps.map(d=>d.getTime());
    const xMin = xs[0]; const xMax = xs[xs.length-1];
    
    let series1: number[] = [];
    let series2: number[] = [];
    let label1 = '';
    let label2 = '';
    let color1 = '#10b981';
    let color2 = '#ef4444';
    
    if (mode === 'production') {
      series1 = data.production;
      label1 = 'Production (kWh)';
      color1 = '#fbbf24';
    } else if (mode === 'distribution' && kpis) {
      series1 = data.production.map(p => p * (economicParams.selfConsumptionRate / 100));
      series2 = data.production.map(p => p * (1 - economicParams.selfConsumptionRate / 100));
      label1 = 'Self-Consumption';
      label2 = 'Exported';
      color1 = '#10b981';
      color2 = '#ef4444';
    } else if (mode === 'grid' && kpis) {
      series1 = data.production.map(() => Math.max(0, economicParams.avgDailyLoad / data.production.length));
      series2 = data.production.map(p => p * (economicParams.selfConsumptionRate / 100));
      label1 = 'Grid Draw';
      label2 = 'Self-Consumption';
      color1 = '#6b7280';
      color2 = '#3b82f6';
    } else if (mode === 'economic' && kpis) {
      series1 = data.production.map(p => (p * (1 - economicParams.selfConsumptionRate / 100) * economicParams.sellingPrice));
      series2 = data.production.map(p => (p * (economicParams.selfConsumptionRate / 100) * economicParams.gridPrice));
      label1 = 'Income';
      label2 = 'Saving';
      color1 = '#a855f7';
      color2 = '#38bdf8';
    }
    
    const allValues = [...series1, ...series2].filter(v => v > 0);
    const yMin = 0;
    const yMax = allValues.length > 0 ? Math.max(...allValues) * 1.15 : 10;
    const span = yMax - yMin || 1;
    const innerW = w - l - r; 
    const innerH = h - t - b;
    
    const mapPoint = (time:number,val:number)=>{ 
      const x = l + (innerW * (time - xMin)/(xMax - xMin || 1)); 
      const y = t + innerH * (1 - (val - yMin)/span); 
      return {x,y}; 
    };
    
    const pathFor = (arr:number[]) => arr.map((v,i)=>{const p=mapPoint(xs[i],v);return `${i===0?'M':'L'}${p.x},${p.y}`}).join(' ');
    const path1 = series1.length > 0 ? pathFor(series1) : '';
    const path2 = series2.length > 0 ? pathFor(series2) : '';
    
    const areaPath1 = mode === 'economic' && series1.length > 0 
      ? path1 + ` L${l + innerW},${t + innerH} L${l},${t + innerH} Z`
      : '';
    const areaPath2 = mode === 'economic' && series2.length > 0
      ? path2 + ` L${l + innerW},${t + innerH} L${l},${t + innerH} Z`
      : '';
    
    let xLabels: { position: number; label: string }[] = [];
    
    switch (scale) {
      case "D":
        for (let hour = 0; hour <= 24; hour += 3) {
          const timeInMs = new Date(xs[0]).setHours(hour, 0, 0, 0);
          if (timeInMs < xs[0] || timeInMs > xs[xs.length - 1]) continue;
          const timePos = (timeInMs - xMin) / (xMax - xMin);
          const x = l + innerW * timePos;
          xLabels.push({ position: x, label: `${hour.toString().padStart(2,'0')}:00` });
        }
        break;
      case "W":
        const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
        for (let i = 0; i < 7; i++) {
          const timePos = i / 6;
          const x = l + innerW * timePos;
          xLabels.push({ position: x, label: weekDays[i] });
        }
        break;
      case "M":
        for (let day = 1; day <= 31; day += 5) {
          const timePos = (day - 1) / 30;
          const x = l + innerW * timePos;
          xLabels.push({ position: x, label: day.toString() });
        }
        break;
      case "Y":
        const monthAbbrevs = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
        for (let month = 0; month < 12; month++) {
          const timePos = month / 11;
          const x = l + innerW * timePos;
          xLabels.push({ position: x, label: monthAbbrevs[month] });
        }
        break;
    }
    
    const yTicks = Array.from({length:6}).map((_,i)=> Math.round((yMin + (span)*i/5) * 10) / 10);
    
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
      
      const snapX = mapPoint(xs[closestIdx], series1[closestIdx] || 0).x;
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
        className="absolute inset-0 w-full h-full"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <rect x={0} y={0} width={w} height={h} fill="#0a0a0a" />
        <rect x={l} y={t} width={innerW} height={innerH} fill="#000000" stroke="#1f2937" />
        {yTicks.map((v,i)=>{
          const y=t+innerH*(1 - (v-yMin)/span);
          const displayValue = mode === 'economic' ? `€${v.toFixed(1)}` : v.toFixed(1);
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
        {mode === 'economic' && areaPath1 && <path d={areaPath1} fill={color1} fillOpacity={0.3} />}
        {mode === 'economic' && areaPath2 && <path d={areaPath2} fill={color2} fillOpacity={0.3} />}
        {path1 && <path d={path1} fill="none" stroke={color1} strokeWidth={2.5} />}
        {path2 && mode !== 'production' && <path d={path2} fill="none" stroke={color2} strokeWidth={2} strokeDasharray={mode === 'distribution' || mode === 'grid' ? '5 5' : '0'} />}
        
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
              height={series2.length > 0 ? 70 : 50} 
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
              {new Date(xs[hoverIndex]).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </text>
            
            <circle cx={hoverX > l + innerW / 2 ? hoverX - 110 : hoverX + 30} cy={t + 42} r={3} fill={color1} />
            <text x={hoverX > l + innerW / 2 ? hoverX - 100 : hoverX + 40} y={t + 45} fontSize={10} fill="#f3f4f6" fontWeight="600">
              {label1}: {series1[hoverIndex].toFixed(2)}
            </text>
            
            {series2.length > 0 && (
              <>
                <circle cx={hoverX > l + innerW / 2 ? hoverX - 110 : hoverX + 30} cy={t + 60} r={3} fill={color2} />
                <text x={hoverX > l + innerW / 2 ? hoverX - 100 : hoverX + 40} y={t + 63} fontSize={10} fill="#f3f4f6" fontWeight="600">
                  {label2}: {series2[hoverIndex].toFixed(2)}
                </text>
              </>
            )}
            
            <circle cx={hoverX} cy={mapPoint(xs[hoverIndex], series1[hoverIndex]).y} r={4} fill={color1} stroke="#1f2937" strokeWidth={2} />
            {series2.length > 0 && (
              <circle cx={hoverX} cy={mapPoint(xs[hoverIndex], series2[hoverIndex]).y} r={4} fill={color2} stroke="#1f2937" strokeWidth={2} />
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
            <h3 className="text-lg font-bold text-white">Photovoltaic System Dashboard</h3>
            <div className="text-xs text-gray-300 flex items-center gap-2">
              <div><span className="text-gray-400">System:</span> <span className="font-semibold text-white">{sensor.name}</span></div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
            <button
              onClick={() => setShowSettings(true)}
              className="px-3 py-1.5 rounded-lg bg-gray-800/70 border border-gray-700 text-xs text-gray-100 hover:bg-gray-700/60 transition flex items-center gap-2"
              title="Settings"
            >
              ⚙️ Settings
            </button>
            <button
              onClick={()=>{ const el=dateInputEl.current as any; if(el?.showPicker) el.showPicker(); else el?.click(); }}
              className="px-2 md:px-3 py-1 md:py-1.5 rounded-lg bg-gray-800/70 border border-gray-700 text-xs md:text-sm text-gray-100 hover:bg-gray-700/60 transition flex items-center gap-1 md:gap-2"
              title="Pick date"
            >
              <span className="hidden sm:inline">{formatDate(date)}</span>
              <span className="inline sm:hidden text-[10px]">{date.getDate()}/{date.getMonth()+1}</span>
              <span className="inline-block w-3 h-3 md:w-4 md:h-4 text-gray-300">📅</span>
            </button>
            <input ref={dateInputEl} type="date" max={todayYmd} className="absolute w-0 h-0 opacity-0 pointer-events-none" value={dateInputValue} onChange={e=>{ const d=new Date(e.target.value+ 'T00:00:00'); const today=new Date(); today.setHours(0,0,0,0); if(!isNaN(d.getTime())) setDate(d>today? today : d); }} />
            <ScaleSwitch currentScale={viewScale} setScale={setViewScale} />
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
        {/* LEFT COLUMN - 8 KPI Indicators */}
        <div className="col-span-1 md:col-span-3 flex flex-col h-auto md:h-full space-y-2 min-h-0 overflow-y-auto">
          <div className="grid grid-cols-2 gap-2">
            {calculateKPIs && (
              <>
                <KPICard label="Yield Energy" value={calculateKPIs.yieldEnergy} unit="kWh" color="#fbbf24" icon="⚡" />
                <KPICard label="Efficiency" value={calculateKPIs.efficiency} unit="%" color="#22c55e" icon="🎯" />
                <KPICard label="Self-Use Rate" value={calculateKPIs.directSelfUseRate} unit="%" color="#10b981" icon="🏠" />
                <KPICard label="Exported" value={calculateKPIs.exportedEnergy} unit="kWh" color="#ef4444" icon="⬆️" />
                <KPICard label="Grid Draw" value={calculateKPIs.gridConsumption} unit="kWh" color="#6b7280" icon="⬇️" />
                <KPICard label="Income" value={calculateKPIs.income} unit="€" color="#a855f7" icon="💰" />
                <KPICard label="Saving" value={calculateKPIs.saving} unit="€" color="#38bdf8" icon="💵" />
                <KPICard label="Net Bill" value={calculateKPIs.bill} unit="€" color={calculateKPIs.bill < 0 ? '#22c55e' : '#ef4444'} icon="📊" />
              </>
            )}
          </div>
        </div>

        {/* CENTER COLUMN - 4 Main Charts */}
        <div ref={centerColRef} className="col-span-1 md:col-span-6 flex flex-col h-auto md:h-full min-w-0 overflow-hidden">
          <div className="flex-1 flex flex-col gap-1.5 md:gap-2 min-h-0">
            <div className="flex-1 flex flex-col min-h-[180px] md:min-h-0 bg-gray-900 border border-gray-700 rounded-xl p-2 md:p-3 overflow-hidden">
              <div className="flex items-center justify-between mb-1.5 md:mb-2 flex-shrink-0">
                <div className="text-xs md:text-sm font-semibold text-white">📈 {viewScale === 'D' ? 'Daily' : viewScale === 'W' ? 'Weekly' : viewScale === 'M' ? 'Monthly' : 'Annual'} Production</div>
              </div>
              <div className="flex-1 min-h-0 relative">
                <EconomicChart mode="production" title="Production" width={chartWidth} height={chartHeight} data={series} scale={viewScale} kpis={calculateKPIs} />
              </div>
            </div>

            <div className="flex-1 flex flex-col min-h-[180px] md:min-h-0 bg-gray-900 border border-gray-700 rounded-xl p-2 md:p-3 overflow-hidden">
              <div className="flex items-center justify-between mb-1.5 md:mb-2 flex-shrink-0">
                <div className="text-xs md:text-sm font-semibold text-white">🔄 Energy Distribution</div>
              </div>
              <div className="flex-1 min-h-0 relative">
                <EconomicChart mode="distribution" title="Distribution" width={chartWidth} height={chartHeight} data={series} scale={viewScale} kpis={calculateKPIs} />
              </div>
            </div>

            <div className="flex-1 flex flex-col min-h-[180px] md:min-h-0 bg-gray-900 border border-gray-700 rounded-xl p-2 md:p-3 overflow-hidden">
              <div className="flex items-center justify-between mb-1.5 md:mb-2 flex-shrink-0">
                <div className="text-xs md:text-sm font-semibold text-white">⚡ Grid vs Self-Consumption</div>
              </div>
              <div className="flex-1 min-h-0 relative">
                <EconomicChart mode="grid" title="Grid" width={chartWidth} height={chartHeight} data={series} scale={viewScale} kpis={calculateKPIs} />
              </div>
            </div>

            <div className="flex-1 flex flex-col min-h-[180px] md:min-h-0 bg-gray-900 border border-gray-700 rounded-xl p-2 md:p-3 overflow-hidden">
              <div className="flex items-center justify-between mb-1.5 md:mb-2 flex-shrink-0">
                <div className="text-xs md:text-sm font-semibold text-white">💰 Economic Trend</div>
              </div>
              <div className="flex-1 min-h-0 relative">
                <EconomicChart mode="economic" title="Economic" width={chartWidth} height={chartHeight} data={series} scale={viewScale} kpis={calculateKPIs} />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN - Economic Forecast Panel */}
        <div className="col-span-1 md:col-span-3 flex flex-col h-auto md:h-full gap-2 md:gap-3 min-h-0">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 flex-shrink-0">
            <div className="text-sm font-semibold text-white mb-3">🔮 Economic Forecast</div>
            
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setForecastPeriod('monthly')}
                className={`flex-1 px-2 py-1 rounded text-xs font-semibold transition ${
                  forecastPeriod === 'monthly'
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setForecastPeriod('annual')}
                className={`flex-1 px-2 py-1 rounded text-xs font-semibold transition ${
                  forecastPeriod === 'annual'
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
                }`}
              >
                Annual
              </button>
              <button
                onClick={() => setForecastPeriod('custom')}
                className={`flex-1 px-2 py-1 rounded text-xs font-semibold transition ${
                  forecastPeriod === 'custom'
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
                }`}
              >
                Custom
              </button>
            </div>
            
            {forecastPeriod === 'custom' && (
              <div className="mb-3">
                <label className="text-xs text-gray-400 block mb-1">Days to forecast:</label>
                <input
                  type="number"
                  min="1"
                  max="730"
                  value={customForecastDays}
                  onChange={(e) => setCustomForecastDays(Number(e.target.value))}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-sm"
                />
              </div>
            )}
            
            {calculateForecast && (
              <div className="space-y-3">
                <div className="bg-purple-900/20 border border-purple-700 rounded-lg p-3">
                  <div className="text-xs text-purple-400 mb-1">Income</div>
                  <div className="text-2xl font-bold text-purple-300">€{calculateForecast.income.toFixed(2)}</div>
                  <div className="text-xs text-gray-400 mt-1">{calculateForecast.days} days</div>
                </div>
                
                <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-3">
                  <div className="text-xs text-blue-400 mb-1">Saving</div>
                  <div className="text-2xl font-bold text-blue-300">€{calculateForecast.saving.toFixed(2)}</div>
                  <div className="text-xs text-gray-400 mt-1">{calculateForecast.days} days</div>
                </div>
                
                <div className="bg-green-900/20 border border-green-700 rounded-lg p-3">
                  <div className="text-xs text-green-400 mb-1">Total Benefit</div>
                  <div className="text-2xl font-bold text-green-300">€{calculateForecast.total.toFixed(2)}</div>
                  <div className="text-xs text-gray-400 mt-1">{calculateForecast.days} days</div>
                </div>
              </div>
            )}
          </div>
          
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 flex-shrink-0">
            <div className="text-sm font-semibold text-white mb-2">⚡ Current Status</div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Power:</span>
                <span className="text-white font-semibold">{liveStats?.powerCur.toFixed(1) || '0.0'} kW</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Voltage:</span>
                <span className="text-white font-semibold">{liveStats?.voltageCur.toFixed(0) || '0'} V</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Efficiency:</span>
                <span className="text-white font-semibold">{liveStats?.efficiencyCur.toFixed(1) || '0.0'}%</span>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 flex-1 overflow-auto">
            <div className="text-sm font-semibold text-white mb-2">📊 System Parameters</div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">Self-Consumption:</span>
                <span className="text-white font-semibold">{economicParams.selfConsumptionRate}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Daily Load:</span>
                <span className="text-white font-semibold">{economicParams.avgDailyLoad} kWh</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Grid Price:</span>
                <span className="text-white font-semibold">€{economicParams.gridPrice.toFixed(2)}/kWh</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Sell Price:</span>
                <span className="text-white font-semibold">€{economicParams.sellingPrice.toFixed(2)}/kWh</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Forecast Trend:</span>
                <span className="text-white font-semibold">{economicParams.forecastTrend > 0 ? '+' : ''}{economicParams.forecastTrend}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {showSettings && <SettingsPanel economicParams={economicParams} setEconomicParams={setEconomicParams} onClose={() => setShowSettings(false)} />}
      {loading && (<div className="absolute inset-0 flex items-center justify-center bg-gray-900/50"><div className="text-sm text-gray-300">Loading data…</div></div>)}
      {error && (<div className="absolute top-16 left-1/2 -translate-x-1/2 bg-red-600/90 text-white text-xs px-3 py-2 rounded-md shadow">{error}</div>)}
    </div>
  );
}
