# ChunkForge Open Source

A self-hosted document processing platform for converting PDFs to Markdown with semantic chunking, drag-and-drop editing, rich metadata management, and multi-format export.

## Features

- **PDF to Markdown Conversion**: Upload PDFs and convert them to Markdown using LlamaParse, MarkItDown, or Docling
- **Semantic Chunking**: Multiple strategies (recursive, paragraph, heading, semantic, sentence, token, hierarchical)
- **Drag-and-Drop Editor**: Visual chunk manipulation with reordering, merging, and splitting
- **Rich Metadata**: Add title, author, tags, keywords, summaries, and custom fields to each chunk
- **Custom Schemas**: Define your own metadata schemas for documents and chunks
- **AI Enrichment**: Optionally use AI (OpenAI) to automatically populate metadata fields
- **Multi-Format Export**: Export as JSON, JSONL, CSV, or Markdown with configurable overlap

## Quick Start with Docker

The easiest way to run ChunkForge is with Docker:

```bash
# Clone the repository
git clone https://github.com/your-repo/chunk-forge.git
cd chunk-forge

# Copy environment file and configure
cp .env.example .env

# Edit .env with your API keys

# Start all services
docker-compose up -d

# Access the application
open http://localhost:5001
```

## Architecture

- **Frontend**: React + Vite + TypeScript + Tailwind CSS + dnd-kit
- **Backend**: Node.js + Express + TypeScript + Drizzle ORM
- **Parser Service**: Python + FastAPI + LlamaParse/MarkItDown/Docling
- **Database**: PostgreSQL
- **Storage**: Local filesystem

## Manual Setup

### Prerequisites

- Node.js 20+
- Python 3.11+
- PostgreSQL 15+

### 1. Install Dependencies

```bash
# Install Node.js dependencies
npm install

# Install Python dependencies
cd parser
pip install -r requirements.txt
cd ..
```

### 2. Database Setup

```bash
# Create PostgreSQL database
createdb chunkforge

# Run the init script
psql chunkforge < scripts/init-db.sql
```

Or use Docker for PostgreSQL:

```bash
docker run -d \
  --name chunkforge-db \
  -e POSTGRES_USER=chunkforge \
  -e POSTGRES_PASSWORD=chunkforge \
  -e POSTGRES_DB=chunkforge \
  -p 5432:5432 \
  postgres:16-alpine
```

### 3. Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```bash
DATABASE_URL=postgresql://chunkforge:chunkforge@localhost:5432/chunkforge
PARSER_SERVICE_URL=http://localhost:8000

# Optional: For high-quality PDF parsing
LLAMA_CLOUD_API_KEY=your-api-key

# Optional: For AI metadata enrichment
OPENAI_API_KEY=your-api-key
```

### 4. Run the Application

```bash
# Terminal 1: Start the parser service
cd parser && python main.py

# Terminal 2: Start the main app (frontend + backend)
npm run dev
```

Access the application at http://localhost:5000

## Usage

1. **Upload a Document**: Click "New Upload" and select a PDF or other document
2. **Choose Parser**: Select LlamaParse (best quality), MarkItDown (free), or Docling
3. **Configure Chunking**: Choose a strategy and parameters
4. **Edit Chunks**: Drag to reorder, click to select, use toolbar to edit
5. **Add Metadata**: Select a chunk and fill in metadata in the right panel
6. **Export**: Click "Export" and choose format (JSON, JSONL, CSV, Markdown)

## Chunking Strategies

| Strategy | Description | Use Case |
|----------|-------------|----------|
| **Recursive** | Smart fixed-size with separator hierarchy | General purpose |
| **Paragraph** | Split on paragraph boundaries | Clean text documents |
| **By Heading** | Split on Markdown headings | Technical docs, manuals |
| **Semantic** | Header-family based grouping | Structured documents |
| **Sentence** | Split on sentence boundaries | NLP applications |
| **Token** | Token-aware chunking | LLM context windows |
| **Hierarchical** | Parent-child chunk relationships | Complex documents |

## Export Formats

- **JSON**: Array of chunk objects with full metadata
- **JSONL**: Newline-delimited JSON for streaming/large datasets
- **CSV**: Spreadsheet format with metadata columns
- **Markdown**: Formatted markdown with metadata sections

### Vector DB Presets

Built-in export presets for popular vector databases:
- Pinecone
- Chroma

## API Endpoints

### Uploads
- `POST /api/upload` - Upload and parse document
- `GET /api/uploads` - List all uploads
- `GET /api/uploads/:id` - Get single upload
- `DELETE /api/uploads/:id` - Delete upload

### Chunks
- `POST /api/chunk` - Generate chunks from markdown
- `GET /api/chunks/:uploadId` - Get chunks for upload
- `PATCH /api/chunks/:id` - Update chunk
- `DELETE /api/chunks/:id` - Delete chunk

### Schemas
- `GET /api/schemas` - List all schemas
- `POST /api/schemas` - Create schema
- `PATCH /api/schemas/:id` - Update schema
- `DELETE /api/schemas/:id` - Delete schema

### Export
- `POST /api/export` - Export chunks
- `GET /api/export/markdown/:uploadId` - Download markdown
- `GET /api/export/original/:uploadId` - Download original file

### AI Agents
- `POST /api/agents/upload-info/:uploadId` - Extract document info
- `POST /api/agents/enrich-chunk/:uploadId/:chunkId` - Enrich single chunk
- `POST /api/agents/enrich-chunks/:uploadId` - Batch enrich chunks

## Development

### Project Structure

```
/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # UI components
│   │   ├── pages/         # Page components
│   │   ├── hooks/         # Custom React hooks
│   │   └── lib/           # Utilities
├── server/                # Express backend
│   ├── routes/           # API route handlers
│   ├── services/         # Business logic
│   ├── db-schema.ts      # Drizzle schema
│   └── database.ts       # Database module
├── parser/               # Python FastAPI service
│   ├── main.py          # Parser endpoints
│   ├── llama_parser.py  # LlamaParse integration
│   ├── markitdown_parser.py
│   └── docling_parser.py
├── shared/              # Shared TypeScript types
│   ├── schema.ts        # Core data models
│   └── metadata-schema.ts
├── scripts/             # Database scripts
│   └── init-db.sql
└── storage/             # Local file storage
    ├── uploads/
    └── markdown/
```

### Commands

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run check    # TypeScript type checking
npm run db:push  # Push schema to database
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `PARSER_SERVICE_URL` | No | Parser service URL (default: http://localhost:8000) |
| `LLAMA_CLOUD_API_KEY` | No | LlamaParse API key for PDF parsing |
| `OPENAI_API_KEY` | No | OpenAI API key for AI features |
| `PORT` | No | Server port (default: 5000) |

## License

Apache 2.0
