import React from 'react';
import { RefreshCw, Layers, Search, Filter, ZoomIn, ZoomOut } from 'lucide-react';

interface MapControlsProps {
  onRefresh: () => void;
  loading: boolean;
  plotCount: number;
  totalPlots: number;
}

export const MapControls: React.FC<MapControlsProps> = ({
  onRefresh,
  loading,
  plotCount,
  totalPlots
}) => {
  return (
    <div className="absolute top-4 left-4 z-[1000] space-y-2">
      {/* Plot Count Display */}
      <div className="bg-white rounded-lg shadow-lg px-4 py-2">
        <div className="text-sm font-medium text-gray-900">
          Showing {plotCount.toLocaleString()} of {totalPlots.toLocaleString()} plots
        </div>
      </div>

      {/* Control Buttons */}
      <div className="bg-white rounded-lg shadow-lg p-2 flex flex-col space-y-1">
        <button
          onClick={onRefresh}
          disabled={loading}
          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50"
          title="Refresh map data"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
        
        <button
          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
          title="Toggle layers"
        >
          <Layers className="w-5 h-5" />
        </button>
        
        <button
          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
          title="Search plots"
        >
          <Search className="w-5 h-5" />
        </button>
        
        <button
          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
          title="Filter plots"
        >
          <Filter className="w-5 h-5" />
        </button>
      </div>

      {/* Zoom Controls */}
      <div className="bg-white rounded-lg shadow-lg p-2 flex flex-col space-y-1">
        <button
          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
          title="Zoom in"
        >
          <ZoomIn className="w-5 h-5" />
        </button>
        
        <button
          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
          title="Zoom out"
        >
          <ZoomOut className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};