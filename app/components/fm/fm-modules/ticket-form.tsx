"use client";

import React, { useState, useEffect } from "react";
import { load, save, K, stripRevitPrefix } from "../fm-panel-utils";
import { CATEGORY_MAPPING } from "../../../services/asset-extraction-service";
import type { TicketItem, WorkOrderItem } from "../fm-panel-types";

interface TicketFormProps {
  projectId?: string;
  viewer?: any;
}

export 
const TicketForm: React.FC<TicketFormProps> = ({ projectId, viewer }) => {
  // Fetch from DB only - no localStorage caching for data
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrderItem[]>([]);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [showQrModal, setShowQrModal] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const [waitingForSelection, setWaitingForSelection] = useState(false);
  const isStandalone = typeof window !== 'undefined' && window.opener;
  const [projectName, setProjectName] = useState<string>('');

  // Load from backend
  useEffect(() => {
    const loadData = async () => {
      if (!projectId) return;
      try {
        const [ticketsRes, workOrdersRes] = await Promise.all([
          fetch(`/api/projects/${projectId}/tickets`),
          fetch(`/api/projects/${projectId}/work-orders`)
        ]);
        if (ticketsRes.ok) {
          const ticketsData = await ticketsRes.json();
          if (Array.isArray(ticketsData)) setTickets(ticketsData);
        }
        if (workOrdersRes.ok) {
          const workOrdersData = await workOrdersRes.json();
          if (Array.isArray(workOrdersData)) setWorkOrders(workOrdersData);
        }
      } catch (err) { console.error('[TicketForm] Load error', err); }
    };
    loadData();
  }, [projectId]);

  // Load project metadata (name) so we can fallback to it for Building when object has no Building prop
  useEffect(() => {
    if (!projectId) return;
    (async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}`);
        if (res.ok) {
          const json = await res.json();
          setProjectName(json?.project?.name || json?.name || '');
        }
      } catch (err) {
        console.warn('[TicketForm] Could not load project metadata', err);
      }
    })();
  }, [projectId]);

  // When projectName becomes available, ensure building defaults to it if empty
  useEffect(() => {
    if (!projectName) return;
    setForm(prev => {
      if (prev.building && String(prev.building).trim() !== '') return prev;
      return { ...prev, building: projectName };
    });
  }, [projectName]);

  // Listen for selection data from main window (standalone mode)
  useEffect(() => {
    if (!isStandalone) return;
    // include projectName so we can fall back to it when incoming selection has no Building
    const handleMessage = (e: MessageEvent) => {
      const d = e.data;
      if (!d || typeof d !== 'object') return;

      if (d.type === 'FM_SELECTION_DATA') {
        // Auto-detect discipline based on category
        let discipline = '';
        if (d.category) {
          const catLower = d.category.toLowerCase();
          if (catLower.includes('wall') || catLower.includes('window') || catLower.includes('door') || catLower.includes('roof') || catLower.includes('floor')) {
            discipline = 'Architecture';
          } else if (catLower.includes('column') || catLower.includes('beam') || catLower.includes('foundation') || catLower.includes('structural')) {
            discipline = 'Structure';
          } else if (catLower.includes('mechanical') || catLower.includes('hvac') || catLower.includes('duct') || catLower.includes('pipe')) {
            discipline = 'Mechanical';
          } else if (catLower.includes('electrical') || catLower.includes('lighting') || catLower.includes('fixture')) {
            discipline = 'Electrical';
          } else if (catLower.includes('plumbing') || catLower.includes('sanitary')) {
            discipline = 'Plumbing';
          } else if (catLower.includes('furniture') || catLower.includes('casework')) {
            discipline = 'Architecture';
          }
        }

        // Find matching category option from CATEGORY_MAPPING
        let matchedCategory = '';
        if (d.category) {
          const catLower = d.category.toLowerCase();
          for (const [italian, mapping] of Object.entries(CATEGORY_MAPPING)) {
            const englishLower = mapping.english.toLowerCase();
            const ifcLower = mapping.ifc.toLowerCase();
            const ifcWithoutPrefix = ifcLower.replace('ifc', '');

            if (
              catLower.includes(englishLower) ||
              englishLower.includes(catLower) ||
              catLower.includes(ifcWithoutPrefix) ||
              ifcWithoutPrefix.includes(catLower) ||
              (catLower.includes('furniture') && englishLower.includes('furnishing')) ||
              (catLower.includes('furnishing') && englishLower.includes('furniture'))
            ) {
              matchedCategory = `${italian} / ${mapping.english} (${mapping.ifc})`;
              console.log('🎯 [Prefill] Standalone - Category matched:', d.category, '→', matchedCategory);
              break;
            }
          }
        }

        setForm(v => ({
          ...v,
          item: d.item || '',
          itemDbId: d.itemDbId || null,
          discipline: discipline || v.discipline,
          category: matchedCategory || v.category,
          // Overwrite location fields explicitly; if missing, fallback to projectName so Building is auto-filled
          building: d.building ?? projectName ?? '',
          level: d.level ?? '',
          room: d.room ?? '',
          spaceCode: d.spaceCode ?? ''
        }));
        setWaitingForSelection(false);
        console.log('✅ [Prefill] Standalone - Data received and form updated', { discipline, matchedCategory });
      } else if (d.type === 'FM_SELECTION_CANCELLED') {
        setWaitingForSelection(false);
        console.log('⚠️ [Prefill] Standalone - Selection cancelled');
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isStandalone, projectName]);

  // Auto-request selection in standalone and fallback to prefill snapshot if no response
  useEffect(() => {
    if (!isStandalone) return;
    let responded = false;
    const onMessage = (e: MessageEvent) => {
      const d = e.data;
      if (!d || typeof d !== 'object') return;
      if (d.type === 'FM_SELECTION_DATA' || d.type === 'FM_SELECTION_CANCELLED') {
        responded = true;
        window.removeEventListener('message', onMessage as any);
      }
    };
    window.addEventListener('message', onMessage as any);
    try {
      setWaitingForSelection(true);
      (window as any).opener?.postMessage?.({ type: 'FM_SELECT_OBJECT_START' }, '*');
    } catch {}
    const t = window.setTimeout(() => {
      if (!responded) {
        // Fallback to local snapshot
        try {
          const raw = projectId ? localStorage.getItem(`fm-prefill-${projectId}`) : null;
          if (raw) {
            const snap = JSON.parse(raw || '{}');
            setForm(v => ({
              ...v,
              item: snap.item || v.item || '',
              itemDbId: snap.itemDbId || v.itemDbId || null,
              category: snap.category || v.category || '',
              building: snap.building || projectName || v.building || '',
              level: snap.level || v.level || '',
              room: snap.room || v.room || '',
              spaceCode: snap.spaceCode || v.spaceCode || ''
            }));
          }
        } catch {}
        setWaitingForSelection(false);
      }
    }, 1200);
    return () => { window.clearTimeout(t); window.removeEventListener('message', onMessage as any); };
  }, [isStandalone, projectId, projectName]);

  const [form, setForm] = useState(() => {
    // Load from localStorage on init
    const saved = load(`fm-ticket-form-draft-${projectId || 'global'}`, {});
    return {
      // Requester
      name: '', surname: '', contact: '',
      // Location
      building: '', level: '', room: '', spaceCode: '',
      // Intervention
      discipline: '', category: '', item: '', itemDbId: null as number | null, descriptionShort: '', descriptionDetailed: '',
      attachments: [] as string[],
      ...saved
    };
  });

  // Auto-save draft to localStorage on every field change
  useEffect(() => {
    save(`fm-ticket-form-draft-${projectId || 'global'}`, form);
  }, [form, projectId]);

  const disciplines = ['Architecture', 'Structure', 'Mechanical', 'Electrical', 'Plumbing', 'Fire Protection', 'Elevator', 'Safety', 'IT/Technology', 'Other'];

  // Select item from model
  const selectFromModel = async () => {
    console.log('🎯 [Prefill] Button clicked');

    // Standalone mode: request main window to handle selection
    if (isStandalone) {
      console.log('📤 [Prefill] Standalone mode - requesting selection from main window');
      try {
        setWaitingForSelection(true);
        (window as any).opener?.postMessage?.({ type: 'FM_SELECT_OBJECT_START' }, '*');
      } catch (err) {
        console.error('[Model Selection] Error sending message', err);
        setWaitingForSelection(false);
      }
      return;
    }

    // Modal mode: direct selection
    console.log('🖥️ [Prefill] Modal mode - direct selection');
    if (!viewer) {
      console.error('❌ [Prefill] Viewer not available');
      alert('Viewer not available. Please open a 3D model first.');
      return;
    }

    console.log('✅ [Prefill] Viewer available, getting selection...');

    try {
      // Get current selection - use getAggregateSelection for multi-model support
      viewer.getAggregateSelection((selectionData: any) => {
        console.log('📦 [Prefill] Selection data received:', selectionData);
        console.log('📦 [Prefill] Is array?', Array.isArray(selectionData));

        // Handle both array and single model object
        let model: any;
        let selectedIds: number[] = [];

        if (Array.isArray(selectionData)) {
          // Array format: [{ model, selection: [dbIds] }]
          console.log('📦 [Prefill] Array format detected');
          if (selectionData.length === 0) {
            console.warn('⚠️ [Prefill] Empty selection array');
            alert('Please select an object in the 3D model first.');
            return;
          }
          const firstItem = selectionData[0];
          model = firstItem.model;
          selectedIds = firstItem.selection || [];
        } else if (selectionData && selectionData.selector) {
          // Single model object with selector
          console.log('📦 [Prefill] Single model object detected');
          model = selectionData;
          selectedIds = model.selector?.getSelection?.() || [];
        } else {
          console.warn('⚠️ [Prefill] Unexpected format');
          alert('Unable to get selection. Please try again.');
          return;
        }

        console.log('📦 [Prefill] Model:', model);
        console.log('📦 [Prefill] Selected IDs:', selectedIds);

        if (!selectedIds || selectedIds.length === 0) {
          console.warn('⚠️ [Prefill] No objects selected');
          alert('Please select an object in the 3D model first.');
          return;
        }

        const dbId = selectedIds[0];

        console.log('🔍 [Prefill] Selected dbId:', dbId, 'Model:', model);

        // Get object properties
        model.getProperties(dbId, (props: any) => {
          console.log('📋 [Prefill] Properties received:', props);

          const getProp = (names: string[]): string | undefined => {
            const lower = names.map(n => n.toLowerCase());
            const p = props?.properties?.find((p: any) => {
              const dn = p.displayName?.toLowerCase?.();
              return dn && (lower.includes(dn) || lower.some(n => dn.includes(n)));
            });
            return p?.displayValue?.toString();
          };

          const name = props?.name || getProp(['Name', 'Nome']);
          // Category candidates (Revit + IFC + OmniClass + Italian)
          const rawCategory = getProp(['Category', 'Categoria', 'Titolo OmniClass', 'OmniClass Title', 'Descrizione']);
          const ifcType = getProp(['Export Type to IFC As', 'Esporta tipo in formato IFC con nome', 'IFC Type', 'IfcClass']);
          const ifcPredefined = getProp(['IFC Predefined Type', 'Tipo predefinito IFC']);
          
          // Level: prefer human-readable "Livello" from Constraints over numeric reference
          let level = '';
          if (Array.isArray(props?.properties)) {
            // First try to find "Livello" with displayCategory "Vincoli" (Constraints) - Italian human-readable level
            const itLevel = props.properties.find((p: any) => 
              (p.displayName || '').toString().toLowerCase() === 'livello' && 
              (p.displayCategory || '').toString().toLowerCase() === 'vincoli'
            );
            if (itLevel?.displayValue != null) {
              level = itLevel.displayValue.toString();
            } else {
              // Fallback: any "Level" property with string type
              const fallbackLevel = props.properties.find((p: any) => 
                (p.displayName || '').toString().toLowerCase() === 'level' && p.type === 20
              );
              if (fallbackLevel?.displayValue != null) {
                level = fallbackLevel.displayValue.toString();
              }
            }
          }
          
          let room = getProp(['Room', 'Space', 'Locale', 'Nome del locale']);
          const spaceCode = getProp(['Space Code', 'Number', 'Mark', 'Nome codice']);
          let building = getProp(['Building', 'Edificio']);

          // Use spatial bounding as fallback for room detection (check for empty string too)
          if ((!room || room.trim() === '') && (window as any).sensorContext?.findRoomForObject) {
            try {
              const roomData = (window as any).sensorContext.findRoomForObject(dbId);
              if (roomData?.name) {
                room = roomData.name;
                console.log('🏠 [Prefill] Using spatial bounding room:', room);
              }
            } catch (err) {
              console.warn('[Prefill] Spatial bounding fallback failed', err);
            }
          }

          // Extra robust fallback: if level still missing, scan all props for any 'level' key
          if ((!level || level.trim() === '') && Array.isArray(props?.properties)) {
            for (const p of props.properties) {
              const dn = (p.displayName || '').toString().toLowerCase();
              const dv = (p.displayValue || '').toString();
              if (dn.includes('level') && dv) { level = dv; break; }
            }
          }

          // Auto-detect discipline: robust multi-step detection
          let discipline = '';

          // Helper: try to match a text against known disciplines
          const matchKnownDiscipline = (text: string | undefined) => {
            if (!text) return '';
            const t = text.toLowerCase();
            const mapping: Record<string, string[]> = {
              'Architecture': ['wall', 'window', 'door', 'roof', 'floor', 'muro', 'finestra', 'porta', 'floor', 'pavimento', 'architettura'],
              'Structure': ['column', 'beam', 'foundation', 'structural', 'colonna', 'trave', 'fondazione', 'struttura'],
              'Mechanical': ['mechanical', 'hvac', 'duct', 'pipe', 'meccanico', 'ventil', 'convettore', 'pump', 'fan', 'meccanica'],
              'Electrical': ['electrical', 'lighting', 'fixture', 'elettrico', 'quadro', 'circuito', 'panel', 'elettrica'],
              'Plumbing': ['plumbing', 'sanitary', 'idraul', 'plumbing', 'plumbing'],
              'Fire Protection': ['fire', 'antincendio', 'sprinkler'],
              'Elevator': ['elevator', 'lift', 'ascensore'],
              'Safety': ['safety', 'protezione'],
              'IT/Technology': ['network', 'data', 'tecnologia']
            };
            for (const [disc, keywords] of Object.entries(mapping)) {
              for (const kw of keywords) {
                if (t.includes(kw)) return disc;
              }
            }
            return '';
          };

          // 1) Try matching known disciplines from rawCategory first (most reliable)
          if (rawCategory) {
            discipline = matchKnownDiscipline(rawCategory) || '';
            if (discipline) {
              console.log('🎯 [Prefill] Discipline inferred from category →', discipline);
            }
          }

          // 2) If not found from category, scan other discipline-like properties
          if (!discipline) {
            const disciplineCandidates = [
              'Discipline', 'Discipline Type', 'Category Type', 'System Classification', 'System Name',
              'Classification', 'Classificazione', 'Description'
            ];

            for (const cand of disciplineCandidates) {
              const v = getProp([cand]);
              if (v) {
                // try matching known disciplines inside the value
                const matched = matchKnownDiscipline(v);
                if (matched) {
                  console.log('🎯 [Prefill] Discipline found from prop', cand, '→', matched);
                  discipline = matched;
                  break;
                }
              }
            }
          }

          // 3) Scan all properties names and values as fallback
          if (!discipline && Array.isArray(props?.properties)) {
            for (const p of props.properties) {
              const dv = (p.displayValue || '').toString();
              const dn = (p.displayName || '').toString();
              const tryText = `${dn} ${dv}`;
              const m = matchKnownDiscipline(tryText);
              if (m) { discipline = m; console.log('🎯 [Prefill] Discipline found scanning properties →', m, 'from', dn); break; }
            }
          }

          // 4) Final fallback: check object name
          if (!discipline && name) {
            discipline = matchKnownDiscipline(name) || '';
            if (discipline) console.log('🎯 [Prefill] Discipline inferred from name →', discipline);
          }

          // Prefer IFC mapping when available; otherwise map Italian/English category; fallback to raw values
          let matchedCategory = '';
          if (ifcType) {
            const ic = ifcType.toString().toLowerCase();
            for (const [it, m] of Object.entries(CATEGORY_MAPPING)) {
              if (m.ifc.toLowerCase() === ic) { matchedCategory = `${it} / ${m.english} (${m.ifc})`; break; }
            }
            if (!matchedCategory) matchedCategory = ifcType; // fallback to IFC type string
          }
          if (!matchedCategory && rawCategory) {
            const rc = rawCategory.toString().toLowerCase();
            for (const [it, m] of Object.entries(CATEGORY_MAPPING)) {
              if (rc.includes(it.toLowerCase()) || rc.includes(m.english.toLowerCase()) || rc.includes(m.ifc.toLowerCase())) {
                matchedCategory = `${it} / ${m.english} (${m.ifc})`;
                break;
              }
            }
            if (!matchedCategory) matchedCategory = rawCategory;
          }
          if (!matchedCategory && ifcPredefined) matchedCategory = ifcPredefined;

          console.log('✨ [Prefill] Extracted data:', {
            name,
            category: rawCategory,
            matchedCategory,
            discipline,
            level,
            room,
            spaceCode,
            building,
            dbId
          });

          // Update form - fallback building to projectName when BIM object has no Building property
          setForm(v => ({
            ...v,
            item: name || `Object ${dbId}`,
            itemDbId: dbId,
            discipline: discipline || v.discipline,
            category: matchedCategory || v.category,
            // Overwrite location fields; if missing, use projectName for building to avoid empty building
            building: building || projectName || 'Project Name',
            level: level ?? '',
            room: room ?? '',
            spaceCode: spaceCode ?? ''
          }));

          console.log('✅ [Prefill] Form updated successfully');
        });
      });
    } catch (err) {
      console.error('❌ [Model Selection] Error', err);
      alert('Error selecting from model. Please try again.');
    }
  };

  // Build category options from CATEGORY_MAPPING
  const categoryOptions: string[] = React.useMemo(() => {
    const opts: string[] = [];
    for (const [it, m] of Object.entries(CATEGORY_MAPPING)) {
      opts.push(`${it} / ${m.english} (${m.ifc})`);
    }
    return opts.sort();
  }, []);

  const generateCode = async (ticketCode: string): Promise<string> => {
    const qrData = JSON.stringify({
      ticketCode,
      requester: `${form.name} ${form.surname}`,
      contact: form.contact,
      location: `${form.building}-${form.level}-${form.room}`,
      item: form.item,
      category: form.category,
      discipline: form.discipline,
      timestamp: new Date().toISOString()
    });

    // Generate QR code using QRCode library
    let qrDataUrl = '';
    try {
      const QRCode = (await import('qrcode')).default;
      qrDataUrl = await QRCode.toDataURL(qrData, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      setQrCodeDataUrl(qrDataUrl);
    } catch (err) {
      console.error('[QR Generation] Error', err);
      // Fallback to simple canvas
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = 300;
        canvas.height = 300;
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 300, 300);
        ctx.fillStyle = 'black';
        ctx.font = '14px monospace';
        ctx.fillText(ticketCode, 50, 150);
        qrDataUrl = canvas.toDataURL();
        setQrCodeDataUrl(qrDataUrl);
      }
    }

    setGeneratedCode(ticketCode);
    setShowQrModal(true);
    return qrDataUrl;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const fileNames = Array.from(files).map(f => f.name);
      setForm(v => ({ ...v, attachments: [...v.attachments, ...fileNames] }));
    }
  };

  const [validationError, setValidationError] = useState<string>('');

  const submit = async () => {
    // Validate required fields
    if (!form.name || !form.surname || !form.contact) {
      setValidationError('Please fill in all requester information (Name, Surname, Contact)');
      setTimeout(() => setValidationError(''), 5000);
      return;
    }
    setValidationError('');

    const timestamp = Date.now();
    const code = `TKT-${timestamp}`;
    const qrData = `TICKET:${code}|REQUESTER:${form.name} ${form.surname}|CONTACT:${form.contact}|LOCATION:${form.building}-${form.level}-${form.room}`;

    const ticket: TicketItem = {
      id: `ticket-${timestamp}`,
      ticketCode: code,
      qrCode: qrData,
      requester: {
        name: form.name,
        surname: form.surname,
        contact: form.contact
      },
      location: {
        building: form.building,
        level: form.level,
        room: form.room,
        spaceCode: form.spaceCode
      },
      intervention: {
        discipline: form.discipline,
        category: form.category,
        item: form.item,
        descriptionShort: form.descriptionShort,
        descriptionDetailed: form.descriptionDetailed,
        attachments: form.attachments as any // Convert string[] to attachment format if needed
      },
      status: 'PENDING_APPROVAL',
      createdAt: new Date().toISOString()
    };

    // Save to backend if projectId available
    if (projectId) {
      try {
        // Generate QR code first and get the data URL
        const generatedQrDataUrl = await generateCode(code);

        const ticketRes = await fetch(`/api/projects/${projectId}/tickets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...ticket,
            qrCodeDataUrl: generatedQrDataUrl // Pass QR code for email
          })
        });

        if (ticketRes.ok) {
          const ticketData = await ticketRes.json();
          const savedTicket = ticketData.ticket;

          // Create corresponding work order
          const workOrder: WorkOrderItem = {
            id: `wo-${timestamp}`,
            requestId: code,
            requester: `${form.name} ${form.surname}`,
            contact: form.contact,
            location: `${form.building} - ${form.level} - ${form.room}`,
            interventionDetails: form.descriptionDetailed,
            discipline: form.discipline,
            category: form.category,
            description: form.descriptionShort,
            attachments: form.attachments.map(url => ({ url, type: 'doc' as const })),
            asset: form.item,
            status: 'OPEN',
            sourceTicketId: savedTicket.id
          };

          const woRes = await fetch(`/api/projects/${projectId}/work-orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(workOrder)
          });

          if (woRes.ok) {
            // Reload data from backend
            const [ticketsRes, workOrdersRes] = await Promise.all([
              fetch(`/api/projects/${projectId}/tickets`),
              fetch(`/api/projects/${projectId}/work-orders`)
            ]);
            if (ticketsRes.ok) {
              const ticketsData = await ticketsRes.json();
              if (Array.isArray(ticketsData)) setTickets(ticketsData);
            }
            if (workOrdersRes.ok) {
              const workOrdersData = await workOrdersRes.json();
              if (Array.isArray(workOrdersData)) setWorkOrders(workOrdersData);
            }
          }
        }
      } catch (err) {
        console.error('[TicketForm] Submit error', err);
        alert('Error saving ticket to database. Saved locally.');
        // Fallback to local storage
        setTickets(prev => [ticket, ...prev]);
      }
    } else {
      // No projectId, save to local storage only
      setTickets(prev => [ticket, ...prev]);
      const workOrder: WorkOrderItem = {
        id: `wo-${timestamp}`,
        requestId: code,
        requester: `${form.name} ${form.surname}`,
        contact: form.contact,
        location: `${form.building} - ${form.level} - ${form.room}`,
        interventionDetails: form.descriptionDetailed,
        discipline: form.discipline,
        category: form.category,
        description: form.descriptionShort,
        attachments: form.attachments.map(url => ({ url, type: 'doc' as const })),
        asset: form.item,
        status: 'OPEN',
        sourceTicketId: ticket.id
      };
      setWorkOrders(prev => [workOrder, ...prev]);
    }

    // Generate and show QR code with success modal
    await generateCode(code);

    // Clear draft after successful submission
    const emptyForm = {
      name: '', surname: '', contact: '',
      building: projectName ?? '', level: '', room: '', spaceCode: '',
      discipline: '', category: '', item: '', itemDbId: null, descriptionShort: '', descriptionDetailed: '',
      attachments: []
    };
    setForm(emptyForm);
    save(`fm-ticket-form-draft-${projectId || 'global'}`, emptyForm);
  };

  const resetForm = () => {
    const emptyForm = {
      name: '', surname: '', contact: '',
      building: projectName ?? '', level: '', room: '', spaceCode: '',
      discipline: '', category: '', item: '', itemDbId: null, descriptionShort: '', descriptionDetailed: '',
      attachments: []
    };
    setForm(emptyForm);
    save(`fm-ticket-form-draft-${projectId || 'global'}`, emptyForm);
    setQrCodeDataUrl('');
    setShowQrModal(false);
    setGeneratedCode('');
  };

  return (
    <div className="p-3 space-y-3 h-full flex flex-col overflow-y-auto">
      <div className="text-white font-semibold text-sm">Ticket based Maintenance</div>

      {/* Requester Section */}
      <div className="border-b border-gray-700 pb-3">
        <div className="text-xs text-gray-400 mb-2">Requester</div>
        <div className="grid grid-cols-2 gap-2">
          <input placeholder="Name" value={form.name} onChange={e => setForm(v => ({ ...v, name: e.target.value }))} className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" />
          <input placeholder="Surname" value={form.surname} onChange={e => setForm(v => ({ ...v, surname: e.target.value }))} className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" />
          <div className="col-span-2"><input placeholder="Contact (email / phone)" value={form.contact} onChange={e => setForm(v => ({ ...v, contact: e.target.value }))} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" /></div>
        </div>
      </div>

      {/* Intervention Section - Moved under Requester */}
      <div className="border-b border-gray-700 pb-3">
        <div className="text-xs text-gray-400 mb-2">Intervention Identification</div>
        <div className="grid grid-cols-1 gap-2">
          {/* Item - Now first field with Prefill from Selection */}
          <div className="flex gap-2 items-center">
            <input
              placeholder={waitingForSelection ? "Waiting for selection..." : "Item (select from model)"}
              value={form.item}
              onChange={e => setForm(v => ({ ...v, item: e.target.value }))}
              className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs"
              disabled={waitingForSelection}
            />
            {(viewer || isStandalone) && (
              <div className="flex-shrink-0 flex gap-2">
                <button
                  type="button"
                  onClick={selectFromModel}
                  disabled={waitingForSelection}
                  className={`px-3 py-1.5 rounded text-xs font-semibold whitespace-nowrap ${waitingForSelection
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-purple-600 hover:bg-purple-700 text-white'
                  }`}
                  title={isStandalone ? "Select object from main window" : "Select object from 3D model"}
                  style={{ minWidth: 140 }}
                >
                  {waitingForSelection ? 'Waiting...' : 'Prefill from Selection'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setForm(v => ({
                      ...v,
                      item: '',
                      itemDbId: null,
                      discipline: '',
                      category: '',
                      building: projectName ?? '',
                      level: '',
                      room: '',
                      spaceCode: ''
                    }));
                  }}
                  className="px-3 py-1.5 rounded text-xs font-semibold whitespace-nowrap bg-gray-700 hover:bg-gray-600 text-white"
                  style={{ minWidth: 120 }}
                  disabled={waitingForSelection}
                  title="Clear selection and autofilled fields"
                >
                  Clear selection
                </button>
              </div>
            )}
          </div>
          <select value={form.discipline} onChange={e => setForm(v => ({ ...v, discipline: e.target.value }))} className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs">
            <option value="">Select Discipline</option>
            {disciplines.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={form.category} onChange={e => setForm(v => ({ ...v, category: e.target.value }))} className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs">
            <option value="">Select Category</option>
            {/* If form.category contains a raw value not present in categoryOptions, inject it so the select displays it */}
            {form.category && !categoryOptions.includes(form.category) && (
              <option key={`raw-${form.category}`} value={form.category}>{form.category}</option>
            )}
            {categoryOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
          <input placeholder="Short Description" value={form.descriptionShort} onChange={e => setForm(v => ({ ...v, descriptionShort: e.target.value }))} className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" />
          <textarea placeholder="Detailed Description" value={form.descriptionDetailed} onChange={e => setForm(v => ({ ...v, descriptionDetailed: e.target.value }))} className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" rows={3} />

          {/* File Attachments */}
          <div>
            <label className="text-xs text-gray-400 block mb-1">Attached Files</label>
            <input type="file" multiple onChange={handleFileUpload} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" />
            {form.attachments.length > 0 && (
              <div className="mt-2 space-y-1">
                {form.attachments.map((file, idx) => (
                  <div key={idx} className="text-xs text-gray-400 flex justify-between items-center bg-gray-900/60 px-2 py-1 rounded">
                    <span>{file}</span>
                    <button onClick={() => setForm(v => ({ ...v, attachments: v.attachments.filter((_, i) => i !== idx) }))} className="text-red-400 hover:text-red-300">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Location Section - Now after Intervention */}
      <div className="border-b border-gray-700 pb-3">
        <div className="text-xs text-gray-400 mb-2">Location of Intervention</div>
        <div className="grid grid-cols-2 gap-2">
          <input placeholder="Building" value={form.building} onChange={e => setForm(v => ({ ...v, building: e.target.value }))} className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" />
          <input placeholder="Level" value={form.level} onChange={e => setForm(v => ({ ...v, level: e.target.value }))} className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" />
          <input placeholder="Room" value={form.room} onChange={e => setForm(v => ({ ...v, room: e.target.value }))} className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" />
          <input placeholder="Space Code" value={form.spaceCode} onChange={e => setForm(v => ({ ...v, spaceCode: e.target.value }))} className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" />
        </div>
      </div>

      {/* Validation Error */}
      {validationError && (
        <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 flex items-start gap-2">
          <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1">
            <div className="text-red-400 text-sm font-semibold">Validation Error</div>
            <div className="text-red-300 text-xs mt-1">{validationError}</div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 pt-2">
        <button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded text-sm font-semibold" onClick={submit}>Submit Ticket</button>
        <button className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2.5 rounded text-sm" onClick={resetForm}>Reset</button>
      </div>

      {/* Success Modal with QR Code */}
      {showQrModal && generatedCode && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 w-full max-w-4xl border border-gray-700 shadow-2xl resize overflow-auto" style={{ minWidth: '400px', minHeight: '500px', maxHeight: 'calc(100vh - 40px)', maxWidth: 'calc(100vw - 40px)' }} onClick={e => e.stopPropagation()}>
            {/* Success Header */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500/20 rounded-full mb-4">
                <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Ticket Created Successfully!</h3>
              <p className="text-gray-400 text-sm">Your maintenance request has been submitted</p>
            </div>

            {/* QR Code Display */}
            <div className="bg-white rounded-xl p-6 mb-6 flex items-center justify-center shadow-lg">
              {qrCodeDataUrl ? (
                <img src={qrCodeDataUrl} alt="QR Code" className="w-64 h-64" />
              ) : (
                <div className="w-64 h-64 bg-gray-100 flex items-center justify-center text-gray-600 text-sm text-center p-4 rounded-lg">
                  <div>
                    <div className="text-2xl mb-2">📱</div>
                    <div className="font-mono text-xs">{generatedCode}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Ticket Info */}
            <div className="space-y-3 mb-6">
              <div className="bg-gray-900/60 rounded-lg px-4 py-3 border border-gray-700">
                <div className="text-xs text-gray-400 mb-1">Ticket Code</div>
                <div className="text-lg font-mono text-white font-semibold">{generatedCode}</div>
              </div>
              <div className="text-center text-sm text-gray-400 py-2">
                <span className="inline-flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  This ticket has been sent to the Maintenance Team
                </span>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={() => {
                setShowQrModal(false);
                resetForm();
              }}
              className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-6 py-3 rounded-lg text-sm font-semibold transition-colors shadow-lg hover:shadow-xl"
            >
              Close
            </button>
          </div>
        </div>
      )}

      
    </div>
  );
};

