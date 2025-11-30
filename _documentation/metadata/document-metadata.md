# Document Metadata

This document describes the metadata system for documents in ChunkForge, including what metadata is automatically populated during PDF upload and what can be customized by users.

## Overview

Document metadata is stored in two places:
1. **`metadata`** - Core document properties (populated automatically + user-editable)
2. **`customMetadata`** - Schema-defined custom fields (user-defined)

## Metadata Schema

Defined in `shared/schema.ts`:

```typescript
export const documentMetadataSchema = z.object({
  // Auto-populated during upload
  pageCount: z.number().optional(),
  fileSize: z.number().optional(),
  uploadedAt: z.string().optional(),
  originalFilename: z.string().optional(),

  // User-editable fields
  title: z.string().optional(),
  author: z.string().optional(),
  description: z.string().optional(),

  // Custom fields (from schema or ad-hoc)
  custom: customFieldsSchema.default({}),
});
```

## Auto-Populated Fields (During Upload)

When a PDF is uploaded via `/api/upload`, the following metadata is automatically extracted:

| Field | Type | Source | Description |
|-------|------|--------|-------------|
| `pageCount` | number | Parser service | Total number of pages in the PDF |
| `fileSize` | number | Upload request | File size in bytes |
| `uploadedAt` | string | Server timestamp | ISO 8601 timestamp of upload |
| `originalFilename` | string | Upload request | Original filename of the uploaded PDF |

### Upload Flow

```
1. User uploads PDF → Express server
2. PDF stored in local storage (/storage/uploads/)
3. PDF sent to Parser service (/parse)
4. Parser returns markdown + pageCount
5. Document saved with metadata:
   {
     pageCount: <from parser>,
     fileSize: req.file.size,
     uploadedAt: new Date().toISOString(),
     originalFilename: req.file.originalname,
     custom: {}
   }
```

**Source**: `server/routes/upload.ts:82-88`

## User-Editable Fields

These fields are displayed in the Document tab of the MetadataPanel and can be modified by users:

| Field | Type | Description | UI Location |
|-------|------|-------------|-------------|
| `title` | string | Document title | "Basic Information" accordion |
| `author` | string | Document author | "Basic Information" accordion |
| `description` | string | Document description (textarea) | "Basic Information" accordion |

## Read-Only Display Fields

These auto-populated fields are displayed but not editable:

| Field | UI Display | Location |
|-------|-----------|----------|
| `pageCount` | "Page Count: N" | "File Information" accordion |
| `fileSize` | "File Size: N KB" | "File Information" accordion |
| `originalFilename` | Filename | "File Information" accordion |
| `uploadedAt` | Formatted date | "File Information" accordion |

## Custom Metadata Schema

Documents can have a custom metadata schema assigned that defines typed fields.

### Schema Association

| Column | Type | Description |
|--------|------|-------------|
| `schemaId` | UUID (nullable) | Foreign key to `metadata_schemas` table |
| `customMetadata` | JSONB | Custom field values matching the schema |

### How Schemas Work

1. **Create Schema** (`/schemas` page or MetadataPanel dialog)
   - Define document-level fields with types: string, numeric, array, json
   - Configure validation rules (min/max, required, etc.)

2. **Apply Schema** (MetadataPanel → Schema Selector)
   - Select from available schemas
   - Schema fields appear in "Custom Fields" accordion

3. **Fill Values**
   - DynamicField components render appropriate inputs per type
   - Values stored in `customMetadata` JSONB column

### Custom Field Types

```typescript
type CustomFieldValue =
  | string
  | number
  | Record<string, string>  // Flat JSON only
  | string[];               // Array of strings

type CustomFields = Record<string, CustomFieldValue>;
```

### Ad-hoc Fields

Users can add custom fields without a schema:
1. Enter field name in "Add Custom Field" section
2. Select type from dropdown (Text, Number, Array, JSON)
3. Field added to `customMetadata` with default value

## Database Schema

```sql
-- Documents table columns
schema_id UUID REFERENCES metadata_schemas(id) ON DELETE SET NULL,
custom_metadata JSONB DEFAULT '{}'::jsonb NOT NULL
```

**Table**: `documents`
**Columns**: `schemaId`, `customMetadata`

## API Endpoints

### Update Document Metadata

```
PATCH /api/documents/:id
```

Request body:
```json
{
  "title": "New Title",
  "metadata": {
    "author": "John Doe",
    "description": "Document description"
  },
  "schemaId": "uuid-or-null",
  "customMetadata": {
    "custom_field": "value",
    "numeric_field": 42,
    "array_field": ["tag1", "tag2"]
  }
}
```

### Apply Schema to Document

```
PATCH /api/documents/:id/schema
```

Request body:
```json
{
  "schemaId": "schema-uuid-or-null"
}
```

## Frontend Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `MetadataPanel` | `components/MetadataPanel.tsx` | Main metadata editing UI |
| `SchemaSelector` | `components/SchemaSelector.tsx` | Schema dropdown selector |
| `SchemaEditorDialog` | `components/SchemaEditorDialog.tsx` | Create/edit schemas |
| `DynamicField` | `components/DynamicField.tsx` | Renders typed field inputs |

## Caching Strategy

- React Query with 30-minute `staleTime` for schema data
- Document metadata saved with document (no separate cache)
- Changes trigger `queryClient.invalidateQueries()` on save
