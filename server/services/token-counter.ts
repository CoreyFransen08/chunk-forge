import { encoding_for_model } from "tiktoken";
import type { TiktokenModel } from "tiktoken";

// Create encoder once at module load for efficiency
// Uses cl100k_base encoding (GPT-4, GPT-3.5-turbo, text-embedding-ada-002)
let encoder: ReturnType<typeof encoding_for_model> | null = null;

function getEncoder() {
  if (!encoder) {
    encoder = encoding_for_model("gpt-4" as TiktokenModel);
  }
  return encoder;
}

/**
 * Count tokens in a text string using tiktoken.
 * Uses cl100k_base encoding (same as GPT-4).
 */
export function countTokens(text: string): number {
  const enc = getEncoder();
  const tokens = enc.encode(text);
  return tokens.length;
}

/**
 * Count tokens for multiple texts.
 * More efficient than calling countTokens multiple times.
 */
export function countTokensBatch(texts: string[]): number[] {
  const enc = getEncoder();
  return texts.map((text) => enc.encode(text).length);
}

/**
 * Free the encoder when done (optional cleanup).
 * Call this if you need to release memory.
 */
export function freeEncoder(): void {
  if (encoder) {
    encoder.free();
    encoder = null;
  }
}
