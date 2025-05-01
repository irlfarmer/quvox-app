import React, { useState, useEffect } from 'react';
import { ScreenshotService } from '../../../utils/screenshot';

interface AppToTrack {
  name: string;
  icon?: string;
  isActive: boolean;
}

interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
}

interface Settings {
  captureInterval: number;
  launchOnStartup: boolean;
  showNotifications: boolean;
  selectedApps: string[];
  shortcut: KeyboardShortcut;
  storagePath: string;
}

interface AutoCaptureDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onStart: () => void;
  selectedApps: string[];
  onAppToggle: (appName: string) => void;
  availableApps: Array<{ name: string; isActive: boolean }>;
}

export const AutoCaptureDialog: React.FC<AutoCaptureDialogProps> = ({
  isOpen,
  onClose,
  onStart,
  selectedApps,
  onAppToggle,
  availableApps
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-background rounded-xl p-6 max-w-md w-full">
        <h3 className="text-lg font-semibold mb-4 text-foreground">Start Auto Capture</h3>
        <p className="text-muted-foreground mb-4">
          Selected apps will be monitored and screenshots will be taken automatically.
        </p>
        <div className="mb-4">
          <div className="text-sm font-medium mb-2 text-foreground">Selected Apps ({selectedApps.length})</div>
          <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-2">
            {availableApps.map(app => (
              <div 
                key={app.name}
                className="flex items-center p-2 hover:bg-secondary rounded-lg transition-colors"
              >
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedApps.includes(app.name)}
                    onChange={() => onAppToggle(app.name)}
                    className="w-4 h-4 rounded border-2 border-accent bg-transparent appearance-none checked:bg-accent checked:border-accent transition-all cursor-pointer"
                  />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 checked:opacity-100 transition-opacity">
                    <svg className="w-3 h-3 text-white" viewBox="0 0 12 12">
                      <path
                        d="M3.5 6L5.5 8L8.5 4"
                        stroke="currentColor"
                        strokeWidth="2"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>
                <span className="flex-1 ml-3 text-foreground">{app.name}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary transition-colors focus:outline-none"
          >
            Cancel
          </button>
          <button
            onClick={onStart}
            className="px-4 py-2 bg-accent text-accent-foreground rounded-lg hover:bg-accent-hover transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={selectedApps.length === 0}
          >
            Start Capture
          </button>
        </div>
      </div>
    </div>
  );
};

export const Settings: React.FC = () => {
  const [captureInterval, setCaptureInterval] = useState<number>(5);
  const [storagePath, setStoragePath] = useState<string>('');
  const [launchOnStartup, setLaunchOnStartup] = useState(false);
  const [showNotifications, setShowNotifications] = useState(true);
  const [availableApps, setAvailableApps] = useState<AppToTrack[]>([]);
  const [selectedApps, setSelectedApps] = useState<string[]>([]);
  const [shortcut, setShortcut] = useState<KeyboardShortcut>({
    key: 'P',
    ctrl: true,
    shift: true,
  });
  const [isRecordingShortcut, setIsRecordingShortcut] = useState(false);
  const [recordedKeys, setRecordedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Get storage path
    ScreenshotService.getInstance().getScreenshotDirectory()
      .then(path => setStoragePath(path))
      .catch(console.error);

    // Get available apps
    window.electron.ipcRenderer.invoke('get-available-apps', undefined)
      .then(apps => setAvailableApps(apps))
      .catch(console.error);

    // Load settings from storage
    window.electron.ipcRenderer.invoke('load-settings', undefined)
      .then((settings: Settings) => {
        setCaptureInterval(settings.captureInterval || 5);
        setLaunchOnStartup(settings.launchOnStartup || false);
        setShowNotifications(settings.showNotifications || true);
        setSelectedApps(settings.selectedApps || []);
        setShortcut(settings.shortcut || { key: 'P', ctrl: true, shift: true });
      })
      .catch(console.error);
  }, []);

  const handleChangeStorageLocation = async () => {
    try {
      const newPath = await window.electron.ipcRenderer.invoke('select-directory', undefined);
      if (newPath) {
        await window.electron.ipcRenderer.invoke('update-storage-path', newPath);
        setStoragePath(newPath);
      }
    } catch (error) {
      console.error('Failed to change storage location:', error);
    }
  };

  const handleShortcutChange = () => {
    setIsRecordingShortcut(true);
    setRecordedKeys(new Set());

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      const key = e.key.toUpperCase();
      setRecordedKeys(prev => new Set([...prev, key]));
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (recordedKeys.size > 0) {
        const newShortcut: KeyboardShortcut = {
          key: Array.from(recordedKeys).filter(k => !['CONTROL', 'SHIFT', 'ALT'].includes(k)).pop() || 'P',
          ctrl: recordedKeys.has('CONTROL'),
          alt: recordedKeys.has('ALT'),
          shift: recordedKeys.has('SHIFT'),
        };
        setShortcut(newShortcut);
        setIsRecordingShortcut(false);
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
        // Save the new shortcut
        window.electron.ipcRenderer.invoke('save-settings', { shortcut: newShortcut });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
  };

  const handleAppToggle = (appName: string) => {
    const newSelectedApps = selectedApps.includes(appName)
      ? selectedApps.filter(name => name !== appName)
      : [...selectedApps, appName];
    setSelectedApps(newSelectedApps);
    // Save the selected apps
    window.electron.ipcRenderer.invoke('save-settings', { selectedApps: newSelectedApps });
  };

  const formatShortcut = (shortcut: KeyboardShortcut): string => {
    const parts = [];
    if (shortcut.ctrl) parts.push('Ctrl');
    if (shortcut.alt) parts.push('Alt');
    if (shortcut.shift) parts.push('Shift');
    parts.push(shortcut.key);
    return parts.join(' + ');
  };

  return (
    <div className="p-6 space-y-8">
      <div>
        <h2 className="text-xl font-semibold mb-4 text-foreground">Capture Settings</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-foreground">Screenshot Interval</label>
            <select
              value={captureInterval}
              onChange={(e) => {
                const value = parseInt(e.target.value);
                setCaptureInterval(value);
                window.electron.ipcRenderer.invoke('save-settings', { captureInterval: value });
              }}
              className="w-full bg-secondary text-foreground rounded-lg p-2 focus:outline-none hover:bg-secondary/80 transition-colors"
            >
              <option value="5" className="text-foreground bg-secondary">5 seconds</option>
              <option value="10" className="text-foreground bg-secondary">10 seconds</option>
              <option value="30" className="text-foreground bg-secondary">30 seconds</option>
              <option value="60" className="text-foreground bg-secondary">1 minute</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-foreground">Keyboard Shortcut</label>
            <button
              onClick={handleShortcutChange}
              className="bg-secondary rounded-lg p-2 w-full text-left text-foreground hover:bg-secondary/80 transition-colors focus:outline-none"
            >
              {isRecordingShortcut ? (
                <span className="text-muted-foreground">Press your desired key combination...</span>
              ) : (
                <span>{formatShortcut(shortcut)}</span>
              )}
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-foreground">Apps to Track</label>
            <div className="bg-secondary rounded-lg p-4 border border-border">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Selected: {selectedApps.length} apps</span>
                <button 
                  onClick={() => setSelectedApps(availableApps.map(app => app.name))}
                  className="text-sm text-accent hover:text-accent-hover transition-colors"
                >
                  Select All
                </button>
              </div>
              <div className="space-y-2">
                {availableApps.map(app => (
                  <div 
                    key={app.name}
                    className="flex items-center p-2 hover:bg-secondary/80 rounded-lg transition-colors"
                  >
                    <div className="relative flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedApps.includes(app.name)}
                        onChange={() => handleAppToggle(app.name)}
                        className="w-4 h-4 rounded border-2 border-accent bg-transparent appearance-none checked:bg-accent checked:border-accent transition-all cursor-pointer"
                      />
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 checked:opacity-100 transition-opacity">
                        <svg className="w-3 h-3 text-white" viewBox="0 0 12 12">
                          <path
                            d="M3.5 6L5.5 8L8.5 4"
                            stroke="currentColor"
                            strokeWidth="2"
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                    </div>
                    <span className="flex-1 ml-3 text-foreground">{app.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {app.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-foreground">Storage Location</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={storagePath}
                readOnly
                className="flex-1 bg-secondary text-foreground rounded-lg p-2 focus:outline-none"
              />
              <button
                onClick={handleChangeStorageLocation}
                className="px-4 py-2 bg-accent text-accent-foreground rounded-lg hover:bg-accent-hover transition-colors"
              >
                Change
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-foreground">Launch on Startup</h3>
                <p className="text-sm text-muted-foreground">
                  Automatically start the app when you log in
                </p>
              </div>
              <button
                onClick={() => {
                  const newValue = !launchOnStartup;
                  setLaunchOnStartup(newValue);
                  window.electron.ipcRenderer.invoke('save-settings', { launchOnStartup: newValue });
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  launchOnStartup ? 'bg-accent' : 'bg-secondary'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    launchOnStartup ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-foreground">Show Notifications</h3>
                <p className="text-sm text-muted-foreground">
                  Get notified when screenshots are taken
                </p>
              </div>
              <button
                onClick={() => {
                  const newValue = !showNotifications;
                  setShowNotifications(newValue);
                  window.electron.ipcRenderer.invoke('save-settings', { showNotifications: newValue });
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  showNotifications ? 'bg-accent' : 'bg-secondary'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    showNotifications ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}; 