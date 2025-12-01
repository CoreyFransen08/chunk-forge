import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface JsonKeyValueEditorProps {
  value: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
  disabled?: boolean;
  className?: string;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}

export function JsonKeyValueEditor({
  value,
  onChange,
  disabled = false,
  className,
  keyPlaceholder = "Key",
  valuePlaceholder = "Value",
}: JsonKeyValueEditorProps) {
  const entries = Object.entries(value);

  const handleKeyChange = (oldKey: string, newKey: string) => {
    if (newKey === oldKey) return;

    // Don't allow duplicate keys
    if (newKey && newKey in value && newKey !== oldKey) {
      return;
    }

    const newValue = { ...value };
    const val = newValue[oldKey];
    delete newValue[oldKey];
    if (newKey) {
      newValue[newKey] = val;
    }
    onChange(newValue);
  };

  const handleValueChange = (key: string, newVal: string) => {
    onChange({ ...value, [key]: newVal });
  };

  const addEntry = () => {
    // Find a unique key name
    let keyNum = 1;
    let newKey = `key${keyNum}`;
    while (newKey in value) {
      keyNum++;
      newKey = `key${keyNum}`;
    }
    onChange({ ...value, [newKey]: "" });
  };

  const removeEntry = (key: string) => {
    const newValue = { ...value };
    delete newValue[key];
    onChange(newValue);
  };

  return (
    <div className={cn("space-y-2", className)}>
      {entries.length === 0 ? (
        <div className="text-sm text-muted-foreground py-2 text-center border border-dashed rounded-md">
          No entries. Click "Add" to create one.
        </div>
      ) : (
        entries.map(([key, val], index) => (
          <div key={index} className="flex gap-2 items-center">
            <Input
              value={key}
              onChange={(e) => handleKeyChange(key, e.target.value)}
              placeholder={keyPlaceholder}
              disabled={disabled}
              className="flex-1"
            />
            <span className="text-muted-foreground">:</span>
            <Input
              value={val}
              onChange={(e) => handleValueChange(key, e.target.value)}
              placeholder={valuePlaceholder}
              disabled={disabled}
              className="flex-1"
            />
            {!disabled && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeEntry(key)}
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))
      )}
      {!disabled && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addEntry}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Entry
        </Button>
      )}
    </div>
  );
}
