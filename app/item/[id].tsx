import { useEffect, useRef, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { selectItem, useStore } from '@/store';
import { retryItem } from '@/ai/queue';
import { TextAction } from '@/components/TextAction';
import { ReminderChoices } from '@/components/ReminderChoices';
import { ItemMark } from '@/components/ItemMark';
import { InlineEdit } from '@/components/InlineEdit';
import { NoteField } from '@/components/NoteField';
import { DeleteConfirm } from '@/components/DeleteConfirm';
import { BackLink } from '@/components/BackLink';
import { Clock, Check } from '@/components/icons';
import { haptic } from '@/lib/haptics';
import { remindPhrase } from '@/lib/reminders';
import { ago } from '@/lib/time';
import { colors, motion, PAD, space, text } from '@/theme';
import type { Intent } from '@/types';

const RESURFACE: Record<Intent, string> = {
  watch: 'watch it',
  read: 'read it',
  buy: 'buy it',
  go: 'go there',
  try: 'try it',
  do: 'do it',
  keep: 'got it', // "keep it" would just restate the state
};

const norm = (s?: string | null) => (s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
function sameish(a?: string | null, b?: string | null): boolean {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return false;
  return x === y || (x.length > 8 && y.length > 8 && (x.includes(y) || y.includes(x)));
}

function domainOf(url?: string | null): string {
  try {
    return new URL(url ?? '').hostname.replace(/^www\./, '');
  } catch {
    return 'link';
  }
}

export default function ItemDetail() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const item = useStore(selectItem(id!));
  const hydrated = useStore((s) => s.hydrated);
  const hydrateOne = useStore((s) => s.hydrateOne);
  const setReminder = useStore((s) => s.setReminder);
  const clearReminder = useStore((s) => s.clearReminder);
  const acceptSuggestedDate = useStore((s) => s.acceptSuggestedDate);
  const acknowledgeSensitive = useStore((s) => s.acknowledgeSensitive);
  const editField = useStore((s) => s.editField);
  const setNote = useStore((s) => s.setNote);
  const archive = useStore((s) => s.archive);
  const remove = useStore((s) => s.remove);

  const [pickingTime, setPickingTime] = useState(false);
  const [justSet, setJustSet] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [imgAR, setImgAR] = useState<number | null>(null);
  const leaving = useRef(false);

  const imgUri = item?.kind === 'image' ? item.fileUri : null;

  useEffect(() => {
    if (id) hydrateOne(id);
  }, [id, hydrateOne]);

  // Measure the real image so detail shows it whole — never cropped.
  useEffect(() => {
    if (!imgUri) return setImgAR(null);
    Image.getSize(
      imgUri,
      (w, h) => setImgAR(h > 0 ? w / h : null),
      () => setImgAR(null),
    );
  }, [imgUri]);

  // If background enrichment stalled, quietly try once more — no UI, no error.
  useEffect(() => {
    if (item?.status === 'failed') {
      retryItem(item.id)
        .then(() => hydrateOne(item.id))
        .catch(() => {});
    }
  }, [item?.status, item?.id, hydrateOne]);

  // No "gone." screen — if the item isn't there, step back to where we came from.
  useEffect(() => {
    if (hydrated && !item && !leaving.current) {
      leaving.current = true;
      router.back();
    }
  }, [hydrated, item]);

  if (!item) return <View style={{ flex: 1, backgroundColor: colors.paper }} />;

  if (item.sensitive && !item.sensitiveAck) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.paper,
          paddingTop: insets.top + space(4),
          paddingBottom: insets.bottom + space(10),
          paddingHorizontal: PAD,
        }}
      >
        <BackLink />
        <Text style={[text.masthead, { color: colors.ink, marginTop: space(10) }]}>
          This looks{'\n'}private.
        </Text>
        <Text style={[text.body, { color: colors.slate, marginTop: space(5), maxWidth: 320 }]}>
          It looks like a password or key. Leave It Here isn&rsquo;t a safe place to keep something
          like that.
        </Text>
        <View style={{ marginTop: 'auto', gap: space(5) }}>
          <TextAction
            tone="inverse"
            minTouch
            label="delete it forever"
            textStyle={text.title}
            onPress={() => {
              leaving.current = true;
              router.back();
              remove(item.id);
            }}
          />
          <TextAction
            tone="ghost"
            label="keep it anyway"
            textStyle={text.meta}
            onPress={() => acknowledgeSensitive(item.id)}
          />
        </View>
      </View>
    );
  }

  const now = Date.now();
  const state = item.archivedAt
    ? 'archived'
    : item.reminderAt == null
      ? 'saved'
      : item.reminderAt <= now
        ? 'due'
        : 'scheduled';

  const isImage = item.kind === 'image' && !!item.fileUri;
  const isLink = item.kind === 'link' || /^https?:\/\/\S+$/i.test((item.rawText ?? '').trim());
  const showText = !isImage && !isLink && !!item.rawText && !sameish(item.rawText, item.title);
  const saveTitle = (v: string) => editField(item.id, 'title', v || null);

  const pick = (ms: number) => {
    setReminder(item.id, ms);
    setPickingTime(false);
    setJustSet(true);
  };

  const openLink = () => item.rawText && Linking.openURL(item.rawText.trim()).catch(() => {});

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.paper }}
      contentContainerStyle={{
        paddingTop: insets.top + space(4),
        paddingBottom: insets.bottom + space(16),
        paddingHorizontal: PAD,
      }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets
    >
      <View
        style={{
          marginBottom: space(7),
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 10,
        }}
      >
        <BackLink />
        <DeleteConfirm
          onDelete={() => {
            leaving.current = true;
            router.back();
            remove(item.id);
          }}
        />
      </View>

      {/* THE THING ITSELF — on a due item it rises back into your hands */}
      <Animated.View
        entering={
          state === 'due'
            ? FadeInDown.springify().damping(14).stiffness(120).mass(0.9)
            : FadeIn.duration(motion.enter)
        }
      >
        {isImage ? (
          <>
            <Pressable onPress={() => item.fileUri && Linking.openURL(item.fileUri)}>
              <Image
                source={{ uri: item.fileUri! }}
                resizeMode="contain"
                style={{
                  width: width - PAD * 2,
                  height: Math.min(
                    imgAR ? (width - PAD * 2) / imgAR : (width - PAD * 2) * 0.72,
                    height * 1.5,
                  ),
                  borderRadius: 22,
                  backgroundColor: colors.haze,
                }}
              />
            </Pressable>
            <View style={{ marginTop: space(4) }}>
              <InlineEdit
                value={item.title}
                onSave={saveTitle}
                placeholder="name this"
                textStyle={text.title}
              />
            </View>
          </>
        ) : isLink ? (
          <Pressable
            onPress={openLink}
            style={{ borderWidth: 1, borderColor: colors.haze, borderRadius: 20, padding: space(5) }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <ItemMark item={item} size={34} />
              <Text style={[text.meta, { color: colors.slate, marginLeft: space(3), flex: 1 }]}>
                {domainOf(item.rawText)}
              </Text>
            </View>
            {item.title && !sameish(item.title, domainOf(item.rawText)) && (
              <Text style={[text.title, { color: colors.ink, marginTop: space(3) }]}>
                {item.title}
              </Text>
            )}
            <Text style={[text.meta, { color: colors.ember, marginTop: space(3) }]}>open →</Text>
          </Pressable>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <ItemMark item={item} size={40} />
            <View style={{ flex: 1, marginLeft: space(4) }}>
              <InlineEdit
                value={item.title}
                onSave={saveTitle}
                placeholder="name this"
                textStyle={[text.masthead, { fontSize: 25, lineHeight: 30 }]}
              />
              {showText && (
                <Text style={[text.body, { color: colors.graphite, marginTop: space(4) }]}>
                  {item.rawText}
                </Text>
              )}
            </View>
          </View>
        )}

        {item.sensitive && !revealed && showText && (
          <View style={{ marginTop: space(3), alignSelf: 'flex-start' }}>
            <TextAction
              tone="ghost"
              label="reveal"
              textStyle={text.meta}
              onPress={() => setRevealed(true)}
            />
          </View>
        )}
      </Animated.View>

      {/* OPTIONAL DETAIL */}
      <NoteField value={item.note} onSave={(v) => setNote(item.id, v)} />

      {/* ONE CONSISTENT STATUS + ACTION BAND */}
      <View
        style={{
          marginTop: space(9),
          borderTopWidth: 1,
          borderTopColor: colors.haze,
          paddingTop: space(6),
        }}
      >
        {pickingTime ? (
          <Animated.View entering={FadeIn.duration(motion.press)}>
            <Text style={[text.meta, { color: colors.ash, marginBottom: space(3) }]}>
              When should I remind you?
            </Text>
            <ReminderChoices onPick={pick} />
            <View style={{ marginTop: space(4), alignSelf: 'flex-start' }}>
              <TextAction
                tone="ghost"
                label="never mind"
                textStyle={text.meta}
                onPress={() => setPickingTime(false)}
              />
            </View>
          </Animated.View>
        ) : state === 'due' ? (
          <Animated.View entering={FadeIn.duration(motion.enter).delay(100)}>
            <Pressable
              onPress={() => {
                haptic.done();
                archive(item.id, true);
              }}
              hitSlop={10}
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: space(1) }}
            >
              <Dot />
              <Text style={[text.title, { color: colors.ink, marginLeft: space(3) }]}>
                {item.intent ? RESURFACE[item.intent] : 'i’ve dealt with this'}
              </Text>
              <Text
                style={{
                  color: colors.ember,
                  fontFamily: text.title.fontFamily,
                  fontSize: 20,
                  marginLeft: space(3),
                }}
              >
                →
              </Text>
            </Pressable>
            <View style={{ marginTop: space(4), alignSelf: 'flex-start' }}>
              <TextAction
                tone="ghost"
                label="not yet"
                textStyle={text.meta}
                onPress={() => setPickingTime(true)}
              />
            </View>
          </Animated.View>
        ) : state === 'scheduled' ? (
          <Animated.View entering={FadeIn.duration(motion.press)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space(2) }}>
              {justSet ? (
                <Check size={14} color={colors.ember} />
              ) : (
                <Clock size={14} color={colors.ember} />
              )}
              <Text style={[text.meta, { color: colors.emberInk, marginLeft: space(2.5) }]}>
                {justSet ? 'reminder set' : 'reminder'}
              </Text>
            </View>
            <Text style={[text.title, { color: colors.emberInk }]}>
              I&rsquo;ll remind you {remindPhrase(item.reminderAt!)} · {timeOf(item.reminderAt!)}
            </Text>
            <View style={{ flexDirection: 'row', gap: space(6), marginTop: space(4) }}>
              <TextAction
                tone="ghost"
                label="change"
                textStyle={text.meta}
                onPress={() => {
                  setJustSet(false);
                  setPickingTime(true);
                }}
              />
              <TextAction
                tone="ghost"
                label="remove"
                textStyle={text.meta}
                onPress={() => {
                  setJustSet(false);
                  clearReminder(item.id);
                }}
              />
            </View>
          </Animated.View>
        ) : state === 'archived' ? (
          // completed — history now, no action (it stays in Everything regardless)
          <Animated.View
            entering={FadeIn.duration(motion.press)}
            style={{ flexDirection: 'row', alignItems: 'center' }}
          >
            <Check size={14} color={colors.slate} />
            <Text style={[text.meta, { color: colors.slate, marginLeft: space(2.5) }]}>
              done · {ago(item.archivedAt!)}
            </Text>
          </Animated.View>
        ) : (
          // saved
          <Animated.View entering={FadeIn.duration(motion.press)}>
            {item.suggestedDate && !item.suggestedDateAccepted ? (
              <>
                <Pressable
                  onPress={() => {
                    acceptSuggestedDate(item.id);
                    setJustSet(true);
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center' }}
                >
                  <Clock size={15} color={colors.ember} />
                  <Text style={[text.title, { color: colors.emberInk, marginLeft: space(3) }]}>
                    remind me {remindPhrase(item.suggestedDate)}?
                  </Text>
                </Pressable>
                <View style={{ marginTop: space(4), alignSelf: 'flex-start' }}>
                  <TextAction
                    tone="ghost"
                    label="another time"
                    textStyle={text.meta}
                    onPress={() => setPickingTime(true)}
                  />
                </View>
              </>
            ) : (
              <Pressable
                onPress={() => setPickingTime(true)}
                hitSlop={10}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: space(1) }}
              >
                <Clock size={15} color={colors.slate} />
                <Text style={[text.title, { color: colors.ink, marginLeft: space(3) }]}>
                  remind me
                </Text>
              </Pressable>
            )}
          </Animated.View>
        )}
      </View>

    </ScrollView>
  );
}

function timeOf(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function Dot() {
  return <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.ember }} />;
}
