export type Discipline =
  | 'architecture'
  | 'structure'
  | 'mep'
  | 'electrical'
  | 'plumbing'
  | 'hvac'
  | 'other';

export interface ModelTransform {
  tx?: number; // translation x (meters)
  ty?: number; // translation y (meters)
  tz?: number; // translation z (meters)
  rx?: number; // rotation x (degrees)
  ry?: number; // rotation y (degrees)
  rz?: number; // rotation z (degrees)
  sx?: number; // scale x
  sy?: number; // scale y
  sz?: number; // scale z
}

export interface ProjectModel {
  id: string;
  name: string;
  discipline: Discipline;
  urn: string;
  fileType?: string;
  transform?: ModelTransform | null;
}

export interface ProjectDoc {
  _id: any;
  userId: any;
  name: string;
  code?: string;
  country?: string;
  municipality?: string;
  address?: string;
  cadastral?: string;
  company?: string;
  surname?: string;
  clientName?: string;
  urn?: string; // legacy primary model
  fileType?: string; // legacy primary model type
  models?: ProjectModel[]; // federated models
  location: { lat: number; lng: number };
  description?: string;
  createdAt: Date;
}
