export interface KeyboardShortcut {
  key: string;
  ctrl: boolean;
  shift: boolean;
  alt?: boolean;
}

export interface Settings {
  captureInterval: number;
  launchOnStartup: boolean;
  showNotifications: boolean;
  selectedApps: string[];
  shortcut: KeyboardShortcut;
  storagePath: string;
} 