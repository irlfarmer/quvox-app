import './index.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './renderer/App';
import { AuthProvider } from './contexts/AuthContext';

// Create root element
const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element not found');
}

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
); 