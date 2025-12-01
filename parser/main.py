from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import tempfile
import os
import json
import traceback
from typing import List, Optional
from dotenv import load_dotenv

# Import parsing modules (chunking moved to Node.js/Mastra)
from metadata import calculate_token_count
from llama_parser import parse_pdf, ParseConfig, DEFAULT_PARSE_CONFIG, ParseResult
from markitdown_parser import parse_with_markitdown
from docling_parser import parse_with_docling

# Load environment variables
load_dotenv()

app = FastAPI()

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request/Response Models
class ParseResponse(BaseModel):
    markdown: str
    pageCount: int = 0

class TokenCalculationRequest(BaseModel):
    """Request model for token calculation."""
    texts: List[str] = Field(..., description="List of text strings to calculate tokens for")
    model: str = Field(default="gpt-4", description="Model to use for token encoding")

class TokenCalculationResponse(BaseModel):
    """Response model for token calculation."""
    token_counts: List[int]
    char_counts: List[int]

@app.get("/")
async def root():
    return {"status": "ok", "service": "ChunkForge Parser"}

@app.post("/parse-pdf", response_model=ParseResponse)
async def parse_pdf_endpoint(
    file: UploadFile = File(...),
    config: Optional[str] = Form(None)  # JSON string for config
):
    """
    Parse PDF to Markdown using LlamaParse with optional configuration.

    The config parameter accepts a JSON string with parsing options.
    If not provided, uses system defaults.
    """
    try:
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_file_path = tmp_file.name

        try:
            # Parse config if provided
            parse_config = None
            if config:
                try:
                    parse_config = json.loads(config)
                except json.JSONDecodeError:
                    print(f"Invalid config JSON, using defaults: {config}")

            # Parse PDF using the new module (returns ParseResult with markdown and page_count)
            parse_result = parse_pdf(tmp_file_path, parse_config)

        finally:
            # Clean up temp file
            if os.path.exists(tmp_file_path):
                os.unlink(tmp_file_path)

        return ParseResponse(markdown=parse_result.markdown, pageCount=parse_result.page_count)

    except Exception as e:
        # Log full traceback for debugging
        print(f"Error parsing PDF: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to parse PDF: {str(e)}")


@app.post("/parse", response_model=ParseResponse)
async def parse_document(
    file: UploadFile = File(...),
    config: Optional[str] = Form(None),  # JSON string for config (LlamaParse only)
    parser_method: str = Form("llamaparse")  # "llamaparse", "markitdown", or "docling"
):
    """
    Parse document to Markdown using specified parser method.

    Supports three parser methods:
    - llamaparse: High-quality PDF parsing using LlamaParse API (PDF only, 1 credit)
    - markitdown: Microsoft MarkItDown for multiple formats (PDF, DOCX, XLSX, CSV, free)
    - docling: IBM Docling for AI-powered document understanding (PDF, DOCX, PPTX, XLSX, HTML, images, free)

    Args:
        file: The document file to parse
        config: Optional JSON string for LlamaParse configuration
        parser_method: Parser to use - "llamaparse" (default), "markitdown", or "docling"
    """
    try:
        # Determine file extension
        filename = file.filename or "document"
        file_ext = os.path.splitext(filename)[1].lower()

        # Validate parser method and file type
        if parser_method == "llamaparse" and file_ext != ".pdf":
            raise HTTPException(
                status_code=400,
                detail="LlamaParse only supports PDF files. Use 'markitdown' for other formats."
            )

        # Save uploaded file temporarily with correct extension
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_file_path = tmp_file.name

        try:
            if parser_method == "docling":
                # Parse with Docling (supports PDF, DOCX, PPTX, XLSX, HTML, images)
                parse_result = parse_with_docling(tmp_file_path)
                print(f"Successfully parsed with Docling: {filename}")
            elif parser_method == "markitdown":
                # Parse with MarkItDown (supports multiple formats)
                parse_result = parse_with_markitdown(tmp_file_path)
                print(f"Successfully parsed with MarkItDown: {filename}")
            else:
                # Parse with LlamaParse (PDF only)
                parse_config = None
                if config:
                    try:
                        parse_config = json.loads(config)
                    except json.JSONDecodeError:
                        print(f"Invalid config JSON, using defaults: {config}")

                parse_result = parse_pdf(tmp_file_path, parse_config)

        finally:
            # Clean up temp file
            if os.path.exists(tmp_file_path):
                os.unlink(tmp_file_path)

        return ParseResponse(markdown=parse_result.markdown, pageCount=parse_result.page_count)

    except HTTPException:
        raise
    except Exception as e:
        # Log full traceback for debugging
        print(f"Error parsing document: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to parse document: {str(e)}")


@app.post("/calculate-tokens", response_model=TokenCalculationResponse)
async def calculate_tokens(request: TokenCalculationRequest):
    """
    Calculate token counts for a list of text strings.

    Used to recalculate token counts after chunk editing (resize, split, etc.)
    """
    try:
        token_counts = []
        char_counts = []

        for text in request.texts:
            token_counts.append(calculate_token_count(text, request.model))
            char_counts.append(len(text))

        return TokenCalculationResponse(
            token_counts=token_counts,
            char_counts=char_counts
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Token calculation failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
