import { contextBridge, ipcRenderer } from 'electron';
import config from '../utils/config';



// Validate required environment variables
if (!config.supabase.url || !config.supabase.anonKey) {
  console.error('Missing Supabase configuration in preload script');
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    send: (channel: string, data: any) => {
      // whitelist channels
      const validChannels = ['screenshot:capture', 'screenshot:save'];
      if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, data);
      }
    },
    on: (channel: string, func: (...args: any[]) => void) => {
      const validChannels = ['screenshot:captured', 'screenshot:saved'];
      if (validChannels.includes(channel)) {
        // Strip event as it includes `sender`
        ipcRenderer.on(channel, (event, ...args) => func(...args));
      }
    },
  },
  // Expose environment variables
  env: {
    SUPABASE_URL: config.supabase.url || '',
    SUPABASE_ANON_KEY: config.supabase.anonKey || '',
    ENABLE_DEBUG_MODE: config.features.debugMode ? 'true' : 'false',
    SCREENSHOT_STORAGE_PATH: config.app.paths.screenshots || '',
    DEFAULT_CAPTURE_INTERVAL: config.app.captureInterval?.toString() || '30000',
  },
}); 