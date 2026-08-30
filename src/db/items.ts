import { Platform } from 'react-native';
import type { Item } from '@/types';
import { getDb } from './client';

/** Web preview has no SQLite — writes are no-ops, the in-memory store is enough. */
const NO_DB = Platform.OS === 'web';

type Row = Record<string, any>;

function toItem(r: Row): Item {
  return {
    id: r.id,
    kind: r.kind,
    status: r.status,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    rawText: r.rawText ?? null,
    fileUri: r.fileUri ?? null,
    note: r.note ?? null,
    sourceApp: r.sourceApp ?? null,
    contentHash: r.contentHash ?? null,
    title: r.title ?? null,
    summary: r.summary ?? null,
    intent: r.intent ?? null,
    suggestedDate: r.suggestedDate ?? null,
    aiConfidence: r.aiConfidence ?? null,
    aiRaw: r.aiRaw ?? null,
    archivedAt: r.archivedAt ?? null,
    pinned: !!r.pinned,
    userEditedFields: safeParse(r.userEditedFields),
    reminderAt: r.reminderAt ?? null,
    reminderNotifId: r.reminderNotifId ?? null,
    suggestedDateAccepted: !!r.suggestedDateAccepted,
    sensitive: !!r.sensitive,
    sensitiveAck: !!r.sensitiveAck,
  };
}

function safeParse(s: unknown): string[] {
  try {
    return Array.isArray(JSON.parse(String(s))) ? JSON.parse(String(s)) : [];
  } catch {
    return [];
  }
}

const COLUMNS = [
  'id', 'kind', 'status', 'createdAt', 'updatedAt', 'rawText', 'fileUri', 'note',
  'sourceApp', 'contentHash', 'title', 'summary', 'intent', 'suggestedDate',
  'aiConfidence', 'aiRaw', 'archivedAt', 'pinned', 'userEditedFields',
  'reminderAt', 'reminderNotifId', 'suggestedDateAccepted', 'sensitive', 'sensitiveAck',
] as const;

function serialize(item: Item): Record<string, any> {
  return {
    ...item,
    pinned: item.pinned ? 1 : 0,
    suggestedDateAccepted: item.suggestedDateAccepted ? 1 : 0,
    sensitive: item.sensitive ? 1 : 0,
    sensitiveAck: item.sensitiveAck ? 1 : 0,
    userEditedFields: JSON.stringify(item.userEditedFields ?? []),
  };
}

export async function insertItem(item: Item): Promise<void> {
  if (NO_DB) return;
  const db = await getDb();
  const s = serialize(item);
  const placeholders = COLUMNS.map((c) => `$${c}`).join(', ');
  await db.runAsync(
    `INSERT INTO items (${COLUMNS.join(', ')}) VALUES (${placeholders})`,
    Object.fromEntries(COLUMNS.map((c) => [`$${c}`, s[c] ?? null])),
  );
}

export async function updateItem(id: string, patch: Partial<Item>): Promise<void> {
  if (NO_DB) return;
  const db = await getDb();
  const existing = await getItem(id);
  if (!existing) return;
  const next = serialize({ ...existing, ...patch, id, updatedAt: Date.now() });
  const cols = COLUMNS.filter((c) => c !== 'id');
  await db.runAsync(
    `UPDATE items SET ${cols.map((c) => `${c} = $${c}`).join(', ')} WHERE id = $id`,
    Object.fromEntries([
      ['$id', id],
      ...cols.map((c) => [`$${c}`, next[c] ?? null]),
    ]),
  );
}

export async function getItem(id: string): Promise<Item | null> {
  if (NO_DB) return null;
  const db = await getDb();
  const row = await db.getFirstAsync<Row>('SELECT * FROM items WHERE id = ?', [id]);
  return row ? toItem(row) : null;
}

export async function findByHash(hash: string, sinceMs: number): Promise<Item | null> {
  if (NO_DB) return null;
  const db = await getDb();
  const row = await db.getFirstAsync<Row>(
    'SELECT * FROM items WHERE contentHash = ? AND createdAt >= ? ORDER BY createdAt DESC LIMIT 1',
    [hash, Date.now() - sinceMs],
  );
  return row ? toItem(row) : null;
}

/** Items whose AI pass never landed (processing or previously failed) — re-queued on launch. */
export async function getProcessingItems(): Promise<Item[]> {
  if (NO_DB) return [];
  const db = await getDb();
  const rows = await db.getAllAsync<Row>(
    "SELECT * FROM items WHERE status IN ('processing', 'failed') ORDER BY createdAt ASC",
  );
  return rows.map(toItem);
}

/** Reminders that are due or overdue and not archived — "ready to come back". */
export async function getDueReminders(now = Date.now()): Promise<Item[]> {
  if (NO_DB) return [];
  const db = await getDb();
  const rows = await db.getAllAsync<Row>(
    'SELECT * FROM items WHERE reminderAt IS NOT NULL AND reminderAt <= ? AND archivedAt IS NULL ORDER BY reminderAt ASC',
    [now],
  );
  return rows.map(toItem);
}

/** Upcoming reminders (future) — not archived. */
export async function getUpcomingReminders(now = Date.now()): Promise<Item[]> {
  if (NO_DB) return [];
  const db = await getDb();
  const rows = await db.getAllAsync<Row>(
    'SELECT * FROM items WHERE reminderAt IS NOT NULL AND reminderAt > ? AND archivedAt IS NULL ORDER BY reminderAt ASC',
    [now],
  );
  return rows.map(toItem);
}

/** The last few un-reminded, un-archived drops — Home's "just left" shelf. */
export async function getRecentlyLeft(sinceMs: number, limit = 3): Promise<Item[]> {
  if (NO_DB) return [];
  const db = await getDb();
  const rows = await db.getAllAsync<Row>(
    `SELECT * FROM items
     WHERE reminderAt IS NULL AND archivedAt IS NULL AND createdAt >= ?
     ORDER BY createdAt DESC LIMIT ?`,
    [Date.now() - sinceMs, limit],
  );
  return rows.map(toItem);
}

export async function search(query: string, limit = 50): Promise<Item[]> {
  if (NO_DB) return [];
  const db = await getDb();
  const q = query.trim();
  if (!q) return [];
  try {
    const rows = await db.getAllAsync<Row>(
      `SELECT items.* FROM items
       JOIN items_fts ON items_fts.id = items.id
       WHERE items_fts MATCH ?
       ORDER BY rank LIMIT ?`,
      [`${q}*`, limit],
    );
    return rows.map(toItem);
  } catch {
    // FTS unavailable / bad query — fall back to LIKE
    const like = `%${q}%`;
    const rows = await db.getAllAsync<Row>(
      `SELECT * FROM items
       WHERE title LIKE ? OR summary LIKE ? OR rawText LIKE ?
       ORDER BY createdAt DESC LIMIT ?`,
      [like, like, like, limit],
    );
    return rows.map(toItem);
  }
}

/** The "everything" view: browse by AI intent and/or free text. */
export async function listItems(
  opts: { query?: string; intent?: string | null; kind?: string | null } = {},
): Promise<Item[]> {
  const match = (i: Item) =>
    (!opts.intent || i.intent === opts.intent) && (!opts.kind || i.kind === opts.kind);

  if (NO_DB) return [];

  const q = opts.query?.trim();
  if (q) return (await search(q, 200)).filter(match);

  const where: string[] = [];
  const args: string[] = [];
  if (opts.intent) {
    where.push('intent = ?');
    args.push(opts.intent);
  }
  if (opts.kind) {
    where.push('kind = ?');
    args.push(opts.kind);
  }
  const db = await getDb();
  const rows = await db.getAllAsync<Row>(
    `SELECT * FROM items
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY createdAt DESC LIMIT 200`,
    args,
  );
  return rows.map(toItem);
}

export async function deleteItem(id: string): Promise<void> {
  if (NO_DB) return;
  const db = await getDb();
  await db.runAsync('DELETE FROM items WHERE id = ?', [id]);
}

export async function countItems(): Promise<number> {
  if (NO_DB) return 0;
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) n FROM items');
  return row?.n ?? 0;
}
