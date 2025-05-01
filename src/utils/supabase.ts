import { createClient } from '@supabase/supabase-js';
import config from './config';

// Create a simple in-memory storage for testing
const createMemoryStorage = () => {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
  };
};

// Use localStorage in browser/Electron, memory storage in Node.js
const storage = typeof window !== 'undefined' ? window.localStorage : createMemoryStorage();

// Create Supabase client
export const supabase = createClient(
  config.supabase.url,
  config.supabase.anonKey,
  {
    auth: {
      persistSession: true,
      storage,
    },
  }
);

// User data interface
export interface UserData {
  id: string;
  email: string;
  display_name: string;
  avatar_url?: string;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

// Auth helper functions
export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) return null;

  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  if (userError) throw userError;
  return { ...user, ...userData } as UserData;
}

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

export async function signUpWithEmail(email: string, password: string, displayName: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  if (error) throw error;
  if (!data.user) throw new Error('No user data returned');

  // Wait a moment for the auth system to fully process the signup
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Create user profile in our users table
  const { error: userError } = await supabase
    .from('users')
    .insert([
      {
        id: data.user.id,
        display_name: displayName,
        is_admin: false,
      },
    ]);

  if (userError) throw userError;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
} 