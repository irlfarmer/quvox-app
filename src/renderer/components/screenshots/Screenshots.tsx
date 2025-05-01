import React, { useState, useEffect } from 'react';
import { ScreenshotService } from '../../../utils/screenshot';
import { AutoCaptureDialog } from './AutoCaptureDialog';

interface Screenshot {
  id: string;
  path: string;
  name: string;
  timestamp: number;
  metadata: {
    activeWindow?: {
      title: string;
      app: string;
    };
  };
}

export const Screenshots: React.FC = () => {
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [storagePath, setStoragePath] = useState<string>('');
  const [isAutoCaptureDialogOpen, setIsAutoCaptureDialogOpen] = useState(false);
  const [availableApps, setAvailableApps] = useState<Array<{ name: string; isActive: boolean }>>([]);
  const [selectedApps, setSelectedApps] = useState<string[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);

  useEffect(() => {
    // Get storage path
    ScreenshotService.getInstance().getScreenshotDirectory()
      .then(path => setStoragePath(path))
      .catch(console.error);

    // Load recent screenshots
    loadRecentScreenshots();
    
    // Load available apps
    loadAvailableApps();

    // Check if auto-capture is already running
    const isAutoCapturing = ScreenshotService.getInstance().isAutoCapturing();
    setIsCapturing(isAutoCapturing);

    // Load selected apps from settings
    window.electron.ipcRenderer.invoke('load-settings', undefined)
      .then((settings: { selectedApps?: string[] }) => {
        if (settings.selectedApps) {
          setSelectedApps(settings.selectedApps);
        }
      })
      .catch(console.error);
  }, []);

  const loadAvailableApps = async () => {
    try {
      const apps = await window.electron.ipcRenderer.invoke('get-available-apps', undefined);
      setAvailableApps(apps);
    } catch (error) {
      console.error('Failed to load apps:', error);
    }
  };

  const loadRecentScreenshots = async () => {
    try {
      const recentScreenshots = await window.electron.ipcRenderer.invoke('get-recent-screenshots', undefined);
      setScreenshots(recentScreenshots);
    } catch (error) {
      console.error('Failed to load recent screenshots:', error);
    }
  };

  const handleCaptureScreenshot = async () => {
    try {
      await ScreenshotService.getInstance().captureScreen();
      loadRecentScreenshots();
    } catch (error) {
      console.error('Failed to capture screenshot:', error);
    }
  };

  const handleViewScreenshot = async (path: string) => {
    try {
      await window.electron.ipcRenderer.invoke('open-file', path);
    } catch (error) {
      console.error('Failed to open screenshot:', error);
    }
  };

  const handleAppToggle = (appName: string) => {
    setSelectedApps(prev =>
      prev.includes(appName)
        ? prev.filter(app => app !== appName)
        : [...prev, appName]
    );
  };

  const handleStartAutoCapture = () => {
    setIsAutoCaptureDialogOpen(true);
  };

  const handleConfirmAutoCapture = () => {
    if (selectedApps.length === 0) return;
    
    setIsCapturing(true);
    setIsAutoCaptureDialogOpen(false);
    
    // Save selected apps to settings
    window.electron.ipcRenderer.invoke('save-settings', { selectedApps })
      .catch(console.error);

    // Start auto capture
    ScreenshotService.getInstance().startAutoCaptureWithApps(selectedApps, (screenshot) => {
      loadRecentScreenshots();
    });
  };

  const handleStopAutoCapture = () => {
    setIsCapturing(false);
    ScreenshotService.getInstance().stopAutoCapture();
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[var(--text-primary)]">Screenshot Control</h2>
          <p className="text-[var(--text-secondary)] mt-1">
            Screenshots are saved to: <span className="text-[var(--text-primary)]">{storagePath}</span>
          </p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={handleCaptureScreenshot}
            className="px-6 py-2 bg-[var(--accent)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--accent-hover)] transition-colors"
          >
            Capture Screenshot
          </button>
          {!isCapturing ? (
            <button
              onClick={handleStartAutoCapture}
              className="px-6 py-2 bg-[var(--secondary)] text-[var(--text-primary)] rounded-lg hover:bg-[#333333] transition-colors"
            >
              Start Auto Capture
            </button>
          ) : (
            <button
              onClick={handleStopAutoCapture}
              className="px-6 py-2 bg-[var(--error)] text-[var(--text-primary)] rounded-lg hover:opacity-90 transition-colors"
            >
              Stop Auto Capture
            </button>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4 text-[var(--text-primary)]">Recent Screenshots</h2>
        {screenshots.length === 0 ? (
          <div className="text-center py-12 text-[var(--text-secondary)]">
            Your captured screenshots will appear here
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {screenshots.map((screenshot) => (
              <div
                key={screenshot.id}
                className="bg-[var(--secondary)] rounded-lg overflow-hidden group hover:ring-2 hover:ring-[var(--accent)] transition-all"
              >
                <div className="relative aspect-video bg-[var(--background)]">
                  <img
                    src={`file://${screenshot.path}`}
                    alt={`Screenshot ${screenshot.name}`}
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      onClick={() => handleViewScreenshot(screenshot.path)}
                      className="px-4 py-2 bg-[var(--accent)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--accent-hover)] transition-colors"
                    >
                      View
                    </button>
                  </div>
                </div>
                <div className="p-4">
                  <div className="text-sm text-[var(--text-secondary)]">{formatDate(screenshot.timestamp)}</div>
                  {screenshot.metadata?.activeWindow && (
                    <div className="text-sm mt-1 text-[var(--text-primary)]">
                      {screenshot.metadata.activeWindow.app}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AutoCaptureDialog
        isOpen={isAutoCaptureDialogOpen}
        onClose={() => setIsAutoCaptureDialogOpen(false)}
        onStart={handleConfirmAutoCapture}
        selectedApps={selectedApps}
        onAppToggle={handleAppToggle}
        availableApps={availableApps}
      />
    </div>
  );
}; 