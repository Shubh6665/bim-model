"use client";

import React, { useState, useEffect } from "react";
import { load, save, K } from "../fm-panel-utils";
import type { TicketItem, WorkOrderItem } from "../fm-panel-types";

interface ServiceRequestsProps {
  projectId?: string;
}

export 
const ServiceRequests: React.FC<{ projectId?: string; }> = ({ projectId }) => {
  // Fetch from DB only - no localStorage caching
  const [rows, setRows] = useState<WorkOrderItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<WorkOrderItem>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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
      } catch (err) { console.error('[ServiceRequests] Load error', err); }
    };
    loadData();
  }, [projectId]);



  const startEdit = (row: WorkOrderItem) => {
    setEditingId(row.id);
    setEditForm(row);
  };

  const saveEdit = async () => {
    if (!editingId) return;

    const oldRow = rows.find(r => r.id === editingId);
    const updatedRow = { ...oldRow, ...editForm, updatedAt: new Date().toISOString() };

    // Check if technician was assigned
    const wasAssigned = !oldRow?.responsibleTechnician && editForm.responsibleTechnician;
    if (wasAssigned) {
      updatedRow.assignedAt = new Date().toISOString();
    }

    // Check if status changed to Resolved
    const wasResolved = oldRow?.status !== 'Resolved' && editForm.status === 'Resolved';
    if (wasResolved) {
      updatedRow.resolvedAt = new Date().toISOString();
    }

    // Update backend if projectId available
    if (projectId) {
      try {
        const res = await fetch(`/api/projects/${projectId}/work-orders`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingId, ...editForm, wasAssigned, wasResolved })
        });

        if (res.ok) {
          // Reload from backend
          const refreshRes = await fetch(`/api/projects/${projectId}/work-orders?type=service-request`);
          if (refreshRes.ok) {
            const data = await refreshRes.json();
            if (Array.isArray(data)) setRows(data);
          }
        } else {
          // Fallback to local update
          setRows(prev => prev.map(r => r.id === editingId ? updatedRow as WorkOrderItem : r));
        }
      } catch (err) {
        console.error('[ServiceRequests] Save error', err);
        // Fallback to local update
        setRows(prev => prev.map(r => r.id === editingId ? updatedRow as WorkOrderItem : r));
      }
    } else {
      // No projectId, local update only
      setRows(prev => prev.map(r => r.id === editingId ? updatedRow as WorkOrderItem : r));
    }

    setEditingId(null);
    setEditForm({});
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Open': return 'bg-yellow-900/30 text-yellow-300';
      case 'Planned': return 'bg-blue-900/30 text-blue-300';
      case 'In Progress': return 'bg-purple-900/30 text-purple-300';
      case 'Resolved': return 'bg-green-900/30 text-green-300';
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
      <div>
        <h3 className="text-white font-semibold text-lg mb-1">Service Requests</h3>
        <p className="text-xs text-gray-400">
          <span className="inline-block bg-gray-700/40 px-1.5 py-0.5 rounded text-gray-300 mr-2">Gray fields</span>
          are from tickets.
          <span className="inline-block bg-blue-900/40 px-1.5 py-0.5 rounded text-blue-300 ml-2">Blue fields</span>
          are managed by Maintenance Team.
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
                <th className="px-3 py-2 text-left text-gray-300 whitespace-nowrap">Discipline</th>
                <th className="px-3 py-2 text-left text-gray-300 whitespace-nowrap">Category</th>
                <th className="px-3 py-2 text-left text-gray-300 whitespace-nowrap">Description</th>
                <th className="px-3 py-2 text-left text-blue-300 whitespace-nowrap">Technician</th>
                <th className="px-3 py-2 text-left text-blue-300 whitespace-nowrap">Company</th>
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
                const isEditing = editingId === row.id;
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
                      <td className="px-3 py-2 text-gray-300">{row.discipline || '-'}</td>
                      <td className="px-3 py-2 text-gray-400 text-xs max-w-[120px] truncate" title={row.category}>
                        {row.category || '-'}
                      </td>
                      <td className="px-3 py-2 text-gray-400 text-xs max-w-[150px] truncate" title={row.description}>
                        {row.description || '-'}
                      </td>
                      <td className="px-3 py-2 text-blue-300 text-xs">
                        {row.responsibleTechnician || <span className="text-gray-500">Unassigned</span>}
                      </td>
                      <td className="px-3 py-2 text-blue-300 text-xs">{row.company || '-'}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded text-xs whitespace-nowrap ${getStatusColor(row.status)}`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : row.id)}
                          className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs whitespace-nowrap"
                        >
                          {isExpanded ? 'Hide ▲' : 'Expand ▼'}
                        </button>
                      </td>
                    </tr>

                    {/* Expanded Row with Full Details */}
                    {isExpanded && (
                      <tr className="border-b border-gray-800 bg-gray-900/60">
                        <td colSpan={12} className="p-0">
                          <div className="p-4 space-y-4">
                            {!isEditing ? (
                              <>
                                {/* Gray Fields - From Ticket */}
                                <div className="bg-gray-800/40 rounded-lg p-4 border border-gray-700">
                                  <div className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                                    <span className="bg-gray-700/60 px-2 py-1 rounded text-xs">From Ticket</span>
                                    Full Request Details
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
                                  </div>
                                </div>

                                {/* Blue Fields - Maintenance Team Managed */}
                                <div className="bg-blue-900/10 rounded-lg p-4 border border-blue-900/30">
                                  <div className="text-sm font-semibold text-blue-300 mb-3 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="bg-blue-900/40 px-2 py-1 rounded text-xs">Maintenance Team</span>
                                      Management Fields
                                    </div>
                                    <button
                                      onClick={() => startEdit(row)}
                                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs"
                                    >
                                      Edit Blue Fields
                                    </button>
                                  </div>
                                  <div className="grid grid-cols-3 gap-4">
                                    <div>
                                      <div className="text-xs text-blue-400 mb-1">Responsible Technician</div>
                                      <div className="text-sm text-blue-200 font-semibold">
                                        {row.responsibleTechnician || <span className="text-gray-500">Not Assigned</span>}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-xs text-blue-400 mb-1">Company</div>
                                      <div className="text-sm text-blue-200">{row.company || 'N/A'}</div>
                                    </div>
                                    <div>
                                      <div className="text-xs text-blue-400 mb-1">Status</div>
                                      <div>
                                        <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(row.status)}`}>
                                          {row.status}
                                        </span>
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-xs text-blue-400 mb-1">Priority</div>
                                      <div className="text-sm text-blue-200">{row.priority || 'Not Set'}</div>
                                    </div>
                                    <div>
                                      <div className="text-xs text-blue-400 mb-1">Assigned At</div>
                                      <div className="text-sm text-blue-300">
                                        {row.assignedAt ? new Date(row.assignedAt).toLocaleString() : 'Not yet assigned'}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-xs text-blue-400 mb-1">Resolved At</div>
                                      <div className="text-sm text-blue-300">
                                        {row.resolvedAt ? new Date(row.resolvedAt).toLocaleString() : 'Not yet resolved'}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </>
                            ) : (
                              <>
                                {/* Edit Mode - Blue Fields Only */}
                                <div className="bg-blue-900/20 rounded-lg p-4 border-2 border-blue-600">
                                  <div className="text-sm font-semibold text-blue-300 mb-4">
                                    Edit Maintenance Team Fields
                                  </div>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <label className="text-xs text-blue-400 block mb-1.5 font-semibold">
                                        Responsible Technician *
                                      </label>
                                      <input
                                        type="text"
                                        value={editForm.responsibleTechnician || ''}
                                        onChange={e => setEditForm(prev => ({ ...prev, responsibleTechnician: e.target.value }))}
                                        className="w-full px-3 py-2 bg-gray-700 border border-blue-600 rounded text-sm text-white focus:outline-none focus:border-blue-400"
                                        placeholder="Assign technician name"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-xs text-blue-400 block mb-1.5 font-semibold">
                                        Company
                                      </label>
                                      <input
                                        type="text"
                                        value={editForm.company || ''}
                                        onChange={e => setEditForm(prev => ({ ...prev, company: e.target.value }))}
                                        className="w-full px-3 py-2 bg-gray-700 border border-blue-600 rounded text-sm text-white focus:outline-none focus:border-blue-400"
                                        placeholder="Company name"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-xs text-blue-400 block mb-1.5 font-semibold">
                                        Status *
                                      </label>
                                      <select
                                        value={editForm.status || row.status}
                                        onChange={e => setEditForm(prev => ({ ...prev, status: e.target.value as any }))}
                                        className="w-full px-3 py-2 bg-gray-700 border border-blue-600 rounded text-sm text-white focus:outline-none focus:border-blue-400"
                                      >
                                        <option value="Open">Open</option>
                                        <option value="Planned">Planned</option>
                                        <option value="In Progress">In Progress</option>
                                        <option value="Resolved">Resolved</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className="text-xs text-blue-400 block mb-1.5 font-semibold">
                                        Priority
                                      </label>
                                      <select
                                        value={editForm.priority || row.priority || 'Medium'}
                                        onChange={e => setEditForm(prev => ({ ...prev, priority: e.target.value as any }))}
                                        className="w-full px-3 py-2 bg-gray-700 border border-blue-600 rounded text-sm text-white focus:outline-none focus:border-blue-400"
                                      >
                                        <option value="Low">Low</option>
                                        <option value="Medium">Medium</option>
                                        <option value="High">High</option>
                                        <option value="Critical">Critical</option>
                                      </select>
                                    </div>
                                  </div>

                                  {/* Action Buttons */}
                                  <div className="flex gap-3 mt-4 pt-4 border-t border-blue-800">
                                    <button
                                      onClick={saveEdit}
                                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-semibold transition-colors"
                                    >
                                      Save Changes
                                    </button>
                                    <button
                                      onClick={() => { setEditingId(null); setEditForm({}); }}
                                      className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              </>
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
