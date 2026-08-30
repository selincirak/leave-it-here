import type { AnalyzeInput } from './provider';

export const SYSTEM_PROMPT = `You classify a single item a person "left" in a personal drop box.
They did not organize it. Your job is to understand it well enough to bring it back later.

Return ONLY a JSON object:
{
  "title": string,        // short, human, specific. No quotes around it.
  "summary": string,      // one or two calm sentences. What it is / why they kept it.
  "intent": "watch" | "read" | "buy" | "go" | "try" | "do" | "keep",
  "suggestedDate": string | null,  // ISO 8601 ONLY if the content clearly implies a date/deadline. Else null.
  "sensitive": boolean,   // true if this looks like a secret: a password, passphrase, PIN, API key, access/auth token, private key, seed/recovery phrase, 2FA/one-time code, full card number, or CVV. A link to a login page is NOT sensitive.
  "confidence": number    // 0..1
}

Rules:
- Never invent a date. suggestedDate is null unless there is a real one in the content.
- intent "keep" means "just hold onto this", no action implied.
- If "sensitive" is true, still fill in "title" from the person's own words (do not echo the secret) and set intent to "keep".
- Keep it warm and plain. No marketing tone.`;

export function buildUserPrompt(input: AnalyzeInput): string {
  const now = new Date().toISOString();
  if (input.type === 'text') {
    return [
      `Current time: ${now}`,
      input.url ? `URL: ${input.url}` : null,
      `Content:\n${input.text}`,
    ]
      .filter(Boolean)
      .join('\n\n');
  }
  return [
    `Current time: ${now}`,
    input.note ? `User note: ${input.note}` : null,
    'The image is attached. Describe and classify what the person kept.',
  ]
    .filter(Boolean)
    .join('\n\n');
}
