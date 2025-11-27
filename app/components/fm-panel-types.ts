// FM Panel Types - All interfaces and types for Facilities Management

// Extended Asset Record with all fields from asset_register_facility_manager_template_extended
export interface AssetRecord {
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

export interface SpaceRecord {
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

export interface ScheduledItem {
  id: string;
  discipline: string;
  category: string;
  code: string;
  asset: string[];
  tasks: string[];
  frequency: number;
  timeHours: number;
}

export interface TicketItem {
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

export interface WorkOrderItem {
  id: string;
  requestId?: string;
  requester?: string;
  contact?: string;
  location?: string;
  interventionDetails?: string;
  discipline?: string;
  category?: string;
  description?: string;
  attachments?: Array<{ url: string; type?: 'before'|'after'|'doc'; name?: string; uploadedAt?: string; uploadedBy?: string }>;
  asset?: string;
  responsibleTechnician?: string;
  company?: string;
  status: 'Open' | 'Planned' | 'In Progress' | 'Resolved';
  priority?: 'High' | 'Medium' | 'Low' | 'Critical';
  sourceTicketId?: string;
  comments?: Array<{ id: string; author: string; text: string; timestamp: string }>;
  createdAt?: string;
  updatedAt?: string;
  assignedAt?: string;
  resolvedAt?: string;
  diagnosis?: string;
  workPerformed?: string;
  technicalNotes?: string;
}

export type Section =
  | { group: "assets"; item: "asset-list" | "create-asset" | null }
  | { group: "spaces"; item: "space-list" | "create-space" | null }
  | { group: "maintenance"; item: "scheduled" | "ticket" | null }
  | { group: "work-orders"; item: "service-requests" | "reports" | null }
  | { group: "upcoming-activities"; item: "ongoing" | "planned" | null };

export interface FMPanelProps { 
  projectId?: string; 
  viewer?: any; 
  standalone?: boolean; 
  initialSection?: Section | null;
}

export type Maybe<T> = T | null | undefined;
