import { ReactNode } from 'react';
import { Pressable, StyleProp, Text, TextStyle, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { colors, motion, space } from '@/theme';

type Tone = 'primary' | 'ghost' | 'inverse';

/**
 * Interactive text. The affordance is a considered ember rule under the word —
 * always visible at rest, intensifying on press — plus a small scale and a
 * haptic. No pill, no box. Consistent across the app so "underlined = you can
 * tap this".
 */
export function TextAction({
  label,
  onPress,
  tone = 'ghost',
  color,
  textStyle,
  leading,
  trailing,
  disabled,
  align = 'left',
  hitSlop = 14,
  minTouch,
}: {
  label: string;
  onPress: () => void;
  tone?: Tone;
  color?: string;
  textStyle?: StyleProp<TextStyle>;
  leading?: ReactNode;
  trailing?: ReactNode;
  disabled?: boolean;
  align?: 'left' | 'right';
  hitSlop?: number;
  /** Guarantee a >=44pt tap target (padded + centred). */
  minTouch?: boolean;
}) {
  const p = useSharedValue(0);

  const textColor =
    disabled && tone === 'inverse'
      ? colors.nightAsh
      : disabled
        ? colors.ash
        : (color ?? toneText(tone));
  const ruleColor = colors.ember;
  const ruleH = tone === 'ghost' ? 1 : 2;
  const restOpacity = tone === 'ghost' ? 0.5 : 0.95;
  const showRule = !disabled;
  const hasTrailing = trailing != null;

  const wrap = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(p.value, [0, 1], [1, 0.955]) }],
  }));
  const ruleStyle = useAnimatedStyle(() => ({
    opacity: showRule ? interpolate(p.value, [0, 1], [restOpacity, 1]) : 0,
    transform: [{ scaleX: interpolate(p.value, [0, 1], [1, 1.06]) }],
  }));
  const trailStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(p.value, [0, 1], [0, 5]) }],
  }));

  return (
    <Pressable
      hitSlop={hitSlop}
      disabled={disabled}
      onPressIn={() => {
        p.value = withTiming(1, { duration: motion.press, easing: Easing.out(Easing.quad) });
      }}
      onPressOut={() => {
        p.value = withTiming(0, { duration: 190, easing: Easing.out(Easing.quad) });
      }}
      onPress={() => {
        if (disabled) return;
        onPress();
      }}
      style={{
        paddingVertical: minTouch ? space(3) : space(2),
        minHeight: minTouch ? 44 : undefined,
        justifyContent: 'center',
        alignSelf: align === 'right' ? 'flex-end' : 'flex-start',
      }}
    >
      <Animated.View style={[{ flexDirection: 'row', alignItems: 'center' }, wrap]}>
        {leading}
        <View>
          <Text style={[textStyle, { color: textColor }]}>{label}</Text>
          <Animated.View
            style={[
              {
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: -3,
                height: ruleH,
                borderRadius: ruleH,
                backgroundColor: ruleColor,
              },
              ruleStyle,
            ]}
          />
        </View>
        {hasTrailing && (
          <Animated.View style={[{ marginLeft: space(2) }, trailStyle]}>{trailing}</Animated.View>
        )}
      </Animated.View>
    </Pressable>
  );
}

function toneText(tone: Tone): string {
  if (tone === 'primary') return colors.ink;
  if (tone === 'inverse') return colors.ember;
  return colors.slate;
}
