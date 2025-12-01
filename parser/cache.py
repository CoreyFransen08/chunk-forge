"""
Caching utilities for expensive operations like embeddings and chunking.

This module provides caching mechanisms to reduce API costs and improve performance.
"""

import hashlib
import json
import os
import pickle
import time
from functools import lru_cache
from pathlib import Path
from typing import Any, Optional, Dict


class EmbeddingCache:
    """Cache for embedding API results."""

    def __init__(self, cache_dir: str = "./cache/embeddings", ttl: int = 604800):
        """
        Initialize the embedding cache.

        Args:
            cache_dir: Directory to store cache files
            ttl: Time to live in seconds (default: 7 days)
        """
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.ttl = ttl

    def _get_cache_key(self, text: str, model: str) -> str:
        """
        Generate a cache key for text and model combination.

        Args:
            text: The text being embedded
            model: The embedding model name

        Returns:
            SHA256 hash as cache key
        """
        content = f"{text}:{model}"
        return hashlib.sha256(content.encode()).hexdigest()

    def _get_cache_path(self, key: str) -> Path:
        """Get the file path for a cache key."""
        return self.cache_dir / f"{key}.pkl"

    def get(self, text: str, model: str) -> Optional[Any]:
        """
        Retrieve embedding from cache.

        Args:
            text: The text to look up
            model: The embedding model name

        Returns:
            Cached embedding or None if not found/expired
        """
        key = self._get_cache_key(text, model)
        cache_file = self._get_cache_path(key)

        if not cache_file.exists():
            return None

        # Check if cache is expired
        file_age = time.time() - cache_file.stat().st_mtime
        if file_age > self.ttl:
            # Cache expired, delete it
            cache_file.unlink()
            return None

        try:
            with open(cache_file, 'rb') as f:
                return pickle.load(f)
        except Exception as e:
            print(f"Error loading cache: {e}")
            return None

    def set(self, text: str, model: str, embedding: Any):
        """
        Store embedding in cache.

        Args:
            text: The text being embedded
            model: The embedding model name
            embedding: The embedding to cache
        """
        key = self._get_cache_key(text, model)
        cache_file = self._get_cache_path(key)

        try:
            with open(cache_file, 'wb') as f:
                pickle.dump(embedding, f)
        except Exception as e:
            print(f"Error saving cache: {e}")

    def clear_expired(self):
        """Remove all expired cache entries."""
        current_time = time.time()

        for cache_file in self.cache_dir.glob("*.pkl"):
            file_age = current_time - cache_file.stat().st_mtime
            if file_age > self.ttl:
                cache_file.unlink()

    def clear_all(self):
        """Remove all cache entries."""
        for cache_file in self.cache_dir.glob("*.pkl"):
            cache_file.unlink()

    def get_size(self) -> tuple[int, int]:
        """
        Get cache statistics.

        Returns:
            Tuple of (number of files, total size in bytes)
        """
        files = list(self.cache_dir.glob("*.pkl"))
        total_size = sum(f.stat().st_size for f in files)
        return len(files), total_size


class ChunkResultCache:
    """
    Cache for chunking operation results.
    Uses LRU caching in memory for fast repeated access.
    """

    def __init__(self, cache_dir: str = "./cache/chunks", ttl: int = 86400):
        """
        Initialize the chunk result cache.

        Args:
            cache_dir: Directory to store cache files
            ttl: Time to live in seconds (default: 1 day)
        """
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.ttl = ttl

    def _get_cache_key(
        self,
        text_hash: str,
        strategy: str,
        config: Dict[str, Any]
    ) -> str:
        """
        Generate cache key for chunking operation.

        Args:
            text_hash: Hash of the input text
            strategy: Chunking strategy name
            config: Configuration dictionary

        Returns:
            Cache key string
        """
        # Create deterministic config representation
        config_str = json.dumps(config, sort_keys=True)
        content = f"{text_hash}:{strategy}:{config_str}"
        return hashlib.sha256(content.encode()).hexdigest()

    def _get_cache_path(self, key: str) -> Path:
        """Get the file path for a cache key."""
        return self.cache_dir / f"{key}.json"

    def _hash_text(self, text: str) -> str:
        """Create a hash of the input text."""
        return hashlib.sha256(text.encode()).hexdigest()

    def get(
        self,
        text: str,
        strategy: str,
        config: Dict[str, Any]
    ) -> Optional[list]:
        """
        Retrieve chunking result from cache.

        Args:
            text: The input text
            strategy: Chunking strategy name
            config: Configuration dictionary

        Returns:
            Cached chunks or None if not found/expired
        """
        text_hash = self._hash_text(text)
        key = self._get_cache_key(text_hash, strategy, config)
        cache_file = self._get_cache_path(key)

        if not cache_file.exists():
            return None

        # Check if cache is expired
        file_age = time.time() - cache_file.stat().st_mtime
        if file_age > self.ttl:
            cache_file.unlink()
            return None

        try:
            with open(cache_file, 'r') as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading chunk cache: {e}")
            return None

    def set(
        self,
        text: str,
        strategy: str,
        config: Dict[str, Any],
        chunks: list
    ):
        """
        Store chunking result in cache.

        Args:
            text: The input text
            strategy: Chunking strategy name
            config: Configuration dictionary
            chunks: The chunks to cache
        """
        text_hash = self._hash_text(text)
        key = self._get_cache_key(text_hash, strategy, config)
        cache_file = self._get_cache_path(key)

        try:
            with open(cache_file, 'w') as f:
                json.dump(chunks, f)
        except Exception as e:
            print(f"Error saving chunk cache: {e}")

    def clear_expired(self):
        """Remove all expired cache entries."""
        current_time = time.time()

        for cache_file in self.cache_dir.glob("*.json"):
            file_age = current_time - cache_file.stat().st_mtime
            if file_age > self.ttl:
                cache_file.unlink()

    def clear_all(self):
        """Remove all cache entries."""
        for cache_file in self.cache_dir.glob("*.json"):
            cache_file.unlink()


class ParseResultCache:
    """
    Cache for PDF parsing results.
    Caches by file hash + parsing configuration to avoid re-parsing.
    """

    def __init__(self, cache_dir: str = "./cache/parses", ttl: int = 604800):
        """
        Initialize the parse result cache.

        Args:
            cache_dir: Directory to store cache files
            ttl: Time to live in seconds (default: 7 days)
        """
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.ttl = ttl

    def _get_cache_key(
        self,
        file_hash: str,
        config: Dict[str, Any],
        parser_method: str = "llamaparse"
    ) -> str:
        """
        Generate cache key for parsing operation.

        Args:
            file_hash: Hash of the PDF file contents
            config: Configuration dictionary
            parser_method: Parser method used ("llamaparse" or "markitdown")

        Returns:
            Cache key string
        """
        # Create deterministic config representation
        config_str = json.dumps(config, sort_keys=True)
        content = f"{file_hash}:{parser_method}:{config_str}"
        return hashlib.sha256(content.encode()).hexdigest()

    def _get_cache_path(self, key: str) -> Path:
        """Get the file path for a cache key."""
        return self.cache_dir / f"{key}.json"

    def get(
        self,
        file_hash: str,
        config: Dict[str, Any],
        parser_method: str = "llamaparse"
    ) -> Optional[str]:
        """
        Retrieve parsing result from cache.

        Args:
            file_hash: Hash of the PDF file
            config: Configuration dictionary
            parser_method: Parser method used ("llamaparse" or "markitdown")

        Returns:
            Cached markdown or None if not found/expired
        """
        key = self._get_cache_key(file_hash, config, parser_method)
        cache_file = self._get_cache_path(key)

        if not cache_file.exists():
            return None

        # Check if cache is expired
        file_age = time.time() - cache_file.stat().st_mtime
        if file_age > self.ttl:
            cache_file.unlink()
            return None

        try:
            with open(cache_file, 'r') as f:
                data = json.load(f)
                return data.get('markdown')
        except Exception as e:
            print(f"Error loading parse cache: {e}")
            return None

    def set(
        self,
        file_hash: str,
        config: Dict[str, Any],
        markdown: str,
        parser_method: str = "llamaparse"
    ):
        """
        Store parsing result in cache.

        Args:
            file_hash: Hash of the PDF file
            config: Configuration dictionary
            markdown: The parsed markdown text
            parser_method: Parser method used ("llamaparse" or "markitdown")
        """
        key = self._get_cache_key(file_hash, config, parser_method)
        cache_file = self._get_cache_path(key)

        cache_data = {
            'file_hash': file_hash,
            'config': config,
            'markdown': markdown,
            'parser_method': parser_method,
            'timestamp': time.time()
        }

        try:
            with open(cache_file, 'w') as f:
                json.dump(cache_data, f)
        except Exception as e:
            print(f"Error saving parse cache: {e}")

    def clear_expired(self):
        """Remove all expired cache entries."""
        current_time = time.time()

        for cache_file in self.cache_dir.glob("*.json"):
            file_age = current_time - cache_file.stat().st_mtime
            if file_age > self.ttl:
                cache_file.unlink()

    def clear_all(self):
        """Remove all cache entries."""
        for cache_file in self.cache_dir.glob("*.json"):
            cache_file.unlink()


# Global cache instances
_embedding_cache = None
_chunk_cache = None
_parse_cache = None


def get_embedding_cache() -> EmbeddingCache:
    """Get or create the global embedding cache instance."""
    global _embedding_cache
    if _embedding_cache is None:
        cache_dir = os.getenv("EMBEDDING_CACHE_DIR", "./cache/embeddings")
        ttl = int(os.getenv("EMBEDDING_CACHE_TTL", "604800"))  # 7 days default
        _embedding_cache = EmbeddingCache(cache_dir=cache_dir, ttl=ttl)
    return _embedding_cache


def get_chunk_cache() -> ChunkResultCache:
    """Get or create the global chunk result cache instance."""
    global _chunk_cache
    if _chunk_cache is None:
        cache_dir = os.getenv("CHUNK_CACHE_DIR", "./cache/chunks")
        ttl = int(os.getenv("CHUNK_CACHE_TTL", "86400"))  # 1 day default
        _chunk_cache = ChunkResultCache(cache_dir=cache_dir, ttl=ttl)
    return _chunk_cache


def get_parse_cache() -> ParseResultCache:
    """Get or create the global parse result cache instance."""
    global _parse_cache
    if _parse_cache is None:
        cache_dir = os.getenv("PARSE_CACHE_DIR", "./cache/parses")
        ttl = int(os.getenv("PARSE_CACHE_TTL", "604800"))  # 7 days default
        _parse_cache = ParseResultCache(cache_dir=cache_dir, ttl=ttl)
    return _parse_cache


@lru_cache(maxsize=100)
def cached_chunk(text_hash: str, strategy: str, config_json: str):
    """
    LRU cache decorator for chunking operations.

    This is an in-memory cache that complements the file-based cache.

    Args:
        text_hash: Hash of the input text
        strategy: Chunking strategy name
        config_json: JSON string of configuration

    Note: This is a placeholder - actual chunking happens elsewhere.
    This function is used with the @lru_cache decorator for in-memory caching.
    """
    pass


def cleanup_caches():
    """Clean up expired entries from all caches."""
    try:
        get_embedding_cache().clear_expired()
        get_chunk_cache().clear_expired()
        get_parse_cache().clear_expired()
        print("Cache cleanup completed")
    except Exception as e:
        print(f"Error during cache cleanup: {e}")
