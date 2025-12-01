"""
Metadata extraction utilities for chunks.

This module provides functions to extract and enrich chunk metadata.
"""

from typing import List, Dict, Any
import tiktoken


def calculate_token_count(text: str, model: str = "gpt-4") -> int:
    """
    Calculate token count for a text using tiktoken.

    Args:
        text: The text to count tokens for
        model: The model encoding to use (default: gpt-4)

    Returns:
        Number of tokens
    """
    try:
        # Map common model names to encoding names
        encoding_map = {
            "gpt-4": "cl100k_base",
            "gpt-3.5-turbo": "cl100k_base",
            "text-davinci-003": "p50k_base",
            "text-davinci-002": "p50k_base",
        }

        encoding_name = encoding_map.get(model, "cl100k_base")
        encoding = tiktoken.get_encoding(encoding_name)
        return len(encoding.encode(text))
    except Exception as e:
        # Fallback: rough estimate (1 token ≈ 4 characters)
        return len(text) // 4


def enrich_metadata(
    chunks: List[Dict[str, Any]],
    strategy: str,
    original_text: str,
    schema_field_names: List[str] = None
) -> List[Dict[str, Any]]:
    """
    Enrich chunk metadata with additional information.

    Args:
        chunks: List of chunk dictionaries with 'text' and 'metadata'
        strategy: The chunking strategy used
        original_text: The original text before chunking
        schema_field_names: Optional list of field names to populate.
                            If None, all fields are populated.
                            If provided, only these fields will be populated.

    Returns:
        Enriched chunk dictionaries
    """
    enriched = []

    # Track current heading context for breadcrumb building
    current_headings = {}

    def should_include_field(field_name: str) -> bool:
        """Check if a field should be included based on schema."""
        if schema_field_names is None:
            return True  # No schema provided, include all fields
        return field_name in schema_field_names

    for idx, chunk in enumerate(chunks):
        text = chunk.get('text', '')
        metadata = chunk.get('metadata', {})

        # Add token count if not present and field is in schema
        if 'token_count' not in metadata and should_include_field('token_count'):
            metadata['token_count'] = calculate_token_count(text)

        # Add position information for all strategies (if in schema)
        if should_include_field('position_in_document'):
            metadata['position_in_document'] = idx
        if should_include_field('total_chunks'):
            metadata['total_chunks'] = len(chunks)

        # Strategy-specific enrichment
        if strategy == 'by_heading':
            # MarkdownChunker should have added heading metadata
            # Build section_path if not present but we have heading data
            if 'section_path' not in metadata and should_include_field('section_path'):
                section_path = build_section_path(metadata)
                if section_path:
                    metadata['section_path'] = section_path

        elif strategy == 'hierarchical':
            # Already handled in HierarchicalChunker
            # But also extract heading info from chunk text
            if 'heading_level' not in metadata:
                heading_meta = extract_heading_metadata(text)
                # Filter heading metadata by schema fields
                filtered_meta = {k: v for k, v in heading_meta.items() if should_include_field(k)}
                metadata.update(filtered_meta)
                if heading_meta and should_include_field('section_path'):
                    section_path = build_section_path(metadata)
                    if section_path:
                        metadata['section_path'] = section_path

        else:
            # For all other strategies, extract heading info from chunk text
            heading_meta = extract_heading_metadata(text)
            if heading_meta:
                # Update current heading context
                for key, value in heading_meta.items():
                    # Only process heading_1, heading_2, etc. (not heading_level)
                    if key.startswith('heading_') and key != 'heading_level':
                        try:
                            level = int(key.split('_')[1])
                            current_headings[level] = value
                            # Clear lower level headings when a higher level is found
                            for l in range(level + 1, 7):
                                current_headings.pop(l, None)
                        except ValueError:
                            pass  # Skip keys that don't have a numeric suffix

                # Only add fields that are in the schema
                filtered_meta = {k: v for k, v in heading_meta.items() if should_include_field(k)}
                metadata.update(filtered_meta)

            # Build section path from accumulated context
            if current_headings:
                for level in sorted(current_headings.keys()):
                    heading_key = f'heading_{level}'
                    if should_include_field(heading_key):
                        metadata[heading_key] = current_headings[level]
                if should_include_field('section_path'):
                    section_path = build_section_path(metadata)
                    if section_path:
                        metadata['section_path'] = section_path

        enriched.append({
            'text': text,
            'metadata': metadata
        })

    return enriched


def extract_heading_metadata(text: str) -> Dict[str, Any]:
    """
    Extract heading information from markdown text.

    Args:
        text: Markdown text possibly containing headings

    Returns:
        Dictionary with heading metadata
    """
    import re

    metadata = {}
    lines = text.strip().split('\n')

    # Check first few lines for headings
    for line in lines[:5]:
        match = re.match(r'^(#{1,6})\s+(.+)$', line.strip())
        if match:
            level = len(match.group(1))
            heading_text = match.group(2).strip()
            metadata[f'heading_{level}'] = heading_text
            metadata['heading_level'] = level
            break

    return metadata


def build_section_path(metadata: Dict[str, Any]) -> str:
    """
    Build a hierarchical section path from heading metadata.

    Args:
        metadata: Metadata dictionary containing heading_1, heading_2, etc.

    Returns:
        Section path string like "Chapter 1 > Section 1.1 > Subsection"
    """
    path_parts = []

    for level in range(1, 7):
        heading_key = f'heading_{level}'
        if heading_key in metadata and metadata[heading_key]:
            path_parts.append(metadata[heading_key])

    return " > ".join(path_parts) if path_parts else ""


def estimate_reading_time(text: str, words_per_minute: int = 200) -> int:
    """
    Estimate reading time in minutes for a chunk.

    Args:
        text: The text to estimate reading time for
        words_per_minute: Average reading speed (default: 200 wpm)

    Returns:
        Estimated reading time in minutes
    """
    word_count = len(text.split())
    reading_time = max(1, round(word_count / words_per_minute))
    return reading_time


def extract_code_blocks(text: str) -> List[Dict[str, str]]:
    """
    Extract code blocks from markdown text.

    Args:
        text: Markdown text

    Returns:
        List of dictionaries with 'language' and 'code' keys
    """
    import re

    pattern = r'```(\w+)?\n(.*?)```'
    matches = re.findall(pattern, text, re.DOTALL)

    code_blocks = []
    for match in matches:
        language = match[0] if match[0] else 'text'
        code = match[1].strip()
        code_blocks.append({
            'language': language,
            'code': code
        })

    return code_blocks


def calculate_complexity_score(text: str) -> float:
    """
    Calculate a simple complexity score for the text.

    Based on:
    - Average sentence length
    - Vocabulary diversity (unique words / total words)
    - Technical term density (code blocks, math symbols)

    Args:
        text: The text to analyze

    Returns:
        Complexity score from 0.0 (simple) to 1.0 (complex)
    """
    import re

    if not text:
        return 0.0

    # Sentence count
    sentences = re.split(r'[.!?]+', text)
    sentence_count = len([s for s in sentences if s.strip()])

    if sentence_count == 0:
        return 0.0

    # Words
    words = text.split()
    word_count = len(words)

    if word_count == 0:
        return 0.0

    # Average sentence length (normalized to 0-1, assuming 30+ words is complex)
    avg_sentence_length = word_count / sentence_count
    length_score = min(avg_sentence_length / 30, 1.0)

    # Vocabulary diversity
    unique_words = len(set(word.lower() for word in words))
    diversity_score = unique_words / word_count

    # Technical indicators
    code_blocks = len(extract_code_blocks(text))
    has_math = bool(re.search(r'[$].*?[$]', text))  # LaTeX math
    has_links = bool(re.search(r'\[.*?\]\(.*?\)', text))  # Markdown links

    technical_score = min((code_blocks * 0.2 + has_math * 0.3 + has_links * 0.1), 0.5)

    # Combine scores
    complexity = (length_score * 0.3 + diversity_score * 0.4 + technical_score * 0.3)

    return round(complexity, 2)
