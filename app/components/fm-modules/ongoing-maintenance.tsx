"use client";

import React, { useState, useEffect } from "react";
import { useUserRole } from "@/app/hooks/useUserRole";
import { ActivityTimeline } from "./activity-timeline";
import { EnhancedMaintenanceReport } from "./enhanced-maintenance-report";
import type { WorkOrderItem, WorkOrderStatus, MaintenanceCycle } from "../fm-panel-types";

interface OngoingMaintenanceProps {
  projectId?: string;
  archived?: boolean;
}

export const OngoingMaintenance: React.FC<OngoingMaintenanceProps> = ({ projectId, archived = false }) => {
  const { role, isTM, isMaintainer, isFM } = useUserRole(projectId || '');
  const [workOrders, setWorkOrders] = useState<WorkOrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<WorkOrderItem | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({ 
    show: false, 
    message: '', 
    type: 'success' 
  });
  
  // Resolve modal
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [tmClosingNotes, setTmClosingNotes] = useState('');
  const [orderToResolve, setOrderToResolve] = useState<WorkOrderItem | null>(null);
  
  // Operational notes for status transitions
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [operationalNote, setOperationalNote] = useState('');
  const [pendingTransition, setPendingTransition] = useState<{ orderId: string; status: WorkOrderStatus } | null>(null);
  
  // Technician assignment
  const [showTechModal, setShowTechModal] = useState(false);
  const [techEmail, setTechEmail] = useState('');
  const [techName, setTechName] = useState('');
  const [techCompany, setTechCompany] = useState('');
  const [selectedOrderForTech, setSelectedOrderForTech] = useState<WorkOrderItem | null>(null);
  
  // Enhanced Report Modal
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportWorkOrder, setReportWorkOrder] = useState<WorkOrderItem | null>(null);
  
  // Integration Request Modal
  const [showIntegrationModal, setShowIntegrationModal] = useState(false);
  const [integrationReason, setIntegrationReason] = useState('');
  const [orderForIntegration, setOrderForIntegration] = useState<WorkOrderItem | null>(null);

  // Confirm Resolution Modal
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [orderToConfirm, setOrderToConfirm] = useState<WorkOrderItem | null>(null);
  
  // Filters for Task 8
  const [filterStatus, setFilterStatus] = useState<WorkOrderStatus | 'ALL'>('ALL');
  const [filterPriority, setFilterPriority] = useState<string>('ALL');
  const [searchTechnician, setSearchTechnician] = useState('');

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
  };

  useEffect(() => {
    if (projectId) {
      fetchWorkOrders();
    }
  }, [projectId]);

  const fetchWorkOrders = async () => {
    if (!projectId) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/work-orders`);
      if (!res.ok) throw new Error("Failed to fetch work orders");
      const data = await res.json();
      // Include RESOLVED orders so FM can act on them
      const activeOrders = data.filter((wo: WorkOrderItem) => 
        ['OPEN', 'PLANNED', 'IN_PROGRESS', 'CLOSE', 'RESOLVED'].includes(wo.status) || 
        wo.ticketStatus === 'REJECTED' || 
        wo.status === 'Rejected'
      );
      setWorkOrders(activeOrders);
    } catch (error) {
      console.error("Error fetching work orders:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusTransition = async (orderId: string, newStatus: WorkOrderStatus, note?: string) => {
    if (!isTM && !isMaintainer) {
      showToast("You don't have permission to update work order status", "error");
      return;
    }

    setTransitioning(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/work-orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newStatus, note: note || operationalNote }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update status");
      }

      await fetchWorkOrders();
      setSelectedOrder(null);
      setShowNotesModal(false);
      setOperationalNote('');
      setPendingTransition(null);
      showToast(`Work order status updated to ${newStatus}`, "success");
    } catch (error: any) {
      showToast(error.message, "error");
    } finally {
      setTransitioning(false);
    }
  };
  
  const openNotesModal = (orderId: string, status: WorkOrderStatus) => {
    setPendingTransition({ orderId, status });
    setShowNotesModal(true);
  };
  
  const submitWithNotes = () => {
    if (!pendingTransition) return;
    handleStatusTransition(pendingTransition.orderId, pendingTransition.status);
  };
  
  const handleResolve = async () => {
    if (!orderToResolve || !projectId) return;
    
    if (!tmClosingNotes.trim()) {
      showToast('Please enter TM Closing Notes', 'error');
      return;
    }
    
    setTransitioning(true);
    try {
      // Use _id if available, otherwise fallback to id
      const orderId = orderToResolve._id || orderToResolve.id;
      const res = await fetch(`/api/projects/${projectId}/work-orders/${orderId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tmClosingNotes }),
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to resolve work order');
      }
      
      await fetchWorkOrders();
      setShowResolveModal(false);
      setTmClosingNotes('');
      setOrderToResolve(null);
      showToast('Work order resolved successfully', 'success');
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setTransitioning(false);
    }
  };

  const openConfirmModal = (order: WorkOrderItem) => {
    setOrderToConfirm(order);
    setShowConfirmModal(true);
  };

  const handleConfirmResolution = async () => {
    if (!orderToConfirm || !projectId) return;
    
    setTransitioning(true);
    try {
      const orderId = orderToConfirm._id || orderToConfirm.id;
      const res = await fetch(`/api/projects/${projectId}/work-orders/${orderId}/confirm-resolution`, {
        method: 'POST',
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to confirm resolution');
      }
      
      await fetchWorkOrders();
      setShowConfirmModal(false);
      setOrderToConfirm(null);
      showToast('Resolution confirmed and user notified', 'success');
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setTransitioning(false);
    }
  };
  
  const handleRequestIntegration = async () => {
    if (!orderForIntegration || !projectId) return;
    
    if (!integrationReason.trim()) {
      showToast('Please enter a reason for integration', 'error');
      return;
    }
    
    setTransitioning(true);
    try {
      const orderId = orderForIntegration._id || orderForIntegration.id;
      const res = await fetch(`/api/projects/${projectId}/work-orders/${orderId}/integration-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: integrationReason }),
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to request integration');
      }
      
      await fetchWorkOrders();
      setShowIntegrationModal(false);
      setIntegrationReason('');
      setOrderForIntegration(null);
      showToast('Integration requested successfully', 'success');
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setTransitioning(false);
    }
  };
  
  const assignTechnician = async () => {
    if (!selectedOrderForTech || !projectId) return;
    if (!techEmail.trim() || !techName.trim() || !techCompany.trim()) {
      showToast('Please enter technician email, name and company', 'error');
      return;
    }
    
    setTransitioning(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/work-orders/${selectedOrderForTech.id}/technicians`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          technicianEmail: techEmail, 
          technicianName: techName,
          company: techCompany 
        }),
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to add technician');
      }
      
      await fetchWorkOrders();
      setShowTechModal(false);
      setTechEmail('');
      setTechName('');
      setTechCompany('');
      setSelectedOrderForTech(null);
      showToast('Technician assigned successfully', 'success');
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setTransitioning(false);
    }
  };
  
  const removeTechnician = async (orderId: string, techEmail: string) => {
    if (!projectId) return;
    
    setTransitioning(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/work-orders/${orderId}/technicians?email=${encodeURIComponent(techEmail)}`, {
        method: 'DELETE',
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to remove technician');
      }
      
      await fetchWorkOrders();
      showToast('Technician removed successfully', 'success');
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setTransitioning(false);
    }
  };

  const getAvailableTransitions = (currentStatus: WorkOrderStatus): WorkOrderStatus[] => {
    switch (currentStatus) {
      case 'OPEN':
        return ['PLANNED'];
      case 'PLANNED':
        return ['IN_PROGRESS'];
      case 'IN_PROGRESS':
        return ['CLOSE'];
      case 'CLOSE':
        return []; // TM uses /resolve endpoint for CLOSE -> RESOLVED
      default:
        return [];
    }
  };

  const getStatusColor = (status: WorkOrderStatus) => {
    switch (status) {
      case 'OPEN': return 'bg-yellow-900/40 text-yellow-300 border-yellow-700';
      case 'PLANNED': return 'bg-blue-900/40 text-blue-300 border-blue-700';
      case 'IN_PROGRESS': return 'bg-purple-900/40 text-purple-300 border-purple-700';
      case 'CLOSE': return 'bg-orange-900/40 text-orange-300 border-orange-700';
      case 'RESOLVED': return 'bg-green-900/40 text-green-300 border-green-700';
      default: return 'bg-gray-900/40 text-gray-300 border-gray-700';
    }
  };

  const getCurrentCycle = (cycles: MaintenanceCycle[]): MaintenanceCycle | undefined => {
    return cycles.find(c => !c.endedAt);
  };

  const formatDuration = (startedAt: string, endedAt?: string) => {
    const start = new Date(startedAt);
    const end = endedAt ? new Date(endedAt) : new Date();
    const diff = end.getTime() - start.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  if (loading) {
    return <div className="p-4 text-gray-400">Loading work orders...</div>;
  }

  // Allow User (Requester) and FM to view, but restrict actions
  const canView = isTM || isMaintainer || isFM || role === 'User';
  if (!canView) {
    return (
      <div className="p-4 text-gray-400">
        You don't have permission to view ongoing maintenance activities.
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
        } text-white px-6 py-4 rounded-lg shadow-2xl border border-white/20 backdrop-blur-sm min-w-[320px]`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1">
              <p className="font-semibold text-sm">{toast.type === 'success' ? 'Success' : 'Error'}</p>
              <p className="text-sm opacity-90">{toast.message}</p>
            </div>
            <button 
              onClick={() => setToast({ show: false, message: '', type: 'success' })}
              className="text-white/80 hover:text-white transition-colors text-xl font-bold leading-none"
            >
              &times;
            </button>
          </div>
        </div>
      )}

      {/* Filters Section */}
      <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">Filters</h3>
          {(filterStatus !== 'ALL' || filterPriority !== 'ALL' || searchTechnician) && (
            <button
              onClick={() => {
                setFilterStatus('ALL');
                setFilterPriority('ALL');
                setSearchTechnician('');
              }}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              Clear All
            </button>
          )}
        </div>
        
        <div className="grid grid-cols-3 gap-3">
          {/* Status Filter */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as WorkOrderStatus | 'ALL')}
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="Open">Open</option>
              <option value="Planned">Planned</option>
              <option value="In Progress">In Progress</option>
              <option value="Closed">Closed</option>
              <option value="Resolved">Resolved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
          
          {/* Priority Filter */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Priority</label>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Priorities</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
          
          {/* Technician Search */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Search Technician</label>
            <input
              type="text"
              value={searchTechnician}
              onChange={(e) => setSearchTechnician(e.target.value)}
              placeholder="Name or email..."
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Results Counter */}
      {(() => {
        // First, filter by view (Ongoing vs Archived)
        const viewOrders = workOrders.filter(order => {
          const isRejected = order.ticketStatus === 'REJECTED' || order.status === 'Rejected';
          const effectiveStatus = isRejected ? 'Rejected' : order.status;
          const isResolved = effectiveStatus === 'RESOLVED' || effectiveStatus === 'Resolved';

          if (archived) {
            // In archived view, ONLY show Resolved or Rejected
            return isResolved || isRejected;
          } else {
            // In ongoing view, HIDE Resolved and Rejected
            return !isResolved && !isRejected;
          }
        });

        // Then apply user filters to the view-specific orders
        const filteredOrders = viewOrders.filter(order => {
          const isRejected = order.ticketStatus === 'REJECTED' || order.status === 'Rejected';
          const effectiveStatus = isRejected ? 'Rejected' : order.status;

          if (filterStatus !== 'ALL') {
            const s = (effectiveStatus || '').toUpperCase();
            const f = filterStatus.toUpperCase();
            if (f === 'CLOSED' && s === 'CLOSE') { /* match */ }
            else if (f === 'IN PROGRESS' && s === 'IN_PROGRESS') { /* match */ }
            else if (s !== f && s !== f.replace(' ', '_')) return false;
          }
          if (filterPriority !== 'ALL' && order.priority !== filterPriority) return false;
          if (searchTechnician) {
            const search = searchTechnician.toLowerCase();
            const primaryTech = (order.responsibleTechnician || '').toLowerCase();
            const assignedTechs = (order.assignedTechnicians || []).map(t => 
              `${t.name} ${t.email}`.toLowerCase()
            );
            const matchesPrimary = primaryTech.includes(search);
            const matchesAssigned = assignedTechs.some(tech => tech.includes(search));
            if (!matchesPrimary && !matchesAssigned) return false;
          }
          return true;
        });

        return (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">
              Showing <span className="text-white font-semibold">{filteredOrders.length}</span> of{' '}
              <span className="text-white font-semibold">{viewOrders.length}</span> work orders
            </span>
          </div>
        );
      })()}

      {workOrders.length === 0 ? (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 text-center text-gray-400">
          No active work orders. All maintenance activities are completed.
        </div>
      ) : (
        <div className="grid gap-4">
          {workOrders
            .filter(order => {
              // Determine effective status
              const isRejected = order.ticketStatus === 'REJECTED' || order.status === 'Rejected';
              const effectiveStatus = isRejected ? 'Rejected' : order.status;
              const isResolved = effectiveStatus === 'RESOLVED' || effectiveStatus === 'Resolved';

              // Archive filtering logic
              if (archived) {
                // In archived view, ONLY show Resolved or Rejected
                if (!isResolved && !isRejected) return false;
              } else {
                // In ongoing view, HIDE Resolved and Rejected
                if (isResolved || isRejected) return false;
              }

              // Apply status filter
              if (filterStatus !== 'ALL') {
                const s = (effectiveStatus || '').toUpperCase();
                const f = filterStatus.toUpperCase();
                // Handle "Closed" vs "CLOSE" and "In Progress" vs "IN_PROGRESS"
                if (f === 'CLOSED' && s === 'CLOSE') { /* match */ }
                else if (f === 'IN PROGRESS' && s === 'IN_PROGRESS') { /* match */ }
                else if (s !== f && s !== f.replace(' ', '_')) return false;
              }
              
              // Apply priority filter
              if (filterPriority !== 'ALL' && order.priority !== filterPriority) return false;
              
              // Apply technician search
              if (searchTechnician) {
                const search = searchTechnician.toLowerCase();
                const primaryTech = (order.responsibleTechnician || '').toLowerCase();
                const assignedTechs = (order.assignedTechnicians || []).map(t => 
                  `${t.name} ${t.email}`.toLowerCase()
                );
                
                const matchesPrimary = primaryTech.includes(search);
                const matchesAssigned = assignedTechs.some(tech => tech.includes(search));
                
                if (!matchesPrimary && !matchesAssigned) return false;
              }
              
              return true;
            })
            .map((order) => {
            const currentCycle = getCurrentCycle(order.maintenanceCycles || []);
            
            // Determine effective status (override if ticket is rejected)
            const isRejected = order.ticketStatus === 'REJECTED' || order.status === 'Rejected';
            const effectiveStatus = isRejected ? 'Rejected' : order.status;
            
            const transitions = getAvailableTransitions(effectiveStatus as WorkOrderStatus);

            return (
              <div
                key={order.id}
                className={`bg-gray-800/70 border ${isRejected ? 'border-red-900/50' : 'border-gray-700'} rounded-lg p-4 hover:border-gray-600 transition-all`}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{order.requestId || order.ticketId || 'No ID'}</h3>
                    <p className="text-sm text-gray-400 mt-1">{order.description}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(effectiveStatus as WorkOrderStatus)}`}>
                    {effectiveStatus}
                  </span>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                  <div>
                    <span className="text-gray-400">Priority:</span>
                    <span className="ml-2 text-white font-medium">{order.priority}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Type:</span>
                    <span className="ml-2 text-white font-medium">{order.maintenanceType}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Location:</span>
                    <span className="ml-2 text-white">{order.location}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Cycles:</span>
                    <span className="ml-2 text-white">{order.maintenanceCycles?.length || 0}</span>
                  </div>
                </div>
                
                {/* Assigned Technicians - View Only for non-TM */}
                {!isTM && order.assignedTechnicians && order.assignedTechnicians.length > 0 && (
                  <div className="mb-4 text-sm">
                    <span className="text-gray-400">Assigned Technicians:</span>
                    <div className="ml-2 mt-1 space-y-1">
                      {order.assignedTechnicians.map((tech: any, idx: number) => (
                        <div key={idx} className="text-white">
                          {tech.name} <span className="text-gray-200">({tech.email})</span>
                          {tech.company && <span className="text-gray-200"> - {tech.company}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Assigned Technicians - Editable for TM */}
                {isTM && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-400">Assigned Technicians:</span>
                      {!isRejected && (
                        <button
                          onClick={() => {
                            setSelectedOrderForTech(order);
                            setShowTechModal(true);
                          }}
                          className="text-xs px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                        >
                          + Add
                        </button>
                      )}
                    </div>
                    <div className="ml-2 space-y-1">
                      {order.assignedTechnicians && order.assignedTechnicians.length > 0 ? (
                        order.assignedTechnicians.map((tech: any, idx: number) => (
                          <div key={idx} className="flex items-center gap-2 text-sm">
                            <span className="text-white">
                              {tech.name} <span className="text-gray-500">({tech.email})</span>
                              {tech.company && <span className="text-gray-500"> - {tech.company}</span>}
                            </span>
                            <button
                              onClick={() => removeTechnician(order.id, tech.email)}
                              className="text-red-400 hover:text-red-300 p-0.5"
                              title="Remove"
                            >
                              ×
                            </button>
                          </div>
                        ))
                      ) : (
                        <span className="text-xs text-gray-500 italic">No technicians assigned</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Current Cycle Info */}
                {currentCycle && (
                  <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-3 mb-4">
                    <div className="text-xs text-gray-400 mb-2">Current Cycle</div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-400">Status:</span>
                        <span className="ml-2 text-white font-medium">{currentCycle.status}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Duration:</span>
                        <span className="ml-2 text-white">{formatDuration(currentCycle.startedAt, currentCycle.endedAt)}</span>
                      </div>
                      {currentCycle.performedBy && (
                        <div className="col-span-2">
                          <span className="text-gray-400">Performed by:</span>
                          <span className="ml-2 text-white">{currentCycle.performedBy}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* State Machine Actions - Hidden for Users and FMs */}
                {transitions.length > 0 && (isTM || isMaintainer) && (
                  <div className="flex gap-2 flex-wrap">
                    {transitions.map((nextStatus) => (
                      <button
                        key={nextStatus}
                        onClick={() => openNotesModal(order.id, nextStatus)}
                        disabled={transitioning}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        {transitioning ? 'Processing...' : `Move to ${nextStatus}`}
                      </button>
                    ))}
                    
                    {/* View Enhanced Report Button */}
                    <button
                      onClick={() => {
                        setReportWorkOrder(order);
                        setShowReportModal(true);
                      }}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      View Report
                    </button>
                  </div>
                )}

                {/* Close Status - TM can resolve */}
                {order.status === 'CLOSE' && isTM && (
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => {
                        setOrderToResolve(order);
                        setShowResolveModal(true);
                      }}
                      disabled={transitioning}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      {transitioning ? 'Processing...' : 'Mark as RESOLVED'}
                    </button>
                    
                    {/* View Enhanced Report Button */}
                    <button
                      onClick={() => {
                        setReportWorkOrder(order);
                        setShowReportModal(true);
                      }}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      View Report
                    </button>
                  </div>
                )}

                {/* Resolved Status - FM can request integration or confirm resolution */}
                {order.status === 'RESOLVED' && isFM && (
                  <div className="flex gap-2 flex-wrap items-center">
                    {!order.resolutionConfirmed ? (
                      <>
                        <button
                          onClick={() => openConfirmModal(order)}
                          disabled={transitioning}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                        >
                          Confirm Resolution
                        </button>
                        <button
                          onClick={() => {
                            setOrderForIntegration(order);
                            setShowIntegrationModal(true);
                          }}
                          className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                          Request Integration
                        </button>
                      </>
                    ) : (
                      <span className="text-green-400 text-sm font-medium flex items-center gap-1 mr-2">
                        ✓ Resolution Confirmed
                      </span>
                    )}
                    
                    <button
                      onClick={() => {
                        setReportWorkOrder(order);
                        setShowReportModal(true);
                      }}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      View Report
                    </button>
                  </div>
                )}

                {/* Cycle History - Enhanced Display */}
                {order.maintenanceCycles && order.maintenanceCycles.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-700">
                    <button
                      onClick={() => setSelectedOrder(selectedOrder?.id === order.id ? null : order)}
                      className="text-sm text-blue-400 hover:text-blue-300 transition-colors font-medium"
                    >
                      {selectedOrder?.id === order.id ? 'Hide' : 'View'} Cycle History ({order.maintenanceCycles.length})
                    </button>

                    {selectedOrder?.id === order.id && (
                      <div className="mt-3 space-y-3">
                        {order.maintenanceCycles.map((cycle, idx) => {
                          const duration = cycle.endedAt 
                            ? formatDuration(cycle.startedAt, cycle.endedAt)
                            : formatDuration(cycle.startedAt, new Date().toISOString()) + ' (ongoing)';
                          
                          return (
                            <div key={idx} className="bg-gradient-to-r from-gray-900/50 to-gray-800/30 border border-gray-700 rounded-lg p-3 hover:border-gray-600 transition-colors">
                              {/* Cycle Header */}
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-white">Cycle {idx + 1}</span>
                                  <span className="text-xs text-gray-400">•</span>
                                  <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(cycle.status)}`}>
                                    {cycle.status}
                                  </span>
                                </div>
                                <div className="text-xs font-semibold text-blue-400">
                                  Duration: {duration}
                                </div>
                              </div>
                              
                              {/* Cycle Details */}
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <span className="text-gray-500">Started:</span>
                                  <div className="text-gray-300 mt-0.5">
                                    {new Date(cycle.startedAt).toLocaleString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </div>
                                </div>
                                {cycle.endedAt && (
                                  <div>
                                    <span className="text-gray-500">Ended:</span>
                                    <div className="text-gray-300 mt-0.5">
                                      {new Date(cycle.endedAt).toLocaleString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </div>
                                  </div>
                                )}
                                {cycle.performedBy && (
                                  <div className="col-span-2">
                                    <span className="text-gray-500">Performed by:</span>
                                    <div className="text-gray-300 mt-0.5">{cycle.performedBy}</div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Activity Timeline */}
                {projectId && order.id && (
                  <div className="mt-4">
                    <ActivityTimeline projectId={projectId} workOrderId={order.id} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      
      {/* Operational Notes Modal */}
      {showNotesModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-lg max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-xl font-semibold text-white mb-4">Add Operational Notes</h3>
            <p className="text-gray-400 text-sm mb-4">
              Transitioning to: <span className="text-blue-400 font-semibold">{pendingTransition?.status}</span>
            </p>
            <textarea
              value={operationalNote}
              onChange={(e) => setOperationalNote(e.target.value)}
              placeholder="Enter operational notes (optional)"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none h-32 mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowNotesModal(false);
                  setOperationalNote('');
                  setPendingTransition(null);
                }}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitWithNotes}
                disabled={transitioning}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors"
              >
                {transitioning ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* TM Closing Notes Modal */}
      {showResolveModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-lg max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-xl font-semibold text-white mb-4">Resolve Work Order</h3>
            <p className="text-gray-400 text-sm mb-4">
              Work Order: <span className="text-white font-semibold">{orderToResolve?.requestId || orderToResolve?.ticketId}</span>
            </p>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              TM Closing Notes <span className="text-red-400">*</span>
            </label>
            <textarea
              value={tmClosingNotes}
              onChange={(e) => setTmClosingNotes(e.target.value)}
              placeholder="Enter closing notes (required)"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-green-500 resize-none h-32 mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowResolveModal(false);
                  setTmClosingNotes('');
                  setOrderToResolve(null);
                }}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleResolve}
                disabled={transitioning || !tmClosingNotes.trim()}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors"
              >
                {transitioning ? 'Resolving...' : 'Mark as RESOLVED'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* FM Integration Request Modal */}
      {showIntegrationModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-lg max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-xl font-semibold text-white mb-4">Request Integration</h3>
            <p className="text-gray-400 text-sm mb-4">
              Work Order: <span className="text-white font-semibold">{orderForIntegration?.requestId || orderForIntegration?.ticketId}</span>
            </p>
            <p className="text-gray-400 text-xs mb-4">
              This will reopen the work order for the maintenance team to address the integration request.
            </p>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Reason for Integration <span className="text-red-400">*</span>
            </label>
            <textarea
              value={integrationReason}
              onChange={(e) => setIntegrationReason(e.target.value)}
              placeholder="Enter reason for integration request..."
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 resize-none h-32 mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowIntegrationModal(false);
                  setIntegrationReason('');
                  setOrderForIntegration(null);
                }}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRequestIntegration}
                disabled={transitioning || !integrationReason.trim()}
                className="flex-1 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors"
              >
                {transitioning ? 'Requesting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Technician Assignment Modal */}
      {showTechModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-lg max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-xl font-semibold text-white mb-4">Assign Technician</h3>
            <p className="text-gray-400 text-sm mb-4">
              Work Order: <span className="text-white font-semibold">{selectedOrderForTech?.requestId || selectedOrderForTech?.ticketId}</span>
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Technician Name</label>
                <input
                  type="text"
                  value={techName}
                  onChange={(e) => setTechName(e.target.value)}
                  placeholder="Enter technician name"
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Technician Email</label>
                <input
                  type="email"
                  value={techEmail}
                  onChange={(e) => setTechEmail(e.target.value)}
                  placeholder="technician@example.com"
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Technician Company</label>
                <input
                  type="text"
                  value={techCompany}
                  onChange={(e) => setTechCompany(e.target.value)}
                  placeholder="Enter technician company"
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowTechModal(false);
                  setTechEmail('');
                  setTechName('');
                  setTechCompany('');
                  setSelectedOrderForTech(null);
                }}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={assignTechnician}
                disabled={transitioning || !techEmail.trim() || !techName.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors"
              >
                {transitioning ? 'Adding...' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Enhanced Maintenance Report Modal */}
      {showReportModal && reportWorkOrder && (
        <div className="fixed inset-0 bg-black/90 z-50 overflow-y-auto">
          <EnhancedMaintenanceReport 
            projectId={projectId}
            workOrder={reportWorkOrder}
            onClose={() => {
              setShowReportModal(false);
              setReportWorkOrder(null);
              fetchWorkOrders(); // Refresh data after closing report
            }}
          />
        </div>
      )}

      {/* Confirm Resolution Modal */}
      {showConfirmModal && orderToConfirm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4">Confirm Resolution</h3>
            <p className="text-gray-300 mb-6">
              Are you sure you want to confirm this resolution? This will notify the requester that the work is complete and verify the fix.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setOrderToConfirm(null);
                }}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
                disabled={transitioning}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmResolution}
                disabled={transitioning}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                {transitioning ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    Confirming...
                  </>
                ) : (
                  'Confirm Resolution'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
