import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { Intent } from '@/types';

const CHANNEL_ID = 'reminders';

const NUDGE: Record<Intent, string> = {
  watch: 'Time to watch this',
  read: 'Time to read this',
  buy: 'Time to buy this',
  go: 'Time to go',
  try: 'Time to try this',
  do: 'Time to do this',
  keep: 'Bringing this back to you',
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let channelReady = false;
async function ensureChannel(): Promise<void> {
  if (channelReady || Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Reminders',
    importance: Notifications.AndroidImportance.HIGH,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
  channelReady = true;
}

export async function requestPermission(): Promise<boolean> {
  await ensureChannel();
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.status === 'granted';
}

/**
 * Schedule a local reminder for an item. Fires at the chosen time; tapping it
 * opens straight to the item (handled in app/_layout.tsx via `data.itemId`).
 * Returns the notification id so it can be cancelled / rescheduled.
 */
export async function scheduleReminder(
  itemId: string,
  fireAt: number,
  itemTitle: string,
  intent: Intent | null,
): Promise<string> {
  await ensureChannel();
  return Notifications.scheduleNotificationAsync({
    content: {
      // Clear title (what to do) + body (the thing) — never just the raw text.
      title: intent ? NUDGE[intent] : 'Here it is again',
      body: itemTitle,
      data: { itemId },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(fireAt),
      channelId: CHANNEL_ID,
    },
  });
}

export async function cancelReminder(notifId: string | null): Promise<void> {
  if (!notifId) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notifId);
  } catch {
    /* noop */
  }
}
