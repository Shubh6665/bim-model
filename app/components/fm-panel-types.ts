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
  // QR Code fields (created once, viewable/printable)
  qrCode?: string; // Unique QR payload or identifier
  qrGeneratedAt?: string; // ISO timestamp when QR was created
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

// Ticket Priority Levels
export type TicketPriority = "Low" | "Medium" | "High" | "Critical";

// Maintenance Types
export type MaintenanceType = 
  | "Preventive"
  | "Corrective" 
  | "Predictive"
  | "Emergency"
  | "Urgent" 
  | "Safety" 
  | "Regulatory" 
  | "Inspection" 
  | "Cleaning";

// Approval Status for Tickets
export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

// Ticket Status Flow
export type TicketStatus = "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "ARCHIVED";

// Work Order Status Flow
export type WorkOrderStatus = "Open" | "Planned" | "In Progress" | "Closed" | "Resolved" | "Rejected" | "OPEN" | "PLANNED" | "IN_PROGRESS" | "CLOSE" | "RESOLVED";

// User Roles
export type UserRole = "User" | "TM" | "Maintainer" | "FM";

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
  // Approval Flow Fields
  approvalStatus?: ApprovalStatus;
  approvedBy?: string;  // TM email
  approvedAt?: string;  // ISO timestamp
  rejectionReason?: string;
  // Priority & Type (set by TM on approval)
  priority?: TicketPriority;
  type?: MaintenanceType;
  // FM Fields (can be modified by FM at any time)
  fmFields?: {
    priority?: TicketPriority;
    type?: MaintenanceType;
    lastModifiedBy?: string;  // FM email
    lastModifiedAt?: string;  // ISO timestamp
  };
  status?: TicketStatus;
  createdAt?: string;
  updatedAt?: string;
}

// Maintenance Cycle (for tracking PLANNED → IN_PROGRESS → CLOSE)
export interface MaintenanceCycle {
  cycleNumber: number;
  status: WorkOrderStatus;  // PLANNED, IN_PROGRESS, CLOSE
  startedBy: string;  // email
  startedByRole: UserRole;
  startedAt: string;  // ISO timestamp
  endedAt?: string;  // ISO timestamp when cycle ended
  performedBy?: string;  // email of who performed/executed this cycle
  plannedAt?: string;
  plannedBy?: string;
  inProgressAt?: string;
  inProgressBy?: string;
  closedAt?: string;
  closedBy?: string;
  notes: Array<{
    id: string;
    author: string;
    authorRole: UserRole;
    text: string;
    timestamp: string;
    attachments?: string[];
  }>;
  duration?: number;  // minutes (from PLANNED to CLOSE)
}

export interface WorkOrderItem {
  _id?: string;  // MongoDB _id
  id: string;
  ticketId?: string;  // Reference to original ticket
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
  facilityManager?: string; // TM/FM who approved/manages this
  status: WorkOrderStatus | string;
  priority?: TicketPriority;
  maintenanceType?: MaintenanceType;  // Added maintenance type
  type?: MaintenanceType;
  sourceTicketId?: string;
  ticketStatus?: string; // Added to sync rejection status
  maintenanceCycles?: MaintenanceCycle[];
  currentCycle?: number;  // Current cycle number
  
  // TM Closing Fields
  tmClosingNotes?: string;
  resolvedBy?: string;  // TM email
  resolvedAt?: string;  // ISO timestamp
  
  // FM Integration Request
  integrationRequested?: boolean;
  integrationRequestedBy?: string;  // FM email
  integrationRequestedAt?: string;  // ISO timestamp
  integrationReason?: string;
  
  // FM Resolution Confirmation
  resolutionConfirmed?: boolean;
  resolutionConfirmedBy?: string;
  resolutionConfirmedAt?: string;

  // Calculated Fields
  totalTimeSpent?: number;  // minutes (sum of all cycle durations)
  totalTimeToResolve?: number;  // minutes (from creation to RESOLVED)
  
  // Timestamps
  createdAt?: string;
  updatedAt?: string;
  assignedAt?: string;
  
  // Report Fields
  diagnosis?: string;
  workPerformed?: string;
  technicalNotes?: string;

  assignedTechnicians?: Array<{
    name: string;
    surname?: string;
    email: string;
    company?: string;
    assignedAt: string;
  }>;

  // Additional Report Fields
  comments?: any[];
  interventionOutcome?: string;
  assetCondition?: string;
  nextPlannedActions?: string;
  materials?: string;
  timeSpent?: string;
  additionalTechnicians?: string;
  complianceCompleted?: boolean;
  ppe?: string;
  techSignature?: string;
  clientSignature?: string;
  closureDate?: string;
  additionalComments?: string;
}

// Activity Log Action Types
export type ActivityAction = 
  | "TICKET_CREATED"
  | "TICKET_APPROVED" 
  | "TICKET_REJECTED"
  | "STATUS_CHANGE"
  | "PRIORITY_CHANGE"
  | "TYPE_CHANGE"
  | "TECHNICIAN_ASSIGNED"
  | "NOTE_ADDED"
  | "ATTACHMENT_ADDED"
  | "TM_CLOSED"
  | "TM_RESOLVED"
  | "FM_INTEGRATION_REQUESTED"
  | "FM_FIELD_UPDATED"
  | "REPORT_UPDATED";

// Activity Log Entry
export interface ActivityLogEntry {
  id: string;
  ticketId?: string;
  workOrderId?: string;
  projectId: string;
  author: string;  // email
  authorRole: UserRole;
  action: ActivityAction;
  fieldChanged?: string;
  oldValue?: string;
  newValue?: string;
  notes?: string;
  timestamp: string;  // ISO timestamp
  metadata?: Record<string, any>;
}

export type Section =
  | { group: "assets"; item: "asset-list" | "create-asset" | null }
  | { group: "spaces"; item: "space-list" | "create-space" | null }
  | { group: "maintenance"; item: "scheduled" | "ticket" | null }
  | { group: "work-orders"; item: "pending-approvals" | "service-requests" | "reports" | "fm-editor" | null }
  | { group: "upcoming-activities"; item: "ongoing" | "planned" | "archived" | null };

export interface FMPanelProps { 
  projectId?: string; 
  viewer?: any; 
  standalone?: boolean; 
  initialSection?: Section | null;
}

export type Maybe<T> = T | null | undefined;
