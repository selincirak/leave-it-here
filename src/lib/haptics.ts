import * as Haptics from 'expo-haptics';

const impact = (s: Haptics.ImpactFeedbackStyle) => Haptics.impactAsync(s).catch(() => {});
const notify = (t: Haptics.NotificationFeedbackType) => Haptics.notificationAsync(t).catch(() => {});

/**
 * Haptics fire ONLY on meaningful state changes — never on ordinary taps
 * (navigation, filters, opening items, text links). The app should feel
 * tactile, not constantly buzzing.
 */
export const haptic = {
  /** something was saved / dropped */
  saved: () => impact(Haptics.ImpactFeedbackStyle.Light),
  /** a reminder was successfully set */
  set: () => notify(Haptics.NotificationFeedbackType.Success),
  /** a resurfaced item was completed */
  done: () => impact(Haptics.ImpactFeedbackStyle.Light),
  /** a deletion was confirmed */
  deleted: () => impact(Haptics.ImpactFeedbackStyle.Medium),
  /** something needs attention (e.g. a sensitive item was flagged) */
  warn: () => notify(Haptics.NotificationFeedbackType.Warning),
  /** optional feedback at a gesture threshold */
  nudge: () => Haptics.selectionAsync().catch(() => {}),
};
