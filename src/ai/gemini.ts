import type { AIResult } from '@/types';
import {
  AIProvider,
  AnalyzeInput,
  extractJson,
  parseAIResult,
} from './provider';
import { SYSTEM_PROMPT, buildUserPrompt } from './prompt';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * DEV-ONLY direct Gemini client. The key lives in a local .env and must never
 * ship in a release build (enforced in src/ai/index.ts). In production the same
 * AIProvider contract is fulfilled by BackendProvider instead.
 */
export class GeminiProvider implements AIProvider {
  readonly name = 'gemini-direct';

  constructor(
    private apiKey: string,
    private model = 'gemini-2.0-flash',
  ) {}

  async analyze(input: AnalyzeInput): Promise<AIResult> {
    const parts: any[] = [{ text: buildUserPrompt(input) }];
    if (input.type === 'image') {
      parts.push({
        inline_data: { mime_type: input.mimeType, data: input.base64 },
      });
    }

    const res = await fetch(
      `${ENDPOINT}/${this.model}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: 'user', parts }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
        }),
      },
    );

    if (!res.ok) {
      throw new Error(`gemini ${res.status}: ${await res.text()}`);
    }

    const json = await res.json();
    const text: string =
      json?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') ?? '';
    return parseAIResult(extractJson(text));
  }
}
