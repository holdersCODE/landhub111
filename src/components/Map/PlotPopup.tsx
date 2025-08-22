import React, { useState } from 'react';
import { MapPin, Ruler, Tag, DollarSign, User, FileText } from 'lucide-react';
import { Plot } from '../../types';
import { useAuthStore } from '../../store/authStore';
import { usePlotStore } from '../../store/plotStore';
import { OrderModal } from './OrderModal';

interface PlotPopupProps {
  plot: Plot;
}

export const PlotPopup: React.FC<PlotPopupProps> = ({ plot }) => {
  const { isAuthenticated, user } = useAuthStore();
  const [showOrderModal, setShowOrderModal] = useState(false);

  const getStatusColor = (status: Plot['status']) => {
    switch (status) {
      case 'available': return 'text-green-600 bg-green-100';
      case 'reserved': return 'text-yellow-600 bg-yellow-100';
      case 'sold': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const formatSize = (size: number) => {
    return `${size.toLocaleString()} sq m`;
  };

  return (
    <div className="w-80 p-0">
      <div className="bg-white rounded-lg shadow-sm">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">{plot.plotCode}</h3>
            <span className={`px-2 py-1 text-xs font-medium rounded-full capitalize ${getStatusColor(plot.status)}`}>
              {plot.status}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 py-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center space-x-2">
              <Ruler className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-600">{formatSize(plot.size)}</span>
            </div>
            <div className="flex items-center space-x-2">
              <Tag className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-600">{plot.use}</span>
            </div>
          </div>

          {plot.price && (
            <div className="flex items-center space-x-2">
              <DollarSign className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-900">{formatPrice(plot.price)}</span>
            </div>
          )}

          {plot.owner && (
            <div className="flex items-center space-x-2">
              <User className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-600">Owner: {plot.owner}</span>
            </div>
          )}

          {plot.notes && (
            <div className="flex items-start space-x-2">
              <FileText className="w-4 h-4 text-gray-400 mt-0.5" />
              <p className="text-sm text-gray-600">{plot.notes}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-4 py-3 border-t border-gray-200">
          {plot.status === 'available' && isAuthenticated && user?.role === 'user' ? (
            <button
              onClick={() => setShowOrderModal(true)}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Reserve Plot
            </button>
          ) : plot.status === 'available' && !isAuthenticated ? (
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-2">Sign in to reserve this plot</p>
              <button className="w-full bg-gray-100 text-gray-500 py-2 px-4 rounded-md text-sm font-medium cursor-not-allowed">
                Reserve Plot
              </button>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-xs text-gray-500">
                This plot is {plot.status === 'sold' ? 'sold' : 'reserved'}
              </p>
            </div>
          )}
        </div>
      </div>

      {showOrderModal && (
        <OrderModal
          plot={plot}
          onClose={() => setShowOrderModal(false)}
        />
      )}
    </div>
  );
};