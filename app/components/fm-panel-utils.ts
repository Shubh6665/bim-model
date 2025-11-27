// FM Panel Utility Functions and Constants
import type { AssetRecord } from "./fm-panel-types";

// Fixed Revit categories list
export const REVIT_CATEGORIES: string[] = [
  'Accessori per tubazioni',
  'Accessori per condotti',
  'Apparecchi elettrici',
  'Apparecchi idraulici',
  'Apparecchi per illuminazione',
  'Aree',
  'Aree di rete strutturale',
  'Aree pavimentate e costruite',
  'Armatura strutturale',
  'Armatura su area strutturale',
  'Armatura su percorso strutturale',
  'Arredi',
  'Arredi fissi',
  'Attrezzatura elettrica',
  'Attrezzatura idraulica',
  'Attrezzatura meccanica',
  'Attrezzatura medica',
  'Attrezzatura per servizi alimentari',
  'Attrezzatura per servizi alimentazione',
  'Attrezzature speciali',
  'Bocchettoni',
  'Canaline di fabbricazione MEP',
  'Cavedi',
  'Cavi',
  'Circolazione verticale',
  'Collegamenti strutturali',
  'Collocazioni condotto',
  'Collocazioni tubazione',
  'Condotti di fabbricazione MEP',
  'Condotto',
  'Condotto flessibile',
  'Contesto',
  'Controsoffitti',
  'Dispositivi allarme incendio',
  'Dispositivi audiovisivi',
  'Dispositivi chiamata infermiera',
  'Dispositivi dati',
  'Dispositivi di comunicazione',
  'Dispositivi di controllo meccanico',
  'Dispositivi di illuminazione',
  'Dispositivi di sicurezza',
  'Dispositivi telefonici',
  'Elementi di dettaglio',
  'Estintori',
  'Finestre',
  'Fondazioni strutturali',
  'Irrigidimenti condotti di fabbricazione MEP',
  'Irrigidimenti strutturali',
  'Isolamenti condotti',
  'Isolamenti tubazioni',
  'Linee',
  'Locali',
  'Manicotti armatura strutturale',
  'Massa',
  'Modelli generici',
  'Montanti della facciata continua',
  'Muri',
  'Pannelli di facciata continua',
  'Passerelle',
  'Pavimenti',
  'Pilastri',
  'Pilastri strutturali',
  'Planimetria',
  'Porte',
  'Posti auto',
  'Protezione antincendio',
  'Raccordi condotto',
  'Raccordi passerella',
  'Raccordi tubazione',
  'Raccordi tubo protettivo',
  'Rampe inclinate',
  'Rinforzo rete strutturale',
  'Ringhiere',
  'Rivestimenti condotti',
  'Scale',
  'Segnaletica',
  'Sistemi di arredo',
  'Sistemi di facciata continua',
  'Sistemi di travi strutturali',
  'Solido topografico',
  'Staffe di fabbricazione MEP',
  'Strade',
  'Stratigrafia',
  'Strutture temporanee',
  'Telaio ausiliario MEP',
  'Telaio strutturale',
  'Tetti',
  'Topografia',
  'Travi reticolari strutturali',
  'Tubazioni',
  'Tubazioni di fabbricazione MEP',
  'Tubazioni flessibili',
  'Tubi protettivi',
  'Vani',
  'Verde',
  'Zone riscaldamento ventilazione e aria condizionata'
];

// IFC class list
export const IFCCLASSES: string[] = [
  'IfcBuildingElementProxy',
  'IfcAirTerminal',
  'IfcAlarmType',
  'IfcAssembly',
  'IfcAudioVisualAppliance',
  'IfcBeam',
  'IfcBuildingElementPart',
  'IfcBuildingElementProxy',
  'IfcBuildingStorey',
  'IFCCableCarrierFitting',
  'IFCCableCarrierFittingType',
  'IFCCableCarrierSegment',
  'IfcColumn',
  'IfcController',
  'IfcCovering',
  'IfcCurtainWall',
  'IfcDoor',
  'IfcDuctFitting',
  'IfcDuctSegment',
  'IfcElectricApplianceType',
  'IfcElementAssembly',
  'IfcFireSuppressionTerminalType',
  'IfcFlowTerminal',
  'IfcFurniture',
  'IfcGeographicElement',
  'IfcGrid',
  'IfcGroup',
  'IfcLightFixtureType',
  'IfcMechanicalFastener',
  'IfcMedicalDevice',
  'IfcMember',
  'IfcOpeningElement',
  'IfcPipeFitting',
  'IfcPipeSegment',
  'IfcPlate',
  'IfcRailing',
  'IfcRamp',
  'IfcReinforcementMesh',
  'IfcReinforcingBar',
  'IfcReinforcingMesh',
  'IfcRoof',
  'IfcSite',
  'IfcSlab',
  'IfcSpace',
  'IfcSpaceHeater',
  'IfcStair',
  'IfcSwitchingDeviceType',
  'IfcSystemFurnitureElement',
  'IfcTransportElement',
  'IfcValveType',
  'IfcWall',
  'IfcWindow',
  'IfcZone'
];

// Ensure unique IFC class entries
export const IFCCLASSES_UNIQUE = Array.from(new Set(IFCCLASSES));

// Fields users are allowed to edit
export const EDITABLE_FIELDS: (keyof AssetRecord)[] = [
  'assetCode','assetName','category','type','brand','model','serialNumber','installationDate','elementId',
  'material','dimensions','weight','capacity','powerRating','location','description',
  'condition','serviceDate','expectedLife','maintenanceSchedule','lastService','nextService',
  'purchaseCost','maintenanceCost','manuals','warranties','certifications','regulations','safetyNotes',
  'ifcGuid','ifcClass','ifcType','ifcPredefined'
];

// Fields that can be explicitly cleared (null) when an asset is converted to MANUAL
export const CLEARABLE_FIELDS: (keyof AssetRecord)[] = [
  'dbId','modelGuid','modelId','ifcGuid','ifcClass','ifcType','ifcPredefined','conflictWithId','linkedAssetId'
];

// Storage keys
export const K = {
  assets: (pid?: string) => `fm-assets-${pid || 'global'}`,
  spaces: (pid?: string) => `fm-spaces-${pid || 'global'}`,
  scheduled: (pid?: string) => `fm-scheduled-${pid || 'global'}`,
  tickets: (pid?: string) => `fm-tickets-${pid || 'global'}`,
  workOrders: (pid?: string) => `fm-workorders-${pid || 'global'}`,
  serviceRequests: (pid?: string) => `fm-servicereq-${pid || 'global'}`,
  reports: (pid?: string) => `fm-reports-${pid || 'global'}`,
  upcoming: (pid?: string) => `fm-upcoming-${pid || 'global'}`,
  ongoing: (pid?: string) => `fm-ongoing-${pid || 'global'}`,
  planned: (pid?: string) => `fm-planned-${pid || 'global'}`,
  uiSection: (pid?: string) => `fm-ui-section-${pid || 'global'}`,
};

// Cache interface
interface CachedData<T> {
  version: number;
  timestamp: number;
  data: T;
}

const CACHE_VERSION = 1;

// Helper: remove any leading 'Revit' prefix from category strings for UI display
export function stripRevitPrefix(s?: string | null) {
  if (!s) return s;
  try {
    return String(s).replace(/^\s*revit\s*[:\-–—]?\s*/i, '').trim();
  } catch { return s; }
}

// Whitelist: Only cache UI state, NOT large data arrays
const CACHEABLE_KEYS = [
  'fm-ui-section',        // Current section selection
  'fm-context',           // Viewer context (modelGuid, urn)
  'fm-prefill',           // Pre-fill data for forms
  'fm-assets-page'        // Pagination state only
];

// Check if a key should be cached
function shouldCache(key: string): boolean {
  return CACHEABLE_KEYS.some(pattern => key.includes(pattern));
}

// Load from localStorage - ONLY for whitelisted UI state
export function load<T>(key: string, def: T): T {
  if (typeof window === 'undefined') return def;
  
  // If not in whitelist, return default (fetch from DB instead)
  if (!shouldCache(key)) {
    return def;
  }
  
  try {
    const v = localStorage.getItem(key);
    if (!v) return def;
    
    const cached = JSON.parse(v) as CachedData<T>;
    
    // Validate cache version
    if (cached.version !== CACHE_VERSION) {
      localStorage.removeItem(key);
      return def;
    }
    
    return cached.data as T;
  } catch (e) {
    console.error(`❌ [Cache] Load error for ${key}:`, e);
    return def;
  }
}

// Save to localStorage - ONLY for whitelisted UI state
export function save<T>(key: string, val: T) {
  if (typeof window === 'undefined') return;
  
  // Block caching of large data arrays
  if (!shouldCache(key)) {
    // Silently skip - data will be fetched from DB
    return;
  }
  
  try {
    const cached: CachedData<T> = {
      version: CACHE_VERSION,
      timestamp: Date.now(),
      data: val
    };
    const serialized = JSON.stringify(cached);
    
    // Safety check: Don't cache if > 50KB (UI state should be tiny)
    if (serialized.length > 51200) {
      console.warn(`⚠️ [Cache] Skipping ${key} - too large (${(serialized.length / 1024).toFixed(1)}KB)`);
      return;
    }
    
    localStorage.setItem(key, serialized);
  } catch (e) {
    // Silently fail - not critical for functionality
    if (e instanceof Error && e.message.includes('quota')) {
      console.warn(`⚠️ [Cache] Storage full - skipping cache for ${key}`);
    }
  }
}

// Manual cache clear function for admin/debug
export function clearAssetCache(projectId?: string) {
  if (typeof window === 'undefined') return;
  try {
    if (projectId) {
      localStorage.removeItem(K.assets(projectId));
      console.log(`✅ [Cache] Cleared assets for project: ${projectId}`);
    } else {
      // Clear all FM cache
      const keys = Object.keys(localStorage).filter(k => k.includes('fm-') || k.includes('assets'));
      keys.forEach(k => localStorage.removeItem(k));
      console.log(`✅ [Cache] Cleared all FM cache (${keys.length} items)`);
    }
  } catch (e) {
    console.error('❌ [Cache] Clear error:', e);
  }
}

// Make cache clear available in console
if (typeof window !== 'undefined') {
  (window as any).clearAssetCache = clearAssetCache;
}

// Helper function to pick only editable fields from an asset record
export function pickEditable(r: Partial<AssetRecord>): Partial<AssetRecord> {
  const out: Partial<AssetRecord> = {};
  for (const k of EDITABLE_FIELDS) {
    const v = (r as any)[k];
    if (v !== undefined) (out as any)[k] = v as any;
  }
  return out;
}
