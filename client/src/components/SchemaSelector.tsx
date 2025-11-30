import * as React from "react";
import { Check, ChevronsUpDown, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { useSchemas } from "@/hooks/useSchemas";
import { cn } from "@/lib/utils";

interface SchemaSelectorProps {
  value: string | null;
  onChange: (schemaId: string | null) => void;
  onCreateNew?: () => void;
  disabled?: boolean;
  className?: string;
}

export function SchemaSelector({
  value,
  onChange,
  onCreateNew,
  disabled = false,
  className,
}: SchemaSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const { data: schemas, isLoading } = useSchemas();

  // Find selected schema
  const selectedSchema = schemas?.find((s) => s.id === value);

  const handleSelect = (schemaId: string) => {
    if (schemaId === value) {
      onChange(null); // Deselect if clicking same schema
    } else {
      onChange(schemaId);
    }
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || isLoading}
          className={cn("w-full justify-between", className)}
        >
          {selectedSchema ? (
            <div className="flex items-center gap-2 truncate">
              <span className="truncate">{selectedSchema.name}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">Select schema...</span>
          )}
          <div className="flex items-center gap-1">
            {value && (
              <X
                className="h-4 w-4 text-muted-foreground hover:text-foreground"
                onClick={handleClear}
              />
            )}
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search schemas..." />
          <CommandList>
            <CommandEmpty>No schema found.</CommandEmpty>

            {/* All schemas */}
            {schemas && schemas.length > 0 && (
              <CommandGroup heading="Schemas">
                {schemas.map((schema) => (
                  <CommandItem
                    key={schema.id}
                    value={schema.name}
                    onSelect={() => handleSelect(schema.id)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === schema.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col flex-1">
                      <span>{schema.name}</span>
                      {schema.description && (
                        <span className="text-xs text-muted-foreground truncate">
                          {schema.description}
                        </span>
                      )}
                    </div>
                    <Badge variant="secondary" className="ml-2 text-[10px]">
                      {(schema.documentFields?.length || 0) +
                        (schema.chunkFields?.length || 0)}{" "}
                      fields
                    </Badge>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* Create new option */}
            {onCreateNew && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem onSelect={onCreateNew}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create new schema...
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
