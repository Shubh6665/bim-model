"use client";

import React, { useState, useEffect } from "react";
import { useUserRole } from "@/app/hooks/useUserRole";
import type { TicketItem, TicketPriority, MaintenanceType } from "../fm-panel-types";

interface PendingApprovalsProps {
  projectId?: string;
}

export const PendingApprovals: React.FC<PendingApprovalsProps> = ({ projectId }) => {
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<TicketItem | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [priority, setPriority] = useState<TicketPriority>("Medium");
  const [type, setType] = useState<MaintenanceType>("Corrective");
  const [rejectionReason, setRejectionReason] = useState("");
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

  const { role, isTM, loading: roleLoading } = useUserRole(projectId);

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
        setTickets(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Failed to fetch tickets:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedTicket || !projectId) return;
    setProcessing(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/tickets/${selectedTicket.id}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ priority, type }),
        }
      );

      if (res.ok) {
        showToast("Ticket approved successfully! Work order created.", "success");
        setShowApprovalModal(false);
        setSelectedTicket(null);
        fetchTickets();
      } else {
        const error = await res.json();
        showToast(`Approval failed: ${error.error || "Unknown error"}`, "error");
      }
    } catch (error) {
      console.error("Approval error:", error);
      showToast("Failed to approve ticket", "error");
    } finally {
      setProcessing(false);
    }
  };

    const handleReject = async () => {
    if (!selectedTicket || !projectId || !rejectionReason.trim()) {
      showToast("Please provide a rejection reason", "error");
      return;
    }
    setProcessing(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/tickets/${selectedTicket.id}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: rejectionReason }),
        }
      );

      if (res.ok) {
        showToast("Ticket rejected. Notifications sent.", "success");
        setShowRejectionModal(false);
        setSelectedTicket(null);
        setRejectionReason("");
        fetchTickets();
      } else {
        const error = await res.json();
        showToast(`Rejection failed: ${error.error || "Unknown error"}`, "error");
      }
    } catch (error) {
      console.error("Rejection error:", error);
      showToast("Failed to reject ticket", "error");
    } finally {
      setProcessing(false);
    }
  };

  const pendingTickets = tickets.filter(
    (t) => t.status === "PENDING_APPROVAL" || !t.status
  );

  const approvedTickets = tickets.filter((t) => t.status === "APPROVED");
  const rejectedTickets = tickets.filter((t) => t.status === "REJECTED");

  if (loading || roleLoading) {
    return <div className="p-4 text-gray-400">Loading...</div>;
  }

  if (!isTM) {
    return (
      <div className="p-4 text-center text-gray-400">
        <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-lg p-6">
          <div className="text-yellow-400 text-lg font-semibold mb-2"> TM Access Only</div>
          <div className="text-sm">
            Only Maintenance Team members can approve/reject tickets.
            <br />
            Your current role: <span className="text-cyan-400 font-semibold">{role || "User"}</span>
          </div>
        </div>
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
              className="text-white/80 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-white">Ticket Approvals (TM)</h2>
        
      </div>

      {/* Pending Approval Section */}
      <div className="space-y-2">
        <h3 className="text-md font-semibold text-yellow-400 flex items-center gap-2">
        Pending Approval ({pendingTickets.length})
        </h3>
        {pendingTickets.length === 0 ? (
          <div className="text-gray-500 text-sm bg-gray-800/30 rounded p-4">No pending tickets</div>
        ) : (
          <div className="space-y-2">
            {pendingTickets.map((ticket) => (
              <div key={ticket.id} className="bg-yellow-900/20 border border-yellow-700/30 rounded-lg p-3">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-semibold text-yellow-300">{ticket.ticketCode}</div>
                    <div className="text-sm text-gray-300">
                      {ticket.requester.name} {ticket.requester.surname}
                    </div>
                    <div className="text-xs text-gray-400">{ticket.requester.contact}</div>
                  </div>
                  <span className="px-2 py-1 rounded text-xs font-semibold bg-yellow-900/40 text-yellow-300">
                    PENDING
                  </span>
                </div>
                <div className="text-sm text-gray-200 mb-2">
                  {ticket.intervention?.descriptionShort || "No description"}
                </div>
                <div className="text-xs text-gray-400 mb-3">
                  {ticket.location?.building} - {ticket.location?.level} - {ticket.location?.room}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setSelectedTicket(ticket);
                      setShowApprovalModal(true);
                    }}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-sm font-medium transition-colors"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => {
                      setSelectedTicket(ticket);
                      setShowRejectionModal(true);
                    }}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded text-sm font-medium transition-colors"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Approved Section */}
      <div className="space-y-2">
        <h3 className="text-md font-semibold text-green-400 flex items-center gap-2">
          Approved ({approvedTickets.length})
        </h3>
        {approvedTickets.length === 0 ? (
          <div className="text-gray-500 text-sm">No approved tickets yet</div>
        ) : (
          <div className="space-y-2">
            {approvedTickets.slice(0, 5).map((ticket) => (
              <div key={ticket.id} className="bg-green-900/20 border border-green-700/30 rounded-lg p-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold text-green-300">{ticket.ticketCode}</div>
                    <div className="text-sm text-gray-300">
                      {ticket.requester.name} {ticket.requester.surname}
                    </div>
                    {ticket.priority && (
                      <div className="text-xs mt-1">
                        <span className={`font-semibold ${
                          ticket.priority === "Critical" ? "text-red-400" :
                          ticket.priority === "High" ? "text-orange-400" :
                          ticket.priority === "Medium" ? "text-yellow-400" :
                          "text-green-400"
                        }`}>
                          {ticket.priority}
                        </span>
                        {ticket.type && <span className="text-gray-400 ml-2">| {ticket.type}</span>}
                      </div>
                    )}
                  </div>
                  <span className="px-2 py-1 rounded text-xs font-semibold bg-green-900/40 text-green-300">
                    APPROVED
                  </span>
                </div>
              </div>
            ))}
            {approvedTickets.length > 5 && (
              <div className="text-xs text-gray-500 text-center">
                ... and {approvedTickets.length - 5} more
              </div>
            )}
          </div>
        )}
      </div>

      {/* Rejected Section */}
      {rejectedTickets.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-md font-semibold text-red-400 flex items-center gap-2">
            Rejected ({rejectedTickets.length})
          </h3>
          <div className="space-y-2">
            {rejectedTickets.slice(0, 3).map((ticket) => (
              <div key={ticket.id} className="bg-red-900/20 border border-red-700/30 rounded-lg p-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold text-red-300">{ticket.ticketCode}</div>
                    <div className="text-sm text-gray-300">
                      {ticket.requester.name} {ticket.requester.surname}
                    </div>
                    {ticket.rejectionReason && (
                      <div className="text-xs text-red-400 mt-1">Reason: {ticket.rejectionReason}</div>
                    )}
                  </div>
                  <span className="px-2 py-1 rounded text-xs font-semibold bg-red-900/40 text-red-300">
                    REJECTED
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Approval Modal */}
      {showApprovalModal && selectedTicket && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-white mb-4">Approve Ticket</h3>
            <div className="text-sm text-gray-300 mb-4">
              <div className="font-semibold">{selectedTicket.ticketCode}</div>
              <div>{selectedTicket.intervention?.descriptionShort}</div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Priority *</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TicketPriority)}
                  className="w-full bg-gray-700 text-white border border-gray-600 rounded px-3 py-2"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Type *</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as MaintenanceType)}
                  className="w-full bg-gray-700 text-white border border-gray-600 rounded px-3 py-2"
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
                onClick={handleApprove}
                disabled={processing}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-4 py-2 rounded font-medium transition-colors"
              >
                {processing ? "Approving..." : "Approve"}
              </button>
              <button
                onClick={() => {
                  setShowApprovalModal(false);
                  setSelectedTicket(null);
                }}
                disabled={processing}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {showRejectionModal && selectedTicket && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-white mb-4">Reject Ticket</h3>
            <div className="text-sm text-gray-300 mb-4">
              <div className="font-semibold">{selectedTicket.ticketCode}</div>
              <div>{selectedTicket.intervention?.descriptionShort}</div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Rejection Reason *</label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full bg-gray-700 text-white border border-gray-600 rounded px-3 py-2 min-h-[100px]"
                placeholder="Please provide a reason for rejection..."
              />
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleReject}
                disabled={processing || !rejectionReason.trim()}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white px-4 py-2 rounded font-medium transition-colors"
              >
                {processing ? "Rejecting..." : "❌ Reject"}
              </button>
              <button
                onClick={() => {
                  setShowRejectionModal(false);
                  setSelectedTicket(null);
                  setRejectionReason("");
                }}
                disabled={processing}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
