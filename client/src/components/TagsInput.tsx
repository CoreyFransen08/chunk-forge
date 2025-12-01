import * as React from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface TagsInputProps {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  maxItems?: number;
  disabled?: boolean;
  className?: string;
}

export function TagsInput({
  value,
  onChange,
  placeholder = "Add item...",
  maxItems,
  disabled = false,
  className,
}: TagsInputProps) {
  const [inputValue, setInputValue] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const addTags = (text: string) => {
    // Split by comma and filter empty strings
    const newTags = text
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);

    if (newTags.length === 0) return;

    // Filter out duplicates
    const uniqueNewTags = newTags.filter((tag) => !value.includes(tag));

    if (uniqueNewTags.length === 0) {
      setInputValue("");
      return;
    }

    // Check max items limit
    if (maxItems && value.length + uniqueNewTags.length > maxItems) {
      const allowedCount = maxItems - value.length;
      if (allowedCount > 0) {
        onChange([...value, ...uniqueNewTags.slice(0, allowedCount)]);
      }
    } else {
      onChange([...value, ...uniqueNewTags]);
    }

    setInputValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (inputValue.trim()) {
        addTags(inputValue);
      }
    } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
      // Remove last tag on backspace when input is empty
      onChange(value.slice(0, -1));
    }
  };

  const handleBlur = () => {
    if (inputValue.trim()) {
      addTags(inputValue);
    }
  };

  const removeTag = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const handleContainerClick = () => {
    inputRef.current?.focus();
  };

  const isAtLimit = maxItems !== undefined && value.length >= maxItems;

  return (
    <div
      className={cn(
        "flex flex-wrap gap-1.5 p-2 border rounded-md bg-background min-h-[38px] cursor-text",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
      onClick={handleContainerClick}
    >
      {value.map((tag, index) => (
        <Badge
          key={`${tag}-${index}`}
          variant="secondary"
          className="flex items-center gap-1 pr-1"
        >
          <span className="max-w-[150px] truncate">{tag}</span>
          {!disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(index);
              }}
              className="ml-1 rounded-full hover:bg-muted p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </Badge>
      ))}
      {!disabled && !isAtLimit && (
        <Input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={value.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[120px] border-0 p-0 h-6 focus-visible:ring-0 focus-visible:ring-offset-0"
          disabled={disabled}
        />
      )}
      {isAtLimit && (
        <span className="text-xs text-muted-foreground">
          Max {maxItems} items
        </span>
      )}
    </div>
  );
}
