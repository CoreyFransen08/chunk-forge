"""
Docling parsing service for AI-powered document understanding.

This module provides document parsing using IBM's Docling library,
supporting PDF, Word, PowerPoint, Excel, HTML, and image files.
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


def parse_with_docling(file_path: str) -> ParseResult:
    """
    Parse document to markdown using IBM Docling.

    Supports: PDF, DOCX, PPTX, XLSX, HTML, images (PNG, JPEG)

    Args:
        file_path: Path to document file

    Returns:
        ParseResult containing markdown text and page count

    Raises:
        ImportError: If docling package is not installed
        Exception: If parsing fails
    """
    from docling.document_converter import DocumentConverter

    # Initialize DocumentConverter
    converter = DocumentConverter()

    # Convert document
    result = converter.convert(file_path)

    # Export to markdown
    markdown = result.document.export_to_markdown()

    # Get page count for PDFs
    page_count = get_pdf_page_count(file_path)

    return ParseResult(
        markdown=markdown,
        page_count=page_count
    )
