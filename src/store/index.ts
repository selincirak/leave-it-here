import { create } from 'zustand';
import { createItemsSlice, RECENTLY_LEFT_WINDOW, type ItemsSlice } from './items';
import { createRemindersSlice, type RemindersSlice } from './reminders';
import {
  createEntitlementsSlice,
  type EntitlementsSlice,
} from './entitlements';

export type Store = ItemsSlice & RemindersSlice & EntitlementsSlice;

export const useStore = create<Store>()((...a) => ({
  ...createItemsSlice(...a),
  ...createRemindersSlice(...a),
  ...createEntitlementsSlice(...a),
}));

// ---- selectors: Home shows only what's relevant now ----

/** Due or overdue reminders + accepted deadlines that have arrived. */
export const selectReadyToComeBack = (s: Store) => {
  const now = Date.now();
  return Object.values(s.items)
    .filter((i) => !i.archivedAt && i.reminderAt != null && i.reminderAt <= now)
    .sort((a, b) => (a.reminderAt ?? 0) - (b.reminderAt ?? 0));
};

/** Future reminders, soonest first. */
export const selectUpcoming = (s: Store) => {
  const now = Date.now();
  return Object.values(s.items)
    .filter((i) => !i.archivedAt && i.reminderAt != null && i.reminderAt > now)
    .sort((a, b) => (a.reminderAt ?? 0) - (b.reminderAt ?? 0));
};

/**
 * "Just left" — the few most recent drops, so saving lands somewhere visible.
 * Not an archive: capped at 3, only items with no reminder (those live in
 * "coming up"), and only for a few days after they're dropped.
 */
export { RECENTLY_LEFT_WINDOW };

export const selectRecentlyLeft = (s: Store) => {
  const cutoff = Date.now() - RECENTLY_LEFT_WINDOW;
  return Object.values(s.items)
    .filter(
      (i) => !i.archivedAt && i.reminderAt == null && i.createdAt >= cutoff,
    )
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 3);
};

export const selectItem = (id: string) => (s: Store) => s.items[id];
