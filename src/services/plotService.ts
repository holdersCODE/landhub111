import { supabase, spatialQueries, transactionHelpers, handleSupabaseError } from '../lib/supabase';
import { Database, PlotWithGeometry, OrderWithDetails } from '../types/database';
import * as turf from '@turf/turf';

type Plot = Database['public']['Tables']['plots']['Row'];
type PlotInsert = Database['public']['Tables']['plots']['Insert'];
type PlotUpdate = Database['public']['Tables']['plots']['Update'];

export class PlotService {
  // Get all plots with spatial data
  static async getAllPlots(): Promise<PlotWithGeometry[]> {
    try {
      const { data, error } = await supabase
        .from('plots')
        .select(`
          *,
          plot_attributes (
            attribute_name,
            attribute_value,
            data_type
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Convert PostGIS geometry to GeoJSON for frontend use
      return data.map(plot => ({
        ...plot,
        geometry_geojson: plot.geometry ? JSON.parse(plot.geometry) : null,
        centroid_geojson: plot.centroid ? JSON.parse(plot.centroid) : null
      }));
    } catch (error) {
      throw new Error(handleSupabaseError(error));
    }
  }

  // Get plots within map bounds
  static async getPlotsInBounds(bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  }): Promise<PlotWithGeometry[]> {
    try {
      const data = await spatialQueries.getPlotsInBounds(bounds);
      return data;
    } catch (error) {
      throw new Error(handleSupabaseError(error));
    }
  }

  // Get plot by ID with full details
  static async getPlotById(id: string): Promise<PlotWithGeometry | null> {
    try {
      const { data, error } = await supabase
        .from('plots')
        .select(`
          *,
          plot_attributes (
            attribute_name,
            attribute_value,
            data_type,
            source_column
          ),
          orders (
            id,
            order_number,
            status,
            created_at,
            user_id
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      return {
        ...data,
        geometry_geojson: data.geometry ? JSON.parse(data.geometry) : null,
        centroid_geojson: data.centroid ? JSON.parse(data.centroid) : null
      };
    } catch (error) {
      throw new Error(handleSupabaseError(error));
    }
  }

  // Search plots with filters
  static async searchPlots(filters: {
    status?: string[];
    landUse?: string[];
    minPrice?: number;
    maxPrice?: number;
    minArea?: number;
    maxArea?: number;
    searchTerm?: string;
  }): Promise<PlotWithGeometry[]> {
    try {
      let query = supabase
        .from('plots')
        .select('*');

      // Apply filters
      if (filters.status && filters.status.length > 0) {
        query = query.in('status', filters.status);
      }

      if (filters.landUse && filters.landUse.length > 0) {
        query = query.in('land_use', filters.landUse);
      }

      if (filters.minPrice !== undefined) {
        query = query.gte('price_usd', filters.minPrice);
      }

      if (filters.maxPrice !== undefined) {
        query = query.lte('price_usd', filters.maxPrice);
      }

      if (filters.minArea !== undefined) {
        query = query.gte('area_sqm', filters.minArea);
      }

      if (filters.maxArea !== undefined) {
        query = query.lte('area_sqm', filters.maxArea);
      }

      if (filters.searchTerm) {
        query = query.or(`plot_code.ilike.%${filters.searchTerm}%,owner_name.ilike.%${filters.searchTerm}%,notes.ilike.%${filters.searchTerm}%`);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      return data.map(plot => ({
        ...plot,
        geometry_geojson: plot.geometry ? JSON.parse(plot.geometry) : null,
        centroid_geojson: plot.centroid ? JSON.parse(plot.centroid) : null
      }));
    } catch (error) {
      throw new Error(handleSupabaseError(error));
    }
  }

  // Create new plot
  static async createPlot(plotData: PlotInsert): Promise<Plot> {
    try {
      const { data, error } = await supabase
        .from('plots')
        .insert(plotData)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw new Error(handleSupabaseError(error));
    }
  }

  // Update plot
  static async updatePlot(id: string, updates: PlotUpdate): Promise<Plot> {
    try {
      const { data, error } = await supabase
        .from('plots')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw new Error(handleSupabaseError(error));
    }
  }

  // Delete plot
  static async deletePlot(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('plots')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      throw new Error(handleSupabaseError(error));
    }
  }

  // Get plot statistics
  static async getPlotStatistics() {
    try {
      const { data, error } = await supabase
        .from('plot_statistics')
        .select('*')
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw new Error(handleSupabaseError(error));
    }
  }

  // Get plots near a point
  static async getPlotsNearPoint(
    lat: number, 
    lng: number, 
    radiusKm: number = 1
  ): Promise<PlotWithGeometry[]> {
    try {
      const data = await spatialQueries.getPlotsNearPoint(lat, lng, radiusKm);
      return data;
    } catch (error) {
      throw new Error(handleSupabaseError(error));
    }
  }

  // Get plot neighbors
  static async getPlotNeighbors(
    plotId: string, 
    bufferMeters: number = 100
  ): Promise<PlotWithGeometry[]> {
    try {
      const data = await spatialQueries.getPlotNeighbors(plotId, bufferMeters);
      return data;
    } catch (error) {
      throw new Error(handleSupabaseError(error));
    }
  }

  // Calculate plot area
  static async calculatePlotArea(plotId: string): Promise<number> {
    try {
      const area = await spatialQueries.calculatePlotArea(plotId);
      return area;
    } catch (error) {
      throw new Error(handleSupabaseError(error));
    }
  }

  // Validate plot geometry using Turf.js
  static validatePlotGeometry(geometry: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      // Check if it's a valid GeoJSON
      if (!geometry || geometry.type !== 'Polygon') {
        errors.push('Geometry must be a valid Polygon');
        return { isValid: false, errors };
      }

      // Create Turf polygon
      const polygon = turf.polygon(geometry.coordinates);

      // Check if polygon is valid
      if (!turf.booleanValid(polygon)) {
        errors.push('Invalid polygon geometry');
      }

      // Check for self-intersections
      const kinks = turf.kinks(polygon);
      if (kinks.features.length > 0) {
        errors.push('Polygon has self-intersections');
      }

      // Check area (should be reasonable)
      const area = turf.area(polygon);
      if (area < 1) {
        errors.push('Plot area is too small (< 1 sq meter)');
      }
      if (area > 10000000) { // 10 sq km
        errors.push('Plot area is too large (> 10 sq km)');
      }

      return { isValid: errors.length === 0, errors };
    } catch (error) {
      errors.push('Invalid geometry format');
      return { isValid: false, errors };
    }
  }

  // Bulk update plot statuses
  static async bulkUpdatePlotStatus(
    plotIds: string[], 
    status: 'available' | 'reserved' | 'sold' | 'pending'
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('plots')
        .update({ status, updated_at: new Date().toISOString() })
        .in('id', plotIds);

      if (error) throw error;
    } catch (error) {
      throw new Error(handleSupabaseError(error));
    }
  }

  // Get available land use types
  static async getLandUseTypes(): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from('plots')
        .select('land_use')
        .not('land_use', 'is', null);

      if (error) throw error;

      const uniqueTypes = [...new Set(data.map(item => item.land_use).filter(Boolean))];
      return uniqueTypes.sort();
    } catch (error) {
      throw new Error(handleSupabaseError(error));
    }
  }

  // Get price range
  static async getPriceRange(): Promise<{ min: number; max: number }> {
    try {
      const { data, error } = await supabase
        .from('plots')
        .select('price_usd')
        .not('price_usd', 'is', null)
        .order('price_usd', { ascending: true });

      if (error) throw error;

      if (data.length === 0) {
        return { min: 0, max: 0 };
      }

      return {
        min: data[0].price_usd || 0,
        max: data[data.length - 1].price_usd || 0
      };
    } catch (error) {
      throw new Error(handleSupabaseError(error));
    }
  }
}