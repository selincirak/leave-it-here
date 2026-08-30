export type ItemKind = 'image' | 'link' | 'text';

export type ItemStatus = 'processing' | 'ready' | 'failed';

export type Intent = 'watch' | 'read' | 'buy' | 'go' | 'try' | 'do' | 'keep';

export const INTENTS: Intent[] = ['watch', 'read', 'buy', 'go', 'try', 'do', 'keep'];

export interface Item {
  id: string;
  kind: ItemKind;
  status: ItemStatus;
  createdAt: number;
  updatedAt: number;

  /** raw shared text or URL */
  rawText: string | null;
  /** local file uri for image kind */
  fileUri: string | null;
  /** optional note the user adds later, on the detail page — never asked for at capture */
  note: string | null;
  sourceApp: string | null;
  /** dedupe key for repeated share intents */
  contentHash: string | null;

  // AI-derived (null until processed)
  title: string | null;
  summary: string | null;
  intent: Intent | null;
  /** AI-detected date. A suggestion only — not a reminder until accepted. */
  suggestedDate: number | null;
  aiConfidence: number | null;
  /** full provider response JSON, kept for debugging + migration */
  aiRaw: string | null;

  /** looks like a password / key / private credential — handled, not stored casually */
  sensitive: boolean;
  /** user chose to keep a flagged item anyway */
  sensitiveAck: boolean;

  // user state
  archivedAt: number | null;
  pinned: boolean;
  /** fields the user has hand-edited; AI must never overwrite these */
  userEditedFields: string[];

  // reminder — the ONLY resurfacing mechanism in the MVP
  reminderAt: number | null;
  reminderNotifId: string | null;
  /** true once the user has explicitly accepted suggestedDate as a reminder */
  suggestedDateAccepted: boolean;
}

export interface AIResult {
  title: string;
  summary: string;
  intent: Intent;
  suggestedDate: string | null; // ISO 8601
  /** password, API key, card number, 2FA code, private credential */
  sensitive: boolean;
  confidence: number; // 0..1
}
