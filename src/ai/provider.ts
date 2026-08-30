import { z } from 'zod';
import type { AIResult, Intent } from '@/types';
import { INTENTS } from '@/types';

export type AnalyzeInput =
  | { type: 'image'; base64: string; mimeType: string; note?: string }
  | { type: 'text'; text: string; url?: string };

/**
 * The only surface the app depends on. Swapping models = new implementation.
 * Implementations must NOT throw for "model gave junk" — they return null-ish
 * via validation failure so the queue can mark the item failed and retry.
 */
export interface AIProvider {
  readonly name: string;
  analyze(input: AnalyzeInput): Promise<AIResult>;
}

export const aiResultSchema = z.object({
  title: z.string().min(1).max(120),
  summary: z.string().max(400),
  intent: z.enum(INTENTS as [Intent, ...Intent[]]),
  suggestedDate: z.string().datetime().nullable().catch(null),
  sensitive: z.boolean().catch(false),
  confidence: z.number().min(0).max(1).catch(0.5),
});

export function parseAIResult(raw: unknown): AIResult {
  return aiResultSchema.parse(raw);
}

/** Tolerant extraction of a JSON object from a model's text response. */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('no JSON object in response');
  return JSON.parse(candidate.slice(start, end + 1));
}
