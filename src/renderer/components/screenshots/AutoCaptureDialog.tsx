import React from 'react';

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
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
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