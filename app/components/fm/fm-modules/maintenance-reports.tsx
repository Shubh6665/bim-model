"use client";

import React, { useState, useEffect } from "react";
import { Eye } from "lucide-react";
import { EnhancedMaintenanceReport } from "./enhanced-maintenance-report";
import { load, save, K } from "../fm-panel-utils";
import type { WorkOrderItem, ScheduledItem } from "../fm-panel-types";

// Type alias for backward compatibility
type WOType = WorkOrderItem;

interface MaintenanceReportsProps {
  projectId?: string;
}

export 
const MaintenanceReports: React.FC<{ projectId?: string; }> = ({ projectId }) => {
  // Fetch from DB only - no localStorage caching
  const [scheduled, setScheduled] = useState<ScheduledItem[]>([]);
  const [workOrders, setWorkOrders] = useState<WOType[]>([]);
  const [openWO, setOpenWO] = useState<WOType | null>(null);
  const [reportTime, setReportTime] = useState<string>('');

  // Load from database on mount
  useEffect(() => {
    const loadFromBackend = async () => {
      if (!projectId) return;
      
      try {
        const [scheduledRes, woRes] = await Promise.all([
          fetch(`/api/projects/${projectId}/scheduled-maintenance`),
          fetch(`/api/projects/${projectId}/work-orders`)
        ]);
        
        if (scheduledRes.ok) {
          const data = await scheduledRes.json();
          setScheduled(Array.isArray(data) ? data : []);
        }
        
        if (woRes.ok) {
          const data = await woRes.json();
          setWorkOrders(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error('[MaintenanceReports] Failed to load data:', err);
      }
    };
    loadFromBackend();
  }, [projectId]);

  // Load work orders from backend on mount
  useEffect(() => {
    const loadFromBackend = async () => {
      if (!projectId) return;
      try {
        const res = await fetch(`/api/projects/${projectId}/work-orders`);
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : [];
          setWorkOrders(list);
          save(K.workOrders(projectId), list);
        }
      } catch (e) {
        console.error('Failed to load work orders from backend', e);
      }
    };
    loadFromBackend();
  }, [projectId]);

  // Set a stable timestamp on client to avoid SSR/client mismatch
  useEffect(() => {
    setReportTime(new Date().toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
  }, []);

  const totalScheduled = scheduled.length;
  const totalWorkOrders = workOrders.length;
  const openOrders = workOrders.filter(w => w.status === 'OPEN').length;
  const inProgressOrders = workOrders.filter(w => w.status === 'IN_PROGRESS').length;
  const resolvedOrders = workOrders.filter(w => w.status === 'RESOLVED').length;

  return (
    <div className="p-3 space-y-4">
      <div className="text-foreground font-semibold text-sm">Maintenance Reports</div>

      {/* Shrunk stat cards - smaller padding & font-sizes */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-card/60 rounded p-2">
          <div className="text-xs text-muted-foreground">Scheduled Tasks</div>
          <div className="text-lg text-foreground font-bold">{totalScheduled}</div>
        </div>
        <div className="bg-card/60 rounded p-2">
          <div className="text-xs text-muted-foreground">Total Work Orders</div>
          <div className="text-lg text-foreground font-bold">{totalWorkOrders}</div>
        </div>
        <div className="bg-yellow-900/30 rounded p-2">
          <div className="text-xs text-yellow-400">Open Orders</div>
          <div className="text-lg text-yellow-300 font-bold">{openOrders}</div>
        </div>
        <div className="bg-purple-900/30 rounded p-2">
          <div className="text-xs text-purple-400">In Progress</div>
          <div className="text-lg text-purple-300 font-bold">{inProgressOrders}</div>
        </div>
        <div className="col-span-2 bg-green-900/30 rounded p-2">
          <div className="text-xs text-green-400">Resolved Orders</div>
          <div className="text-lg text-green-300 font-bold">{resolvedOrders}</div>
        </div>
      </div>

      <div className="border-t border-border pt-3">
        <div className="text-xs text-muted-foreground">Reports generated at: {reportTime || '—'}</div>
      </div>

      <div className="mt-3">
        <div className="text-sm text-foreground mb-2">Work orders</div>
        <div className="space-y-2">
          {workOrders.map(w => (
            <div key={w.id} className="bg-card/40 rounded">
              <div className="flex items-center justify-between p-2">
                <div>
                  <div className="text-sm font-medium text-foreground">{w.requestId || w.id} • {w.asset || w.location || '—'}</div>
                  <div className="text-xs text-muted-foreground">{w.description?.slice(0, 80) || 'No description'}</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-xs text-muted-foreground">
                    {String(w.ticketStatus)?.toUpperCase() === 'REJECTED' ? 'Rejected' : (String(w.status || '').toLowerCase().replace(/(^|\s)[a-z]/g, s => s.toUpperCase()))}
                  </div>
                  <button
                    onClick={() => setOpenWO(openWO && openWO.id === w.id ? null : w)}
                    className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm flex items-center gap-1"
                    title={openWO && openWO.id === w.id ? 'Close report' : 'View report'}
                  >
                    <Eye className="w-4 h-4" />
                    <span className="sr-only">{openWO && openWO.id === w.id ? 'Close' : 'Open'}</span>
                  </button>
                </div>
              </div>

              {/* Inline expanded report */}
              {openWO && openWO.id === w.id && (
                <div className="fixed inset-0 bg-background z-50 overflow-y-auto">
                  <EnhancedMaintenanceReport
                    projectId={projectId}
                    workOrder={openWO}
                    onClose={() => {
                      setOpenWO(null);
                      // Reload work orders from backend after closing
                      if (projectId) {
                        fetch(`/api/projects/${projectId}/work-orders`)
                          .then(res => res.json())
                          .then(data => {
                            const list = Array.isArray(data) ? data : [];
                            setWorkOrders(list);
                            save(K.workOrders(projectId), list);
                          })
                          .catch(e => console.error('Refresh failed', e));
                      }
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Upcoming Maintenance Activities
const UpcomingMaintenance: React.FC<{ projectId?: string; }> = ({ projectId }) => {
  const [scheduled] = useState<ScheduledItem[]>(() => load(K.scheduled(projectId), [] as ScheduledItem[]));
  const [workOrders] = useState<WorkOrderItem[]>(() => load(K.workOrders(projectId), [] as WorkOrderItem[]));

  const upcomingScheduled = scheduled.slice(0, 10); // Show next 10
  const plannedOrders = workOrders.filter(w => w.status === 'PLANNED');

  return (
    <div className="p-3 space-y-3">
      <div className="text-foreground font-semibold text-sm">Upcoming Maintenance Activities</div>

      <div className="space-y-2">
        <div className="text-xs text-muted-foreground font-semibold">Scheduled Maintenance</div>
        {upcomingScheduled.length === 0 ? (
          <div className="text-muted-foreground text-xs">No scheduled maintenance.</div>
        ) : (
          <ul className="space-y-1">
            {upcomingScheduled.map(s => (
              <li key={s.id} className="bg-blue-900/20 rounded px-2 py-1.5 text-xs text-foreground">
                <span className="font-semibold text-blue-300">[{s.discipline}]</span> {s.asset} • {s.tasks.join(', ')}
                <div className="text-xs text-muted-foreground mt-0.5">{s.frequency}/year • {s.timeHours}h</div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2 border-t border-border pt-3">
        <div className="text-xs text-muted-foreground font-semibold">Planned Work Orders</div>
        {plannedOrders.length === 0 ? (
          <div className="text-muted-foreground text-xs">No planned work orders.</div>
        ) : (
          <ul className="space-y-1">
            {plannedOrders.map(w => (
              <li key={w.id} className="bg-card/60 rounded px-2 py-1.5 text-xs text-foreground">
                <span className="font-semibold">{w.requestId}</span> • {w.description}
                <div className="text-xs text-muted-foreground mt-0.5">Technician: {w.responsibleTechnician || 'Unassigned'}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

// Ongoing Maintenance
