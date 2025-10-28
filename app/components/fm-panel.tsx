
"use client";

import React, { useEffect, useState, useRef } from "react";
import MaintenanceReport from "./fm-maintenance-report";
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

// Fields users are allowed to edit and that must always win during backend merges
const EDITABLE_FIELDS: (keyof AssetRecord)[] = [
  'assetCode','assetName','category','type','brand','model','serialNumber','installationDate',
  'material','dimensions','weight','capacity','powerRating','location','description',
  'condition','serviceDate','expectedLife','maintenanceSchedule','lastService','nextService',
  'purchaseCost','maintenanceCost','manuals','warranties','certifications','regulations','safetyNotes'
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

function load<T>(key: string, def: T): T { if (typeof window === 'undefined') return def; try { const v = localStorage.getItem(key); return v ? JSON.parse(v) as T : def; } catch { return def; } }
function save<T>(key: string, val: T) { if (typeof window === 'undefined') return; try { localStorage.setItem(key, JSON.stringify(val)); } catch { } }

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
      if (remoteBaseZRef.current == null) {
        const hit = viewer.impl.hitTest(ev.clientX, ev.clientY, true);
        if (hit?.point?.z != null) remoteBaseZRef.current = hit.point.z; else {
          try { remoteBaseZRef.current = viewer.model?.getBoundingBox?.().min?.z ?? 0; } catch { remoteBaseZRef.current = 0; }
        }
      }
      const z = remoteBaseZRef.current ?? 0;
      const p = remoteWorldOnZ(ev.clientX, ev.clientY, z);
      if (!p) return;
      if (remotePointsRef.current.length >= 3 && remoteIsNearFirst(p)) {
        // auto finish
        try { childWinRef.current?.postMessage?.({ type: 'FM_DRAW_DONE', points: remotePointsRef.current }, '*'); } catch { }
        remoteDetach();
        return;
      }
      const point = { x: p.x, y: p.y, z };
      remotePointsRef.current.push(point);
      childWinRef.current?.postMessage?.({ type: 'FM_DRAW_POINT', point }, '*');
      remoteDrawPreview();
    } catch { }
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
  const remoteAttach = () => {
    try {
      if (!viewer || remoteActiveRef.current) return;
      remotePointsRef.current = [];
      remoteBaseZRef.current = null;
      remoteHoverRef.current = null;
      remoteActiveRef.current = true;
      viewer.container?.addEventListener('click', remoteOnViewerClick as any, true);
      viewer.container?.addEventListener('mousemove', remoteOnViewerMove as any, true);
      viewer.container?.addEventListener('dblclick', remoteOnViewerDblClick as any, true);
      try { viewer.container && ((viewer.container as HTMLElement).style.cursor = 'crosshair'); } catch { }
      if (!viewer.impl.overlayScenes?.[remoteOverlay]) viewer.impl.createOverlayScene(remoteOverlay);
    } catch { }
  };
  const remoteDetach = () => {
    try {
      if (!viewer) return;
      viewer.container?.removeEventListener('click', remoteOnViewerClick as any, true);
      viewer.container?.removeEventListener('mousemove', remoteOnViewerMove as any, true);
      viewer.container?.removeEventListener('dblclick', remoteOnViewerDblClick as any, true);
      try { viewer.container && ((viewer.container as HTMLElement).style.cursor = 'default'); } catch { }
      remoteActiveRef.current = false;
      remoteHoverRef.current = null;
      remoteClearOverlay();
    } catch { }
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

  // Bridge messages from child standalone window (only in main window)
  useEffect(() => {
    if (isStandalone) return; // child handles its own UI
    const onMsg = (e: MessageEvent) => {
      const d: any = e.data;
      if (!d || typeof d !== 'object') return;
      if (d.type === 'FM_DRAW_START') {
        if (!viewer) {
          try { (e.source as Window | null)?.postMessage?.({ type: 'FM_DRAW_CANCELLED', reason: 'NO_VIEWER' }, '*'); } catch { }
          return;
        }
        // Remember sender as our child window for point streaming
        try { childWinRef.current = (e.source as Window) || null; } catch { }
        remoteAttach();
      } else if (d.type === 'FM_DRAW_UNDO') {
        // Remove last point and update preview
        remotePointsRef.current.pop();
        remoteDrawPreview();
      } else if (d.type === 'FM_DRAW_FINISH') {
        if (!viewer) return;
        const pts = remotePointsRef.current;
        if (pts.length >= 3) {
          try { (e.source as Window | null)?.postMessage?.({ type: 'FM_DRAW_DONE', points: pts }, '*'); } catch { }
        } else {
          try { (e.source as Window | null)?.postMessage?.({ type: 'FM_DRAW_CANCELLED', reason: 'NOT_ENOUGH_POINTS' }, '*'); } catch { }
        }
        remoteDetach();
      } else if (d.type === 'FM_DRAW_CANCEL') {
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

    if (section.group === 'assets' && section.item === 'asset-list') return <AssetList projectId={projectId} viewer={viewer} />;
    if (section.group === 'assets' && section.item === 'create-asset') return <CreateAsset projectId={projectId} viewer={viewer} />;
    if (section.group === 'spaces' && section.item === 'space-list') return <SpaceList projectId={projectId} viewer={viewer} />;
    if (section.group === 'spaces' && section.item === 'create-space') return <CreateSpace projectId={projectId} viewer={viewer} standalone={isStandalone} />;
  if (section.group === 'maintenance' && section.item === 'scheduled') return <ScheduledMaintenance projectId={projectId} viewer={viewer} />;
    if (section.group === 'maintenance' && section.item === 'ticket') return <TicketForm projectId={projectId} viewer={viewer} />;
    if (section.group === 'work-orders' && section.item === 'service-requests') return <ServiceRequests projectId={projectId} />;
    if (section.group === 'work-orders' && section.item === 'reports') return <MaintenanceReports projectId={projectId} />;
    if (section.group === 'upcoming-activities' && section.item === 'ongoing') return <OngoingMaintenance projectId={projectId} />;
    if (section.group === 'upcoming-activities' && section.item === 'planned') return <PlannedMaintenance projectId={projectId} />;

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
                      const s = encodeURIComponent(JSON.stringify(section));
                      const url = `${window.location.origin}/fm-standalone?section=${s}${projectId ? `&projectId=${projectId}` : ''}`;
                      const w = window.open(url, `_blank`, `width=${Math.min(window.innerWidth-100, 1200)},height=${Math.min(window.innerHeight-100, 800)}`);
                      if (w) {
                        childWinRef.current = w;
                      }
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
            {/* Body */}
            {!showModalMinimized ? (
              // Allow the modal body to scroll and not trap all scrolling events
              <div className="p-4 flex-1 flex flex-col min-h-0 overflow-auto">
                {renderSectionContent()}
              </div>
            ) : (
              <div className="p-4 flex items-center justify-center text-sm text-gray-400">Minimized — model visible. Click Restore to open panel.</div>
            )}
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

const AssetList: React.FC<{ projectId?: string; viewer?: any; }> = ({ projectId, viewer }) => {
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
  const [filter, setFilter] = useState({ category: '', type: '', location: '', condition: '', classification: '', ifcClass: '' });
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
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

  const pickEditable = (r: Partial<AssetRecord>): Partial<AssetRecord> => {
    const out: Partial<AssetRecord> = {};
    for (const k of EDITABLE_FIELDS) {
      const v = (r as any)[k];
      if (v !== undefined) (out as any)[k] = v as any;
    }
    return out;
  };

  const openEditAsset = (row: AssetRecord) => {
    setEditModal({ open: true, id: row.id });
    setEdit({ ...pickEditable(row) });
    setEditSection('basic');
  };

  const persistEditToBackend = async (id: string, fields: Partial<AssetRecord>) => {
    if (!projectId) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updateFields', id, fields })
      });
      if (!res.ok) {
        // Try a generic PUT fallback
        await fetch(`/api/projects/${projectId}/assets?id=${encodeURIComponent(id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fields)
        }).catch(() => {});
      }
    } catch {}
  };

  const saveEditAsset = async () => {
    const id = editModal.id;
    if (!id) { setEditModal({ open: false }); return; }
    try {
      const fields = pickEditable(edit);
      setRows(prev => prev.map(r => r.id === id ? { ...r, ...fields, userEdited: true } : r));
      showToast('success', 'Asset updated');
      // Persist to local immediately (handled by rows effect) and try backend
      await persistEditToBackend(id, fields);
    } catch (e) {
      showToast('error', 'Failed to update asset');
    } finally {
      setEditModal({ open: false });
    }
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

    try {
      // Optimistically remove from UI
      setRows(prev => prev.filter(a => a.id !== id));
      save(K.assets(projectId), rows.filter(a => a.id !== id));

      // Delete from backend if we have a valid ObjectId and projectId
      if (projectId && isHexObjectId(id)) {
        const res = await fetch(`/api/projects/${projectId}/assets?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (!res.ok) {
          const txt = await res.text().catch(() => '');
          console.warn('⚠️ [AssetList] Backend delete failed:', res.status, txt);
          showToast('error', 'Failed to delete from server — removed locally');
        } else {
          showToast('success', 'Asset deleted');
        }
      } else {
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
  }, []);

  const getCurrentModelGuid = React.useCallback((): string | undefined => {
    try {
      const g = viewer?.model?.getData?.()?.guid;
      if (g && typeof g === 'string') return g;
      const mid = viewer?.model?.id;
      return (mid != null) ? String(mid) : undefined;
    } catch { return undefined; }
  }, [viewer]);

  const filterAssetsForCurrentModel = React.useCallback((arr: AssetRecord[]): AssetRecord[] => {
    const g = getCurrentModelGuid();
    if (!g) return arr; // if no model, do not filter
    // Strict: include manual always; BIM only for current modelGuid
    return arr.filter(a => a.source !== 'BIM_MODEL' || a.modelGuid === g);
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
        const res = await fetch(`/api/projects/${projectId}/assets?modelGuid=${encodeURIComponent(currentGuid)}`);
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : [];
          console.log(`✅ [AssetList] Loaded ${list.length} assets from backend`);

          // Merge backend list with cached assets in localStorage so we don't lose richer local fields
          // Filter cached to current model before merging to avoid legacy inflation
          const cachedAll = load(K.assets(projectId), [] as AssetRecord[]);
          const cached = cachedAll.filter(a => a.source !== 'BIM_MODEL' || a.modelGuid === currentGuid);
          const mergedById = list.map(b => {
            const c = cached.find(x => x.id === b.id);
            if (!c) return b;
            // Prefer cached values when backend has null/empty fields, and ALWAYS prefer user edits on editable fields
            const merged: any = { ...b };
            const isEdited = (c as any).userEdited === true;
            for (const key of Object.keys(c)) {
              const val = (c as any)[key];
              if (isEdited && (EDITABLE_FIELDS as any).includes(key)) {
                merged[key] = val; // user edited fields always win
              } else if (val !== null && val !== undefined && val !== '') {
                merged[key] = val;
              }
            }
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
              for (const key of Object.keys(c)) {
                const val = (c as any)[key];
                if (isEdited && (EDITABLE_FIELDS as any).includes(key)) {
                  merged[key] = val; // user edited fields always win
                } else if (val !== null && val !== undefined && val !== '') {
                  merged[key] = val;
                }
              }
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

    // Do not auto-refresh on mount; initial load is handled by loadFromBackend above.
    window.addEventListener('asset-created', handleAssetCreated);

    return () => {
      window.removeEventListener('asset-created', handleAssetCreated);
    };
  }, [projectId, rows.length]);

  // BIM Asset Extraction
  const extractAssetsFromBIM = async () => {
    if (!viewer || !viewer.model) {
      showToast('error', 'No BIM model loaded. Please load a model first.');
      return;
    }

    setIsExtracting(true);
    setExtractionProgress(0);

    try {
      console.log('🚀 [AssetList] Starting VIEWER LEAF NODE asset extraction (proven approach)...');

      // Use proven viewer-based leaf node extraction
      const extractor = new ViewerLeafAssetExtractor(viewer);
      const viewerAssets = await extractor.extractAssets((progress) => {
        setExtractionProgress(progress.progress);
        console.log(`📊 [${progress.stage}] ${progress.message}`);
      });

      console.log(`✅ [AssetList] Extraction complete: ${viewerAssets.length} assets`);

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

        const brand = asset.brand || pick('Brand','Manufacturer','Marca','Produttore','Fabbricante','Costruttore') || asset.family || 'Unknown';
        const model = asset.model || pick('Model','Modello','Type Name','Nome del tipo','Nome Tipo','Tipo') || asset.type || 'Unknown';
        const serial = asset.serialNumber || pick('Serial Number','Numero di Serie','Numero di serie','Matricola','Seriale','Mark','Contrassegno') || undefined;
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
        // Common keys seen: 'IFC Class', 'IfcClass', 'Classe IFC',
        // 'Esporta tipo in formato IFC con nome' (Italian: Export type to IFC with name),
        // 'Tipo predefinito IFC' (Predefined Type), 'IfcGUID'
        const ifcGuid = pick('IfcGUID','IFC GUID','IFC GlobalId','GlobalId');
        const ifcClass = pick(
          'IFC Class','IfcClass','Classe IFC',
          'Esporta tipo in formato IFC con nome',
          'Esporta in formato IFC con nome',
          'Esporta tipo in IFC con nome',
          'Export type in IFC with name',
          'Export type to IFC as name',
          'Export IFC Type'
        );
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

        return {
          id: `viewer-${currentGuid}-${asset.dbId}`,
          dbId: asset.dbId,
          assetCode: `BIM-${asset.dbId}`,
          assetName: asset.name,
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
          description: `${assetClassification} asset extracted from BIM model`,
          condition: 'Good',
          source: 'BIM_MODEL',
          // IFC metadata for filtering
          ifcGuid: ifcGuid ? String(ifcGuid) : undefined,
          ifcClass: ifcClass ? String(ifcClass) : undefined,
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

      // Merge newly extracted BIM assets with any locally edited versions (editable fields win)
      const newAssetsMerged = newAssets.map(a => {
        const old = rows.find(r => r.id === a.id && r.userEdited);
        if (!old) return a;
        const merged: any = { ...a };
        for (const key of EDITABLE_FIELDS) {
          const v = (old as any)[key];
          if (v !== undefined) merged[key] = v;
        }
        merged.userEdited = true;
        return merged as AssetRecord;
      });

      // Replace BIM assets with the current model's assets; keep manual assets
      const combined = [...existingManualAssets, ...newAssetsMerged];

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

          console.log(`💾 [AssetList] BG save ${newAssets.length} assets to backend (projectId: ${projectId})...`);
          const saveCtrl = new AbortController();
          const saveTimer = setTimeout(() => saveCtrl.abort('timeout'), 60000);
          const saveRes = await fetch(`/api/projects/${projectId}/assets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'replaceForModel', modelGuid: currentGuid, assets: newAssets }),
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
              for (const key of Object.keys(c)) {
                const val = (c as any)[key];
                if (isEdited && (EDITABLE_FIELDS as any).includes(key)) {
                  merged[key] = val; // user edited fields always win
                } else if (val !== null && val !== undefined && val !== '') {
                  merged[key] = val;
                }
              }
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
    categories: Array.from(new Set(rows.map(r => r.category).filter(Boolean))).sort() as string[],
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
    return true;
  });

  // Reset page when filters or page size change
  useEffect(() => { setPage(1); }, [filter.category, filter.type, filter.location, filter.condition, filter.classification, filter.ifcClass, pageSize]);

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
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const pageClamped = Math.min(page, totalPages);
  const startIndex = (pageClamped - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedRows = filteredRows.slice(startIndex, endIndex);

  const applyFilterToViewer = () => {
    if (!viewer || filteredRows.length === 0) return;
    const dbIds = filteredRows.filter(r => r.dbId != null).map(r => r.dbId as number);
    if (dbIds.length > 0) {
      viewer.isolate?.(dbIds);
      viewer.fitToView?.(dbIds);
    }
  };

  // Export CSV of current assets
  const exportCSV = () => {
    const headers = [
      'id', 'assetCode', 'assetName', 'category', 'type', 'brand', 'model', 'serialNumber', 'installationDate',
      'material', 'dimensions', 'weight', 'capacity', 'powerRating', 'location', 'condition', 'source'
    ];
    const lines = [headers.join(',')];
    rows.forEach(r => {
      const vals = headers.map(h => {
        const v = (r as any)[h];
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
          <span className="text-[11px] px-2 py-0.5 rounded bg-gray-800 border border-gray-700 text-gray-300">{rows.length} items</span>
        </div>

        {/* BIM Asset Extraction */}
        <div className="mb-2">
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
            <div className="mt-1 bg-gray-800 rounded-full h-1">
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
              {[
                ['Basic', 'basic'],
                ['Identification', 'identification'],
                ['Technical', 'technical'],
                ['Documentation', 'documentation'],
                ['Lifecycle', 'lifecycle'],
                ['Maintenance', 'maintenance'],
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
            <div className="grid grid-cols-2 gap-2">
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
              <select value={filter.classification} onChange={e => setFilter(f => ({ ...f, classification: e.target.value }))} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-xs col-span-2">
                <option value="">All Classifications</option>
                {distinct.classifications.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
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
              {visibleFields.basic && (
                <>
                  <th className="text-left px-2 py-1.5">Source</th>
                  <th className="text-left px-2 py-1.5">Category</th>
                  <th className="text-left px-2 py-1.5">Type</th>
                  <th className="text-left px-2 py-1.5">Brand</th>
                  <th className="text-left px-2 py-1.5">Model</th>
                  <th className="text-left px-2 py-1.5">Actions</th>
                </>
              )}
              {visibleFields.identification && (
                <>
                  <th className="text-left px-2 py-1.5">Code</th>
                  <th className="text-left px-2 py-1.5">Name</th>
                  <th className="text-left px-2 py-1.5">Serial</th>
                  <th className="text-left px-2 py-1.5">Install Date</th>
                </>
              )}
              {visibleFields.technical && (
                <>
                  <th className="text-left px-2 py-1.5">Material</th>
                  <th className="text-left px-2 py-1.5">Dimensions</th>
                  <th className="text-left px-2 py-1.5">Capacity</th>
                </>
              )}
              {visibleFields.documentation && (
                <>
                  <th className="text-left px-2 py-1.5">Manuals</th>
                  <th className="text-left px-2 py-1.5">Warranties</th>
                </>
              )}
              {visibleFields.lifecycle && (
                <>
                  <th className="text-left px-2 py-1.5">Condition</th>
                  <th className="text-left px-2 py-1.5">Expected Life</th>
                </>
              )}
              {visibleFields.maintenance && (
                <>
                  <th className="text-left px-2 py-1.5">Last Service</th>
                  <th className="text-left px-2 py-1.5">Next Service</th>
                </>
              )}
              {visibleFields.economic && (
                <>
                  <th className="text-left px-2 py-1.5">Purchase Cost</th>
                  <th className="text-left px-2 py-1.5">Maintenance Cost</th>
                </>
              )}
              {visibleFields.compliance && (
                <>
                  <th className="text-left px-2 py-1.5">Regulations</th>
                  <th className="text-left px-2 py-1.5">Safety</th>
                </>
              )}
              {visibleFields.relationships && (
                <>
                  <th className="text-left px-2 py-1.5">Location</th>
                  <th className="text-left px-2 py-1.5">Suppliers</th>
                </>
              )}
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
                    <td className="px-2 py-1.5 text-gray-100">{r.category || '-'}</td>
                    <td className="px-2 py-1.5 text-gray-200">{r.type || '-'}</td>
                    <td className="px-2 py-1.5 text-gray-200">{r.brand || '-'}</td>
                    <td className="px-2 py-1.5 text-gray-200">{r.model || '-'}</td>
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
                    <td className="px-2 py-1.5 text-gray-200">{r.manuals || '-'}</td>
                    <td className="px-2 py-1.5 text-gray-200">{r.warranties || '-'}</td>
                  </>
                )}
                {visibleFields.lifecycle && (
                  <>
                    <td className="px-2 py-1.5 text-gray-200">{r.condition || '-'}</td>
                    <td className="px-2 py-1.5 text-gray-200">{r.expectedLife || '-'}</td>
                  </>
                )}
                {visibleFields.maintenance && (
                  <>
                    <td className="px-2 py-1.5 text-gray-200">{r.lastService || '-'}</td>
                    <td className="px-2 py-1.5 text-gray-200">{r.nextService || '-'}</td>
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
                    <td className="px-2 py-1.5 text-gray-200">{r.location || '-'}</td>
                    <td className="px-2 py-1.5 text-gray-200">{r.suppliers || '-'}</td>
                  </>
                )}
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

      {/* Edit Asset Modal */}
      {editModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1001]" onClick={() => setEditModal({ open: false })}>
          <div className="bg-gray-900 border border-gray-700 rounded p-3 w-[700px] max-w-[95vw] max-h-[85vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-white text-sm font-semibold">Edit Asset</div>
              <div className="flex items-center gap-2 text-xs">
                {(['basic','identification','technical','documentation','lifecycle','maintenance','economic','compliance','relationships'] as const).map(tab => (
                  <button key={tab}
                    className={`px-2 py-1 rounded border ${editSection===tab?'text-white border-gray-500 bg-gray-700':'text-gray-300 border-gray-700 bg-gray-800/60 hover:bg-gray-700'}`}
                    onClick={() => setEditSection(tab)}
                  >{tab[0].toUpperCase()+tab.slice(1)}</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {editSection==='basic' && (
                <>
                  <label className="flex flex-col gap-1 text-gray-300"><span>Category</span><input value={edit.category||''} onChange={e=>setEdit(p=>({...p, category:e.target.value}))} className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white"/></label>
                  <label className="flex flex-col gap-1 text-gray-300"><span>Type</span><input value={edit.type||''} onChange={e=>setEdit(p=>({...p, type:e.target.value}))} className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white"/></label>
                  <label className="flex flex-col gap-1 text-gray-300"><span>Brand</span><input value={edit.brand||''} onChange={e=>setEdit(p=>({...p, brand:e.target.value}))} className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white"/></label>
                  <label className="flex flex-col gap-1 text-gray-300"><span>Model</span><input value={edit.model||''} onChange={e=>setEdit(p=>({...p, model:e.target.value}))} className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white"/></label>
                  <label className="flex flex-col gap-1 text-gray-300 col-span-2"><span>Description</span><textarea value={edit.description||''} onChange={e=>setEdit(p=>({...p, description:e.target.value}))} className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white min-h-[60px]"/></label>
                </>
              )}
              {editSection==='identification' && (
                <>
                  <label className="flex flex-col gap-1 text-gray-300"><span>Asset Code</span><input value={edit.assetCode||''} onChange={e=>setEdit(p=>({...p, assetCode:e.target.value}))} className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white"/></label>
                  <label className="flex flex-col gap-1 text-gray-300"><span>Asset Name</span><input value={edit.assetName||''} onChange={e=>setEdit(p=>({...p, assetName:e.target.value}))} className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white"/></label>
                  <label className="flex flex-col gap-1 text-gray-300"><span>Serial Number</span><input value={edit.serialNumber||''} onChange={e=>setEdit(p=>({...p, serialNumber:e.target.value}))} className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white"/></label>
                  <label className="flex flex-col gap-1 text-gray-300"><span>Installation Date</span><input value={edit.installationDate||''} onChange={e=>setEdit(p=>({...p, installationDate:e.target.value}))} className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white"/></label>
                </>
              )}
              {editSection==='technical' && (
                <>
                  <label className="flex flex-col gap-1 text-gray-300"><span>Material</span><input value={edit.material||''} onChange={e=>setEdit(p=>({...p, material:e.target.value}))} className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white"/></label>
                  <label className="flex flex-col gap-1 text-gray-300"><span>Dimensions</span><input value={edit.dimensions||''} onChange={e=>setEdit(p=>({...p, dimensions:e.target.value}))} className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white"/></label>
                  <label className="flex flex-col gap-1 text-gray-300"><span>Weight</span><input value={edit.weight||''} onChange={e=>setEdit(p=>({...p, weight:e.target.value}))} className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white"/></label>
                  <label className="flex flex-col gap-1 text-gray-300"><span>Capacity</span><input value={edit.capacity||''} onChange={e=>setEdit(p=>({...p, capacity:e.target.value}))} className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white"/></label>
                  <label className="flex flex-col gap-1 text-gray-300"><span>Power Rating</span><input value={edit.powerRating||''} onChange={e=>setEdit(p=>({...p, powerRating:e.target.value}))} className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white"/></label>
                </>
              )}
              {editSection==='documentation' && (
                <>
                  <label className="flex flex-col gap-1 text-gray-300"><span>Manuals</span><input value={edit.manuals||''} onChange={e=>setEdit(p=>({...p, manuals:e.target.value}))} className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white"/></label>
                  <label className="flex flex-col gap-1 text-gray-300"><span>Warranties</span><input value={edit.warranties||''} onChange={e=>setEdit(p=>({...p, warranties:e.target.value}))} className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white"/></label>
                  <label className="flex flex-col gap-1 text-gray-300 col-span-2"><span>Regulations</span><input value={edit.regulations||''} onChange={e=>setEdit(p=>({...p, regulations:e.target.value}))} className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white"/></label>
                  <label className="flex flex-col gap-1 text-gray-300 col-span-2"><span>Safety Notes</span><textarea value={edit.safetyNotes||''} onChange={e=>setEdit(p=>({...p, safetyNotes:e.target.value}))} className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white min-h-[60px]"/></label>
                </>
              )}
              {editSection==='lifecycle' && (
                <>
                  <label className="flex flex-col gap-1 text-gray-300"><span>Condition</span><input value={edit.condition||''} onChange={e=>setEdit(p=>({...p, condition:e.target.value}))} className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white"/></label>
                  <label className="flex flex-col gap-1 text-gray-300"><span>Service Date</span><input value={edit.serviceDate||''} onChange={e=>setEdit(p=>({...p, serviceDate:e.target.value}))} className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white"/></label>
                  <label className="flex flex-col gap-1 text-gray-300"><span>Expected Life</span><input value={edit.expectedLife||''} onChange={e=>setEdit(p=>({...p, expectedLife:e.target.value}))} className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white"/></label>
                </>
              )}
              {editSection==='maintenance' && (
                <>
                  <label className="flex flex-col gap-1 text-gray-300"><span>Maintenance Schedule</span><input value={edit.maintenanceSchedule||''} onChange={e=>setEdit(p=>({...p, maintenanceSchedule:e.target.value}))} className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white"/></label>
                  <label className="flex flex-col gap-1 text-gray-300"><span>Last Service</span><input value={edit.lastService||''} onChange={e=>setEdit(p=>({...p, lastService:e.target.value}))} className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white"/></label>
                  <label className="flex flex-col gap-1 text-gray-300"><span>Next Service</span><input value={edit.nextService||''} onChange={e=>setEdit(p=>({...p, nextService:e.target.value}))} className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white"/></label>
                </>
              )}
              {editSection==='economic' && (
                <>
                  <label className="flex flex-col gap-1 text-gray-300"><span>Purchase Cost</span><input value={edit.purchaseCost||''} onChange={e=>setEdit(p=>({...p, purchaseCost:e.target.value}))} className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white"/></label>
                  <label className="flex flex-col gap-1 text-gray-300"><span>Maintenance Cost</span><input value={edit.maintenanceCost||''} onChange={e=>setEdit(p=>({...p, maintenanceCost:e.target.value}))} className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white"/></label>
                </>
              )}
              {editSection==='compliance' && (
                <>
                  <label className="flex flex-col gap-1 text-gray-300 col-span-2"><span>Regulations</span><input value={edit.regulations||''} onChange={e=>setEdit(p=>({...p, regulations:e.target.value}))} className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white"/></label>
                  <label className="flex flex-col gap-1 text-gray-300 col-span-2"><span>Safety Notes</span><textarea value={edit.safetyNotes||''} onChange={e=>setEdit(p=>({...p, safetyNotes:e.target.value}))} className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white min-h-[60px]"/></label>
                </>
              )}
              {editSection==='relationships' && (
                <>
                  <label className="flex flex-col gap-1 text-gray-300 col-span-2"><span>Location</span><input value={edit.location||''} onChange={e=>setEdit(p=>({...p, location:e.target.value}))} className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white"/></label>
                  <label className="flex flex-col gap-1 text-gray-300 col-span-2"><span>Suppliers</span><input value={edit.suppliers||''} onChange={e=>setEdit(p=>({...p, suppliers:e.target.value}))} className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white"/></label>
                </>
              )}
            </div>
            <div className="mt-3 flex items-center justify-end gap-2">
              <button className="px-3 py-1.5 rounded text-xs bg-gray-700 hover:bg-gray-600 text-white" onClick={() => setEditModal({ open: false })}>Cancel</button>
              <button className="px-3 py-1.5 rounded text-xs bg-emerald-700 hover:bg-emerald-600 text-white" onClick={saveEditAsset}>Save</button>
            </div>
          </div>
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
    </div>
  );
};

const CreateAsset: React.FC<{ projectId?: string; viewer?: any; }> = ({ projectId, viewer }) => {
  const [rows, setRows] = useState<AssetRecord[]>(() => load(K.assets(projectId), [] as AssetRecord[]));
  const [activeSection, setActiveSection] = useState<'identification' | 'technical' | 'documentation' | 'lifecycle' | 'maintenance' | 'economic' | 'compliance' | 'relationships'>('identification');
  const [f, setF] = useState<Partial<AssetRecord>>(() => {
    // Load from localStorage on init
    const saved = load(`fm-create-asset-draft-${projectId || 'global'}`, {});
    return {
      category: '', type: '', brand: '', model: '', description: '', location: '',
      assetCode: '', assetName: '', serialNumber: '', installationDate: '',
      material: '', dimensions: '', weight: '', capacity: '', powerRating: '',
      manuals: '', warranties: '', certifications: '',
      condition: '', serviceDate: '', expectedLife: '',
      maintenanceSchedule: '', lastService: '', nextService: '',
      purchaseCost: '', maintenanceCost: '',
      regulations: '', safetyNotes: '',
      parentAsset: '', suppliers: '',
      ...saved
    };
  });


  // Auto-save draft to localStorage on every field change
  useEffect(() => {
    save(`fm-create-asset-draft-${projectId || 'global'}`, f);
  }, [f, projectId]);

  useEffect(() => save(K.assets(projectId), rows), [rows, projectId]);

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const onSave = async () => {
    // Validate required fields
    if (!f.assetName && !f.brand && !f.model) {
      setSaveError('Please provide at least Asset Name, Brand, or Model');
      setTimeout(() => setSaveError(null), 3000);
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const rec: AssetRecord = {
        ...f as AssetRecord,
        id: `asset-${Date.now()}`,
        dbId: null,
        source: 'MANUAL',
        // Set default condition if not provided
        condition: f.condition || 'Good'
      };

      console.log('🔍 [CreateAsset] Form data being saved:', f);
      console.log('🔍 [CreateAsset] Asset record being created:', rec);

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
    { key: 'maintenance' as const, label: 'Maintenance Management' },
    { key: 'economic' as const, label: 'Economic Aspects' },
    { key: 'compliance' as const, label: 'Compliance & Safety' },
    { key: 'relationships' as const, label: 'Links & Relationships' }
  ];

  const updateField = (key: keyof AssetRecord, value: string) => {
    setF(v => ({ ...v, [key]: value }));
  };

  // Build category options from CATEGORY_MAPPING in Italian / English (IFC)
  const categoryOptions: string[] = React.useMemo(() => {
    const opts: string[] = [];
    for (const [it, m] of Object.entries(CATEGORY_MAPPING)) {
      opts.push(`${it} / ${m.english} (${m.ifc})`);
    }
    return opts.sort();
  }, []);

  const mapToStandardCategory = (category?: string): string | undefined => {
    if (!category) return undefined;
    const cat = category.toLowerCase();
    for (const [it, m] of Object.entries(CATEGORY_MAPPING)) {
      if (cat.includes(it.toLowerCase()) || cat.includes(m.english.toLowerCase()) || cat.includes(m.ifc.toLowerCase())) {
        return `${it} / ${m.english} (${m.ifc})`;
      }
    }
    return category;
  };

  // Prefill from current model selection
  const prefillFromSelection = async () => {
    try {
      if (!viewer) return;
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
      // Level needs to fall back to raw pick directly (prefers descriptive fields)
      const level = pickAlias('level');
      const room = pickAlias('room');
      const rawCategory = pickAlias('rawCategory') || pick('Category', 'Categoria', 'OmniClass Title', 'OmniClass', 'Tipo');
      const category = mapToStandardCategory(rawCategory);
      const dimensions = (length || width || height) ? `${length || ''} x ${width || ''} x ${height || ''}`.replace(/\s+x\s+x\s+/, '').trim() : undefined;

      setF(v => ({
        ...v,
        // Replace with new selection data (clear fields if not present in new selection)
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
      }));
    } catch { }
  };



  return (
    <div className="p-3 space-y-3 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div className="text-white font-semibold text-sm">Create New Asset</div>
        <button
          className="text-[11px] px-2 py-1 rounded border border-gray-700 bg-gray-800/60 hover:bg-gray-700 text-gray-200"
          onClick={prefillFromSelection}
        >
          Prefill from Selection
        </button>
      </div>

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
            <div><label className="text-[11px] text-gray-300 block mb-1">Asset Code</label><input value={f.assetCode || ''} onChange={e => updateField('assetCode', e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" /></div>
            <div><label className="text-[11px] text-gray-300 block mb-1">Asset Name</label><input value={f.assetName || ''} onChange={e => updateField('assetName', e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" /></div>
            <div><label className="text-[11px] text-gray-300 block mb-1">Category</label>
              <select value={f.category || ''} onChange={e => updateField('category', e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs">
                <option value="">Select category</option>
                {categoryOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
            <div><label className="text-[11px] text-gray-300 block mb-1">Type</label><input value={f.type || ''} onChange={e => updateField('type', e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" /></div>
            <div><label className="text-[11px] text-gray-300 block mb-1">Brand</label><input value={f.brand || ''} onChange={e => updateField('brand', e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" /></div>
            <div><label className="text-[11px] text-gray-300 block mb-1">Model</label><input value={f.model || ''} onChange={e => updateField('model', e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" /></div>
            <div><label className="text-[11px] text-gray-300 block mb-1">Serial Number</label><input value={f.serialNumber || ''} onChange={e => updateField('serialNumber', e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" /></div>
            <div><label className="text-[11px] text-gray-300 block mb-1">Installation Date</label><input type="date" value={f.installationDate || ''} onChange={e => updateField('installationDate', e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" /></div>
            <div className="col-span-2"><label className="text-[11px] text-gray-300 block mb-1">Description</label><textarea value={f.description || ''} onChange={e => updateField('description', e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" rows={2} /></div>
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
            <div><label className="text-[11px] text-gray-300 block mb-1">Manuals</label><input value={f.manuals || ''} onChange={e => updateField('manuals', e.target.value)} placeholder="Link or file reference" className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" /></div>
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

        {activeSection === 'maintenance' && (
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2"><label className="text-[11px] text-gray-300 block mb-1">Maintenance Schedule</label><input value={f.maintenanceSchedule || ''} onChange={e => updateField('maintenanceSchedule', e.target.value)} placeholder="Weekly, Monthly, Annually" className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" /></div>
            <div><label className="text-[11px] text-gray-300 block mb-1">Last Service</label><input type="date" value={f.lastService || ''} onChange={e => updateField('lastService', e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" /></div>
            <div><label className="text-[11px] text-gray-300 block mb-1">Next Service</label><input type="date" value={f.nextService || ''} onChange={e => updateField('nextService', e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" /></div>
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
            <div><label className="text-[11px] text-gray-300 block mb-1">Location</label><input value={f.location || ''} onChange={e => updateField('location', e.target.value)} placeholder="Building, Floor, Room" className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs" /></div>
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
  onSave: () => void;
  onCancel: () => void;
}> = ({ space, projectId, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    level: space.level || '',
    name: space.name || '',
    area: space.area || '',
    description: space.description || '',
    building: space.building || '',
    spaceCode: space.spaceCode || ''
  });
  const [saving, setSaving] = useState(false);

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

  // Helper to get current model GUID (if viewer is present)
  const getCurrentModelGuid = React.useCallback((): string | undefined => {
    try {
      const g = viewer?.model?.getData?.()?.guid;
      if (g && typeof g === 'string') return g;
      const mid = viewer?.model?.id;
      return (mid != null) ? String(mid) : undefined;
    } catch { return undefined; }
  }, [viewer]);

  // Load from backend (scoped by model when possible)
  useEffect(() => {
    const run = async () => {
      if (!projectId) return;
      try {
        const mg = getCurrentModelGuid();
        console.log(`[Spaces] Initial load with modelGuid=${mg}`);
        const url = mg ? `/api/projects/${projectId}/spaces?modelGuid=${encodeURIComponent(mg)}` : `/api/projects/${projectId}/spaces`;
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data)) {
          // Normalize ids
          const normalized: SpaceRecord[] = data.map((d: any) => ({
            id: d.id || d._id || d.idStr || `${d.source || 'MANUAL'}-${d.dbId || d.name || Math.random()}`,
            level: d.level,
            name: d.name,
            area: d.area,
            spaceCode: d.spaceCode,
            building: d.building,
            description: d.description,
            source: d.source,
            dbId: d.dbId ?? null,
            modelGuid: d.modelGuid,
            footprint: d.footprint || undefined,
            conflictWithId: d.conflictWithId
          }));
          
          // Extra client-side filter for safety
          const clientFiltered = mg 
            ? normalized.filter(r => r.source !== 'BIM_MODEL' || r.modelGuid === mg)
            : normalized;
          
          console.log(`[Spaces] Initial load: server returned ${normalized.length}, client-filtered to ${clientFiltered.length}`);
          setRows(clientFiltered);
        }
      } catch (err) { console.error(err); }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, viewer]);

  // Ensure current rows reflect only the current model's BIM spaces when viewer/model changes
  useEffect(() => {
    const mg = getCurrentModelGuid();
    if (!mg) return;
    setRows(prev => prev.filter(r => r.source !== 'BIM_MODEL' || r.modelGuid === mg));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageClamped = Math.min(Math.max(1, page), totalPages);
  const startIndex = (pageClamped - 1) * pageSize;
  const endIndex = Math.min(rows.length, startIndex + pageSize);
  const paginatedRows = rows.slice(startIndex, endIndex);

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
      const dbids = await findRoomDbIds();
      if (!dbids || dbids.length === 0) {
        setExtractionProgress(100);
        setIsExtracting(false);
        return;
      }
      const propsList: any[] = [];
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
        const areaStr = get(['Area', 'Superficie', 'Superficie utile', 'Superficie netta', 'Area utile', 'Area netta', 'Superficie (m²)']);
        const areaNum = areaStr ? Number((areaStr as string).toString().replace(/[^0-9.\-]/g, '')) : undefined;

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
          level: level || undefined,
          name: name || (p as any).__syntheticName || undefined,
          area: isNaN(Number(areaNum)) ? undefined : Number(areaNum),
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
                spaceCode: d.spaceCode,
                building: d.building,
                description: d.description,
                source: d.source,
                dbId: d.dbId ?? null,
                modelGuid: d.modelGuid,
                footprint: d.footprint || undefined,
                conflictWithId: d.conflictWithId
              }));
              
              // Extra client-side filter: only keep BIM spaces matching current model, plus all manual spaces
              const clientFiltered = mg 
                ? normalized.filter(r => r.source !== 'BIM_MODEL' || r.modelGuid === mg)
                : normalized;
              
              console.log(`[Spaces] Server returned ${normalized.length}, client-filtered to ${clientFiltered.length} for modelGuid=${mg}`);
              setRows(clientFiltered);
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
              spaceCode: d.spaceCode,
              building: d.building,
              description: d.description,
              source: d.source,
              dbId: d.dbId ?? null,
              modelGuid: d.modelGuid,
              footprint: d.footprint || undefined,
              conflictWithId: d.conflictWithId
            })) : [];
            
            // Extra client-side filter for safety
            const clientFiltered = mg 
              ? normalized.filter(r => r.source !== 'BIM_MODEL' || r.modelGuid === mg)
              : normalized;
            
            console.log(`[Spaces] Server returned ${normalized.length}, client-filtered to ${clientFiltered.length} for modelGuid=${mg}`);
            setRows(clientFiltered);
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
    if (autoExtractSpacesOnceRef.current) return;
    if (!projectId || !viewer) return;
    autoExtractSpacesOnceRef.current = true;
    console.log('🔁 [Spaces] Auto-extract on open (background refresh)');
    extractRoomsFromBIM();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, viewer]);

  // Listen for space-created events to refresh list
  useEffect(() => {
    const handleSpaceCreated = (e: CustomEvent) => {
      if (e.detail?.projectId === projectId) {
        console.log('[SpaceList] Space created event received, reloading from DB');
        const mg = getCurrentModelGuid();
        fetch(`/api/projects/${projectId}/spaces${mg ? `?modelGuid=${encodeURIComponent(mg)}` : ''}`)
          .then(res => res.json())
          .then(data => {
            if (Array.isArray(data)) {
              const normalized: SpaceRecord[] = data.map((d: any) => ({
                id: d.id || d._id || d.idStr || `${d.source || 'MANUAL'}-${d.dbId || d.name || Math.random()}`,
                level: d.level,
                name: d.name,
                area: d.area,
                spaceCode: d.spaceCode,
                building: d.building,
                description: d.description,
                source: d.source,
                dbId: d.dbId ?? null,
                modelGuid: d.modelGuid,
                footprint: d.footprint || undefined,
                conflictWithId: d.conflictWithId
              }));
              const clientFiltered = mg 
                ? normalized.filter(r => r.source !== 'BIM_MODEL' || r.modelGuid === mg)
                : normalized;
              console.log(`[SpaceList] Reloaded after space-created: ${clientFiltered.length} spaces`);
              setRows(clientFiltered);
            }
          })
          .catch(err => console.error('[SpaceList] Failed to reload after space-created', err));
      }
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

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-3 border-b border-gray-800">
        <div className="text-white font-semibold text-sm">Space List</div>
        <div className="mt-2">
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
              <th className="text-left px-3 py-2">Description</th>
              <th className="text-center px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400">No spaces. Use "Create new space" or extract from BIM.</td></tr>
            ) : paginatedRows.map(r => (
              <tr key={r.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                <td className="px-3 py-2 text-gray-100">{r.level || '-'}</td>
                <td className="px-3 py-2 text-gray-200 cursor-pointer hover:text-white" onClick={() => onRowClick(r)}>{r.name || '-'}</td>
                <td className="px-3 py-2 text-gray-200">{r.area != null ? (typeof r.area === 'string' ? parseFloat(r.area).toFixed(2) : r.area.toFixed(2)) : '-'}</td>
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
        <div className="flex-1 text-center text-gray-400 truncate">
          {rows.length === 0 ? '0' : `${startIndex + 1}-${Math.min(endIndex, rows.length)}`} of {rows.length}
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
              onSave={() => {
                setEditModal({ open: false });
                // Reload spaces from database to show updated values
                (async () => {
                  try {
                    console.log('[SpaceList] Reloading spaces after edit...');
                    const res = await fetch(`/api/projects/${projectId}/spaces`);
                    if (res.ok) {
                      const data = await res.json();
                      console.log('[SpaceList] Reloaded spaces:', data.length, 'items');
                      if (Array.isArray(data)) {
                        const normalized: SpaceRecord[] = data.map((d: any) => ({
                          id: d.id || d._id || d.idStr || `${d.source || 'MANUAL'}-${d.dbId || d.name || Math.random()}`,
                          level: d.level,
                          name: d.name,
                          area: d.area,
                          spaceCode: d.spaceCode,
                          building: d.building,
                          description: d.description,
                          source: d.source,
                          dbId: d.dbId ?? null,
                          modelGuid: d.modelGuid,
                          footprint: d.footprint || undefined,
                          conflictWithId: d.conflictWithId
                        }));
                        console.log('[SpaceList] Normalized and setting rows:', normalized.length);
                        setRows(normalized);
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
  const [f, setF] = useState(() => {
    // Load from localStorage on init
    const saved = load(`fm-create-space-draft-${projectId || 'global'}`, {});
    return {
      building: '', level: '', name: '', spaceCode: '', area: '', description: '',
      ...saved
    };
  });

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
      setF(prev => ({ ...prev, building: projectName }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectName]);

  // Auto-save draft to localStorage on every field change
  useEffect(() => {
    save(`fm-create-space-draft-${projectId || 'global'}`, f);
  }, [f, projectId]);
  // Footprint drawing state
  const [drawing, setDrawing] = useState(false);
  const [footprint, setFootprint] = useState<{ points: { x: number; y: number; z: number }[]; z?: number; levelIndex?: number } | null>(null);
  const pointsRef = useRef<{ x: number; y: number; z: number }[]>([]);
  const baseZRef = useRef<number | null>(null);
  const overlayName = 'fm-footprint-editor';
  const isRemote = !viewer && !!standalone; // standalone window without viewer
  const hoverRef = useRef<{ x: number; y: number; z: number } | null>(null);

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
      const pts = pointsRef.current;
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
        const closedPts = [...pts, pts[0]].map(p => new THREE.Vector3(p.x, p.y, p.z));
        const geom2 = new THREE.BufferGeometry().setFromPoints(closedPts);
        const line2 = new THREE.Line(geom2, new THREE.LineBasicMaterial({ color: 0x0088ff, linewidth: 4, depthTest: false, opacity: 0.7, transparent: true }));
        line2.renderOrder = 999;
        viewer.impl.addOverlay(overlayName, line2);
        // Filled polygon for visibility (DARKER)
        const shape = new THREE.Shape(pts.map((p, i) => new THREE.Vector2(p.x, p.y)));
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

  const isNearFirst = (p: { x: number; y: number; z: number }, eps = 0.4) => {
    if (pointsRef.current.length < 1) return false;
    const a = pointsRef.current[0];
    const dx = p.x - a.x, dy = p.y - a.y;
    return Math.hypot(dx, dy) <= eps;
  };

  const onViewerClick = (ev: MouseEvent) => {
    try {
      if (!viewer?.impl) return;
      // Initialize base Z from first hit or ground if needed
      if (baseZRef.current == null) {
        const hit = viewer.impl.hitTest(ev.clientX, ev.clientY, true);
        if (hit?.point?.z != null) baseZRef.current = hit.point.z; else {
          try { baseZRef.current = viewer.model?.getBoundingBox?.().min?.z ?? 0; } catch { baseZRef.current = 0; }
        }
      }
      const z = baseZRef.current ?? 0;
      const p = worldOnZ(ev.clientX, ev.clientY, z);
      if (!p) return;
      if (pointsRef.current.length >= 3 && isNearFirst(p)) {
        finishDrawing();
        return;
      }
      pointsRef.current.push({ x: p.x, y: p.y, z });
      drawPreview();
    } catch { }
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
      const p = worldOnZ(ev.clientX, ev.clientY, z);
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
    } else if (ev.key === 'Escape') {
      ev.preventDefault();
      cancelDrawing();
    }
  };

  const startDrawing = () => {
    if (!viewer) {
      // Remote drawing: request main window to start capture
      try {
        (window as any).opener?.postMessage?.({ type: 'FM_DRAW_START' }, '*');
        setFootprint(null);
        pointsRef.current = [];
        baseZRef.current = null;
        setDrawing(true);
      } catch { }
      return;
    }
    try {
      setFootprint(null);
      pointsRef.current = [];
      baseZRef.current = null;
      hoverRef.current = null;
      setDrawing(true);
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
    } catch { }
  };

  const finishDrawing = () => {
    try {
      if (isRemote) {
        // Ask main window to finalize and send us the points
        (window as any).opener?.postMessage?.({ type: 'FM_DRAW_FINISH' }, '*');
        setDrawing(false);
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
      const pts = pointsRef.current;
      if (pts.length >= 3) {
        setFootprint({ points: [...pts], z: baseZRef.current ?? undefined, levelIndex: undefined });
        // Draw final polygon and keep it visible
        drawFinalPolygon(pts);
      } else {
        // not enough points
        setFootprint(null);
        clearOverlay();
      }
    } catch { }
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
      clearOverlay();
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
        return;
      }
      pointsRef.current.pop();
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
    const onMsg = (e: MessageEvent) => {
      const d: any = e.data;
      if (!d || typeof d !== 'object') return;
      if (d.type === 'FM_DRAW_POINT' && d.point) {
        try {
          const p = d.point as { x: number; y: number; z: number };
          pointsRef.current.push(p);
          // keep latest summary for UI
          setFootprint(prev => ({ points: [...pointsRef.current], z: pointsRef.current[0]?.z, levelIndex: undefined }));
        } catch { }
      } else if (d.type === 'FM_DRAW_DONE' && Array.isArray(d.points)) {
        setDrawing(false);
        pointsRef.current = d.points;
        setFootprint({ points: [...d.points], z: d.points[0]?.z, levelIndex: undefined });
      } else if (d.type === 'FM_DRAW_CANCELLED') {
        setDrawing(false);
        pointsRef.current = [];
        setFootprint(null);
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
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
      dbId: null
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
        console.log('[CreateSpace] Space saved to DB successfully');
        // Trigger a refresh event so SpaceList reloads
        window.dispatchEvent(new CustomEvent('space-created', { detail: { projectId } }));
        
        // Clear form
        const emptyForm = { building: '', level: '', name: '', spaceCode: '', area: '', description: '' };
        setF(emptyForm);
        save(`fm-create-space-draft-${projectId || 'global'}`, emptyForm);
        
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
  return (
    <div className="p-3 space-y-3">
      <div className="text-white font-semibold text-sm">Create New Space</div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className="text-[12px] text-gray-300 block mb-1">Building</label><input value={f.building} onChange={e => setF(v => ({ ...v, building: e.target.value }))} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm" /></div>
        <div><label className="text-[12px] text-gray-300 block mb-1">Level</label><input value={f.level} onChange={e => setF(v => ({ ...v, level: e.target.value }))} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm" /></div>
        <div><label className="text-[12px] text-gray-300 block mb-1">Room name</label><input value={f.name} onChange={e => setF(v => ({ ...v, name: e.target.value }))} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm" /></div>
        <div><label className="text-[12px] text-gray-300 block mb-1">Space Code</label><input value={f.spaceCode} onChange={e => setF(v => ({ ...v, spaceCode: e.target.value }))} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm" /></div>
        <div><label className="text-[12px] text-gray-300 block mb-1">Area (m²)</label><input value={f.area} onChange={e => setF(v => ({ ...v, area: e.target.value }))} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm" /></div>
        <div className="col-span-2"><label className="text-[12px] text-gray-300 block mb-1">Description</label><input value={f.description} onChange={e => setF(v => ({ ...v, description: e.target.value }))} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm" /></div>
      </div>
      {/* Footprint Editor */}
      <div className="border-t border-gray-700 pt-3">
        <div className="text-xs text-gray-400 mb-2">2D Footprint (optional)</div>
        <div className="flex flex-wrap gap-2">
          <button onClick={startDrawing} disabled={(!!viewer === false && !isRemote) || drawing} className={`px-3 py-1.5 rounded text-xs ${(((!!viewer === false) && !isRemote) || drawing) ? 'bg-gray-700 text-gray-400' : 'bg-emerald-700 hover:bg-emerald-800 text-white'}`}>Start drawing</button>
          <button onClick={finishDrawing} disabled={!drawing || pointsRef.current.length < 3} className={`px-3 py-1.5 rounded text-xs ${(!drawing || pointsRef.current.length < 3) ? 'bg-gray-700 text-gray-400' : 'bg-blue-700 hover:bg-blue-800 text-white'}`}>Finish</button>
          <button onClick={undoLastPoint} disabled={!drawing || pointsRef.current.length === 0} className={`px-3 py-1.5 rounded text-xs ${(!drawing || pointsRef.current.length === 0) ? 'bg-gray-700 text-gray-400' : 'bg-yellow-700 hover:bg-yellow-800 text-white'}`}>Undo</button>
          <button onClick={cancelDrawing} disabled={!drawing && !footprint} className={`px-3 py-1.5 rounded text-xs ${(!drawing && !footprint) ? 'bg-gray-700 text-gray-400' : 'bg-red-700 hover:bg-red-800 text-white'}`}>Clear</button>
        </div>
        <div className="text-[11px] text-gray-500 mt-2">
          {drawing
            ? 'Click on the model to add points. Press Enter to finish, ESC to cancel.'
            : footprint
              ? `${footprint.points.length} points captured at z=${(footprint.z ?? 0).toFixed?.(2)}`
              : 'No footprint set.'}
        </div>
      </div>
      <div><button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded" onClick={onSave}>Save Space</button></div>
    </div>
  );
};

const ScheduledMaintenance: React.FC<{ projectId?: string; viewer?: any }> = ({ projectId, viewer }) => {
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

  const [f, setF] = useState({ discipline: '', category: '', code: '', asset: '', frequency: '', timeHours: '' });
  const [selectedAssets, setSelectedAssets] = useState<{ label: string; type?: string; id?: string }[]>([]);
  const [allowedAssetType, setAllowedAssetType] = useState<string | null>(null);
  const [currentTask, setCurrentTask] = useState('');
  const [tasks, setTasks] = useState<string[]>([]);
  const [errors, setErrors] = useState({ discipline: '', category: '', code: '', asset: '', frequency: '', timeHours: '', tasks: '' });
  const [submitMessage, setSubmitMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

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
    if (!f.category) { newErrors.category = 'Required'; hasError = true; }
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
    const newItem: ScheduledItem = {
      id: `sched-${Date.now()}`,
      discipline: f.discipline,
      category: f.category,
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

    // Reset form
    setF({ discipline: '', category: '', code: '', asset: '', frequency: '', timeHours: '' });
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

        {/* Category Dropdown (from CATEGORY_MAPPING) */}
        <div>
          <label className="text-[11px] text-gray-400 block mb-1">Category *</label>
          <select
            value={f.category}
            onChange={e => { setF(v => ({ ...v, category: e.target.value })); setErrors(prev => ({ ...prev, category: '' })); setSubmitMessage(null); }}
            className={`w-full bg-gray-800 border rounded px-2 py-1.5 text-white text-sm ${errors.category ? 'border-red-500' : 'border-gray-700'}`}
          >
            <option value="">Select Category</option>
            {categoryOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
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

      {/* Asset Picker Modal */}
      {showAssetPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAssetPicker(false)}>
          <div className="bg-gray-800 rounded-lg p-4 w-full max-w-5xl flex flex-col resize overflow-auto" style={{ minWidth: '400px', minHeight: '500px', maxHeight: 'calc(100vh - 40px)', maxWidth: 'calc(100vw - 40px)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-semibold">Select Asset from Register</h3>
              <button onClick={() => setShowAssetPicker(false)} className="text-gray-400 hover:text-white text-2xl">&times;</button>
            </div>

            {/* Search Input */}
            <input
              type="text"
              placeholder="Search assets by name, code, category, location, type, brand..."
              value={assetSearch}
              onChange={e => setAssetSearch(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm mb-3"
            />

            {/* Filter and Sort Controls */}
            <div className="flex gap-2 mb-3">
              {/* Category Filter */}
              <div className="flex-1">
                <label className="text-[10px] text-gray-400 block mb-1">Filter by Category</label>
                <select
                  value={assetCategoryFilter}
                  onChange={e => setAssetCategoryFilter(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-white text-xs"
                >
                  <option value="">Revit Categories ({assets.length})</option>
                  {assetCategories.map(cat => {
                    const isMaster = categoryOptions.some(co => co.label === cat);
                    const count = assets.filter(a => a.category === cat).length;
                    return (
                      <option key={cat} value={cat}>
                        {cat}{!isMaster ? ' (extra)' : ''} {count > 0 ? `(${count})` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="flex-1">
                <label className="text-[10px] text-gray-400 block mb-1">Ifc Class</label>
                <select
                  value={assetIfcClassFilter}
                  onChange={e => setAssetIfcClassFilter(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-white text-xs"
                >
                  <option value="">Ifc Class</option>
                  {IFCCLASSES_UNIQUE.map(ic => <option key={ic} value={ic}>{ic}</option>)}
                </select>
              </div>

              {/* Sort By */}
              <div className="flex-1">
                <label className="text-[10px] text-gray-400 block mb-1">Sort By</label>
                <select
                  value={assetSortBy}
                  onChange={e => setAssetSortBy(e.target.value as 'name' | 'category' | 'location')}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-white text-xs"
                >
                  <option value="name">Name (A-Z)</option>
                  <option value="category">Category (A-Z)</option>
                  <option value="location">Location (A-Z)</option>
                </select>
              </div>

              {/* Results Count */}
              <div className="flex items-end">
                <div className="px-3 py-1.5 bg-gray-700/50 rounded text-xs text-gray-300">
                  {filteredAssets.length} asset{filteredAssets.length !== 1 ? 's' : ''}
                </div>
              </div>
            </div>

            {/* Asset List */}
            <div className="flex-1 overflow-auto">
              {assetsLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
                  <div className="text-gray-400 text-sm">Loading assets...</div>
                </div>
              ) : filteredAssets.length === 0 ? (
                <div className="text-gray-400 text-center py-8">
                  {assetSearch || assetCategoryFilter ? 'No assets match your filters' : 'No assets in register'}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredAssets.map(asset => (
                    <div
                      key={asset.id}
                      onClick={() => selectAsset(asset)}
                      className="bg-gray-700/50 hover:bg-gray-700 rounded p-3 cursor-pointer transition"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-semibold text-white">
                            {asset.assetName || asset.assetCode || `Asset ${asset.id}`}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            {asset.assetCode && <span className="mr-3">Code: <span className="text-blue-300">{asset.assetCode}</span></span>}
                            {asset.category && <span className="mr-3">Category: <span className="text-emerald-300">{asset.category}</span></span>}
                            {asset.type && <span className="mr-3">Type: <span className="text-purple-300">{asset.type}</span></span>}
                          </div>
                          {asset.brand && (
                            <div className="text-xs text-gray-500 mt-1">Brand: {asset.brand}</div>
                          )}
                          {asset.location && (
                            <div className="text-xs text-gray-500 mt-1">Location: {asset.location}</div>
                          )}
                        </div>
                        <div className="ml-2">
                          <span className={`text-xs px-2 py-1 rounded ${asset.source === 'BIM_MODEL' ? 'bg-blue-600/30 text-blue-300' : 'bg-green-600/30 text-green-300'
                            }`}>
                            {asset.source === 'BIM_MODEL' ? 'BIM' : 'Manual'}
                          </span>
                        </div>
                      </div>
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
                    <td className="px-2 py-1.5 text-gray-500">{r.category || '-'}</td>
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
const PlannedMaintenance: React.FC<{ projectId?: string; }> = ({ projectId }) => {
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
          <div className="sticky top-0 bg-gray-900/80 border border-gray-700 rounded-t-lg mb-0">
            <div className="grid grid-cols-12 gap-2 px-3 py-2.5 text-xs font-semibold text-gray-300 border-b border-gray-700">
              <div className="col-span-1">Actions</div>
              <div className="col-span-2">Discipline</div>
              <div className="col-span-2">Category</div>
              <div className="col-span-1">Asset Type</div>
              <div className="col-span-1">Code</div>
              <div className="col-span-2">Asset</div>
              <div className="col-span-1">Level</div>
              <div className="col-span-1">Room</div>
              <div className="col-span-1">Frequency</div>
              <div className="col-span-1">Time</div>
            </div>
          </div>

          {/* Table Rows */}
          <div className="space-y-0 border border-gray-700 border-t-0 rounded-b-lg overflow-hidden bg-gray-800/20">
            {scheduled.map((item, idx) => (
              <div
                key={item.id}
                className={`grid grid-cols-12 gap-2 px-3 py-2.5 items-center border-b border-gray-700/50 hover:bg-gray-700/20 transition-colors ${
                  idx === scheduled.length - 1 ? 'border-b-0' : ''
                }`}
              >
                {/* Action Buttons */}
                <div className="col-span-1 flex gap-1 justify-start">
                  <button
                    onClick={() => beginEditAsset(item)}
                    className="p-1.5 rounded bg-blue-600/80 hover:bg-blue-500 text-white transition-colors"
                    title="Edit asset information"
                  >
                    <Wrench size={14} />
                  </button>
                  <button
                    onClick={() => beginEditTasks(item)}
                    className="p-1.5 rounded bg-green-600/80 hover:bg-green-500 text-white transition-colors"
                    title="Edit maintenance tasks"
                  >
                    <ClipboardList size={14} />
                  </button>
                  <button
                    onClick={() => openHistory(item)}
                    className="p-1.5 rounded bg-purple-600/80 hover:bg-purple-500 text-white transition-colors"
                    title="View maintenance history"
                  >
                    <CalendarClock size={14} />
                  </button>
                </div>

                {/* Discipline */}
                <div className="col-span-2 text-xs text-gray-200 truncate">
                  {item.discipline || '—'}
                </div>

                {/* Category */}
                <div className="col-span-2 text-xs text-gray-300 truncate">
                  {item.category || '—'}
                </div>

                {/* Asset Type */}
                <div className="col-span-1 text-xs text-gray-300 truncate">
                  {item.category?.split('/')[0].trim() || '—'}
                </div>

                {/* Code */}
                <div className="col-span-1 text-xs text-blue-300 font-mono truncate">
                  {item.code || '—'}
                </div>

                {/* Asset */}
                <div className="col-span-2 text-xs text-gray-300 truncate">
                  {Array.isArray(item.asset) ? item.asset.slice(0, 2).join(', ') + (item.asset.length > 2 ? '...' : '') : item.asset || '—'}
                </div>

                {/* Level */}
                <div className="col-span-1 text-xs text-gray-400">
                  —
                </div>

                {/* Room */}
                <div className="col-span-1 text-xs text-gray-400">
                  —
                </div>

                {/* Frequency */}
                <div className="col-span-1 text-xs text-emerald-300">
                  {item.frequency}/yr
                </div>

                {/* Time */}
                <div className="col-span-1 text-xs text-emerald-300">
                  {item.timeHours}h
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
