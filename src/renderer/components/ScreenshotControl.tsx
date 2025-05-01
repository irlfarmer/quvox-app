import React, { useState, useEffect } from 'react';
import { ScreenshotService, Screenshot } from '../../utils/screenshot';
import { AutoCaptureDialog } from './screenshots/AutoCaptureDialog';

interface ScreenshotControlProps {
  onScreenshotTaken?: (screenshot: Screenshot) => void;
}

export const ScreenshotControl: React.FC<ScreenshotControlProps> = ({
  onScreenshotTaken
}) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savePath, setSavePath] = useState<string>('');
  const [isAutoCaptureDialogOpen, setIsAutoCaptureDialogOpen] = useState(false);
  const [availableApps, setAvailableApps] = useState<Array<{ name: string; isActive: boolean }>>([]);
  const [selectedApps, setSelectedApps] = useState<string[]>([]);
  const screenshotService = ScreenshotService.getInstance();

  useEffect(() => {
    // Get the screenshot directory when component mounts
    screenshotService.getScreenshotDirectory()
      .then(path => {
        // Convert forward slashes to backslashes on Windows
        const displayPath = process.platform === 'win32' ? path.replace(/\//g, '\\') : path;
        setSavePath(displayPath);
      })
      .catch(error => {
        console.error('Failed to get screenshot directory:', error);
        setError('Failed to initialize screenshot directory');
      });

    // Load available apps
    loadAvailableApps();

    // Check if auto-capture is already running
    const isAutoCapturing = screenshotService.isAutoCapturing();
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

  const handleStartCapture = () => {
    setIsAutoCaptureDialogOpen(true);
  };

  const handleConfirmAutoCapture = () => {
    if (selectedApps.length === 0) return;
    
    setError(null);
    setIsCapturing(true);
    setIsAutoCaptureDialogOpen(false);

    // Save selected apps to settings
    window.electron.ipcRenderer.invoke('save-settings', { selectedApps })
      .catch(console.error);

    try {
      screenshotService.startAutoCaptureWithApps(selectedApps, (screenshot) => {
        setError(null);
        if (onScreenshotTaken) {
          onScreenshotTaken(screenshot);
        }
      });
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('Failed to start auto capture');
      }
      setIsCapturing(false);
    }
  };

  const handleAppToggle = (appName: string) => {
    setSelectedApps(prev =>
      prev.includes(appName)
        ? prev.filter(app => app !== appName)
        : [...prev, appName]
    );
  };

  const handleStopCapture = () => {
    screenshotService.stopAutoCapture();
    setIsCapturing(false);
  };

  const handleManualCapture = async () => {
    try {
      setError(null);
      const screenshot = await screenshotService.captureScreen();
      // Just call the callback, don't send to main process
      if (onScreenshotTaken) {
        onScreenshotTaken(screenshot);
      }
    } catch (error) {
      console.error('Failed to capture screenshot:', error);
      setError(error instanceof Error ? error.message : 'Failed to capture screenshot');
    }
  };

  return (
    <div className="card">
      <div className="flex flex-col gap-6">


        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded p-3 text-destructive text-sm">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={handleManualCapture}
              className="button"
              disabled={!savePath}
            >
              Capture Screenshot
            </button>
            {!isCapturing ? (
              <button
                onClick={handleStartCapture}
                className="button button-secondary"
                disabled={!savePath}
              >
                Start Auto Capture
              </button>
            ) : (
              <button
                onClick={handleStopCapture}
                className="button bg-destructive text-destructive-foreground"
              >
                Stop Auto Capture
              </button>
            )}
          </div>

          <div className="text-sm text-muted-foreground">
            Screenshots are saved to: <span className="text-foreground">{savePath}</span>
          </div>
        </div>
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