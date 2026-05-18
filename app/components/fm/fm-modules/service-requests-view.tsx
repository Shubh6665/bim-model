"use client";

import React, { useState, useEffect } from "react";
import { useUserRole } from "@/app/hooks/useUserRole";
import type { TicketItem } from "../fm-panel-types";

interface ServiceRequestsViewProps {
  projectId?: string;
}

export const ServiceRequestsView: React.FC<ServiceRequestsViewProps> = ({ projectId }) => {
  const { role, isTM, isFM } = useUserRole(projectId || '');
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<TicketItem | null>(null);
  const [showFMModal, setShowFMModal] = useState(false);
  const [fmPriority, setFmPriority] = useState('');
  const [fmType, setFmType] = useState('');
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({ 
    show: false, 
    message: '', 
    type: 'success' 
  });

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
  };

  useEffect(() => {
    if (projectId) {
      fetchTickets();
    }
  }, [projectId]);

  const fetchTickets = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/tickets`);
      if (res.ok) {
        const data = await res.json();
        // Filter to show only approved tickets (which became work orders)
        const approvedTickets = Array.isArray(data) ? data.filter((t: TicketItem) => 
          t.status === 'APPROVED' || t.approvalStatus === 'APPROVED'
        ) : [];
        setTickets(approvedTickets);
      }
    } catch (error) {
      console.error('Failed to fetch tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const openFMEditModal = (ticket: TicketItem) => {
    setSelectedTicket(ticket);
    setFmPriority(ticket.priority || 'Medium');
    setFmType(ticket.type || 'Corrective');
    setShowFMModal(true);
  };

  const saveFMFields = async () => {
    if (!selectedTicket || !projectId) return;
    
    setProcessing(true);
    try {
      // Find work order associated with this ticket
      const woRes = await fetch(`/api/projects/${projectId}/work-orders`);
      if (!woRes.ok) throw new Error('Failed to fetch work orders');
      
      const workOrders = await woRes.json();
      const workOrder = workOrders.find((wo: any) => wo.ticketId === selectedTicket.id || wo.sourceTicketId === selectedTicket.id);
      
      if (!workOrder) {
        throw new Error('Work order not found for this ticket');
      }
      
      // Update FM fields via the fm-fields endpoint
      const res = await fetch(`/api/projects/${projectId}/work-orders/${workOrder._id || workOrder.id}/fm-fields`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          priority: fmPriority, 
          type: fmType 
        }),
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update FM fields');
      }
      
      await fetchTickets();
      setShowFMModal(false);
      setSelectedTicket(null);
      showToast('FM fields updated successfully', 'success');
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return <div className="p-4 text-muted-foreground">Loading service requests...</div>;
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

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-foreground">Service Requests (READ-ONLY)</h2>
        <span className="text-sm text-muted-foreground">{tickets.length} approved tickets</span>
      </div>

      {tickets.length === 0 ? (
        <div className="bg-card/50 border border-border rounded-lg p-6 text-center text-muted-foreground">
          No approved service requests found
        </div>
      ) : (
        <div className="grid gap-4">
          {tickets.map((ticket) => (
            <div key={ticket.id} className="bg-card/70 border border-border rounded-lg p-4">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{ticket.ticketCode || ticket.id}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{ticket.intervention?.descriptionShort}</p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-900/40 text-green-300 border border-green-700">
                  APPROVED
                </span>
              </div>

              {/* READ-ONLY Data Grid */}
              <div className="bg-card/50 border border-border rounded-lg p-4 mb-4">
                <h4 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Ticket Information (Read-Only)
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Request ID:</span>
                    <span className="ml-2 text-foreground">{ticket.ticketCode || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Requester:</span>
                    <span className="ml-2 text-foreground">{ticket.requester?.name} {ticket.requester?.surname}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Contact:</span>
                    <span className="ml-2 text-foreground">{ticket.requester?.contact}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Location:</span>
                    <span className="ml-2 text-foreground">
                      {ticket.location?.building} - {ticket.location?.level} - {ticket.location?.room}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Category:</span>
                    <span className="ml-2 text-foreground">{ticket.intervention?.category}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Discipline:</span>
                    <span className="ml-2 text-foreground">{ticket.intervention?.discipline}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Description:</span>
                    <span className="ml-2 text-foreground">{ticket.intervention?.descriptionDetailed}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Approved By:</span>
                    <span className="ml-2 text-foreground">{ticket.approvedBy || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Approved At:</span>
                    <span className="ml-2 text-foreground">
                      {ticket.approvedAt ? new Date(ticket.approvedAt).toLocaleString() : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Priority (TM):</span>
                    <span className="ml-2 text-foreground font-medium">{ticket.priority || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Type (TM):</span>
                    <span className="ml-2 text-foreground font-medium">{ticket.type || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* FM Fields Section (Editable by FM only) */}
              {isFM && (
                <div className="bg-purple-900/20 border border-purple-700/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-purple-300 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Facility Manager Fields (FM Only)
                    </h4>
                    <button
                      onClick={() => openFMEditModal(ticket)}
                      className="text-xs px-3 py-1 bg-purple-600 hover:bg-purple-700 text-foreground rounded transition-colors"
                    >
                      Edit Priority/Type
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-purple-300/70">FM Priority:</span>
                      <span className="ml-2 text-foreground font-medium">{ticket.fmFields?.priority || ticket.priority || 'Not Set'}</span>
                    </div>
                    <div>
                      <span className="text-purple-300/70">FM Type:</span>
                      <span className="ml-2 text-foreground font-medium">{ticket.fmFields?.type || ticket.type || 'Not Set'}</span>
                    </div>
                    {ticket.fmFields?.lastModifiedBy && (
                      <>
                        <div>
                          <span className="text-purple-300/70">Last Modified By:</span>
                          <span className="ml-2 text-foreground text-xs">{ticket.fmFields.lastModifiedBy}</span>
                        </div>
                        <div>
                          <span className="text-purple-300/70">Last Modified:</span>
                          <span className="ml-2 text-foreground text-xs">
                            {new Date(ticket.fmFields.lastModifiedAt!).toLocaleString()}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* FM Edit Modal */}
      {showFMModal && selectedTicket && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-xl font-semibold text-foreground mb-4">Edit FM Fields</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Ticket: <span className="text-foreground font-semibold">{selectedTicket.ticketCode}</span>
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">Priority</label>
                <select
                  value={fmPriority}
                  onChange={(e) => setFmPriority(e.target.value)}
                  className="w-full bg-card border border-border rounded-lg px-4 py-2 text-foreground focus:outline-none focus:border-purple-500"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">Type</label>
                <select
                  value={fmType}
                  onChange={(e) => setFmType(e.target.value)}
                  className="w-full bg-card border border-border rounded-lg px-4 py-2 text-foreground focus:outline-none focus:border-purple-500"
                >
                  <option value="Corrective">Corrective</option>
                  <option value="Urgent">Urgent</option>
                  <option value="Preventive">Preventive</option>
                  <option value="Safety">Safety</option>
                  <option value="Regulatory">Regulatory</option>
                  <option value="Inspection">Inspection</option>
                  <option value="Cleaning">Cleaning</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowFMModal(false);
                  setSelectedTicket(null);
                }}
                className="flex-1 px-4 py-2 bg-muted hover:bg-muted text-foreground rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveFMFields}
                disabled={processing}
                className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-muted text-foreground rounded-lg font-medium transition-colors"
              >
                {processing ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
