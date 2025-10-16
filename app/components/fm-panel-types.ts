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

export type Maybe<T> = T | null | undefined;
