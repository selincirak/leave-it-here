import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { useShareIntent } from 'expo-share-intent';
import { useStore } from '@/store';
import { drainQueue } from '@/ai/queue';
import { colors } from '@/theme';
import { useAppFonts } from '@/theme/fonts';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const fontsLoaded = useAppFonts();
  const hydrate = useStore((s) => s.hydrate);
  const drop = useStore((s) => s.drop);
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  // Re-drain the AI queue whenever the app comes to the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') drainQueue();
    });
    return () => sub.remove();
  }, []);

  // Route incoming shares straight into the Drop flow. It's already saved; the
  // sheet just lets you name a photo before it goes (never required).
  useEffect(() => {
    if (!hasShareIntent) return;
    (async () => {
      let id: string | null = null;
      if (shareIntent.files?.length) {
        id = await drop({ kind: 'image', imageUri: shareIntent.files[0].path });
      } else if (shareIntent.webUrl) {
        id = await drop({ kind: 'link', rawText: shareIntent.webUrl });
      } else if (shareIntent.text) {
        // drop() decides text vs link (and pulls any URL out of the text)
        id = await drop({ kind: 'text', rawText: shareIntent.text });
      }
      resetShareIntent();
      router.replace(id ? `/drop?saved=${id}` : '/');
    })();
  }, [hasShareIntent, shareIntent, drop, resetShareIntent]);

  // Reminder tap -> open straight to that exact item. One guard covers both the
  // warm listener and the cold-start response so a single tap navigates once.
  const handledNotif = useRef<string | null>(null);
  const openFromNotification = (id: unknown, key: string) => {
    if (typeof id !== 'string' || handledNotif.current === key) return;
    handledNotif.current = key;
    router.push(`/item/${id}`);
  };

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = Notifications.addNotificationResponseReceivedListener((res) => {
      openFromNotification(
        res.notification.request.content.data?.itemId,
        res.notification.request.identifier,
      );
    });
    return () => sub.remove();
  }, []);

  // expo-notifications has no web implementation; Platform.OS is stable per session.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const lastResponse =
    Platform.OS === 'web' ? null : Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!lastResponse) return;
    openFromNotification(
      lastResponse.notification.request.content.data?.itemId,
      lastResponse.notification.request.identifier,
    );
  }, [lastResponse]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.paper },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen
            name="drop"
            options={{
              presentation: 'transparentModal',
              animation: 'none',
              contentStyle: { backgroundColor: 'transparent' },
            }}
          />
          <Stack.Screen name="item/[id]" />
          <Stack.Screen name="search" />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
