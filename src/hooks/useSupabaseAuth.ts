import { useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Database } from '../types/database';

type UserProfile = Database['public']['Tables']['user_profiles']['Row'];

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
}

export const useSupabaseAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    profile: null,
    session: null,
    loading: true,
    error: null
  });

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          setAuthState(prev => ({ ...prev, error: error.message, loading: false }));
          return;
        }

        if (session?.user) {
          const profile = await getUserProfile(session.user.id);
          setAuthState({
            user: session.user,
            profile,
            session,
            loading: false,
            error: null
          });
        } else {
          setAuthState(prev => ({ ...prev, loading: false }));
        }
      } catch (error) {
        setAuthState(prev => ({ 
          ...prev, 
          error: error instanceof Error ? error.message : 'Authentication error',
          loading: false 
        }));
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        try {
          if (session?.user) {
            const profile = await getUserProfile(session.user.id);
            setAuthState({
              user: session.user,
              profile,
              session,
              loading: false,
              error: null
            });
          } else {
            setAuthState({
              user: null,
              profile: null,
              session: null,
              loading: false,
              error: null
            });
          }
        } catch (error) {
          setAuthState(prev => ({
            ...prev,
            error: error instanceof Error ? error.message : 'Profile fetch error',
            loading: false
          }));
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Get user profile
  const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        // If profile doesn't exist, create one
        if (error.code === 'PGRST116') {
          return await createUserProfile(userId);
        }
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  };

  // Create user profile
  const createUserProfile = async (userId: string): Promise<UserProfile | null> => {
    try {
      const { data: user } = await supabase.auth.getUser();
      
      const profileData = {
        id: userId,
        name: user.user?.user_metadata?.name || user.user?.email?.split('@')[0] || 'User',
        role: 'user' as const
      };

      const { data, error } = await supabase
        .from('user_profiles')
        .insert(profileData)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating user profile:', error);
      return null;
    }
  };

  // Sign up
  const signUp = async (email: string, password: string, name: string) => {
    try {
      setAuthState(prev => ({ ...prev, loading: true, error: null }));

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name
          }
        }
      });

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sign up failed';
      setAuthState(prev => ({ ...prev, error: errorMessage, loading: false }));
      return { data: null, error: errorMessage };
    }
  };

  // Sign in
  const signIn = async (email: string, password: string) => {
    try {
      setAuthState(prev => ({ ...prev, loading: true, error: null }));

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sign in failed';
      setAuthState(prev => ({ ...prev, error: errorMessage, loading: false }));
      return { data: null, error: errorMessage };
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      setAuthState(prev => ({ ...prev, loading: true, error: null }));
      
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      return { error: null };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sign out failed';
      setAuthState(prev => ({ ...prev, error: errorMessage, loading: false }));
      return { error: errorMessage };
    }
  };

  // Update profile
  const updateProfile = async (updates: Partial<UserProfile>) => {
    try {
      if (!authState.user) throw new Error('No authenticated user');

      const { data, error } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('id', authState.user.id)
        .select()
        .single();

      if (error) throw error;

      setAuthState(prev => ({ ...prev, profile: data }));
      return { data, error: null };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Profile update failed';
      return { data: null, error: errorMessage };
    }
  };

  // Reset password
  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });

      if (error) throw error;
      return { error: null };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Password reset failed';
      return { error: errorMessage };
    }
  };

  // Check if user is admin
  const isAdmin = () => {
    return authState.profile?.role === 'admin';
  };

  // Check if user is authenticated
  const isAuthenticated = () => {
    return !!authState.user && !!authState.session;
  };

  return {
    ...authState,
    signUp,
    signIn,
    signOut,
    updateProfile,
    resetPassword,
    isAdmin,
    isAuthenticated,
    refreshProfile: () => {
      if (authState.user) {
        getUserProfile(authState.user.id).then(profile => {
          setAuthState(prev => ({ ...prev, profile }));
        });
      }
    }
  };
};