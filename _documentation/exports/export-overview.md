# Export System Overview

ChunkForge provides a comprehensive export system that allows users to download their processed content in multiple formats optimized for different use cases.

## Export Types

The ExportDialog provides three main export categories via a tabbed interface:

| Tab | Description | Endpoint |
|-----|-------------|----------|
| **Chunks** | Export processed chunks in various formats | `POST /api/export` |
| **Markdown** | Download the parsed markdown document | `GET /api/export/markdown/:uploadId` |
| **Original** | Download the original uploaded file | `GET /api/export/original/:uploadId` |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    ExportDialog                          │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐               │
│  │ Chunks  │  │ Markdown │  │ Original │               │
│  └────┬────┘  └────┬─────┘  └────┬─────┘               │
└───────┼────────────┼─────────────┼──────────────────────┘
        │            │             │
        ▼            ▼             ▼
   POST /api/    GET /api/     GET /api/
    export      export/md     export/original
        │            │             │
        ▼            ▼             ▼
┌───────────────────────────────────────────────────────┐
│                 server/routes/export.ts                │
│                                                        │
│  • Format handlers (JSON, JSONL, CSV, etc.)           │
│  • Overlap processing (character/token)                │
│  • ID prefix application                               │
│  • File retrieval from local storage                   │
└───────────────────────────────────────────────────────┘
```

## Key Files

| File | Purpose |
|------|---------|
| `client/src/components/ExportDialog.tsx` | Frontend UI with tabbed interface |
| `server/routes/export.ts` | Backend API routes and format handlers |
| `shared/schema.ts` | Export types and request schemas |

## Related Documentation

- [Export Formats](./export-formats.md) - Detailed format specifications
- [Export Options](./export-options.md) - Configuration options (overlap, ID prefix, metadata)
