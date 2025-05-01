import { Screenshot } from '../../utils/screenshot';

// Define the structure of the API exposed by the preload script
declare global {
  interface Window {
    electron: {
      ipcRenderer: {
        send(channel: string, data: any): void;
        // Update the 'on' method signature if it returns a cleanup function
        on(channel: string, func: (...args: any[]) => void): (() => void) | void; // Allow returning cleanup
        invoke(channel: string, data: any): Promise<any>;
        removeListener(channel: string, listener: (...args: any[]) => void): void;
      };
      // Add other exposed properties if any (like env, platform)
      env?: {
        SUPABASE_URL?: string;
        SUPABASE_ANON_KEY?: string;
        // Add other env vars if exposed
      };
      platform?: string;
    };
  }
}

// Export an empty object to make this a module
export {}; 