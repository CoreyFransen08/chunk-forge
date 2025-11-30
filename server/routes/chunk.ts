import type { Express } from "express";
import { chunkingRequestSchema } from "@shared/schema";
import type { Chunk } from "@shared/schema";
import { db } from "../db-connection";
import { chunks, uploads, metadataSchemas } from "../db-schema";
import { eq } from "drizzle-orm";
import { toDbChunk, fromDbChunk } from "@shared/schema";
import type { FieldDefinition } from "@shared/metadata-schema";
import { chunkWithMastra } from "../services/mastra-chunker";

export function registerChunkRoutes(app: Express) {
  // Generate chunks from markdown
  app.post("/api/chunk", async (req, res) => {
    try {
      const parsed = chunkingRequestSchema.parse(req.body);
      const { markdown, strategy, config, documentId, autoSave } = parsed;

      // Fetch schema chunk fields if documentId (uploadId) is provided
      let schemaChunkFields: FieldDefinition[] | null = null;
      let upload: any = null;
      const uploadId = documentId; // documentId in request is actually uploadId

      if (uploadId) {
        // Fetch upload with its schema
        const [doc] = await db
          .select()
          .from(uploads)
          .where(eq(uploads.id, uploadId))
          .limit(1);

        if (doc && doc.schemaId) {
          upload = doc;
          // Fetch the schema to get chunk fields
          const [schema] = await db
            .select()
            .from(metadataSchemas)
            .where(eq(metadataSchemas.id, doc.schemaId));

          if (schema) {
            schemaChunkFields = schema.chunkFields as FieldDefinition[] || [];
            console.log("Using schema chunk fields:", schemaChunkFields.map(f => f.name));
          }
        }
      }

      // Use Mastra for all chunking (moved from Python parser service)
      const result = await chunkWithMastra(markdown, strategy, config || {});
      let generatedChunks: Chunk[] = result.chunks;

      // Auto-save to database if upload was verified and autoSave is true
      if (upload && autoSave !== false) {
        try {
          const savedChunks = await db.transaction(async (tx) => {
            // Delete existing chunks
            await tx
              .delete(chunks)
              .where(eq(chunks.uploadId, uploadId!));

            // Insert new chunks
            const chunksToInsert = generatedChunks.map((chunk) =>
              toDbChunk(chunk, uploadId!)
            );

            const inserted = await tx
              .insert(chunks)
              .values(chunksToInsert)
              .returning();

            // Update upload's chunking strategy
            await tx
              .update(uploads)
              .set({
                chunkingStrategy: strategy,
                updatedAt: new Date(),
              })
              .where(eq(uploads.id, uploadId!));

            return inserted;
          });

          // Return chunks with real database IDs
          const responseChunks = savedChunks.map(fromDbChunk);
          return res.json({ chunks: responseChunks, saved: true });
        } catch (saveError) {
          console.error("Auto-save failed:", saveError);
          // Continue with unsaved chunks
        }
      }

      res.json({ chunks: generatedChunks, saved: false });
    } catch (error: any) {
      console.error("Chunking error:", error);
      res.status(500).json({ error: error.message });
    }
  });
}
