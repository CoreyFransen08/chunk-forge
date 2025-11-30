import type { Express } from "express";
import { eq, asc } from "drizzle-orm";
import { db } from "../database";
import { uploads, chunks, metadataSchemas } from "../db-schema";
import { extractDocumentInfo, enrichChunkMetadata, enrichChunksMetadata } from "../agents";
import { recalculateChunkMetadata } from "../services/mastra-chunker";
import { fromDbChunk, type DocumentMetadata, type ChunkMetadata } from "@shared/schema";
import type { MetadataSchema } from "@shared/metadata-schema";


export function registerAgentRoutes(app: Express) {
  /**
   * POST /api/agents/upload-info/:uploadId
   *
   * Extract document info (title, author, description) from an upload's markdown.
   * Uses AI to analyze the first 3 pages and extract metadata.
   */
  app.post("/api/agents/upload-info/:uploadId", async (req, res) => {
    try {
      // Fetch the upload
      const [upload] = await db
        .select()
        .from(uploads)
        .where(eq(uploads.id, req.params.uploadId))
        .limit(1);

      if (!upload) {
        return res.status(404).json({ error: "Upload not found" });
      }

      if (!upload.markdown) {
        return res.status(400).json({
          error: "Upload has no markdown content for extraction",
        });
      }

      // Extract document info using the AI agent
      const extracted = await extractDocumentInfo(upload.markdown);

      // Update the upload with extracted metadata
      const currentMetadata = (upload.metadata || {}) as DocumentMetadata;
      const updatedMetadata: DocumentMetadata = {
        ...currentMetadata,
        custom: currentMetadata.custom || {},
        title: extracted.title || currentMetadata.title,
        author: extracted.author || currentMetadata.author,
        description: extracted.description || currentMetadata.description,
      };

      // Update upload in database
      const [updatedUpload] = await db
        .update(uploads)
        .set({
          metadata: updatedMetadata,
          updatedAt: new Date(),
        })
        .where(eq(uploads.id, req.params.uploadId))
        .returning();

      res.json({
        extracted,
        upload: updatedUpload,
      });
    } catch (error: any) {
      console.error("Upload info extraction error:", error);

      // Provide specific error messages for common issues
      if (error.message?.includes("OPENAI_API_KEY") || error.message?.includes("API key")) {
        return res.status(503).json({
          error: "AI service not configured",
          details: "OpenAI API key is missing or invalid",
        });
      }

      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/agents/enrich-chunk/:uploadId/:chunkId
   *
   * Enrich a single chunk's metadata using AI based on the schema's enrichment prompt.
   */
  app.post("/api/agents/enrich-chunk/:uploadId/:chunkId", async (req, res) => {
    try {
      // Fetch the upload
      const [upload] = await db
        .select()
        .from(uploads)
        .where(eq(uploads.id, req.params.uploadId))
        .limit(1);

      if (!upload) {
        return res.status(404).json({ error: "Upload not found" });
      }

      // Check if upload has a schema
      if (!upload.schemaId) {
        return res.status(400).json({ error: "Upload has no schema assigned" });
      }

      // Fetch the schema
      const [schema] = await db
        .select()
        .from(metadataSchemas)
        .where(eq(metadataSchemas.id, upload.schemaId))
        .limit(1);

      if (!schema) {
        return res.status(404).json({ error: "Schema not found" });
      }

      if (!schema.chunkEnrichmentPrompt) {
        return res.status(400).json({ error: "Schema has no enrichment prompt configured" });
      }

      // Fetch the specific chunk
      const [dbChunk] = await db
        .select()
        .from(chunks)
        .where(eq(chunks.id, req.params.chunkId))
        .limit(1);

      if (!dbChunk) {
        return res.status(404).json({ error: "Chunk not found" });
      }

      // Get all chunks ordered by position to calculate actual index
      const allChunksOrdered = await db
        .select()
        .from(chunks)
        .where(eq(chunks.uploadId, req.params.uploadId))
        .orderBy(asc(chunks.position));
      const totalChunks = allChunksOrdered.length;

      // Find actual position (index in ordered list, not stored position which may have gaps)
      const actualPosition = allChunksOrdered.findIndex(c => c.id === req.params.chunkId);

      // Convert to frontend Chunk format for agent
      const chunk = fromDbChunk(dbChunk);

      // Enrich the chunk metadata using AI
      const enrichedFields = await enrichChunkMetadata(chunk, schema as unknown as MetadataSchema);

      // Recalculate automatic metadata fields (token_count, headings, position, etc.)
      const recalculatedMetadata = recalculateChunkMetadata(chunk, actualPosition, totalChunks);

      // Merge: recalculated automatic fields + AI-enriched custom fields
      const updatedMetadata: ChunkMetadata = {
        ...recalculatedMetadata,
        custom: {
          ...(recalculatedMetadata.custom || {}),
          ...enrichedFields,
        },
      };

      // Update chunk in database
      await db
        .update(chunks)
        .set({
          metadata: updatedMetadata,
          updatedAt: new Date(),
        })
        .where(eq(chunks.id, req.params.chunkId));

      // Fetch updated chunk
      const [updatedDbChunk] = await db
        .select()
        .from(chunks)
        .where(eq(chunks.id, req.params.chunkId))
        .limit(1);

      res.json({
        chunk: fromDbChunk(updatedDbChunk),
        enrichedFields,
      });
    } catch (error: any) {
      console.error("Chunk enrichment error:", error);

      if (error.message?.includes("OPENAI_API_KEY") || error.message?.includes("API key")) {
        return res.status(503).json({
          error: "AI service not configured",
          details: "OpenAI API key is missing or invalid",
        });
      }

      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/agents/enrich-chunks/:uploadId
   *
   * Enrich multiple chunks' metadata (batch processing).
   */
  app.post("/api/agents/enrich-chunks/:uploadId", async (req, res) => {
    try {
      // Parse optional limit
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      if (limit !== undefined && (isNaN(limit) || limit < 1)) {
        return res.status(400).json({ error: "Invalid limit parameter" });
      }

      // Fetch the upload
      const [upload] = await db
        .select()
        .from(uploads)
        .where(eq(uploads.id, req.params.uploadId))
        .limit(1);

      if (!upload) {
        return res.status(404).json({ error: "Upload not found" });
      }

      if (!upload.schemaId) {
        return res.status(400).json({ error: "Upload has no schema assigned" });
      }

      // Fetch the schema
      const [schema] = await db
        .select()
        .from(metadataSchemas)
        .where(eq(metadataSchemas.id, upload.schemaId))
        .limit(1);

      if (!schema) {
        return res.status(404).json({ error: "Schema not found" });
      }

      if (!schema.chunkEnrichmentPrompt) {
        return res.status(400).json({ error: "Schema has no enrichment prompt configured" });
      }

      // Fetch chunks ordered by position, with optional limit
      let query = db
        .select()
        .from(chunks)
        .where(eq(chunks.uploadId, req.params.uploadId))
        .orderBy(asc(chunks.position));

      const dbChunks = limit
        ? await query.limit(limit)
        : await query;

      if (dbChunks.length === 0) {
        return res.json({
          results: [],
          summary: { enriched: 0, failed: 0, total: 0 },
        });
      }

      // Get total count for summary
      const allChunks = await db
        .select()
        .from(chunks)
        .where(eq(chunks.uploadId, req.params.uploadId));
      const totalChunks = allChunks.length;

      // Convert to frontend format
      const chunksToEnrich = dbChunks.map(fromDbChunk);

      // Enrich all chunks
      const enrichmentResults = await enrichChunksMetadata(
        chunksToEnrich,
        schema as unknown as MetadataSchema
      );

      // Update each chunk in the database with recalculated metadata
      let enrichedCount = 0;
      let failedCount = 0;

      for (const result of enrichmentResults) {
        if (result.success) {
          // Find the original db chunk and frontend chunk
          const dbChunk = dbChunks.find(c => c.id === result.chunkId);
          const frontendChunk = chunksToEnrich.find(c => c.id === result.chunkId);

          if (dbChunk && frontendChunk) {
            // Find actual index in the ordered dbChunks array (not stored position which may have gaps)
            const actualIndex = dbChunks.findIndex(c => c.id === result.chunkId);

            // Recalculate automatic metadata fields (token_count, headings, position, etc.)
            const recalculatedMetadata = recalculateChunkMetadata(
              frontendChunk,
              actualIndex,
              totalChunks
            );

            // Merge: recalculated automatic fields + AI-enriched custom fields
            const updatedMetadata: ChunkMetadata = {
              ...recalculatedMetadata,
              custom: {
                ...(recalculatedMetadata.custom || {}),
                ...result.enrichedFields,
              },
            };

            await db
              .update(chunks)
              .set({
                metadata: updatedMetadata,
                updatedAt: new Date(),
              })
              .where(eq(chunks.id, result.chunkId));

            enrichedCount++;
          }
        } else {
          failedCount++;
        }
      }

      res.json({
        results: enrichmentResults,
        summary: {
          enriched: enrichedCount,
          failed: failedCount,
          total: totalChunks,
          processed: dbChunks.length,
        },
      });
    } catch (error: any) {
      console.error("Batch chunk enrichment error:", error);

      if (error.message?.includes("OPENAI_API_KEY") || error.message?.includes("API key")) {
        return res.status(503).json({
          error: "AI service not configured",
          details: "OpenAI API key is missing or invalid",
        });
      }

      res.status(500).json({ error: error.message });
    }
  });
}
