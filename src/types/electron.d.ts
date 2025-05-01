type IpcRequest = 
  | { channel: 'get-available-apps' }
  | { channel: 'load-settings' }
  | { channel: 'select-directory' }
  | { channel: 'save-settings'; data: any }
  | { channel: 'update-storage-path'; data: string }
  | { channel: 'get-active-window' }
  | { channel: 'get-recent-screenshots' };

type IpcResponse<T extends IpcRequest> = T extends { channel: 'get-available-apps' }
  ? Array<{ name: string; icon?: string; isActive: boolean }>
  : T extends { channel: 'load-settings' }
  ? {
      captureInterval: number;
      launchOnStartup: boolean;
      showNotifications: boolean;
      selectedApps: string[];
      shortcut: {
        key: string;
        ctrl: boolean;
        shift: boolean;
      };
      storagePath: string;
    }
  : T extends { channel: 'select-directory' }
  ? string
  : T extends { channel: 'save-settings' }
  ? void
  : T extends { channel: 'update-storage-path' }
  ? void
  : T extends { channel: 'get-active-window' }
  ? {
      title: string;
      owner: {
        name: string;
        path: string;
      };
    } | null
  : T extends { channel: 'get-recent-screenshots' }
  ? Array<{
      id: string;
      path: string;
      name: string;
      timestamp: number;
      metadata: any;
    }>
  : never;

type NoArgsChannels = 'get-available-apps' | 'load-settings' | 'select-directory' | 'get-active-window' | 'get-recent-screenshots';
type WithArgsChannels = 'save-settings' | 'update-storage-path';

type IpcChannels = {
  'get-available-apps': {
    data: undefined;
    response: Array<{ name: string; icon?: string; isActive: boolean }>;
  };
  'load-settings': {
    data: undefined;
    response: {
      captureInterval: number;
      launchOnStartup: boolean;
      showNotifications: boolean;
      selectedApps: string[];
      shortcut: {
        key: string;
        ctrl: boolean;
        shift: boolean;
      };
      storagePath: string;
    };
  };
  'select-directory': {
    data: undefined;
    response: string;
  };
  'save-settings': {
    data: any;
    response: void;
  };
  'update-storage-path': {
    data: string;
    response: void;
  };
  'get-active-window': {
    data: undefined;
    response: {
      title: string;
      owner: {
        name: string;
        path: string;
      };
    } | null;
  };
  'get-recent-screenshots': {
    data: undefined;
    response: Array<{
      id: string;
      path: string;
      name: string;
      timestamp: number;
      metadata: any;
    }>;
  };
};

type IpcRenderer = {
  send: (channel: string, data: any) => void;
  on: (channel: string, func: (...args: any[]) => void) => void;
  invoke<T extends keyof IpcChannels>(
    channel: T,
    data: IpcChannels[T]['data']
  ): Promise<IpcChannels[T]['response']>;
};

declare global {
  interface Window {
    electron: {
      ipcRenderer: IpcRenderer;
      env: {
        SUPABASE_URL: string;
        SUPABASE_ANON_KEY: string;
        ENABLE_DEBUG_MODE: string;
        SCREENSHOT_STORAGE_PATH: string;
        DEFAULT_CAPTURE_INTERVAL: string;
      };
    };
  }
}

export {}; 