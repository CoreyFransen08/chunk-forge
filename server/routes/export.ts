import type { Express } from "express";
import { exportRequestSchema, JsonExportResponse, PineconeExportItem, ChromaExportResponse } from "@shared/schema";
import type { Chunk, Upload } from "@shared/schema";
import { db } from "../database";
import { uploads } from "../db-schema";
import { eq } from "drizzle-orm";
import { encoding_for_model } from "tiktoken";
import { getMarkdownContent } from "./uploads";
import { downloadFile } from "../services/storage";

// Helper function to apply character-based overlap between chunks
function applyOverlap(chunks: Chunk[], overlapChars: number): Chunk[] {
  if (overlapChars === 0 || chunks.length === 0) return chunks;

  return chunks.map((chunk, index) => {
    if (index === chunks.length - 1) return chunk; // Last chunk stays as-is

    const nextChunk = chunks[index + 1];
    const overlapText = nextChunk.text.slice(0, overlapChars);

    return {
      ...chunk,
      text: chunk.text + (overlapText ? '\n' + overlapText : ''),
    };
  });
}

// Helper function to apply token-based overlap between chunks
function applyTokenOverlap(chunks: Chunk[], overlapTokens: number): Chunk[] {
  if (overlapTokens === 0 || chunks.length === 0) return chunks;

  const encoding = encoding_for_model("gpt-4");

  try {
    return chunks.map((chunk, index) => {
      if (index === chunks.length - 1) return chunk; // Last chunk stays as-is

      const nextChunk = chunks[index + 1];
      const nextTokens = encoding.encode(nextChunk.text);
      const overlapTokensSlice = nextTokens.slice(0, overlapTokens);
      const overlapText = new TextDecoder().decode(encoding.decode(overlapTokensSlice));

      return {
        ...chunk,
        text: chunk.text + (overlapText ? '\n' + overlapText : ''),
      };
    });
  } finally {
    encoding.free();
  }
}

// Helper function to apply ID prefix to chunks
function applyIdPrefix(chunks: Chunk[], prefix: string): Chunk[] {
  if (!prefix) return chunks;

  return chunks.map((chunk, index) => ({
    ...chunk,
    id: `${prefix}chunk-${index}`,
  }));
}

export function registerExportRoutes(app: Express) {
  // Export chunks
  app.post("/api/export", async (req, res) => {
    try {
      const parsed = exportRequestSchema.parse(req.body);
      const { uploadId, documentId, chunks, format, includeMetadata, overlap, overlapUnit, idPrefix } = parsed;

      // Support both uploadId (new) and documentId (legacy)
      const resolvedUploadId = uploadId || documentId;

      // Fetch upload if uploadId is provided (for JSON nested structure)
      let upload: Upload | null = null;
      if (resolvedUploadId) {
        const [doc] = await db
          .select()
          .from(uploads)
          .where(eq(uploads.id, resolvedUploadId))
          .limit(1);
        upload = doc as Upload || null;
      }

      // Apply overlap based on unit type
      let processedChunks = chunks;
      if (overlap > 0) {
        processedChunks = overlapUnit === "tokens"
          ? applyTokenOverlap(chunks, overlap)
          : applyOverlap(chunks, overlap);
      }

      // Apply ID prefix if specified
      if (idPrefix) {
        processedChunks = applyIdPrefix(processedChunks, idPrefix);
      }

      let output: string;
      let contentType: string;
      let filename: string;

      if (format === "json") {
        // Use nested structure with upload metadata
        const exportData: JsonExportResponse = {
          document: upload ? {
            id: upload.id,
            title: upload.title,
            metadata: upload.metadata,
          } : null,
          chunks: processedChunks.map((c) => ({
            id: c.id,
            text: c.text,
            order: c.order,
            ...(includeMetadata ? { metadata: c.metadata } : {}),
          })),
          exportedAt: new Date().toISOString(),
        };
        output = JSON.stringify(exportData, null, 2);
        contentType = "application/json";
        filename = upload ? `${upload.title.replace(/[^a-z0-9]/gi, '_')}_export.json` : "chunks.json";
      } else if (format === "jsonl") {
        output = processedChunks
          .map((c) =>
            JSON.stringify(includeMetadata ? c : { id: c.id, text: c.text })
          )
          .join("\n");
        contentType = "application/jsonl";
        filename = "chunks.jsonl";
      } else if (format === "csv") {
        const headers = includeMetadata
          ? "id,text,title,author,page,tags,keywords,summary"
          : "id,text";
        const rows = processedChunks.map((c) => {
          if (includeMetadata) {
            return `"${c.id}","${c.text.replace(/"/g, '""')}","${c.metadata.title || ""}","${
              c.metadata.author || ""
            }","${c.metadata.page || ""}","${(c.metadata.tags || []).join(";")}","${(
              c.metadata.keywords || []
            ).join(";")}","${c.metadata.summary || ""}"`;
          }
          return `"${c.id}","${c.text.replace(/"/g, '""')}"`;
        });
        output = [headers, ...rows].join("\n");
        contentType = "text/csv";
        filename = "chunks.csv";
      } else if (format === "pinecone") {
        // Pinecone format: flat array of {id, text, metadata}
        const pineconeData: PineconeExportItem[] = processedChunks.map((c) => ({
          id: c.id,
          text: c.text,
          metadata: includeMetadata ? {
            ...c.metadata,
            order: c.order,
          } : { order: c.order },
        }));
        output = JSON.stringify(pineconeData, null, 2);
        contentType = "application/json";
        filename = upload ? `${upload.title.replace(/[^a-z0-9]/gi, '_')}_pinecone.json` : "chunks_pinecone.json";
      } else if (format === "chroma") {
        // Chroma format: batched {ids: [], documents: [], metadatas: []}
        const chromaData: ChromaExportResponse = {
          ids: processedChunks.map(c => c.id),
          documents: processedChunks.map(c => c.text),
          metadatas: processedChunks.map(c => includeMetadata ? {
            ...c.metadata,
            order: c.order,
          } : { order: c.order }),
        };
        output = JSON.stringify(chromaData, null, 2);
        contentType = "application/json";
        filename = upload ? `${upload.title.replace(/[^a-z0-9]/gi, '_')}_chroma.json` : "chunks_chroma.json";
      } else {
        // Markdown format
        output = processedChunks.map((c) => {
          let md = `# Chunk ${c.id}\n\n${c.text}\n`;
          if (includeMetadata && Object.keys(c.metadata).length > 0) {
            md += `\n---\n\n**Metadata:**\n`;
            if (c.metadata.title) md += `- Title: ${c.metadata.title}\n`;
            if (c.metadata.author) md += `- Author: ${c.metadata.author}\n`;
            if (c.metadata.page) md += `- Page: ${c.metadata.page}\n`;
            if (c.metadata.tags?.length) md += `- Tags: ${c.metadata.tags.join(", ")}\n`;
          }
          return md;
        }).join("\n\n---\n\n");
        contentType = "text/markdown";
        filename = "chunks.md";
      }

      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(output);
    } catch (error: any) {
      console.error("Export error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Download parsed markdown
  app.get("/api/export/markdown/:uploadId", async (req, res) => {
    try {
      const [upload] = await db
        .select()
        .from(uploads)
        .where(eq(uploads.id, req.params.uploadId))
        .limit(1);

      if (!upload) {
        return res.status(404).json({ error: "Upload not found" });
      }

      const markdown = await getMarkdownContent(upload);
      const filename = `${upload.title.replace(/[^a-z0-9]/gi, '_')}.md`;

      res.setHeader("Content-Type", "text/markdown");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(markdown);
    } catch (error: any) {
      console.error("Markdown export error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Download original file
  app.get("/api/export/original/:uploadId", async (req, res) => {
    try {
      const [upload] = await db
        .select()
        .from(uploads)
        .where(eq(uploads.id, req.params.uploadId))
        .limit(1);

      if (!upload) {
        return res.status(404).json({ error: "Upload not found" });
      }

      // Download from local storage
      try {
        const buffer = await downloadFile('uploads', upload.filePath);
        res.setHeader("Content-Type", "application/octet-stream");
        res.setHeader("Content-Disposition", `attachment; filename="${upload.originalFilename}"`);
        res.send(buffer);
      } catch (error) {
        console.error("Storage download error:", error);
        return res.status(500).json({ error: "Failed to download file" });
      }
    } catch (error: any) {
      console.error("Original file export error:", error);
      res.status(500).json({ error: error.message });
    }
  });
}
