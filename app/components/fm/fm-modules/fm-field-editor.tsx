"use client";

import React, { useState, useEffect } from "react";
import { useUserRole } from "@/app/hooks/useUserRole";
import type { WorkOrderItem, TicketPriority, MaintenanceType } from "../fm-panel-types";

interface FMFieldEditorProps {
  projectId?: string;
}

export const FMFieldEditor: React.FC<FMFieldEditorProps> = ({ projectId }) => {
  const { role, isFM } = useUserRole(projectId || '');
  const [workOrders, setWorkOrders] = useState<WorkOrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<WorkOrderItem | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editValues, setEditValues] = useState<{
    priority: TicketPriority;
    maintenanceType: MaintenanceType;
  }>({
    priority: "Medium",
    maintenanceType: "Corrective",
  });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({ 
    show: false, 
    message: '', 
    type: 'success' 
  });

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  useEffect(() => {
    if (projectId) {
      fetchWorkOrders();
    }
  }, [projectId]);

  const fetchWorkOrders = async () => {
    if (!projectId) return;
    console.log('[FM Field Editor] Fetching work orders for project:', projectId);
    try {
      const res = await fetch(`/api/projects/${projectId}/work-orders`);
      console.log('[FM Field Editor] Fetch response status:', res.status);
      if (!res.ok) throw new Error("Failed to fetch work orders");
      const data = await res.json();
      console.log('[FM Field Editor] Fetched work orders:', data.length, 'total');
      // Show all non-resolved orders
      const activeOrders = data.filter((wo: WorkOrderItem) => wo.status !== 'RESOLVED');
      console.log('[FM Field Editor] Active work orders:', activeOrders.length);
      console.log('[FM Field Editor] Sample order:', activeOrders[0]);
      setWorkOrders(activeOrders);
    } catch (error) {
      console.error('[FM Field Editor] Error fetching work orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (order: WorkOrderItem) => {
    const orderId = order.id || order._id;
    console.log('[FM Field Editor] Opening edit modal for order:', orderId);
    console.log('[FM Field Editor] Current order values:', {
      priority: order.priority,
      maintenanceType: order.maintenanceType,
      type: order.type
    });
    setSelectedOrder(order);
    setEditValues({
      priority: order.priority || "Medium",
      maintenanceType: order.maintenanceType || order.type || "Corrective",
    });
    setShowEditModal(true);
  };

  const handleSaveChanges = async () => {
    const orderId = selectedOrder?.id || selectedOrder?._id;
    if (!orderId) {
      console.error('[FM Field Editor] No order ID found!');
      return;
    }

    console.log('[FM Field Editor] Starting save...');
    console.log('[FM Field Editor] Selected Order ID:', orderId);
    console.log('[FM Field Editor] Edit Values:', editValues);

    const requestBody = {
      priority: editValues.priority,
      type: editValues.maintenanceType,
    };
    console.log('[FM Field Editor] Request Body:', requestBody);

    setSaving(true);
    try {
      const url = `/api/projects/${projectId}/work-orders/${orderId}/fm-fields`;
      console.log('[FM Field Editor] API URL:', url);

      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      console.log('[FM Field Editor] Response Status:', res.status);
      console.log('[FM Field Editor] Response OK:', res.ok);

      if (!res.ok) {
        const error = await res.json();
        console.error('[FM Field Editor] API Error:', error);
        throw new Error(error.error || "Failed to update fields");
      }

      const result = await res.json();
      console.log('[FM Field Editor] API Success:', result);

      await fetchWorkOrders();
      setShowEditModal(false);
      setSelectedOrder(null);
      showToast("Priority and Type updated successfully", "success");
    } catch (error: any) {
      console.error('[FM Field Editor] Save Error:', error);
      showToast(error.message || "Failed to update fields", "error");
    } finally {
      setSaving(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN': return 'bg-yellow-900/40 text-yellow-300';
      case 'PLANNED': return 'bg-blue-900/40 text-blue-300';
      case 'IN_PROGRESS': return 'bg-purple-900/40 text-purple-300';
      case 'CLOSE': return 'bg-orange-900/40 text-orange-300';
      default: return 'bg-card/40 text-muted-foreground';
    }
  };

  const getPriorityColor = (priority: TicketPriority) => {
    switch (priority) {
      case 'Critical': return 'text-red-400';
      case 'High': return 'text-orange-400';
      case 'Medium': return 'text-yellow-400';
      case 'Low': return 'text-green-400';
      default: return 'text-muted-foreground';
    }
  };

  if (loading) {
    return <div className="p-4 text-muted-foreground">Loading work orders...</div>;
  }

  if (!isFM) {
    return (
      <div className="p-4 text-muted-foreground">
        Only Facility Managers can modify Priority and Type fields.
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Toast Notification */}
      {toast.show && (
        <div className={`fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 duration-300 ${
          toast.type === 'success' 
            ? 'bg-green-600' 
            : 'bg-red-600'
        } text-foreground px-6 py-4 rounded-lg shadow-2xl border border-border/20 backdrop-blur-sm min-w-[320px]`}>
          <div className="flex items-center gap-3">
            {toast.type === 'success' ? (
              <svg className="w-6 h-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-6 h-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <div className="flex-1">
              <p className="font-semibold text-sm">{toast.type === 'success' ? 'Success' : 'Error'}</p>
              <p className="text-sm opacity-90">{toast.message}</p>
            </div>
            <button 
              onClick={() => setToast({ show: false, message: '', type: 'success' })}
              className="text-foreground/80 hover:text-foreground transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-foreground">Priority Order</h2>
      </div>

      <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-3 text-sm text-blue-300">
        <strong>FM Privilege:</strong> You can modify Priority and Maintenance Type at any time during the work order lifecycle.
      </div>

      {workOrders.length === 0 ? (
        <div className="bg-card/50 border border-border rounded-lg p-6 text-center text-muted-foreground">
          No active work orders to manage.
        </div>
      ) : (
        <div className="grid gap-4">
          {workOrders.map((order) => (
            <div
              key={order.id || order._id}
              className="bg-card/70 border border-border rounded-lg p-4 hover:border-border transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-foreground">{order.ticketId || order.requestId}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{order.description}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                  {order.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                <div>
                  <span className="text-muted-foreground">Priority:</span>
                  <span className={`ml-2 font-semibold ${getPriorityColor(order.priority || 'Medium')}`}>
                    {order.priority || 'Medium'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Type:</span>
                  <span className="ml-2 text-foreground font-medium">{order.maintenanceType || 'Corrective'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Location:</span>
                  <span className="ml-2 text-foreground">{order.location || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Requester:</span>
                  <span className="ml-2 text-foreground">{order.requester || 'Unknown'}</span>
                </div>
              </div>

              <button
                onClick={() => openEditModal(order)}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-foreground rounded-lg text-sm font-medium transition-colors"
              >
                Edit Priority & Type
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedOrder && (
        <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-semibold text-foreground mb-4">
              Edit FM Fields
            </h3>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Priority
                </label>
                <select
                  value={editValues.priority}
                  onChange={(e) => setEditValues(prev => ({ ...prev, priority: e.target.value as TicketPriority }))}
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-foreground"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Maintenance Type
                </label>
                <select
                  value={editValues.maintenanceType}
                  onChange={(e) => setEditValues(prev => ({ ...prev, maintenanceType: e.target.value as MaintenanceType }))}
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-foreground"
                >
                  <option value="Preventive">Preventive</option>
                  <option value="Corrective">Corrective</option>
                  <option value="Predictive">Predictive</option>
                  <option value="Emergency">Emergency</option>
                  <option value="Urgent">Urgent</option>
                  <option value="Safety">Safety</option>
                </select>
              </div>

              <div className="bg-yellow-900/20 border border-yellow-700/50 rounded p-3 text-sm text-yellow-300">
                Changes will be logged and notifications will be sent to the Maintenance Team.
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedOrder(null);
                }}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-muted hover:bg-muted disabled:bg-card text-foreground rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveChanges}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-muted text-foreground rounded-lg font-medium transition-colors"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
