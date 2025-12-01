import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { TagsInput } from "@/components/TagsInput";
import { JsonKeyValueEditor } from "@/components/JsonKeyValueEditor";
import { cn } from "@/lib/utils";
import type { FieldDefinition, CustomFieldValue } from "@shared/metadata-schema";

interface DynamicFieldProps {
  field: FieldDefinition;
  value: CustomFieldValue | undefined;
  onChange: (value: CustomFieldValue) => void;
  error?: string;
  disabled?: boolean;
  showTypeBadge?: boolean;
}

export function DynamicField({
  field,
  value,
  onChange,
  error,
  disabled = false,
  showTypeBadge = true,
}: DynamicFieldProps) {
  const renderInput = () => {
    switch (field.type) {
      case "string":
        // Use textarea for fields with maxLength > 100 or description hint
        const isLongText =
          (field.validation?.maxLength && field.validation.maxLength > 100) ||
          field.description?.toLowerCase().includes("description") ||
          field.description?.toLowerCase().includes("notes");

        if (isLongText) {
          return (
            <Textarea
              value={(value as string) ?? ""}
              onChange={(e) => onChange(e.target.value)}
              placeholder={field.description || `Enter ${field.label.toLowerCase()}`}
              disabled={disabled}
              className={cn(error && "border-destructive")}
              rows={3}
            />
          );
        }

        return (
          <Input
            type="text"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.description || `Enter ${field.label.toLowerCase()}`}
            disabled={disabled}
            className={cn(error && "border-destructive")}
            minLength={field.validation?.minLength}
            maxLength={field.validation?.maxLength}
          />
        );

      case "numeric":
        return (
          <Input
            type="number"
            value={(value as number) ?? ""}
            onChange={(e) => {
              const num = field.validation?.integer
                ? parseInt(e.target.value, 10)
                : parseFloat(e.target.value);
              onChange(isNaN(num) ? 0 : num);
            }}
            placeholder={field.description || `Enter ${field.label.toLowerCase()}`}
            disabled={disabled}
            className={cn(error && "border-destructive")}
            min={field.validation?.min}
            max={field.validation?.max}
            step={field.validation?.integer ? 1 : "any"}
          />
        );

      case "array":
        return (
          <TagsInput
            value={(value as string[]) ?? []}
            onChange={(tags) => onChange(tags)}
            placeholder={field.description || `Add ${field.label.toLowerCase()}`}
            disabled={disabled}
            maxItems={field.validation?.maxItems}
            className={cn(error && "border-destructive")}
          />
        );

      case "json":
        return (
          <JsonKeyValueEditor
            value={(value as Record<string, string>) ?? {}}
            onChange={(obj) => onChange(obj)}
            disabled={disabled}
            className={cn(error && "border-destructive")}
          />
        );

      default:
        return (
          <Input
            type="text"
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
          />
        );
    }
  };

  const getTypeBadgeVariant = () => {
    switch (field.type) {
      case "string":
        return "default";
      case "numeric":
        return "secondary";
      case "array":
        return "outline";
      case "json":
        return "destructive";
      default:
        return "default";
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">
          {field.label}
          {field.required && <span className="text-destructive ml-1">*</span>}
        </Label>
        {showTypeBadge && (
          <Badge variant={getTypeBadgeVariant()} className="text-[10px] px-1.5 py-0">
            {field.type}
          </Badge>
        )}
      </div>
      {renderInput()}
      {error && <p className="text-xs text-destructive">{error}</p>}
      {field.description && !error && (
        <p className="text-xs text-muted-foreground">{field.description}</p>
      )}
    </div>
  );
}
