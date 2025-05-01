import { app } from 'electron';
import path from 'path';
import { AppConfig } from './config';

// Initialize app paths
function initializeAppPaths(): AppConfig['app']['paths'] {
  // For testing environment, use a temporary directory
  if (process.env.NODE_ENV === 'test') {
    const tempDir = path.join(process.cwd(), 'test-data');
    return {
      screenshots: path.join(tempDir, 'screenshots'),
      flows: path.join(tempDir, 'flows'),
      cache: path.join(tempDir, 'cache'),
    };
  }

  // For Electron environment
  const userDataPath = app.getPath('userData');
  return {
    screenshots: path.join(userDataPath, 'Screenshots'),
    flows: path.join(userDataPath, 'Flows'),
    cache: path.join(userDataPath, 'Cache'),
  };
}

// Create configuration object for main process
const mainConfig: AppConfig = {
  supabase: {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
  },
  app: {
    paths: initializeAppPaths(),
    captureInterval: parseInt(process.env.DEFAULT_CAPTURE_INTERVAL || '30000', 10),
  },
  features: {
    debugMode: process.env.ENABLE_DEBUG_MODE === 'true',
  },
};

export default mainConfig; 