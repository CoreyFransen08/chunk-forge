import * as React from "react";
import { GripVertical, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { FieldDefinition, FieldType } from "@shared/metadata-schema";

interface FieldEditorProps {
  field: FieldDefinition;
  onChange: (field: FieldDefinition) => void;
  onDelete: () => void;
  isDragging?: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}

const FIELD_TYPES: { value: FieldType; label: string; description: string }[] = [
  { value: "string", label: "Text", description: "Single or multi-line text" },
  { value: "numeric", label: "Number", description: "Integer or decimal" },
  { value: "array", label: "Array", description: "List of text values" },
  { value: "json", label: "JSON", description: "Key-value pairs" },
];

export function FieldEditor({
  field,
  onChange,
  onDelete,
  isDragging = false,
  dragHandleProps,
}: FieldEditorProps) {
  const [isOpen, setIsOpen] = React.useState(!field.name);

  const updateField = (updates: Partial<FieldDefinition>) => {
    onChange({ ...field, ...updates });
  };

  const updateValidation = (updates: Partial<FieldDefinition["validation"]>) => {
    onChange({
      ...field,
      validation: { ...field.validation, ...updates },
    });
  };

  // Generate name from label
  const handleLabelChange = (label: string) => {
    updateField({
      label,
      // Auto-generate name from label if name is empty or matches previous auto-generated name
      name: field.name === "" || field.name === labelToName(field.label)
        ? labelToName(label)
        : field.name,
    });
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div
        className={cn(
          "border rounded-lg p-3",
          isDragging && "opacity-50 border-dashed"
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-2">
          {dragHandleProps && (
            <div
              {...dragHandleProps}
              className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
            >
              <GripVertical className="h-4 w-4" />
            </div>
          )}

          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="flex-1 justify-start">
              <span className="font-medium truncate">
                {field.label || "Untitled Field"}
              </span>
              <Badge variant="secondary" className="ml-2 text-[10px]">
                {FIELD_TYPES.find((t) => t.value === field.type)?.label || field.type}
              </Badge>
              {field.required && (
                <Badge variant="destructive" className="ml-1 text-[10px]">
                  Required
                </Badge>
              )}
            </Button>
          </CollapsibleTrigger>

          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Expandable content */}
        <CollapsibleContent className="pt-4 space-y-4">
          {/* Basic fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Label</Label>
              <Input
                value={field.label}
                onChange={(e) => handleLabelChange(e.target.value)}
                placeholder="Field label"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Field Name</Label>
              <Input
                value={field.name}
                onChange={(e) => updateField({ name: e.target.value })}
                placeholder="field_name"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Used in exports. Lowercase, underscores only.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select
                value={field.type}
                onValueChange={(value: FieldType) => updateField({ type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div>
                        <span>{type.label}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {type.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input
                value={field.description || ""}
                onChange={(e) => updateField({ description: e.target.value })}
                placeholder="Help text for this field"
              />
            </div>
          </div>

          {/* Required checkbox */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id={`required-${field.id}`}
              checked={field.required}
              onCheckedChange={(checked) =>
                updateField({ required: checked === true })
              }
            />
            <Label htmlFor={`required-${field.id}`} className="text-sm">
              Required field
            </Label>
          </div>

          {/* Type-specific validation */}
          {field.type === "string" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Min Length</Label>
                <Input
                  type="number"
                  min={0}
                  value={field.validation?.minLength || ""}
                  onChange={(e) =>
                    updateValidation({
                      minLength: e.target.value ? parseInt(e.target.value) : undefined,
                    })
                  }
                  placeholder="No minimum"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Max Length</Label>
                <Input
                  type="number"
                  min={0}
                  value={field.validation?.maxLength || ""}
                  onChange={(e) =>
                    updateValidation({
                      maxLength: e.target.value ? parseInt(e.target.value) : undefined,
                    })
                  }
                  placeholder="No maximum"
                />
              </div>
            </div>
          )}

          {field.type === "numeric" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Min Value</Label>
                  <Input
                    type="number"
                    value={field.validation?.min ?? ""}
                    onChange={(e) =>
                      updateValidation({
                        min: e.target.value ? parseFloat(e.target.value) : undefined,
                      })
                    }
                    placeholder="No minimum"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Max Value</Label>
                  <Input
                    type="number"
                    value={field.validation?.max ?? ""}
                    onChange={(e) =>
                      updateValidation({
                        max: e.target.value ? parseFloat(e.target.value) : undefined,
                      })
                    }
                    placeholder="No maximum"
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id={`integer-${field.id}`}
                  checked={field.validation?.integer || false}
                  onCheckedChange={(checked) =>
                    updateValidation({ integer: checked === true })
                  }
                />
                <Label htmlFor={`integer-${field.id}`} className="text-sm">
                  Integer only (no decimals)
                </Label>
              </div>
            </div>
          )}

          {field.type === "array" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Min Items</Label>
                <Input
                  type="number"
                  min={0}
                  value={field.validation?.minItems || ""}
                  onChange={(e) =>
                    updateValidation({
                      minItems: e.target.value ? parseInt(e.target.value) : undefined,
                    })
                  }
                  placeholder="No minimum"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Max Items</Label>
                <Input
                  type="number"
                  min={0}
                  value={field.validation?.maxItems || ""}
                  onChange={(e) =>
                    updateValidation({
                      maxItems: e.target.value ? parseInt(e.target.value) : undefined,
                    })
                  }
                  placeholder="No maximum"
                />
              </div>
            </div>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

/**
 * Convert a label to a valid field name
 */
function labelToName(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "_")
    .replace(/^[^a-z]/, "")
    .substring(0, 50);
}
