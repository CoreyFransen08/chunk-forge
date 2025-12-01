import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GripVertical, Trash2, Merge } from 'lucide-react';
import { Chunk } from '@shared/schema';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useState } from 'react';

interface ChunkCardProps {
  chunk: Chunk;
  onDelete: () => void;
  onSelect: () => void;
  isSelected: boolean;
}

export function ChunkCard({ chunk, onDelete, onSelect, isSelected }: ChunkCardProps) {
  const [expanded, setExpanded] = useState(false);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: chunk.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  const charCount = chunk.text.length;
  const tokenCount = chunk.metadata.token_count || Math.ceil(charCount / 4);
  const hasHeadingInfo = chunk.metadata.section_path || chunk.metadata.heading_1;
  const hasHierarchy = chunk.metadata.parent_chunk_id || chunk.metadata.child_chunk_ids;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`group transition-all ${isSelected ? 'border-l-4 border-l-primary' : ''} ${isDragging ? 'shadow-lg' : ''}`}
      onClick={onSelect}
      data-testid={`card-chunk-${chunk.id}`}
    >
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <button
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing text-muted-foreground hover-elevate p-1 rounded"
              data-testid={`button-drag-${chunk.id}`}
            >
              <GripVertical className="h-4 w-4" />
            </button>
            <Badge variant="outline" className="font-mono text-xs" data-testid={`badge-id-${chunk.id}`}>
              {chunk.id.slice(0, 8)}
            </Badge>
            <div className="flex items-center gap-2 ml-auto">
              <Badge variant="secondary" className="font-mono text-xs" data-testid={`badge-chars-${chunk.id}`}>
                {charCount} chars
              </Badge>
              <Badge variant="secondary" className="font-mono text-xs" data-testid={`badge-tokens-${chunk.id}`}>
                {tokenCount} tokens
              </Badge>
              {chunk.metadata.heading_level && (
                <Badge variant="outline" className="font-mono text-xs">
                  H{chunk.metadata.heading_level}
                </Badge>
              )}
              {hasHierarchy && (
                <Badge variant="outline" className="font-mono text-xs">
                  Level {chunk.metadata.depth_level || 0}
                </Badge>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            data-testid={`button-delete-chunk-${chunk.id}`}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>

        {/* Display section path for heading-based chunks */}
        {hasHeadingInfo && (
          <div className="mt-2 text-xs text-muted-foreground truncate">
            📑 {chunk.metadata.section_path || chunk.metadata.heading_1}
          </div>
        )}

        {/* Display hierarchy info */}
        {hasHierarchy && (
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            {chunk.metadata.parent_chunk_id && (
              <span>⬆️ Parent</span>
            )}
            {chunk.metadata.child_chunk_ids && chunk.metadata.child_chunk_ids.length > 0 && (
              <span>⬇️ {chunk.metadata.child_chunk_ids.length} children</span>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="p-4 pt-2">
        <div className={`prose prose-sm dark:prose-invert max-w-none ${!expanded ? 'line-clamp-5' : ''}`}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{chunk.text}</ReactMarkdown>
        </div>
        {chunk.text.length > 300 && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            data-testid={`button-expand-${chunk.id}`}
          >
            {expanded ? 'Show less' : 'Show more'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
