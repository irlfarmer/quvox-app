import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../utils/supabase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      // Sync session with main process
      if (session) {
        window.electron.ipcRenderer.invoke('sync-auth-session', session);
      }
    });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
      // Sync session with main process
      if (session) {
        await window.electron.ipcRenderer.invoke('sync-auth-session', session);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { error, data: { session } } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      
      // Sync session with main process after successful sign in
      if (session) {
        await window.electron.ipcRenderer.invoke('sync-auth-session', session);
      }
    } catch (error) {
      console.error('Error signing in:', error);
      throw error;
    }
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    try {
      // Sign up the user
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName,
          },
        },
      });

      if (signUpError) throw signUpError;
      if (!authData.user) throw new Error('No user data returned');

      // Wait for the session to be established
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Create user profile
      const { error: profileError } = await supabase
        .from('users')
        .insert([
          {
            id: authData.user.id,
            display_name: displayName,
            is_admin: false,
          },
        ])
        .single();

      if (profileError) {
        console.error('Error creating user profile:', profileError);
        // Don't throw here, as the auth part succeeded
      }

      // Initialize contributor stats - using service role client would be better
      const { error: statsError } = await supabase
        .from('contributor_stats')
        .insert([
          {
            user_id: authData.user.id,
            total_uploads: 0,
            approved_uploads: 0,
            current_league: 'bronze',
            league_points: 0,
            badges: [],
          },
        ])
        .single();

      if (statsError) {
        console.error('Error initializing contributor stats:', statsError);
        // Don't throw here, as the auth part succeeded
      }

      // Automatically sign in after successful signup
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        console.error('Error signing in after signup:', signInError);
        throw signInError;
      }
    } catch (error) {
      console.error('Error signing up:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}; 