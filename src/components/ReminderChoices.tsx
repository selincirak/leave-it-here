import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import DateTimePicker, {
  DateTimePickerAndroid,
} from '@react-native-community/datetimepicker';
import Animated, {
  Easing,
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { PRESETS, presetHint } from '@/lib/reminders';
import { colors, motion, space, text } from '@/theme';

type Tone = 'light' | 'dark';

type Palette = { label: string; hint: string; rule: string; wash: string };

const PAL: Record<Tone, Palette> = {
  light: {
    label: colors.ink,
    hint: colors.slate,
    rule: colors.haze,
    wash: 'rgba(200,84,46,0.08)',
  },
  dark: {
    label: colors.nightInk,
    hint: colors.nightAsh,
    rule: '#3A342C',
    wash: 'rgba(240,150,90,0.14)',
  },
};

/** Tomorrow · This weekend · Pick a date. Nothing else. */
export function ReminderChoices({
  onPick,
  tone = 'light',
}: {
  onPick: (whenMs: number) => void;
  tone?: Tone;
}) {
  const pal = PAL[tone];
  return (
    <View>
      {PRESETS.map((p, i) => (
        <Row
          key={p.key}
          pal={pal}
          index={i}
          first={i === 0}
          label={p.label}
          hint={presetHint(p.resolve())}
          onPress={() => onPick(p.resolve().getTime())}
        />
      ))}
      <PickDateRow pal={pal} index={PRESETS.length} onPick={onPick} />
    </View>
  );
}

function Row({
  pal,
  index,
  first,
  label,
  hint,
  emphasise,
  onPress,
}: {
  pal: Palette;
  index: number;
  first: boolean;
  label: string;
  hint: string;
  emphasise?: boolean;
  onPress: () => void;
}) {
  const p = useSharedValue(0);
  const [committed, setCommitted] = useState(false);
  const wash = useAnimatedStyle(() => ({ opacity: interpolate(p.value, [0, 1], [0, 1]) }));
  const shift = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(p.value, [0, 1], [0, 4]) }],
  }));

  const active = committed || emphasise;

  return (
    <Animated.View
      entering={FadeInDown.duration(motion.enter)
        .delay(index * motion.stagger)
        .easing(Easing.out(Easing.quad))}
    >
      <Pressable
        disabled={committed}
        onPressIn={() => {
          p.value = withTiming(1, { duration: motion.press, easing: Easing.out(Easing.quad) });
        }}
        onPressOut={() => {
          if (!committed) p.value = withTiming(0, { duration: 240, easing: Easing.out(Easing.quad) });
        }}
        onPress={() => {
          // Hold the selected state for a beat so the choice registers, then commit.
          setCommitted(true);
          p.value = withTiming(1, { duration: motion.press });
          setTimeout(onPress, 170);
        }}
      >
        <Animated.View
          style={[
            {
              position: 'absolute',
              left: -space(4),
              right: -space(4),
              top: 0,
              bottom: 0,
              backgroundColor: pal.wash,
            },
            wash,
          ]}
        />
        <Animated.View
          style={[
            {
              flexDirection: 'row',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              paddingVertical: space(4),
              borderTopWidth: first ? 1 : 0,
              borderBottomWidth: 1,
              borderColor: active ? colors.ember : pal.rule,
            },
            shift,
          ]}
        >
          <Text style={[text.title, { color: active ? colors.ember : pal.label }]}>{label}</Text>
          <Text style={[text.meta, { color: active ? colors.ember : pal.hint }]}>{hint}</Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

function PickDateRow({
  pal,
  index,
  onPick,
}: {
  pal: Palette;
  index: number;
  onPick: (ms: number) => void;
}) {
  const [picked, setPicked] = useState<Date | null>(null);
  const [iosStage, setIosStage] = useState<'idle' | 'date' | 'time'>('idle');
  const [iosDraft, setIosDraft] = useState(() => defaultPick());

  const commit = (d: Date) => {
    setPicked(d);
    onPick(d.getTime());
  };

  const openAndroid = () => {
    DateTimePickerAndroid.open({
      value: picked ?? defaultPick(),
      mode: 'date',
      minimumDate: new Date(),
      onChange: (e, date) => {
        if (e.type !== 'set' || !date) return;
        DateTimePickerAndroid.open({
          value: withHour(date, 9),
          mode: 'time',
          is24Hour: true,
          onChange: (e2, t) => {
            if (e2.type !== 'set' || !t) return;
            const d = new Date(date);
            d.setHours(t.getHours(), t.getMinutes(), 0, 0);
            commit(d);
          },
        });
      },
    });
  };

  const open = () => {
    if (Platform.OS === 'android') openAndroid();
    else {
      setIosDraft(picked ?? defaultPick());
      setIosStage('date');
    }
  };

  return (
    <>
      <Row
        pal={pal}
        index={index}
        first={false}
        label={picked ? 'a different date' : 'pick a date'}
        hint={picked ? presetHint(picked) : 'choose  →'}
        emphasise={!!picked}
        onPress={open}
      />
      {Platform.OS === 'ios' && iosStage !== 'idle' && (
        <DateTimePicker
          value={iosDraft}
          mode={iosStage}
          minimumDate={iosStage === 'date' ? new Date() : undefined}
          onChange={(e, d) => {
            if (e.type !== 'set' || !d) {
              setIosStage('idle');
              return;
            }
            if (iosStage === 'date') {
              setIosDraft(withHour(d, 9));
              setIosStage('time');
            } else {
              const final = new Date(iosDraft);
              final.setHours(d.getHours(), d.getMinutes(), 0, 0);
              setIosStage('idle');
              commit(final);
            }
          }}
        />
      )}
    </>
  );
}

function defaultPick(): Date {
  return withHour(new Date(Date.now() + 864e5), 9);
}

function withHour(d: Date, h: number): Date {
  const c = new Date(d);
  c.setHours(h, 0, 0, 0);
  return c;
}
