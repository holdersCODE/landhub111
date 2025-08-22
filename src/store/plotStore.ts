import { create } from 'zustand';
import { Plot, Order } from '../types';

interface PlotState {
  plots: Plot[];
  orders: Order[];
  selectedPlot: Plot | null;
  setSelectedPlot: (plot: Plot | null) => void;
  createOrder: (plotId: string, userId: string, notes?: string) => string;
  updateOrderStatus: (orderId: string, status: Order['status']) => void;
  updatePlotStatus: (plotId: string, status: Plot['status']) => void;
  getOrdersByUser: (userId: string) => Order[];
  getOrderById: (orderId: string) => Order | undefined;
}

// Mock data for demonstration
const mockPlots: Plot[] = [
  {
    id: '1',
    plotCode: 'LP001',
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [-74.0059, 40.7128],
        [-74.0049, 40.7128],
        [-74.0049, 40.7138],
        [-74.0059, 40.7138],
        [-74.0059, 40.7128]
      ]]
    },
    center: [-74.0054, 40.7133],
    size: 1000,
    use: 'Residential',
    status: 'available',
    price: 150000
  },
  {
    id: '2',
    plotCode: 'LP002',
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [-74.0049, 40.7128],
        [-74.0039, 40.7128],
        [-74.0039, 40.7138],
        [-74.0049, 40.7138],
        [-74.0049, 40.7128]
      ]]
    },
    center: [-74.0044, 40.7133],
    size: 800,
    use: 'Commercial',
    status: 'reserved',
    price: 200000
  },
  {
    id: '3',
    plotCode: 'LP003',
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [-74.0039, 40.7128],
        [-74.0029, 40.7128],
        [-74.0029, 40.7138],
        [-74.0039, 40.7138],
        [-74.0039, 40.7128]
      ]]
    },
    center: [-74.0034, 40.7133],
    size: 1200,
    use: 'Agricultural',
    status: 'sold',
    owner: 'Jane Smith',
    price: 120000
  }
];

export const usePlotStore = create<PlotState>((set, get) => ({
  plots: mockPlots,
  orders: [],
  selectedPlot: null,
  
  setSelectedPlot: (plot) => set({ selectedPlot: plot }),
  
  createOrder: (plotId, userId, notes) => {
    const orderId = Date.now().toString();
    const newOrder: Order = {
      id: orderId,
      userId,
      plotId,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      notes
    };
    
    set(state => ({
      orders: [...state.orders, newOrder],
      plots: state.plots.map(plot => 
        plot.id === plotId ? { ...plot, status: 'reserved' } : plot
      )
    }));
    
    return orderId;
  },
  
  updateOrderStatus: (orderId, status) => {
    set(state => ({
      orders: state.orders.map(order => 
        order.id === orderId ? { ...order, status, updatedAt: new Date().toISOString() } : order
      )
    }));
  },
  
  updatePlotStatus: (plotId, status) => {
    set(state => ({
      plots: state.plots.map(plot => 
        plot.id === plotId ? { ...plot, status } : plot
      )
    }));
  },
  
  getOrdersByUser: (userId) => {
    const { orders, plots } = get();
    return orders
      .filter(order => order.userId === userId)
      .map(order => ({
        ...order,
        plot: plots.find(plot => plot.id === order.plotId)
      }));
  },
  
  getOrderById: (orderId) => {
    const { orders, plots } = get();
    const order = orders.find(o => o.id === orderId);
    if (order) {
      return {
        ...order,
        plot: plots.find(plot => plot.id === order.plotId)
      };
    }
    return undefined;
  }
}));