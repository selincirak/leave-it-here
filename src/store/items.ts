import { Platform } from 'react-native';
import type { StateCreator } from 'zustand';
import type { Store } from './index';
import type { Item, ItemKind } from '@/types';
import { newId, contentHash } from '@/lib/id';
import { guessIntent, looksSensitive, splitUrl } from '@/lib/classify';
import { importImage, deleteFile } from '@/lib/files';
import { cancelReminder } from '@/lib/notifications';
import * as repo from '@/db/items';
import { processItem, drainQueue } from '@/ai/queue';

const DEDUPE_WINDOW_MS = 15_000;

/** How long a saved-without-reminder item rests on Home's "just left" shelf. */
export const RECENTLY_LEFT_WINDOW = 4 * 24 * 60 * 60 * 1000;

export interface DropInput {
  kind: ItemKind;
  rawText?: string;
  imageUri?: string;
  sourceApp?: string;
  /** optional context captured alongside the content */
  note?: string;
}

function placeholderTitle(kind: ItemKind, rawText: string | null): string | null {
  // Images get no placeholder — the thumbnail is the identity, the user can
  // name it on the confirmation sheet, and AI fills a real title later.
  // "Screenshot" as a title makes every capture feel anonymous.
  if (kind === 'image') return null;
  const t = (rawText ?? '').trim();
  if (kind === 'link') {
    try {
      return new URL(t).hostname.replace(/^www\./, '');
    } catch {
      return 'link';
    }
  }
  return t.split('\n')[0]?.slice(0, 60) || null;
}

export interface ItemsSlice {
  items: Record<string, Item>;
  hydrated: boolean;
  /** true only until the very first item is ever saved — drives the first-run hint */
  libraryEmpty: boolean;
  /** the id of the drop that should play its landing animation on Home, once */
  justLandedId: string | null;

  hydrate: () => Promise<void>;
  clearJustLanded: () => void;
  /**
   * The Everything list. One source per platform: SQLite on native, the
   * in-memory session store on web (no SQLite there). Never both.
   */
  listEverything: (opts?: {
    query?: string;
    intent?: string | null;
    kind?: string | null;
  }) => Promise<Item[]>;
  /** Reload one item from the DB into local state (e.g. after AI finishes). */
  hydrateOne: (id: string) => Promise<void>;
  /** Optimistic. Inserts immediately, enqueues AI, never blocks. */
  drop: (input: DropInput) => Promise<string>;
  editField: (id: string, field: keyof Item, value: unknown) => Promise<void>;
  /** Optional free-text note, added/edited on the detail screen. */
  setNote: (id: string, note: string) => Promise<void>;
  archive: (id: string, archived: boolean) => Promise<void>;
  /** User chose to keep a sensitive-flagged item anyway. */
  acknowledgeSensitive: (id: string) => Promise<void>;
  setPinned: (id: string, pinned: boolean) => Promise<void>;
  /** Permanent delete — "let go". Cancels reminder + removes the file. */
  remove: (id: string) => Promise<void>;
  replaceLocal: (item: Item) => void;
}

export const createItemsSlice: StateCreator<
  Store,
  [],
  [],
  ItemsSlice
> = (set, get) => ({
  items: {},
  hydrated: false,
  libraryEmpty: false,
  justLandedId: null,

  clearJustLanded: () => set({ justLandedId: null }),

  listEverything: async (opts = {}) => {
    if (Platform.OS !== 'web') {
      try {
        return await repo.listItems(opts);
      } catch {
        return [];
      }
    }
    const { query, intent, kind } = opts;
    const q = query?.trim().toLowerCase();
    return Object.values(get().items)
      .filter(
        (i) =>
          (!intent || i.intent === intent) &&
          (!kind || i.kind === kind) &&
          (!q ||
            `${i.title ?? ''} ${i.rawText ?? ''} ${i.note ?? ''} ${i.summary ?? ''}`
              .toLowerCase()
              .includes(q)),
      )
      .sort((a, b) => b.createdAt - a.createdAt);
  },

  hydrate: async () => {
    // Load the working set: due + upcoming reminders, the recent "shelf", and
    // anything still processing.
    try {
      const [due, upcoming, recent, processing, total] = await Promise.all([
        repo.getDueReminders(),
        repo.getUpcomingReminders(),
        repo.getRecentlyLeft(RECENTLY_LEFT_WINDOW),
        repo.getProcessingItems(),
        repo.countItems(),
      ]);
      const map: Record<string, Item> = {};
      for (const it of [...due, ...upcoming, ...recent, ...processing]) map[it.id] = it;
      set({ items: map, libraryEmpty: total === 0 });
      drainQueue();
    } catch (err) {
      if (__DEV__) console.warn('[store] hydrate failed', err);
    } finally {
      set({ hydrated: true });
    }
  },

  hydrateOne: async (id) => {
    try {
      const fresh = await repo.getItem(id);
      if (fresh) set((s) => ({ items: { ...s.items, [id]: fresh } }));
    } catch {
      /* no DB (e.g. web preview) — keep the in-memory copy */
    }
  },

  drop: async (input) => {
    const now = Date.now();

    // Deterministic content type, decided before any classification: a URL
    // anywhere → link, with the surrounding text kept as the note. No URL →
    // text. Images are explicit and never re-derived.
    let kind = input.kind;
    let rawText = input.rawText ?? null;
    let note = input.note?.trim() || null;
    if (kind !== 'image' && rawText) {
      const { url, rest } = splitUrl(rawText);
      kind = url ? 'link' : 'text';
      if (url) {
        rawText = url;
        if (rest && !note) note = rest;
      }
    }

    const hashSrc = input.imageUri ?? rawText ?? '';
    const hash = contentHash(hashSrc);

    // Storage is best-effort: if the DB is unavailable (e.g. web preview) the
    // drop still lands and lives in memory for the session.
    let dup: Item | null = null;
    try {
      dup = await repo.findByHash(hash, DEDUPE_WINDOW_MS);
    } catch {
      /* no DB — skip dedupe */
    }
    if (dup) return dup.id;

    const id = newId();
    let fileUri: string | null = null;

    const optimistic: Item = {
      id,
      kind,
      status: 'processing',
      createdAt: now,
      updatedAt: now,
      rawText,
      fileUri: null,
      note,
      sourceApp: input.sourceApp ?? null,
      contentHash: hash,
      title: placeholderTitle(kind, rawText),
      summary: null,
      // instant offline guess from everything we have; AI refines it later
      intent: guessIntent([rawText, note].filter(Boolean).join(' ')),
      suggestedDate: null,
      aiConfidence: null,
      aiRaw: null,
      sensitive: looksSensitive(rawText) || looksSensitive(note),
      sensitiveAck: false,
      archivedAt: null,
      pinned: false,
      userEditedFields: [],
      reminderAt: null,
      reminderNotifId: null,
      suggestedDateAccepted: false,
    };

    set((s) => ({
      items: { ...s.items, [id]: optimistic },
      libraryEmpty: false,
      justLandedId: id,
    }));

    // Heavy work off the render path.
    if (input.imageUri) {
      try {
        fileUri = await importImage(input.imageUri);
      } catch {
        fileUri = input.imageUri; // fall back to original
      }
    }

    const persisted: Item = { ...optimistic, fileUri };
    try {
      await repo.insertItem(persisted);
    } catch (err) {
      if (__DEV__) console.warn('[store] insert failed — item kept in memory only', err);
    }
    set((s) => ({ items: { ...s.items, [id]: persisted } }));

    processItem(id)
      .then(() => get().hydrateOne(id))
      .catch(() => {});
    return id;
  },

  editField: async (id, field, value) => {
    const current = get().items[id];
    if (!current) return;
    const userEditedFields = Array.from(
      new Set([...current.userEditedFields, String(field)]),
    );
    const patch = { [field]: value, userEditedFields } as Partial<Item>;
    set((s) => ({ items: { ...s.items, [id]: { ...current, ...patch } } }));
    await repo.updateItem(id, patch);
  },

  archive: async (id, archived) => {
    const current = get().items[id];
    if (!current) return;
    const archivedAt = archived ? Date.now() : null;
    set((s) => ({ items: { ...s.items, [id]: { ...current, archivedAt } } }));
    await repo.updateItem(id, { archivedAt });
  },

  setNote: async (id, note) => {
    const current = get().items[id];
    if (!current) return;
    const value = note.trim() || null;
    if (value === (current.note ?? null)) return;
    set((s) => ({ items: { ...s.items, [id]: { ...current, note: value } } }));
    await repo.updateItem(id, { note: value });
  },

  acknowledgeSensitive: async (id) => {
    const current = get().items[id];
    if (!current) return;
    set((s) => ({ items: { ...s.items, [id]: { ...current, sensitiveAck: true } } }));
    await repo.updateItem(id, { sensitiveAck: true });
  },

  setPinned: async (id, pinned) => {
    const current = get().items[id];
    if (!current) return;
    set((s) => ({ items: { ...s.items, [id]: { ...current, pinned } } }));
    await repo.updateItem(id, { pinned });
  },

  remove: async (id) => {
    const current = get().items[id];
    if (current?.reminderNotifId) await cancelReminder(current.reminderNotifId);
    if (current?.fileUri) await deleteFile(current.fileUri);
    set((s) => {
      const next = { ...s.items };
      delete next[id];
      return { items: next };
    });
    await repo.deleteItem(id);
  },

  replaceLocal: (item) =>
    set((s) => ({ items: { ...s.items, [item.id]: item } })),
});
