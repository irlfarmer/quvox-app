import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Flow, FlowStep, FlowConnection, ScreenshotMetadata } from '../../../types/flows';
import { supabase } from '../../../utils/rendererSupabase';

// Define App type locally
interface App {
  id: string;
  name: string;
  description?: string;
  icon_url?: string;
}

interface FlowEditorProps {
  flow: Flow;
  steps: FlowStep[];
  onSave: (flow: Flow, steps: FlowStep[]) => void;
}

interface ConnectionPoint {
  stepId: string;
  x: number;
  y: number;
}

interface FlowEditorState {
  isDragging: boolean;
  isConnecting: boolean;
  connectionStart: ConnectionPoint | null;
  mousePosition: { x: number; y: number } | null;
  isSelecting: boolean;
  selectionStart: { x: number; y: number } | null;
  selectionEnd: { x: number; y: number } | null;
  selectedSteps: string[];
}

interface DraggableFlowStep extends FlowStep {
  dragOffset?: {
    x: number;
    y: number;
  };
  selectedStepsOffsets?: {
    id: string;
    initialX: number;
    initialY: number;
    offsetX: number;
    offsetY: number;
  }[];
}

interface UploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (appId: string | null) => Promise<void>;
  apps: App[];
}

export const FlowEditor: React.FC<FlowEditorProps> = ({ flow, steps, onSave }) => {
  const [editorState, setEditorState] = useState<FlowEditorState>({
    isDragging: false,
    isConnecting: false,
    connectionStart: null,
    mousePosition: null,
    isSelecting: false,
    selectionStart: null,
    selectionEnd: null,
    selectedSteps: [] as string[]
  });

  const [flowSteps, setFlowSteps] = useState<FlowStep[]>(steps);
  const [connections, setConnections] = useState<FlowConnection[]>([]);
  const [editingStep, setEditingStep] = useState<FlowStep | null>(null);
  
  const editorRef = useRef<HTMLDivElement>(null);
  const draggedStep = useRef<DraggableFlowStep | null>(null);
  const connectionLine = useRef<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

  const [screenshots, setScreenshots] = useState<any[]>([]);
  const [isAddingStep, setIsAddingStep] = useState(false);
  const [newStepName, setNewStepName] = useState('');
  const [newStepDescription, setNewStepDescription] = useState('');
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);

  const [editorSize, setEditorSize] = useState({ width: '100%', height: '100%' });
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartPos = useRef({ x: 0, y: 0 });
  const initialSize = useRef({ width: 0, height: 0 });

  const [expandedImage, setExpandedImage] = useState<{
    id: string;
    title: string;
    data?: string;
    zoom?: number;
  } | null>(null);

  const [selectionBox, setSelectionBox] = useState<{
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  } | null>(null);

  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [apps, setApps] = useState<App[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
  const [errorModalMessage, setErrorModalMessage] = useState('');
  const [errorModalTitle, setErrorModalTitle] = useState('');

  // Update flowSteps when steps prop changes
  useEffect(() => {
    
    const stepsWithPositions = (Array.isArray(steps) ? steps : []).map((step, index) => ({
      ...step,
      metadata: {
        ...step.metadata,
        position: step.metadata?.position || {
          x: 200 + (index * 300),
          y: 300
        }
      }
    }));
    
    setFlowSteps(stepsWithPositions);

    // Extract connections from steps
    const existingConnections = stepsWithPositions.reduce((acc: FlowConnection[], step) => {
      const stepConnections = step.metadata?.connections?.to || [];
      return [
        ...acc,
        ...stepConnections.map(targetId => ({
          source: step.id,
          target: targetId,
          type: 'normal' as const
        }))
      ];
    }, []);
    
    setConnections(existingConnections);
  }, [steps]);

  // Handle ESC key to cancel actions
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Cancel connection if connecting
        if (editorState.isConnecting) {
          setEditorState(prev => ({
            ...prev,
            isConnecting: false,
            connectionStart: null,
            mousePosition: null
          }));
        }
        
        // Clear selection if any steps are selected
        if (editorState.selectedSteps.length > 0) {
          setEditorState(prev => ({
            ...prev,
            selectedSteps: []
          }));
        }
        
        // Close image preview if open
        if (expandedImage) {
          setExpandedImage(null);
        }
        
        // Close step editing if open
        if (editingStep) {
          setEditingStep(null);
        }

        // Close add step dialog if open
        if (isAddingStep) {
          setIsAddingStep(false);
          setNewStepName('');
          setNewStepDescription('');
          setSelectedScreenshot(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editorState.isConnecting, editorState.selectedSteps, expandedImage, editingStep, isAddingStep]);

  // Cancel connection handler
  const handleCancelConnection = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // Only cancel if clicking on the editor background (not on steps or other elements)
    if (target === editorRef.current && editorState.isConnecting) {
      setEditorState(prev => ({
        ...prev,
        isConnecting: false,
        connectionStart: null,
        mousePosition: null
      }));
    }
  };

  // Load screenshots when adding a new step
  useEffect(() => {
    // Load screenshots on mount and when adding a step
    window.electron.ipcRenderer.invoke('get-recent-screenshots', undefined)
      .then(result => setScreenshots(result));
  }, []);  // Empty dependency array means this runs once on mount

  // Handle step dragging
  const handleStepDragStart = (step: FlowStep, e: React.DragEvent) => {
    e.stopPropagation();
    const rect = editorRef.current?.getBoundingClientRect();
    if (!rect) return;

    const scrollLeft = editorRef.current.scrollLeft;
    const scrollTop = editorRef.current.scrollTop;
    const offsetX = e.clientX - rect.left + scrollLeft - step.metadata?.position?.x;
    const offsetY = e.clientY - rect.top + scrollTop - step.metadata?.position?.y;
    
    // Store initial positions of all selected steps
    const selectedStepsInitialPositions = flowSteps
      .filter(s => editorState.selectedSteps.includes(s.id))
      .map(s => ({
        id: s.id,
        initialX: s.metadata?.position?.x || 0,
        initialY: s.metadata?.position?.y || 0,
        offsetX: (s.metadata?.position?.x || 0) - (step.metadata?.position?.x || 0),
        offsetY: (s.metadata?.position?.y || 0) - (step.metadata?.position?.y || 0)
      }));
    
    draggedStep.current = {
      ...step,
      dragOffset: { x: offsetX, y: offsetY },
      selectedStepsOffsets: selectedStepsInitialPositions
    };
    
    setEditorState(prev => ({ ...prev, isDragging: true }));
  };

  const handleStepDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedStep.current || !editorRef.current) return;

    const rect = editorRef.current.getBoundingClientRect();
    const scrollLeft = editorRef.current.scrollLeft;
    const scrollTop = editorRef.current.scrollTop;
    const x = e.clientX - rect.left + scrollLeft - draggedStep.current.dragOffset?.x;
    const y = e.clientY - rect.top + scrollTop - draggedStep.current.dragOffset?.y;

    setFlowSteps(prev => 
      prev.map(step => {
        // If this is the main dragged step
        if (step.id === draggedStep.current?.id) {
          return {
            ...step,
            metadata: {
              ...step.metadata,
              position: { x, y }
            }
          };
        }
        // If this is one of the selected steps
        else if (editorState.selectedSteps.includes(step.id)) {
          const offset = draggedStep.current.selectedStepsOffsets?.find(o => o.id === step.id);
          if (offset) {
            return {
              ...step,
              metadata: {
                ...step.metadata,
                position: {
                  x: x + offset.offsetX,
                  y: y + offset.offsetY
                }
              }
            };
          }
        }
        return step;
      })
    );
  };

  const handleStepDragEnd = () => {
    setEditorState(prev => ({ ...prev, isDragging: false }));
    draggedStep.current = null;
  };

  // Handle connection creation
  const handleConnectionStart = (stepId: string, point: { x: number; y: number }) => {
    
    const step = flowSteps.find(s => s.id === stepId);
    if (!step?.metadata?.position) return;
    
    setEditorState(prev => ({
      ...prev,
      isConnecting: true,
      connectionStart: {
        stepId,
        x: point.x,
        y: point.y
      },
      mousePosition: { x: point.x, y: point.y }
    }));
  };

  const handleConnectionMove = (e: React.MouseEvent) => {
    if (editorState.isConnecting) {
      const rect = editorRef.current?.getBoundingClientRect();
      if (rect) {
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        setEditorState(prev => ({
          ...prev,
          mousePosition: { x, y }
        }));
      }
    }
  };

  const handleConnectionEnd = (stepId: string, point: { x: number; y: number }) => {
    
    if (editorState.isConnecting && editorState.connectionStart?.stepId !== stepId) {
      // Check if connection already exists
      const connectionExists = connections.some(
        conn => conn.source === editorState.connectionStart?.stepId && conn.target === stepId
      );

      if (!connectionExists) {

        const newConnection = {
          source: editorState.connectionStart!.stepId,
          target: stepId,
          type: 'normal' as const
        };
        setConnections(prev => [...prev, newConnection]);
        
        // Update the step's metadata to include the connection
        setFlowSteps(prev => prev.map(step => {
          if (step.id === editorState.connectionStart!.stepId) {
            return {
              ...step,
              metadata: {
                ...step.metadata,
                connections: {
                  ...step.metadata?.connections,
                  to: [...(step.metadata?.connections?.to || []), stepId]
                }
              }
            };
          }
          return step;
        }));
      }
    }
    setEditorState(prev => ({
      ...prev,
      isConnecting: false,
      connectionStart: null,
      mousePosition: null
    }));
  };

  const handleStepEdit = (step: FlowStep) => {
    setEditingStep(step);
  };

  const handleStepUpdate = (updatedStep: FlowStep) => {
    setFlowSteps(prev => 
      prev.map(step => step.id === updatedStep.id ? updatedStep : step)
    );
    setEditingStep(null);
  };

  const getConnectionPoints = (step: FlowStep): ConnectionPoint[] => {
    const { x = 0, y = 0 } = step.metadata?.position || {};
    return [
      { stepId: step.id, x: x - 128, y },
      { stepId: step.id, x: x + 128, y },
      { stepId: step.id, x, y: y - 80 },
      { stepId: step.id, x, y: y + 80 }
    ];
  };

  const handleStepDelete = (step: FlowStep) => {
    setFlowSteps(steps => steps.filter(s => s.id !== step.id));
    setConnections(conns => conns.filter(c => c.source !== step.id && c.target !== step.id));
  };

  const handleAddStep = () => {
    setIsAddingStep(true);
  };

  const handleAddStepConfirm = () => {
    const selectedScreenshotData = screenshots.find(s => s.id === selectedScreenshot);
    if (!selectedScreenshotData) return;
    
    // Grid configuration
    const GRID_COLS = 3;
    const STEP_WIDTH = 300;
    const STEP_HEIGHT = 250;
    const INITIAL_OFFSET_X = 200;
    const INITIAL_OFFSET_Y = 200;
    
    // Calculate grid position
    const stepIndex = flowSteps.length;
    const row = Math.floor(stepIndex / GRID_COLS);
    const col = stepIndex % GRID_COLS;
    
    const newStep: FlowStep = {
      id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      flow_id: flow.id,
      name: newStepName,
      description: newStepDescription,
      screenshot_id: selectedScreenshot,
      parent_step_id: null,
      order_index: flowSteps.length,
      metadata: {
        position: {
          x: INITIAL_OFFSET_X + (col * STEP_WIDTH * 1.2), // Add 20% spacing between steps
          y: INITIAL_OFFSET_Y + (row * STEP_HEIGHT * 1.2)
        },
        connections: {
          to: []
        },
        screenshot: {
          thumbnail: selectedScreenshotData.thumbnail || '',
          data: selectedScreenshotData.data,
          app: selectedScreenshotData.metadata?.activeWindow?.app || 'Unknown App',
          title: selectedScreenshotData.metadata?.activeWindow?.title || newStepName
        }
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    setFlowSteps(steps => [...steps, newStep]);
    setIsAddingStep(false);
    setNewStepName('');
    setNewStepDescription('');
    setSelectedScreenshot(null);
  };

  const handleClearConnections = () => {
    setConnections([]);
  };

  // Add zoom controls
  const handleZoomIn = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedImage(prev => prev ? { ...prev, zoom: (prev.zoom || 1) * 1.2 } : null);
  };

  const handleZoomOut = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedImage(prev => prev ? { ...prev, zoom: Math.max(0.1, (prev.zoom || 1) / 1.2) } : null);
  };

  const handleResetZoom = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedImage(prev => prev ? { ...prev, zoom: 1 } : null);
  };

  const handleDeleteConnection = (connection: FlowConnection) => {
    // Remove the connection from connections array
    setConnections(prev => prev.filter(conn => 
      !(conn.source === connection.source && conn.target === connection.target)
    ));

    // Update the source step's metadata to remove the connection
    setFlowSteps(prev => prev.map(step => {
      if (step.id === connection.source) {
        return {
          ...step,
          metadata: {
            ...step.metadata,
            connections: {
              ...step.metadata?.connections,
              to: (step.metadata?.connections?.to || []).filter(id => id !== connection.target)
            }
          }
        };
      }
      return step;
    }));
  };

  const handleSelectionStart = (e: React.MouseEvent) => {
    if (!editorRef.current) return;
    const rect = editorRef.current.getBoundingClientRect();
    const scrollLeft = editorRef.current.scrollLeft;
    const scrollTop = editorRef.current.scrollTop;
    const x = e.clientX - rect.left + scrollLeft;
    const y = e.clientY - rect.top + scrollTop;
    
    setEditorState(prev => ({
      ...prev,
      isSelecting: true,
      selectionStart: { x, y },
      selectionEnd: { x, y }
    }));
    
    setSelectionBox({
      startX: x,
      startY: y,
      endX: x,
      endY: y
    });
  };

  const handleSelectionMove = (e: React.MouseEvent) => {
    if (!editorState.isSelecting || !editorRef.current) return;
    
    const rect = editorRef.current.getBoundingClientRect();
    const scrollLeft = editorRef.current.scrollLeft;
    const scrollTop = editorRef.current.scrollTop;
    const x = e.clientX - rect.left + scrollLeft;
    const y = e.clientY - rect.top + scrollTop;
    
    setEditorState(prev => ({
      ...prev,
      selectionEnd: { x, y }
    }));
    
    setSelectionBox(prev => prev ? {
      ...prev,
      endX: x,
      endY: y
    } : null);

    // Update selected steps
    const selectedSteps = flowSteps.filter(step => {
      const pos = step.metadata?.position;
      if (!pos || !selectionBox) return false;

      const boxLeft = Math.min(selectionBox.startX, x);
      const boxRight = Math.max(selectionBox.startX, x);
      const boxTop = Math.min(selectionBox.startY, y);
      const boxBottom = Math.max(selectionBox.startY, y);

      return pos.x >= boxLeft && pos.x <= boxRight && 
             pos.y >= boxTop && pos.y <= boxBottom;
    }).map(step => step.id);

    setEditorState(prev => ({
      ...prev,
      selectedSteps
    }));
  };

  const handleSelectionEnd = () => {
    setEditorState(prev => ({
      ...prev,
      isSelecting: false,
      selectionStart: null,
      selectionEnd: null
    }));
    setSelectionBox(null);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Delete selected steps
        if (editorState.selectedSteps.length > 0) {
          const remainingSteps = flowSteps.filter(step => !editorState.selectedSteps.includes(step.id));
          // Also remove any connections to/from deleted steps
          const updatedSteps = remainingSteps.map(step => ({
            ...step,
            metadata: {
              ...step.metadata,
              connections: {
                to: (step.metadata?.connections?.to || [])
                  .filter(targetId => !editorState.selectedSteps.includes(targetId))
              }
            }
          }));
          setFlowSteps(updatedSteps);
          setEditorState(prev => ({
            ...prev,
            selectedSteps: []
          }));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [flowSteps, editorState.selectedSteps]);

  // Add a function to check if mouse is near any connection point
  const isNearConnectionPoint = (mouseX: number, mouseY: number): boolean => {
    const snapDistance = 20; // Same as our connection snap distance
    
    return flowSteps.some(step => {
      if (step.id === editorState.connectionStart?.stepId) return false; // Skip source step
      
      const pos = step.metadata?.position;
      if (!pos) return false;
      
      // Check left and right connection points
      const leftPoint = { x: pos.x - 96, y: pos.y };
      const rightPoint = { x: pos.x + 96, y: pos.y };
      
      const distanceToLeft = Math.sqrt(
        Math.pow(mouseX - leftPoint.x, 2) + Math.pow(mouseY - leftPoint.y, 2)
      );
      const distanceToRight = Math.sqrt(
        Math.pow(mouseX - rightPoint.x, 2) + Math.pow(mouseY - rightPoint.y, 2)
      );
      
      return distanceToLeft <= snapDistance || distanceToRight <= snapDistance;
    });
  };

  const handleExportFlow = async () => {
    try {
      // Get screenshot data for each step
      const stepsWithImages = flowSteps.map(step => {
        let screenshotData = null;
        if (step.screenshot_id) {
          screenshotData = screenshots.find(s => s.id === step.screenshot_id);
        }

        // Create a clean version of the metadata without private paths
        const cleanMetadata = {
          ...step.metadata,
          screenshot: step.metadata?.screenshot ? {
            thumbnail: step.metadata.screenshot.thumbnail,
            data: step.metadata.screenshot.data,
            app: step.metadata.screenshot.app,
            title: step.metadata.screenshot.title
          } : null
        };

        return {
          ...step,
          id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${step.id}`,
          flow_id: null as string | null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          screenshot_data: screenshotData?.data || null,
          thumbnail_data: screenshotData?.thumbnail || null,
          metadata: cleanMetadata
        };
      });

      // Create export data structure
      const exportData = {
        flow: {
          ...flow,
          id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          is_published: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        steps: stepsWithImages
      };

      // Convert to JSON string
      const jsonString = JSON.stringify(exportData, null, 2);
      
      // Create blob and download
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      
      // Create temporary link and trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = `${flow.name.toLowerCase().replace(/\s+/g, '-')}-flow.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting flow:', error);
    }
  };

  // Add the handler function near other handlers
  const handleUploadFlow = () => {
    setIsUploadDialogOpen(true);
  };

  // Add this effect to load apps
  useEffect(() => {
    const loadApps = async () => {
      try {
        const { data: apps } = await window.electron.ipcRenderer.invoke('get-apps', {});
        setApps(apps || []);
      } catch (error) {
        console.error('Failed to load apps:', error);
      }
    };
    loadApps();
  }, []);

  // Add the upload handler
  const handleUpload = async (appId: string | null) => {
    setIsProcessing(true);
    try {
      // Create flow first to get the flow ID
      const flowResponse = await window.electron.ipcRenderer.invoke(
        'create-flow',
        {
          name: flow.name,
          app_id: appId,
          resolution: `${window.screen.width}x${window.screen.height}`,
          is_published: false,
          flow_type: flow.flow_type || 'custom'
        }
      );


      if (flowResponse.error) {
        console.error('Detailed flow creation error:', {
          error: flowResponse.error,
          response: flowResponse
        });
        throw new Error(`Failed to create flow: ${flowResponse.error}`);
      }

      if (!flowResponse.data?.id) {
        console.error('Invalid flow response structure:', flowResponse);
        throw new Error('Flow response missing ID');
      }

      const newFlow = flowResponse.data;
  

      // Process screenshots and create steps
      
      let successCount = 0;
      let errorCount = 0;
      
      for (const step of flowSteps) {
        try {
          if (!step.metadata?.screenshot?.data) {
            console.warn('Skipping step due to missing screenshot data:', step.id);
            continue;
          }


          // Create screenshot record first
          const screenshotResponse = await window.electron.ipcRenderer.invoke(
            'create-screenshot',
            {
              storage_path: `${step.id}.png`,
              resolution: `${window.screen.width}x${window.screen.height}`,
              app_name: appId ? apps.find(a => a.id === appId)?.name : 'Other',
              metadata: {
                activeWindow: {
                  title: step.metadata.screenshot.title || step.name,
                  app: step.metadata.screenshot.app || 'Other'
                }
              }
            }
          );

          

          if (screenshotResponse.error) {
            console.error('Screenshot creation error:', screenshotResponse.error);
            errorCount++;
            continue;
          }

          // Extract the first screenshot from the array response
          const screenshot = Array.isArray(screenshotResponse.data) ? screenshotResponse.data[0] : screenshotResponse.data;

          if (!screenshot || screenshot.error || !screenshot.id) {
            console.error('Invalid screenshot response:', screenshotResponse);
            errorCount++;
            continue;
          }

          // Clean up metadata before uploading - keep structure but empty sensitive fields
          const cleanMetadata = {
            ...step.metadata,
            position: step.metadata.position,
            connections: step.metadata.connections,
            original_id: step.id,  // Preserve the original step ID
            screenshot: {
              thumbnail: '',  // Empty the thumbnail field
              data: '',  // Empty the data field
              app: step.metadata.screenshot.app,
              title: step.metadata.screenshot.title,
            }
          };

          // Upload the image to Supabase Storage
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('screenshots')
            .upload(`${step.id}.png`, base64ToBlob(step.metadata.screenshot.data), {
              contentType: 'image/png',
              upsert: true
            });

          if (uploadError) {
            console.error('Screenshot upload failed:', uploadError);
            errorCount++;
            continue;
          }

          

          // Create step record


          const stepResponse = await window.electron.ipcRenderer.invoke(
            'create-flow-step',
            {
              flow_id: newFlow.id,
              name: step.name,
              description: step.description,
              screenshot_id: screenshot.id,
              parent_step_id: null,
              order_index: step.order_index,
              metadata: cleanMetadata
            }
          );

          

          if (!stepResponse.data || !Array.isArray(stepResponse.data) || stepResponse.data.length === 0) {
            console.error('Invalid step creation response format:', stepResponse);
            setErrorModalTitle('Step Creation Error');
            setErrorModalMessage(`Failed to create step "${step.name}": Invalid response format`);
            setIsErrorModalOpen(true);
            errorCount++;
            continue;
          }

          const createdStep = stepResponse.data[0];
          if (createdStep.error_message) {
            console.error('Step creation failed:', createdStep.error_message);
            setErrorModalTitle('Step Creation Error');
            setErrorModalMessage(`Failed to create step "${step.name}": ${createdStep.error_message}`);
            setIsErrorModalOpen(true);
            errorCount++;
            continue;
          }

          if (!createdStep.step_id) {
            console.error('Step creation response missing step_id:', createdStep);
            setErrorModalTitle('Step Creation Error');
            setErrorModalMessage(`Failed to create step "${step.name}": No step ID returned`);
            setIsErrorModalOpen(true);
            errorCount++;
            continue;
          }

          
          successCount++;
        } catch (stepError) {
          console.error('Error processing step:', {
            stepId: step.id,
            error: stepError instanceof Error ? stepError.message : stepError
          });
          errorCount++;
        }
      }

      // Show success message without step counts
      if (errorCount === 0) {
        setErrorModalTitle('Upload Complete');
        setErrorModalMessage('Flow uploaded successfully!');
        setIsErrorModalOpen(true);
      } else {
        // If there were any errors, show them in the modal
        setErrorModalTitle('Upload Completed with Errors');
        setErrorModalMessage(`Some steps failed to upload. Check the console for details.`);
        setIsErrorModalOpen(true);
      }

      setIsUploadDialogOpen(false);
      setIsProcessing(false);
      
    } catch (error) {
      console.error('Upload failed:', error);
      setIsProcessing(false);
      
      // Show error in modal
      setErrorModalTitle('Upload Failed');
      setErrorModalMessage(error instanceof Error ? error.message : 'An unexpected error occurred during upload');
      setIsErrorModalOpen(true);
    }
  };

  // Helper function to convert base64 to Blob
  const base64ToBlob = (base64: string): Blob => {
    const byteString = atob(base64);
    const arrayBuffer = new ArrayBuffer(byteString.length);
    const uint8Array = new Uint8Array(arrayBuffer);
    
    for (let i = 0; i < byteString.length; i++) {
      uint8Array[i] = byteString.charCodeAt(i);
    }
    
    return new Blob([arrayBuffer], { type: 'image/png' });
  };

  // Guard against invalid flowSteps
  if (!Array.isArray(flowSteps)) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-[var(--text-secondary)]">No steps available</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col h-full">
        <div
          ref={editorRef}
          className="absolute inset-0 bg-background rounded-lg w-full h-full overflow-hidden"
          onDragOver={handleStepDragOver}
          onClick={handleCancelConnection}
          onMouseDown={(e) => {
            const target = e.target as HTMLElement;
            if (!target.closest('.step-card')) {
              setEditorState(prev => ({
                ...prev,
                selectedSteps: []
              }));
              handleSelectionStart(e);
            }
          }}
          onMouseMove={(e) => {
            handleSelectionMove(e);
            if (editorState.isConnecting) {
              const rect = editorRef.current?.getBoundingClientRect();
              if (!rect) return;
              
              const mouseX = e.clientX - rect.left;
              const mouseY = e.clientY - rect.top;
              
              setEditorState(prev => ({
                ...prev,
                mousePosition: { x: mouseX, y: mouseY }
              }));
            }
          }}
          onMouseUp={handleSelectionEnd}
          tabIndex={0}
        >
          {/* Selection Box */}
          {selectionBox && (
            <div
              className="absolute border-2 border-accent bg-accent/10 pointer-events-none z-50"
              style={{
                left: Math.min(selectionBox.startX, selectionBox.endX) + 'px',
                top: Math.min(selectionBox.startY, selectionBox.endY) + 'px',
                width: Math.abs(selectionBox.endX - selectionBox.startX) + 'px',
                height: Math.abs(selectionBox.endY - selectionBox.startY) + 'px'
              }}
            />
          )}

          {/* Styled Sidebar */}
          <div className="fixed left-4 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-50 bg-secondary p-3 rounded-2xl shadow-lg border border-border">
            <button
              className="p-3 bg-background text-foreground rounded-xl hover:bg-secondary/80 transition-all group flex items-center justify-center"
              onClick={handleAddStep}
              title="Add Step"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14m-7-7h14" />
              </svg>
            </button>
            <button
              className="p-3 bg-background text-foreground rounded-xl hover:bg-secondary/80 transition-all group flex items-center justify-center"
              onClick={handleClearConnections}
              title="Clear Connections"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <button
              className="p-3 bg-background text-foreground rounded-xl hover:bg-secondary/80 transition-all group flex items-center justify-center"
              onClick={handleUploadFlow}
              title="Upload Flow"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </button>
            <button
              className="p-3 bg-background text-foreground rounded-xl hover:bg-secondary/80 transition-all group flex items-center justify-center"
              onClick={handleExportFlow}
              title="Export Flow"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M7 17L17 7M17 7H8M17 7V16" />
              </svg>
            </button>
            <div className="w-full h-px bg-border" />
            <button
              className="p-3 bg-accent text-accent-foreground rounded-xl hover:opacity-90 transition-all group flex items-center justify-center"
              onClick={() => onSave(flow, flowSteps)}
              title="Save Flow"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
            </button>
          </div>

          {/* Steps */}
          {flowSteps.map(step => {
            const position = step.metadata?.position || { x: 200, y: 300 };
            const isSelected = editorState.selectedSteps.includes(step.id);
            
            return (
              <div
                key={step.id}
                className={`step-card absolute w-48 bg-secondary rounded-lg shadow-lg cursor-move overflow-hidden group transition-all ${
                  isSelected ? 'ring-2 ring-accent' : ''
                } ${editorState.isConnecting ? 'pointer-events-none' : 'hover:scale-[1.02] hover:shadow-xl'}`}
                style={{
                  left: `${position.x}px`,
                  top: `${position.y}px`,
                  transform: 'translate(-50%, -50%)',
                  zIndex: editorState.isDragging && draggedStep.current?.id === step.id ? 10 : 1
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isSelected) {
                    setEditorState(prev => ({
                      ...prev,
                      selectedSteps: []
                    }));
                  }
                }}
                draggable="true"
                onDragStart={(e) => {
                  e.stopPropagation();
                  handleStepDragStart(step, e);
                }}
                onDragEnd={(e) => {
                  e.stopPropagation();
                  handleStepDragEnd();
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                {/* Connection Points */}
                <div 
                  className={`absolute left-0 top-1/2 w-4 h-4 -ml-2 bg-accent rounded-full cursor-pointer transform -translate-y-1/2 transition-opacity z-50 hover:scale-110 ${
                    editorState.isConnecting ? 'opacity-100 pointer-events-auto' : 'opacity-0 group-hover:opacity-100'
                  }`}
                  draggable="true"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    const rect = editorRef.current?.getBoundingClientRect();
                    if (!rect) return;
                    
                    handleConnectionStart(step.id, { 
                      x: position.x - 96,
                      y: position.y
                    });
                  }}
                  onMouseUp={(e) => {
                    e.stopPropagation();
                    if (editorState.isConnecting) {
                      handleConnectionEnd(step.id, {
                        x: position.x - 96,
                        y: position.y
                      });
                    }
                  }}
                  onDragStart={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                />
                <div 
                  className={`absolute right-0 top-1/2 w-4 h-4 -mr-2 bg-accent rounded-full cursor-pointer transform -translate-y-1/2 transition-opacity z-50 hover:scale-110 ${
                    editorState.isConnecting ? 'opacity-100 pointer-events-auto' : 'opacity-0 group-hover:opacity-100'
                  }`}
                  draggable="true"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    const rect = editorRef.current?.getBoundingClientRect();
                    if (!rect) return;
                    
                    handleConnectionStart(step.id, { 
                      x: position.x + 96,
                      y: position.y
                    });
                  }}
                  onMouseUp={(e) => {
                    e.stopPropagation();
                    if (editorState.isConnecting) {
                      handleConnectionEnd(step.id, {
                        x: position.x + 96,
                        y: position.y
                      });
                    }
                  }}
                  onDragStart={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                />

                {/* Step Content */}
                <div className="relative">
                  {step.screenshot_id && step.metadata?.screenshot?.thumbnail && (
                    <div 
                      className={`relative w-full h-24 bg-black ${editorState.isConnecting ? '' : 'cursor-pointer'}`}
                      onClick={async () => {
                        if (editorState.isConnecting) return;
                        
                        let screenshotData;
                        if (screenshots.length === 0) {
                          const result = await window.electron.ipcRenderer.invoke('get-recent-screenshots', undefined);
                          setScreenshots(result);
                          screenshotData = result.find((s: { id: string; data: string }) => s.id === step.screenshot_id);
                        } else {
                          screenshotData = screenshots.find((s: { id: string; data: string }) => s.id === step.screenshot_id);
                        }
                        
                        if (screenshotData) {
                          setExpandedImage({
                            id: step.screenshot_id!,
                            title: step.name,
                            data: screenshotData.data
                          });
                        }
                      }}
                    >
                      <img
                        src={`data:image/png;base64,${step.metadata.screenshot.thumbnail}`}
                        alt={step.name}
                        className="w-full h-full object-contain"
                      />
                      <div className={`absolute inset-0 bg-black/0 transition-colors flex items-center justify-center ${
                        editorState.isConnecting ? 'pointer-events-none' : 'hover:bg-black/20'
                      } ${editorState.isConnecting ? 'opacity-0' : 'opacity-0 hover:opacity-100'}`}>
                        <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                    </div>
                  )}
                  
                  {/* Step Info */}
                  <div className="p-2">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-medium text-sm text-foreground">{step.name}</h3>
                      <div className={`flex gap-1 transition-opacity ${
                        editorState.isConnecting ? 'opacity-0 pointer-events-none' : 'opacity-0 group-hover:opacity-100'
                      }`}>
                        <button
                          className="p-1 hover:bg-background rounded text-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!editorState.isConnecting) {
                              handleStepEdit(step);
                            }
                          }}
                        >
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button
                          className="p-1 hover:bg-background rounded text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!editorState.isConnecting) {
                              handleStepDelete(step);
                            }
                          }}
                        >
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 6h18" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{step.description || 'No description'}</p>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Connections */}
          <svg className="absolute inset-0 w-full h-full">
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon
                  points="0 0, 10 3.5, 0 7"
                  fill="hsl(var(--accent))"
                />
              </marker>
            </defs>
            {/* Existing connections */}
            {connections.map((conn, i) => {
              const sourceStep = flowSteps.find(s => s.id === conn.source);
              const targetStep = flowSteps.find(s => s.id === conn.target);
              
              if (!sourceStep?.metadata?.position || !targetStep?.metadata?.position) return null;

              const sourcePos = sourceStep.metadata.position;
              const targetPos = targetStep.metadata.position;
              
              // Calculate control points for the curve
              const dx = targetPos.x - sourcePos.x;
              const dy = targetPos.y - sourcePos.y;
              const midX = sourcePos.x + dx * 0.5;
              
              const path = `M ${sourcePos.x + 128},${sourcePos.y} C ${midX + 128},${sourcePos.y} ${midX - 128},${targetPos.y} ${targetPos.x - 128},${targetPos.y}`;
              
              return (
                <g key={i} className="group">
                  <path
                    d={path}
                    stroke="hsl(var(--accent))"
                    strokeWidth="12"
                    fill="none"
                    opacity="0"
                    className="cursor-pointer"
                  />
                  <path
                    d={path}
                    stroke="hsl(var(--accent))"
                    strokeWidth="2"
                    fill="none"
                    markerEnd="url(#arrowhead)"
                    className="group-hover:opacity-50 transition-opacity pointer-events-none"
                  />
                  {/* Delete button */}
                  <g
                    className="opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    transform={`translate(${(sourcePos.x + targetPos.x) / 2}, ${(sourcePos.y + targetPos.y) / 2})`}
                    onClick={() => handleDeleteConnection(conn)}
                  >
                    <circle
                      r="12"
                      fill="hsl(var(--background))"
                      stroke="hsl(var(--accent))"
                      strokeWidth="2"
                    />
                    <path
                      d="M-6 0 L6 0 M0 -6 L0 6"
                      stroke="hsl(var(--accent))"
                      strokeWidth="2"
                      transform="rotate(45)"
                    />
                  </g>
                </g>
              );
            })}

            {/* Active connection line */}
            {editorState.isConnecting && editorState.connectionStart && editorState.mousePosition && (
              <path
                d={`M ${editorState.connectionStart.x},${editorState.connectionStart.y} C ${(editorState.connectionStart.x + editorState.mousePosition.x) / 2},${editorState.connectionStart.y} ${(editorState.connectionStart.x + editorState.mousePosition.x) / 2},${editorState.mousePosition.y} ${editorState.mousePosition.x},${editorState.mousePosition.y}`}
                stroke="hsl(var(--accent))"
                strokeWidth="2"
                strokeDasharray={isNearConnectionPoint(editorState.mousePosition.x, editorState.mousePosition.y) ? "" : "5,5"}
                fill="none"
                markerEnd={isNearConnectionPoint(editorState.mousePosition.x, editorState.mousePosition.y) ? "url(#arrowhead)" : ""}
                className="transition-all duration-75"
              />
            )}
          </svg>
        </div>

        {/* Add Step Dialog */}
        {isAddingStep && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-background rounded-xl p-6 max-w-lg w-full">
              <h3 className="text-lg font-semibold mb-4 text-foreground">Add New Step</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-foreground">Name</label>
                  <input
                    type="text"
                    value={newStepName}
                    onChange={(e) => setNewStepName(e.target.value)}
                    className="w-full bg-secondary text-foreground rounded-lg p-2"
                    placeholder="Enter step name"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2 text-foreground">Description</label>
                  <textarea
                    value={newStepDescription}
                    onChange={(e) => setNewStepDescription(e.target.value)}
                    className="w-full h-32 bg-secondary text-foreground rounded-lg p-2 resize-none"
                    placeholder="Enter step description"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-foreground">Screenshot</label>
                  <div className="grid grid-cols-3 gap-2 max-h-60 overflow-y-auto p-2 bg-secondary rounded-lg">
                    {screenshots.map(screenshot => (
                      <div
                        key={screenshot.id}
                        className={`relative aspect-video cursor-pointer rounded-lg overflow-hidden ${
                          selectedScreenshot === screenshot.id ? 'ring-2 ring-accent' : ''
                        }`}
                        onClick={() => setSelectedScreenshot(screenshot.id)}
                      >
                        <img
                          src={`data:image/png;base64,${screenshot.thumbnail}`}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  className="px-4 py-2 bg-secondary text-foreground rounded-lg hover:bg-secondary/80 transition-colors"
                  onClick={() => {
                    setIsAddingStep(false);
                    setNewStepName('');
                    setNewStepDescription('');
                    setSelectedScreenshot(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 bg-accent text-accent-foreground rounded-lg hover:opacity-80 transition-opacity"
                  onClick={handleAddStepConfirm}
                >
                  Add Step
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Step Dialog */}
        {editingStep && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-background rounded-xl p-6 max-w-lg w-full">
              <h3 className="text-lg font-semibold mb-4 text-foreground">Edit Step</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-foreground">Name</label>
                  <input
                    type="text"
                    value={editingStep.name}
                    onChange={(e) => setEditingStep(prev => prev ? { ...prev, name: e.target.value } : null)}
                    className="w-full bg-secondary text-foreground rounded-lg p-2"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2 text-foreground">Description</label>
                  <textarea
                    value={editingStep.description || ''}
                    onChange={(e) => setEditingStep(prev => prev ? { ...prev, description: e.target.value } : null)}
                    className="w-full h-32 bg-secondary text-foreground rounded-lg p-2 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-foreground">Screenshot</label>
                  <div className="grid grid-cols-3 gap-2 max-h-60 overflow-y-auto p-2 bg-secondary rounded-lg">
                    {screenshots.map(screenshot => (
                      <div
                        key={screenshot.id}
                        className={`relative aspect-video cursor-pointer rounded-lg overflow-hidden ${
                          selectedScreenshot === screenshot.id ? 'ring-2 ring-accent' : ''
                        }`}
                        onClick={() => setSelectedScreenshot(screenshot.id)}
                      >
                        <img
                          src={`data:image/png;base64,${screenshot.thumbnail}`}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  className="px-4 py-2 bg-secondary text-foreground rounded-lg hover:bg-secondary/80 transition-colors"
                  onClick={() => setEditingStep(null)}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 bg-accent text-accent-foreground rounded-lg hover:opacity-80 transition-opacity"
                  onClick={() => editingStep && handleStepUpdate(editingStep)}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Image Preview Modal */}
        {expandedImage && (
          <div 
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={() => setExpandedImage(null)}
          >
            <div className="relative max-w-4xl w-full mx-4 bg-background rounded-xl overflow-hidden">
              <div className="absolute top-4 right-4 z-10 flex gap-2">
                {/* Zoom Controls */}
                <button
                  className="p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                  onClick={handleZoomOut}
                  title="Zoom Out"
                >
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 12H4" />
                  </svg>
                </button>
                <button
                  className="p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                  onClick={handleResetZoom}
                  title="Reset Zoom"
                >
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
                <button
                  className="p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                  onClick={handleZoomIn}
                  title="Zoom In"
                >
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 4v16m8-8H4" />
                  </svg>
                </button>
                <button
                  className="p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedImage(null);
                  }}
                  title="Close"
                >
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-4 bg-secondary">
                <h3 className="text-lg font-semibold text-foreground">{expandedImage.title}</h3>
              </div>
              <div className="relative aspect-video bg-black overflow-auto">
                <div className="min-h-full min-w-full flex items-center justify-center">
                  <img
                    src={`data:image/png;base64,${expandedImage.data}`}
                    alt={expandedImage.title}
                    className="object-contain transition-transform duration-200"
                    style={{ 
                      transform: `scale(${expandedImage.zoom || 1})`,
                      transformOrigin: 'center center'
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        <UploadDialog
          isOpen={isUploadDialogOpen}
          onClose={() => setIsUploadDialogOpen(false)}
          onUpload={handleUpload}
          apps={apps}
        />
        
        {isProcessing && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-background rounded-xl p-6">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-accent border-t-transparent"></div>
                <span className="text-foreground">Processing...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error Modal */}
      {isErrorModalOpen && (
        <div className="fixed inset-0 bg-background bg-opacity-80 flex items-center justify-center z-50">
          <div className="bg-secondary border border-border rounded-lg p-6 max-w-md w-full mx-4 shadow-lg">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-xl font-semibold text-foreground">{errorModalTitle}</h3>
              <button
                onClick={() => setIsErrorModalOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-muted-foreground whitespace-pre-wrap mb-6">{errorModalMessage}</p>
            <div className="flex justify-end">
              <button
                onClick={() => setIsErrorModalOpen(false)}
                className="px-4 py-2 bg-accent text-accent-foreground rounded hover:bg-accent-hover transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// Add the AsyncImage component at the end of the file
const AsyncImage: React.FC<{
  screenshotId: string;
  loadImage: (id: string) => Promise<string | null>;
  alt: string;
  className?: string;
}> = ({ screenshotId, loadImage, alt, className }) => {
  const [imageData, setImageData] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);

    loadImage(screenshotId).then(data => {
      if (mounted && data) {
        setImageData(data);
        setIsLoading(false);
      }
    });

    return () => {
      mounted = false;
    };
  }, [screenshotId, loadImage]);

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent border-t-transparent"></div>
      </div>
    );
  }

  if (!imageData) {
    return (
      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
        Failed to load image
      </div>
    );
  }

  return (
    <img
      src={`data:image/png;base64,${imageData}`}
      alt={alt}
      className={className}
    />
  );
};

const UploadDialog: React.FC<UploadDialogProps> = ({ isOpen, onClose, onUpload, apps }) => {
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  if (!isOpen) return null;

  const handleUpload = async () => {
    setIsUploading(true);
    try {
      await onUpload(selectedAppId);
      onClose();
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-background rounded-xl p-6 max-w-md w-full">
        <h3 className="text-lg font-semibold mb-4 text-foreground">Upload Flow</h3>
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2 text-foreground">Select App</label>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
            <div 
              className={`flex items-center p-3 rounded-lg cursor-pointer transition-all ${
                selectedAppId === null ? 'bg-accent text-accent-foreground' : 'hover:bg-secondary'
              }`}
              onClick={() => setSelectedAppId(null)}
            >
              <span className="flex-1">Other</span>
            </div>
            {apps.map(app => (
              <div 
                key={app.id}
                className={`flex items-center p-3 rounded-lg cursor-pointer transition-all ${
                  selectedAppId === app.id ? 'bg-accent text-accent-foreground' : 'hover:bg-secondary'
                }`}
                onClick={() => setSelectedAppId(app.id)}
              >
                <span className="flex-1">{app.name}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button
            className="px-4 py-2 text-foreground rounded-lg hover:bg-secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 bg-accent text-accent-foreground rounded-lg hover:opacity-80 transition-opacity"
            onClick={handleUpload}
            disabled={isUploading}
          >
            {isUploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  );
};