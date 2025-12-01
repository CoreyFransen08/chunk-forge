import fs from 'fs/promises';
import path from 'path';

/**
 * Local filesystem storage service for ChunkForge Open Source
 * Replaces Supabase Storage with local file system operations
 */

// Storage base directory - can be configured via environment variable
const STORAGE_BASE = process.env.STORAGE_PATH || path.join(process.cwd(), 'storage');

// Bucket directories
const BUCKETS = {
  uploads: 'uploads',        // Original uploaded files (PDFs, etc.)
  markdown: 'markdown',      // Converted markdown files
} as const;

type BucketName = keyof typeof BUCKETS;

/**
 * Ensure storage directories exist
 */
export async function initStorage(): Promise<void> {
  for (const bucket of Object.values(BUCKETS)) {
    const bucketPath = path.join(STORAGE_BASE, bucket);
    await fs.mkdir(bucketPath, { recursive: true });
  }
  console.log(`Storage initialized at: ${STORAGE_BASE}`);
}

/**
 * Get the full path for a file in a bucket
 */
function getFilePath(bucket: BucketName, filename: string): string {
  return path.join(STORAGE_BASE, BUCKETS[bucket], filename);
}

/**
 * Upload a file to local storage
 * @param bucket - The storage bucket name
 * @param filename - The filename to save as
 * @param data - The file data as Buffer
 * @returns The filename (for storing in database)
 */
export async function uploadFile(
  bucket: BucketName,
  filename: string,
  data: Buffer
): Promise<string> {
  const filePath = getFilePath(bucket, filename);
  await fs.writeFile(filePath, data);
  return filename;
}

/**
 * Upload a text file to local storage
 * @param bucket - The storage bucket name
 * @param filename - The filename to save as
 * @param content - The text content
 * @returns The filename (for storing in database)
 */
export async function uploadText(
  bucket: BucketName,
  filename: string,
  content: string
): Promise<string> {
  const filePath = getFilePath(bucket, filename);
  await fs.writeFile(filePath, content, 'utf-8');
  return filename;
}

/**
 * Download a file from local storage
 * @param bucket - The storage bucket name
 * @param filename - The filename to download
 * @returns The file data as Buffer
 */
export async function downloadFile(
  bucket: BucketName,
  filename: string
): Promise<Buffer> {
  const filePath = getFilePath(bucket, filename);
  return await fs.readFile(filePath);
}

/**
 * Download a text file from local storage
 * @param bucket - The storage bucket name
 * @param filename - The filename to download
 * @returns The file content as string
 */
export async function downloadText(
  bucket: BucketName,
  filename: string
): Promise<string> {
  const filePath = getFilePath(bucket, filename);
  return await fs.readFile(filePath, 'utf-8');
}

/**
 * Delete a file from local storage
 * @param bucket - The storage bucket name
 * @param filename - The filename to delete
 */
export async function deleteFile(
  bucket: BucketName,
  filename: string
): Promise<void> {
  const filePath = getFilePath(bucket, filename);
  try {
    await fs.unlink(filePath);
  } catch (error) {
    // Ignore if file doesn't exist
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}

/**
 * Check if a file exists in local storage
 * @param bucket - The storage bucket name
 * @param filename - The filename to check
 * @returns True if file exists
 */
export async function fileExists(
  bucket: BucketName,
  filename: string
): Promise<boolean> {
  const filePath = getFilePath(bucket, filename);
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the public URL for a file (for serving via Express)
 * @param bucket - The storage bucket name
 * @param filename - The filename
 * @returns The URL path to access the file
 */
export function getFileUrl(bucket: BucketName, filename: string): string {
  return `/storage/${BUCKETS[bucket]}/${filename}`;
}

/**
 * Get the absolute file path for a file
 * Used for serving files directly
 * @param bucket - The storage bucket name
 * @param filename - The filename
 * @returns The absolute file path
 */
export function getAbsolutePath(bucket: BucketName, filename: string): string {
  return getFilePath(bucket, filename);
}

/**
 * Generate a unique filename with timestamp prefix
 * @param originalFilename - The original filename
 * @returns A unique filename with timestamp
 */
export function generateFilename(originalFilename: string): string {
  const timestamp = Date.now();
  const safeName = originalFilename.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `${timestamp}-${safeName}`;
}

// Export bucket names for type safety
export { BUCKETS, type BucketName };
