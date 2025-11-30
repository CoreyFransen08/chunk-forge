import { pgTable, uuid, text, integer, timestamp, jsonb, boolean, index } from 'drizzle-orm/pg-core';
import type { ChunkMetadata, DocumentMetadata } from '@shared/schema';
import type { FieldDefinition, CustomFields } from '@shared/metadata-schema';

/**
 * Metadata schemas - user-defined schemas for custom metadata fields
 * Open source version: No user scoping, all schemas accessible
 */
export const metadataSchemas = pgTable(
  'metadata_schemas',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    description: text('description'),
    documentFields: jsonb('document_fields').default([]).notNull().$type<FieldDefinition[]>(),
    chunkFields: jsonb('chunk_fields').default([]).notNull().$type<FieldDefinition[]>(),
    chunkEnrichmentPrompt: text('chunk_enrichment_prompt'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  }
);

/**
 * Uploads table - stores uploaded files (PDFs, etc.) converted to markdown
 * Open source version: No user scoping
 */
export const uploads = pgTable(
  'uploads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull(),
    originalFilename: text('original_filename').notNull(),
    filePath: text('file_path').notNull(),
    fileSize: integer('file_size').notNull(),
    chunkingStrategy: text('chunking_strategy').notNull(),
    markdown: text('markdown'), // Legacy - kept for backward compatibility
    markdownPath: text('markdown_path'), // New - path to markdown file in storage
    metadata: jsonb('metadata').default({}).notNull().$type<DocumentMetadata>(),
    // Custom metadata schema support
    schemaId: uuid('schema_id').references(() => metadataSchemas.id, { onDelete: 'set null' }),
    customMetadata: jsonb('custom_metadata').default({}).notNull().$type<CustomFields>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index('idx_uploads_schema_id').on(table.schemaId),
  ]
);

/**
 * Chunks table - stores individual chunks for uploads
 * Related one-to-many with uploads (cascading delete)
 */
export const chunks = pgTable(
  'chunks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    uploadId: uuid('upload_id')
      .references(() => uploads.id, { onDelete: 'cascade' })
      .notNull(),
    content: text('content').notNull(),
    markdownContent: text('markdown_content').notNull(),
    position: integer('position').notNull(),
    // Character offset fields for overlay mode (nullable for backward compatibility)
    startOffset: integer('start_offset'),
    endOffset: integer('end_offset'),
    hasOverlap: boolean('has_overlap').default(false),
    metadata: jsonb('metadata').default({}).notNull().$type<ChunkMetadata>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index('idx_chunks_upload_id').on(table.uploadId),
    index('idx_chunks_position').on(table.uploadId, table.position),
    index('idx_chunks_offsets').on(table.uploadId, table.startOffset, table.endOffset),
  ]
);

// Type exports for use in application code
export type MetadataSchemaRecord = typeof metadataSchemas.$inferSelect;
export type InsertMetadataSchema = typeof metadataSchemas.$inferInsert;

export type Upload = typeof uploads.$inferSelect;
export type InsertUpload = typeof uploads.$inferInsert;

export type Chunk = typeof chunks.$inferSelect;
export type InsertChunk = typeof chunks.$inferInsert;
