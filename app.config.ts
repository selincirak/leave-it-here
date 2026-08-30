import type { ExpoConfig, ConfigContext } from 'expo/config';

/**
 * AI configuration is injected here at build time.
 *
 * MVP rule: NO production API key ships in the client.
 *  - In development we may call Gemini directly using EXPO_PUBLIC_GEMINI_API_KEY
 *    from a local, git-ignored .env file.
 *  - Any non-dev build MUST use aiMode "backend" and route through
 *    EXPO_PUBLIC_AI_BACKEND_URL (an Edge Function / server proxy that holds
 *    the real key). See src/ai/index.ts for the runtime guard.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Leave It Here',
  slug: 'leave-it-here',
  scheme: 'leaveithere',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.leaveithere.app',
  },
  android: {
    package: 'com.leaveithere.app',
  },
  plugins: [
    'expo-router',
    'expo-sqlite',
    'expo-notifications',
    [
      'expo-share-intent',
      {
        iosActivationRules: {
          NSExtensionActivationSupportsText: true,
          NSExtensionActivationSupportsWebURLWithMaxCount: 1,
          NSExtensionActivationSupportsImageWithMaxCount: 1,
        },
      },
    ],
    [
      'expo-image-picker',
      { photosPermission: 'Leave It Here saves the screenshots and photos you drop in.' },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    aiMode: process.env.EXPO_PUBLIC_AI_MODE ?? 'gemini-direct', // 'gemini-direct' | 'backend'
    geminiApiKey: process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? null,
    geminiModel: process.env.EXPO_PUBLIC_GEMINI_MODEL ?? 'gemini-2.0-flash',
    aiBackendUrl: process.env.EXPO_PUBLIC_AI_BACKEND_URL ?? null,
  },
});
