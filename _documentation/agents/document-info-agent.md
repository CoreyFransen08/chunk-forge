# Document Info Agent

This document describes the AI-powered document metadata extraction system in ChunkForge, which uses Mastra agents to automatically extract title, author, and description from uploaded documents.

## Overview

The Document Info Agent analyzes the beginning of documents (first 3 pages) and extracts:
- **Title**: From headings or inferred from content
- **Author**: From bylines or attribution (null if not found)
- **Description**: A 1-2 sentence summary of the document's topic

**Key Features:**
- Automatic extraction during file upload
- Manual re-extraction API for existing uploads
- Non-blocking on failure (upload continues if extraction fails)

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Upload Process                               │
├─────────────────────────────────────────────────────────────────────┤
│  POST /api/upload                                                    │
│  ├── Upload file to storage                                         │
│  ├── Parse file to markdown (Python parser)                         │
│  ├── extractDocumentInfo(markdown) ─────────────────┐               │
│  │   └── Non-blocking: continues on failure         │               │
│  ├── Build metadata with AI-extracted values        │               │
│  └── Save upload to database                        │               │
└─────────────────────────────────────────────────────┼───────────────┘
                                                      │
                                                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Document Info Agent                               │
├─────────────────────────────────────────────────────────────────────┤
│  server/agents/document-info-agent.ts                               │
│  ├── documentInfoSchema → Zod schema for structured output          │
│  ├── documentInfoAgent → Mastra Agent instance                      │
│  ├── extractFirstPages() → Extract first N pages from markdown      │
│  └── extractDocumentInfo() → Main extraction function               │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Mastra / OpenAI                              │
├─────────────────────────────────────────────────────────────────────┤
│  Agent.generate() with structuredOutput                             │
│  └── Model: gpt-4o-mini                                             │
│  └── Returns: { title, author, description }                        │
└─────────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Document Info Schema

**File:** `server/agents/document-info-agent.ts`

```typescript
export const documentInfoSchema = z.object({
  title: z.string().describe("The document title"),
  author: z.string().nullable().describe("The document author if mentioned"),
  description: z.string().describe("A brief 1-2 sentence summary"),
});

export type DocumentInfo = z.infer<typeof documentInfoSchema>;
```

### 2. Document Info Agent

```typescript
export const documentInfoAgent = new Agent({
  name: "document-info-agent",
  instructions: `You are a document metadata extraction specialist...`,
  model: "openai/gpt-4o-mini",
});
```

**Agent Instructions:**
- Look for main heading (H1 or prominent title) for title
- Look for author attribution, bylines, or "written by" statements
- Write concise 1-2 sentence summary for description
- Only extract information clearly present or inferable
- Return null for author if not explicitly mentioned

### 3. Extraction Function

```typescript
export async function extractDocumentInfo(
  markdown: string
): Promise<DocumentInfo>
```

**Process:**
1. Extract first 3 pages using page separator (`\n---\n`)
2. Call agent with structured output
3. Return extracted `DocumentInfo`

## Integration Points

### 1. Automatic Extraction During Upload

**File:** `server/routes/upload.ts`

The agent is called automatically when a file is uploaded:

```typescript
// Extract document info using AI agent (non-blocking on failure)
let aiExtractedInfo = { title: null, author: null, description: null };
try {
  const extracted = await extractDocumentInfo(markdown);
  aiExtractedInfo = {
    title: extracted.title,
    author: extracted.author,
    description: extracted.description,
  };
} catch (error) {
  console.error("Document info extraction failed (non-blocking):", error);
  // Continue with upload - AI extraction is optional
}
```

**Key behaviors:**
- Non-blocking: Upload succeeds even if extraction fails
- Values populate `upload.metadata.title`, `.author`, `.description`
- Schema defaults can override AI-extracted values if specified

### 2. Manual Re-Extraction API

**File:** `server/routes/agents.ts`

Users can manually trigger extraction for existing uploads:

```
POST /api/agents/upload-info/:uploadId
Content-Type: application/json
```

**Response:**
```json
{
  "extracted": {
    "title": "Document Title",
    "author": "John Doe",
    "description": "This document covers..."
  },
  "upload": { /* Updated upload object */ }
}
```

## Data Flow

### Upload Flow with AI Extraction

```
1. User uploads file via POST /api/upload
2. File saved to local storage
3. File sent to Python parser service
4. Parser returns markdown + pageCount
5. extractDocumentInfo(markdown) called:
   a. Extract first 3 pages
   b. Call OpenAI via Mastra agent
   c. Return { title, author, description }
6. Build DocumentMetadata:
   - AI-extracted values used for title/author/description
   - Schema defaults can override if specified
   - Auto-generated fields (pageCount, fileSize, etc.) added
7. Save upload to database with populated metadata
```

### Storage Location

AI-extracted values are stored at the root level of `upload.metadata`:

```typescript
upload.metadata = {
  title: "AI Extracted Title",        // From agent
  author: "Extracted Author",          // From agent (nullable)
  description: "Brief summary...",     // From agent
  pageCount: 10,                       // Auto-generated
  fileSize: 102400,                    // Auto-generated
  uploadedAt: "2024-01-15T...",       // Auto-generated
  originalFilename: "document.pdf",   // Auto-generated
  custom: {}                           // User-defined fields
}
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | Yes | - | OpenAI API key for gpt-4o-mini |

## Error Handling

| Error | HTTP Status | Cause |
|-------|-------------|-------|
| "Upload not found" | 404 | Invalid uploadId |
| "Upload has no markdown content" | 400 | Upload failed to parse or has no content |
| "AI service not configured" | 503 | Missing `OPENAI_API_KEY` |

**Non-Blocking Behavior:**

During upload, extraction failures are logged but do not fail the upload:
```typescript
} catch (error) {
  console.error("Document info extraction failed (non-blocking):", error);
  // Upload continues with null values for AI fields
}
```

## Performance Considerations

- **Model:** Uses `gpt-4o-mini` for cost-effective processing
- **Content Scope:** Only analyzes first 3 pages (reduces tokens)
- **Non-Blocking:** Upload latency not significantly impacted by extraction failures

## Related Files

| File | Purpose |
|------|---------|
| `server/agents/document-info-agent.ts` | Core agent logic and extraction |
| `server/agents/index.ts` | Barrel exports |
| `server/routes/upload.ts` | Automatic extraction during upload |
| `server/routes/agents.ts` | Manual extraction API endpoints |

## Comparison: Document Info vs Chunk Enrichment

| Aspect | Document Info Agent | Chunk Enrichment Agent |
|--------|---------------------|------------------------|
| **Trigger** | Automatic on upload | Manual button click |
| **Scope** | First 3 pages | Individual chunks |
| **Schema** | Fixed (title, author, description) | Dynamic from FieldDefinition[] |
| **Failure Mode** | Non-blocking | Blocking (returns error) |
| **Storage** | Root level of metadata | metadata.custom |
