export interface Screenshot {
  id: string;
  path: string;
  name: string;
  timestamp: number;
  thumbnail?: string;
  metadata?: {
    activeWindow?: {
      title: string;
      app: string;
    };
    [key: string]: any;
  };
} 