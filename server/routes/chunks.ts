import type { Express } from "express";
import { db } from "../db-connection";
import { chunks, uploads } from "../db-schema";
import { eq, asc } from "drizzle-orm";
import { fromDbChunk, toDbChunk, type Chunk } from "@shared/schema";

export function registerChunkCrudRoutes(app: Express) {

  // GET /api/uploads/:uploadId/chunks
  // Load all chunks for an upload
  app.get("/api/uploads/:uploadId/chunks", async (req, res) => {
    try {
      // Verify upload exists
      const [upload] = await db
        .select()
        .from(uploads)
        .where(eq(uploads.id, req.params.uploadId))
        .limit(1);

      if (!upload) {
        return res.status(404).json({ error: "Upload not found" });
      }

      // Load chunks ordered by position
      const dbChunks = await db
        .select()
        .from(chunks)
        .where(eq(chunks.uploadId, req.params.uploadId))
        .orderBy(asc(chunks.position));

      // Map to frontend Chunk format
      const responseChunks = dbChunks.map(fromDbChunk);

      res.json({ chunks: responseChunks });
    } catch (error: any) {
      console.error("Load chunks error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/uploads/:uploadId/chunks
  // Save/replace chunks for an upload
  app.post("/api/uploads/:uploadId/chunks", async (req, res) => {
    try {
      const { chunks: incomingChunks, strategy } = req.body as {
        chunks: Chunk[];
        strategy: string;
      };

      if (!incomingChunks || !Array.isArray(incomingChunks)) {
        return res.status(400).json({ error: "Invalid chunks data" });
      }

      // Verify upload exists
      const [upload] = await db
        .select()
        .from(uploads)
        .where(eq(uploads.id, req.params.uploadId))
        .limit(1);

      if (!upload) {
        return res.status(404).json({ error: "Upload not found" });
      }

      // Recalculate token counts via parser service
      let chunksWithTokens = incomingChunks;
      if (incomingChunks.length > 0) {
        try {
          const parserUrl = process.env.PARSER_SERVICE_URL || "http://localhost:8000";
          const tokenResponse = await fetch(`${parserUrl}/calculate-tokens`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              texts: incomingChunks.map(c => c.text),
              model: "gpt-4"
            }),
          });

          if (tokenResponse.ok) {
            const tokenData = await tokenResponse.json();
            // Update chunks with new token counts
            chunksWithTokens = incomingChunks.map((chunk, index) => ({
              ...chunk,
              metadata: {
                ...chunk.metadata,
                token_count: tokenData.token_counts[index],
              }
            }));
          } else {
            console.warn("Token calculation failed, saving without updating token counts");
          }
        } catch (tokenError) {
          console.warn("Could not reach parser service for token calculation:", tokenError);
          // Continue without updating token counts
        }
      }

      // Transaction: Delete old chunks and insert new ones
      await db.transaction(async (tx) => {
        // Delete existing chunks for this upload
        await tx
          .delete(chunks)
          .where(eq(chunks.uploadId, req.params.uploadId));

        // Insert new chunks with updated token counts
        if (chunksWithTokens.length > 0) {
          const chunksToInsert = chunksWithTokens.map((chunk) =>
            toDbChunk(chunk, req.params.uploadId)
          );

          await tx.insert(chunks).values(chunksToInsert);
        }

        // Update upload's chunking strategy
        await tx
          .update(uploads)
          .set({
            chunkingStrategy: strategy,
            updatedAt: new Date(),
          })
          .where(eq(uploads.id, req.params.uploadId));
      });

      res.json({ success: true, count: chunksWithTokens.length });
    } catch (error: any) {
      console.error("Save chunks error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // PATCH /api/uploads/:uploadId/chunks/:chunkId
  // Update individual chunk (metadata, content, or position)
  app.patch("/api/uploads/:uploadId/chunks/:chunkId", async (req, res) => {
    try {
      const { metadata, position, content } = req.body;

      // Verify upload exists
      const [upload] = await db
        .select()
        .from(uploads)
        .where(eq(uploads.id, req.params.uploadId))
        .limit(1);

      if (!upload) {
        return res.status(404).json({ error: "Upload not found" });
      }

      // Build update object
      const updates: any = { updatedAt: new Date() };
      if (metadata !== undefined) updates.metadata = metadata;
      if (position !== undefined) updates.position = position;
      if (content !== undefined) {
        updates.content = content;
        updates.markdownContent = content;
      }

      // Update chunk
      await db
        .update(chunks)
        .set(updates)
        .where(eq(chunks.id, req.params.chunkId));

      res.json({ success: true });
    } catch (error: any) {
      console.error("Update chunk error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/uploads/:uploadId/chunks/:chunkId
  // Delete individual chunk
  app.delete("/api/uploads/:uploadId/chunks/:chunkId", async (req, res) => {
    try {
      // Verify upload exists
      const [upload] = await db
        .select()
        .from(uploads)
        .where(eq(uploads.id, req.params.uploadId))
        .limit(1);

      if (!upload) {
        return res.status(404).json({ error: "Upload not found" });
      }

      // Delete chunk and reorder remaining chunks
      await db.transaction(async (tx) => {
        // Get position of chunk to delete
        const [chunkToDelete] = await tx
          .select()
          .from(chunks)
          .where(eq(chunks.id, req.params.chunkId))
          .limit(1);

        if (!chunkToDelete) {
          throw new Error("Chunk not found");
        }

        // Delete the chunk
        await tx
          .delete(chunks)
          .where(eq(chunks.id, req.params.chunkId));

        // Get all remaining chunks in this upload
        const remainingChunks = await tx
          .select()
          .from(chunks)
          .where(eq(chunks.uploadId, req.params.uploadId))
          .orderBy(asc(chunks.position));

        // Decrement positions of chunks after the deleted one
        for (const chunk of remainingChunks) {
          if (chunk.position > chunkToDelete.position) {
            await tx
              .update(chunks)
              .set({ position: chunk.position - 1, updatedAt: new Date() })
              .where(eq(chunks.id, chunk.id));
          }
        }
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete chunk error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/uploads/:uploadId/chunks/reorder
  // Bulk update chunk positions (for drag-and-drop)
  app.post("/api/uploads/:uploadId/chunks/reorder", async (req, res) => {
    try {
      const { chunkIds } = req.body as { chunkIds: string[] };

      if (!chunkIds || !Array.isArray(chunkIds)) {
        return res.status(400).json({ error: "Invalid chunk IDs" });
      }

      // Verify upload exists
      const [upload] = await db
        .select()
        .from(uploads)
        .where(eq(uploads.id, req.params.uploadId))
        .limit(1);

      if (!upload) {
        return res.status(404).json({ error: "Upload not found" });
      }

      // Update positions in transaction
      await db.transaction(async (tx) => {
        for (let i = 0; i < chunkIds.length; i++) {
          await tx
            .update(chunks)
            .set({ position: i, updatedAt: new Date() })
            .where(eq(chunks.id, chunkIds[i]));
        }
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Reorder chunks error:", error);
      res.status(500).json({ error: error.message });
    }
  });
}
