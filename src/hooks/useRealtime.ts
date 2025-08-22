import { useEffect, useState } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, subscriptions } from '../lib/supabase';

interface RealtimeState {
  connected: boolean;
  error: string | null;
}

// Hook for real-time plot updates
export const usePlotRealtime = (onPlotChange?: (payload: any) => void) => {
  const [state, setState] = useState<RealtimeState>({
    connected: false,
    error: null
  });

  useEffect(() => {
    let channel: RealtimeChannel;

    const setupSubscription = async () => {
      try {
        channel = subscriptions.subscribePlotChanges((payload) => {
          console.log('Plot change received:', payload);
          onPlotChange?.(payload);
        });

        // Listen for subscription status
        channel.on('system', {}, (payload) => {
          if (payload.extension === 'postgres_changes') {
            setState(prev => ({ ...prev, connected: true, error: null }));
          }
        });

      } catch (error) {
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Subscription failed'
        }));
      }
    };

    setupSubscription();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [onPlotChange]);

  return state;
};

// Hook for real-time order updates (user-specific)
export const useOrderRealtime = (
  userId: string | null,
  onOrderChange?: (payload: any) => void
) => {
  const [state, setState] = useState<RealtimeState>({
    connected: false,
    error: null
  });

  useEffect(() => {
    if (!userId) return;

    let channel: RealtimeChannel;

    const setupSubscription = async () => {
      try {
        channel = subscriptions.subscribeUserOrders(userId, (payload) => {
          console.log('Order change received:', payload);
          onOrderChange?.(payload);
        });

        channel.on('system', {}, (payload) => {
          if (payload.extension === 'postgres_changes') {
            setState(prev => ({ ...prev, connected: true, error: null }));
          }
        });

      } catch (error) {
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Subscription failed'
        }));
      }
    };

    setupSubscription();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [userId, onOrderChange]);

  return state;
};

// Hook for real-time admin order updates
export const useAdminOrderRealtime = (onOrderChange?: (payload: any) => void) => {
  const [state, setState] = useState<RealtimeState>({
    connected: false,
    error: null
  });

  useEffect(() => {
    let channel: RealtimeChannel;

    const setupSubscription = async () => {
      try {
        channel = subscriptions.subscribeAllOrders((payload) => {
          console.log('Admin order change received:', payload);
          onOrderChange?.(payload);
        });

        channel.on('system', {}, (payload) => {
          if (payload.extension === 'postgres_changes') {
            setState(prev => ({ ...prev, connected: true, error: null }));
          }
        });

      } catch (error) {
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Subscription failed'
        }));
      }
    };

    setupSubscription();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [onOrderChange]);

  return state;
};

// Generic realtime hook for any table
export const useTableRealtime = (
  tableName: string,
  filter?: string,
  onDataChange?: (payload: any) => void
) => {
  const [state, setState] = useState<RealtimeState>({
    connected: false,
    error: null
  });

  useEffect(() => {
    let channel: RealtimeChannel;

    const setupSubscription = async () => {
      try {
        const channelName = `${tableName}_changes_${Date.now()}`;
        channel = supabase.channel(channelName);

        const subscriptionConfig: any = {
          event: '*',
          schema: 'public',
          table: tableName
        };

        if (filter) {
          subscriptionConfig.filter = filter;
        }

        channel.on('postgres_changes', subscriptionConfig, (payload) => {
          console.log(`${tableName} change received:`, payload);
          onDataChange?.(payload);
        });

        channel.on('system', {}, (payload) => {
          if (payload.extension === 'postgres_changes') {
            setState(prev => ({ ...prev, connected: true, error: null }));
          }
        });

        await channel.subscribe();

      } catch (error) {
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Subscription failed'
        }));
      }
    };

    setupSubscription();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [tableName, filter, onDataChange]);

  return state;
};

// Hook for connection status
export const useSupabaseConnection = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('id')
          .limit(1);

        if (error) throw error;
        setIsConnected(true);
        setError(null);
      } catch (error) {
        setIsConnected(false);
        setError(error instanceof Error ? error.message : 'Connection failed');
      }
    };

    // Check connection immediately
    checkConnection();

    // Check connection every 30 seconds
    const interval = setInterval(checkConnection, 30000);

    return () => clearInterval(interval);
  }, []);

  return { isConnected, error };
};