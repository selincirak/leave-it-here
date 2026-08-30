import type { StateCreator } from 'zustand';
import type { Item } from '@/types';
import * as repo from '@/db/items';
import { haptic } from '@/lib/haptics';
import {
  cancelReminder,
  requestPermission,
  scheduleReminder,
} from '@/lib/notifications';
import type { Store } from './index';

/**
 * Reminders are the ONLY resurfacing mechanism in the MVP.
 * Two entry points, both explicit:
 *   1. setReminder(id, when)      — user picks a time
 *   2. acceptSuggestedDate(id)    — user accepts an AI-detected deadline
 * There is no automatic "oldest item" resurfacing.
 */
export interface RemindersSlice {
  setReminder: (id: string, fireAt: number) => Promise<void>;
  clearReminder: (id: string) => Promise<void>;
  acceptSuggestedDate: (id: string) => Promise<void>;
}

async function applyReminder(
  item: Item,
  fireAt: number,
  accepted: boolean,
): Promise<Partial<Item>> {
  const granted = await requestPermission();
  await cancelReminder(item.reminderNotifId);
  let notifId: string | null = null;
  if (granted) {
    notifId = await scheduleReminder(
      item.id,
      fireAt,
      item.title ?? 'Something you left',
      item.intent,
    );
  }
  return {
    reminderAt: fireAt,
    reminderNotifId: notifId,
    suggestedDateAccepted: accepted || item.suggestedDateAccepted,
  };
}

export const createRemindersSlice: StateCreator<
  Store,
  [],
  [],
  RemindersSlice
> = (_set, get) => ({
  setReminder: async (id, fireAt) => {
    const item = get().items[id];
    if (!item) return;
    const patch = await applyReminder(item, fireAt, false);
    get().replaceLocal({ ...item, ...patch });
    await repo.updateItem(id, patch);
    haptic.set();
  },

  clearReminder: async (id) => {
    const item = get().items[id];
    if (!item) return;
    await cancelReminder(item.reminderNotifId);
    const patch: Partial<Item> = { reminderAt: null, reminderNotifId: null };
    get().replaceLocal({ ...item, ...patch });
    await repo.updateItem(id, patch);
  },

  acceptSuggestedDate: async (id) => {
    const item = get().items[id];
    if (!item?.suggestedDate) return;
    const patch = await applyReminder(item, item.suggestedDate, true);
    get().replaceLocal({ ...item, ...patch });
    await repo.updateItem(id, patch);
    haptic.set();
  },
});
