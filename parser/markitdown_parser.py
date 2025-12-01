"""
MarkItDown parsing service for multiple document types.

This module provides document parsing using Microsoft's MarkItDown library,
supporting PDF, Word, Excel, and CSV files.
"""

from typing import NamedTuple


class ParseResult(NamedTuple):
    """Result of parsing containing markdown and page metadata."""
    markdown: str
    page_count: int  # 0 for non-PDF types, estimated for PDFs


def get_pdf_page_count(file_path: str) -> int:
    """
    Extract page count from PDF using PyPDF2.

    Args:
        file_path: Path to PDF file

    Returns:
        Number of pages in the PDF, or 0 if not a PDF or error
    """
    if not file_path.lower().endswith('.pdf'):
        return 0

    try:
        from PyPDF2 import PdfReader
        reader = PdfReader(file_path)
        return len(reader.pages)
    except Exception as e:
        print(f"Warning: Could not extract page count: {e}")
        return 0


def parse_with_markitdown(file_path: str) -> ParseResult:
    """
    Parse document to markdown using Microsoft MarkItDown.

    Supports: PDF, DOCX, XLSX, CSV

    Args:
        file_path: Path to document file

    Returns:
        ParseResult containing markdown text and page count

    Raises:
        ImportError: If markitdown package is not installed
        Exception: If parsing fails
    """
    from markitdown import MarkItDown

    # Initialize MarkItDown (plugins disabled for security)
    md = MarkItDown(enable_plugins=False)

    # Convert document to markdown
    result = md.convert(file_path)

    # Get page count for PDFs
    page_count = get_pdf_page_count(file_path)

    return ParseResult(
        markdown=result.text_content,
        page_count=page_count
    )
