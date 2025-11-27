"use client";

import React, { useState, useEffect } from "react";
import { useUserRole } from "@/app/hooks/useUserRole";
import type { WorkOrderItem } from "../fm-panel-types";

interface EnhancedMaintenanceReportProps {
  projectId?: string;
  workOrder: WorkOrderItem | null;
  onClose: () => void;
}

export const EnhancedMaintenanceReport: React.FC<EnhancedMaintenanceReportProps> = ({ 
  projectId, 
  workOrder, 
  onClose 
}) => {
  const { role, isTM, isFM } = useUserRole(projectId || '');
  const [editableData, setEditableData] = useState<any>({
    // Section 3: Work Description (Maintainer/TM editable)
    diagnosis: '',
    workPerformed: '',
    materialsUsed: '',
    
    // Section 4: Safety & Compliance (Maintainer/TM editable)
    complianceCompleted: false,
    ppeUsed: '',
    
    // Section 6: Result & Closure (TM editable)
    assetCondition: '',
    technicalNotes: '',
    
    // Section 7: Signatures
    tmSignature: '',
    fmSignature: '',
    signatureDate: '',
    
    // Section 8: Additional Comments (TM/FM editable)
    additionalComments: ''
  });

  const [sectionVisibility, setSectionVisibility] = useState({
    general: true,
    assignment: true,
    workDescription: true,
    safety: true,
    approval: true,
    result: true,
    signatures: true,
    comments: true
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (workOrder) {
      setEditableData({
        diagnosis: (workOrder as any).diagnosis || '',
        workPerformed: (workOrder as any).workPerformed || '',
        materialsUsed: (workOrder as any).materialsUsed || '',
        complianceCompleted: (workOrder as any).complianceCompleted || false,
        ppeUsed: (workOrder as any).ppeUsed || '',
        assetCondition: (workOrder as any).assetCondition || '',
        technicalNotes: (workOrder as any).technicalNotes || workOrder.tmClosingNotes || '',
        tmSignature: (workOrder as any).tmSignature || '',
        fmSignature: (workOrder as any).fmSignature || '',
        signatureDate: (workOrder as any).signatureDate || '',
        additionalComments: (workOrder as any).additionalComments || ''
      });
    }
  }, [workOrder]);

  const toggleSection = (section: keyof typeof sectionVisibility) => {
    setSectionVisibility(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const saveReport = async () => {
    if (!workOrder || !projectId) return;
    
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/work-orders/${workOrder._id}/report`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editableData)
      });
      
      if (!res.ok) throw new Error('Failed to save report');
      
      alert('Report saved successfully!');
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const generatePDF = () => {
    // Filter sections based on visibility
    const visibleSections = Object.entries(sectionVisibility)
      .filter(([_, visible]) => visible)
      .map(([section]) => section);
    
    alert(`Generating PDF with sections: ${visibleSections.join(', ')}`);
    // TODO: Implement PDF generation
  };

  if (!workOrder) {
    return (
      <div className="p-4 text-gray-400">
        No work order selected
      </div>
    );
  }

  const totalTime = workOrder.totalTimeSpent || 0;
  const totalTimeToResolve = workOrder.totalTimeToResolve || 0;

  return (
    <div className="bg-gray-900 text-white min-h-screen p-6 overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-white">Maintenance Report</h1>
              <p className="text-sm text-gray-400 mt-1">Work Order: {workOrder.requestId || workOrder.ticketId || 'N/A'}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={generatePDF}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition-colors"
              >
                Generate PDF
              </button>
              <button
                onClick={saveReport}
                disabled={saving}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded text-sm font-medium transition-colors"
              >
                {saving ? 'Saving...' : 'Save Report'}
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>

        {/* Section Visibility Toggles */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Section Visibility (for PDF)</h3>
          <div className="grid grid-cols-4 gap-3">
            {Object.entries(sectionVisibility).map(([key, visible]) => (
              <label key={key} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={visible}
                  onChange={() => toggleSection(key as any)}
                  className="rounded"
                />
                <span className="capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Section 1: General Information (READ-ONLY) */}
        {sectionVisibility.general && (
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-5 mb-4">
            <h2 className="text-lg font-semibold mb-4 text-gray-200 border-b border-gray-700 pb-2">1. General Information</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-400">Work Order ID:</span>
                <span className="ml-2 font-medium text-white">{workOrder.requestId || workOrder.id}</span>
              </div>
              <div>
                <span className="text-gray-400">Date & Time:</span>
                <span className="ml-2 text-white">{workOrder.createdAt ? new Date(workOrder.createdAt).toLocaleString() : 'N/A'}</span>
              </div>
              <div>
                <span className="text-gray-400">Related Ticket:</span>
                <span className="ml-2 text-white">{workOrder.ticketId || 'N/A'}</span>
              </div>
              <div>
                <span className="text-gray-400">Requester:</span>
                <span className="ml-2 text-white">{workOrder.requester || 'N/A'}</span>
              </div>
              <div>
                <span className="text-gray-400">Contact:</span>
                <span className="ml-2 text-white">{workOrder.contact || 'N/A'}</span>
              </div>
              <div>
                <span className="text-gray-400">Location:</span>
                <span className="ml-2 text-white">{workOrder.location || 'N/A'}</span>
              </div>
              <div>
                <span className="text-gray-400">Asset:</span>
                <span className="ml-2 text-white">{workOrder.asset || 'N/A'}</span>
              </div>
              <div>
                <span className="text-gray-400">Category:</span>
                <span className="ml-2 text-white">{workOrder.category || 'N/A'}</span>
              </div>
              <div className="col-span-2">
                <span className="text-gray-400">Description:</span>
                <p className="mt-1 text-white">{workOrder.description || 'N/A'}</p>
              </div>
            </div>
          </div>
        )}

        {/* Section 2: Maintenance Team Assignment (READ-ONLY) */}
        {sectionVisibility.assignment && (
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-5 mb-4">
            <h2 className="text-lg font-semibold mb-4 text-gray-200 border-b border-gray-700 pb-2">2. Maintenance Team Assignment</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-400">Company:</span>
                <span className="ml-2 text-white">{workOrder.company || 'N/A'}</span>
              </div>
              <div>
                <span className="text-gray-400">Primary Technician:</span>
                <span className="ml-2 text-white">{workOrder.responsibleTechnician || 'N/A'}</span>
              </div>
              {workOrder.assignedTechnicians && workOrder.assignedTechnicians.length > 0 && (
                <div className="col-span-2">
                  <span className="text-gray-400">Assigned Technicians:</span>
                  <div className="mt-2 space-y-1">
                    {workOrder.assignedTechnicians.map((tech: any, idx: number) => (
                      <div key={idx} className="text-sm text-white bg-gray-900/30 rounded px-3 py-1.5">
                        {tech.name} ({tech.email}) - Assigned {new Date(tech.assignedAt).toLocaleDateString()}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Section 3: Work Description (TM Editable) */}
        {sectionVisibility.workDescription && (
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-5 mb-4">
            <h2 className="text-lg font-semibold mb-4 text-gray-200 border-b border-gray-700 pb-2">3. Work Description {isTM && <span className="text-xs text-blue-400 ml-2">(Editable)</span>}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Diagnosis / Root Cause</label>
                <textarea
                  value={editableData.diagnosis}
                  onChange={(e) => setEditableData({...editableData, diagnosis: e.target.value})}
                  disabled={!isTM}
                  className="w-full bg-gray-900/50 border border-gray-700 rounded px-3 py-2 text-white disabled:opacity-50 disabled:cursor-not-allowed text-sm focus:outline-none focus:border-blue-500"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Work Performed</label>
                <textarea
                  value={editableData.workPerformed}
                  onChange={(e) => setEditableData({...editableData, workPerformed: e.target.value})}
                  disabled={!isTM}
                  className="w-full bg-gray-900/50 border border-gray-700 rounded px-3 py-2 text-white disabled:opacity-50 disabled:cursor-not-allowed text-sm focus:outline-none focus:border-blue-500"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Materials / Spare Parts Used</label>
                <textarea
                  value={editableData.materialsUsed}
                  onChange={(e) => setEditableData({...editableData, materialsUsed: e.target.value})}
                  disabled={!isTM}
                  className="w-full bg-gray-900/50 border border-gray-700 rounded px-3 py-2 text-white disabled:opacity-50 disabled:cursor-not-allowed text-sm focus:outline-none focus:border-blue-500"
                  rows={2}
                />
              </div>
              <div>
                <span className="text-sm text-gray-400">Total Time Spent:</span>
                <span className="ml-2 text-white font-medium">{totalTime} minutes ({(totalTime / 60).toFixed(1)} hours)</span>
              </div>
            </div>
          </div>
        )}

        {/* Section 4: Safety & Compliance (TM Editable) */}
        {sectionVisibility.safety && (
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-5 mb-4">
            <h2 className="text-lg font-semibold mb-4 text-gray-200 border-b border-gray-700 pb-2">4. Safety & Compliance {isTM && <span className="text-xs text-blue-400 ml-2">(Editable)</span>}</h2>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={editableData.complianceCompleted}
                  onChange={(e) => setEditableData({...editableData, complianceCompleted: e.target.checked})}
                  disabled={!isTM}
                  className="rounded"
                />
                <label className="text-sm font-medium text-gray-300">Compliance Check Completed</label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">PPE Used</label>
                <input
                  type="text"
                  value={editableData.ppeUsed}
                  onChange={(e) => setEditableData({...editableData, ppeUsed: e.target.value})}
                  disabled={!isTM}
                  placeholder="e.g., Hard hat, Safety goggles, Gloves"
                  className="w-full bg-gray-900/50 border border-gray-700 rounded px-3 py-2 text-white disabled:opacity-50 disabled:cursor-not-allowed text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Section 5: Approval Workflow (READ-ONLY) */}
        {sectionVisibility.approval && (
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-5 mb-4">
            <h2 className="text-lg font-semibold mb-4 text-gray-200 border-b border-gray-700 pb-2">5. Approval Workflow</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-400">TM Approval Date:</span>
                <span className="ml-2 text-white">{workOrder.createdAt ? new Date(workOrder.createdAt).toLocaleDateString() : 'N/A'}</span>
              </div>
              <div>
                <span className="text-gray-400">Priority:</span>
                <span className="ml-2 text-white font-medium">{workOrder.priority || 'N/A'}</span>
              </div>
              <div>
                <span className="text-gray-400">Type:</span>
                <span className="ml-2 text-white font-medium">{workOrder.maintenanceType || workOrder.type || 'N/A'}</span>
              </div>
              <div>
                <span className="text-gray-400">Last FM Modification:</span>
                <span className="ml-2 text-white">N/A</span>
              </div>
            </div>
          </div>
        )}

        {/* Section 6: Result & Closure (TM Editable) */}
        {sectionVisibility.result && (
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-5 mb-4">
            <h2 className="text-lg font-semibold mb-4 text-gray-200 border-b border-gray-700 pb-2">6. Result & Closure {isTM && <span className="text-xs text-blue-400 ml-2">(Editable)</span>}</h2>
            <div className="space-y-4">
              <div>
                <span className="text-sm text-gray-400">Status:</span>
                <span className="ml-2 text-white font-medium">{workOrder.status}</span>
              </div>
              <div>
                <span className="text-sm text-gray-400">TM Closure Date:</span>
                <span className="ml-2 text-white">{workOrder.resolvedAt ? new Date(workOrder.resolvedAt).toLocaleString() : 'Not resolved yet'}</span>
              </div>
              <div>
                <span className="text-sm text-gray-400">Total Time to Resolve:</span>
                <span className="ml-2 text-white font-medium">{totalTimeToResolve} minutes ({(totalTimeToResolve / 60).toFixed(1)} hours)</span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Asset Condition After Work</label>
                <textarea
                  value={editableData.assetCondition}
                  onChange={(e) => setEditableData({...editableData, assetCondition: e.target.value})}
                  disabled={!isTM}
                  className="w-full bg-gray-900/50 border border-gray-700 rounded px-3 py-2 text-white disabled:opacity-50 disabled:cursor-not-allowed text-sm focus:outline-none focus:border-blue-500"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Technical Notes / Recommendations</label>
                <textarea
                  value={editableData.technicalNotes}
                  onChange={(e) => setEditableData({...editableData, technicalNotes: e.target.value})}
                  disabled={!isTM}
                  className="w-full bg-gray-900/50 border border-gray-700 rounded px-3 py-2 text-white disabled:opacity-50 disabled:cursor-not-allowed text-sm focus:outline-none focus:border-blue-500"
                  rows={3}
                />
              </div>
            </div>
          </div>
        )}

        {/* Section 7: Signatures & Validation */}
        {sectionVisibility.signatures && (
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-5 mb-4">
            <h2 className="text-lg font-semibold mb-4 text-gray-200 border-b border-gray-700 pb-2">7. Signatures & Validation</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Maintenance Team Signature {isTM && <span className="text-xs text-blue-400">(Editable)</span>}
                </label>
                <input
                  type="text"
                  value={editableData.tmSignature}
                  onChange={(e) => setEditableData({...editableData, tmSignature: e.target.value})}
                  disabled={!isTM}
                  placeholder="Digital signature or name"
                  className="w-full bg-gray-900/50 border border-gray-700 rounded px-3 py-2 text-white disabled:opacity-50 disabled:cursor-not-allowed text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Facility Manager Signature {isFM && <span className="text-xs text-blue-400">(Editable)</span>}
                </label>
                <input
                  type="text"
                  value={editableData.fmSignature}
                  onChange={(e) => setEditableData({...editableData, fmSignature: e.target.value})}
                  disabled={!isFM}
                  placeholder="Digital signature or name"
                  className="w-full bg-gray-900/50 border border-gray-700 rounded px-3 py-2 text-white disabled:opacity-50 disabled:cursor-not-allowed text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Signature Date</label>
                <input
                  type="date"
                  value={editableData.signatureDate}
                  onChange={(e) => setEditableData({...editableData, signatureDate: e.target.value})}
                  disabled={!isTM && !isFM}
                  className="w-full bg-gray-900/50 border border-gray-700 rounded px-3 py-2 text-white disabled:opacity-50 disabled:cursor-not-allowed text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Section 8: Additional Comments */}
        {sectionVisibility.comments && (
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-5 mb-4">
            <h2 className="text-lg font-semibold mb-4 text-gray-200 border-b border-gray-700 pb-2">8. Additional Comments {(isTM || isFM) && <span className="text-xs text-blue-400 ml-2">(Editable)</span>}</h2>
            <textarea
              value={editableData.additionalComments}
              onChange={(e) => setEditableData({...editableData, additionalComments: e.target.value})}
              disabled={!isTM && !isFM}
              placeholder="Any additional notes or comments..."
              className="w-full bg-gray-900/50 border border-gray-700 rounded px-3 py-2 text-white disabled:opacity-50 disabled:cursor-not-allowed text-sm focus:outline-none focus:border-blue-500"
              rows={4}
            />
          </div>
        )}
      </div>
    </div>
  );
};
