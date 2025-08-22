import { supabase, transactionHelpers, handleSupabaseError } from '../lib/supabase';
import { Database } from '../types/database';
import JSZip from 'jszip';
import * as turf from '@turf/turf';

type ShapefileImport = Database['public']['Tables']['shapefile_imports']['Row'];
type ShapefileImportInsert = Database['public']['Tables']['shapefile_imports']['Insert'];

interface ShapefileData {
  features: any[];
  projection?: string;
  bounds?: any;
  metadata?: any;
}

interface ParsedPlotData {
  plot_code: string;
  geometry: any;
  area_sqm: number;
  land_use?: string;
  owner_name?: string;
  price_usd?: number;
  notes?: string;
  attributes?: { [key: string]: any };
}

export class ShapefileService {
  // Upload and process shapefile
  static async uploadShapefile(
    file: File,
    userId: string
  ): Promise<{ importId: string; message: string }> {
    try {
      // Create import record
      const importData: ShapefileImportInsert = {
        filename: `${Date.now()}_${file.name}`,
        original_filename: file.name,
        uploaded_by: userId,
        file_size: file.size,
        status: 'processing'
      };

      const { data: importRecord, error: importError } = await supabase
        .from('shapefile_imports')
        .insert(importData)
        .select()
        .single();

      if (importError) throw importError;

      // Process the shapefile
      try {
        const shapefileData = await this.parseShapefileFromZip(file);
        const plotsData = await this.convertToPlotData(shapefileData);

        // Import plots using transaction
        const result = await transactionHelpers.bulkImportPlots(
          plotsData,
          importRecord.id
        );

        return {
          importId: importRecord.id,
          message: `Successfully imported ${result.imported_count} plots`
        };
      } catch (processingError) {
        // Update import record with error
        await supabase
          .from('shapefile_imports')
          .update({
            status: 'failed',
            error_message: processingError instanceof Error ? processingError.message : 'Processing failed'
          })
          .eq('id', importRecord.id);

        throw processingError;
      }
    } catch (error) {
      throw new Error(handleSupabaseError(error));
    }
  }

  // Parse shapefile from ZIP
  private static async parseShapefileFromZip(file: File): Promise<ShapefileData> {
    try {
      const zip = await JSZip.loadAsync(file);
      const files = zip.files;

      // Check for required files
      const shpFile = Object.keys(files).find(name => name.toLowerCase().endsWith('.shp'));
      const dbfFile = Object.keys(files).find(name => name.toLowerCase().endsWith('.dbf'));
      const prjFile = Object.keys(files).find(name => name.toLowerCase().endsWith('.prj'));

      if (!shpFile || !dbfFile) {
        throw new Error('Shapefile must contain .shp and .dbf files');
      }

      // For now, we'll simulate shapefile parsing
      // In a real implementation, you would use a library like shapefile-js
      // or process this on the server side with GDAL/OGR
      
      const mockFeatures = await this.generateMockFeaturesFromFile(file);
      
      return {
        features: mockFeatures,
        projection: prjFile ? 'EPSG:4326' : undefined,
        bounds: this.calculateBounds(mockFeatures),
        metadata: {
          fileCount: Object.keys(files).length,
          hasProjection: !!prjFile
        }
      };
    } catch (error) {
      throw new Error(`Failed to parse shapefile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Generate mock features for demonstration
  private static async generateMockFeaturesFromFile(file: File): Promise<any[]> {
    // This is a mock implementation
    // In production, you would parse the actual shapefile
    const baseCoords = [-74.006, 40.7128]; // NYC coordinates
    const features = [];

    for (let i = 0; i < 10; i++) {
      const offsetLat = (Math.random() - 0.5) * 0.01;
      const offsetLng = (Math.random() - 0.5) * 0.01;
      
      const polygon = turf.polygon([[
        [baseCoords[0] + offsetLng, baseCoords[1] + offsetLat],
        [baseCoords[0] + offsetLng + 0.001, baseCoords[1] + offsetLat],
        [baseCoords[0] + offsetLng + 0.001, baseCoords[1] + offsetLat + 0.001],
        [baseCoords[0] + offsetLng, baseCoords[1] + offsetLat + 0.001],
        [baseCoords[0] + offsetLng, baseCoords[1] + offsetLat]
      ]]);

      features.push({
        type: 'Feature',
        geometry: polygon.geometry,
        properties: {
          PLOT_CODE: `LP${String(i + 1).padStart(3, '0')}`,
          LAND_USE: ['Residential', 'Commercial', 'Agricultural', 'Industrial'][Math.floor(Math.random() * 4)],
          OWNER: `Owner ${i + 1}`,
          AREA_SQM: Math.floor(Math.random() * 2000) + 500,
          PRICE_USD: Math.floor(Math.random() * 200000) + 50000
        }
      });
    }

    return features;
  }

  // Convert shapefile data to plot data
  private static async convertToPlotData(shapefileData: ShapefileData): Promise<ParsedPlotData[]> {
    const plotsData: ParsedPlotData[] = [];

    for (const feature of shapefileData.features) {
      try {
        const geometry = feature.geometry;
        const properties = feature.properties || {};

        // Calculate area using Turf.js
        const area = turf.area(feature);

        // Map common property names
        const plotData: ParsedPlotData = {
          plot_code: properties.PLOT_CODE || properties.plot_code || properties.ID || `PLOT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          geometry: JSON.stringify(geometry),
          area_sqm: area,
          land_use: properties.LAND_USE || properties.land_use || properties.USE || properties.TYPE,
          owner_name: properties.OWNER || properties.owner || properties.OWNER_NAME,
          price_usd: properties.PRICE_USD || properties.price || properties.VALUE,
          notes: properties.NOTES || properties.notes || properties.REMARKS,
          attributes: properties
        };

        // Validate geometry
        const validation = this.validateGeometry(geometry);
        if (!validation.isValid) {
          console.warn(`Skipping invalid plot ${plotData.plot_code}: ${validation.errors.join(', ')}`);
          continue;
        }

        plotsData.push(plotData);
      } catch (error) {
        console.error('Error processing feature:', error);
        continue;
      }
    }

    return plotsData;
  }

  // Calculate bounds from features
  private static calculateBounds(features: any[]): any {
    if (features.length === 0) return null;

    const collection = turf.featureCollection(features);
    const bbox = turf.bbox(collection);
    
    // Convert bbox to polygon
    return turf.bboxPolygon(bbox).geometry;
  }

  // Validate geometry
  private static validateGeometry(geometry: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      if (!geometry || geometry.type !== 'Polygon') {
        errors.push('Geometry must be a Polygon');
        return { isValid: false, errors };
      }

      const polygon = turf.polygon(geometry.coordinates);
      
      // Check if valid
      if (!turf.booleanValid(polygon)) {
        errors.push('Invalid polygon geometry');
      }

      // Check for self-intersections
      const kinks = turf.kinks(polygon);
      if (kinks.features.length > 0) {
        errors.push('Polygon has self-intersections');
      }

      // Check area
      const area = turf.area(polygon);
      if (area < 1) {
        errors.push('Area too small');
      }
      if (area > 10000000) {
        errors.push('Area too large');
      }

      return { isValid: errors.length === 0, errors };
    } catch (error) {
      errors.push('Invalid geometry format');
      return { isValid: false, errors };
    }
  }

  // Get all shapefile imports
  static async getShapefileImports(): Promise<ShapefileImport[]> {
    try {
      const { data, error } = await supabase
        .from('shapefile_imports')
        .select(`
          *,
          user_profiles (
            name
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    } catch (error) {
      throw new Error(handleSupabaseError(error));
    }
  }

  // Get shapefile import by ID
  static async getShapefileImportById(id: string): Promise<ShapefileImport | null> {
    try {
      const { data, error } = await supabase
        .from('shapefile_imports')
        .select(`
          *,
          user_profiles (
            name
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw new Error(handleSupabaseError(error));
    }
  }

  // Delete shapefile import and associated plots
  static async deleteShapefileImport(id: string): Promise<void> {
    try {
      // First delete associated plots
      const { error: plotsError } = await supabase
        .from('plots')
        .delete()
        .eq('import_id', id);

      if (plotsError) throw plotsError;

      // Then delete the import record
      const { error: importError } = await supabase
        .from('shapefile_imports')
        .delete()
        .eq('id', id);

      if (importError) throw importError;
    } catch (error) {
      throw new Error(handleSupabaseError(error));
    }
  }

  // Get supported file formats
  static getSupportedFormats(): string[] {
    return [
      '.zip', // Shapefile package
      '.shp', // Individual shapefile components
      '.shx',
      '.dbf',
      '.prj',
      '.cpg'
    ];
  }

  // Validate file before upload
  static validateFile(file: File): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const maxSize = 50 * 1024 * 1024; // 50MB

    // Check file size
    if (file.size > maxSize) {
      errors.push('File size exceeds 50MB limit');
    }

    // Check file extension
    const extension = file.name.toLowerCase().split('.').pop();
    const supportedFormats = this.getSupportedFormats().map(f => f.replace('.', ''));
    
    if (!extension || !supportedFormats.includes(extension)) {
      errors.push('Unsupported file format. Please upload a ZIP file containing shapefile components.');
    }

    return { isValid: errors.length === 0, errors };
  }

  // Get import statistics
  static async getImportStatistics() {
    try {
      const { data, error } = await supabase
        .from('shapefile_imports')
        .select('status, plots_count, created_at');

      if (error) throw error;

      const stats = {
        total_imports: data.length,
        successful_imports: data.filter(i => i.status === 'completed').length,
        failed_imports: data.filter(i => i.status === 'failed').length,
        processing_imports: data.filter(i => i.status === 'processing').length,
        total_plots_imported: data.reduce((sum, i) => sum + (i.plots_count || 0), 0),
        recent_imports: data.filter(i => {
          const importDate = new Date(i.created_at);
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          return importDate > weekAgo;
        }).length
      };

      return stats;
    } catch (error) {
      throw new Error(handleSupabaseError(error));
    }
  }
}