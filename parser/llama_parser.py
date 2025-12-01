"""
Modular PDF parsing service with configurable LlamaParse integration.

This module provides PDF parsing using LlamaParse with configuration management
and caching for performance optimization.
"""

import hashlib
import os
from typing import Any, Dict, Optional, NamedTuple

from pydantic import BaseModel, Field
from PyPDF2 import PdfReader


class ParseResult(NamedTuple):
    """Result of PDF parsing containing markdown and metadata."""
    markdown: str
    page_count: int


def get_pdf_page_count(file_path: str) -> int:
    """
    Extract page count from PDF using PyPDF2.

    Args:
        file_path: Path to PDF file

    Returns:
        Number of pages in the PDF
    """
    try:
        reader = PdfReader(file_path)
        return len(reader.pages)
    except Exception as e:
        print(f"Warning: Could not extract page count: {e}")
        return 0


class ParseConfig(BaseModel):
    """Configuration for PDF parsing with LlamaParse."""

    # Language and OCR
    language: str = Field(default="en", description="Document language for OCR")
    disable_ocr: bool = Field(default=False, description="Skip OCR on images")
    skip_diagonal_text: bool = Field(default=False, description="Skip angled text")

    # Page handling
    target_pages: Optional[str] = Field(
        default=None, description="Page range (e.g., '0-5,10')"
    )
    page_separator: str = Field(
        default="\n---\n", description="Delimiter between pages"
    )

    # Table and layout
    output_tables_as_HTML: bool = Field(
        default=False, description="Render tables as HTML"
    )
    preserve_layout_alignment_across_pages: bool = Field(
        default=False, description="Maintain alignment across pages"
    )

    # Header/footer
    hide_headers: bool = Field(default=False, description="Remove headers from output")
    hide_footers: bool = Field(default=False, description="Remove footers from output")

    class Config:
        extra = "forbid"  # Reject unknown keys


# Default configuration
DEFAULT_PARSE_CONFIG = ParseConfig().model_dump()


def _hash_file(file_path: str) -> str:
    """
    Generate SHA256 hash of file contents.

    Args:
        file_path: Path to file to hash

    Returns:
        Hexadecimal SHA256 hash string
    """
    sha256 = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            sha256.update(chunk)
    return sha256.hexdigest()


def parse_pdf(file_path: str, config: Optional[Dict[str, Any]] = None) -> ParseResult:
    """
    Parse PDF to markdown using LlamaParse with caching.

    Results are cached by file hash + config to avoid re-parsing.

    Args:
        file_path: Path to PDF file
        config: Optional parsing configuration (uses defaults if not provided)

    Returns:
        ParseResult containing markdown text and page count

    Raises:
        ImportError: If llama-cloud-services package is not installed
        ValueError: If LLAMA_CLOUD_API_KEY is not configured
        Exception: If parsing fails
    """
    from llama_cloud_services import LlamaParse
    from cache import get_parse_cache

    # Extract page count before any processing (PyPDF2 doesn't need API key)
    page_count = get_pdf_page_count(file_path)

    # Check API key
    api_key = os.getenv("LLAMA_CLOUD_API_KEY")
    if not api_key:
        raise ValueError("LLAMA_CLOUD_API_KEY environment variable is not set")

    # Validate and merge config with defaults
    if config is None:
        config = DEFAULT_PARSE_CONFIG
    else:
        try:
            # Validate config against Pydantic model
            parse_config = ParseConfig(**config)
            config = parse_config.model_dump()
        except Exception as e:
            print(f"Invalid config, using defaults: {e}")
            config = DEFAULT_PARSE_CONFIG

    # Convert to Pydantic model for type safety
    parse_config = ParseConfig(**config)

    # Check cache first
    file_hash = _hash_file(file_path)
    cache = get_parse_cache()
    cached_result = cache.get(file_hash, config, parser_method="llamaparse")

    if cached_result is not None:
        print(f"Cache hit for {file_path} (LlamaParse)")
        return ParseResult(markdown=cached_result, page_count=page_count)

    # Parse with LlamaParse
    parser = LlamaParse(
        api_key=api_key,
        result_type="markdown",
        verbose=True,
        language=parse_config.language,
        disable_ocr=parse_config.disable_ocr,
        skip_diagonal_text=parse_config.skip_diagonal_text,
        target_pages=parse_config.target_pages,
        page_separator=parse_config.page_separator,
        output_tables_as_HTML=parse_config.output_tables_as_HTML,
        preserve_layout_alignment_across_pages=parse_config.preserve_layout_alignment_across_pages,
        hide_headers=parse_config.hide_headers,
        hide_footers=parse_config.hide_footers,
    )

    documents = parser.load_data(file_path)
    markdown = "\n\n".join([doc.text for doc in documents])

    # Cache the successful result
    cache.set(file_hash, config, markdown, parser_method="llamaparse")
    print(f"Successfully parsed with LlamaParse")

    return ParseResult(markdown=markdown, page_count=page_count)
