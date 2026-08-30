import { nanoid } from 'nanoid/non-secure';

export const newId = (): string => nanoid(16);

/** Cheap, stable hash for share-intent dedupe. Not cryptographic. */
export function contentHash(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = (h * 33) ^ input.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}
