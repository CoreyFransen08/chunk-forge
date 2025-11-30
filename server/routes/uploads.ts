import type { Express } from "express";
import { db } from "../database";
import { uploads, metadataSchemas } from "../db-schema";
import { eq, desc } from "drizzle-orm";
import { applySchemaRequestSchema } from "@shared/metadata-schema";
import { downloadText, deleteFile } from "../services/storage";

/**
 * Helper function to get markdown content from storage or database
 * Supports both new storage-based approach and legacy database column
 */
async function getMarkdownContent(upload: { markdown?: string | null; markdownPath?: string | null }): Promise<string> {
  if (upload.markdownPath) {
    try {
      return await downloadText('markdown', upload.markdownPath);
    } catch (error) {
      console.error('Error fetching markdown from storage:', error);
      // Fall back to database column if storage fetch fails
      return upload.markdown || '';
    }
  }
  // Fallback for legacy records stored in database
  return upload.markdown || '';
}

export function registerUploadRoutes(app: Express) {
  // Get all uploads
  app.get("/api/uploads", async (req, res) => {
    try {
      const allUploads = await db
        .select()
        .from(uploads)
        .orderBy(desc(uploads.createdAt));

      res.json(allUploads);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get single upload
  app.get("/api/uploads/:id", async (req, res) => {
    try {
      const [upload] = await db
        .select()
        .from(uploads)
        .where(eq(uploads.id, req.params.id))
        .limit(1);

      if (!upload) {
        return res.status(404).json({ error: "Upload not found" });
      }

      // Fetch markdown content from storage if needed
      const markdown = await getMarkdownContent(upload);

      res.json({ ...upload, markdown });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update upload metadata
  app.patch("/api/uploads/:id", async (req, res) => {
    try {
      const { metadata, title, schemaId, customMetadata } = req.body;

      // Build update object
      const updateData: Record<string, any> = {
        updatedAt: new Date(),
      };

      if (metadata !== undefined) {
        updateData.metadata = metadata;
      }

      if (title !== undefined) {
        updateData.title = title;
      }

      if (schemaId !== undefined) {
        updateData.schemaId = schemaId;
      }

      if (customMetadata !== undefined) {
        updateData.customMetadata = customMetadata;
      }

      const [updatedUpload] = await db
        .update(uploads)
        .set(updateData)
        .where(eq(uploads.id, req.params.id))
        .returning();

      if (!updatedUpload) {
        return res.status(404).json({ error: "Upload not found" });
      }

      res.json(updatedUpload);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Apply or remove schema from upload
  app.patch("/api/uploads/:id/schema", async (req, res) => {
    try {
      // Validate request body
      const validationResult = applySchemaRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: "Invalid request",
          details: validationResult.error.flatten(),
        });
      }

      const { schemaId } = validationResult.data;

      // If applying a schema, verify it exists
      if (schemaId) {
        const [schema] = await db
          .select()
          .from(metadataSchemas)
          .where(eq(metadataSchemas.id, schemaId))
          .limit(1);

        if (!schema) {
          return res.status(404).json({ error: "Schema not found" });
        }
      }

      const [updatedUpload] = await db
        .update(uploads)
        .set({
          schemaId,
          updatedAt: new Date(),
        })
        .where(eq(uploads.id, req.params.id))
        .returning();

      if (!updatedUpload) {
        return res.status(404).json({ error: "Upload not found" });
      }

      res.json(updatedUpload);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Delete upload
  app.delete("/api/uploads/:id", async (req, res) => {
    try {
      // Get the upload first to delete associated storage files
      const [upload] = await db
        .select()
        .from(uploads)
        .where(eq(uploads.id, req.params.id))
        .limit(1);

      if (upload) {
        // Delete markdown file from local storage if it exists
        if (upload.markdownPath) {
          await deleteFile('markdown', upload.markdownPath);
        }

        // Delete original file from local storage
        if (upload.filePath) {
          await deleteFile('uploads', upload.filePath);
        }
      }

      await db
        .delete(uploads)
        .where(eq(uploads.id, req.params.id));

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}

// Export the helper function for use in other routes
export { getMarkdownContent };
