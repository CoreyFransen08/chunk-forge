# Docling Parser Method

## Overview

Docling is an open-source document processing library developed by IBM that converts various document formats to Markdown using AI-powered understanding. It provides excellent layout detection, table extraction, and OCR capabilities.

## Key Characteristics

| Property | Value |
|----------|-------|
| **Supported Formats** | PDF, Word (.docx), PowerPoint (.pptx), Excel (.xlsx), HTML, Images (PNG, JPEG) |
| **Quality** | Excellent - AI-powered document understanding |
| **Processing** | Local (no external API) |
| **API Key Required** | No |

## When to Use Docling

- Complex PDF documents with tables, charts, or multi-column layouts
- PowerPoint presentations that need conversion
- Documents requiring OCR (scanned PDFs, images)
- When you need high-quality output without API costs
- HTML pages that need to be converted to Markdown
- Image-based documents (screenshots, scanned pages)

## Supported File Types

### PDF Files (`.pdf`)
- Advanced text extraction with AI-powered layout detection
- Excellent table detection and formatting
- OCR support for scanned documents
- Multi-column layout handling

### Word Documents (`.docx`)
- Full text content
- Heading hierarchy
- Lists and formatting
- Tables

### PowerPoint Presentations (`.pptx`)
- Slide content extraction
- Speaker notes (where available)
- Table handling

### Excel Spreadsheets (`.xlsx`)
- Sheet content as markdown tables
- Cell formatting preserved where possible
- Multiple sheets supported

### HTML Files (`.html`)
- Clean text extraction
- Structure preservation
- Link handling

### Images (`.png`, `.jpg`, `.jpeg`)
- OCR text extraction
- Layout detection
- Multi-language support

## Implementation Details

### File Location
`parser/docling_parser.py`

### Main Function
```python
def parse_with_docling(file_path: str) -> ParseResult
```

### Return Type
```python
class ParseResult(NamedTuple):
    markdown: str      # Converted markdown content
    page_count: int    # Number of pages (PDFs only, 0 for other types)
```

### Process Flow

1. **Initialize DocumentConverter**: Creates Docling converter instance
2. **Convert Document**: Calls `converter.convert(file_path)`
3. **Export to Markdown**: Uses `result.document.export_to_markdown()`
4. **Page Count**: For PDFs, extracts page count via PyPDF2
5. **Return**: Returns `ParseResult` with markdown and page count

### Code Example

```python
from docling.document_converter import DocumentConverter

converter = DocumentConverter()
result = converter.convert("document.pdf")
markdown = result.document.export_to_markdown()
```

## Caching

Docling results use the same caching infrastructure as other parsers:

- **Cache Key**: `SHA256(file_hash + "docling" + config_json)`
- **TTL**: 7 days (configurable via `PARSE_CACHE_TTL`)
- **Location**: `./cache/parses/` directory

Same file parsed with different methods = separate cache entries.

## MIME Type Support

| MIME Type | Extension | Description |
|-----------|-----------|-------------|
| `application/pdf` | `.pdf` | PDF documents |
| `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | `.docx` | Word documents |
| `application/vnd.openxmlformats-officedocument.presentationml.presentation` | `.pptx` | PowerPoint presentations |
| `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | `.xlsx` | Excel spreadsheets |
| `text/html` | `.html` | HTML pages |
| `image/png` | `.png` | PNG images |
| `image/jpeg` | `.jpg`, `.jpeg` | JPEG images |

## API Endpoint

The Docling parser is invoked via the `/parse` endpoint with `parser_method=docling`:

```
POST /parse
Content-Type: multipart/form-data

file: <document binary>
parser_method: docling
```

**Response:**
```json
{
  "markdown": "# Document Title\n\nContent...",
  "pageCount": 0
}
```

Note: `pageCount` is 0 for non-PDF files.

## Quality Comparison

| Feature | LlamaParse | MarkItDown | Docling |
|---------|------------|------------|---------|
| Table extraction | Excellent | Good | Excellent |
| Multi-column layout | Excellent | Basic | Excellent |
| OCR accuracy | High | Moderate | High |
| Heading detection | Excellent | Good | Excellent |
| Processing speed | Slower (API) | Faster (local) | Moderate (local) |
| API key required | Yes | No | No |
| File types | PDF only | Multiple | Most diverse |
| PowerPoint support | No | No | Yes |
| Image support | No | No | Yes |

## Best Practices

1. **Use for complex documents**: Docling excels with multi-column layouts and complex tables
2. **PowerPoint conversions**: Only Docling supports PPTX among our parsers
3. **Image-based documents**: Use Docling for scanned PDFs or image files
4. **HTML conversion**: When you need to convert web pages to Markdown
5. **Compare quality**: Try Docling alongside MarkItDown for PDFs to see which produces better results

## Limitations

- Slower than MarkItDown for simple documents (more processing overhead)
- First-time use may require model downloads
- Large documents may use significant memory
- Some complex layouts may still require manual cleanup

## Dependencies

Install with pip:

```bash
pip install docling
```

Note: Docling may download AI models on first use, which can take additional time and disk space.

## Related Files

- `parser/docling_parser.py` - Parser implementation
- `parser/cache.py` - Caching logic (`ParseResultCache`)
- `parser/main.py` - FastAPI endpoint (`/parse`)
- `parser/requirements.txt` - Package dependency
- `server/routes/upload.ts` - Express upload handler
