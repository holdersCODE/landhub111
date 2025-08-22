import React, { useRef, useEffect } from 'react';
import { MapContainer, TileLayer, Polygon, Popup, useMap } from 'react-leaflet';
import { LatLngBounds } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { usePlotStore } from '../../store/plotStore';
import { Plot } from '../../types';
import { PlotPopup } from './PlotPopup';

const MapController: React.FC<{ plots: Plot[] }> = ({ plots }) => {
  const map = useMap();
  
  useEffect(() => {
    if (plots.length > 0) {
      const bounds = new LatLngBounds(
        plots.map(plot => plot.center as [number, number])
      );
      map.fitBounds(bounds, { padding: [20, 20] });
    }
  }, [map, plots]);

  return null;
};

const getPlotColor = (status: Plot['status']) => {
  switch (status) {
    case 'available':
      return { color: '#10b981', fillColor: '#10b981', fillOpacity: 0.3 };
    case 'reserved':
      return { color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.3 };
    case 'sold':
      return { color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.3 };
    default:
      return { color: '#6b7280', fillColor: '#6b7280', fillOpacity: 0.3 };
  }
};

export const PlotMap: React.FC = () => {
  const { plots, selectedPlot, setSelectedPlot } = usePlotStore();

  const formatCoordinates = (coordinates: number[][][]): [number, number][] => {
    return coordinates[0].map(coord => [coord[1], coord[0]] as [number, number]);
  };

  return (
    <div className="w-full h-full relative">
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
        
        <MapController plots={plots} />
        
        {plots.map((plot) => (
          <Polygon
            key={plot.id}
            positions={formatCoordinates(plot.geometry.coordinates)}
            pathOptions={{
              ...getPlotColor(plot.status),
              weight: selectedPlot?.id === plot.id ? 3 : 2,
              opacity: 0.8
            }}
            eventHandlers={{
              click: () => setSelectedPlot(plot),
              mouseover: (e) => {
                e.target.setStyle({ weight: 3, opacity: 1 });
              },
              mouseout: (e) => {
                e.target.setStyle({ 
                  weight: selectedPlot?.id === plot.id ? 3 : 2, 
                  opacity: 0.8 
                });
              }
            }}
          >
            <Popup>
              <PlotPopup plot={plot} />
            </Popup>
          </Polygon>
        ))}
      </MapContainer>
      
      {/* Legend */}
      <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4 z-[1000]">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Plot Status</h3>
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-green-500 rounded opacity-60"></div>
            <span className="text-xs text-gray-700">Available</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-yellow-500 rounded opacity-60"></div>
            <span className="text-xs text-gray-700">Reserved</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-red-500 rounded opacity-60"></div>
            <span className="text-xs text-gray-700">Sold</span>
          </div>
        </div>
      </div>
    </div>
  );
};