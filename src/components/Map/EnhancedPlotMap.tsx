import React, { useRef, useEffect, useState, useCallback } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap, useMapEvents } from 'react-leaflet';
import { LatLngBounds, Layer } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { PlotService } from '../../services/plotService';
import { PlotWithGeometry } from '../../types/database';
import { usePlotRealtime } from '../../hooks/useRealtime';
import { PlotPopup } from './PlotPopup';
import { MapControls } from './MapControls';
import { PlotFilters } from './PlotFilters';
import { LoadingSpinner } from '../UI/LoadingSpinner';

interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

interface PlotFilters {
  status: string[];
  landUse: string[];
  minPrice?: number;
  maxPrice?: number;
  minArea?: number;
  maxArea?: number;
  searchTerm?: string;
}

const MapController: React.FC<{ 
  plots: PlotWithGeometry[];
  onBoundsChange: (bounds: MapBounds) => void;
}> = ({ plots, onBoundsChange }) => {
  const map = useMap();
  
  useEffect(() => {
    if (plots.length > 0) {
      const coordinates = plots
        .filter(plot => plot.centroid_geojson)
        .map(plot => {
          const coords = plot.centroid_geojson.coordinates;
          return [coords[1], coords[0]] as [number, number];
        });

      if (coordinates.length > 0) {
        const bounds = new LatLngBounds(coordinates);
        map.fitBounds(bounds, { padding: [20, 20] });
      }
    }
  }, [map, plots]);

  useMapEvents({
    moveend: () => {
      const bounds = map.getBounds();
      onBoundsChange({
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest()
      });
    }
  });

  return null;
};

const getPlotStyle = (plot: PlotWithGeometry) => {
  const baseStyle = {
    weight: 2,
    opacity: 0.8,
    fillOpacity: 0.3
  };

  switch (plot.status) {
    case 'available':
      return { ...baseStyle, color: '#10b981', fillColor: '#10b981' };
    case 'reserved':
      return { ...baseStyle, color: '#f59e0b', fillColor: '#f59e0b' };
    case 'sold':
      return { ...baseStyle, color: '#ef4444', fillColor: '#ef4444' };
    case 'pending':
      return { ...baseStyle, color: '#8b5cf6', fillColor: '#8b5cf6' };
    default:
      return { ...baseStyle, color: '#6b7280', fillColor: '#6b7280' };
  }
};

export const EnhancedPlotMap: React.FC = () => {
  const [plots, setPlots] = useState<PlotWithGeometry[]>([]);
  const [filteredPlots, setFilteredPlots] = useState<PlotWithGeometry[]>([]);
  const [selectedPlot, setSelectedPlot] = useState<PlotWithGeometry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<PlotFilters>({
    status: [],
    landUse: [],
    searchTerm: ''
  });
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);

  // Real-time updates
  usePlotRealtime(useCallback((payload) => {
    console.log('Plot update received:', payload);
    loadPlots(); // Reload plots when changes occur
  }, []));

  // Load plots
  const loadPlots = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let plotsData: PlotWithGeometry[];

      if (mapBounds) {
        // Load plots within current map bounds for better performance
        plotsData = await PlotService.getPlotsInBounds(mapBounds);
      } else {
        // Load all plots initially
        plotsData = await PlotService.getAllPlots();
      }

      setPlots(plotsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load plots');
    } finally {
      setLoading(false);
    }
  }, [mapBounds]);

  // Apply filters
  useEffect(() => {
    let filtered = [...plots];

    // Status filter
    if (filters.status.length > 0) {
      filtered = filtered.filter(plot => filters.status.includes(plot.status));
    }

    // Land use filter
    if (filters.landUse.length > 0) {
      filtered = filtered.filter(plot => 
        plot.land_use && filters.landUse.includes(plot.land_use)
      );
    }

    // Price filter
    if (filters.minPrice !== undefined) {
      filtered = filtered.filter(plot => 
        plot.price_usd && plot.price_usd >= filters.minPrice!
      );
    }

    if (filters.maxPrice !== undefined) {
      filtered = filtered.filter(plot => 
        plot.price_usd && plot.price_usd <= filters.maxPrice!
      );
    }

    // Area filter
    if (filters.minArea !== undefined) {
      filtered = filtered.filter(plot => plot.area_sqm >= filters.minArea!);
    }

    if (filters.maxArea !== undefined) {
      filtered = filtered.filter(plot => plot.area_sqm <= filters.maxArea!);
    }

    // Search filter
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(plot =>
        plot.plot_code.toLowerCase().includes(searchLower) ||
        (plot.owner_name && plot.owner_name.toLowerCase().includes(searchLower)) ||
        (plot.land_use && plot.land_use.toLowerCase().includes(searchLower)) ||
        (plot.notes && plot.notes.toLowerCase().includes(searchLower))
      );
    }

    setFilteredPlots(filtered);
  }, [plots, filters]);

  // Load plots on mount
  useEffect(() => {
    loadPlots();
  }, [loadPlots]);

  // Handle plot click
  const handlePlotClick = (plot: PlotWithGeometry) => {
    setSelectedPlot(plot);
  };

  // Handle bounds change
  const handleBoundsChange = useCallback((bounds: MapBounds) => {
    setMapBounds(bounds);
  }, []);

  if (loading && plots.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 mb-2">Failed to load map data</div>
          <div className="text-sm text-gray-600 mb-4">{error}</div>
          <button
            onClick={loadPlots}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      {/* Map Container */}
      <MapContainer
        center={[40.7133, -74.0054]}
        zoom={16}
        className="w-full h-full"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapController plots={filteredPlots} onBoundsChange={handleBoundsChange} />
        
        {/* Render plots as GeoJSON */}
        {filteredPlots.map((plot) => {
          if (!plot.geometry_geojson) return null;

          return (
            <GeoJSON
              key={plot.id}
              data={plot.geometry_geojson}
              style={() => getPlotStyle(plot)}
              eventHandlers={{
                click: () => handlePlotClick(plot),
                mouseover: (e) => {
                  const layer = e.target as Layer;
                  layer.setStyle({ weight: 3, opacity: 1 });
                },
                mouseout: (e) => {
                  const layer = e.target as Layer;
                  const style = getPlotStyle(plot);
                  layer.setStyle(style);
                }
              }}
            >
              {selectedPlot?.id === plot.id && (
                <PlotPopup 
                  plot={selectedPlot} 
                  onClose={() => setSelectedPlot(null)}
                />
              )}
            </GeoJSON>
          );
        })}
      </MapContainer>

      {/* Map Controls */}
      <MapControls 
        onRefresh={loadPlots}
        loading={loading}
        plotCount={filteredPlots.length}
        totalPlots={plots.length}
      />

      {/* Plot Filters */}
      <PlotFilters
        filters={filters}
        onFiltersChange={setFilters}
        plots={plots}
      />

      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-white rounded-lg shadow-lg p-4 z-[1000]">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Plot Status</h3>
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-green-500 rounded opacity-60"></div>
            <span className="text-xs text-gray-700">Available ({plots.filter(p => p.status === 'available').length})</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-purple-500 rounded opacity-60"></div>
            <span className="text-xs text-gray-700">Pending ({plots.filter(p => p.status === 'pending').length})</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-yellow-500 rounded opacity-60"></div>
            <span className="text-xs text-gray-700">Reserved ({plots.filter(p => p.status === 'reserved').length})</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-red-500 rounded opacity-60"></div>
            <span className="text-xs text-gray-700">Sold ({plots.filter(p => p.status === 'sold').length})</span>
          </div>
        </div>
      </div>

      {/* Loading overlay */}
      {loading && plots.length > 0 && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white rounded-lg shadow-lg px-4 py-2 z-[1000]">
          <div className="flex items-center space-x-2">
            <LoadingSpinner size="sm" />
            <span className="text-sm text-gray-600">Updating map...</span>
          </div>
        </div>
      )}
    </div>
  );
};