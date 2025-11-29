"use client";

import React, { useState, useEffect, useRef } from "react";
// html2pdf.js is loaded dynamically to avoid SSR issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let html2pdfLib: any = null;
import { useUserRole } from "@/app/hooks/useUserRole";
import type { WorkOrderItem } from "../fm-panel-types";
import { X, Printer, Save } from "lucide-react";
import toast from "react-hot-toast";

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
    const contentRef = useRef<HTMLDivElement | null>(null);
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
  const [isDirty, setIsDirty] = useState(false);
  const [maintenanceTeamInfo, setMaintenanceTeamInfo] = useState<{name: string, surname: string} | null>(null);

  const updateData = (field: string, value: any) => {
    setEditableData((prev: any) => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

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
      setIsDirty(false);
    }
  }, [workOrder]);

  // Fetch project team to get Maintenance Team info
  useEffect(() => {
    if (!projectId) return;
    
    const fetchTeam = async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/team`);
        if (res.ok) {
          const data = await res.json();
          const team = data.team || [];
          const maintenanceTeamMember = team.find((m: any) => m.role === 'TM');
          
          if (maintenanceTeamMember) {
            setMaintenanceTeamInfo({
              name: maintenanceTeamMember.firstName || maintenanceTeamMember.name.split(' ')[0],
              surname: maintenanceTeamMember.surname || maintenanceTeamMember.name.split(' ').slice(1).join(' ')
            });
          }
        }
      } catch (e) {
        console.error('Failed to fetch team:', e);
      }
    };
    
    fetchTeam();
  }, [projectId]);

  const toggleSection = (section: keyof typeof sectionVisibility) => {
    setSectionVisibility(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const saveReport = async () => {
    if (!workOrder || !projectId) return;
    
    setSaving(true);
    try {
      // Use workOrder.id if _id is missing (normalized data)
      const orderId = workOrder._id || workOrder.id;
      const res = await fetch(`/api/projects/${projectId}/work-orders/${orderId}/report`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editableData)
      });
      
      if (!res.ok) throw new Error('Failed to save report');
      
      toast.success('Report saved successfully!');
      setIsDirty(false);
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const generatePDF = () => {
    // Fallback to print if html2pdf is not available
    document.body.classList.add('printing');
    window.print();
    document.body.classList.remove('printing');
  };

  const downloadPDF = async () => {
    try {
      if (!contentRef.current) return;
      // Dynamically import to avoid SSR issues
      if (!html2pdfLib) {
        const mod = await import('html2pdf.js');
        html2pdfLib = mod.default || mod;
      }

      const fileName = `Maintenance_Report_${workOrder?.requestId || workOrder?.id || 'N_A'}.pdf`;

      // Clone node to avoid hidden styles interfering
      const node = contentRef.current.cloneNode(true) as HTMLElement;
      // Wrap clone in a minimal container with reset styles
      const wrapper = document.createElement('div');
      wrapper.style.background = '#ffffff';
      wrapper.style.color = '#000000';
      wrapper.style.width = '100%';
      wrapper.style.maxWidth = '100%';
      wrapper.style.padding = '0';
      wrapper.style.margin = '0';
      // Append clone into wrapper
      wrapper.appendChild(node);
      // Remove UI-only elements (toggles, buttons) from the clone
      // Remove anything marked as no-print
      wrapper.querySelectorAll('.no-print').forEach((el) => el.parentNode?.removeChild(el));
      
      // Remove all form elements (inputs, textareas, selects, buttons)
      wrapper.querySelectorAll('input, textarea, select, button').forEach((el) => el.parentNode?.removeChild(el));

      // Remove "(Editable)" text from the clone
      wrapper.querySelectorAll('span').forEach((span) => {
        if (span.textContent && (span.textContent.includes('(Editable)') || span.textContent.includes('Editable'))) {
          span.remove();
        }
      });

      // Remove existing headers to avoid duplication
      wrapper.querySelectorAll('h1').forEach((el) => el.remove());

      // Try to remove the Section Visibility block by heading text match
      wrapper.querySelectorAll('h3').forEach((h) => {
        if (h.textContent && h.textContent.toLowerCase().includes('section visibility')) {
          const parent = h.closest('div');
          parent?.parentNode?.removeChild(parent);
        }
      });

      // Add a clean, professional header
      const header = document.createElement('div');
      header.style.borderBottom = '1px solid #333';
      header.style.paddingBottom = '15px';
      header.style.marginBottom = '20px';
      header.style.display = 'flex';
      header.style.justifyContent = 'space-between';
      header.style.alignItems = 'flex-end';
      
      const leftHeader = document.createElement('div');
      const h1 = document.createElement('h1');
      h1.textContent = 'Maintenance Report';
      h1.style.fontSize = '22pt';
      h1.style.fontWeight = '600';
      h1.style.margin = '0';
      h1.style.color = '#000';
      h1.style.fontFamily = 'Georgia, serif';
      
      leftHeader.appendChild(h1);
      
      const rightHeader = document.createElement('div');
      rightHeader.style.textAlign = 'right';
      rightHeader.style.fontSize = '10pt';
      rightHeader.style.color = '#333';
      rightHeader.style.fontFamily = 'Arial, sans-serif';
      rightHeader.innerHTML = `
        <div><strong>Work Order:</strong> ${workOrder?.requestId || workOrder?.ticketId || workOrder?.id || 'N/A'}</div>
        <div><strong>Date:</strong> ${new Date().toLocaleDateString()}</div>
      `;
      
      header.appendChild(leftHeader);
      header.appendChild(rightHeader);
      
      wrapper.insertBefore(header, wrapper.firstChild);
      
      // Intelligent Styling & Class Stripping
      wrapper.querySelectorAll('*').forEach((el) => {
        const htmlEl = el as HTMLElement;
        
        // Capture state before stripping classes
        const isGrid = htmlEl.classList.contains('grid');
        const isColSpan2 = htmlEl.classList.contains('col-span-2');
        const isLabel = htmlEl.classList.contains('text-gray-400') || htmlEl.tagName === 'LABEL';
        const isValue = htmlEl.classList.contains('text-white') || htmlEl.classList.contains('print-value');
        const isSectionHeader = htmlEl.tagName === 'H2';
        
        // Identify section containers: Divs that have an H2 as a direct child
        const isSectionContainer = htmlEl.tagName === 'DIV' && htmlEl.querySelector(':scope > h2') !== null;

        // Strip classes
        if (el instanceof SVGElement) {
          el.setAttribute('class', '');
        } else {
          htmlEl.className = '';
        }
        
        const s = htmlEl.style;
        
        // Global Reset
        s.boxShadow = 'none';
        s.filter = 'none';
        s.backdropFilter = 'none';
        s.backgroundColor = 'transparent';
        s.color = '#222';
        s.fontFamily = 'Arial, Helvetica, sans-serif';
        
        // Section Container Styling (Clean, Simple)
        if (isSectionContainer) {
            s.border = '1px solid #ccc';
            s.borderRadius = '0';
            s.padding = '12px 15px';
            s.marginBottom = '15px';
            s.backgroundColor = '#fff';
            s.pageBreakInside = 'avoid';
        }

        // Layout: Grid Simulation
        if (isGrid) {
          s.display = 'flex';
          s.flexWrap = 'wrap';
          s.gap = '10px 20px';
          s.width = '100%';
        }
        
        // Layout: Grid Items
        if (htmlEl.parentElement?.style.display === 'flex') {
          if (isColSpan2) {
            s.width = '100%';
            s.flex = '1 1 100%';
          } else {
            s.width = 'calc(50% - 10px)';
            s.flex = '1 1 calc(50% - 10px)';
          }
          s.marginBottom = '6px';
        }
        
        // Typography: Section Headers
        if (isSectionHeader) {
          s.fontSize = '11pt';
          s.fontWeight = '700';
          s.backgroundColor = '#f5f5f5';
          s.padding = '6px 10px';
          s.marginBottom = '10px';
          s.marginTop = '0';
          s.color = '#333';
          s.borderBottom = '1px solid #ddd';
        }
        
        // Typography: Labels
        if (isLabel) {
          s.color = '#555';
          s.fontSize = '8pt';
          s.fontWeight = '600';
          s.textTransform = 'uppercase';
          s.display = 'inline';
          s.marginRight = '5px';
        }
        
        // Typography: Values
        if (isValue) {
          s.color = '#000';
          s.fontSize = '9.5pt';
          s.fontWeight = '400';
          s.lineHeight = '1.4';
          s.display = 'inline';
        }
        
        // Fix for checkboxes
        if (htmlEl.tagName === 'INPUT' && (htmlEl as HTMLInputElement).type === 'checkbox') {
           s.display = 'none';
        }
      });
      
      // Add footer spacer
      const footer = document.createElement('div');
      footer.style.height = '30px';
      wrapper.appendChild(footer);

      const opt = {
        margin: [15, 15, 15, 15], // mm equivalent handled by html2pdf
        filename: fileName,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          windowWidth: document.documentElement.scrollWidth,
          onclone: (clonedDoc: Document) => {
            // Remove global stylesheets that may inject oklab/colors
            clonedDoc.querySelectorAll('style, link[rel="stylesheet"]').forEach((n) => n.parentNode?.removeChild(n));
            const root = clonedDoc.body; // Use body of cloned doc containing wrapper
            if (!root) return;
            // Ensure body is white/black
            (root as HTMLElement).style.backgroundColor = '#ffffff';
            (root as HTMLElement).style.color = '#000000';
          },
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'], avoid: ['.no-break'] },
      } as any;

      await html2pdfLib().set(opt).from(wrapper).save();
      toast.success('PDF downloaded successfully');
    } catch (e: any) {
      console.error('PDF generation failed:', e);
      toast.error('Failed to generate PDF');
    }
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
    <div className="bg-gray-900 text-white min-h-screen p-6 overflow-y-auto print:bg-white print:text-black print:p-0">
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 15mm;
          }
          html, body {
            height: auto !important;
            overflow: visible !important;
            background: white !important;
            color: black !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            font-size: 12pt !important;
          }
          body * {
            visibility: hidden;
          }
          .print-content, .print-content * {
            visibility: visible;
          }
          .print-content {
            position: static;
            width: 100% !important;
            max-width: none !important;
            background: white;
            color: black;
            padding: 0;
            margin: 0;
            overflow: visible !important;
          }
          .no-print {
            display: none !important;
          }
          /* Force dark backgrounds to white for print */
          .bg-gray-800\\/50, .bg-gray-900 {
            background-color: white !important;
            border: 1px solid #ccc !important;
            color: black !important;
            box-shadow: none !important;
          }
          .text-gray-400, .text-gray-300, .text-gray-200 {
            color: #333 !important;
          }
          .text-white {
            color: black !important;
          }
          /* Hide inputs/textareas in print and show their values instead */
          input, textarea {
            display: none !important;
          }
          .print-value {
            display: block !important;
            white-space: pre-wrap;
            border: 1px solid #ddd;
            padding: 4px 8px;
            border-radius: 4px;
            min-height: 1.5em;
            font-size: 12pt !important;
            color: black !important;
          }
          /* Hide scrollbars */
          ::-webkit-scrollbar {
            display: none;
          }
        }
      `}</style>
      <div ref={contentRef} className="max-w-6xl mx-auto print-content print:max-w-none print:w-full">
        {/* Header */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 mb-4 flex items-center justify-between no-print">
          <div>
            <h1 className="text-2xl font-semibold text-white">Maintenance Report</h1>
            <p className="text-sm text-gray-400 mt-1">Work Order: {workOrder.requestId || workOrder.ticketId || 'N/A'}</p>
          </div>
          <div className="flex gap-3 items-center">
            <button
              onClick={downloadPDF}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-blue-900/20"
            >
              <Printer size={16} />
              Download PDF
            </button>
            
            <button
              onClick={onClose}
              className="ml-2 p-2 bg-gray-700 hover:bg-red-600 text-white rounded-full transition-all duration-200 hover:rotate-90 shadow-lg"
              title="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Print Header (Only visible in print) */}
        <div className="hidden print:block mb-6 border-b pb-4">
          <h1 className="text-2xl font-bold">Maintenance Report</h1>
          <p className="text-sm text-gray-600">Work Order: {workOrder.requestId || workOrder.ticketId || 'N/A'}</p>
          <p className="text-sm text-gray-600">Date: {new Date().toLocaleDateString()}</p>
        </div>

        {/* Section Visibility Toggles */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 mb-4 no-print">
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
                <span className="ml-2 text-white">
                  {workOrder.assignedTechnicians && workOrder.assignedTechnicians.length > 0 
                    ? workOrder.assignedTechnicians.map(t => t.company).filter(Boolean).join(', ') || 'N/A'
                    : (workOrder.company || 'N/A')}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Name of Maintenance Team:</span>
                <span className="ml-2 text-white">{maintenanceTeamInfo?.name || (workOrder as any).maintenanceTeamName || 'N/A'}</span>
              </div>
              <div>
                <span className="text-gray-400">Surname of Maintenance Team:</span>
                <span className="ml-2 text-white">{maintenanceTeamInfo?.surname || (workOrder as any).maintenanceTeamSurname || 'N/A'}</span>
              </div>
              <div>
                <span className="text-gray-400">Primary Technician:</span>
                <span className="ml-2 text-white">
                  {workOrder.assignedTechnicians && workOrder.assignedTechnicians.length > 0 
                    ? workOrder.assignedTechnicians.map(t => t.name).join(', ')
                    : (workOrder.responsibleTechnician || 'N/A')}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Surname of Manutentor (1):</span>
                <span className="ml-2 text-white">{(workOrder as any).responsibleTechnicianSurname || 'N/A'}</span>
              </div>
              <div>
                <span className="text-gray-400">Name of Manutentor (2):</span>
                <span className="ml-2 text-white">{(workOrder as any).manutentor2Name || (workOrder.assignedTechnicians && workOrder.assignedTechnicians[0]?.name) || ''}</span>
              </div>
              <div>
                <span className="text-gray-400">Surname of Manutentor (2):</span>
                <span className="ml-2 text-white">{(workOrder as any).manutentor2Surname || (workOrder.assignedTechnicians && (workOrder.assignedTechnicians as any)[0]?.surname) || ''}</span>
              </div>
              {workOrder.assignedTechnicians && workOrder.assignedTechnicians.length > 0 && (
                <div className="col-span-2">
                  <span className="text-gray-400">Assigned Technicians:</span>
                  <div className="mt-2 space-y-1">
                    {workOrder.assignedTechnicians.map((tech: any, idx: number) => (
                      <div key={idx} className="text-sm text-white bg-gray-900/30 rounded px-3 py-1.5 flex justify-between items-center">
                        <span>{tech.name} ({tech.email})</span>
                        <div className="flex items-center gap-3">
                          {tech.company && <span className="text-blue-300">{tech.company}</span>}
                          <span className="text-gray-500 text-xs">Assigned {new Date(tech.assignedAt).toLocaleDateString()}</span>
                        </div>
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
                  onChange={(e) => updateData('diagnosis', e.target.value)}
                  disabled={!isTM}
                  className="w-full bg-gray-900/50 border border-gray-700 rounded px-3 py-2 text-white disabled:opacity-50 disabled:cursor-not-allowed text-sm focus:outline-none focus:border-blue-500 print:hidden"
                  rows={3}
                />
                <div className="hidden print-value">{editableData.diagnosis}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Work Performed</label>
                <textarea
                  value={editableData.workPerformed}
                  onChange={(e) => updateData('workPerformed', e.target.value)}
                  disabled={!isTM}
                  className="w-full bg-gray-900/50 border border-gray-700 rounded px-3 py-2 text-white disabled:opacity-50 disabled:cursor-not-allowed text-sm focus:outline-none focus:border-blue-500 print:hidden"
                  rows={3}
                />
                <div className="hidden print-value">{editableData.workPerformed}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Materials / Spare Parts Used</label>
                <textarea
                  value={editableData.materialsUsed}
                  onChange={(e) => updateData('materialsUsed', e.target.value)}
                  disabled={!isTM}
                  className="w-full bg-gray-900/50 border border-gray-700 rounded px-3 py-2 text-white disabled:opacity-50 disabled:cursor-not-allowed text-sm focus:outline-none focus:border-blue-500 print:hidden"
                  rows={2}
                />
                <div className="hidden print-value">{editableData.materialsUsed}</div>
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
                  onChange={(e) => updateData('complianceCompleted', e.target.checked)}
                  disabled={!isTM}
                  className="rounded print:hidden"
                />
                <span className="hidden print:inline font-bold mr-2">{editableData.complianceCompleted ? '☑' : '☐'}</span>
                <label className="text-sm font-medium text-gray-300">Compliance Check Completed</label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">PPE Used</label>
                <input
                  type="text"
                  value={editableData.ppeUsed}
                  onChange={(e) => updateData('ppeUsed', e.target.value)}
                  disabled={!isTM}
                  placeholder="e.g., Hard hat, Safety goggles, Gloves"
                  className="w-full bg-gray-900/50 border border-gray-700 rounded px-3 py-2 text-white disabled:opacity-50 disabled:cursor-not-allowed text-sm focus:outline-none focus:border-blue-500 print:hidden"
                />
                <div className="hidden print-value">{editableData.ppeUsed}</div>
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
                <span className="ml-2 text-white">{(workOrder as any).fmModificationDate ? new Date((workOrder as any).fmModificationDate).toLocaleString() : 'N/A'}</span>
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
                  onChange={(e) => updateData('assetCondition', e.target.value)}
                  disabled={!isTM}
                  className="w-full bg-gray-900/50 border border-gray-700 rounded px-3 py-2 text-white disabled:opacity-50 disabled:cursor-not-allowed text-sm focus:outline-none focus:border-blue-500 print:hidden"
                  rows={2}
                />
                <div className="hidden print-value">{editableData.assetCondition}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Technical Notes / Recommendations</label>
                <textarea
                  value={editableData.technicalNotes}
                  onChange={(e) => updateData('technicalNotes', e.target.value)}
                  disabled={!isTM}
                  className="w-full bg-gray-900/50 border border-gray-700 rounded px-3 py-2 text-white disabled:opacity-50 disabled:cursor-not-allowed text-sm focus:outline-none focus:border-blue-500 print:hidden"
                  rows={3}
                />
                <div className="hidden print-value">{editableData.technicalNotes}</div>
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
                  onChange={(e) => updateData('tmSignature', e.target.value)}
                  disabled={!isTM}
                  placeholder="Digital signature or name"
                  className="w-full bg-gray-900/50 border border-gray-700 rounded px-3 py-2 text-white disabled:opacity-50 disabled:cursor-not-allowed text-sm focus:outline-none focus:border-blue-500 print:hidden"
                />
                <div className="hidden print-value font-serif italic text-lg">{editableData.tmSignature}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Facility Manager Signature {isFM && <span className="text-xs text-blue-400">(Editable)</span>}
                </label>
                <input
                  type="text"
                  value={editableData.fmSignature}
                  onChange={(e) => updateData('fmSignature', e.target.value)}
                  disabled={!isFM}
                  placeholder="Digital signature or name"
                  className="w-full bg-gray-900/50 border border-gray-700 rounded px-3 py-2 text-white disabled:opacity-50 disabled:cursor-not-allowed text-sm focus:outline-none focus:border-blue-500 print:hidden"
                />
                <div className="hidden print-value font-serif italic text-lg">{editableData.fmSignature}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Signature Date</label>
                <input
                  type="date"
                  value={editableData.signatureDate}
                  onChange={(e) => updateData('signatureDate', e.target.value)}
                  disabled={!isTM && !isFM}
                  className="w-full bg-gray-900/50 border border-gray-700 rounded px-3 py-2 text-white disabled:opacity-50 disabled:cursor-not-allowed text-sm focus:outline-none focus:border-blue-500 print:hidden"
                />
                <div className="hidden print-value">{editableData.signatureDate}</div>
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
              onChange={(e) => updateData('additionalComments', e.target.value)}
              disabled={!isTM && !isFM}
              placeholder="Any additional notes or comments..."
              className="w-full bg-gray-900/50 border border-gray-700 rounded px-3 py-2 text-white disabled:opacity-50 disabled:cursor-not-allowed text-sm focus:outline-none focus:border-blue-500 print:hidden"
              rows={4}
            />
            <div className="hidden print-value">{editableData.additionalComments}</div>
          </div>
        )}

        {/* Save Button (Bottom) */}
        {(isTM || isFM) && (
          <div className="flex justify-end mt-6 mb-8 no-print">
            <button
              onClick={saveReport}
              disabled={saving || !isDirty}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg ${
                saving || !isDirty 
                  ? 'bg-gray-600 text-gray-300 cursor-not-allowed' 
                  : 'bg-green-600 hover:bg-green-700 text-white shadow-green-900/20'
              }`}
            >
              <Save size={16} />
              {saving ? 'Saving...' : (!isDirty ? 'Saved' : 'Save Report')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
