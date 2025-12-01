import { useState, useCallback, useEffect, RefObject } from 'react';
import { Chunk, supportsOverlayMode } from '@shared/schema';
import { usePixelToCharacter } from './usePixelToCharacter';

interface UseDragResizeProps {
  chunks: Chunk[];
  markdownRef: RefObject<HTMLElement>;
  markdown: string;
  onChunkUpdate: (chunk: Chunk) => void;
}

interface DragState {
  chunkId: string;
  edge: 'top' | 'bottom';
  originalStart: number;
  originalEnd: number;
}

/**
 * Snap offset to line boundary based on which edge is being dragged.
 * Mirrors server-side snapToLineBoundaries() in mastra-chunker.ts.
 */
function snapToLineBoundary(
  markdown: string,
  offset: number,
  edge: 'top' | 'bottom'
): number {
  if (edge === 'top') {
    // Snap backward to line start (find preceding newline)
    let snapped = offset;
    while (snapped > 0 && markdown[snapped - 1] !== '\n') {
      snapped--;
    }
    return snapped;
  } else {
    // Snap forward to line end (include newline if present)
    let snapped = offset;
    while (snapped < markdown.length && markdown[snapped] !== '\n') {
      snapped++;
    }
    if (snapped < markdown.length && markdown[snapped] === '\n') {
      snapped++;
    }
    return snapped;
  }
}

/**
 * Hook for handling drag and resize interactions on chunk overlays
 * Includes overlap detection (per user preference: allow with warning)
 */
export function useDragResize({
  chunks,
  markdownRef,
  markdown,
  onChunkUpdate,
}: UseDragResizeProps) {
  const [dragging, setDragging] = useState<DragState | null>(null);
  const { getCharacterOffset } = usePixelToCharacter(markdownRef, markdown);

  const handleResizeStart = useCallback(
    (chunkId: string, edge: 'top' | 'bottom') => {
      const chunk = chunks.find((c) => c.id === chunkId);
      if (!chunk || !supportsOverlayMode(chunk)) return;

      setDragging({
        chunkId,
        edge,
        originalStart: chunk.startOffset!,
        originalEnd: chunk.endOffset!,
      });
    },
    [chunks]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragging) return;

      // Get raw offset without word snapping
      const rawOffset = getCharacterOffset(e.clientX, e.clientY, false);
      if (rawOffset === null) return;

      // Snap to line boundary based on edge being dragged
      const newOffset = snapToLineBoundary(markdown, rawOffset, dragging.edge);

      const chunk = chunks.find((c) => c.id === dragging.chunkId);
      if (!chunk) return;

      let newStart = dragging.originalStart;
      let newEnd = dragging.originalEnd;

      // Update based on which edge is being dragged
      // 'top' adjusts startOffset, 'bottom' adjusts endOffset
      if (dragging.edge === 'top') {
        newStart = Math.max(0, Math.min(newOffset, newEnd - 1));
      } else if (dragging.edge === 'bottom') {
        newEnd = Math.max(newStart + 1, Math.min(newOffset, markdown.length));
      }

      // Detect overlaps with other chunks (per user preference: allow with warning)
      const hasOverlap = chunks.some((other) => {
        if (other.id === chunk.id || !supportsOverlayMode(other)) return false;

        // Check if ranges intersect
        return (
          (newStart >= other.startOffset! && newStart < other.endOffset!) ||
          (newEnd > other.startOffset! && newEnd <= other.endOffset!) ||
          (newStart <= other.startOffset! && newEnd >= other.endOffset!)
        );
      });

      // Calculate new text and approximate token count
      const newText = markdown.slice(newStart, newEnd);
      const charCount = newText.length;
      // Approximate token count: ~4 chars per token for English text
      const approxTokenCount = Math.ceil(charCount / 4);

      // Update chunk with new offsets, text, and updated metadata
      onChunkUpdate({
        ...chunk,
        startOffset: newStart,
        endOffset: newEnd,
        hasOverlap,
        text: newText,
        metadata: {
          ...chunk.metadata,
          token_count: approxTokenCount, // Approximate - will be recalculated on save
        },
      });
    },
    [dragging, chunks, getCharacterOffset, onChunkUpdate, markdown]
  );

  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  // Attach mouse event listeners when dragging
  useEffect(() => {
    if (dragging) {
      // Disable text selection during drag
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'ns-resize';

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        // Re-enable text selection
        document.body.style.userSelect = '';
        document.body.style.cursor = '';

        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragging, handleMouseMove, handleMouseUp]);

  return { handleResizeStart, isDragging: dragging !== null };
}
