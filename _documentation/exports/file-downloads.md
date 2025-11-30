# File Downloads

In addition to chunk exports, ChunkForge allows downloading the parsed markdown and original uploaded files.

## Markdown Download

Downloads the markdown content generated from the original document during upload.

### Endpoint

```
GET /api/export/markdown/:uploadId
```

### Response

- **Content-Type:** `text/markdown`
- **Filename:** `{document_title}.md`

### Source

Markdown is retrieved using the `getMarkdownContent()` helper which checks:
1. **Primary:** Local storage directory `/storage/markdown/`
2. **Fallback:** Database `uploads.markdown` field

### Use Cases

- Review parsed content without re-uploading
- Use markdown in other applications
- Verify parsing quality
- Share parsed content

---

## Original File Download

Downloads the original file that was uploaded (PDF, DOCX, etc.).

### Endpoint

```
GET /api/export/original/:uploadId
```

### Response

- **Content-Type:** `application/octet-stream`
- **Filename:** Original filename (e.g., `report.pdf`)

### Source

Files are downloaded from local storage directory `/storage/uploads/` using the stored `filePath`.

### Use Cases

- Retrieve original document
- Re-process with different settings
- Archive/backup original files
- Share source documents

---

## API Implementation

### Markdown Route

```typescript
app.get("/api/export/markdown/:uploadId", async (req, res) => {
  // 1. Fetch upload record
  const [upload] = await db
    .select()
    .from(uploads)
    .where(eq(uploads.id, req.params.uploadId));

  // 2. Get markdown content
  const markdown = await getMarkdownContent(upload);

  // 3. Send response
  res.setHeader("Content-Type", "text/markdown");
  res.setHeader("Content-Disposition",
    `attachment; filename="${upload.title.replace(/[^a-z0-9]/gi, '_')}.md"`);
  res.send(markdown);
});
```

### Original File Route

```typescript
app.get("/api/export/original/:uploadId", async (req, res) => {
  // 1. Fetch upload record
  const [upload] = await db
    .select()
    .from(uploads)
    .where(eq(uploads.id, req.params.uploadId));

  // 2. Download from local storage
  const data = await downloadFile('uploads', upload.filePath);

  // 3. Send response
  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Disposition",
    `attachment; filename="${upload.originalFilename}"`);
  res.send(data);
});
```

---

## Frontend Integration

### ExportDialog Props

```typescript
interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chunks: Chunk[];
  uploadId?: string;           // Required for file downloads
  originalFilename?: string;   // Displayed in Original tab
  documentTitle?: string;      // Used for filenames
  hasMarkdown?: boolean;       // Enable/disable Markdown tab
}
```

### Tab States

| Tab | Enabled When |
|-----|--------------|
| Chunks | Always |
| Markdown | `hasMarkdown && uploadId` |
| Original | `uploadId` |

### Download Handlers

```typescript
const handleMarkdownDownload = async () => {
  const response = await fetch(`/api/export/markdown/${uploadId}`);
  const blob = await response.blob();
  downloadBlob(blob, `${documentTitle}.md`);
};

const handleOriginalDownload = async () => {
  const response = await fetch(`/api/export/original/${uploadId}`);
  const blob = await response.blob();
  downloadBlob(blob, originalFilename);
};
```

---

## Storage Architecture

```
Local Storage (/storage/)
├── uploads/                    ← Original files
│   ├── 1699000000-report.pdf
│   ├── 1699000001-manual.docx
│   └── ...
│
└── markdown/                   ← Parsed markdown
    ├── {uploadId}.md
    └── ...

Database (uploads table)
├── filePath      → "1699000000-report.pdf"
├── markdownPath  → "{uploadId}.md"
└── markdown      → (fallback, null if stored in directory)
```

---

## Error Handling

| Error | HTTP Status | Cause |
|-------|-------------|-------|
| Upload not found | 404 | Invalid uploadId |
| Download failed | 500 | Storage read error |

### Frontend Error Display

```typescript
catch {
  toast({
    variant: 'destructive',
    title: 'Download failed',
    description: 'Failed to download file. Please try again.',
  });
}
```
