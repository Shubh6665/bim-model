"use client";

import React, { useState, useEffect } from "react";
import { load, save, K } from "../fm-panel-utils";
import type { TicketItem, WorkOrderItem } from "../fm-panel-types";
import { useUserRole } from "../../hooks/useUserRole";

interface ServiceRequestsProps {
  projectId?: string;
}

export 
const ServiceRequests: React.FC<{ projectId?: string; }> = ({ projectId }) => {
  const { role, isTM, isFM } = useUserRole(projectId);
  
  // Fetch from DB only - no localStorage caching
  const [rows, setRows] = useState<WorkOrderItem[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // TM Approval State
  const [showTMApproval, setShowTMApproval] = useState(false);
  const [showTMRejection, setShowTMRejection] = useState(false);
  const [tmTicketId, setTmTicketId] = useState<string | null>(null);
  const [tmPriority, setTmPriority] = useState<'Low' | 'Medium' | 'High' | 'Critical'>('Medium');
  const [tmType, setTmType] = useState<'Corrective' | 'Urgent' | 'Preventive' | 'Safety' | 'Regulatory' | 'Inspection' | 'Cleaning'>('Corrective');
  const [tmRejectionReason, setTmRejectionReason] = useState('');
  // Ticket approval status map (sourceTicketId -> approvalStatus)
  const [ticketStatusMap, setTicketStatusMap] = useState<Record<string, string>>({});
  // Ticket data cache (sourceTicketId -> ticket details including rejectionReason)
  const [ticketDataMap, setTicketDataMap] = useState<Record<string, any>>({});
  
  // Project Team Cache
  const [projectTeam, setProjectTeam] = useState<{ name: string; email: string; role: string }[]>([]);

  // FM Edit State
  const [showFMEdit, setShowFMEdit] = useState(false);
  const [fmOrderId, setFmOrderId] = useState<string | null>(null);
  const [fmPriority, setFmPriority] = useState<'Low' | 'Medium' | 'High' | 'Critical'>('Medium');
  const [fmType, setFmType] = useState<'Corrective' | 'Preventive' | 'Predictive'>('Corrective');
  
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({ 
    show: false, 
    message: '', 
    type: 'success' 
  });

  const showToastMessage = (message: string, type: 'success' | 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  // Filters
  const [filters, setFilters] = useState({
    status: 'all',
    discipline: 'all',
    technician: 'all',
    priority: 'all',
    search: ''
  });

  // Sorting
  const [sortBy, setSortBy] = useState<'requestId' | 'status' | 'createdAt' | 'requester'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Cache to localStorage
  useEffect(() => save(K.serviceRequests(projectId), rows), [rows, projectId]);

  // Load from backend
  useEffect(() => {
    const loadData = async () => {
      if (!projectId) return;
      try {
        const res = await fetch(`/api/projects/${projectId}/work-orders?type=service-request`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) setRows(data);
        }
        
        // Load Project Team
        const teamRes = await fetch(`/api/projects/${projectId}/team`);
        if (teamRes.ok) {
          const teamData = await teamRes.json();
          if (Array.isArray(teamData.team)) setProjectTeam(teamData.team);
        }
      } catch (err) { console.error('[ServiceRequests] Load error', err); }
    };
    loadData();
  }, [projectId]);

  // Helper to get emails by role
  const getEmailsByRole = (role: 'TM' | 'FM') => {
    return projectTeam
      .filter(m => m.role === role)
      .map(m => m.email)
      .join(', ') || '-';
  };

  // TM Approval Handler
  const handleTMApprove = async () => {
    if (!tmTicketId || !projectId) return;
    setProcessing(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/tickets/${tmTicketId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority: tmPriority, type: tmType }),
      });
      
      if (res.ok) {
        showToastMessage('Ticket approved and work order created successfully', 'success');
        setShowTMApproval(false);
        
        // Update local state immediately
        setTicketStatusMap(prev => ({ ...prev, [tmTicketId]: 'APPROVED' }));
        
        // Update ticket data map with new values so TM Decision section reflects them
        setTicketDataMap(prev => ({
          ...prev,
          [tmTicketId]: {
            ...(prev[tmTicketId] || {}),
            approvalStatus: 'APPROVED',
            status: 'APPROVED',
            priority: tmPriority,
            type: tmType
          }
        }));

        setTmTicketId(null);
        setExpandedId(null);
        // Reload work orders
        const refreshRes = await fetch(`/api/projects/${projectId}/work-orders?type=service-request`);
        if (refreshRes.ok) {
          const data = await refreshRes.json();
          if (Array.isArray(data)) setRows(data);
        }
      } else {
        const error = await res.json();
        showToastMessage(error.error || 'Failed to approve ticket', 'error');
      }
    } catch (error) {
      showToastMessage('Failed to approve ticket', 'error');
    } finally {
      setProcessing(false);
    }
  };

  // TM Rejection Handler
  const handleTMReject = async () => {
    if (!tmTicketId || !projectId || !tmRejectionReason.trim()) {
      showToastMessage('Please provide a rejection reason', 'error');
      return;
    }
    setProcessing(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/tickets/${tmTicketId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: tmRejectionReason }),
      });
      
      if (res.ok) {
        showToastMessage('Ticket rejected. Notifications sent to user and FM.', 'success');
        setShowTMRejection(false);
        // mark ticket rejected locally so TM section hides
        setTicketStatusMap(prev => ({ ...prev, [tmTicketId]: 'REJECTED' }));
        setTmTicketId(null);
        setTmRejectionReason('');
        setExpandedId(null);
        // Reload work orders
        const refreshRes = await fetch(`/api/projects/${projectId}/work-orders?type=service-request`);
        if (refreshRes.ok) {
          const data = await refreshRes.json();
          if (Array.isArray(data)) setRows(data);
        }
      } else {
        const error = await res.json();
        showToastMessage(error.error || 'Failed to reject ticket', 'error');
      }
    } catch (error) {
      showToastMessage('Failed to reject ticket', 'error');
    } finally {
      setProcessing(false);
    }
  };

  // FM Field Edit Handler
  const handleFMSave = async () => {
    if (!fmOrderId || !projectId) return;
    setProcessing(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/work-orders/${fmOrderId}/fm-fields`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority: fmPriority, type: fmType }),
      });
      
      if (res.ok) {
        showToastMessage('Priority and Type updated successfully', 'success');
        setShowFMEdit(false);
        setFmOrderId(null);
        // Reload work orders
        const refreshRes = await fetch(`/api/projects/${projectId}/work-orders?type=service-request`);
        if (refreshRes.ok) {
          const data = await refreshRes.json();
          if (Array.isArray(data)) setRows(data);
        }
      } else {
        const error = await res.json();
        showToastMessage(error.error || 'Failed to update fields', 'error');
      }
    } catch (error) {
      showToastMessage('Failed to update fields', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const normalizeStatus = (status: string) => {
    if (!status) return '';
    if (status === 'OPEN') return 'Open';
    if (status === 'PLANNED') return 'Planned';
    if (status === 'IN_PROGRESS') return 'In Progress';
    if (status === 'RESOLVED') return 'Resolved';
    if (status === 'CLOSE') return 'Closed';
    if (status === 'REJECTED') return 'Rejected';
    return status;
  };

  const getStatusColor = (status: string) => {
    // Normalize for color lookup
    const normalized = normalizeStatus(status);
    switch (normalized) {
      case 'Open': return 'bg-yellow-900/30 text-yellow-300';
      case 'Planned': return 'bg-blue-900/30 text-blue-300';
      case 'In Progress': return 'bg-purple-900/30 text-purple-300';
      case 'Resolved': return 'bg-green-900/30 text-green-300';
      case 'Rejected': return 'bg-red-900/30 text-red-300';
      default: return 'bg-gray-800/60 text-gray-300';
    }
  };

  // Apply filters and sorting
  const filteredRows = rows.filter(row => {
    if (filters.status !== 'all' && row.status !== filters.status) return false;
    if (filters.discipline !== 'all' && row.discipline !== filters.discipline) return false;
    if (filters.technician !== 'all' && row.responsibleTechnician !== filters.technician) return false;
    if (filters.priority !== 'all' && row.priority !== filters.priority) return false;
    if (filters.search) {
      const search = filters.search.toLowerCase();
      return (
        row.requestId?.toLowerCase().includes(search) ||
        row.requester?.toLowerCase().includes(search) ||
        row.description?.toLowerCase().includes(search) ||
        row.location?.toLowerCase().includes(search)
      );
    }
    return true;
  }).sort((a, b) => {
    let aVal: any, bVal: any;

    switch (sortBy) {
      case 'requestId':
        aVal = a.requestId || '';
        bVal = b.requestId || '';
        break;
      case 'status':
        aVal = a.status || '';
        bVal = b.status || '';
        break;
      case 'requester':
        aVal = a.requester || '';
        bVal = b.requester || '';
        break;
      case 'createdAt':
        aVal = new Date(a.createdAt || 0).getTime();
        bVal = new Date(b.createdAt || 0).getTime();
        break;
      default:
        return 0;
    }

    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  // Get unique values for filters
  const uniqueStatuses = Array.from(new Set(rows.map(r => r.status).filter(Boolean)));
  const uniqueDisciplines = Array.from(new Set(rows.map(r => r.discipline).filter(Boolean)));
  const uniqueTechnicians = Array.from(new Set(rows.map(r => r.responsibleTechnician).filter(Boolean)));
  const uniquePriorities = Array.from(new Set(rows.map(r => r.priority).filter(Boolean)));

  // Selection handlers
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredRows.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRows.map(r => r.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  // Export to CSV - only selected rows
  const exportToCSV = () => {
    const rowsToExport = selectedIds.size > 0
      ? filteredRows.filter(r => selectedIds.has(r.id))
      : filteredRows;

    const headers = [
      'Request ID', 'Requester', 'Contact', 'Location', 'Intervention Details',
      'Discipline', 'Category', 'Description', 'Attachments', 'Asset',
      'Responsible Technician', 'Company', 'Status', 'Priority', 'Created At'
    ];

    const csvRows = [
      headers.join(','),
      ...rowsToExport.map(row => [
        row.requestId || '',
        row.requester || '',
        row.contact || '',
        row.location || '',
        (row.interventionDetails || '').replace(/,/g, ';'),
        row.discipline || '',
        row.category || '',
        (row.description || '').replace(/,/g, ';'),
        (row.attachments || []).length,
        row.asset || '',
        row.responsibleTechnician || '',
        row.company || '',
        row.status || '',
        row.priority || '',
        row.createdAt ? new Date(row.createdAt).toLocaleString() : ''
      ].map(val => `"${val}"`).join(','))
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `service-requests-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const clearFilters = () => {
    setFilters({
      status: 'all',
      discipline: 'all',
      technician: 'all',
      priority: 'all',
      search: ''
    });
  };

  return (
    <div className="p-4 space-y-4 h-full flex flex-col overflow-hidden">
      {/* Toast Notification */}
      {toast.show && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg ${
          toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
        } text-white font-medium animate-in slide-in-from-top-2 duration-300`}>
          {toast.message}
        </div>
      )}

      <div>
        <h3 className="text-white font-semibold text-lg mb-1">Service Requests</h3>
        <p className="text-xs text-gray-400">
          View and manage all service requests. Expand rows to access role-based actions.
        </p>
      </div>

      {/* Filters and Actions */}
      <div className="flex flex-wrap items-center gap-2 bg-gray-800/40 p-3 rounded-lg">
        <input
          type="text"
          placeholder="Search..."
          value={filters.search}
          onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
          className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-white flex-1 min-w-[200px]"
        />

        <select
          value={filters.status}
          onChange={e => setFilters(prev => ({ ...prev, status: e.target.value }))}
          className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-white"
        >
          <option value="all">All Status</option>
          {uniqueStatuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <select
          value={filters.discipline}
          onChange={e => setFilters(prev => ({ ...prev, discipline: e.target.value }))}
          className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-white"
        >
          <option value="all">All Disciplines</option>
          {uniqueDisciplines.map(d => <option key={d} value={d}>{d}</option>)}
        </select>

        <select
          value={filters.technician}
          onChange={e => setFilters(prev => ({ ...prev, technician: e.target.value }))}
          className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-white"
        >
          <option value="all">All Technicians</option>
          {uniqueTechnicians.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <select
          value={filters.priority}
          onChange={e => setFilters(prev => ({ ...prev, priority: e.target.value }))}
          className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-white"
        >
          <option value="all">All Priorities</option>
          {uniquePriorities.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        <button
          onClick={clearFilters}
          className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded transition-colors"
        >
          Clear Filters
        </button>

        <button
          onClick={exportToCSV}
          disabled={selectedIds.size === 0}
          className={`px-3 py-1.5 text-white text-sm rounded transition-colors ${selectedIds.size > 0
            ? 'bg-green-600 hover:bg-green-700'
            : 'bg-gray-600 cursor-not-allowed'
            }`}
        >
          Export to CSV {selectedIds.size > 0 && `(${selectedIds.size})`}
        </button>
      </div>

      {/* Results count */}
      <div className="text-xs text-gray-400">
        Showing {filteredRows.length} of {rows.length} request{rows.length !== 1 ? 's' : ''}
        {selectedIds.size > 0 && ` • ${selectedIds.size} selected`}
      </div>

      {rows.length === 0 ? (
        <div className="text-gray-400 text-sm bg-gray-800/30 rounded-lg p-6 text-center">
          No service requests yet. Requests will appear here when submitted through the Maintenance Ticket form.
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="text-gray-400 text-sm bg-gray-800/30 rounded-lg p-6 text-center">
          No requests match the current filters.
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-gray-900 z-10">
              <tr className="border-b border-gray-700">
                <th className="px-3 py-2 text-left">
                  <input
                    type="checkbox"
                    className="rounded"
                    checked={selectedIds.size === filteredRows.length && filteredRows.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th
                  className="px-3 py-2 text-left text-gray-300 cursor-pointer hover:text-white whitespace-nowrap"
                  onClick={() => toggleSort('requestId')}
                >
                  Request ID {sortBy === 'requestId' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className="px-3 py-2 text-left text-gray-300 cursor-pointer hover:text-white whitespace-nowrap"
                  onClick={() => toggleSort('requester')}
                >
                  Requester {sortBy === 'requester' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-3 py-2 text-left text-gray-300 whitespace-nowrap">Contact</th>
                <th className="px-3 py-2 text-left text-gray-300 whitespace-nowrap">Location</th>
                <th className="px-3 py-2 text-left text-gray-300 whitespace-nowrap">Category</th>
                <th className="px-3 py-2 text-left text-gray-300 whitespace-nowrap">Description</th>
                <th className="px-3 py-2 text-left text-gray-300 whitespace-nowrap">Maintenance Team</th>
                <th className="px-3 py-2 text-left text-blue-300 whitespace-nowrap">Technician</th>
                <th className="px-3 py-2 text-left text-blue-300 whitespace-nowrap">Company</th>
                <th className="px-3 py-2 text-left text-blue-300 whitespace-nowrap">Facility Manager</th>
                <th
                  className="px-3 py-2 text-left text-blue-300 cursor-pointer hover:text-white whitespace-nowrap"
                  onClick={() => toggleSort('status')}
                >
                  Status {sortBy === 'status' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-3 py-2 text-left text-gray-300 whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map(row => {
                const isExpanded = expandedId === row.id;
                const isSelected = selectedIds.has(row.id);

                return (
                  <React.Fragment key={row.id}>
                    <tr className={`border-b border-gray-800 hover:bg-gray-800/40 transition-colors ${isSelected ? 'bg-blue-900/20' : ''}`}>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          className="rounded"
                          checked={isSelected}
                          onChange={() => toggleSelect(row.id)}
                        />
                      </td>
                      <td className="px-3 py-2 text-blue-400 font-mono text-xs">
                        {row.requestId || row.id.slice(0, 12)}
                      </td>
                      <td className="px-3 py-2 text-gray-300">{row.requester || '-'}</td>
                      <td className="px-3 py-2 text-gray-400 text-xs">{row.contact || '-'}</td>
                      <td className="px-3 py-2 text-gray-400 text-xs max-w-[120px] truncate" title={row.location}>
                        {row.location || '-'}
                      </td>
                      <td className="px-3 py-2 text-gray-400 text-xs max-w-[120px] truncate" title={row.category}>
                        {row.category || '-'}
                      </td>
                      <td className="px-3 py-2 text-gray-400 text-xs max-w-[150px] truncate" title={row.description}>
                        {row.description || '-'}
                      </td>
                      <td className="px-3 py-2 text-gray-300 text-xs">{getEmailsByRole('TM')}</td>
                      <td className="px-3 py-2 text-blue-300 text-xs">
                        {row.assignedTechnicians && row.assignedTechnicians.length > 0 
                          ? row.assignedTechnicians.map(t => t.name).join(', ') 
                          : (row.responsibleTechnician || <span className="text-gray-500">Unassigned</span>)}
                      </td>
                      <td className="px-3 py-2 text-blue-300 text-xs">
                        {row.assignedTechnicians && row.assignedTechnicians.length > 0 
                          ? row.assignedTechnicians.map(t => t.company).filter(Boolean).join(', ') || '-'
                          : (row.company || '-')}
                      </td>
                      <td className="px-3 py-2 text-blue-300 text-xs">{getEmailsByRole('FM')}</td>
                      <td className="px-3 py-2">
                        {(() => {
                          const isRejected = row.ticketStatus === 'REJECTED' || row.status === 'Rejected';
                          const rawStatus = isRejected ? 'Rejected' : row.status;
                          const displayStatus = normalizeStatus(rawStatus);
                          return (
                            <span className={`px-2 py-0.5 rounded text-xs whitespace-nowrap ${getStatusColor(displayStatus)}`}>
                              {displayStatus}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          onClick={async () => {
                            if (isExpanded) {
                              setExpandedId(null);
                              return;
                            }
                            setExpandedId(row.id);
                            // If this row is linked to a ticket, fetch ticket details (if not already)
                            const tid = row.sourceTicketId || row.ticketId;
                            if (tid && projectId && !ticketStatusMap[tid]) {
                              try {
                                const res = await fetch(`/api/projects/${projectId}/tickets`);
                                if (res.ok) {
                                  const tickets = await res.json();
                                  const found = Array.isArray(tickets) ? tickets.find((t: any) => (t.id === tid || t._id === tid)) : null;
                                  if (found) {
                                    const status = found.approvalStatus || found.status || 'PENDING_APPROVAL';
                                    setTicketStatusMap(prev => ({ ...prev, [tid]: status }));
                                    // Store full ticket data including rejectionReason
                                    setTicketDataMap(prev => ({ ...prev, [tid]: found }));
                                  }
                                }
                              } catch (e) {
                                console.error('[ServiceRequests] Failed to load ticket data', e);
                              }
                            }
                          }}
                          className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs whitespace-nowrap"
                        >
                          {isExpanded ? 'Hide ▲' : 'Expand ▼'}
                        </button>
                      </td>
                    </tr>

                    {/* Expanded Row with Full Details */}
                    {isExpanded && (
                      <tr className="border-b border-gray-800 bg-gray-900/60">
                        <td colSpan={13} className="p-0">
                          <div className="p-4 space-y-4">
                            {/* Gray Fields - From Ticket */}
                            <div className="bg-gray-800/40 rounded-lg p-4 border border-gray-700">
                              <div className="text-sm font-semibold text-gray-300 mb-3 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="bg-gray-700/60 px-2 py-1 rounded text-xs">From Ticket</span>
                                  Full Request Details (READ-ONLY)
                                </div>
                                {/* Approval Status Badge */}
                                {(() => {
                                  const tid = row.sourceTicketId || row.ticketId;
                                  const ticketStatus = tid ? (ticketStatusMap[tid] || '').toUpperCase() : '';
                                  if (ticketStatus === 'APPROVED') {
                                    return (
                                      <span className="px-3 py-1 rounded text-xs font-bold bg-green-700/80 text-white">
                                        Approved
                                      </span>
                                    );
                                  }
                                  if (ticketStatus === 'REJECTED') {
                                    return (
                                      <span className="px-3 py-1 rounded text-xs font-bold bg-red-700/80 text-white">
                                        Rejected
                                      </span>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                              <div className="grid grid-cols-3 gap-4">
                                <div>
                                  <div className="text-xs text-gray-500 mb-1">Request ID</div>
                                  <div className="text-sm text-white font-mono">{row.requestId || 'N/A'}</div>
                                </div>
                                <div>
                                  <div className="text-xs text-gray-500 mb-1">Requester</div>
                                  <div className="text-sm text-gray-200">{row.requester || 'N/A'}</div>
                                </div>
                                <div>
                                  <div className="text-xs text-gray-500 mb-1">Contact</div>
                                  <div className="text-sm text-gray-200">{row.contact || 'N/A'}</div>
                                </div>
                                <div>
                                  <div className="text-xs text-gray-500 mb-1">Location</div>
                                  <div className="text-sm text-gray-200">{row.location || 'N/A'}</div>
                                </div>
                                <div>
                                  <div className="text-xs text-gray-500 mb-1">Discipline</div>
                                  <div className="text-sm text-gray-200">{row.discipline || 'N/A'}</div>
                                </div>
                                <div>
                                  <div className="text-xs text-gray-500 mb-1">Category</div>
                                  <div className="text-sm text-gray-200">{row.category || 'N/A'}</div>
                                </div>
                                <div className="col-span-3">
                                  <div className="text-xs text-gray-500 mb-1">Short Description</div>
                                  <div className="text-sm text-gray-200">{row.description || 'N/A'}</div>
                                </div>
                                <div className="col-span-3">
                                  <div className="text-xs text-gray-500 mb-1">Detailed Intervention Description</div>
                                  <div className="text-sm text-gray-200 whitespace-pre-wrap">{row.interventionDetails || 'N/A'}</div>
                                </div>
                                <div>
                                  <div className="text-xs text-gray-500 mb-1">Asset</div>
                                  <div className="text-sm text-gray-200">{row.asset || 'N/A'}</div>
                                </div>
                                <div>
                                  <div className="text-xs text-gray-500 mb-1">Attachments</div>
                                  <div className="text-sm text-gray-200">
                                    {row.attachments && row.attachments.length > 0
                                      ? `${row.attachments.length} file(s)`
                                      : 'None'}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-xs text-gray-500 mb-1">Created At</div>
                                  <div className="text-sm text-gray-400">
                                    {row.createdAt ? new Date(row.createdAt).toLocaleString() : 'N/A'}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-xs text-gray-500 mb-1">Status</div>
                                  <div>
                                    {(() => {
                                      const isRejected = row.ticketStatus === 'REJECTED' || row.status === 'Rejected';
                                      const rawStatus = isRejected ? 'Rejected' : row.status;
                                      const displayStatus = normalizeStatus(rawStatus);
                                      return (
                                        <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(displayStatus)}`}>
                                          {displayStatus}
                                        </span>
                                      );
                                    })()}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-xs text-gray-500 mb-1">Technician</div>
                                  <div className="text-sm text-gray-200">
                                    {row.assignedTechnicians && row.assignedTechnicians.length > 0 ? (
                                      <div className="flex flex-col gap-1">
                                        {row.assignedTechnicians.map((tech: any, idx: number) => (
                                          <div key={idx} className="flex flex-col text-xs bg-gray-700/50 p-1.5 rounded">
                                            <span className="font-medium text-white">{tech.name}</span>
                                            <span className="text-gray-400">{tech.email}</span>
                                            {tech.company && <span className="text-blue-300">{tech.company}</span>}
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      row.responsibleTechnician || 'Not Assigned'
                                    )}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-xs text-gray-500 mb-1">Company</div>
                                  <div className="text-sm text-gray-200">
                                    {row.assignedTechnicians && row.assignedTechnicians.length > 0 
                                      ? row.assignedTechnicians.map(t => t.company).filter(Boolean).join(', ') || 'N/A'
                                      : (row.company || 'N/A')}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* TM Section - Approval / Rejection (Only for TM Role) */}
                            {isTM && (row.sourceTicketId || row.ticketId) && (
                              (() => {
                                const tid = row.sourceTicketId || row.ticketId!;
                                const ticketStatus = (ticketStatusMap[tid] || 'PENDING_APPROVAL').toUpperCase();
                                const ticketData = ticketDataMap[tid] || {};

                                // If already approved or rejected, show static summary (no buttons)
                                if (ticketStatus === 'APPROVED' || ticketStatus === 'REJECTED') {
                                  return (
                                    <div className="bg-blue-900/10 rounded-lg p-4 border border-blue-800">
                                      <div className="flex items-center justify-between mb-3">
                                        <div className="text-sm font-semibold text-blue-300 flex items-center gap-2">
                                          <span className="bg-blue-800/80 px-2 py-1 rounded text-xs">TM Decision</span>
                                          {ticketStatus === 'APPROVED' ? 'Approved Ticket' : 'Rejected Ticket'}
                                        </div>
                                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                          ticketStatus === 'APPROVED'
                                            ? 'bg-green-900/40 text-green-300'
                                            : 'bg-red-900/40 text-red-300'
                                        }`}>
                                          {ticketStatus}
                                        </span>
                                      </div>

                                      <div className="grid grid-cols-3 gap-4 text-sm">
                                        <div>
                                          <div className="text-xs text-gray-500 mb-1">Priority (TM)</div>
                                          <div className="text-gray-200">{row.priority || ticketData.priority || 'N/A'}</div>
                                        </div>
                                        <div>
                                          <div className="text-xs text-gray-500 mb-1">Type (TM)</div>
                                          <div className="text-gray-200">{row.type || row.maintenanceType || ticketData.type || 'N/A'}</div>
                                        </div>
                                        {ticketStatus === 'REJECTED' && (
                                          <div className="col-span-3">
                                            <div className="text-xs text-gray-500 mb-1">Rejection Reason</div>
                                            <div className="text-gray-200 whitespace-pre-wrap">{ticketData.rejectionReason || 'Not provided'}</div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                }

                                // Pending approval: show buttons / forms
                                return (
                                  <div className="bg-blue-900/20 rounded-lg p-4 border border-blue-700">
                                    <div className="text-sm font-semibold text-blue-300 mb-3 flex items-center gap-2">
                                      <span className="bg-blue-700/60 px-2 py-1 rounded text-xs">Maintenance Team</span>
                                      Ticket Approval Management
                                    </div>
                                    
                                    {!showTMApproval && !showTMRejection ? (
                                      <div className="flex gap-3">
                                        <button
                                          onClick={() => {
                                            setTmTicketId(tid);
                                            setTmPriority(row.priority || 'Medium');
                                            setTmType((row.type || row.maintenanceType) as any || 'Corrective');
                                            setShowTMApproval(true);
                                          }}
                                          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                                        >
                                          Approve Ticket
                                        </button>
                                        <button
                                          onClick={() => {
                                            setTmTicketId(tid);
                                            setShowTMRejection(true);
                                          }}
                                          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                                        >
                                          Reject Ticket
                                        </button>
                                      </div>
                                    ) : showTMApproval ? (
                                  <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                      <div>
                                        <label className="text-xs text-blue-400 block mb-1.5 font-semibold">Priority</label>
                                        <select
                                          value={tmPriority}
                                          onChange={(e) => setTmPriority(e.target.value as any)}
                                          className="w-full px-3 py-2 bg-gray-800/80 border border-blue-600 rounded text-sm text-white"
                                        >
                                          <option value="Low">Low</option>
                                          <option value="Medium">Medium</option>
                                          <option value="High">High</option>
                                          <option value="Critical">Critical</option>
                                        </select>
                                      </div>
                                      <div>
                                        <label className="text-xs text-blue-400 block mb-1.5 font-semibold">Type</label>
                                        <select
                                          value={tmType}
                                          onChange={(e) => setTmType(e.target.value as any)}
                                          className="w-full px-3 py-2 bg-gray-800/80 border border-blue-600 rounded text-sm text-white"
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
                                    <div className="flex gap-2">
                                      <button
                                        onClick={handleTMApprove}
                                        disabled={processing}
                                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                                      >
                                        {processing ? 'Processing...' : 'Confirm Approval'}
                                      </button>
                                      <button
                                        onClick={() => setShowTMApproval(false)}
                                        className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="space-y-3">
                                    <div>
                                      <label className="text-xs text-red-400 block mb-1.5 font-semibold">Rejection Reason *</label>
                                      <textarea
                                        value={tmRejectionReason}
                                        onChange={(e) => setTmRejectionReason(e.target.value)}
                                        className="w-full px-3 py-2 bg-gray-800/80 border border-red-600 rounded text-sm text-white"
                                        rows={3}
                                        placeholder="Enter reason for rejection..."
                                      />
                                    </div>
                                    <div className="flex gap-2">
                                      <button
                                        onClick={handleTMReject}
                                        disabled={processing || !tmRejectionReason.trim()}
                                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                                      >
                                        {processing ? 'Processing...' : 'Confirm Rejection'}
                                      </button>
                                      <button
                                        onClick={() => {
                                          setShowTMRejection(false);
                                          setTmRejectionReason('');
                                        }}
                                        className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                )}
                                  </div>
                                );
                              })()
                            )}

                            {/* FM Section - Priority & Type Editor (Only for FM Role) */}
                            {isFM && row.id && (
                              (() => {
                                const tid = row.sourceTicketId || row.ticketId;
                                const ticketStatus = tid ? (ticketStatusMap[tid] || 'PENDING_APPROVAL').toUpperCase() : 'PENDING_APPROVAL';

                                // If ticket is rejected, show read-only rejected state for FM as well
                                if (ticketStatus === 'REJECTED') {
                                  return (
                                    <div className="bg-purple-900/20 rounded-lg p-4 border border-purple-700">
                                      <div className="flex items-center justify-between mb-3">
                                        <div className="text-sm font-semibold text-purple-300 flex items-center gap-2">
                                          <span className="bg-purple-700/60 px-2 py-1 rounded text-xs">FM View</span>
                                          Ticket Rejected
                                        </div>
                                        <span className="px-2 py-1 rounded text-xs font-semibold bg-red-900/40 text-red-300">
                                          REJECTED
                                        </span>
                                      </div>
                                      <div className="grid grid-cols-4 gap-3 text-sm">
                                        <div>
                                          <div className="text-xs text-gray-500 mb-1">Priority</div>
                                          <div className="text-sm text-purple-300 font-semibold">{row.priority || 'N/A'}</div>
                                        </div>
                                        <div>
                                          <div className="text-xs text-gray-500 mb-1">Type</div>
                                          <div className="text-sm text-purple-300 font-semibold">{row.type || row.maintenanceType || 'N/A'}</div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                }

                                // Otherwise normal FM edit section
                                return (
                                  <div className="bg-purple-900/20 rounded-lg p-4 border border-purple-700">
                                    <div className="text-sm font-semibold text-purple-300 mb-3 flex items-center gap-2">
                                      <span className="bg-purple-700/60 px-2 py-1 rounded text-xs">FM Actions</span>
                                      Priority & Type Management
                                    </div>
                                    <div className="grid grid-cols-4 gap-3 mb-3">
                                      <div>
                                        <div className="text-xs text-gray-500 mb-1">Current Priority</div>
                                        <div className="text-sm text-purple-300 font-semibold">{row.priority || 'N/A'}</div>
                                      </div>
                                      <div>
                                        <div className="text-xs text-gray-500 mb-1">Current Type</div>
                                        <div className="text-sm text-purple-300 font-semibold">{row.type || row.maintenanceType || 'N/A'}</div>
                                      </div>
                                    </div>
                                    {!showFMEdit ? (
                                      <button
                                        onClick={() => {
                                          setFmOrderId(row.id);
                                          setFmPriority(row.priority || 'Medium');
                                          setFmType((row.type || row.maintenanceType) as any || 'Corrective');
                                          setShowFMEdit(true);
                                        }}
                                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
                                      >
                                        Edit Priority & Type
                                      </button>
                                    ) : (
                                      <div className="space-y-3">
                                        <div className="grid grid-cols-2 gap-3">
                                          <div>
                                            <label className="text-xs text-purple-400 block mb-1.5 font-semibold">Priority</label>
                                            <select
                                              value={fmPriority}
                                              onChange={(e) => setFmPriority(e.target.value as any)}
                                              className="w-full px-3 py-2 bg-gray-800/80 border border-purple-600 rounded text-sm text-white"
                                            >
                                              <option value="Low">Low</option>
                                              <option value="Medium">Medium</option>
                                              <option value="High">High</option>
                                              <option value="Critical">Critical</option>
                                            </select>
                                          </div>
                                          <div>
                                            <label className="text-xs text-purple-400 block mb-1.5 font-semibold">Maintenance Type</label>
                                            <select
                                              value={fmType}
                                              onChange={(e) => setFmType(e.target.value as any)}
                                              className="w-full px-3 py-2 bg-gray-800/80 border border-purple-600 rounded text-sm text-white"
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
                                        <div className="flex gap-2">
                                          <button
                                            onClick={handleFMSave}
                                            disabled={processing}
                                            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                                          >
                                            {processing ? 'Saving...' : 'Save Changes'}
                                          </button>
                                          <button
                                            onClick={() => setShowFMEdit(false)}
                                            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// Maintenance Reports
