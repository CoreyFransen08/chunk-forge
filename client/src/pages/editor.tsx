import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ChunkCard } from '@/components/ChunkCard';
import { ChunkingPanel } from '@/components/ChunkingPanel';
import { MetadataPanel } from '@/components/MetadataPanel';
import { ExportDialog } from '@/components/ExportDialog';
import { OverlayContainer } from '@/components/OverlayContainer';
import { ViewModeToggle } from '@/components/ViewModeToggle';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Upload, Chunk, ChunkStrategy, ChunkMetadata, ChunkingConfig, supportsOverlayMode, DocumentMetadata, CustomFields } from '@shared/schema';
import { useSchema, useApplySchemaToDocument } from '@/hooks/useSchemas';
import { FileText, ArrowLeft, Download, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { formatDistanceToNow } from 'date-fns';

export default function Editor() {
  const { id: uploadId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [selectedChunkId, setSelectedChunkId] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<ChunkStrategy>('paragraph');
  const [config, setConfig] = useState<ChunkingConfig>({
    chunk_size: 1000,
    heading_levels: [1, 2, 3],
    sentences_per_chunk: 5,
  });
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [showRawMarkdown, setShowRawMarkdown] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  // Document metadata state
  const [documentMetadata, setDocumentMetadata] = useState<DocumentMetadata>({ custom: {} });
  const [documentTitle, setDocumentTitle] = useState('');
  const [hasUnsavedDocumentChanges, setHasUnsavedDocumentChanges] = useState(false);

  // Schema and custom metadata state
  const [schemaId, setSchemaId] = useState<string | null>(null);
  const [customMetadata, setCustomMetadata] = useState<CustomFields>({});

  // Fetch schema when document has one
  const { data: schema } = useSchema(schemaId);
  const applySchema = useApplySchemaToDocument();

  // View mode state (card vs overlay)
  const [viewMode, setViewMode] = useState<'card' | 'overlay'>('card');

  // Check if all chunks support overlay mode
  const supportsOverlay = useMemo(
    () => chunks.length > 0 && chunks.every(supportsOverlayMode),
    [chunks]
  );

  // Auto-switch to card mode if chunks don't support overlay
  useEffect(() => {
    if (viewMode === 'overlay' && !supportsOverlay && chunks.length > 0) {
      setViewMode('card');
      toast({
        title: 'Switched to card view',
        description: 'Overlay view requires chunks with character offsets. Regenerate chunks to enable overlay mode.',
      });
    }
  }, [viewMode, supportsOverlay, chunks.length, toast]);

  const { data: upload, isLoading } = useQuery<Upload>({
    queryKey: ['/api/uploads', uploadId],
    enabled: !!uploadId,
  });

  // Load existing chunks from database
  const { data: existingChunks, isLoading: isLoadingChunks } = useQuery<{ chunks: Chunk[] }>({
    queryKey: ['/api/uploads', uploadId, 'chunks'],
    enabled: !!uploadId,
    staleTime: 30 * 60 * 1000, // 30 minutes
  });

  // Initialize chunks from database on load
  useEffect(() => {
    if (existingChunks?.chunks && existingChunks.chunks.length > 0) {
      setChunks(existingChunks.chunks);
      if (existingChunks.chunks.length > 0) {
        setSelectedChunkId(existingChunks.chunks[0].id);
      }
    }
  }, [existingChunks]);

  // Initialize upload metadata from loaded upload
  useEffect(() => {
    if (upload) {
      setDocumentTitle(upload.title);
      setDocumentMetadata(upload.metadata || {});
      setSchemaId(upload.schemaId || null);
      setCustomMetadata(upload.customMetadata || {});
    }
  }, [upload]);

  // Keyboard shortcut for save (Cmd+S / Ctrl+S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if ((hasUnsavedChanges || hasUnsavedDocumentChanges) && !isSaving) {
          saveChunks();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasUnsavedChanges, hasUnsavedDocumentChanges, isSaving, chunks, uploadId, strategy, documentMetadata, documentTitle]);

  // Beforeunload warning for unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges || hasUnsavedDocumentChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges, hasUnsavedDocumentChanges]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Save upload metadata to database
  const saveDocumentMetadata = async () => {
    if (!uploadId) return;

    try {
      const response = await apiRequest('PATCH', `/api/uploads/${uploadId}`, {
        title: documentTitle,
        metadata: documentMetadata,
        schemaId: schemaId,
        customMetadata: customMetadata,
      });

      if (response.ok) {
        setHasUnsavedDocumentChanges(false);
        queryClient.invalidateQueries({ queryKey: ['/api/uploads', uploadId] });
        return true;
      } else {
        throw new Error('Save failed');
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Save failed', description: 'Failed to save upload metadata. Please try again.' });
      return false;
    }
  };

  // Save chunks to database
  const saveChunks = async () => {
    if (!uploadId) return;

    setIsSaving(true);
    try {
      // Save document metadata if changed
      if (hasUnsavedDocumentChanges) {
        await saveDocumentMetadata();
      }

      // Save chunks if changed
      if (hasUnsavedChanges) {
        const response = await apiRequest('POST', `/api/uploads/${uploadId}/chunks`, {
          chunks,
          strategy,
        });

        if (response.ok) {
          setHasUnsavedChanges(false);
          setLastSavedAt(new Date());
          queryClient.invalidateQueries({ queryKey: ['/api/uploads', uploadId, 'chunks'] });
          toast({ title: 'Saved', description: `Saved ${chunks.length} chunks` });
        } else {
          throw new Error('Save failed');
        }
      } else if (hasUnsavedDocumentChanges) {
        // Only document metadata was changed
        setLastSavedAt(new Date());
        toast({ title: 'Saved', description: 'Document metadata saved' });
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Save failed', description: 'Failed to save. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  // Perform chunk generation (extracted for reuse)
  const performGeneration = async () => {
    if (!upload?.markdown) return;

    setProcessing(true);
    try {
      const response = await apiRequest('POST', '/api/chunk', {
        markdown: upload.markdown,
        strategy,
        config,
        documentId: uploadId, // API still expects documentId for backward compatibility
        autoSave: true,
      });

      if (!response.ok) throw new Error('Chunking failed');

      const data = await response.json();
      setChunks(data.chunks);
      if (data.chunks.length > 0) {
        setSelectedChunkId(data.chunks[0].id);
      }

      if (data.saved) {
        setHasUnsavedChanges(false);
        setLastSavedAt(new Date());
        queryClient.invalidateQueries({ queryKey: ['/api/uploads', uploadId, 'chunks'] });
      }

      const strategyNames: Record<ChunkStrategy, string> = {
        recursive: 'Smart Fixed Size',
        paragraph: 'Paragraph',
        by_heading: 'By Heading',
        semantic: 'Semantic',
        sentence: 'Sentence',
        token: 'Token-Based',
        hierarchical: 'Hierarchical',
        // Native Mastra strategies
        character: 'Character',
        html: 'HTML',
        json: 'JSON',
        latex: 'LaTeX',
        markdown: 'Markdown',
        'semantic-markdown': 'Semantic Markdown',
      };

      toast({
        title: 'Chunks generated',
        description: `Created ${data.chunks.length} chunks using ${strategyNames[strategy]} strategy`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Chunking failed',
        description: 'Failed to generate chunks. Please try again.',
      });
    } finally {
      setProcessing(false);
    }
  };

  // Generate chunks with confirmation if existing chunks exist
  const generateChunks = async () => {
    if (!upload?.markdown) return;

    // Check for existing chunks
    const hasExisting = chunks.length > 0 || (existingChunks?.chunks?.length ?? 0) > 0;

    if (hasExisting) {
      setConfirmDialogOpen(true);
      return;
    }

    await performGeneration();
  };


  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setChunks((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);
        return newItems.map((item, index) => ({ ...item, order: index }));
      });
      setHasUnsavedChanges(true);
    }
  };

  const handleDeleteChunk = (chunkId: string) => {
    setChunks((prev) => prev.filter((c) => c.id !== chunkId));
    if (selectedChunkId === chunkId) {
      setSelectedChunkId(chunks[0]?.id || null);
    }
    setHasUnsavedChanges(true);
    toast({
      title: 'Chunk deleted',
      description: 'The chunk has been removed.',
    });
  };

  const handleMetadataChange = (metadata: ChunkMetadata) => {
    if (!selectedChunkId) return;

    setChunks((prev) =>
      prev.map((chunk) =>
        chunk.id === selectedChunkId ? { ...chunk, metadata } : chunk
      )
    );
    setHasUnsavedChanges(true);
  };

  const handleChunkUpdate = (updatedChunk: Chunk) => {
    setChunks((prev) =>
      prev.map((chunk) => (chunk.id === updatedChunk.id ? updatedChunk : chunk))
    );
    setHasUnsavedChanges(true);
  };

  const handleChunkSplit = (chunkId: string, splitOffset: number) => {
    const chunk = chunks.find((c) => c.id === chunkId);
    if (!chunk || !supportsOverlayMode(chunk) || !upload?.markdown) return;

    // Create two new chunks
    const chunk1: Chunk = {
      ...chunk,
      id: crypto.randomUUID(),
      startOffset: chunk.startOffset,
      endOffset: splitOffset,
      text: upload.markdown.slice(chunk.startOffset!, splitOffset),
      order: chunk.order,
      metadata: { ...chunk.metadata },
    };

    const chunk2: Chunk = {
      ...chunk,
      id: crypto.randomUUID(),
      startOffset: splitOffset,
      endOffset: chunk.endOffset,
      text: upload.markdown.slice(splitOffset, chunk.endOffset!),
      order: chunk.order + 0.5, // Insert between existing orders
      metadata: { ...chunk.metadata },
    };

    // Replace original chunk with two new chunks
    setChunks((prev) =>
      prev
        .filter((c) => c.id !== chunkId)
        .concat([chunk1, chunk2])
        .sort((a, b) => (a.startOffset || 0) - (b.startOffset || 0))
        .map((c, index) => ({ ...c, order: index })) // Renumber orders
    );

    setHasUnsavedChanges(true);
    setSelectedChunkId(chunk1.id);

    toast({
      title: 'Chunk split',
      description: 'Split into 2 chunks at cursor position',
    });
  };

  // Document metadata handlers
  const handleDocumentMetadataChange = (metadata: DocumentMetadata) => {
    setDocumentMetadata(metadata);
    setHasUnsavedDocumentChanges(true);
  };

  const handleDocumentTitleChange = (title: string) => {
    setDocumentTitle(title);
    setHasUnsavedDocumentChanges(true);
  };

  // Schema and custom metadata handlers
  const handleSchemaChange = async (newSchemaId: string | null) => {
    setSchemaId(newSchemaId);
    setHasUnsavedDocumentChanges(true);

    // If applying a schema, also apply it via API for proper handling
    if (newSchemaId && uploadId) {
      try {
        await applySchema.mutateAsync({ uploadId, schemaId: newSchemaId });
        queryClient.invalidateQueries({ queryKey: ['/api/uploads', uploadId] });
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Failed to apply schema',
          description: 'Schema was selected but failed to save.',
        });
      }
    }
  };

  const handleCustomMetadataChange = (metadata: CustomFields) => {
    setCustomMetadata(metadata);
    setHasUnsavedDocumentChanges(true);
  };

  const selectedChunk = chunks.find((c) => c.id === selectedChunkId);

  if (isLoading) {
    return (
      <div className="h-screen flex">
        <div className="flex-1 p-6">
          <Skeleton className="h-8 w-64 mb-4" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!upload) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Upload not found</h2>
          <Button onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <header className="h-14 border-b flex items-center justify-between px-6 flex-shrink-0">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/dashboard')}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">{upload.title}</h1>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            {chunks.length} chunks
          </span>

          {/* Save status indicator */}
          {lastSavedAt && !hasUnsavedChanges && (
            <span className="text-xs text-muted-foreground">
              Saved {formatDistanceToNow(lastSavedAt, { addSuffix: true })}
            </span>
          )}

          {(hasUnsavedChanges || hasUnsavedDocumentChanges) && (
            <span className="text-xs text-amber-600">Unsaved changes</span>
          )}

          {/* Save button */}
          <Button
            onClick={saveChunks}
            disabled={!(hasUnsavedChanges || hasUnsavedDocumentChanges) || isSaving}
            variant={(hasUnsavedChanges || hasUnsavedDocumentChanges) ? 'default' : 'outline'}
            data-testid="button-save"
          >
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSaving ? 'Saving...' : 'Save'}
          </Button>

          <Button
            onClick={() => setExportDialogOpen(true)}
            disabled={chunks.length === 0}
            data-testid="button-export"
          >
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <ChunkingPanel
          strategy={strategy}
          onStrategyChange={setStrategy}
          config={config}
          onConfigChange={setConfig}
          onGenerateChunks={generateChunks}
          processing={processing}
          chunksExist={chunks.length > 0}
        />

        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto">
            {chunks.length === 0 ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Document Preview</h3>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="raw-toggle" className="text-sm">Raw Markdown</Label>
                      <Switch
                        id="raw-toggle"
                        checked={showRawMarkdown}
                        onCheckedChange={setShowRawMarkdown}
                      />
                    </div>
                    <span className="text-sm text-muted-foreground">
                      Select a chunking strategy and click "Generate Chunks"
                    </span>
                  </div>
                </div>
                <div className="border rounded-lg p-6 bg-card">
                  {showRawMarkdown ? (
                    <pre className="whitespace-pre-wrap text-sm font-mono text-muted-foreground overflow-auto">
                      {upload?.markdown || ''}
                    </pre>
                  ) : (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {upload?.markdown || ''}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* View mode controls - sticky header */}
                <div className="sticky top-0 z-10 flex items-center justify-between bg-background py-2 -mx-6 px-6 border-b">
                  <ViewModeToggle
                    mode={viewMode}
                    onModeChange={setViewMode}
                    disabled={!supportsOverlay}
                  />
                </div>

                {/* Conditional rendering based on view mode */}
                {viewMode === 'card' ? (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={chunks.map((c) => c.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-4">
                        {chunks.map((chunk) => (
                          <ChunkCard
                            key={chunk.id}
                            chunk={chunk}
                            onDelete={() => handleDeleteChunk(chunk.id)}
                            onSelect={() => setSelectedChunkId(chunk.id)}
                            isSelected={selectedChunkId === chunk.id}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                ) : (
                  <OverlayContainer
                    markdown={upload?.markdown || ''}
                    chunks={chunks}
                    selectedChunkId={selectedChunkId}
                    onChunkSelect={setSelectedChunkId}
                    onChunkDelete={handleDeleteChunk}
                    onChunkUpdate={handleChunkUpdate}
                    onChunkSplit={handleChunkSplit}
                  />
                )}
              </div>
            )}
          </div>
        </main>

        <MetadataPanel
          uploadId={uploadId || ''}
          chunkMetadata={selectedChunk?.metadata || null}
          onChunkMetadataChange={handleMetadataChange}
          selectedChunkId={selectedChunkId}
          documentMetadata={documentMetadata}
          onDocumentMetadataChange={handleDocumentMetadataChange}
          documentTitle={documentTitle}
          onDocumentTitleChange={handleDocumentTitleChange}
          schema={schema || null}
          onSchemaChange={handleSchemaChange}
        />
      </div>

      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        chunks={chunks}
        uploadId={uploadId}
        originalFilename={upload?.originalFilename}
        documentTitle={upload?.title}
      />

      {/* Confirmation dialog for regenerating chunks */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate Chunks?</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace {chunks.length || existingChunks?.chunks?.length || 0} existing chunks.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setConfirmDialogOpen(false);
              performGeneration();
            }}>
              Regenerate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
