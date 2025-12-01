import React from 'react';
import { Button } from '@/components/ui/button';
import { LayoutList, Layers } from 'lucide-react';

interface ViewModeToggleProps {
  mode: 'card' | 'overlay';
  onModeChange: (mode: 'card' | 'overlay') => void;
  disabled?: boolean;
}

export function ViewModeToggle({
  mode,
  onModeChange,
  disabled = false,
}: ViewModeToggleProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">View Mode:</span>
      <div className="inline-flex rounded-md shadow-sm" role="group">
        <Button
          variant={mode === 'card' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onModeChange('card')}
          className="rounded-r-none"
          disabled={disabled}
        >
          <LayoutList className="mr-2 h-4 w-4" />
          Card View
        </Button>
        <Button
          variant={mode === 'overlay' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onModeChange('overlay')}
          className="rounded-l-none"
          disabled={disabled}
        >
          <Layers className="mr-2 h-4 w-4" />
          Overlay View
        </Button>
      </div>
      {disabled && (
        <span className="text-xs text-amber-600">
          Regenerate chunks to enable overlay mode
        </span>
      )}
    </div>
  );
}
