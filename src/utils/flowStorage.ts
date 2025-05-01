import { Flow, FlowStep } from '../types/flows';

// Local storage keys
const FLOWS_STORAGE_KEY = 'local_flows';
const FLOW_STEPS_STORAGE_KEY = 'local_flow_steps';

// Helper to generate local IDs
const generateLocalId = () => `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export const flowStorage = {
  // Load all local flows
  getFlows: async (): Promise<Flow[]> => {
    try {
      const settings = await window.electron.ipcRenderer.invoke('load-settings', FLOWS_STORAGE_KEY);
      const flows = settings?.[FLOWS_STORAGE_KEY] || [];
      return Array.isArray(flows) ? flows : [];
    } catch (error) {
      return [];
    }
  },

  // Save all flows
  saveFlows: async (flows: Flow[]): Promise<void> => {
    try {
      const settings = {
        [FLOWS_STORAGE_KEY]: flows
      };
      await window.electron.ipcRenderer.invoke('save-settings', settings);
    } catch (error) {
      // Handle error silently
    }
  },

  // Get steps for a specific flow
  getFlowSteps: async (flowId: string): Promise<FlowStep[]> => {
    try {
      const key = `${FLOW_STEPS_STORAGE_KEY}_${flowId}`;
      const settings = await window.electron.ipcRenderer.invoke('load-settings', key);
      
      // Access the steps array directly using the key
      const steps = settings?.[key] || [];
      
      // Ensure steps have proper metadata structure
      const processedSteps = Array.isArray(steps) ? steps.map(step => ({
        ...step,
        metadata: {
          ...step.metadata,
          connections: step.metadata?.connections || { to: [] }
        }
      })) : [];
      
      return processedSteps;
    } catch (error) {
      return [];
    }
  },

  // Save steps for a specific flow
  saveFlowSteps: async (flowId: string, steps: FlowStep[]): Promise<void> => {
    try {
      const key = `${FLOW_STEPS_STORAGE_KEY}_${flowId}`;
      
      // Save steps under the correct key
      const settings = {
        [key]: steps
      };
      
      await window.electron.ipcRenderer.invoke('save-settings', settings);
    } catch (error) {
      // Handle error silently
    }
  },

  // Create a new flow
  createFlow: async (flowData: Partial<Flow> & { screenshots?: string[] }): Promise<Flow> => {
    const newFlow: Flow = {
      id: generateLocalId(),
      user_id: '', // Will be set when uploaded
      name: flowData.name || 'New Flow',
      flow_type: flowData.flow_type || 'custom',
      is_published: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Save the new flow first
    const flows = await flowStorage.getFlows();
    const updatedFlows = Array.isArray(flows) ? [newFlow, ...flows] : [newFlow];
    await flowStorage.saveFlows(updatedFlows);

    // If screenshots are provided, create initial steps
    if (flowData.screenshots?.length) {
      // Get all screenshots at once to avoid multiple IPC calls
      const allScreenshots = await window.electron.ipcRenderer.invoke('get-recent-screenshots', undefined);
      
      // Get window dimensions
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      // Grid configuration
      const GRID_COLS = 3;
      const STEP_WIDTH = Math.min(300, width * 0.2); // 20% of window width, max 300px
      const STEP_HEIGHT = 250;
      const INITIAL_OFFSET_X = width * 0.15; // Start at 15% of window width
      const INITIAL_OFFSET_Y = height * 0.15;
      
      // Create steps with screenshot data
      const steps: FlowStep[] = flowData.screenshots.map((id, index) => {
        const screenshot = allScreenshots.find((s: any) => s.id === id);
        if (!screenshot) return null;

        // Calculate grid position
        const row = Math.floor(index / GRID_COLS);
        const col = index % GRID_COLS;

        return {
          id: generateLocalId(),
          flow_id: newFlow.id,
          parent_step_id: null as string | null,
          screenshot_id: screenshot.id,
          name: `Step ${index + 1}`,
          description: screenshot.metadata?.activeWindow?.title || '',
          order_index: index,
          metadata: {
            screenshot: {
              id: screenshot.id,
              name: screenshot.name,
              data: screenshot.data,
              thumbnail: screenshot.thumbnail,
              app: screenshot.metadata?.activeWindow?.app || 'Unknown App',
              title: screenshot.metadata?.activeWindow?.title || `Step ${index + 1}`,
              metadata: screenshot.metadata
            },
            position: {
              x: INITIAL_OFFSET_X + (col * STEP_WIDTH * 1.2), // Add 20% spacing between steps
              y: INITIAL_OFFSET_Y + (row * STEP_HEIGHT * 1.2)
            },
            connections: { to: [] as string[] }
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      }).filter(Boolean) as FlowStep[];
      
      // Save steps with the correct key structure
      const key = `${FLOW_STEPS_STORAGE_KEY}_${newFlow.id}`;
      await window.electron.ipcRenderer.invoke('save-settings', {
        [key]: steps
      });
    }

    return newFlow;
  },

  // Delete a flow and its steps
  deleteFlow: async (flowId: string): Promise<void> => {
    const flows = await flowStorage.getFlows();
    const updatedFlows = flows.filter(f => f.id !== flowId);
    await flowStorage.saveFlows(updatedFlows);
    
    // Clean up steps
    try {
      await window.electron.ipcRenderer.invoke('save-settings', {
        [`${FLOW_STEPS_STORAGE_KEY}_${flowId}`]: null
      });
    } catch (error) {
      // Handle error silently
    }
  },

  // Publish flow to Supabase
  publishFlow: async (flow: Flow, steps: FlowStep[], supabase: any): Promise<void> => {
    // First, upload the flow
    const { data: uploadedFlow, error: flowError } = await supabase
      .from('flows')
      .upsert([{
        ...flow,
        is_published: true,
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (flowError) throw flowError;

    // Then upload the steps
    const { error: stepsError } = await supabase
      .from('flow_steps')
      .upsert(steps.map(step => ({
        ...step,
        flow_id: uploadedFlow.id
      })));

    if (stepsError) throw stepsError;

    // Update local flow with remote ID and published status
    const flows = await flowStorage.getFlows();
    const updatedFlows = flows.map(f => 
      f.id === flow.id 
        ? { ...f, id: uploadedFlow.id, is_published: true }
        : f
    );
    await flowStorage.saveFlows(updatedFlows);
  }
}; 