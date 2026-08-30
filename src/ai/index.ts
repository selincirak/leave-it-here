import Constants from 'expo-constants';
import type { AIProvider } from './provider';
import { GeminiProvider } from './gemini';
import { BackendProvider } from './backend';

type Extra = {
  aiMode?: 'gemini-direct' | 'backend';
  geminiApiKey?: string | null;
  geminiModel?: string;
  aiBackendUrl?: string | null;
};

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

let _provider: AIProvider | null = null;

/**
 * Single place that decides which AI implementation runs.
 *
 * Hard rule: a non-dev build may ONLY use the backend proxy. A direct model
 * key in a release binary is a build error, not a runtime fallback.
 */
export function getAIProvider(): AIProvider {
  if (_provider) return _provider;

  const mode = extra.aiMode ?? 'gemini-direct';

  if (!__DEV__ && mode !== 'backend') {
    throw new Error(
      '[ai] Release builds must set EXPO_PUBLIC_AI_MODE=backend. Refusing to embed a model key.',
    );
  }

  if (mode === 'backend') {
    if (!extra.aiBackendUrl) throw new Error('[ai] EXPO_PUBLIC_AI_BACKEND_URL is not set.');
    _provider = new BackendProvider(extra.aiBackendUrl);
    return _provider;
  }

  const key = extra.geminiApiKey?.trim();
  if (!key || key === 'null' || key === 'undefined' || key.length < 20) {
    throw new Error('[ai] EXPO_PUBLIC_GEMINI_API_KEY is not set (dev only).');
  }
  _provider = new GeminiProvider(key, extra.geminiModel);
  return _provider;
}

export type { AIProvider, AnalyzeInput } from './provider';
