import React, { useEffect, useState, useRef } from 'react';
import '../styles/globals.css';
import { useAuth } from '../contexts/AuthContext';
import { LoginScreen } from './components/auth/LoginScreen';
import { ScreenshotControl } from './components/ScreenshotControl';
import { Settings } from './components/settings/Settings';
import { Screenshot } from '../utils/screenshot';
import { Flows } from './components/flows/Flows';
import quvoxLogo from '../assets/quvox.png';

const App: React.FC = () => {
  const { user, loading, signOut } = useAuth();
  const [activeTab, setActiveTab] = React.useState<'screenshots' | 'flows' | 'settings'>('screenshots');
  const [recentScreenshots, setRecentScreenshots] = React.useState<Screenshot[]>([]);
  const pendingNotifications = useRef<Set<string>>(new Set());
  const processedScreenshots = useRef<Set<string>>(new Set());

  // Separate effect for loading saved screenshots
  useEffect(() => {
    loadSavedScreenshots();
  }, []);

  // Effect for event listeners
  useEffect(() => {
    // Listen for notifications from the main process
    const notificationHandler = (data: { title: string; body: string; icon?: Electron.NativeImage; screenshotPath?: string }) => {
      if (data.icon) {
        // Convert the NativeImage to a data URL for the web Notification
        const iconDataUrl = (data.icon as any).toDataURL();
        const notification = new Notification(data.title, {
          body: data.body,
          icon: iconDataUrl
        });

        // Handle click event
        notification.onclick = async () => {
          if (data.screenshotPath) {
            await window.electron.ipcRenderer.invoke('open-file', data.screenshotPath);
          }
        };
      } else {
        const notification = new Notification(data.title, {
          body: data.body
        });

        // Handle click event
        notification.onclick = async () => {
          if (data.screenshotPath) {
            await window.electron.ipcRenderer.invoke('open-file', data.screenshotPath);
          }
        };
      }
    };

    // Listen for screenshot captured events
    const screenshotHandler = (screenshot: Screenshot & { showNotification?: boolean }) => {
      // Check if we've already processed this screenshot
      if (processedScreenshots.current.has(screenshot.id)) {
        return;
      }

      // Mark screenshot as processed
      processedScreenshots.current.add(screenshot.id);

      setRecentScreenshots(prev => {
        // Check if screenshot already exists in state
        const exists = prev.some(s => s.id === screenshot.id);
        if (exists) {
          return prev;
        }

        return [screenshot, ...prev].slice(0, 8);
      });
    };
    
    // Add our listeners
    window.electron.ipcRenderer.on('show-notification', notificationHandler);
    window.electron.ipcRenderer.on('screenshot:captured', screenshotHandler);

    // Cleanup function
    return () => {
      window.electron.ipcRenderer.removeListener('show-notification', notificationHandler);
      window.electron.ipcRenderer.removeListener('screenshot:captured', screenshotHandler);
    };
  }, []); // Empty dependency array means this runs once on mount

  const loadSavedScreenshots = async () => {
    try {
      const saved = await window.electron.ipcRenderer.invoke('get-recent-screenshots', undefined);
      setRecentScreenshots(saved.slice(0, 8));
    } catch (error) {
      console.error('Failed to load saved screenshots:', error);
    }
  };

  const handleScreenshotTaken = (screenshot: Screenshot) => {
    setRecentScreenshots(prev => {
      // Check if screenshot already exists
      const exists = prev.some(s => s.id === screenshot.id);
      if (exists) return prev;
      return [screenshot, ...prev].slice(0, 8);
    });
  };

  const handleDeleteScreenshot = async (screenshot: Screenshot) => {
    try {
      await window.electron.ipcRenderer.invoke('delete-screenshot', screenshot.path);
      setRecentScreenshots(prev => prev.filter(s => s.path !== screenshot.path));
    } catch (error) {
      console.error('Failed to delete screenshot:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="text-xl font-medium text-foreground">Loading...</h2>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-background backdrop-blur-sm bg-opacity-80 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="h-12 w-auto">
            <img 
              src={quvoxLogo}
              alt="Quvox Logo"
              className="h-full w-auto object-contain"
            />
          </div>
          <div className="flex items-center gap-6">
            <nav className="flex items-center gap-4">
              <button
                onClick={() => setActiveTab('screenshots')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  activeTab === 'screenshots'
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Screenshots
              </button>
              <button
                onClick={() => setActiveTab('flows')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  activeTab === 'flows'
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Flows
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  activeTab === 'settings'
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Settings
              </button>
            </nav>
            <div className="flex items-center gap-4">
              <div className="text-sm">
                <span className="text-muted-foreground">Signed in as </span>
                <span className="text-foreground">
                  {(user?.user_metadata as { display_name?: string })?.display_name || user?.email}
                </span>
              </div>
              <button
                onClick={signOut}
                className="px-4 py-2 bg-secondary text-foreground rounded-lg hover:bg-secondary/80 transition-colors text-sm"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {activeTab === 'screenshots' && (
          <div className="space-y-6">
            <ScreenshotControl
              onScreenshotTaken={handleScreenshotTaken}
            />
            
            {/* Screenshot Gallery */}
            <div className="card">
              <h2 className="text-xl font-semibold mb-4">Recent Screenshots</h2>
              {recentScreenshots.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {recentScreenshots.slice(0, 8).map((screenshot, index) => (
                    <div key={`${screenshot.id}_${index}`} className="relative group">
                      <img
                        src={screenshot.thumbnail ? `data:image/png;base64,${screenshot.thumbnail}` : `local-file://${screenshot.path}`}
                        alt={`Screenshot from ${new Date(screenshot.timestamp).toLocaleString()}`}
                        className="w-full h-auto rounded-lg"
                      />
                      <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center rounded-lg">
                        <div className="flex gap-2">
                          <button 
                            onClick={() => window.electron.ipcRenderer.invoke('open-file', screenshot.path)}
                            className="px-4 py-2 bg-accent text-accent-foreground rounded-lg hover:bg-accent-hover transition-colors"
                          >
                            View
                          </button>
                          <button 
                            onClick={() => handleDeleteScreenshot(screenshot)}
                            className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:opacity-80 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">Your captured screenshots will appear here</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'flows' && (
          <Flows />
        )}

        {activeTab === 'settings' && (
          <Settings />
        )}
      </main>
    </div>
  );
};

export default App; 