"use client";

import React, { useState, useEffect, useRef } from "react";
import type { Sensor } from "@/app/context/sensor-context";

interface Props {
  sensor?: Sensor | null;
  onClose: () => void;
  projectLocation?: {
    latitude: number;
    longitude: number;
    address?: string;
    city?: string;
  };
  standalone?: boolean;
}

export default function EnergyDashboardOverlay({ sensor, onClose, projectLocation, standalone = false }: Props) {
  const [l1Scale, setL1Scale] = useState<"D" | "W" | "M" | "Y">("M");
  const [l2Scale, setL2Scale] = useState<"D" | "W" | "M" | "Y">("M");
  const [l3Scale, setL3Scale] = useState<"D" | "W" | "M" | "Y">("M");
  const [totalScale, setTotalScale] = useState<"D" | "W" | "M" | "Y">("M");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [realtimeData, setRealtimeData] = useState({
    currentPower: 384,
    hourConsumption: 0.3,
    dayConsumption: 7.8,
    monthConsumption: 818,
    yearConsumption: 9467,
    totalConsumption: 105858,
    temperature: 5,
    humidity: 65,
    l1Current: 28.1,
    l2Current: 21.8,
    l3Current: 14.3
  });

  const [weatherData, setWeatherData] = useState({
    temperature: 5,
    humidity: 65,
    sunrise: "06:51",
    sunset: "18:46",
    weatherCode: 2, // 0: Clear, 1: Partly cloudy, 2: Cloudy, 3: Rain
    location: projectLocation?.city || projectLocation?.address || "Project Location"
  });

  // Fetch weather data on component mount
  useEffect(() => {
    const fetchWeatherData = async () => {
      try {
        // Use project coordinates or fallback to Delhi
        const lat = projectLocation?.latitude || 28.6139;
        const lon = projectLocation?.longitude || 77.2090;
        const locationName = projectLocation?.city || projectLocation?.address || "Delhi";
        
        const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code&daily=sunrise,sunset&timezone=auto&forecast_days=1`
        );
        const data = await response.json();
        
        if (data.current && data.daily) {
          // Get timezone from the API response for accurate time formatting
          const timezone = data.timezone || 'UTC';
          
          const sunrise = new Date(data.daily.sunrise[0]).toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            timeZone: timezone,
            hour12: true
          });
          const sunset = new Date(data.daily.sunset[0]).toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            timeZone: timezone,
            hour12: true
          });
          
          setWeatherData({
            temperature: Math.round(data.current.temperature_2m * 10) / 10,
            humidity: Math.round(data.current.relative_humidity_2m),
            sunrise,
            sunset,
            weatherCode: data.current.weather_code,
            location: locationName
          });
        }
      } catch (error) {
        console.error('Failed to fetch weather data:', error);
        // Keep default values on error
      }
    };

    fetchWeatherData();
    // Refresh weather data every 10 minutes
    const weatherTimer = setInterval(fetchWeatherData, 10 * 60 * 1000);

    return () => clearInterval(weatherTimer);
  }, [projectLocation]);

  // Update time and mock real-time data every few seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      
      // Update mock data every 3 seconds to simulate real-time changes
      if (Math.random() > 0.7) {
        setRealtimeData(prev => ({
          currentPower: Math.max(200, Math.min(600, prev.currentPower + (Math.random() - 0.5) * 50)),
          hourConsumption: Math.max(0.1, prev.hourConsumption + (Math.random() - 0.5) * 0.05),
          dayConsumption: Math.max(5, prev.dayConsumption + (Math.random() - 0.5) * 0.3),
          monthConsumption: Math.max(700, prev.monthConsumption + (Math.random() - 0.5) * 5),
          yearConsumption: Math.max(8000, prev.yearConsumption + (Math.random() - 0.5) * 20),
          totalConsumption: prev.totalConsumption + Math.random() * 0.1,
          temperature: prev.temperature, // Keep existing temperature
          humidity: prev.humidity, // Keep existing humidity  
          l1Current: Math.max(20, Math.min(35, prev.l1Current + (Math.random() - 0.5) * 3)),
          l2Current: Math.max(15, Math.min(30, prev.l2Current + (Math.random() - 0.5) * 2.5)),
          l3Current: Math.max(10, Math.min(25, prev.l3Current + (Math.random() - 0.5) * 2))
        }));
      }
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const box = "bg-gray-900/95 border border-gray-700 rounded-xl p-2 shadow-md";
  const label = "text-[11px] uppercase tracking-wider text-gray-400";
  const value = "text-sm font-semibold text-gray-100";

  // Helpers for redesigned Power panel
  const prevPowerRef = useRef<number>(realtimeData.currentPower);
  const [powerTrend, setPowerTrend] = useState<"up"|"down"|"same">("same");
  // Hover states for line charts (index under cursor)
  const [l1HoverIdx, setL1HoverIdx] = useState<number | null>(null);
  const [l2HoverIdx, setL2HoverIdx] = useState<number | null>(null);
  const [l3HoverIdx, setL3HoverIdx] = useState<number | null>(null);
  const [totalHoverIdx, setTotalHoverIdx] = useState<number | null>(null);

  useEffect(() => {
    // Determine trend whenever realtimeData.currentPower changes
    if (realtimeData.currentPower > prevPowerRef.current + 2) setPowerTrend("up");
    else if (realtimeData.currentPower < prevPowerRef.current - 2) setPowerTrend("down");
    else setPowerTrend("same");
    prevPowerRef.current = realtimeData.currentPower;
  }, [realtimeData.currentPower]);

  const formatEnergy = (n: number, fraction: number = 0) => {
    return n.toFixed(fraction).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };
  const formatTime = (d: Date) => {
    const hh = d.getHours().toString().padStart(2,'0');
    const mm = d.getMinutes().toString().padStart(2,'0');
    const ss = d.getSeconds().toString().padStart(2,'0');
    return `${hh}:${mm}.${ss}`; // Format like 10:21.36
  };

  // Build SVG path strings for line and area under it (responsive via viewBox)
  const buildLinePaths = (values: number[], max: number) => {
    const width = 1000; // virtual width for viewBox
    const height = 200; // virtual height for viewBox
    const n = values.length;
    const safeValues = n > 1 ? values : [0, 0];
    const clamp = (v: number) => Math.max(0, Math.min(max, v));
    const points = safeValues.map((v, i) => {
      const x = (i * width) / Math.max(1, n - 1);
      const y = height - (clamp(v) / max) * height;
      return [x, y] as [number, number];
    });
    const d = points
      .map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`)
      .join(' ');
    const area = `${d} L ${width} ${height} L 0 ${height} Z`;
    return { d, area, width, height };
  };

  // Weather code to emoji mapping (WMO Weather interpretation codes)
  const getWeatherEmoji = (code: number) => {
    if (code === 0) return "☀️"; // Clear sky
    if (code <= 3) return "⛅"; // Partly cloudy
    if (code <= 48) return "🌫️"; // Fog
    if (code <= 67) return "🌧️"; // Rain
    if (code <= 77) return "🌨️"; // Snow
    if (code <= 82) return "🌦️"; // Rain showers
    if (code <= 86) return "🌨️"; // Snow showers
    if (code <= 99) return "⛈️"; // Thunderstorm
    return "⛅"; // Default
  };

  // Today string for date input max (prevents selecting future dates)
  const todayStr = new Date().toISOString().split('T')[0];

  // Custom export UI state
  const [showCustomExport, setShowCustomExport] = useState(false);
  const [customFrom, setCustomFrom] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [customTo, setCustomTo] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // Export data to Excel
  const handleExportData = (type: 'month' | 'week' | 'consumption') => {
    const generateExcelData = () => {
      const baseData = {
        timestamp: new Date().toISOString(),
        sensorName: sensor?.name || 'Energy Sensor',
        currentPower: realtimeData.currentPower,
        hourConsumption: realtimeData.hourConsumption,
        dayConsumption: realtimeData.dayConsumption,
        monthConsumption: realtimeData.monthConsumption,
        yearConsumption: realtimeData.yearConsumption,
        totalConsumption: realtimeData.totalConsumption,
        l1Current: realtimeData.l1Current,
        l2Current: realtimeData.l2Current,
        l3Current: realtimeData.l3Current
      };

      if (type === 'month') {
        // Generate monthly data for past 12 months
        const months = [];
        for (let i = 0; i < 12; i++) {
          const date = new Date();
          date.setMonth(date.getMonth() - i);
          const monthName = date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
          const consumption = i === 0 ? realtimeData.monthConsumption : 
            817.69 + i * 45 + Math.sin(i + realtimeData.currentPower/100) * 80;
          months.push({
            Month: monthName,
            'Total Consumption (kWh)': Math.round(consumption * 10) / 10,
            'L1 Consumption (kWh)': Math.round(consumption * 0.44 * 10) / 10,
            'L2 Consumption (kWh)': Math.round(consumption * 0.35 * 10) / 10,
            'L3 Consumption (kWh)': Math.round(consumption * 0.21 * 10) / 10
          });
        }
        return months;
      } else if (type === 'week') {
        // Generate weekly data for past 4 weeks
        const weeks = [];
        for (let i = 0; i < 4; i++) {
          const weekStart = new Date();
          weekStart.setDate(weekStart.getDate() - (i * 7));
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 6);
          
          const weekLabel = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
          const weeklyConsumption = realtimeData.dayConsumption * 7 * (1 + Math.random() * 0.3 - 0.15);
          
          weeks.push({
            Week: weekLabel,
            'Total Consumption (kWh)': Math.round(weeklyConsumption * 10) / 10,
            'L1 Consumption (kWh)': Math.round(realtimeData.l1Current * 7 * 10) / 10,
            'L2 Consumption (kWh)': Math.round(realtimeData.l2Current * 6.8 * 10) / 10,
            'L3 Consumption (kWh)': Math.round(realtimeData.l3Current * 6.2 * 10) / 10,
            'Average Power (W)': Math.round(realtimeData.currentPower * (1 + Math.random() * 0.2 - 0.1))
          });
        }
        return weeks;
      } else {
        // All consumption data
        return [{
          'Export Date': new Date().toLocaleString(),
          'Sensor Name': baseData.sensorName,
          'Current Power (W)': baseData.currentPower,
          'Hour Consumption (kWh)': baseData.hourConsumption,
          'Day Consumption (kWh)': baseData.dayConsumption,
          'Month Consumption (kWh)': baseData.monthConsumption,
          'Year Consumption (kWh)': baseData.yearConsumption,
          'Total Consumption (kWh)': baseData.totalConsumption,
          'L1 Current (A)': baseData.l1Current,
          'L2 Current (A)': baseData.l2Current,
          'L3 Current (A)': baseData.l3Current,
          'L1 Monthly (kWh)': Math.round(baseData.monthConsumption * 0.44 * 10) / 10,
          'L2 Monthly (kWh)': Math.round(baseData.monthConsumption * 0.35 * 10) / 10,
          'L3 Monthly (kWh)': Math.round(baseData.monthConsumption * 0.21 * 10) / 10
        }];
      }
    };

    const data = generateExcelData();
    
    // Convert to CSV format
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => `"${row[header as keyof typeof row]}"`).join(','))
    ].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `energy_consumption_${type}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export for custom date range (From-To with daily rows)
  const handleCustomExport = () => {
    try {
      if (!customFrom || !customTo) {
        alert('Please select both From and To dates.');
        return;
      }
      const start = new Date(customFrom);
      const end = new Date(customTo);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        alert('Invalid date range.');
        return;
      }
      if (start > end) {
        alert('From date must be before To date.');
        return;
      }

      const rows: any[] = [];
      const dayMs = 24 * 60 * 60 * 1000;
      for (let t = start.getTime(), i = 0; t <= end.getTime(); t += dayMs, i++) {
        const d = new Date(t);
        // simple synthetic variation based on current values
        const total = Math.max(3, realtimeData.dayConsumption * (1 + Math.sin(i * 0.7 + realtimeData.currentPower / 200) * 0.2));
        const l1 = Math.round(total * 0.44 * 10) / 10;
        const l2 = Math.round(total * 0.35 * 10) / 10;
        const l3 = Math.round(total * 0.21 * 10) / 10;
        rows.push({
          Date: d.toISOString().split('T')[0],
          'Total Consumption (kWh)': Math.round(total * 10) / 10,
          'L1 Consumption (kWh)': l1,
          'L2 Consumption (kWh)': l2,
          'L3 Consumption (kWh)': l3,
          'Average Power (W)': Math.round(realtimeData.currentPower * (1 + Math.sin(i * 0.3) * 0.1))
        });
      }

      if (!rows.length) {
        alert('No days in selected range.');
        return;
      }

      const headers = Object.keys(rows[0]);
      const csvContent = [
        headers.join(','),
        ...rows.map(row => headers.map(h => `"${row[h as keyof typeof row]}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `energy_consumption_custom_${customFrom}_to_${customTo}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error('Custom export failed', e);
    }
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

  return (
    <div className={standalone ? "h-full w-full flex flex-col bg-gray-950" : "fixed left-0 right-0 bottom-0 top-16 z-[2000] flex flex-col bg-gray-950/98"}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-1.5 border-b border-gray-800 bg-gray-900/70 flex-shrink-0">
        <div className="flex items-baseline gap-3">
          <h3 className="text-lg font-bold text-white">Consumption</h3>
          {sensor?.name && <div className="text-xs text-gray-400">Sensor: {sensor.name}</div>}
        </div>
        <div className="flex items-center gap-2">
          {!standalone && (
            <button 
              onClick={() => {
                const roomName = sensor?.room ? encodeURIComponent(sensor.room.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '-')) : 'unknown-room';
                const sensorName = sensor?.name ? encodeURIComponent(sensor.name.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '-')) : 'unknown-sensor';
                const url = `/energy-dashboard/${roomName}/${sensorName}?id=${sensor?.id || ''}`;
                window.open(url, '_blank', 'width=1400,height=900,scrollbars=yes,resizable=yes');
              }}
              className="w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-sm border border-blue-500 flex items-center justify-center transition-colors"
              title="Open in new window"
            >
              ⧉
            </button>
          )}
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 text-white text-sm border border-gray-600 flex items-center justify-center transition-colors">
            ×
          </button>
        </div>
      </div>

      {/* Content */}
      <div
        className="flex-1 px-2 sm:px-3 md:px-4 pt-3 sm:pt-4 md:pt-5 pb-5 md:pb-6 overflow-y-auto"
        style={{
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 6px)'
        }}
      >
        <div className="grid grid-cols-12 gap-2 max-w-none mx-auto h-full">
          
          {/* Left Column - Time-of-Use & Monthly Summary */}
          <div className="col-span-12 md:col-span-3 space-y-1.5 h-full flex flex-col">
            <div className={box + " flex-none"}>
              <div className="text-gray-200 font-semibold mb-3">Time Band</div>
              
              {/* Table Header */}
              <div className="border border-gray-600 rounded-lg overflow-hidden">
                <div className="grid grid-cols-5 bg-gray-800 border-b border-gray-600">
                  <div className="p-2 text-center border-r border-gray-600">
                    <div className="text-[10px] text-gray-400 font-semibold">Date</div>
                    <div className="text-[9px] text-gray-500">Sept 2025</div>
                  </div>
                  <div className="p-2 text-center border-r border-gray-600">
                    <div className="text-[11px] text-gray-300 font-bold">D</div>
                  </div>
                  <div className="p-2 text-center border-r border-gray-600">
                    <div className="text-[11px] text-gray-300 font-bold">W</div>
                  </div>
                  <div className="p-2 text-center border-r border-gray-600">
                    <div className="text-[11px] text-gray-300 font-bold">M</div>
                  </div>
                  <div className="p-2 text-center">
                    <div className="text-[11px] text-gray-300 font-bold">Y</div>
                  </div>
                </div>

                {/* Table Rows */}
                {[
                  { band: "F1", d: realtimeData.l1Current, w: realtimeData.l1Current * 7, m: realtimeData.monthConsumption * 0.44, y: realtimeData.yearConsumption * 0.42 },
                  { band: "F2", d: realtimeData.l2Current, w: realtimeData.l2Current * 6.8, m: realtimeData.monthConsumption * 0.35, y: realtimeData.yearConsumption * 0.36 },
                  { band: "F3", d: realtimeData.l3Current, w: realtimeData.l3Current * 6.2, m: realtimeData.monthConsumption * 0.21, y: realtimeData.yearConsumption * 0.22 },
                  { band: "TOT", d: realtimeData.dayConsumption, w: realtimeData.dayConsumption * 7, m: realtimeData.monthConsumption, y: realtimeData.yearConsumption }
                ].map(({ band, d, w, m, y }, index) => (
                  <div key={band} className={`grid grid-cols-5 ${index < 3 ? 'border-b border-gray-600' : ''} ${band === 'TOT' ? 'bg-gray-850' : ''}`}>
                    <div className="p-2 text-center border-r border-gray-600 bg-gray-800">
                      <div className="text-[12px] font-bold text-gray-200">{band}</div>
                    </div>
                    <div className="p-2 text-center border-r border-gray-600">
                      <div className="text-[11px] text-gray-200 font-semibold">{d.toFixed(1)}</div>
                    </div>
                    <div className="p-2 text-center border-r border-gray-600">
                      <div className="text-[11px] text-gray-200 font-semibold">{w.toFixed(1)}</div>
                    </div>
                    <div className="p-2 text-center border-r border-gray-600">
                      <div className="text-[11px] text-gray-200 font-semibold">{m.toFixed(1)}</div>
                    </div>
                    <div className="p-2 text-center">
                      <div className="text-[11px] text-gray-200 font-semibold">{y.toFixed(0)}</div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="text-[10px] text-gray-500 mt-2 text-center">Energy [kWh]</div>
            </div>

            <div className={box + " flex-1 min-h-0 overflow-hidden"}>
              <div className="text-gray-200 font-semibold mb-3">Monthly Summary</div>
              <div className="divide-y divide-gray-800 h-full overflow-y-auto">
                {[
                  "September 2025", "August 2025", "July 2025", "June 2025", 
                  "May 2025", "April 2025", "March 2025", "February 2025"
                ].map((month, i) => {
                  const baseConsumption = i === 0 ? realtimeData.monthConsumption : 
                                        817.69 + i * 45 + Math.sin(i + realtimeData.currentPower/100) * 80;
                  return (
                    <div key={month} className="flex items-center justify-between py-2">
                      <div className="text-[12px] text-gray-300">{month}</div>
                      <div className="text-[12px] text-gray-200 font-semibold">
                        {baseConsumption.toFixed(0)} kWh
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Center Area - Charts */}
          <div className="col-span-12 md:col-span-6 space-y-1.5 h-full flex flex-col">
            {/* L1 Chart */}
            <div className={box + " flex-1 flex flex-col min-h-[140px]"}>
              <div className="flex items-center justify-between mb-2">
                <div className="text-gray-200 font-semibold">Line 1 (L1)</div>
                <div className="flex items-center gap-3">
                  <div className="text-[11px] text-gray-400">kWh</div>
                  <ScaleSwitch currentScale={l1Scale} setScale={setL1Scale} />
                </div>
              </div>
              <div className="relative flex-1 rounded-xl overflow-hidden">
                {(() => {
                  const len = l1Scale === "D" ? 24 : l1Scale === "W" ? 7 : l1Scale === "Y" ? 12 : 30;
                  const base = realtimeData.l1Current;
                  const values = Array.from({ length: len }, (_, i) => {
                    const timeVariation = Math.sin(i * 0.5 + currentTime.getMinutes() * 0.1) * (base * 0.3);
                    return Math.max(5, base + timeVariation + Math.sin(i * 0.3 + realtimeData.currentPower/100) * 5);
                  });
                  const max = 50;
                  const w = 1000, h = 200;
                  const l = 38, r = 12, t = 20, b = 30;
                  const innerW = w - l - r;
                  const innerH = h - t - b;
                  
                  const pathD = values.map((v, i) => {
                    const x = l + (i / (len - 1)) * innerW;
                    const y = t + innerH * (1 - v / max);
                    return `${i === 0 ? 'M' : 'L'}${x},${y}`;
                  }).join(' ');
                  
                  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const mouseX = e.clientX - rect.left;
                    const ratio = Math.max(0, Math.min(1, (mouseX - rect.left * (l / w)) / (rect.width * (innerW / w))));
                    const idx = Math.round(ratio * (len - 1));
                    setL1HoverIdx(idx);
                  };
                  
                  return (
                    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="absolute inset-0 w-full h-full rounded-xl" onMouseMove={handleMove} onMouseLeave={() => setL1HoverIdx(null)} style={{cursor:'crosshair'}}>
                      <rect x={0} y={0} width={w} height={h} fill="#0a0a0a" />
                      <rect x={l} y={t} width={innerW} height={innerH} fill="#000000" stroke="#1f2937" />
                      {/* Y-axis grid and labels */}
                      {[50,40,30,20,10,0].map((val, i) => {
                        const y = t + innerH * (1 - val / max);
                        return (
                          <g key={i}>
                            <line x1={l} x2={l + innerW} y1={y} y2={y} stroke="#1f2937" />
                            <text x={l - 4} y={y + 3} fontSize={9} fill="#ffffff" textAnchor="end">{val}</text>
                          </g>
                        );
                      })}
                      {/* X-axis grid and labels */}
                      {Array.from({ length: len }, (_, i) => {
                        const x = l + (i / (len - 1)) * innerW;
                        const label = l1Scale === "D" ? `${i}:00` : l1Scale === "W" ? ["M","T","W","T","F","S","S"][i] : l1Scale === "Y" ? ["J","F","M","A","M","J","J","A","S","O","N","D"][i] : String(i+1);
                        return (
                          <g key={i}>
                            <line x1={x} x2={x} y1={t} y2={t + innerH} stroke="#1f2937" strokeWidth={0.5} />
                            <text x={x} y={h - 8} fontSize={10} fill="#ffffff" textAnchor="middle">{label}</text>
                          </g>
                        );
                      })}
                      {/* Line path */}
                      <path d={pathD} fill="none" stroke="#ef4444" strokeWidth={2} />
                      {/* Hover tooltip */}
                      {l1HoverIdx !== null && values[l1HoverIdx] !== undefined && (() => {
                        const hoverX = l + (l1HoverIdx / (len - 1)) * innerW;
                        const hoverY = t + innerH * (1 - values[l1HoverIdx] / max);
                        return (
                          <g>
                            <line x1={hoverX} x2={hoverX} y1={t} y2={t + innerH} stroke="#60a5fa" strokeWidth={1.5} strokeDasharray="4 4" opacity={0.8} />
                            <rect x={hoverX > w / 2 ? hoverX - 125 : hoverX + 10} y={t + 10} width={115} height={42} rx={6} fill="#1f2937" stroke="#374151" strokeWidth={1.5} opacity={0.95} />
                            <circle cx={hoverX > w / 2 ? hoverX - 108 : hoverX + 27} cy={t + 31} r={4} fill="#ef4444" />
                            <text x={hoverX > w / 2 ? hoverX - 95 : hoverX + 40} y={t + 35} fontSize={16} fill="#f3f4f6" fontWeight="700">{values[l1HoverIdx].toFixed(1)} kWh</text>
                            <circle cx={hoverX} cy={hoverY} r={4} fill="#ef4444" stroke="#1f2937" strokeWidth={2} />
                          </g>
                        );
                      })()}
                    </svg>
                  );
                })()}
              </div>
            </div>

            {/* L2 Chart */}
            <div className={box + " flex-1 flex flex-col min-h-[140px]"}>
              <div className="flex items-center justify-between mb-2">
                <div className="text-gray-200 font-semibold">Line 2 (L2)</div>
                <div className="flex items-center gap-3">
                  <div className="text-[11px] text-gray-400">kWh</div>
                  <ScaleSwitch currentScale={l2Scale} setScale={setL2Scale} />
                </div>
              </div>
              <div className="relative flex-1 rounded-xl overflow-hidden">
                {(() => {
                  const len = l2Scale === "D" ? 24 : l2Scale === "W" ? 7 : l2Scale === "Y" ? 12 : 30;
                  const base = realtimeData.l2Current;
                  const values = Array.from({ length: len }, (_, i) => {
                    const timeVariation = Math.sin(i * 0.7 + currentTime.getMinutes() * 0.15) * (base * 0.25);
                    return Math.max(3, base + timeVariation + Math.sin(i * 0.4 + realtimeData.currentPower/120) * 4);
                  });
                  const max = 50;
                  const w = 1000, h = 200;
                  const l = 38, r = 12, t = 20, b = 30;
                  const innerW = w - l - r;
                  const innerH = h - t - b;
                  
                  const pathD = values.map((v, i) => {
                    const x = l + (i / (len - 1)) * innerW;
                    const y = t + innerH * (1 - v / max);
                    return `${i === 0 ? 'M' : 'L'}${x},${y}`;
                  }).join(' ');
                  
                  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const mouseX = e.clientX - rect.left;
                    const ratio = Math.max(0, Math.min(1, (mouseX - rect.left * (l / w)) / (rect.width * (innerW / w))));
                    const idx = Math.round(ratio * (len - 1));
                    setL2HoverIdx(idx);
                  };
                  
                  return (
                    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="absolute inset-0 w-full h-full rounded-xl" onMouseMove={handleMove} onMouseLeave={() => setL2HoverIdx(null)} style={{cursor:'crosshair'}}>
                      <rect x={0} y={0} width={w} height={h} fill="#0a0a0a" />
                      <rect x={l} y={t} width={innerW} height={innerH} fill="#000000" stroke="#1f2937" />
                      {/* Y-axis grid and labels */}
                      {[50,40,30,20,10,0].map((val, i) => {
                        const y = t + innerH * (1 - val / max);
                        return (
                          <g key={i}>
                            <line x1={l} x2={l + innerW} y1={y} y2={y} stroke="#1f2937" />
                            <text x={l - 4} y={y + 3} fontSize={9} fill="#ffffff" textAnchor="end">{val}</text>
                          </g>
                        );
                      })}
                      {/* X-axis grid and labels */}
                      {Array.from({ length: len }, (_, i) => {
                        const x = l + (i / (len - 1)) * innerW;
                        const label = l2Scale === "D" ? `${i}:00` : l2Scale === "W" ? ["M","T","W","T","F","S","S"][i] : l2Scale === "Y" ? ["J","F","M","A","M","J","J","A","S","O","N","D"][i] : String(i+1);
                        return (
                          <g key={i}>
                            <line x1={x} x2={x} y1={t} y2={t + innerH} stroke="#1f2937" strokeWidth={0.5} />
                            <text x={x} y={h - 8} fontSize={10} fill="#ffffff" textAnchor="middle">{label}</text>
                          </g>
                        );
                      })}
                      {/* Line path */}
                      <path d={pathD} fill="none" stroke="#3b82f6" strokeWidth={2} />
                      {/* Hover tooltip */}
                      {l2HoverIdx !== null && values[l2HoverIdx] !== undefined && (() => {
                        const hoverX = l + (l2HoverIdx / (len - 1)) * innerW;
                        const hoverY = t + innerH * (1 - values[l2HoverIdx] / max);
                        return (
                          <g>
                            <line x1={hoverX} x2={hoverX} y1={t} y2={t + innerH} stroke="#60a5fa" strokeWidth={1.5} strokeDasharray="4 4" opacity={0.8} />
                            <rect x={hoverX > w / 2 ? hoverX - 125 : hoverX + 10} y={t + 10} width={115} height={42} rx={6} fill="#1f2937" stroke="#374151" strokeWidth={1.5} opacity={0.95} />
                            <circle cx={hoverX > w / 2 ? hoverX - 108 : hoverX + 27} cy={t + 31} r={4} fill="#3b82f6" />
                            <text x={hoverX > w / 2 ? hoverX - 95 : hoverX + 40} y={t + 35} fontSize={16} fill="#f3f4f6" fontWeight="700">{values[l2HoverIdx].toFixed(1)} kWh</text>
                            <circle cx={hoverX} cy={hoverY} r={4} fill="#3b82f6" stroke="#1f2937" strokeWidth={2} />
                          </g>
                        );
                      })()}
                    </svg>
                  );
                })()}
              </div>
            </div>

            {/* L3 Chart */}
            <div className={box + " flex-1 flex flex-col min-h-[140px]"}>
              <div className="flex items-center justify-between mb-2">
                <div className="text-gray-200 font-semibold">Line 3 (L3)</div>
                <div className="flex items-center gap-3">
                  <div className="text-[11px] text-gray-400">kWh</div>
                  <ScaleSwitch currentScale={l3Scale} setScale={setL3Scale} />
                </div>
              </div>
              <div className="relative flex-1 rounded-xl overflow-hidden">
                {(() => {
                  const len = l3Scale === "D" ? 24 : l3Scale === "W" ? 7 : l3Scale === "Y" ? 12 : 30;
                  const base = realtimeData.l3Current;
                  const values = Array.from({ length: len }, (_, i) => {
                    const timeVariation = Math.sin(i * 0.9 + currentTime.getMinutes() * 0.12) * (base * 0.2);
                    return Math.max(2, base + timeVariation + Math.sin(i * 0.6 + realtimeData.currentPower/150) * 3);
                  });
                  const max = 50;
                  const w = 1000, h = 200;
                  const l = 38, r = 12, t = 20, b = 30;
                  const innerW = w - l - r;
                  const innerH = h - t - b;
                  
                  const pathD = values.map((v, i) => {
                    const x = l + (i / (len - 1)) * innerW;
                    const y = t + innerH * (1 - v / max);
                    return `${i === 0 ? 'M' : 'L'}${x},${y}`;
                  }).join(' ');
                  
                  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const mouseX = e.clientX - rect.left;
                    const ratio = Math.max(0, Math.min(1, (mouseX - rect.left * (l / w)) / (rect.width * (innerW / w))));
                    const idx = Math.round(ratio * (len - 1));
                    setL3HoverIdx(idx);
                  };
                  
                  return (
                    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="absolute inset-0 w-full h-full rounded-xl" onMouseMove={handleMove} onMouseLeave={() => setL3HoverIdx(null)} style={{cursor:'crosshair'}}>
                      <rect x={0} y={0} width={w} height={h} fill="#0a0a0a" />
                      <rect x={l} y={t} width={innerW} height={innerH} fill="#000000" stroke="#1f2937" />
                      {/* Y-axis grid and labels */}
                      {[50,40,30,20,10,0].map((val, i) => {
                        const y = t + innerH * (1 - val / max);
                        return (
                          <g key={i}>
                            <line x1={l} x2={l + innerW} y1={y} y2={y} stroke="#1f2937" />
                            <text x={l - 4} y={y + 3} fontSize={9} fill="#ffffff" textAnchor="end">{val}</text>
                          </g>
                        );
                      })}
                      {/* X-axis grid and labels */}
                      {Array.from({ length: len }, (_, i) => {
                        const x = l + (i / (len - 1)) * innerW;
                        const label = l3Scale === "D" ? `${i}:00` : l3Scale === "W" ? ["M","T","W","T","F","S","S"][i] : l3Scale === "Y" ? ["J","F","M","A","M","J","J","A","S","O","N","D"][i] : String(i+1);
                        return (
                          <g key={i}>
                            <line x1={x} x2={x} y1={t} y2={t + innerH} stroke="#1f2937" strokeWidth={0.5} />
                            <text x={x} y={h - 8} fontSize={10} fill="#ffffff" textAnchor="middle">{label}</text>
                          </g>
                        );
                      })}
                      {/* Line path */}
                      <path d={pathD} fill="none" stroke="#fbbf24" strokeWidth={2} />
                      {/* Hover tooltip */}
                      {l3HoverIdx !== null && values[l3HoverIdx] !== undefined && (() => {
                        const hoverX = l + (l3HoverIdx / (len - 1)) * innerW;
                        const hoverY = t + innerH * (1 - values[l3HoverIdx] / max);
                        return (
                          <g>
                            <line x1={hoverX} x2={hoverX} y1={t} y2={t + innerH} stroke="#60a5fa" strokeWidth={1.5} strokeDasharray="4 4" opacity={0.8} />
                            <rect x={hoverX > w / 2 ? hoverX - 125 : hoverX + 10} y={t + 10} width={115} height={42} rx={6} fill="#1f2937" stroke="#374151" strokeWidth={1.5} opacity={0.95} />
                            <circle cx={hoverX > w / 2 ? hoverX - 108 : hoverX + 27} cy={t + 31} r={4} fill="#fbbf24" />
                            <text x={hoverX > w / 2 ? hoverX - 95 : hoverX + 40} y={t + 35} fontSize={16} fill="#f3f4f6" fontWeight="700">{values[l3HoverIdx].toFixed(1)} kWh</text>
                            <circle cx={hoverX} cy={hoverY} r={4} fill="#fbbf24" stroke="#1f2937" strokeWidth={2} />
                          </g>
                        );
                      })()}
                    </svg>
                  );
                })()}
              </div>
            </div>

            {/* Total Usage Chart (3 lines: L1/L2/L3) */}
            <div className={box + " flex-1 flex flex-col min-h-[160px]"}>
              <div className="flex items-center justify-between mb-2">
                <div className="text-gray-200 font-semibold">Total Usage (L1/L2/L3)</div>
                <div className="flex items-center gap-3">
                  {/* legend */}
                  <div className="hidden md:flex items-center gap-3 mr-1">
                    <div className="flex items-center gap-1 text-[10px] text-gray-300"><span className="w-2 h-2 rounded-full bg-red-400 inline-block"></span>L1</div>
                    <div className="flex items-center gap-1 text-[10px] text-gray-300"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block"></span>L2</div>
                    <div className="flex items-center gap-1 text-[10px] text-gray-300"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block"></span>L3</div>
                  </div>
                  <div className="text-[11px] text-gray-400">kWh</div>
                  <ScaleSwitch currentScale={totalScale} setScale={setTotalScale} />
                </div>
              </div>
              
              <div className="bg-gray-950 border border-gray-800 rounded-lg p-2 flex-1">
                <div className="flex h-full">
                  {/* Y-axis with values */}
                  <div className="flex flex-col justify-between h-full w-8 mr-2">
                    {[100, 80, 60, 40, 20, 0].map((val, i) => (
                      <div key={i} className="flex items-center">
                        <div className="text-[9px] text-white text-right w-6">{val}</div>
                        <div className="w-2 h-px bg-gray-700 ml-1"></div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Line chart area: render L1, L2, L3 as separate lines */}
                  <div className="flex-1 flex flex-col">
                    <div className="relative flex-1">
                      {(() => {
                        const len = totalScale === "D" ? 24 : totalScale === "W" ? 7 : totalScale === "Y" ? 12 : 30;
                        const baseL1 = realtimeData.l1Current;
                        const baseL2 = realtimeData.l2Current;
                        const baseL3 = realtimeData.l3Current;
                        const l1Values = Array.from({ length: len }, (_, i) =>
                          Math.max(5, baseL1 + Math.sin(i * 0.5 + currentTime.getMinutes() * 0.1) * (baseL1 * 0.3))
                        );
                        const l2Values = Array.from({ length: len }, (_, i) =>
                          Math.max(3, baseL2 + Math.sin(i * 0.7 + currentTime.getMinutes() * 0.15) * (baseL2 * 0.25))
                        );
                        const l3Values = Array.from({ length: len }, (_, i) =>
                          Math.max(2, baseL3 + Math.sin(i * 0.9 + currentTime.getMinutes() * 0.12) * (baseL3 * 0.2))
                        );
                        const { d: d1, width, height } = buildLinePaths(l1Values, 100);
                        const { d: d2 } = buildLinePaths(l2Values, 100);
                        const { d: d3 } = buildLinePaths(l3Values, 100);
                        const handleMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
                          const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
                          const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                          const idx = Math.round(ratio * (len - 1));
                          setTotalHoverIdx(idx);
                        };
                        return (
                          <svg
                            viewBox={`0 0 ${width} ${height}`}
                            preserveAspectRatio="none"
                            className="absolute inset-0 w-full h-full"
                            onMouseMove={handleMove}
                            onMouseLeave={() => setTotalHoverIdx(null)}
                            style={{ cursor: 'crosshair' }}
                          >
                            {[0,1,2,3,4,5].map(i => (
                              <line key={i} x1={0} x2={width} y1={(i*(height/5))} y2={(i*(height/5))} stroke="#374151" opacity="0.5" strokeWidth={1} />
                            ))}
                            {/* lines */}
                            <path d={d1} fill="none" stroke="#ef4444" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                            <path d={d2} fill="none" stroke="#3b82f6" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                            <path d={d3} fill="none" stroke="#fbbf24" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />

                            {totalHoverIdx !== null && totalHoverIdx >= 0 && totalHoverIdx < len && (() => {
                              const idx = totalHoverIdx;
                              const x = (idx/(len-1)) * width;
                              const clamp = (v:number, max=100)=> Math.max(0, Math.min(max, v));
                              const y1 = height - (clamp(l1Values[idx],100)/100) * height;
                              const y2 = height - (clamp(l2Values[idx],100)/100) * height;
                              const y3 = height - (clamp(l3Values[idx],100)/100) * height;
                              return (
                                <g>
                                  {/* Crosshair line */}
                                  <line x1={x} x2={x} y1={0} y2={height} stroke="#60a5fa" strokeWidth={1.5} strokeDasharray="4 4" opacity={0.8} />
                                  {/* Tooltip background - spacious */}
                                  <rect x={x < width/2 ? x + 10 : x - 170} y={15} width={160} height={105} rx={8} fill="#1f2937" stroke="#374151" strokeWidth={1.5} opacity={0.95} />
                                  {/* L1 */}
                                  <circle cx={x < width/2 ? x + 25 : x - 155} cy={40} r={5} fill="#ef4444" />
                                  <text x={x < width/2 ? x + 38 : x - 142} y={45} fontSize={16} fill="#9ca3af" fontWeight="600">L1:</text>
                                  <text x={x < width/2 ? x + 160 : x - 20} y={45} fontSize={18} fill="#f3f4f6" fontWeight="700" textAnchor="end">{l1Values[idx].toFixed(1)} kWh</text>
                                  {/* L2 */}
                                  <circle cx={x < width/2 ? x + 25 : x - 155} cy={70} r={5} fill="#3b82f6" />
                                  <text x={x < width/2 ? x + 38 : x - 142} y={75} fontSize={16} fill="#9ca3af" fontWeight="600">L2:</text>
                                  <text x={x < width/2 ? x + 160 : x - 20} y={75} fontSize={18} fill="#f3f4f6" fontWeight="700" textAnchor="end">{l2Values[idx].toFixed(1)} kWh</text>
                                  {/* L3 */}
                                  <circle cx={x < width/2 ? x + 25 : x - 155} cy={100} r={5} fill="#fbbf24" />
                                  <text x={x < width/2 ? x + 38 : x - 142} y={105} fontSize={16} fill="#9ca3af" fontWeight="600">L3:</text>
                                  <text x={x < width/2 ? x + 160 : x - 20} y={105} fontSize={18} fill="#f3f4f6" fontWeight="700" textAnchor="end">{l3Values[idx].toFixed(1)} kWh</text>
                                  {/* Data point circles */}
                                  <circle cx={x} cy={y1} r={5} fill="#ef4444" stroke="#1f2937" strokeWidth={2} />
                                  <circle cx={x} cy={y2} r={5} fill="#3b82f6" stroke="#1f2937" strokeWidth={2} />
                                  <circle cx={x} cy={y3} r={5} fill="#fbbf24" stroke="#1f2937" strokeWidth={2} />
                                </g>
                              );
                            })()}
                          </svg>
                        );
                      })()}
                    </div>
                    {(() => {
                      const len = totalScale === "D" ? 24 : totalScale === "W" ? 7 : totalScale === "Y" ? 12 : 30;
                      return (
                        <div className="mt-1 relative h-4">
                          {Array.from({ length: len }, (_, i) => (
                            <div
                              key={i}
                              className="absolute text-[8px] text-white text-center"
                              style={{ left: `${(i / (len - 1)) * 100}%`, transform: 'translateX(-50%)' }}
                            >
                              {totalScale === "D" ? i : totalScale === "W" ? ["M","T","W","T","F","S","S"][i] : totalScale === "Y" ? ["J","F","M","A","M","J","J","A","S","O","N","D"][i] : i+1}
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Power, Export Data, Active Alerts */}
          <div className="col-span-12 md:col-span-3 space-y-1.5 h-full flex flex-col">
            {/* Power Section - Fixed Size */}
            <div className={box + " relative overflow-hidden flex-none"}>
              {/* POWER Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="text-gray-200 font-semibold">Power</div>
                {powerTrend !== 'same' && (
                  <div className={`text-[10px] flex items-center gap-1 font-semibold ${powerTrend === 'up' ? 'text-green-400' : 'text-red-400'}`}>
                    {powerTrend === 'up' ? '▲' : '▼'}
                    <span>{Math.abs(realtimeData.currentPower - prevPowerRef.current).toFixed(0)}W</span>
                  </div>
                )}
              </div>
              {/* Grid Rows */}
              <div className="grid grid-cols-2 gap-y-1">
                {/* NOW Row */}
                <div className="text-[14px] md:text-[15px] font-bold text-lime-400">Now</div>
                <div className="text-right text-[16px] md:text-[18px] font-bold flex items-center justify-end gap-2">
                  <span className={`${realtimeData.currentPower > 450 ? 'text-red-400' : realtimeData.currentPower > 350 ? 'text-yellow-400' : 'text-white'}`}>{realtimeData.currentPower.toFixed(0)}</span>
                  <span className="text-gray-400 text-[11px] font-medium">W</span>
                </div>
                {/* Hour */}
                <div className="text-[13px] md:text-[14px] font-semibold text-lime-400">Hour</div>
                <div className="text-right text-[13px] md:text-[14px] text-gray-200">{realtimeData.hourConsumption.toFixed(1)} <span className="text-[10px] text-gray-400">kWh</span></div>
                {/* Day */}
                <div className="text-[13px] md:text-[14px] font-semibold text-lime-400">Day</div>
                <div className="text-right text-[13px] md:text-[14px] text-gray-200">{realtimeData.dayConsumption.toFixed(1)} <span className="text-[10px] text-gray-400">kWh</span></div>
                {/* Month */}
                <div className="text-[13px] md:text-[14px] font-semibold text-lime-400">Month</div>
                <div className="text-right text-[13px] md:text-[14px] text-gray-200">{formatEnergy(realtimeData.monthConsumption,0)} <span className="text-[10px] text-gray-400">kWh</span></div>
                {/* Year */}
                <div className="text-[13px] md:text-[14px] font-semibold text-lime-400">Year</div>
                <div className="text-right text-[13px] md:text-[14px] text-gray-200">{formatEnergy(realtimeData.yearConsumption,0)} <span className="text-[10px] text-gray-400">kWh</span></div>
                {/* TOTAL */}
                <div className="pt-1 mt-1 border-t border-gray-700 text-[13px] md:text-[14px] font-semibold text-gray-200">TOTAL</div>
                <div className="pt-1 mt-1 border-t border-gray-700 text-right text-[14px] md:text-[15px] font-bold text-white">{formatEnergy(realtimeData.totalConsumption,0)} <span className="text-[10px] text-gray-400 font-medium">kWh</span></div>
              </div>
            </div>

            {/* Export Data Section - Flexible with scroll */}
            <div className={box + " flex-[3] min-h-0 overflow-auto"}>
              <div className="flex items-center gap-2 mb-3">
                <div className="text-gray-200 font-semibold">Export Data</div>
              </div>
              
              <div className="space-y-2">
                {showCustomExport ? (
                  <div className="p-3 border border-teal-700/50 rounded-lg bg-gray-900/60">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[13px] font-semibold text-gray-200">Custom Export</div>
                      <button
                        onClick={() => setShowCustomExport(false)}
                        className="text-[11px] px-2 py-1 rounded border border-gray-600 text-gray-300 hover:bg-gray-700"
                      >
                        Back
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] text-gray-300 w-14">From</label>
                        <input
                          type="date"
                          value={customFrom}
                          onChange={(e) => setCustomFrom(e.target.value)}
                          max={todayStr}
                          className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-[12px] text-gray-200 focus:outline-none focus:ring-1 focus:ring-teal-500"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] text-gray-300 w-14">To</label>
                        <input
                          type="date"
                          value={customTo}
                          onChange={(e) => setCustomTo(e.target.value)}
                          min={customFrom}
                          max={todayStr}
                          className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-[12px] text-gray-200 focus:outline-none focus:ring-1 focus:ring-teal-500"
                        />
                      </div>
                      <div className="flex justify-end">
                        <button
                          onClick={handleCustomExport}
                          className="px-3 py-1.5 text-[12px] font-semibold text-white bg-teal-600 hover:bg-teal-500 border border-teal-500 rounded-md"
                        >
                          Export
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => handleExportData('month')}
                      className="group w-full flex items-center justify-between py-3 px-3 bg-gradient-to-r from-blue-900/40 to-blue-800/40 hover:from-blue-800/60 hover:to-blue-700/60 border border-blue-700/50 hover:border-blue-600/70 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-blue-600/20 rounded-lg flex items-center justify-center group-hover:bg-blue-600/30 transition-colors">
                          <svg className="w-3.5 h-3.5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="text-left">
                          <div className="text-[12px] font-medium text-gray-200">Monthly Data</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] px-1.5 py-0.5 bg-green-600/20 text-green-400 rounded-full font-medium">Excel</span>
                        <svg className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3" />
                        </svg>
                      </div>
                    </button>

                    <button
                      onClick={() => handleExportData('week')}
                      className="group w-full flex items-center justify-between py-3 px-3 bg-gradient-to-r from-purple-900/40 to-purple-800/40 hover:from-purple-800/60 hover:to-purple-700/60 border border-purple-700/50 hover:border-purple-600/70 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-purple-600/20 rounded-lg flex items-center justify-center group-hover:bg-purple-600/30 transition-colors">
                          <svg className="w-3.5 h-3.5 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="text-left">
                          <div className="text-[12px] font-medium text-gray-200">Weekly Data</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] px-1.5 py-0.5 bg-green-600/20 text-green-400 rounded-full font-medium">Excel</span>
                        <svg className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3" />
                        </svg>
                      </div>
                    </button>

                    <button
                      onClick={() => handleExportData('consumption')}
                      className="group w-full flex items-center justify-between py-3 px-3 bg-gradient-to-r from-orange-900/40 to-orange-800/40 hover:from-orange-800/60 hover:to-orange-700/60 border border-orange-700/50 hover:border-orange-600/70 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-orange-600/20 rounded-lg flex items-center justify-center group-hover:bg-orange-600/30 transition-colors">
                          <svg className="w-3.5 h-3.5 text-orange-400" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div className="text-left">
                          <div className="text-[12px] font-medium text-gray-200">Annual Consumption</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] px-1.5 py-0.5 bg-green-600/20 text-green-400 rounded-full font-medium">Excel</span>
                        <svg className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3" />
                        </svg>
                      </div>
                    </button>

                    <button
                      onClick={() => setShowCustomExport(true)}
                      className="group w-full flex items-center justify-between py-3 px-3 bg-gradient-to-r from-teal-900/40 to-teal-800/40 hover:from-teal-800/60 hover:to-teal-700/60 border border-teal-700/50 hover:border-teal-600/70 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-teal-600/20 rounded-lg flex items-center justify-center group-hover:bg-teal-600/30 transition-colors">
                          <svg className="w-3.5 h-3.5 text-teal-300" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm-1 7a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="text-left">
                          <div className="text-[12px] font-medium text-gray-200">Custom</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] px-1.5 py-0.5 bg-green-600/20 text-green-400 rounded-full font-medium">Excel</span>
                        <svg className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3" />
                        </svg>
                      </div>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Active Alerts Section - Flexible */}
            <div className={box + " flex-[2] min-h-0 overflow-hidden flex flex-col"}>
              <div className="text-gray-200 font-semibold mb-3 flex-none">Active Alerts</div>
              <div className="flex flex-col gap-2 overflow-y-auto pr-1">
                <div className="flex items-center gap-2 p-2 bg-blue-900/30 border border-blue-700/50 rounded-lg">
                  <div className="w-2 h-2 bg-blue-500 rounded-full" />
                  <div className="text-[12px] text-blue-200">System Normal</div>
                </div>
                <div className="flex items-center gap-2 p-2 bg-red-900/30 border border-red-700/50 rounded-lg">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <div className="text-[12px] text-red-200">Sensor Offline</div>
                </div>
                <div className="flex items-center gap-2 p-2 bg-yellow-900/30 border border-yellow-700/50 rounded-lg">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                  <div className="text-[12px] text-yellow-200">Temperature High</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
