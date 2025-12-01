import { useCallback, RefObject } from 'react';

/**
 * Hook for converting mouse coordinates to character offset.
 * Works with a raw text layer where the text content matches the markdown string exactly.
 * Note: Line-boundary snapping is handled in useDragResize.ts, not here.
 */
export function usePixelToCharacter(
  containerRef: RefObject<HTMLElement>,
  markdown: string
) {
  const getCharacterOffset = useCallback(
    (clientX: number, clientY: number, _snapToWord: boolean = false): number | null => {
      if (!containerRef.current) return null;

      const container = containerRef.current;
      const textNode = container.firstChild;

      if (!textNode || textNode.nodeType !== Node.TEXT_NODE) {
        return null;
      }

      // Use caretPositionFromPoint (Firefox) or caretRangeFromPoint (Chrome)
      let offset: number | null = null;

      if ('caretPositionFromPoint' in document) {
        const caretPos = (document as any).caretPositionFromPoint(clientX, clientY);
        if (caretPos && caretPos.offsetNode === textNode) {
          offset = caretPos.offset;
        }
      } else if ('caretRangeFromPoint' in document) {
        const range = (document as any).caretRangeFromPoint(clientX, clientY);
        if (range && range.startContainer === textNode) {
          offset = range.startOffset;
        }
      }

      if (offset === null) {
        // Fallback: find closest character by position
        offset = findClosestCharacterOffset(container, textNode as Text, clientX, clientY, markdown.length);
      }

      if (offset === null) {
        return null;
      }

      // Clamp to valid range
      return Math.max(0, Math.min(offset, markdown.length));
    },
    [containerRef, markdown]
  );

  return { getCharacterOffset };
}

/**
 * Find the closest character offset to the given coordinates using binary search
 */
function findClosestCharacterOffset(
  container: HTMLElement,
  textNode: Text,
  clientX: number,
  clientY: number,
  textLength: number
): number | null {
  if (textLength === 0) return null;

  const containerRect = container.getBoundingClientRect();

  // Binary search for the line (Y position)
  let bestOffset = 0;
  let bestDistance = Infinity;

  // Sample characters to find the right line first
  const sampleSize = Math.min(100, textLength);
  const step = Math.max(1, Math.floor(textLength / sampleSize));

  for (let i = 0; i < textLength; i += step) {
    try {
      const range = document.createRange();
      range.setStart(textNode, i);
      range.setEnd(textNode, Math.min(i + 1, textLength));
      const rect = range.getBoundingClientRect();

      // Calculate distance (prioritize Y, then X)
      const dy = clientY < rect.top ? rect.top - clientY :
                 clientY > rect.bottom ? clientY - rect.bottom : 0;
      const dx = clientX < rect.left ? rect.left - clientX :
                 clientX > rect.right ? clientX - rect.right : 0;
      const distance = dy * 1000 + dx; // Weight Y heavily

      if (distance < bestDistance) {
        bestDistance = distance;
        bestOffset = i;
      }
    } catch (e) {
      // Skip invalid ranges
    }
  }

  // Refine around the best offset
  const searchStart = Math.max(0, bestOffset - step);
  const searchEnd = Math.min(textLength, bestOffset + step);

  for (let i = searchStart; i < searchEnd; i++) {
    try {
      const range = document.createRange();
      range.setStart(textNode, i);
      range.setEnd(textNode, Math.min(i + 1, textLength));
      const rect = range.getBoundingClientRect();

      const dy = clientY < rect.top ? rect.top - clientY :
                 clientY > rect.bottom ? clientY - rect.bottom : 0;
      const dx = clientX < rect.left ? rect.left - clientX :
                 clientX > rect.right ? clientX - rect.right : 0;
      const distance = dy * 1000 + dx;

      if (distance < bestDistance) {
        bestDistance = distance;
        bestOffset = i;
      }
    } catch (e) {
      // Skip invalid ranges
    }
  }

  return bestOffset;
}

