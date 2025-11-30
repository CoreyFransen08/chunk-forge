import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ExportFormat, Chunk, OverlapUnit } from '@shared/schema';
import { Download, FileJson, FileCode, FileSpreadsheet, FileText, Database, File, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chunks: Chunk[];
  uploadId?: string;
  originalFilename?: string;
  documentTitle?: string;
  hasMarkdown?: boolean;
}

export function ExportDialog({
  open,
  onOpenChange,
  chunks,
  uploadId,
  originalFilename,
  documentTitle,
  hasMarkdown = true
}: ExportDialogProps) {
  const { toast } = useToast();

  // Chunk export state
  const [format, setFormat] = useState<ExportFormat>('json');
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [overlap, setOverlap] = useState(0);
  const [overlapUnit, setOverlapUnit] = useState<OverlapUnit>('characters');
  const [idPrefix, setIdPrefix] = useState('');

  // Tab state
  const [activeTab, setActiveTab] = useState('chunks');

  // Loading state
  const [isDownloading, setIsDownloading] = useState(false);

  const formatIcons: Record<string, typeof FileJson> = {
    json: FileJson,
    jsonl: FileCode,
    csv: FileSpreadsheet,
    markdown: FileText,
    pinecone: Database,
    chroma: Database,
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const handleChunkExport = async () => {
    const response = await fetch('/api/export', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uploadId,
        chunks,
        format,
        includeMetadata,
        overlap,
        overlapUnit,
        idPrefix: idPrefix || undefined,
      }),
    });

    if (!response.ok) {
      throw new Error('Export failed');
    }

    const blob = await response.blob();
    const extension = format === 'jsonl' ? 'jsonl' : format === 'pinecone' || format === 'chroma' ? 'json' : format;
    const baseFilename = documentTitle
      ? documentTitle.replace(/[^a-z0-9]/gi, '_')
      : 'chunks-export';
    downloadBlob(blob, `${baseFilename}.${extension}`);

    toast({
      title: 'Export successful',
      description: `Downloaded ${chunks.length} chunks as ${format.toUpperCase()}`,
    });
  };

  const handleMarkdownDownload = async () => {
    if (!uploadId) {
      throw new Error('No upload ID available');
    }

    const response = await fetch(`/api/export/markdown/${uploadId}`);

    if (!response.ok) {
      throw new Error('Download failed');
    }

    const blob = await response.blob();
    const filename = documentTitle
      ? `${documentTitle.replace(/[^a-z0-9]/gi, '_')}.md`
      : 'document.md';
    downloadBlob(blob, filename);

    toast({
      title: 'Download successful',
      description: 'Markdown file downloaded',
    });
  };

  const handleOriginalDownload = async () => {
    if (!uploadId) {
      throw new Error('No upload ID available');
    }

    const response = await fetch(`/api/export/original/${uploadId}`);

    if (!response.ok) {
      throw new Error('Download failed');
    }

    const blob = await response.blob();
    downloadBlob(blob, originalFilename || 'document');

    toast({
      title: 'Download successful',
      description: 'Original file downloaded',
    });
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      if (activeTab === 'chunks') {
        await handleChunkExport();
      } else if (activeTab === 'markdown') {
        await handleMarkdownDownload();
      } else if (activeTab === 'original') {
        await handleOriginalDownload();
      }
      onOpenChange(false);
    } catch {
      toast({
        variant: 'destructive',
        title: 'Download failed',
        description: 'Failed to download file. Please try again.',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Export</DialogTitle>
          <DialogDescription>
            Download chunks, markdown, or original file
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="chunks" data-testid="tab-chunks">
              <Database className="h-4 w-4 mr-2" />
              Chunks
            </TabsTrigger>
            <TabsTrigger value="markdown" disabled={!hasMarkdown || !uploadId} data-testid="tab-markdown">
              <FileText className="h-4 w-4 mr-2" />
              Markdown
            </TabsTrigger>
            <TabsTrigger value="original" disabled={!uploadId} data-testid="tab-original">
              <File className="h-4 w-4 mr-2" />
              Original
            </TabsTrigger>
          </TabsList>

          {/* Chunks Tab */}
          <TabsContent value="chunks" className="space-y-4 py-4">
            {/* Format selection */}
            <div className="space-y-3">
              <Label>Export Format</Label>
              <RadioGroup value={format} onValueChange={(value) => setFormat(value as ExportFormat)}>
                {/* Standard formats */}
                <div className="grid grid-cols-2 gap-2">
                  {(['json', 'jsonl', 'csv', 'markdown'] as ExportFormat[]).map((fmt) => {
                    const Icon = formatIcons[fmt];
                    return (
                      <div key={fmt} className="flex items-center space-x-2">
                        <RadioGroupItem value={fmt} id={fmt} data-testid={`radio-format-${fmt}`} />
                        <Label htmlFor={fmt} className="flex items-center gap-2 cursor-pointer font-normal">
                          <Icon className="h-4 w-4" />
                          {fmt.toUpperCase()}
                        </Label>
                      </div>
                    );
                  })}
                </div>

                {/* Vector DB presets */}
                <div className="pt-3 border-t mt-3">
                  <Label className="text-xs text-muted-foreground mb-2 block">Vector DB Presets</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['pinecone', 'chroma'] as ExportFormat[]).map((fmt) => {
                      const Icon = formatIcons[fmt];
                      return (
                        <div key={fmt} className="flex items-center space-x-2">
                          <RadioGroupItem value={fmt} id={fmt} data-testid={`radio-format-${fmt}`} />
                          <Label htmlFor={fmt} className="flex items-center gap-2 cursor-pointer font-normal">
                            <Icon className="h-4 w-4" />
                            {fmt.charAt(0).toUpperCase() + fmt.slice(1)}
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </RadioGroup>
            </div>

            {/* ID Prefix */}
            <div className="space-y-2">
              <Label htmlFor="id-prefix">ID Prefix (optional)</Label>
              <Input
                id="id-prefix"
                placeholder="e.g., doc1-"
                value={idPrefix}
                onChange={(e) => setIdPrefix(e.target.value)}
                data-testid="input-id-prefix"
              />
              <p className="text-xs text-muted-foreground">
                Prepends prefix to all chunk IDs: "{idPrefix || 'doc1-'}chunk-0"
              </p>
            </div>

            {/* Include Metadata toggle */}
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="metadata-toggle">Include Metadata</Label>
                <p className="text-xs text-muted-foreground">
                  Include title, author, tags, keywords in export
                </p>
              </div>
              <Switch
                id="metadata-toggle"
                checked={includeMetadata}
                onCheckedChange={setIncludeMetadata}
                data-testid="switch-metadata"
              />
            </div>

            {/* Overlap Configuration */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Chunk Overlap</Label>
                <Select value={overlapUnit} onValueChange={(v) => setOverlapUnit(v as OverlapUnit)}>
                  <SelectTrigger className="w-32" data-testid="select-overlap-unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="characters">Characters</SelectItem>
                    <SelectItem value="tokens">Tokens</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Input
                type="number"
                min="0"
                max={overlapUnit === 'tokens' ? 200 : 500}
                value={overlap}
                onChange={(e) => setOverlap(parseInt(e.target.value) || 0)}
                data-testid="input-overlap"
              />
              <p className="text-xs text-muted-foreground">
                Add overlapping content from next chunk ({overlapUnit})
              </p>
            </div>

            {/* Export Summary */}
            <div className="p-3 bg-muted rounded-md">
              <div className="text-sm font-medium mb-1">Export Summary</div>
              <div className="text-xs text-muted-foreground space-y-1">
                <div>Format: {format.toUpperCase()}</div>
                <div>Chunks: {chunks.length}</div>
                <div>ID Prefix: {idPrefix || '(none)'}</div>
                <div>Metadata: {includeMetadata ? 'Included' : 'Excluded'}</div>
                <div>Overlap: {overlap} {overlapUnit}</div>
              </div>
            </div>
          </TabsContent>

          {/* Markdown Tab */}
          <TabsContent value="markdown" className="py-4">
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm font-medium mb-2">Download Parsed Markdown</p>
              <p className="text-xs text-muted-foreground">
                Download the markdown content generated from your uploaded document
              </p>
            </div>
          </TabsContent>

          {/* Original File Tab */}
          <TabsContent value="original" className="py-4">
            <div className="text-center py-8">
              <File className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm font-medium mb-2">Download Original File</p>
              <p className="text-xs text-muted-foreground mb-4">
                Download the original uploaded document
              </p>
              {originalFilename && (
                <p className="text-xs font-mono bg-muted px-3 py-1.5 rounded inline-block">
                  {originalFilename}
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-export">
            Cancel
          </Button>
          <Button onClick={handleDownload} disabled={isDownloading} data-testid="button-download">
            {isDownloading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
