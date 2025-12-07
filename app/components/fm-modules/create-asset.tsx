"use client";

import React, { useState, useEffect, useCallback } from "react";
import { X, Save } from "lucide-react";
import { load, save, K, stripRevitPrefix, REVIT_CATEGORIES, IFCCLASSES_UNIQUE } from "../fm-panel-utils";
import { CATEGORY_MAPPING } from "../../services/asset-extraction-service";
import type { AssetRecord, SpaceRecord } from "../fm-panel-types";

interface CreateAssetProps {
  projectId?: string;
  viewer?: any;
  title?: string;
  initial?: Partial<AssetRecord>;
  onSaveOverride?: (asset: AssetRecord) => Promise<void>;
  mode?: 'create' | 'edit';
  bulkEditMode?: boolean;
}

export 
const CreateAsset: React.FC<{ projectId?: string; viewer?: any; title?: string; initial?: Partial<AssetRecord>; onSaveOverride?: (asset: AssetRecord) => Promise<void>; mode?: 'create'|'edit'; bulkEditMode?: boolean }> = ({ projectId, viewer, title, initial, onSaveOverride, mode = 'create', bulkEditMode = false }) => {
  // A clean empty form used when entering bulk edit or resetting edit mode
  const EMPTY_FORM: Partial<AssetRecord> = {
    category: '', type: '', brand: '', model: '', description: '', location: '',
    assetCode: '', assetName: '', serialNumber: '', installationDate: '',
    material: '', dimensions: '', weight: '', capacity: '', powerRating: '',
    manuals: '', warranties: '', certifications: '',
    condition: '', serviceDate: '', expectedLife: '',
    maintenanceSchedule: '', lastService: '', nextService: '',
    purchaseCost: '', maintenanceCost: '',
    regulations: '', safetyNotes: '',
    parentAsset: '', suppliers: '',
    // identification fields that might exist
    elementId: undefined as any,
    dbId: undefined as any,
  };
  const [rows, setRows] = useState<AssetRecord[]>(() => load(K.assets(projectId), [] as AssetRecord[]));
  const [activeSection, setActiveSection] = useState<'identification' | 'technical' | 'documentation' | 'lifecycle' | 'maintenance' | 'economic' | 'compliance' | 'relationships' | 'qr'>('identification');
  const [f, setF] = useState<Partial<AssetRecord>>(() => {
    // Load from localStorage on init
    const saved = load(`fm-create-asset-draft-${projectId || 'global'}`, {});
    return {
      ...EMPTY_FORM,
      ...saved,
      ...(initial || {})
    };
  });

  // If `mode`/`bulkEditMode`/`initial` change, keep form in correct state
  useEffect(() => {
    if (mode === 'edit') {
      if (bulkEditMode) {
        // Bulk edit should start from aggregated initial values passed by parent
        setF({ ...EMPTY_FORM, ...(initial as Partial<AssetRecord> || {}) });
      } else if (initial) {
        // Single edit should reflect the asset being edited (hard reset rather than merge)
        setF({ ...EMPTY_FORM, ...(initial as Partial<AssetRecord>) });
      }
    }
  }, [mode, bulkEditMode, initial]);


  // Auto-save draft to localStorage on every field change (only in create mode)
  useEffect(() => {
    if (mode === 'create' && !bulkEditMode) {
      save(`fm-create-asset-draft-${projectId || 'global'}`, f);
    }
  }, [f, projectId, mode, bulkEditMode]);

  useEffect(() => save(K.assets(projectId), rows), [rows, projectId]);

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const onSave = async () => {
    console.log('💾 [CreateAsset onSave] Starting save...');
    console.log('💾 [CreateAsset onSave] mode:', mode);
    console.log('💾 [CreateAsset onSave] onSaveOverride exists:', !!onSaveOverride);
    console.log('💾 [CreateAsset onSave] Form data (f):', f);
    console.log('💾 [CreateAsset onSave] bulkEditMode:', bulkEditMode);
    
    // Validate required fields - but NOT for bulk edit (in bulk edit, empty fields mean "don't change")
    if (!bulkEditMode && !f.assetName && !f.brand && !f.model) {
      setSaveError('Please provide at least Asset Name, Brand, or Model');
      setTimeout(() => setSaveError(null), 3000);
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      // If caller provided an override handler (edit mode), use it and skip default upsert
      // In edit mode, pass ONLY the editable fields, not a new asset record
      if (onSaveOverride) {
        console.log('✅ [CreateAsset onSave] EDIT MODE - calling onSaveOverride');
        console.log('✅ [CreateAsset onSave] Passing form fields:', f);
        try {
          // Pass just the form fields - the override handler will merge with existing asset
          await onSaveOverride(f as AssetRecord);
          console.log('✅ [CreateAsset onSave] onSaveOverride completed successfully');
          setSaveSuccess(true);
          setTimeout(() => setSaveSuccess(false), 1800);
          setIsSaving(false);
          return;
        } catch (err) {
          console.error('[CreateAsset] onSaveOverride failed', err);
          setSaveError('Failed to save asset via override');
          setTimeout(() => setSaveError(null), 3000);
          setIsSaving(false);
          return;
        }
      }

      // CREATE MODE: Build a new asset record
      console.log('🆕 [CreateAsset onSave] CREATE MODE - building new MANUAL asset');
      const rec: AssetRecord = {
        ...f as AssetRecord,
        id: `asset-${Date.now()}`,
        dbId: null,
        source: 'MANUAL',
        // Condition must be explicitly selected - no default fallback
        condition: f.condition || undefined
      };

      console.log('🔍 [CreateAsset] Form data being saved:', f);
      console.log('🔍 [CreateAsset] Asset record being created:', rec);

      // Safety: if in edit mode but no override provided, do NOT create a new asset
      if (mode === 'edit' && !onSaveOverride) {
        console.warn('[CreateAsset] Edit mode without onSaveOverride - blocking create to avoid duplicates');
        setSaveError('Cannot save edit at the moment. Please retry.');
        setTimeout(() => setSaveError(null), 3000);
        setIsSaving(false);
        return;
      }

      // Save to backend if projectId is available
      if (projectId) {
        console.log(`💾 [CreateAsset] Saving asset to backend for project: ${projectId}`, rec);
        try {
          const res = await fetch(`/api/projects/${projectId}/assets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(rec)
          });

          if (res.ok) {
            const result = await res.json();
            console.log('✅ [CreateAsset] Asset saved to backend successfully:', result);

            // Merge backend response with original record to preserve all form data
            const backendAsset = result?.asset || result || {};
            const savedAsset = {
              ...rec, // Keep all form data
              ...backendAsset, // Override with backend fields (id, timestamps, etc.)
              id: backendAsset.id || backendAsset._id || rec.id // Ensure we have an ID
            };

            console.log('🔄 [CreateAsset] Merged asset for display:', savedAsset);

            setRows(prev => [savedAsset, ...prev]);

            // Also update localStorage to sync with AssetList
            const currentAssets = load(K.assets(projectId), [] as AssetRecord[]);
            const updatedAssets = [savedAsset, ...currentAssets.filter(a => a.id !== savedAsset.id)];
            save(K.assets(projectId), updatedAssets);

            // Show success message
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);

            // Dispatch custom event to notify AssetList
            window.dispatchEvent(new CustomEvent('asset-created'));
          } else {
            const errorText = await res.text();
            console.error('❌ [CreateAsset] Backend save failed:', res.status, errorText);
            throw new Error(`Save failed: ${res.status}`);
          }
        } catch (backendError) {
          console.error('❌ [CreateAsset] Backend error, falling back to local storage:', backendError);
          // Fallback to local storage
          setRows(prev => [rec, ...prev]);

          // Update localStorage to sync with AssetList
          const currentAssets = load(K.assets(projectId), [] as AssetRecord[]);
          const updatedAssets = [rec, ...currentAssets.filter(a => a.id !== rec.id)];
          save(K.assets(projectId), updatedAssets);

          setSaveError('Saved locally (backend unavailable)');
          setTimeout(() => setSaveError(null), 3000);

          // Dispatch custom event to notify AssetList
          window.dispatchEvent(new CustomEvent('asset-created'));
        }
      } else {
        // No projectId, save locally only
        console.log('💾 [CreateAsset] No projectId, saving locally only', rec);
        setRows(prev => [rec, ...prev]);

        // Update localStorage to sync with AssetList
        const currentAssets = load(K.assets(projectId), [] as AssetRecord[]);
        const updatedAssets = [rec, ...currentAssets.filter(a => a.id !== rec.id)];
        save(K.assets(projectId), updatedAssets);

        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);

        // Dispatch custom event to notify AssetList
        window.dispatchEvent(new CustomEvent('asset-created'));
      }

      // Clear draft after successful save - DISABLED per user request to retain values for next asset
      /*
      const emptyForm = {
        category: '', type: '', brand: '', model: '', description: '', location: '',
        assetCode: '', assetName: '', serialNumber: '', installationDate: '',
        material: '', dimensions: '', weight: '', capacity: '', powerRating: '',
        manuals: '', warranties: '', certifications: '',
        condition: '', serviceDate: '', expectedLife: '',
        maintenanceSchedule: '', lastService: '', nextService: '',
        purchaseCost: '', maintenanceCost: '',
        regulations: '', safetyNotes: '',
        parentAsset: '', suppliers: ''
      };
      setF(emptyForm);
      save(`fm-create-asset-draft-${projectId || 'global'}`, emptyForm);
      */

    } catch (error) {
      console.error('❌ [CreateAsset] Save error:', error);
      setSaveError('Failed to save asset. Please try again.');
      setTimeout(() => setSaveError(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const sections = [
    { key: 'identification' as const, label: 'Identification & Registry' },
    { key: 'technical' as const, label: 'Technical & Construction' },
    { key: 'documentation' as const, label: 'Documentation' },
    { key: 'lifecycle' as const, label: 'Status & Lifecycle' },
    { key: 'economic' as const, label: 'Economic Aspects' },
    { key: 'compliance' as const, label: 'Compliance & Safety' },
    { key: 'relationships' as const, label: 'Links & Relationships' },
    { key: 'qr' as const, label: 'Create - View QR Code' }
  ];

  const updateField = (key: keyof AssetRecord, value: string) => {
    setF(v => ({ ...v, [key]: value }));
  };

  // Use Revit categories from REVIT_CATEGORIES (same as Asset List filter dropdown)
  const categoryOptions: string[] = React.useMemo(() => {
    return REVIT_CATEGORIES;
  }, []);

  const mapToStandardCategory = (category?: string): string | undefined => {
    if (!category) return undefined;
    // Strip 'Revit' prefix if present
    const stripped = stripRevitPrefix(category);
    if (!stripped) return category;
    
    // Try to find exact match in REVIT_CATEGORIES (case-insensitive)
    const cat = stripped.toLowerCase();
    const match = REVIT_CATEGORIES.find(rc => rc.toLowerCase() === cat);
    if (match) return match;
    
    // Try partial match
    const partialMatch = REVIT_CATEGORIES.find(rc => rc.toLowerCase().includes(cat) || cat.includes(rc.toLowerCase()));
    return partialMatch || category;
  };

  const qrImageUrl = (code?: string, size = 400) => {
    if (!code) return '';
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(code)}`;
  };

  const generateQr = async () => {
    if (f.qrCode) return; // already generated
    try {
      const code = (typeof crypto !== 'undefined' && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : `qr-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
      const generatedAt = new Date().toISOString();
      setF(v => ({ ...v, qrCode: code, qrGeneratedAt: generatedAt }));

      // If caller provided an override (edit mode), persist immediately
      if (onSaveOverride) {
        setIsSaving(true);
        try {
          await onSaveOverride({ qrCode: code, qrGeneratedAt: generatedAt } as AssetRecord);
          setSaveSuccess(true);
          setTimeout(() => setSaveSuccess(false), 2200);
        } catch (err) {
          console.error('❌ [CreateAsset] QR save failed', err);
          setSaveError('Failed to persist QR code');
          setTimeout(() => setSaveError(null), 3000);
        } finally {
          setIsSaving(false);
        }
      }
    } catch (e) {
      console.error('❌ [CreateAsset] generateQr error', e);
      setSaveError('Failed to generate QR');
      setTimeout(() => setSaveError(null), 3000);
    }
  };

  const exportQrPdf = () => {
    if (!f.qrCode) return;
    const url = qrImageUrl(f.qrCode, 800);
    const title = f.assetName || 'asset-qr';
    const w = window.open('', '_blank') as Window | null;
    if (!w) return;
    const html = `<!doctype html><html><head><title>${title}</title><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body style="display:flex;flex-direction:column;align-items:center;justify-content:center;margin:0;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#111;background:#fff;">` +
      `<h3 style="margin-bottom:8px;">${title}</h3>` +
      `<img src="${url}" style="width:360px;height:360px;object-fit:contain;border:1px solid #ddd;padding:8px;background:#fff;"/>` +
      `<div style="margin-top:12px;font-size:12px;color:#444;">QR: ${f.qrCode}</div>` +
      `</body></html>`;
    w.document.open();
    w.document.write(html);
    w.document.close();
    // Give it a moment to render then trigger print
    setTimeout(() => {
      try { w.print(); } catch (e) { console.warn('Print failed', e); }
    }, 500);
  };

  // Prefill from current model selection
  const prefillFromSelection = async () => {
    try {
      if (!viewer) {
        // Fallback: prefill from stored context when viewer is not available (standalone window)
        try {
          const raw = projectId ? localStorage.getItem(`fm-prefill-${projectId}`) : null;
          if (raw) {
            const snap = JSON.parse(raw || '{}') as Partial<AssetRecord>;
            setF(v => ({ ...v, ...snap }));
            return;
          }
        } catch {}
        return;
      }
      const getAgg = () => new Promise<any>((resolve) => viewer.getAggregateSelection ? viewer.getAggregateSelection(resolve) : resolve(null));
      let dbId: number | undefined; let model: any = viewer.model;
      const agg = await getAgg();
      if (agg && agg.length > 0 && agg[0].selection?.length > 0) { dbId = agg[0].selection[0]; model = agg[0].model; }
      else { const sel = viewer.getSelection?.(); if (sel && sel.length > 0) dbId = sel[0]; }
      if (dbId == null || !model) return;
      const props: any = await new Promise(resolve => model.getProperties(dbId!, resolve));
      const propArray: any[] = Array.isArray(props?.properties) ? props.properties : [];

      // Flatten properties for easier multilingual lookups
      const propsMap: Record<string, any> = {};
      const propsLower: Record<string, any> = {};
      for (const prop of propArray) {
        const name = (prop?.displayName ?? '').toString();
        if (!name) continue;
        const value = prop?.displayValue;
        propsMap[name] = value;
        propsLower[name.toLowerCase().trim()] = value;
      }

      const pick = (...keys: string[]): string | undefined => {
        for (const key of keys) {
          const direct = propsMap[key];
          if (direct !== undefined && direct !== null && direct !== '') return direct.toString();
          const lk = key.toLowerCase().trim();
          const lowerVal = propsLower[lk];
          if (lowerVal !== undefined && lowerVal !== null && lowerVal !== '') return lowerVal.toString();
        }
        return undefined;
      };

      // Accept a broad set of property display names (English + Italian + common variants)
      const PROP_ALIASES: Record<string, string[]> = {
        brand: ['Manufacturer', 'Brand', 'Manufacturer Name', 'Produttore', 'Marca'],
        modelName: ['Model', 'Modello'],
        serial: ['Serial Number', 'Serial', 'Numero di serie'],
        elementId: ['ElementId', 'Element Id', 'ElementId', 'ID'],
        ifcGuid: ['IfcGUID', 'IFC GUID', 'IFC GlobalId', 'GlobalId'],
        ifcClass: ['IfcClass', 'IFC Class', 'Classe IFC', 'Esporta tipo in formato IFC con nome', 'Tipo: Tipo predefinito IFC'],
        installDate: ['Install Date', 'Installation Date', 'Data di installazione'],
        power: ['Power', 'Power Rating', 'kW', 'Dati elettrici', 'Alimentazione apparente'],
        capacity: ['Capacity', 'Capacità'],
        weight: ['Weight', 'Peso'],
        length: ['Length', 'Lunghezza'],
        width: ['Width', 'Larghezza'],
        height: ['Height', 'Thickness', 'Altezza'],
        material: ['Material', 'Structural Material', 'Materiale', 'Materiale strutturale'],
        level: [
          'Schedule Level', 'Livello abaco',
          'Base Level', 'Reference Level',
          'Livello di base', 'Livello superiore',
          'Vincolo di base', 'Vincolo parte superiore',
          'Base Constraint', 'Top Constraint', 'Constraint', 'Vincolo',
          'Livello', 'Level', 'Piano', 'Piano Terra', 'Level 1'
        ],
        room: ['Room', 'Space', 'Stanza', 'Locale', 'Space Code'],
        rawCategory: ['Category', 'Categoria', 'Type', 'Tipo', 'Nome del tipo', 'Category Name'],
        assetCode: ['Asset Code', 'Codice Asset', 'Codice Bene', 'Sigla'],
        projectCode: ['Project Code', 'Codice Progetto', 'Project Number', 'Numero Progetto', 'Commessa']
      };

      const pickAlias = (key: keyof typeof PROP_ALIASES) => pick(...PROP_ALIASES[key]);

      const brand = pickAlias('brand') || 'Unknown';
      const modelName = pickAlias('modelName') || 'Unknown';
      const serial = pickAlias('serial');
      const elementId = pickAlias('elementId');
      const ifcGuid = pickAlias('ifcGuid');
      const ifcClass = pickAlias('ifcClass');
      const installDate = pickAlias('installDate');
      const power = pickAlias('power');
      const capacity = pickAlias('capacity');
      const weight = pickAlias('weight');
      const length = pickAlias('length');
      const width = pickAlias('width');
      const height = pickAlias('height');
      const material = pickAlias('material');
      // Level needs to fall back to raw pick directly (prefers descriptive fields)
      const level = pickAlias('level');
      const room = pickAlias('room');

      // Asset Code Logic
      console.log(`🔍 [CreateAsset Prefill] Processing selection - model available: ${!!model}`);
      
      let assetCode = pickAlias('assetCode');
      console.log(`   ✅ Step 1 - Asset Code from parameter: ${assetCode || '(not found)'}`);

      if (!assetCode) {
        // Priority 2: Compute from Project Code + Floor Level
        let projectCode = pickAlias('projectCode');
        console.log(`   ✅ Step 2 - Project Code from element: ${projectCode || '(not found)'}`);

        // If not found on element, try to find in Project Information
        if (!projectCode) {
          console.log(`   🔎 Step 3 - Searching for Project Information in model...`);
          try {
            const projectInfoIds = await new Promise<number[]>((resolve) => {
              model.search('Project Information', resolve, () => resolve([]), ['Category']);
            });
            
            console.log(`   🔎 Found ${projectInfoIds.length} Project Information element(s)`);
            
            if (projectInfoIds && projectInfoIds.length > 0) {
              const pProps: any = await new Promise(resolve => model.getProperties(projectInfoIds[0], resolve));
              if (pProps && pProps.properties) {
                const pMap: any = {};
                pProps.properties.forEach((p: any) => { if(p.displayName) pMap[p.displayName] = p.displayValue; });
                
                console.log(`   🔎 Project Information properties found:`, Object.keys(pMap).join(', '));
                
                for (const k of PROP_ALIASES.projectCode) {
                  if (pMap[k]) {
                    projectCode = pMap[k];
                    console.log(`   ✅ Found Project Code in Project Information: ${projectCode} (key: ${k})`);
                    break;
                  }
                }
              }
            }
          } catch (e) { 
            console.error('   ❌ Error fetching Project Info', e); 
          }
        }

        console.log(`   ✅ Step 4 - Final Project Code: ${projectCode || '(not found)'}`);
        console.log(`   ✅ Step 5 - Level string: ${level || '(not found)'}`);

        if (projectCode && level) {
          // Parse level code
          // 0 - Piano Terra -> 00
          // 1 - Piano Primo -> 01
          // -1 - Piano Interrato -> G1
          let levelCode = '';
          const match = level.match(/^(-?\d+)/);
          if (match) {
            const num = parseInt(match[1], 10);
            console.log(`   ✅ Step 6 - Extracted level number: ${num}`);
            if (num >= 0) {
              levelCode = num.toString().padStart(2, '0');
            } else {
              levelCode = `G${Math.abs(num)}`;
            }
            console.log(`   ✅ Step 7 - Level code generated: ${levelCode}`);
          } else {
            console.log(`   ⚠️ Step 6 - Could not extract level number from: "${level}"`);
          }

          if (levelCode) {
            assetCode = `${projectCode}-${levelCode}`;
            console.log(`   ✅ Step 8 - Final Asset Code computed: ${assetCode}`);
          }
        } else {
          if (!projectCode) console.log(`   ⚠️ Cannot compute Asset Code - Project Code missing`);
          if (!level) console.log(`   ⚠️ Cannot compute Asset Code - Level missing`);
        }
      }

      // Fallback
      if (!assetCode) {
        assetCode = '@';
        console.log(`   ⚠️ Step 9 - Fallback to '@' - no code could be determined`);
      }

      console.log(`   ✅ FINAL Asset Code: ${assetCode}\n`);

      const rawCategory = pickAlias('rawCategory') || pick('Category', 'Categoria', 'OmniClass Title', 'OmniClass', 'Tipo');
      const category = mapToStandardCategory(rawCategory);
      const dimensions = (length || width || height) ? `${length || ''} x ${width || ''} x ${height || ''}`.replace(/\s+x\s+x\s+/, '').trim() : undefined;

      setF(v => ({
        ...v,
        // Replace with new selection data (clear fields if not present in new selection)
        brand: brand,
        model: modelName,
        assetCode: assetCode || '@',
        serialNumber: serial || '',
        elementId: elementId || '',
        ifcGuid: ifcGuid || '',
        ifcClass: ifcClass || '',
        installationDate: installDate || '',
        powerRating: power || '',
        capacity: capacity || '',
        weight: weight || '',
        dimensions: dimensions || '',
        material: material || '',
        location: [level, room].filter(Boolean).join(' - ') || '',
        category: category || '',
        description: 'Asset extracted from BIM model'
      }));
    } catch { }
  };

  // Clear all form fields (Create New Asset)
  const clearForm = () => {
    const emptyForm = {
      category: '', type: '', brand: '', model: '', description: '', location: '',
      assetCode: '', assetName: '', serialNumber: '', installationDate: '', elementId: '', ifcGuid: '', ifcClass: '',
      material: '', dimensions: '', weight: '', capacity: '', powerRating: '',
      manuals: '', warranties: '', certifications: '',
      condition: '', serviceDate: '', expectedLife: '',
      maintenanceSchedule: '', lastService: '', nextService: '',
      purchaseCost: '', maintenanceCost: '',
      regulations: '', safetyNotes: '',
      parentAsset: '', suppliers: ''
    } as Partial<AssetRecord>;
    setF(emptyForm);
    save(`fm-create-asset-draft-${projectId || 'global'}`, emptyForm);
  };

  // Standalone auto-prefill on mount if viewer is not present
  useEffect(() => {
    if (!viewer) {
      // Try immediately from local snapshot; if empty, nothing happens
      prefillFromSelection();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);



  return (
    <div className="p-3 space-y-3 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div className="text-white font-semibold text-sm">{title || (mode === 'edit' ? 'Edit Asset' : 'Create New Asset')}</div>
        <div className="flex items-center gap-2">
          {mode !== 'edit' && (
            <button
              className="text-[11px] px-2 py-1 rounded border border-gray-700 bg-gray-800/60 hover:bg-gray-700 text-gray-200"
              onClick={clearForm}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Bulk Edit Notification */}
      {bulkEditMode && (
        <div className="px-2 py-2 bg-blue-900/40 border border-blue-700 rounded text-blue-200 text-xs">
          
          <div>Fields left empty will not be changed. Asset Code and Asset Name cannot be bulk edited.</div>
        </div>
      )}

      {/* Section selector */}
      <div className="flex gap-1 overflow-x-auto pb-2">
        {sections.map(sec => (
          <button
            key={sec.key}
            onClick={() => setActiveSection(sec.key)}
            className={`text-xs px-2 py-1 rounded whitespace-nowrap ${activeSection === sec.key
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
          >
            {sec.label}
          </button>
        ))}
      </div>

      {/* Fields by section */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {activeSection === 'identification' && (
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-[11px] text-gray-300 block mb-1">Discipline</label>
              <select value={f.assetClassification || ''} onChange={e => updateField('assetClassification', e.target.value as any)} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs">
                <option value="">Select discipline</option>
                <option value="ARCHITECTURAL">Architecture</option>
                <option value="STRUCTURAL">Structure</option>
                <option value="MEP">Mechanical System</option>
                <option value="MEP">Electrical System</option>
                <option value="MEP">Plumbing System</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div><label className="text-[11px] text-gray-300 block mb-1">Category</label>
              <select value={f.category || ''} onChange={e => updateField('category', e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs">
                <option value="">Select category</option>
                {f.category && !categoryOptions.includes(f.category) && (
                  <option key={f.category} value={f.category}>{f.category} (current)</option>
                )}
                {categoryOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
            <div><label className="text-[11px] text-gray-300 block mb-1">Asset Name {bulkEditMode && <span className="text-red-400"></span>}</label><input disabled={bulkEditMode} placeholder="Description attribute" value={f.assetName || ''} onChange={e => updateField('assetName', e.target.value)} className={`w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs ${bulkEditMode ? 'opacity-50 cursor-not-allowed' : ''}`} /></div>
            <div><label className="text-[11px] text-gray-300 block mb-1">Asset Code</label><input disabled={bulkEditMode} value={f.assetCode || ''} onChange={e => updateField('assetCode', e.target.value)} className={`w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs ${bulkEditMode ? 'opacity-50 cursor-not-allowed' : ''}`} /></div>
            <div><label className="text-[11px] text-gray-300 block mb-1">BIM ID (ElementId)</label><input disabled={bulkEditMode} value={f.elementId || ''} onChange={e => updateField('elementId' as any, e.target.value)} placeholder="Unique BIM Element ID" className={`w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs ${bulkEditMode ? 'opacity-50 cursor-not-allowed' : ''}`} /></div>
            <div><label className="text-[11px] text-gray-300 block mb-1">IFC GUID</label><input disabled={bulkEditMode} value={f.ifcGuid || ''} onChange={e => updateField('ifcGuid', e.target.value)} placeholder="IFC Global ID" className={`w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs ${bulkEditMode ? 'opacity-50 cursor-not-allowed' : ''}`} /></div>
            <div><label className="text-[11px] text-gray-300 block mb-1">Brand</label><input placeholder="Manufacturer attribute (default: Unknown)" value={f.brand || ''} onChange={e => updateField('brand', e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" /></div>
            <div><label className="text-[11px] text-gray-300 block mb-1">Model</label><input placeholder="Model attribute (default: Unknown)" value={f.model || ''} onChange={e => updateField('model', e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" /></div>
            <div><label className="text-[11px] text-gray-300 block mb-1">Type</label><input value={f.type || ''} onChange={e => updateField('type', e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" /></div>
            <div><label className="text-[11px] text-gray-300 block mb-1">Ifc Class</label>
              <select value={f.ifcClass || ''} onChange={e => updateField('ifcClass', e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs">
                <option value="">Select Ifc Class</option>
                {f.ifcClass && !IFCCLASSES_UNIQUE.includes(f.ifcClass) && (
                  <option key={f.ifcClass} value={f.ifcClass}>{f.ifcClass} (current)</option>
                )}
                {IFCCLASSES_UNIQUE.map(ic => <option key={ic} value={ic}>{ic}</option>)}
              </select>
            </div>
            <div><label className="text-[11px] text-gray-300 block mb-1">Serial Number</label><input value={f.serialNumber || ''} onChange={e => updateField('serialNumber', e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" /></div>
            <div><label className="text-[11px] text-gray-300 block mb-1">Installation Date</label><input type="date" value={f.installationDate || ''} onChange={e => updateField('installationDate', e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" /></div>
            <div className="col-span-2"><label className="text-[11px] text-gray-300 block mb-1">Description</label><textarea value={f.description || ''} onChange={e => updateField('description', e.target.value)} placeholder="Asset extracted from BIM model" className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" rows={2} /></div>
          </div>
        )}

        {activeSection === 'technical' && (
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-[11px] text-gray-300 block mb-1">Material</label><input value={f.material || ''} onChange={e => updateField('material', e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" /></div>
            <div><label className="text-[11px] text-gray-300 block mb-1">Dimensions</label><input value={f.dimensions || ''} onChange={e => updateField('dimensions', e.target.value)} placeholder="L x W x H" className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" /></div>
            <div><label className="text-[11px] text-gray-300 block mb-1">Weight</label><input value={f.weight || ''} onChange={e => updateField('weight', e.target.value)} placeholder="kg" className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" /></div>
            <div><label className="text-[11px] text-gray-300 block mb-1">Capacity</label><input value={f.capacity || ''} onChange={e => updateField('capacity', e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" /></div>
            <div className="col-span-2"><label className="text-[11px] text-gray-300 block mb-1">Power Rating</label><input value={f.powerRating || ''} onChange={e => updateField('powerRating', e.target.value)} placeholder="kW" className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" /></div>
          </div>
        )}

        {activeSection === 'documentation' && (
          <div className="grid grid-cols-1 gap-2">
            <div>
              <label className="text-[11px] text-gray-300 block mb-1">Manuals</label>
              <div className="space-y-2">
                <input 
                  type="file" 
                  multiple 
                  onChange={async (e) => { 
                    const files = e.target.files; 
                    if (files && projectId) {
                      try {
                        const fileNames: string[] = [];
                        
                        // Upload each file
                        for (const file of Array.from(files)) {
                          const formData = new FormData();
                          formData.append('file', file);
                          
                          const response = await fetch(`/api/projects/${projectId}/files`, {
                            method: 'POST',
                            body: formData
                          });
                          
                          if (response.ok) {
                            const fileRecord = await response.json();
                            fileNames.push(file.name);
                            console.log(`✅ Uploaded file: ${file.name}`);
                          } else {
                            console.error(`Failed to upload ${file.name}`);
                          }
                        }
                        
                        if (fileNames.length > 0) {
                          updateField('manuals', fileNames.join(', '));
                        }
                      } catch (err) {
                        console.error('Error uploading files:', err);
                      }
                      // Reset input so user can upload same file again if needed
                      e.target.value = '';
                    }
                  }} 
                  placeholder="Select one or more files" 
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" 
                />
                {f.manuals && (
                  <div className="bg-gray-700/40 border border-gray-600 rounded px-2 py-1.5 text-[11px] text-gray-300">
                    <div className="font-semibold text-gray-400 mb-1">Uploaded files:</div>
                    <div className="text-gray-400 whitespace-pre-wrap break-words">{f.manuals}</div>
                    <button
                      type="button"
                      onClick={() => updateField('manuals', '')}
                      className="mt-2 text-xs text-red-400 hover:text-red-300 underline"
                    >
                      Clear files
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div><label className="text-[11px] text-gray-300 block mb-1">Warranties</label><input value={f.warranties || ''} onChange={e => updateField('warranties', e.target.value)} placeholder="Expiry date / terms" className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" /></div>
            <div><label className="text-[11px] text-gray-300 block mb-1">Certifications</label><input value={f.certifications || ''} onChange={e => updateField('certifications', e.target.value)} placeholder="ISO, CE, etc." className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" /></div>
          </div>
        )}

        {activeSection === 'lifecycle' && (
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-[11px] text-gray-300 block mb-1">Condition</label>
              <select value={f.condition || ''} onChange={e => updateField('condition', e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs">
                <option value="">Select</option>
                <option value="Excellent">Excellent</option>
                <option value="Good">Good</option>
                <option value="Fair">Fair</option>
                <option value="Poor">Poor</option>
                <option value="Critical">Critical</option>
              </select>
            </div>
            <div><label className="text-[11px] text-gray-300 block mb-1">Service Date</label><input type="date" value={f.serviceDate || ''} onChange={e => updateField('serviceDate', e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" /></div>
            <div className="col-span-2"><label className="text-[11px] text-gray-300 block mb-1">Expected Life</label><input value={f.expectedLife || ''} onChange={e => updateField('expectedLife', e.target.value)} placeholder="Years" className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" /></div>
          </div>
        )}

        {activeSection === 'economic' && (
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-[11px] text-gray-300 block mb-1">Purchase Cost</label><input value={f.purchaseCost || ''} onChange={e => updateField('purchaseCost', e.target.value)} placeholder="€" className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" /></div>
            <div><label className="text-[11px] text-gray-300 block mb-1">Maintenance Cost</label><input value={f.maintenanceCost || ''} onChange={e => updateField('maintenanceCost', e.target.value)} placeholder="€/year" className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" /></div>
          </div>
        )}

        {activeSection === 'compliance' && (
          <div className="grid grid-cols-1 gap-2">
            <div><label className="text-[11px] text-gray-300 block mb-1">Regulations</label><input value={f.regulations || ''} onChange={e => updateField('regulations', e.target.value)} placeholder="Regulatory requirements" className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" /></div>
            <div><label className="text-[11px] text-gray-300 block mb-1">Safety Notes</label><textarea value={f.safetyNotes || ''} onChange={e => updateField('safetyNotes', e.target.value)} placeholder="Safety precautions" className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" rows={3} /></div>
          </div>
        )}

        {activeSection === 'relationships' && (
          <div className="grid grid-cols-1 gap-2">
            <div><label className="text-[11px] text-gray-300 block mb-1">Parent Asset</label><input value={f.parentAsset || ''} onChange={e => updateField('parentAsset', e.target.value)} placeholder="Related parent asset" className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" /></div>
            <div><label className="text-[11px] text-gray-300 block mb-1">Suppliers</label><input value={f.suppliers || ''} onChange={e => updateField('suppliers', e.target.value)} placeholder="Supplier contacts" className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" /></div>
          </div>
        )}
        {activeSection === 'qr' && (
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="text-[11px] text-gray-300 block mb-1">Create / View QR Code</label>
              <div className="bg-gray-800 border border-gray-700 rounded p-3 flex flex-col items-center gap-3">
                {f.qrCode ? (
                  <>
                    <img src={qrImageUrl(f.qrCode, 400)} alt="QR Code" className="w-40 h-40 bg-white p-2" />
                    <div className="text-xs text-gray-300">Generated: {f.qrGeneratedAt ? new Date(f.qrGeneratedAt).toLocaleString() : '—'}</div>
                    <div className="flex gap-2">
                      <button className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm" onClick={exportQrPdf}>Export / Print as PDF</button>
                      <button className="px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-white text-sm" onClick={() => { const u = qrImageUrl(f.qrCode, 800); window.open(u, '_blank'); }}>Open Image</button>
                      <button className="px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-white text-sm" onClick={() => { navigator.clipboard?.writeText(String(f.qrCode)); try { (window as any).showToast?.('success', 'Code copied!'); } catch {} }}>Copy Code</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-xs text-gray-300 mb-2">No QR code generated yet. Click the button below to generate a unique, permanent QR for this asset. Once created it cannot be modified.</div>
                    <div className="flex gap-2">
                      <button disabled={isSaving} className={`px-3 py-1.5 rounded text-sm font-semibold ${isSaving ? 'bg-gray-600 text-gray-300' : 'bg-green-600 hover:bg-green-700 text-white'}`} onClick={generateQr}>{isSaving ? 'Generating...' : 'Generate QR Code'}</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Success/Error Messages */}
      {(saveSuccess || saveError) && (
        <div className={`p-3 rounded-lg border ${saveSuccess
          ? 'bg-green-500/10 border-green-500/50 text-green-400'
          : 'bg-red-500/10 border-red-500/50 text-red-400'
          }`}>
          <div className="flex items-center gap-2">
            {saveSuccess ? (
              <>
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <div className="font-semibold text-sm">Asset Created Successfully!</div>
                  <div className="text-xs mt-1 opacity-90">
                    {projectId ? 'Asset saved to project and available in Asset List' : 'Asset saved locally'}
                  </div>
                </div>
              </>
            ) : (
              <>
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <div className="font-semibold text-sm">Save Error</div>
                  <div className="text-xs mt-1 opacity-90">{saveError}</div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="border-t border-gray-800 pt-3">
        <button
          className={`w-full px-4 py-2 rounded text-sm font-semibold transition-colors ${isSaving
            ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          onClick={onSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <div className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin"></div>
              Saving Asset...
            </div>
          ) : (
            'Save Asset'
          )}
        </button>
      </div>
    </div>
  );
};

// Inline form for editing spaces
const EditSpaceFormInline: React.FC<{
  space: SpaceRecord;
  projectId?: string;
  viewer?: any;
  onSave: () => void;
  onCancel: () => void;
}> = ({ space, projectId, viewer, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    level: space.level || '',
    name: space.name || '',
    area: space.area || '',
    description: space.description || '',
    building: space.building || '',
    spaceCode: space.spaceCode || ''
  });
  const [saving, setSaving] = useState(false);

  // Attempt to prefill building from model properties (if available) or project name
  useEffect(() => {
    let cancelled = false;
    const tryPrefill = async () => {
      if (formData.building && String(formData.building).trim() !== '') return;
      // First try: read building from the BIM model properties if we have the same model loaded
      try {
        if (viewer && space && space.dbId != null) {
          const props: any = await new Promise(resolve => {
            try { viewer.getProperties(space.dbId, resolve); } catch (e) { resolve(null); }
          });
          const getProp = (names: string[]) => {
            const lower = names.map(n => n.toLowerCase());
            const p = props?.properties?.find((p: any) => {
              const dn = p.displayName?.toLowerCase?.();
              return dn && (lower.includes(dn) || lower.some(n => dn.includes(n)));
            });
            return p?.displayValue?.toString();
          };
          const b = getProp(['Building', 'Edificio', 'Building Name', 'BuildingName', 'Nome edificio', 'Nome edificio']);
          if (b && !cancelled) {
            setFormData(d => ({ ...d, building: b }));
            return;
          }
        }
      } catch (err) {
        // ignore
      }

      // Fallback: fetch project metadata and use Project Name
      try {
        if (projectId) {
          const res = await fetch(`/api/projects/${projectId}`);
          if (res.ok) {
            const json = await res.json();
            const projName = json?.project?.name || json?.name || '';
            if (projName && !cancelled) setFormData(d => ({ ...d, building: projName }));
          }
        }
      } catch (err) { /* ignore */ }
    };
    tryPrefill();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [space, projectId, viewer]);

  const handleSave = async () => {
    setSaving(true);
    try {
      console.log(`[EditSpace] Saving space ${space.id} for project ${projectId}`, formData);
      const res = await fetch(`/api/projects/${projectId}/spaces/${space.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      console.log(`[EditSpace] Response status:`, res.status);
      if (res.ok) {
        const data = await res.json();
        console.log(`[EditSpace] Space updated successfully:`, data);
        onSave();
      } else {
        const errData = await res.text();
        console.error(`[EditSpace] Update failed with status ${res.status}:`, errData);
        alert(`Failed to update space: ${res.status}`);
      }
    } catch (err) {
      console.error('[EditSpace] Error:', err);
      alert('Error updating space');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-gray-400">Building</label>
        <input 
          type="text"
          value={formData.building}
          onChange={e => setFormData(d => ({ ...d, building: e.target.value }))}
          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white placeholder-gray-500"
          placeholder="Building"
        />
      </div>
      <div>
        <label className="text-xs text-gray-400">Level</label>
        <input 
          type="text"
          value={formData.level}
          onChange={e => setFormData(d => ({ ...d, level: e.target.value }))}
          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white placeholder-gray-500"
          placeholder="Level"
        />
      </div>
      <div>
        <label className="text-xs text-gray-400">Room Name</label>
        <input 
          type="text"
          value={formData.name}
          onChange={e => setFormData(d => ({ ...d, name: e.target.value }))}
          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white placeholder-gray-500"
          placeholder="Room Name"
        />
      </div>
      <div>
        <label className="text-xs text-gray-400">Area (m²)</label>
        <input 
          type="number"
          value={formData.area}
          onChange={e => setFormData(d => ({ ...d, area: e.target.value }))}
          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white placeholder-gray-500"
          placeholder="Area"
        />
      </div>
      <div>
        <label className="text-xs text-gray-400">Space Code</label>
        <input 
          type="text"
          value={formData.spaceCode}
          onChange={e => setFormData(d => ({ ...d, spaceCode: e.target.value }))}
          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white placeholder-gray-500"
          placeholder="Space Code"
        />
      </div>
      <div>
        <label className="text-xs text-gray-400">Description</label>
        <textarea 
          value={formData.description}
          onChange={e => setFormData(d => ({ ...d, description: e.target.value }))}
          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white placeholder-gray-500 resize-none"
          placeholder="Description"
          rows={3}
        />
      </div>
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 rounded text-xs bg-gray-700 hover:bg-gray-600 text-white"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-1.5 rounded text-xs bg-blue-700 hover:bg-blue-600 text-white disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
};
