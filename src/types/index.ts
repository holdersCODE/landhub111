export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
}

export interface Plot {
  id: string;
  plotCode: string;
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  center: [number, number];
  size: number; // in square meters
  use: string;
  status: 'available' | 'reserved' | 'sold';
  owner?: string;
  notes?: string;
  price?: number;
}

export interface Order {
  id: string;
  userId: string;
  plotId: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  updatedAt: string;
  notes?: string;
  plot?: Plot;
  user?: User;
}

export interface ShapefileImport {
  id: string;
  filename: string;
  uploadedBy: string;
  uploadedAt: string;
  plotsCount: number;
  status: 'processing' | 'completed' | 'failed';
}