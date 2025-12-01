import { useState, useCallback, RefObject } from 'react';
import { Chunk, supportsOverlayMode } from '@shared/schema';
import { usePixelToCharacter } from './usePixelToCharacter';

interface UseChunkContextMenuProps {
  markdownRef: RefObject<HTMLElement>;
  markdown: string;
  chunks: Chunk[];
  onChunkSplit: (chunkId: string, splitOffset: number) => void;
}

interface ContextMenuState {
  x: number;
  y: number;
  chunkId: string;
  splitOffset: number;
}

/**
 * Hook for managing context menu for chunk split functionality
 */
export function useChunkContextMenu({
  markdownRef,
  markdown,
  chunks,
  onChunkSplit,
}: UseChunkContextMenuProps) {
  const { getCharacterOffset } = usePixelToCharacter(markdownRef, markdown);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();

      const offset = getCharacterOffset(e.clientX, e.clientY, false);
      if (offset === null) return;

      // Find chunk containing this offset
      const chunk = chunks.find(
        (c) =>
          supportsOverlayMode(c) &&
          c.startOffset! <= offset &&
          c.endOffset! > offset
      );

      if (!chunk) {
        // No chunk at this position, close menu
        setContextMenu(null);
        return;
      }

      // Don't allow split at chunk boundaries
      if (offset === chunk.startOffset || offset === chunk.endOffset) {
        return;
      }

      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        chunkId: chunk.id,
        splitOffset: offset,
      });
    },
    [chunks, getCharacterOffset]
  );

  const handleSplit = useCallback(() => {
    if (!contextMenu) return;
    onChunkSplit(contextMenu.chunkId, contextMenu.splitOffset);
    setContextMenu(null);
  }, [contextMenu, onChunkSplit]);

  const handleClose = useCallback(() => {
    setContextMenu(null);
  }, []);

  return {
    handleContextMenu,
    contextMenu,
    handleSplit,
    handleClose,
  };
}
