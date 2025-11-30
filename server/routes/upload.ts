import type { Express } from "express";
import multer from "multer";
import path from "path";
import { eq } from "drizzle-orm";
import { db } from "../database";
import { uploads, metadataSchemas } from "../db-schema";
import { getDefaultValueForType } from "@shared/metadata-schema";
import type { DocumentMetadata, ParserMethod } from "@shared/schema";
import { extractDocumentInfo } from "../agents";
import { uploadFile, uploadText, generateFilename } from "../services/storage";

const upload = multer({ storage: multer.memoryStorage() });

// Supported MIME types per parser method
const SUPPORTED_MIME_TYPES: Record<ParserMethod, string[]> = {
  llamaparse: ['application/pdf'],
  markitdown: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'text/csv',
  ],
  docling: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'text/html',
    'image/png',
    'image/jpeg',
  ],
};

export function registerUploadRoutes(app: Express) {
  // Upload file and convert to markdown
  app.post("/api/upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Get parser method from request body (default to llamaparse)
      const parserMethod: ParserMethod = (req.body.parserMethod as ParserMethod) || 'llamaparse';

      // Validate parser method
      if (!['llamaparse', 'markitdown', 'docling'].includes(parserMethod)) {
        return res.status(400).json({ error: "Invalid parser method. Use 'llamaparse', 'markitdown', or 'docling'." });
      }

      // Validate file type for the selected parser
      const supportedTypes = SUPPORTED_MIME_TYPES[parserMethod];
      if (!supportedTypes.includes(req.file.mimetype)) {
        const formatMap: Record<ParserMethod, string> = {
          llamaparse: 'PDF',
          markitdown: 'PDF, Word, Excel, CSV',
          docling: 'PDF, Word, PowerPoint, Excel, HTML, Images',
        };
        return res.status(400).json({
          error: `File type not supported for ${parserMethod}. Supported formats: ${formatMap[parserMethod]}`
        });
      }

      const fileName = generateFilename(req.file.originalname);

      console.log("Attempting upload:", {
        fileName,
        fileSize: req.file.size,
        parserMethod,
        mimeType: req.file.mimetype
      });

      // Upload file to local storage
      try {
        await uploadFile('uploads', fileName, req.file.buffer);
      } catch (storageError: any) {
        console.error("Storage error:", storageError);
        return res.status(500).json({
          error: "Failed to upload file",
          details: storageError.message
        });
      }

      console.log("Upload successful:", fileName);

      // Send file to Python parser service using the new /parse endpoint
      const parserUrl = process.env.PARSER_SERVICE_URL || "http://localhost:8000";
      const formData = new FormData();
      formData.append("file", new Blob([new Uint8Array(req.file.buffer)]), req.file.originalname);
      formData.append("parser_method", parserMethod);

      const parserResponse = await fetch(`${parserUrl}/parse`, {
        method: "POST",
        body: formData,
      });

      if (!parserResponse.ok) {
        const errorText = await parserResponse.text();
        throw new Error(`Parser service failed: ${errorText}`);
      }

      const parserData = await parserResponse.json();
      const { markdown, pageCount } = parserData;

      console.log("Parser response:", { parserMethod, pageCount, markdownLength: markdown?.length });

      // Extract document info using AI agent (non-blocking on failure)
      let aiExtractedInfo: { title: string | null; author: string | null; description: string | null } = {
        title: null,
        author: null,
        description: null,
      };
      try {
        const extracted = await extractDocumentInfo(markdown);
        aiExtractedInfo = {
          title: extracted.title,
          author: extracted.author,
          description: extracted.description,
        };
        console.log("AI document info extraction:", {
          title: aiExtractedInfo.title,
          author: aiExtractedInfo.author,
        });
      } catch (error) {
        console.error("Document info extraction failed (non-blocking):", error);
        // Continue with upload - AI extraction is optional
      }

      // Get schemaId from form data - REQUIRED
      const schemaId = req.body.schemaId;
      if (!schemaId) {
        return res.status(400).json({ error: "Schema ID is required" });
      }

      // Fetch schema definition
      const [schema] = await db
        .select()
        .from(metadataSchemas)
        .where(eq(metadataSchemas.id, schemaId));

      if (!schema) {
        return res.status(400).json({ error: "Invalid schema ID" });
      }

      console.log("Using schema:", schema.name, "with", schema.documentFields?.length || 0, "document fields");

      // Build metadata object based on schema's documentFields
      // Standard fields that go at root level of DocumentMetadata
      const standardFields = ['pageCount', 'fileSize', 'uploadedAt', 'originalFilename', 'title', 'author', 'description'];

      // Auto-generated document field values
      const autoGenValues: Record<string, any> = {
        pageCount: pageCount || 0,
        fileSize: req.file.size,
        uploadedAt: new Date().toISOString(),
        originalFilename: req.file.originalname,
      };

      // Initialize metadata with custom object and AI-extracted values
      const documentMetadata: DocumentMetadata = {
        custom: {},
        // Pre-populate with AI-extracted values (will be overwritten if schema has explicit defaults)
        title: aiExtractedInfo.title || undefined,
        author: aiExtractedInfo.author || undefined,
        description: aiExtractedInfo.description || undefined,
      };

      // Populate fields defined in schema
      for (const field of (schema.documentFields || [])) {
        let value: any;

        if (field.autoGenerated && autoGenValues[field.name] !== undefined) {
          // Use system-generated value for auto-generated fields
          value = autoGenValues[field.name];
        } else if (!field.autoGenerated) {
          // For title/author/description, use AI-extracted value if no explicit default
          if (['title', 'author', 'description'].includes(field.name) && !field.defaultValue) {
            value = (aiExtractedInfo as any)[field.name] ?? getDefaultValueForType(field.type);
          } else {
            // Use schema default value or type default for user-editable fields
            value = field.defaultValue ?? getDefaultValueForType(field.type);
          }
        } else {
          continue; // Skip auto-generated fields without values
        }

        // Put standard fields at root level, others in custom
        if (standardFields.includes(field.name)) {
          (documentMetadata as any)[field.name] = value;
        } else {
          documentMetadata.custom[field.name] = value;
        }
      }

      console.log("Document metadata to save:", documentMetadata);

      // Store markdown to local storage
      const fileBaseName = path.basename(req.file.originalname, path.extname(req.file.originalname));
      const markdownFileName = `${Date.now()}-${fileBaseName}.md`;
      let markdownStorageError = false;
      try {
        await uploadText('markdown', markdownFileName, markdown);
      } catch (error) {
        console.error("Markdown storage error:", error);
        markdownStorageError = true;
        // Fall back to storing in database if storage fails
      }

      // Save upload to database with populated metadata
      const [newUpload] = await db
        .insert(uploads)
        .values({
          title: fileBaseName,
          originalFilename: req.file.originalname,
          filePath: fileName, // Store just the filename/path
          fileSize: req.file.size,
          chunkingStrategy: 'none', // Will be set when chunking is applied
          markdownPath: markdownStorageError ? null : markdownFileName, // Path to markdown in storage
          markdown: markdownStorageError ? markdown : null, // Fallback to database storage
          metadata: documentMetadata,
          schemaId: schemaId,
          customMetadata: {},
        })
        .returning();

      console.log("Saved upload metadata:", newUpload.metadata);

      res.json({ upload: newUpload, markdown });
    } catch (error: any) {
      console.error("Upload error:", error);
      res.status(500).json({ error: error.message });
    }
  });
}
