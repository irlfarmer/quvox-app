import React from 'react';
import { Flow } from '../../../types/flows';

interface FlowListProps {
  flows: Flow[];
  onSelect: (flow: Flow) => void;
  onDelete: (flow: Flow) => void;
  onNew: () => void;
  onImport: () => void;
}

export const FlowList: React.FC<FlowListProps> = ({ flows = [], onSelect, onDelete, onNew, onImport }) => {
  // Ensure flows is always an array
  const safeFlows = Array.isArray(flows) ? flows : [];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-foreground">Your Flows</h2>
        <div className="flex gap-2">
          <button
            className="p-3 bg-accent text-accent-foreground rounded-lg hover:opacity-80 transition-opacity"
            onClick={onNew}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14m-7-7h14" />
            </svg>
          </button>
          <button
            className="p-3 bg-accent text-accent-foreground rounded-lg hover:opacity-80 transition-opacity"
            onClick={onImport}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {safeFlows.map(flow => (
          <div
            key={flow.id}
            className="bg-background rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer card"
            onClick={() => onSelect(flow)}
          >
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-lg font-medium text-foreground">{flow.name}</h3>
              <span className="px-2 py-1 text-xs rounded-full bg-accent text-accent-foreground">
                {flow.flow_type}
              </span>
            </div>
            
            <div className="flex justify-between items-center mt-4">
              <span className="text-sm text-muted-foreground">
                {new Date(flow.created_at).toLocaleDateString()}
              </span>
              <div className="flex gap-2">
                {flow.is_published ? (
                  <span className="text-sm text-muted-foreground">Published</span>
                ) : (
                  <span className="text-sm text-muted-foreground">Draft</span>
                )}
                <button
                  className="text-destructive hover:opacity-80 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(flow);
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}

        {safeFlows.length === 0 && (
          <div className="col-span-full text-center py-8">
            <p className="text-muted-foreground">No flows created yet</p>
          </div>
        )}
      </div>
    </div>
  );
}; 