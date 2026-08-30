import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Trash } from '@/components/icons';
import { haptic } from '@/lib/haptics';
import { colors, space, text } from '@/theme';

/**
 * The quiet top-right trash icon. Tapping it wakes the icon and drops a compact
 * paper slip directly beneath it — two clear choices, never an immediate delete,
 * never an OS dialog. The slip is content-sized so it covers as little of the
 * item as possible; the icon returns to rest when it closes.
 */
export function DeleteConfirm({ onDelete }: { onDelete: () => void }) {
  const [asking, setAsking] = useState(false);
  const open = useSharedValue(0);

  const toggle = () => {
    setAsking((a) => {
      const next = !a;
      open.value = withTiming(next ? 1 : 0, { duration: 150, easing: Easing.out(Easing.quad) });
      return next;
    });
  };

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(open.value, [0, 1], [1, 1.14]) }],
  }));

  return (
    <View style={{ position: 'relative' }}>
      <Pressable
        onPress={toggle}
        hitSlop={16}
        accessibilityRole="button"
        accessibilityLabel="Delete"
        style={{ padding: space(2) }}
      >
        <Animated.View style={iconStyle}>
          <Trash size={18} color={asking ? colors.graphite : colors.ash} />
        </Animated.View>
      </Pressable>

      {asking && (
        <Animated.View
          entering={FadeIn.duration(130)}
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: space(1.5),
            alignItems: 'flex-end',
            backgroundColor: colors.paper,
            borderWidth: 1,
            borderColor: colors.haze,
            borderRadius: 8,
            paddingVertical: space(2.5),
            paddingHorizontal: space(3.5),
            shadowColor: '#211D18',
            shadowOpacity: 0.05,
            shadowRadius: 4,
            shadowOffset: { width: 0, height: 2 },
            elevation: 2,
            zIndex: 20,
          }}
        >
          <Text style={[text.body, { color: colors.ink, fontSize: 15 }]}>Delete this?</Text>
          <View style={{ flexDirection: 'row', gap: space(5), marginTop: space(2.5) }}>
            <Pressable
              onPress={toggle}
              hitSlop={{ top: 12, bottom: 14, left: 14, right: 8 }}
              style={{ paddingVertical: space(1.5) }}
            >
              <Text style={[text.meta, { color: colors.slate }]}>cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                haptic.deleted();
                onDelete();
              }}
              hitSlop={{ top: 12, bottom: 14, left: 8, right: 14 }}
              style={{ paddingVertical: space(1.5) }}
            >
              <Text style={[text.meta, { color: colors.ember }]}>delete</Text>
            </Pressable>
          </View>
        </Animated.View>
      )}
    </View>
  );
}
