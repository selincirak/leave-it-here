import type { Intent } from '@/types';

// Ordered most- to least-explicit. A scheme wins; then www.; then a bare
// domain with a known TLD (kept conservative so ordinary "3.30pm" / "node.js"
// text is never mistaken for a link).
const URL_CANDIDATES: RegExp[] = [
  /\bhttps?:\/\/[^\s<>()]+/i,
  /\bwww\.[^\s<>()]+/i,
  /\b[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*\.(?:com\.tr|co\.uk|com|org|net|io|dev|app|ai|me|co|gg|xyz|info|tv|news|shop|store|blog|gov|edu|tr|uk|de|nl|fr|es|it|ca|jp)(?:\/[^\s<>()]*)?/i,
];

/**
 * Deterministic content-type split, run before any classification: a URL
 * anywhere in the input makes it a link (normalised so it opens reliably), and
 * whatever text surrounds the URL becomes context (the item's detail). No URL →
 * plain text.
 */
export function splitUrl(input: string): { url: string | null; rest: string } {
  const text = input.trim();
  for (const re of URL_CANDIDATES) {
    const m = text.match(re);
    if (m?.index == null) continue;
    if (text[m.index - 1] === '@') continue; // an email address, not a link
    const raw = m[0].replace(/[.,;:!?)\]}'"”’…]+$/u, '');
    const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const rest = (text.slice(0, m.index) + text.slice(m.index + m[0].length))
      .replace(/\s{2,}/g, ' ')
      .trim();
    return { url, rest };
  }
  return { url: null, rest: text };
}

/**
 * Instant, offline first-guess at an item's category so it never shows up
 * uncategorised. The AI pass refines this later; if the AI is unavailable the
 * guess is what the user sees. Returns null when genuinely unsure — better
 * blank than wrong.
 */
const RULES: [Intent, RegExp][] = [
  ['watch', /\b(watch|movie|film|trailer|episode|series|show|netflix|hbo|hulu|disney|youtube|video|documentary|stream)\b/i],
  ['read', /\b(read|article|book|essay|blog|paper|newsletter|thread|substack|medium|chapter|novel)\b/i],
  ['buy', /\b(buy|bought|order|purchase|shop|cart|checkout|gift|deal|discount|price|amazon|etsy|[$€£]\s?\d)\b/i],
  ['go', /\b(go|going|visit|trip|travel|restaurant|cafe|coffee|bar|museum|gallery|exhibit|venue|directions|reservation)\b/i],
  ['try', /\b(try|trying|recipe|cook|bake|make|app|tool|plugin|technique|workout|routine|experiment)\b/i],
  ['do', /\b(call|email|reply|respond|send|message|text|dm|ping|fix|finish|submit|renew|apply|pay|schedule|book|sign up|register|cancel|reschedule)\b/i],
];

export function guessIntent(text: string | null | undefined): Intent | null {
  const t = (text ?? '').trim();
  if (!t) return null;
  for (const [intent, re] of RULES) {
    if (re.test(t)) return intent;
  }
  return null;
}

const SENSITIVE_HINTS =
  /\b(password|passwd|pwd|passcode|pass\s?phrase|api[\s_-]?key|secret\s?key|access\s?token|private\s?key|seed\s?phrase|recovery\s?phrase|2fa|otp|one[\s-]?time\s?code|cvv|cvc|pin\s?number|routing\s?number|social\s?security|ssn|iban)\b/i;
// 13–16 digit runs (card numbers), with or without separators
const CARD_LIKE = /\b(?:\d[ -]?){13,16}\b/;
// "key: <long random token>" or a bare high-entropy token
const TOKEN_LIKE = /(?:key|token|secret|pw|pass)\s*[:=]\s*\S{8,}/i;
const HIGH_ENTROPY = /\b(?=[a-z]*[A-Z])(?=[A-Za-z]*\d)(?=\S*[^A-Za-z0-9\s])\S{10,}\b/;

/**
 * Instant, offline check for content that shouldn't be kept as a casual item
 * (passwords, keys, card numbers). The AI pass confirms/overrides. When in
 * doubt this errs toward flagging — the user can always keep it anyway.
 */
export function looksSensitive(text: string | null | undefined): boolean {
  const t = (text ?? '').trim();
  if (!t) return false;
  if (/^https?:\/\//i.test(t) && !SENSITIVE_HINTS.test(t)) return false;
  return (
    SENSITIVE_HINTS.test(t) ||
    CARD_LIKE.test(t) ||
    TOKEN_LIKE.test(t) ||
    (t.length <= 64 && HIGH_ENTROPY.test(t))
  );
}
