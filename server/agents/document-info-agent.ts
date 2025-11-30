import { Agent } from "@mastra/core/agent";
import { z } from "zod";

/**
 * Schema for structured output from the document info extraction agent.
 * Defines the exact shape of metadata to extract from documents.
 */
export const documentInfoSchema = z.object({
  title: z.string().describe("The document title, extracted from headings or inferred from content"),
  author: z.string().nullable().describe("The document author if mentioned, null if not found"),
  description: z.string().describe("A brief 1-2 sentence summary of the document's main topic"),
});

export type DocumentInfo = z.infer<typeof documentInfoSchema>;

/**
 * The document info extraction agent.
 * Analyzes the beginning of documents to extract title, author, and description.
 */
export const documentInfoAgent = new Agent({
  name: "document-info-agent",
  instructions: `You are a document metadata extraction specialist. Your task is to analyze the beginning of a document and extract:

1. **Title**: Look for the main heading (usually H1 or the most prominent title at the start). If no clear title exists, infer a concise, descriptive title from the content.

2. **Author**: Look for author attribution, bylines, "written by" statements, or author names near the title. Return null if no author is found - do not guess.

3. **Description**: Write a concise 1-2 sentence summary of what the document is about based on the content provided. Focus on the main topic and purpose.

Guidelines:
- Be accurate and only extract information that is clearly present or reasonably inferable
- For title, prefer explicit headings over inferred titles
- For author, only include if explicitly mentioned
- For description, be concise but informative`,
  model: "openai/gpt-4o-mini",
});

/**
 * Extract the first N pages from markdown using the page separator.
 * The parser service uses "\n---\n" as the default page separator.
 */
function extractFirstPages(markdown: string, pageCount: number = 3): string {
  const pageSeparator = "\n---\n";
  const pages = markdown.split(pageSeparator);
  return pages.slice(0, pageCount).join(pageSeparator);
}

/**
 * Extract document info (title, author, description) from document markdown.
 *
 * @param markdown - Full document markdown content
 * @returns Extracted document info
 */
export async function extractDocumentInfo(markdown: string): Promise<DocumentInfo> {
  // Extract first 3 pages for analysis
  const contentToAnalyze = extractFirstPages(markdown, 3);

  // Call the agent with structured output
  const response = await documentInfoAgent.generate(
    [
      {
        role: "user",
        content: `Please extract the title, author, and description from the following document content:\n\n${contentToAnalyze}`,
      },
    ],
    {
      structuredOutput: {
        schema: documentInfoSchema,
      },
    }
  );

  return response.object as DocumentInfo;
}
