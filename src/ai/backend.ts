import type { AIResult } from '@/types';
import { AIProvider, AnalyzeInput, parseAIResult } from './provider';

/**
 * Production path. Points at an Edge Function / server proxy that holds the
 * real model key and can be re-pointed at any provider without an app update.
 * The proxy is expected to return an object matching aiResultSchema directly.
 */
export class BackendProvider implements AIProvider {
  readonly name = 'backend';

  constructor(private endpoint: string) {}

  async analyze(input: AnalyzeInput): Promise<AIResult> {
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // TODO: attach the user's auth token here once auth exists.
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      throw new Error(`ai backend ${res.status}: ${await res.text()}`);
    }
    return parseAIResult(await res.json());
  }
}
