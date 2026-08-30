import type { AnalyzeInput, AIProvider } from './provider';
import { getAIProvider } from './index';
import { getItem, getProcessingItems, updateItem } from '@/db/items';
import { readAsBase64 } from '@/lib/files';
import type { Item } from '@/types';

/**
 * Deliberately tiny. No queue table: the source of truth is
 * `SELECT * FROM items WHERE status = 'processing'`, so the queue is
 * self-healing across app restarts. AI never blocks the UI.
 */
const inFlight = new Set<string>();
const MAX_ATTEMPTS = 2;
const attempts = new Map<string, number>();

async function buildInput(item: Item): Promise<AnalyzeInput | null> {
  if (item.kind === 'image' && item.fileUri) {
    return {
      type: 'image',
      base64: await readAsBase64(item.fileUri),
      mimeType: 'image/jpeg',
    };
  }
  if (item.rawText) {
    const isUrl = /^https?:\/\/\S+$/i.test(item.rawText.trim());
    return {
      type: 'text',
      // include any captured context so the AI can use it (e.g. a deadline)
      text: item.note ? `${item.rawText}\n\n${item.note}` : item.rawText,
      url: isUrl ? item.rawText.trim() : undefined,
    };
  }
  return null;
}

export async function processItem(id: string): Promise<void> {
  if (inFlight.has(id)) return;
  inFlight.add(id);
  try {
    let item: Item | null;
    try {
      item = await getItem(id);
    } catch {
      return; // no DB (e.g. web preview) — leave the in-memory copy as-is
    }
    if (__DEV__) console.log('[ai.queue] processItem', id, item?.status);
    if (!item || item.status === 'ready') return;

    // No AI configured (e.g. dev with no key): keep the instant offline
    // classification, mark ready, and don't nag the user with a failure.
    let provider: AIProvider;
    try {
      provider = getAIProvider();
    } catch (e) {
      if (__DEV__) console.log('[ai.queue] no provider -> ready', String(e));
      await updateItem(id, { status: 'ready' });
      return;
    }

    const input = await buildInput(item);
    if (!input) {
      await updateItem(id, { status: 'ready' });
      return;
    }

    const result = await provider.analyze(input);

    // Never overwrite fields the user has hand-edited.
    const locked = new Set(item.userEditedFields);
    const patch: Partial<Item> = {
      status: 'ready',
      aiConfidence: result.confidence,
      aiRaw: JSON.stringify(result),
      // AI is authoritative on sensitivity; keep a flag the offline pass raised.
      sensitive: result.sensitive || item.sensitive,
    };
    if (!locked.has('title')) patch.title = result.title;
    if (!locked.has('summary') && !result.sensitive) patch.summary = result.summary;
    if (!locked.has('intent')) patch.intent = result.intent;
    // suggestedDate is a suggestion only — it becomes a reminder only when the
    // user explicitly accepts it in the item detail screen.
    patch.suggestedDate = result.suggestedDate
      ? new Date(result.suggestedDate).getTime()
      : null;

    await updateItem(id, patch);
    attempts.delete(id);
  } catch (err) {
    const msg = String(err);
    // A bad key / auth / quota response will never succeed — don't nag the user,
    // just accept the instant offline classification.
    if (/\b(400|401|403|429)\b|api key|permission|quota/i.test(msg)) {
      if (__DEV__) console.log('[ai.queue] provider rejected -> ready', msg.slice(0, 120));
      await updateItem(id, { status: 'ready' });
      attempts.delete(id);
      return;
    }
    const n = (attempts.get(id) ?? 0) + 1;
    attempts.set(id, n);
    if (n >= MAX_ATTEMPTS) {
      await updateItem(id, { status: 'failed' });
    } else {
      setTimeout(() => processItem(id), 1500); // self-retry, no foreground needed
    }
    if (__DEV__) console.warn('[ai.queue] processItem failed', id, err);
  } finally {
    inFlight.delete(id);
  }
}

/** Call on app foreground and after each drop. */
export async function drainQueue(): Promise<void> {
  let pending: Item[];
  try {
    pending = await getProcessingItems();
  } catch {
    return; // no DB (e.g. web preview)
  }
  for (const item of pending) {
    if ((attempts.get(item.id) ?? 0) < MAX_ATTEMPTS) {
      await processItem(item.id);
    }
  }
}

export function retryItem(id: string): Promise<void> {
  attempts.delete(id);
  return updateItem(id, { status: 'processing' }).then(() => processItem(id));
}
