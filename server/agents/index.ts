/**
 * Server Agents - AI-powered extraction and analysis agents
 *
 * This barrel file exports all agents for clean imports throughout the codebase.
 * Each agent handles a specific domain of AI-powered functionality.
 */

// Document Info Agent - extracts title, author, description from documents
export {
  documentInfoAgent,
  extractDocumentInfo,
  documentInfoSchema,
} from "./document-info-agent";

export type { DocumentInfo } from "./document-info-agent";

// Chunk Enrichment Agent - enriches chunk metadata based on schema fields
export {
  enrichChunkMetadata,
  enrichChunksMetadata,
  buildDynamicSchema,
  createEnrichmentAgent,
  getEditableChunkFields,
  canEnrichChunks,
} from "./chunk-enrichment-agent";

export type { ChunkEnrichmentResult } from "./chunk-enrichment-agent";
