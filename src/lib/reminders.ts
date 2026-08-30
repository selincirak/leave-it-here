/** Shared reminder time logic: the 3 presets + how we phrase a set reminder. */

function atHour(d: Date, h: number): Date {
  const c = new Date(d);
  c.setHours(h, 0, 0, 0);
  return c;
}

export type Preset = { key: string; label: string; resolve: () => Date };

export const PRESETS: Preset[] = [
  {
    key: 'tomorrow',
    label: 'tomorrow',
    resolve: () => atHour(new Date(Date.now() + 864e5), 9),
  },
  {
    key: 'weekend',
    label: 'this weekend',
    resolve: () => {
      const d = new Date();
      const delta = (6 - d.getDay() + 7) % 7 || 7; // upcoming Saturday
      return atHour(new Date(Date.now() + delta * 864e5), 10);
    },
  },
];

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Compact hint for a preset row, e.g. "sat 10:00". */
export function presetHint(d: Date): string {
  const hhmm = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  const days = Math.round((startOfDay(d.getTime()) - startOfDay(Date.now())) / 864e5);
  if (days <= 0) return hhmm;
  if (days < 7) return `${d.toLocaleDateString(undefined, { weekday: 'short' }).toLowerCase()} ${hhmm}`;
  return `${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }).toLowerCase()} ${hhmm}`;
}

/** Warm confirmation phrase: "tomorrow", "Monday", "on 8 Sep". */
export function remindPhrase(ts: number): string {
  const d = new Date(ts);
  const days = Math.round((startOfDay(ts) - startOfDay(Date.now())) / 864e5);
  if (days <= 0) return 'later today';
  if (days === 1) return 'tomorrow';
  if (days < 7) return d.toLocaleDateString(undefined, { weekday: 'long' });
  return `on ${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
}

/** Glanceable stamp for a set reminder: "tomorrow · 9:00", "mon · 18:30", "3 sep · 9:00". */
export function remindStamp(ts: number): string {
  const d = new Date(ts);
  const hhmm = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  const days = Math.round((startOfDay(ts) - startOfDay(Date.now())) / 864e5);
  const day =
    days <= 0
      ? 'today'
      : days === 1
        ? 'tomorrow'
        : days < 7
          ? d.toLocaleDateString(undefined, { weekday: 'short' }).toLowerCase()
          : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }).toLowerCase();
  return `${day} · ${hhmm}`;
}
