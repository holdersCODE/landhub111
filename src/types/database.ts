export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string;
          name: string;
          role: 'admin' | 'user';
          phone?: string;
          address?: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name: string;
          role?: 'admin' | 'user';
          phone?: string;
          address?: string;
        };
        Update: {
          name?: string;
          role?: 'admin' | 'user';
          phone?: string;
          address?: string;
        };
      };
      plots: {
        Row: {
          id: string;
          plot_code: string;
          geometry: any; // PostGIS geometry
          centroid: any; // PostGIS point
          area_sqm: number;
          perimeter_m?: number;
          land_use?: string;
          status: 'available' | 'reserved' | 'sold' | 'pending';
          owner_name?: string;
          title_deed?: string;
          zone_classification?: string;
          soil_type?: string;
          elevation?: number;
          slope_percentage?: number;
          access_road: boolean;
          utilities: any; // JSON
          price_usd?: number;
          price_per_sqm?: number;
          valuation_date?: string;
          notes?: string;
          import_id?: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          plot_code: string;
          geometry: any;
          area_sqm: number;
          perimeter_m?: number;
          land_use?: string;
          status?: 'available' | 'reserved' | 'sold' | 'pending';
          owner_name?: string;
          title_deed?: string;
          zone_classification?: string;
          soil_type?: string;
          elevation?: number;
          slope_percentage?: number;
          access_road?: boolean;
          utilities?: any;
          price_usd?: number;
          price_per_sqm?: number;
          valuation_date?: string;
          notes?: string;
          import_id?: string;
        };
        Update: {
          plot_code?: string;
          geometry?: any;
          area_sqm?: number;
          perimeter_m?: number;
          land_use?: string;
          status?: 'available' | 'reserved' | 'sold' | 'pending';
          owner_name?: string;
          title_deed?: string;
          zone_classification?: string;
          soil_type?: string;
          elevation?: number;
          slope_percentage?: number;
          access_road?: boolean;
          utilities?: any;
          price_usd?: number;
          price_per_sqm?: number;
          valuation_date?: string;
          notes?: string;
        };
      };
      orders: {
        Row: {
          id: string;
          order_number: string;
          user_id: string;
          plot_id: string;
          status: 'pending' | 'approved' | 'rejected' | 'cancelled';
          order_type: string;
          requested_price?: number;
          approved_price?: number;
          payment_terms?: string;
          payment_status: string;
          payment_due_date?: string;
          contract_start_date?: string;
          contract_end_date?: string;
          purpose?: string;
          notes?: string;
          admin_notes?: string;
          approved_by?: string;
          approved_at?: string;
          rejected_reason?: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          plot_id: string;
          order_type?: string;
          requested_price?: number;
          payment_terms?: string;
          payment_due_date?: string;
          contract_start_date?: string;
          contract_end_date?: string;
          purpose?: string;
          notes?: string;
        };
        Update: {
          status?: 'pending' | 'approved' | 'rejected' | 'cancelled';
          approved_price?: number;
          payment_terms?: string;
          payment_status?: string;
          payment_due_date?: string;
          contract_start_date?: string;
          contract_end_date?: string;
          admin_notes?: string;
          approved_by?: string;
          approved_at?: string;
          rejected_reason?: string;
        };
      };
      shapefile_imports: {
        Row: {
          id: string;
          filename: string;
          original_filename: string;
          uploaded_by?: string;
          upload_date: string;
          status: 'processing' | 'completed' | 'failed';
          plots_count: number;
          file_size?: number;
          projection?: string;
          bounds?: any;
          metadata: any;
          error_message?: string;
          created_at: string;
        };
        Insert: {
          filename: string;
          original_filename: string;
          uploaded_by?: string;
          file_size?: number;
          projection?: string;
          bounds?: any;
          metadata?: any;
        };
        Update: {
          status?: 'processing' | 'completed' | 'failed';
          plots_count?: number;
          error_message?: string;
        };
      };
      plot_attributes: {
        Row: {
          id: string;
          plot_id: string;
          attribute_name: string;
          attribute_value?: string;
          data_type?: string;
          source_column?: string;
          created_at: string;
        };
        Insert: {
          plot_id: string;
          attribute_name: string;
          attribute_value?: string;
          data_type?: string;
          source_column?: string;
        };
        Update: {
          attribute_value?: string;
          data_type?: string;
        };
      };
      spatial_layers: {
        Row: {
          id: string;
          name: string;
          description?: string;
          layer_type?: string;
          style_config: any;
          is_active: boolean;
          display_order: number;
          created_at: string;
        };
        Insert: {
          name: string;
          description?: string;
          layer_type?: string;
          style_config?: any;
          is_active?: boolean;
          display_order?: number;
        };
        Update: {
          name?: string;
          description?: string;
          layer_type?: string;
          style_config?: any;
          is_active?: boolean;
          display_order?: number;
        };
      };
    };
    Views: {
      plot_statistics: {
        Row: {
          total_plots: number;
          available_plots: number;
          reserved_plots: number;
          sold_plots: number;
          total_area_sqm: number;
          avg_price_usd: number;
          min_price_usd: number;
          max_price_usd: number;
        };
      };
      order_statistics: {
        Row: {
          total_orders: number;
          pending_orders: number;
          approved_orders: number;
          rejected_orders: number;
          avg_requested_price: number;
          total_approved_value: number;
        };
      };
    };
    Functions: {
      get_plots_in_bounds: {
        Args: {
          north: number;
          south: number;
          east: number;
          west: number;
        };
        Returns: any[];
      };
      get_plots_near_point: {
        Args: {
          lat: number;
          lng: number;
          radius_km: number;
        };
        Returns: any[];
      };
      calculate_plot_area: {
        Args: {
          plot_id: string;
        };
        Returns: number;
      };
      get_plot_neighbors: {
        Args: {
          plot_id: string;
          buffer_meters: number;
        };
        Returns: any[];
      };
      create_order_transaction: {
        Args: {
          plot_id: string;
          user_id: string;
          order_type: string;
          requested_price?: number;
          purpose?: string;
          notes?: string;
        };
        Returns: any;
      };
      approve_order_transaction: {
        Args: {
          order_id: string;
          approved_price?: number;
        };
        Returns: any;
      };
      bulk_import_plots: {
        Args: {
          plots_data: any[];
          import_id: string;
        };
        Returns: any;
      };
    };
  };
}

// Extended types for the application
export interface PlotWithGeometry extends Database['public']['Tables']['plots']['Row'] {
  geometry_geojson?: any;
  centroid_geojson?: any;
  distance_km?: number;
}

export interface OrderWithDetails extends Database['public']['Tables']['orders']['Row'] {
  plot?: Database['public']['Tables']['plots']['Row'];
  user_profile?: Database['public']['Tables']['user_profiles']['Row'];
}

export interface ShapefileImportWithStats extends Database['public']['Tables']['shapefile_imports']['Row'] {
  uploader?: Database['public']['Tables']['user_profiles']['Row'];
}