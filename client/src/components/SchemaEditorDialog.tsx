import * as React from "react";
import { Plus, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FieldEditor } from "@/components/FieldEditor";
import { MentionAutocomplete } from "@/components/MentionAutocomplete";
import { useCreateSchema, useUpdateSchema } from "@/hooks/useSchemas";
import { useToast } from "@/hooks/use-toast";
import { createEmptyField, generateFieldId } from "@shared/metadata-schema";
import type { FieldDefinition, MetadataSchema, FieldType } from "@shared/metadata-schema";

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  string: "Text",
  numeric: "Number",
  array: "Array",
  json: "JSON",
};

function ReadOnlyField({ field }: { field: FieldDefinition }) {
  return (
    <div className="border rounded-lg p-3">
      <div className="flex items-center gap-2">
        <span className="font-medium">{field.label}</span>
        <Badge variant="secondary" className="text-[10px]">
          {FIELD_TYPE_LABELS[field.type] || field.type}
        </Badge>
        {field.required && (
          <Badge variant="destructive" className="text-[10px]">
            Required
          </Badge>
        )}
      </div>
      {field.description && (
        <p className="text-sm text-muted-foreground mt-1">{field.description}</p>
      )}
      <p className="text-xs text-muted-foreground mt-1 font-mono">
        Field name: {field.name}
      </p>
    </div>
  );
}

interface SchemaEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schema?: MetadataSchema | null;
  onSaved?: (schema: MetadataSchema) => void;
  readOnly?: boolean;
}

export function SchemaEditorDialog({
  open,
  onOpenChange,
  schema,
  onSaved,
  readOnly = false,
}: SchemaEditorDialogProps) {
  const { toast } = useToast();
  const createSchema = useCreateSchema();
  const updateSchema = useUpdateSchema();

  const isEditing = !!schema?.id;

  // Form state
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [documentFields, setDocumentFields] = React.useState<FieldDefinition[]>([]);
  const [chunkFields, setChunkFields] = React.useState<FieldDefinition[]>([]);
  const [chunkEnrichmentPrompt, setChunkEnrichmentPrompt] = React.useState("");
  const [activeTab, setActiveTab] = React.useState("document");
  const [newlyAddedFieldId, setNewlyAddedFieldId] = React.useState<string | null>(null);

  // Refs for scrolling
  const documentScrollRef = React.useRef<HTMLDivElement>(null);
  const chunkScrollRef = React.useRef<HTMLDivElement>(null);
  const promptTextareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Reset form when schema changes
  React.useEffect(() => {
    if (schema) {
      setName(schema.name);
      setDescription(schema.description || "");
      setDocumentFields(schema.documentFields || []);
      setChunkFields(schema.chunkFields || []);
      setChunkEnrichmentPrompt(schema.chunkEnrichmentPrompt || "");
    } else {
      setName("");
      setDescription("");
      setDocumentFields([]);
      setChunkFields([]);
      setChunkEnrichmentPrompt("");
    }
  }, [schema, open]);

  const handleAddField = (type: "document" | "chunk", fieldType: FieldType = "string") => {
    const newField: FieldDefinition = {
      ...createEmptyField(fieldType),
      id: generateFieldId(),
    };

    setNewlyAddedFieldId(newField.id);

    if (type === "document") {
      setDocumentFields([...documentFields, newField]);
      // Scroll to bottom after state update
      setTimeout(() => {
        documentScrollRef.current?.scrollTo({
          top: documentScrollRef.current.scrollHeight,
          behavior: "smooth",
        });
      }, 50);
    } else {
      setChunkFields([...chunkFields, newField]);
      setTimeout(() => {
        chunkScrollRef.current?.scrollTo({
          top: chunkScrollRef.current.scrollHeight,
          behavior: "smooth",
        });
      }, 50);
    }

    // Clear highlight after animation
    setTimeout(() => {
      setNewlyAddedFieldId(null);
    }, 2000);
  };

  const handleUpdateField = (
    type: "document" | "chunk",
    index: number,
    field: FieldDefinition
  ) => {
    if (type === "document") {
      const updated = [...documentFields];
      updated[index] = field;
      setDocumentFields(updated);
    } else {
      const updated = [...chunkFields];
      updated[index] = field;
      setChunkFields(updated);
    }
  };

  const handleDeleteField = (type: "document" | "chunk", index: number) => {
    if (type === "document") {
      setDocumentFields(documentFields.filter((_, i) => i !== index));
    } else {
      setChunkFields(chunkFields.filter((_, i) => i !== index));
    }
  };

  // Get available fields for mention autocomplete
  const availableFields = React.useMemo(() => {
    return chunkFields.filter((f) => !f.autoGenerated);
  }, [chunkFields]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast({
        title: "Validation Error",
        description: "Schema name is required",
        variant: "destructive",
      });
      return;
    }

    // Validate field names
    const allFields = [...documentFields, ...chunkFields];
    const invalidFields = allFields.filter(
      (f) => !f.name || !f.label || !/^[a-z][a-z0-9_]*$/.test(f.name)
    );

    if (invalidFields.length > 0) {
      toast({
        title: "Validation Error",
        description: "All fields must have a valid name and label",
        variant: "destructive",
      });
      return;
    }

    try {
      let savedSchema: MetadataSchema;

      if (isEditing && schema) {
        savedSchema = await updateSchema.mutateAsync({
          id: schema.id,
          data: {
            name: name.trim(),
            description: description.trim() || undefined,
            documentFields,
            chunkFields,
            chunkEnrichmentPrompt: chunkEnrichmentPrompt.trim() || null,
          },
        });
        toast({
          title: "Schema Updated",
          description: `"${name}" has been updated successfully`,
        });
      } else {
        savedSchema = await createSchema.mutateAsync({
          name: name.trim(),
          description: description.trim() || undefined,
          documentFields,
          chunkFields,
          chunkEnrichmentPrompt: chunkEnrichmentPrompt.trim() || null,
        });
        toast({
          title: "Schema Created",
          description: `"${name}" has been created successfully`,
        });
      }

      onSaved?.(savedSchema);
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save schema",
        variant: "destructive",
      });
    }
  };

  const isPending = createSchema.isPending || updateSchema.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[95vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {readOnly ? "View Schema" : isEditing ? "Edit Schema" : "Create New Schema"}
          </DialogTitle>
          <DialogDescription>
            {readOnly
              ? "Viewing schema details. Copy to your schemas to make changes."
              : "Define custom metadata fields for documents and chunks."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4 px-1">
          {/* Basic info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Schema"
                disabled={readOnly}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                disabled={readOnly}
              />
            </div>
          </div>

          {/* Fields tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="document">
                Document ({documentFields.length})
              </TabsTrigger>
              <TabsTrigger value="chunk">
                Chunk ({chunkFields.length})
              </TabsTrigger>
              <TabsTrigger value="enrichment" className="flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                AI
              </TabsTrigger>
            </TabsList>

            <TabsContent value="document" className="flex-1 overflow-hidden mt-4">
              <ScrollArea className="h-[400px] pl-1 pr-4" viewportRef={documentScrollRef}>
                <div className="space-y-3">
                  {documentFields.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
                      No document fields defined.
                      {!readOnly && (
                        <>
                          <br />
                          <Button
                            variant="ghost"
                            onClick={() => handleAddField("document")}
                            className="mt-2"
                          >
                            Add your first field
                          </Button>
                        </>
                      )}
                    </div>
                  ) : readOnly ? (
                    documentFields.map((field) => (
                      <ReadOnlyField key={field.id} field={field} />
                    ))
                  ) : (
                    documentFields.map((field, index) => (
                      <div
                        key={field.id}
                        className={
                          newlyAddedFieldId === field.id
                            ? "rounded-lg ring-2 ring-green-500 ring-offset-2 transition-all duration-300"
                            : ""
                        }
                      >
                        <FieldEditor
                          field={field}
                          onChange={(f) => handleUpdateField("document", index, f)}
                          onDelete={() => handleDeleteField("document", index)}
                        />
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
              {!readOnly && documentFields.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddField("document")}
                  className="w-full mt-3"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Document Field
                </Button>
              )}
            </TabsContent>

            <TabsContent value="chunk" className="flex-1 overflow-hidden mt-4">
              <ScrollArea className="h-[400px] pl-1 pr-4" viewportRef={chunkScrollRef}>
                <div className="space-y-3">
                  {chunkFields.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
                      No chunk fields defined.
                      {!readOnly && (
                        <>
                          <br />
                          <Button
                            variant="ghost"
                            onClick={() => handleAddField("chunk")}
                            className="mt-2"
                          >
                            Add your first field
                          </Button>
                        </>
                      )}
                    </div>
                  ) : readOnly ? (
                    chunkFields.map((field) => (
                      <ReadOnlyField key={field.id} field={field} />
                    ))
                  ) : (
                    chunkFields.map((field, index) => (
                      <div
                        key={field.id}
                        className={
                          newlyAddedFieldId === field.id
                            ? "rounded-lg ring-2 ring-green-500 ring-offset-2 transition-all duration-300"
                            : ""
                        }
                      >
                        <FieldEditor
                          field={field}
                          onChange={(f) => handleUpdateField("chunk", index, f)}
                          onDelete={() => handleDeleteField("chunk", index)}
                        />
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
              {!readOnly && chunkFields.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddField("chunk")}
                  className="w-full mt-3"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Chunk Field
                </Button>
              )}
            </TabsContent>

            <TabsContent value="enrichment" className="flex-1 overflow-hidden mt-4">
              <div className="space-y-4 px-1">
                <div className="rounded-lg border bg-muted/50 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="font-medium">AI Chunk Enrichment</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Define how AI should generate metadata for each chunk. Reference your chunk fields by name.
                    This prompt will guide the AI when you trigger metadata enrichment.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="enrichmentPrompt">Enrichment Prompt</Label>
                  <MentionAutocomplete
                    textareaRef={promptTextareaRef}
                    value={chunkEnrichmentPrompt}
                    onChange={setChunkEnrichmentPrompt}
                    availableFields={availableFields}
                    disabled={readOnly}
                    id="enrichmentPrompt"
                    placeholder="Example: Analyze each chunk and extract a concise summary for the {{summary}} field. Identify key topics as {{keywords}}. Determine the content category and assign appropriate {{tags}}. Type '@' to insert fields."
                    className="min-h-[200px] resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    Max 5,000 characters. {chunkEnrichmentPrompt.length > 0 && `(${chunkEnrichmentPrompt.length} / 5,000)`}
                    {availableFields.length > 0 && (
                      <span className="ml-2">Type '@' to insert fields</span>
                    )}
                  </p>
                </div>

                {chunkFields.filter(f => !f.autoGenerated).length > 0 && (
                  <div className="rounded-lg border p-3">
                    <p className="text-sm font-medium mb-2">
                      Click a field to insert it into your prompt:
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {chunkFields.filter(f => !f.autoGenerated).map((field) => (
                        <Badge
                          key={field.id}
                          variant="secondary"
                          className="text-xs cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                          onClick={() => {
                            if (!readOnly && promptTextareaRef.current) {
                              const fieldTemplate = `{{${field.name}}}`;
                              const textarea = promptTextareaRef.current;
                              const start = textarea.selectionStart;
                              const end = textarea.selectionEnd;
                              const newValue =
                                chunkEnrichmentPrompt.substring(0, start) +
                                fieldTemplate +
                                chunkEnrichmentPrompt.substring(end);
                              setChunkEnrichmentPrompt(newValue);
                              
                              setTimeout(() => {
                                textarea.focus();
                                const newCursorPos = start + fieldTemplate.length;
                                textarea.setSelectionRange(newCursorPos, newCursorPos);
                              }, 0);
                            }
                          }}
                        >
                          {field.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          {readOnly ? (
            <Button onClick={() => onOpenChange(false)}>
              Close
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isPending}>
                {isPending ? "Saving..." : isEditing ? "Update Schema" : "Create Schema"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
