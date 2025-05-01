import React, { useState, useEffect } from 'react';
import { Flow, FlowStep } from '../../../types/flows';
import { FlowList } from './FlowList';
import { FlowEditor } from './FlowEditor';
import { supabase } from '../../../utils/supabase';
import { flowStorage } from '../../../utils/flowStorage';
import { Screenshot } from '../../../types/screenshot';
import path from 'path';

interface CreateFlowDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateEmpty: (name: string) => void;
  onCreateFromScreenshots: (name: string, screenshots: string[]) => void;
  availableScreenshots: Screenshot[];
}

const CreateFlowDialog: React.FC<CreateFlowDialogProps> = ({
  isOpen,
  onClose,
  onCreateEmpty,
  onCreateFromScreenshots,
  availableScreenshots
}) => {
  const [selectedScreenshots, setSelectedScreenshots] = useState<string[]>([]);
  const [flowName, setFlowName] = useState('');
  const [expandedApps, setExpandedApps] = useState<Set<string>>(new Set());

  // Group screenshots by app
  const screenshotsByApp = React.useMemo(() => {
    const groups: { [key: string]: Screenshot[] } = {};
    availableScreenshots.forEach(screenshot => {
      const appName = screenshot.metadata?.activeWindow?.app || 'Other';
      if (!groups[appName]) {
        groups[appName] = [];
      }
      groups[appName].push(screenshot);
    });
    return groups;
  }, [availableScreenshots]);

  const toggleApp = (appName: string) => {
    setExpandedApps(prev => {
      const next = new Set(prev);
      if (next.has(appName)) {
        next.delete(appName);
      } else {
        next.add(appName);
      }
      return next;
    });
  };

  const toggleScreenshot = (screenshotId: string) => {
    setSelectedScreenshots(prev => {
      if (prev.includes(screenshotId)) {
        return prev.filter(id => id !== screenshotId);
      }
      return [...prev, screenshotId];
    });
  };

  const handleCreate = () => {
    if (!flowName.trim()) return;
    
    if (selectedScreenshots.length > 0) {
      onCreateFromScreenshots(flowName, selectedScreenshots);
    } else {
      onCreateEmpty(flowName);
    }
    onClose();
    setFlowName('');
    setSelectedScreenshots([]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-background rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        <h3 className="text-lg font-semibold mb-4 text-foreground">Create New Flow</h3>
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2 text-foreground">Flow Name</label>
          <input
            type="text"
            value={flowName}
            onChange={(e) => setFlowName(e.target.value)}
            placeholder="Enter flow name"
            className="w-full bg-secondary text-foreground rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-accent transition-all"
          />
        </div>

        <div className="flex-1 overflow-auto">
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-foreground">Select Screenshots by Application</label>
              <span className="text-sm text-muted-foreground">Selected: {selectedScreenshots.length}</span>
            </div>
            
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {Object.entries(screenshotsByApp).map(([appName, screenshots]) => (
                <div key={appName} className="bg-secondary rounded-lg overflow-hidden">
                  <button
                    className="w-full px-4 py-2 text-foreground flex justify-between items-center hover:bg-secondary/80 transition-colors"
                    onClick={() => toggleApp(appName)}
                  >
                    <span>{appName}</span>
                    <span className="text-sm text-muted-foreground">
                      {screenshots.length} screenshots
                    </span>
                  </button>
                  
                  {expandedApps.has(appName) && (
                    <div className="p-4 grid grid-cols-2 gap-4 bg-background">
                      {screenshots.map(screenshot => (
                        <div
                          key={screenshot.id}
                          className={`relative rounded-lg overflow-hidden cursor-pointer transition-all transform hover:scale-[1.02] ${
                            selectedScreenshots.includes(screenshot.id)
                              ? 'ring-2 ring-accent ring-opacity-70'
                              : ''
                          }`}
                          onClick={() => toggleScreenshot(screenshot.id)}
                        >
                          <img
                            src={`data:image/png;base64,${screenshot.thumbnail}`}
                            alt={screenshot.name}
                            className="w-full h-32 object-cover"
                          />
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                            <p className="text-white text-sm truncate">
                              {screenshot.metadata?.activeWindow?.title || screenshot.name}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4 pt-4 bg-background">
          <button
            className="px-4 py-2 bg-secondary text-foreground rounded-lg hover:bg-secondary/80 transition-colors"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 bg-accent text-accent-foreground rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleCreate}
            disabled={!flowName.trim()}
          >
            Create Flow
          </button>
        </div>
      </div>
    </div>
  );
};

export const Flows: React.FC = () => {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [selectedFlow, setSelectedFlow] = useState<Flow | null>(null);
  const [flowSteps, setFlowSteps] = useState<FlowStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [availableScreenshots, setAvailableScreenshots] = useState<Screenshot[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    loadFlows();
    loadScreenshots();
  }, []);

  useEffect(() => {
    if (selectedFlow) {
      loadFlowSteps(selectedFlow.id);
    }
  }, [selectedFlow]);

  const loadScreenshots = async () => {
    try {
      const screenshots = await window.electron.ipcRenderer.invoke('get-recent-screenshots', undefined);
      setAvailableScreenshots(screenshots);
    } catch (error) {
      console.error('Error loading screenshots:', error);
    }
  };

  const loadFlows = async () => {
    try {
      setError(null);
      setLoading(true);
      const localFlows = await flowStorage.getFlows();
      setFlows(Array.isArray(localFlows) ? localFlows : []);
    } catch (error) {
      setError('Failed to load flows');
      setFlows([]);
    } finally {
      setLoading(false);
    }
  };

  const loadFlowSteps = async (flowId: string) => {
    try {
      setError(null);
      const steps = await flowStorage.getFlowSteps(flowId);
      if (!Array.isArray(steps)) {
        setFlowSteps([]);
        return;
      }
      setFlowSteps(steps);
    } catch (error) {
      setError('Failed to load flow steps');
      setFlowSteps([]);
    }
  };

  const handleCreateEmptyFlow = async (name: string) => {
    try {
      setError(null);
      const newFlow = await flowStorage.createFlow({
        name,
        flow_type: 'custom'
      });
      await loadFlows();
      setSelectedFlow(newFlow);
    } catch (error) {
      console.error('Error creating new flow:', error);
      setError('Failed to create new flow');
    }
  };

  const handleCreateFlowFromScreenshots = async (name: string, screenshots: string[]) => {
    try {
      setError(null);
      const newFlow = await flowStorage.createFlow({
        name,
        flow_type: 'custom',
        screenshots
      });

      // Immediately load the flow steps after creation
      const steps = await flowStorage.getFlowSteps(newFlow.id);
      if (!Array.isArray(steps)) {
        setFlowSteps([]);
      } else {
        setFlowSteps(steps);
      }
      
      await loadFlows();
      setSelectedFlow(newFlow);
    } catch (error) {
      setError('Failed to create new flow');
    }
  };

  const handleDeleteFlow = async (flow: Flow) => {
    try {
      setError(null);
      await flowStorage.deleteFlow(flow.id);
      await loadFlows();
      if (selectedFlow?.id === flow.id) {
        setSelectedFlow(null);
        setFlowSteps([]);
      }
    } catch (error) {
      console.error('Error deleting flow:', error);
      setError('Failed to delete flow');
    }
  };

  const handleSaveFlow = async (flow: Flow, steps: FlowStep[]) => {
    try {
      setError(null);
      
      // Save flow
      const flows = await flowStorage.getFlows();
      const updatedFlows = Array.isArray(flows) ? flows.map(f => f.id === flow.id ? flow : f) : [flow];
      await flowStorage.saveFlows(updatedFlows);

      // Save steps with their connections
      await flowStorage.saveFlowSteps(flow.id, steps);

      // Refresh flows list and reload steps
      await loadFlows();
      await loadFlowSteps(flow.id);
    } catch (error) {
      setError('Failed to save flow');
    }
  };

  const handlePublishFlow = async (flow: Flow) => {
    try {
      setError(null);
      const steps = await flowStorage.getFlowSteps(flow.id);
      await flowStorage.publishFlow(flow, Array.isArray(steps) ? steps : [], supabase);
      await loadFlows(); // Refresh to get updated published status
    } catch (error) {
      console.error('Error publishing flow:', error);
      setError('Failed to publish flow');
    }
  };

  const handleImportFlow = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      setIsImporting(true);
      try {
        const text = await file.text();
        const importData = JSON.parse(text);
        
        // First create the flow using flowStorage
        const newFlow = await flowStorage.createFlow({
          name: importData.flow.name,
          flow_type: importData.flow.flow_type || 'custom'
        });

        // Create a mapping of IDs to new step IDs
        const idMapping: { [oldId: string]: string } = {};

        // First pass: Process steps and save screenshots
        const processedSteps = await Promise.all(importData.steps.map(async (step: any, index: number) => {
          const newStepId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${index}`;
          
          // Store the mapping for the full ID
          idMapping[step.id] = newStepId;
          
          let screenshotId = null;
          let screenshotData = null;

          // Handle screenshot data - try different possible formats
          const screenshot = step.screenshot_data || step.metadata?.screenshot?.data;
          if (screenshot) {
            const timestamp = Date.now();
            const id = `screenshot_${timestamp}`;
            
            // Get screenshot directory
            const screenshotDir = await window.electron.ipcRenderer.invoke('get-app-data-path', {});
            const savePath = path.join(screenshotDir, 'screenshots', `${id}.png`);
            const metaPath = savePath.replace('.png', '.json');
            
            // Create proper metadata object
            const metadata = JSON.stringify({
              id,
              timestamp,
              name: `${id}.png`,
              path: savePath,
              source: 'import',
              category: 'manual',
              activeWindow: {
                title: step.name || 'Imported Step',
                app: step.metadata?.screenshot?.app || step.metadata?.app || 'Imported Flow',
                path: ''
              }
            }, null, 2);

            try {
              // Save the screenshot using the same method as capture
              screenshotData = await window.electron.ipcRenderer.invoke('screenshot:save', {
                screenshot,
                savePath,
                metaPath,
                metadata
              });

              if (screenshotData) {
                screenshotId = screenshotData.id;
              }
            } catch (error) {
              console.error('Failed to save screenshot:', error);
              // Continue without the screenshot if saving fails
            }
          }
          
          // Create the step with updated metadata
          const processedStep = {
            ...step,
            id: newStepId,
            screenshot_id: screenshotId,
            metadata: {
              ...step.metadata,
              screenshot: screenshotData ? {
                id: screenshotData.id,
                data: screenshot,
                thumbnail: screenshotData?.thumbnail,
                app: step.metadata?.screenshot?.app || step.metadata?.app || 'Imported Flow',
                title: step.name || 'Imported Step'
              } : undefined
            }
          };

          return processedStep;
        }));

        // Second pass: Update connections using the ID mapping
        const stepsWithUpdatedConnections = processedSteps.map(step => ({
          ...step,
          metadata: {
            ...step.metadata,
            connections: {
              to: (step.metadata?.connections?.to || []).map((targetId: string) => {
                // Try to find the new ID using the full ID
                const newId = idMapping[targetId];
                if (!newId) {
                  console.warn(`Could not find mapping for connection target ID: ${targetId}`);
                }
                return newId;
              }).filter(Boolean)
            }
          }
        }));

        // Save the steps using flowStorage
        await flowStorage.saveFlowSteps(newFlow.id, stepsWithUpdatedConnections);

        // Refresh the flows list and select the new flow
        await loadFlows();
        setSelectedFlow(newFlow);
      } catch (error) {
        console.error('Error importing flow:', error);
        setError('Failed to import flow');
      } finally {
        setIsImporting(false);
      }
    };

    input.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading flows...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-destructive">{error}</p>
          <button
            className="mt-4 px-4 py-2 bg-accent text-accent-foreground rounded-lg hover:opacity-80 transition-opacity"
            onClick={loadFlows}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full">
      {isImporting ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent border-t-transparent mb-4"></div>
            <p className="text-foreground">Importing flow...</p>
          </div>
        </div>
      ) : selectedFlow ? (
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between p-6 pb-0">
            <h1 className="text-2xl font-bold text-foreground">{selectedFlow.name}</h1>
            <div className="flex gap-2">
              {!selectedFlow.is_published && (
                <button
                  className="px-4 py-2 bg-accent text-accent-foreground rounded-lg hover:opacity-80 transition-opacity"
                  onClick={() => handlePublishFlow(selectedFlow)}
                >
                  Publish Flow
                </button>
              )}
              <button
                className="px-4 py-2 bg-secondary text-foreground rounded-lg hover:opacity-80 transition-opacity"
                onClick={() => setSelectedFlow(null)}
              >
                Back to Flows
              </button>
            </div>
          </div>
          <div className="flex-1 p-6 pt-4 min-h-0 overflow-auto">
            <div className="w-full h-full">
              <FlowEditor
                key={selectedFlow.id}
                flow={selectedFlow}
                steps={flowSteps}
                onSave={handleSaveFlow}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="p-6">
          <FlowList
            flows={flows}
            onSelect={setSelectedFlow}
            onDelete={handleDeleteFlow}
            onNew={() => setIsCreateDialogOpen(true)}
            onImport={handleImportFlow}
          />
          <CreateFlowDialog
            isOpen={isCreateDialogOpen}
            onClose={() => setIsCreateDialogOpen(false)}
            onCreateEmpty={handleCreateEmptyFlow}
            onCreateFromScreenshots={handleCreateFlowFromScreenshots}
            availableScreenshots={availableScreenshots}
          />
        </div>
      )}
    </div>
  );
}; 