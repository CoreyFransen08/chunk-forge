import { MDocument } from "@mastra/rag";
import type { Chunk, ChunkingConfig, ChunkMetadata } from "@shared/schema";
import { countTokens } from "./token-counter";

// Strategy types supported by this service
export type MastraStrategy =
  | "recursive"
  | "paragraph"
  | "by_heading"
  | "semantic"
  | "sentence"
  | "token"
  | "hierarchical"
  // Native Mastra strategies (new)
  | "character"
  | "html"
  | "json"
  | "latex"
  | "markdown"
  | "semantic-markdown";

export interface MastraChunkResult {
  chunks: Chunk[];
  strategy: string;
}

// Chunk output from Mastra's MDocument.chunk()
interface MastraChunk {
  text: string;
  metadata?: Record<string, any>;
}

/**
 * Snap character offsets to line boundaries.
 * This ensures chunks never start or end mid-line, which is required
 * for the overlay visualization system to work correctly.
 */
function snapToLineBoundaries(
  markdown: string,
  startOffset: number,
  endOffset: number
): { startOffset: number; endOffset: number } {
  // Snap startOffset backward to line start
  let snappedStart = startOffset;
  while (snappedStart > 0 && markdown[snappedStart - 1] !== "\n") {
    snappedStart--;
  }

  // Snap endOffset forward to line end
  let snappedEnd = endOffset;
  while (snappedEnd < markdown.length && markdown[snappedEnd] !== "\n") {
    snappedEnd++;
  }
  // Include the newline character if present
  if (snappedEnd < markdown.length && markdown[snappedEnd] === "\n") {
    snappedEnd++;
  }

  return { startOffset: snappedStart, endOffset: snappedEnd };
}

/**
 * Calculate character offsets for each chunk in the original markdown.
 * Uses text search with line-boundary snapping.
 */
function calculateOffsets(
  markdown: string,
  chunkTexts: string[]
): Array<{ startOffset: number; endOffset: number }> {
  const offsets: Array<{ startOffset: number; endOffset: number }> = [];
  let searchStart = 0;

  for (const chunkText of chunkTexts) {
    // Try to find the exact chunk text in the markdown
    let foundIndex = markdown.indexOf(chunkText, searchStart);

    if (foundIndex === -1) {
      // Fallback: try trimmed search
      const trimmedText = chunkText.trim();
      if (trimmedText.length > 0) {
        foundIndex = markdown.indexOf(trimmedText, searchStart);
      }
    }

    if (foundIndex !== -1) {
      const rawEnd = foundIndex + chunkText.length;
      const snapped = snapToLineBoundaries(markdown, foundIndex, rawEnd);
      offsets.push(snapped);
      searchStart = snapped.endOffset;
    } else {
      // Last resort: sequential placement with line snapping
      const rawEnd = Math.min(searchStart + chunkText.length, markdown.length);
      const snapped = snapToLineBoundaries(markdown, searchStart, rawEnd);
      offsets.push(snapped);
      searchStart = snapped.endOffset;
    }
  }

  return offsets;
}

/**
 * Calculate token count using tiktoken.
 * Uses cl100k_base encoding (same as GPT-4).
 */
function calculateTokenCount(text: string): number {
  return countTokens(text);
}

/**
 * Calculate page boundaries from markdown page separators.
 * LlamaParse uses "\n---\n" as page separator (configurable in llama_parser.py).
 * Returns array of character offsets where each page starts.
 */
function calculatePageBoundaries(markdown: string): number[] {
  const PAGE_SEPARATOR = "\n---\n";
  const boundaries: number[] = [0]; // Page 1 starts at offset 0

  let searchStart = 0;
  while (true) {
    const separatorIndex = markdown.indexOf(PAGE_SEPARATOR, searchStart);
    if (separatorIndex === -1) break;
    // Next page starts after the separator
    boundaries.push(separatorIndex + PAGE_SEPARATOR.length);
    searchStart = separatorIndex + PAGE_SEPARATOR.length;
  }

  return boundaries;
}

/**
 * Find which page a chunk is on based on its start offset.
 * Returns undefined if no page separators exist (graceful handling for
 * markdown from MarkItDown, Docling, or other non-LlamaParse sources).
 */
function getPageNumber(startOffset: number, pageBoundaries: number[]): number | undefined {
  // If only one boundary (offset 0) exists, no page separators were found
  if (pageBoundaries.length <= 1) {
    return undefined; // Gracefully skip page numbering
  }

  for (let i = pageBoundaries.length - 1; i >= 0; i--) {
    if (startOffset >= pageBoundaries[i]) {
      return i + 1; // 1-indexed page numbers
    }
  }
  return 1;
}

/**
 * Extract heading metadata from chunk text.
 * Looks for markdown headings in the first few lines.
 */
export function extractHeadingMetadata(text: string): Partial<ChunkMetadata> {
  const metadata: Partial<ChunkMetadata> = {};
  const lines = text.trim().split("\n");

  for (const line of lines.slice(0, 5)) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const level = match[1].length as 1 | 2 | 3 | 4 | 5 | 6;
      const headingText = match[2].trim();
      const key = `heading_${level}` as keyof ChunkMetadata;
      (metadata as any)[key] = headingText;
      metadata.heading_level = level;
      break;
    }
  }

  return metadata;
}

/**
 * Build section path from heading metadata.
 */
export function buildSectionPath(metadata: Partial<ChunkMetadata>): string {
  const parts: string[] = [];
  for (let level = 1; level <= 6; level++) {
    const key = `heading_${level}` as keyof ChunkMetadata;
    const value = metadata[key];
    if (typeof value === "string") {
      parts.push(value);
    }
  }
  return parts.join(" > ");
}

/**
 * Enrich chunk metadata with token counts, position info, and heading info.
 */
function enrichMetadata(
  text: string,
  existingMetadata: Partial<ChunkMetadata> = {},
  index: number,
  totalChunks: number,
  pageNumber?: number
): ChunkMetadata {
  const headingMeta = extractHeadingMetadata(text);
  const sectionPath = buildSectionPath({ ...existingMetadata, ...headingMeta });

  return {
    tags: [],
    keywords: [],
    custom: {},
    ...existingMetadata,
    ...headingMeta,
    token_count: calculateTokenCount(text),
    section_path: sectionPath || undefined,
    position_in_document: index,
    total_chunks: totalChunks,
    page: pageNumber,
  };
}

/**
 * Recalculate automatic metadata fields for an existing chunk.
 * Used after chunk editing or during enrichment to ensure metadata is up-to-date.
 * Preserves existing page number and custom fields.
 *
 * @param chunk - The chunk to recalculate metadata for
 * @param index - The chunk's position in the document (0-indexed)
 * @param totalChunks - Total number of chunks in the document
 * @returns Updated chunk metadata with recalculated automatic fields
 */
export function recalculateChunkMetadata(
  chunk: Chunk,
  index: number,
  totalChunks: number
): ChunkMetadata {
  const existingMetadata = chunk.metadata || {};
  const headingMeta = extractHeadingMetadata(chunk.text);
  const sectionPath = buildSectionPath({ ...existingMetadata, ...headingMeta });

  // Start with existing metadata to preserve page, custom fields, etc.
  // Then apply recalculated automatic fields
  return {
    // Preserve existing metadata first (includes page, custom, tags, keywords, etc.)
    ...existingMetadata,
    // Recalculate heading metadata from text (overwrites old heading fields)
    ...headingMeta,
    // Recalculate automatic fields (always overwrite)
    token_count: calculateTokenCount(chunk.text),
    section_path: sectionPath || undefined,
    position_in_document: index,
    total_chunks: totalChunks,
  };
}

/**
 * Convert Mastra Document array to our MastraChunk format.
 */
function toMastraChunks(docs: Array<{ text: string; metadata?: Record<string, any> }>): MastraChunk[] {
  return docs.map((doc) => ({
    text: doc.text,
    metadata: doc.metadata,
  }));
}

/**
 * Execute recursive chunking strategy.
 */
async function chunkRecursive(
  doc: MDocument,
  config: ChunkingConfig
): Promise<MastraChunk[]> {
  const docs = await doc.chunk({
    strategy: "recursive",
    maxSize: config.chunk_size || 1000,
    overlap: 0,
    separators: config.separators || ["\n\n", "\n", ". ", " ", ""],
  });
  return toMastraChunks(docs);
}

/**
 * Execute paragraph chunking strategy.
 * Maps to recursive with paragraph-only separators.
 */
async function chunkParagraph(
  doc: MDocument,
  config: ChunkingConfig
): Promise<MastraChunk[]> {
  const docs = await doc.chunk({
    strategy: "recursive",
    maxSize: config.max_section_size || 2000,
    overlap: 0,
    separators: ["\n\n"],
  });
  return toMastraChunks(docs);
}

/**
 * Execute by_heading chunking strategy.
 * Maps to markdown strategy with header-based splitting.
 */
async function chunkByHeading(
  doc: MDocument,
  config: ChunkingConfig
): Promise<MastraChunk[]> {
  const headingLevels = config.heading_levels || [1, 2, 3];

  const headers: Array<[string, string]> = headingLevels.map((level) => [
    "#".repeat(level),
    `heading_${level}`,
  ]);

  const docs = await doc.chunk({
    strategy: "markdown",
    headers,
    stripHeaders: false,
  });
  return toMastraChunks(docs);
}

/**
 * Execute semantic chunking strategy.
 * Uses Mastra's semantic-markdown which groups by header families.
 */
async function chunkSemantic(
  doc: MDocument,
  config: ChunkingConfig
): Promise<MastraChunk[]> {
  const docs = await doc.chunk({
    strategy: "semantic-markdown",
    joinThreshold: config.chunk_size || 500,
  } as any);
  return toMastraChunks(docs);
}

/**
 * Execute sentence chunking strategy.
 */
async function chunkSentence(
  doc: MDocument,
  config: ChunkingConfig
): Promise<MastraChunk[]> {
  const sentencesPerChunk = config.sentences_per_chunk || 5;
  const maxSize = sentencesPerChunk * 100;

  const docs = await doc.chunk({
    strategy: "sentence",
    maxSize,
    overlap: 0,
  } as any);
  return toMastraChunks(docs);
}

/**
 * Execute token chunking strategy.
 */
async function chunkToken(
  doc: MDocument,
  config: ChunkingConfig
): Promise<MastraChunk[]> {
  const docs = await doc.chunk({
    strategy: "token",
    maxSize: config.chunk_size || 512,
    overlap: 0,
  } as any);
  return toMastraChunks(docs);
}

/**
 * Execute hierarchical chunking strategy.
 * Custom implementation using two-pass recursive chunking.
 */
async function chunkHierarchical(
  doc: MDocument,
  config: ChunkingConfig,
  markdown: string
): Promise<MastraChunk[]> {
  const chunkSizes = config.chunk_sizes || [2048, 512];
  const results: MastraChunk[] = [];
  let chunkIdCounter = 0;

  const parentDocs = await doc.chunk({
    strategy: "recursive",
    maxSize: chunkSizes[0],
    overlap: 0,
  });

  for (const parentDoc of parentDocs) {
    const parentId = `hier-${chunkIdCounter++}`;
    const childIds: string[] = [];

    if (chunkSizes.length > 1 && parentDoc.text.length > chunkSizes[1]) {
      const childMDoc = MDocument.fromMarkdown(parentDoc.text);
      const childDocs = await childMDoc.chunk({
        strategy: "recursive",
        maxSize: chunkSizes[1],
        overlap: 0,
      });

      for (const childDoc of childDocs) {
        const childId = `hier-${chunkIdCounter++}`;
        childIds.push(childId);
        results.push({
          text: childDoc.text,
          metadata: {
            parent_chunk_id: parentId,
            depth_level: 1,
            _tempId: childId,
          },
        });
      }
    }

    results.push({
      text: parentDoc.text,
      metadata: {
        child_chunk_ids: childIds.length > 0 ? childIds : undefined,
        depth_level: 0,
        _tempId: parentId,
      },
    });
  }

  return results;
}

/**
 * Execute character chunking strategy (native Mastra).
 */
async function chunkCharacter(
  doc: MDocument,
  config: ChunkingConfig
): Promise<MastraChunk[]> {
  const docs = await doc.chunk({
    strategy: "character",
    maxSize: config.chunk_size || 1000,
    overlap: 0,
    separator: "\n\n",
  });
  return toMastraChunks(docs);
}

/**
 * Execute HTML chunking strategy (native Mastra).
 * Falls back to recursive for markdown content since HTML strategy requires HTML input.
 */
async function chunkHtml(
  doc: MDocument,
  config: ChunkingConfig
): Promise<MastraChunk[]> {
  // HTML strategy requires headers or sections, fall back to recursive for markdown
  const docs = await doc.chunk({
    strategy: "recursive",
    maxSize: config.chunk_size || 1000,
    overlap: 0,
    separators: ["</p>", "</div>", "</section>", "\n\n", "\n"],
  });
  return toMastraChunks(docs);
}

/**
 * Execute JSON chunking strategy (native Mastra).
 */
async function chunkJson(
  doc: MDocument,
  config: ChunkingConfig
): Promise<MastraChunk[]> {
  const docs = await doc.chunk({
    strategy: "json",
    maxSize: config.chunk_size || 1000,
    overlap: 0,
  } as any);
  return toMastraChunks(docs);
}

/**
 * Execute LaTeX chunking strategy (native Mastra).
 */
async function chunkLatex(
  doc: MDocument,
  config: ChunkingConfig
): Promise<MastraChunk[]> {
  const docs = await doc.chunk({
    strategy: "latex",
    maxSize: config.chunk_size || 1000,
    overlap: 0,
  } as any);
  return toMastraChunks(docs);
}

/**
 * Main chunking function using Mastra.
 * Accepts markdown text, strategy, and configuration.
 * Returns chunks with accurate character offsets snapped to line boundaries.
 */
export async function chunkWithMastra(
  markdown: string,
  strategy: string,
  config: ChunkingConfig = {}
): Promise<MastraChunkResult> {
  const doc = MDocument.fromMarkdown(markdown);

  let mastraChunks: MastraChunk[];

  switch (strategy) {
    case "recursive":
      mastraChunks = await chunkRecursive(doc, config);
      break;
    case "paragraph":
      mastraChunks = await chunkParagraph(doc, config);
      break;
    case "by_heading":
    case "markdown":
      mastraChunks = await chunkByHeading(doc, config);
      break;
    case "semantic":
    case "semantic-markdown":
      mastraChunks = await chunkSemantic(doc, config);
      break;
    case "sentence":
      mastraChunks = await chunkSentence(doc, config);
      break;
    case "token":
      mastraChunks = await chunkToken(doc, config);
      break;
    case "hierarchical":
      mastraChunks = await chunkHierarchical(doc, config, markdown);
      break;
    case "character":
      mastraChunks = await chunkCharacter(doc, config);
      break;
    case "html":
      mastraChunks = await chunkHtml(doc, config);
      break;
    case "json":
      mastraChunks = await chunkJson(doc, config);
      break;
    case "latex":
      mastraChunks = await chunkLatex(doc, config);
      break;
    default:
      console.warn(`Unknown strategy "${strategy}", falling back to recursive`);
      mastraChunks = await chunkRecursive(doc, config);
  }

  // Calculate character offsets with line-boundary snapping
  const chunkTexts = mastraChunks.map((c) => c.text);
  const offsets = calculateOffsets(markdown, chunkTexts);

  // Calculate page boundaries for page number assignment
  // (only works for LlamaParse-processed documents with --- separators)
  const pageBoundaries = calculatePageBoundaries(markdown);
  const totalChunks = mastraChunks.length;

  // Build final chunks with enriched metadata
  const chunks: Chunk[] = mastraChunks.map((mastraChunk, index) => {
    const { startOffset, endOffset } = offsets[index];
    const snappedText = markdown.slice(startOffset, endOffset);
    const pageNumber = getPageNumber(startOffset, pageBoundaries);

    return {
      id: `chunk-${Date.now()}-${index}`,
      text: snappedText,
      metadata: enrichMetadata(snappedText, mastraChunk.metadata || {}, index, totalChunks, pageNumber),
      order: index,
      startOffset,
      endOffset,
      hasOverlap: false,
    };
  });

  return {
    chunks,
    strategy,
  };
}
