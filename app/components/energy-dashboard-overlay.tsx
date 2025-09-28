"use client";

import React, { useState, useEffect, useRef } from "react";
import type { Sensor } from "@/app/context/sensor-context";

interface Props {
  sensor?: Sensor | null;
  onClose: () => void;
}

export default function EnergyDashboardOverlay({ sensor, onClose }: Props) {
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
          temperature: Math.max(-2, Math.min(12, prev.temperature + (Math.random() - 0.5) * 2)),
          humidity: Math.max(40, Math.min(85, prev.humidity + (Math.random() - 0.5) * 5)),
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
    <div className="fixed left-0 right-0 bottom-0 top-16 z-[2000] flex flex-col bg-gray-950/98">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 bg-gray-900/70">
        <div className="flex items-baseline gap-3">
          <h3 className="text-lg font-bold text-white">Energy Statistics Dashboard</h3>
          {sensor?.name && <div className="text-xs text-gray-400">Sensor: {sensor.name}</div>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="px-3 py-1.5 rounded-md bg-gray-700 hover:bg-gray-600 text-white text-sm border border-gray-600">
            Close ×
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="grid grid-cols-12 gap-2 max-w-none mx-auto">
          
          {/* Left Column - Time-of-Use & Monthly Summary */}
          <div className="col-span-12 md:col-span-3 space-y-1.5">
            <div className={box}>
              <div className="text-gray-200 font-semibold mb-3">Energy Consumption</div>
              
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

            <div className={box}>
              <div className="text-gray-200 font-semibold mb-3">Monthly Summary</div>
              <div className="divide-y divide-gray-800">
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
          <div className="col-span-12 md:col-span-6 space-y-1.5">
            {/* L1 Chart */}
            <div className={box}>
              <div className="flex items-center justify-between mb-2">
                <div className="text-gray-200 font-semibold">Line 1 (L1)</div>
                <div className="flex items-center gap-3">
                  <div className="text-[11px] text-gray-400">kWh</div>
                  <ScaleSwitch currentScale={l1Scale} setScale={setL1Scale} />
                </div>
              </div>
              <div className="bg-gray-950 border border-gray-800 rounded-lg p-2 h-28">
                <div className="flex h-full">
                  {/* Y-axis */}
                  <div className="flex flex-col justify-between h-full w-8 mr-2">
                    {[50,40,30,20,10,0].map((val,i)=>(
                      <div key={i} className="flex items-center">
                        <div className="text-[9px] text-white w-6 text-right">{val}</div>
                        <div className="w-2 h-px bg-gray-700 ml-1"></div>
                      </div>
                    ))}
                  </div>
                  {/* Bars area */}
                  <div className="flex-1 flex flex-col">
                    <div className="relative flex-1 flex items-end justify-between gap-1">
                      {Array.from({ length: l1Scale === "D" ? 24 : l1Scale === "W" ? 7 : l1Scale === "Y" ? 12 : 30 }, (_, i) => {
                        const baseValue = realtimeData.l1Current;
                        const timeVariation = Math.sin(i * 0.5 + currentTime.getMinutes() * 0.1) * (baseValue * 0.3);
                        const value = Math.max(5, baseValue + timeVariation + Math.sin(i * 0.3 + realtimeData.currentPower/100) * 5);
                        return (
                          <div key={i} className="flex flex-col items-center gap-1 flex-1 relative group">
                            {/* Tooltip */}
                            <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 whitespace-nowrap">
                              <div className="text-blue-300">L1: {value.toFixed(1)} kWh</div>
                            </div>
                            <div className="flex items-end h-20">
                              <div className="bg-blue-500 rounded-sm min-w-[6px] transition-all duration-200 hover:brightness-110" style={{ height: `${(value/50)*100}%` }} title={`L1: ${value.toFixed(1)} kWh`} />
                            </div>
                            <div className="text-[8px] text-white text-center">
                              {l1Scale === "D" ? i : l1Scale === "W" ? ["M","T","W","T","F","S","S"][i] : l1Scale === "Y" ? ["J","F","M","A","M","J","J","A","S","O","N","D"][i] : i+1}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* L2 Chart */}
            <div className={box}>
              <div className="flex items-center justify-between mb-2">
                <div className="text-gray-200 font-semibold">Line 2 (L2)</div>
                <div className="flex items-center gap-3">
                  <div className="text-[11px] text-gray-400">kWh</div>
                  <ScaleSwitch currentScale={l2Scale} setScale={setL2Scale} />
                </div>
              </div>
              <div className="bg-gray-950 border border-gray-800 rounded-lg p-2 h-28">
                <div className="flex h-full">
                  {/* Y-axis */}
                  <div className="flex flex-col justify-between h-full w-8 mr-2">
                    {[50,40,30,20,10,0].map((val,i)=>(
                      <div key={i} className="flex items-center">
                        <div className="text-[9px] text-white w-6 text-right">{val}</div>
                        <div className="w-2 h-px bg-gray-700 ml-1"></div>
                      </div>
                    ))}
                  </div>
                  {/* Bars area */}
                  <div className="flex-1 flex flex-col">
                    <div className="relative flex-1 flex items-end justify-between gap-1">
                      {Array.from({ length: l2Scale === "D" ? 24 : l2Scale === "W" ? 7 : l2Scale === "Y" ? 12 : 30 }, (_, i) => {
                        const baseValue = realtimeData.l2Current;
                        const timeVariation = Math.sin(i * 0.7 + currentTime.getMinutes() * 0.15) * (baseValue * 0.25);
                        const value = Math.max(3, baseValue + timeVariation + Math.sin(i * 0.4 + realtimeData.currentPower/120) * 4);
                        return (
                          <div key={i} className="flex flex-col items-center gap-1 flex-1 relative group">
                            {/* Tooltip */}
                            <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 whitespace-nowrap">
                              <div className="text-green-300">L2: {value.toFixed(1)} kWh</div>
                            </div>
                            <div className="flex items-end h-20">
                              <div className="bg-green-500 rounded-sm min-w-[6px] transition-all duration-200 hover:brightness-110" style={{ height: `${(value/50)*100}%` }} title={`L2: ${value.toFixed(1)} kWh`} />
                            </div>
                            <div className="text-[8px] text-white text-center">
                              {l2Scale === "D" ? i : l2Scale === "W" ? ["M","T","W","T","F","S","S"][i] : l2Scale === "Y" ? ["J","F","M","A","M","J","J","A","S","O","N","D"][i] : i+1}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* L3 Chart */}
            <div className={box}>
              <div className="flex items-center justify-between mb-2">
                <div className="text-gray-200 font-semibold">Line 3 (L3)</div>
                <div className="flex items-center gap-3">
                  <div className="text-[11px] text-gray-400">kWh</div>
                  <ScaleSwitch currentScale={l3Scale} setScale={setL3Scale} />
                </div>
              </div>
              <div className="bg-gray-950 border border-gray-800 rounded-lg p-2 h-28">
                <div className="flex h-full">
                  {/* Y-axis */}
                  <div className="flex flex-col justify-between h-full w-8 mr-2">
                    {[50,40,30,20,10,0].map((val,i)=>(
                      <div key={i} className="flex items-center">
                        <div className="text-[9px] text-white w-6 text-right">{val}</div>
                        <div className="w-2 h-px bg-gray-700 ml-1"></div>
                      </div>
                    ))}
                  </div>
                  {/* Bars area */}
                  <div className="flex-1 flex flex-col">
                    <div className="relative flex-1 flex items-end justify-between gap-1">
                      {Array.from({ length: l3Scale === "D" ? 24 : l3Scale === "W" ? 7 : l3Scale === "Y" ? 12 : 30 }, (_, i) => {
                        const baseValue = realtimeData.l3Current;
                        const timeVariation = Math.sin(i * 0.9 + currentTime.getMinutes() * 0.12) * (baseValue * 0.2);
                        const value = Math.max(2, baseValue + timeVariation + Math.sin(i * 0.6 + realtimeData.currentPower/150) * 3);
                        return (
                          <div key={i} className="flex flex-col items-center gap-1 flex-1 relative group">
                            {/* Tooltip */}
                            <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 whitespace-nowrap">
                              <div className="text-yellow-300">L3: {value.toFixed(1)} kWh</div>
                            </div>
                            <div className="flex items-end h-20">
                              <div className="bg-yellow-500 rounded-sm min-w-[6px] transition-all duration-200 hover:brightness-110" style={{ height: `${(value/50)*100}%` }} title={`L3: ${value.toFixed(1)} kWh`} />
                            </div>
                            <div className="text-[8px] text-white text-center">
                              {l3Scale === "D" ? i : l3Scale === "W" ? ["M","T","W","T","F","S","S"][i] : l3Scale === "Y" ? ["J","F","M","A","M","J","J","A","S","O","N","D"][i] : i+1}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Total Usage Chart */}
            <div className={box}>
              <div className="flex items-center justify-between mb-2">
                <div className="text-gray-200 font-semibold">Total Usage (Stacked)</div>
                <div className="flex items-center gap-3">
                  <div className="text-[11px] text-gray-400">kWh</div>
                  <ScaleSwitch currentScale={totalScale} setScale={setTotalScale} />
                </div>
              </div>
              
              <div className="bg-gray-950 border border-gray-800 rounded-lg p-2 h-40">
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
                  
                  {/* Chart area */}
                  <div className="flex-1 flex items-end justify-between h-full gap-1 relative">
                    {/* Horizontal grid lines */}
                    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                      {[0, 1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="w-full h-px bg-gray-800 opacity-50"></div>
                      ))}
                    </div>
                    
                    {/* Bars */}
                    {Array.from({ length: totalScale === "D" ? 24 : totalScale === "W" ? 7 : totalScale === "Y" ? 12 : 30 }, (_, i) => {
                      const baseL1 = realtimeData.l1Current;
                      const baseL2 = realtimeData.l2Current;
                      const baseL3 = realtimeData.l3Current;
                      
                      const l1 = Math.max(5, baseL1 + Math.sin(i * 0.5 + currentTime.getMinutes() * 0.1) * (baseL1 * 0.3));
                      const l2 = Math.max(3, baseL2 + Math.sin(i * 0.7 + currentTime.getMinutes() * 0.15) * (baseL2 * 0.25));
                      const l3 = Math.max(2, baseL3 + Math.sin(i * 0.9 + currentTime.getMinutes() * 0.12) * (baseL3 * 0.2));
                      const total = l1 + l2 + l3;
                      
                      return (
                        <div key={i} className="flex flex-col items-center gap-1 flex-1 relative group">
                          {/* Tooltip */}
                          <div className="absolute -top-14 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 whitespace-nowrap">
                            <div>Total: {total.toFixed(1)} kWh</div>
                            <div className="text-blue-300">L1: {l1.toFixed(1)} kWh</div>
                            <div className="text-green-300">L2: {l2.toFixed(1)} kWh</div>
                            <div className="text-yellow-300">L3: {l3.toFixed(1)} kWh</div>
                          </div>
                          
                          {/* Stacked bars */}
                          <div className="flex flex-col h-28 justify-end min-w-[6px] relative">
                            <div 
                              className="bg-blue-500 rounded-t-sm transition-all duration-300 hover:brightness-110" 
                              style={{ height: `${(l1/100)*100}%` }}
                              title={`L1: ${l1.toFixed(1)} kWh`}
                            />
                            <div 
                              className="bg-green-500 transition-all duration-300 hover:brightness-110" 
                              style={{ height: `${(l2/100)*100}%` }}
                              title={`L2: ${l2.toFixed(1)} kWh`}
                            />
                            <div 
                              className="bg-yellow-500 rounded-b-sm transition-all duration-300 hover:brightness-110" 
                              style={{ height: `${(l3/100)*100}%` }}
                              title={`L3: ${l3.toFixed(1)} kWh`}
                            />
                          </div>
                          
                          {/* X-axis labels */}
                          <div className="text-[8px] text-white text-center">
                            {totalScale === "D" ? i : totalScale === "W" ? ["M","T","W","T","F","S","S"][i] : totalScale === "Y" ? ["J","F","M","A","M","J","J","A","S","O","N","D"][i] : i+1}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Weather, Power, Alerts */}
          <div className="col-span-12 md:col-span-3 space-y-1.5">
            <div className={box}>
              <div className="text-gray-200 font-semibold mb-3">Weather Condition</div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-2xl">{realtimeData.temperature > 8 ? "☀️" : realtimeData.temperature > 0 ? "⛅" : "❄️"}</div>
                <div className="text-right">
                  <div className={`text-2xl font-bold ${realtimeData.temperature > 5 ? 'text-green-400' : realtimeData.temperature > 0 ? 'text-yellow-400' : 'text-blue-400'}`}>
                    {realtimeData.temperature > 0 ? '+' : ''}{realtimeData.temperature.toFixed(1)}°C
                  </div>
                  <div className="text-[11px] text-gray-400">Delhi</div>
                </div>
              </div>
              <div className="space-y-1 text-[12px]">
                <div className="flex justify-between">
                  <span className="text-gray-400">Humidity:</span>
                  <span className="text-gray-200">{realtimeData.humidity.toFixed(0)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Sunrise:</span>
                  <span className="text-gray-200">06:51</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Sunset:</span>
                  <span className="text-gray-200">18:46</span>
                </div>
              </div>
            </div>

            <div className={box + " relative overflow-hidden"}>
              {/* POWER Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="text-[11px] tracking-wider font-semibold text-gray-300">POWER</div>
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
                <div className="text-[13px] font-bold text-lime-400">NOW</div>
                <div className="text-right text-[15px] font-bold flex items-center justify-end gap-2">
                  <span className={`${realtimeData.currentPower > 450 ? 'text-red-400' : realtimeData.currentPower > 350 ? 'text-yellow-400' : 'text-white'}`}>{realtimeData.currentPower.toFixed(0)}</span>
                  <span className="text-gray-400 text-[11px] font-medium">W</span>
                </div>
                {/* Hour */}
                <div className="text-[12px] font-semibold text-lime-400">Hour</div>
                <div className="text-right text-[12px] text-gray-200">{realtimeData.hourConsumption.toFixed(1)} <span className="text-[10px] text-gray-400">kWh</span></div>
                {/* Day */}
                <div className="text-[12px] font-semibold text-lime-400">Day</div>
                <div className="text-right text-[12px] text-gray-200">{realtimeData.dayConsumption.toFixed(1)} <span className="text-[10px] text-gray-400">kWh</span></div>
                {/* Month */}
                <div className="text-[12px] font-semibold text-lime-400">Month</div>
                <div className="text-right text-[12px] text-gray-200">{formatEnergy(realtimeData.monthConsumption,0)} <span className="text-[10px] text-gray-400">kWh</span></div>
                {/* Year */}
                <div className="text-[12px] font-semibold text-lime-400">Year</div>
                <div className="text-right text-[12px] text-gray-200">{formatEnergy(realtimeData.yearConsumption,0)} <span className="text-[10px] text-gray-400">kWh</span></div>
                {/* TOTAL */}
                <div className="pt-1 mt-1 border-t border-gray-700 text-[12px] font-semibold text-gray-200">TOTAL</div>
                <div className="pt-1 mt-1 border-t border-gray-700 text-right text-[13px] font-bold text-white">{formatEnergy(realtimeData.totalConsumption,0)} <span className="text-[10px] text-gray-400 font-medium">kWh</span></div>
              </div>
              <div className="absolute bottom-1 left-0 w-full text-center text-[10px] text-gray-500 tracking-wider">{formatTime(currentTime)}</div>
            </div>

            <div className={box}>
              <div className="text-gray-200 font-semibold mb-3">Active Alerts</div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-2 bg-yellow-900/30 border border-yellow-700/50 rounded-lg">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                  <div className="text-[11px] text-yellow-200">Line 2 High Load</div>
                </div>
                <div className="flex items-center gap-2 p-2 bg-red-900/30 border border-red-700/50 rounded-lg">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <div className="text-[11px] text-red-200">Sensor Offline</div>
                </div>
                <div className="flex items-center gap-2 p-2 bg-blue-900/30 border border-blue-700/50 rounded-lg">
                  <div className="w-2 h-2 bg-blue-500 rounded-full" />
                  <div className="text-[11px] text-blue-200">System Normal</div>
                </div>
              </div>
            </div>

            <div className={box}>
              <div className="text-gray-200 font-semibold mb-3">Local Time</div>
              <div className="text-center">
                <div className="text-3xl font-bold text-white">
                  {currentTime.toLocaleTimeString('en-IN', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    timeZone: 'Asia/Kolkata'
                  })}
                </div>
                <div className="text-[11px] text-gray-400">
                  {currentTime.toLocaleDateString('en-IN', { 
                    weekday: 'long',
                    day: '2-digit',
                    timeZone: 'Asia/Kolkata'
                  }).toUpperCase()}
                </div>
                <div className="text-[11px] text-gray-400">
                  {currentTime.toLocaleDateString('en-IN', { 
                    month: 'long',
                    year: 'numeric',
                    timeZone: 'Asia/Kolkata'
                  }).toUpperCase()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
