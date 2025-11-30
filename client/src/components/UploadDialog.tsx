import { useState, useRef, useCallback } from 'react';
import { Upload, FileText, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { SchemaSelector } from './SchemaSelector';
import { DEFAULT_SCHEMA_ID } from '@shared/constants';
import { cn } from '@/lib/utils';
import type { ParserMethod } from '@shared/schema';

// Supported file types per parser method
const SUPPORTED_FILE_TYPES: Record<ParserMethod, string[]> = {
  llamaparse: ['application/pdf'],
  markitdown: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'text/csv',
  ],
  docling: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'text/html',
    'image/png',
    'image/jpeg',
  ],
};

const SUPPORTED_EXTENSIONS: Record<ParserMethod, string> = {
  llamaparse: '.pdf',
  markitdown: '.pdf,.docx,.xlsx,.csv',
  docling: '.pdf,.docx,.pptx,.xlsx,.html,.png,.jpg,.jpeg',
};

const SUPPORTED_FORMATS_TEXT: Record<ParserMethod, string> = {
  llamaparse: 'PDF',
  markitdown: 'PDF, Word, Excel, CSV',
  docling: 'PDF, Word, PowerPoint, Excel, HTML, Images',
};

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: (file: File, schemaId: string, parserMethod: ParserMethod) => Promise<void>;
}

export function UploadDialog({ open, onOpenChange, onUpload }: UploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [schemaId, setSchemaId] = useState<string | null>(DEFAULT_SCHEMA_ID);
  const [parserMethod, setParserMethod] = useState<ParserMethod>('llamaparse');
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (selectedFile: File | null) => {
    if (selectedFile && SUPPORTED_FILE_TYPES[parserMethod].includes(selectedFile.type)) {
      setFile(selectedFile);
    }
  };

  const handleParserMethodChange = (method: ParserMethod) => {
    setParserMethod(method);
    // Clear file if current file is not supported by new parser
    if (file && !SUPPORTED_FILE_TYPES[method].includes(file.type)) {
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    handleFileSelect(selectedFile);
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    handleFileSelect(droppedFile);
  }, []);

  const handleUpload = async () => {
    if (!file || !schemaId) return;

    setUploading(true);
    try {
      await onUpload(file, schemaId, parserMethod);
      // Reset and close on success
      setFile(null);
      setSchemaId(DEFAULT_SCHEMA_ID);
      setParserMethod('llamaparse');
      onOpenChange(false);
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    if (!uploading) {
      setFile(null);
      setSchemaId(DEFAULT_SCHEMA_ID);
      setParserMethod('llamaparse');
      onOpenChange(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Upload File</DialogTitle>
          <DialogDescription>
            Upload a file and select a metadata schema to apply.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Parser Method Toggle */}
          <div className="space-y-3">
            <Label>Parser Method</Label>
            <RadioGroup
              value={parserMethod}
              onValueChange={(value) => handleParserMethodChange(value as ParserMethod)}
              className="grid gap-3"
            >
              <div className="flex items-start space-x-3">
                <RadioGroupItem value="llamaparse" id="llamaparse" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="llamaparse" className="font-medium cursor-pointer">
                    LlamaParse
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    High-quality PDF parsing (requires LlamaParse API key)
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <RadioGroupItem value="markitdown" id="markitdown" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="markitdown" className="font-medium cursor-pointer">
                    MarkItDown
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Free, supports multiple formats (PDF, Word, Excel, CSV)
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <RadioGroupItem value="docling" id="docling" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="docling" className="font-medium cursor-pointer">
                    Docling
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Free, AI-powered (PDF, Word, PowerPoint, Excel, HTML, Images)
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* File Drop Zone */}
          <div className="space-y-2">
            <Label>File</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept={SUPPORTED_EXTENSIONS[parserMethod]}
              onChange={handleInputChange}
              className="hidden"
              data-testid="input-file-upload"
            />
            {file ? (
              <div className="flex items-center gap-3 p-4 border rounded-lg bg-muted/50 w-full">
                <FileText className="h-8 w-8 text-primary flex-shrink-0" />
                <div className="flex-1 w-0">
                  <p className="font-medium truncate" title={file.name}>{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={clearFile}
                  disabled={uploading}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  "flex flex-col items-center justify-center gap-2 p-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors",
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
                )}
              >
                <Upload className="h-8 w-8 text-muted-foreground" />
                <div className="text-center">
                  <p className="font-medium">Drop your file here</p>
                  <p className="text-sm text-muted-foreground">
                    or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Supported: {SUPPORTED_FORMATS_TEXT[parserMethod]}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Schema Selector */}
          <div className="space-y-2">
            <Label>Metadata Schema <span className="text-destructive">*</span></Label>
            <SchemaSelector
              value={schemaId}
              onChange={setSchemaId}
              disabled={uploading}
            />
            <p className="text-xs text-muted-foreground">
              A schema is required. It defines which metadata fields will be available for this upload and its chunks.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={uploading}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={!file || !schemaId || uploading}>
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
