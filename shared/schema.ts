import { z } from "zod";
import { customFieldsSchema, type CustomFields } from "./metadata-schema";

// Re-export metadata schema types for convenience
export { customFieldsSchema, type CustomFields } from "./metadata-schema";
export type { FieldDefinition, FieldType, MetadataSchema, CustomFieldValue } from "./metadata-schema";

// Chunk metadata schema
export const chunkMetadataSchema = z.object({
  title: z.string().optional(),
  author: z.string().optional(),
  page: z.number().optional(),
  tags: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
  summary: z.string().optional(),
  custom: customFieldsSchema.default({}),

  // Heading hierarchy (from by_heading strategy)
  heading_1: z.string().optional(),
  heading_2: z.string().optional(),
  heading_3: z.string().optional(),
  heading_4: z.string().optional(),
  heading_5: z.string().optional(),
  heading_6: z.string().optional(),
  section_path: z.string().optional(),  // e.g., "Introduction > Background > History"
  heading_level: z.number().min(1).max(6).optional(),

  // Token information
  token_count: z.number().optional(),

  // Position information (auto-generated)
  position_in_document: z.number().optional(),
  total_chunks: z.number().optional(),

  // Hierarchical relationships (from hierarchical strategy)
  parent_chunk_id: z.string().optional(),
  child_chunk_ids: z.array(z.string()).optional(),
  depth_level: z.number().optional(),
});

export type ChunkMetadata = z.infer<typeof chunkMetadataSchema>;

// Document metadata schema (populated during PDF upload)
export const documentMetadataSchema = z.object({
  pageCount: z.number().optional(),
  fileSize: z.number().optional(),
  uploadedAt: z.string().optional(),
  originalFilename: z.string().optional(),
  // User-editable fields
  title: z.string().optional(),
  author: z.string().optional(),
  description: z.string().optional(),
  // Custom metadata (from schema or ad-hoc)
  custom: customFieldsSchema.default({}),
});

export type DocumentMetadata = z.infer<typeof documentMetadataSchema>;

// Chunking configuration schema
export const chunkingConfigSchema = z.object({
  // Common settings
  chunk_size: z.number().optional(),
  overlap: z.number().optional(),
  unit: z.enum(['characters', 'tokens']).optional(),

  // Semantic-specific settings
  embedding_model: z.enum(['openai', 'huggingface', 'fast']).optional(),
  buffer_size: z.number().min(1).max(10).optional(),
  threshold: z.number().min(0).max(100).optional(),

  // Markdown/Heading-specific settings
  heading_levels: z.array(z.number().min(1).max(6)).optional(),
  preserve_hierarchy: z.boolean().optional(),
  max_section_size: z.number().optional(),

  // Recursive-specific settings
  separators: z.array(z.string()).optional(),

  // Sentence-specific settings
  sentences_per_chunk: z.number().min(1).max(20).optional(),
  overlap_sentences: z.number().min(0).max(5).optional(),

  // Token-specific settings
  model_encoding: z.string().optional(),  // e.g., "cl100k_base" for GPT-4

  // Hierarchical-specific settings
  chunk_sizes: z.array(z.number()).optional(),  // Multi-level sizes [2048, 512, 128]
});

export type ChunkingConfig = z.infer<typeof chunkingConfigSchema>;

// Chunk schema
export const chunkSchema = z.object({
  id: z.string(),
  text: z.string(),
  metadata: chunkMetadataSchema,
  order: z.number(),
  // Character offset fields for overlay mode (optional for backward compatibility)
  startOffset: z.number().optional(),
  endOffset: z.number().optional(),
  hasOverlap: z.boolean().default(false),
});

export type Chunk = z.infer<typeof chunkSchema>;

// Helper to check if chunk supports overlay mode
export function supportsOverlayMode(chunk: Chunk): boolean {
  return chunk.startOffset !== undefined && chunk.endOffset !== undefined;
}

// Helper to extract text from markdown using offsets
export function extractChunkText(chunk: Chunk, markdown: string): string {
  if (chunk.startOffset !== undefined && chunk.endOffset !== undefined) {
    return markdown.slice(chunk.startOffset, chunk.endOffset);
  }
  return chunk.text;
}

// Database chunk type (matches Drizzle schema with camelCase)
export interface DbChunk {
  id: string;
  uploadId: string;
  content: string;
  markdownContent: string;
  position: number;
  startOffset: number | null;
  endOffset: number | null;
  hasOverlap: boolean | null;
  metadata: ChunkMetadata;
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
}

// Convert frontend Chunk to database format
export function toDbChunk(
  chunk: Chunk,
  uploadId: string
): Omit<DbChunk, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    uploadId,
    content: chunk.text,
    markdownContent: chunk.text,
    position: chunk.order,
    startOffset: chunk.startOffset ?? null,
    endOffset: chunk.endOffset ?? null,
    hasOverlap: chunk.hasOverlap ?? false,
    metadata: chunk.metadata,
  };
}

// Convert database chunk to frontend format
export function fromDbChunk(dbChunk: DbChunk): Chunk {
  return {
    id: dbChunk.id,
    text: dbChunk.markdownContent,
    metadata: dbChunk.metadata,
    order: dbChunk.position,
    startOffset: dbChunk.startOffset ?? undefined,
    endOffset: dbChunk.endOffset ?? undefined,
    hasOverlap: dbChunk.hasOverlap ?? false,
  };
}

// Upload schema (matches Drizzle ORM output - camelCase)
export interface Upload {
  id: string;
  userId: string;
  title: string;
  originalFilename: string;
  filePath: string;
  fileSize: number;
  chunkingStrategy: string;
  metadata: DocumentMetadata;
  // Custom metadata schema support
  schemaId: string | null;
  customMetadata: CustomFields;
  createdAt: Date | string;
  updatedAt: Date | string;
  markdown: string | null; // Legacy - kept for backward compatibility
  markdownPath: string | null; // Path to markdown file in storage
}

// Backward compatibility alias
export type Document = Upload;

export const insertUploadSchema = z.object({
  userId: z.string().uuid(),
  title: z.string().min(1, "Upload title is required"),
  originalFilename: z.string(),
  filePath: z.string(),
  fileSize: z.number(),
  chunkingStrategy: z.string(),
  markdown: z.string().nullable(),
  markdownPath: z.string().nullable().optional(),
  metadata: documentMetadataSchema.default({}),
  schemaId: z.string().uuid().nullable().optional(),
  customMetadata: customFieldsSchema.default({}),
});

export type InsertUpload = z.infer<typeof insertUploadSchema>;

// Backward compatibility alias
export const insertDocumentSchema = insertUploadSchema;
export type InsertDocument = InsertUpload;


export type ChunkStrategy =
  | "recursive"         // Smart fixed-size (replaces "fixed")
  | "paragraph"         // Paragraph-based
  | "by_heading"        // Markdown heading-based
  | "semantic"          // Semantic (header-family based)
  | "sentence"          // Sentence-based
  | "token"             // Token-aware
  | "hierarchical"      // Parent-child relationships
  // Native Mastra strategies
  | "character"         // Simple character-based splits
  | "html"              // HTML structure-aware
  | "json"              // JSON structure-aware
  | "latex"             // LaTeX structure-aware
  | "markdown"          // Markdown heading-aware (alias for by_heading)
  | "semantic-markdown"; // Semantic markdown (header families)

export type ExportFormat = "json" | "jsonl" | "csv" | "markdown" | "pinecone" | "chroma";

// Overlap unit for export
export type OverlapUnit = "characters" | "tokens";

export type EmbeddingModel = "openai" | "huggingface" | "fast";
export type ChunkUnit = "characters" | "tokens";
export type ParserMethod = "llamaparse" | "markitdown" | "docling";

export interface ChunkSession {
  id: string;
  document_id: string;
  user_id: string;
  strategy: ChunkStrategy;
  overlap: number;
  format: ExportFormat;
  chunks: Chunk[];
  created_at: string;
}

export const insertChunkSessionSchema = z.object({
  document_id: z.string(),
  strategy: z.enum(["fixed", "paragraph", "by_heading", "semantic"]),
  overlap: z.number().min(0).default(0),
  format: z.enum(["json", "jsonl", "csv", "markdown"]).default("json"),
  chunks: z.array(chunkSchema),
});

export type InsertChunkSession = z.infer<typeof insertChunkSessionSchema>;

// Upload response
export interface UploadResponse {
  upload: Upload;
  markdown: string;
  // Backward compatibility
  document?: Upload;
}

// Chunking request
export const chunkingRequestSchema = z.object({
  markdown: z.string(),
  strategy: z.enum([
    "recursive",
    "paragraph",
    "by_heading",
    "semantic",
    "sentence",
    "token",
    "hierarchical",
    // Native Mastra strategies
    "character",
    "html",
    "json",
    "latex",
    "markdown",
    "semantic-markdown",
  ]),
  config: chunkingConfigSchema.optional(),
  documentId: z.string().uuid().optional(),
  autoSave: z.boolean().optional().default(true),
});

export type ChunkingRequest = z.infer<typeof chunkingRequestSchema>;

// Export request
export const exportRequestSchema = z.object({
  uploadId: z.string().uuid().optional(),
  // Backward compatibility alias
  documentId: z.string().uuid().optional(),
  chunks: z.array(chunkSchema),
  format: z.enum(["json", "jsonl", "csv", "markdown", "pinecone", "chroma"]),
  includeMetadata: z.boolean().default(true),
  overlap: z.number().default(0),
  overlapUnit: z.enum(["characters", "tokens"]).default("characters"),
  idPrefix: z.string().optional(),
});

export type ExportRequest = z.infer<typeof exportRequestSchema>;

// Export response for JSON format (nested structure)
export interface JsonExportResponse {
  document: {
    id: string;
    title: string;
    metadata: DocumentMetadata;
  } | null;
  chunks: Array<{
    id: string;
    text: string;
    order: number;
    metadata?: ChunkMetadata;
  }>;
  exportedAt: string;
}

// Vector DB export formats
export interface PineconeExportItem {
  id: string;
  text: string;
  metadata: Record<string, unknown>;
}

export interface ChromaExportResponse {
  ids: string[];
  documents: string[];
  metadatas: Record<string, unknown>[];
}
