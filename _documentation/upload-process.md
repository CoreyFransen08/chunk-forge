# File Upload Process Documentation

This document outlines the complete flow of uploading and processing files in ChunkForge, from the Dashboard UI through the server-side processing pipeline.

## Overview

The upload process involves multiple components working together:
1. **Client-side (Dashboard)**: File selection, validation, and upload initiation
2. **Server-side (Upload Route)**: File storage, parsing, and database persistence
3. **External Services**: Local Filesystem Storage and Python Parser Service

## Database Schema

### Uploads Table
```sql
CREATE TABLE uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  chunking_strategy TEXT NOT NULL DEFAULT 'none',
  metadata JSONB DEFAULT '{}',
  schema_id UUID REFERENCES metadata_schemas(id),
  custom_metadata JSONB DEFAULT '{}',
  markdown TEXT,                    -- Legacy: kept for backward compatibility
  markdown_path TEXT,               -- Path to markdown file in storage
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Chunks Table
```sql
CREATE TABLE chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id UUID NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  markdown_content TEXT NOT NULL,
  position INTEGER NOT NULL,
  start_offset INTEGER,
  end_offset INTEGER,
  has_overlap BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Storage Directories
- **`/storage/uploads/`**: Stores the original uploaded files (PDFs, etc.)
- **`/storage/markdown/`**: Stores the converted markdown content as separate files

## High-Level Architecture Flow

```mermaid
graph TB
    A[User selects file] --> B[Dashboard: handleUpload]
    B --> C{File type valid?}
    C -->|No| D[Show error toast]
    C -->|Yes| E[Create FormData]
    E --> F[POST /api/upload]
    F --> G[Server: Upload Route]
    G --> H[Save to local storage]
    H --> I{Storage success?}
    I -->|No| J[Return 500 error]
    I -->|Yes| K[Send to Python Parser]
    K --> L{Parse success?}
    L -->|No| M[Throw error]
    L -->|Yes| N[Store markdown to /storage/markdown/]
    N --> O[Save to Database with markdownPath]
    O --> P[Return upload + markdown]
    P --> Q[Client: Navigate to Editor]

    style A fill:#e1f5ff
    style Q fill:#c8e6c9
    style D fill:#ffcdd2
    style J fill:#ffcdd2
    style M fill:#ffcdd2
```

## Detailed Sequence Diagram

```mermaid
sequenceDiagram
    participant User
    participant Dashboard
    participant UploadRoute
    participant LocalStorage
    participant ParserService
    participant Database

    User->>Dashboard: Select file
    Dashboard->>Dashboard: Validate file type
    alt Invalid file type
        Dashboard->>User: Show error toast
    else Valid file type
        Dashboard->>Dashboard: setUploading(true)
        Dashboard->>UploadRoute: POST /api/upload (FormData)

        UploadRoute->>UploadRoute: Generate timestamped filename
        UploadRoute->>LocalStorage: Save file to /storage/uploads/
        LocalStorage-->>UploadRoute: filePath or error

        alt Storage failed
            UploadRoute-->>Dashboard: 500 Error
            Dashboard->>User: Show error toast
        else Storage successful
            UploadRoute->>ParserService: POST /parse (file buffer)
            ParserService-->>UploadRoute: { markdown }

            alt Parser failed
                UploadRoute-->>Dashboard: 500 Error
                Dashboard->>User: Show error toast
            else Parser successful
                UploadRoute->>LocalStorage: Save markdown to /storage/markdown/
                LocalStorage-->>UploadRoute: markdownPath
                UploadRoute->>Database: Insert upload record with markdownPath
                Database-->>UploadRoute: upload
                UploadRoute-->>Dashboard: { upload, markdown }

                Dashboard->>Dashboard: Invalidate uploads query
                Dashboard->>Dashboard: setUploading(false)
                Dashboard->>User: Show success toast
                Dashboard->>Dashboard: Navigate to /editor/:id
            end
        end
    end
```

## Client-Side Process Flow (Dashboard)

```mermaid
flowchart TD
    Start([User clicks Upload button]) --> Click[File input triggered]
    Click --> Select[User selects file]
    Select --> CheckFile{File exists?}
    CheckFile -->|No| End1([Process ends])
    CheckFile -->|Yes| ValidateType{File type supported?}
    ValidateType -->|No| ShowError[Show error toast:<br/>Invalid file type]
    ShowError --> End1
    ValidateType -->|Yes| SetUploading[setUploading = true]
    SetUploading --> CreateFormData[Create FormData object]
    CreateFormData --> AppendFile[Append file to FormData]
    AppendFile --> Fetch[Fetch POST /api/upload]
    Fetch --> CheckResponse{Response OK?}
    CheckResponse -->|No| CatchError[Catch error]
    CatchError --> ShowUploadError[Show error toast:<br/>Upload failed]
    ShowUploadError --> ResetUploading[setUploading = false]
    ResetUploading --> ClearInput[Clear file input]
    ClearInput --> End1
    CheckResponse -->|Yes| ParseJSON[Parse response JSON]
    ParseJSON --> InvalidateQuery[Invalidate uploads query]
    InvalidateQuery --> ShowSuccess[Show success toast]
    ShowSuccess --> Navigate[Navigate to /editor/:id]
    Navigate --> ResetUploading2[setUploading = false]
    ResetUploading2 --> ClearInput2[Clear file input]
    ClearInput2 --> End2([Process complete])

    style Start fill:#e1f5ff
    style End1 fill:#ffcdd2
    style End2 fill:#c8e6c9
    style ShowError fill:#ffcdd2
    style ShowUploadError fill:#ffcdd2
    style ShowSuccess fill:#c8e6c9
```

## Server-Side Process Flow (Upload Route)

```mermaid
flowchart TD
    Start([POST /api/upload received]) --> CheckFile{File exists?}
    CheckFile -->|No| Return400[Return 400:<br/>No file uploaded]
    CheckFile -->|Yes| GenerateFilename[Generate filename:<br/>timestamp-originalname]
    GenerateFilename --> UploadStorage[Save file to<br/>/storage/uploads/]
    UploadStorage --> CheckStorage{Storage success?}
    CheckStorage -->|No| LogError[Log storage error details]
    LogError --> Return500a[Return 500:<br/>Failed to upload file]
    CheckStorage -->|Yes| CreateFormData[Create FormData for<br/>Parser Service]
    CreateFormData --> CallParser[POST to Parser Service:<br/>/parse]
    CallParser --> CheckParser{Parser success?}
    CheckParser -->|No| ThrowError[Throw error:<br/>Parser service failed]
    ThrowError --> CatchError[Catch error]
    CatchError --> Return500b[Return 500:<br/>Error message]
    CheckParser -->|Yes| ExtractMarkdown[Extract markdown<br/>from parser response]
    ExtractMarkdown --> StoreMarkdown[Store markdown to<br/>/storage/markdown/]
    StoreMarkdown --> PrepareUpload[Prepare upload data:<br/>title, filename,<br/>filePath, fileSize, markdownPath]
    PrepareUpload --> InsertDB[Insert into uploads table]
    InsertDB --> ReturnSuccess[Return 200:<br/>upload + markdown]

    style Start fill:#e1f5ff
    style Return400 fill:#ffcdd2
    style Return500a fill:#ffcdd2
    style Return500b fill:#ffcdd2
    style ReturnSuccess fill:#c8e6c9
```

## Component Interaction Diagram

```mermaid
graph LR
    subgraph "Client Components"
        A[Dashboard Component]
        C[QueryClient]
        D[Toast Hook]
    end

    subgraph "Server Components"
        E[Express App]
        F[Multer Middleware]
        G[Upload Route Handler]
        H[Storage Service]
        I[Database Client]
    end

    subgraph "Services"
        K1[Local Storage<br/>/storage/uploads/]
        K2[Local Storage<br/>/storage/markdown/]
        L[Python Parser Service]
        M[PostgreSQL Database]
    end

    A -->|POST /api/upload| E
    A -->|invalidateQueries| C
    A -->|show toast| D

    E -->|parse multipart| F
    F -->|req.file| G
    G -->|save file| H
    H -->|store file| K1
    H -->|store markdown| K2
    G -->|POST /parse| L
    G -->|insert upload| I
    I -->|save record| M

    style A fill:#e3f2fd
    style G fill:#fff3e0
    style K1 fill:#f3e5f5
    style K2 fill:#f3e5f5
    style L fill:#e8f5e9
    style M fill:#e0f2f1
```

## Error Handling Flow

```mermaid
flowchart TD
    Start([Upload Process]) --> Try[Try block]
    Try --> Step1[Step 1: File validation]
    Step1 -->|Error| Catch1[Catch: Return 400]
    Step1 -->|Success| Step2[Step 2: Storage upload]
    Step2 -->|Error| Catch2[Catch: Log & Return 500]
    Step2 -->|Success| Step3[Step 3: Parser call]
    Step3 -->|Error| Catch3[Catch: Throw error]
    Step3 -->|Success| Step4[Step 4: Markdown storage]
    Step4 -->|Error| Catch4[Catch: Return 500]
    Step4 -->|Success| Step5[Step 5: Database insert]
    Step5 -->|Error| Catch5[Catch: Return 500]
    Step5 -->|Success| Success[Return 200 with upload]

    Catch1 --> End1([Client: Show error toast])
    Catch2 --> End1
    Catch3 --> CatchAll[Catch all errors]
    Catch4 --> CatchAll
    Catch5 --> CatchAll
    CatchAll --> End1
    Success --> End2([Client: Navigate to editor])

    style Start fill:#e1f5ff
    style End1 fill:#ffcdd2
    style End2 fill:#c8e6c9
    style Catch1 fill:#ffcdd2
    style Catch2 fill:#ffcdd2
    style Catch3 fill:#ffcdd2
    style Catch4 fill:#ffcdd2
    style Catch5 fill:#ffcdd2
    style CatchAll fill:#ffcdd2
```

## Data Flow Diagram

```mermaid
graph TB
    subgraph "Input"
        A[File e.g. PDF]
        C[Schema ID]
    end

    subgraph "Processing"
        D[FormData]
        E[File Buffer]
        F[Timestamped Filename]
        H[Markdown Content]
        I[Markdown Path]
    end

    subgraph "Storage"
        J[Local Storage<br/>/storage/uploads/]
        K[Local Storage<br/>/storage/markdown/]
        L[PostgreSQL Database<br/>uploads table]
    end

    subgraph "Output"
        M[Upload Record]
        N[Markdown String]
    end

    A --> D
    C --> D
    D --> E
    E --> F
    F --> J
    E --> H
    H --> K
    K --> I
    I --> L
    L --> M
    H --> N

    style A fill:#e1f5ff
    style C fill:#e1f5ff
    style M fill:#c8e6c9
    style N fill:#c8e6c9
    style J fill:#f3e5f5
    style K fill:#f3e5f5
    style L fill:#e0f2f1
```

## API Endpoints

### Upload Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upload` | Upload a new file |
| GET | `/api/uploads` | List all uploads |
| GET | `/api/uploads/:uploadId` | Get single upload with markdown |
| PATCH | `/api/uploads/:uploadId` | Update upload metadata |
| DELETE | `/api/uploads/:uploadId` | Delete upload and associated data |
| PATCH | `/api/uploads/:uploadId/schema` | Apply or remove schema from upload |

### Chunk Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/uploads/:uploadId/chunks` | Get all chunks for an upload |
| POST | `/api/uploads/:uploadId/chunks` | Save chunks for an upload |
| DELETE | `/api/uploads/:uploadId/chunks` | Delete all chunks for an upload |

### Response Format

**Upload Response:**
```json
{
  "upload": {
    "id": "uuid",
    "title": "Document Title",
    "originalFilename": "document.pdf",
    "filePath": "uploads/1234567890-document.pdf",
    "fileSize": 1024000,
    "chunkingStrategy": "none",
    "metadata": {},
    "schemaId": "uuid | null",
    "customMetadata": {},
    "markdown": null,
    "markdownPath": "markdown/uuid.md",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "markdown": "# Document content..."
}
```

## Key Components

### Client-Side (`dashboard.tsx`)

**Key Functions:**
- `handleUpload`: Main upload handler that validates file, creates FormData, and sends request
- `deleteMutation`: Handles upload deletion with query invalidation

**State Management:**
- `uploading`: Boolean state to track upload progress
- `fileInputRef`: Reference to hidden file input element
- React Query for upload fetching and cache management

**User Feedback:**
- Toast notifications for success/error states
- Loading spinner during upload
- Automatic navigation to editor on success

### Client-Side (`UploadDialog.tsx`)

**Supported File Types:**
```typescript
const SUPPORTED_FILE_TYPES = [
  'application/pdf',
  // Future support can be added here
];

const SUPPORTED_EXTENSIONS = '.pdf';
```

**Features:**
- Drag and drop file upload
- File type validation
- Schema selection (required)
- Upload progress indication

### Server-Side (`upload.ts`)

**Key Steps:**
1. **File Validation**: Checks if file exists in request
2. **File Storage**: Saves file buffer to `/storage/uploads/` directory
3. **Parser Integration**: Sends file to Python parser service for markdown conversion
4. **Markdown Storage**: Stores converted markdown to `/storage/markdown/` directory
5. **Database Persistence**: Saves upload metadata with `markdownPath` to PostgreSQL

**Error Handling:**
- 400: No file uploaded
- 500: Storage upload failure, parser service failure, or database error

**File Naming:**
- Format: `${Date.now()}-${req.file.originalname}`
- Ensures unique filenames and prevents collisions

### Server-Side (`uploads.ts`)

**Markdown Retrieval:**
```typescript
async function getMarkdownContent(upload: Upload): Promise<string | null> {
  // Try markdownPath first (new storage method)
  if (upload.markdownPath) {
    const content = await downloadText('markdown', upload.markdownPath);
    if (content) {
      return content;
    }
  }
  // Fall back to markdown column (legacy)
  return upload.markdown || null;
}
```

## Environment Variables

- `PARSER_SERVICE_URL`: URL of the Python parser service (defaults to `http://localhost:8000`)
- `DATABASE_URL`: PostgreSQL connection string

## Dependencies

### Client
- `@tanstack/react-query`: Query management and cache invalidation
- `react-router-dom`: Navigation after successful upload
- `date-fns`: Date formatting for upload display

### Server
- `multer`: Multipart form data parsing
- `express`: HTTP server framework
- `drizzle-orm`: Database ORM for PostgreSQL

## Notes

- The upload process is synchronous and blocking - the client waits for the entire process to complete
- File size is stored in the database for reference
- Markdown content is stored in a separate storage directory for better organization
- The `markdown` column is kept for backward compatibility but new uploads use `markdownPath`
- The chunking strategy is initially set to `'none'` and will be updated when chunking is applied
- The system is designed to support multiple file types in the future (not just PDFs)
