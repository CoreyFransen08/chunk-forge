import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { FileText, Upload as UploadIcon, Calendar, FileStack, MoreVertical, Trash2, Plus, Pencil, Copy, ListTree } from 'lucide-react';
import type { Upload, ParserMethod } from '@shared/schema';
import type { MetadataSchema } from '@shared/metadata-schema';
import { formatDistanceToNow } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { UploadDialog } from '@/components/UploadDialog';
import { SchemaEditorDialog } from '@/components/SchemaEditorDialog';
import { useSchemas, useDeleteSchema, useDuplicateSchema } from '@/hooks/useSchemas';

export default function Dashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  // Schema state
  const [schemaEditorOpen, setSchemaEditorOpen] = useState(false);
  const [editingSchema, setEditingSchema] = useState<MetadataSchema | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [schemaToDelete, setSchemaToDelete] = useState<MetadataSchema | null>(null);

  // Uploads query
  const { data: uploads, isLoading } = useQuery<Upload[]>({
    queryKey: ['/api/uploads'],
  });

  // Schema queries
  const { data: schemas, isLoading: isLoadingSchemas } = useSchemas();
  const deleteSchema = useDeleteSchema();
  const duplicateSchema = useDuplicateSchema();

  const deleteMutation = useMutation({
    mutationFn: async (uploadId: string) => {
      await apiRequest('DELETE', `/api/uploads/${uploadId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/uploads'] });
      toast({
        title: 'Upload deleted',
        description: 'The upload has been removed.',
      });
    },
  });

  const handleUpload = async (file: File, schemaId: string, parserMethod: ParserMethod) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('schemaId', schemaId);
    formData.append('parserMethod', parserMethod);

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      toast({
        variant: 'destructive',
        title: 'Upload failed',
        description: error.error || 'Upload failed',
      });
      throw new Error(error.error || 'Upload failed');
    }

    const data = await response.json();
    queryClient.invalidateQueries({ queryKey: ['/api/uploads'] });

    toast({
      title: 'Upload successful',
      description: 'Your file has been processed.',
    });

    navigate(`/editor/${data.upload.id}`);
  };

  // Schema handlers
  const handleCreateSchema = () => {
    setEditingSchema(null);
    setSchemaEditorOpen(true);
  };

  const handleEditSchema = (schema: MetadataSchema) => {
    setEditingSchema(schema);
    setSchemaEditorOpen(true);
  };

  const handleDeleteSchemaClick = (schema: MetadataSchema) => {
    setSchemaToDelete(schema);
    setDeleteDialogOpen(true);
  };

  const handleDeleteSchemaConfirm = async () => {
    if (!schemaToDelete) return;

    try {
      await deleteSchema.mutateAsync(schemaToDelete.id);
      toast({
        title: 'Schema Deleted',
        description: `"${schemaToDelete.name}" has been deleted.`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete schema',
        variant: 'destructive',
      });
    } finally {
      setDeleteDialogOpen(false);
      setSchemaToDelete(null);
    }
  };

  const handleDuplicateSchema = async (schema: MetadataSchema) => {
    try {
      const duplicated = await duplicateSchema.mutateAsync({
        id: schema.id,
        name: `${schema.name} (Copy)`,
      });
      toast({
        title: 'Schema Duplicated',
        description: `Created "${duplicated.name}"`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to duplicate schema',
        variant: 'destructive',
      });
    }
  };

  const renderSchemaCard = (schema: MetadataSchema) => {
    const docFieldCount = schema.documentFields?.length || 0;
    const chunkFieldCount = schema.chunkFields?.length || 0;

    return (
      <Card key={schema.id} className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg">
                {schema.name}
              </CardTitle>
              {schema.description && (
                <CardDescription className="mt-1">
                  {schema.description}
                </CardDescription>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleEditSchema(schema)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleDuplicateSchema(schema)}>
                  <Copy className="h-4 w-4 mr-2" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => handleDeleteSchemaClick(schema)}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <FileText className="h-4 w-4" />
              <span>{docFieldCount} document fields</span>
            </div>
            <div className="flex items-center gap-1">
              <ListTree className="h-4 w-4" />
              <span>{chunkFieldCount} chunk fields</span>
            </div>
          </div>

          {/* Preview of field types */}
          <div className="flex flex-wrap gap-1 mt-3">
            {[...(schema.documentFields || []), ...(schema.chunkFields || [])]
              .slice(0, 5)
              .map((field) => (
                <Badge key={field.id} variant="outline" className="text-[10px]">
                  {field.label}
                </Badge>
              ))}
            {docFieldCount + chunkFieldCount > 5 && (
              <Badge variant="secondary" className="text-[10px]">
                +{docFieldCount + chunkFieldCount - 5} more
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderSchemaLoadingCards = () => (
    <>
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-48 mt-2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-4 w-full" />
          </CardContent>
        </Card>
      ))}
    </>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 border-b flex items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">ChunkForge</h1>
          <span className="text-sm text-muted-foreground ml-2">Open Source Document Chunking</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6">
        <Tabs defaultValue="uploads">
          <TabsList className="mb-6">
            <TabsTrigger value="uploads">Uploads</TabsTrigger>
            <TabsTrigger value="schemas">Schemas</TabsTrigger>
          </TabsList>

          {/* Uploads Tab */}
          <TabsContent value="uploads">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-semibold mb-1">Uploads</h2>
                <p className="text-sm text-muted-foreground">
                  Upload files to convert them to markdown and create semantic chunks
                </p>
              </div>
              <div>
                <Button
                  onClick={() => setUploadDialogOpen(true)}
                  data-testid="button-upload"
                >
                  <UploadIcon className="mr-2 h-4 w-4" />
                  New Upload
                </Button>
              </div>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <Card key={i} className="min-h-[120px]">
                    <CardContent className="p-6">
                      <Skeleton className="h-5 w-3/4 mb-2" />
                      <Skeleton className="h-4 w-1/2" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : uploads && uploads.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {uploads.map((upload) => (
                  <Card
                    key={upload.id}
                    className="min-h-[120px] hover-elevate transition-shadow duration-200 cursor-pointer group"
                    data-testid={`card-upload-${upload.id}`}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-3">
                        <FileStack className="h-5 w-5 text-primary flex-shrink-0" />
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                              data-testid={`button-menu-${upload.id}`}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => deleteMutation.mutate(upload.id)}
                              className="text-destructive"
                              data-testid={`button-delete-${upload.id}`}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div onClick={() => navigate(`/editor/${upload.id}`)}>
                        <h3 className="font-medium mb-2 line-clamp-2" data-testid={`text-title-${upload.id}`}>
                          {upload.title}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>{formatDistanceToNow(new Date(upload.createdAt), { addSuffix: true })}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="min-h-[400px] flex items-center justify-center">
                <CardContent className="text-center py-16">
                  <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No uploads yet</h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    Upload your first file to get started with ChunkForge
                  </p>
                  <Button onClick={() => setUploadDialogOpen(true)} data-testid="button-upload-empty">
                    <UploadIcon className="mr-2 h-4 w-4" />
                    Upload File
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Schemas Tab */}
          <TabsContent value="schemas">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-semibold mb-1">Metadata Schemas</h2>
                <p className="text-sm text-muted-foreground">
                  Create and manage custom metadata schemas for your documents and chunks
                </p>
              </div>
              <Button onClick={handleCreateSchema}>
                <Plus className="h-4 w-4 mr-2" />
                New Schema
              </Button>
            </div>

            {isLoadingSchemas ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {renderSchemaLoadingCards()}
              </div>
            ) : !schemas || schemas.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <ListTree className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No schemas yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Create your first schema to define custom metadata fields for
                    your documents and chunks.
                  </p>
                  <Button onClick={handleCreateSchema}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Schema
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {schemas.map((schema) => renderSchemaCard(schema))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      <UploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onUpload={handleUpload}
      />

      <SchemaEditorDialog
        open={schemaEditorOpen}
        onOpenChange={setSchemaEditorOpen}
        schema={editingSchema}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Schema</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{schemaToDelete?.name}"? This
              action cannot be undone. Documents using this schema will no longer
              have it assigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSchemaConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
