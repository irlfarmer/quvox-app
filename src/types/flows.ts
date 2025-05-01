import { Screenshot } from './screenshot';

export interface Flow {
  id: string;
  user_id: string;
  name: string;
  flow_type: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface FlowStep {
  id: string;
  flow_id: string;
  parent_step_id: string | null;
  screenshot_id: string | null;
  name: string;
  description?: string;
  order_index: number;
  metadata: {
    screenshot?: ScreenshotMetadata;
    position?: {
      x: number;
      y: number;
    };
    connections?: {
      to: string[];  // Array of step IDs this step connects to
      type?: 'normal' | 'conditional' | 'loop';
    };
    conditions?: {
      type: 'if' | 'loop' | 'wait';
      value: any;
    }[];
  };
  created_at: string;
  updated_at: string;
}

export interface FlowConnection {
  source: string;  // Step ID
  target: string;  // Step ID
  type: 'normal' | 'conditional' | 'loop';
  label?: string;
}

export interface FlowWithSteps extends Flow {
  steps: FlowStep[];
}

// Flow creation/editing state
export interface FlowEditorState {
  selectedStep?: FlowStep;
  selectedConnection?: FlowConnection;
  isDragging: boolean;
  isConnecting: boolean;
  connectionStart?: {
    stepId: string;
    position: { x: number; y: number };
  };
}

// Flow types
export const FLOW_TYPES = [
  'login',
  'settings',
  'editor',
  'dashboard',
  'custom'
] as const;

export type FlowType = typeof FLOW_TYPES[number];

export interface ScreenshotMetadata {
  thumbnail: string;
  data?: string;
  app?: string;
  title?: string;
}

export interface FlowStepMetadata {
  position?: {
    x: number;
    y: number;
  };
  screenshot?: ScreenshotMetadata;
  connections?: {
    to: string[];
  };
} 