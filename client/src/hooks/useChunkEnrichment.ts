import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Chunk } from "@shared/schema";
import type { ChunkEnrichmentResult } from "../../../server/agents/chunk-enrichment-agent";

/**
 * Response from single chunk enrichment
 */
interface EnrichChunkResponse {
  chunk: Chunk;
  enrichedFields: Record<string, any>;
}

/**
 * Response from batch chunk enrichment
 */
interface EnrichChunksResponse {
  results: ChunkEnrichmentResult[];
  summary: {
    enriched: number;
    failed: number;
    total: number;
    processed: number;
  };
}

/**
 * Enrich a single chunk's metadata using AI
 */
export function useEnrichChunk() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      uploadId,
      chunkId,
    }: {
      uploadId: string;
      chunkId: string;
    }): Promise<EnrichChunkResponse> => {
      const res = await apiRequest(
        "POST",
        `/api/agents/enrich-chunk/${uploadId}/${chunkId}`
      );
      return res.json();
    },
    onSuccess: (_, { uploadId }) => {
      // Invalidate chunks query to refetch with new metadata
      queryClient.invalidateQueries({
        queryKey: ["/api/uploads", uploadId, "chunks"],
      });
    },
  });
}

/**
 * Enrich multiple chunks' metadata (batch processing)
 * Supports optional limit for testing prompts on a subset
 */
export function useEnrichChunks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      uploadId,
      limit,
    }: {
      uploadId: string;
      limit?: number;
    }): Promise<EnrichChunksResponse> => {
      const url = limit
        ? `/api/agents/enrich-chunks/${uploadId}?limit=${limit}`
        : `/api/agents/enrich-chunks/${uploadId}`;

      const res = await apiRequest("POST", url);
      return res.json();
    },
    onSuccess: (_, { uploadId }) => {
      // Invalidate chunks query to refetch with new metadata
      queryClient.invalidateQueries({
        queryKey: ["/api/uploads", uploadId, "chunks"],
      });
    },
  });
}

/**
 * Preset options for test mode dropdown
 */
export const ENRICH_LIMIT_OPTIONS = [
  { value: "3", label: "Test first 3" },
  { value: "5", label: "Test first 5" },
  { value: "10", label: "Test first 10" },
  { value: "all", label: "All chunks" },
] as const;

export type EnrichLimitValue = (typeof ENRICH_LIMIT_OPTIONS)[number]["value"];

/**
 * Parse limit value from dropdown selection
 */
export function parseEnrichLimit(value: EnrichLimitValue): number | undefined {
  return value === "all" ? undefined : parseInt(value, 10);
}
