# ChunkForge Parser Service

FastAPI-based microservice for PDF parsing and semantic text chunking using LlamaIndex.

## Features

- **PDF to Markdown Conversion**: Extracts text from PDFs and converts to markdown format
- **Semantic Chunking**: Intelligent text splitting using OpenAI embeddings
- **Fallback Support**: Works with PyPDF2 when LlamaIndex is unavailable
- **Health Checks**: Built-in health monitoring endpoint

## Running with Docker

### Build and Run

```bash
# Build the Docker image
docker build -t chunkforge-parser .

# Run the container
docker run -p 8000:8000 chunkforge-parser

# Or with OpenAI API key for semantic chunking
docker run -p 8000:8000 -e OPENAI_API_KEY=your_key_here chunkforge-parser
```

### Using Docker Compose

#### Production Mode
```bash
# Start the service (requires rebuild for code changes)
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the service
docker-compose down
```

#### Development Mode (with live reload)
```bash
# Start with volume mounting for live code changes
docker-compose -f docker-compose.dev.yml up

# Your changes to main.py will automatically reload!
# No rebuild needed during development
```

**Development vs Production:**
- **Development** (`docker-compose.dev.yml`): Mounts source code, enables auto-reload, runs in foreground
- **Production** (`docker-compose.yml`): Baked-in code, no auto-reload, runs in background

### Environment Variables

- `OPENAI_API_KEY` (optional): Required for semantic chunking feature

## Running Locally

### Prerequisites

- Python 3.11+
- pip

### Installation

```bash
# Install dependencies
pip install -r requirements.txt

# Run the service
python main.py
```

The service will be available at `http://localhost:8000`

## API Endpoints

### Health Check
```
GET /
```

### Parse PDF
```
POST /parse-pdf
Content-Type: multipart/form-data

Form Data:
- file: PDF file to parse
```

Response:
```json
{
  "markdown": "# Extracted Text\n\n..."
}
```

### Semantic Chunking
```
POST /chunk-semantic
Content-Type: application/json

{
  "text": "Your text to chunk...",
  "chunk_size": 500
}
```

Response:
```json
{
  "chunks": ["chunk1", "chunk2", ...]
}
```

## Architecture

- **Framework**: FastAPI
- **Server**: Uvicorn with async support
- **PDF Parsing**: LlamaIndex (primary) / PyPDF2 (fallback)
- **Embeddings**: OpenAI (for semantic chunking)

## Docker Image Details

- **Base Image**: `python:3.11-slim`
- **Exposed Port**: 8000
- **Health Check**: Every 30 seconds
- **Restart Policy**: Unless stopped manually

## Production Deployment

For production deployments:

1. Set `OPENAI_API_KEY` environment variable
2. Use reverse proxy (nginx/traefik) for SSL termination
3. Configure resource limits in docker-compose.yml:
   ```yaml
   deploy:
     resources:
       limits:
         cpus: '1'
         memory: 1G
   ```
4. Enable logging driver for centralized logs
5. Use Docker secrets for sensitive data

## Development

```bash
# Install dev dependencies
pip install -r requirements.txt

# Run with auto-reload
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## Troubleshooting

### Container won't start
- Check logs: `docker logs <container_id>`
- Verify port 8000 is not in use
- Ensure sufficient disk space for image

### PDF parsing fails
- Verify file is valid PDF
- Check LlamaIndex dependencies installed
- Falls back to PyPDF2 if LlamaIndex unavailable

### Semantic chunking not working
- Ensure `OPENAI_API_KEY` is set
- Verify OpenAI API quota
- Check network connectivity to OpenAI API
