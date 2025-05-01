import { app, BrowserWindow, protocol } from 'electron';
import * as path from 'path';

const mainWindow = new BrowserWindow({
  width: 1200,
  height: 800,
  webPreferences: {
    nodeIntegration: false,
    contextIsolation: true,
    preload: path.join(__dirname, 'preload.js'),
    webSecurity: true
  }
});

// Register quvox:// protocol
protocol.registerFileProtocol('quvox', (request: Electron.ProtocolRequest, callback: (response: Electron.ProtocolResponse) => void) => {
  const url = request.url.replace('quvox://', '');
  if (url.startsWith('screenshot/')) {
    const screenshotId = url.replace('screenshot/', '');
    const screenshotPath = path.join(app.getPath('userData'), 'screenshots', screenshotId + '.png');
    callback({ path: screenshotPath });
  }
});

// Set CSP header
mainWindow.webContents.session.webRequest.onHeadersReceived((details: Electron.OnHeadersReceivedListenerDetails, callback: (response: Electron.HeadersReceivedResponse) => void) => {
  callback({
    responseHeaders: {
      ...details.responseHeaders,
      'Content-Security-Policy': [
        "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: quvox: file:; img-src 'self' data: blob: quvox: file:"
      ]
    }
  });
}); 