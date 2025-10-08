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
  timestamps: Date[];       // Time points
  production: number[];     // Daily energy production (kWh) - PRIMARY INPUT
  power?: number[];         // Instantaneous power (kW) - for live display only
  voltage?: number[];       // For live display only
  current?: number[];       // For live display only
  efficiency?: number[];    // Calculated efficiency
  energy?: number[];        // Cumulative energy
};

type EconomicParams = {
  selfConsumptionRate: number;  // Direct self-consumption rate (%)
  avgDailyLoad: number;          // Average daily household load (kWh)
  gridPrice: number;             // Grid electricity price (€/kWh)
  sellingPrice: number;          // Energy selling price (€/kWh)
  forecastTrend: number;         // Forecast trend (%)
  panelSurface?: number;         // Total surface of PV panels (m²) - optional
  dailyIrradiance?: number;      // Average daily irradiance (kWh/m²) - optional
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
  const [panelSurfaceText, setPanelSurfaceText] = React.useState(economicParams.panelSurface ? String(economicParams.panelSurface) : '');
  const [irradianceText, setIrradianceText] = React.useState(economicParams.dailyIrradiance ? String(economicParams.dailyIrradiance) : '');
  
  return (
  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[3000] flex items-center justify-center" onClick={onClose}>
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 max-w-md w-full m-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          
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
                // Average daily load must be ≥ 0 as per specification
                setEconomicParams({ ...economicParams, avgDailyLoad: isNaN(num) ? 0 : Math.max(0, num) });
              }}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
              placeholder="e.g. 15 (min: 0)"
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
                    // Grid price must be > 0 as per specification
                    setEconomicParams({ ...economicParams, gridPrice: Math.max(0.01, num) });
                  }
                }
              }}
              onBlur={() => {
                // On blur, sync with actual value
                setGridPriceText(String(economicParams.gridPrice));
              }}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
              placeholder="e.g. 0.25 (min: 0.01)"
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
                    // Selling price must be ≥ 0 as per specification
                    setEconomicParams({ ...economicParams, sellingPrice: Math.max(0, num) });
                  }
                }
              }}
              onBlur={() => {
                // On blur, sync with actual value
                setSellingPriceText(String(economicParams.sellingPrice));
              }}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
              placeholder="e.g. 0.10 (min: 0)"
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
                // Clamp trend to -20% → +20% as per specification
                setEconomicParams({ ...economicParams, forecastTrend: isNaN(num) ? 0 : Math.min(20, Math.max(-20, num)) });
              }}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
              placeholder="e.g. 2 (range: -20 to +20)"
            />
          </div>
        </div>
        
        {/* Optional Parameters */}
        <div className="mt-4 pt-4 border-t border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Optional Parameters</h4>
            <span className="text-[10px] text-gray-500">For efficiency calculation</span>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-300 block mb-1">
                Panel Surface (m²)
                <span className="text-gray-500 ml-1">*</span>
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={panelSurfaceText}
                onChange={(e) => {
                  const val = e.target.value.replace(',', '.');
                  // Allow typing decimal values
                  if (val === '' || /^[0-9]*\.?[0-9]*$/.test(val)) {
                    setPanelSurfaceText(val);
                    const num = parseFloat(val);
                    if (!isNaN(num)) {
                      setEconomicParams({ ...economicParams, panelSurface: num });
                    } else if (val === '') {
                      setEconomicParams({ ...economicParams, panelSurface: undefined });
                    }
                  }
                }}
                onBlur={() => {
                  // On blur, sync with actual value or clear if empty
                  if (economicParams.panelSurface !== undefined) {
                    setPanelSurfaceText(String(economicParams.panelSurface));
                  } else {
                    setPanelSurfaceText('');
                  }
                }}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
                placeholder="e.g. 50"
              />
            </div>
            <div>
              <label className="text-xs text-gray-300 block mb-1">
                Daily Irradiance (kWh/m²)
                <span className="text-gray-500 ml-1">*</span>
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={irradianceText}
                onChange={(e) => {
                  const val = e.target.value.replace(',', '.');
                  // Allow typing decimal values
                  if (val === '' || /^[0-9]*\.?[0-9]*$/.test(val)) {
                    setIrradianceText(val);
                    const num = parseFloat(val);
                    if (!isNaN(num)) {
                      setEconomicParams({ ...economicParams, dailyIrradiance: num });
                    } else if (val === '') {
                      setEconomicParams({ ...economicParams, dailyIrradiance: undefined });
                    }
                  }
                }}
                onBlur={() => {
                  // On blur, sync with actual value or clear if empty
                  if (economicParams.dailyIrradiance !== undefined) {
                    setIrradianceText(String(economicParams.dailyIrradiance));
                  } else {
                    setIrradianceText('');
                  }
                }}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
                placeholder="e.g. 4.5"
              />
            </div>
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
  const [loading, setLoading] = useState(true); // Start as true for initial load
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<Date>(() => new Date());
  const centerColRef = useRef<HTMLDivElement | null>(null);
  const [chartWidth, setChartWidth] = useState<number>(800);
  const [chartHeight, setChartHeight] = useState<number>(200);
  const dateInputEl = useRef<HTMLInputElement | null>(null);
  const [hasReceivedValidData, setHasReceivedValidData] = useState(false);
  const initialLoadRef = useRef(true);
  
  const [showSettings, setShowSettings] = useState(false);
  const [forecastPeriod, setForecastPeriod] = useState<ForecastPeriod>('monthly');
  const [customForecastDays, setCustomForecastDays] = useState(90);
  
  // Load economic parameters from LocalStorage or use defaults
  const [economicParams, setEconomicParams] = useState<EconomicParams>(() => {
    // Try to load from localStorage
    if (typeof window !== 'undefined') {
      try {
        const savedParams = localStorage.getItem(`pv-params-${sensor.id}`);
        if (savedParams) {
          const parsed = JSON.parse(savedParams);
          console.log('[PV Dashboard] Loaded saved parameters from LocalStorage:', parsed);
          return parsed;
        }
      } catch (e) {
        console.warn('[PV Dashboard] Failed to load saved parameters:', e);
      }
    }
    
    // Default values if no saved data
    return {
      selfConsumptionRate: 70,   // 70% self-consumption
      avgDailyLoad: 15,          // 15 kWh daily load
      gridPrice: 0.25,           // €0.25/kWh grid price
      sellingPrice: 0.10,        // €0.10/kWh selling price
      forecastTrend: 0,          // 0% trend (no growth/decrease)
      panelSurface: 50,          // 50 m² panel surface (optional)
      dailyIrradiance: 4.5,      // 4.5 kWh/m²/day irradiance (optional)
    };
  });
  
  // Save economic parameters to LocalStorage whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`pv-params-${sensor.id}`, JSON.stringify(economicParams));
        console.log('[PV Dashboard] Saved parameters to LocalStorage:', economicParams);
      } catch (e) {
        console.warn('[PV Dashboard] Failed to save parameters:', e);
      }
    }
  }, [economicParams, sensor.id]);

  // KPIs are computed for current day only; this keeps D/W/M/Y controls exclusive to charts.
  const periodDays = 1;

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

  // Extract current production from sensor.value (format: "13.02 kWh")
  // Returns null only on very first load if sensor value is invalid
  const getCurrentProduction = (): number | null => {
    try {
      console.log('[PV Dashboard] Parsing sensor value:', sensor.value);
      
      // Check if sensor value contains "kWh" format
      const match = sensor.value.match(/([0-9.]+)\s*kWh/);
      if (match && match[1]) {
        const production = parseFloat(match[1]);
        
        // Only return null on initial load if value is truly invalid
        if (isNaN(production)) {
          console.log('[PV Dashboard] Invalid sensor value (NaN)');
          return initialLoadRef.current ? null : 0;
        }
        
        console.log('[PV Dashboard] Extracted production:', production, 'kWh');
        return production;
      }
    } catch (e) {
      console.warn('[PV Dashboard] Failed to parse sensor value:', sensor.value);
    }
    
    // Return null only on first load, otherwise return 0
    console.warn('[PV Dashboard] Could not parse sensor value');
    return initialLoadRef.current ? null : 0;
  };

  const generatePVMockData = (start: Date, end: Date, resolution: number, scale: "D" | "W" | "M" | "Y" = "D", currentProduction?: number): DailySeries => {
    const timestamps: Date[] = [];
    const production: number[] = [];
    
    const duration = end.getTime() - start.getTime();
    const interval = duration / resolution;
    const today = new Date();
    const isToday = start.getDate() === today.getDate() && 
                    start.getMonth() === today.getMonth() && 
                    start.getFullYear() === today.getFullYear();
    
    for (let i = 0; i <= resolution; i++) {
      const timestamp = new Date(start.getTime() + i * interval);
      timestamps.push(timestamp);
      
      const dayOfYear = Math.floor((timestamp.getTime() - new Date(timestamp.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
      const seasonalFactor = 0.7 + 0.3 * Math.sin((dayOfYear / 365) * 2 * Math.PI - Math.PI / 2);
      
      let dailyProduction = 0; // Daily energy production in kWh - PRIMARY INPUT
      
      // Use real sensor value for today's last data point
      if (isToday && scale === "D" && i === resolution && currentProduction !== undefined) {
        dailyProduction = currentProduction;
        console.log(`[PV Dashboard] Using real sensor value: ${dailyProduction} kWh`);
      } else if (scale === "D") {
        // For daily view, spread production across hours (simulation only)
        const hour = timestamp.getHours() + timestamp.getMinutes() / 60;
        if (hour >= 6 && hour <= 18) {
          const solarPosition = (hour - 6) / 12;
          const bellCurve = Math.sin(solarPosition * Math.PI);
          // Scale historical hourly data proportionally to current production if available
          const baseHourly = bellCurve * (1.5 + Math.random() * 0.5) * seasonalFactor;
          if (isToday && currentProduction !== undefined) {
            // Scale historical hours to match current cumulative production
            dailyProduction = baseHourly * (currentProduction / 25); // Assume ~25 kWh daily capacity
          } else {
            dailyProduction = baseHourly;
          }
        }
      } else {
        // Daily/Weekly/Monthly/Yearly: Total daily production
        dailyProduction = (20 + Math.random() * 10) * seasonalFactor; // 20-30 kWh per day
      }
      
      production.push(parseFloat(dailyProduction.toFixed(2)));
    }
    
    return { timestamps, production };
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
      
      // Extract current production from sensor value for today's data
      const currentProduction = isSameDay ? getCurrentProduction() : undefined;
      
      // Only block on very first load if data is completely invalid (null)
      if (isSameDay && currentProduction === null && initialLoadRef.current) {
        console.log('[PV Dashboard] Initial load: Waiting for valid sensor data...');
        return; // Don't update series yet, keep loading spinner
      }
      
      const mockData = generatePVMockData(start, end, resolution, scale, currentProduction ?? undefined);
      setter(mockData);
      setError(null);
      
      // Mark that we've received valid data on first successful load
      if (isSameDay && currentProduction !== null && initialLoadRef.current) {
        console.log('[PV Dashboard] First valid data received, clearing initial load flag');
        setHasReceivedValidData(true);
        initialLoadRef.current = false;
      }
    } catch (e:any) {
      setError(e?.message || 'Failed to load data');
      setter(null);
    }
  };

  useEffect(() => {
    // Load daily series for KPIs and Live Status; chart series are computed per-chart below
    console.log('[PV Dashboard] useEffect triggered - sensor.value:', sensor.value, 'sensor.id:', sensor.id);
    
    const today = new Date();
    const isToday = date.getDate() === today.getDate() && 
                    date.getMonth() === today.getMonth() && 
                    date.getFullYear() === today.getFullYear();
    
    // Only validate on very first mount
    if (isToday && initialLoadRef.current) {
      const currentProd = getCurrentProduction();
      if (currentProd === null) {
        // Still waiting for valid sensor data on first load
        console.log('[PV Dashboard] Initial mount: waiting for valid data');
        setLoading(true);
        return;
      } else {
        // First valid data received
        console.log('[PV Dashboard] Initial mount: valid data received, clearing flag');
        initialLoadRef.current = false;
        setHasReceivedValidData(true);
      }
    }
    
    // Load data
    setLoading(true);
    loadForSensor(sensor, setSeries, date, 'D').finally(() => setLoading(false));
  }, [sensor.id, sensor.value, date, projectId]); // Removed hasReceivedValidData to prevent loops

  // Helper to compute series for a given scale (per-chart)
  const computeSeriesFor = React.useCallback((scale: "D" | "W" | "M" | "Y") => {
    const baseDate = date;
    let start = new Date(baseDate);
    let end = new Date(baseDate);
    let resolution = 96;
    switch (scale) {
      case 'D':
        start.setHours(0,0,0,0);
        end.setHours(23,59,59,999);
        resolution = 96;
        break;
      case 'W':
        const dayOfWeek = start.getDay();
        start.setDate(start.getDate() - dayOfWeek);
        start.setHours(0,0,0,0);
        end = new Date(start);
        end.setDate(end.getDate() + 6);
        end.setHours(23,59,59,999);
        resolution = 7;
        break;
      case 'M':
        start.setDate(1);
        start.setHours(0,0,0,0);
        end = new Date(start);
        end.setMonth(end.getMonth() + 1);
        end.setDate(0);
        end.setHours(23,59,59,999);
        resolution = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
        break;
      case 'Y':
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
    const isSameDay = start.getFullYear()===today.getFullYear() && start.getMonth()===today.getMonth() && start.getDate()===today.getDate() && scale === 'D';
    if (isSameDay) end = new Date();
    
    // Extract current production from sensor value for today's data
    const currentProduction = isSameDay ? getCurrentProduction() : undefined;
    
    return generatePVMockData(start, end, resolution, scale, currentProduction ?? undefined);
  }, [date, sensor.value]); // Added sensor.value to re-compute when sensor updates

  // Per-chart scale state
  const [prodScale, setProdScale] = useState<"D" | "W" | "M" | "Y">('D');
  const [distScale, setDistScale] = useState<"D" | "W" | "M" | "Y">('D');
  const [gridScale, setGridScale] = useState<"D" | "W" | "M" | "Y">('D');
  const [econScale, setEconScale] = useState<"D" | "W" | "M" | "Y">('D');

  // Per-chart data
  const prodSeries = useMemo(() => computeSeriesFor(prodScale), [computeSeriesFor, prodScale]);
  const distSeries = useMemo(() => computeSeriesFor(distScale), [computeSeriesFor, distScale]);
  const gridSeries = useMemo(() => computeSeriesFor(gridScale), [computeSeriesFor, gridScale]);
  const econSeries = useMemo(() => computeSeriesFor(econScale), [computeSeriesFor, econScale]);

  const calculateKPIs = useMemo((): KPIData | null => {
    if (!series?.production || series.production.length === 0) return null;
    
    // 1. Yield Energy = sum of daily production (kWh)
    const yieldEnergy = series.production.reduce((sum, val) => sum + val, 0);
    
    // 2. Efficiency = (Production / (Irradiance × Area)) × 100
    // Only calculate if panel surface and irradiance are available
    let avgEfficiency = 0;
    if (economicParams.panelSurface && economicParams.dailyIrradiance) {
      const theoreticalMax = economicParams.dailyIrradiance * economicParams.panelSurface;
      avgEfficiency = theoreticalMax > 0 ? (yieldEnergy / theoreticalMax) * 100 : 0;
    }
    
    // 3. Self-Use = Production × self-consumption rate
    const selfConsumption = yieldEnergy * (economicParams.selfConsumptionRate / 100);
    
    // 4. Exported = Production − Self-Use
    const exportedEnergy = yieldEnergy - selfConsumption;
    
    // 5. Direct Self-Use Rate = (Self-Use / Production) × 100
    // Calculate actual rate from data as per client specification
    const directSelfUseRate = yieldEnergy > 0 ? (selfConsumption / yieldEnergy) * 100 : 0;
    
    // 6. Grid Consumption = max(0, Daily Load − Self-Use)
    const totalLoadForPeriod = economicParams.avgDailyLoad * periodDays;
    const gridConsumption = Math.max(0, totalLoadForPeriod - selfConsumption);
    
    // 7. Income = Exported × Selling price
    const income = exportedEnergy * economicParams.sellingPrice;
    
    // 8. Saving = Self-Use × Grid price
    const saving = selfConsumption * economicParams.gridPrice;
    
    // 9. Bill = (Grid × Grid price) − Income
    const bill = (gridConsumption * economicParams.gridPrice) - income;
    
    return {
      yieldEnergy,
      efficiency: avgEfficiency,
      directSelfUseRate,
      exportedEnergy,
      gridConsumption,
      income,
      saving,
      bill,
    };
  }, [series, economicParams, periodDays]);
  
  const calculateForecast = useMemo(() => {
    if (!series?.production || series.production.length < 3) return null;
    
    // 3-day moving average as base (per specification)
    const recentProduction = series.production.slice(-3);
    const avgDailyProduction = recentProduction.reduce((a, b) => a + b, 0) / recentProduction.length;
    
    const daysToForecast = forecastPeriod === 'monthly' ? 30 : forecastPeriod === 'annual' ? 365 : customForecastDays;
    
    let totalIncome = 0;
    let totalSaving = 0;
    
    // For each future day, apply trend adjustment
    for (let day = 1; day <= daysToForecast; day++) {
      // Estimated Production = Average(last 3 days) × (1 + trend)^day
      const trendFactor = Math.pow(1 + (economicParams.forecastTrend / 100), day);
      const forecastProduction = avgDailyProduction * trendFactor;
      
      // Estimated Self-Use = Estimated Production × self-consumption rate
      const selfConsumption = forecastProduction * (economicParams.selfConsumptionRate / 100);
      
      // Estimated Exported = Estimated Production − Self-Use
      const exported = forecastProduction - selfConsumption;
      
      // Estimated Income = Exported × selling price
      totalIncome += exported * economicParams.sellingPrice;
      
      // Estimated Saving = Self-Use × grid price
      totalSaving += selfConsumption * economicParams.gridPrice;
    }
    
    // Estimated Total = Income + Saving
    return {
      income: totalIncome,
      saving: totalSaving,
      total: totalIncome + totalSaving,
      days: daysToForecast,
    };
  }, [series, economicParams, forecastPeriod, customForecastDays]);

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

  const KPICard: React.FC<{ label: string; value: number | undefined; unit: string; color?: string; showGauge?: boolean; gaugeMin?: number; gaugeMax?: number; trend?: 'up' | 'down' | 'neutral' }> = ({ label, value, unit, color = '#22c55e', showGauge = false, gaugeMin = 0, gaugeMax = 100, trend = 'neutral' }) => {
    const v = value ?? 0;
    const pct = showGauge ? Math.max(0, Math.min(1, (v - gaugeMin) / (gaugeMax - gaugeMin || 1))) : 0;
    
    // Check if value is undefined (not available)
    const isValueUnavailable = value === undefined;
    
    // Check if this is Yield Energy (kWh unit with longer value)
    const isYieldEnergy = unit === 'kWh';
    
    return (
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700/50 rounded-xl p-2.5 sm:p-3 md:p-4 flex flex-col justify-between h-full hover:border-gray-600 transition-all duration-300 group overflow-hidden">
        <div className="flex items-center justify-between mb-2 sm:mb-2.5 md:mb-3 flex-shrink-0">
          <div className="text-[9px] sm:text-[10px] md:text-[11px] text-gray-400 uppercase tracking-wider font-semibold truncate pr-1">{label}</div>
          {trend !== 'neutral' && !isValueUnavailable && (
            <div className={`text-[10px] sm:text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${
              trend === 'up' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
            }`}>
              {trend === 'up' ? '↑' : '↓'}
            </div>
          )}
        </div>
        
        <div className="flex-1 flex flex-col justify-center min-h-0">
          {isValueUnavailable ? (
            /* Show dash when value is not available */
            <div className="flex items-baseline gap-1 sm:gap-1.5 md:gap-2 overflow-hidden">
              <div 
                className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tabular-nums leading-none truncate flex-shrink-0"
                style={{ color: '#6b7280' }}
              >
                —
              </div>
              <div 
                className="text-sm sm:text-base md:text-lg font-medium flex-shrink-0"
                style={{ color: '#4b5563' }}
              >
                {unit}
              </div>
            </div>
          ) : isYieldEnergy ? (
            /* Yield Energy - Stack unit below on small screens */
            <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-1.5 md:gap-2">
              <div 
                className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tabular-nums leading-none"
                style={{ color }}
              >
                {v.toFixed(1)}
              </div>
              <div 
                className="text-base sm:text-base md:text-lg font-medium mt-1 sm:mt-0"
                style={{ color: '#9ca3af' }}
              >
                {unit}
              </div>
            </div>
          ) : (
            /* Other cards - Keep inline */
            <div className="flex items-baseline gap-1 sm:gap-1.5 md:gap-2 overflow-hidden">
              <div 
                className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tabular-nums leading-none truncate flex-shrink-0"
                style={{ color }}
              >
                {v.toFixed(unit === '€' ? 2 : unit === '%' ? 0 : 1)}
              </div>
              <div 
                className="text-sm sm:text-base md:text-lg font-medium flex-shrink-0"
                style={{ color: '#9ca3af' }}
              >
                {unit}
              </div>
            </div>
          )}
          
          {showGauge && !isValueUnavailable && (
            <div className="mt-3 md:mt-4 hidden lg:block">
              <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{ 
                    width: `${pct * 100}%`,
                    background: `linear-gradient(90deg, ${color}dd, ${color})`
                  }}
                />
              </div>
              <div className="flex justify-between mt-1.5 text-[9px] text-gray-500">
                <span>{gaugeMin}</span>
                <span>{gaugeMax}{unit}</span>
              </div>
            </div>
          )}
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
      const prodUnit = scale === 'D' ? 'kW' : 'kWh';
      label1 = `Production (${prodUnit})`;
      color1 = '#fbbf24';
    } else if (mode === 'distribution' && kpis) {
      series1 = data.production.map(p => p * (economicParams.selfConsumptionRate / 100));
      series2 = data.production.map(p => p * (1 - economicParams.selfConsumptionRate / 100));
      label1 = 'Self-Consumption';
      label2 = 'Exported';
      color1 = '#10b981';
      color2 = '#ef4444';
    } else if (mode === 'grid' && kpis) {
      // Compute per-point baseline load and PV self-consumption, then grid draw = max(load - selfConsumption, 0)
      const loadPerPoint = data.production.map(() => (
        scale === 'D'
          ? Math.max(0, economicParams.avgDailyLoad / 24) // kW baseline load for each hour
          : Math.max(0, economicParams.avgDailyLoad)      // kWh per day for W/M/Y
      ));
      series2 = data.production.map(p => p * (economicParams.selfConsumptionRate / 100)); // self-consumption
      series1 = loadPerPoint.map((l, i) => Math.max(0, l - (series2[i] || 0))); // grid draw
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
          // Display only the number value, units are shown in tooltip
          const displayValue = v.toFixed(1);
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
            
            {(() => {
              const val1 = series1[hoverIndex];
              const val2 = series2.length > 0 ? series2[hoverIndex] : null;
              const unit = mode === 'economic' ? '€' : (scale === 'D' ? 'kW' : 'kWh');
              const val1Str = mode === 'economic' ? `€${val1.toFixed(2)}` : `${val1.toFixed(2)} ${unit}`;
              const val2Str = val2 !== null ? (mode === 'economic' ? `€${val2.toFixed(2)}` : `${val2.toFixed(2)} ${unit}`) : '';
              
              // Calculate dynamic tooltip dimensions - more generous sizing
              const maxLabelLength = Math.max(label1.length, label2?.length || 0);
              const maxValueLength = Math.max(val1Str.length, val2Str.length);
              const tooltipWidth = Math.max(200, Math.min(260, (maxLabelLength + maxValueLength) * 8.5));
              const tooltipHeight = val2 !== null ? 110 : 80;
              
              // Better positioning - prefer top of chart area for more space
              const tooltipX = hoverX > l + innerW / 2 ? hoverX - tooltipWidth - 12 : hoverX + 12;
              const tooltipY = t + 15; // More space from top
              
              return (
                <>
                  <rect 
                    x={tooltipX} 
                    y={tooltipY} 
                    width={tooltipWidth} 
                    height={tooltipHeight} 
                    rx={8} 
                    fill="#1f2937" 
                    stroke="#374151" 
                    strokeWidth={1.5}
                    opacity={0.98}
                  />
                  
                  {/* Timestamp */}
                  <text 
                    x={tooltipX + tooltipWidth / 2} 
                    y={tooltipY + 22} 
                    fontSize={11.5} 
                    fill="#9ca3af" 
                    textAnchor="middle"
                    fontWeight="500"
                  >
                    {(() => {
                      const d = new Date(xs[hoverIndex]);
                      if (scale === 'D') return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
                      if (scale === 'W') return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
                      if (scale === 'M') return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                      return d.toLocaleDateString('en-GB', { month: 'short' });
                    })()}
                  </text>
                  
                  {/* First series */}
                  <circle cx={tooltipX + 16} cy={tooltipY + 46} r={4.5} fill={color1} />
                  <text x={tooltipX + 28} y={tooltipY + 50} fontSize={11.5} fill="#d1d5db" fontWeight="500">
                    {label1}
                  </text>
                  <text x={tooltipX + tooltipWidth - 16} y={tooltipY + 50} fontSize={12.5} fill="#f3f4f6" fontWeight="700" textAnchor="end">
                    {val1Str}
                  </text>
                  
                  {val2 !== null && (
                    <>
                      {/* Second series */}
                      <circle cx={tooltipX + 16} cy={tooltipY + 74} r={4.5} fill={color2} />
                      <text x={tooltipX + 28} y={tooltipY + 78} fontSize={11.5} fill="#d1d5db" fontWeight="500">
                        {label2}
                      </text>
                      <text x={tooltipX + tooltipWidth - 16} y={tooltipY + 78} fontSize={12.5} fill="#f3f4f6" fontWeight="700" textAnchor="end">
                        {val2Str}
                      </text>
                    </>
                  )}
                </>
              );
            })()}
            
            {/* Data point circles */}
            <circle cx={hoverX} cy={mapPoint(xs[hoverIndex], series1[hoverIndex]).y} r={5} fill={color1} stroke="#1f2937" strokeWidth={2} />
            {series2.length > 0 && (
              <circle cx={hoverX} cy={mapPoint(xs[hoverIndex], series2[hoverIndex]).y} r={5} fill={color2} stroke="#1f2937" strokeWidth={2} />
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
              onClick={()=>{ const el=dateInputEl.current as any; if(el?.showPicker) el.showPicker(); else el?.click(); }}
              className="px-2 md:px-3 py-1 md:py-1.5 rounded-lg bg-gray-800/70 border border-gray-700 text-xs md:text-sm text-gray-100 hover:bg-gray-700/60 transition flex items-center gap-1 md:gap-2"
              title="Pick date"
            >
              {/* Calendar icon (Flaticon style) */}
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="5" width="18" height="16" rx="2"></rect>
                <line x1="16" y1="3" x2="16" y2="7"></line>
                <line x1="8" y1="3" x2="8" y2="7"></line>
                <line x1="3" y1="11" x2="21" y2="11"></line>
              </svg>
              <span className="hidden sm:inline">{formatDate(date)}</span>
              <span className="inline sm:hidden text-[10px]">{date.getDate()}/{date.getMonth()+1}</span>
            </button>
            <input ref={dateInputEl} type="date" max={todayYmd} className="absolute w-0 h-0 opacity-0 pointer-events-none" value={dateInputValue} onChange={e=>{ const d=new Date(e.target.value+ 'T00:00:00'); const today=new Date(); today.setHours(0,0,0,0); if(!isNaN(d.getTime())) setDate(d>today? today : d); }} />
            <button
              onClick={() => setShowSettings(true)}
              className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gray-800/70 hover:bg-gray-700/60 border border-gray-700 text-gray-100 flex items-center justify-center"
              aria-label="Settings"
              title="Settings"
            >
              {/* Settings icon (Freepik/Flaticon style) */}
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09c.67 0 1.27-.39 1.51-1a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06c.46.46 1.12.6 1.7.39.55-.2.95-.69 1-1.27V3a2 2 0 1 1 4 0v.09c.05.58.45 1.07 1 1.27.58.21 1.24.07 1.7-.39l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06c-.46.46-.6 1.12-.39 1.7.2.55.69.95 1.27 1H21a2 2 0 1 1 0 4h-.09c-.58.05-1.07.45-1.27 1z"></path>
              </svg>
            </button>
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

      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 p-3 md:p-4 min-h-0 max-h-full overflow-hidden">
        {/* LEFT COLUMN - 8 KPI Indicators */}
        <div className="col-span-1 md:col-span-3 flex flex-col h-auto md:h-full min-h-0 md:shrink-0 md:grow">
          <div className="grid grid-cols-2 gap-2 md:shrink-0 md:grow min-h-[220px]">
            {calculateKPIs && (
              <>
                {/* Row 1 */}
                <KPICard 
                  label="Yield Energy" 
                  value={calculateKPIs.yieldEnergy} 
                  unit="kWh" 
                  color="#fbbf24" 
                  showGauge={false}
                  trend="up"
                />
                <KPICard 
                  label="Efficiency" 
                  value={economicParams.panelSurface && economicParams.dailyIrradiance ? calculateKPIs.efficiency : undefined} 
                  unit="%" 
                  color="#22c55e" 
                  showGauge={false}
                />
                
                {/* Row 2 */}
                <KPICard 
                  label="Direct Self Use Rate" 
                  value={calculateKPIs.directSelfUseRate} 
                  unit="%" 
                  color="#10b981" 
                  showGauge={false}
                />
                <KPICard 
                  label="Exported Energy" 
                  value={calculateKPIs.exportedEnergy} 
                  unit="kWh" 
                  color="#ef4444"
                  trend="up"
                />
                
                {/* Row 3 */}
                <KPICard 
                  label="Grid Consumption" 
                  value={calculateKPIs.gridConsumption} 
                  unit="kWh" 
                  color="#6b7280"
                />
                <KPICard 
                  label="Income" 
                  value={calculateKPIs.income} 
                  unit="€" 
                  color="#a855f7"
                  trend="up"
                />
                
                {/* Row 4 */}
                <KPICard 
                  label="Saving" 
                  value={calculateKPIs.saving} 
                  unit="€" 
                  color="#38bdf8"
                  trend="up"
                />
                <KPICard 
                  label="Bill" 
                  value={calculateKPIs.bill} 
                  unit="€" 
                  color={calculateKPIs.bill < 0 ? '#22c55e' : '#ef4444'}
                  trend={calculateKPIs.bill < 0 ? 'down' : 'up'}
                />
              </>
            )}
          </div>
        </div>

        {/* CENTER COLUMN - 4 Main Charts */}
        <div ref={centerColRef} className="col-span-1 md:col-span-6 flex flex-col h-auto md:h-full min-w-0 overflow-hidden">
          <div className="flex-1 flex flex-col gap-1.5 md:gap-2 min-h-0">
            <div className="flex-1 flex flex-col min-h-[180px] md:min-h-0 bg-gray-900 border border-gray-700 rounded-xl pt-2 px-2 md:pt-3 md:px-3 pb-0 overflow-hidden">
              <div className="flex items-center justify-between mb-1.5 md:mb-2 flex-shrink-0">
                <div className="text-xs md:text-sm font-semibold text-white">{prodScale === 'D' ? 'Daily' : prodScale === 'W' ? 'Weekly' : prodScale === 'M' ? 'Monthly' : 'Annual'} Production</div>
                <ScaleSwitch currentScale={prodScale} setScale={setProdScale} />
              </div>
              <div className="flex-1 min-h-0 relative">
                <EconomicChart mode="production" title="Production" width={chartWidth} height={chartHeight} data={prodSeries} scale={prodScale} kpis={calculateKPIs} />
              </div>
            </div>

            <div className="flex-1 flex flex-col min-h-[180px] md:min-h-0 bg-gray-900 border border-gray-700 rounded-xl pt-2 px-2 md:pt-3 md:px-3 pb-0 overflow-hidden">
              <div className="flex items-center justify-between mb-1.5 md:mb-2 flex-shrink-0">
                <div className="text-xs md:text-sm font-semibold text-white">Energy Distribution</div>
                <ScaleSwitch currentScale={distScale} setScale={setDistScale} />
              </div>
              <div className="flex-1 min-h-0 relative">
                <EconomicChart mode="distribution" title="Distribution" width={chartWidth} height={chartHeight} data={distSeries} scale={distScale} kpis={calculateKPIs} />
              </div>
            </div>

            <div className="flex-1 flex flex-col min-h-[240px] md:min-h-0 bg-gray-900 border border-gray-700 rounded-xl pt-2 px-2 md:pt-3 md:px-3 pb-0 overflow-hidden">
              <div className="flex items-center justify-between mb-1.5 md:mb-2 flex-shrink-0">
                <div className="text-xs md:text-sm font-semibold text-white">Grid vs Self-Consumption</div>
                <ScaleSwitch currentScale={gridScale} setScale={setGridScale} />
              </div>
              <div className="flex-1 min-h-0 relative">
                <EconomicChart mode="grid" title="Grid" width={chartWidth} height={chartHeight} data={gridSeries} scale={gridScale} kpis={calculateKPIs} />
              </div>
            </div>

            <div className="flex-1 flex flex-col min-h-[240px] md:min-h-0 bg-gray-900 border border-gray-700 rounded-xl pt-2 px-2 md:pt-3 md:px-3 pb-0 overflow-hidden">
              <div className="flex items-center justify-between mb-1.5 md:mb-2 flex-shrink-0">
                <div className="text-xs md:text-sm font-semibold text-white">Economic Trend</div>
                <ScaleSwitch currentScale={econScale} setScale={setEconScale} />
              </div>
              <div className="flex-1 min-h-0 relative">
                <EconomicChart mode="economic" title="Economic" width={chartWidth} height={chartHeight} data={econSeries} scale={econScale} kpis={calculateKPIs} />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN - Economic Forecast Panel */}
        <div className="col-span-1 md:col-span-3 flex flex-col h-auto md:h-full gap-3 min-h-0 md:shrink-0">
          {/* Economic Forecast - Main Card */}
          <div className="relative bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800 border border-slate-700/50 rounded-2xl p-3 md:p-4 flex-1 md:grow md:shrink-0 flex flex-col min-h-[260px] overflow-hidden">
            {/* Decorative background elements */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl"></div>
            <div className="absolute bottom-0 left-0 w-20 h-20 bg-emerald-500/5 rounded-full blur-xl"></div>
            
            <div className="relative z-10 flex flex-col h-full">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-white">Economic Forecast</h3>
                <div className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded-full">
                  <span className="text-[10px] font-semibold text-blue-400">{calculateForecast?.days || 30} days</span>
                </div>
              </div>
              
              {/* Period Selector */}
              <div className="flex gap-1.5 mb-3 p-0.5 bg-gray-800/40 rounded-lg backdrop-blur-sm">
                <button
                  onClick={() => setForecastPeriod('monthly')}
                  className={`flex-1 px-2 py-1.5 rounded-md text-[10px] font-semibold transition-all duration-300 ${
                    forecastPeriod === 'monthly'
                      ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/40'
                      : 'text-gray-400 hover:text-gray-300 hover:bg-gray-700/30'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setForecastPeriod('annual')}
                  className={`flex-1 px-2 py-1.5 rounded-md text-[10px] font-semibold transition-all duration-300 ${
                    forecastPeriod === 'annual'
                      ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/40'
                      : 'text-gray-400 hover:text-gray-300 hover:bg-gray-700/30'
                  }`}
                >
                  Annual
                </button>
                <button
                  onClick={() => setForecastPeriod('custom')}
                  className={`flex-1 px-2 py-1.5 rounded-md text-[10px] font-semibold transition-all duration-300 ${
                    forecastPeriod === 'custom'
                      ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/40'
                      : 'text-gray-400 hover:text-gray-300 hover:bg-gray-700/30'
                  }`}
                >
                  Custom
                </button>
              </div>
              
              {/* Custom Days Input */}
              {forecastPeriod === 'custom' && (
                <div className="mb-3">
                  <label className="text-[10px] text-gray-400 block mb-1.5 font-medium">Days to forecast</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={customForecastDays}
                    onChange={(e) => {
                      const val = e.target.value;
                      // Allow empty or numbers only
                      if (val === '') {
                        setCustomForecastDays('' as any);
                      } else if (/^\d+$/.test(val)) {
                        const numVal = parseInt(val);
                        if (numVal >= 1 && numVal <= 730) {
                          setCustomForecastDays(numVal);
                        } else if (numVal > 730) {
                          setCustomForecastDays(730);
                        }
                      }
                    }}
                    onBlur={(e) => {
                      if (e.target.value === '' || parseInt(e.target.value) < 1) {
                        setCustomForecastDays(1);
                      }
                    }}
                    onFocus={(e) => e.target.select()}
                    placeholder="Enter days (1-730)"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition-all"
                  />
                </div>
              )}
              
              {/* Forecast Values */}
              {calculateForecast && (
                <div className="flex-1 flex flex-col gap-2 min-h-0">
                  {/* Total Benefit - Hero Card */}
                  <div className="relative group flex-shrink-0">
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-green-500/20 rounded-xl blur-lg group-hover:blur-xl transition-all duration-300"></div>
                    <div className="relative bg-gradient-to-br from-emerald-500/20 via-emerald-600/10 to-green-500/20 border border-emerald-400/30 rounded-xl p-3 backdrop-blur-sm">
                      <div className="flex items-start justify-between mb-1.5">
                        <div className="flex-1">
                          <div className="text-[9px] font-bold text-emerald-400/80 uppercase tracking-widest mb-1">Total Benefit</div>
                          <div className="text-2xl md:text-3xl font-black text-emerald-300 tabular-nums tracking-tight leading-none">
                            €{calculateForecast.total.toFixed(2)}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
                          <div className="w-1 h-1 rounded-full bg-emerald-400/60 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                      </div>
                      <div className="h-0.5 bg-gradient-to-r from-emerald-500/40 via-green-500/40 to-transparent rounded-full"></div>
                    </div>
                  </div>
                  
                  {/* Income & Saving - Enhanced Cards */}
                  <div className="grid grid-cols-2 gap-2 flex-shrink-0">
                    <div className="relative group">
                      <div className="absolute inset-0 bg-purple-500/10 rounded-lg blur-md group-hover:blur-lg transition-all duration-300"></div>
                      <div className="relative bg-gradient-to-br from-purple-500/15 to-purple-600/5 border border-purple-400/20 rounded-lg p-2.5 backdrop-blur-sm">
                        <div className="text-[9px] font-bold text-purple-400/80 uppercase tracking-widest mb-1">Income</div>
                        <div className="text-lg md:text-xl font-bold text-purple-300 tabular-nums leading-none">€{calculateForecast.income.toFixed(2)}</div>
                        <div className="mt-1.5 h-0.5 bg-gradient-to-r from-purple-500/50 to-transparent rounded-full"></div>
                      </div>
                    </div>
                    
                    <div className="relative group">
                      <div className="absolute inset-0 bg-cyan-500/10 rounded-lg blur-md group-hover:blur-lg transition-all duration-300"></div>
                      <div className="relative bg-gradient-to-br from-cyan-500/15 to-cyan-600/5 border border-cyan-400/20 rounded-lg p-2.5 backdrop-blur-sm">
                        <div className="text-[9px] font-bold text-cyan-400/80 uppercase tracking-widest mb-1">Saving</div>
                        <div className="text-lg md:text-xl font-bold text-cyan-300 tabular-nums leading-none">€{calculateForecast.saving.toFixed(2)}</div>
                        <div className="mt-1.5 h-0.5 bg-gradient-to-r from-cyan-500/50 to-transparent rounded-full"></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* System Parameters - Compact */}
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700/50 rounded-xl p-4 md:shrink-0">
            <h3 className="text-sm font-bold text-white mb-3 tracking-wide">System Parameters</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500">Self-Consumption</span>
                <span className="text-white font-semibold tabular-nums">{economicParams.selfConsumptionRate}%</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500">Daily Load</span>
                <span className="text-white font-semibold tabular-nums">{economicParams.avgDailyLoad} kWh</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500">Grid Price</span>
                <span className="text-white font-semibold tabular-nums">€{economicParams.gridPrice.toFixed(2)}/kWh</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500">Sell Price</span>
                <span className="text-white font-semibold tabular-nums">€{economicParams.sellingPrice.toFixed(2)}/kWh</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500">Forecast Trend</span>
                <span className={`font-semibold tabular-nums ${economicParams.forecastTrend > 0 ? 'text-green-400' : economicParams.forecastTrend < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                  {economicParams.forecastTrend > 0 ? '+' : ''}{economicParams.forecastTrend}%
                </span>
              </div>
              
              {/* Optional Parameters - Always show with divider */}
              <div className="border-t border-gray-700 my-2 pt-2">
                <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">Optional</div>
                
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500">Panel Surface</span>
                  <span className="text-white font-semibold tabular-nums">
                    {economicParams.panelSurface ? `${economicParams.panelSurface} m²` : '—'}
                  </span>
                </div>
                
                <div className="flex justify-between items-center text-xs mt-2">
                  <span className="text-gray-500">Irradiance</span>
                  <span className="text-white font-semibold tabular-nums">
                    {economicParams.dailyIrradiance ? `${economicParams.dailyIrradiance} kWh/m²` : '—'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {showSettings && <SettingsPanel economicParams={economicParams} setEconomicParams={setEconomicParams} onClose={() => setShowSettings(false)} />}
      
      {/* Loading Overlay with Backdrop Blur */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/70 backdrop-blur-md z-50">
          <div className="flex flex-col items-center gap-4">
            {/* Spinner */}
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 border-4 border-gray-700 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-transparent border-t-blue-500 rounded-full animate-spin"></div>
            </div>
            {/* Loading Text */}
            <div className="text-base text-gray-200 font-medium">Loading sensor data…</div>
          </div>
        </div>
      )}
      
      {error && (<div className="absolute top-16 left-1/2 -translate-x-1/2 bg-red-600/90 text-white text-xs px-3 py-2 rounded-md shadow">{error}</div>)}
    </div>
  );
}
