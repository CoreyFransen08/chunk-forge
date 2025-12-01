import { useState, useEffect, useCallback, RefObject, useMemo, useRef } from 'react';
import { Chunk, supportsOverlayMode } from '@shared/schema';

interface CachedRect {
  startOffset: number;
  endOffset: number;
  rect: DOMRect;
}

/**
 * Hook for computing bounding rectangles for chunks using a raw text layer.
 * The raw text layer contains the exact markdown string, so character offsets match perfectly.
 * Uses per-chunk memoization to avoid recalculating unchanged chunks.
 */
export function useRawTextRects(
  rawTextRef: RefObject<HTMLElement>,
  chunks: Chunk[],
  markdown: string
): Map<string, DOMRect> {
  const [rects, setRects] = useState<Map<string, DOMRect>>(new Map());

  // Per-chunk cache: only recalculate if offsets changed
  const rectCache = useRef<Map<string, CachedRect>>(new Map());

  // Track markdown length to invalidate cache on content change
  const prevMarkdownLength = useRef<number>(0);

  // Memoize chunks that support overlay mode
  const overlayChunks = useMemo(
    () => chunks.filter(supportsOverlayMode),
    [chunks]
  );

  const calculateRects = useCallback((forceRecalculate = false) => {
    if (!rawTextRef.current || !markdown) {
      setRects(new Map());
      return;
    }

    const container = rawTextRef.current;
    const textNode = container.firstChild;

    if (!textNode || textNode.nodeType !== Node.TEXT_NODE) {
      console.warn('Raw text layer does not contain a text node');
      setRects(new Map());
      return;
    }

    // Invalidate entire cache if markdown content changed
    if (markdown.length !== prevMarkdownLength.current) {
      rectCache.current.clear();
      prevMarkdownLength.current = markdown.length;
    }

    // Clear cache on force recalculate (e.g., resize)
    if (forceRecalculate) {
      rectCache.current.clear();
    }

    const newRects = new Map<string, DOMRect>();
    const containerRect = container.getBoundingClientRect();
    const containerWidth = containerRect.width;

    // Get the actual text node length (may differ from markdown.length due to browser normalization)
    const textNodeLength = textNode.textContent?.length ?? 0;

    // Track which chunk IDs are still valid
    const validChunkIds = new Set<string>();

    for (const chunk of overlayChunks) {
      validChunkIds.add(chunk.id);

      try {
        const startOffset = chunk.startOffset!;
        const endOffset = chunk.endOffset!;

        // Check cache first - reuse if offsets match
        const cached = rectCache.current.get(chunk.id);
        if (
          cached &&
          cached.startOffset === startOffset &&
          cached.endOffset === endOffset
        ) {
          newRects.set(chunk.id, cached.rect);
          continue;
        }

        // Validate offsets against actual text node length (not markdown.length)
        // This handles cases where browser normalizes whitespace differently
        if (startOffset < 0 || startOffset >= endOffset) {
          console.warn(`Invalid offsets for chunk ${chunk.id}: ${startOffset}-${endOffset}`);
          continue;
        }

        // Clamp endOffset to text node length to handle edge cases
        const clampedEndOffset = Math.min(endOffset, textNodeLength);

        // Skip if clamped offset would create invalid range
        if (startOffset >= clampedEndOffset) {
          console.warn(`Chunk ${chunk.id} extends beyond text node (${endOffset} > ${textNodeLength})`);
          continue;
        }

        // Create a range for this chunk's text
        const range = document.createRange();

        try {
          range.setStart(textNode, startOffset);
          range.setEnd(textNode, clampedEndOffset);
        } catch (e) {
          console.warn(`Could not set range for chunk ${chunk.id}:`, e);
          continue;
        }

        // Get all client rects (one per line for multi-line text)
        const clientRects = range.getClientRects();

        if (clientRects.length === 0) {
          console.warn(`No client rects for chunk ${chunk.id}`);
          continue;
        }

        // Find the bounding box encompassing all lines
        let minY = Infinity;
        let maxY = -Infinity;

        for (let i = 0; i < clientRects.length; i++) {
          const rect = clientRects[i];
          if (rect.height > 0) {
            minY = Math.min(minY, rect.top);
            maxY = Math.max(maxY, rect.bottom);
          }
        }

        if (minY === Infinity || maxY === -Infinity) {
          continue;
        }

        // Create full-width rectangle relative to container
        const top = Math.max(0, minY - containerRect.top);
        const height = maxY - minY;

        const rect = new DOMRect(0, top, containerWidth, height);
        newRects.set(chunk.id, rect);

        // Cache the result
        rectCache.current.set(chunk.id, { startOffset, endOffset, rect });
      } catch (error) {
        console.error(`Error calculating rect for chunk ${chunk.id}:`, error);
      }
    }

    // Clean up stale cache entries for deleted chunks
    Array.from(rectCache.current.keys()).forEach((cachedId) => {
      if (!validChunkIds.has(cachedId)) {
        rectCache.current.delete(cachedId);
      }
    });

    setRects(newRects);
  }, [rawTextRef, overlayChunks, markdown]);

  // Calculate on mount and when dependencies change
  useEffect(() => {
    // Small delay to ensure DOM is ready
    const timeoutId = setTimeout(calculateRects, 10);
    return () => clearTimeout(timeoutId);
  }, [calculateRects]);

  // Recalculate on window resize (force recalculate to clear cache)
  useEffect(() => {
    const handleResize = () => {
      calculateRects(true); // Force recalculate on resize
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [calculateRects]);

  return rects;
}
