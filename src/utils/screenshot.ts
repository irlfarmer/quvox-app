import path from 'path';

interface CaptureOptions {
  displayId?: number;
  savePath?: string;
}

export interface Screenshot {
  id: string;
  timestamp: number;
  path: string;
  name: string;
  thumbnail?: string;  // base64 encoded PNG for newly captured screenshots
  metadata?: {
    activeWindow?: {
      title: string;
      app: string;
    };
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

export class ScreenshotService {
  private static instance: ScreenshotService;
  private captureInterval: NodeJS.Timeout | null = null;
  private isCapturing = false;
  private screenshotDir: string | null = null;
  private initPromise: Promise<void>;
  private autoCaptureCallback: ((screenshot: Screenshot) => void) | null = null;

  private constructor() {
    this.initPromise = this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Get the appropriate app data directory based on the OS
      const userDataPath = await window.electron.ipcRenderer.invoke('get-app-data-path', {});
      this.screenshotDir = path.join(userDataPath, 'screenshots');

      // Ensure the screenshots directory exists
      await window.electron.ipcRenderer.invoke('ensure-dir', { dirPath: this.screenshotDir });
    } catch (error) {
      console.error('Failed to initialize ScreenshotService:', error);
      throw error;
    }
  }

  public static getInstance(): ScreenshotService {
    if (!ScreenshotService.instance) {
      ScreenshotService.instance = new ScreenshotService();
    }
    return ScreenshotService.instance;
  }

  public async captureScreen(options: CaptureOptions = {}): Promise<Screenshot> {
    try {
      // Wait for initialization to complete
      await this.initPromise;
      
      const { displayId, savePath } = options;
      const timestamp = Date.now();
      const id = `screenshot_${timestamp}`;

      // Get active window information first
      const activeWindow = await window.electron.ipcRenderer.invoke('get-active-window', undefined);

      // Request screenshot capture from main process
      const base64Data = await window.electron.ipcRenderer.invoke('screenshot:capture', {
        displayId,
        timestamp
      });

      if (!base64Data) {
        console.error('❌ Failed to capture screenshot - no base64Data');
        throw new Error('Failed to capture screenshot');
      }

      if (!this.screenshotDir) {
        console.error('❌ Failed to capture screenshot - no screenshot directory');
        throw new Error('Screenshot directory not initialized');
      }

      // Construct the file paths
      const filePath = savePath || path.join(this.screenshotDir, `${id}.png`);
      const metaPath = filePath.replace('.png', '.json');

      // Save the screenshot with metadata
      const screenshotData = await window.electron.ipcRenderer.invoke('screenshot:save', {
        screenshot: base64Data,
        savePath: filePath,
        metaPath,
        metadata: {
          id,
          timestamp,
          name: path.basename(filePath),
          source: 'button',
          category: 'manual',
          activeWindow: activeWindow ? {
            title: activeWindow.title,
            app: activeWindow.owner.name,
            path: activeWindow.owner.path
          } : undefined
        }
      });

      if (!screenshotData) {
        console.error('❌ Failed to save screenshot data');
        throw new Error('Failed to save screenshot');
      }

      return screenshotData;
    } catch (error) {
      console.error('Failed to capture screenshot:', error);
      throw error;
    }
  }

  public async startAutoCapture(callback: (screenshot: Screenshot) => void): Promise<void> {
    try {
      // Don't start immediately, just set up the callback
      this.autoCaptureCallback = callback;
    } catch (error) {
      console.error('Failed to start auto capture:', error);
      throw error;
    }
  }

  public async startAutoCaptureWithApps(apps: string[], callback: (screenshot: Screenshot) => void): Promise<void> {
    try {
      // Start auto-capture in main process
      const response = await window.electron.ipcRenderer.invoke('start-auto-capture', apps);
      if (!response.success) {
        throw new Error(response.error || 'Failed to start auto capture');
      }

      this.isCapturing = true;
      this.autoCaptureCallback = callback;

      // Get the current settings to use the user's preferred interval
      const settings = await window.electron.ipcRenderer.invoke('load-settings', undefined);
      const interval = (settings.captureInterval || 5) * 1000; // Convert seconds to milliseconds

      // Start the capture interval
      this.captureInterval = setInterval(async () => {
        try {
          // Get active window info
          const activeWindow = await window.electron.ipcRenderer.invoke('get-active-window', undefined);
          if (!activeWindow) {
            return;
          }

          // Check if active window belongs to a tracked app
          const isTrackedApp = apps.some(app => 
            activeWindow.owner.name.toLowerCase().includes(app.toLowerCase()) ||
            activeWindow.title.toLowerCase().includes(app.toLowerCase())
          );

          if (!isTrackedApp) {
            return; // Not a tracked app, skip capture
          }

          // Take screenshot with app info
          const screenshot = await this.captureScreen();
          screenshot.metadata = {
            ...screenshot.metadata,
            activeWindow: {
              title: activeWindow.title,
              app: activeWindow.owner.name
            }
          };

          if (this.autoCaptureCallback) {
            this.autoCaptureCallback(screenshot);
          }
        } catch (error) {
          console.error('Error in auto-capture interval:', error);
        }
      }, interval);
    } catch (error) {
      console.error('Error starting auto-capture:', error);
      throw error;
    }
  }

  public async stopAutoCapture(): Promise<void> {
    try {
      // Stop auto-capture in main process
      await window.electron.ipcRenderer.invoke('stop-auto-capture', undefined);
      
      this.isCapturing = false;
      if (this.captureInterval) {
        clearInterval(this.captureInterval);
        this.captureInterval = null;
      }
      this.autoCaptureCallback = null;
    } catch (error) {
      console.error('Failed to stop auto capture:', error);
      throw error;
    }
  }

  public isAutoCapturing(): boolean {
    return this.isCapturing;
  }

  public async getScreenshotDirectory(): Promise<string> {
    await this.initPromise;
    if (!this.screenshotDir) {
      throw new Error('Screenshot directory not initialized');
    }
    return this.screenshotDir;
  }
}