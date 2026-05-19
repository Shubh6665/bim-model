"use client";

import React, { useState, useEffect } from "react";
import MaintenanceReport from "../fm-maintenance-report";
import { load, save, K, stripRevitPrefix } from "../fm-panel-utils";
import type { WorkOrderItem, ScheduledItem } from "../fm-panel-types";

// Type alias for backward compatibility
type WOType = WorkOrderItem;

interface WorkOrdersProps {
  projectId?: string;
}

export 
const WorkOrders: React.FC<{ projectId?: string; }> = ({ projectId }) => {
  // Fetch from DB only - no localStorage caching
  const [rows, setRows] = useState<WorkOrderItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<WorkOrderItem>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showAttachmentsModal, setShowAttachmentsModal] = useState<WorkOrderItem | null>(null);
  const [showCommentsModal, setShowCommentsModal] = useState<WorkOrderItem | null>(null);
  const [newComment, setNewComment] = useState('');

  // Filters
  const [filters, setFilters] = useState({
    status: 'all',
    discipline: 'all',
    technician: 'all',
    priority: 'all',
    search: ''
  });

  // Sorting
  const [sortBy, setSortBy] = useState<'requestId' | 'status' | 'createdAt' | 'priority'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Load from backend
  useEffect(() => {
    const loadData = async () => {
      if (!projectId) return;
      try {
        const res = await fetch(`/api/projects/${projectId}/work-orders`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) setRows(data);
        }
      } catch (err) { console.error('[WorkOrders] Load error', err); }
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
          const refreshRes = await fetch(`/api/projects/${projectId}/work-orders`);
          if (refreshRes.ok) {
            const data = await refreshRes.json();
            if (Array.isArray(data)) setRows(data);
          }
        } else {
          // Fallback to local update
          setRows(prev => prev.map(r => r.id === editingId ? updatedRow as WorkOrderItem : r));
        }
      } catch (err) {
        console.error('[WorkOrders] Save error', err);
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

  const addComment = async (workOrderId: string) => {
    if (!newComment.trim()) return;

    const comment = {
      id: `comment-${Date.now()}`,
      author: 'Current User', // TODO: Get from session
      text: newComment,
      timestamp: new Date().toISOString()
    };

    const updatedRow = rows.find(r => r.id === workOrderId);
    if (!updatedRow) return;

    const comments = [...(updatedRow.comments || []), comment];

    if (projectId) {
      try {
        await fetch(`/api/projects/${projectId}/work-orders`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: workOrderId, comments })
        });

        setRows(prev => prev.map(r => r.id === workOrderId ? { ...r, comments } : r));
      } catch (err) {
        console.error('[WorkOrders] Add comment error', err);
      }
    } else {
      setRows(prev => prev.map(r => r.id === workOrderId ? { ...r, comments } : r));
    }

    setNewComment('');
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredAndSortedRows.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAndSortedRows.map(r => r.id)));
    }
  };

  const bulkAssignTechnician = async () => {
    const technician = prompt('Enter technician name:');
    if (!technician) return;

    const updates = Array.from(selectedIds).map(id => ({
      id,
      responsibleTechnician: technician,
      assignedAt: new Date().toISOString()
    }));

    if (projectId) {
      try {
        await fetch(`/api/projects/${projectId}/work-orders/bulk`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates })
        });

        setRows(prev => prev.map(r =>
          selectedIds.has(r.id) ? { ...r, responsibleTechnician: technician, assignedAt: new Date().toISOString() } : r
        ));
      } catch (err) {
        console.error('[WorkOrders] Bulk assign error', err);
      }
    } else {
      setRows(prev => prev.map(r =>
        selectedIds.has(r.id) ? { ...r, responsibleTechnician: technician, assignedAt: new Date().toISOString() } : r
      ));
    }

    setSelectedIds(new Set());
  };

  const bulkChangeStatus = async (status: WorkOrderItem['status']) => {
    const updates = Array.from(selectedIds).map(id => ({
      id,
      status,
      ...(status === 'Resolved' ? { resolvedAt: new Date().toISOString() } : {})
    }));

    if (projectId) {
      try {
        await fetch(`/api/projects/${projectId}/work-orders/bulk`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates })
        });

        setRows(prev => prev.map(r =>
          selectedIds.has(r.id) ? { ...r, status, ...(status === 'Resolved' ? { resolvedAt: new Date().toISOString() } : {}) } : r
        ));
      } catch (err) {
        console.error('[WorkOrders] Bulk status error', err);
      }
    } else {
      setRows(prev => prev.map(r =>
        selectedIds.has(r.id) ? { ...r, status, ...(status === 'Resolved' ? { resolvedAt: new Date().toISOString() } : {}) } : r
      ));
    }

    setSelectedIds(new Set());
  };

  const exportToCSV = () => {
    const headers = ['Request ID', 'Requester', 'Contact', 'Location', 'Discipline', 'Category', 'Description', 'Asset', 'Technician', 'Company', 'Status', 'Priority', 'Created At'];
    const csvRows = [
      headers.join(','),
      ...filteredAndSortedRows.map(r => [
        r.requestId || '',
        r.requester || '',
        r.contact || '',
        r.location || '',
        r.discipline || '',
        r.category || '',
        r.description || '',
        r.asset || '',
        r.responsibleTechnician || '',
        r.company || '',
        r.status,
        r.priority || '',
        r.createdAt || ''
      ].map(v => `"${v}"`).join(','))
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `work-orders-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filter and sort rows
  const filteredAndSortedRows = React.useMemo(() => {
    let filtered = rows.filter(r => {
      if (filters.status !== 'all' && r.status !== filters.status) return false;
      if (filters.discipline !== 'all' && r.discipline !== filters.discipline) return false;
      if (filters.technician !== 'all' && r.responsibleTechnician !== filters.technician) return false;
      if (filters.priority !== 'all' && r.priority !== filters.priority) return false;
      if (filters.search) {
        const search = filters.search.toLowerCase();
        return (
          r.requestId?.toLowerCase().includes(search) ||
          r.requester?.toLowerCase().includes(search) ||
          r.description?.toLowerCase().includes(search) ||
          r.asset?.toLowerCase().includes(search)
        );
      }
      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      let aVal: any, bVal: any;

      switch (sortBy) {
        case 'requestId':
          aVal = a.requestId || '';
          bVal = b.requestId || '';
          break;
        case 'status':
          aVal = a.status;
          bVal = b.status;
          break;
        case 'createdAt':
          aVal = new Date(a.createdAt || 0).getTime();
          bVal = new Date(b.createdAt || 0).getTime();
          break;
        case 'priority':
          const priorityOrder = { 'High': 3, 'Medium': 2, 'Low': 1 };
          aVal = priorityOrder[a.priority as keyof typeof priorityOrder] || 0;
          bVal = priorityOrder[b.priority as keyof typeof priorityOrder] || 0;
          break;
      }

      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    return filtered;
  }, [rows, filters, sortBy, sortOrder]);

  // Get unique values for filters
  const uniqueDisciplines = Array.from(new Set(rows.map(r => r.discipline).filter(Boolean)));
  const uniqueTechnicians = Array.from(new Set(rows.map(r => r.responsibleTechnician).filter(Boolean)));

  return (
    <div className="p-3 space-y-3 h-full flex flex-col">
      <div className="text-foreground font-semibold text-sm">Work Orders / Service Requests</div>
      <div className="text-xs text-muted-foreground">
        <span className="text-muted-foreground">Gray fields</span> are from tickets.
        <span className="text-blue-400 ml-2">Blue fields</span> are managed by Maintenance Team.
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          placeholder="Search..."
          value={filters.search}
          onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
          className="bg-card border border-border rounded px-3 py-1.5 text-foreground text-xs flex-1 min-w-[200px]"
        />
        <select
          value={filters.status}
          onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
          className="bg-card border border-border rounded px-3 py-1.5 text-foreground text-xs"
        >
          <option value="all">All Status</option>
          <option value="Open">Open</option>
          <option value="Planned">Planned</option>
          <option value="In Progress">In Progress</option>
          <option value="Resolved">Resolved</option>
        </select>
        <select
          value={filters.discipline}
          onChange={e => setFilters(f => ({ ...f, discipline: e.target.value }))}
          className="bg-card border border-border rounded px-3 py-1.5 text-foreground text-xs"
        >
          <option value="all">All Disciplines</option>
          {uniqueDisciplines.map(d => (
            <option key={String(d)} value={String(d)}>{String(d)}</option>
          ))}
        </select>
        <select
          value={filters.technician}
          onChange={e => setFilters(f => ({ ...f, technician: e.target.value }))}
          className="bg-card border border-border rounded px-3 py-1.5 text-foreground text-xs"
        >
          <option value="all">All Technicians</option>
          {uniqueTechnicians.map(t => (
            <option key={String(t)} value={String(t)}>{String(t)}</option>
          ))}
        </select>
        <select
          value={filters.priority}
          onChange={e => setFilters(f => ({ ...f, priority: e.target.value }))}
          className="bg-card border border-border rounded px-3 py-1.5 text-foreground text-xs"
        >
          <option value="all">All Priorities</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
        <button
          onClick={() => setFilters({ status: 'all', discipline: 'all', technician: 'all', priority: 'all', search: '' })}
          className="bg-muted hover:bg-muted text-foreground px-3 py-1.5 rounded text-xs"
        >
          Clear Filters
        </button>
      </div>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap gap-2 items-center p-2 bg-blue-900/20 border border-blue-500/50 rounded">
          <span className="text-blue-300 text-sm">{selectedIds.size} selected</span>
          <button onClick={exportToCSV} className="bg-muted hover:bg-muted text-foreground px-3 py-1 rounded text-xs">Export CSV</button>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-card/90 backdrop-blur border-b border-border text-muted-foreground">
            <tr>
              <th className="px-2 py-1.5 w-10">
                <input type="checkbox" checked={filteredAndSortedRows.length > 0 && selectedIds.size === filteredAndSortedRows.length} onChange={toggleSelectAll} />
              </th>
              <th className="text-left px-2 py-1.5 cursor-pointer hover:bg-muted/50" onClick={() => {
                if (sortBy === 'requestId') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); else { setSortBy('requestId'); setSortOrder('desc'); }
              }}>Request ID {sortBy === 'requestId' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}</th>
              <th className="text-left px-2 py-1.5">Requester</th>
              <th className="text-left px-2 py-1.5">Contact</th>
              <th className="text-left px-2 py-1.5">Location</th>
              <th className="text-left px-2 py-1.5">Discipline</th>
              <th className="text-left px-2 py-1.5">Category</th>
              <th className="text-left px-2 py-1.5">Description</th>
              <th className="text-left px-2 py-1.5">Intervention Details</th>
              <th className="text-left px-2 py-1.5">Attachments</th>
              <th className="text-left px-2 py-1.5">Asset</th>
              <th className="text-left px-2 py-1.5 cursor-pointer hover:bg-muted/50" onClick={() => {
                if (sortBy === 'priority') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); else { setSortBy('priority'); setSortOrder('desc'); }
              }}>Priority {sortBy === 'priority' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}</th>
              <th className="text-left px-2 py-1.5">Technician</th>
              <th className="text-left px-2 py-1.5">Company</th>
              <th className="text-left px-2 py-1.5 cursor-pointer hover:bg-muted/50" onClick={() => {
                if (sortBy === 'status') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); else { setSortBy('status'); setSortOrder('asc'); }
              }}>Status {sortBy === 'status' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}</th>
              <th className="text-left px-2 py-1.5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedRows.length === 0 ? (
              <tr><td colSpan={16} className="px-3 py-4 text-center text-muted-foreground">No work orders yet. Create tickets to generate work orders.</td></tr>
            ) : filteredAndSortedRows.map(r => {
              const isEditing = editingId === r.id;
              return (
                <>
                  <tr key={r.id} className="border-b border-border hover:bg-card/40" onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}>
                    <td className="px-2 py-1.5 w-10" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSelect(r.id)} />
                    </td>
                    {/* Gray-shaded: from ticket */}
                    <td className="px-2 py-1.5 text-muted-foreground">{r.requestId || '-'}</td>
                    <td className="px-2 py-1.5 text-muted-foreground">{r.requester || '-'}</td>
                    <td className="px-2 py-1.5 text-muted-foreground">{r.contact || '-'}</td>
                    <td className="px-2 py-1.5 text-muted-foreground">{r.location || '-'}</td>
                    <td className="px-2 py-1.5 text-muted-foreground">{r.discipline || '-'}</td>
                    <td className="px-2 py-1.5 text-muted-foreground">{stripRevitPrefix(r.category) || '-'}</td>
                    <td className="px-2 py-1.5 text-muted-foreground">{r.description || '-'}</td>
                    <td className="px-2 py-1.5 text-muted-foreground">
                      <div className="max-w-[220px] truncate" title={r.interventionDetails || ''}>{r.interventionDetails || '-'}</div>
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground" onClick={e => e.stopPropagation()}>
                      {r.attachments && r.attachments.length > 0 ? (
                        <button onClick={() => setShowAttachmentsModal(r)} className="text-blue-400 hover:text-blue-300">📎 {r.attachments.length}</button>
                      ) : '-'}
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground">{r.asset || '-'}</td>
                    <td className="px-2 py-1.5">
                      {isEditing ? (
                        <select
                          value={editForm.priority || r.priority || 'Medium'}
                          onChange={e => setEditForm(f => ({ ...f, priority: e.target.value as WorkOrderItem['priority'] }))}
                          className="w-full bg-card border border-blue-500 rounded px-1 py-0.5 text-blue-300 text-xs"
                        >
                          <option value="High">High</option>
                          <option value="Medium">Medium</option>
                          <option value="Low">Low</option>
                        </select>
                      ) : (
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${r.priority === 'High' ? 'bg-red-900/40 text-red-300' :
                          r.priority === 'Medium' ? 'bg-yellow-900/40 text-yellow-300' :
                            r.priority === 'Low' ? 'bg-green-900/40 text-green-300' :
                              'bg-card/40 text-muted-foreground'
                          }`}>
                          {r.priority || 'Not Set'}
                        </span>
                      )}
                    </td>

                    {/* Blue-shaded: managed by maintenance team */}
                    <td className="px-2 py-1.5">
                      {isEditing ? (
                        <input
                          value={editForm.responsibleTechnician || ''}
                          onChange={e => setEditForm(f => ({ ...f, responsibleTechnician: e.target.value }))}
                          className="w-full bg-card border border-blue-500 rounded px-1 py-0.5 text-blue-300 text-xs"
                        />
                      ) : (
                        <span className="text-blue-300">{r.responsibleTechnician || '-'}</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      {isEditing ? (
                        <input
                          value={editForm.company || ''}
                          onChange={e => setEditForm(f => ({ ...f, company: e.target.value }))}
                          className="w-full bg-card border border-blue-500 rounded px-1 py-0.5 text-blue-300 text-xs"
                        />
                      ) : (
                        <span className="text-blue-300">{r.company || '-'}</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      {isEditing ? (
                        <select
                          value={editForm.status || r.status}
                          onChange={e => setEditForm(f => ({ ...f, status: e.target.value as WorkOrderItem['status'] }))}
                          className="w-full bg-card border border-blue-500 rounded px-1 py-0.5 text-blue-300 text-xs"
                        >
                          <option value="Open">Open</option>
                          <option value="Planned">Planned</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Resolved">Resolved</option>
                        </select>
                      ) : (
                        <span className={`px-2 py-0.5 rounded text-xs ${r.status === 'Open' ? 'bg-yellow-900/40 text-yellow-300' :
                          r.status === 'Planned' ? 'bg-blue-900/40 text-blue-300' :
                            r.status === 'In Progress' ? 'bg-purple-900/40 text-purple-300' :
                              'bg-green-900/40 text-green-300'
                          }`}>{r.status}</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5" onClick={e => e.stopPropagation()}>
                      {isEditing ? (
                        <div className="flex gap-1">
                          <button onClick={saveEdit} className="bg-green-600 hover:bg-green-700 text-foreground px-2 py-0.5 rounded text-xs">Save</button>
                          <button onClick={() => { setEditingId(null); setEditForm({}) }} className="bg-muted hover:bg-muted text-foreground px-2 py-0.5 rounded text-xs">Cancel</button>
                        </div>
                      ) : (
                        <div className="flex gap-1">
                          <button onClick={() => startEdit(r)} className="bg-blue-600 hover:bg-blue-700 text-foreground px-2 py-0.5 rounded text-xs">Edit</button>
                          <button onClick={() => setShowCommentsModal(r)} className="bg-muted hover:bg-muted text-foreground px-2 py-0.5 rounded text-xs">Comments</button>
                          <button onClick={() => setExpandedId(expandedId === r.id ? null : r.id)} className="bg-muted hover:bg-muted text-foreground px-2 py-0.5 rounded text-xs">{expandedId === r.id ? 'Hide' : 'Details'}</button>
                        </div>
                      )}
                    </td>
                  </tr>
                  {expandedId === r.id && (
                    <tr className="border-b border-border bg-card/30">
                      <td colSpan={16} className="px-3 py-3">
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <div className="text-xs text-muted-foreground">Full Description</div>
                            <div className="text-foreground">{r.description || '-'}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Intervention Details</div>
                            <div className="text-foreground">{r.interventionDetails || '-'}</div>
                          </div>
                          <div className="col-span-2">
                            <div className="text-xs text-muted-foreground mb-1">Attachments</div>
                            <div className="flex flex-wrap gap-2">
                              {r.attachments && r.attachments.length > 0 ? (
                                r.attachments.map((a, idx) => (
                                  <span key={idx} className="bg-card px-2 py-1 rounded text-xs text-foreground">📄 {typeof a === 'string' ? a : a.name || a.url}</span>
                                ))
                              ) : (
                                <span className="text-muted-foreground text-xs">No attachments</span>
                              )}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Timestamps</div>
                            <div className="text-muted-foreground text-xs space-y-0.5">
                              <div>Created: {r.createdAt ? new Date(r.createdAt).toLocaleString() : '-'}</div>
                              <div>Updated: {r.updatedAt ? new Date(r.updatedAt).toLocaleString() : '-'}</div>
                              <div>Assigned: {r.assignedAt ? new Date(r.assignedAt).toLocaleString() : '-'}</div>
                              <div>Resolved: {r.resolvedAt ? new Date(r.resolvedAt).toLocaleString() : '-'}</div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Attachments Modal */}
      {showAttachmentsModal && (
        <div className="fixed inset-0 bg-background/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-lg p-6 w-full max-w-5xl resize overflow-auto" style={{ minWidth: '400px', minHeight: '300px', maxHeight: 'calc(100vh - 40px)', maxWidth: 'calc(100vw - 40px)' }}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-foreground font-semibold text-lg">Attachments</h3>
              <button onClick={() => setShowAttachmentsModal(null)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <div className="space-y-2">
              {showAttachmentsModal.attachments && showAttachmentsModal.attachments.length > 0 ? (
                showAttachmentsModal.attachments.map((a, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-card/60 rounded px-3 py-2">
                    <span className="text-foreground text-sm">📄 {typeof a === 'string' ? a : a.name || a.url}</span>
                    <a href={typeof a === 'string' ? a : a.url} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 text-xs">Open</a>
                  </div>
                ))
              ) : (
                <div className="text-muted-foreground text-sm">No attachments</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Comments Modal */}
      {showCommentsModal && (
        <div className="fixed inset-0 bg-background/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-lg p-6 w-full max-w-5xl resize overflow-auto" style={{ minWidth: '400px', minHeight: '400px', maxHeight: 'calc(100vh - 40px)', maxWidth: 'calc(100vw - 40px)' }}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-foreground font-semibold text-lg">Comments & Notes</h3>
              <button onClick={() => setShowCommentsModal(null)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <div className="space-y-3 mb-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
              {showCommentsModal.comments && showCommentsModal.comments.length > 0 ? (
                showCommentsModal.comments.map(c => (
                  <div key={c.id} className="bg-card/60 rounded p-3">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-blue-400 font-semibold text-sm">{c.author}</span>
                      <span className="text-muted-foreground text-xs">{new Date(c.timestamp).toLocaleString()}</span>
                    </div>
                    <div className="text-muted-foreground text-sm">{c.text}</div>
                  </div>
                ))
              ) : (
                <div className="text-muted-foreground text-sm">No comments yet.</div>
              )}
            </div>
            <div className="flex gap-2">
              <textarea
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 bg-card border border-border rounded px-3 py-2 text-foreground text-sm"
                rows={3}
              />
              <button
                onClick={() => showCommentsModal && addComment(showCommentsModal.id)}
                className="bg-blue-600 hover:bg-blue-700 text-foreground px-4 py-2 rounded text-sm self-start"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Service Requests (Work Orders - Service Requests)
// This section records all maintenance requests made over time
// Gray-shaded data derive from "Maintenance Ticket" form
// Blue-shaded data are managed by the Maintenance Team
const ServiceRequests: React.FC<{ projectId?: string; }> = ({ projectId }) => {
  const [rows, setRows] = useState<WorkOrderItem[]>(() => load(K.serviceRequests(projectId), [] as WorkOrderItem[]));
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
      default: return 'bg-card/60 text-muted-foreground';
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
        <h3 className="text-foreground font-semibold text-lg mb-1">Service Requests</h3>
        <p className="text-xs text-muted-foreground">
          <span className="inline-block bg-muted/40 px-1.5 py-0.5 rounded text-muted-foreground mr-2">Gray fields</span>
          are from tickets.
          <span className="inline-block bg-blue-900/40 px-1.5 py-0.5 rounded text-blue-300 ml-2">Blue fields</span>
          are managed by Maintenance Team.
        </p>
      </div>

      {/* Filters and Actions */}
      <div className="flex flex-wrap items-center gap-2 bg-card/40 p-3 rounded-lg">
        <input
          type="text"
          placeholder="Search..."
          value={filters.search}
          onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
          className="px-3 py-1.5 bg-muted border border-border rounded text-sm text-foreground flex-1 min-w-[200px]"
        />

        <select
          value={filters.status}
          onChange={e => setFilters(prev => ({ ...prev, status: e.target.value }))}
          className="px-3 py-1.5 bg-muted border border-border rounded text-sm text-foreground"
        >
          <option value="all">All Status</option>
          {uniqueStatuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <select
          value={filters.discipline}
          onChange={e => setFilters(prev => ({ ...prev, discipline: e.target.value }))}
          className="px-3 py-1.5 bg-muted border border-border rounded text-sm text-foreground"
        >
          <option value="all">All Disciplines</option>
          {uniqueDisciplines.map(d => <option key={d} value={d}>{d}</option>)}
        </select>

        <select
          value={filters.technician}
          onChange={e => setFilters(prev => ({ ...prev, technician: e.target.value }))}
          className="px-3 py-1.5 bg-muted border border-border rounded text-sm text-foreground"
        >
          <option value="all">All Technicians</option>
          {uniqueTechnicians.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <select
          value={filters.priority}
          onChange={e => setFilters(prev => ({ ...prev, priority: e.target.value }))}
          className="px-3 py-1.5 bg-muted border border-border rounded text-sm text-foreground"
        >
          <option value="all">All Priorities</option>
          {uniquePriorities.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        <button
          onClick={clearFilters}
          className="px-3 py-1.5 bg-muted hover:bg-muted text-foreground text-sm rounded transition-colors"
        >
          Clear Filters
        </button>

        <button
          onClick={exportToCSV}
          disabled={selectedIds.size === 0}
          className={`px-3 py-1.5 text-foreground text-sm rounded transition-colors ${selectedIds.size > 0
            ? 'bg-green-600 hover:bg-green-700'
            : 'bg-muted cursor-not-allowed'
            }`}
        >
          Export to CSV {selectedIds.size > 0 && `(${selectedIds.size})`}
        </button>
      </div>

      {/* Results count */}
      <div className="text-xs text-muted-foreground">
        Showing {filteredRows.length} of {rows.length} request{rows.length !== 1 ? 's' : ''}
        {selectedIds.size > 0 && ` • ${selectedIds.size} selected`}
      </div>

      {rows.length === 0 ? (
        <div className="text-muted-foreground text-sm bg-card/30 rounded-lg p-6 text-center">
          No service requests yet. Requests will appear here when submitted through the Maintenance Ticket form.
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="text-muted-foreground text-sm bg-card/30 rounded-lg p-6 text-center">
          No requests match the current filters.
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-card z-10">
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-left">
                  <input
                    type="checkbox"
                    className="rounded"
                    checked={selectedIds.size === filteredRows.length && filteredRows.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th
                  className="px-3 py-2 text-left text-muted-foreground cursor-pointer hover:text-foreground whitespace-nowrap"
                  onClick={() => toggleSort('requestId')}
                >
                  Request ID {sortBy === 'requestId' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className="px-3 py-2 text-left text-muted-foreground cursor-pointer hover:text-foreground whitespace-nowrap"
                  onClick={() => toggleSort('requester')}
                >
                  Requester {sortBy === 'requester' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-3 py-2 text-left text-muted-foreground whitespace-nowrap">Contact</th>
                <th className="px-3 py-2 text-left text-muted-foreground whitespace-nowrap">Location</th>
                <th className="px-3 py-2 text-left text-muted-foreground whitespace-nowrap">Discipline</th>
                <th className="px-3 py-2 text-left text-muted-foreground whitespace-nowrap">Category</th>
                <th className="px-3 py-2 text-left text-muted-foreground whitespace-nowrap">Description</th>
                <th className="px-3 py-2 text-left text-blue-300 whitespace-nowrap">Technician</th>
                <th className="px-3 py-2 text-left text-blue-300 whitespace-nowrap">Company</th>
                <th
                  className="px-3 py-2 text-left text-blue-300 cursor-pointer hover:text-foreground whitespace-nowrap"
                  onClick={() => toggleSort('status')}
                >
                  Status {sortBy === 'status' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-3 py-2 text-left text-muted-foreground whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map(row => {
                const isEditing = editingId === row.id;
                const isExpanded = expandedId === row.id;
                const isSelected = selectedIds.has(row.id);

                return (
                  <React.Fragment key={row.id}>
                    <tr className={`border-b border-border hover:bg-card/40 transition-colors ${isSelected ? 'bg-blue-900/20' : ''}`}>
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
                      <td className="px-3 py-2 text-muted-foreground">{row.requester || '-'}</td>
                      <td className="px-3 py-2 text-muted-foreground text-xs">{row.contact || '-'}</td>
                      <td className="px-3 py-2 text-muted-foreground text-xs max-w-[120px] truncate" title={row.location}>
                        {row.location || '-'}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{row.discipline || '-'}</td>
                      <td className="px-3 py-2 text-muted-foreground text-xs max-w-[120px] truncate" title={row.category}>
                        {row.category || '-'}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground text-xs max-w-[150px] truncate" title={row.description}>
                        {row.description || '-'}
                      </td>
                      <td className="px-3 py-2 text-blue-300 text-xs">
                        {row.responsibleTechnician || <span className="text-muted-foreground">Unassigned</span>}
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
                          className="px-2 py-1 bg-muted hover:bg-muted text-foreground rounded text-xs whitespace-nowrap"
                        >
                          {isExpanded ? 'Hide ▲' : 'Expand ▼'}
                        </button>
                      </td>
                    </tr>

                    {/* Expanded Row with Full Details */}
                    {isExpanded && (
                      <tr className="border-b border-border bg-card/60">
                        <td colSpan={12} className="p-0">
                          <div className="p-4 space-y-4">
                            {!isEditing ? (
                              <>
                                {/* Gray Fields - From Ticket */}
                                <div className="bg-card/40 rounded-lg p-4 border border-border">
                                  <div className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                                    <span className="bg-muted/60 px-2 py-1 rounded text-xs">From Ticket</span>
                                    Full Request Details
                                  </div>
                                  <div className="grid grid-cols-3 gap-4">
                                    <div>
                                      <div className="text-xs text-muted-foreground mb-1">Request ID</div>
                                      <div className="text-sm text-foreground font-mono">{row.requestId || 'N/A'}</div>
                                    </div>
                                    <div>
                                      <div className="text-xs text-muted-foreground mb-1">Requester</div>
                                      <div className="text-sm text-foreground">{row.requester || 'N/A'}</div>
                                    </div>
                                    <div>
                                      <div className="text-xs text-muted-foreground mb-1">Contact</div>
                                      <div className="text-sm text-foreground">{row.contact || 'N/A'}</div>
                                    </div>
                                    <div>
                                      <div className="text-xs text-muted-foreground mb-1">Location</div>
                                      <div className="text-sm text-foreground">{row.location || 'N/A'}</div>
                                    </div>
                                    <div>
                                      <div className="text-xs text-muted-foreground mb-1">Discipline</div>
                                      <div className="text-sm text-foreground">{row.discipline || 'N/A'}</div>
                                    </div>
                                    <div>
                                      <div className="text-xs text-muted-foreground mb-1">Category</div>
                                      <div className="text-sm text-foreground">{row.category || 'N/A'}</div>
                                    </div>
                                    <div className="col-span-3">
                                      <div className="text-xs text-muted-foreground mb-1">Short Description</div>
                                      <div className="text-sm text-foreground">{row.description || 'N/A'}</div>
                                    </div>
                                    <div className="col-span-3">
                                      <div className="text-xs text-muted-foreground mb-1">Detailed Intervention Description</div>
                                      <div className="text-sm text-foreground whitespace-pre-wrap">{row.interventionDetails || 'N/A'}</div>
                                    </div>
                                    <div>
                                      <div className="text-xs text-muted-foreground mb-1">Asset</div>
                                      <div className="text-sm text-foreground">{row.asset || 'N/A'}</div>
                                    </div>
                                    <div>
                                      <div className="text-xs text-muted-foreground mb-1">Attachments</div>
                                      <div className="text-sm text-foreground">
                                        {row.attachments && row.attachments.length > 0
                                          ? `${row.attachments.length} file(s)`
                                          : 'None'}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-xs text-muted-foreground mb-1">Created At</div>
                                      <div className="text-sm text-muted-foreground">
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
                                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-foreground rounded text-xs"
                                    >
                                      Edit Blue Fields
                                    </button>
                                  </div>
                                  <div className="grid grid-cols-3 gap-4">
                                    <div>
                                      <div className="text-xs text-blue-400 mb-1">Responsible Technician</div>
                                      <div className="text-sm text-blue-200 font-semibold">
                                        {row.responsibleTechnician || <span className="text-muted-foreground">Not Assigned</span>}
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
                                        className="w-full px-3 py-2 bg-muted border border-blue-600 rounded text-sm text-foreground focus:outline-none focus:border-blue-400"
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
                                        className="w-full px-3 py-2 bg-muted border border-blue-600 rounded text-sm text-foreground focus:outline-none focus:border-blue-400"
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
                                        className="w-full px-3 py-2 bg-muted border border-blue-600 rounded text-sm text-foreground focus:outline-none focus:border-blue-400"
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
                                        className="w-full px-3 py-2 bg-muted border border-blue-600 rounded text-sm text-foreground focus:outline-none focus:border-blue-400"
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
                                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-foreground rounded font-semibold transition-colors"
                                    >
                                      Save Changes
                                    </button>
                                    <button
                                      onClick={() => { setEditingId(null); setEditForm({}); }}
                                      className="px-4 py-2 bg-muted hover:bg-muted text-foreground rounded transition-colors"
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
const MaintenanceReports: React.FC<{ projectId?: string; }> = ({ projectId }) => {
  // Start with empty arrays so server and initial client render match.
  // Load any cached localStorage values after mount to avoid hydration mismatch.
  const [scheduled, setScheduled] = useState<ScheduledItem[]>([]);
  const [workOrders, setWorkOrders] = useState<WOType[]>([]);
  const [openWO, setOpenWO] = useState<WOType | null>(null);
  const [reportTime, setReportTime] = useState<string>('');

  // Load cached values from localStorage on client mount (won't run on server)
  useEffect(() => {
    const cachedScheduled = load(K.scheduled(projectId), [] as ScheduledItem[]);
    if (cachedScheduled && cachedScheduled.length) setScheduled(cachedScheduled);
    const cachedWO = load(K.workOrders(projectId), [] as WOType[]);
    if (cachedWO && cachedWO.length) setWorkOrders(cachedWO);
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
  const openOrders = workOrders.filter(w => w.status === 'Open').length;
  const inProgressOrders = workOrders.filter(w => w.status === 'In Progress').length;
  const resolvedOrders = workOrders.filter(w => w.status === 'Resolved').length;

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
        <div className="bg-yellow-200 dark:bg-yellow-900/30 rounded p-2">
          <div className="text-xs text-foreground/80 dark:text-yellow-400">Open Orders</div>
          <div className="text-lg text-foreground dark:text-yellow-300 font-bold">{openOrders}</div>
        </div>
        <div className="bg-purple-200 dark:bg-purple-900/30 rounded p-2">
          <div className="text-xs text-foreground/80 dark:text-purple-400">In Progress</div>
          <div className="text-lg text-foreground dark:text-purple-300 font-bold">{inProgressOrders}</div>
        </div>
        <div className="col-span-2 bg-green-200 dark:bg-green-900/30 rounded p-2">
          <div className="text-xs text-foreground/80 dark:text-green-400">Resolved Orders</div>
          <div className="text-lg text-foreground dark:text-green-300 font-bold">{resolvedOrders}</div>
        </div>
      </div>

      <div className="border-t border-border pt-3">
        <div className="text-xs text-muted-foreground">Reports generated at: {reportTime || '—'}</div>
      </div>

      <div className="mt-3">
        <div className="text-sm text-foreground mb-2">Work Orders</div>
        <div className="space-y-2">
          {workOrders.map(w => (
            <div key={w.id} className="bg-card/40 rounded">
              <div className="flex items-center justify-between p-2">
                <div>
                  <div className="text-sm font-medium">{w.requestId || w.id} • {w.asset || w.location || '—'}</div>
                  <div className="text-xs text-muted-foreground">{w.description?.slice(0, 80) || 'No description'}</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-xs text-muted-foreground">{w.status}</div>
                  <button onClick={() => setOpenWO(openWO && openWO.id === w.id ? null : w)} className="px-2 py-1 bg-blue-600 rounded text-sm">{openWO && openWO.id === w.id ? 'Close' : 'Open'}</button>
                </div>
              </div>

              {/* Inline expanded report */}
              {openWO && openWO.id === w.id && (
                <div className="p-2 border-t border-border">
                  <MaintenanceReport
                    projectId={projectId}
                    workOrder={openWO}
                    onSave={(updated) => {
                      // Update local state with the updated work order
                      setWorkOrders(prev => {
                        const found = prev.find(p => p.id === updated.id);
                        if (found) return prev.map(p => p.id === updated.id ? updated as WOType : p);
                        return [ ...prev, updated as WOType ];
                      });
                      save(K.workOrders(projectId), (load(K.workOrders(projectId), [] as WOType[]).map(p => p.id === updated.id ? updated : p)));
                      
                      // If marked as resolved, reload from backend to confirm
                      if (updated.status === 'Resolved') {
                        setTimeout(async () => {
                          try {
                            const res = await fetch(`/api/projects/${projectId}/work-orders`);
                            if (res.ok) {
                              const data = await res.json();
                              const list = Array.isArray(data) ? data : [];
                              setWorkOrders(list);
                              save(K.workOrders(projectId), list);
                            }
                          } catch (e) { console.error('Refresh failed', e); }
                        }, 1000);
                      }
                      setOpenWO(null);
                    }}
                    onClose={() => setOpenWO(null)}
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
  const plannedOrders = workOrders.filter(w => w.status === 'Planned');

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
