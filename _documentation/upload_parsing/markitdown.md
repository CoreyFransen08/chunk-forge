# MarkItDown Parser Method

## Overview

MarkItDown is an open-source Python library developed by Microsoft that converts various document formats to Markdown. 

## Key Characteristics

| Property | Value |
|----------|-------|
| **Supported Formats** | PDF, Word (.docx), Excel (.xlsx), CSV |
| **Quality** | Good - best for simple documents |
| **Processing** | Local (no external API) |
| **API Key Required** | No |

## When to Use MarkItDown

- Simple documents without complex layouts
- Word documents, spreadsheets, CSV files
- Batch processing large numbers of files
- Documents where perfect formatting isn't critical
- When you don't have a LlamaParse API key

## Supported File Types

### PDF Files (`.pdf`)
- Basic text extraction
- Table detection (simpler than LlamaParse)
- Heading structure preservation

### Word Documents (`.docx`)
- Full text content
- Heading hierarchy
- Lists and formatting
- Tables

### Excel Spreadsheets (`.xlsx`)
- Sheet content as markdown tables
- Cell formatting preserved where possible
- Multiple sheets supported

### CSV Files (`.csv`)
- Converted to markdown tables
- Header row detection
- Clean tabular output

## Implementation Details

### File Location
`parser/markitdown_parser.py`

### Main Function
```python
def parse_with_markitdown(file_path: str) -> ParseResult
```

### Return Type
```python
class ParseResult(NamedTuple):
    markdown: str      # Converted markdown content
    page_count: int    # Number of pages (PDFs only, 0 for other types)
```

### Process Flow

1. **Initialize MarkItDown**: Creates `MarkItDown(enable_plugins=False)` instance
2. **Convert Document**: Calls `md.convert(file_path)`
3. **Page Count**: For PDFs, extracts page count via PyPDF2
4. **Return**: Returns `ParseResult` with markdown and page count

### Code Example

```python
from markitdown import MarkItDown

md = MarkItDown(enable_plugins=False)
result = md.convert("document.docx")
print(result.text_content)
```

## Configuration

MarkItDown currently uses default settings with plugins disabled for security:

```python
md = MarkItDown(enable_plugins=False)
```

Unlike LlamaParse, MarkItDown does not support extensive configuration options. The conversion is straightforward and deterministic.

## Caching

MarkItDown results use the same caching infrastructure as LlamaParse but with a separate cache key:

- **Cache Key**: `SHA256(file_hash + "markitdown" + config_json)`
- **TTL**: 7 days (configurable via `PARSE_CACHE_TTL`)
- **Location**: `./cache/parses/` directory

Same file parsed with different methods = separate cache entries.

## MIME Type Support

| MIME Type | Extension | Description |
|-----------|-----------|-------------|
| `application/pdf` | `.pdf` | PDF documents |
| `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | `.docx` | Word documents |
| `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | `.xlsx` | Excel spreadsheets |
| `text/csv` | `.csv` | CSV files |

## API Endpoint

The MarkItDown parser is invoked via the `/parse` endpoint with `parser_method=markitdown`:

```
POST /parse
Content-Type: multipart/form-data

file: <document binary>
parser_method: markitdown
```

**Response:**
```json
{
  "markdown": "# Document Title\n\nContent...",
  "pageCount": 0
}
```

Note: `pageCount` is 0 for non-PDF files.

## Output Examples

### Word Document Output
```markdown
# Document Title

## Introduction

This is the introduction paragraph with **bold** and *italic* text.

## Section 1

- List item 1
- List item 2
- List item 3

| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |
```

### Excel Spreadsheet Output
```markdown
# Sheet1

| Name  | Age | City     |
|-------|-----|----------|
| Alice | 30  | New York |
| Bob   | 25  | Boston   |

# Sheet2

| Product | Price |
|---------|-------|
| Widget  | $10   |
| Gadget  | $25   |
```

### CSV Output
```markdown
| column1 | column2 | column3 |
|---------|---------|---------|
| value1  | value2  | value3  |
| value4  | value5  | value6  |
```

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| `ImportError` | markitdown not installed | Run `pip install markitdown[all]` |
| `File not found` | Invalid file path | Check file exists |
| `Unsupported format` | Unknown file type | Use supported extension |

## Dependencies

Install with all optional dependencies:

```bash
pip install 'markitdown[all]>=0.1.0'
```

Or install specific format support:

```bash
pip install 'markitdown[pdf,docx,xlsx]'
```

## Quality Comparison

| Feature | MarkItDown | LlamaParse |
|---------|------------|------------|
| Table extraction | Good | Excellent |
| Multi-column layout | Basic | Excellent |
| OCR accuracy | Moderate | High |
| Heading detection | Good | Excellent |
| Processing speed | Fast (local) | Slower (API) |
| API key required | No | Yes |
| File types | Multiple | PDF only |

## Best Practices

1. **Use for simple documents**: MarkItDown excels with straightforward text documents
2. **Batch processing**: Ideal for processing many files without credit concerns
3. **Word/Excel files**: Better native support than LlamaParse (which only handles PDFs)
4. **Test both**: Try MarkItDown first; switch to LlamaParse if quality is insufficient

## Limitations

- No OCR for scanned PDFs (requires text-based PDFs)
- Less accurate table extraction than LlamaParse
- No configuration options for fine-tuning
- May struggle with complex multi-column layouts
- No image description capabilities

## Related Files

- `parser/markitdown_parser.py` - Parser implementation
- `parser/cache.py` - Caching logic (`ParseResultCache`)
- `parser/main.py` - FastAPI endpoint (`/parse`)
- `parser/requirements.txt` - Package dependency
- `server/routes/upload.ts` - Express upload handler
