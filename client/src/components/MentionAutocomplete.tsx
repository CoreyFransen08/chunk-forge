import * as React from "react";
import { createPortal } from "react-dom";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import type { FieldDefinition, FieldType } from "@shared/metadata-schema";

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  string: "Text",
  numeric: "Number",
  array: "Array",
  json: "JSON",
};

interface MentionPosition {
  start: number;
  end: number;
  top: number;
  left: number;
}

interface MentionAutocompleteProps {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  availableFields: FieldDefinition[];
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  id?: string;
  insertTemplate?: (fieldName: string) => string; // Custom template function, defaults to {{fieldName}}
}

export function MentionAutocomplete({
  textareaRef,
  value,
  onChange,
  onKeyDown,
  availableFields,
  disabled = false,
  placeholder,
  className,
  id,
  insertTemplate = (fieldName) => `{{${fieldName}}}`,
}: MentionAutocompleteProps) {
  // Mention autocomplete state
  const [mentionQuery, setMentionQuery] = React.useState("");
  const [mentionPosition, setMentionPosition] = React.useState<MentionPosition | null>(null);
  const [selectedMentionIndex, setSelectedMentionIndex] = React.useState(0);
  const mentionPopoverRef = React.useRef<HTMLDivElement>(null);
  const mentionItemRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  // Filter fields based on mention query
  const filteredFields = React.useMemo(() => {
    if (!mentionQuery) return availableFields;
    const query = mentionQuery.toLowerCase();
    return availableFields.filter(
      (field) =>
        field.name.toLowerCase().includes(query) ||
        field.label.toLowerCase().includes(query)
    );
  }, [availableFields, mentionQuery]);

  // Calculate cursor position in textarea
  const getCursorPosition = React.useCallback((textarea: HTMLTextAreaElement, position: number) => {
    // Create a temporary div to measure text position
    const div = document.createElement("div");
    const style = getComputedStyle(textarea);

    // Copy textarea styles
    const stylesToCopy = [
      "fontFamily",
      "fontSize",
      "fontWeight",
      "lineHeight",
      "paddingTop",
      "paddingLeft",
      "paddingRight",
      "paddingBottom",
      "borderTopWidth",
      "borderLeftWidth",
      "borderRightWidth",
      "borderBottomWidth",
      "boxSizing",
      "whiteSpace",
      "wordWrap",
      "letterSpacing",
      "textIndent",
      "textTransform",
    ];

    stylesToCopy.forEach((prop) => {
      div.style[prop as any] = style[prop as any];
    });

    div.style.position = "absolute";
    div.style.visibility = "hidden";
    div.style.whiteSpace = "pre-wrap";
    div.style.wordWrap = "break-word";
    div.style.overflowWrap = "break-word";
    div.style.width = `${textarea.offsetWidth}px`;
    div.style.top = "0";
    div.style.left = "0";
    div.style.height = "auto";
    div.style.overflow = "hidden";
    div.style.zIndex = "-1";

    document.body.appendChild(div);

    // Get text before cursor and preserve line breaks
    const textBeforeCursor = textarea.value.substring(0, position);
    div.textContent = textBeforeCursor;

    // Create a span to mark the end position
    const span = document.createElement("span");
    span.textContent = "\u200B"; // Zero-width space for measurement
    div.appendChild(span);

    const textareaRect = textarea.getBoundingClientRect();
    const spanRect = span.getBoundingClientRect();
    const divRect = div.getBoundingClientRect();

    // Calculate position relative to viewport
    const top = textareaRect.top + (spanRect.top - divRect.top) + spanRect.height + window.scrollY;
    const left = textareaRect.left + (spanRect.left - divRect.left) + window.scrollX;

    document.body.removeChild(div);

    return { top, left };
  }, []);

  // Handle field insertion
  const handleInsertField = React.useCallback(
    (fieldName: string, replaceRange?: MentionPosition) => {
      const fieldTemplate = insertTemplate(fieldName);
      const textarea = textareaRef.current;

      if (textarea) {
        const start = replaceRange?.start ?? textarea.selectionStart;
        const end = replaceRange?.end ?? textarea.selectionEnd;
        const newValue = value.substring(0, start) + fieldTemplate + value.substring(end);
        onChange(newValue);

        // Close mention popover
        setMentionPosition(null);
        setMentionQuery("");

        // Set cursor position after the inserted text
        setTimeout(() => {
          textarea.focus();
          const newCursorPos = start + fieldTemplate.length;
          textarea.setSelectionRange(newCursorPos, newCursorPos);
        }, 0);
      } else {
        // Fallback: append to end
        onChange(value + fieldTemplate);
      }
    },
    [value, onChange, insertTemplate, textareaRef]
  );

  // Handle textarea input for mention detection
  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      const cursorPos = e.target.selectionStart;
      onChange(newValue);

      // Check if we're in a mention context (after '@')
      const textBeforeCursor = newValue.substring(0, cursorPos);
      const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

      if (mentionMatch && availableFields.length > 0 && textareaRef.current) {
        const query = mentionMatch[1];
        const startPos = cursorPos - query.length - 1; // -1 for '@'

        // Calculate cursor position
        try {
          const { top, left } = getCursorPosition(textareaRef.current, cursorPos);
          setMentionQuery(query);
          setMentionPosition({ start: startPos, end: cursorPos, top, left });
          setSelectedMentionIndex(0);
        } catch (error) {
          // Fallback to textarea position
          const rect = textareaRef.current.getBoundingClientRect();
          setMentionQuery(query);
          setMentionPosition({
            start: startPos,
            end: cursorPos,
            top: rect.top + window.scrollY,
            left: rect.left + window.scrollX + 10,
          });
          setSelectedMentionIndex(0);
        }
      } else {
        setMentionPosition(null);
        setMentionQuery("");
      }
    },
    [availableFields.length, getCursorPosition, onChange, textareaRef]
  );

  // Update mention position on scroll/resize
  React.useEffect(() => {
    if (!mentionPosition || !textareaRef.current) return;

    const updatePosition = () => {
      if (textareaRef.current && mentionPosition) {
        try {
          const { top, left } = getCursorPosition(textareaRef.current, mentionPosition.end);
          setMentionPosition((prev) => (prev ? { ...prev, top, left } : null));
        } catch (error) {
          // Ignore errors
        }
      }
    };

    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    const textarea = textareaRef.current;
    textarea.addEventListener("scroll", updatePosition);

    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
      textarea.removeEventListener("scroll", updatePosition);
    };
  }, [mentionPosition, getCursorPosition, textareaRef]);

  // Close mention popover when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        mentionPosition &&
        textareaRef.current &&
        !textareaRef.current.contains(e.target as Node) &&
        mentionPopoverRef.current &&
        !mentionPopoverRef.current.contains(e.target as Node)
      ) {
        setMentionPosition(null);
        setMentionQuery("");
      }
    };

    if (mentionPosition) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [mentionPosition, textareaRef]);

  // Reset refs when filtered fields change
  React.useEffect(() => {
    mentionItemRefs.current = new Array(filteredFields.length);
  }, [filteredFields.length]);

  // Scroll selected item into view
  React.useEffect(() => {
    if (mentionItemRefs.current[selectedMentionIndex] && mentionPopoverRef.current) {
      const selectedItem = mentionItemRefs.current[selectedMentionIndex];
      const popover = mentionPopoverRef.current;

      if (selectedItem && popover) {
        const scrollTop = popover.scrollTop;
        const itemOffsetTop = selectedItem.offsetTop;

        // Calculate if item is visible
        const itemTop = itemOffsetTop - scrollTop;
        const itemBottom = itemTop + selectedItem.offsetHeight;
        const visibleTop = 0;
        const visibleBottom = popover.clientHeight;

        // Scroll if item is outside visible area
        if (itemTop < visibleTop) {
          // Item is above visible area, scroll up
          popover.scrollTo({
            top: itemOffsetTop - 4, // 4px padding
            behavior: "smooth",
          });
        } else if (itemBottom > visibleBottom) {
          // Item is below visible area, scroll down
          popover.scrollTo({
            top: itemOffsetTop - popover.clientHeight + selectedItem.offsetHeight + 4, // 4px padding
            behavior: "smooth",
          });
        }
      }
    }
  }, [selectedMentionIndex, filteredFields.length]);

  // Handle keyboard navigation in mention popover
  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Call external onKeyDown handler first
      onKeyDown?.(e);

      if (mentionPosition && filteredFields.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedMentionIndex((prev) =>
            prev < filteredFields.length - 1 ? prev + 1 : prev
          );
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedMentionIndex((prev) => (prev > 0 ? prev - 1 : 0));
        } else if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          const selectedField = filteredFields[selectedMentionIndex];
          if (selectedField) {
            handleInsertField(selectedField.name, mentionPosition);
          }
        } else if (e.key === "Escape") {
          e.preventDefault();
          setMentionPosition(null);
          setMentionQuery("");
        } else if (
          e.key === "ArrowLeft" ||
          e.key === "ArrowRight" ||
          e.key === "Home" ||
          e.key === "End"
        ) {
          // Update position when cursor moves
          setTimeout(() => {
            if (textareaRef.current && mentionPosition) {
              const cursorPos = textareaRef.current.selectionStart;
              const textBeforeCursor = value.substring(0, cursorPos);
              const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

              if (!mentionMatch) {
                setMentionPosition(null);
                setMentionQuery("");
              } else {
                // Recalculate position
                try {
                  const { top, left } = getCursorPosition(textareaRef.current, cursorPos);
                  setMentionPosition((prev) =>
                    prev ? { ...prev, top, left, end: cursorPos } : null
                  );
                } catch (error) {
                  // Ignore
                }
              }
            }
          }, 0);
        }
      }
    },
    [
      mentionPosition,
      filteredFields,
      selectedMentionIndex,
      handleInsertField,
      getCursorPosition,
      value,
      textareaRef,
      onKeyDown,
    ]
  );

  return (
    <>
      <Textarea
        ref={textareaRef}
        id={id}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
      />
      {mentionPosition && filteredFields.length > 0 &&
        createPortal(
          <div
            ref={mentionPopoverRef}
            className="fixed w-64 bg-popover border rounded-md shadow-lg p-1 max-h-[200px] overflow-y-auto z-[100] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            style={{
              top: `${mentionPosition.top - 8}px`,
              left: `${mentionPosition.left}px`,
              transform: "translateY(-100%)",
            }}
            onMouseDown={(e) => {
              // Only prevent default if clicking on the popover itself, not buttons
              if (e.target === e.currentTarget) {
                e.preventDefault();
              }
            }}
          >
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-muted-foreground px-2 py-1.5 border-b">
                Available Fields
              </p>
              {filteredFields.length === 0 ? (
                <p className="text-xs text-muted-foreground px-2 py-2 text-center">
                  No fields match "{mentionQuery}"
                </p>
              ) : (
                filteredFields.map((field, index) => {
                  // Ensure refs array is large enough
                  if (!mentionItemRefs.current[index]) {
                    mentionItemRefs.current[index] = null;
                  }
                  return (
                    <button
                      key={field.id}
                      ref={(el) => {
                        mentionItemRefs.current[index] = el;
                      }}
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleInsertField(field.name, mentionPosition);
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      className={`w-full text-left px-2 py-1.5 rounded-md text-sm transition-colors ${
                        index === selectedMentionIndex
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted"
                      }`}
                      onMouseEnter={() => setSelectedMentionIndex(index)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{field.label}</span>
                        <Badge variant="secondary" className="text-[10px]">
                          {FIELD_TYPE_LABELS[field.type] || field.type}
                        </Badge>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

