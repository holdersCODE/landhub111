import React, { useState } from 'react';
import { Upload, MapPin, Users, Package, Settings, FileText } from 'lucide-react';
import { PlotsManagement } from './PlotsManagement';
import { OrdersManagement } from './OrdersManagement';
import { ShapefileUpload } from './ShapefileUpload';
import { usePlotStore } from '../../store/plotStore';

type AdminView = 'overview' | 'plots' | 'orders' | 'upload';

export const AdminDashboard: React.FC = () => {
  const [activeView, setActiveView] = useState<AdminView>('overview');
  const { plots, orders } = usePlotStore();

  const navigation = [
    { id: 'overview', name: 'Overview', icon: Settings },
    { id: 'plots', name: 'Plots', icon: MapPin },
    { id: 'orders', name: 'Orders', icon: Package },
    { id: 'upload', name: 'Upload', icon: Upload },
  ];

  const stats = [
    {
      name: 'Total Plots',
      value: plots.length,
      icon: MapPin,
      color: 'bg-blue-500'
    },
    {
      name: 'Available Plots',
      value: plots.filter(p => p.status === 'available').length,
      icon: FileText,
      color: 'bg-green-500'
    },
    {
      name: 'Total Orders',
      value: orders.length,
      icon: Package,
      color: 'bg-purple-500'
    },
    {
      name: 'Pending Orders',
      value: orders.filter(o => o.status === 'pending').length,
      icon: Users,
      color: 'bg-yellow-500'
    },
  ];

  const renderContent = () => {
    switch (activeView) {
      case 'plots':
        return <PlotsManagement />;
      case 'orders':
        return <OrdersManagement />;
      case 'upload':
        return <ShapefileUpload />;
      default:
        return (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {stats.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.name} className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                    <div className="flex items-center">
                      <div className={`p-3 rounded-lg ${stat.color}`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                        <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button
                    onClick={() => setActiveView('upload')}
                    className="p-4 border-2 border-dashed border-gray-300 rounded-lg text-center hover:border-blue-500 hover:bg-blue-50 transition-colors group"
                  >
                    <Upload className="w-8 h-8 text-gray-400 group-hover:text-blue-500 mx-auto mb-2" />
                    <h3 className="text-sm font-medium text-gray-900">Upload Shapefile</h3>
                    <p className="text-xs text-gray-500 mt-1">Add new land plots</p>
                  </button>
                  
                  <button
                    onClick={() => setActiveView('orders')}
                    className="p-4 border border-gray-300 rounded-lg text-center hover:border-purple-500 hover:bg-purple-50 transition-colors group"
                  >
                    <Package className="w-8 h-8 text-gray-400 group-hover:text-purple-500 mx-auto mb-2" />
                    <h3 className="text-sm font-medium text-gray-900">Manage Orders</h3>
                    <p className="text-xs text-gray-500 mt-1">Review pending orders</p>
                  </button>
                  
                  <button
                    onClick={() => setActiveView('plots')}
                    className="p-4 border border-gray-300 rounded-lg text-center hover:border-green-500 hover:bg-green-50 transition-colors group"
                  >
                    <MapPin className="w-8 h-8 text-gray-400 group-hover:text-green-500 mx-auto mb-2" />
                    <h3 className="text-sm font-medium text-gray-900">Manage Plots</h3>
                    <p className="text-xs text-gray-500 mt-1">Edit plot information</p>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 bg-white shadow-sm border-r border-gray-200 min-h-screen">
          <div className="p-6">
            <h1 className="text-xl font-bold text-gray-900">Admin Panel</h1>
            <p className="text-sm text-gray-600 mt-1">Land Plot Management</p>
          </div>
          <nav className="mt-6">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id as AdminView)}
                  className={`w-full flex items-center px-6 py-3 text-left transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-5 h-5 mr-3" />
                  {item.name}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-8">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};