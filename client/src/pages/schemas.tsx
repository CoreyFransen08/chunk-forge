import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SchemaEditorDialog } from "@/components/SchemaEditorDialog";
import { useSchemas, useDeleteSchema, useDuplicateSchema } from "@/hooks/useSchemas";
import { useToast } from "@/hooks/use-toast";
import { Plus, MoreVertical, Pencil, Trash2, Copy, FileText, ListTree, ArrowLeft } from "lucide-react";
import type { MetadataSchema } from "@shared/metadata-schema";

export default function SchemasPage() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: schemas, isLoading } = useSchemas();

  const deleteSchema = useDeleteSchema();
  const duplicateSchema = useDuplicateSchema();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingSchema, setEditingSchema] = useState<MetadataSchema | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [schemaToDelete, setSchemaToDelete] = useState<MetadataSchema | null>(null);

  const handleCreate = () => {
    setEditingSchema(null);
    setEditorOpen(true);
  };

  const handleEdit = (schema: MetadataSchema) => {
    setEditingSchema(schema);
    setEditorOpen(true);
  };

  const handleDeleteClick = (schema: MetadataSchema) => {
    setSchemaToDelete(schema);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!schemaToDelete) return;

    try {
      await deleteSchema.mutateAsync(schemaToDelete.id);
      toast({
        title: "Schema Deleted",
        description: `"${schemaToDelete.name}" has been deleted.`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete schema",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setSchemaToDelete(null);
    }
  };

  const handleDuplicate = async (schema: MetadataSchema) => {
    try {
      const duplicated = await duplicateSchema.mutateAsync({
        id: schema.id,
        name: `${schema.name} (Copy)`,
      });
      toast({
        title: "Schema Duplicated",
        description: `Created "${duplicated.name}"`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to duplicate schema",
        variant: "destructive",
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
                <DropdownMenuItem onClick={() => handleEdit(schema)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleDuplicate(schema)}>
                  <Copy className="h-4 w-4 mr-2" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => handleDeleteClick(schema)}
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

  const renderLoadingCards = () => (
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
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-xl font-semibold">Metadata Schemas</h1>
                <p className="text-sm text-muted-foreground">
                  Create and manage custom metadata schemas
                </p>
              </div>
            </div>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              New Schema
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {renderLoadingCards()}
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
              <Button onClick={handleCreate}>
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
      </main>

      {/* Schema Editor Dialog */}
      <SchemaEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        schema={editingSchema}
      />

      {/* Delete Confirmation Dialog */}
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
              onClick={handleDeleteConfirm}
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
