import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';

let _dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,
  rawText TEXT,
  fileUri TEXT,
  note TEXT,
  sourceApp TEXT,
  contentHash TEXT,
  title TEXT,
  summary TEXT,
  intent TEXT,
  suggestedDate INTEGER,
  aiConfidence REAL,
  aiRaw TEXT,
  archivedAt INTEGER,
  pinned INTEGER NOT NULL DEFAULT 0,
  userEditedFields TEXT NOT NULL DEFAULT '[]',
  reminderAt INTEGER,
  reminderNotifId TEXT,
  suggestedDateAccepted INTEGER NOT NULL DEFAULT 0,
  sensitive INTEGER NOT NULL DEFAULT 0,
  sensitiveAck INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_items_reminderAt ON items(reminderAt);
CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
CREATE INDEX IF NOT EXISTS idx_items_contentHash ON items(contentHash);

CREATE VIRTUAL TABLE IF NOT EXISTS items_fts USING fts5(
  id UNINDEXED, title, summary, rawText,
  content='items', content_rowid='rowid'
);

CREATE TRIGGER IF NOT EXISTS items_ai AFTER INSERT ON items BEGIN
  INSERT INTO items_fts(rowid, id, title, summary, rawText)
  VALUES (new.rowid, new.id, new.title, new.summary, new.rawText);
END;
CREATE TRIGGER IF NOT EXISTS items_ad AFTER DELETE ON items BEGIN
  INSERT INTO items_fts(items_fts, rowid, id, title, summary, rawText)
  VALUES ('delete', old.rowid, old.id, old.title, old.summary, old.rawText);
END;
CREATE TRIGGER IF NOT EXISTS items_au AFTER UPDATE ON items BEGIN
  INSERT INTO items_fts(items_fts, rowid, id, title, summary, rawText)
  VALUES ('delete', old.rowid, old.id, old.title, old.summary, old.rawText);
  INSERT INTO items_fts(rowid, id, title, summary, rawText)
  VALUES (new.rowid, new.id, new.title, new.summary, new.rawText);
END;
`;

/** Additive column migrations for DBs created before a field existed. */
async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  const cols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(items)');
  const have = new Set(cols.map((c) => c.name));
  const adds: [string, string][] = [
    ['sensitive', 'INTEGER NOT NULL DEFAULT 0'],
    ['sensitiveAck', 'INTEGER NOT NULL DEFAULT 0'],
    ['note', 'TEXT'],
  ];
  for (const [name, def] of adds) {
    if (!have.has(name)) {
      await db.execAsync(`ALTER TABLE items ADD COLUMN ${name} ${def}`);
    }
  }
}

/**
 * Memoize the *promise*, not the resolved value — otherwise concurrent first
 * callers (e.g. Promise.all in hydrate) each open a separate connection and race
 * the schema, which surfaces on Android as `prepareAsync` NullPointerException.
 */
export function getDb(): Promise<SQLite.SQLiteDatabase> {
  // No SQLite on web (no wasm worker configured) — reject fast so callers fall
  // back to their in-memory path instead of hanging on openDatabaseAsync.
  if (Platform.OS === 'web') {
    return Promise.reject(new Error('SQLite unavailable on web'));
  }
  if (!_dbPromise) {
    _dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('leaveithere.db');
      await db.execAsync('PRAGMA journal_mode = WAL;');
      await db.execAsync(SCHEMA);
      await migrate(db);
      return db;
    })().catch((e) => {
      _dbPromise = null; // allow retry on next call
      throw e;
    });
  }
  return _dbPromise;
}
