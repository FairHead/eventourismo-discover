/**
 * Deduplication utilities for venue ingestion
 */

/**
 * Normalize venue name for comparison
 * Removes common business suffixes, punctuation, and normalizes whitespace
 */
export function normalizeName(s: string): string {
  if (!s) return '';
  
  return s
    .toLowerCase()
    .replace(/\s+/g, ' ') // normalize whitespace
    .replace(/[.,''"]/g, '') // remove punctuation
    .replace(/\b(e\.?\s?v\.?|gmbh|ug|ag|e\.?k\.?|inc\.?|llc|ltd\.?|corp\.?|co\.?)\b/g, '') // business suffixes
    .replace(/\s-\s/g, ' ') // normalize dashes
    .trim();
}

/**
 * Merge source arrays, avoiding duplicates by src:id combination
 */
export function mergeSources(existingSources: any[] = [], newSources: any[] = []): any[] {
  const sourceMap = new Map<string, any>();
  
  // Add existing sources first
  existingSources.forEach(source => {
    if (source?.src && source?.id) {
      sourceMap.set(`${source.src}:${source.id}`, source);
    }
  });
  
  // Add new sources, overwriting if same key
  newSources.forEach(source => {
    if (source?.src && source?.id) {
      sourceMap.set(`${source.src}:${source.id}`, source);
    }
  });
  
  return Array.from(sourceMap.values());
}

/**
 * Merge two arrays, removing duplicates
 */
export function mergeArrays<T>(existing: T[] = [], newItems: T[] = []): T[] {
  const combined = [...existing, ...newItems];
  return [...new Set(combined)];
}

/**
 * Get a better name by preferring longer, more descriptive names
 */
export function getBetterName(name1: string, name2: string): string {
  if (!name1) return name2;
  if (!name2) return name1;
  
  // Prefer longer names that are likely more descriptive
  if (name2.length > name1.length + 5) {
    return name2;
  }
  
  return name1;
}

/**
 * Retry with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      // Calculate delay with exponential backoff + jitter
      const delay = initialDelay * Math.pow(2, attempt) + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}