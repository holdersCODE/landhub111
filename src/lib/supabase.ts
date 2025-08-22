import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

// Spatial query helpers
export const spatialQueries = {
  // Get plots within a bounding box
  getPlotsInBounds: async (bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  }) => {
    const { data, error } = await supabase
      .rpc('get_plots_in_bounds', {
        north: bounds.north,
        south: bounds.south,
        east: bounds.east,
        west: bounds.west
      });
    
    if (error) throw error;
    return data;
  },

  // Get plots within a radius of a point
  getPlotsNearPoint: async (lat: number, lng: number, radiusKm: number) => {
    const { data, error } = await supabase
      .rpc('get_plots_near_point', {
        lat,
        lng,
        radius_km: radiusKm
      });
    
    if (error) throw error;
    return data;
  },

  // Calculate plot area
  calculatePlotArea: async (plotId: string) => {
    const { data, error } = await supabase
      .rpc('calculate_plot_area', { plot_id: plotId });
    
    if (error) throw error;
    return data;
  },

  // Get plot neighbors
  getPlotNeighbors: async (plotId: string, bufferMeters: number = 100) => {
    const { data, error } = await supabase
      .rpc('get_plot_neighbors', {
        plot_id: plotId,
        buffer_meters: bufferMeters
      });
    
    if (error) throw error;
    return data;
  }
};

// Transaction helpers
export const transactionHelpers = {
  // Create order with plot status update
  createOrderWithTransaction: async (orderData: {
    plot_id: string;
    user_id: string;
    order_type: string;
    requested_price?: number;
    purpose?: string;
    notes?: string;
  }) => {
    const { data, error } = await supabase
      .rpc('create_order_transaction', orderData);
    
    if (error) throw error;
    return data;
  },

  // Approve order with plot status update
  approveOrderWithTransaction: async (orderId: string, approvedPrice?: number) => {
    const { data, error } = await supabase
      .rpc('approve_order_transaction', {
        order_id: orderId,
        approved_price: approvedPrice
      });
    
    if (error) throw error;
    return data;
  },

  // Bulk import plots from shapefile data
  bulkImportPlots: async (plotsData: any[], importId: string) => {
    const { data, error } = await supabase
      .rpc('bulk_import_plots', {
        plots_data: plotsData,
        import_id: importId
      });
    
    if (error) throw error;
    return data;
  }
};

// Real-time subscriptions
export const subscriptions = {
  // Subscribe to plot changes
  subscribePlotChanges: (callback: (payload: any) => void) => {
    return supabase
      .channel('plots_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'plots' }, 
        callback
      )
      .subscribe();
  },

  // Subscribe to order changes for a user
  subscribeUserOrders: (userId: string, callback: (payload: any) => void) => {
    return supabase
      .channel(`user_orders_${userId}`)
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'orders',
          filter: `user_id=eq.${userId}`
        }, 
        callback
      )
      .subscribe();
  },

  // Subscribe to admin order changes
  subscribeAllOrders: (callback: (payload: any) => void) => {
    return supabase
      .channel('all_orders')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'orders' }, 
        callback
      )
      .subscribe();
  }
};

// Error handling helper
export const handleSupabaseError = (error: any) => {
  console.error('Supabase error:', error);
  
  if (error.code === 'PGRST116') {
    return 'No data found';
  } else if (error.code === '23505') {
    return 'This record already exists';
  } else if (error.code === '23503') {
    return 'Referenced record not found';
  } else if (error.code === '42501') {
    return 'Permission denied';
  }
  
  return error.message || 'An unexpected error occurred';
};