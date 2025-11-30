import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { MetadataSchema, CreateSchemaRequest, UpdateSchemaRequest } from "@shared/metadata-schema";

const SCHEMA_STALE_TIME = 30 * 60 * 1000; // 30 minutes

/**
 * Fetch all schemas
 */
export function useSchemas() {
  return useQuery<MetadataSchema[]>({
    queryKey: ["/api/schemas"],
    staleTime: SCHEMA_STALE_TIME,
  });
}

/**
 * Fetch a single schema by ID
 */
export function useSchema(schemaId: string | null) {
  return useQuery<MetadataSchema>({
    queryKey: ["/api/schemas", schemaId],
    enabled: !!schemaId,
    staleTime: SCHEMA_STALE_TIME,
  });
}

/**
 * Create a new schema
 */
export function useCreateSchema() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateSchemaRequest) => {
      const res = await apiRequest("POST", "/api/schemas", data);
      return res.json() as Promise<MetadataSchema>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schemas"] });
    },
  });
}

/**
 * Update an existing schema
 */
export function useUpdateSchema() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: UpdateSchemaRequest;
    }) => {
      const res = await apiRequest("PATCH", `/api/schemas/${id}`, data);
      return res.json() as Promise<MetadataSchema>;
    },
    onSuccess: (updatedSchema) => {
      queryClient.invalidateQueries({ queryKey: ["/api/schemas"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/schemas", updatedSchema.id],
      });
    },
  });
}

/**
 * Delete a schema
 */
export function useDeleteSchema() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/schemas/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schemas"] });
    },
  });
}

/**
 * Duplicate a schema (creates a copy for the current user)
 */
export function useDuplicateSchema() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name?: string }) => {
      const res = await apiRequest("POST", `/api/schemas/${id}/duplicate`, {
        name,
      });
      return res.json() as Promise<MetadataSchema>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schemas"] });
    },
  });
}

/**
 * Apply or remove a schema from an upload
 */
export function useApplySchemaToUpload() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      uploadId,
      schemaId,
    }: {
      uploadId: string;
      schemaId: string | null;
    }) => {
      const res = await apiRequest(
        "PATCH",
        `/api/uploads/${uploadId}/schema`,
        { schemaId }
      );
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["/api/uploads", variables.uploadId],
      });
    },
  });
}

// Backward compatibility alias
export const useApplySchemaToDocument = useApplySchemaToUpload;
