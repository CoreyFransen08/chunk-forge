import React from 'react';
import { Chunk } from '@shared/schema';

// Color palette for chunks - visually distinct colors
const CHUNK_COLORS = [
  { bg: 'rgba(168, 85, 247, 0.15)', border: '#a855f7' },  // purple
  { bg: 'rgba(34, 197, 94, 0.15)', border: '#22c55e' },   // green
  { bg: 'rgba(249, 115, 22, 0.15)', border: '#f97316' },  // orange
  { bg: 'rgba(14, 165, 233, 0.15)', border: '#0ea5e9' },  // sky blue
  { bg: 'rgba(236, 72, 153, 0.15)', border: '#ec4899' },  // pink
  { bg: 'rgba(234, 179, 8, 0.15)', border: '#eab308' },   // yellow
  { bg: 'rgba(99, 102, 241, 0.15)', border: '#6366f1' },  // indigo
  { bg: 'rgba(20, 184, 166, 0.15)', border: '#14b8a6' },  // teal
];

interface ChunkOverlayProps {
  chunk: Chunk;
  rect: DOMRect | null;
  colorIndex: number;
  isSelected: boolean;
  isHovered: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onResizeStart: (edge: 'top' | 'bottom') => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export function ChunkOverlay({
  chunk,
  rect,
  colorIndex,
  isSelected,
  isHovered,
  onSelect,
  onDelete,
  onResizeStart,
  onMouseEnter,
  onMouseLeave,
}: ChunkOverlayProps) {
  if (!rect) return null;

  // Determine colors based on state
  const baseColor = CHUNK_COLORS[colorIndex % CHUNK_COLORS.length];

  const backgroundColor = isSelected
    ? 'rgba(59, 130, 246, 0.25)' // blue for selected
    : baseColor.bg;

  const borderColor = isSelected
    ? '#3b82f6' // blue
    : baseColor.border;

  // Calculate z-index: selected chunks on top, otherwise based on chunk order
  // Using order ensures consistent stacking regardless of scroll position
  const baseZIndex = isSelected ? 1000 : 100 + (chunk.order ?? 0);

  return (
    <div
      style={{
        position: 'absolute',
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        backgroundColor,
        border: `2px solid ${borderColor}`,
        borderRadius: '4px',
        pointerEvents: 'auto',
        cursor: 'pointer',
        transition: 'background-color 150ms, border-color 150ms',
        zIndex: baseZIndex,
      }}
      onClick={onSelect}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      data-chunk-id={chunk.id}
    >
      {/* Top resize handle - adjusts startOffset */}
      {(isSelected || isHovered) && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: '-4px',
            width: '100%',
            height: '8px',
            cursor: 'ns-resize',
            backgroundColor: borderColor,
            opacity: isSelected ? 1 : 0.6,
            transition: 'opacity 150ms',
            zIndex: 25,
            borderRadius: '2px',
          }}
          onMouseDown={(e) => {
            e.preventDefault(); // Prevent text selection
            e.stopPropagation();
            onResizeStart('top');
          }}
        />
      )}

      {/* Bottom resize handle - adjusts endOffset */}
      {(isSelected || isHovered) && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            bottom: '-4px',
            width: '100%',
            height: '8px',
            cursor: 'ns-resize',
            backgroundColor: borderColor,
            opacity: isSelected ? 1 : 0.6,
            transition: 'opacity 150ms',
            zIndex: 25,
            borderRadius: '2px',
          }}
          onMouseDown={(e) => {
            e.preventDefault(); // Prevent text selection
            e.stopPropagation();
            onResizeStart('bottom');
          }}
        />
      )}

      {/* Chunk ID badge with metadata */}
      <div
        style={{
          position: 'absolute',
          top: '-20px',
          left: 0,
          fontSize: '10px',
          fontFamily: 'monospace',
          backgroundColor: borderColor,
          color: 'white',
          padding: '2px 6px',
          borderRadius: '3px',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          zIndex: 30,
        }}
      >
        {chunk.id.slice(0, 8)}
        {` · ${chunk.text.length} chars`}
        {chunk.metadata.token_count != null && ` · ~${chunk.metadata.token_count} tokens`}
        {chunk.metadata.heading_level && ` · H${chunk.metadata.heading_level}`}
      </div>

      {/* Delete button - visible on hover when selected */}
      {isSelected && isHovered && (
        <button
          style={{
            position: 'absolute',
            top: '-20px',
            right: 0,
            fontSize: '12px',
            backgroundColor: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            padding: '2px 6px',
            cursor: 'pointer',
            zIndex: 30,
          }}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title="Delete chunk"
        >
          ✕
        </button>
      )}
    </div>
  );
}
