// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

type EventHandler = (event: IpcRendererEvent, ...args: any[]) => void;
type StrippedHandler = (...args: any[]) => void;

// Store listeners for proper cleanup
const listeners = new Map<string, { wrapper: (event: IpcRendererEvent, ...args: any[]) => void; original: StrippedHandler }>();

// Helper function to remove all listeners for a channel
function removeAllChannelListeners(channel: string) {
  const channelListeners = listeners.get(channel);
  if (channelListeners) {
    ipcRenderer.removeListener(channel, channelListeners.wrapper);
    listeners.delete(channel);
  }
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
    on: (channel: string, func: StrippedHandler) => {
      // Remove any existing listeners for this channel
      removeAllChannelListeners(channel);

      // Create a wrapper function that includes the event object
      const wrapper = (event: IpcRendererEvent, ...args: any[]) => {
        func(...args);
      };

      // Store both the wrapper and original function
      listeners.set(channel, { wrapper, original: func });

      // Register the wrapper with ipcRenderer
      ipcRenderer.on(channel, wrapper);
    },
    removeListener: (channel: string, func: StrippedHandler) => {
      const channelListeners = listeners.get(channel);
      if (channelListeners && channelListeners.original === func) {
        ipcRenderer.removeListener(channel, channelListeners.wrapper);
        listeners.delete(channel);
      }
    },
    invoke: (channel: string, ...args: any[]) => {
      return ipcRenderer.invoke(channel, ...args);
    }
  },
  // Expose environment variables
  env: {
    SUPABASE_URL: process.env.SUPABASE_URL || '',
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
    ENABLE_DEBUG_MODE: process.env.ENABLE_DEBUG_MODE || 'false',
    SCREENSHOT_STORAGE_PATH: process.env.SCREENSHOT_STORAGE_PATH || '',
    DEFAULT_CAPTURE_INTERVAL: process.env.DEFAULT_CAPTURE_INTERVAL || '30000',
  },
  // Expose platform information
  platform: process.platform
});
