
"use client";

import React, { useEffect, useState, useRef } from "react";
import MaintenanceReport from "./fm-maintenance-report";
import PdfViewer from "./pdf-viewer";
import { WorkOrderItem as WOType } from "./fm-panel-types";
import { X, Minimize2, ExternalLink, Building2, Square, Wrench, ClipboardList, CalendarClock, Package } from "lucide-react";
import { APSAssetExtractor, type APSAsset } from '../services/aps-asset-extractor';
import { ViewerLeafAssetExtractor, type ViewerAsset } from '../services/viewer-leaf-asset-extractor';
import { CATEGORY_MAPPING } from "../services/asset-extraction-service";

// Fixed Revit categories list (module-level so it can be reused across this component)
const REVIT_CATEGORIES: string[] = [
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

  // Helper: remove any leading 'Revit' prefix from category strings for UI display
  function stripRevitPrefix(s?: string | null) {
    if (!s) return s;
    try {
      return String(s).replace(/^\s*revit\s*[:\-–—]?\s*/i, '').trim();
    } catch { return s; }
  }

// Fields users are allowed to edit and that must always win during backend merges
const EDITABLE_FIELDS: (keyof AssetRecord)[] = [
  'assetCode','assetName','category','type','brand','model','serialNumber','installationDate','elementId',
  'material','dimensions','weight','capacity','powerRating','location','description',
  'condition','serviceDate','expectedLife','maintenanceSchedule','lastService','nextService',
  'purchaseCost','maintenanceCost','manuals','warranties','certifications','regulations','safetyNotes',
  'ifcGuid','ifcClass','ifcType','ifcPredefined'
];

  // Fields that can be explicitly cleared (null) when an asset is converted to MANUAL
  const CLEARABLE_FIELDS: (keyof AssetRecord)[] = [
    'dbId','modelGuid','modelId','ifcGuid','ifcClass','ifcType','ifcPredefined','conflictWithId','linkedAssetId'
  ];

  // IFC class list (provided)
const IFCCLASSES: string[] = [
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

// Ensure unique IFC class entries to avoid duplicate React keys
const IFCCLASSES_UNIQUE = Array.from(new Set(IFCCLASSES));

// Extended models
interface FMPanelProps { projectId?: string; viewer?: any; standalone?: boolean; initialSection?: Section | null }

// Extended Asset Record with all fields from asset_register_facility_manager_template_extended
interface AssetRecord {
  id: string;
  // Identification and Registry
  assetCode?: string;
  assetName?: string;
  category?: string;
  type?: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  installationDate?: string;
  elementId?: string;  // BIM Element ID
  // Classification (from universal extractor)
  assetClassification?: 'STRUCTURAL' | 'ARCHITECTURAL' | 'MEP' | 'FURNITURE' | 'EQUIPMENT' | 'OTHER';
  // Technical and Construction Data
  material?: string;
  dimensions?: string;
  weight?: string;
  capacity?: string;
  powerRating?: string;
  // Documentation
  manuals?: string;
  warranties?: string;
  certifications?: string;
  // Status and Lifecycle
  condition?: string;
  serviceDate?: string;
  expectedLife?: string;
  // Maintenance Management
  maintenanceSchedule?: string;
  lastService?: string;
  nextService?: string;
  // Economic Aspects
  purchaseCost?: string;
  maintenanceCost?: string;
  // Compliance and Safety
  regulations?: string;
  safetyNotes?: string;
  // Links and Relationships
  parentAsset?: string;
  location?: string;
  suppliers?: string;
  description?: string;
  dbId?: number | null;
  source?: 'BIM_MODEL' | 'MANUAL';
  // Optional 3D placeholder for manual assets
  placeholderX?: number;
  placeholderY?: number;
  placeholderZ?: number;
  placeholderShape?: 'cube' | 'sphere';
  placeholderSize?: number;
  // Conflict indicator
  conflictWithId?: string;
  // Linkage and visibility helpers
  linkedAssetId?: string;
  hidden?: boolean;
  // Model identity for BIM assets (used to filter to current model)
  modelGuid?: string;
  // Internal viewer model id to aid selection in federated models
  modelId?: number;
  // IFC metadata (normalized fields for filtering)
  ifcGuid?: string;
  ifcClass?: string;
  ifcType?: string;
  ifcPredefined?: string;
  // Aggregated IFC-related strings for robust filtering
  ifcCandidates?: string[];
  // Mark when user edited fields locally; ensures editable fields win on merges
  userEdited?: boolean;
}

interface SpaceRecord {
  id: string;
  level?: string;
  name?: string;
  area?: number;
  perimeter?: number;
  volume?: number;
  occupancy?: number;
  spaceCode?: string;
  building?: string;
  description?: string;
  source?: 'BIM_MODEL' | 'MANUAL';
  dbId?: number | null;
  // Model identity for BIM spaces (used to filter to current model)
  modelGuid?: string;
  // Optional 2D footprint to simulate a room in the model (planar polygon at a given Z)
  footprint?: { points: { x: number; y: number; z: number }[]; z?: number; levelIndex?: number } | null;
  // If a BIM room later conflicts with this manual space (or vice-versa)
  conflictWithId?: string;
}

interface ScheduledItem {
  id: string;
  discipline: string;
  category: string;
  code: string;
  asset: string[];
  tasks: string[];
  frequency: number;
  timeHours: number;
}

interface TicketItem {
  id: string;
  ticketCode?: string;
  qrCode?: string;
  requester: {
    name: string;
    surname: string;
    contact: string;
  };
  location?: {
    building?: string;
    level?: string;
    room?: string;
    spaceCode?: string;
  };
  intervention?: {
    discipline?: string;
    category?: string;
    item?: string;
    descriptionShort?: string;
    descriptionDetailed?: string;
    attachments?: string[];
  };
  status?: "Open" | "Planned" | "In Progress" | "Resolved";
  createdAt?: string;
}

interface WorkOrderItem {
  id: string;
  requestId?: string;
  requester?: string;
  contact?: string;
  location?: string;
  interventionDetails?: string;
  discipline?: string;
  category?: string;
  description?: string;
  attachments?: string[];
  asset?: string;
  responsibleTechnician?: string;
  company?: string;
  status: "Open" | "Planned" | "In Progress" | "Resolved";
  priority?: "High" | "Medium" | "Low";
  sourceTicketId?: string;
  comments?: Array<{
    id: string;
    author: string;
    text: string;
    timestamp: string;
  }>;
  createdAt?: string;
  updatedAt?: string;
  assignedAt?: string;
  resolvedAt?: string;
}

type Section =
  | { group: "assets"; item: "asset-list" | "create-asset" | null }
  | { group: "spaces"; item: "space-list" | "create-space" | null }
  | { group: "maintenance"; item: "scheduled" | "ticket" | null }
  | { group: "work-orders"; item: "service-requests" | "reports" | null }
  | { group: "upcoming-activities"; item: "ongoing" | "planned" | null };

const K = {
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

// Optimized cache functions with versioning and timestamp validation
interface CachedData<T> {
  version: number;
  timestamp: number;
  data: T;
}

const CACHE_VERSION = 1;
const CACHE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

function load<T>(key: string, def: T): T {
  if (typeof window === 'undefined') return def;
  try {
    const v = localStorage.getItem(key);
    if (!v) return def;
    
    const cached = JSON.parse(v) as CachedData<T>;
    
    // Validate cache version and age
    if (cached.version !== CACHE_VERSION) {
      console.warn(`⚠️ [Cache] Version mismatch for ${key}. Clearing stale cache.`);
      localStorage.removeItem(key);
      return def;
    }
    
    const age = Date.now() - cached.timestamp;
    if (age > CACHE_MAX_AGE) {
      console.warn(`⚠️ [Cache] Expired cache for ${key} (${Math.round(age / 1000)}s old). Clearing.`);
      localStorage.removeItem(key);
      return def;
    }
    
    return cached.data as T;
  } catch (e) {
    console.error(`❌ [Cache] Load error for ${key}:`, e);
    return def;
  }
}

function save<T>(key: string, val: T) {
  if (typeof window === 'undefined') return;
  try {
    const cached: CachedData<T> = {
      version: CACHE_VERSION,
      timestamp: Date.now(),
      data: val
    };
    localStorage.setItem(key, JSON.stringify(cached));
    console.log(`✅ [Cache] Saved ${key} (${JSON.stringify(cached).length} bytes)`);
  } catch (e) {
    console.error(`❌ [Cache] Save error for ${key}:`, e);
    // Attempt to clear localStorage if quota exceeded
    if (e instanceof Error && e.message.includes('QuotaExceededError')) {
      console.warn(`⚠️ [Cache] Storage quota exceeded. Clearing old data...`);
      try {
        localStorage.clear();
      } catch {}
    }
  }
}

// Manual cache clear function for admin/debug
function clearAssetCache(projectId?: string) {
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

const MenuButton: React.FC<{ label: string; active?: boolean; onClick: () => void }> = ({ label, onClick }) => (
  <button onClick={onClick} className={"w-full text-left px-3 py-2 rounded-md text-sm transition-colors text-gray-300 hover:text-white hover:bg-gray-800"}>{label}</button>
);

export default function FMPanel({ projectId, viewer, standalone, initialSection }: FMPanelProps) {
  const defaultItemForGroup = (group: Section['group']): Section => {
    switch (group) {
      case 'assets': return { group: 'assets', item: 'asset-list' };
      case 'spaces': return { group: 'spaces', item: 'space-list' };
      case 'maintenance': return { group: 'maintenance', item: 'scheduled' };
      case 'work-orders': return { group: 'work-orders', item: 'service-requests' };
      case 'upcoming-activities': return { group: 'upcoming-activities', item: 'ongoing' };
      default: return { group: 'assets', item: 'asset-list' } as Section;
    }
  };

  const initialSectionState: Section = React.useMemo(() => {
    // 1) from prop if valid
    if (initialSection && (initialSection as any).group) {
      const s = initialSection as Section;
      // normalize: ensure item is set
      if (!(s as any).item) return defaultItemForGroup(s.group);
      return s;
    }
    // 2) from localStorage
    const loaded = load<Section | null>(K.uiSection(projectId), null);
    if (loaded && (loaded as any).group) {
      const ls = loaded as Section;
      if (!(ls as any).item) return defaultItemForGroup(ls.group);
      return ls;
    }
    // 3) fallback default
    return defaultItemForGroup('assets');
  }, [initialSection, projectId]);

  const [section, setSection] = useState<Section | null>(initialSectionState);
  const [showModal, setShowModal] = useState(false);
  const modalRef = React.useRef<HTMLDivElement | null>(null);
  const [modalPos, setModalPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [preSelectedAssets, setPreSelectedAssets] = useState<AssetRecord[]>([]);
  const [modalSize, setModalSize] = useState<{ width: number; height: number }>({ width: 1200, height: 800 });
  const [showModalMinimized, setShowModalMinimized] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const dragRef = React.useRef({ startMouseX: 0, startMouseY: 0, startX: 0, startY: 0 });
  const resizeRef = React.useRef({ startMouseX: 0, startMouseY: 0, startWidth: 0, startHeight: 0 });
  const isStandalone = !!standalone;
  // Persist section selection so it restores in new windows/tabs
  useEffect(() => {
    if (section) save(K.uiSection(projectId), section);
  }, [section, projectId]);
  const childWinRef = useRef<Window | null>(null);

  // Remote drawing bridge (main window only)
  const remoteActiveRef = useRef(false);
  const remotePointsRef = useRef<{ x: number; y: number; z: number }[]>([]);
  const remoteBaseZRef = useRef<number | null>(null);
  const remoteOverlay = 'fm-remote-footprint-preview';
  const remoteHoverRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const remoteSnapperRef = useRef<any>(null);
  // Remote placement (manual asset) bridge
  const remotePlaceActiveRef = useRef(false);
  const remotePlaceAssetRef = useRef<{ assetId: string; shape: 'cube' | 'sphere'; size: number } | null>(null);
  const remotePlaceOverlayElRef = useRef<HTMLElement | null>(null);
  const remotePlaceOverlayChildRef = useRef<HTMLElement | null>(null);
  const remotePlacePrevDisplayRef = useRef<string | null>(null);
  const remotePlacePrevBackdropRef = useRef<string | null>(null);
  const remotePlacePrevBgRef = useRef<string | null>(null);
  const remoteClearOverlay = () => {
    try {
      if (!viewer?.impl) return;
      const scn = (viewer.impl.overlayScenes || {})[remoteOverlay];
      const scene = scn?.scene;
      if (scene) {
        const children = [...scene.children];
        children.forEach(ch => scene.remove(ch));
        viewer.impl.invalidate(true);
      }
    } catch { }
  };
  // Remote helpers
  const remoteWorldOnZ = (clientX: number, clientY: number, z: number) => {
    const THREE = (window as any).THREE;
    if (!THREE || !viewer?.impl?.camera) return null;

    // Get proper canvas bounds
    const canvas = viewer.impl.canvas || viewer.container;
    const rect = canvas.getBoundingClientRect();

    // Normalize to [-1, 1] NDC space
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((clientY - rect.top) / rect.height) * 2 + 1;

    const camera = viewer.impl.camera;

    // Create ray from camera through mouse position
    const mouse = new THREE.Vector3(x, y, 0.5);
    mouse.unproject(camera);

    const origin = camera.position.clone();
    const dir = mouse.sub(origin).normalize();

    // Intersect ray with horizontal plane at z
    const EPS = 1e-6;
    if (Math.abs(dir.z) < EPS) return null; // parallel to plane

    const t = (z - origin.z) / dir.z;
    if (!isFinite(t) || t < 0) return null; // behind camera

    const point = origin.clone().add(dir.clone().multiplyScalar(t));
    return point;
  };
  const remoteIsNearFirst = (p: { x: number; y: number; z: number }, eps = 0.4) => {
    if (remotePointsRef.current.length < 1) return false;
    const a = remotePointsRef.current[0];
    const dx = p.x - a.x, dy = p.y - a.y;
    return Math.hypot(dx, dy) <= eps;
  };
  const remoteDrawPreview = () => {
    try {
      if (!viewer?.impl) return;
      if (!(viewer.impl.overlayScenes || {})[remoteOverlay]) viewer.impl.createOverlayScene(remoteOverlay);
      remoteClearOverlay();
      const pts = remotePointsRef.current;
      const hover = remoteHoverRef.current;
      const THREE = (window as any).THREE;
      if (!THREE) { viewer.impl.invalidate(true); return; }

      // Draw polyline through all clicked points (THICKER & DARKER)
      if (pts.length >= 2) {
        const geom = new THREE.BufferGeometry().setFromPoints(pts.map(p => new THREE.Vector3(p.x, p.y, p.z)));
        const mat = new THREE.LineBasicMaterial({ color: 0x00dd00, linewidth: 4, depthTest: false });
        const line = new THREE.Line(geom, mat);
        line.renderOrder = 999;
        viewer.impl.addOverlay(remoteOverlay, line);
      }

      // Draw preview line from LAST point to hover (THICKER)
      if (hover && pts.length >= 1) {
        const lastPt = pts[pts.length - 1];
        const previewGeom = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(lastPt.x, lastPt.y, lastPt.z),
          new THREE.Vector3(hover.x, hover.y, hover.z)
        ]);
        const previewMat = new THREE.LineBasicMaterial({ color: 0xff8800, linewidth: 4, depthTest: false, opacity: 0.8, transparent: true });
        const previewLine = new THREE.Line(previewGeom, previewMat);
        previewLine.renderOrder = 999;
        viewer.impl.addOverlay(remoteOverlay, previewLine);
      }

      // Draw closing line preview (back to first point) - THICKER & DARKER
      if (pts.length >= 3) {
        const closedPts = [...pts, pts[0]].map(p => new THREE.Vector3(p.x, p.y, p.z));
        const geom2 = new THREE.BufferGeometry().setFromPoints(closedPts);
        const line2 = new THREE.Line(geom2, new THREE.LineBasicMaterial({ color: 0x0088ff, linewidth: 4, depthTest: false, opacity: 0.7, transparent: true }));
        line2.renderOrder = 999;
        viewer.impl.addOverlay(remoteOverlay, line2);
        // Filled polygon for visibility (DARKER)
        const shape = new THREE.Shape(pts.map((p, i) => new THREE.Vector2(p.x, p.y)));
        const fillGeom = new THREE.ShapeGeometry(shape);
        const fillMat = new THREE.MeshBasicMaterial({ color: 0x00dd00, opacity: 0.25, transparent: true, depthWrite: false, depthTest: false });
        const mesh = new THREE.Mesh(fillGeom, fillMat);
        if (remoteBaseZRef.current != null) mesh.position.z = remoteBaseZRef.current;
        mesh.renderOrder = 998;
        viewer.impl.addOverlay(remoteOverlay, mesh);
      }
      viewer.impl.invalidate(true);
    } catch { }
  };
  const remoteOnViewerMove = (ev: MouseEvent) => {
    try {
      if (!viewer?.impl || !remoteActiveRef.current) return;
      if (remoteBaseZRef.current == null) {
        const hit = viewer.impl.hitTest(ev.clientX, ev.clientY, true);
        if (hit?.point?.z != null) remoteBaseZRef.current = hit.point.z; else {
          try { remoteBaseZRef.current = viewer.model?.getBoundingBox?.().min?.z ?? 0; } catch { remoteBaseZRef.current = 0; }
        }
      }
      const z = remoteBaseZRef.current ?? 0;
      const p = remoteWorldOnZ(ev.clientX, ev.clientY, z);
      if (!p) return;
      if (remotePointsRef.current.length >= 2 && remoteIsNearFirst(p)) {
        const a = remotePointsRef.current[0];
        remoteHoverRef.current = { x: a.x, y: a.y, z: a.z };
      } else {
        remoteHoverRef.current = { x: p.x, y: p.y, z };
      }
      remoteDrawPreview();
    } catch { }
  };
  const remoteOnViewerClick = (ev: MouseEvent) => {
    try {
      if (!viewer?.impl || !remoteActiveRef.current) return;
      console.log('[FMPanel][remoteOnViewerClick] Click detected, remoteActive:', remoteActiveRef.current);
      if (remoteBaseZRef.current == null) {
        const hit = viewer.impl.hitTest(ev.clientX, ev.clientY, true);
        if (hit?.point?.z != null) remoteBaseZRef.current = hit.point.z; else {
          try { remoteBaseZRef.current = viewer.model?.getBoundingBox?.().min?.z ?? 0; } catch { remoteBaseZRef.current = 0; }
        }
        console.log('[FMPanel][remoteOnViewerClick] Base Z initialized:', remoteBaseZRef.current);
      }
      const z = remoteBaseZRef.current ?? 0;
      let p = null as any;
      // Try snapper first
      try {
        if (remoteSnapperRef.current && typeof remoteSnapperRef.current.getSnapResult === 'function') {
          const sr = remoteSnapperRef.current.getSnapResult();
          if (sr) {
            const gp = (sr.getPoint && sr.getPoint()) || (sr.intersectPoint) || (sr.point) || null;
            if (gp && gp.x != null && gp.y != null && gp.z != null) {
              p = gp;
              console.log('[FMPanel][remoteOnViewerClick] Snapped point:', p);
            }
          }
        }
      } catch (e) {
        console.warn('[FMPanel][remoteOnViewerClick] Snap failed:', e);
      }
      if (!p) {
        p = remoteWorldOnZ(ev.clientX, ev.clientY, z);
        console.log('[FMPanel][remoteOnViewerClick] Fallback worldOnZ point:', p);
      }
      if (!p) return;
      if (remotePointsRef.current.length >= 3 && remoteIsNearFirst(p)) {
        // auto finish
        console.log('[FMPanel][remoteOnViewerClick] Near first point, finishing. Total points:', remotePointsRef.current.length);
        try { childWinRef.current?.postMessage?.({ type: 'FM_DRAW_DONE', points: remotePointsRef.current }, '*'); } catch { }
        remoteDetach();
        return;
      }
      const point = { x: p.x, y: p.y, z };
      remotePointsRef.current.push(point);
      console.log('[FMPanel][remoteOnViewerClick] Point added. Total:', remotePointsRef.current.length, 'Point:', point);
      childWinRef.current?.postMessage?.({ type: 'FM_DRAW_POINT', point }, '*');
      remoteDrawPreview();
    } catch (e) {
      console.error('[FMPanel][remoteOnViewerClick] Error:', e);
    }
  };
  const remoteOnViewerDblClick = (ev: MouseEvent) => {
    try {
      if (!viewer?.impl || !remoteActiveRef.current) return;
      if (remotePointsRef.current.length >= 3) {
        try { childWinRef.current?.postMessage?.({ type: 'FM_DRAW_DONE', points: remotePointsRef.current }, '*'); } catch { }
        remoteDetach();
      }
    } catch { }
  };
  const remoteAttach = async () => {
    try {
      if (!viewer || remoteActiveRef.current) {
        console.warn('[FMPanel][remoteAttach] Cannot attach: viewer:', !!viewer, 'already active:', remoteActiveRef.current);
        return;
      }
      console.log('[FMPanel][remoteAttach] Attaching remote drawing handlers');
      remotePointsRef.current = [];
      remoteBaseZRef.current = null;
      remoteHoverRef.current = null;
      remoteActiveRef.current = true;
      // Load snapper if not already loaded
      console.log('[FMPanel][remoteAttach] Loading snapper extensions...');
      try {
        const measureExt = await viewer.loadExtension?.('Autodesk.Measure');
        const maybeSnapper = measureExt?.getSnapper?.();
        if (maybeSnapper) {
          remoteSnapperRef.current = maybeSnapper;
          try { maybeSnapper.activateSnap?.(true); } catch {}
          console.log('[FMPanel][remoteAttach] Measure snapper activated');
        }
      } catch (e) {
        console.warn('[FMPanel][remoteAttach] Measure extension failed:', e);
      }
      try {
        if (!remoteSnapperRef.current) {
          await viewer.loadExtension?.('Autodesk.Snapping');
          const S = (window as any).Autodesk?.Viewing?.Extensions?.Snapping;
          if (S) {
            const sn = new S.Snapper(viewer, true);
            viewer.toolController?.registerTool?.(sn);
            viewer.toolController?.activateTool?.(sn.getName?.());
            try { sn.activateSnap?.(true); } catch {}
            remoteSnapperRef.current = sn;
            console.log('[FMPanel][remoteAttach] Snapping tool activated');
          }
        }
      } catch (e) {
        console.warn('[FMPanel][remoteAttach] Snapping extension failed:', e);
      }
      viewer.container?.addEventListener('click', remoteOnViewerClick as any, true);
      viewer.container?.addEventListener('mousemove', remoteOnViewerMove as any, true);
      viewer.container?.addEventListener('dblclick', remoteOnViewerDblClick as any, true);
      try { viewer.container && ((viewer.container as HTMLElement).style.cursor = 'crosshair'); } catch { }
      if (!viewer.impl.overlayScenes?.[remoteOverlay]) viewer.impl.createOverlayScene(remoteOverlay);
      console.log('[FMPanel][remoteAttach] Remote drawing activated, listeners attached');
    } catch (e) {
      console.error('[FMPanel][remoteAttach] Error:', e);
    }
  };
  const remoteDetach = () => {
    try {
      console.log('[FMPanel][remoteDetach] Detaching remote drawing handlers');
      if (!viewer) return;
      viewer.container?.removeEventListener('click', remoteOnViewerClick as any, true);
      viewer.container?.removeEventListener('mousemove', remoteOnViewerMove as any, true);
      viewer.container?.removeEventListener('dblclick', remoteOnViewerDblClick as any, true);
      try { viewer.container && ((viewer.container as HTMLElement).style.cursor = 'default'); } catch { }
      try { remoteSnapperRef.current?.deactivateSnap?.(); } catch {}
      try {
        const name = remoteSnapperRef.current?.getName?.();
        if (name) viewer.toolController?.deactivateTool?.(name);
      } catch {}
      remoteActiveRef.current = false;
      remoteHoverRef.current = null;
      remoteClearOverlay();
      console.log('[FMPanel][remoteDetach] Remote drawing deactivated');
    } catch (e) {
      console.error('[FMPanel][remoteDetach] Error:', e);
    }
  };

  // Remote placement handlers (single-point manual asset)
  const remotePlaceOnKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      try { (childWinRef.current as Window | null)?.postMessage?.({ type: 'FM_PLACE_CANCELLED' }, '*'); } catch { }
      // cleanup
      try { if (viewer?.container) { (viewer.container as HTMLElement).style.cursor = 'default'; } } catch { }
      viewer?.container?.removeEventListener('click', remotePlaceOnClick as any, true);
      window.removeEventListener('keydown', remotePlaceOnKeyDown as any, true);
      remotePlaceActiveRef.current = false;
      // restore overlay
      try {
        const ov = remotePlaceOverlayElRef.current;
        const ovChild = remotePlaceOverlayChildRef.current;
        if (ov) {
          ov.style.pointerEvents = '';
          if (remotePlacePrevBackdropRef.current != null) ov.style.backdropFilter = remotePlacePrevBackdropRef.current;
          if (remotePlacePrevBgRef.current != null) ov.style.background = remotePlacePrevBgRef.current;
          if (remotePlacePrevBgRef.current != null) ov.style.backgroundColor = remotePlacePrevBgRef.current;
        }
        if (ovChild) ovChild.style.display = remotePlacePrevDisplayRef.current ?? '';
      } catch { }
    }
  };
  const remotePlaceOnClick = async (ev: MouseEvent) => {
    try {
      if (!viewer || !remotePlaceActiveRef.current) return;
      const payload = remotePlaceAssetRef.current;
      const container = viewer.container as HTMLElement;
      const canvas = container.querySelector('canvas') as HTMLCanvasElement | null;
      // determine point and clicked dbId/model
      let pt: any = null;
      let locDbId: number | undefined;
      let locModel: any | undefined;
      const res = viewer.impl.hitTest(ev.clientX, ev.clientY, true);
      if (res && res.point) {
        pt = res.point;
        if (res.dbId != null && res.model) { locDbId = res.dbId; locModel = res.model; }
      }
      if (!pt) {
        // Fallback: use current aggregate selection center
        let dbId: number | undefined; let model: any = viewer.model;
        const agg: any[] | null = await new Promise(resolve => viewer.getAggregateSelection ? viewer.getAggregateSelection(resolve) : resolve(null));
        if (agg && agg.length > 0 && agg[0].selection?.length > 0) { dbId = agg[0].selection[0]; model = agg[0].model; }
        else { const sel = viewer.getSelection?.(); if (sel && sel.length > 0) dbId = sel[0]; }
        if (dbId != null && model) {
          const THREE = (window as any).THREE;
          const frags = model.getFragmentList?.();
          if (THREE && frags) {
            const box = new THREE.Box3();
            frags.enumNodeFragments(dbId, (fid: number) => {
              const fb = new THREE.Box3();
              frags.getWorldBounds(fid, fb);
              box.union(fb);
            });
            if (!box.isEmpty()) {
              pt = box.getCenter(new THREE.Vector3());
              locDbId = dbId; locModel = model;
            }
          }
        }
      }
      if (!pt) {
        // keep placing until user clicks a valid spot or selects an object
        return;
      }
      // Draw overlay in main viewer
      const THREE = (window as any).THREE;
      if (THREE) {
        if (!(viewer as any)._fmOverlayCreated) {
          viewer.impl.createOverlayScene('fm-placeholders');
          (viewer as any)._fmOverlayCreated = true;
        }
        const size = payload?.size ?? 0.3;
        const geom = (payload?.shape || 'cube') === 'sphere'
          ? new THREE.SphereGeometry(size / 2, 12, 12)
          : new THREE.BoxGeometry(size, size, size);
        const mat = new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.85 });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.set(pt.x, pt.y, pt.z);
        viewer.impl.addOverlay('fm-placeholders', mesh);
        viewer.impl.invalidate(true);
      }
      // derive human-friendly location
      let newLocation: string | undefined;
      try {
        if (locModel && locDbId != null) {
          const props: any = await new Promise(resolve => locModel.getProperties(locDbId!, resolve));
          const getVal = (names: string[]): string | undefined => {
            const lower = names.map(n => n.toLowerCase());
            const p = props?.properties?.find((p: any) => { const dn = p.displayName?.toLowerCase?.(); return dn && (lower.includes(dn) || lower.some(n => dn.includes(n))); });
            return p?.displayValue?.toString();
          };
          const building = getVal(['Building']);
          const level = getVal(['Level', 'Reference Level']);
          const room = getVal(['Room', 'Space']);
          const parts = [building, level, room].filter(Boolean) as string[];
          if (parts.length) newLocation = parts.join(' - ');
        }
      } catch { }
      // Fallback: AEC LevelsExtension by Z if properties didn't yield a level
      if (!newLocation) {
        try {
          const lev = await viewer.loadExtension?.('Autodesk.AEC.LevelsExtension');
          const floorData = lev?.floorSelector?.floorData;
          if (floorData && floorData.length) {
            const z = pt.z;
            const matched = floorData.find((f: any) => (z >= (f.zMin ?? -Infinity)) && (z <= (f.zMax ?? Infinity)));
            if (matched) newLocation = [matched.building || undefined, matched.name || matched.label || undefined].filter(Boolean).join(' - ');
          }
        } catch { }
      }
      // notify child window
      try {
        (childWinRef.current as Window | null)?.postMessage?.({
          type: 'FM_PLACE_DONE',
          assetId: payload?.assetId,
          point: { x: pt.x, y: pt.y, z: pt.z },
          location: newLocation
        }, '*');
      } catch { }
      // cleanup
      try { if (container) { container.style.cursor = 'default'; if (canvas) canvas.style.cursor = 'default'; } } catch { }
      viewer.container?.removeEventListener('click', remotePlaceOnClick as any, true);
      window.removeEventListener('keydown', remotePlaceOnKeyDown as any, true);
      remotePlaceActiveRef.current = false;
      // restore overlay
      try {
        const ov = remotePlaceOverlayElRef.current;
        const ovChild = remotePlaceOverlayChildRef.current;
        if (ov) ov.style.pointerEvents = '';
        if (ovChild) ovChild.style.display = remotePlacePrevDisplayRef.current ?? '';
      } catch { }
    } catch { }
  };
  const remotePlaceAttach = (payload: { assetId: string; shape: 'cube' | 'sphere'; size: number }) => {
    try {
      if (!viewer || remotePlaceActiveRef.current) return;
      remotePlaceAssetRef.current = payload;
      remotePlaceActiveRef.current = true;
      // crosshair cursor
      try { viewer.container && ((viewer.container as HTMLElement).style.cursor = 'crosshair'); } catch { }
      viewer.container?.addEventListener('click', remotePlaceOnClick as any, true);
      window.addEventListener('keydown', remotePlaceOnKeyDown as any, true);
    } catch { }
  };
  const remotePlaceDetach = () => {
    try {
      if (!viewer) return;
      viewer.container?.removeEventListener('click', remotePlaceOnClick as any, true);
      window.removeEventListener('keydown', remotePlaceOnKeyDown as any, true);
      try { viewer.container && ((viewer.container as HTMLElement).style.cursor = 'default'); } catch { }
      remotePlaceActiveRef.current = false;
      remotePlaceAssetRef.current = null;
      // restore overlay
      try {
        const ov = remotePlaceOverlayElRef.current;
        const ovChild = remotePlaceOverlayChildRef.current;
        if (ov) ov.style.pointerEvents = '';
        if (ovChild) ovChild.style.display = remotePlacePrevDisplayRef.current ?? '';
      } catch { }
    } catch { }
  };

  const modalTitle = React.useMemo(() => {
    if (!section) return 'FM';
    if (section.group === 'assets') return section.item === 'asset-list' ? 'Assets' : 'Assets';
    if (section.group === 'spaces') return section.item === 'space-list' ? 'Spaces' : 'Spaces';
    if (section.group === 'maintenance') {
      return section.item === 'scheduled' ? 'Maintenance' : ' Maintenance';
    }
    if (section.group === 'work-orders') {
      return section.item === 'service-requests' ? 'Work Orders' : 'Work Orders';
    }
    if (section.group === 'upcoming-activities') {
      return section.item === 'ongoing' ? 'Upcoming Maintenance Activities' : 'Upcoming Maintenance Activities';
    }
    return 'FM';
  }, [section]);

  // Initialize defaults and modal position
  useEffect(() => {
    // Default section in standalone mode
    if (isStandalone && !section) {
      setSection({ group: 'spaces', item: 'space-list' });
    }
    if (showModal) {
      try { setModalPos({ x: window.innerWidth / 2, y: window.innerHeight / 2 }); } catch { }
    }
  }, [showModal, isStandalone, section]);

  // If user switches section/menu while a panel is minimized, restore (close minimized) so new panel can open normally
  useEffect(() => {
    if (showModalMinimized) {
      setShowModalMinimized(false);
      // also close any open modal so the new section can open its panel freshly
      setShowModal(false);
    }
  }, [section]);

  // Allow feature panels (e.g., CreateSpace) to programmatically minimize/restore modal and adjust overlay blur
  const drawOverlayPrevRef = useRef<{ backdrop?: string; bg?: string; bgColor?: string } | null>(null);
  useEffect(() => {
    const onMin = () => {
      try {
        console.log('[FMPanel] fm-modal-minimize received');
        setShowModalMinimized(true);
        const ov = document.getElementById('fm-modal-overlay') as HTMLElement | null;
        if (ov) {
          drawOverlayPrevRef.current = { backdrop: ov.style.backdropFilter, bg: ov.style.background, bgColor: ov.style.backgroundColor };
          ov.style.pointerEvents = 'none';
          ov.style.backdropFilter = 'none';
          ov.style.background = 'transparent';
          ov.style.backgroundColor = 'transparent';
        }
      } catch {}
    };
    const onRestore = () => {
      try {
        console.log('[FMPanel] fm-modal-restore received');
        setShowModalMinimized(false);
        const ov = document.getElementById('fm-modal-overlay') as HTMLElement | null;
        if (ov) {
          const prev = drawOverlayPrevRef.current;
          ov.style.pointerEvents = '';
          if (prev) {
            ov.style.backdropFilter = prev.backdrop || '';
            ov.style.background = prev.bg || '';
            ov.style.backgroundColor = prev.bgColor || '';
          } else {
            ov.style.backdropFilter = '';
            ov.style.background = '';
            ov.style.backgroundColor = '';
          }
        }
      } catch {}
    };
    window.addEventListener('fm-modal-minimize', onMin as any);
    window.addEventListener('fm-modal-restore', onRestore as any);
    return () => {
      window.removeEventListener('fm-modal-minimize', onMin as any);
      window.removeEventListener('fm-modal-restore', onRestore as any);
    };
  }, []);

  // Bridge messages from child standalone window (only in main window)
  useEffect(() => {
    if (isStandalone) return; // child handles its own UI
    const onMsg = (e: MessageEvent) => {
      const d: any = e.data;
      if (!d || typeof d !== 'object') return;
      console.log('[FMPanel][onMsg] Received message from child:', d.type, d);
      if (d.type === 'FM_DRAW_START') {
        if (!viewer) {
          console.warn('[FMPanel][onMsg] No viewer, cancelling remote draw');
          try { (e.source as Window | null)?.postMessage?.({ type: 'FM_DRAW_CANCELLED', reason: 'NO_VIEWER' }, '*'); } catch { }
          return;
        }
        console.log('[FMPanel][onMsg] Starting remote drawing for child window');
        // Remember sender as our child window for point streaming
        try { childWinRef.current = (e.source as Window) || null; } catch { }
        remoteAttach();
      } else if (d.type === 'FM_DRAW_UNDO') {
        // Remove last point and update preview
        console.log('[FMPanel][onMsg] Undo last point. Before:', remotePointsRef.current.length);
        remotePointsRef.current.pop();
        console.log('[FMPanel][onMsg] After undo:', remotePointsRef.current.length);
        remoteDrawPreview();
      } else if (d.type === 'FM_DRAW_FINISH') {
        if (!viewer) return;
        const pts = remotePointsRef.current;
        console.log('[FMPanel][onMsg] Finish requested. Points:', pts.length);
        if (pts.length >= 3) {
          console.log('[FMPanel][onMsg] Sending FM_DRAW_DONE with', pts.length, 'points');
          try { (e.source as Window | null)?.postMessage?.({ type: 'FM_DRAW_DONE', points: pts }, '*'); } catch { }
        } else {
          console.warn('[FMPanel][onMsg] Not enough points, cancelling');
          try { (e.source as Window | null)?.postMessage?.({ type: 'FM_DRAW_CANCELLED', reason: 'NOT_ENOUGH_POINTS' }, '*'); } catch { }
        }
        remoteDetach();
      } else if (d.type === 'FM_DRAW_CANCEL') {
        console.log('[FMPanel][onMsg] Cancel requested');
        try { (e.source as Window | null)?.postMessage?.({ type: 'FM_DRAW_CANCELLED' }, '*'); } catch { }
        remoteDetach();
      } else if (d.type === 'FM_PLACE_START') {
        if (!viewer) {
          try { (e.source as Window | null)?.postMessage?.({ type: 'FM_PLACE_CANCELLED', reason: 'NO_VIEWER' }, '*'); } catch { }
          return;
        }
        try { childWinRef.current = (e.source as Window) || null; } catch { }
        // Disable modal overlay interactions and hide modal panel while placing from child window
        try {
          const ov = document.getElementById('fm-modal-overlay') as HTMLElement | null;
          remotePlaceOverlayElRef.current = ov;
          if (ov) {
            // store previous visual styles
            remotePlacePrevBackdropRef.current = ov.style.backdropFilter || '';
            remotePlacePrevBgRef.current = ov.style.background || ov.style.backgroundColor || '';
            // make overlay click-through and remove blur/background
            ov.style.pointerEvents = 'none';
            ov.style.backdropFilter = 'none';
            ov.style.background = 'transparent';
            ov.style.backgroundColor = 'transparent';
            const ovChild = ov.firstElementChild as HTMLElement | null;
            remotePlaceOverlayChildRef.current = ovChild;
            if (ovChild) {
              remotePlacePrevDisplayRef.current = ovChild.style.display || '';
              ovChild.style.display = 'none';
            }
          }
        } catch { }
        const payload = {
          assetId: d.assetId as string,
          shape: (d.shape as 'cube' | 'sphere') || 'cube',
          size: (typeof d.size === 'number' && d.size > 0 ? d.size : 0.3)
        };
        remotePlaceAttach(payload);
      } else if (d.type === 'FM_PLACE_CANCEL') {
        try { (e.source as Window | null)?.postMessage?.({ type: 'FM_PLACE_CANCELLED' }, '*'); } catch { }
        remotePlaceDetach();
      } else if (d.type === 'FM_SELECT_OBJECT_START') {
        // Handle object selection request from standalone ticket form
        if (!viewer) {
          try { (e.source as Window | null)?.postMessage?.({ type: 'FM_SELECTION_CANCELLED', reason: 'NO_VIEWER' }, '*'); } catch { }
          return;
        }

        try { childWinRef.current = (e.source as Window) || null; } catch { }

        // Get current selection
        viewer.getAggregateSelection?.((selectionData: any) => {
          // Handle both array and single model object
          let model: any;
          let selectedIds: number[] = [];

          if (Array.isArray(selectionData)) {
            if (selectionData.length === 0) {
              try { (e.source as Window | null)?.postMessage?.({ type: 'FM_SELECTION_CANCELLED', reason: 'NO_SELECTION' }, '*'); } catch { }
              return;
            }
            const firstItem = selectionData[0];
            model = firstItem.model;
            selectedIds = firstItem.selection || [];
          } else if (selectionData && selectionData.selector) {
            model = selectionData;
            selectedIds = model.selector?.getSelection?.() || [];
          } else {
            try { (e.source as Window | null)?.postMessage?.({ type: 'FM_SELECTION_CANCELLED', reason: 'NO_SELECTION' }, '*'); } catch { }
            return;
          }

          if (!selectedIds || selectedIds.length === 0) {
            try { (e.source as Window | null)?.postMessage?.({ type: 'FM_SELECTION_CANCELLED', reason: 'NO_SELECTION' }, '*'); } catch { }
            return;
          }

          const dbId = selectedIds[0];

          // Get object properties
          model.getProperties(dbId, (props: any) => {
            const getProp = (names: string[]): string | undefined => {
              const lower = names.map((n: string) => n.toLowerCase());
              const p = props?.properties?.find((p: any) => {
                const dn = p.displayName?.toLowerCase?.();
                return dn && (lower.includes(dn) || lower.some((n: string) => dn.includes(n)));
              });
              return p?.displayValue?.toString();
            };

            const name = props?.name || getProp(['Name', 'Nome']);
            const rawCategory = getProp(['Category', 'Categoria', 'OmniClass Title', 'Titolo OmniClass', 'Descrizione']);
            const ifcType = getProp(['Export Type to IFC As', 'Esporta tipo in formato IFC con nome', 'IFC Type', 'IfcClass']);
            const ifcPredefined = getProp(['IFC Predefined Type', 'Tipo predefinito IFC']);
            let level = getProp(['Level', 'Reference Level', 'Livello', 'Livello abaco']);
            if (!level || /^\d+(\.\d+)?$/.test(level)) {
              try {
                const levelProps = (props?.properties || []).filter((p: any) => (p.displayName || '').toString().toLowerCase() === 'level');
                const preferred = levelProps.find((p: any) => p.type === 20 || (p.displayCategory || '').toString().toLowerCase() === 'constraints')
                  || levelProps[levelProps.length - 1];
                if (preferred && preferred.displayValue != null) level = preferred.displayValue.toString();
              } catch {}
            }
            let room = getProp(['Room', 'Space', 'Locale']);
            const spaceCode = getProp(['Space Code', 'Number', 'Mark', 'Nome codice']);
            const building = getProp(['Building', 'Edificio']);

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

            // Build category with preference: IFC type -> mapped label; else mapped raw category -> IFC predefined -> raw
            let matchedCategory = '';
            if (ifcType) {
              const ic = ifcType.toString().toLowerCase();
              for (const [it, m] of Object.entries(CATEGORY_MAPPING)) {
                if (m.ifc.toLowerCase() === ic) { matchedCategory = `${it} / ${m.english} (${m.ifc})`; break; }
              }
              if (!matchedCategory) matchedCategory = ifcType;
            }
            if (!matchedCategory && rawCategory) {
              const rc = rawCategory.toString().toLowerCase();
              for (const [it, m] of Object.entries(CATEGORY_MAPPING)) {
                if (rc.includes(it.toLowerCase()) || rc.includes(m.english.toLowerCase()) || rc.includes(m.ifc.toLowerCase())) {
                  matchedCategory = `${it} / ${m.english} (${m.ifc})`; break;
                }
              }
              if (!matchedCategory) matchedCategory = rawCategory;
            }
            if (!matchedCategory && ifcPredefined) matchedCategory = ifcPredefined;

            // Send data back to standalone window
            try {
              (e.source as Window | null)?.postMessage?.({
                type: 'FM_SELECTION_DATA',
                item: name || `Object ${dbId}`,
                itemDbId: dbId,
                category: matchedCategory || rawCategory || '',
                building: building || '',
                level: level || '',
                room: room || '',
                spaceCode: spaceCode || ''
              }, '*');
            } catch (err) {
              console.error('[Selection] Error sending data', err);
            }
          });
        });
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [isStandalone, viewer]);

  const handleMouseMove = (ev: MouseEvent) => {
    const { startMouseX, startMouseY, startX, startY } = dragRef.current;
    const dx = ev.clientX - startMouseX;
    const dy = ev.clientY - startMouseY;
    let nx = startX + dx;
    let ny = startY + dy;
    const rect = modalRef.current?.getBoundingClientRect();
    if (rect) {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const halfW = rect.width / 2;
      const halfH = rect.height / 2;
      const pad = 12;
      const minX = halfW + pad;
      const maxX = vw - halfW - pad;
      const minY = halfH + pad;
      const maxY = vh - halfH - pad;
      nx = Math.max(minX, Math.min(maxX, nx));
      ny = Math.max(minY, Math.min(maxY, ny));
    }
    setModalPos({ x: nx, y: ny });
  };

  const handleMouseUp = () => {
    setDragging(false);
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  };

  const onHeaderMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current.startMouseX = e.clientX;
    dragRef.current.startMouseY = e.clientY;
    dragRef.current.startX = modalPos.x;
    dragRef.current.startY = modalPos.y;
    setDragging(true);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Resize handlers
  const handleResizeMove = (ev: MouseEvent) => {
    const { startMouseX, startMouseY, startWidth, startHeight } = resizeRef.current;
    const dx = ev.clientX - startMouseX;
    const dy = ev.clientY - startMouseY;
    const newWidth = Math.max(400, Math.min(window.innerWidth - 20, startWidth + dx));
    const newHeight = Math.max(300, Math.min(window.innerHeight - 20, startHeight + dy));
    setModalSize({ width: newWidth, height: newHeight });
  };

  const handleResizeUp = () => {
    setResizing(false);
    window.removeEventListener('mousemove', handleResizeMove);
    window.removeEventListener('mouseup', handleResizeUp);
  };

  const onResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current.startMouseX = e.clientX;
    resizeRef.current.startMouseY = e.clientY;
    resizeRef.current.startWidth = modalSize.width;
    resizeRef.current.startHeight = modalSize.height;
    setResizing(true);
    window.addEventListener('mousemove', handleResizeMove);
    window.addEventListener('mouseup', handleResizeUp);
  };

  // Render content based on selected section
  const renderSectionContent = () => {
    if (!section || !section.item) {
      // Show which menu is selected
      const menuName = section?.group === 'assets' ? 'Assets' :
        section?.group === 'spaces' ? 'Spaces' :
          section?.group === 'maintenance' ? 'Maintenance' :
            section?.group === 'work-orders' ? 'Work Orders' :
              section?.group === 'upcoming-activities' ? 'Upcoming Maintenance Activities' :
                'FM Tools';

      return (
        <div className="text-center py-8">
          <Building2 className="w-16 h-16 mx-auto mb-4 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-300 mb-2">{menuName}</h3>
          <p className="text-gray-500">Select a command from the submenu to get started</p>
        </div>
      );
    }

    if (section.group === 'assets' && section.item === 'asset-list') return <AssetList projectId={projectId} viewer={viewer} onScheduleMaintenance={(assets) => {
      setPreSelectedAssets(assets);
      setSection({ group: 'maintenance', item: 'scheduled' });
      if (!isStandalone) setShowModal(true);
    }} />;
    if (section.group === 'assets' && section.item === 'create-asset') return <CreateAsset projectId={projectId} viewer={viewer} />;
    if (section.group === 'spaces' && section.item === 'space-list') return <SpaceList projectId={projectId} viewer={viewer} />;
    if (section.group === 'spaces' && section.item === 'create-space') return <CreateSpace projectId={projectId} viewer={viewer} standalone={isStandalone} />;
  if (section.group === 'maintenance' && section.item === 'scheduled') return <ScheduledMaintenance projectId={projectId} viewer={viewer} preSelectedAssets={preSelectedAssets} onClearPreSelected={() => setPreSelectedAssets([])} />;
    if (section.group === 'maintenance' && section.item === 'ticket') return <TicketForm projectId={projectId} viewer={viewer} />;
    if (section.group === 'work-orders' && section.item === 'service-requests') return <ServiceRequests projectId={projectId} />;
    if (section.group === 'work-orders' && section.item === 'reports') return <MaintenanceReports projectId={projectId} />;
  if (section.group === 'upcoming-activities' && section.item === 'ongoing') return <OngoingMaintenance projectId={projectId} />;
  if (section.group === 'upcoming-activities' && section.item === 'planned') return <PlannedMaintenance projectId={projectId} viewer={viewer} />;

    return null;
  };

  // Sidebar menu (shared)
  const Sidebar = (
    <div className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col h-full">
      <div className="p-4 border-b border-gray-800">
        <h2 className="text-xl font-bold text-white mb-3 text-center">FM</h2>
      </div>

      {/* Vertical menu (BIM-style) - Top 5 headings only */}
      <div className="p-3 space-y-1.5 border-b border-gray-800">
        {/* Assets */}
        <button
          onClick={() => {
            setSection(defaultItemForGroup('assets'));
          }}
          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md border text-sm ${section?.group === 'assets' ? 'bg-blue-600 text-white border-transparent' : 'bg-gray-800 text-gray-200 border-gray-700 hover:bg-gray-700'}`}
        >
          <Package className="h-4 w-4" />
          <span className="font-medium">Assets</span>
        </button>

        {/* Spaces */}
        <button
          onClick={() => {
            setSection(defaultItemForGroup('spaces'));
          }}
          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md border text-sm ${section?.group === 'spaces' ? 'bg-blue-600 text-white border-transparent' : 'bg-gray-800 text-gray-200 border-gray-700 hover:bg-gray-700'}`}
        >
          <Square className="h-4 w-4" />
          <span className="font-medium">Spaces</span>
        </button>

        {/* Maintenance */}
        <button
          onClick={() => {
            setSection(defaultItemForGroup('maintenance'));
          }}
          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md border text-sm ${section?.group === 'maintenance' ? 'bg-blue-600 text-white border-transparent' : 'bg-gray-800 text-gray-200 border-gray-700 hover:bg-gray-700'}`}
        >
          <Wrench className="h-4 w-4" />
          <span className="font-medium">Maintenance</span>
        </button>

        {/* Work Orders */}
        <button
          onClick={() => {
            setSection(defaultItemForGroup('work-orders'));
          }}
          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md border text-sm ${section?.group === 'work-orders' ? 'bg-blue-600 text-white border-transparent' : 'bg-gray-800 text-gray-200 border-gray-700 hover:bg-gray-700'}`}
        >
          <ClipboardList className="h-4 w-4" />
          <span className="font-medium">Work orders</span>
        </button>

        {/* Upcoming Maintenance Activities */}
        <button
          onClick={() => {
            setSection(defaultItemForGroup('upcoming-activities'));
          }}
          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md border text-sm ${section?.group === 'upcoming-activities' ? 'bg-blue-600 text-white border-transparent' : 'bg-gray-800 text-gray-200 border-gray-700 hover:bg-gray-700'}`}
        >
          <CalendarClock className="h-4 w-4" />
          <span className="font-medium">Upcoming maintenance activities</span>
        </button>
      </div>

      {/* Content area - Shows submenu and content below the line */}
      <div className="flex-1 p-4 overflow-y-auto min-h-0">
        {section && (
          <div className="space-y-3">
            {/* Submenu Section Header - styled like BIM panel */}
            <div className="mb-2">
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2 text-white">
                {section.group === 'assets' && (<><Package className="h-5 w-5" />Asset Management</>)}
                {section.group === 'spaces' && (<><Square className="h-5 w-5" />Space Management</>)}
                {section.group === 'maintenance' && (<><Wrench className="h-5 w-5" />Maintenance Options</>)}
                {section.group === 'work-orders' && (<><ClipboardList className="h-5 w-5" />Work Order Management</>)}
                {section.group === 'upcoming-activities' && (<><CalendarClock className="h-5 w-5" />Activity Planning</>)}
              </h3>
            </div>

            {/* Submenu for selected group */}
            <div className="space-y-1.5">
              {section.group === 'assets' && (
                <>
                  <button
                    onClick={() => { setSection({ group: 'assets', item: 'asset-list' }); if (!isStandalone) setShowModal(true); }}
                    className={`w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${(isStandalone || showModal) && section.item === 'asset-list'
                      ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30'
                      : 'text-gray-300 hover:text-white hover:bg-gray-800/80 border border-transparent hover:border-gray-700'
                      }`}
                  >
                    Asset list
                  </button>
                  <button
                    onClick={() => { setSection({ group: 'assets', item: 'create-asset' }); if (!isStandalone) setShowModal(true); }}
                    className={`w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${(isStandalone || showModal) && section.item === 'create-asset'
                      ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30'
                      : 'text-gray-300 hover:text-white hover:bg-gray-800/80 border border-transparent hover:border-gray-700'
                      }`}
                  >
                    Create new asset
                  </button>
                </>
              )}
              {section.group === 'spaces' && (
                <>
                  <button
                    onClick={() => { setSection({ group: 'spaces', item: 'space-list' }); if (!isStandalone) setShowModal(true); }}
                    className={`w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${(isStandalone || showModal) && section.item === 'space-list'
                      ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30'
                      : 'text-gray-300 hover:text-white hover:bg-gray-800/80 border border-transparent hover:border-gray-700'
                      }`}
                  >
                    Space list
                  </button>
                  <button
                    onClick={() => { setSection({ group: 'spaces', item: 'create-space' }); if (!isStandalone) setShowModal(true); }}
                    className={`w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${(isStandalone || showModal) && section.item === 'create-space'
                      ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30'
                      : 'text-gray-300 hover:text-white hover:bg-gray-800/80 border border-transparent hover:border-gray-700'
                      }`}
                  >
                    Create new space
                  </button>
                </>
              )}
              {section.group === 'maintenance' && (
                <>
                  <button
                    onClick={() => { setSection({ group: 'maintenance', item: 'scheduled' }); if (!isStandalone) setShowModal(true); }}
                    className={`w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${(isStandalone || showModal) && section.item === 'scheduled'
                      ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30'
                      : 'text-gray-300 hover:text-white hover:bg-gray-800/80 border border-transparent hover:border-gray-700'
                      }`}
                  >
                    Scheduled maintenance
                  </button>
                  <button
                    onClick={() => { setSection({ group: 'maintenance', item: 'ticket' }); if (!isStandalone) setShowModal(true); }}
                    className={`w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${(isStandalone || showModal) && section.item === 'ticket'
                      ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30'
                      : 'text-gray-300 hover:text-white hover:bg-gray-800/80 border border-transparent hover:border-gray-700'
                      }`}
                  >
                    Ticket-based maintenance
                  </button>
                </>
              )}
              {section.group === 'work-orders' && (
                <>
                  <button
                    onClick={() => { setSection({ group: 'work-orders', item: 'service-requests' }); if (!isStandalone) setShowModal(true); }}
                    className={`w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${(isStandalone || showModal) && section.item === 'service-requests'
                      ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30'
                      : 'text-gray-300 hover:text-white hover:bg-gray-800/80 border border-transparent hover:border-gray-700'
                      }`}
                  >
                    Service requests
                  </button>
                  <button
                    onClick={() => { setSection({ group: 'work-orders', item: 'reports' }); if (!isStandalone) setShowModal(true); }}
                    className={`w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${(isStandalone || showModal) && section.item === 'reports'
                      ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30'
                      : 'text-gray-300 hover:text-white hover:bg-gray-800/80 border border-transparent hover:border-gray-700'
                      }`}
                  >
                    Maintenance reports
                  </button>
                </>
              )}
              {section.group === 'upcoming-activities' && (
                <>
                  <button
                    onClick={() => { setSection({ group: 'upcoming-activities', item: 'ongoing' }); if (!isStandalone) setShowModal(true); }}
                    className={`w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${(isStandalone || showModal) && section.item === 'ongoing'
                      ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30'
                      : 'text-gray-300 hover:text-white hover:bg-gray-800/80 border border-transparent hover:border-gray-700'
                      }`}
                  >
                    Ongoing maintenance
                  </button>
                  <button
                    onClick={() => { setSection({ group: 'upcoming-activities', item: 'planned' }); if (!isStandalone) setShowModal(true); }}
                    className={`w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${(isStandalone || showModal) && section.item === 'planned'
                      ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30'
                      : 'text-gray-300 hover:text-white hover:bg-gray-800/80 border border-transparent hover:border-gray-700'
                      }`}
                  >
                    Planned maintenance
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (isStandalone) {
    return (
      <div className="h-full w-full flex bg-gray-950">
        {Sidebar}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="p-4 border-b border-gray-800 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">{modalTitle}</h3>
          </div>
          <div className="p-4 flex-1 flex flex-col min-h-0 overflow-auto">
            {renderSectionContent()}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col h-full">
      {Sidebar}

      {showModal && !showModalMinimized && (
        // Make overlay pointer-events pass-through so the page can scroll while modal is open.
        <div id="fm-modal-overlay" className="fixed inset-0 backdrop-blur-sm bg-black/30 z-50 pointer-events-none">
          <div
            ref={modalRef}
            className="absolute bg-gray-800 rounded-lg shadow-xl mx-4 flex flex-col border border-gray-700 pointer-events-auto"
            style={{
              left: modalPos.x,
              top: modalPos.y,
              transform: 'translate(-50%, -50%)',
              width: `${modalSize.width}px`,
              height: `${modalSize.height}px`,
              maxWidth: 'calc(100vw - 20px)',
              maxHeight: 'calc(100vh - 20px)'
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between p-4 border-b border-gray-700 cursor-move select-none"
              onMouseDown={onHeaderMouseDown}
            >
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-white">{modalTitle}</h3>
              </div>
              <div className="flex items-center gap-2" onMouseDown={(e) => e.stopPropagation()}>
                <button
                  title={showModalMinimized ? 'Restore' : 'Minimize'}
                  onClick={() => setShowModalMinimized(s => !s)}
                  className="w-8 h-8 grid place-items-center rounded-full border border-gray-600 text-gray-300 hover:text-white hover:bg-gray-700"
                  aria-label="Minimize"
                >
                  <Minimize2 className="w-4 h-4" />
                </button>

                <button
                  title="Open in new window"
                  onClick={() => {
                    try {
                        // Capture minimal viewer context synchronously and persist so the standalone window can read it immediately
                        const getViewerContextSync = () => {
                          try {
                            const g = viewer?.model?.getData?.()?.guid || (viewer?.model?.id != null ? String(viewer.model.id) : undefined);
                            const urn = viewer?.model?.getData?.()?.urn || (viewer?.impl?.model?.myData?.urn);
                            
                            // Create composite modelGuid: guid|urn to ensure uniqueness
                            let modelGuid = '';
                            if (g && typeof g === 'string') {
                              modelGuid = g;
                              if (urn && typeof urn === 'string') {
                                modelGuid = `${g}|${urn}`;
                              }
                            }
                            
                            return { modelGuid, urn } as { modelGuid?: string; urn?: string };
                          } catch { return {}; }
                        };
                        try {
                          const ctxSync = getViewerContextSync();
                          if (projectId) {
                            try {
                              localStorage.setItem(`fm-context-${projectId}`, JSON.stringify(ctxSync));
                              console.log(`[Spaces][open] wrote fm-context-${projectId} =>`, ctxSync);
                            } catch {}
                          }
                        } catch { }

                        // Open window synchronously FIRST to avoid popup blockers
                        const features = `width=${Math.min(window.innerWidth-100, 1200)},height=${Math.min(window.innerHeight-100, 800)}`;
                        const s = encodeURIComponent(JSON.stringify(section));
                        const url = `${window.location.origin}/fm-standalone?section=${s}${projectId ? `&projectId=${projectId}` : ''}`;
                        const w = window.open(url, `_blank`, features);
                        if (w) childWinRef.current = w;

                        // Now capture prefill snapshot asynchronously and save to localStorage (non-blocking)
                        (async () => {
                          try {
                            const capturePrefillSnapshot = async (): Promise<Partial<AssetRecord> | null> => {
                              try {
                                if (!viewer) return null;
                                const getAgg = () => new Promise<any>((resolve) => viewer.getAggregateSelection ? viewer.getAggregateSelection(resolve) : resolve(null));
                                let dbId: number | undefined; let model: any = viewer.model;
                                const agg = await getAgg();
                                if (agg && agg.length > 0 && agg[0].selection?.length > 0) { dbId = agg[0].selection[0]; model = agg[0].model; }
                                else { const sel = viewer.getSelection?.(); if (sel && sel.length > 0) dbId = sel[0]; }
                                if (dbId == null || !model) return null;
                                const props: any = await new Promise(resolve => model.getProperties(dbId!, resolve));
                                const propArray: any[] = Array.isArray(props?.properties) ? props.properties : [];
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
                                const PROP_ALIASES: Record<string, string[]> = {
                                  brand: ['Manufacturer', 'Brand', 'Manufacturer Name', 'Produttore', 'Marca'],
                                  modelName: ['Model', 'Type Name', 'Model Number', 'Nome del tipo', 'Nome del tipo'],
                                  serial: ['Serial Number', 'Serial', 'Numero di serie'],
                                  installDate: ['Install Date', 'Installation Date', 'Data di installazione'],
                                  power: ['Power', 'Power Rating', 'kW', 'Dati elettrici', 'Alimentazione apparente'],
                                  capacity: ['Capacity', 'Capacità'],
                                  weight: ['Weight', 'Peso'],
                                  length: ['Length', 'Lunghezza'],
                                  width: ['Width', 'Larghezza'],
                                  height: ['Height', 'Thickness', 'Altezza'],
                                  material: ['Material', 'Structural Material', 'Materiale', 'Materiale strutturale'],
                                  level: ['Schedule Level','Livello abaco','Base Level','Reference Level','Livello di base','Livello superiore','Vincolo di base','Vincolo parte superiore','Base Constraint','Top Constraint','Constraint','Vincolo','Livello','Level','Piano','Piano Terra','Level 1'],
                                  room: ['Room', 'Space', 'Stanza', 'Locale', 'Space Code'],
                                  rawCategory: ['Category', 'Categoria', 'Type', 'Tipo', 'Nome del tipo', 'Category Name']
                                };
                                const pickAlias = (key: keyof typeof PROP_ALIASES) => pick(...PROP_ALIASES[key]);
                                const brand = pickAlias('brand');
                                const modelName = pickAlias('modelName');
                                const serial = pickAlias('serial');
                                const installDate = pickAlias('installDate');
                                const power = pickAlias('power');
                                const capacity = pickAlias('capacity');
                                const weight = pickAlias('weight');
                                const length = pickAlias('length');
                                const width = pickAlias('width');
                                const height = pickAlias('height');
                                const material = pickAlias('material');
                                const level = pickAlias('level');
                                const room = pickAlias('room');
                                const rawCategory = pickAlias('rawCategory') || pick('Category','Categoria','OmniClass Title','OmniClass','Tipo');
                                const mapToStandardCategoryLocal = (category?: string): string | undefined => {
                                  if (!category) return undefined;
                                  const cat = category.toLowerCase();
                                  for (const [it, m] of Object.entries(CATEGORY_MAPPING)) {
                                    if (cat.includes(it.toLowerCase()) || cat.includes(m.english.toLowerCase()) || cat.includes(m.ifc.toLowerCase())) {
                                      return `${it} / ${m.english} (${m.ifc})`;
                                    }
                                  }
                                  return category;
                                };
                                const category = mapToStandardCategoryLocal(rawCategory);
                                const dimensions = (length || width || height) ? `${length || ''} x ${width || ''} x ${height || ''}`.replace(/\s+x\s+x\s+/, '').trim() : undefined;
                                return {
                                  brand: brand || '',
                                  model: modelName || '',
                                  serialNumber: serial || '',
                                  installationDate: installDate || '',
                                  powerRating: power || '',
                                  capacity: capacity || '',
                                  weight: weight || '',
                                  dimensions: dimensions || '',
                                  material: material || '',
                                  location: [level, room].filter(Boolean).join(' - ') || '',
                                  category: category || ''
                                } as Partial<AssetRecord>;
                              } catch { return null; }
                            };
                            const prefill = await capturePrefillSnapshot();
                            if (projectId && prefill) {
                              try { localStorage.setItem(`fm-prefill-${projectId}`, JSON.stringify(prefill)); } catch {}
                            }
                          } catch (err) { console.error('Failed to capture context/prefill', err); }
                        })();
                        
                        // Close the current modal when opening new window
                        setShowModal(false);
                        setSection(s => s ? { ...s, item: null } : s);
                    } catch (err) { console.error('Failed to open standalone window', err); }
                  }}
                  className="w-8 h-8 grid place-items-center rounded-full border border-gray-600 text-gray-300 hover:text-white hover:bg-gray-700"
                  aria-label="Open in new window"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>

                <button
                  onClick={() => { setShowModal(false); setSection(s => s ? { ...s, item: null } : s); }}
                  className="w-8 h-8 grid place-items-center rounded-full border border-gray-600 text-gray-300 hover:text-white hover:bg-gray-700"
                  aria-label="Close"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            {/* Body - keep mounted; hide when minimized to avoid unmount/reload flicker */}
            <div className={`p-4 flex-1 flex flex-col min-h-0 overflow-auto ${showModalMinimized ? 'hidden' : ''}`}>
              {renderSectionContent()}
            </div>
            {/* Resize Handle */}
            <div
              onMouseDown={onResizeMouseDown}
              className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
              style={{
                background: 'linear-gradient(135deg, transparent 50%, rgba(156, 163, 175, 0.5) 50%)',
              }}
            />
          </div>
        </div>
      )}

      {/* Dock item when minimized */}
      {showModalMinimized && (
        <div className="fixed bottom-4 right-4 z-50">
          <button onClick={() => setShowModalMinimized(false)} title={modalTitle} className="group relative flex items-center gap-2 px-3 py-2 bg-gray-800/90 border border-gray-700 text-sm text-white rounded-lg shadow-lg hover:scale-105 transition-transform">
            <div className="w-8 h-8 bg-gray-900 rounded-full flex items-center justify-center ring-1 ring-gray-700">
              <span className="text-lg font-bold">{modalTitle?.[0] || 'F'}</span>
            </div>
            <div className="hidden group-hover:block text-xs text-gray-200">{modalTitle}</div>
          </button>
        </div>
      )}
    </div>
  );
}

const AssetList: React.FC<{ projectId?: string; viewer?: any; onScheduleMaintenance?: (assets: AssetRecord[]) => void; }> = ({ projectId, viewer, onScheduleMaintenance }) => {
  const [rows, setRows] = useState<AssetRecord[]>(() => load(K.assets(projectId), [] as AssetRecord[]));
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState(0);
  const [placingAssetId, setPlacingAssetId] = useState<string | null>(null);
  // Pagination
  const pageStorageKey = `fm-assets-page-${projectId || 'global'}`;
  const [page, setPage] = useState<number>(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(pageStorageKey) : null;
      const n = raw ? parseInt(raw, 10) : NaN;
      return (Number.isFinite(n) && n > 0) ? n : 1;
    } catch { return 1; }
  });
  const [pageSize, setPageSize] = useState(10);
  const [jumpPage, setJumpPage] = useState<string>('');
  const [visibleFields, setVisibleFields] = useState({
    basic: true,
    identification: false,
    technical: false,
    documentation: false,
    lifecycle: false,
    maintenance: false,
    economic: false,
    compliance: false,
    relationships: false
  });
  const [filter, setFilter] = useState({ category: '', type: '', location: '', condition: '', classification: '', ifcClass: '', selectedOnly: false, selectedKeys: [] as string[] });
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);
  const showToast = (type: 'success' | 'error' | 'info', text: string) => {
    setToast({ type, text });
    window.setTimeout(() => setToast(null), 3500);
  };
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; id?: string; label?: string }>({ open: false });
  // Edit Asset modal
  const [editModal, setEditModal] = useState<{ open: boolean; id?: string }>({ open: false });
  const [editSection, setEditSection] = useState<'basic'|'identification'|'technical'|'documentation'|'lifecycle'|'maintenance'|'economic'|'compliance'|'relationships'>('basic');
  const [edit, setEdit] = useState<Partial<AssetRecord>>({});
  // Sequential Edit queue for "Edit Selected"
  const [editQueue, setEditQueue] = useState<string[]>([]);
  const [editIndex, setEditIndex] = useState<number>(0);
  // Bulk Edit mode: when multiple assets selected with same category
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [bulkEditIds, setBulkEditIds] = useState<string[]>([]);
  const [bulkCategoryLabel, setBulkCategoryLabel] = useState<string>('');
  // PDF Viewer modal state
  const [pdfModal, setPdfModal] = useState<{ open: boolean; fileId?: string; fileName?: string }>({ open: false });

  const pickEditable = (r: Partial<AssetRecord>): Partial<AssetRecord> => {
    const out: Partial<AssetRecord> = {};
    for (const k of EDITABLE_FIELDS) {
      const v = (r as any)[k];
      if (v !== undefined) (out as any)[k] = v as any;
    }
    return out;
  };
  

  const openEditAsset = (row: AssetRecord) => {
    // Ensure we are NOT in bulk edit or sequential multi-edit mode when explicitly editing a single row
    setBulkEditMode(false);
    setBulkEditIds([]);
    setBulkCategoryLabel('');
    setEditQueue([]);
    setEditIndex(0);
    setEditModal({ open: true, id: row.id });
    // Prefill form with asset data, normalizing category to remove Revit prefix
    const editData = { ...pickEditable(row) };
    if (editData.category) {
      editData.category = stripRevitPrefix(editData.category) || editData.category;
    }
    setEdit(editData);
    setEditSection('basic');
  };

  const persistEditToBackend = async (id: string, fields: Partial<AssetRecord>) => {
    if (!projectId) return;

    const asset = rows.find(r => r.id === id);
    console.log('📤 [persistEditToBackend] Attempting to save edit...');
    console.log('📤 [persistEditToBackend] Asset ID:', id);
    console.log('📤 [persistEditToBackend] Fields to update:', fields);

    if (!asset) {
      console.warn('⚠️ [persistEditToBackend] Asset not found in current rows; skipping backend save');
      return;
    }

    try {
      // Build a full payload so the server upsert doesn't null-out fields we don't send
      // For BIM assets, server upserts by (projectId, source=BIM_MODEL, modelGuid, dbId)
      // For MANUAL assets, server upserts by _id when id is provided
      const isBim = asset.source === 'BIM_MODEL';
      const payload: any = {
        ...(asset as any),
        ...fields,
      };

      if (isBim) {
        payload.source = 'BIM_MODEL';
        payload.modelGuid = asset.modelGuid;
        payload.dbId = asset.dbId;
        // Ensure we don't force manual _id path for BIM upsert
        delete payload.id;
      } else {
        payload.source = 'MANUAL';
        payload.id = id; // manual path uses _id filter
      }

      const resPost = await fetch(`/api/projects/${projectId}/assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      console.log('📤 [persistEditToBackend] POST response status:', resPost.status);
      if (resPost.ok) {
        console.log('✅ [persistEditToBackend] POST succeeded');
      } else {
        console.warn('⚠️ [persistEditToBackend] POST failed');
      }
    } catch (err) {
      console.error('❌ [persistEditToBackend] Error:', err);
    }
  };

  const saveEditAsset = async () => {
    const id = editModal.id;
    if (!id) { setEditModal({ open: false }); return; }
    try {
      const fields = pickEditable(edit);
      // Keep the asset source as-is (BIM stays BIM, Manual stays Manual)
      // userEdited flag ensures changes persist across merges
      const current = rows.find(r => r.id === id);
      const oldConflict = current?.conflictWithId;
      // Clear conflicts but don't convert source
      const mergedFields = { ...fields, conflictWithId: undefined } as Partial<AssetRecord>;

      setRows(prev => {
        // First update this record
        let next = prev.map(r => r.id === id ? { ...r, ...mergedFields, userEdited: true } : r);
        // Clear conflicts on any counterpart that pointed to this id; hide and link counterparts to this edited record
        next = next.map(r => {
          if (r.id !== id && (r.conflictWithId === id || (oldConflict && r.id === oldConflict))) {
            return { ...r, conflictWithId: undefined, hidden: true, linkedAssetId: id };
          }
          return r;
        });
        return next;
      });
      showToast('success', 'Asset updated');
      // Persist to local immediately (handled by rows effect) and try backend
      await persistEditToBackend(id, mergedFields);
      // Persist any BIM counterparts we modified locally (hidden/link + clear conflict)
      try {
        const counterparts = rows.filter(r => r.id !== id && (r.conflictWithId === id || (oldConflict && r.id === oldConflict)));
        await Promise.allSettled(counterparts.map(c => {
          const upd: Partial<AssetRecord> = { conflictWithId: undefined, hidden: true, linkedAssetId: id } as any;
          return persistEditToBackend(c.id, upd);
        }));
      } catch {}
      // Also persist counterpart conflict cleanup to localStorage
      try {
        const key = K.assets(projectId);
        const currentLs = load(key, [] as AssetRecord[]);
        const updated = currentLs.map(r => {
          if (r.id === id) return { ...r, ...mergedFields, userEdited: true };
          if (r.conflictWithId === id || (oldConflict && r.id === oldConflict)) {
            return { ...r, conflictWithId: undefined, hidden: true, linkedAssetId: id } as any;
          }
          return r;
        });
        save(key, updated);
      } catch {}
    } catch (e) {
      showToast('error', 'Failed to update asset');
    } finally {
      setEditModal({ open: false });
    }
  };
  
  // Start sequential edit over selected assets or bulk edit if same category
  const startSequentialEdit = () => {
    try {
      const idsOrdered = filteredRows.map(r => r.id).filter(id => selectedIds.has(id));
      const ids = idsOrdered.length ? idsOrdered : Array.from(selectedIds.values());
      if (!ids.length) return;
      
      // Get all selected assets
      const selectedAssets = rows.filter(r => ids.includes(r.id));
      
      // Group assets by category
      const categoryMap = new Map<string, string[]>();
      selectedAssets.forEach(a => {
        const cat = a.category || 'Uncategorized';
        if (!categoryMap.has(cat)) categoryMap.set(cat, []);
        categoryMap.get(cat)!.push(a.id);
      });
      
      // Find the most common category (largest group)
      let dominantCategory = '';
      let dominantIds: string[] = [];
      let maxCount = 0;
      
      categoryMap.forEach((assetIds, cat) => {
        if (assetIds.length > maxCount) {
          maxCount = assetIds.length;
          dominantCategory = cat;
          dominantIds = assetIds;
        }
      });
      
      if (maxCount === 0) {
        showToast('error', 'Assets must have a category to bulk edit. Please assign categories first.');
        return;
      }
      
      // If there are assets from other categories, show warning
      if (categoryMap.size > 1) {
        showToast('info', `Found assets from ${categoryMap.size} categories. Editing ${dominantIds.length} assets from "${dominantCategory}" category.`);
      }
      
      // Enable bulk edit mode for the dominant category assets
      if (dominantIds.length > 1) {
        console.log(`📋 [Bulk Edit] Starting bulk edit for ${dominantIds.length} assets with category: ${dominantCategory}`);
        setBulkEditMode(true);
        setBulkEditIds(dominantIds);
        setBulkCategoryLabel(dominantCategory || '');
        setEdit({}); // Empty form for bulk edit - user fills in what they want to apply to all
        setEditModal({ open: true, id: `bulk-${dominantIds[0]}` }); // Special ID to indicate bulk mode
      } else if (dominantIds.length === 1) {
        // Only one asset in the dominant category - use sequential edit
        setEditQueue(dominantIds);
        setEditIndex(0);
        const first = rows.find(r => r.id === dominantIds[0]);
        if (!first) return;
        openEditAsset(first);
      }
    } catch {}
  };
  

  const isHexObjectId = (id?: string) => !!id && /^[a-f0-9]{24}$/i.test(id);

  const confirmDelete = (row: AssetRecord) => {
    if (row.source !== 'MANUAL') return; // safety
    const label = row.assetName || row.assetCode || row.model || row.brand || row.category || 'this asset';
    setDeleteModal({ open: true, id: row.id, label });
  };

  const performDelete = async () => {
    const id = deleteModal.id;
    if (!id) { setDeleteModal({ open: false }); return; }

    console.log('🗑️ [performDelete] Deleting asset with ID:', id);
    console.log('🗑️ [performDelete] Current rows before delete:', rows.length);

    try {
      // Optimistically remove from UI
      setRows(prev => {
        const filtered = prev.filter(a => a.id !== id);
        console.log('🗑️ [performDelete] setRows - Filtered rows:', filtered.length);
        console.log('🗑️ [performDelete] setRows - Remaining userEdited assets:', filtered.filter(a => (a as any).userEdited).length);
        return filtered;
      });
      
      const updatedRows = rows.filter(a => a.id !== id);
      save(K.assets(projectId), updatedRows);
      console.log('🗑️ [performDelete] Saved to localStorage - count:', updatedRows.length);

      // Delete from backend if we have a valid ObjectId and projectId
      if (projectId && isHexObjectId(id)) {
        console.log('🗑️ [performDelete] Deleting from backend...');
        const res = await fetch(`/api/projects/${projectId}/assets?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (!res.ok) {
          const txt = await res.text().catch(() => '');
          console.warn('⚠️ [AssetList] Backend delete failed:', res.status, txt);
          showToast('error', 'Failed to delete from server — removed locally');
        } else {
          console.log('✅ [performDelete] Backend delete successful');
          showToast('success', 'Asset deleted');
        }
      } else {
        console.log('🗑️ [performDelete] Local-only deletion (not a backend ID)');
        // Local-only deletion
        showToast('success', 'Asset deleted locally');
      }
    } catch (e) {
      console.error('❌ [AssetList] Delete error', e);
      showToast('error', 'Delete failed');
    } finally {
      setDeleteModal({ open: false });
    }
  };

  // Helper: deduplicate BIM assets (by dbId) and keep best record; manual assets by id
  const dedupeAssets = React.useCallback((arr: AssetRecord[]): AssetRecord[] => {
    console.log('🔄 [dedupeAssets] Input array length:', arr.length);
    console.log('🔄 [dedupeAssets] Assets with userEdited flag:', arr.filter(a => (a as any).userEdited).length);
    
    const score = (x: AssetRecord) => {
      // Prioritize user-edited assets heavily
      if ((x as any).userEdited === true) return 10000;
      const fields: (keyof AssetRecord)[] = [
        'assetCode','assetName','category','type','brand','model','serialNumber','installationDate',
        'material','dimensions','weight','capacity','powerRating','location','description'
      ];
      let n = 0; for (const f of fields) if ((x as any)[f]) n++;
      return n;
    };
    const map = new Map<string, AssetRecord>();
    for (const a of arr) {
      const key = (a.source === 'BIM_MODEL' && a.dbId != null)
        ? `BIM|${a.modelGuid || 'g'}|${a.dbId}`
        : `ID|${a.id}`;
      const ex = map.get(key);
      
      if (!ex) {
        map.set(key, a);
      } else {
        const aScore = score(a);
        const exScore = score(ex);
        const winner = aScore >= exScore ? a : ex;
        if (a.userEdited || ex.userEdited) {
          console.log(`🔄 [dedupeAssets] Dedup conflict for key ${key}:`, {
            existing: { id: ex.id, source: ex.source, userEdited: (ex as any).userEdited, score: exScore, assetName: ex.assetName },
            new: { id: a.id, source: a.source, userEdited: (a as any).userEdited, score: aScore, assetName: a.assetName },
            winner: winner.id
          });
        }
        map.set(key, winner);
      }
    }
    
    const result = Array.from(map.values());
    console.log('🔄 [dedupeAssets] Output array length:', result.length);
    console.log('🔄 [dedupeAssets] Output assets with userEdited:', result.filter(a => (a as any).userEdited).length);
    
    return result;
  }, []);

  const getCurrentModelGuid = React.useCallback((): string | undefined => {
    try {
      const g = viewer?.model?.getData?.()?.guid;
      if (g && typeof g === 'string') return g;
      const mid = viewer?.model?.id;
      if (mid != null) return String(mid);
      // Fallback to context stored when opening standalone window
      try {
        const ctxRaw = projectId ? localStorage.getItem(`fm-context-${projectId}`) : null;
        if (ctxRaw) { const ctx = JSON.parse(ctxRaw || '{}'); if (ctx?.modelGuid) return String(ctx.modelGuid); }
      } catch {}
      return undefined;
    } catch { return undefined; }
  }, [viewer]);

  // Treat modelGuid variants as equivalent:
  // - plain guid/id (e.g., '1' or 'a1b2c3')
  // - composite 'guid|urn'
  // - any string ending with '|urn'
  const parseModelGuid = (mg?: string) => {
    if (!mg) return { raw: '', left: '', right: '' };
    const raw = String(mg);
    const i = raw.indexOf('|');
    if (i === -1) return { raw, left: raw, right: '' };
    return { raw, left: raw.slice(0, i), right: raw.slice(i + 1) };
  };
  const isSameModelGuid = (a?: string, b?: string): boolean => {
    if (!a || !b) return false;
    if (a === b) return true;
    const A = parseModelGuid(a);
    const B = parseModelGuid(b);
    if (A.left && B.left && A.left === B.left) return true;
    if (A.right && B.right && A.right === B.right) return true;
    // Allow matching when one is composite and the other is its left part
    if (A.left && B.raw && B.raw.startsWith(A.left + '|')) return true;
    if (B.left && A.raw && A.raw.startsWith(B.left + '|')) return true;
    return false;
  };

  const filterAssetsForCurrentModel = React.useCallback((arr: AssetRecord[]): AssetRecord[] => {
    const g = getCurrentModelGuid();
    if (!g) return arr; // if no model, do not filter
    // Include manual always; BIM only when modelGuid matches current model (equivalence-aware)
    return arr.filter(a => a.source !== 'BIM_MODEL' || isSameModelGuid(a.modelGuid, g));
  }, [getCurrentModelGuid]);

  // Build master category labels from CATEGORY_MAPPING used in Ticket-based Maintenance
  const assetCategoryMasterOptions: string[] = React.useMemo(() => {
    const opts: string[] = [];
    for (const [it, m] of Object.entries(CATEGORY_MAPPING)) {
      opts.push(`${it} / ${m.english} (${m.ifc})`);
    }
    return opts.sort();
  }, []);

  // Map of master label -> tokens [italian, english, ifc]
  const masterCategoryTokens = React.useMemo(() => {
    const map = new Map<string, string[]>();
    for (const [italian, mapping] of Object.entries(CATEGORY_MAPPING)) {
      const label = `${italian} / ${mapping.english} (${mapping.ifc})`;
      map.set(label, [italian, mapping.english, mapping.ifc].filter(Boolean) as string[]);
    }
    return map;
  }, []);

  // Use module-level REVIT_CATEGORIES for filters (replaces previous dynamic category construction)
  const assetCategories: string[] = React.useMemo(() => REVIT_CATEGORIES, []);

  // Load assets from backend (preferred), fallback to localStorage
  useEffect(() => {
    const loadFromBackend = async () => {
      if (!projectId) {
        console.log('📭 [AssetList] No projectId, skipping backend load');
        return;
      }

      const currentGuid = getCurrentModelGuid();
      if (!currentGuid) {
        console.log('📭 [AssetList] No model guid yet, using local cache for now');
        try {
          const cached = load(K.assets(projectId), [] as AssetRecord[]);
          const filtered = filterAssetsForCurrentModel(cached);
          const deduped = dedupeAssets(filtered);
          setRows(deduped);
        } catch {}
        return;
      }

      console.log(`🔄 [AssetList] Loading assets from backend for project: ${projectId}, modelGuid: ${currentGuid}`);
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout
        
        const res = await fetch(`/api/projects/${projectId}/assets?modelGuid=${encodeURIComponent(currentGuid)}`, {
          signal: controller.signal
        });
        clearTimeout(timeout);
        
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : [];
          console.log(`✅ [AssetList] Loaded ${list.length} assets from backend`);

          // Merge backend list with cached assets in localStorage so we don't lose richer local fields
          // Filter cached to current model before merging to avoid legacy inflation
          const cachedAll = load(K.assets(projectId), [] as AssetRecord[]);
          const cached = cachedAll.filter(a => a.source !== 'BIM_MODEL' || a.modelGuid === currentGuid);
          
          console.log(`📦 [AssetList] Cache info - Total cached: ${cachedAll.length}, Current model: ${cached.length}`);
          
          const mergedById = list.map(b => {
            const c = cached.find(x => x.id === b.id);
            if (!c) return b;
            // Prefer cached values when backend has null/empty fields, and ALWAYS prefer user edits on editable fields
            const merged: any = { ...b };
            const isEdited = (c as any).userEdited === true;
            const isManual = (c as any).source === 'MANUAL';
            for (const key of Object.keys(c)) {
              const val = (c as any)[key];
              if (isEdited && (EDITABLE_FIELDS as any).includes(key)) {
                merged[key] = val; // user edited fields always win
              } else if (isManual && (CLEARABLE_FIELDS as any).includes(key)) {
                // Allow manual assets to explicitly clear fields (null)
                merged[key] = val;
              } else if (val !== null && val !== undefined && val !== '') {
                merged[key] = val;
              }
            }
            // Preserve critical flags and state
            if (isEdited) merged.userEdited = true;
            if ((c as any).hidden === true) merged.hidden = true;
            if ((c as any).linkedAssetId) merged.linkedAssetId = (c as any).linkedAssetId;
            if ((c as any).conflictWithId === undefined) merged.conflictWithId = undefined;
            return merged as AssetRecord;
          });
          // Include any cached-only records (not returned by backend), but only for current model (manual always ok)
          const cachedOnly = cached.filter(c => !list.find(b => b.id === c.id));
          const finalList = [...mergedById, ...cachedOnly];

          console.log(`🔀 [AssetList] Merged backend (${list.length}) with cached (${cached.length}) => final ${finalList.length}`);
          const filtered = filterAssetsForCurrentModel(finalList);
          const deduped = dedupeAssets(filtered);
          if (deduped.length !== finalList.length) {
            console.log(`🧹 [AssetList] Deduped merged list: ${finalList.length} -> ${deduped.length}`);
          }
          setRows(deduped);
          save(K.assets(projectId), deduped);
          return;
        } else {
          console.warn(`⚠️ [AssetList] Backend returned status ${res.status}`);
        }
      } catch (e) {
        console.warn('[AssetList] Backend load failed, using local cache', e);
      }
      // fallback to local cache
      try {
  const cached = load(K.assets(projectId), [] as AssetRecord[]);
  const filtered = filterAssetsForCurrentModel(cached);
  const deduped = dedupeAssets(filtered);
  console.log(`💾 [AssetList] Loaded ${cached.length} assets from localStorage (filtered ${filtered.length}, deduped ${deduped.length})`);
  setRows(deduped);
      } catch { }
    };
    loadFromBackend();
  }, [projectId]);

  // Deduplicate any pre-existing duplicates on initial load
  useEffect(() => {
    setRows(prev => {
      const unique = Array.from(new Map(prev.map(a => [a.id, a])).values());
      if (unique.length !== prev.length) {
        save(K.assets(projectId), unique);
        return unique;
      }
      return prev;
    });
  }, [projectId]);

  // Refresh assets from localStorage when component becomes visible (to sync with CreateAsset)
  useEffect(() => {
    // Refresh only on explicit create events (no visibilitychange auto-refresh). Backend preferred.
    const refreshFromBackendOrCache = async () => {
      try {
        const guid = getCurrentModelGuid();
        if (projectId && guid) {
          const res = await fetch(`/api/projects/${projectId}/assets?modelGuid=${encodeURIComponent(guid)}`);
          if (res && res.ok) {
            const data = await res.json();
            const list = Array.isArray(data) ? data : [];
            // Merge with cached local to preserve richer fields (IFC, manual overrides)
            const cachedAll = load(K.assets(projectId), [] as AssetRecord[]);
            const cached = cachedAll.filter(a => a.source !== 'BIM_MODEL' || a.modelGuid === guid);
            const mergedById = list.map(b => {
              const c = cached.find(x => x.id === b.id);
              if (!c) return b;
              const merged: any = { ...b };
              const isEdited = (c as any).userEdited === true;
              const isManual = (c as any).source === 'MANUAL';
              for (const key of Object.keys(c)) {
                const val = (c as any)[key];
                if (isEdited && (EDITABLE_FIELDS as any).includes(key)) {
                  merged[key] = val; // user edited fields always win
                } else if (isManual && (CLEARABLE_FIELDS as any).includes(key)) {
                  merged[key] = val; // allow nulls to clear
                } else if (val !== null && val !== undefined && val !== '') {
                  merged[key] = val;
                }
              }
              // Preserve critical flags and state
              if (isEdited) merged.userEdited = true;
              if ((c as any).hidden === true) merged.hidden = true;
              if ((c as any).linkedAssetId) merged.linkedAssetId = (c as any).linkedAssetId;
              if ((c as any).conflictWithId === undefined) merged.conflictWithId = undefined;
              return merged as AssetRecord;
            });
            const cachedOnly = cached.filter(c => !list.find(b => b.id === c.id));
            const finalList = [...mergedById, ...cachedOnly];
            const filtered = filterAssetsForCurrentModel(finalList);
            const deduped = dedupeAssets(filtered);
            console.log(`🔄 [AssetList] Refresh from backend: merged ${list.length} backend with ${cached.length} cached -> ${deduped.length}`);
            setRows(deduped);
            save(K.assets(projectId), deduped);
            return;
          }
        }
        // Fallback: use local cache only (no backend or fetch failed)
        const cached = load(K.assets(projectId), [] as AssetRecord[]);
        const filtered = filterAssetsForCurrentModel(cached);
        const deduped = dedupeAssets(filtered);
        console.log(`🔄 [AssetList] Refresh from cache: ${deduped.length} assets`);
        setRows(deduped);
      } catch (e) {
        console.error('❌ [AssetList] Error during refresh:', e);
      }
    };

    const handleAssetCreated = () => { void refreshFromBackendOrCache(); };
  const handleAssetUpdated = () => { void refreshFromBackendOrCache(); };

    // Do not auto-refresh on mount; initial load is handled by loadFromBackend above.
  window.addEventListener('asset-created', handleAssetCreated);
  window.addEventListener('asset-updated', handleAssetUpdated);

    return () => {
      window.removeEventListener('asset-created', handleAssetCreated);
      window.removeEventListener('asset-updated', handleAssetUpdated);
    };
  }, [projectId, rows.length]);

  // BIM Asset Extraction
  const extractAssetsFromBIM = async () => {
    // If viewer is missing (standalone), try APS fallback using stored URN
    const tryAPS = async (): Promise<boolean> => {
      try {
        const ctxRaw = projectId ? localStorage.getItem(`fm-context-${projectId}`) : null;
        const ctx = ctxRaw ? JSON.parse(ctxRaw) : {};
        const urn: string | undefined = ctx?.urn;
        if (!urn) return false;
        setIsExtracting(true);
        setExtractionProgress(1);
        const extractor = new APSAssetExtractor(urn);
        const result = await extractor.extractAllAssets((progress) => setExtractionProgress(Math.min(99, Math.max(1, progress))));
        const currentGuid = ctx?.modelGuid || getCurrentModelGuid();
        const newAssets: AssetRecord[] = result.assets.map((a) => ({
          id: `aps-${a.modelGuid}-${a.objectId}`,
          assetName: a.name,
          category: a.category,
          type: a.type,
          brand: a.brand,
          model: a.model,
          serialNumber: a.serialNumber,
          material: a.material,
          location: a.location,
          source: 'BIM_MODEL',
          dbId: a.objectId,
          modelGuid: a.modelGuid || currentGuid,
        }));
        // Upsert to backend when projectId exists
        if (projectId && newAssets.length) {
          await fetch(`/api/projects/${projectId}/assets`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'upsertMany', assets: newAssets })
          }).catch(() => {});
          // Reload list
          const res = await fetch(`/api/projects/${projectId}/assets${currentGuid ? `?modelGuid=${encodeURIComponent(currentGuid)}` : ''}`);
          if (res.ok) {
            const data = await res.json();
            const list = Array.isArray(data) ? data : [];
            // Merge with cached local to preserve edited fields
            const currentCachedAll = load(K.assets(projectId), [] as AssetRecord[]);
            const currentGuid = ctx?.modelGuid || getCurrentModelGuid();
            const cached = currentCachedAll.filter(a => a.source !== 'BIM_MODEL' || a.modelGuid === currentGuid);
            const mergedById = list.map(b => {
              const c = cached.find(x => x.id === b.id) || {} as any;
              const merged: any = { ...b };
              const isEdited = (c as any).userEdited === true;
              const isManual = (c as any).source === 'MANUAL';
              for (const [key, val] of Object.entries(c)) {
                if ((EDITABLE_FIELDS as any).includes(key) && isEdited) merged[key] = val;
                else if (isManual && (CLEARABLE_FIELDS as any).includes(key)) merged[key] = val;
              }
              // Preserve critical flags and state
              if (isEdited) merged.userEdited = true;
              if ((c as any).hidden === true) merged.hidden = true;
              if ((c as any).linkedAssetId) merged.linkedAssetId = (c as any).linkedAssetId;
              if ((c as any).conflictWithId === undefined) merged.conflictWithId = undefined;
              return merged as AssetRecord;
            });
            const cachedOnly = cached.filter(c => !list.find(b => b.id === c.id));
            const finalList = [...mergedById, ...cachedOnly];
            const filtered = filterAssetsForCurrentModel(finalList);
            const deduped = dedupeAssets(filtered);
            setRows(deduped);
            save(K.assets(projectId), deduped);
          }
        } else {
          // Local-only update
          setRows(prev => dedupeAssets(filterAssetsForCurrentModel([...prev, ...newAssets])));
        }
        setExtractionProgress(100);
        setTimeout(() => setExtractionProgress(0), 800);
        setIsExtracting(false);
        return true;
      } catch (e) {
        console.warn('[AssetList] APS fallback extraction failed', e);
        setIsExtracting(false);
        return false;
      }
    };

    if (!viewer || !viewer.model) {
      const ok = await tryAPS();
      if (!ok) showToast('error', 'No BIM model loaded. Open from the main window or ensure context includes URN.');
      return;
    }

    setIsExtracting(true);
    setExtractionProgress(0);

    try {
      console.log('🚀 [AssetList] Starting VIEWER LEAF NODE asset extraction (proven approach)...');
      console.log('📋 [AssetList] Viewer info:', {
        hasViewer: !!viewer,
        hasModel: !!viewer?.model,
        hasGetAllModels: typeof viewer?.getAllModels === 'function',
        hasInstanceTree: typeof viewer?.model?.getInstanceTree === 'function'
      });

      // Use proven viewer-based leaf node extraction
      const extractor = new ViewerLeafAssetExtractor(viewer);
      const viewerAssets = await extractor.extractAssets((progress) => {
        setExtractionProgress(progress.progress);
        console.log(`📊 [${progress.stage}] ${progress.message} (${progress.current}/${progress.total})`);
      });

      console.log(`✅ [AssetList] Extraction complete: ${viewerAssets.length} assets`);
      
      // Log detailed extraction summary
      console.log('📊 [AssetList] Extraction summary:', {
        totalAssetsExtracted: viewerAssets.length,
        hasCategoryData: viewerAssets.length > 0 && viewerAssets.some(a => a.category),
        hasNameData: viewerAssets.length > 0 && viewerAssets.some(a => a.name),
        hasTypeData: viewerAssets.length > 0 && viewerAssets.some(a => a.type),
        categories: Array.from(new Set(viewerAssets.map(a => a.category))).slice(0, 10)
      });
      
      // Log sample of extracted names for debugging
      try {
        const samples = viewerAssets.slice(0, 5).map(a => ({ 
          dbId: a.dbId, 
          name: a.name, 
          type: a.type, 
          category: a.category,
          family: a.family,
          brand: a.brand,
          model: a.model
        }));
        console.log('[AssetList] First 5 extracted assets:', samples);
        
        // Log any assets with missing critical data
        const incomplete = viewerAssets.filter(a => !a.name || !a.category);
        if (incomplete.length > 0) {
          console.warn(`[AssetList] ⚠️ ${incomplete.length} assets missing name or category:`, incomplete.slice(0, 3));
        }
      } catch (e) {
        console.error('[AssetList] Error logging sample assets:', e);
      }

      console.log('🔄 [AssetList] Converting viewer assets to AssetRecord format...');
      const currentGuid = getCurrentModelGuid();
      const newAssets: AssetRecord[] = viewerAssets.map((asset: ViewerAsset) => {
        const props = asset.properties || {} as Record<string, any>;
        const propsLower: Record<string, any> = {};
        for (const k of Object.keys(props)) propsLower[k.toLowerCase().trim()] = props[k];
        const pick = (...keys: string[]) => {
          for (const k of keys) {
            if (props[k] !== undefined) return props[k];
            const lk = k.toLowerCase().trim();
            if (propsLower[lk] !== undefined) return propsLower[lk];
          }
          return undefined;
        };

        // Log instance name extraction for debugging
        const instanceNameDebug = {
          'asset.name': asset.name,
          'Name': props['Name'],
          'Nome': props['Nome'],
          'Mark': props['Mark'],
          'Contrassegno': props['Contrassegno'],
          'dbId': asset.dbId,
          'category': asset.category,
          'type': asset.type
        };
        if (asset.name?.includes('Element') || !asset.name) {
          console.log('[AssetList][map] Instance name for dbId', asset.dbId, ':', instanceNameDebug);
        }

        // Brand must coincide with Manufacturer attribute - default to 'Unknown' if not found
        const brand = asset.brand || pick('Manufacturer','Produttore','Brand','Marca','Fabbricante','Costruttore') || 'Unknown';
        // Model must coincide with Model attribute - default to 'Unknown' if not found
        const model = asset.model || pick('Model','Modello','Type Name','Nome del tipo') || 'Unknown';
        // Serial number - remove Mark fallback, only use Serial Number attributes
        const serial = asset.serialNumber || pick('Serial Number','Numero di Serie','Numero di serie','Matricola','Seriale') || undefined;
        const installDate = props['Install Date'] || props['Installation Date'] || undefined;
        const power = props['Power'] || props['Power Rating'] || props['kW'] || undefined;
        const capacity = props['Capacity'] || undefined;
        const weight = props['Weight'] || undefined;
        const length = props['Length'] || undefined;
        const width = props['Width'] || undefined;
        const height = props['Height'] || props['Thickness'] || undefined;
        const dimensions = (length || width || height) ? `${length || ''} x ${width || ''} x ${height || ''}`.replace(/\s+x\s+x\s+/, '').trim() : undefined;

        // Robust level fallback from properties if asset.level is missing or not descriptive
        const levelFromProps = pick(
          'Schedule Level','Livello abaco',
          'Base Level','Reference Level',
          'Livello di base','Livello superiore',
          'Vincolo di base','Vincolo parte superiore',
          'Base Constraint','Top Constraint','Constraint','Vincolo',
          'Livello','Level','Piano','Piano Terra','Level 1','Base Constraint'
        );
        const levelForLocation = (asset.level && String(asset.level).trim()) ? asset.level : levelFromProps;

        try {
          if (brand === 'Unknown' || model === 'Unknown' || !serial) {
            console.log('[AssetList][map][missing] dbId:', asset.dbId, {
              category: asset.category,
              brand, model, serial,
              keys: Object.keys(props)
            });
          }
        } catch {}

        // Normalize IFC fields from multilingual Revit properties
        // IFC Class: Read directly from IfcExportType attribute first
        // Common keys seen: 'IfcExportType', 'IFC Export Type', 'IFC Class', 'IfcClass', 'Classe IFC',
        // 'Esporta tipo in formato IFC con nome' (Italian: Export type to IFC with name),
        // 'Tipo predefinito IFC' (Predefined Type), 'IfcGUID'
        const ifcGuid = pick('IfcGUID','IFC GUID','IFC GlobalId','GlobalId');
        const ifcClass = pick(
          'IfcExportType',  // Primary: Read directly from IfcExportType attribute
          'IFC Export Type',
          'IFC Class','IfcClass','Classe IFC',
          'Esporta tipo in formato IFC con nome',
          'Esporta in formato IFC con nome',
          'Esporta tipo in IFC con nome',
          'Export type in IFC with name',
          'Export type to IFC as name',
          'Export IFC Type'
        ) || asset.ifcExportType || 'Unknown';  // Fall back to ifcExportType from viewer asset, then default to 'Unknown'
        const ifcType = pick('IFC Type','IfcType','Tipo IFC');
        const ifcPredefined = pick('Predefined Type','PredefinedType','Tipo predefinito IFC','Tipo: Tipo predefinito IFC');
        const ifcCandidates = [ifcClass, ifcType, ifcPredefined]
          .map(v => (v == null ? undefined : String(v)))
          .filter(Boolean) as string[];

        // Determine asset classification from category
        let assetClassification: AssetRecord['assetClassification'] = 'OTHER';
        const catLower = (asset.category || '').toLowerCase();
        if (/(structural|column|beam|wall|floor|slab)/.test(catLower)) assetClassification = 'STRUCTURAL';
        else if (/(door|window|stair|roof|ceiling)/.test(catLower)) assetClassification = 'ARCHITECTURAL';
        else if (/(mechanical|electrical|plumbing|duct|pipe|hvac|fixture|equipment|terminal)/.test(catLower)) assetClassification = 'MEP';
        else if (/(furniture|casework)/.test(catLower)) assetClassification = 'FURNITURE';
        else if (/equipment/.test(catLower)) assetClassification = 'EQUIPMENT';

        // Extract description from IFC metadata (Description attribute)
        // Priority: 1) Description attribute 2) asset.name with bracket parsing 3) type 4) category
        const descriptionFromMetadata = pick('Description', 'Descrizione', 'Description attribute');
        
        // Parse asset.name to extract name and code from brackets
        // Examples: "White Porcelain Plate [997068]" or "POR-ASB-Emergenza-01 [169069]"
        let parsedAssetName = asset.name || '';
        let parsedAssetCode = '';
        
        const nameMatch = (asset.name || '').match(/^(.+?)\s*\[(\d+)\]\s*$/);
        if (nameMatch) {
          // Name contains [ID] pattern
          parsedAssetName = nameMatch[1].trim();
          parsedAssetCode = nameMatch[2];
        }
        
        // ASSET CODE: Leave empty (do NOT use ElementId, dbId, or any other fallback)
        // ElementId should be stored separately in the elementId field
        const finalAssetCode = '';
        
        // Asset Name Priority: 1) Description from IFC metadata 2) Parsed asset.name 3) Type 4) Category 5) Default
        const finalAssetName = (descriptionFromMetadata && String(descriptionFromMetadata).trim()) 
          || parsedAssetName 
          || asset.type 
          || asset.category 
          || 'Unknown Asset';

        return {
          id: `viewer-${currentGuid}-${asset.dbId}`,
          dbId: asset.dbId,
          assetCode: finalAssetCode,
          elementId: asset.elementId,
          assetName: finalAssetName,
          category: asset.category,
          type: asset.type,
          brand,
          model,
          serialNumber: serial,
          installationDate: installDate,
          assetClassification,
          powerRating: power,
          capacity,
          weight,
          dimensions,
          material: asset.material,
          location: [levelForLocation, asset.room].filter(Boolean).join(' - ') || 'Unknown Location',
          description: `Asset extracted from BIM model`,
          condition: 'Good',
          source: 'BIM_MODEL',
          // IFC metadata for filtering
          ifcGuid: ifcGuid ? String(ifcGuid) : undefined,
          ifcClass: String(ifcClass),  // Always use ifcClass value (defaults to 'Unknown' from extraction)
          ifcType: ifcType ? String(ifcType) : undefined,
          ifcPredefined: ifcPredefined ? String(ifcPredefined) : undefined,
          ifcCandidates: ifcCandidates.length ? ifcCandidates : undefined,
          // Force-align to the currently loaded model/viewable GUID so UI filtering matches
          modelGuid: currentGuid,
          modelId: (asset as any).modelId
        } as AssetRecord;
      });

  console.log(`✅ [AssetList] Converted ${newAssets.length} assets`);

      // Merge with existing manual assets
  console.log('🔄 [AssetList] Merging with existing assets...');
  const existingManualAssets = rows.filter(r => r.source === 'MANUAL');
  const keyOf = (a: AssetRecord) => `${(a.category || '').toLowerCase()}|${(a.location || '').toLowerCase()}|${(a.model || a.assetName || '').toLowerCase()}`;

      // Basic conflict detection (manual vs BIM)
      const manualMap = new Map<string, AssetRecord>();
      existingManualAssets.forEach(a => manualMap.set(keyOf(a), a));
      newAssets.forEach(a => {
        const m = manualMap.get(keyOf(a));
        if (m) {
          a.conflictWithId = m.id;
          m.conflictWithId = a.id;
        }
      });

      // Merge newly extracted BIM assets with any locally cached or backend-loaded versions
      // Prefer existing values for editable fields (backend values or local edits) so extraction doesn't overwrite
      // IMPORTANT: Also check localStorage directly to get latest edits made after extraction started
      const localStorageAssets = load(K.assets(projectId), [] as AssetRecord[]);
      const allExistingAssets = [...rows, ...localStorageAssets.filter(lsa => !rows.find(r => r.id === lsa.id))];
      
      // Merge extracted assets with any existing rows. Match by id OR by stable BIM key (modelGuid+dbId).
      // If an existing record is found prefer its id (this may be a DB ObjectId) so we keep continuity
      // between local cache and backend records. Also preserve editable fields and userEdited flag.
      const newAssetsMerged = newAssets.map(a => {
        const byId = allExistingAssets.find(r => r.id === a.id);
        const byDbId = allExistingAssets.find(r => r.source === 'BIM_MODEL' && r.dbId != null && a.dbId != null && r.dbId === a.dbId && r.modelGuid === a.modelGuid);
        const old = byId || byDbId;
        if (!old) return a;
        const merged: any = { ...a, id: old.id };
        for (const key of EDITABLE_FIELDS) {
          const v = (old as any)[key];
          if (v !== undefined && v !== null && v !== '') merged[key] = v;
        }
        if ((old as any).userEdited) merged.userEdited = true;
        // Clear any conflicts that were on the old version
        merged.conflictWithId = undefined;
        return merged as AssetRecord;
      });

      // Replace BIM assets with the current model's assets; keep manual assets
      // But HIDE manual assets that conflict with edited BIM assets
      const editedBimIds = new Set(newAssetsMerged.filter(a => a.userEdited).map(a => a.id));
      const existingManualAssetsFiltered = existingManualAssets.map(m => {
        // If this manual asset conflicts with an edited BIM asset, hide it
        if (m.conflictWithId && editedBimIds.has(m.conflictWithId)) {
          return { ...m, hidden: true, linkedAssetId: m.conflictWithId, conflictWithId: undefined };
        }
        return m;
      });
      
      const combined = [...existingManualAssetsFiltered, ...newAssetsMerged];

      // Deduplicate by stable id to avoid React duplicate key warnings (e.g., "universal-4087")
      const uniqueById = Array.from(new Map(combined.map(a => [a.id, a])).values());

      console.log(`✅ [AssetList] Merged: ${uniqueById.length} total assets (${existingManualAssets.length} manual, ${newAssets.length} new BIM)`);

      // Immediately update UI and local cache to avoid blocking on network (with dedupe)
      // Filter to the currently loaded model for BIM assets
      const onlyCurrentModel = filterAssetsForCurrentModel(uniqueById);
      const dedupedAfterExtract = dedupeAssets(onlyCurrentModel);
      if (dedupedAfterExtract.length !== uniqueById.length) {
        console.log(`🧹 [AssetList] Filtered+Deduped after extract: ${uniqueById.length} -> ${dedupedAfterExtract.length}`);
      }
      setRows(dedupedAfterExtract);
      save(K.assets(projectId), dedupedAfterExtract);

      console.log('✅ [AssetList] Asset extraction complete — UI updated. Starting background save...');

      const breakdown = Object.entries(
        newAssets.reduce((acc, asset) => {
          const type = asset.assetClassification || 'Other';
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      ).map(([type, count]) => `${type}: ${count}`).join(' • ');

      showToast('success', `Extracted ${newAssets.length} assets. ${breakdown}`);

      // Background persist with timeouts (non-blocking)
      (async () => {
        if (!projectId) {
          console.warn('⚠️ [AssetList] No projectId provided, skipping backend save');
          return;
        }
        try {
          const timeoutMs = 15000;
          const withTimeout = (signal?: AbortSignal) => {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort('timeout'), timeoutMs);
            const composite = signal ? new AbortController() : controller;
            return { controller, timer };
          };

          console.log(`💾 [AssetList] BG save ${newAssetsMerged.length} assets to backend (projectId: ${projectId})...`);
          const saveCtrl = new AbortController();
          const saveTimer = setTimeout(() => saveCtrl.abort('timeout'), 60000);
          const saveRes = await fetch(`/api/projects/${projectId}/assets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // IMPORTANT: send merged assets so backend stores user fields too
            body: JSON.stringify({ action: 'replaceForModel', modelGuid: currentGuid, assets: newAssetsMerged }),
            signal: saveCtrl.signal
          }).catch(err => { throw err; });
          clearTimeout(saveTimer);

          if (!saveRes.ok) {
            const errorText = await saveRes.text().catch(() => '');
            console.warn('⚠️ [AssetList] BG save failed:', saveRes.status, errorText);
            return;
          }

          // Small delay then background refresh
          await new Promise(r => setTimeout(r, 500));
          const reloadCtrl = new AbortController();
          const reloadTimer = setTimeout(() => reloadCtrl.abort('timeout'), 30000);
          const guid = getCurrentModelGuid();
          const res = await fetch(`/api/projects/${projectId}/assets${guid ? `?modelGuid=${encodeURIComponent(guid)}` : ''}` as any, { signal: reloadCtrl.signal }).catch(err => { throw err; });
          clearTimeout(reloadTimer);

          if (res && res.ok) {
            const data = await res.json();
            const list = Array.isArray(data) ? data : [];

            // Merge backend-reloaded list with cached/local (to preserve richer fields like IFC)
            const currentGuid2 = getCurrentModelGuid();
            const cachedAll = load(K.assets(projectId), [] as AssetRecord[]);
            const cached = cachedAll.filter(a => a.source !== 'BIM_MODEL' || a.modelGuid === currentGuid2);

            const mergedById = list.map(b => {
              const c = cached.find(x => x.id === b.id);
              if (!c) return b;
              const merged: any = { ...b };
              const isEdited = (c as any).userEdited === true;
              const isManual = (c as any).source === 'MANUAL';
              for (const key of Object.keys(c)) {
                const val = (c as any)[key];
                if (isEdited && (EDITABLE_FIELDS as any).includes(key)) {
                  merged[key] = val; // user edited fields always win
                } else if (isManual && (CLEARABLE_FIELDS as any).includes(key)) {
                  merged[key] = val; // allow nulls to clear
                } else if (val !== null && val !== undefined && val !== '') {
                  merged[key] = val;
                }
              }
              // Preserve critical flags and state
              if (isEdited) merged.userEdited = true;
              if ((c as any).hidden === true) merged.hidden = true;
              if ((c as any).linkedAssetId) merged.linkedAssetId = (c as any).linkedAssetId;
              if ((c as any).conflictWithId === undefined) merged.conflictWithId = undefined;
              return merged as AssetRecord;
            });
            const cachedOnly = cached.filter(c => !list.find(b => b.id === c.id));
            const finalList = [...mergedById, ...cachedOnly];

            const filtered = filterAssetsForCurrentModel(finalList);
            const deduped = dedupeAssets(filtered);
            console.log(`✅ [AssetList] BG reload merged ${list.length} backend with ${cached.length} cached -> ${finalList.length} (filtered ${filtered.length}, deduped ${deduped.length})`);
            setRows(deduped);
            // Persist the merged (richer) list so periodic refresh keeps IFC fields
            save(K.assets(projectId), deduped);
          } else {
            console.warn('⚠️ [AssetList] BG reload failed or aborted');
          }
        } catch (e) {
          console.warn('⚠️ [AssetList] Background persist/reload aborted or failed', e);
        }
      })();

    } catch (error) {
      console.error('❌ [AssetList] Asset extraction failed:', error);
      showToast('error', 'Failed to extract assets. Check console for details.');
    } finally {
      console.log('🏁 [AssetList] Extraction process finished');
      setIsExtracting(false);
      // Reset progress a tick later to avoid flicker
      setTimeout(() => setExtractionProgress(0), 250);
    }
  };

  // Auto-refresh assets when FM > Asset list opens (once per mount)
  const autoExtractOnceRef = React.useRef(false);
  useEffect(() => {
    // Remove auto-extract on open to avoid unintentional refreshes and page resets.
    // User must click 'Extract from BIM' to refresh assets.
    if (autoExtractOnceRef.current) return;
    autoExtractOnceRef.current = true;
  }, []);

  const onRowClick = (r: AssetRecord) => {
    try {
      if (!viewer) return;
      if (r.dbId != null) {
        // Prefer selecting in the model the asset came from
        const allModels: any[] = typeof (viewer as any).getAllModels === 'function'
          ? ((viewer as any).getAllModels() || [])
          : [viewer.model].filter(Boolean);
        const target = (r.modelId != null)
          ? (allModels.find(m => (typeof m.getModelId === 'function' ? m.getModelId() : m?.id) === r.modelId))
          : null;

        const trySelectInModel = (m: any) => {
          if (!m) return false;
          const mid = (typeof m.getModelId === 'function' ? m.getModelId() : m?.id);
          console.log(`[FM][select] Trying dbId ${r.dbId} in model ${mid} (asset.modelId=${r.modelId})`);
          try {
            // Check if dbId exists in this model's instance tree
            const tree = m.getInstanceTree?.();
            if (!tree) {
              console.log(`[FM][select] Model ${mid} has no instance tree, skipping`);
              return false;
            }
            
            // Verify dbId exists in this model
            let exists = false;
            try {
              tree.enumNodeChildren(r.dbId as number, () => { exists = true; }, false);
              if (!exists) {
                // Check if dbId itself is valid (leaf or parent)
                const name = tree.getNodeName?.(r.dbId as number);
                exists = !!name;
              }
            } catch {}
            
            if (!exists) {
              console.log(`[FM][select] dbId ${r.dbId} not found in model ${mid}`);
              return false;
            }
            
            console.log(`[FM][select] Found dbId ${r.dbId} in model ${mid}, selecting...`);
            
            // Ensure model is visible
            try { viewer.show?.(m); } catch {}
            try { m?.setVisible?.(true); } catch {}
            // Restore fragment visibility if the overlay was hidden via fragment-level ops
            try {
              const fragList = m?.getFragmentList?.();
              const count = fragList?.getCount?.() ?? 0;
              if (count > 0) {
                for (let i = 0; i < count; i++) { try { fragList.setVisibility(i, true); } catch {} }
                try { fragList.updateAnimTransforms?.(); } catch {}
              }
            } catch {}
            
            // Clear and select
            viewer.clearSelection?.();
            viewer.select?.([r.dbId as number], m);
            viewer.fitToView?.([r.dbId as number], m);
            
            // Force viewer refresh
            try { viewer.impl?.invalidate?.(true, true, true); } catch {}
            
            console.log(`[FM][select] ✅ Selected dbId ${r.dbId} in model ${mid}`);
            return true;
          } catch (e) { 
            console.warn(`[FM][select] Failed to select dbId ${r.dbId} in model ${mid}:`, e);
            return false; 
          }
        };

        let selected = false;
        if (target) {
          // If we have a stored modelId, ONLY try that specific model (dbIds are not unique across models!)
          selected = trySelectInModel(target);
          if (!selected) {
            console.warn(`[FM][select] Asset has modelId ${r.modelId} but dbId ${r.dbId} not found in that model. Skipping fallback to avoid selecting wrong object.`);
          }
        } else {
          // No stored modelId - try all models as fallback (legacy assets)
          console.log(`[FM][select] No modelId stored for dbId ${r.dbId}, trying all models...`);
          for (const m of allModels) { if (trySelectInModel(m)) { selected = true; break; } }
        }
        if (!selected) { 
          console.warn(`[FM][select] Could not select dbId ${r.dbId} in any model`);
          viewer.select?.([r.dbId as number]); 
          viewer.fitToView?.([r.dbId as number]); 
        }
        return;
      }
      // Manual asset: frame placeholder if available
      if (r.placeholderX != null && r.placeholderY != null && r.placeholderZ != null) {
        const THREE = (window as any).THREE;
        const size = r.placeholderSize ?? 0.3;
        if (THREE && viewer.navigation?.fitBounds) {
          const half = Math.max(size, 0.3);
          const min = new THREE.Vector3(r.placeholderX - half, r.placeholderY - half, r.placeholderZ - half);
          const max = new THREE.Vector3(r.placeholderX + half, r.placeholderY + half, r.placeholderZ + half);
          const bbox = new THREE.Box3(min, max);
          viewer.navigation.fitBounds(true, bbox);
          viewer.impl?.invalidate(true);
        }
      }
    } catch { }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(prev => {
      const ids = paginatedRows.map(r => r.id);
      const allSelected = ids.length > 0 && ids.every(id => prev.has(id));
      const next = new Set(prev);
      if (allSelected) ids.forEach(id => next.delete(id)); else ids.forEach(id => next.add(id));
      return next;
    });
  };

  // Conflict resolution modal state
  const [conflictModal, setConflictModal] = useState<{ open: boolean; manualId?: string; bimId?: string }>({ open: false });

  const openConflictResolver = (row: AssetRecord) => {
    const otherId = row.conflictWithId;
    if (!otherId) return;
    const other = rows.find(x => x.id === otherId);
    if (!other) return;
    const manual = row.source === 'MANUAL' ? row : (other.source === 'MANUAL' ? other : undefined);
    const bim = row.source === 'BIM_MODEL' ? row : (other.source === 'BIM_MODEL' ? other : undefined);
    if (!manual || !bim) return;
    setConflictModal({ open: true, manualId: manual.id, bimId: bim.id });
  };

  const resolveLink = () => {
    if (!conflictModal.manualId || !conflictModal.bimId) return;
    setRows(prev => prev.map(r => {
      if (r.id === conflictModal.manualId) return { ...r, linkedAssetId: conflictModal.bimId, conflictWithId: undefined };
      if (r.id === conflictModal.bimId) return { ...r, conflictWithId: undefined };
      return r;
    }));
    setConflictModal({ open: false });
  };

  const resolveMerge = () => {
    if (!conflictModal.manualId || !conflictModal.bimId) return;
    setRows(prev => {
      const manual = prev.find(r => r.id === conflictModal.manualId)!;
      const bim = prev.find(r => r.id === conflictModal.bimId)!;
      const merged: AssetRecord = {
        ...manual,
        brand: manual.brand || bim.brand,
        model: manual.model || bim.model,
        serialNumber: manual.serialNumber || bim.serialNumber,
        installationDate: manual.installationDate || bim.installationDate,
        material: manual.material || bim.material,
        dimensions: manual.dimensions || bim.dimensions,
        weight: manual.weight || bim.weight,
        capacity: manual.capacity || bim.capacity,
        powerRating: manual.powerRating || bim.powerRating,
        description: manual.description || bim.description,
        conflictWithId: undefined,
        linkedAssetId: bim.id
      };
      return prev.map(r => {
        if (r.id === manual.id) return merged;
        if (r.id === bim.id) return { ...r, hidden: true, conflictWithId: undefined };
        return r;
      });
    });
    setConflictModal({ open: false });
  };

  const resolveKeepBoth = () => {
    if (!conflictModal.manualId || !conflictModal.bimId) return;
    setRows(prev => prev.map(r => (r.id === conflictModal.manualId || r.id === conflictModal.bimId) ? { ...r, conflictWithId: undefined } : r));
    setConflictModal({ open: false });
  };

  const toggleField = (field: keyof typeof visibleFields) => {
    setVisibleFields(prev => ({ ...prev, [field]: !prev[field] }));
  };

  // Build distinct option lists for dropdown filters
  const distinct = {
    // Use sanitized category labels (no leading 'Revit' prefix)
    categories: Array.from(new Set(rows.map(r => stripRevitPrefix(r.category)).filter(Boolean))).sort() as string[],
    types: Array.from(new Set(rows.map(r => r.type).filter(Boolean))).sort() as string[],
    locations: Array.from(new Set(rows.map(r => r.location).filter(Boolean))).sort() as string[],
    // conditions removed from UI per request; keep computed list in case used elsewhere
    conditions: Array.from(new Set(rows.map(r => r.condition).filter(Boolean))).sort() as string[],
    classifications: Array.from(new Set(rows.map(r => r.assetClassification).filter(Boolean))).sort() as string[]
  };

  // Apply filters with smart category matching against master CATEGORY_MAPPING labels
  const filteredRows = rows.filter(r => {
    if (r.hidden) return false;
    if (filter.category) {
      if (masterCategoryTokens.has(filter.category)) {
        const tokens = (masterCategoryTokens.get(filter.category) || []).map(t => String(t).toLowerCase());
        const cat = (r.category || '').toLowerCase();
        const match = tokens.some(t => t && (cat.includes(t) || t.includes(cat)));
        if (!match) return false;
      } else {
        // Non-master selection. Normalize and map Italian -> English/IFC.
        const rawSel = filter.category;
        const selLower = rawSel.toLowerCase();
        const selNoRevit = selLower.replace(/^revit\s+/, '').trim();

        // Try exact Italian key match (case-insensitive)
        const itKey = Object.keys(CATEGORY_MAPPING).find(k => k.toLowerCase() === selNoRevit);
        // Or try English match against mapping.english
        const enEntry = itKey ? null : Object.entries(CATEGORY_MAPPING).find(([, m]: any) => (m?.english || '').toLowerCase() === selNoRevit);
        const keyUsed = itKey || (enEntry ? enEntry[0] : undefined);
        const mapping: any = keyUsed ? (CATEGORY_MAPPING as any)[keyUsed] : undefined;

        if (mapping) {
          // Build robust token set: italian, english, ifc + their 'revit ' prefixed variants
          const baseTokens = [keyUsed, mapping.english, mapping.ifc].filter(Boolean) as string[];
          const tokens = Array.from(new Set(
            baseTokens.flatMap(t => [String(t).toLowerCase(), `revit ${String(t).toLowerCase()}`])
          ));
          const cat = (r.category || '').toLowerCase();
          const match = tokens.some((t: string) => t && (cat.includes(t) || t.includes(cat)));
          if (!match) return false;
        } else {
          // Fallback: try with and without 'revit ' prefix
          const cat = (r.category || '').toLowerCase();
          const candidates = [selLower, selNoRevit, `revit ${selNoRevit}`];
          const ok = candidates.some(sel => cat === sel || cat.includes(sel) || sel.includes(cat));
          if (!ok) return false;
        }
      }
    }
    if (filter.type && !r.type?.toLowerCase().includes(filter.type.toLowerCase())) return false;
    if (filter.location && !r.location?.toLowerCase().includes(filter.location.toLowerCase())) return false;
    // filter.condition UI removed; logic preserved if state is set programmatically
    if (filter.condition && !r.condition?.toLowerCase().includes(filter.condition.toLowerCase())) return false;
    // IFC class filter for table view
    if (filter.ifcClass) {
      const sel = filter.ifcClass.toLowerCase();
      const candidatesArr = (
        ((r as any).ifcCandidates as string[] | undefined) ||
        [
          (r as any).ifcClass,
          (r as any).ifcType,
          (r as any).ifcPredefined
        ].filter(Boolean)
      ) as string[];
      const anyHit = candidatesArr.some(c => {
        const cand = String(c || '').toLowerCase();
        return cand === sel || cand.includes(sel) || sel.includes(cand);
      });
      if (!anyHit) return false;
    }
    if (filter.classification && (r.assetClassification || '').toLowerCase() !== filter.classification.toLowerCase()) return false;
    // When "Show Selected" is enabled, only include rows matching current selection keys
    if (filter.selectedOnly) {
      const keys = new Set(filter.selectedKeys || []);
      const did = r.dbId != null ? String(r.dbId) : '';
      if (!did) return false; // only BIM-backed assets can match
      const mid = (r as any).modelId != null ? String((r as any).modelId) : '';
      const key1 = mid ? `${mid}:${did}` : '';
      const key2 = `*:${did}`;
      if (!(key1 && keys.has(key1)) && !keys.has(key2)) return false;
    }
    return true;
  });

  // Sorting state for Asset List
  const [sortKey, setSortKey] = useState<string>('assetName');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const getComparable = (r: AssetRecord, key: string): string => {
    try {
      if (key === 'source') return r.source === 'BIM_MODEL' ? 'BIM' : 'Manual';
      if (key === 'category') return (stripRevitPrefix(r.category) || '').toString();
      if (key === 'ifcClass') return ((r as any).ifcClass || 'Unknown').toString();
      return ((r as any)[key] ?? '').toString();
    } catch { return ''; }
  };

  const compareStr = (a: string, b: string): number => {
    const aa = a.trim().toLowerCase();
    const bb = b.trim().toLowerCase();
    const aEmpty = aa.length === 0;
    const bEmpty = bb.length === 0;
    if (aEmpty && bEmpty) return 0;
    if (aEmpty) return 1; // empty goes to end for asc
    if (bEmpty) return -1;
    return aa.localeCompare(bb, undefined, { numeric: false, sensitivity: 'base' });
  };

  const sortedRows = React.useMemo(() => {
    const arr = [...filteredRows];
    if (!sortKey) return arr;
    arr.sort((ra, rb) => {
      const va = getComparable(ra, sortKey);
      const vb = getComparable(rb, sortKey);
      const cmp = compareStr(va, vb);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [filteredRows, sortKey, sortDir]);

  const handleSort = (key: string) => {
    setSortKey(prevKey => {
      if (prevKey === key) {
        setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
        return prevKey;
      } else {
        setSortDir('asc');
        return key;
      }
    });
  };

  const sortIndicator = (key: string) => (sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '');

  // Reset page when filters or page size change
  useEffect(() => { setPage(1); }, [filter.category, filter.type, filter.location, filter.condition, filter.classification, filter.ifcClass, filter.selectedOnly, filter.selectedKeys, pageSize]);

  // Persist page number per project so minimize/maximize (or remount) keeps the same page
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') localStorage.setItem(pageStorageKey, String(page));
    } catch {}
  }, [page, pageStorageKey]);

  // Debug aid: log IFC filtering stats when user selects an IFC class
  useEffect(() => {
    if (!filter.ifcClass) return;
    try {
      const sel = filter.ifcClass.toLowerCase();
      const withIfc = rows.filter(r => (r as any).ifcClass || (r as any).ifcType || (r as any).ifcPredefined || (r as any).ifcCandidates?.length);
      const matches = rows.filter(r => {
        const arr = ((r as any).ifcCandidates as string[] | undefined) || [ (r as any).ifcClass, (r as any).ifcType, (r as any).ifcPredefined ].filter(Boolean);
        return (arr as string[]).some(c => {
          const cc = String(c || '').toLowerCase();
          return cc === sel || cc.includes(sel) || sel.includes(cc);
        });
      });
      const sample = withIfc.slice(0, 5).map(r => ({ id: r.id, ifcClass: (r as any).ifcClass, ifcType: (r as any).ifcType, ifcPredefined: (r as any).ifcPredefined, cand: (r as any).ifcCandidates }));
      console.log('[IFC Filter][debug]', {
        selected: filter.ifcClass,
        totalRows: rows.length,
        withIfcFields: withIfc.length,
        matches: matches.length,
        sample
      });
    } catch {}
  }, [filter.ifcClass, rows]);

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const pageClamped = Math.min(page, totalPages);
  const startIndex = (pageClamped - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedRows = sortedRows.slice(startIndex, endIndex);

  // Build selection keys from viewer selection (multi-model safe): `${modelId}:${dbId}` and fallback `*:${dbId}`
  const getCurrentSelectionKeys = React.useCallback(async (): Promise<string[]> => {
    try {
      if (!viewer) return [];
      const uniq = new Set<string>();
      const agg: any = await new Promise(resolve => viewer.getAggregateSelection ? viewer.getAggregateSelection(resolve) : resolve(null));
      if (Array.isArray(agg) && agg.length > 0) {
        for (const item of agg) {
          const sel: number[] = Array.isArray(item?.selection) ? item.selection : [];
          const model = item?.model;
          const mid = model ? String((typeof model.getModelId === 'function' ? model.getModelId() : model.id) ?? '') : '';
          for (const id of sel) { uniq.add(`${mid}:${id}`); uniq.add(`*:${id}`); }
        }
      } else {
        const sel: number[] = viewer.getSelection?.() || [];
        const model = viewer.model;
        const mid = model ? String((typeof model.getModelId === 'function' ? model.getModelId() : model.id) ?? '') : '';
        for (const id of sel) { uniq.add(`${mid}:${id}`); uniq.add(`*:${id}`); }
      }
      return Array.from(uniq.values());
    } catch { return []; }
  }, [viewer]);

  const toggleShowSelected = async () => {
    try {
      if (!viewer) return;
      if (!filter.selectedOnly) {
        const keys = await getCurrentSelectionKeys();
        if (!keys.length) { showToast('info', 'Select one or more objects in the model first'); return; }
        setFilter(f => ({ ...f, selectedOnly: true, selectedKeys: keys }));
      } else {
        setFilter(f => ({ ...f, selectedOnly: false, selectedKeys: [] }));
      }
    } catch {}
  };

  const applyFilterToViewer = () => {
    if (!viewer || filteredRows.length === 0) return;
    const dbIds = filteredRows.filter(r => r.dbId != null).map(r => r.dbId as number);
    if (dbIds.length > 0) {
      viewer.isolate?.(dbIds);
      viewer.fitToView?.(dbIds);
    }
  };

  // Export CSV of selected or filtered assets
  const exportCSV = () => {
    const headers = [
      'id', 'assetCode', 'assetName', 'category', 'type', 'brand', 'model', 'serialNumber', 'installationDate',
      'material', 'dimensions', 'weight', 'capacity', 'powerRating', 'location', 'condition', 'source'
    ];
    // Prefer explicitly checkbox-selected rows; otherwise export the currently filtered rows
    const data = (selectedIds.size > 0)
      ? rows.filter(r => selectedIds.has(r.id))
      : filteredRows;

    if (data.length === 0) { showToast('info', 'No assets to export'); return; }

    const lines = [headers.join(',')];
    data.forEach(r => {
      const vals = headers.map(h => {
        let v = (r as any)[h];
        // sanitize category column for export
        if (h === 'category') v = stripRevitPrefix(v);
        const s = (v == null ? '' : String(v));
        return '"' + s.replace(/"/g, '""') + '"';
      });
      lines.push(vals.join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'asset_register.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  // Manual asset placement (placeholder geometry)
  const placeManual = (r: AssetRecord) => {
    // Remote placement if we're in the standalone control window (no viewer)
    if (!viewer) {
      setPlacingAssetId(r.id);
      try {
        const opener = (window as any).opener as Window | null;
        if (!opener) return;
        // Temporarily minimize/slide this window to the side
        const old = { x: window.screenX, y: window.screenY, w: window.outerWidth, h: window.outerHeight };
        try {
          const sw = window.screen?.availWidth || 1280;
          const sh = window.screen?.availHeight || 800;
          const targetW = Math.max(360, Math.min(480, Math.floor(sw * 0.32)));
          const targetH = Math.max(260, Math.min(420, Math.floor(sh * 0.35)));
          window.resizeTo(targetW, targetH);
          window.moveTo(sw - targetW - 10, 10);
        } catch { }
        // One-off listener for placement result
        const onMsg = (e: MessageEvent) => {
          const d: any = e.data;
          if (!d || typeof d !== 'object') return;
          if (d.type === 'FM_PLACE_DONE' && d.assetId === r.id && d.point) {
            try {
              setRows(prev => prev.map(a => a.id === r.id
                ? { ...a, placeholderX: d.point.x, placeholderY: d.point.y, placeholderZ: d.point.z, location: d.location ?? a.location }
                : a
              ));
            } finally {
              window.removeEventListener('message', onMsg);
              // restore window
              try { window.resizeTo(old.w, old.h); window.moveTo(old.x, old.y); window.focus(); } catch { }
              setPlacingAssetId(null);
            }
          } else if (d.type === 'FM_PLACE_CANCELLED') {
            window.removeEventListener('message', onMsg);
            try { window.resizeTo(old.w, old.h); window.moveTo(old.x, old.y); window.focus(); } catch { }
            setPlacingAssetId(null);
          }
        };
        window.addEventListener('message', onMsg);
        // Send start with preferred shape/size
        const shape = (r.placeholderShape || 'cube') as 'cube' | 'sphere';
        const size = (r.placeholderSize ?? 0.3) as number;
        opener.postMessage({ type: 'FM_PLACE_START', assetId: r.id, shape, size }, '*');
      } catch { }
      return;
    }
    // In-viewer placement (main window)
    setPlacingAssetId(r.id);
    // Keep overlay visible but allow click-through, remove blur/backdrop, and hide modal content
    let overlayEl: HTMLElement | null = null;
    let overlayChildEl: HTMLElement | null = null;
    let prevChildDisplay: string | null = null;
    let prevBackdrop: string | null = null;
    let prevBg: string | null = null;
    try {
      overlayEl = document.getElementById('fm-modal-overlay');
      if (overlayEl) {
        // store and clear visuals
        prevBackdrop = overlayEl.style.backdropFilter || '';
        prevBg = overlayEl.style.background || overlayEl.style.backgroundColor || '';
        overlayEl.style.pointerEvents = 'none';
        overlayEl.style.backdropFilter = 'none';
        overlayEl.style.background = 'transparent';
        overlayEl.style.backgroundColor = 'transparent';
        overlayChildEl = overlayEl.firstElementChild as HTMLElement | null;
        if (overlayChildEl) {
          prevChildDisplay = overlayChildEl.style.display || '';
          overlayChildEl.style.display = 'none';
        }
      }
    } catch { }
    const container = viewer.container as HTMLElement;
    // Ensure crosshair cursor globally for the viewer container
    try {
      if (!document.getElementById('fm-placing-style')) {
        const style = document.createElement('style');
        style.id = 'fm-placing-style';
        style.textContent = `.fm-placing, .fm-placing * { cursor: crosshair !important; }`;
        document.head.appendChild(style);
      }
    } catch { }
    container.classList.add('fm-placing');
    container.style.cursor = 'crosshair';
    const canvas = container.querySelector('canvas') as HTMLCanvasElement | null;
    if (canvas) canvas.style.cursor = 'crosshair';

    const finish = () => {
      container.removeEventListener('click', onClick, true);
      window.removeEventListener('keydown', onKeyDown, true);
      container.style.cursor = 'default';
      if (canvas) canvas.style.cursor = 'default';
      container.classList.remove('fm-placing');
      // Restore modal overlay and button state
      try {
        if (overlayEl) {
          overlayEl.style.pointerEvents = '';
          if (prevBackdrop != null) overlayEl.style.backdropFilter = prevBackdrop;
          if (prevBg != null) { overlayEl.style.background = prevBg; overlayEl.style.backgroundColor = prevBg; }
        }
        if (overlayChildEl) overlayChildEl.style.display = prevChildDisplay ?? '';
      } catch { }
      setPlacingAssetId(null);
    };
    const onClick = async (ev: MouseEvent) => {
      try {
        let pt: any = null;
        let locDbId: number | undefined;
        let locModel: any | undefined;
        const res = viewer.impl.hitTest(ev.clientX, ev.clientY, true);
        if (res && res.point) {
          pt = res.point;
          if (res.dbId != null && res.model) { locDbId = res.dbId; locModel = res.model; }
        } else {
          // Fallback: place on currently selected object center (aggregate safe)
          let dbId: number | undefined; let model: any = viewer.model;
          const agg: any[] | null = await new Promise(resolve => viewer.getAggregateSelection ? viewer.getAggregateSelection(resolve) : resolve(null));
          if (agg && agg.length > 0 && agg[0].selection?.length > 0) { dbId = agg[0].selection[0]; model = agg[0].model; }
          else { const sel = viewer.getSelection?.(); if (sel && sel.length > 0) dbId = sel[0]; }
          if (dbId != null && model) {
            const THREE = (window as any).THREE;
            const frags = model.getFragmentList?.();
            if (THREE && frags) {
              const box = new THREE.Box3();
              frags.enumNodeFragments(dbId, (fid: number) => {
                const fb = new THREE.Box3();
                frags.getWorldBounds(fid, fb);
                box.union(fb);
              });
              if (!box.isEmpty()) {
                pt = box.getCenter(new THREE.Vector3());
                locDbId = dbId; locModel = model;
              }
            }
          }
          if (!pt) {
            // keep placing until user clicks a valid spot or select an object
            showToast('info', 'Click a surface or select an object, then click to place. ESC to cancel.');
            return;
          }
        }
        // draw overlay using chosen shape and size
        const THREE = (window as any).THREE;
        if (THREE) {
          if (!(viewer as any)._fmOverlayCreated) {
            viewer.impl.createOverlayScene('fm-placeholders');
            (viewer as any)._fmOverlayCreated = true;
          }
          const size = r.placeholderSize ?? 0.3;
          const geom = (r.placeholderShape || 'cube') === 'sphere'
            ? new THREE.SphereGeometry(size / 2, 12, 12)
            : new THREE.BoxGeometry(size, size, size);
          const mat = new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.85 });
          const mesh = new THREE.Mesh(geom, mat);
          mesh.position.set(pt.x, pt.y, pt.z);
          viewer.impl.addOverlay('fm-placeholders', mesh);
          viewer.impl.invalidate(true);
        }
        // derive location from properties if possible (Level / Room / Building)
        let newLocation: string | undefined;
        try {
          if (locModel && locDbId != null) {
            const props: any = await new Promise(resolve => locModel.getProperties(locDbId!, resolve));
            const getVal = (names: string[]): string | undefined => {
              const lower = names.map(n => n.toLowerCase());
              const p = props?.properties?.find((p: any) => { const dn = p.displayName?.toLowerCase?.(); return dn && (lower.includes(dn) || lower.some(n => dn.includes(n))); });
              return p?.displayValue?.toString();
            };
            const building = getVal(['Building']);
            const level = getVal(['Level', 'Reference Level']);
            const room = getVal(['Room', 'Space']);
            const parts = [building, level, room].filter(Boolean) as string[];
            if (parts.length) newLocation = parts.join(' - ');
          }
        } catch { }
        // Fallback: AEC LevelsExtension by Z if properties didn't yield a level
        if (!newLocation) {
          try {
            const lev = await viewer.loadExtension?.('Autodesk.AEC.LevelsExtension');
            const floorData = lev?.floorSelector?.floorData;
            if (floorData && floorData.length) {
              const z = pt.z;
              const matched = floorData.find((f: any) => (z >= (f.zMin ?? -Infinity)) && (z <= (f.zMax ?? Infinity)));
              if (matched) newLocation = [matched.building || undefined, matched.name || matched.label || undefined].filter(Boolean).join(' - ');
            }
          } catch { }
        }

        // store coordinates (and location if found)
        setRows(prev => prev.map(a => a.id === r.id ? { ...a, placeholderX: pt.x, placeholderY: pt.y, placeholderZ: pt.z, location: newLocation ?? a.location } : a));
        finish();
      } catch { }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        container.removeEventListener('click', onClick, true);
        window.removeEventListener('keydown', onKeyDown, true);
        container.style.cursor = 'default';
        if (canvas) canvas.style.cursor = 'default';
        container.classList.remove('fm-placing');
        try {
          if (overlayEl) {
            overlayEl.style.pointerEvents = '';
            if (prevBackdrop != null) overlayEl.style.backdropFilter = prevBackdrop;
            if (prevBg != null) { overlayEl.style.background = prevBg; overlayEl.style.backgroundColor = prevBg; }
          }
          if (overlayChildEl) overlayChildEl.style.display = prevChildDisplay ?? '';
        } catch { }
        setPlacingAssetId(null);
      }
    };
    container.addEventListener('click', onClick, true);
    window.addEventListener('keydown', onKeyDown, true);
  };

  // Persist asset rows on change (dedicated effect avoids stale saves)
  useEffect(() => {
    save(K.assets(projectId), rows);
  }, [rows, projectId]);

  // Rehydrate overlays from saved rows (after refresh or any change)
  useEffect(() => {
    if (!viewer) return;
    const THREE = (window as any).THREE;
    if (!THREE) return;
    try {
      const overlayName = 'fm-placeholders';
      if (!(viewer as any)._fmOverlayCreated) {
        viewer.impl.createOverlayScene(overlayName);
        (viewer as any)._fmOverlayCreated = true;
      }
      const overlayScenes = (viewer.impl.overlayScenes || {}) as any;
      const scn = overlayScenes[overlayName];
      const scene = scn?.scene;
      if (!scene) return;

      // Lazily init placeholder map on viewer
      const vAny: any = viewer;
      if (!vAny._fmPlaceholderMap) vAny._fmPlaceholderMap = new Map<string, any>();
      const map: Map<string, any> = vAny._fmPlaceholderMap as Map<string, any>;

      // Remove any temporary meshes (no assetId)
      try {
        const toRemove: any[] = [];
        for (const ch of scene.children) {
          if (!ch?.userData || !ch.userData.assetId) toRemove.push(ch);
        }
        toRemove.forEach(m => scene.remove(m));
      } catch { }

      // Build a set of desired IDs
      const desiredIds = new Set<string>();
      rows.forEach(r => {
        if (r.placeholderX != null && r.placeholderY != null && r.placeholderZ != null) {
          desiredIds.add(r.id);
          const size = r.placeholderSize ?? 0.3;
          const shape = (r.placeholderShape || 'cube') as 'cube' | 'sphere';
          let mesh = map.get(r.id);
          if (!mesh) {
            const geom = shape === 'sphere'
              ? new THREE.SphereGeometry(size / 2, 12, 12)
              : new THREE.BoxGeometry(size, size, size);
            const mat = new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.85 });
            mesh = new THREE.Mesh(geom, mat);
            mesh.userData = {
              ...(mesh.userData || {}),
              assetId: r.id,
              geomBaseSize: size,
              shape
            };
            mesh.position.set(r.placeholderX, r.placeholderY, r.placeholderZ);
            scene.add(mesh);
            map.set(r.id, mesh);
          } else {
            // Update shape if changed
            if (mesh.userData?.shape !== shape) {
              try {
                mesh.geometry?.dispose?.();
              } catch {}
              mesh.geometry = shape === 'sphere'
                ? new THREE.SphereGeometry(size / 2, 12, 12)
                : new THREE.BoxGeometry(size, size, size);
              mesh.userData.shape = shape;
              mesh.userData.geomBaseSize = size;
              mesh.scale.set(1, 1, 1);
            }
            // Update position
            const p = mesh.position;
            if (p.x !== r.placeholderX || p.y !== r.placeholderY || p.z !== r.placeholderZ) {
              mesh.position.set(r.placeholderX, r.placeholderY, r.placeholderZ);
            }
            // Update size via scale, relative to base geom size
            const base = Number(mesh.userData?.geomBaseSize) || size || 0.3;
            const scale = (size || 0.3) / base;
            mesh.scale.set(scale, scale, scale);
          }
        }
      });

      // Remove meshes that are no longer present
      for (const [id, mesh] of [...map.entries()]) {
        if (!desiredIds.has(id)) {
          try { scene.remove(mesh); } catch { }
          map.delete(id);
        }
      }

      // Maintain selection highlight if any
      try {
        const vAny2: any = viewer;
        const selId: string | null = vAny2._fmSelectedPlaceholderId || null;
        for (const [id, mesh] of map.entries()) {
          const mat: any = mesh.material;
          if (mat && mat.color) {
            if (selId && selId === id) mat.color.setHex(0x00ffff); else mat.color.setHex(0xffcc00);
            mat.needsUpdate = true;
          }
        }
      } catch { }

      viewer.impl.invalidate(true);
    } catch { }
  }, [viewer, rows]);

  // Enable selecting, dragging (move) and resizing (wheel/keys) of placeholders in the overlay
  useEffect(() => {
    if (!viewer) return;
    const THREE = (window as any).THREE;
    if (!THREE) return;
    const overlayName = 'fm-placeholders';
    const vAny: any = viewer;
    if (!vAny._fmOverlayCreated) return; // wait until created by other effect

    const overlayScenes = (viewer.impl.overlayScenes || {}) as any;
    const scn = overlayScenes[overlayName];
    const scene = scn?.scene;
    if (!scene) return;

    if (!vAny._fmPlaceholderMap) vAny._fmPlaceholderMap = new Map<string, any>();
    const map: Map<string, any> = vAny._fmPlaceholderMap as Map<string, any>;
    const raycaster = new THREE.Raycaster();
    const container = viewer.container as HTMLElement;

    const getIntersections = (clientX: number, clientY: number) => {
      const rect = (viewer.impl.canvas || container).getBoundingClientRect();
      const ndc = {
        x: ((clientX - rect.left) / rect.width) * 2 - 1,
        y: -((clientY - rect.top) / rect.height) * 2 + 1
      };
      // Prefer public API camera when available (Forge returns THREE.Camera)
      const camera = (viewer.getCamera?.() || viewer.impl.camera) as any;
      if (!camera) return [] as any[];

      try {
        const THREE = (window as any).THREE;
        const v = new THREE.Vector3(ndc.x, ndc.y, 0.5);
        let origin: any;
        let dir: any;
        if ((camera as any).isPerspectiveCamera) {
          v.unproject(camera);
          origin = camera.position.clone();
          dir = v.sub(origin).normalize();
        } else if ((camera as any).isOrthographicCamera) {
          // For ortho, origin is the unprojected point on near plane, dir is camera forward
          origin = new THREE.Vector3(ndc.x, ndc.y, -1).unproject(camera);
          dir = camera.getWorldDirection(new THREE.Vector3()).normalize();
        } else {
          // Fallback: try unproject-style ray
          v.unproject(camera);
          origin = camera.position?.clone ? camera.position.clone() : new THREE.Vector3(0, 0, 0);
          dir = v.sub(origin).normalize();
        }
        raycaster.set(origin, dir);
      } catch {
        return [] as any[];
      }
      // Only test against meshes that are placeholders
      const objs = [...map.values()];
      return raycaster.intersectObjects(objs, false) as any[];
    };

    const highlightSelection = (id: string | null) => {
      vAny._fmSelectedPlaceholderId = id || null;
      for (const [mid, mesh] of map.entries()) {
        const mat: any = mesh.material;
        if (mat && mat.color) {
          if (id && id === mid) mat.color.setHex(0x00ffff); else mat.color.setHex(0xffcc00);
          mat.needsUpdate = true;
        }
      }
      viewer.impl.invalidate(true);
    };

    let dragging: null | { id: string; dzPlane: number; cursorOffset?: any } = null;

    const worldOnZ = (clientX: number, clientY: number, z: number) => {
      const rect = (viewer.impl.canvas || container).getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((clientY - rect.top) / rect.height) * 2 + 1;
      const camera = viewer.impl.camera;
      if (!camera) return null;
      const mouse = new THREE.Vector3(x, y, 0.5); mouse.unproject(camera);
      const origin = camera.position.clone();
      const dir = mouse.sub(origin).normalize();
      const EPS = 1e-6;
      if (Math.abs(dir.z) < EPS) return null;
      const t = (z - origin.z) / dir.z;
      if (!isFinite(t) || t < 0) return null;
      return origin.clone().add(dir.multiplyScalar(t));
    };

    const onPointerDown = (ev: MouseEvent) => {
      try {
        const ints = getIntersections(ev.clientX, ev.clientY);
        if (ints && ints.length) {
          ev.stopPropagation();
          ev.preventDefault();
          const hit = ints[0];
          const mesh = hit.object as any;
          const id = mesh?.userData?.assetId as string | undefined;
          if (!id) return;
          highlightSelection(id);
          if (ev.button === 0) {
            // start dragging
            const dz = mesh.position?.z ?? 0;
            const p = hit.point || new THREE.Vector3(mesh.position.x, mesh.position.y, dz);
            const offset = new THREE.Vector3(mesh.position.x - p.x, mesh.position.y - p.y, 0);
            dragging = { id, dzPlane: dz, cursorOffset: offset };
            try { viewer.setNavigationLock?.(true); } catch { }
          }
        }
      } catch { }
    };

    const onPointerMove = (ev: MouseEvent) => {
      if (!dragging) return;
      try {
        ev.stopPropagation();
        ev.preventDefault();
        const id = dragging.id;
        const mesh: any = map.get(id);
        if (!mesh) return;
        // Prefer hitTest against model to stick to surfaces
        const res = viewer.impl.hitTest(ev.clientX, ev.clientY, true);
        let pt = res?.point || worldOnZ(ev.clientX, ev.clientY, dragging.dzPlane);
        if (!pt) return;
        const nx = pt.x + (dragging.cursorOffset?.x || 0);
        const ny = pt.y + (dragging.cursorOffset?.y || 0);
        mesh.position.set(nx, ny, dragging.dzPlane);
        // Persist live to rows
        setRows(prev => prev.map(r => r.id === id ? { ...r, placeholderX: nx, placeholderY: ny, placeholderZ: dragging!.dzPlane } : r));
        viewer.impl.invalidate(true);
      } catch { }
    };

    const onPointerUp = (ev: MouseEvent) => {
      if (!dragging) return;
      ev.stopPropagation();
      ev.preventDefault();
      dragging = null;
      try { viewer.setNavigationLock?.(false); } catch { }
    };

    const adjustSize = (id: string, delta: number) => {
      const mesh: any = map.get(id);
      if (!mesh) return;
      const currentBase = Number(mesh.userData?.geomBaseSize) || (rows.find(r => r.id === id)?.placeholderSize ?? 0.3) || 0.3;
      const currentSize = (rows.find(r => r.id === id)?.placeholderSize ?? currentBase) as number;
      let next = currentSize * (1 + delta);
      next = Math.max(0.05, Math.min(10, next));
      const scale = next / currentBase;
      mesh.scale.set(scale, scale, scale);
      // Persist to rows
      setRows(prev => prev.map(r => r.id === id ? { ...r, placeholderSize: next } : r));
      viewer.impl.invalidate(true);
    };

    const onWheel = (ev: WheelEvent) => {
      const selId: string | null = (vAny._fmSelectedPlaceholderId || null) as string | null;
      if (!selId) return;
      // Resize inversely with deltaY
      ev.stopPropagation();
      ev.preventDefault();
      const delta = -ev.deltaY * 0.001; // small increments
      adjustSize(selId, delta);
    };

    const onKeyDown = (ev: KeyboardEvent) => {
      const selId: string | null = (vAny._fmSelectedPlaceholderId || null) as string | null;
      if (!selId) return;
      if (ev.key === '+' || ev.key === '=' ) { ev.preventDefault(); adjustSize(selId, 0.05); }
      if (ev.key === '-' || ev.key === '_' ) { ev.preventDefault(); adjustSize(selId, -0.05); }
      if (ev.key === 'Escape') { highlightSelection(null); }
    };

    container.addEventListener('mousedown', onPointerDown, true);
    window.addEventListener('mousemove', onPointerMove, true);
    window.addEventListener('mouseup', onPointerUp, true);
    container.addEventListener('wheel', onWheel, { capture: true, passive: false } as any);
    window.addEventListener('keydown', onKeyDown, true);

    return () => {
      container.removeEventListener('mousedown', onPointerDown, true);
      window.removeEventListener('mousemove', onPointerMove, true);
      window.removeEventListener('mouseup', onPointerUp, true);
      container.removeEventListener('wheel', onWheel as any, true as any);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [viewer, rows]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-3 border-b border-gray-800">
        <div className="flex items-center justify-between mb-2">
          <div className="text-white font-semibold text-sm">Asset List</div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] px-2 py-0.5 rounded bg-gray-800 border border-gray-700 text-gray-300">{rows.length} items</span>
            <button
              onClick={() => {
                clearAssetCache(projectId);
                // Reload assets after cache clear
                setRows([] as AssetRecord[]);
                setTimeout(() => {
                  const cached = load(K.assets(projectId), [] as AssetRecord[]);
                  const filtered = filterAssetsForCurrentModel(cached);
                  const deduped = dedupeAssets(filtered);
                  setRows(deduped);
                  showToast('success', 'Cache cleared and reloaded');
                }, 100);
              }}
              className="text-[11px] px-2 py-0.5 rounded bg-grey-900/40 border border-gray-700 text-gray-300 hover:bg-grey-900/60 transition"
              title="Clear cache and reload fresh data"
            >
              Clear Cache
            </button>
          </div>
        </div>

        {/* BIM Asset Extraction */}
        <div className="mb-2 space-y-2">
          <button
            onClick={extractAssetsFromBIM}
            disabled={isExtracting}
            className={`w-full text-xs py-2 px-3 rounded-md font-medium transition ${isExtracting
              ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
              : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
          >
            {isExtracting ? `Extracting... ${extractionProgress.toFixed(0)}%` : 'Extract from BIM'}
          </button>
          {isExtracting && (
            <div className="bg-gray-800 rounded-full h-1">
              <div
                className="bg-green-500 h-1 rounded-full transition-all duration-300"
                style={{ width: `${extractionProgress}%` }}
              />
            </div>
          )}
        </div>

  {/* In-memory Edit Asset modal trigger is per-row in Actions column below */}

        {/* Controls: Show/Hide & Filters toggles */}
        <div className="grid grid-cols-2 gap-2">
          <button
            className={`w-full inline-flex items-center justify-center gap-1 text-xs px-2 py-1 rounded border ${fieldsOpen ? 'text-white border-gray-500 bg-gray-700' : 'text-gray-300 border-gray-700 bg-gray-800/60 hover:bg-gray-700'}`}
            onClick={() => { if (fieldsOpen) { setFieldsOpen(false); } else { setFieldsOpen(true); setFiltersOpen(false); } }}
          >
            Show/Hide Fields
          </button>
          <button
            className={`w-full inline-flex items-center justify-center gap-1 text-xs px-2 py-1 rounded border ${filtersOpen ? 'text-white border-gray-500 bg-gray-700' : 'text-gray-300 border-gray-700 bg-gray-800/60 hover:bg-gray-700'}`}
            onClick={() => { if (filtersOpen) { setFiltersOpen(false); } else { setFiltersOpen(true); setFieldsOpen(false); } }}
          >
            Filters
          </button>
        </div>

        {/* Full-width content panels below */}
        {fieldsOpen && (
          <div className="mt-2 p-2 text-xs bg-gray-900/60 rounded border border-gray-800 w-full">
            <div className="grid grid-cols-2 gap-2">
              {/* Basic checkbox - always checked and disabled */}
              <label className="flex items-center gap-1 text-gray-300 cursor-not-allowed opacity-75">
                <input
                  type="checkbox"
                  checked={true}
                  disabled={true}
                  className="w-3 h-3"
                />
                <span>Basic</span>
              </label>
              
              {[
                ['Identification', 'identification'],
                ['Technical', 'technical'],
                ['Documentation', 'documentation'],
                ['Lifecycle', 'lifecycle'],
                ['Economic', 'economic'],
                ['Compliance', 'compliance'],
                ['Relationships', 'relationships']
              ].map(([label, key]) => (
                <label key={key} className="flex items-center gap-1 text-gray-300">
                  <input
                    type="checkbox"
                    checked={visibleFields[key as keyof typeof visibleFields]}
                    onChange={() => toggleField(key as keyof typeof visibleFields)}
                    className="w-3 h-3"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {filtersOpen && (
          <div className="mt-2 p-2 bg-gray-900/60 rounded border border-gray-800 w-full">
            <div className="grid grid-cols-3 gap-2">
              <select value={filter.category} onChange={e => setFilter(f => ({ ...f, category: e.target.value }))} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-xs">
                <option value="">Revit Categories</option>
                {assetCategories.map(cat => {
                  const isMaster = assetCategoryMasterOptions.includes(cat);
                  return (
                    <option key={cat} value={cat}>
                      {cat}{!isMaster ? '' : ''}
                    </option>
                  );
                })}
              </select>
              {/* IFC Class Filter (next to Revit Categories) */}
              <select value={filter.ifcClass} onChange={e => setFilter(f => ({ ...f, ifcClass: e.target.value }))} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-xs">
                <option value="">Ifc Class</option>
                {IFCCLASSES_UNIQUE.map(ic => <option key={ic} value={ic}>{ic}</option>)}
              </select>
              <select value={filter.type} onChange={e => setFilter(f => ({ ...f, type: e.target.value }))} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-xs">
                <option value="">All Types</option>
                {distinct.types.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
              <select value={filter.location} onChange={e => setFilter(f => ({ ...f, location: e.target.value }))} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-xs">
                <option value="">All Locations</option>
                {distinct.locations.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
              <select value={filter.classification} onChange={e => setFilter(f => ({ ...f, classification: e.target.value }))} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-xs">
                <option value="">All Classifications</option>
                {distinct.classifications.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
              <button
                onClick={toggleShowSelected}
                className={`w-full text-white text-xs py-1 rounded ${filter.selectedOnly ? 'bg-amber-600 hover:bg-amber-700' : 'bg-gray-700 hover:bg-gray-600'}`}
              >
                Show Selected
              </button>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 w-full">
              <button
                onClick={applyFilterToViewer}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs py-1 rounded"
              >
                Apply to Model
              </button>
              <button
                onClick={exportCSV}
                className="w-full bg-gray-700 hover:bg-gray-600 text-white text-xs py-1 rounded"
              >
                Export CSV
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-gray-800/90 backdrop-blur border-b border-gray-700 text-gray-300">
            <tr>
              <th className="px-2 py-1.5 w-8">
                <input
                  type="checkbox"
                  checked={paginatedRows.length > 0 && paginatedRows.every(r => selectedIds.has(r.id))}
                  onChange={toggleSelectAll}
                />
              </th>
              {visibleFields.basic && (
                <>
                  <th className="text-left px-2 py-1.5 cursor-pointer select-none" onClick={() => handleSort('source')}>Source{sortIndicator('source')}</th>
                  <th className="text-left px-2 py-1.5 cursor-pointer select-none" onClick={() => handleSort('category')}>Category{sortIndicator('category')}</th>
                  <th className="text-left px-2 py-1.5 cursor-pointer select-none" onClick={() => handleSort('type')}>Type{sortIndicator('type')}</th>
                  <th className="text-left px-2 py-1.5 cursor-pointer select-none" onClick={() => handleSort('brand')}>Brand{sortIndicator('brand')}</th>
                  <th className="text-left px-2 py-1.5 cursor-pointer select-none" onClick={() => handleSort('model')}>Model{sortIndicator('model')}</th>
                  <th className="text-left px-2 py-1.5 cursor-pointer select-none" onClick={() => handleSort('ifcClass')}>Ifc Class{sortIndicator('ifcClass')}</th>
                </>
              )}
              {visibleFields.identification && (
                <>
                  <th className="text-left px-2 py-1.5 cursor-pointer select-none" onClick={() => handleSort('assetCode')}>Code{sortIndicator('assetCode')}</th>
                  <th className="text-left px-2 py-1.5 cursor-pointer select-none" onClick={() => handleSort('assetName')}>Name{sortIndicator('assetName')}</th>
                  <th className="text-left px-2 py-1.5 cursor-pointer select-none" onClick={() => handleSort('serialNumber')}>Serial{sortIndicator('serialNumber')}</th>
                  <th className="text-left px-2 py-1.5 cursor-pointer select-none" onClick={() => handleSort('installationDate')}>Install Date{sortIndicator('installationDate')}</th>
                </>
              )}
              {visibleFields.technical && (
                <>
                  <th className="text-left px-2 py-1.5 cursor-pointer select-none" onClick={() => handleSort('material')}>Material{sortIndicator('material')}</th>
                  <th className="text-left px-2 py-1.5 cursor-pointer select-none" onClick={() => handleSort('dimensions')}>Dimensions{sortIndicator('dimensions')}</th>
                  <th className="text-left px-2 py-1.5 cursor-pointer select-none" onClick={() => handleSort('capacity')}>Capacity{sortIndicator('capacity')}</th>
                </>
              )}
              {visibleFields.documentation && (
                <>
                  <th className="text-left px-2 py-1.5 cursor-pointer select-none" onClick={() => handleSort('manuals')}>Manuals{sortIndicator('manuals')}</th>
                  <th className="text-left px-2 py-1.5 cursor-pointer select-none" onClick={() => handleSort('warranties')}>Warranties{sortIndicator('warranties')}</th>
                </>
              )}
              {visibleFields.lifecycle && (
                <>
                  <th className="text-left px-2 py-1.5 cursor-pointer select-none" onClick={() => handleSort('condition')}>Condition{sortIndicator('condition')}</th>
                  <th className="text-left px-2 py-1.5 cursor-pointer select-none" onClick={() => handleSort('expectedLife')}>Expected Life{sortIndicator('expectedLife')}</th>
                </>
              )}
              {visibleFields.economic && (
                <>
                  <th className="text-left px-2 py-1.5 cursor-pointer select-none" onClick={() => handleSort('purchaseCost')}>Purchase Cost{sortIndicator('purchaseCost')}</th>
                  <th className="text-left px-2 py-1.5 cursor-pointer select-none" onClick={() => handleSort('maintenanceCost')}>Maintenance Cost{sortIndicator('maintenanceCost')}</th>
                </>
              )}
              {visibleFields.compliance && (
                <>
                  <th className="text-left px-2 py-1.5 cursor-pointer select-none" onClick={() => handleSort('regulations')}>Regulations{sortIndicator('regulations')}</th>
                  <th className="text-left px-2 py-1.5 cursor-pointer select-none" onClick={() => handleSort('safetyNotes')}>Safety{sortIndicator('safetyNotes')}</th>
                </>
              )}
              {visibleFields.relationships && (
                <>
                  <th className="text-left px-2 py-1.5 cursor-pointer select-none" onClick={() => handleSort('suppliers')}>Suppliers{sortIndicator('suppliers')}</th>
                </>
              )}
              <th className="text-left px-2 py-1.5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={20} className="px-3 py-4 text-center text-gray-400">
                  {filter.category || filter.type || filter.location || filter.ifcClass || filter.classification
                    ? 'No assets available'
                    : 'No assets. Use "Create new asset".'}
                </td>
              </tr>
            ) : paginatedRows.map(r => (
              <tr key={r.id} className="border-b border-gray-800 hover:bg-gray-800/60 cursor-pointer" onClick={() => onRowClick(r)}>
                <td className="px-2 py-1.5 w-8" onClick={e => e.stopPropagation()}>
                  <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSelect(r.id)} />
                </td>
                {visibleFields.basic && (
                  <>
                    <td className="px-2 py-1.5">
                      <span className={`text-xs px-2 py-0.5 rounded ${r.source === 'BIM_MODEL'
                        ? 'bg-green-900/40 text-green-300'
                        : 'bg-blue-900/40 text-blue-300'
                        }`}>
                        {r.source === 'BIM_MODEL' ? 'BIM' : 'Manual'}
                      </span>
                      {r.conflictWithId && <span className="ml-2 text-[10px] text-red-300">⚠ Conflict</span>}
                    </td>
                    <td className="px-2 py-1.5 text-gray-100">{stripRevitPrefix(r.category) || '-'}</td>
                    <td className="px-2 py-1.5 text-gray-200">{r.type || '-'}</td>
                    <td className="px-2 py-1.5 text-gray-200">{r.brand || '-'}</td>
                    <td className="px-2 py-1.5 text-gray-200">{r.model || '-'}</td>
                    <td className="px-2 py-1.5 text-gray-200">{r.ifcClass || 'Unknown'}</td>
                  </>
                )}
                {visibleFields.identification && (
                  <>
                    <td className="px-2 py-1.5 text-gray-200">{r.assetCode || '-'}</td>
                    <td className="px-2 py-1.5 text-gray-200">{r.assetName || '-'}</td>
                    <td className="px-2 py-1.5 text-gray-200">{r.serialNumber || '-'}</td>
                    <td className="px-2 py-1.5 text-gray-200">{r.installationDate || '-'}</td>
                  </>
                )}
                {visibleFields.technical && (
                  <>
                    <td className="px-2 py-1.5 text-gray-200">{r.material || '-'}</td>
                    <td className="px-2 py-1.5 text-gray-200">{r.dimensions || '-'}</td>
                    <td className="px-2 py-1.5 text-gray-200">{r.capacity || '-'}</td>
                  </>
                )}
                {visibleFields.documentation && (
                  <>
                    <td className="px-2 py-1.5 text-gray-200">
                      {r.manuals ? (
                        <div className="flex flex-wrap gap-1">
                          {r.manuals.split(', ').map((fileName, idx) => (
                            <button
                              key={idx}
                              onClick={(e) => { 
                                e.stopPropagation();
                                const openFile = async () => {
                                  try {
                                    const response = await fetch(`/api/projects/${projectId}/files/by-name?fileName=${encodeURIComponent(fileName)}`);
                                    if (response.ok) {
                                      const fileRecord = await response.json();
                                      setPdfModal({ open: true, fileId: fileRecord._id || fileRecord.fileId, fileName: fileName });
                                    } else {
                                      showToast('error', `File "${fileName}" not found`);
                                    }
                                  } catch (err) {
                                    console.error('Error opening file:', err);
                                    showToast('error', 'Failed to open file');
                                  }
                                };
                                openFile();
                              }}
                              className="text-blue-400 hover:text-blue-300 underline text-xs break-all"
                              title={`Open ${fileName}`}
                            >
                              {fileName}
                            </button>
                          ))}
                        </div>
                      ) : '-'}
                    </td>
                    <td className="px-2 py-1.5 text-gray-200">{r.warranties || '-'}</td>
                  </>
                )}
                {visibleFields.lifecycle && (
                  <>
                    <td className="px-2 py-1.5 text-gray-200">{r.condition || '-'}</td>
                    <td className="px-2 py-1.5 text-gray-200">{r.expectedLife || '-'}</td>
                  </>
                )}
                {visibleFields.economic && (
                  <>
                    <td className="px-2 py-1.5 text-gray-200">{r.purchaseCost || '-'}</td>
                    <td className="px-2 py-1.5 text-gray-200">{r.maintenanceCost || '-'}</td>
                  </>
                )}
                {visibleFields.compliance && (
                  <>
                    <td className="px-2 py-1.5 text-gray-200">{r.regulations || '-'}</td>
                    <td className="px-2 py-1.5 text-gray-200">{r.safetyNotes || '-'}</td>
                  </>
                )}
                {visibleFields.relationships && (
                  <>
                    <td className="px-2 py-1.5 text-gray-200">{r.suppliers || '-'}</td>
                  </>
                )}
                <td className="px-2 py-1.5">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); openEditAsset(r); }}
                      title="Edit Asset"
                      className="inline-flex items-center justify-center h-6 px-2 rounded border text-[11px] bg-amber-800/30 border-amber-700 text-amber-200 hover:bg-amber-800/50"
                    >Edit</button>
                    {r.source === 'MANUAL' && (
                      <>
                      <select
                        value={r.placeholderShape || 'cube'}
                        onClick={e => e.stopPropagation()}
                        onChange={e => { e.stopPropagation(); const val = e.target.value as 'cube' | 'sphere'; setRows(prev => prev.map(x => x.id === r.id ? { ...x, placeholderShape: val } : x)); }}
                        className="bg-gray-800 border border-gray-700 rounded px-1 py-0.5 text-[11px] text-white"
                      >
                        <option value="cube">Cube</option>
                        <option value="sphere">Sphere</option>
                      </select>
                      <input
                        onClick={e => e.stopPropagation()}
                        value={r.placeholderSize ?? 0.3}
                        onChange={e => { const n = Number(e.target.value) || 0.3; setRows(prev => prev.map(x => x.id === r.id ? { ...x, placeholderSize: n } : x)); }}
                        className="w-12 bg-gray-800 border border-gray-700 rounded px-1 py-0.5 text-[11px] text-white"
                        placeholder="m"
                      />
                      <button
                        onClick={(e) => { e.stopPropagation(); placeManual(r); }}
                        disabled={placingAssetId === r.id}
                        className={`text-xs text-white px-2 py-0.5 rounded ${placingAssetId === r.id ? 'bg-gray-600 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'}`}
                      >
                        {placingAssetId === r.id ? 'Placing…' : (r.placeholderX == null ? 'Place' : 'Re-place')}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); confirmDelete(r); }}
                        title="Delete"
                        className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded border text-[12px] font-bold bg-red-900/30 border-red-700 text-red-300 hover:bg-red-800/40"
                      >
                        ×
                      </button>
                      </>
                    )}
                    {r.conflictWithId && (
                      <button onClick={(e) => { e.stopPropagation(); openConflictResolver(r); }} className="ml-2 text-[10px] text-red-300 underline">Resolve</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Conflict Resolution Modal */}
      {conflictModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded p-3 resize overflow-auto" style={{ width: '320px', minWidth: '280px', minHeight: '200px' }}>
            <div className="text-white text-sm font-semibold mb-2">Resolve Conflict</div>
            <div className="text-xs text-gray-300 mb-2">Choose how to resolve the BIM vs Manual conflict.</div>
            <div className="grid grid-cols-1 gap-2">
              <button className="bg-emerald-700 hover:bg-emerald-600 text-white text-xs py-1 rounded" onClick={resolveLink}>Link (keep both)</button>
              <button className="bg-blue-700 hover:bg-blue-600 text-white text-xs py-1 rounded" onClick={resolveMerge}>Merge into Manual (hide BIM)</button>
              <button className="bg-gray-700 hover:bg-gray-600 text-white text-xs py-1 rounded" onClick={resolveKeepBoth}>Keep both (dismiss)</button>
              <button className="bg-red-800 hover:bg-red-700 text-white text-xs py-1 rounded" onClick={() => setConflictModal({ open: false })}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-[1000]">
          <div className={`px-3 py-2 rounded text-xs shadow border ${toast.type === 'success' ? 'bg-emerald-800/80 text-emerald-100 border-emerald-700' :
            toast.type === 'error' ? 'bg-red-800/80 text-red-100 border-red-700' :
              'bg-gray-800/80 text-gray-100 border-gray-700'
            }`}>
            {toast.text}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1001]" onClick={() => setDeleteModal({ open: false })}>
          <div className="bg-gray-900 border border-gray-700 rounded p-3 w-[320px]" onClick={e => e.stopPropagation()}>
            <div className="text-white text-sm font-semibold mb-2">Delete asset?</div>
            <div className="text-xs text-gray-300 mb-3">Are you sure you want to permanently delete <span className="text-red-300">{deleteModal.label}</span>?</div>
            <div className="flex items-center justify-end gap-2">
              <button className="px-3 py-1.5 rounded text-xs bg-gray-700 hover:bg-gray-600 text-white" onClick={() => setDeleteModal({ open: false })}>Cancel</button>
              <button className="px-3 py-1.5 rounded text-xs bg-red-700 hover:bg-red-600 text-white" onClick={performDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Asset Modal - reuse CreateAsset UI so the edit dialog is identical to create */}
      {editModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1001]" onClick={() => { setEditModal({ open: false }); setEditQueue([]); setEditIndex(0); setBulkEditMode(false); setBulkEditIds([]); setBulkCategoryLabel(''); }}>
          <div className="bg-gray-900 border border-gray-700 rounded p-3 w-[1100px] max-w-[98vw] max-h-[90vh] overflow-auto resize" style={{ minWidth: '640px', minHeight: '420px', resize: 'both' }} onClick={e => e.stopPropagation()}>
            <CreateAsset
              projectId={projectId}
              viewer={viewer}
              title={bulkEditMode ? `Bulk Edit ${bulkEditIds.length} Assets${bulkCategoryLabel ? ` — ${bulkCategoryLabel}` : ''}` : `Edit Asset${editQueue.length > 1 ? ` (${editIndex+1}/${editQueue.length})` : ''}`}
              initial={edit}
              mode="edit"
              bulkEditMode={bulkEditMode}
              onSaveOverride={async (rec) => {
                try {
                  if (bulkEditMode) {
                    // BULK EDIT: Apply changes to all selected assets
                    console.log('📋 [Bulk Edit Override] Starting bulk edit for', bulkEditIds.length, 'assets');
                    console.log('📋 [Bulk Edit Override] Received form data:', rec);
                    
                    // Get only the non-empty fields (user only fills in what they want to apply)
                    const filledFields = Object.entries(rec)
                      .filter(([_key, value]) => value !== '' && value !== undefined && value !== null)
                      .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {} as Partial<AssetRecord>);
                    
                    console.log('� [Bulk Edit Override] Filled fields to apply:', filledFields);
                    
                    // Don't allow bulk edit of assetCode and assetName (these should be per-asset)
                    const forbiddenFields = ['assetCode', 'assetName', 'id', 'dbId', 'source'];
                    forbiddenFields.forEach(f => delete (filledFields as any)[f]);
                    
                    console.log('📋 [Bulk Edit Override] Final fields to apply (forbidden removed):', filledFields);
                    
                    let updatedRows: AssetRecord[] = [];
                    
                    setRows(prev => {
                      let next = prev.map(r => 
                        bulkEditIds.includes(r.id) 
                          ? { ...r, ...filledFields, userEdited: true } 
                          : r
                      );
                      console.log('📋 [Bulk Edit Override] Updated', bulkEditIds.length, 'assets');
                      updatedRows = next;
                      return next;
                    });
                    
                    // Save to localStorage
                    try {
                      const key = K.assets(projectId);
                      save(key, updatedRows);
                      console.log('💾 [Bulk Edit Override] Saved to localStorage');
                    } catch {}
                    
                    // Persist to backend for each asset
                    try {
                      await Promise.allSettled(
                        bulkEditIds.map(id => persistEditToBackend(id, filledFields))
                      );
                    } catch {}
                    
                    try { window.dispatchEvent(new CustomEvent('asset-updated', { detail: { projectId } })); } catch {}
                    showToast('success', `Bulk edit applied to ${bulkEditIds.length} assets`);
                    
                    // Close modal and reset bulk edit mode
                    setEditModal({ open: false });
                    setBulkEditMode(false);
                    setBulkEditIds([]);
                    setSelectedIds(new Set());
                  } else {
                    // SINGLE EDIT (original sequential logic)
                    console.log('�🔧 [Edit Override] Starting edit save for asset:', editModal.id);
                    console.log('🔧 [Edit Override] Received form data:', rec);
                    
                    const id = editModal.id;
                    if (!id) throw new Error('Missing edit id');
                    
                    const current = rows.find(r => r.id === id);
                    console.log('🔧 [Edit Override] Current asset being edited:', current);
                    
                    const oldConflict = current?.conflictWithId;
                    const fields = pickEditable(rec);
                    
                    console.log('🔧 [Edit Override] Picked editable fields:', fields);
                    
                    // Don't convert source - keep BIM as BIM, Manual as Manual
                    const mergedFields = { ...fields, conflictWithId: undefined } as Partial<AssetRecord>;
                    
                    console.log('🔧 [Edit Override] Merged fields to apply:', mergedFields);
                    console.log('🔧 [Edit Override] Current source:', current?.source);
                    
                    // Capture the updated rows for localStorage save
                    let updatedRows: AssetRecord[] = [];
                    
                    setRows(prev => {
                      console.log('🔧 [Edit Override] setRows - updating asset with ID:', id);
                      let next = prev.map(r => r.id === id ? { ...r, ...mergedFields, userEdited: true } : r);
                      next = next.map(r => {
                        if (r.id !== id && (r.conflictWithId === id || (oldConflict && r.id === oldConflict))) {
                          return { ...r, conflictWithId: undefined, hidden: true, linkedAssetId: id };
                        }
                        return r;
                      });
                      console.log('🔧 [Edit Override] setRows - Updated rows count:', next.length);
                      console.log('🔧 [Edit Override] setRows - Updated asset:', next.find(r => r.id === id));
                      updatedRows = next; // Capture for localStorage save
                      return next;
                    });
                    
                    // IMPORTANT: Save updated rows to localStorage immediately to preserve userEdited flag
                    try {
                      const key = K.assets(projectId);
                      save(key, updatedRows);
                      console.log('💾 [Edit Override] Saved to localStorage with userEdited flag');
                    } catch {}
                    
                    // persist to backend if possible
                    await persistEditToBackend(id, mergedFields);
                    // Persist any BIM counterparts we modified locally
                    try {
                      const counterparts = rows.filter(r => r.id !== id && (r.conflictWithId === id || (oldConflict && r.id === oldConflict)));
                      await Promise.allSettled(counterparts.map(c => {
                        const upd: Partial<AssetRecord> = { conflictWithId: undefined, hidden: true, linkedAssetId: id } as any;
                        return persistEditToBackend(c.id, upd);
                      }));
                    } catch {}
                    try { window.dispatchEvent(new CustomEvent('asset-updated', { detail: { projectId, id } })); } catch {}
                    showToast('success', 'Asset updated');
                    
                    // If editing a sequence, move to next; else close
                    setTimeout(() => {
                      setEditModal(prev => {
                        if (editQueue.length > 0 && editIndex < editQueue.length - 1) {
                          const nextIndex = editIndex + 1;
                          const nextId = editQueue[nextIndex];
                          const next = rows.find(r => r.id === nextId);
                          if (next) {
                            setEditIndex(nextIndex);
                            setEdit({ ...pickEditable(next) });
                            setEditSection('basic');
                            return { open: true, id: nextId };
                          }
                        }
                        // Done with sequence
                        setEditQueue([]);
                        setEditIndex(0);
                        return { open: false };
                      });
                    }, 50);
                  }
                } catch (err) {
                  console.error('[EditModal] onSaveOverride error', err);
                  showToast('error', 'Failed to update asset' + (bulkEditMode ? 's' : ''));
                  throw err;
                }
              }}
            />
          </div>
        </div>
      )}

      {/* Bottom Action Bar: Edit Selected (sequential) and Schedule Maintenance */}
      {selectedIds.size > 0 && (
        <div className="px-2 py-1.5 border-t border-gray-800 flex justify-end gap-2">
          <button
            onClick={startSequentialEdit}
            className="text-[11px] py-1 px-2 rounded border border-amber-500 bg-amber-600/20 hover:bg-amber-600/40 text-amber-200 transition"
            title="Edit selected assets one by one"
          >
            Edit Selected ({selectedIds.size})
          </button>
          {onScheduleMaintenance && (
            <button
              onClick={() => {
                const selectedAssets = rows.filter(r => selectedIds.has(r.id));
                onScheduleMaintenance(selectedAssets);
              }}
              className="text-[11px] py-1 px-2 rounded border border-blue-500 bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 transition"
            >
              Schedule Maintenance ({selectedIds.size})
            </button>
          )}
        </div>
      )}

      {/* Bottom Pagination Controls */}
      <div className="flex items-center justify-between px-2 py-2 text-[11px] text-gray-300 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="whitespace-nowrap">Rows:</span>
          <select
            value={pageSize}
            onChange={e => setPageSize(parseInt(e.target.value, 10))}
            className="h-6 bg-gray-800/80 border border-gray-700 rounded px-2 text-[11px] focus:outline-none focus:border-gray-500"
          >
            {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="flex-1 text-center text-gray-400 truncate">
          {filteredRows.length === 0 ? '0' : `${startIndex + 1}-${Math.min(endIndex, filteredRows.length)}`} of {filteredRows.length}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={pageClamped <= 1}
            className={`h-6 w-6 grid place-items-center rounded border ${pageClamped <= 1 ? 'text-gray-500 border-gray-700' : 'text-white border-gray-600 hover:bg-gray-700'}`}
            aria-label="Previous page"
          >
            &#8249;
          </button>
          <span className="mx-1 whitespace-nowrap">{pageClamped}/{totalPages}</span>
          <div className="mx-2 flex items-center gap-1">
            <input
              type="number"
              min={1}
              max={totalPages}
              value={jumpPage}
              onChange={e => setJumpPage(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const n = Math.max(1, Math.min(totalPages, Number(e.currentTarget.value || 1)));
                  setPage(n);
                  setJumpPage('');
                }
              }}
              placeholder="#"
              className="w-12 h-6 text-xs bg-gray-800 border border-gray-700 rounded px-1 text-white"
            />
            <button
              onClick={() => {
                const n = Math.max(1, Math.min(totalPages, Number(jumpPage || pageClamped)));
                setPage(n);
                setJumpPage('');
              }}
              className="h-6 px-2 rounded bg-gray-700 hover:bg-gray-600 text-white text-xs"
            >Go</button>
          </div>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={pageClamped >= totalPages}
            className={`h-6 w-6 grid place-items-center rounded border ${pageClamped >= totalPages ? 'text-gray-500 border-gray-700' : 'text-white border-gray-600 hover:bg-gray-700'}`}
            aria-label="Next page"
          >
            &#8250;
          </button>
        </div>
      </div>

      {/* PDF Viewer Modal */}
      {pdfModal.open && pdfModal.fileId && projectId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1002]" onClick={() => setPdfModal({ open: false })}>
          <div className="bg-gray-900 border border-gray-700 rounded w-[95vw] h-[95vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex-1 overflow-hidden">
              <PdfViewer
                projectId={projectId}
                fileId={pdfModal.fileId}
                fileName={pdfModal.fileName}
                onClose={() => setPdfModal({ open: false })}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

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
  const [activeSection, setActiveSection] = useState<'identification' | 'technical' | 'documentation' | 'lifecycle' | 'maintenance' | 'economic' | 'compliance' | 'relationships'>('identification');
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
        // Bulk edit must start with a clean form so no stale values are applied
        setF({ ...EMPTY_FORM });
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
            body: JSON.stringify({ action: 'upsert', asset: rec })
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

      // Clear draft after successful save
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
    { key: 'relationships' as const, label: 'Links & Relationships' }
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
        rawCategory: ['Category', 'Categoria', 'Type', 'Tipo', 'Nome del tipo', 'Category Name']
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
      const rawCategory = pickAlias('rawCategory') || pick('Category', 'Categoria', 'OmniClass Title', 'OmniClass', 'Tipo');
      const category = mapToStandardCategory(rawCategory);
      const dimensions = (length || width || height) ? `${length || ''} x ${width || ''} x ${height || ''}`.replace(/\s+x\s+x\s+/, '').trim() : undefined;

      setF(v => ({
        ...v,
        // Replace with new selection data (clear fields if not present in new selection)
        brand: brand,
        model: modelName,
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
            <div><label className="text-[11px] text-gray-300 block mb-1">Asset Name {bulkEditMode && <span className="text-red-400">(disabled)</span>}</label><input disabled={bulkEditMode} placeholder="Description attribute" value={f.assetName || ''} onChange={e => updateField('assetName', e.target.value)} className={`w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs ${bulkEditMode ? 'opacity-50 cursor-not-allowed' : ''}`} /></div>
            <div><label className="text-[11px] text-gray-300 block mb-1">Asset Code</label><input disabled placeholder="Leave empty" value="" className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs opacity-50 cursor-not-allowed" /></div>
            <div><label className="text-[11px] text-gray-300 block mb-1">BIM ID (ElementId)</label><input value={f.elementId || ''} onChange={e => updateField('elementId' as any, e.target.value)} placeholder="Unique BIM Element ID" className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" /></div>
            <div><label className="text-[11px] text-gray-300 block mb-1">IFC GUID</label><input value={f.ifcGuid || ''} onChange={e => updateField('ifcGuid', e.target.value)} placeholder="IFC Global ID" className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" /></div>
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

const SpaceList: React.FC<{ projectId?: string; viewer?: any; }> = ({ projectId, viewer }) => {
  // Start empty to avoid reading localStorage during SSR (prevents hydration mismatch).
  const [rows, setRows] = useState<SpaceRecord[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState(0);
  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  // Delete modal
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; id?: string; name?: string }>({ open: false });
  // Edit modal
  const [editModal, setEditModal] = useState<{ open: boolean; space?: SpaceRecord }>({ open: false });

  // Persist spaces to local storage to avoid flicker on minimize/restore and enable instant load
  useEffect(() => {
    try { save(K.spaces(projectId), rows); } catch {}
  }, [rows, projectId]);

  // Hydrate from localStorage on client after mount. This avoids SSR/CSR mismatch.
  useEffect(() => {
    try {
      const persisted: SpaceRecord[] = load(K.spaces(projectId), [] as SpaceRecord[]);
      if (Array.isArray(persisted) && persisted.length > 0 && rows.length === 0) {
        // Filter to current model (if known) to avoid cross-model mixing on hydrate
        let mg: string | undefined;
        try {
          const g = viewer?.model?.getData?.()?.guid;
          if (g && typeof g === 'string') mg = g; else {
            const mid = viewer?.model?.id;
            if (mid != null) mg = String(mid);
          }
          if (!mg && projectId) {
            const ctxRaw = localStorage.getItem(`fm-context-${projectId}`);
            if (ctxRaw) { const ctx = JSON.parse(ctxRaw || '{}'); if (ctx?.modelGuid) mg = String(ctx.modelGuid); }
          }
        } catch {}
        const filtered = mg ? persisted.filter(r => r.source !== 'BIM_MODEL' || r.modelGuid === mg) : persisted;
        setRows(filtered);
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Helper to get current model GUID (if viewer is present)
  // Get unique model identifier combining guid+urn to handle cases where multiple models have same guid
  const getCurrentModelGuid = React.useCallback((): string | undefined => {
    try {
      const g = viewer?.model?.getData?.()?.guid;
      const urn = viewer?.model?.getData?.()?.urn || (viewer?.impl?.model?.myData?.urn);
      
      // Create composite key: guid|urn to ensure uniqueness across different models
      let compositeKey = '';
      if (g && typeof g === 'string') {
        compositeKey = g;
        // Append URN hash to distinguish models with same guid
        if (urn && typeof urn === 'string') {
          compositeKey = `${g}|${urn}`;
        }
      } else {
        const mid = viewer?.model?.id;
        if (mid != null) {
          compositeKey = String(mid);
          if (urn && typeof urn === 'string') {
            compositeKey = `${mid}|${urn}`;
          }
        }
      }
      
      if (compositeKey) return compositeKey;
      
      // Fallback to persisted fm-context (standalone)
      try {
        const ctxRaw = projectId ? localStorage.getItem(`fm-context-${projectId}`) : null;
        if (ctxRaw) { const ctx = JSON.parse(ctxRaw || '{}'); if (ctx?.modelGuid) return String(ctx.modelGuid); }
      } catch {}
      return undefined;
    } catch { return undefined; }
  }, [viewer, projectId]);

  // Merge server-returned rows with persisted client-side rows to avoid losing locally extracted/prefilled fields
  const mergeWithPersisted = (normalized: SpaceRecord[]): SpaceRecord[] => {
    try {
      const persisted: SpaceRecord[] = load(K.spaces(projectId), [] as SpaceRecord[]);
      // Use getCurrentModelGuid for consistent composite key (guid|urn)
      const mg = getCurrentModelGuid();
      const map = new Map<string, SpaceRecord>();
      const keyOf = (r: SpaceRecord) => (
        r.source === 'BIM_MODEL' && r.dbId != null ? `BIM|${r.modelGuid || 'g'}|${r.dbId}` : `MAN|${r.id}`
      );
      // seed with server rows
      for (const r of normalized) map.set(keyOf(r), r);
      // overlay persisted non-empty values so we don't lose metrics/building filled by extract or user
      for (const p of persisted) {
        // Skip persisted BIM rows from other models to prevent cross-model mixing
        if (p.source === 'BIM_MODEL' && mg && p.modelGuid && p.modelGuid !== mg) {
          console.log(`[Spaces][merge] SKIP persisted BIM row from different model: dbId=${p.dbId}, name=${p.name}, modelGuid=${p.modelGuid} (current=${mg})`);
          continue;
        }
        const k = keyOf(p);
        const target = map.get(k);
        if (!target) {
          map.set(k, p);
          continue;
        }
        const out = { ...target } as SpaceRecord;
        // fields we want to preserve if persisted has them
        const prefer = ['building', 'area', 'perimeter', 'volume', 'occupancy', 'description', 'name', 'spaceCode'];
        for (const f of prefer) {
          const val = (p as any)[f];
          if (val != null && val !== '' && !(typeof val === 'number' && Number(val) === 0)) {
            (out as any)[f] = val;
          }
        }
        map.set(k, out);
      }
      return Array.from(map.values());
    } catch (err) {
      return normalized;
    }
  };

  // Load from backend (scoped by model when possible)
  useEffect(() => {
    const run = async () => {
      if (!projectId) return;
      try {
        const mg = getCurrentModelGuid();
        console.log(`[Spaces] Initial load with modelGuid=${mg}`);
        // Prepare floors for display normalization
        let floors: any[] = [];
        try {
          let ext = (viewer && typeof viewer.getExtension === 'function') ? viewer.getExtension('Autodesk.AEC.LevelsExtension') : null;
          if (!ext && viewer && typeof (viewer as any).loadExtension === 'function') {
            try { ext = await (viewer as any).loadExtension('Autodesk.AEC.LevelsExtension'); } catch {}
          }
          const fs = (ext as any)?.floorSelector;
          floors = Array.isArray(fs?.floorData) ? fs.floorData : [];
        } catch {}
        const normalizeLevel = (lv: any) => {
          try {
            const s = lv != null ? String(lv) : '';
            if (!s) return undefined;
            const n = Number(s);
            if (!isNaN(n) && floors[n]?.name) return String(floors[n].name);
            const m = s.match(/(^|\D)(\d{1,2})(\D|$)/);
            if (m && floors[Number(m[2])]?.name) return String(floors[Number(m[2])].name);
            return s;
          } catch { return lv; }
        };
        const inferLevelByDbId = (dbId?: number | null): string | undefined => {
          try {
            if (dbId == null || !viewer?.model) return undefined;
            const it = viewer.model.getData?.()?.instanceTree;
            const fragList = viewer.model.getFragmentList?.();
            const THREE = (window as any).THREE;
            if (!it || !fragList || !THREE) return undefined;
            const fragIds: number[] = [];
            it.enumNodeFragments(dbId, (fid: number) => fragIds.push(fid));
            if (!fragIds.length) return undefined;
            const bbox = new THREE.Box3();
            const tmp = new THREE.Box3();
            for (const fid of fragIds) { fragList.getWorldBounds(fid, tmp); bbox.union(tmp); }
            const zc = (bbox.min.z + bbox.max.z) / 2;
            let best: { name: string; dist: number } | null = null;
            for (const f of floors) {
              const zMin = Number(f?.zMin ?? -Infinity), zMax = Number(f?.zMax ?? Infinity);
              const dist = (zc < zMin) ? (zMin - zc) : (zc > zMax ? (zc - zMax) : 0);
              if (best == null || dist < best.dist) best = { name: String(f?.name || ''), dist };
            }
            return best?.name || undefined;
          } catch { return undefined; }
        };
        const url = mg ? `/api/projects/${projectId}/spaces?modelGuid=${encodeURIComponent(mg)}` : `/api/projects/${projectId}/spaces`;
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data)) {
          // Normalize ids
          let normalized: SpaceRecord[] = data.map((d: any) => ({
            id: d.id || d._id || d.idStr || `${d.source || 'BIM_MODEL'}-${d.dbId || d.name || Math.random()}`,
            level: normalizeLevel(d.level),
            name: d.name,
            area: d.area,
            perimeter: d.perimeter,
            volume: d.volume,
            occupancy: d.occupancy,
            spaceCode: d.spaceCode,
            building: d.building,
            description: d.description,
            source: d.source,
            dbId: d.dbId ?? null,
            modelGuid: d.modelGuid,
            footprint: d.footprint || undefined,
            conflictWithId: d.conflictWithId
          }));
          // Correct level using Z inference for BIM records where possible
          normalized = normalized.map(r => {
            if (r.source === 'BIM_MODEL' && r.dbId != null) {
              const byZ = inferLevelByDbId(r.dbId);
              if (byZ) return { ...r, level: byZ };
            }
            return r;
          });
          
          // STRICT client-side filter: use equivalence-aware modelGuid match
          const parseModelGuid = (s?: string) => {
            if (!s) return { raw: '', left: '', right: '' };
            const i = s.indexOf('|');
            return i === -1 ? { raw: s, left: s, right: '' } : { raw: s, left: s.slice(0, i), right: s.slice(i + 1) };
          };
          const isSameModelGuid = (a?: string, b?: string) => {
            if (!a || !b) return false; if (a === b) return true;
            const A = parseModelGuid(a), B = parseModelGuid(b);
            if (A.left && B.left && A.left === B.left) return true;
            if (A.right && B.right && A.right === B.right) return true;
            if (A.left && B.raw && B.raw.startsWith(A.left + '|')) return true;
            if (B.left && A.raw && A.raw.startsWith(B.left + '|')) return true;
            return false;
          };
          const clientFiltered = mg 
            ? normalized.filter(r => r.source === 'BIM_MODEL' ? isSameModelGuid(r.modelGuid as any, mg) : (!r.modelGuid || isSameModelGuid(r.modelGuid as any, mg)))
            : normalized;
          
          console.log(`[Spaces] Initial load: server returned ${normalized.length}, STRICT client-filtered to ${clientFiltered.length}`);
          // Merge with persisted to avoid losing locally extracted/prefilled fields
          const mergedClient = mergeWithPersisted(clientFiltered);
          setRows(mergedClient);
          try {
            const mgSave = getCurrentModelGuid();
            const toSave = mgSave ? mergedClient.filter(r => r.source !== 'BIM_MODEL' || r.modelGuid === mgSave) : mergedClient;
            save(K.spaces(projectId), toSave);
          } catch {}
        }
      } catch (err) { console.error(err); }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, viewer]);

  // Ensure current rows reflect only the current model's BIM spaces when viewer/model changes
  // AND clear localStorage to prevent stale data accumulation
  useEffect(() => {
    const mg = getCurrentModelGuid();
    if (!mg) return;
    
    setRows(prev => {
      const filtered = prev.filter(r => r.source !== 'BIM_MODEL' || r.modelGuid === mg);
      // Also update localStorage immediately to purge stale BIM spaces
      try {
        save(K.spaces(projectId), filtered);
      } catch {}
      return filtered;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const [spaceSearch, setSpaceSearch] = useState('');
  const [spaceSortBy, setSpaceSortBy] = useState<'name'|'level'|'area'|'perimeter'|'volume'|'occupancy'>('name');
  const [spaceSortDir, setSpaceSortDir] = useState<'asc'|'desc'>('asc');
  const pageClamped = Math.min(Math.max(1, page), totalPages);
  const startIndex = (pageClamped - 1) * pageSize;
  const endIndex = Math.min(rows.length, startIndex + pageSize);
  const filteredRowsSpaces = React.useMemo(() => {
    if (!spaceSearch) return rows;
    const q = spaceSearch.toLowerCase();
    return rows.filter(r => (
      (r.name || '').toLowerCase().includes(q) ||
      (r.spaceCode || '').toLowerCase().includes(q) ||
      (r.level || '').toLowerCase().includes(q) ||
      (r.building || '').toLowerCase().includes(q) ||
      (r.description || '').toLowerCase().includes(q)
    ));
  }, [rows, spaceSearch]);
  const sortedRowsSpaces = React.useMemo(() => {
    const arr = [...filteredRowsSpaces];
    const cmp = (a: any, b: any) => {
      const dir = spaceSortDir === 'asc' ? 1 : -1;
      const get = (r: any) => {
        switch (spaceSortBy) {
          case 'level': return (r.level || '').toString().toLowerCase();
          case 'area': return Number(r.area || 0);
          case 'perimeter': return Number(r.perimeter || 0);
          case 'volume': return Number(r.volume || 0);
          case 'occupancy': return Number(r.occupancy || 0);
          default: return (r.name || '').toString().toLowerCase();
        }
      };
      const va = get(a), vb = get(b);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    };
    return arr.sort(cmp);
  }, [filteredRowsSpaces, spaceSortBy, spaceSortDir]);
  const paginatedRows = sortedRowsSpaces.slice(startIndex, endIndex);

  const findRoomDbIds = async (): Promise<number[]> => {
    if (!viewer) return [];
    // Restrict to clear room/space categories only to avoid false positives
  const queries = ['Revit Rooms', 'Rooms', 'Spaces', 'Stanze', 'Spazi', 'Locali', 'Locale', 'Ambiente', 'Revit Stanze', 'Revit Locali'];
    const all = new Set<number>();
    for (const q of queries) {
      // eslint-disable-next-line no-await-in-loop
      const ids: number[] = await new Promise(resolve => {
        try {
          viewer.search(q, (dbids: number[]) => resolve(dbids || []), () => resolve([]), ['Category'], { searchHidden: true });
        } catch { resolve([]); }
      });
      console.log(`[Spaces] search '${q}' -> ${ids.length}`);
      ids.forEach(id => all.add(id));
    }
    console.log(`[Spaces] total unique dbIds found: ${all.size}`);
    return Array.from(all);
  };

  const extractRoomsFromBIM = async () => {
    if (!viewer) return;
    setIsExtracting(true);
    setExtractionProgress(1);
    try {
      const modelGuid = getCurrentModelGuid();
      console.log(`[Spaces] Extracting with composite modelGuid: ${modelGuid}`);
      // Prepare floor names and floors data for normalization
      let floorNames: string[] = [];
      let floors2: any[] = [];
      try {
        let ext = (viewer && typeof viewer.getExtension === 'function') ? viewer.getExtension('Autodesk.AEC.LevelsExtension') : null;
        if (!ext && viewer && typeof (viewer as any).loadExtension === 'function') {
          try { ext = await (viewer as any).loadExtension('Autodesk.AEC.LevelsExtension'); } catch {}
        }
        const fs = (ext as any)?.floorSelector;
        if (Array.isArray(fs?.floorData)) {
          floorNames = fs.floorData.map((f: any) => String(f?.name || ''));
          floors2 = fs.floorData;
        } else {
          floorNames = [];
          floors2 = [];
        }
      } catch {}
      const normalizeLevel = (lv: any) => {
        try {
          const s = lv != null ? String(lv) : '';
          if (!s) return undefined;
          const n = Number(s);
          if (!isNaN(n) && floorNames[n]) return floorNames[n];
          const m = s.match(/(^|\D)(\d{1,2})(\D|$)/);
          if (m && floorNames[Number(m[2])]) return floorNames[Number(m[2])];
          return s;
        } catch { return lv; }
      };
      const inferLevelByDbId = (dbId?: number | null): string | undefined => {
        try {
          if (dbId == null || !viewer?.model) return undefined;
          const it = viewer.model.getData?.()?.instanceTree;
          const fragList = viewer.model.getFragmentList?.();
          const THREE = (window as any).THREE;
          if (!it || !fragList || !THREE) return undefined;
          const fragIds: number[] = [];
          it.enumNodeFragments(dbId, (fid: number) => fragIds.push(fid));
          if (!fragIds.length) return undefined;
          const bbox = new THREE.Box3();
          const tmp = new THREE.Box3();
          for (const fid of fragIds) { fragList.getWorldBounds(fid, tmp); bbox.union(tmp); }
          const zc = (bbox.min.z + bbox.max.z) / 2;
          let best: { name: string; dist: number } | null = null;
          if (!Array.isArray(floors2) || floors2.length === 0) return undefined;
          for (const f of floors2) {
            const zMin = Number((f as any)?.zMin ?? -Infinity), zMax = Number((f as any)?.zMax ?? Infinity);
            const dist = (zc < zMin) ? (zMin - zc) : (zc > zMax ? (zc - zMax) : 0);
            if (best == null || dist < best.dist) best = { name: String((f as any)?.name || ''), dist };
          }
          return best?.name || undefined;
        } catch { return undefined; }
      };
      const dbids = await findRoomDbIds();
      if (!dbids || dbids.length === 0) {
        setExtractionProgress(100);
        setIsExtracting(false);
        return;
      }
      const propsList: any[] = [];
      // Try to read model-level Building/Project properties once and reuse as fallback
      let modelLevelBuilding: string | undefined;
      try {
        const rootId = viewer?.model?.getRootId ? viewer.model.getRootId() : null;
        if (rootId != null) {
          // eslint-disable-next-line no-await-in-loop
          const rootProps: any = await new Promise(resolve => { try { viewer.getProperties(rootId, resolve); } catch { resolve(null); } });
          const getPropFrom = (propsObj: any, names: string[]) => {
            if (!propsObj || !Array.isArray(propsObj.properties)) return undefined;
            const lower = names.map(n => n.toLowerCase());
            const p = propsObj.properties.find((p: any) => {
              const dn = p.displayName?.toLowerCase?.();
              return dn && (lower.includes(dn) || lower.some(n => dn.includes(n)));
            });
            return p?.displayValue?.toString?.();
          };
          modelLevelBuilding = getPropFrom(rootProps, ['Building', 'Edificio', 'Building Name', 'BuildingName', 'Nome edificio', 'Project Name', 'Project Name']);
        }
      } catch (err) {
        // ignore
      }
      console.log(`[Spaces] model-level building fallback='${modelLevelBuilding}'`);
      const total = dbids.length;
      for (let i = 0; i < total; i++) {
        // eslint-disable-next-line no-await-in-loop
        const p = await new Promise<any>(resolve => viewer.getProperties(dbids[i], resolve));
        propsList.push(p);
        const base = 5; // reserve first 5% for search
        const pct = base + Math.round(((i + 1) / total) * 75); // up to 80% during properties collection
        setExtractionProgress(Math.min(80, Math.max(base, pct)));
      }
      let kept = 0, skipped = 0;
      // Helper: robust numeric parsing with unit normalization and locale support
      const parseMeasure = (raw: any, kind: 'length' | 'area' | 'volume'): number | undefined => {
        if (raw == null) return undefined;
        if (typeof raw === 'number' && !isNaN(raw)) {
          // Auto-detect likely units based on magnitude
          if (kind === 'length') {
            // If > 100, likely mm; convert to m
            return raw > 100 ? raw / 1000 : raw;
          }
          if (kind === 'area') {
            // If > 1000, likely mm²; convert to m²
            return raw > 1000 ? raw / 1_000_000 : raw;
          }
          if (kind === 'volume') {
            // If > 10000, likely mm³; convert to m³
            return raw > 10000 ? raw / 1_000_000_000 : raw;
          }
          return raw;
        }
        let s = String(raw).trim();
        const sLower = s.toLowerCase();
        s = s.replace(/\u00A0/g, ' ').replace(/,/g, '.');
        const match = s.match(/-?[0-9]+(?:\.[0-9]+)?/g);
        if (!match || !match.length) return undefined;
        const num = parseFloat(match[match.length - 1]);
        if (!isFinite(num)) return undefined;
        const has = (u: string) => sLower.includes(u);
        if (kind === 'length') {
          if (has('mm')) return num / 1000;
          if (has('cm')) return num / 100;
          if (has('ft') || has('feet')) return num * 0.3048;
          // Auto-detect: if > 100, likely mm
          return num > 100 ? num / 1000 : num;
        }
        if (kind === 'area') {
          if (has('mm2') || has('mm^2') || has('mm²')) return num / 1_000_000;
          if (has('cm2') || has('cm^2') || has('cm²')) return num / 10_000;
          if (has('ft2') || has('ft^2') || has('ft²') || has('sf') || has('sq ft')) return num * 0.09290304;
          // Auto-detect: if > 1000, likely mm²
          return num > 1000 ? num / 1_000_000 : num;
        }
        // volume
        if (has('mm3') || has('mm^3') || has('mm³')) return num / 1_000_000_000;
        if (has('cm3') || has('cm^3') || has('cm³')) return num / 1_000_000;
        if (has('ft3') || has('ft^3') || has('ft³') || has('cf') || has('cu ft')) return num * 0.028316846592;
        // Auto-detect: if > 10000, likely mm³
        return num > 10000 ? num / 1_000_000_000 : num;
      };
      const candidates: SpaceRecord[] = propsList.map((p: any) => {
        const get = (names: string[]): string | undefined => {
          const lower = names.map(n => n.toLowerCase());
          const prop = p?.properties?.find((x: any) => {
            const dn = x.displayName?.toLowerCase?.();
            return dn && (lower.includes(dn) || lower.some(n => dn.includes(n)));
          });
          return prop?.displayValue?.toString();
        };
        const category = get(['Category', 'Categoria']);
        const cat = category?.toString()?.trim()?.toLowerCase?.();
        
        // Log raw category for debugging
        console.log(`[Spaces][debug] dbId=${p?.dbId} raw category='${category}' normalized='${cat}'`);
        
        // Match category more flexibly - check if it contains room/space/locale keywords
        const isRoomCat = !!cat && (
          cat.includes('room') || 
          cat.includes('stanza') || 
          cat.includes('stanze') ||
          /^rooms?$/.test(cat) || 
          /^revit rooms?$/.test(cat)
        );
        const isSpaceCat = !!cat && (
          cat.includes('space') || 
          cat.includes('spazi') || 
          cat.includes('spazio') ||
          cat.includes('local') || 
          cat.includes('ambiente') ||
          /^spaces?$/.test(cat) || 
          /^locali?$/.test(cat)
        );
        
  const level = get(['Level', 'Reference Level', 'Livello', 'Livello di riferimento', 'Piano', 'Piano di riferimento']);
        const name = p?.name || get(['Name', 'Room Name', 'Space Name', 'Nome', 'Nome stanza', 'Nome spazio', 'Nome locale', 'Nome ambiente', 'Denominazione']);
        const code = get(['Number', 'Room Number', 'Space Number', 'Numero', 'Numero stanza', 'Numero spazio', 'Numero locale', 'Codice', 'Codice locale', 'Codice stanza', 'ID', 'ID locale', 'ID stanza']);
  const desc = get(['Comments', 'Description', 'Commenti', 'Descrizione']);
        
        // Try ALL possible property names for area/perimeter/volume/occupancy
        const areaStr = get([
          'Area', 'Superficie', 'Superficie utile', 'Superficie netta', 'Area utile', 'Area netta', 
          'Superficie (m²)', 'Gross Area', 'Area Computed', 'Computed Area', 'Room Area'
        ]);
        const areaNum = parseMeasure(areaStr, 'area');
        
        const perimeterStr = get([
          'Perimeter', 'Perimetro', 'Perimeter (Gross)', 'Room Perimeter', 'Gross Perimeter',
          'Computed Perimeter', 'Perimeter (m)', 'Room Perimeter (m)'
        ]);
        const perimeterNum = parseMeasure(perimeterStr, 'length');
        
        const volumeStr = get([
          'Volume', 'Volumetria', 'Volume Lordo', 'Gross Volume', 'GrossVolume', 'Room Volume', 'Computed Volume',
          'Net Volume', 'Room Volume (m³)', 'Room Volume (m3)'
        ]);
        let volumeNum = parseMeasure(volumeStr, 'volume');
        
        // Fallback: compute volume from area and unbounded height when explicit Volume is missing
        // Works for English ("Unbounded Height") and Italian ("Altezza non delimitata").
        if ((volumeNum == null || isNaN(Number(volumeNum)) || Number(volumeNum) === 0)) {
          const unboundedHeightStr = get(['Unbounded Height', 'Altezza non delimitata']);
          const heightNum = parseMeasure(unboundedHeightStr, 'length');
          if (heightNum != null && !isNaN(Number(heightNum))) {
            if (areaNum != null && !isNaN(Number(areaNum))) {
              volumeNum = Number(areaNum) * Number(heightNum);
            }
          }
        }
        
        const occupancyStr = get([
          'Occupancy', 'Occupazione', 'Numero persone', 'Number of People', 'Occupanti', 'People Count', 'Occupant'
        ]);
        const occupancyNum = occupancyStr ? (() => {
          const s = String(occupancyStr).replace(/\u00A0/g, ' ').replace(/,/g, '.');
          const m = s.match(/-?[0-9]+(?:\.[0-9]+)?/);
          return m ? Number(m[0]) : undefined;
        })() : undefined;

        let buildingStr = get(['Building', 'Edificio', 'Building Name', 'BuildingName', 'Nome edificio']);
        let usedFallback = false;
        if ((!buildingStr || String(buildingStr).trim() === '') && modelLevelBuilding) {
          buildingStr = modelLevelBuilding;
          usedFallback = true;
        }
        // debug building extraction (room-level and whether model-level fallback used)
        console.log(`[Spaces][extract] dbId=${p?.dbId} building='${buildingStr}' (fallback=${usedFallback}) area='${areaStr}' perimeter='${perimeterStr}' volume='${volumeStr}'`);

        // Filter: must be Rooms/Spaces category and have a name or code; Level/Area are optional (we'll include if missing)
        let skipReason: string | null = null;
        if (!(isRoomCat || isSpaceCat)) skipReason = `bad-category (category='${cat || ''}')`;
        else if (!((name && String(name).trim().length > 0) || (code && String(code).trim().length > 0))) {
          // As a last resort, synthesize a name from dbId to keep the room
          const dbId = p?.dbId;
          const labelBase = isRoomCat ? (cat?.includes('stan') ? 'Stanza' : 'Room') : (cat?.includes('local') ? 'Locale' : (cat?.includes('spaz') ? 'Spazio' : 'Space'));
          const synthetic = dbId != null ? `${labelBase} ${dbId}` : undefined;
          if (!synthetic) skipReason = `missing-name-and-number`;
          else {
            // Use synthetic name and accept
            (p as any).__syntheticName = synthetic;
          }
        }
        if (skipReason) {
          skipped++;
          console.warn(`[Spaces][skip] dbId=${p?.dbId} cat='${cat}' lvl='${level}' name='${name}' code='${code}' area='${areaStr}' reason=${skipReason}`);
          return null as any;
        }
        kept++;

        return {
          id: `space-${modelGuid || 'g'}-${p?.dbId ?? p?.externalId ?? Date.now()}`,
          level: normalizeLevel(level) || inferLevelByDbId(p?.dbId) || undefined,
          name: name || (p as any).__syntheticName || undefined,
          area: isNaN(Number(areaNum)) ? undefined : Number(areaNum),
          perimeter: isNaN(Number(perimeterNum)) ? undefined : Number(perimeterNum),
          volume: isNaN(Number(volumeNum)) ? undefined : Number(volumeNum),
          building: buildingStr || undefined,
          occupancy: isNaN(Number(occupancyNum)) ? undefined : Number(occupancyNum),
          spaceCode: code || undefined,
          description: desc || undefined,
          source: 'BIM_MODEL',
          dbId: p?.dbId ?? null,
          modelGuid: modelGuid
        } as SpaceRecord;
      }).filter(Boolean) as SpaceRecord[];
      console.log(`[Spaces] props processed=${propsList.length}, kept=${kept}, skipped=${skipped}`);

      // Deduplicate within this extraction by modelGuid+dbId
      const seen = new Map<string, SpaceRecord>();
      for (const r of candidates) {
        const key = (r.source === 'BIM_MODEL' && r.dbId != null)
          ? `BIM|${r.modelGuid || 'g'}|${r.dbId}`
          : `LVLNAME|${(r.level || '').toLowerCase()}|${(r.name || '').toLowerCase()}|${(r.spaceCode || '').toLowerCase()}`;
        if (!seen.has(key)) seen.set(key, r);
      }
      const newRows = Array.from(seen.values());
      setExtractionProgress(90);
  console.log(`[Spaces] deduped newRows=${newRows.length}`);

      // Prefer server upsert + refresh when a projectId is available
      if (projectId && newRows.length) {
        try {
          await fetch(`/api/projects/${projectId}/spaces`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'upsertMany', spaces: newRows })
          });
          const mg = getCurrentModelGuid();
          console.log(`[Spaces] Fetching from server with modelGuid=${mg}`);
          const res = await fetch(`/api/projects/${projectId}/spaces${mg ? `?modelGuid=${encodeURIComponent(mg)}` : ''}`);
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) {
              const normalized: SpaceRecord[] = data.map((d: any) => ({
                id: d.id || d._id || d.idStr || `${d.source || 'BIM_MODEL'}-${d.dbId || d.name || Math.random()}`,
                level: d.level,
                name: d.name,
                area: d.area,
                perimeter: d.perimeter,
                volume: d.volume,
                occupancy: d.occupancy,
                spaceCode: d.spaceCode,
                building: d.building,
                description: d.description,
                source: d.source,
                dbId: d.dbId ?? null,
                modelGuid: d.modelGuid,
                footprint: d.footprint || undefined,
                conflictWithId: d.conflictWithId
              }));
              
              // STRICT client-side filter: ONLY keep spaces matching current model
              // BIM spaces MUST have matching modelGuid; manual spaces are kept only if no modelGuid context
              const clientFiltered = mg 
                ? normalized.filter(r => {
                    if (r.source === 'BIM_MODEL') {
                      // BIM space: MUST match current modelGuid exactly
                      const match = r.modelGuid === mg;
                      if (!match) {
                        console.log(`[Spaces] FILTERING OUT BIM space: dbId=${r.dbId}, modelGuid=${r.modelGuid} (current=${mg})`);
                      }
                      return match;
                    } else {
                      // Manual space: include only if it has no modelGuid or matches current
                      return !r.modelGuid || r.modelGuid === mg;
                    }
                  })
                : normalized;
              
              console.log(`[Spaces] Server returned ${normalized.length}, STRICT client-filtered to ${clientFiltered.length} for modelGuid=${mg}`);
              
              // CRITICAL FIX: After extraction, ONLY keep:
              // 1. Freshly extracted BIM spaces (from newRows - these are the current 5 rooms)
              // 2. Manual spaces (not from BIM)
              // Do NOT include old BIM spaces from previous extractions!
              
              const keyOf = (r: SpaceRecord) => (
                r.source === 'BIM_MODEL' && r.dbId != null
                  ? `BIM|${r.modelGuid || 'g'}|${r.dbId}`
                  : `ID|${r.id}`
              );
              
              // Build set of freshly extracted dbIds
              const extractedDbIds = new Set(newRows.map(r => r.dbId).filter(Boolean));
              console.log(`[Spaces] Freshly extracted dbIds:`, Array.from(extractedDbIds));
              
              // Filter: keep ONLY freshly extracted BIM spaces + manual spaces
              const freshOnly = clientFiltered.filter(r => {
                if (r.source === 'BIM_MODEL') {
                  const isFresh = r.dbId != null && extractedDbIds.has(r.dbId);
                  if (!isFresh) {
                    console.log(`[Spaces] FILTERING OUT old BIM space: dbId=${r.dbId}, name=${r.name} (not in fresh extraction)`);
                  }
                  return isFresh;
                }
                // Keep all manual spaces
                return true;
              });
              
              console.log(`[Spaces] After filtering to fresh extraction: ${freshOnly.length} spaces (${newRows.length} BIM + manual)`);
              
              // Enrich with freshly extracted metrics
              const extractedMap = new Map<string, SpaceRecord>();
              for (const r of newRows) extractedMap.set(keyOf(r), r);
              const enriched = freshOnly.map(r => {
                const ex = extractedMap.get(keyOf(r));
                if (!ex) return r;
                const out: SpaceRecord = { ...r };
                // Only fill when missing/zero on the server response
                if ((out.area == null || Number(out.area) === 0) && ex.area != null) out.area = ex.area;
                if ((out.perimeter == null || Number(out.perimeter) === 0) && ex.perimeter != null) out.perimeter = ex.perimeter;
                if ((out.volume == null || Number(out.volume) === 0) && ex.volume != null) out.volume = ex.volume;
                if ((out.occupancy == null || Number(out.occupancy) === 0) && ex.occupancy != null) out.occupancy = ex.occupancy;
                // Prefer building from extraction if server empty
                if ((!out.building || out.building === '') && ex.building) out.building = ex.building;
                return out;
              });
              const mergedEnriched = mergeWithPersisted(enriched);
              setRows(mergedEnriched);
              try {
                const mgSave2 = getCurrentModelGuid();
                const toSave2 = mgSave2 ? mergedEnriched.filter(r => r.source !== 'BIM_MODEL' || r.modelGuid === mgSave2) : mergedEnriched;
                save(K.spaces(projectId), toSave2);
              } catch {}
            }
          }
          setExtractionProgress(100);
        } catch (e) {
          console.error('[Spaces] upsertMany/refresh failed', e);
        }
      } else if (!projectId) {
        // Fallback: local merge with dedupe (only when no projectId - for testing)
        const score = (r: SpaceRecord) => {
          let s = 0;
          if (r.source === 'MANUAL') s += 3;
          if (r.area && r.area > 0) s += 2;
          if (r.name) s += 1;
          if (r.spaceCode) s += 1;
          if (r.footprint && Array.isArray(r.footprint.points) && r.footprint.points.length >= 3) s += 2;
          return s;
        };
        // Keep only current-model BIM rows from existing list to avoid cross-model mixing
        const mg = getCurrentModelGuid();
        const existingFiltered = rows.filter(r => r.source !== 'BIM_MODEL' || r.modelGuid === mg);
        const all = [...existingFiltered, ...newRows];
        const map = new Map<string, SpaceRecord>();
        for (const r of all) {
          const key = (r.source === 'BIM_MODEL' && r.dbId != null)
            ? `BIM|${r.modelGuid || 'g'}|${r.dbId}`
            : `LVLNAME|${(r.level || '').toLowerCase()}|${(r.name || '').toLowerCase()}|${(r.spaceCode || '').toLowerCase()}`;
          const ex = map.get(key);
          if (!ex) map.set(key, r);
          else map.set(key, score(r) >= score(ex) ? r : ex);
        }
        const merged = Array.from(map.values());
        setRows(merged);
        try {
          const mgSave3 = getCurrentModelGuid();
          const toSave3 = mgSave3 ? merged.filter(r => r.source !== 'BIM_MODEL' || r.modelGuid === mgSave3) : merged;
          save(K.spaces(projectId), toSave3);
        } catch {}
        console.log(`[Spaces] local merge result: ${merged.length} rows`);
        setExtractionProgress(100);
      } else {
        // projectId present but no newRows: just reload from server for current model
        console.warn('[Spaces] No new rows extracted, reloading from server');
        try {
          const mg = getCurrentModelGuid();
          console.log(`[Spaces] No new rows - reloading from server with modelGuid=${mg}`);
          const res = await fetch(`/api/projects/${projectId}/spaces${mg ? `?modelGuid=${encodeURIComponent(mg)}` : ''}`);
          if (res.ok) {
            const data = await res.json();
            const normalized: SpaceRecord[] = Array.isArray(data) ? data.map((d: any) => ({
              id: d.id || d._id || d.idStr || `${d.source || 'BIM_MODEL'}-${d.dbId || d.name || Math.random()}`,
              level: d.level,
              name: d.name,
              area: d.area,
              perimeter: d.perimeter,
              volume: d.volume,
              occupancy: d.occupancy,
              spaceCode: d.spaceCode,
              building: d.building,
              description: d.description,
              source: d.source,
              dbId: d.dbId ?? null,
              modelGuid: d.modelGuid,
              footprint: d.footprint || undefined,
              conflictWithId: d.conflictWithId
            })) : [];
            
            // STRICT client-side filter for safety - ONLY spaces from current model
            const clientFiltered = mg 
              ? normalized.filter(r => {
                  if (r.source === 'BIM_MODEL') {
                    // BIM space: MUST match current modelGuid exactly
                    return r.modelGuid === mg;
                  } else {
                    // Manual space: include only if it has no modelGuid or matches current
                    return !r.modelGuid || r.modelGuid === mg;
                  }
                })
              : normalized;
            
            console.log(`[Spaces] Server returned ${normalized.length}, STRICT client-filtered to ${clientFiltered.length} for modelGuid=${mg}`);
            // Nothing extracted this round; keep rows as-is but prefer persisted values
            setRows(mergeWithPersisted(clientFiltered));
          }
        } catch (e) {
          console.warn('[Spaces] reload after empty extraction failed', e);
        }
        setExtractionProgress(100);
      }
    } finally {
      setIsExtracting(false);
      // Reset the progress after a short delay so user sees 100%
      setTimeout(() => setExtractionProgress(0), 800);
    }
  };

  // Auto-refresh spaces when Space list opens (once per mount)
  const autoExtractSpacesOnceRef = React.useRef(false);
  useEffect(() => {
    // Disabled auto-extract per requirements: refresh only on explicit extract or space-created event
    // Keeping ref logic in case we re-enable later
    if (autoExtractSpacesOnceRef.current) return;
    autoExtractSpacesOnceRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, viewer]);

  // Listen for space-created events to refresh list
  useEffect(() => {
    const handleSpaceCreated = (e: CustomEvent) => {
      if (e.detail?.projectId !== projectId) return;
      const mg = getCurrentModelGuid();
      // Optimistic insert at top if event contains the space
      const spaceRaw = e.detail?.space as any;
      const space = (spaceRaw && spaceRaw.space) ? (spaceRaw.space as SpaceRecord) : (spaceRaw as SpaceRecord);
      if (space) {
        const parseModelGuid = (s?: string) => {
          if (!s) return { raw: '', left: '', right: '' };
          const i = s.indexOf('|');
          return i === -1 ? { raw: s, left: s, right: '' } : { raw: s, left: s.slice(0, i), right: s.slice(i + 1) };
        };
        const isSameModelGuid = (a?: string, b?: string) => {
          if (!a || !b) return false; if (a === b) return true;
          const A = parseModelGuid(a), B = parseModelGuid(b);
          if (A.left && B.left && A.left === B.left) return true;
          if (A.right && B.right && A.right === B.right) return true;
          if (A.left && B.raw && B.raw.startsWith(A.left + '|')) return true;
          if (B.left && A.raw && A.raw.startsWith(B.left + '|')) return true;
          return false;
        };
        const passes = !mg || !space.modelGuid || isSameModelGuid(space.modelGuid as any, mg);
        if (passes) {
          setRows(prev => [space, ...prev]);
        }
      }
      console.log('[SpaceList] Space created event received, reloading from DB');
      fetch(`/api/projects/${projectId}/spaces${mg ? `?modelGuid=${encodeURIComponent(mg)}` : ''}`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            // Prepare floors for normalization
            let floors: any[] = [] as any[];
            (async () => {
              try {
                let ext = (viewer && typeof viewer.getExtension === 'function') ? viewer.getExtension('Autodesk.AEC.LevelsExtension') : null;
                if (!ext && viewer && typeof (viewer as any).loadExtension === 'function') {
                  try { ext = await (viewer as any).loadExtension('Autodesk.AEC.LevelsExtension'); } catch {}
                }
                const fs = (ext as any)?.floorSelector;
                floors = Array.isArray(fs?.floorData) ? fs.floorData : [];
              } catch {}
              const normalizeLevel = (lv: any) => {
                try {
                  const s = lv != null ? String(lv) : '';
                  if (!s) return undefined;
                  const n = Number(s);
                  if (!isNaN(n) && floors[n]?.name) return String(floors[n].name);
                  const m = s.match(/(^|\D)(\d{1,2})(\D|$)/);
                  if (m && floors[Number(m[2])]?.name) return String(floors[Number(m[2])].name);
                  return s;
                } catch { return lv; }
              };
              const inferLevelByDbId = (dbId?: number | null): string | undefined => {
                try {
                  if (dbId == null || !viewer?.model) return undefined;
                  const it = viewer.model.getData?.()?.instanceTree;
                  const fragList = viewer.model.getFragmentList?.();
                  const THREE = (window as any).THREE;
                  if (!it || !fragList || !THREE) return undefined;
                  const fragIds: number[] = [];
                  it.enumNodeFragments(dbId, (fid: number) => fragIds.push(fid));
                  if (!fragIds.length) return undefined;
                  const bbox = new THREE.Box3();
                  const tmp = new THREE.Box3();
                  for (const fid of fragIds) { fragList.getWorldBounds(fid, tmp); bbox.union(tmp); }
                  const zc = (bbox.min.z + bbox.max.z) / 2;
                  let best: { name: string; dist: number } | null = null;
                  for (const f of floors) {
                    const zMin = Number(f?.zMin ?? -Infinity), zMax = Number(f?.zMax ?? Infinity);
                    const dist = (zc < zMin) ? (zMin - zc) : (zc > zMax ? (zc - zMax) : 0);
                    if (best == null || dist < best.dist) best = { name: String(f?.name || ''), dist };
                  }
                  return best?.name || undefined;
                } catch { return undefined; }
              };
              let normalized: SpaceRecord[] = data.map((d: any) => ({
                id: d.id || d._id || d.idStr || `${d.source || 'MANUAL'}-${d.dbId || d.name || Math.random()}`,
                level: normalizeLevel(d.level),
                name: d.name,
                area: d.area,
                perimeter: d.perimeter,
                volume: d.volume,
                occupancy: d.occupancy,
                spaceCode: d.spaceCode,
                building: d.building,
                description: d.description,
                source: d.source,
                dbId: d.dbId ?? null,
                modelGuid: d.modelGuid,
                footprint: d.footprint || undefined,
                conflictWithId: d.conflictWithId
              }));
              normalized = normalized.map(r => {
                if (r.source === 'BIM_MODEL' && r.dbId != null) {
                  const byZ = inferLevelByDbId(r.dbId);
                  if (byZ) return { ...r, level: byZ };
                }
                return r;
              });
              // STRICT filter: equivalence-aware modelGuid
              const parseModelGuid = (s?: string) => {
                if (!s) return { raw: '', left: '', right: '' };
                const i = s.indexOf('|');
                return i === -1 ? { raw: s, left: s, right: '' } : { raw: s, left: s.slice(0, i), right: s.slice(i + 1) };
              };
              const isSameModelGuid = (a?: string, b?: string) => {
                if (!a || !b) return false; if (a === b) return true;
                const A = parseModelGuid(a), B = parseModelGuid(b);
                if (A.left && B.left && A.left === B.left) return true;
                if (A.right && B.right && A.right === B.right) return true;
                if (A.left && B.raw && B.raw.startsWith(A.left + '|')) return true;
                if (B.left && A.raw && A.raw.startsWith(B.left + '|')) return true;
                return false;
              };
              const clientFiltered = mg 
                ? normalized.filter(r => r.source === 'BIM_MODEL' ? isSameModelGuid(r.modelGuid as any, mg) : (!r.modelGuid || isSameModelGuid(r.modelGuid as any, mg)))
                : normalized;
              console.log(`[SpaceList] Reloaded after space-created: ${clientFiltered.length} spaces`);
              setRows(mergeWithPersisted(clientFiltered));
              })();
            }
          })
          .catch(err => console.error('[SpaceList] Failed to reload after space-created', err));
        };
        
        window.addEventListener('space-created', handleSpaceCreated as any);
        return () => window.removeEventListener('space-created', handleSpaceCreated as any);
      }, [projectId, getCurrentModelGuid]);

  const onRowClick = (r: SpaceRecord) => {
    try {
      if (!viewer || !r.dbId) return;
      // Isolate and fit to view the room
      if (viewer.isolate) viewer.isolate([r.dbId]);
      if (viewer.fitToView) viewer.fitToView([r.dbId]);
    } catch { }
  };

  const savedOverlayName = 'fm-saved-footprint';
  const clearSavedFootprint = () => {
    try {
      if (!viewer?.impl) return;
      const scn = (viewer.impl.overlayScenes || {})[savedOverlayName];
      const scene = scn?.scene;
      if (scene) {
        const children = [...scene.children];
        children.forEach(ch => scene.remove(ch));
        viewer.impl.invalidate(true);
      }
    } catch { }
  };

  const drawSavedFootprint = (fp?: { points?: { x: number; y: number; z?: number }[]; z?: number | null }) => {
    try {
      if (!viewer?.impl || !fp || !Array.isArray(fp.points) || fp.points.length < 3) { clearSavedFootprint(); return; }
      const pts = fp.points;
      const THREE = (window as any).THREE;
      if (!THREE) return;
      if (!(viewer.impl.overlayScenes || {})[savedOverlayName]) viewer.impl.createOverlayScene(savedOverlayName);
      clearSavedFootprint();
      const z = (fp.z != null ? fp.z : (pts[0]?.z ?? 0));

      // outline
      const closed = [...pts, pts[0]].map(p => new THREE.Vector3(p.x, p.y, z));
      const lineGeom = new THREE.BufferGeometry().setFromPoints(closed);
      const lineMat = new THREE.LineBasicMaterial({ color: 0x00aaff, linewidth: 3, depthTest: false, transparent: true, opacity: 0.9 });
      const line = new THREE.Line(lineGeom, lineMat);
      line.renderOrder = 1000;
      viewer.impl.addOverlay(savedOverlayName, line);

      // fill
      const shape = new THREE.Shape(pts.map(p => new THREE.Vector2(p.x, p.y)));
      const fillGeom = new THREE.ShapeGeometry(shape);
      const fillMat = new THREE.MeshBasicMaterial({ color: 0x00aaff, opacity: 0.18, transparent: true, depthWrite: false, depthTest: false });
      const mesh = new THREE.Mesh(fillGeom, fillMat);
      mesh.position.z = z;
      mesh.renderOrder = 999;
      viewer.impl.addOverlay(savedOverlayName, mesh);

      viewer.impl.invalidate(true);
    } catch { }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-3 border-b border-gray-800">
        <div className="text-white font-semibold text-sm">Space List</div>
          <div className="mt-2 grid grid-cols-1 gap-2">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Search rooms by name, code, level, building…"
                value={spaceSearch}
                onChange={e => { setSpaceSearch(e.target.value); setPage(1); }}
                className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs"
              />
              <select
                value={spaceSortBy}
                onChange={e => { setSpaceSortBy(e.target.value as any); setPage(1); }}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs"
                title="Sort By"
              >
                <option value="name">Sort by Name</option>
                <option value="level">Sort by Level</option>
                <option value="area">Sort by Area</option>
                <option value="perimeter">Sort by Perimeter</option>
                <option value="volume">Sort by Volume</option>
                <option value="occupancy">Sort by Occupancy</option>
              </select>
              <button
                onClick={() => setSpaceSortDir(d => d === 'asc' ? 'desc' : 'asc')}
                className="px-2 py-1.5 rounded text-xs bg-gray-700 hover:bg-gray-600 text-white"
                title="Toggle sort direction"
              >
                {spaceSortDir === 'asc' ? 'Asc' : 'Desc'}
              </button>
            </div>
          <button
            onClick={extractRoomsFromBIM}
            disabled={isExtracting}
            className={`w-full ${isExtracting ? 'bg-green-700/70' : 'bg-green-600 hover:bg-green-700'} text-white text-xs py-1.5 rounded`}
          >
            {isExtracting ? `Extracting Rooms… ${extractionProgress}%` : 'Extract Rooms from BIM'}
          </button>
          {isExtracting && (
            <div className="mt-2 h-1.5 bg-gray-700 rounded overflow-hidden">
              <div className="h-full bg-green-500 transition-all" style={{ width: `${Math.max(0, Math.min(100, extractionProgress))}%` }} />
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-800/90 backdrop-blur border-b border-gray-700 text-gray-300">
            <tr>
              <th className="text-left px-3 py-2">Level</th>
              <th className="text-left px-3 py-2">Room name</th>
              <th className="text-left px-3 py-2">Area (m²)</th>
              <th className="text-left px-3 py-2">Perimeter (m)</th>
              <th className="text-left px-3 py-2">Volume (m³)</th>
              <th className="text-left px-3 py-2">Occupancy</th>
              <th className="text-left px-3 py-2">Description</th>
              <th className="text-center px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-gray-400">No spaces. Use "Create new space" or extract from BIM.</td></tr>
            ) : paginatedRows.map(r => (
              <tr key={r.id} className="border-b border-gray-800 hover:bg-gray-800/50"
                  onMouseEnter={() => drawSavedFootprint(r.footprint || undefined)}
                  onMouseLeave={() => clearSavedFootprint()}>
                <td className="px-3 py-2 text-gray-100">{r.level || '-'}</td>
                <td className="px-3 py-2 text-gray-200 cursor-pointer hover:text-white" onClick={() => onRowClick(r)}>{r.name || '-'}</td>
                <td className="px-3 py-2 text-gray-200">{r.area != null ? (typeof r.area === 'string' ? parseFloat(r.area).toFixed(2) : r.area.toFixed(2)) : '-'}</td>
                <td className="px-3 py-2 text-gray-200">{r.perimeter != null ? Number(r.perimeter).toFixed(2) : '-'}</td>
                <td className="px-3 py-2 text-gray-200">{r.volume != null ? Number(r.volume).toFixed(2) : '-'}</td>
                <td className="px-3 py-2 text-gray-200">{r.occupancy != null ? Number(r.occupancy) : '-'}</td>
                <td className="px-3 py-2 text-gray-300">{r.description || '-'}</td>
                <td className="px-3 py-2 text-center flex gap-1 justify-center">
                  <button
                    onClick={() => setEditModal({ open: true, space: r })}
                    className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded"
                    title="Edit space"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteModal({ open: true, id: r.id, name: r.name })}
                    className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded"
                    title="Delete space"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Bottom Pagination Controls */}
      <div className="flex items-center justify-between px-2 py-2 text-[11px] text-gray-300 gap-2 border-t border-gray-800">
        <div className="flex items-center gap-2 min-w-0">
          <span className="whitespace-nowrap">Rows:</span>
          <select
            value={pageSize}
            onChange={e => { setPageSize(parseInt(e.target.value, 10)); setPage(1); }}
            className="h-6 bg-gray-800/80 border border-gray-700 rounded px-2 text-[11px] focus:outline-none focus:border-gray-500"
          >
            {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="flex-1 text-center text-gray-4 00 truncate">
          {sortedRowsSpaces.length === 0 ? '0' : `${startIndex + 1}-${Math.min(endIndex, sortedRowsSpaces.length)}`} of {sortedRowsSpaces.length}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={pageClamped <= 1}
            className={`h-6 w-6 grid place-items-center rounded border ${pageClamped <= 1 ? 'text-gray-500 border-gray-700' : 'text-white border-gray-600 hover:bg-gray-700'}`}
            aria-label="Previous page"
          >
            &#8249;
          </button>
          <span className="mx-1 whitespace-nowrap">{pageClamped}/{totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={pageClamped >= totalPages}
            className={`h-6 w-6 grid place-items-center rounded border ${pageClamped >= totalPages ? 'text-gray-500 border-gray-700' : 'text-white border-gray-600 hover:bg-gray-700'}`}
            aria-label="Next page"
          >
            &#8250;
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1001]" onClick={() => setDeleteModal({ open: false })}>
          <div className="bg-gray-900 border border-gray-700 rounded p-4 w-[360px]" onClick={e => e.stopPropagation()}>
            <div className="text-white text-sm font-semibold mb-2">Delete space?</div>
            <div className="text-xs text-gray-300 mb-4">Are you sure you want to permanently delete <span className="text-red-300">{deleteModal.name}</span>?</div>
            <div className="flex items-center justify-end gap-2">
              <button 
                className="px-3 py-1.5 rounded text-xs bg-gray-700 hover:bg-gray-600 text-white" 
                onClick={() => setDeleteModal({ open: false })}
              >
                Cancel
              </button>
              <button 
                className="px-3 py-1.5 rounded text-xs bg-red-700 hover:bg-red-600 text-white" 
                onClick={async () => {
                  try {
                    const res = await fetch(`/api/projects/${projectId}/spaces/${deleteModal.id}`, { method: 'DELETE' });
                    console.log(`[SpaceList] Delete response status:`, res.status);
                    if (res.ok) {
                      console.log(`[SpaceList] Space ${deleteModal.id} deleted successfully`);
                      setRows(rows.filter(x => x.id !== deleteModal.id));
                      setDeleteModal({ open: false });
                    } else {
                      const errData = await res.text();
                      console.error(`[SpaceList] Delete failed with status ${res.status}:`, errData);
                      alert(`Failed to delete space: ${res.status}`);
                    }
                  } catch (err) {
                    console.error('[SpaceList] Delete error:', err);
                    alert('Error deleting space');
                  }
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editModal.open && editModal.space && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1001]" onClick={() => setEditModal({ open: false })}>
          <div className="bg-gray-900 border border-gray-700 rounded p-4 w-[420px] max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="text-white text-sm font-semibold mb-3">Edit Space</div>
            <EditSpaceFormInline 
              space={editModal.space} 
              projectId={projectId}
              viewer={viewer}
              onSave={() => {
                setEditModal({ open: false });
                // Reload spaces from database to show updated values
                (async () => {
                  try {
                    console.log('[SpaceList] Reloading spaces after edit...');
                    const mg = getCurrentModelGuid();
                    const res = await fetch(`/api/projects/${projectId}/spaces${mg ? `?modelGuid=${encodeURIComponent(mg)}` : ''}`);
                    if (res.ok) {
                      const data = await res.json();
                      console.log('[SpaceList] Reloaded spaces:', data.length, 'items');
                      if (Array.isArray(data)) {
                        // Prepare floor names for normalization
                        let floorNames: string[] = [];
                        try {
                          let ext = (viewer && typeof viewer.getExtension === 'function') ? viewer.getExtension('Autodesk.AEC.LevelsExtension') : null;
                          if (!ext && viewer && typeof (viewer as any).loadExtension === 'function') {
                            try { ext = await (viewer as any).loadExtension('Autodesk.AEC.LevelsExtension'); } catch {}
                          }
                          const fs = (ext as any)?.floorSelector;
                          floorNames = Array.isArray(fs?.floorData) ? fs.floorData.map((f: any) => String(f?.name || '')) : [];
                        } catch {}
                        const normalizeLevel = (lv: any) => {
                          try {
                            const s = lv != null ? String(lv) : '';
                            if (!s) return undefined;
                            const n = Number(s);
                            if (!isNaN(n) && floorNames[n]) return floorNames[n];
                            const m = s.match(/(^|\D)(\d{1,2})(\D|$)/);
                            if (m && floorNames[Number(m[2])]) return floorNames[Number(m[2])];
                            return s;
                          } catch { return lv; }
                        };
                        const normalized: SpaceRecord[] = data.map((d: any) => ({
                          id: d.id || d._id || d.idStr || `${d.source || 'MANUAL'}-${d.dbId || d.name || Math.random()}`,
                          level: normalizeLevel(d.level),
                          name: d.name,
                          area: d.area,
                          perimeter: d.perimeter,
                          volume: d.volume,
                          occupancy: d.occupancy,
                          spaceCode: d.spaceCode,
                          building: d.building,
                          description: d.description,
                          source: d.source,
                          dbId: d.dbId ?? null,
                          modelGuid: d.modelGuid,
                          footprint: d.footprint || undefined,
                          conflictWithId: d.conflictWithId
                        }));
                        // STRICT filter: only spaces from current model
                        const clientFiltered = mg
                          ? normalized.filter(r => {
                              if (r.source === 'BIM_MODEL') {
                                return r.modelGuid === mg;
                              } else {
                                return !r.modelGuid || r.modelGuid === mg;
                              }
                            })
                          : normalized;
                        console.log('[SpaceList] Normalized and setting rows:', clientFiltered.length);
                        setRows(mergeWithPersisted(clientFiltered));
                      }
                    } else {
                      console.error('[SpaceList] Reload failed with status:', res.status);
                    }
                  } catch (err) {
                    console.error('[SpaceList] Reload error:', err);
                  }
                })();
              }}
              onCancel={() => setEditModal({ open: false })}
            />
          </div>
        </div>
      )}
    </div>
  );
};

const CreateSpace: React.FC<{ projectId?: string; viewer?: any; standalone?: boolean; }> = ({ projectId, viewer, standalone }) => {
  const [rows, setRows] = useState<SpaceRecord[]>([]);
  // Don't read localStorage during SSR - hydrate draft on client after mount
  const [f, setF] = useState({ building: '', level: '', name: '', spaceCode: '', area: '', perimeter: '', description: '' });
  useEffect(() => {
    try {
      const saved = load(`fm-create-space-draft-${projectId || 'global'}`, {});
      if (saved) {
        console.log('[CreateSpace][draft] Loaded create-space draft from LS:', saved);
        setF(prev => ({ ...prev, ...saved }));
      }
    } catch { }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const [projectName, setProjectName] = useState<string>('');

  // Load project metadata (name) so we can prefill Building
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
        console.warn('[CreateSpace] Could not load project metadata', err);
      }
    })();
  }, [projectId]);

  // (removed misplaced openHistory from CreateSpace)

  // (moved) openHistory was accidentally placed here before; removed from this component.

  // When projectName becomes available, prefill building if empty
  useEffect(() => {
    if (projectName && (!f.building || f.building.trim() === '')) {
      console.log('[CreateSpace][prefill] Building from project name:', projectName);
      setF(prev => { const next = { ...prev, building: projectName }; console.log('[CreateSpace][prefill] Form after project-name building set', next); return next; });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectName]);

  // Auto-save draft to localStorage on every field change
  useEffect(() => {
    save(`fm-create-space-draft-${projectId || 'global'}`, f);
  }, [f, projectId]);
  // Footprint drawing state
  const [drawing, setDrawing] = useState(false);
  const [pointCount, setPointCount] = useState(0);
  const [footprint, setFootprint] = useState<{ points: { x: number; y: number; z: number }[]; z?: number; levelIndex?: number } | null>(null);
  const pointsRef = useRef<{ x: number; y: number; z: number }[]>([]);
  const baseZRef = useRef<number | null>(null);
  const overlayName = 'fm-footprint-editor';
  const isRemote = !viewer && !!standalone; // standalone window without viewer
  const hoverRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const snapperRef = useRef<any>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const footprintDraftKey = `fm-footprint-draft-${projectId || 'global'}`;
  const computedPerimeterRef = useRef<number | null>(null);
  const suppressAutoFillRef = useRef<boolean>(false);
  const logFormState = (where: string) => { try { console.log('[CreateSpace][form]', where, { building: f.building, level: f.level, area: f.area, perimeter: (f as any).perimeter, name: f.name, spaceCode: f.spaceCode }); } catch {} };
  useEffect(() => { logFormState('state changed'); // trace every form update
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f]);

  // Restore footprint from localStorage when panel opens again (after minimize/restore)
  useEffect(() => {
    try {
      const saved: any = load(footprintDraftKey, []);
      console.log('[CreateSpace][restore] Footprint from LS:', Array.isArray(saved) ? saved.length : 'invalid');
      if (Array.isArray(saved) && saved.length >= 3) {
        pointsRef.current = saved.map((p: any) => ({ x: Number(p.x), y: Number(p.y), z: Number(p.z) }));
        setPointCount(pointsRef.current.length);
        const pts = sanitizePolygon(pointsRef.current);
        setFootprint({ points: [...pts], z: pts[0]?.z, levelIndex: undefined });
        if (viewer?.impl) drawFinalPolygon(pts);
        setConfirmOpen(true);
        console.log('[CreateSpace][restore] Restored footprint and opened confirmation');
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, viewer]);

  const clearOverlay = () => {
    try {
      if (!viewer?.impl) return;
      const scn = (viewer.impl.overlayScenes || {})[overlayName];
      const scene = scn?.scene;
      if (scene) {
        const children = [...scene.children];
        children.forEach(ch => scene.remove(ch));
        viewer.impl.invalidate(true);
      }
    } catch { }
  };

  const drawFinalPolygon = (pts: { x: number; y: number; z: number }[]) => {
    try {
      if (!viewer?.impl || pts.length < 3) return;
      if (!(viewer.impl.overlayScenes || {})[overlayName]) viewer.impl.createOverlayScene(overlayName);
      clearOverlay();
      pts = sanitizePolygon(pts);
      const THREE = (window as any).THREE;
      if (!THREE) return;

      // Draw final closed polygon with THICK DARK GREEN lines
      const closedPts = [...pts, pts[0]].map(p => new THREE.Vector3(p.x, p.y, p.z));
      const geom = new THREE.BufferGeometry().setFromPoints(closedPts);
      const mat = new THREE.LineBasicMaterial({ color: 0x00aa00, linewidth: 5, depthTest: false });
      const line = new THREE.Line(geom, mat);
      line.renderOrder = 999;
      viewer.impl.addOverlay(overlayName, line);

      // Filled polygon (darker green)
      const shape = new THREE.Shape(pts.map(p => new THREE.Vector2(p.x, p.y)));
      const fillGeom = new THREE.ShapeGeometry(shape);
      const fillMat = new THREE.MeshBasicMaterial({ color: 0x00dd00, opacity: 0.3, transparent: true, depthWrite: false, depthTest: false });
      const mesh = new THREE.Mesh(fillGeom, fillMat);
      if (baseZRef.current != null) mesh.position.z = baseZRef.current;
      mesh.renderOrder = 998;
      viewer.impl.addOverlay(overlayName, mesh);

      viewer.impl.invalidate(true);
    } catch { }
  };

  const drawPreview = () => {
    try {
      if (!viewer?.impl) return;
      if (!(viewer.impl.overlayScenes || {})[overlayName]) {
        viewer.impl.createOverlayScene(overlayName);
      }
      clearOverlay();
      const pts = pointsRef.current; // use raw for line preview to avoid jumpy feedback
      const hover = hoverRef.current;
      const THREE = (window as any).THREE;
      if (!THREE) { viewer.impl.invalidate(true); return; }

      // Draw polyline through all clicked points (THICKER & DARKER)
      if (pts.length >= 2) {
        const geom = new THREE.BufferGeometry().setFromPoints(pts.map(p => new THREE.Vector3(p.x, p.y, p.z)));
        const mat = new THREE.LineBasicMaterial({ color: 0x00dd00, linewidth: 4, depthTest: false });
        const line = new THREE.Line(geom, mat);
        line.renderOrder = 999;
        viewer.impl.addOverlay(overlayName, line);
      }

      // Draw preview line from LAST point to hover (THICKER)
      if (hover && pts.length >= 1) {
        const lastPt = pts[pts.length - 1];
        const previewGeom = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(lastPt.x, lastPt.y, lastPt.z),
          new THREE.Vector3(hover.x, hover.y, hover.z)
        ]);
        const previewMat = new THREE.LineBasicMaterial({ color: 0xff8800, linewidth: 4, depthTest: false, opacity: 0.8, transparent: true });
        const previewLine = new THREE.Line(previewGeom, previewMat);
        previewLine.renderOrder = 999;
        viewer.impl.addOverlay(overlayName, previewLine);
      }

      // Draw closing line preview (back to first point) - THICKER & DARKER
      if (pts.length >= 3) {
        const clean = sanitizePolygon(pts);
        const closedPts = [...clean, clean[0]].map(p => new THREE.Vector3(p.x, p.y, p.z));
        const geom2 = new THREE.BufferGeometry().setFromPoints(closedPts);
        const line2 = new THREE.Line(geom2, new THREE.LineBasicMaterial({ color: 0x0088ff, linewidth: 4, depthTest: false, opacity: 0.7, transparent: true }));
        line2.renderOrder = 999;
        viewer.impl.addOverlay(overlayName, line2);
        // Filled polygon for visibility (DARKER)
        const shape = new THREE.Shape(clean.map((p, i) => new THREE.Vector2(p.x, p.y)));
        const fillGeom = new THREE.ShapeGeometry(shape);
        const fillMat = new THREE.MeshBasicMaterial({ color: 0x00dd00, opacity: 0.25, transparent: true, depthWrite: false, depthTest: false });
        const mesh = new THREE.Mesh(fillGeom, fillMat);
        if (baseZRef.current != null) mesh.position.z = baseZRef.current;
        mesh.renderOrder = 998;
        viewer.impl.addOverlay(overlayName, mesh);
      }
      viewer.impl.invalidate(true);
    } catch { }
  };

  // Compute world point on constant Z plane from screen xy
  const worldOnZ = (clientX: number, clientY: number, z: number) => {
    const THREE = (window as any).THREE;
    if (!THREE || !viewer?.impl?.camera) return null;

    // Get proper canvas bounds
    const canvas = viewer.impl.canvas || viewer.container;
    const rect = canvas.getBoundingClientRect();

    // Normalize to [-1, 1] NDC space
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((clientY - rect.top) / rect.height) * 2 + 1;

    const camera = viewer.impl.camera;

    // Create ray from camera through mouse position
    const mouse = new THREE.Vector3(x, y, 0.5);
    mouse.unproject(camera);

    const origin = camera.position.clone();
    const dir = mouse.sub(origin).normalize();

    // Intersect ray with horizontal plane at z
    const EPS = 1e-6;
    if (Math.abs(dir.z) < EPS) return null; // parallel to plane

    const t = (z - origin.z) / dir.z;
    if (!isFinite(t) || t < 0) return null; // behind camera

    const point = origin.clone().add(dir.multiplyScalar(t));
    return point;
  };

  const isNearFirst = (p: { x: number; y: number; z: number }, eps = 0.25) => {
    if (pointsRef.current.length < 1) return false;
    const a = pointsRef.current[0];
    const dx = p.x - a.x, dy = p.y - a.y;
    return Math.hypot(dx, dy) <= eps;
  };

  const almostEqual = (a: number, b: number, eps = 1e-3) => Math.abs(a - b) <= eps;
  const dedupeAndSimplify = (pts: { x: number; y: number; z: number }[], eps = 1e-3) => {
    if (!Array.isArray(pts) || pts.length === 0) return [] as typeof pts;
    // remove consecutive duplicates (within eps)
    const out: { x: number; y: number; z: number }[] = [];
    for (const p of pts) {
      const last = out[out.length - 1];
      if (!last || !(almostEqual(last.x, p.x, eps) && almostEqual(last.y, p.y, eps))) out.push(p);
    }
    // if last equals first, drop last duplicate
    if (out.length >= 2) {
      const f = out[0], l = out[out.length - 1];
      if (almostEqual(f.x, l.x, eps) && almostEqual(f.y, l.y, eps)) out.pop();
    }
    // drop colinear points
    const colinear = (a: any, b: any, c: any, tol = 1e-6) => {
      const abx = b.x - a.x, aby = b.y - a.y;
      const bcx = c.x - b.x, bcy = c.y - b.y;
      return Math.abs(abx * bcy - aby * bcx) <= tol;
    };
    const simp: typeof out = [];
    for (let i = 0; i < out.length; i++) {
      const prev = out[(i - 1 + out.length) % out.length];
      const curr = out[i];
      const next = out[(i + 1) % out.length];
      if (!colinear(prev, curr, next)) simp.push(curr);
    }
    return simp;
  };
  const signedArea = (pts: { x: number; y: number }[]) => {
    let s = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      s += a.x * b.y - b.x * a.y;
    }
    return 0.5 * s;
  };
  const polygonPerimeter2D = (pts: { x: number; y: number }[]): number => {
    if (!Array.isArray(pts) || pts.length < 2) return 0;
    let sum = 0;
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % n];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      sum += Math.hypot(dx, dy);
    }
    return sum;
  };
  const prefillBuildingAndLevel = async (zHint?: number | null) => {
    try {
      if (!viewer) return;
      console.log('[CreateSpace][prefill] Start. zHint=', zHint);
      if (!f.building || String(f.building).trim() === '') {
        try {
          const rootId = viewer?.model?.getRootId ? viewer.model.getRootId() : null;
          if (rootId != null) {
            const rootProps: any = await new Promise(resolve => { try { viewer.getProperties(rootId, resolve); } catch { resolve(null); } });
            const getPropFrom = (propsObj: any, names: string[]) => {
              if (!propsObj || !Array.isArray(propsObj.properties)) return undefined;
              const lower = names.map(n => n.toLowerCase());
              const p = propsObj.properties.find((p: any) => {
                const dn = p.displayName?.toLowerCase?.();
                return dn && (lower.includes(dn) || lower.some(n => dn.includes(n)));
              });
              return p?.displayValue?.toString?.();
            };
            const building = getPropFrom(rootProps, ['Building', 'Edificio', 'Building Name', 'Nome edificio', 'Project Name']);
            if (building) { setF(prev => ({ ...prev, building })); console.log('[CreateSpace][prefill] Building from model root:', building); }
          }
        } catch {}
      }
      try {
        let ext = (typeof viewer.getExtension === 'function') ? viewer.getExtension('Autodesk.AEC.LevelsExtension') : null;
        if (!ext && typeof (viewer as any).loadExtension === 'function') {
          try { ext = await (viewer as any).loadExtension('Autodesk.AEC.LevelsExtension'); } catch {}
        }
        const fs = (ext as any)?.floorSelector;
        const floors = fs?.floorData || [];
        console.log('[CreateSpace][prefill] Floors available:', floors?.length, floors);
        let levelName = '';
        // Prefer active floor
        const idx = typeof fs?.getActiveFloor === 'function' ? fs.getActiveFloor() : undefined;
        console.log('[CreateSpace][prefill] Active floor idx:', idx);
        if (typeof idx === 'number' && floors[idx]?.name) levelName = floors[idx].name;
        // Fallback: infer by z if available
        if (!levelName && floors?.length && (zHint != null)) {
          const z = Number(zHint);
          console.log('[CreateSpace][prefill] Inferring by zHint:', z);
          let best: { name: string; dist: number } | null = null;
          for (const fdata of floors) {
            const zMin = Number(fdata?.zMin ?? 0), zMax = Number(fdata?.zMax ?? 0);
            const dist = (z < zMin) ? (zMin - z) : (z > zMax ? (z - zMax) : 0);
            if (best == null || dist < best.dist) best = { name: String(fdata?.name || ''), dist };
          }
          levelName = best?.name || '';
        }
        if (levelName) { setF(prev => ({ ...prev, level: levelName })); console.log('[CreateSpace][prefill] Level set to:', levelName); }
      } catch (e) { console.warn('[CreateSpace][prefill] Level prefill failed', e); }
    } catch {}
  };
  const sanitizePolygon = (pts: { x: number; y: number; z: number }[]) => {
    let arr = dedupeAndSimplify(pts);
    if (arr.length < 3) return arr;
    // 2-opt untangle: remove self-intersections by reversing subpaths
    const cross = (p1: any, p2: any, p3: any, p4: any) => {
      const d = (a: any, b: any, c: any) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
      const o1 = d(p1, p2, p3);
      const o2 = d(p1, p2, p4);
      const o3 = d(p3, p4, p1);
      const o4 = d(p3, p4, p2);
      if (o1 === 0 && o2 === 0 && o3 === 0 && o4 === 0) return false;
      return (o1 * o2 < 0) && (o3 * o4 < 0);
    };
    const untangle = (poly: typeof arr) => {
      const n = poly.length;
      if (n < 4) return poly;
      let improved = true;
      let guard = 0;
      while (improved && guard++ < 50) {
        improved = false;
        for (let i = 0; i < n; i++) {
          const i2 = (i + 1) % n;
          for (let j = i + 2; j < n; j++) {
            const j2 = (j + 1) % n;
            // skip adjacent and wraparound pair
            if (i === j2) continue;
            if (cross(poly[i], poly[i2], poly[j], poly[j2])) {
              // reverse between i2..j inclusive
              const a = i2;
              const b = j;
              const segment = poly.slice(a, b + 1).reverse();
              poly = [...poly.slice(0, a), ...segment, ...poly.slice(b + 1)];
              improved = true;
            }
          }
        }
      }
      return poly;
    };
    arr = untangle(arr);
    // ensure consistent winding (CCW) for fill
    if (signedArea(arr) < 0) arr = [...arr].reverse();
    return arr;
  };
  // After footprint changes, ensure form fields are filled if still empty
  useEffect(() => {
    try {
      if (suppressAutoFillRef.current) {
        console.log('[CreateSpace][footprintEffect] Suppressed autofill due to manual form clear');
        suppressAutoFillRef.current = false;
        return;
      }
      if (!footprint || !Array.isArray(footprint.points) || footprint.points.length < 3) return;
      // Fill area/perimeter if missing
      const needArea = !f.area;
      const needPer = !(f as any).perimeter;
      if (needArea || needPer) {
        const pts2d = footprint.points.map(p => ({ x: p.x, y: p.y }));
        const a = Math.abs(signedArea(pts2d));
        const per = polygonPerimeter2D(pts2d);
        computedPerimeterRef.current = per;
        console.log('[CreateSpace][footprintEffect] Recomputed area/perimeter:', a, per);
        setF(prev => ({
          ...prev,
          area: needArea ? a.toFixed(2) : prev.area,
          perimeter: needPer ? per.toFixed(2) : (prev as any).perimeter
        } as any));
      }
      // Fill level if still empty (prefer z from footprint)
      if (!f.level) {
        prefillBuildingAndLevel(footprint.z ?? baseZRef.current ?? null);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [footprint]);

  const onViewerClick = (ev: MouseEvent) => {
    try {
      if (!viewer?.impl) return;
      // Initialize base Z from first hit or ground if needed
      if (baseZRef.current == null) {
        const hit = viewer.impl.hitTest(ev.clientX, ev.clientY, true);
        if (hit?.point?.z != null) baseZRef.current = hit.point.z; else {
          try { baseZRef.current = viewer.model?.getBoundingBox?.().min?.z ?? 0; } catch { baseZRef.current = 0; }
        }
        console.log('[CreateSpace][onViewerClick] Base Z initialized:', baseZRef.current);
      }
      const z = baseZRef.current ?? 0;
      let p = null as any;
      try {
        if (snapperRef.current && typeof snapperRef.current.getSnapResult === 'function') {
          const sr = snapperRef.current.getSnapResult();
          if (sr) {
            const gp = (sr.getPoint && sr.getPoint()) || (sr.intersectPoint) || (sr.point) || null;
            if (gp && gp.x != null && gp.y != null && gp.z != null) {
              p = gp;
              console.log('[CreateSpace][onViewerClick] Snapped point:', p);
            }
          }
        }
      } catch (e) {
        console.warn('[CreateSpace][onViewerClick] Snap failed:', e);
      }
      if (!p) {
        p = worldOnZ(ev.clientX, ev.clientY, z);
        console.log('[CreateSpace][onViewerClick] Fallback worldOnZ point:', p);
      }
      if (!p) return;
      if (pointsRef.current.length >= 3 && isNearFirst(p)) {
        console.log('[CreateSpace][onViewerClick] Near first point, finishing drawing');
        finishDrawing();
        return;
      }
      pointsRef.current.push({ x: p.x, y: p.y, z });
      setPointCount(pointsRef.current.length);
      try { save(footprintDraftKey, pointsRef.current); } catch {}
      console.log('[CreateSpace][onViewerClick] Point added. Total:', pointsRef.current.length, 'Point:', p);
      drawPreview();
    } catch (e) {
      console.error('[CreateSpace][onViewerClick] Error:', e);
    }
  };

  const onViewerMove = (ev: MouseEvent) => {
    try {
      if (!viewer?.impl || !drawing) return;
      if (baseZRef.current == null) {
        const hit = viewer.impl.hitTest(ev.clientX, ev.clientY, true);
        if (hit?.point?.z != null) baseZRef.current = hit.point.z; else {
          try { baseZRef.current = viewer.model?.getBoundingBox?.().min?.z ?? 0; } catch { baseZRef.current = 0; }
        }
      }
      const z = baseZRef.current ?? 0;
      let p = null as any;
      try {
        if (snapperRef.current && typeof snapperRef.current.getSnapResult === 'function') {
          const sr = snapperRef.current.getSnapResult();
          if (sr) {
            const gp = (sr.getPoint && sr.getPoint()) || (sr.intersectPoint) || (sr.point) || null;
            if (gp && gp.x != null && gp.y != null && gp.z != null) p = gp;
          }
        }
      } catch {}
      if (!p) p = worldOnZ(ev.clientX, ev.clientY, z);
      if (!p) return;
      // snap-to-start preview
      if (pointsRef.current.length >= 2 && isNearFirst(p)) {
        const a = pointsRef.current[0];
        hoverRef.current = { x: a.x, y: a.y, z: a.z };
      } else {
        hoverRef.current = { x: p.x, y: p.y, z };
      }
      drawPreview();
    } catch { }
  };

  const onViewerDblClick = (ev: MouseEvent) => {
    try {
      if (!viewer?.impl || !drawing) return;
      if (pointsRef.current.length >= 3) finishDrawing();
    } catch { }
  };

  const onKeyDown = (ev: KeyboardEvent) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      finishDrawing();
      setConfirmOpen(true);
    } else if (ev.key === 'Escape') {
      ev.preventDefault();
      cancelDrawing();
    }
  };

  const startDrawing = async () => {
    console.log('[CreateSpace][startDrawing] Called. viewer:', !!viewer, 'isRemote:', isRemote);
    if (!viewer) {
      // Remote drawing: request main window to start capture
      try {
        console.log('[CreateSpace][startDrawing] Remote mode: sending FM_DRAW_START to opener');
        (window as any).opener?.postMessage?.({ type: 'FM_DRAW_START' }, '*');
        setFootprint(null);
        pointsRef.current = [];
        baseZRef.current = null;
        setDrawing(true);
        setPointCount(0);
        console.log('[CreateSpace][startDrawing] Remote: minimizing popup window');
        try { 
          if (window.opener) {
            window.opener.focus();
          }
          window.blur();
        } catch (e) {
          console.warn('[CreateSpace][startDrawing] Failed to minimize popup:', e);
        }
      } catch (e) {
        console.error('[CreateSpace][startDrawing] Remote mode error:', e);
      }
      return;
    }
    try {
      console.log('[CreateSpace][startDrawing] Main window mode: initializing drawing');
      setFootprint(null);
      pointsRef.current = [];
      baseZRef.current = null;
      hoverRef.current = null;
      setDrawing(true);
      setPointCount(0);
      console.log('[CreateSpace][startDrawing] Loading snapper extensions...');
      // Prefer Measure extension's snapper
      try {
        const measureExt = await viewer.loadExtension?.('Autodesk.Measure');
        const maybeSnapper = measureExt?.getSnapper?.();
        if (maybeSnapper) {
          snapperRef.current = maybeSnapper;
          try { maybeSnapper.activateSnap?.(true); } catch {}
          console.log('[CreateSpace][startDrawing] Measure snapper activated');
        }
      } catch (e) {
        console.warn('[CreateSpace][startDrawing] Measure extension failed:', e);
      }
      // Fallback: standalone snapping tool
      try {
        if (!snapperRef.current) {
          await viewer.loadExtension?.('Autodesk.Snapping');
          const S = (window as any).Autodesk?.Viewing?.Extensions?.Snapping;
          if (S) {
            const sn = new S.Snapper(viewer, true);
            viewer.toolController?.registerTool?.(sn);
            viewer.toolController?.activateTool?.(sn.getName?.());
            try { sn.activateSnap?.(true); } catch {}
            snapperRef.current = sn;
            console.log('[CreateSpace][startDrawing] Snapping tool activated');
          }
        }
      } catch (e) {
        console.warn('[CreateSpace][startDrawing] Snapping extension failed:', e);
      }
      viewer.container?.addEventListener('click', onViewerClick as any, true);
      viewer.container?.addEventListener('mousemove', onViewerMove as any, true);
      viewer.container?.addEventListener('dblclick', onViewerDblClick as any, true);
      window.addEventListener('keydown', onKeyDown as any, true);
      if (!viewer.impl.overlayScenes?.[overlayName]) viewer.impl.createOverlayScene(overlayName);
      // Force crosshair cursor
      if (viewer.container) {
        const container = viewer.container as HTMLElement;
        container.style.cursor = 'crosshair';
        container.style.setProperty('cursor', 'crosshair', 'important');
      }
      console.log('[CreateSpace][startDrawing] Drawing mode activated, listeners attached');
      try { window.dispatchEvent(new Event('fm-modal-minimize')); } catch {}
    } catch (e) {
      console.error('[CreateSpace][startDrawing] Error in main mode:', e);
    }
  };

  const finishDrawing = () => {
    try {
      console.log('[CreateSpace][finishDrawing] Called. isRemote:', isRemote, 'pointsRef.current.length:', pointsRef.current.length);
      if (isRemote) {
        // Ask main window to finalize and send us the points
        console.log('[CreateSpace][finishDrawing] Remote: sending FM_DRAW_FINISH to opener');
        (window as any).opener?.postMessage?.({ type: 'FM_DRAW_FINISH' }, '*');
        setDrawing(false);
        try { window.focus?.(); } catch {}
        return;
      }
      setDrawing(false);
      viewer?.container?.removeEventListener('click', onViewerClick as any, true);
      viewer?.container?.removeEventListener('mousemove', onViewerMove as any, true);
      viewer?.container?.removeEventListener('dblclick', onViewerDblClick as any, true);
      window.removeEventListener('keydown', onKeyDown as any, true);
      // Restore cursor
      if (viewer?.container) {
        const container = viewer.container as HTMLElement;
        container.style.cursor = 'default';
        container.style.removeProperty('cursor');
      }
      try { snapperRef.current?.deactivateSnap?.(); } catch {}
      try {
        const name = snapperRef.current?.getName?.();
        if (name) viewer.toolController?.deactivateTool?.(name);
      } catch {}
      const raw = pointsRef.current;
      console.log('[CreateSpace][finishDrawing] Raw points before sanitize:', raw.length);
      let pts = sanitizePolygon(raw);
      console.log('[CreateSpace][finishDrawing] Sanitized points:', pts.length);
      if (pts.length >= 3) {
        const fp = { points: [...pts], z: baseZRef.current ?? undefined, levelIndex: undefined };
        try { save(footprintDraftKey, fp.points); } catch {}
        // compute area/perimeter and prefill area field
        const a = Math.abs(signedArea(pts));
        const per = polygonPerimeter2D(pts);
        computedPerimeterRef.current = per;
        console.log('[CreateSpace][finishDrawing] Computed area/perimeter:', a, per);
        setF(prev => { const next = { ...prev, area: a.toFixed(2), perimeter: per.toFixed(2) } as any; console.log('[CreateSpace][finishDrawing] Form after area/perimeter set', next); return next; });
        // Prefill building/level
        prefillBuildingAndLevel(baseZRef.current);
        setFootprint(fp);
        drawFinalPolygon(pts);
        setConfirmOpen(true);
        try { window.dispatchEvent(new Event('fm-modal-restore')); } catch {}
        console.log('[CreateSpace][finishDrawing] Footprint set and confirmation opened:', fp);
      } else {
        // not enough points
        console.warn('[CreateSpace][finishDrawing] Not enough points after sanitize');
        setFootprint(null);
        clearOverlay();
      }
    } catch (e) {
      console.error('[CreateSpace][finishDrawing] Error:', e);
    }
  };

  const cancelDrawing = () => {
    try {
      if (isRemote) {
        (window as any).opener?.postMessage?.({ type: 'FM_DRAW_CANCEL' }, '*');
      }
      setDrawing(false);
      pointsRef.current = [];
      baseZRef.current = null;
      viewer?.container?.removeEventListener('click', onViewerClick as any, true);
      viewer?.container?.removeEventListener('mousemove', onViewerMove as any, true);
      viewer?.container?.removeEventListener('dblclick', onViewerDblClick as any, true);
      window.removeEventListener('keydown', onKeyDown as any, true);
      try { snapperRef.current?.deactivateSnap?.(); } catch {}
      try {
        const name = snapperRef.current?.getName?.();
        if (name) viewer.toolController?.deactivateTool?.(name);
      } catch {}
      clearOverlay();
      // Ensure footprint and confirmation are cleared too
      setFootprint(null);
      setConfirmOpen(false);
      try { save(footprintDraftKey, []); } catch {}
      try { window.dispatchEvent(new Event('fm-modal-restore')); } catch {}
      try { (viewer?.container as HTMLElement).style.cursor = 'default'; } catch { }
    } catch { }
  };

  const undoLastPoint = () => {
    try {
      if (!drawing) return;
      if (isRemote) {
        (window as any).opener?.postMessage?.({ type: 'FM_DRAW_UNDO' }, '*');
        // locally reflect count for button state
        pointsRef.current.pop();
        setPointCount(pointsRef.current.length);
        return;
      }
      pointsRef.current.pop();
      setPointCount(pointsRef.current.length);
      drawPreview();
    } catch { }
  };

  // Cleanup on unmount or viewer change
  useEffect(() => {
    return () => {
      try {
        viewer?.container?.removeEventListener('click', onViewerClick as any, true);
        viewer?.container?.removeEventListener('mousemove', onViewerMove as any, true);
        window.removeEventListener('keydown', onKeyDown as any, true);
        clearOverlay();
      } catch { }
    };
  }, [viewer]);

  // Remote drawing: receive points and completion from main window
  useEffect(() => {
    if (!isRemote) return;
    console.log('[CreateSpace][useEffect] Setting up remote message listener');
    const onMsg = (e: MessageEvent) => {
      const d: any = e.data;
      if (!d || typeof d !== 'object') return;
      console.log('[CreateSpace][onMsg] Received message:', d.type, d);
      if (d.type === 'FM_DRAW_POINT' && d.point) {
        try {
          const p = d.point as { x: number; y: number; z: number };
          pointsRef.current.push(p);
          setPointCount(pointsRef.current.length);
          try { save(footprintDraftKey, pointsRef.current); } catch {}
          // keep latest summary for UI
          setFootprint(prev => ({ points: [...pointsRef.current], z: pointsRef.current[0]?.z, levelIndex: undefined }));
          console.log('[CreateSpace][onMsg] Point added remotely. Total:', pointsRef.current.length);
        } catch (e) {
          console.error('[CreateSpace][onMsg] Error adding point:', e);
        }
      } else if (d.type === 'FM_DRAW_DONE' && Array.isArray(d.points)) {
        console.log('[CreateSpace][onMsg] Drawing done. Points received:', d.points.length);
        setDrawing(false);
        pointsRef.current = d.points;
        setPointCount(d.points.length);
        const fp = { points: [...d.points], z: d.points[0]?.z, levelIndex: undefined };
        setFootprint(fp);
        // compute area/perimeter and prefill area
        try {
          const pts2d = fp.points.map(p => ({ x: p.x, y: p.y }));
          const a = Math.abs(signedArea(pts2d));
          const per = polygonPerimeter2D(pts2d);
          computedPerimeterRef.current = per;
          console.log('[CreateSpace][remoteDone] Computed area/perimeter:', a, per);
          setF(prev => { const next = { ...prev, area: a.toFixed(2), perimeter: per.toFixed(2) } as any; console.log('[CreateSpace][remoteDone] Form after area/perimeter set', next); return next; });
        } catch {}
        // Prefill building and level and restore modal
        prefillBuildingAndLevel(fp?.z ?? null);
        setConfirmOpen(true);
        try { window.dispatchEvent(new Event('fm-modal-restore')); } catch {}
        try { save(footprintDraftKey, fp.points); } catch {}
        console.log('[CreateSpace][onMsg] Footprint set from remote:', fp);
      } else if (d.type === 'FM_DRAW_CANCELLED') {
        console.log('[CreateSpace][onMsg] Drawing cancelled remotely');
        setDrawing(false);
        pointsRef.current = [];
        setPointCount(0);
        setFootprint(null);
      }
    };
    window.addEventListener('message', onMsg);
    return () => {
      console.log('[CreateSpace][useEffect] Removing remote message listener');
      window.removeEventListener('message', onMsg);
    };
  }, [isRemote]);
  const onSave = async () => {
    const rec: SpaceRecord = {
      id: `space-${Date.now()}`,
      building: f.building || undefined,
      level: f.level || undefined,
      name: f.name || undefined,
      spaceCode: f.spaceCode || undefined,
      area: f.area ? Number(f.area) : undefined,
      description: f.description || undefined,
      source: 'MANUAL',
      dbId: null,
      modelGuid: (() => {
        try {
          const data = viewer?.model?.getData?.();
          const g = data?.guid;
          const urn = data?.urn || (viewer as any)?.impl?.model?.myData?.urn;
          if (g && urn) return `${g}|${urn}`;
          if (g) return g;
          const mid = (viewer as any)?.model?.id;
          return mid != null ? String(mid) : undefined;
        } catch { return undefined; }
      })(),
      perimeter: (computedPerimeterRef.current != null) ? computedPerimeterRef.current : (f as any).perimeter ? Number((f as any).perimeter) : undefined
    };
    
    if (!projectId) {
      console.warn('[CreateSpace] No projectId - space not saved to DB');
      return;
    }
    
    try {
      const res = await fetch(`/api/projects/${projectId}/spaces`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ ...rec, footprint: footprint || null }) 
      });
      
      if (res.ok) {
        let saved: any = null; try { saved = await res.json(); } catch {}
        console.log('[CreateSpace] Space saved to DB successfully');
        // Trigger a refresh event so SpaceList reloads
        const savedSpace = saved?.space || saved || rec;
        window.dispatchEvent(new CustomEvent('space-created', { detail: { projectId, space: savedSpace } }));
        
        // Clear form
        const emptyForm = { building: '', level: '', name: '', spaceCode: '', area: '', perimeter: '', description: '' };
        setF(emptyForm);
        save(`fm-create-space-draft-${projectId || 'global'}`, emptyForm);
        try { save(footprintDraftKey, []); } catch {}
        
        // Clear footprint
        setFootprint(null);
        cancelDrawing();
      } else {
        console.error('[CreateSpace] Failed to save space to DB');
      }
    } catch (e) {
      console.error('[CreateSpace] Error saving space:', e);
    }
  };
  const clearForm = () => {
    try {
      suppressAutoFillRef.current = true;
      const next = { building: f.building || '', level: '', name: '', spaceCode: '', area: '', perimeter: '', description: '' } as any;
      setF(next);
      computedPerimeterRef.current = null;
      try { save(`fm-create-space-draft-${projectId || 'global'}`, next); } catch {}
      console.log('[CreateSpace][form] Cleared form fields (kept building)', next);
    } catch {}
  };

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-white font-semibold text-sm">Create New Space</div>
        <button type="button" onClick={clearForm} className="px-2 py-1 rounded text-xs bg-gray-700 hover:bg-gray-600 text-white">Clear</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className="text-[12px] text-gray-300 block mb-1">Building</label><input value={f.building} onChange={e => { console.log('[CreateSpace][input] building change:', e.target.value); setF(v => ({ ...v, building: e.target.value })); }} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm" /></div>
        <div><label className="text-[12px] text-gray-300 block mb-1">Level</label><input value={f.level} onChange={e => { console.log('[CreateSpace][input] level change:', e.target.value); setF(v => ({ ...v, level: e.target.value })); }} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm" /></div>
        <div><label className="text-[12px] text-gray-300 block mb-1">Room name</label><input value={f.name} onChange={e => setF(v => ({ ...v, name: e.target.value }))} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm" /></div>
        <div><label className="text-[12px] text-gray-300 block mb-1">Space Code</label><input value={f.spaceCode} onChange={e => setF(v => ({ ...v, spaceCode: e.target.value }))} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm" /></div>
        <div><label className="text-[12px] text-gray-300 block mb-1">Area (m²)</label><input value={f.area} onChange={e => { console.log('[CreateSpace][input] area change:', e.target.value); setF(v => ({ ...v, area: e.target.value })); }} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm" /></div>
        <div><label className="text-[12px] text-gray-300 block mb-1">Perimeter (m)</label><input value={(f as any).perimeter} onChange={e => { console.log('[CreateSpace][input] perimeter change:', e.target.value); setF(v => ({ ...(v as any), perimeter: e.target.value } as any)); }} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm" /></div>
        <div className="col-span-2"><label className="text-[12px] text-gray-300 block mb-1">Description</label><input value={f.description} onChange={e => setF(v => ({ ...v, description: e.target.value }))} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm" /></div>
      </div>
      {/* Footprint Editor */}
      <div className="border-t border-gray-700 pt-3">
        <div className="text-xs text-gray-400 mb-2">2D Footprint (optional)</div>
        <div className="flex flex-wrap gap-2">
          <button onClick={startDrawing} disabled={(!!viewer === false && !isRemote) || drawing} className={`px-3 py-1.5 rounded text-xs ${(((!!viewer === false) && !isRemote) || drawing) ? 'bg-gray-700 text-gray-400' : 'bg-emerald-700 hover:bg-emerald-800 text-white'}`}>Start drawing</button>
          <button onClick={finishDrawing} disabled={!drawing || pointCount < 3} className={`px-3 py-1.5 rounded text-xs ${(!drawing || pointCount < 3) ? 'bg-gray-700 text-gray-400' : 'bg-blue-700 hover:bg-blue-800 text-white'}`}>Finish</button>
          <button onClick={undoLastPoint} disabled={!drawing || pointsRef.current.length === 0} className={`px-3 py-1.5 rounded text-xs ${(!drawing || pointsRef.current.length === 0) ? 'bg-gray-700 text-gray-400' : 'bg-yellow-700 hover:bg-yellow-800 text-white'}`}>Undo</button>
          <button type="button" onClick={cancelDrawing} disabled={!drawing && !footprint} className={`px-3 py-1.5 rounded text-xs ${(!drawing && !footprint) ? 'bg-gray-700 text-gray-400' : 'bg-red-700 hover:bg-red-800 text-white'}`}>Clear</button>
        </div>
        <div className="text-[11px] text-gray-500 mt-2">
          {drawing
            ? `Drawing... ${pointCount} point${pointCount !== 1 ? 's' : ''} added. Click to add more, Enter to finish, ESC to cancel.`
            : footprint
              ? `${footprint.points.length} points captured at z=${(footprint.z ?? 0).toFixed?.(2)}`
              : 'No footprint set.'}
        </div>
      </div>
      {confirmOpen && footprint && (
        <div className="mt-3 border border-gray-700 rounded p-2 bg-gray-900 text-xs text-gray-200">
          <div className="mb-2 font-semibold">Footprint Points (x, y, z):</div>
          <div className="max-h-40 overflow-auto space-y-1 bg-gray-950 p-2 rounded">
            {footprint.points.map((p, i) => (
              <div key={i} className="font-mono">{i + 1}. ({p.x.toFixed(3)}, {p.y.toFixed(3)}, {p.z.toFixed(3)})</div>
            ))}
          </div>
          <div className="mt-2"><button onClick={() => { console.log('[CreateSpace][confirmClose] Closing confirmation'); setConfirmOpen(false); }} className="px-3 py-1.5 rounded text-xs bg-gray-700 hover:bg-gray-600 text-white">Close</button></div>
        </div>
      )}
      <div><button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded" onClick={onSave}>Save Space</button></div>
    </div>
  );
};

const ScheduledMaintenance: React.FC<{ projectId?: string; viewer?: any; preSelectedAssets?: AssetRecord[]; onClearPreSelected?: () => void; }> = ({ projectId, viewer, preSelectedAssets, onClearPreSelected }) => {
  // Prepare category options from CATEGORY_MAPPING
  const categoryOptions = React.useMemo(() => {
    return Object.entries(CATEGORY_MAPPING).map(([italian, mapping]) => ({
      value: `${italian} / ${mapping.english} (${mapping.ifc})`,
      label: `${italian} / ${mapping.english} (${mapping.ifc})`
    }));
  }, []);

  const [rows, setRows] = useState<ScheduledItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const [assetSearch, setAssetSearch] = useState('');
  const [assetCategoryFilter, setAssetCategoryFilter] = useState('');
  const [assetIfcClassFilter, setAssetIfcClassFilter] = useState('');
  const [assetSortBy, setAssetSortBy] = useState<'name' | 'category' | 'location'>('name');

  // Store previously filled values to enable inheritance
  const [previousFormValues, setPreviousFormValues] = useState({ discipline: '', revitCategory: '', ifcClass: '' });
  const [f, setF] = useState({ discipline: '', revitCategory: '', ifcClass: '', code: '', asset: '', frequency: '', timeHours: '' });
  const [selectedAssets, setSelectedAssets] = useState<{ label: string; type?: string; id?: string; assetRecord?: AssetRecord }[]>([]);
  const [allowedAssetType, setAllowedAssetType] = useState<string | null>(null);
  const [currentTask, setCurrentTask] = useState('');
  const [tasks, setTasks] = useState<string[]>([]);
  const [errors, setErrors] = useState({ discipline: '', category: '', code: '', asset: '', frequency: '', timeHours: '', tasks: '' });
  const [submitMessage, setSubmitMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // Initialize form with draft (unsaved) values first, fallback to previously submitted values
  useEffect(() => {
    const draftKey = `fm-scheduled-maintenance-draft-${projectId || 'global'}`;
    const previousKey = `fm-scheduled-maintenance-previous-${projectId || 'global'}`;
    const savedDraft = load(draftKey, { discipline: '', revitCategory: '', ifcClass: '' });
    const savedPrevious = load(previousKey, { discipline: '', revitCategory: '', ifcClass: '' });
    // Prefer draft if any of the fields are non-empty, else use previous
    const source = (savedDraft.discipline || savedDraft.revitCategory || savedDraft.ifcClass) ? savedDraft : savedPrevious;
    setPreviousFormValues(savedPrevious); // keep previous stored separately
    setF(prev => ({
      ...prev,
      discipline: source.discipline,
      revitCategory: source.revitCategory,
      ifcClass: source.ifcClass
    }));
  }, [projectId]);

  // Autosave draft of inheritance fields on change (without needing submission)
  useEffect(() => {
    const draftKey = `fm-scheduled-maintenance-draft-${projectId || 'global'}`;
    // Debounce save to avoid excessive writes
    const handle = setTimeout(() => {
      try {
        const draft = { discipline: f.discipline, revitCategory: f.revitCategory, ifcClass: f.ifcClass };
        save(draftKey, draft);
      } catch {}
    }, 300);
    return () => clearTimeout(handle);
  }, [f.discipline, f.revitCategory, f.ifcClass, projectId]);

  // Load scheduled maintenance from API
  useEffect(() => {
    if (!projectId) {
      // Fallback to localStorage for non-project mode
      const loaded = load(K.scheduled(projectId), [] as ScheduledItem[]);
      const migrated = loaded.map(item => {
        if (!item.tasks && (item as any).task) {
          const legacyTask = (item as any).task as string;
          return { ...item, tasks: legacyTask.split(',').map(t => t.trim()).filter(Boolean) };
        }
        return item;
      });
      setRows(migrated);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/projects/${projectId}/scheduled-maintenance`);
        if (res.ok) {
          const data = await res.json();
          setRows(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error('Failed to load scheduled maintenance:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [projectId]);

  // Load assets from API for picker
  useEffect(() => {
    if (!projectId || assetsLoaded) return;

    // local helpers (same logic as AssetList) -------------------------------------------------
    const dedupeAssetsLocal = (arr: AssetRecord[]): AssetRecord[] => {
      const score = (x: AssetRecord) => {
        const fields: (keyof AssetRecord)[] = [
          'assetCode','assetName','category','type','brand','model','serialNumber','installationDate',
          'material','dimensions','weight','capacity','powerRating','location','description'
        ];
        let n = 0; for (const f of fields) if ((x as any)[f]) n++;
        return n;
      };
      const map = new Map<string, AssetRecord>();
      for (const a of arr) {
        const key = (a.source === 'BIM_MODEL' && a.dbId != null)
          ? `BIM|${a.modelGuid || 'g'}|${a.dbId}`
          : `ID|${a.id}`;
        const ex = map.get(key);
        if (!ex) map.set(key, a);
        else map.set(key, score(a) >= score(ex) ? a : ex);
      }
      return Array.from(map.values());
    };

    const getCurrentModelGuidLocal = (): string | undefined => {
      try {
        const g = viewer?.model?.getData?.()?.guid;
        if (g && typeof g === 'string') return g;
        const mid = viewer?.model?.id;
        return (mid != null) ? String(mid) : undefined;
      } catch { return undefined; }
    };

    const filterAssetsForCurrentModelLocal = (arr: AssetRecord[]): AssetRecord[] => {
      const g = getCurrentModelGuidLocal();
      if (!g) return arr;
      return arr.filter(a => a.source !== 'BIM_MODEL' || a.modelGuid === g);
    };

    const fetchAssets = async () => {
      setAssetsLoading(true);
      try {
        const currentGuid = getCurrentModelGuidLocal();
        if (!currentGuid) {
          // fallback: use cached and dedupe
          const cachedAll = load(K.assets(projectId), [] as AssetRecord[]);
          const filtered = filterAssetsForCurrentModelLocal(cachedAll);
          const deduped = dedupeAssetsLocal(filtered);
          setAssets(deduped);
          setAssetsLoaded(true);
          return;
        }

        const res = await fetch(`/api/projects/${projectId}/assets?modelGuid=${encodeURIComponent(currentGuid)}`);
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : [];

          // Merge backend list with cached assets in localStorage so we don't lose richer local fields
          const cachedAll = load(K.assets(projectId), [] as AssetRecord[]);
          const cached = cachedAll.filter(a => a.source !== 'BIM_MODEL' || a.modelGuid === currentGuid);
          const mergedById = list.map(b => {
            const c = cached.find(x => x.id === b.id);
            if (!c) return b;
            const merged: any = { ...b };
            for (const key of Object.keys(c)) {
              const val = (c as any)[key];
              if (val !== null && val !== undefined && val !== '') merged[key] = val;
            }
            return merged as AssetRecord;
          });
          const cachedOnly = cached.filter(c => !list.find(b => b.id === c.id));
          const finalList = [...mergedById, ...cachedOnly];

          const filtered = filterAssetsForCurrentModelLocal(finalList);
          const deduped = dedupeAssetsLocal(filtered);
          setAssets(deduped);
          setAssetsLoaded(true);
        }
      } catch (err) {
        console.error('Failed to load assets:', err);
      } finally {
        setAssetsLoading(false);
      }
    };
    fetchAssets();
  }, [projectId, assetsLoaded]);

  // Handle pre-selected assets from Asset List
  useEffect(() => {
    if (preSelectedAssets && preSelectedAssets.length > 0) {
      // Convert pre-selected assets to the format expected by selectedAssets
      const formattedAssets = preSelectedAssets.map(asset => ({
        label: asset.assetName || asset.assetCode || asset.id,
        type: asset.category,
        id: asset.id,
        assetRecord: asset
      }));
      
      setSelectedAssets(formattedAssets);
      
      // Set the category if all assets have the same category
      const categories = preSelectedAssets.map(a => a.category).filter(Boolean);
      if (categories.length > 0) {
        const firstCategory = categories[0];
        const allSame = categories.every(c => c === firstCategory);
        if (allSame && firstCategory) {
          // Try to find matching master label
          for (const [italian, mapping] of Object.entries(CATEGORY_MAPPING)) {
            const label = `${italian} / ${mapping.english} (${mapping.ifc})`;
            const tokens = [italian, mapping.english, mapping.ifc].filter(Boolean);
            if (tokens.some(t => String(firstCategory).toLowerCase().includes(String(t).toLowerCase()))) {
              setF(prev => ({ ...prev, revitCategory: label }));
              setAllowedAssetType(label);
              break;
            }
          }
        }
      }
      
      // Clear pre-selected assets after processing
      if (onClearPreSelected) {
        onClearPreSelected();
      }
    }
  }, [preSelectedAssets, onClearPreSelected]);

  // Filtered assets for picker
  const filteredAssets = React.useMemo(() => {
    let result = assets;

    // Apply search filter
    if (assetSearch.trim()) {
      const search = assetSearch.toLowerCase();
      result = result.filter(a =>
        a.assetName?.toLowerCase().includes(search) ||
        a.assetCode?.toLowerCase().includes(search) ||
        a.category?.toLowerCase().includes(search) ||
        a.location?.toLowerCase().includes(search) ||
        a.type?.toLowerCase().includes(search) ||
        a.brand?.toLowerCase().includes(search)
      );
    }

    // Apply category filter
    if (assetCategoryFilter) {
      // Build master label -> tokens map (italian, english, ifc)
      const masterMap = new Map<string, string[]>();
      for (const [italian, mapping] of Object.entries(CATEGORY_MAPPING)) {
        const label = `${italian} / ${mapping.english} (${mapping.ifc})`;
        masterMap.set(label, [italian, mapping.english, mapping.ifc].filter(Boolean) as string[]);
      }

      if (masterMap.has(assetCategoryFilter)) {
        const tokens = masterMap.get(assetCategoryFilter) || [];
        result = result.filter(a => {
          if (!a.category) return false;
          const cat = String(a.category).toLowerCase();
          // Match if any token appears in asset.category (case-insensitive) or equals
          return tokens.some(t => t && cat.includes(String(t).toLowerCase()));
        });
      } else {
        // Extra (non-master) categories: exact match
        result = result.filter(a => a.category === assetCategoryFilter);
      }
    }

    // Apply IFC class filter (picker)
    if (assetIfcClassFilter) {
      const sel = assetIfcClassFilter.toLowerCase();
      result = result.filter(a => {
        const candidate = `${(a as any).ifcClass || (a as any).ifcType || (a as any).ifcPredefined || a.category || ''}`.toLowerCase();
        return candidate === sel || candidate.includes(sel) || sel.includes(candidate);
      });
    }

    // Apply sorting
    result = [...result].sort((a, b) => {
      switch (assetSortBy) {
        case 'name':
          return (a.assetName || '').localeCompare(b.assetName || '');
        case 'category':
          return (a.category || '').localeCompare(b.category || '');
        case 'location':
          return (a.location || '').localeCompare(b.location || '');
        default:
          return 0;
      }
    });

    return result;
  }, [assets, assetSearch, assetCategoryFilter, assetIfcClassFilter, assetSortBy]);

  // Get category list for filter: start with master categoryOptions (labels), then add any extra categories found in assets
  // master labels are like "Italian / English (IFC)"; assets may have raw categories — include them too and mark as extra
  const assetCategories = React.useMemo(() => REVIT_CATEGORIES, []);

  // Reusable Asset List selection modal using the same table design as Asset List
  const AssetListSelectionModal: React.FC<{
    projectId?: string;
    viewer?: any;
    initialCategory?: string;
    initialIfcClass?: string;
    multi?: boolean;
    onClose: () => void;
    onConfirm: (assets: AssetRecord[]) => void;
  }> = ({ projectId, viewer, initialCategory, initialIfcClass, multi = true, onClose, onConfirm }) => {
    const [assets, setAssets] = useState<AssetRecord[]>([]);
    const [assetsLoading, setAssetsLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState(initialCategory || '');
    const [ifcFilter, setIfcFilter] = useState(initialIfcClass || '');
    const [sortBy, setSortBy] = useState<'name' | 'category' | 'location'>('name');
    const [selected, setSelected] = useState<Set<string>>(new Set());

    // Column widths state for resizable columns
    const [columnWidths, setColumnWidths] = useState({
      checkbox: 50,
      source: 90,
      category: 150,
      assetCode: 140,
      assetName: 180,
      type: 150,
      brand: 120,
      model: 120
    });

    // Persist widths so user sizing sticks while using the app
    const COL_WIDTHS_STORAGE_KEY = React.useMemo(() => `fm-sched-assetlist-colwidths-${projectId || 'global'}`, [projectId]);
    useEffect(() => {
      try {
        const saved = localStorage.getItem(COL_WIDTHS_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === 'object') {
            setColumnWidths(prev => ({ ...prev, ...parsed }));
          }
        }
      } catch {}
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [COL_WIDTHS_STORAGE_KEY]);
    useEffect(() => {
      try { localStorage.setItem(COL_WIDTHS_STORAGE_KEY, JSON.stringify(columnWidths)); } catch {}
    }, [COL_WIDTHS_STORAGE_KEY, columnWidths]);

    // Reusable column resize starter for headers
    const startColumnResize = (key: keyof typeof columnWidths, minWidth = 60) => (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startWidth = columnWidths[key];

      const onMouseMove = (ev: MouseEvent) => {
        const diff = ev.clientX - startX;
        setColumnWidths(prev => ({ ...prev, [key]: Math.max(minWidth, Math.round(startWidth + diff)) }));
      };
      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        try {
          document.body.style.cursor = '';
          document.body.classList.remove('select-none');
        } catch {}
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      try {
        document.body.style.cursor = 'col-resize';
        document.body.classList.add('select-none');
      } catch {}
    };

    // Helpers adapted from Asset List and Scheduled Maintenance loaders
    const dedupeAssetsLocal = (arr: AssetRecord[]): AssetRecord[] => {
      const score = (x: AssetRecord) => {
        const fields: (keyof AssetRecord)[] = [
          'assetCode','assetName','category','type','brand','model','serialNumber','installationDate',
          'material','dimensions','weight','capacity','powerRating','location','description'
        ];
        let n = 0; for (const f of fields) if ((x as any)[f]) n++;
        return n;
      };
      const map = new Map<string, AssetRecord>();
      for (const a of arr) {
        const key = (a.source === 'BIM_MODEL' && a.dbId != null)
          ? `BIM|${a.modelGuid || 'g'}|${a.dbId}`
          : `ID|${a.id}`;
        const ex = map.get(key);
        if (!ex) map.set(key, a); else map.set(key, score(a) >= score(ex) ? a : ex);
      }
      return Array.from(map.values());
    };
    const getCurrentModelGuidLocal = (): string | undefined => {
      try {
        const g = viewer?.model?.getData?.()?.guid;
        if (g && typeof g === 'string') return g;
        const mid = viewer?.model?.id;
        return (mid != null) ? String(mid) : undefined;
      } catch { return undefined; }
    };
    const filterAssetsForCurrentModelLocal = (arr: AssetRecord[]): AssetRecord[] => {
      const g = getCurrentModelGuidLocal();
      if (!g) return arr;
      return arr.filter(a => a.source !== 'BIM_MODEL' || a.modelGuid === g);
    };

    useEffect(() => {
      if (!projectId) return;
      const fetchAssets = async () => {
        setAssetsLoading(true);
        try {
          const currentGuid = getCurrentModelGuidLocal();
          const cachedAll = load(K.assets(projectId), [] as AssetRecord[]);
          let base: AssetRecord[] = [];

          if (currentGuid) {
            const res = await fetch(`/api/projects/${projectId}/assets?modelGuid=${encodeURIComponent(currentGuid)}`);
            if (res.ok) {
              const json = await res.json();
              const list = Array.isArray(json) ? json : [];
              const cached = cachedAll.filter(a => a.source !== 'BIM_MODEL' || a.modelGuid === currentGuid);
              const merged = list.map((b: any) => {
                const c = cached.find(x => x.id === b.id);
                if (!c) return b;
                const m: any = { ...b };
                for (const key of Object.keys(c)) {
                  const val = (c as any)[key];
                  if (val !== null && val !== undefined && val !== '') m[key] = val;
                }
                return m as AssetRecord;
              });
              const cachedOnly = cached.filter(c => !list.find((b: any) => b.id === c.id));
              base = [...merged, ...cachedOnly];
            } else {
              base = cachedAll;
            }
          } else {
            base = cachedAll;
          }

          const filtered = filterAssetsForCurrentModelLocal(base);
          const deduped = dedupeAssetsLocal(filtered);
          console.log('[AssetListSelectionModal] Assets loaded:', {
            totalCount: deduped.length,
            samples: deduped.slice(0, 3).map(a => ({
              id: a.id,
              assetName: a.assetName,
              assetCode: a.assetCode,
              category: a.category,
              type: a.type
            }))
          });
          setAssets(deduped);
        } catch (err) {
          console.error('[AssetListSelectionModal] Failed to load assets:', err);
        } finally {
          setAssetsLoading(false);
        }
      };
      fetchAssets();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId]);

    const filtered = React.useMemo(() => {
      let result = assets;
      if (search.trim()) {
        const s = search.toLowerCase();
        result = result.filter(a =>
          a.assetName?.toLowerCase().includes(s) ||
          a.assetCode?.toLowerCase().includes(s) ||
          a.category?.toLowerCase().includes(s) ||
          a.location?.toLowerCase().includes(s) ||
          a.type?.toLowerCase().includes(s) ||
          a.brand?.toLowerCase().includes(s)
        );
      }
      if (categoryFilter) {
        // Find English equivalent from CATEGORY_MAPPING if Italian category is selected
        const mapping = Object.entries(CATEGORY_MAPPING).find(([italian]) => italian === categoryFilter);
        const englishEquivalent = mapping ? mapping[1].english : null;
        
        result = result.filter(a => {
          const assetCategory = (a.category || '').toLowerCase();
          const filterLower = categoryFilter.toLowerCase();
          
          // Match if:
          // 1. Exact match with selected category (Italian)
          // 2. Contains selected category name
          // 3. Matches English equivalent (e.g., "Porte" matches "Door", "Doors")
          const matchesItalian = (a.category || '') === categoryFilter || assetCategory.includes(filterLower);
          const matchesEnglish = englishEquivalent && assetCategory.includes(englishEquivalent.toLowerCase());
          
          return matchesItalian || matchesEnglish;
        });
      }
      if (ifcFilter) {
        const sel = ifcFilter.toLowerCase();
        result = result.filter(a => {
          const cand = `${(a as any).ifcClass || (a as any).ifcType || (a as any).ifcPredefined || a.category || ''}`.toLowerCase();
          return cand === sel || cand.includes(sel) || sel.includes(cand);
        });
      }
      result = [...result].sort((a, b) => {
        switch (sortBy) {
          case 'category': return (a.category || '').localeCompare(b.category || '');
          case 'location': return (a.location || '').localeCompare(b.location || '');
          default: return (a.assetName || '').localeCompare(b.assetName || '');
        }
      });
      return result;
    }, [assets, search, categoryFilter, ifcFilter, sortBy]);

    const toggle = (id: string) => {
      setSelected(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else {
          if (!multi) next.clear();
          next.add(id);
        }
        return next;
      });
    };

    const confirm = () => {
      const picked = filtered.filter(a => selected.has(a.id));
      console.log('[AssetListSelectionModal.confirm] picked assets count:', picked.length);
      picked.forEach((asset, idx) => {
        console.log(`[AssetListSelectionModal] Picked asset ${idx}:`, {
          id: asset.id,
          assetName: asset.assetName,
          assetCode: asset.assetCode,
          category: asset.category,
          type: asset.type,
          location: asset.location,
          source: asset.source,
          dbId: asset.dbId
        });
      });
      onConfirm(picked);
      onClose();
    };

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
        <div className="bg-gray-800 rounded-lg p-4 w-full max-w-6xl flex flex-col resize overflow-auto" style={{ minWidth: '600px', minHeight: '560px', maxHeight: 'calc(100vh - 40px)', maxWidth: 'calc(100vw - 40px)' }} onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold">Asset List</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">&times;</button>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-2 items-center">
            <input
              placeholder="Search assets by name, code, category, location, type, brand..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full max-w-[760px] bg-gray-700 border border-gray-600 rounded-md px-3 text-white text-sm h-9"
            />
            <div className="flex gap-2 items-center w-full">
              <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="flex-1 min-w-[140px] bg-gray-700 border border-gray-600 rounded-md px-3 text-white text-sm h-9">
                <option value="">Revit Categories</option>
                {REVIT_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              <select value={ifcFilter} onChange={e => setIfcFilter(e.target.value)} className="flex-1 min-w-[140px] bg-gray-700 border border-gray-600 rounded-md px-3 text-white text-sm h-9">
                <option value="">Ifc Class</option>
                {IFCCLASSES_UNIQUE.map(ic => <option key={ic} value={ic}>{ic}</option>)}
              </select>
              <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="flex-1 min-w-[120px] bg-gray-700 border border-gray-600 rounded-md px-3 text-white text-sm h-9">
                <option value="name">Name (A-Z)</option>
                <option value="category">Category (A-Z)</option>
                <option value="location">Location (A-Z)</option>
              </select>
              <div className="px-3 h-9 flex items-center bg-gray-700/50 rounded text-xs text-gray-300">
                {filtered.length} item{filtered.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto border border-gray-700 rounded">
            {assetsLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
                <div className="text-gray-400 text-sm">Loading assets...</div>
              </div>
            ) : (
              <table className="w-full text-xs" style={{ tableLayout: 'fixed' }}>
                <thead className="sticky top-0 bg-gray-800/90 backdrop-blur border-b border-gray-700 text-gray-300">
                  <tr>
                    <th className="py-1.5 relative group" style={{ width: `${columnWidths.checkbox}px`, paddingLeft: '6px', paddingRight: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <input type="checkbox" onChange={e => {
                        const allIds = filtered.map(a => a.id);
                        setSelected(prev => {
                          const next = new Set<string>();
                          if (e.target.checked) allIds.forEach(id => next.add(id));
                          return next;
                        });
                      }} />
                      <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize" onMouseDown={startColumnResize('checkbox', 40)}>
                        <div className="h-full w-1 bg-transparent group-hover:bg-cyan-400/60" />
                      </div>
                    </th>
                    <th className="text-left py-1.5 relative group" style={{ width: `${columnWidths.source}px`, paddingLeft: '8px', paddingRight: '8px' }}>
                      Source
                      <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize" onMouseDown={startColumnResize('source', 60)}>
                        <div className="h-full w-1 bg-transparent group-hover:bg-cyan-400/60" />
                      </div>
                    </th>
                    <th className="text-left py-1.5 relative group" style={{ width: `${columnWidths.category}px`, paddingLeft: '8px', paddingRight: '8px' }}>
                      Category
                      <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize" onMouseDown={startColumnResize('category', 80)}>
                        <div className="h-full w-1 bg-transparent group-hover:bg-cyan-400/60" />
                      </div>
                    </th>
                    <th className="text-left py-1.5 relative group" style={{ width: `${columnWidths.assetCode}px`, paddingLeft: '8px', paddingRight: '8px' }}>
                      Asset Code
                      <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize" onMouseDown={startColumnResize('assetCode', 80)}>
                        <div className="h-full w-1 bg-transparent group-hover:bg-cyan-400/60" />
                      </div>
                    </th>
                    <th className="text-left py-1.5 relative group" style={{ width: `${columnWidths.assetName}px`, paddingLeft: '8px', paddingRight: '8px' }}>
                      Asset Name
                      <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize" onMouseDown={startColumnResize('assetName', 80)}>
                        <div className="h-full w-1 bg-transparent group-hover:bg-cyan-400/60" />
                      </div>
                    </th>
                    <th className="text-left py-1.5 relative group" style={{ width: `${columnWidths.type}px`, paddingLeft: '8px', paddingRight: '8px' }}>
                      Type
                      <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize" onMouseDown={startColumnResize('type', 80)}>
                        <div className="h-full w-1 bg-transparent group-hover:bg-cyan-400/60" />
                      </div>
                    </th>
                    <th className="text-left py-1.5 relative group" style={{ width: `${columnWidths.brand}px`, paddingLeft: '8px', paddingRight: '8px' }}>
                      Brand
                      <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize" onMouseDown={startColumnResize('brand', 80)}>
                        <div className="h-full w-1 bg-transparent group-hover:bg-cyan-400/60" />
                      </div>
                    </th>
                    <th className="text-left py-1.5 relative group" style={{ width: `${columnWidths.model}px`, paddingLeft: '8px', paddingRight: '8px' }}>
                      Model
                      <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize" onMouseDown={startColumnResize('model', 80)}>
                        <div className="h-full w-1 bg-transparent group-hover:bg-cyan-400/60" />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-3 py-6 text-center text-gray-400">No assets</td>
                    </tr>
                  ) : filtered.map(a => (
                    <tr key={a.id} className="border-b border-gray-800 hover:bg-gray-800/60">
                      <td style={{ width: `${columnWidths.checkbox}px`, paddingLeft: '6px', paddingRight: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }} className="py-1.5">
                        <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggle(a.id)} />
                      </td>
                      <td style={{ width: `${columnWidths.source}px`, paddingLeft: '8px', paddingRight: '8px' }} className="py-1.5">
                        <span className={`text-xs px-2 py-0.5 rounded ${a.source === 'BIM_MODEL' ? 'bg-green-900/40 text-green-300' : 'bg-blue-900/40 text-blue-300'}`}>
                          {a.source === 'BIM_MODEL' ? 'BIM' : 'Manual'}
                        </span>
                      </td>
                      <td style={{ width: `${columnWidths.category}px`, paddingLeft: '8px', paddingRight: '8px' }} className="py-1.5 text-gray-100 truncate" title={stripRevitPrefix(a.category) || '-'}>{stripRevitPrefix(a.category) || '-'}</td>
                      <td style={{ width: `${columnWidths.assetCode}px`, paddingLeft: '8px', paddingRight: '8px' }} className="py-1.5 text-gray-200 truncate" title={a.assetCode || '-'}>{a.assetCode || '-'}</td>
                      <td style={{ width: `${columnWidths.assetName}px`, paddingLeft: '8px', paddingRight: '8px' }} className="py-1.5 text-gray-200 truncate" title={a.assetName || '-'}>{a.assetName || '-'}</td>
                      <td style={{ width: `${columnWidths.type}px`, paddingLeft: '8px', paddingRight: '8px' }} className="py-1.5 text-gray-200 truncate" title={a.type || '-'}>{a.type || '-'}</td>
                      <td style={{ width: `${columnWidths.brand}px`, paddingLeft: '8px', paddingRight: '8px' }} className="py-1.5 text-gray-200 truncate" title={a.brand || '-'}>{a.brand || '-'}</td>
                      <td style={{ width: `${columnWidths.model}px`, paddingLeft: '8px', paddingRight: '8px' }} className="py-1.5 text-gray-200 truncate" title={a.model || '-'}>{a.model || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div className="text-xs text-gray-400">{selected.size} selected</div>
            <div className="flex gap-2">
              <button onClick={onClose} className="px-3 py-1.5 rounded text-xs bg-gray-700 hover:bg-gray-600 text-white">Cancel</button>
              <button onClick={confirm} disabled={selected.size === 0} className={`px-3 py-1.5 rounded text-xs ${selected.size === 0 ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>Add Selected</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const addTask = () => {
    if (currentTask.trim()) {
      setTasks(prev => [...prev, currentTask.trim()]);
      setCurrentTask('');
      // Clear task-related error immediately
      setErrors(prev => ({ ...prev, tasks: '' }));
      setSubmitMessage(null);
    }
  };

  const removeTask = (index: number) => {
    setTasks(prev => prev.filter((_, i) => i !== index));
  };

  const selectAsset = (asset: AssetRecord) => {
    const label = asset.assetName || asset.assetCode || `Asset ${asset.id}`;
    const type = asset.type || asset.category || '';

    // Enforce match against currently selected Revit Category / Ifc Class
    const matchesFormCategory = () => {
      // Build master label -> tokens map (italian, english, ifc)
      const masterMap = new Map<string, string[]>();
      for (const [italian, mapping] of Object.entries(CATEGORY_MAPPING)) {
        const label = `${italian} / ${mapping.english} (${mapping.ifc})`;
        masterMap.set(label, [italian, mapping.english, mapping.ifc].filter(Boolean) as string[]);
      }
      let ok = true;
      if (f.revitCategory) {
        const tokens = masterMap.get(f.revitCategory) || [];
        const cat = (asset.category || '').toLowerCase();
        ok = tokens.some(t => t && cat.includes(String(t).toLowerCase()));
      }
      if (ok && f.ifcClass) {
        const sel = f.ifcClass.toLowerCase();
        const candidate = `${(asset as any).ifcClass || (asset as any).ifcType || (asset as any).ifcPredefined || asset.category || ''}`.toLowerCase();
        ok = candidate === sel || candidate.includes(sel) || sel.includes(candidate);
      }
      return ok;
    };

    if (!matchesFormCategory()) {
      setSubmitMessage({ type: 'error', text: 'Asset does not match the selected Revit Category / Ifc Class.' });
      return;
    }

    // Enforce same type as first selected asset
    if (allowedAssetType && type !== allowedAssetType) {
      setSubmitMessage({ type: 'error', text: `Only assets of type "${allowedAssetType}" can be added. This asset is "${type}".` });
      return;
    }

    setSelectedAssets(prev => {
      if (prev.some(p => p.label === label)) return prev;
      return [...prev, { label, type, id: asset.id }];
    });
    // Set allowed type if first asset
    if (!allowedAssetType) setAllowedAssetType(type || null);
    setF(v => ({ ...v, asset: '' }));
    setShowAssetPicker(false);
    setAssetSearch('');
    setAssetCategoryFilter('');
    setAssetSortBy('name');
    // Clear asset validation error when selected
    setErrors(prev => ({ ...prev, asset: '' }));
    setSubmitMessage(null);
  };

  const validateAndAdd = async () => {
    setSubmitMessage(null);
    const newErrors: any = { discipline: '', category: '', code: '', asset: '', frequency: '', timeHours: '', tasks: '' };
    let hasError = false;

  // Required fields validation
  if (!f.discipline) { newErrors.discipline = 'Required'; hasError = true; }
  // At least one of Revit Category or Ifc Class must be selected
  if (!f.revitCategory && !f.ifcClass) { newErrors.category = 'Select Revit Category or Ifc Class'; hasError = true; }
    if (!f.code || !f.code.trim()) { newErrors.code = 'Required'; hasError = true; }
  // legacy single-asset field removed; validate using selectedAssets
  // if any assets must be selected, ensure selectedAssets is non-empty
  if (selectedAssets.length === 0) { newErrors.asset = 'Required'; hasError = true; }

    // Validate frequency
    const freq = parseFloat(f.frequency as any);
    if (!f.frequency || isNaN(freq) || freq <= 0) { newErrors.frequency = 'Required (n/year, must be > 0)'; hasError = true; }

    // Validate timeHours
    const hours = parseFloat(f.timeHours as any);
    if (!f.timeHours || isNaN(hours) || hours <= 0) { newErrors.timeHours = 'Required (hours, must be > 0)'; hasError = true; }

  // Validate tasks
  if (tasks.length === 0) { newErrors.tasks = 'Please add at least one task.'; hasError = true; }
  // Validate assets
  if (selectedAssets.length === 0) { newErrors.asset = 'Please select at least one asset.'; hasError = true; }

    setErrors(newErrors);
    if (hasError) {
      setSubmitMessage({ type: 'error', text: 'Please fix the highlighted fields.' });
      return;
    }

    // Build new item
    const combinedCategory = [f.revitCategory, f.ifcClass].filter(Boolean).join(' | ');
    const newItem: ScheduledItem = {
      id: `sched-${Date.now()}`,
      discipline: f.discipline,
      category: combinedCategory,
      code: f.code,
      asset: selectedAssets.map(s => s.label),
      tasks: tasks,
      frequency: freq,
      timeHours: hours
    };

    // Prevent duplicate (all fields equal including tasks order)
    const arraysEqual = (a: string[], b: string[]) => {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) if (a[i].trim().toLowerCase() !== b[i].trim().toLowerCase()) return false;
      return true;
    };

    const duplicate = rows.some(r => {
      const assetsEqual = arraysEqual(r.asset || [], newItem.asset || []);
      return (
        (r.discipline || '') === (newItem.discipline || '') &&
        (r.category || '') === (newItem.category || '') &&
        (r.code || '').trim() === (newItem.code || '').trim() &&
        assetsEqual &&
        arraysEqual(r.tasks || [], newItem.tasks || []) &&
        Number(r.frequency) === Number(newItem.frequency) &&
        Number(r.timeHours) === Number(newItem.timeHours)
      );
    });

    if (duplicate) {
      setSubmitMessage({ type: 'error', text: 'This scheduled maintenance already exists.' });
      return;
    }

    // Save to API if projectId exists
    setLoading(true);
    try {
      if (projectId) {
        const res = await fetch(`/api/projects/${projectId}/scheduled-maintenance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newItem)
        });

        if (res.ok) {
          const result = await res.json();
          const saved = result?.item || newItem;
          setRows(prev => [saved, ...prev]);
        } else {
          // Fallback to local state if API fails
          setRows(prev => [newItem, ...prev]);
        }
      } else {
        // localStorage fallback for non-project mode
        setRows(prev => {
          const updated = [newItem, ...prev];
          save(K.scheduled(projectId), updated);
          return updated;
        });
      }
      setSubmitMessage({ type: 'success', text: 'Scheduled maintenance added.' });
    } catch (err) {
      console.error('Failed to save scheduled maintenance:', err);
      setRows(prev => [newItem, ...prev]);
      setSubmitMessage({ type: 'error', text: 'Failed to save — saved locally.' });
    } finally {
      setLoading(false);
    }

    // Store current values for inheritance (both in state and localStorage)
    const previousValues = {
      discipline: f.discipline,
      revitCategory: f.revitCategory,
      ifcClass: f.ifcClass
    };
    setPreviousFormValues(previousValues);
    save(`fm-scheduled-maintenance-previous-${projectId || 'global'}`, previousValues);

    // Reset form but inherit Discipline, Revit Category, and IFC Class
    setF({ 
      discipline: f.discipline, 
      revitCategory: f.revitCategory, 
      ifcClass: f.ifcClass, 
      code: '', 
      asset: '', 
      frequency: '', 
      timeHours: '' 
    });
    setTasks([]);
    setCurrentTask('');
    setSelectedAssets([]);
    setErrors({ discipline: '', category: '', code: '', asset: '', frequency: '', timeHours: '', tasks: '' });
  };

  return (
    <div className="p-3 space-y-3">
      <div className="text-white font-semibold text-sm">Scheduled Maintenance</div>
      <div className="grid grid-cols-2 gap-2">
        {/* Discipline Dropdown */}
        <div>
          <label className="text-[11px] text-gray-400 block mb-1">Discipline *</label>
          <select
            value={f.discipline}
            onChange={e => { setF(v => ({ ...v, discipline: e.target.value })); setErrors(prev => ({ ...prev, discipline: '' })); setSubmitMessage(null); }}
            className={`w-full bg-gray-800 border rounded px-2 py-1.5 text-white text-sm ${errors.discipline ? 'border-red-500' : 'border-gray-700'}`}
          >
            <option value="">Select Discipline</option>
            {['Architecture', 'Structure', 'Mechanical System', 'Electrical System', 'Plumbing System', 'Fire Protection', 'Elevator System', 'Safety', 'IT/Technology', 'Other'].map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          {errors.discipline && <div className="text-[10px] text-red-400 mt-1">{errors.discipline}</div>}
        </div>

        {/* Revit Category Dropdown */}
        <div>
          <label className="text-[11px] text-gray-400 block mb-1">Revit Category</label>
          <select
            value={f.revitCategory}
            onChange={e => { setF(v => ({ ...v, revitCategory: e.target.value })); setErrors(prev => ({ ...prev, category: '' })); setSubmitMessage(null); }}
            className={`w-full bg-gray-800 border rounded px-2 py-1.5 text-white text-sm ${errors.category ? 'border-red-500' : 'border-gray-700'}`}
          >
            <option value="">Select Revit Category</option>
            {REVIT_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          {errors.category && <div className="text-[10px] text-red-400 mt-1">{errors.category}</div>}
        </div>

        {/* IFC Class Dropdown */}
        <div>
          <label className="text-[11px] text-gray-400 block mb-1">Ifc Class</label>
          <select
            value={f.ifcClass}
            onChange={e => { setF(v => ({ ...v, ifcClass: e.target.value })); setErrors(prev => ({ ...prev, category: '' })); setSubmitMessage(null); }}
            className={`w-full bg-gray-800 border rounded px-2 py-1.5 text-white text-sm ${errors.category ? 'border-red-500' : 'border-gray-700'}`}
          >
            <option value="">Select Ifc Class</option>
            {IFCCLASSES_UNIQUE.map(ic => (
              <option key={ic} value={ic}>{ic}</option>
            ))}
          </select>
          {errors.category && <div className="text-[10px] text-red-400 mt-1">{errors.category}</div>}
        </div>

        {/* Code */}
        <div>
          <label className="text-[11px] text-gray-400 block mb-1">Code *</label>
          <input
            placeholder="Alphanumeric code"
            value={f.code}
            onChange={e => { setF(v => ({ ...v, code: e.target.value })); setErrors(prev => ({ ...prev, code: '' })); setSubmitMessage(null); }}
            className={`w-full bg-gray-800 border rounded px-2 py-1.5 text-white text-sm ${errors.code ? 'border-red-500' : 'border-gray-700'}`}
          />
          {errors.code && <div className="text-[10px] text-red-400 mt-1">{errors.code}</div>}
        </div>

        {/* Assets with Picker (multiple) */}
        <div>
          <label className="text-[11px] text-gray-400 block mb-1">Assets *</label>
          <div className={`w-full bg-gray-800 border rounded px-2 py-1.5 text-white text-sm ${errors.asset ? 'border-red-500' : 'border-gray-700'}`}>
            <div className="flex gap-2 overflow-x-auto py-1">
              {selectedAssets.length === 0 && <div className="text-gray-400">No assets selected</div>}
              {selectedAssets.map((a, idx) => (
                <div key={(a.id || a.label) + '-' + idx} className="flex items-center bg-gray-900/60 px-3 py-1 rounded whitespace-nowrap mr-2">
                  <span className="text-sm text-gray-200 mr-2 max-w-xs overflow-hidden text-ellipsis">{a.label}</span>
                  <button onClick={() => {
                    setSelectedAssets(prev => prev.filter(x => x.label !== a.label));
                    // If removing last, clear allowed type
                    setTimeout(() => {
                      setSelectedAssets(curr => {
                        if (curr.length === 0) setAllowedAssetType(null);
                        return curr;
                      });
                    }, 0);
                  }} className="text-red-400 hover:text-red-300 text-sm">×</button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              {projectId && (
                <button
                  type="button"
                  onClick={() => {
                    if (!assetsLoaded && !assetsLoading) setAssetsLoaded(false);
                    // Auto-apply category/IFC filters based on form selection
                    try {
                      if (f.revitCategory) setAssetCategoryFilter(f.revitCategory);
                      if (f.ifcClass) setAssetIfcClassFilter(f.ifcClass);
                    } catch {}
                    setShowAssetPicker(true);
                  }}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs whitespace-nowrap"
                >
                  Select from List
                </button>
              )}
              <div className="text-xs text-gray-400 self-center">You can add multiple assets. Click × to remove.</div>
            </div>
          </div>
          {errors.asset && <div className="text-[10px] text-red-400 mt-1">{errors.asset}</div>}
        </div>

        {/* Frequency (numeric) */}
        <div>
          <label className="text-[11px] text-gray-400 block mb-1">Frequency (n/year) *</label>
          <input
            type="number"
            min="0"
            step="0.1"
            placeholder="e.g., 12"
            value={f.frequency}
            onChange={e => { setF(v => ({ ...v, frequency: e.target.value })); setErrors(prev => ({ ...prev, frequency: '' })); setSubmitMessage(null); }}
            className={`w-full bg-gray-800 border rounded px-2 py-1.5 text-white text-sm ${errors.frequency ? 'border-red-500' : 'border-gray-700'}`}
          />
          {errors.frequency && <div className="text-[10px] text-red-400 mt-0.5">{errors.frequency}</div>}
        </div>

        {/* Time (hours, numeric) */}
        <div>
          <label className="text-[11px] text-gray-400 block mb-1">Time (hours) *</label>
          <input
            type="number"
            min="0"
            step="0.5"
            placeholder="e.g., 2"
            value={f.timeHours}
            onChange={e => { setF(v => ({ ...v, timeHours: e.target.value })); setErrors(prev => ({ ...prev, timeHours: '' })); setSubmitMessage(null); }}
            className={`w-full bg-gray-800 border rounded px-2 py-1.5 text-white text-sm ${errors.timeHours ? 'border-red-500' : 'border-gray-700'}`}
          />
          {errors.timeHours && <div className="text-[10px] text-red-400 mt-0.5">{errors.timeHours}</div>}
        </div>
      </div>

      {/* Multi-Task Input */}
      <div className="border-t border-gray-700 pt-3">
        <label className="text-[11px] text-gray-400 block mb-1">Tasks (multiple allowed) *</label>
        <div className="flex gap-2">
          <input
            placeholder="Enter task description"
            value={currentTask}
            onChange={e => setCurrentTask(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTask(); } }}
            className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm"
          />
          <button
            onClick={addTask}
            disabled={!currentTask.trim()}
            className={`px-3 py-1.5 rounded text-sm ${currentTask.trim() ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-gray-700 text-gray-400 cursor-not-allowed'}`}
          >
            Add Task
          </button>
        </div>
        {tasks.length > 0 && (
          <div className="mt-2 space-y-1">
            {tasks.map((task, idx) => (
              <div key={idx} className="flex items-center justify-between bg-gray-900/60 rounded px-2 py-1.5 text-sm text-gray-200">
                <span className="flex-1">{idx + 1}. {task}</span>
                <button
                  onClick={() => removeTask(idx)}
                  className="text-red-400 hover:text-red-300 ml-2 font-bold"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        {tasks.length === 0 && <div className="text-[10px] text-red-400 mt-1">{errors.tasks || 'No tasks added yet'}</div>}
      </div>

      {submitMessage && (
        <div className={`p-2 rounded ${submitMessage.type === 'error' ? 'bg-red-700/30 border border-red-600 text-red-200' : 'bg-green-700/20 border border-green-600 text-green-200'}`}>
          {submitMessage.text}
        </div>
      )}

      <div>
        <button
          className={`px-4 py-2 rounded text-white ${loading ? 'bg-gray-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
          onClick={validateAndAdd}
          disabled={loading}
        >
          {loading ? 'Adding...' : 'Add Scheduled Maintenance'}
        </button>
      </div>

      {/* Asset Picker Modal (replaced with the same Asset List UI + selection checkboxes) */}
      {showAssetPicker && (
        <AssetListSelectionModal
          projectId={projectId}
          viewer={viewer}
          initialCategory={f.revitCategory}
          initialIfcClass={f.ifcClass}
          multi={true}
          onClose={() => setShowAssetPicker(false)}
          onConfirm={(picked) => {
            console.log('[ScheduledMaintenance] onConfirm: picked assets count =', picked.length);
            picked.forEach((asset, idx) => {
              console.log(`[ScheduledMaintenance] Asset ${idx}:`, {
                id: asset.id,
                assetName: asset.assetName,
                assetCode: asset.assetCode,
                category: asset.category,
                type: asset.type,
                location: asset.location,
                source: asset.source
              });
            });
            
            const next = picked.map(asset => {
              // Display Asset Code in the Assets section (as per client requirement)
              // Priority: assetCode > type > assetName > category
              const displayName = asset.assetCode?.trim() 
                ? asset.assetCode 
                : asset.type?.trim() 
                ? asset.type 
                : asset.assetName?.trim()
                ? asset.assetName
                : asset.category || `Asset ${asset.id}`;
              
              console.log(`[ScheduledMaintenance] Mapping asset to displayName (Asset Code): "${displayName}"`, {
                assetCode: asset.assetCode,
                type: asset.type,
                assetName: asset.assetName,
                category: asset.category
              });
              
              return {
                label: displayName,
                type: asset.type || asset.category || '',
                id: asset.id,
                // Store full asset record for reference
                assetRecord: asset
              };
            });
            
            console.log('[ScheduledMaintenance] Mapped next items:', next.map(n => ({ label: n.label, id: n.id })));
            
            setSelectedAssets(prev => {
              const map = new Map<string, any>();
              [...prev, ...next].forEach(a => map.set((a.id || a.label)!, a));
              const result = Array.from(map.values());
              console.log('[ScheduledMaintenance] Updated selectedAssets count:', result.length);
              return result;
            });
            if (!allowedAssetType && next[0]?.type) setAllowedAssetType(next[0].type || null);
            setSubmitMessage(null);
            setErrors(prev => ({ ...prev, asset: '' }));
          }}
        />
      )}
    </div>
  );
};

const TicketForm: React.FC<{ projectId?: string; viewer?: any; }> = ({ projectId, viewer }) => {
  const [tickets, setTickets] = useState<TicketItem[]>(() => load(K.tickets(projectId), [] as TicketItem[]));
  const [workOrders, setWorkOrders] = useState<WorkOrderItem[]>(() => load(K.workOrders(projectId), [] as WorkOrderItem[]));
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [showQrModal, setShowQrModal] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const [waitingForSelection, setWaitingForSelection] = useState(false);
  const isStandalone = typeof window !== 'undefined' && window.opener;
  const [projectName, setProjectName] = useState<string>('');

  // Cache to localStorage but prefer backend data when available
  useEffect(() => save(K.tickets(projectId), tickets), [tickets, projectId]);
  useEffect(() => save(K.workOrders(projectId), workOrders), [workOrders, projectId]);

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
        attachments: form.attachments
      },
      status: 'Open',
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
            attachments: form.attachments,
            asset: form.item,
            status: 'Open',
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
        attachments: form.attachments,
        asset: form.item,
        status: 'Open',
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

      {/* Recent Tickets */}
      {tickets.length > 0 && (
        <div className="border-t border-gray-700 pt-3">
          <div className="text-xs text-gray-400 font-semibold mb-2">Recent Tickets</div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {tickets.slice(0, 5).map(t => (
              <div key={t.id} className="text-xs bg-gray-900/40 rounded px-2 py-1.5 flex justify-between items-center">
                <span className="text-gray-300">
                  <span className="font-mono text-blue-400">{t.ticketCode}</span> - {t.requester.name} {t.requester.surname}
                </span>
                <span className={`px-2 py-0.5 rounded text-xs ${t.status === 'Open' ? 'bg-yellow-900/40 text-yellow-300' :
                  t.status === 'Planned' ? 'bg-blue-900/40 text-blue-300' :
                    t.status === 'In Progress' ? 'bg-purple-900/40 text-purple-300' :
                      'bg-green-900/40 text-green-300'
                  }`}>{t.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const WorkOrders: React.FC<{ projectId?: string; }> = ({ projectId }) => {
  const [rows, setRows] = useState<WorkOrderItem[]>(() => load(K.workOrders(projectId), [] as WorkOrderItem[]));
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

  // Cache to localStorage but prefer backend data when available
  useEffect(() => save(K.workOrders(projectId), rows), [rows, projectId]);

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
      <div className="text-white font-semibold text-sm">Work Orders / Service Requests</div>
      <div className="text-xs text-gray-400">
        <span className="text-gray-500">Gray fields</span> are from tickets.
        <span className="text-blue-400 ml-2">Blue fields</span> are managed by Maintenance Team.
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          placeholder="Search..."
          value={filters.search}
          onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-white text-xs flex-1 min-w-[200px]"
        />
        <select
          value={filters.status}
          onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-white text-xs"
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
          className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-white text-xs"
        >
          <option value="all">All Disciplines</option>
          {uniqueDisciplines.map(d => (
            <option key={String(d)} value={String(d)}>{String(d)}</option>
          ))}
        </select>
        <select
          value={filters.technician}
          onChange={e => setFilters(f => ({ ...f, technician: e.target.value }))}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-white text-xs"
        >
          <option value="all">All Technicians</option>
          {uniqueTechnicians.map(t => (
            <option key={String(t)} value={String(t)}>{String(t)}</option>
          ))}
        </select>
        <select
          value={filters.priority}
          onChange={e => setFilters(f => ({ ...f, priority: e.target.value }))}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-white text-xs"
        >
          <option value="all">All Priorities</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
        <button
          onClick={() => setFilters({ status: 'all', discipline: 'all', technician: 'all', priority: 'all', search: '' })}
          className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded text-xs"
        >
          Clear Filters
        </button>
      </div>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap gap-2 items-center p-2 bg-blue-900/20 border border-blue-500/50 rounded">
          <span className="text-blue-300 text-sm">{selectedIds.size} selected</span>
          <button onClick={exportToCSV} className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-xs">Export CSV</button>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-gray-800/90 backdrop-blur border-b border-gray-700 text-gray-300">
            <tr>
              <th className="px-2 py-1.5 w-10">
                <input type="checkbox" checked={filteredAndSortedRows.length > 0 && selectedIds.size === filteredAndSortedRows.length} onChange={toggleSelectAll} />
              </th>
              <th className="text-left px-2 py-1.5 cursor-pointer hover:bg-gray-700/50" onClick={() => {
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
              <th className="text-left px-2 py-1.5 cursor-pointer hover:bg-gray-700/50" onClick={() => {
                if (sortBy === 'priority') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); else { setSortBy('priority'); setSortOrder('desc'); }
              }}>Priority {sortBy === 'priority' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}</th>
              <th className="text-left px-2 py-1.5">Technician</th>
              <th className="text-left px-2 py-1.5">Company</th>
              <th className="text-left px-2 py-1.5 cursor-pointer hover:bg-gray-700/50" onClick={() => {
                if (sortBy === 'status') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); else { setSortBy('status'); setSortOrder('asc'); }
              }}>Status {sortBy === 'status' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}</th>
              <th className="text-left px-2 py-1.5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedRows.length === 0 ? (
              <tr><td colSpan={16} className="px-3 py-4 text-center text-gray-400">No work orders yet. Create tickets to generate work orders.</td></tr>
            ) : filteredAndSortedRows.map(r => {
              const isEditing = editingId === r.id;
              return (
                <>
                  <tr key={r.id} className="border-b border-gray-800 hover:bg-gray-800/40" onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}>
                    <td className="px-2 py-1.5 w-10" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSelect(r.id)} />
                    </td>
                    {/* Gray-shaded: from ticket */}
                    <td className="px-2 py-1.5 text-gray-500">{r.requestId || '-'}</td>
                    <td className="px-2 py-1.5 text-gray-500">{r.requester || '-'}</td>
                    <td className="px-2 py-1.5 text-gray-500">{r.contact || '-'}</td>
                    <td className="px-2 py-1.5 text-gray-500">{r.location || '-'}</td>
                    <td className="px-2 py-1.5 text-gray-500">{r.discipline || '-'}</td>
                    <td className="px-2 py-1.5 text-gray-500">{stripRevitPrefix(r.category) || '-'}</td>
                    <td className="px-2 py-1.5 text-gray-500">{r.description || '-'}</td>
                    <td className="px-2 py-1.5 text-gray-500">
                      <div className="max-w-[220px] truncate" title={r.interventionDetails || ''}>{r.interventionDetails || '-'}</div>
                    </td>
                    <td className="px-2 py-1.5 text-gray-500" onClick={e => e.stopPropagation()}>
                      {r.attachments && r.attachments.length > 0 ? (
                        <button onClick={() => setShowAttachmentsModal(r)} className="text-blue-400 hover:text-blue-300">📎 {r.attachments.length}</button>
                      ) : '-'}
                    </td>
                    <td className="px-2 py-1.5 text-gray-500">{r.asset || '-'}</td>
                    <td className="px-2 py-1.5">
                      {isEditing ? (
                        <select
                          value={editForm.priority || r.priority || 'Medium'}
                          onChange={e => setEditForm(f => ({ ...f, priority: e.target.value as WorkOrderItem['priority'] }))}
                          className="w-full bg-gray-800 border border-blue-500 rounded px-1 py-0.5 text-blue-300 text-xs"
                        >
                          <option value="High">High</option>
                          <option value="Medium">Medium</option>
                          <option value="Low">Low</option>
                        </select>
                      ) : (
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${r.priority === 'High' ? 'bg-red-900/40 text-red-300' :
                          r.priority === 'Medium' ? 'bg-yellow-900/40 text-yellow-300' :
                            r.priority === 'Low' ? 'bg-green-900/40 text-green-300' :
                              'bg-gray-900/40 text-gray-400'
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
                          className="w-full bg-gray-800 border border-blue-500 rounded px-1 py-0.5 text-blue-300 text-xs"
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
                          className="w-full bg-gray-800 border border-blue-500 rounded px-1 py-0.5 text-blue-300 text-xs"
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
                          className="w-full bg-gray-800 border border-blue-500 rounded px-1 py-0.5 text-blue-300 text-xs"
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
                          <button onClick={saveEdit} className="bg-green-600 hover:bg-green-700 text-white px-2 py-0.5 rounded text-xs">Save</button>
                          <button onClick={() => { setEditingId(null); setEditForm({}) }} className="bg-gray-600 hover:bg-gray-700 text-white px-2 py-0.5 rounded text-xs">Cancel</button>
                        </div>
                      ) : (
                        <div className="flex gap-1">
                          <button onClick={() => startEdit(r)} className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-0.5 rounded text-xs">Edit</button>
                          <button onClick={() => setShowCommentsModal(r)} className="bg-gray-700 hover:bg-gray-600 text-white px-2 py-0.5 rounded text-xs">Comments</button>
                          <button onClick={() => setExpandedId(expandedId === r.id ? null : r.id)} className="bg-gray-700 hover:bg-gray-600 text-white px-2 py-0.5 rounded text-xs">{expandedId === r.id ? 'Hide' : 'Details'}</button>
                        </div>
                      )}
                    </td>
                  </tr>
                  {expandedId === r.id && (
                    <tr className="border-b border-gray-800 bg-gray-900/30">
                      <td colSpan={16} className="px-3 py-3">
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <div className="text-xs text-gray-400">Full Description</div>
                            <div className="text-gray-200">{r.description || '-'}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-400">Intervention Details</div>
                            <div className="text-gray-200">{r.interventionDetails || '-'}</div>
                          </div>
                          <div className="col-span-2">
                            <div className="text-xs text-gray-400 mb-1">Attachments</div>
                            <div className="flex flex-wrap gap-2">
                              {r.attachments && r.attachments.length > 0 ? (
                                r.attachments.map((a, idx) => (
                                  <span key={idx} className="bg-gray-800 px-2 py-1 rounded text-xs text-gray-200">📄 {a}</span>
                                ))
                              ) : (
                                <span className="text-gray-500 text-xs">No attachments</span>
                              )}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-400">Timestamps</div>
                            <div className="text-gray-400 text-xs space-y-0.5">
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-5xl resize overflow-auto" style={{ minWidth: '400px', minHeight: '300px', maxHeight: 'calc(100vh - 40px)', maxWidth: 'calc(100vw - 40px)' }}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-semibold text-lg">Attachments</h3>
              <button onClick={() => setShowAttachmentsModal(null)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <div className="space-y-2">
              {showAttachmentsModal.attachments && showAttachmentsModal.attachments.length > 0 ? (
                showAttachmentsModal.attachments.map((a, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-gray-900/60 rounded px-3 py-2">
                    <span className="text-gray-200 text-sm">📄 {a}</span>
                    <a href={a} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 text-xs">Open</a>
                  </div>
                ))
              ) : (
                <div className="text-gray-400 text-sm">No attachments</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Comments Modal */}
      {showCommentsModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-5xl resize overflow-auto" style={{ minWidth: '400px', minHeight: '400px', maxHeight: 'calc(100vh - 40px)', maxWidth: 'calc(100vw - 40px)' }}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-semibold text-lg">Comments & Notes</h3>
              <button onClick={() => setShowCommentsModal(null)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <div className="space-y-3 mb-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
              {showCommentsModal.comments && showCommentsModal.comments.length > 0 ? (
                showCommentsModal.comments.map(c => (
                  <div key={c.id} className="bg-gray-900/60 rounded p-3">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-blue-400 font-semibold text-sm">{c.author}</span>
                      <span className="text-gray-500 text-xs">{new Date(c.timestamp).toLocaleString()}</span>
                    </div>
                    <div className="text-gray-300 text-sm">{c.text}</div>
                  </div>
                ))
              ) : (
                <div className="text-gray-400 text-sm">No comments yet.</div>
              )}
            </div>
            <div className="flex gap-2">
              <textarea
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm"
                rows={3}
              />
              <button
                onClick={() => showCommentsModal && addComment(showCommentsModal.id)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm self-start"
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
      <div className="text-white font-semibold text-sm">Maintenance Reports</div>

      {/* Shrunk stat cards - smaller padding & font-sizes */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-gray-800/60 rounded p-2">
          <div className="text-xs text-gray-400">Scheduled Tasks</div>
          <div className="text-lg text-white font-bold">{totalScheduled}</div>
        </div>
        <div className="bg-gray-800/60 rounded p-2">
          <div className="text-xs text-gray-400">Total Work Orders</div>
          <div className="text-lg text-white font-bold">{totalWorkOrders}</div>
        </div>
        <div className="bg-yellow-900/30 rounded p-2">
          <div className="text-xs text-yellow-400">Open Orders</div>
          <div className="text-lg text-yellow-300 font-bold">{openOrders}</div>
        </div>
        <div className="bg-purple-900/30 rounded p-2">
          <div className="text-xs text-purple-400">In Progress</div>
          <div className="text-lg text-purple-300 font-bold">{inProgressOrders}</div>
        </div>
        <div className="col-span-2 bg-green-900/30 rounded p-2">
          <div className="text-xs text-green-400">Resolved Orders</div>
          <div className="text-lg text-green-300 font-bold">{resolvedOrders}</div>
        </div>
      </div>

      <div className="border-t border-gray-700 pt-3">
        <div className="text-xs text-gray-400">Reports generated at: {reportTime || '—'}</div>
      </div>

      <div className="mt-3">
        <div className="text-sm text-gray-200 mb-2">Work Orders</div>
        <div className="space-y-2">
          {workOrders.map(w => (
            <div key={w.id} className="bg-gray-800/40 rounded">
              <div className="flex items-center justify-between p-2">
                <div>
                  <div className="text-sm font-medium">{w.requestId || w.id} • {w.asset || w.location || '—'}</div>
                  <div className="text-xs text-gray-300">{w.description?.slice(0, 80) || 'No description'}</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-xs text-gray-300">{w.status}</div>
                  <button onClick={() => setOpenWO(openWO && openWO.id === w.id ? null : w)} className="px-2 py-1 bg-blue-600 rounded text-sm">{openWO && openWO.id === w.id ? 'Close' : 'Open'}</button>
                </div>
              </div>

              {/* Inline expanded report */}
              {openWO && openWO.id === w.id && (
                <div className="p-2 border-t border-gray-700">
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
      <div className="text-white font-semibold text-sm">Upcoming Maintenance Activities</div>

      <div className="space-y-2">
        <div className="text-xs text-gray-400 font-semibold">Scheduled Maintenance</div>
        {upcomingScheduled.length === 0 ? (
          <div className="text-gray-500 text-xs">No scheduled maintenance.</div>
        ) : (
          <ul className="space-y-1">
            {upcomingScheduled.map(s => (
              <li key={s.id} className="bg-blue-900/20 rounded px-2 py-1.5 text-xs text-gray-200">
                <span className="font-semibold text-blue-300">[{s.discipline}]</span> {s.asset} • {s.tasks.join(', ')}
                <div className="text-xs text-gray-400 mt-0.5">{s.frequency}/year • {s.timeHours}h</div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2 border-t border-gray-700 pt-3">
        <div className="text-xs text-gray-400 font-semibold">Planned Work Orders</div>
        {plannedOrders.length === 0 ? (
          <div className="text-gray-500 text-xs">No planned work orders.</div>
        ) : (
          <ul className="space-y-1">
            {plannedOrders.map(w => (
              <li key={w.id} className="bg-gray-800/60 rounded px-2 py-1.5 text-xs text-gray-200">
                <span className="font-semibold">{w.requestId}</span> • {w.description}
                <div className="text-xs text-gray-400 mt-0.5">Technician: {w.responsibleTechnician || 'Unassigned'}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

// Ongoing Maintenance
const OngoingMaintenance: React.FC<{ projectId?: string; }> = ({ projectId }) => {
  const [workOrders] = useState<WorkOrderItem[]>(() => load(K.workOrders(projectId), [] as WorkOrderItem[]));
  const ongoingOrders = workOrders.filter(w => w.status === 'In Progress');

  return (
    <div className="p-3 space-y-3">
      <div className="text-white font-semibold text-sm">Ongoing Maintenance</div>

      {ongoingOrders.length === 0 ? (
        <div className="text-gray-400 text-sm">No ongoing maintenance activities.</div>
      ) : (
        <ul className="space-y-2">
          {ongoingOrders.map(w => (
            <li key={w.id} className="bg-purple-900/20 rounded p-3">
              <div className="flex justify-between items-start mb-2">
                <span className="font-semibold text-purple-300">{w.requestId}</span>
                <span className="text-xs bg-purple-900/40 text-purple-300 px-2 py-0.5 rounded">{w.status}</span>
              </div>
              <div className="text-sm text-gray-200">{w.description}</div>
              <div className="text-xs text-gray-400 mt-2">
                <div>Location: {w.location}</div>
                <div>Technician: {w.responsibleTechnician || 'Unassigned'}</div>
                <div>Company: {w.company || 'N/A'}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// Planned Maintenance - Refactored with Table Structure
const PlannedMaintenance: React.FC<{ projectId?: string; viewer?: any; }> = ({ projectId, viewer }) => {
  const [scheduled, setScheduled] = useState<ScheduledItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<'asset' | 'tasks' | null>(null);
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const [editTaskInput, setEditTaskInput] = useState('');
  const [historyFor, setHistoryFor] = useState<ScheduledItem | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyOrders, setHistoryOrders] = useState<WorkOrderItem[]>([]);
  // Filters
  const [filters, setFilters] = useState<{ search: string; discipline: string; revitCategory: string; ifcClass: string; level: string; room: string }>(
    { search: '', discipline: 'all', revitCategory: 'all', ifcClass: 'all', level: 'all', room: 'all' }
  );
  // Cache of computed Level/Room for assets (viewer-assisted lookups)
  const [assetLocCache, setAssetLocCache] = useState<Record<string, { level?: string; room?: string }>>({});
  
  // Helper: find asset by label appearing in scheduled.asset list
  const findAssetByLabel = React.useCallback((label?: string): AssetRecord | undefined => {
    if (!label) return undefined;
    const key = String(label).trim().toLowerCase();
    // exact matches first
    let found = assets.find(a => (a.assetName || '').toLowerCase() === key || (a.assetCode || '').toLowerCase() === key);
    if (found) return found;
    // containment matches
    found = assets.find(a => (a.assetName || '').toLowerCase().includes(key) || (a.assetCode || '').toLowerCase().includes(key));
    return found;
  }, [assets]);

  // Expand rows: for items with multiple assets, create one row per asset
  const expandedRows = React.useMemo(() => {
    const out: Array<{ base: ScheduledItem; assetLabel: string; level: string; room: string; asset?: AssetRecord }>[] = [] as any;
    const rows: Array<{ base: ScheduledItem; assetLabel: string; level: string; room: string; asset?: AssetRecord } > = [];
    for (const s of scheduled) {
      const labels = Array.isArray(s.asset) ? s.asset : [s.asset].filter(Boolean) as string[];
      if (!labels.length) {
        rows.push({ base: s, assetLabel: '—', level: '—', room: '—', asset: undefined });
        continue;
      }
      for (const lab of labels) {
        const a = findAssetByLabel(lab);
        let level = '—';
        let room = '—';
        if (a?.location) {
          const parts = String(a.location).split(' - ').map(p => p.trim()).filter(Boolean);
          if (parts.length >= 1) level = parts[0];
          if (parts.length >= 2) room = parts[1];
        }
        // Use cached viewer-derived level/room when not available from location
        const cacheKey = a ? (a.id || `db-${a.dbId}`) : lab;
        if ((level === '—' || !level) && cacheKey && assetLocCache[cacheKey]?.level) level = assetLocCache[cacheKey].level as string;
        if ((room === '—' || !room) && cacheKey && assetLocCache[cacheKey]?.room) room = assetLocCache[cacheKey].room as string;
        rows.push({ base: s, assetLabel: lab, level, room, asset: a });
      }
    }
    return rows;
  }, [scheduled, findAssetByLabel, assetLocCache]);

  // Unique values for filter dropdowns
  const uniqueDisciplines = React.useMemo(() => Array.from(new Set(scheduled.map(s => s.discipline).filter(Boolean))) as string[], [scheduled]);
  // Use canonical Revit categories and IFC classes lists directly
  const uniqueRevitCategories = React.useMemo(() => REVIT_CATEGORIES, []);
  const uniqueIfcClasses = React.useMemo(() => IFCCLASSES_UNIQUE, []);
  const uniqueLevels = React.useMemo(() => Array.from(new Set(expandedRows.map(r => r.level).filter(v => v && v !== '—'))) as string[], [expandedRows]);
  const uniqueRooms = React.useMemo(() => Array.from(new Set(expandedRows.map(r => r.room).filter(v => v && v !== '—'))) as string[], [expandedRows]);

  // Apply filters
  const filteredRows = React.useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return expandedRows.filter(r => {
      if (filters.discipline !== 'all' && r.base.discipline !== filters.discipline) return false;
      // Revit Category filter: check asset.category first, fallback to scheduled.category
      if (filters.revitCategory !== 'all') {
        const cat = (r.asset?.category || r.base.category || '').toLowerCase();
        const sel = filters.revitCategory.toLowerCase();
        if (!(cat === sel || cat.includes(sel) || sel.includes(cat))) return false;
      }
      // IFC Class filter: match any candidate fields available on asset
      if (filters.ifcClass !== 'all') {
        const sel = filters.ifcClass.toLowerCase();
        const arr = (r.asset && (((r.asset as any).ifcCandidates as string[] | undefined) || [ (r.asset as any).ifcClass, (r.asset as any).ifcType, (r.asset as any).ifcPredefined ].filter(Boolean) as string[])) || [];
        const ok = arr.some(c => String(c || '').toLowerCase().includes(sel));
        if (!ok) return false;
      }
      if (filters.level !== 'all' && r.level !== filters.level) return false;
      if (filters.room !== 'all' && r.room !== filters.room) return false;
      if (search) {
        const blob = [r.assetLabel, r.base.code, r.base.category, r.base.discipline].join(' ').toLowerCase();
        if (!blob.includes(search)) return false;
      }
      return true;
    });
  }, [expandedRows, filters]);

  // Viewer selection for highlight
  const selectRowAssetInViewer = React.useCallback((row: { asset?: AssetRecord }) => {
    try {
      if (!viewer || !row.asset || row.asset.dbId == null) return;
      const allModels: any[] = typeof (viewer as any).getAllModels === 'function'
        ? ((viewer as any).getAllModels() || [])
        : [viewer.model].filter(Boolean);
      const target = (row.asset.modelId != null)
        ? (allModels.find(m => (typeof m.getModelId === 'function' ? m.getModelId() : m?.id) === row.asset!.modelId))
        : null;
      const m = target || viewer.model;
      if (!m) return;
      try {
        if (typeof (viewer as any).select === 'function') {
          (viewer as any).select([row.asset.dbId], m);
        }
        if (typeof (viewer as any).fitToView === 'function') {
          (viewer as any).fitToView([row.asset.dbId], m);
        }
      } catch {}
    } catch {}
  }, [viewer]);
  
  const [edit, setEdit] = useState<{ discipline: string; category: string; code: string; assetType: string; assetsText: string; tasksText: string; frequency: string; timeHours: string; level: string; room: string }>({
    discipline: '', category: '', code: '', assetType: '', assetsText: '', tasksText: '', frequency: '', timeHours: '', level: '', room: ''
  });

  const disciplineOptions = ['Architecture', 'Structure', 'Mechanical System', 'Electrical System', 'Plumbing System', 'Fire Protection', 'Elevator System', 'Safety', 'IT/Technology', 'Other'];
  const categoryOptions = React.useMemo(() => {
    return Object.entries(CATEGORY_MAPPING).map(([italian, mapping]) => `${italian} / ${mapping.english} (${mapping.ifc})`);
  }, []);

  // Load scheduled maintenance from database
  useEffect(() => {
    if (!projectId) {
      const loaded = load(K.scheduled(projectId), [] as ScheduledItem[]);
      setScheduled(loaded);
      return;
    }

    const fetchScheduledMaintenance = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/projects/${projectId}/scheduled-maintenance`);
        if (res.ok) {
          const data = await res.json();
          setScheduled(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error('Failed to load scheduled maintenance for planned view:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchScheduledMaintenance();
  }, [projectId]);

  // Load available assets
  useEffect(() => {
    if (!projectId) return;
    
    const fetchAssets = async () => {
      setAssetsLoading(true);
      try {
        const res = await fetch(`/api/projects/${projectId}/assets`);
        if (res.ok) {
          const data = await res.json();
          setAssets(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error('Failed to load assets:', err);
      } finally {
        setAssetsLoading(false);
      }
    };

    fetchAssets();
  }, [projectId]);

  // Viewer-assisted Level/Room enrichment for assets missing clear location
  useEffect(() => {
    let aborted = false;
    const run = async () => {
      try {
        if (!viewer || !assets || assets.length === 0) return;
        const allModels: any[] = typeof (viewer as any).getAllModels === 'function'
          ? ((viewer as any).getAllModels() || [])
          : [viewer.model].filter(Boolean);
        const modelById = (mid: number | undefined) => {
          if (mid == null) return viewer.model;
          return allModels.find(m => (typeof m.getModelId === 'function' ? m.getModelId() : m?.id) === mid) || viewer.model;
        };

        // Pick assets lacking level or room in location string
        const todo = assets.filter(a => {
          const loc = String(a.location || '') || '';
          const hasLevel = !!loc && loc.includes(' - ') ? true : !!loc; // if any location, assume maybe level
          const needLevel = !hasLevel;
          const needRoom = !loc.includes(' - ');
          const cacheKey = a.id || `db-${a.dbId}`;
          const cached = cacheKey && assetLocCache[cacheKey];
          return (needLevel || needRoom) && !cached && a.dbId != null;
        }).slice(0, 200); // Safety cap

        if (!todo.length) return;

        const next: Record<string, { level?: string; room?: string }> = {};
        for (const a of todo) {
          if (aborted) break;
          try {
            const m = modelById(a.modelId as number | undefined);
            if (!m || typeof m.getProperties !== 'function' || a.dbId == null) continue;
            const props: any = await new Promise(resolve => m.getProperties(a.dbId as number, resolve));
            const getProp = (names: string[]): string | undefined => {
              const lower = names.map(n => n.toLowerCase());
              const p = props?.properties?.find((p: any) => {
                const dn = p.displayName?.toLowerCase?.();
                return dn && (lower.includes(dn) || lower.some(n => dn.includes(n)));
              });
              return p?.displayValue?.toString();
            };

            let level = getProp(['Schedule Level','Livello abaco','Base Level','Reference Level','Livello','Level','Piano']);
            // Prefer descriptive level: if numeric only, try alternative occurrences
            if (!level || /^\d+(\.\d+)?$/.test(level)) {
              try {
                const levelProps = (props?.properties || []).filter((p: any) => (p.displayName || '').toString().toLowerCase() === 'level');
                const preferred = levelProps.find((p: any) => p.type === 20 || (p.displayCategory || '').toString().toLowerCase() === 'constraints')
                  || levelProps[levelProps.length - 1];
                if (preferred && preferred.displayValue != null) level = preferred.displayValue.toString();
              } catch {}
            }

            let room = getProp(['Room','Space','Locale','Stanza']);
            if ((!room || room.trim() === '') && (window as any).sensorContext?.findRoomForObject) {
              try {
                const roomData = (window as any).sensorContext.findRoomForObject(a.dbId);
                if (roomData?.name) room = roomData.name;
              } catch {}
            }

            const key = a.id || `db-${a.dbId}`;
            next[key] = { level, room };
            // Throttle slightly to keep UI smooth
            await new Promise(r => setTimeout(r, 5));
          } catch { }
        }

        if (!aborted && Object.keys(next).length) {
          setAssetLocCache(prev => ({ ...prev, ...next }));
        }
      } catch { }
    };
    run();
    return () => { aborted = true; };
  }, [viewer, assets, assetLocCache]);

  // Open and load maintenance history for an item (within PlannedMaintenance)
  const openHistory = async (item: ScheduledItem) => {
    try {
      setHistoryFor(item);
      setHistoryLoading(true);
      let orders: WorkOrderItem[] = [];
      if (projectId) {
        try {
          const res = await fetch(`/api/projects/${projectId}/work-orders`);
          if (res.ok) {
            const data = await res.json();
            orders = Array.isArray(data) ? data : [];
          }
        } catch (e) {
          console.error('Failed to load work orders for history', e);
        }
      }
      if (!orders.length) {
        orders = load(K.workOrders(projectId), [] as WorkOrderItem[]);
      }
      const assetNames = Array.isArray(item.asset) ? item.asset : [item.asset].filter(Boolean) as string[];
      const code = item.code || '';
      const lowerAssets = new Set(assetNames.map(a => String(a).toLowerCase()));
      const filtered = orders.filter(o => {
        const asset = (o.asset || '').toLowerCase();
        const desc = (o.description || '').toLowerCase();
        const loc = (o.location || '').toLowerCase();
        const matchAsset = asset && [...lowerAssets].some(a => asset.includes(a));
        const matchCode = code && (asset.includes(code.toLowerCase()) || desc.includes(code.toLowerCase()) || loc.includes(code.toLowerCase()));
        return matchAsset || matchCode;
      });
      const toDate = (s?: string) => (s ? new Date(s).getTime() : 0);
      filtered.sort((a, b) => (toDate(b.resolvedAt) || toDate(b.updatedAt) || toDate(b.createdAt)) - (toDate(a.resolvedAt) || toDate(a.updatedAt) || toDate(a.createdAt)));
      setHistoryOrders(filtered);
    } finally {
      setHistoryLoading(false);
    }
  };

  const beginEditAsset = (item: ScheduledItem) => {
    setEditingId(item.id);
    setEditMode('asset');
    setEdit({
      discipline: item.discipline || '',
      category: item.category || '',
      code: item.code || '',
      assetType: item.category || '',
      assetsText: Array.isArray(item.asset) ? item.asset.join('\n') : (item.asset || ''),
      tasksText: Array.isArray(item.tasks) ? item.tasks.join('\n') : '',
      frequency: String(item.frequency ?? ''),
      timeHours: String(item.timeHours ?? ''),
      level: '',
      room: ''
    });
  };

  const beginEditTasks = (item: ScheduledItem) => {
    setEditingId(item.id);
    setEditMode('tasks');
    setEdit({
      discipline: item.discipline || '',
      category: item.category || '',
      code: item.code || '',
      assetType: item.category || '',
      assetsText: Array.isArray(item.asset) ? item.asset.join('\n') : (item.asset || ''),
      tasksText: Array.isArray(item.tasks) ? item.tasks.join('\n') : '',
      frequency: String(item.frequency ?? ''),
      timeHours: String(item.timeHours ?? ''),
      level: '',
      room: ''
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditMode(null);
    setEdit({ discipline: '', category: '', code: '', assetType: '', assetsText: '', tasksText: '', frequency: '', timeHours: '', level: '', room: '' });
  };

  const saveEdit = async (id: string) => {
    const updated: ScheduledItem = {
      id,
      discipline: edit.discipline.trim(),
      category: edit.category.trim(),
      code: edit.code.trim(),
      asset: edit.assetsText.split('\n').map(s => s.trim()).filter(Boolean),
      tasks: edit.tasksText.split('\n').map(s => s.trim()).filter(Boolean),
      frequency: Number(edit.frequency) || 0,
      timeHours: Number(edit.timeHours) || 0,
    };

    try {
      if (projectId) {
        const res = await fetch(`/api/projects/${projectId}/scheduled-maintenance?id=${encodeURIComponent(id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updated)
        });
        if (res.ok) {
          const data = await res.json();
          const saved = (data?.item as any) || updated;
          setScheduled(prev => prev.map(it => it.id === id ? saved : it));
        } else {
          setScheduled(prev => prev.map(it => it.id === id ? updated : it));
        }
      } else {
        setScheduled(prev => {
          const next = prev.map(it => it.id === id ? updated : it);
          save(K.scheduled(projectId), next);
          return next;
        });
      }
    } catch (err) {
      console.error('Failed to update planned maintenance item:', err);
    } finally {
      cancelEdit();
    }
  };

  return (
    <div className="p-3 space-y-3 h-full flex flex-col overflow-hidden">
      <div className="text-white font-semibold text-sm">Planned Maintenance</div>
      {/* Subtitle intentionally omitted to avoid hydration flicker differences */}

      {loading ? (
        <div className="text-center text-gray-400 text-sm py-4">Loading planned maintenance...</div>
      ) : scheduled.length === 0 ? (
        <div className="text-gray-400 text-sm bg-gray-800/30 rounded-lg p-4 text-center">
          No planned maintenance tasks.
        </div>
      ) : (
        <div className="flex-1 overflow-auto pr-2">
          {/* Table Header */}
          <div className="sticky top-0 bg-gray-900/90 border border-gray-700 rounded-t-lg mb-0 backdrop-blur supports-[backdrop-filter]:backdrop-blur">
            <div className="grid grid-cols-12 gap-2 px-3 py-2.5 text-xs font-semibold text-gray-300 border-b border-gray-700">
              <div className="col-span-1 whitespace-nowrap">Actions</div>
              <div className="col-span-2 whitespace-nowrap">Discipline</div>
              <div className="col-span-2 whitespace-nowrap">Category</div>
              <div className="col-span-1 whitespace-nowrap">Asset Type</div>
              <div className="col-span-1 whitespace-nowrap">Code</div>
              <div className="col-span-1 whitespace-nowrap">Asset</div>
              <div className="col-span-1 whitespace-nowrap">Level</div>
              <div className="col-span-1 whitespace-nowrap">Room</div>
              <div className="col-span-1 whitespace-nowrap">Frequency</div>
              <div className="col-span-1 whitespace-nowrap">Time</div>
            </div>
            {/* Filters Row - column aligned */}
            <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-gray-900/60 border-b border-gray-700 text-xs">
              <div className="col-span-1"></div>
              <div className="col-span-2">
                <select value={filters.discipline} onChange={e => setFilters(prev => ({ ...prev, discipline: e.target.value }))} className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white">
                  <option value="all">All</option>
                  {uniqueDisciplines.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              {/* Category cell now holds Revit Category + IFC Class side-by-side */}
              <div className="col-span-2 flex gap-2">
                <select value={filters.revitCategory} onChange={e => setFilters(prev => ({ ...prev, revitCategory: e.target.value }))} className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white">
                  <option value="all">All</option>
                  {uniqueRevitCategories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={filters.ifcClass} onChange={e => setFilters(prev => ({ ...prev, ifcClass: e.target.value }))} className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white">
                  <option value="all">All</option>
                  {uniqueIfcClasses.map(ic => <option key={ic} value={ic}>{ic}</option>)}
                </select>
              </div>
              <div className="col-span-1"></div>
              <div className="col-span-1"></div>
              <div className="col-span-1">
                <input value={filters.search} onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))} placeholder="Search asset/code..." className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white placeholder-gray-400" />
              </div>
              <div className="col-span-1">
                <select value={filters.level} onChange={e => setFilters(prev => ({ ...prev, level: e.target.value }))} className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white">
                  <option value="all">All</option>
                  {uniqueLevels.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div className="col-span-1">
                <select value={filters.room} onChange={e => setFilters(prev => ({ ...prev, room: e.target.value }))} className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white">
                  <option value="all">All</option>
                  {uniqueRooms.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="col-span-1"></div>
              <div className="col-span-1"></div>
            </div>
          </div>

          {/* Table Rows */}
          <div className="space-y-0 border border-gray-700 border-t-0 rounded-b-lg overflow-hidden bg-gray-800/20">
            {filteredRows.map((row, idx) => (
              <div
                key={`${row.base.id}-${row.assetLabel}-${idx}`}
                className={`grid grid-cols-12 gap-2 px-3 py-2.5 items-center border-b border-gray-700/50 hover:bg-gray-700/20 transition-colors ${
                  idx === filteredRows.length - 1 ? 'border-b-0' : ''
                }`}
              >
                {/* Action Buttons */}
                <div className="col-span-1 flex gap-1 justify-start">
                  <button
                    onClick={() => beginEditAsset(row.base)}
                    className="p-1.5 rounded bg-blue-600/80 hover:bg-blue-500 text-white transition-colors"
                    title="Edit asset information"
                  >
                    <Wrench size={14} />
                  </button>
                  <button
                    onClick={() => beginEditTasks(row.base)}
                    className="p-1.5 rounded bg-green-600/80 hover:bg-green-500 text-white transition-colors"
                    title="Edit maintenance tasks"
                  >
                    <ClipboardList size={14} />
                  </button>
                  <button
                    onClick={() => openHistory(row.base)}
                    className="p-1.5 rounded bg-purple-600/80 hover:bg-purple-500 text-white transition-colors"
                    title="View maintenance history"
                  >
                    <CalendarClock size={14} />
                  </button>
                </div>

                {/* Discipline */}
                <div className="col-span-2 text-xs text-gray-200 truncate">
                  {row.base.discipline || '—'}
                </div>

                {/* Category */}
                <div className="col-span-2 text-xs text-gray-300 truncate">
                  {row.base.category || '—'}
                </div>

                {/* Asset Type */}
                <div className="col-span-1 text-xs text-gray-300 truncate">
                  {row.base.category?.split('/')[0].trim() || '—'}
                </div>

                {/* Code */}
                <div className="col-span-1 text-xs text-blue-300 font-mono truncate">
                  {row.base.code || '—'}
                </div>

                {/* Asset */}
                <div className="col-span-1 text-xs text-gray-300 truncate cursor-pointer hover:text-white" onClick={() => selectRowAssetInViewer(row)} title="Click to highlight in model">
                  {row.assetLabel || '—'}
                </div>

                {/* Level */}
                <div className="col-span-1 text-xs text-gray-400">
                  {row.level || '—'}
                </div>

                {/* Room */}
                <div className="col-span-1 text-xs text-gray-400">
                  {row.room || '—'}
                </div>

                {/* Frequency */}
                <div className="col-span-1 text-xs text-emerald-300 whitespace-nowrap">
                  {row.base.frequency}/yr
                </div>

                {/* Time */}
                <div className="col-span-1 text-xs text-emerald-300 whitespace-nowrap">
                  {row.base.timeHours}h
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingId && editMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-[900px] max-w-full bg-gray-900 border border-gray-700 rounded-lg shadow-2xl max-h-[90vh] overflow-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-gray-900 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
              <div className="text-lg font-semibold text-white">
                {editMode === 'asset' ? '✎ Edit Asset Information' : editMode === 'tasks' ? '📋 Edit Maintenance Tasks' : 'Edit'}
              </div>
              <button
                onClick={cancelEdit}
                className="p-1.5 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="px-6 py-4 space-y-4">
              {editMode === 'asset' ? (
                <>
                  {/* Asset Edit Form */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-300 block mb-2 font-medium">Discipline</label>
                      <select
                        value={edit.discipline}
                        onChange={e => setEdit(v => ({ ...v, discipline: e.target.value }))}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm hover:border-gray-600 focus:border-blue-500 focus:outline-none"
                      >
                        <option value="">Select Discipline</option>
                        {disciplineOptions.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm text-gray-300 block mb-2 font-medium">Category</label>
                      <select
                        value={edit.category}
                        onChange={e => setEdit(v => ({ ...v, category: e.target.value }))}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm hover:border-gray-600 focus:border-blue-500 focus:outline-none"
                      >
                        <option value="">Select Category</option>
                        {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm text-gray-300 block mb-2 font-medium">Code</label>
                      <input
                        type="text"
                        value={edit.code}
                        onChange={e => setEdit(v => ({ ...v, code: e.target.value }))}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm hover:border-gray-600 focus:border-blue-500 focus:outline-none"
                        placeholder="Enter asset code"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-300 block mb-2 font-medium">Asset Type</label>
                      <input
                        type="text"
                        value={edit.assetType}
                        onChange={e => setEdit(v => ({ ...v, assetType: e.target.value }))}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm hover:border-gray-600 focus:border-blue-500 focus:outline-none"
                        placeholder="Asset type"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm text-gray-300 block mb-2 font-medium">Assets</label>
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2 mb-3">
                        {(edit.assetsText.split('\n').map(s => s.trim()).filter(Boolean)).map((a, idx) => (
                          <div key={a + '-' + idx} className="inline-flex items-center bg-gray-800 text-gray-200 px-3 py-1 rounded text-sm border border-gray-700">
                            <span className="mr-2">{a}</span>
                            <button onClick={() => setEdit(v => ({ ...v, assetsText: v.assetsText.split('\n').map(s => s.trim()).filter(Boolean).filter((_, i) => i !== idx).join('\n') }))} className="text-red-400 hover:text-red-300 font-bold">×</button>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setShowAssetPicker(true)} className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm">Select from asset list</button>
                        <button onClick={() => setEdit(v => ({ ...v, assetsText: '' }))} className="px-3 py-2 rounded border border-gray-600 text-sm text-gray-200 hover:bg-gray-800">Clear</button>
                      </div>
                      <div>
                        <textarea
                          value={edit.assetsText}
                          onChange={e => setEdit(v => ({ ...v, assetsText: e.target.value }))}
                          className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm hover:border-gray-600 focus:border-blue-500 focus:outline-none"
                          placeholder="Enter assets (one per line)"
                          rows={3}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-300 block mb-2 font-medium">Frequency (per year)</label>
                      <input
                        type="number"
                        value={edit.frequency}
                        onChange={e => setEdit(v => ({ ...v, frequency: e.target.value }))}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm hover:border-gray-600 focus:border-blue-500 focus:outline-none"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-300 block mb-2 font-medium">Time per Intervention (hours)</label>
                      <input
                        type="number"
                        value={edit.timeHours}
                        onChange={e => setEdit(v => ({ ...v, timeHours: e.target.value }))}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm hover:border-gray-600 focus:border-blue-500 focus:outline-none"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Tasks Edit Form */}
                  <div>
                    <label className="text-sm text-gray-300 block mb-2 font-medium">Asset Code: {edit.code}</label>
                  </div>

                  <div>
                    <label className="text-sm text-gray-300 block mb-2 font-medium">Maintenance Tasks</label>
                    <div className="space-y-2">
                      <ul className="space-y-2 mb-3">
                        {(edit.tasksText.split('\n').map(s => s.trim()).filter(Boolean)).map((t, idx) => (
                          <li key={t + '-' + idx} className="flex items-center justify-between bg-gray-800 px-3 py-2 rounded text-sm text-gray-200 border border-gray-700">
                            <span className="flex-1">{t}</span>
                            <button onClick={() => setEdit(v => ({ ...v, tasksText: v.tasksText.split('\n').map(s => s.trim()).filter(Boolean).filter((_, i) => i !== idx).join('\n') }))} className="text-red-400 hover:text-red-300 ml-2 font-bold">Remove</button>
                          </li>
                        ))}
                      </ul>
                      <div className="flex gap-2">
                        <input
                          value={editTaskInput}
                          onChange={e => setEditTaskInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const t = editTaskInput.trim();
                              if (t) {
                                setEdit(v => ({ ...v, tasksText: (v.tasksText ? v.tasksText + '\n' : '') + t }));
                                setEditTaskInput('');
                              }
                            }
                          }}
                          placeholder="New task"
                          className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
                        />
                        <button
                          onClick={() => {
                            const t = editTaskInput.trim();
                            if (t) {
                              setEdit(v => ({ ...v, tasksText: (v.tasksText ? v.tasksText + '\n' : '') + t }));
                              setEditTaskInput('');
                            }
                          }}
                          className="px-3 py-2 rounded bg-green-600 hover:bg-green-700 text-white text-sm"
                        >
                          Add Task
                        </button>
                        <button onClick={() => setEdit(v => ({ ...v, tasksText: '' }))} className="px-3 py-2 rounded border border-gray-600 text-sm text-gray-200 hover:bg-gray-800">Clear</button>
                      </div>
                      <div>
                        <textarea
                          value={edit.tasksText}
                          onChange={e => setEdit(v => ({ ...v, tasksText: e.target.value }))}
                          className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm hover:border-gray-600 focus:border-blue-500 focus:outline-none"
                          placeholder="Enter tasks (one per line)"
                          rows={4}
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-gray-900 border-t border-gray-700 px-6 py-4 flex gap-2 justify-end">
              <button
                onClick={cancelEdit}
                className="px-4 py-2 text-sm rounded border border-gray-600 text-gray-200 hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => saveEdit(editingId!)}
                className="px-4 py-2 text-sm rounded bg-blue-600 hover:bg-blue-700 text-white transition-colors font-medium"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Asset Picker Modal */}
      {showAssetPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="w-[800px] max-w-full bg-gray-900 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-white font-semibold">Select assets (category: {edit.category || 'All'})</div>
              <button onClick={() => setShowAssetPicker(false)} className="px-2 py-1 rounded border border-gray-600 text-gray-200">Close</button>
            </div>
            <div className="h-[420px] overflow-auto">
              {assetsLoading ? (
                <div className="text-gray-400">Loading...</div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {(() => {
                    // Build token map like scheduled maintenance picker
                    const masterMap = new Map<string, string[]>();
                    for (const [italian, mapping] of Object.entries(CATEGORY_MAPPING)) {
                      const label = `${italian} / ${mapping.english} (${mapping.ifc})`;
                      masterMap.set(label, [italian, mapping.english, mapping.ifc].filter(Boolean) as string[]);
                    }
                    const tokens = masterMap.get(edit.category) || [];
                    const filtered = tokens.length
                      ? assets.filter(a => a.category && tokens.some(t => String(a.category).toLowerCase().includes(String(t).toLowerCase())))
                      : assets;
                    return filtered.map(a => {
                      const display = a.assetName || a.assetCode || a.id;
                      const already = edit.assetsText.split('\n').map(s => s.trim()).filter(Boolean).includes(display);
                      const canAdd = tokens.length === 0 || (a.category && tokens.some(t => String(a.category).toLowerCase().includes(String(t).toLowerCase())));
                      // Try to infer canonical label for this asset's category
                      let bestLabel: string | null = null;
                      for (const [label, toks] of masterMap.entries()) {
                        if (a.category && toks.some(t => String(a.category).toLowerCase().includes(String(t).toLowerCase()))) {
                          bestLabel = label;
                          break;
                        }
                      }
                      return (
                        <div key={a.id} className="flex items-center justify-between bg-gray-800/50 p-2 rounded border border-gray-700">
                          <div>
                            <div className="text-sm text-gray-200">{display}</div>
                            <div className="text-xs text-gray-400">{a.category} • {a.location || '—'}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              disabled={already || !canAdd}
                              onClick={() => {
                                const list = edit.assetsText.split('\n').map(s => s.trim()).filter(Boolean);
                                if (!list.includes(display)) {
                                  const next = [...list, display];
                                  setEdit(v => ({ ...v, assetsText: next.join('\n'), category: v.category || (bestLabel || '') }));
                                }
                              }}
                              className={`px-2 py-1 rounded text-white ${already ? 'bg-gray-600 cursor-not-allowed' : canAdd ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-700 cursor-not-allowed'}`}
                              title={already ? 'Already added' : canAdd ? 'Add asset' : 'Category mismatch'}
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {historyFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-[900px] max-w-full bg-gray-900 border border-gray-700 rounded-lg shadow-2xl max-h-[90vh] overflow-auto">
            <div className="sticky top-0 bg-gray-900 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
              <div className="text-lg font-semibold text-white">Maintenance History — {historyFor.code || historyFor.category}</div>
              <button onClick={() => { setHistoryFor(null); setHistoryOrders([]); }} className="p-1.5 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="px-6 py-4">
              {historyLoading ? (
                <div className="text-gray-400">Loading history…</div>
              ) : historyOrders.length === 0 ? (
                <div className="text-gray-400">No history found for selected asset(s).</div>
              ) : (
                <div className="space-y-2">
                  {historyOrders.map(h => (
                    <div key={h.id} className="bg-gray-800/50 rounded border border-gray-700 p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-200 font-medium">{h.requestId || h.id} • {h.asset || h.location || '—'}</div>
                        <div className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-200">{h.status}</div>
                      </div>
                      <div className="text-xs text-gray-300 mt-1">{h.description || '—'}</div>
                      <div className="text-xs text-gray-500 mt-1">Resolved: {h.resolvedAt || '—'}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
