import { Pressable } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft } from '@/components/icons';
import { colors, space } from '@/theme';

/**
 * The one back affordance, identical on every screen: a bare left arrow. Uses the
 * same router.back() that the OS/gesture back triggers, so hardware and UI agree.
 */
export function BackLink({ onPress }: { onPress?: () => void }) {
  return (
    <Pressable
      onPress={() => (onPress ?? router.back)()}
      hitSlop={18}
      style={{ paddingVertical: space(2), paddingRight: space(3), marginLeft: -space(1) }}
    >
      <ArrowLeft size={17} color={colors.graphite} />
    </Pressable>
  );
}
