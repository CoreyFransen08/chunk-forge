import React, { useRef, useState } from 'react';
import { Chunk } from '@shared/schema';
import { ChunkOverlay } from './ChunkOverlay';
import { ChunkContextMenu } from './ChunkContextMenu';
import { useRawTextRects } from '@/hooks/useRawTextRects';
import { useDragResize } from '@/hooks/useDragResize';
import { useChunkContextMenu } from '@/hooks/useChunkContextMenu';

interface OverlayContainerProps {
  markdown: string;
  chunks: Chunk[];
  selectedChunkId: string | null;
  showOverlaps: boolean;
  onChunkSelect: (chunkId: string) => void;
  onChunkDelete: (chunkId: string) => void;
  onChunkUpdate: (chunk: Chunk) => void;
  onChunkSplit: (chunkId: string, splitOffset: number) => void;
}

export function OverlayContainer({
  markdown,
  chunks,
  selectedChunkId,
  showOverlaps,
  onChunkSelect,
  onChunkDelete,
  onChunkUpdate,
  onChunkSplit,
}: OverlayContainerProps) {
  // Ref to the raw text layer (used for character mapping and display)
  const rawTextRef = useRef<HTMLDivElement>(null);
  const [hoveredChunkId, setHoveredChunkId] = useState<string | null>(null);

  // Calculate bounding boxes using the raw text layer (offsets match exactly)
  const chunkRects = useRawTextRects(rawTextRef, chunks, markdown);

  // Drag and resize handler (uses raw text ref for accurate positioning)
  const { handleResizeStart } = useDragResize({
    chunks,
    markdownRef: rawTextRef,
    markdown,
    onChunkUpdate,
  });

  // Context menu for split functionality
  const { handleContextMenu, contextMenu, handleSplit, handleClose } = useChunkContextMenu({
    markdownRef: rawTextRef,
    markdown,
    chunks,
    onChunkSplit,
  });

  return (
    <div style={{ position: 'relative' }}>
      {/* Layer 1: Raw markdown text - visible with monospace styling */}
      {/* Character positions match exactly with chunk offsets */}
      <div
        ref={rawTextRef}
        onContextMenu={handleContextMenu}
        style={{
          position: 'relative',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          fontSize: '13px',
          lineHeight: '1.6',
          whiteSpace: 'pre-wrap',
          wordWrap: 'break-word',
          padding: '1rem',
          borderRadius: '0.5rem',
          backgroundColor: 'rgb(30, 41, 59)', // slate-800
          color: 'rgb(226, 232, 240)', // slate-200
          overflowX: 'auto',
          tabSize: 2,
          zIndex: 1,
        }}
      >
        {markdown}
      </div>

      {/* Layer 2: Overlay layer - chunk highlights positioned on raw text */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: 'none',
          zIndex: 2,
        }}
      >
        {chunks.map((chunk, index) => (
          <ChunkOverlay
            key={chunk.id}
            chunk={chunk}
            rect={chunkRects.get(chunk.id) || null}
            colorIndex={index}
            isSelected={selectedChunkId === chunk.id}
            isHovered={hoveredChunkId === chunk.id}
            showOverlapHighlight={showOverlaps}
            onSelect={() => onChunkSelect(chunk.id)}
            onDelete={() => onChunkDelete(chunk.id)}
            onResizeStart={(edge) => handleResizeStart(chunk.id, edge)}
            onMouseEnter={() => setHoveredChunkId(chunk.id)}
            onMouseLeave={() => setHoveredChunkId(null)}
          />
        ))}
      </div>

      {/* Context menu for chunk splitting */}
      {contextMenu && (
        <ChunkContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onSplit={handleSplit}
          onClose={handleClose}
        />
      )}
    </div>
  );
}
