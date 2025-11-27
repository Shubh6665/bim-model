"use client";

import React, { useState } from "react";
import { load, save, K } from "../fm-panel-utils";
import type { WorkOrderItem } from "../fm-panel-types";

interface OngoingMaintenanceProps {
  projectId?: string;
}

export const OngoingMaintenance: React.FC<OngoingMaintenanceProps> = ({ projectId }) => {
  // Fetch from DB only
  const [workOrders] = useState<WorkOrderItem[]>([]);
  const ongoingOrders = workOrders.filter((w: WorkOrderItem) => w.status === 'In Progress');

  return (
    <div className="p-3 space-y-3">
      <div className="text-white font-semibold text-sm">Ongoing Maintenance</div>

      {ongoingOrders.length === 0 ? (
        <div className="text-gray-400 text-sm">No ongoing maintenance activities.</div>
      ) : (
        <ul className="space-y-2">
          {ongoingOrders.map((w: WorkOrderItem) => (
            <li key={w.id} className="bg-purple-900/20 rounded p-3">
              <div className="flex justify-between items-start mb-2">
                <span className="font-semibold text-purple-300">{w.requestId}</span>
                <span className="text-xs bg-purple-900/40 text-purple-300 px-2 py-0.5 rounded">{w.status}</span>
              </div>
              <div className="text-sm text-gray-200">{w.description}</div>
              <div className="text-xs text-gray-400 mt-2">
                <div>Location: {w.location}</div>
                <div>Technician: {w.responsibleTechnician || 'Unassigned'}</div>
                <div>Company: {w.company || 'N/A'}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
