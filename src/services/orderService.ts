import { supabase, transactionHelpers, handleSupabaseError } from '../lib/supabase';
import { Database, OrderWithDetails } from '../types/database';

type Order = Database['public']['Tables']['orders']['Row'];
type OrderInsert = Database['public']['Tables']['orders']['Insert'];
type OrderUpdate = Database['public']['Tables']['orders']['Update'];

export class OrderService {
  // Create new order with transaction
  static async createOrder(orderData: {
    plot_id: string;
    user_id: string;
    order_type?: string;
    requested_price?: number;
    purpose?: string;
    notes?: string;
    payment_terms?: string;
    contract_start_date?: string;
    contract_end_date?: string;
  }): Promise<any> {
    try {
      const result = await transactionHelpers.createOrderWithTransaction({
        plot_id: orderData.plot_id,
        user_id: orderData.user_id,
        order_type: orderData.order_type || 'reservation',
        requested_price: orderData.requested_price,
        purpose: orderData.purpose,
        notes: orderData.notes
      });

      return result;
    } catch (error) {
      throw new Error(handleSupabaseError(error));
    }
  }

  // Get all orders with details
  static async getAllOrders(): Promise<OrderWithDetails[]> {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          plots (
            id,
            plot_code,
            area_sqm,
            land_use,
            price_usd,
            status,
            geometry
          ),
          user_profiles (
            id,
            name,
            phone,
            address
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as OrderWithDetails[];
    } catch (error) {
      throw new Error(handleSupabaseError(error));
    }
  }

  // Get orders by user
  static async getOrdersByUser(userId: string): Promise<OrderWithDetails[]> {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          plots (
            id,
            plot_code,
            area_sqm,
            land_use,
            price_usd,
            status,
            geometry
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as OrderWithDetails[];
    } catch (error) {
      throw new Error(handleSupabaseError(error));
    }
  }

  // Get order by ID
  static async getOrderById(orderId: string): Promise<OrderWithDetails | null> {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          plots (
            id,
            plot_code,
            area_sqm,
            land_use,
            price_usd,
            status,
            geometry,
            owner_name,
            notes
          ),
          user_profiles (
            id,
            name,
            phone,
            address
          )
        `)
        .eq('id', orderId)
        .single();

      if (error) throw error;
      return data as OrderWithDetails;
    } catch (error) {
      throw new Error(handleSupabaseError(error));
    }
  }

  // Update order status
  static async updateOrderStatus(
    orderId: string, 
    status: 'pending' | 'approved' | 'rejected' | 'cancelled',
    adminNotes?: string,
    rejectedReason?: string
  ): Promise<Order> {
    try {
      const updates: OrderUpdate = {
        status,
        admin_notes: adminNotes,
        rejected_reason: rejectedReason
      };

      if (status === 'approved') {
        updates.approved_by = (await supabase.auth.getUser()).data.user?.id;
        updates.approved_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', orderId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw new Error(handleSupabaseError(error));
    }
  }

  // Approve order with transaction
  static async approveOrder(orderId: string, approvedPrice?: number): Promise<any> {
    try {
      const result = await transactionHelpers.approveOrderWithTransaction(orderId, approvedPrice);
      return result;
    } catch (error) {
      throw new Error(handleSupabaseError(error));
    }
  }

  // Reject order
  static async rejectOrder(orderId: string, reason: string): Promise<Order> {
    try {
      return await this.updateOrderStatus(orderId, 'rejected', undefined, reason);
    } catch (error) {
      throw new Error(handleSupabaseError(error));
    }
  }

  // Cancel order (by user)
  static async cancelOrder(orderId: string): Promise<Order> {
    try {
      // First check if user owns this order
      const { data: order, error: fetchError } = await supabase
        .from('orders')
        .select('user_id, status')
        .eq('id', orderId)
        .single();

      if (fetchError) throw fetchError;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user || order.user_id !== user.id) {
        throw new Error('Unauthorized to cancel this order');
      }

      if (order.status !== 'pending') {
        throw new Error('Only pending orders can be cancelled');
      }

      return await this.updateOrderStatus(orderId, 'cancelled');
    } catch (error) {
      throw new Error(handleSupabaseError(error));
    }
  }

  // Update order details
  static async updateOrder(orderId: string, updates: OrderUpdate): Promise<Order> {
    try {
      const { data, error } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', orderId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw new Error(handleSupabaseError(error));
    }
  }

  // Get order statistics
  static async getOrderStatistics() {
    try {
      const { data, error } = await supabase
        .from('order_statistics')
        .select('*')
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw new Error(handleSupabaseError(error));
    }
  }

  // Get orders by status
  static async getOrdersByStatus(status: 'pending' | 'approved' | 'rejected' | 'cancelled'): Promise<OrderWithDetails[]> {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          plots (
            id,
            plot_code,
            area_sqm,
            land_use,
            price_usd,
            status
          ),
          user_profiles (
            id,
            name,
            phone
          )
        `)
        .eq('status', status)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as OrderWithDetails[];
    } catch (error) {
      throw new Error(handleSupabaseError(error));
    }
  }

  // Get pending orders count
  static async getPendingOrdersCount(): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (error) throw error;
      return count || 0;
    } catch (error) {
      throw new Error(handleSupabaseError(error));
    }
  }

  // Get user's active orders
  static async getUserActiveOrders(userId: string): Promise<OrderWithDetails[]> {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          plots (
            id,
            plot_code,
            area_sqm,
            land_use,
            price_usd,
            status
          )
        `)
        .eq('user_id', userId)
        .in('status', ['pending', 'approved'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as OrderWithDetails[];
    } catch (error) {
      throw new Error(handleSupabaseError(error));
    }
  }

  // Check if user can order plot
  static async canUserOrderPlot(userId: string, plotId: string): Promise<{ canOrder: boolean; reason?: string }> {
    try {
      // Check if plot exists and is available
      const { data: plot, error: plotError } = await supabase
        .from('plots')
        .select('status')
        .eq('id', plotId)
        .single();

      if (plotError) {
        return { canOrder: false, reason: 'Plot not found' };
      }

      if (plot.status !== 'available') {
        return { canOrder: false, reason: 'Plot is not available' };
      }

      // Check if user already has a pending order for this plot
      const { data: existingOrder, error: orderError } = await supabase
        .from('orders')
        .select('id')
        .eq('user_id', userId)
        .eq('plot_id', plotId)
        .eq('status', 'pending')
        .maybeSingle();

      if (orderError) throw orderError;

      if (existingOrder) {
        return { canOrder: false, reason: 'You already have a pending order for this plot' };
      }

      return { canOrder: true };
    } catch (error) {
      throw new Error(handleSupabaseError(error));
    }
  }

  // Get orders within date range
  static async getOrdersByDateRange(startDate: string, endDate: string): Promise<OrderWithDetails[]> {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          plots (
            id,
            plot_code,
            area_sqm,
            land_use,
            price_usd
          ),
          user_profiles (
            id,
            name
          )
        `)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as OrderWithDetails[];
    } catch (error) {
      throw new Error(handleSupabaseError(error));
    }
  }
}