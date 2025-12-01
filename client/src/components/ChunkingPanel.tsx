import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ChunkStrategy, ChunkingConfig } from '@shared/schema';
import { Loader2 } from 'lucide-react';

interface ChunkingPanelProps {
  strategy: ChunkStrategy;
  onStrategyChange: (strategy: ChunkStrategy) => void;
  config: ChunkingConfig;
  onConfigChange: (config: ChunkingConfig) => void;
  onGenerateChunks: () => void;
  processing: boolean;
  chunksExist: boolean;
}

interface StrategyOption {
  value: ChunkStrategy;
  label: string;
  description: string;
}

const STRATEGY_OPTIONS: StrategyOption[] = [
  { value: 'recursive', label: 'Recursive', description: 'Recursive splitting with separator hierarchy' },
  { value: 'paragraph', label: 'Paragraph', description: 'Split on paragraph breaks' },
  { value: 'by_heading', label: 'By Heading', description: 'Split on markdown headings' },
  { value: 'semantic', label: 'Semantic', description: 'Group by header families' },
  { value: 'sentence', label: 'Sentence-Based', description: 'Split by sentence count' },
  { value: 'token', label: 'Token-Based', description: 'Split by token count' },
  { value: 'hierarchical', label: 'Hierarchical', description: 'Parent-child chunk relationships' },
  { value: 'character', label: 'Character', description: 'Simple character-based splits' },
  { value: 'html', label: 'HTML', description: 'HTML structure-aware' },
  { value: 'json', label: 'JSON', description: 'JSON structure-aware' },
  { value: 'latex', label: 'LaTeX', description: 'LaTeX structure-aware' },
];

// Strategies that use the chunk_size slider
const CHUNK_SIZE_STRATEGIES: ChunkStrategy[] = ['recursive', 'semantic', 'token', 'character', 'html', 'json', 'latex'];

export function ChunkingPanel({
  strategy,
  onStrategyChange,
  config,
  onConfigChange,
  onGenerateChunks,
  processing,
  chunksExist,
}: ChunkingPanelProps) {
  const showChunkSizeSlider = CHUNK_SIZE_STRATEGIES.includes(strategy);

  // Get appropriate label for chunk_size based on strategy
  const getChunkSizeLabel = () => {
    if (strategy === 'semantic') return 'Join Threshold';
    if (strategy === 'token') return 'Size (tokens)';
    return 'Chunk Size';
  };

  // Get default chunk_size based on strategy
  const getDefaultChunkSize = () => {
    switch (strategy) {
      case 'semantic': return 500;
      case 'token': return 512;
      default: return 1000;
    }
  };

  return (
    <aside className="w-64 border-r bg-card p-4 overflow-y-auto">
      <h3 className="text-sm font-medium mb-4">Chunking Strategy</h3>

      <div className="space-y-4">
        {/* Strategy Selection */}
        <div className="space-y-2">
          <Label htmlFor="strategy">Strategy</Label>
          <Select
            value={strategy}
            onValueChange={(value) => onStrategyChange(value as ChunkStrategy)}
          >
            <SelectTrigger id="strategy" data-testid="select-strategy">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STRATEGY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {STRATEGY_OPTIONS.find(o => o.value === strategy)?.description}
          </p>
        </div>

        {/* Chunk Size Slider (for applicable strategies) */}
        {showChunkSizeSlider && (
          <div className="space-y-2">
            <Label htmlFor="chunk-size">
              {getChunkSizeLabel()}: {config.chunk_size || getDefaultChunkSize()}
            </Label>
            <Slider
              id="chunk-size"
              min={100}
              max={5000}
              step={100}
              value={[config.chunk_size || getDefaultChunkSize()]}
              onValueChange={([value]) => onConfigChange({ ...config, chunk_size: value })}
              data-testid="slider-chunk-size"
            />
          </div>
        )}

        {/* Paragraph Strategy Options */}
        {strategy === 'paragraph' && (
          <div className="space-y-2">
            <Label htmlFor="max-size">
              Max Section Size: {config.max_section_size || 2000}
            </Label>
            <Slider
              id="max-size"
              min={500}
              max={5000}
              step={100}
              value={[config.max_section_size || 2000]}
              onValueChange={([value]) => onConfigChange({ ...config, max_section_size: value })}
            />
          </div>
        )}

        {/* By Heading Strategy Options */}
        {strategy === 'by_heading' && (
          <div className="space-y-2">
            <Label>Heading Levels</Label>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3, 4, 5, 6].map((level) => (
                <Button
                  key={level}
                  variant={config.heading_levels?.includes(level) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    const current = config.heading_levels || [1, 2, 3];
                    const updated = current.includes(level)
                      ? current.filter(l => l !== level)
                      : [...current, level].sort();
                    onConfigChange({ ...config, heading_levels: updated });
                  }}
                >
                  H{level}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Sentence Strategy Options */}
        {strategy === 'sentence' && (
          <div className="space-y-2">
            <Label htmlFor="sentences">
              Sentences per Chunk: {config.sentences_per_chunk || 5}
            </Label>
            <Slider
              id="sentences"
              min={1}
              max={20}
              step={1}
              value={[config.sentences_per_chunk || 5]}
              onValueChange={([value]) => onConfigChange({ ...config, sentences_per_chunk: value })}
            />
          </div>
        )}

        {/* Hierarchical Strategy Options */}
        {strategy === 'hierarchical' && (
          <div className="space-y-2">
            <Label htmlFor="chunk-sizes">Chunk Sizes (Parent → Child)</Label>
            <p className="text-xs text-muted-foreground">
              Comma-separated sizes for each hierarchy level
            </p>
            <Input
              id="chunk-sizes"
              type="text"
              placeholder="2048, 512"
              defaultValue={(config.chunk_sizes || [2048, 512]).join(', ')}
              onBlur={(e) => {
                const sizes = e.target.value
                  .split(',')
                  .map(s => parseInt(s.trim()))
                  .filter(n => !isNaN(n));
                if (sizes.length > 0) {
                  onConfigChange({ ...config, chunk_sizes: sizes });
                }
              }}
            />
          </div>
        )}

        {/* Generate/Regenerate Button */}
        <Button
          className="w-full"
          onClick={onGenerateChunks}
          disabled={processing}
          data-testid="button-regenerate"
        >
          {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {chunksExist ? 'Regenerate Chunks' : 'Generate Chunks'}
        </Button>
      </div>
    </aside>
  );
}
