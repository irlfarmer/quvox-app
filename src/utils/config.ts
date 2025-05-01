import { app } from 'electron';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

// Define configuration interface
export interface AppConfig {
  supabase: {
    url: string;
    anonKey: string;
  };
  app: {
    paths: {
      screenshots: string;
      flows: string;
      cache: string;
    };
    captureInterval: number;
  };
  features: {
    debugMode: boolean;
  };
}

declare global {
  interface Window {
    electron: {
      ipcRenderer: {
        send(channel: string, data: any): void;
        on(channel: string, func: (data: any) => void): void;
        removeListener(channel: string, func: (data: any) => void): void;
        invoke(channel: string, data: any): Promise<any>;
      };
      env: {
        SUPABASE_URL: string;
        SUPABASE_ANON_KEY: string;
        ENABLE_DEBUG_MODE: string;
        SCREENSHOT_STORAGE_PATH: string;
        DEFAULT_CAPTURE_INTERVAL: string;
      };
      platform: string;
    };
  }
}

// Check if we're in the renderer process
const isRenderer = typeof window !== 'undefined';

// Create configuration object
const config: AppConfig = {
  supabase: {
    url: isRenderer 
      ? (window?.electron?.env?.SUPABASE_URL || '') 
      : (process.env.SUPABASE_URL || ''),
    anonKey: isRenderer 
      ? (window?.electron?.env?.SUPABASE_ANON_KEY || '') 
      : (process.env.SUPABASE_ANON_KEY || ''),
  },
  app: {
    paths: {
      screenshots: isRenderer 
        ? (window?.electron?.env?.SCREENSHOT_STORAGE_PATH || './screenshots')
        : (process.env.SCREENSHOT_STORAGE_PATH || './screenshots'),
      flows: './flows',
      cache: './cache',
    },
    captureInterval: parseInt(
      isRenderer 
        ? (window?.electron?.env?.DEFAULT_CAPTURE_INTERVAL || '30000')
        : (process.env.DEFAULT_CAPTURE_INTERVAL || '30000'), 
      10
    ),
  },
  features: {
    debugMode: isRenderer 
      ? window?.electron?.env?.ENABLE_DEBUG_MODE === 'true'
      : process.env.ENABLE_DEBUG_MODE === 'true',
  },
};

export default config; 