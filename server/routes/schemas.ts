import type { Express } from "express";
import { db } from "../database";
import { metadataSchemas } from "../db-schema";
import { eq, desc } from "drizzle-orm";
import {
  createSchemaRequestSchema,
  updateSchemaRequestSchema,
} from "@shared/metadata-schema";

export function registerSchemaRoutes(app: Express) {
  /**
   * GET /api/schemas
   * List all schemas
   */
  app.get("/api/schemas", async (req, res) => {
    try {
      const schemas = await db
        .select()
        .from(metadataSchemas)
        .orderBy(desc(metadataSchemas.createdAt));

      res.json(schemas);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/schemas/:id
   * Get a single schema
   */
  app.get("/api/schemas/:id", async (req, res) => {
    try {
      const [schema] = await db
        .select()
        .from(metadataSchemas)
        .where(eq(metadataSchemas.id, req.params.id))
        .limit(1);

      if (!schema) {
        return res.status(404).json({ error: "Schema not found" });
      }

      res.json(schema);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/schemas
   * Create a new schema
   */
  app.post("/api/schemas", async (req, res) => {
    try {
      // Validate request body
      const validationResult = createSchemaRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: "Invalid request",
          details: validationResult.error.flatten(),
        });
      }

      const { name, description, documentFields, chunkFields, chunkEnrichmentPrompt } = validationResult.data;

      const [newSchema] = await db
        .insert(metadataSchemas)
        .values({
          name,
          description,
          documentFields: documentFields ?? [],
          chunkFields: chunkFields ?? [],
          chunkEnrichmentPrompt: chunkEnrichmentPrompt ?? null,
        })
        .returning();

      res.status(201).json(newSchema);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * PATCH /api/schemas/:id
   * Update a schema
   */
  app.patch("/api/schemas/:id", async (req, res) => {
    try {
      // Validate request body
      const validationResult = updateSchemaRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: "Invalid request",
          details: validationResult.error.flatten(),
        });
      }

      const updateData = validationResult.data;

      // Build update object
      const updates: Record<string, any> = {
        updatedAt: new Date(),
      };

      if (updateData.name !== undefined) updates.name = updateData.name;
      if (updateData.description !== undefined) updates.description = updateData.description;
      if (updateData.documentFields !== undefined) updates.documentFields = updateData.documentFields;
      if (updateData.chunkFields !== undefined) updates.chunkFields = updateData.chunkFields;
      if (updateData.chunkEnrichmentPrompt !== undefined) updates.chunkEnrichmentPrompt = updateData.chunkEnrichmentPrompt;

      const [updatedSchema] = await db
        .update(metadataSchemas)
        .set(updates)
        .where(eq(metadataSchemas.id, req.params.id))
        .returning();

      if (!updatedSchema) {
        return res.status(404).json({ error: "Schema not found" });
      }

      res.json(updatedSchema);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * DELETE /api/schemas/:id
   * Delete a schema
   */
  app.delete("/api/schemas/:id", async (req, res) => {
    try {
      const result = await db
        .delete(metadataSchemas)
        .where(eq(metadataSchemas.id, req.params.id))
        .returning();

      if (result.length === 0) {
        return res.status(404).json({ error: "Schema not found" });
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/schemas/:id/duplicate
   * Duplicate a schema
   */
  app.post("/api/schemas/:id/duplicate", async (req, res) => {
    try {
      // Get the source schema
      const [sourceSchema] = await db
        .select()
        .from(metadataSchemas)
        .where(eq(metadataSchemas.id, req.params.id))
        .limit(1);

      if (!sourceSchema) {
        return res.status(404).json({ error: "Schema not found" });
      }

      // Create a copy with a new name
      const newName = req.body.name || `${sourceSchema.name} (Copy)`;

      const [duplicatedSchema] = await db
        .insert(metadataSchemas)
        .values({
          name: newName,
          description: sourceSchema.description,
          documentFields: sourceSchema.documentFields,
          chunkFields: sourceSchema.chunkFields,
          chunkEnrichmentPrompt: sourceSchema.chunkEnrichmentPrompt,
        })
        .returning();

      res.status(201).json(duplicatedSchema);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}
