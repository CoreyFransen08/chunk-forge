# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ChunkForge Open Source is a self-hosted document processing platform for converting PDFs to Markdown with semantic chunking, drag-and-drop editing, rich metadata management, and multi-format export. This is the open source version - no authentication, no credits, no external dependencies required.

## Development Commands

```bash
# Start all services in development mode (frontend + backend + parser)
npm run dev

# Type checking
npm run check

# Build for production (frontend + backend)
npm run build

# Start production server
npm start

# Database migrations
npm run db:push

# Docker commands
docker-compose up -d        # Start all services
docker-compose down         # Stop all services
docker-compose logs -f      # View logs
```

## Architecture

### Three-Service Architecture

1. **Frontend** (React + Vite): Client-side application in `client/`
2. **Backend** (Express + TypeScript): API server in `server/`
3. **Parser Service** (Python + FastAPI): PDF processing service in `parser/`

### Key Technology Stack

- **Frontend**: React, TypeScript, Tailwind CSS, TanStack Query, dnd-kit (drag-and-drop), react-router-dom
- **Backend**: Express, Drizzle ORM (type-safe SQL), Multer (file uploads)
- **Parser**: FastAPI, LlamaIndex (PDF parsing via LlamaParse), MarkItDown, Docling
- **Database**: PostgreSQL (local or containerized)
- **Storage**: Local filesystem (`/storage/uploads/` and `/storage/markdown/`)

### Storage System

All files are stored locally in the `storage/` directory:
- `storage/uploads/` - Original uploaded files (PDFs, etc.)
- `storage/markdown/` - Parsed markdown content

Storage service located at `server/services/storage.ts`.

### Chunking Architecture (Mastra-based)

**Libraries Used:**
- **@mastra/rag**: Mastra's RAG package for all chunking strategies
- **LlamaParse**: PDF → Markdown conversion (in Python parser service)

**Code Structure:**
- `server/services/mastra-chunker.ts`: All chunking logic
  - Uses Mastra's `MDocument.chunk()` for strategy execution
  - Line-boundary snapping for overlay system compatibility
  - Metadata enrichment (token counts, heading hierarchy)
  - No overlap at chunking time (overlap added at export)
- `parser/main.py`: PDF parsing and token calculation only
  - `/parse-pdf`: LlamaParse PDF conversion
  - `/parse`: Multi-parser support (LlamaParse, MarkItDown, Docling)
  - `/calculate-tokens`: Token counting for chunk editing

**API Flow:**
1. Client sends chunking request to `/api/chunk` (Express)
2. Express calls `chunkWithMastra()` directly
3. Mastra service:
   - Creates MDocument from markdown
   - Executes chunking strategy
   - Calculates character offsets
   - Snaps offsets to line boundaries
   - Enriches metadata
   - Returns chunks
4. Express returns `Chunk[]` to client

## Important Implementation Patterns

### Path Aliases

Configured in `vite.config.ts`:
- `@/` → `client/src/`
- `@shared/` → `shared/`
- `@assets/` → `attached_assets/`

### Database Access

- **ORM**: Drizzle ORM with PostgreSQL driver
- **Schema**: Defined in `server/db-schema.ts` using Drizzle's schema builder
- **Database instance**: Import `db` from `server/db-connection.ts`
- **Type inference**: Use `typeof table.$inferSelect` and `typeof table.$inferInsert` for TypeScript types

#### Database Schema

**Tables:**
- `uploads` - Document records (title, filename, markdown, schema reference)
- `chunks` - Chunked segments with content and metadata
- `metadata_schemas` - Custom metadata field definitions

#### Naming Convention (IMPORTANT)

**Drizzle uses camelCase in TypeScript that maps to snake_case in the database:**

```typescript
// In db-schema.ts
export const uploads = pgTable('uploads', {
  id: uuid('id').primaryKey(),
  createdAt: timestamp('created_at'),       // TypeScript: createdAt, DB: created_at
  originalFilename: text('original_filename'), // TypeScript: originalFilename, DB: original_filename
});
```

**Always use camelCase in TypeScript code:**
- ✅ `upload.createdAt`, `upload.originalFilename`
- ❌ `upload.created_at`, `upload.original_filename`

### Chunking Strategies

**All chunking handled in Node.js via Mastra** (`server/services/mastra-chunker.ts`):

**Core Strategies:**
1. **recursive**: Smart fixed-size with separator hierarchy
   - Configuration: `chunk_size`, `separators`

2. **paragraph**: Paragraph-based splitting (maps to recursive with `\n\n` separator)
   - Configuration: `max_section_size`

3. **by_heading**: Markdown heading-based splitting
   - Configuration: `heading_levels`
   - Metadata: `heading_1`-`heading_6`, `section_path`, `heading_level`

4. **semantic**: Header-family based grouping (Mastra's semantic-markdown)
   - Groups content by related header families (no embeddings, no API costs)
   - Configuration: `chunk_size` (join threshold)

5. **sentence**: Sentence-based chunking
   - Configuration: `sentences_per_chunk`

6. **token**: Token-aware chunking
   - Configuration: `chunk_size` (in tokens)

7. **hierarchical**: Parent-child chunk relationships (custom two-pass)
   - Configuration: `chunk_sizes` (array of sizes for each level)
   - Metadata: `parent_chunk_id`, `child_chunk_ids`, `depth_level`

**Key Constraints:**
- **No overlap**: All strategies use `overlap: 0` (overlap added at export time)
- **Line boundaries**: All chunks snapped to line boundaries for overlay system

### File Upload Flow

1. Client uploads PDF via multipart/form-data
2. Backend (`/api/upload`):
   - Saves file to local storage (`storage/uploads/`)
   - Forwards PDF to Python parser service at `/parse-pdf`
   - Saves markdown to local storage (`storage/markdown/`)
   - Saves document record to database
   - Returns markdown and document metadata

### Export Formats

Handled in `/api/export` route:
- **json**: Full metadata as formatted JSON
- **jsonl**: Newline-delimited JSON for streaming
- **csv**: Spreadsheet with metadata columns
- **markdown**: Formatted markdown with metadata sections

## Python Parser Service

Located in `parser/`:
- Runs independently on port 8000
- Endpoints:
  - `POST /parse-pdf`: Convert PDF to Markdown using LlamaParse (requires API key)
  - `POST /parse`: Multi-parser support (LlamaParse, MarkItDown, Docling)
  - `POST /calculate-tokens`: Token counting
- Start with: `cd parser && python main.py`

### PDF Parsing with LlamaParse

**Module**: `parser/llama_parser.py` - Modular parsing service using LlamaParse

**Configuration Options:**
- `language`: Document language (default: "en")
- `disable_ocr`: Skip OCR processing (default: false)
- `skip_diagonal_text`: Ignore angled text (default: false)
- `target_pages`: Page range to parse, e.g., "0-5,10" (default: all pages)
- `page_separator`: Delimiter between pages (default: "\n---\n")
- `output_tables_as_HTML`: Render tables as HTML (default: false)
- `hide_headers`: Remove headers from output (default: false)
- `hide_footers`: Remove footers from output (default: false)

**Requirements**:
- `LLAMA_CLOUD_API_KEY` environment variable must be set for LlamaParse
- Alternatively, use MarkItDown (free, no API key) or Docling parsers

**Caching**:
- **Location**: `./cache/parses/` (configurable via `PARSE_CACHE_DIR`)
- **TTL**: 7 days (configurable via `PARSE_CACHE_TTL`)
- **Benefits**: Reduces API costs, improves performance on re-uploads

## Environment Variables

Required:
- `DATABASE_URL`: PostgreSQL connection string

Optional:
- `PARSER_SERVICE_URL`: Python parser URL (defaults to `http://localhost:8000`)
- `LLAMA_CLOUD_API_KEY`: For LlamaParse PDF processing
- `OPENAI_API_KEY`: For AI-powered chunk metadata enrichment
- `EMBEDDING_CACHE_DIR`: Directory for embedding cache (defaults to `./cache/embeddings`)
- `EMBEDDING_CACHE_TTL`: TTL for embedding cache in seconds (defaults to 604800 = 7 days)
- `CHUNK_CACHE_DIR`: Directory for chunk result cache (defaults to `./cache/chunks`)
- `CHUNK_CACHE_TTL`: TTL for chunk cache in seconds (defaults to 86400 = 1 day)
- `PARSE_CACHE_DIR`: Directory for parse result cache (defaults to `./cache/parses`)
- `PARSE_CACHE_TTL`: TTL for parse cache in seconds (defaults to 604800 = 7 days)
- `PORT`: Server port (defaults to 5000)

## Common Patterns

### API Route Pattern

All API routes are simple and direct (no authentication):

```typescript
app.get("/api/uploads", async (req, res) => {
  const uploads = await db
    .select()
    .from(uploads)
    .orderBy(desc(uploads.createdAt));

  res.json(uploads);
});
```

### Shared Types

Types in `shared/` are shared between client and server:
- `schema.ts`: Upload, Chunk, ChunkMetadata, ChunkingConfig, request/response schemas
- `metadata-schema.ts`: Custom metadata schema types for documents and chunks

#### ChunkMetadata Schema

Chunks include rich metadata depending on the strategy used:

**Common fields:**
- `token_count`: Accurate token count via tiktoken
- `tags`, `keywords`, `summary`: User-editable metadata
- `title`, `author`, `page`: Document-level metadata

**Heading-based chunking (`by_heading`) adds:**
- `heading_1` through `heading_6`: Heading text at each level
- `section_path`: Full hierarchical path (e.g., "Chapter 1 > Section 1.1 > Subsection")
- `heading_level`: The heading level (1-6) that starts this chunk

**Hierarchical chunking adds:**
- `parent_chunk_id`: ID of parent chunk
- `child_chunk_ids`: Array of child chunk IDs
- `depth_level`: Depth in hierarchy (0 = top level)

## Docker Deployment

The application is fully containerized:

```bash
# Start all services
docker-compose up -d

# Services:
# - postgres (port 5432) - PostgreSQL database
# - parser (port 8000) - Python PDF parser
# - app (port 5000) - Main application (frontend + backend)

# View logs
docker-compose logs -f app

# Stop services
docker-compose down
```

Environment variables can be set in `.env` file or passed to docker-compose.
