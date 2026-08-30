import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Keyboard, Pressable, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { pickImageUri } from '@/lib/photo';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  interpolate,
  runOnJS,
  useAnimatedKeyboard,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useStore } from '@/store';
import { TextAction } from '@/components/TextAction';
import { InlineEdit } from '@/components/InlineEdit';
import { ReminderChoices } from '@/components/ReminderChoices';
import { haptic } from '@/lib/haptics';
import { remindPhrase } from '@/lib/reminders';
import { colors, motion, PAD, space, text } from '@/theme';

type Phase = 'compose' | 'saved' | 'sensitive' | 'remind' | 'reminded';

export default function Drop() {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const drop = useStore((s) => s.drop);
  const setReminder = useStore((s) => s.setReminder);
  const remove = useStore((s) => s.remove);
  const acknowledgeSensitive = useStore((s) => s.acknowledgeSensitive);
  const editField = useStore((s) => s.editField);

  // arrives with ?saved=<id> when a share was already dropped — jump to confirm
  const preSaved = useLocalSearchParams<{ saved?: string }>().saved ?? null;

  const [value, setValue] = useState('');
  const [phase, setPhase] = useState<Phase>(preSaved ? 'saved' : 'compose');
  const [savedId, setSavedId] = useState<string | null>(preSaved);
  const [remindWhen, setRemindWhen] = useState('');
  const setNote = useStore((s) => s.setNote);
  const category = useStore((s) => (savedId ? (s.items[savedId]?.intent ?? null) : null));
  const savedNote = useStore((s) => (savedId ? (s.items[savedId]?.note ?? null) : null));
  const savedSensitive = useStore((s) => (savedId ? !!s.items[savedId]?.sensitive : false));
  const savedThumb = useStore((s) =>
    savedId && !s.items[savedId]?.sensitive ? (s.items[savedId]?.fileUri ?? null) : null,
  );
  const savedTitle = useStore((s) => (savedId ? (s.items[savedId]?.title ?? null) : null));

  const inputRef = useRef<TextInput>(null);
  const y = useSharedValue(height);
  const keyboard = useAnimatedKeyboard();
  const closing = useRef(false);

  const dismiss = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    Keyboard.dismiss();
    y.value = withTiming(height, { duration: motion.enter }, (done) => {
      if (done) runOnJS(router.back)();
    });
  }, [height, y]);

  useEffect(() => {
    y.value = withTiming(0, { duration: motion.move, easing: Easing.out(Easing.cubic) });
    const t = setTimeout(() => inputRef.current?.focus(), motion.move * 0.6);
    return () => clearTimeout(t);
  }, [y]);

  // A saved item is complete on its own — the sheet never closes itself.
  const land = (id: string) => {
    setSavedId(id);
    const flagged = useStore.getState().items[id]?.sensitive;
    setPhase(flagged ? 'sensitive' : 'saved');
    if (flagged) haptic.warn();
  };

  const submit = async () => {
    const v = value.trim();
    if (!v) return dismiss();
    Keyboard.dismiss();
    // drop() decides text vs link from the content itself.
    land(await drop({ kind: 'text', rawText: v }));
  };

  const addPhoto = async () => {
    const uri = await pickImageUri();
    if (!uri) return;
    Keyboard.dismiss();
    land(await drop({ kind: 'image', imageUri: uri }));
  };

  const pick = (ms: number) => {
    if (!savedId) return;
    setReminder(savedId, ms);
    setRemindWhen(remindPhrase(ms));
    setPhase('reminded');
  };

  // Pan only from the grabber; needs a deliberate downward drag, and never
  // steals a horizontal move or a tap.
  const pan = Gesture.Pan()
    .activeOffsetY(12)
    .failOffsetX([-16, 16])
    .onChange((e) => {
      y.value = Math.max(0, y.value + e.changeY);
    })
    .onEnd((e) => {
      if (y.value > 120 || e.velocityY > 800) runOnJS(dismiss)();
      else y.value = withTiming(0, { duration: motion.press });
    });

  const basePad = insets.bottom + space(6);
  const scrimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [0, height], [1, 0]),
  }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }],
    paddingBottom: keyboard.height.value + basePad,
  }));

  return (
    <View style={{ flex: 1, justifyContent: 'flex-end' }}>
      <Animated.View
        style={[
          { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,17,14,0.55)' },
          scrimStyle,
        ]}
      >
        <Pressable style={{ flex: 1 }} onPress={dismiss} />
      </Animated.View>

      <Animated.View
        style={[
          {
            backgroundColor: colors.night,
            borderTopLeftRadius: 30,
            borderTopRightRadius: 30,
            paddingHorizontal: PAD,
            paddingTop: space(4),
            minHeight: height * 0.46,
            maxHeight: height * 0.9,
          },
          sheetStyle,
        ]}
      >
        <GestureDetector gesture={pan}>
          <View style={{ paddingTop: space(1), paddingBottom: space(7), alignItems: 'center' }}>
            <View
              style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.nightAsh, opacity: 0.45 }}
            />
          </View>
        </GestureDetector>

        {phase === 'compose' && (
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Text style={[text.meta, { color: colors.nightAsh }]}>leave it here</Text>
              <TextAction
                tone="ghost"
                color={colors.nightAsh}
                label="＋ photo"
                textStyle={text.meta}
                onPress={addPhoto}
              />
            </View>
            <TextInput
              ref={inputRef}
              value={value}
              onChangeText={setValue}
              multiline
              scrollEnabled
              placeholder={'paste a link, or\nsay what it is…'}
              placeholderTextColor={colors.nightAsh}
              selectionColor={colors.ember}
              style={[
                text.masthead,
                {
                  color: colors.nightInk,
                  marginTop: space(4),
                  // more leading + bottom room so the 2-line placeholder and its
                  // descenders / ellipsis are never clipped (layout fix, not size).
                  lineHeight: 42,
                  minHeight: 42 * 2 + space(3),
                  maxHeight: height * 0.3,
                  paddingTop: 0,
                  paddingBottom: space(3),
                  textAlignVertical: 'top',
                },
              ]}
            />
            <View style={{ marginTop: 'auto', paddingTop: space(5) }}>
              <TextAction
                tone="inverse"
                label="leave it"
                textStyle={text.title}
                disabled={!value.trim()}
                onPress={submit}
                trailing={
                  <Text
                    style={{
                      fontFamily: text.title.fontFamily,
                      fontSize: text.title.fontSize,
                      color: value.trim() ? colors.ember : colors.nightAsh,
                    }}
                  >
                    →
                  </Text>
                }
              />
            </View>
          </>
        )}

        {phase === 'saved' && (
          <Animated.View
            entering={FadeIn.duration(motion.enter)}
            exiting={FadeOut.duration(motion.press)}
            style={{ flex: 1 }}
          >
            {savedThumb && (
              <Image
                source={{ uri: savedThumb }}
                style={{
                  width: 76,
                  height: 76,
                  borderRadius: 16,
                  marginBottom: space(5),
                  backgroundColor: colors.nightPaper,
                }}
              />
            )}

            {/* THE ONE MESSAGE — saving is already done */}
            <Text style={[text.masthead, { color: colors.nightInk, fontSize: 30, lineHeight: 34 }]}>
              Got it.{'\n'}I&rsquo;ve got this one.
            </Text>
            <Text style={[text.meta, { color: colors.nightAsh, marginTop: space(3) }]}>
              {savedSensitive
                ? 'saved  ·  private'
                : `saved to Everything${category ? `  ·  ${category}` : ''}`}
            </Text>

            {/* everything below is optional and deliberately quieter */}
            {savedId && (
              <View style={{ marginTop: space(9), gap: space(4) }}>
                <InlineEdit
                  value={savedTitle}
                  onSave={(v) => editField(savedId, 'title', v || null)}
                  placeholder="give it a name"
                  textStyle={text.body}
                  restColor={colors.nightInk}
                  editColor={colors.nightInk}
                  emptyColor={colors.nightAsh}
                />
                <DropDetail value={savedNote} onSave={(v) => setNote(savedId, v)} />
              </View>
            )}

            <View style={{ marginTop: 'auto', paddingTop: space(8) }}>
              <TextAction
                tone="ghost"
                color={colors.nightInk}
                minTouch
                label="remind me"
                textStyle={text.body}
                onPress={() => setPhase('remind')}
              />
            </View>
          </Animated.View>
        )}

        {phase === 'sensitive' && (
          <Animated.View
            entering={FadeIn.duration(motion.enter)}
            exiting={FadeOut.duration(motion.press)}
            style={{ flex: 1 }}
          >
            <Text style={[text.masthead, { color: colors.nightInk, fontSize: 30, lineHeight: 34 }]}>
              This looks{'\n'}private.
            </Text>
            <Text style={[text.body, { color: colors.nightAsh, marginTop: space(4), maxWidth: 300 }]}>
              A password or key isn&rsquo;t safe to keep here. I&rsquo;d rather not hold onto it.
            </Text>

            <View style={{ marginTop: 'auto', paddingTop: space(8), gap: space(4) }}>
              <TextAction
                tone="inverse"
                minTouch
                label="delete it"
                textStyle={text.title}
                onPress={() => {
                  if (savedId) remove(savedId);
                  dismiss();
                }}
              />
              <TextAction
                tone="ghost"
                color={colors.nightAsh}
                label="keep it anyway"
                textStyle={text.meta}
                onPress={() => {
                  if (savedId) acknowledgeSensitive(savedId);
                  setPhase('saved');
                }}
              />
            </View>
          </Animated.View>
        )}

        {phase === 'remind' && (
          <Animated.View
            entering={FadeIn.duration(motion.enter)}
            exiting={FadeOut.duration(motion.press)}
          >
            <Text style={[text.meta, { color: colors.nightAsh, marginBottom: space(3) }]}>
              When should I remind you?
            </Text>
            <ReminderChoices tone="dark" onPick={pick} />
            <View style={{ marginTop: space(5), alignSelf: 'flex-start' }}>
              <TextAction
                tone="ghost"
                color={colors.nightAsh}
                label="never mind"
                textStyle={text.meta}
                onPress={() => setPhase('saved')}
              />
            </View>
          </Animated.View>
        )}

        {phase === 'reminded' && (
          <Animated.View
            entering={FadeIn.duration(motion.enter)}
            exiting={FadeOut.duration(motion.press)}
            style={{ flex: 1 }}
          >
            <Text style={[text.masthead, { color: colors.nightInk, fontSize: 30, lineHeight: 34 }]}>
              All set.
            </Text>
            <Animated.View
              entering={FadeIn.duration(motion.enter).delay(120)}
              style={{ flexDirection: 'row', alignItems: 'center', marginTop: space(4) }}
            >
              <View
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 4,
                  backgroundColor: colors.ember,
                  marginRight: space(2.5),
                }}
              />
              <Text style={[text.title, { color: colors.ember }]}>
                I&rsquo;ll remind you {remindWhen}.
              </Text>
            </Animated.View>
          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
}

/**
 * Optional multiline detail on the save sheet — "anything else to remember".
 * Never required: skip it and the save is already done. Autosaves on blur or
 * when the sheet goes away; the same text is editable later on the item screen.
 */
function DropDetail({
  value,
  onSave,
}: {
  value: string | null;
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const st = useRef({ editing, draft, value });
  st.current = { editing, draft, value };

  const finish = () => {
    const { editing: was, draft: d, value: v } = st.current;
    if (!was) return;
    setEditing(false);
    if ((d.trim() || '') !== (v ?? '')) onSave(d);
  };
  const finishRef = useRef(finish);
  finishRef.current = finish;
  useEffect(() => () => finishRef.current(), []);

  if (editing) {
    return (
      <TextInput
        autoFocus
        multiline
        value={draft}
        onChangeText={setDraft}
        onBlur={finish}
        onEndEditing={finish}
        placeholder="add detail"
        placeholderTextColor={colors.nightAsh}
        selectionColor={colors.ember}
        style={[
          text.body,
          { color: colors.nightInk, lineHeight: 22, padding: 0, minHeight: 22 },
        ]}
      />
    );
  }

  if (!value) {
    return (
      <Pressable
        hitSlop={10}
        onPress={() => {
          setDraft('');
          setEditing(true);
        }}
        style={{ alignSelf: 'flex-start' }}
      >
        <Text style={[text.meta, { color: colors.nightAsh }]}>add detail</Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={() => {
        setDraft(value);
        setEditing(true);
      }}
    >
      <Text style={[text.body, { color: colors.nightInk, lineHeight: 22 }]} numberOfLines={3}>
        {value}
      </Text>
    </Pressable>
  );
}
