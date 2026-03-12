/**
 * Prompt Utilities - Sanitize user input for AI prompts
 * Single Responsibility: Prevent prompt injection via player names and other user input
 */

/**
 * Sanitize a string for safe inclusion in AI prompts.
 * - Truncate to maxLength chars
 * - Strip non-word chars except spaces, hyphens, apostrophes
 * - Strip newlines and control characters
 * - Fallback to default if empty after sanitization
 */
export function sanitizeForPrompt(input: string, maxLength: number = 15, fallback: string = 'Adventurer'): string {
  if (!input || typeof input !== 'string') return fallback;

  let sanitized = input
    .replace(/[\n\r\t]/g, '')              // Strip newlines and tabs
    .replace(/[^\w\s\-']/g, '')            // Keep word chars, spaces, hyphens, apostrophes
    .trim()
    .slice(0, maxLength);

  if (!sanitized || sanitized.length === 0) return fallback;

  return sanitized;
}
