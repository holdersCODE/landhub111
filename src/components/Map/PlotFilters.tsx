import React, { useState, useEffect } from 'react';
import { X, Filter, Search, DollarSign, Ruler } from 'lucide-react';
import { PlotWithGeometry } from '../../types/database';
import { PlotService } from '../../services/plotService';

interface PlotFiltersProps {
  filters: {
    status: string[];
    landUse: string[];
    minPrice?: number;
    maxPrice?: number;
    minArea?: number;
    maxArea?: number;
    searchTerm?: string;
  };
  onFiltersChange: (filters: any) => void;
  plots: PlotWithGeometry[];
}

export const PlotFilters: React.FC<PlotFiltersProps> = ({
  filters,
  onFiltersChange,
  plots
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [landUseTypes, setLandUseTypes] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState({ min: 0, max: 0 });

  useEffect(() => {
    // Get unique land use types
    const uniqueTypes = [...new Set(plots.map(p => p.land_use).filter(Boolean))];
    setLandUseTypes(uniqueTypes.sort());

    // Calculate price range
    const prices = plots.map(p => p.price_usd).filter(Boolean) as number[];
    if (prices.length > 0) {
      setPriceRange({
        min: Math.min(...prices),
        max: Math.max(...prices)
      });
    }
  }, [plots]);

  const handleStatusChange = (status: string, checked: boolean) => {
    const newStatus = checked
      ? [...filters.status, status]
      : filters.status.filter(s => s !== status);
    
    onFiltersChange({ ...filters, status: newStatus });
  };

  const handleLandUseChange = (landUse: string, checked: boolean) => {
    const newLandUse = checked
      ? [...filters.landUse, landUse]
      : filters.landUse.filter(l => l !== landUse);
    
    onFiltersChange({ ...filters, landUse: newLandUse });
  };

  const handlePriceChange = (field: 'minPrice' | 'maxPrice', value: string) => {
    const numValue = value === '' ? undefined : Number(value);
    onFiltersChange({ ...filters, [field]: numValue });
  };

  const handleAreaChange = (field: 'minArea' | 'maxArea', value: string) => {
    const numValue = value === '' ? undefined : Number(value);
    onFiltersChange({ ...filters, [field]: numValue });
  };

  const clearFilters = () => {
    onFiltersChange({
      status: [],
      landUse: [],
      searchTerm: ''
    });
  };

  const hasActiveFilters = filters.status.length > 0 || 
                          filters.landUse.length > 0 || 
                          filters.minPrice !== undefined || 
                          filters.maxPrice !== undefined ||
                          filters.minArea !== undefined ||
                          filters.maxArea !== undefined ||
                          (filters.searchTerm && filters.searchTerm.length > 0);

  return (
    <>
      {/* Filter Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`absolute top-4 right-20 z-[1000] bg-white rounded-lg shadow-lg p-3 transition-colors ${
          hasActiveFilters ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:text-gray-900'
        }`}
        title="Filter plots"
      >
        <Filter className="w-5 h-5" />
        {hasActiveFilters && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-600 rounded-full"></div>
        )}
      </button>

      {/* Filter Panel */}
      {isOpen && (
        <div className="absolute top-16 right-4 z-[1000] bg-white rounded-lg shadow-xl border border-gray-200 w-80 max-h-[80vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Filter Plots</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 space-y-6">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Search className="w-4 h-4 inline mr-1" />
                Search
              </label>
              <input
                type="text"
                value={filters.searchTerm || ''}
                onChange={(e) => onFiltersChange({ ...filters, searchTerm: e.target.value })}
                placeholder="Search by plot code, owner, or notes..."
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <div className="space-y-2">
                {['available', 'pending', 'reserved', 'sold'].map(status => (
                  <label key={status} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={filters.status.includes(status)}
                      onChange={(e) => handleStatusChange(status, e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700 capitalize">{status}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Land Use Filter */}
            {landUseTypes.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Land Use
                </label>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {landUseTypes.map(landUse => (
                    <label key={landUse} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={filters.landUse.includes(landUse)}
                        onChange={(e) => handleLandUseChange(landUse, e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">{landUse}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Price Range */}
            {priceRange.max > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <DollarSign className="w-4 h-4 inline mr-1" />
                  Price Range (USD)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <input
                      type="number"
                      placeholder="Min"
                      value={filters.minPrice || ''}
                      onChange={(e) => handlePriceChange('minPrice', e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      placeholder="Max"
                      value={filters.maxPrice || ''}
                      onChange={(e) => handlePriceChange('maxPrice', e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Range: ${priceRange.min.toLocaleString()} - ${priceRange.max.toLocaleString()}
                </div>
              </div>
            )}

            {/* Area Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Ruler className="w-4 h-4 inline mr-1" />
                Area Range (sq m)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <input
                    type="number"
                    placeholder="Min"
                    value={filters.minArea || ''}
                    onChange={(e) => handleAreaChange('minArea', e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <input
                    type="number"
                    placeholder="Max"
                    value={filters.maxArea || ''}
                    onChange={(e) => handleAreaChange('maxArea', e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200 flex justify-between">
            <button
              onClick={clearFilters}
              className="text-sm text-gray-600 hover:text-gray-900"
              disabled={!hasActiveFilters}
            >
              Clear All
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700"
            >
              Apply Filters
            </button>
          </div>
        </div>
      )}
    </>
  );
};