"use client";

import React, { useEffect, useState } from "react";
import { WorkOrderItem } from "./fm-panel-types";

interface MaintenanceReportProps {
  projectId?: string;
  workOrder?: WorkOrderItem | null;
  onSave?: (wo: WorkOrderItem) => void;
  onClose?: () => void;
}

const emptyAttachments: WorkOrderItem["attachments"] = [] as any;

function id() { return `wo-${Math.random().toString(36).slice(2,9)}`; }

export default function MaintenanceReport({ projectId, workOrder, onSave, onClose }: MaintenanceReportProps) {
  const initial = {
    id: workOrder?.id ?? id(),
    requestId: workOrder?.requestId ?? '',
    requester: workOrder?.requester ?? '',
    contact: workOrder?.contact ?? '',
    location: workOrder?.location ?? '',
    asset: workOrder?.asset ?? '',
    interventionDetails: workOrder?.interventionDetails ?? '',
    discipline: workOrder?.discipline ?? '',
    category: workOrder?.category ?? '',
    description: workOrder?.description ?? '',
    attachments: workOrder?.attachments ?? emptyAttachments,
    responsibleTechnician: workOrder?.responsibleTechnician ?? '',
    company: workOrder?.company ?? '',
    status: workOrder?.status ?? 'Open',
    priority: workOrder?.priority ?? 'Medium',
    diagnosis: workOrder?.diagnosis ?? '',
    workPerformed: workOrder?.workPerformed ?? '',
    technicalNotes: workOrder?.technicalNotes ?? '',
    comments: workOrder?.comments ?? [],
    createdAt: workOrder?.createdAt,
    updatedAt: workOrder?.updatedAt,
    interventionOutcome: workOrder?.interventionOutcome ?? '',
    assetCondition: workOrder?.assetCondition ?? '',
    nextPlannedActions: workOrder?.nextPlannedActions ?? '',
    materials: workOrder?.materials ?? '',
    timeSpent: workOrder?.timeSpent ?? '',
    additionalTechnicians: workOrder?.additionalTechnicians ?? '',
    complianceCompleted: workOrder?.complianceCompleted ?? false,
    ppe: workOrder?.ppe ?? '',
    techSignature: workOrder?.techSignature ?? '',
    clientSignature: workOrder?.clientSignature ?? '',
    closureDate: workOrder?.closureDate ?? '',
  } as Partial<WorkOrderItem> & Record<string, any>;

  const [form, setForm] = useState<Partial<WorkOrderItem>>(() => ({ ...initial }));
  const [original, setOriginal] = useState<Partial<WorkOrderItem>>(() => ({ ...initial }));
  const [editingSection, setEditingSection] = useState<string | null>(null);

  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [savingSection, setSavingSection] = useState<string | null>(null);

  useEffect(() => {
    if (workOrder) {
      const merged = { ...initial, ...workOrder } as Partial<WorkOrderItem>;
      setForm(merged);
      setOriginal({ ...merged });
    }
  }, [workOrder]);

  // Fetch project team to auto-populate Maintenance Team fields
  useEffect(() => {
    if (!projectId) return;
    
    const fetchTeam = async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/team`);
        if (res.ok) {
          const data = await res.json();
          const team = data.team || [];
          // Find the user with role 'TM' (Maintenance Team)
          const maintenanceTeamMember = team.find((m: any) => m.role === 'TM');
          
          if (maintenanceTeamMember) {
            setForm(prev => ({
              ...prev,
              maintenanceTeamName: maintenanceTeamMember.firstName || maintenanceTeamMember.name.split(' ')[0],
              maintenanceTeamSurname: maintenanceTeamMember.surname || maintenanceTeamMember.name.split(' ').slice(1).join(' ')
            } as any));
          }
        }
      } catch (e) {
        console.error('Failed to fetch team:', e);
      }
    };
    
    fetchTeam();
  }, [projectId]);

  const setField = (k: keyof WorkOrderItem, v: any) => setForm(f => ({ ...f, [k]: v }));

  const validate = () => {
    const err: string[] = [];
    if (!form.requestId || String(form.requestId).trim() === '') err.push('Request ID is required');
    if (!form.description || String(form.description).trim() === '') err.push('Description is required');
    // If marking resolved, require either an after-photo or technical notes
    if (String(form.status) === 'Resolved') {
      const hasAfter = (form.attachments || []).some(a => (a as any).type === 'after');
      if (!hasAfter && !(form.technicalNotes && form.technicalNotes.trim().length > 3)) err.push('To resolve, add an after-photo or technical notes');
    }
    setErrors(err);
    return err.length === 0;
  };

  const submit = async () => {
    if (!validate()) return false;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      // Build comprehensive work order object including all extra fields
      const out: any = {
        id: form.id as string,
        requestId: form.requestId,
        requester: form.requester as string,
        contact: form.contact as string,
        location: form.location as string,
        interventionDetails: form.interventionDetails as string,
        discipline: form.discipline as string,
        category: form.category as string,
        description: form.description as string,
        attachments: form.attachments || [],
        asset: form.asset as string | undefined,
        responsibleTechnician: form.responsibleTechnician as string | undefined,
        company: form.company as string | undefined,
        status: form.status as any || 'Open',
        priority: form.priority as any || 'Medium',
        comments: form.comments || [],
        createdAt: form.createdAt ?? now,
        updatedAt: now,
        assignedAt: form.assignedAt,
        resolvedAt: form.resolvedAt,
        diagnosis: form.diagnosis,
        workPerformed: form.workPerformed,
        technicalNotes: form.technicalNotes,
        interventionOutcome: (form as any).interventionOutcome,
        assetCondition: (form as any).assetCondition,
        materials: (form as any).materials,
        timeSpent: (form as any).timeSpent,
        complianceCompleted: (form as any).complianceCompleted,
        ppe: (form as any).ppe,
        techSignature: (form as any).techSignature,
        closureDate: (form as any).closureDate,
      };

      // If this is an existing work order (has id in DB), PATCH; otherwise POST
      try {
        if (workOrder && workOrder.id) {
          // PATCH expects payload: { id, ...updates }
          const { id: _, ...rest } = out;
          const payload = { id: out.id, ...rest };
          const resp = await fetch(`/api/projects/${projectId || 'global'}/work-orders`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          if (!resp.ok) console.error('PATCH failed:', resp.statusText);
        } else {
          const resp = await fetch(`/api/projects/${projectId || 'global'}/work-orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(out)
          });
          if (resp.ok) {
            const json = await resp.json();
            if (json?.workOrder?.id) out.id = json.workOrder.id;
          } else {
            console.error('POST failed:', resp.statusText);
          }
        }
      } catch (e) { console.error('Save error', e); }

      // Return the complete work order object with all fields
      return out as WorkOrderItem;
    } finally { setSaving(false); }
  };

  const cancelEdit = () => {
    // revert local changes
    setForm({ ...original });
    setEditingSection(null);
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>, tag: 'before'|'after'|'doc' = 'doc') => {
    const files = e.target.files; if (!files || files.length === 0) return;
    // For demo: store as data URL (small files only). Prefer server upload in production.
    const f = files[0];
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      const att = { url, type: tag, name: f.name, uploadedAt: new Date().toISOString(), uploadedBy: 'technician' } as any;
      setForm(fr => ({ ...fr, attachments: [ ...(fr.attachments || []), att ] }));
    };
    reader.readAsDataURL(f);
  };

  const hasAfterImage = () => {
    const a = (form.attachments || []).some((x: any) => x.type === 'after');
    return a;
  };

  const canMarkResolved = () => {
    // require description and workPerformed and (after image or technical notes)
    if (!form.description || !form.workPerformed) return false;
    if (!hasAfterImage() && !(form.technicalNotes && form.technicalNotes.trim().length > 3)) return false;
    return true;
  };

  const saveSection = async (sectionKey: string) => {
    // Save current section edits without closing the view
    // DO NOT call onSave here - that closes the expanded view
    setSavingSection(sectionKey);
    try {
      const now = new Date().toISOString();
      const updatedForm = { ...form, updatedAt: now } as any;

      // Prepare payload: send id plus updates at root so server $set will apply fields
      const payload = { id: updatedForm.id, ...updatedForm };
      try {
        await fetch(`/api/projects/${projectId || 'global'}/work-orders`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch (e) {
        console.log('Backend save failed, using local only', e);
      }

      // Update the form and original state locally
      setForm(updatedForm);
      setOriginal({ ...updatedForm });
      // Close edit mode for this section (remain expanded)
      setEditingSection(null);
    } finally {
      setSavingSection(null);
    }
  };

  const cancelSectionEdit = (sectionKey: string) => {
    // Revert to original values
    setForm({ ...original });
    setEditingSection(null);
  };

  return (
    <div className="p-3 bg-gray-900 text-gray-100 rounded max-h-[70vh] overflow-auto">
      <h3 className="text-lg font-semibold">Maintenance Report</h3>

      {/* 1. General Information */}
      <div className="mt-3 bg-gray-800/40 p-3 rounded">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">1. General Information</div>
          <div>
            {editingSection === 'general' ? (
                <>
                  <button disabled={savingSection === 'general'} onClick={() => saveSection('general')} className="text-sm bg-green-600 px-2 py-1 rounded mr-2">{savingSection === 'general' ? 'Saving...' : 'Save'}</button>
                  <button onClick={() => cancelSectionEdit('general')} className="text-sm bg-gray-700 px-2 py-1 rounded">Cancel</button>
                </>
              ) : (
                <button onClick={() => setEditingSection('general')} className="text-sm bg-blue-600 px-2 py-1 rounded">Edit</button>
              )}
          </div>
        </div>
        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-300">Work Order ID</label>
            <input value={form.id} readOnly className="mt-1 w-full bg-gray-800 p-2 rounded text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-300">Date & Time of Service</label>
            <input value={form.updatedAt ? new Date(form.updatedAt).toLocaleString() : new Date().toLocaleString()} readOnly className="mt-1 w-full bg-gray-800 p-2 rounded text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-300">Related Request / Ticket</label>
            <input disabled={editingSection !== 'general'} value={form.requestId || ''} onChange={e => setField('requestId', e.target.value)} className="mt-1 w-full bg-gray-800 p-2 rounded text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-300">Type of Maintenance</label>
            <select disabled={editingSection !== 'general'} value={form.category || ''} onChange={e => setField('category', e.target.value)} className="mt-1 w-full bg-gray-800 p-2 rounded text-sm">
              <option value="Corrective">Corrective</option>
              <option value="Preventive">Preventive</option>
              <option value="Improvement">Improvement</option>
              <option value="Inspection">Inspection</option>
              <option value="Emergency">Emergency</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-300">Priority Level</label>
            <select disabled={editingSection !== 'general'} value={form.priority || 'Medium'} onChange={e => setField('priority', e.target.value as any)} className="mt-1 w-full bg-gray-800 p-2 rounded text-sm">
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Critical">Critical</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-300">Site / Building</label>
            <input disabled={editingSection !== 'general'} value={form.location || ''} onChange={e => setField('location', e.target.value)} className="mt-1 w-full bg-gray-800 p-2 rounded text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-300">Asset / Equipment / Area</label>
            <input disabled={editingSection !== 'general'} value={form.asset || ''} onChange={e => setField('asset', e.target.value)} className="mt-1 w-full bg-gray-800 p-2 rounded text-sm" />
          </div>
        </div>
      </div>

      {/* 2. Maintenance Team Assignment */}
      <div className="mt-3 bg-gray-800/40 p-3 rounded">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">2. Maintenance Team Assignment</div>
          <div>
            {editingSection === 'requester' ? (
              <>
                <button disabled={savingSection === 'requester'} onClick={() => saveSection('requester')} className="text-sm bg-green-600 px-2 py-1 rounded mr-2">{savingSection === 'requester' ? 'Saving...' : 'Save'}</button>
                <button onClick={() => cancelSectionEdit('requester')} className="text-sm bg-gray-700 px-2 py-1 rounded">Cancel</button>
              </>
            ) : (
              <button onClick={() => setEditingSection('requester')} className="text-sm bg-blue-600 px-2 py-1 rounded">Edit</button>
            )}
          </div>
        </div>
        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-300">Contractor / Company</label>
            <input disabled={editingSection !== 'requester'} value={form.company || ''} onChange={e => setField('company', e.target.value)} className="mt-1 w-full bg-gray-800 p-2 rounded text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-300">Name of Maintenance Team</label>
            <input disabled={true} value={(form as any).maintenanceTeamName || ''} className="mt-1 w-full bg-gray-800/50 p-2 rounded text-sm text-gray-400 cursor-not-allowed" placeholder="Auto-filled from Role" />
          </div>
          <div>
            <label className="text-xs text-gray-300">Surname of Maintenance Team</label>
            <input disabled={true} value={(form as any).maintenanceTeamSurname || ''} className="mt-1 w-full bg-gray-800/50 p-2 rounded text-sm text-gray-400 cursor-not-allowed" placeholder="Auto-filled from Role" />
          </div>
          <div>
            <label className="text-xs text-gray-300">Name of Manutentor (1)</label>
            <input disabled={editingSection !== 'requester'} value={form.responsibleTechnician || ''} onChange={e => setField('responsibleTechnician', e.target.value)} className="mt-1 w-full bg-gray-800 p-2 rounded text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-300">Surname of Manutentor (1)</label>
            <input disabled={editingSection !== 'requester'} value={(form as any).responsibleTechnicianSurname || ''} onChange={e => setField('responsibleTechnicianSurname' as any, e.target.value)} className="mt-1 w-full bg-gray-800 p-2 rounded text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-300">Name of Manutentor (2)</label>
            <input disabled={editingSection !== 'requester'} value={(form as any).manutentor2Name || (Array.isArray(form.assignedTechnicians) && form.assignedTechnicians[0]?.name) || ''} onChange={e => setField('manutentor2Name' as any, e.target.value)} className="mt-1 w-full bg-gray-800 p-2 rounded text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-300">Surname of Manutentor (2)</label>
            <input disabled={editingSection !== 'requester'} value={(form as any).manutentor2Surname || (Array.isArray(form.assignedTechnicians) && form.assignedTechnicians[0]?.surname) || ''} onChange={e => setField('manutentor2Surname' as any, e.target.value)} className="mt-1 w-full bg-gray-800 p-2 rounded text-sm" />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-gray-300">Assigned Technicians</label>
            <div className="mt-1 text-xs text-gray-300">
              {(form.assignedTechnicians || []).length === 0 ? '—' : (form.assignedTechnicians || []).map((t, i) => (<div key={i}>{t.name} {t.email ? `(${t.email})` : ''} {t.company ? `— ${t.company}` : ''}</div>))}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Work Description */}
      <div className="mt-3 bg-gray-800/40 p-3 rounded">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">3. Work Description</div>
          <div>
            {editingSection === 'work' ? (
              <>
                <button disabled={savingSection === 'work'} onClick={() => saveSection('work')} className="text-sm bg-green-600 px-2 py-1 rounded mr-2">{savingSection === 'work' ? 'Saving...' : 'Save'}</button>
                <button onClick={() => cancelSectionEdit('work')} className="text-sm bg-gray-700 px-2 py-1 rounded">Cancel</button>
              </>
            ) : (
              <button onClick={() => setEditingSection('work')} className="text-sm bg-blue-600 px-2 py-1 rounded">Edit</button>
            )}
          </div>
        </div>
        <div className="mt-2 space-y-2">
          <div>
            <label className="text-xs text-gray-300">Reported Issue / Request</label>
            <input disabled={editingSection !== 'work'} value={form.description || ''} onChange={e => setField('description', e.target.value)} className="mt-1 w-full bg-gray-800 p-2 rounded text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-300">Diagnosis / Root Cause</label>
            <textarea disabled={editingSection !== 'work'} value={form.diagnosis || ''} onChange={e => setField('diagnosis' as any, e.target.value)} className="mt-1 w-full bg-gray-800 p-2 rounded text-sm" rows={2} />
          </div>
          <div>
            <label className="text-xs text-gray-300">Work Performed</label>
            <textarea disabled={editingSection !== 'work'} value={form.workPerformed || ''} onChange={e => setField('workPerformed' as any, e.target.value)} className="mt-1 w-full bg-gray-800 p-2 rounded text-sm" rows={2} />
          </div>
          <div>
            <label className="text-xs text-gray-300">Materials / Spare Parts Used</label>
            <input disabled={editingSection !== 'work'} value={(form as any).materials || ''} onChange={e => setField('materials' as any, e.target.value)} className="mt-1 w-full bg-gray-800 p-2 rounded text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-300">Total Time Spent</label>
            <input disabled={editingSection !== 'work'} value={(form as any).timeSpent || ''} onChange={e => setField('timeSpent' as any, e.target.value)} className="mt-1 w-full bg-gray-800 p-2 rounded text-sm" placeholder="e.g. 1h 30m" />
          </div>
        </div>
      </div>

      {/* 4. Result & Closure */}
      <div className="mt-3 bg-gray-800/40 p-3 rounded">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">4. Result & Closure</div>
          <div>
            {editingSection === 'result' ? (
              <>
                <button disabled={savingSection === 'result'} onClick={() => saveSection('result')} className="text-sm bg-green-600 px-2 py-1 rounded mr-2">{savingSection === 'result' ? 'Saving...' : 'Save'}</button>
                <button onClick={() => cancelSectionEdit('result')} className="text-sm bg-gray-700 px-2 py-1 rounded">Cancel</button>
              </>
            ) : (
              <button onClick={() => setEditingSection('result')} className="text-sm bg-blue-600 px-2 py-1 rounded">Edit</button>
            )}
          </div>
        </div>
        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-300">Intervention Outcome</label>
            <select disabled={editingSection !== 'result'} value={(form as any).interventionOutcome || ''} onChange={e => setField('interventionOutcome' as any, e.target.value)} className="mt-1 w-full bg-gray-800 p-2 rounded text-sm">
              <option value="Resolved">Resolved</option>
              <option value="Partially resolved">Partially resolved</option>
              <option value="Not resolved">Not resolved</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-300">Asset Condition After Work</label>
            <input disabled={editingSection !== 'result'} value={(form as any).assetCondition || ''} onChange={e => setField('assetCondition' as any, e.target.value)} className="mt-1 w-full bg-gray-800 p-2 rounded text-sm" />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-gray-300">Technical Notes / Recommendations</label>
            <textarea disabled={editingSection !== 'result'} value={form.technicalNotes || ''} onChange={e => setField('technicalNotes' as any, e.target.value)} className="mt-1 w-full bg-gray-800 p-2 rounded text-sm" rows={2} />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-gray-300">Next Planned Actions</label>
            <textarea disabled={editingSection !== 'result'} value={(form as any).nextPlannedActions || ''} onChange={e => setField('nextPlannedActions' as any, e.target.value)} className="mt-1 w-full bg-gray-800 p-2 rounded text-sm" rows={2} placeholder="Planned follow-up or scheduled maintenance" />
          </div>
        </div>
      </div>

      {/* 5. Safety & Compliance */}
      <div className="mt-3 bg-gray-800/40 p-3 rounded">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">5. Safety & Compliance</div>
          <div>
            {editingSection === 'safety' ? (
              <>
                <button disabled={savingSection === 'safety'} onClick={() => saveSection('safety')} className="text-sm bg-green-600 px-2 py-1 rounded mr-2">{savingSection === 'safety' ? 'Saving...' : 'Save'}</button>
                <button onClick={() => cancelSectionEdit('safety')} className="text-sm bg-gray-700 px-2 py-1 rounded">Cancel</button>
              </>
            ) : (
              <button onClick={() => setEditingSection('safety')} className="text-sm bg-blue-600 px-2 py-1 rounded">Edit</button>
            )}
          </div>
        </div>
        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-300">Compliance Check Completed</label>
            <select disabled={editingSection !== 'safety'} value={(form as any).complianceCompleted ? 'Yes' : 'No'} onChange={e => setField('complianceCompleted' as any, e.target.value === 'Yes')} className="mt-1 w-full bg-gray-800 p-2 rounded text-sm">
              <option>Yes</option>
              <option>No</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-300">PPE Used</label>
            <input disabled={editingSection !== 'safety'} value={(form as any).ppe || ''} onChange={e => setField('ppe' as any, e.target.value)} className="mt-1 w-full bg-gray-800 p-2 rounded text-sm" />
          </div>
        </div>
      </div>

      {/* 6. Signatures & Validation */}
      <div className="mt-3 bg-gray-800/40 p-3 rounded">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">6. Signatures & Validation</div>
          <div>
            {editingSection === 'signatures' ? (
              <>
                <button disabled={savingSection === 'signatures'} onClick={() => saveSection('signatures')} className="text-sm bg-green-600 px-2 py-1 rounded mr-2">{savingSection === 'signatures' ? 'Saving...' : 'Save'}</button>
                <button onClick={() => cancelSectionEdit('signatures')} className="text-sm bg-gray-700 px-2 py-1 rounded">Cancel</button>
              </>
            ) : (
              <button onClick={() => setEditingSection('signatures')} className="text-sm bg-blue-600 px-2 py-1 rounded">Edit</button>
            )}
          </div>
        </div>
        <div className="mt-2 space-y-3">
          <div>
            <label className="text-xs text-gray-300">Technician Signature (Digital or Handwritten)</label>
            <input disabled={editingSection !== 'signatures'} value={(form as any).techSignature || ''} onChange={e => setField('techSignature' as any, e.target.value)} className="mt-1 w-full bg-gray-800 p-2 rounded text-sm" placeholder="Type name to sign" />
          </div>
          <div>
            <label className="text-xs text-gray-300">Client / Site Representative Signature (Digital or Handwritten)</label>
            <input disabled={editingSection !== 'signatures'} value={(form as any).clientSignature || ''} onChange={e => setField('clientSignature' as any, e.target.value)} className="mt-1 w-full bg-gray-800 p-2 rounded text-sm" placeholder="Type name" />
          </div>
          <div>
            <label className="text-xs text-gray-300">Closure Date (Today or Past)</label>
            <input disabled={editingSection !== 'signatures'} type="date" value={(form as any).closureDate || ''} onChange={e => setField('closureDate' as any, e.target.value)} max={new Date().toISOString().split('T')[0]} className="mt-1 w-full bg-gray-800 p-2 rounded text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-300">Work Status</label>
            <select disabled={editingSection !== 'signatures'} value={form.status || 'In Progress'} onChange={e => setField('status', e.target.value as any)} className="mt-1 w-full bg-gray-800 p-2 rounded text-sm">
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="Verified">Verified</option>
              <option value="Closed">Closed</option>
            </select>
          </div>
        </div>
      </div>

      {/* 7. Attachments */}
      <div className="mt-3 bg-gray-800/40 p-3 rounded">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">7. Attachments</div>
          <div>
            {editingSection === 'attachments' ? (
              <>
                <button disabled={savingSection === 'attachments'} onClick={() => saveSection('attachments')} className="text-sm bg-green-600 px-2 py-1 rounded mr-2">{savingSection === 'attachments' ? 'Saving...' : 'Save'}</button>
                <button onClick={() => cancelSectionEdit('attachments')} className="text-sm bg-gray-700 px-2 py-1 rounded">Cancel</button>
              </>
            ) : (
              <button onClick={() => setEditingSection('attachments')} className="text-sm bg-blue-600 px-2 py-1 rounded">Edit</button>
            )}
          </div>
        </div>

        <div className="mt-3">
          <label className="block text-xs text-gray-300">Attachments</label>
          <div className="mt-2 text-xs text-gray-400">Before images (read-only):</div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {((form.attachments || []) as any[]).filter(a => a.type === 'before').map((a, idx) => (
              <div key={idx} className="bg-gray-800 p-1 rounded">
                <img src={a.url} alt={a.name} className="h-20 w-full object-cover rounded" />
                <div className="text-xs text-gray-400">{a.name || ''} • {a.uploadedAt ? new Date(a.uploadedAt).toLocaleString() : ''}</div>
              </div>
            ))}
          </div>

          <div className="mt-3 text-xs text-gray-400">Add After images / Docs:</div>
          <div className="flex gap-2 mt-2">
            <label className={`bg-gray-700 px-3 py-2 rounded text-sm cursor-pointer ${editingSection === 'attachments' ? '' : 'opacity-60 pointer-events-none'}`}>
              Upload After
              <input disabled={editingSection !== 'attachments'} type="file" accept="image/*" onChange={e => onFile(e, 'after')} className="hidden" />
            </label>
            <label className={`bg-gray-700 px-3 py-2 rounded text-sm cursor-pointer ${editingSection === 'attachments' ? '' : 'opacity-60 pointer-events-none'}`}>
              Upload Doc
              <input disabled={editingSection !== 'attachments'} type="file" onChange={e => onFile(e, 'doc')} className="hidden" />
            </label>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            {(form.attachments || []).map((a: any, idx) => (
              <div key={idx} className="bg-gray-800 p-1 rounded">
                {a.type === 'doc' ? (
                  <div className="text-xs">{a.name || 'doc'}</div>
                ) : (
                  <img src={a.url} alt={a.name} className="h-20 w-full object-cover rounded" />
                )}
                <div className="text-xs text-gray-400">{a.type} • {a.uploadedAt ? new Date(a.uploadedAt).toLocaleString() : ''}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={async () => {
                // Mark resolved flow: update form state with Resolved status, then persist
                setSaving(true);
                try {
                  // Update form to Resolved status
                  const resolvedForm = { ...form, status: 'Resolved' as any };
                  setForm(resolvedForm);
                  
                  // Now submit the resolved form
                  const now = new Date().toISOString();
                  const out: any = {
                    id: resolvedForm.id as string,
                    requestId: resolvedForm.requestId,
                    requester: resolvedForm.requester as string,
                    contact: resolvedForm.contact as string,
                    location: resolvedForm.location as string,
                    interventionDetails: resolvedForm.interventionDetails as string,
                    discipline: resolvedForm.discipline as string,
                    category: resolvedForm.category as string,
                    description: resolvedForm.description as string,
                    attachments: resolvedForm.attachments || [],
                    asset: resolvedForm.asset as string | undefined,
                    responsibleTechnician: resolvedForm.responsibleTechnician as string | undefined,
                    company: resolvedForm.company as string | undefined,
                    status: 'Resolved',
                    priority: resolvedForm.priority as any || 'Medium',
                    comments: resolvedForm.comments || [],
                    createdAt: resolvedForm.createdAt ?? now,
                    updatedAt: now,
                    assignedAt: resolvedForm.assignedAt,
                    resolvedAt: now,
                    diagnosis: resolvedForm.diagnosis,
                    workPerformed: resolvedForm.workPerformed,
                    technicalNotes: resolvedForm.technicalNotes,
                    interventionOutcome: (resolvedForm as any).interventionOutcome,
                    assetCondition: (resolvedForm as any).assetCondition,
                    materials: (resolvedForm as any).materials,
                    timeSpent: (resolvedForm as any).timeSpent,
                    complianceCompleted: (resolvedForm as any).complianceCompleted,
                    ppe: (resolvedForm as any).ppe,
                    techSignature: (resolvedForm as any).techSignature,
                    closureDate: (resolvedForm as any).closureDate,
                  };

                  // PATCH to backend
                  try {
                    const { id: _, ...rest } = out;
                    const payload = { id: out.id, ...rest };
                    const resp = await fetch(`/api/projects/${projectId || 'global'}/work-orders`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(payload)
                    });
                    if (!resp.ok) {
                      console.error('PATCH failed:', resp.statusText);
                      return;
                    }
                  } catch (e) {
                    console.error('Save error', e);
                    return;
                  }

                  // Notify parent with updated work order
                  onSave?.(out as WorkOrderItem);
                  onClose?.();
                } finally { setSaving(false); }
              }}
              disabled={!canMarkResolved() || saving}
              className={`${canMarkResolved() ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 cursor-not-allowed'} px-4 py-2 rounded text-sm font-semibold transition-colors ${saving ? 'opacity-50' : ''}`}
            >
              {saving ? 'Saving...' : 'Mark as Resolved'}
            </button>
          </div>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="mt-3 bg-red-900 text-red-100 p-2 rounded">
          <ul className="text-sm">
            {errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      {/* Mark resolved control moved into attachments/signatures section */}
    </div>
  );
}
