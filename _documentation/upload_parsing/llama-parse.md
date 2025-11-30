# LlamaParse Parser Method

## Overview

LlamaParse is a high-quality PDF parsing service provided by LlamaIndex. It uses advanced AI models to convert PDF documents to Markdown while preserving document structure, tables, and formatting.

## Key Characteristics

| Property | Value |
|----------|-------|
| **Supported Formats** | PDF only |
| **Quality** | High - best for complex PDFs |
| **Processing** | Cloud-based API |
| **API Key Required** | Yes (`LLAMA_CLOUD_API_KEY`) |

## When to Use LlamaParse

- Complex PDF documents with tables, charts, or multi-column layouts
- Academic papers, research documents, technical documentation
- Documents where structural accuracy is critical
- PDFs with embedded images requiring OCR

## Configuration Options

LlamaParse supports extensive configuration via the `ParseConfig` model in `parser/llama_parser.py`:

```python
class ParseConfig(BaseModel):
    # Language and OCR
    language: str = "en"              # Document language for OCR
    disable_ocr: bool = False         # Skip OCR on images
    skip_diagonal_text: bool = False  # Skip angled text

    # Page handling
    target_pages: Optional[str] = None    # Page range (e.g., "0-5,10")
    page_separator: str = "\n---\n"       # Delimiter between pages

    # Table and layout
    output_tables_as_HTML: bool = False   # Render tables as HTML
    preserve_layout_alignment_across_pages: bool = False

    # Header/footer
    hide_headers: bool = False        # Remove headers from output
    hide_footers: bool = False        # Remove footers from output
```

### Configuration Examples

**Basic usage (defaults):**
```json
{}
```

**Spanish document with HTML tables:**
```json
{
  "language": "es",
  "output_tables_as_HTML": true
}
```

**Parse specific pages only:**
```json
{
  "target_pages": "0-10,15,20-25"
}
```

**Clean output (no headers/footers):**
```json
{
  "hide_headers": true,
  "hide_footers": true
}
```

## Implementation Details

### File Location
`parser/llama_parser.py`

### Main Function
```python
def parse_pdf(file_path: str, config: Optional[Dict[str, Any]] = None) -> ParseResult
```

### Return Type
```python
class ParseResult(NamedTuple):
    markdown: str      # Converted markdown content
    page_count: int    # Number of pages in PDF
```

### Process Flow

1. **Page Count Extraction**: Uses PyPDF2 to get page count (no API call)
2. **API Key Validation**: Checks `LLAMA_CLOUD_API_KEY` environment variable
3. **Config Validation**: Validates and merges with defaults via Pydantic
4. **Cache Check**: Looks for cached result by file hash + config + parser method
5. **API Call**: If not cached, calls LlamaParse cloud service
6. **Cache Storage**: Stores successful result for future requests
7. **Return**: Returns `ParseResult` with markdown and page count

### Caching

LlamaParse results are cached to reduce API costs:

- **Cache Key**: `SHA256(file_hash + "llamaparse" + config_json)`
- **TTL**: 7 days (configurable via `PARSE_CACHE_TTL`)
- **Location**: `./cache/parses/` directory
- **Format**: JSON with markdown, config, parser method, timestamp

Same file with different configs = separate cache entries.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LLAMA_CLOUD_API_KEY` | Yes | - | API key from LlamaIndex Cloud |
| `PARSE_CACHE_DIR` | No | `./cache/parses` | Cache directory |
| `PARSE_CACHE_TTL` | No | `604800` (7 days) | Cache TTL in seconds |

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| `ValueError: LLAMA_CLOUD_API_KEY not set` | Missing API key | Set environment variable |
| `Invalid config` | Bad config JSON | Falls back to defaults with warning |
| `Parser service failed` | API error | Check API key, network, or LlamaIndex status |

## API Endpoint

The LlamaParse parser is invoked via the `/parse` endpoint with `parser_method=llamaparse`:

```
POST /parse
Content-Type: multipart/form-data

file: <PDF binary>
parser_method: llamaparse
config: {"language": "en"}  (optional)
```

**Response:**
```json
{
  "markdown": "# Document Title\n\nContent...",
  "pageCount": 42
}
```

## Quality Comparison

| Feature | LlamaParse | MarkItDown |
|---------|------------|------------|
| Table extraction | Excellent | Good |
| Multi-column layout | Excellent | Basic |
| OCR accuracy | High | Moderate |
| Heading detection | Excellent | Good |
| Image handling | Descriptions | Metadata only |
| Processing speed | Slower (API) | Faster (local) |

## Related Files

- `parser/llama_parser.py` - Parser implementation
- `parser/cache.py` - Caching logic (`ParseResultCache`)
- `parser/main.py` - FastAPI endpoint (`/parse`)
- `server/routes/upload.ts` - Express upload handler
