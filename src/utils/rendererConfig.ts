// Get environment variables from the preload script
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

// Configuration for renderer process
export const rendererConfig = {
  supabase: {
    url: window.electron?.env?.SUPABASE_URL || '',
    anonKey: window.electron?.env?.SUPABASE_ANON_KEY || '',
  },
  app: {
    paths: {
      screenshots: window.electron?.env?.SCREENSHOT_STORAGE_PATH || '',
      flows: '',
      cache: '',
    },
    captureInterval: window.electron?.env?.DEFAULT_CAPTURE_INTERVAL
      ? parseInt(window.electron.env.DEFAULT_CAPTURE_INTERVAL, 10)
      : 30000,
  },
  features: {
    debugMode: window.electron?.env?.ENABLE_DEBUG_MODE === 'true',
  },
}; 