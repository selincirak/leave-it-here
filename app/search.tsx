import { useCallback, useEffect, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useStore } from '@/store';
import { ItemMark } from '@/components/ItemMark';
import { BackLink } from '@/components/BackLink';
import { ImageGlyph, LinkGlyph, SearchGlyph } from '@/components/icons';
import { ago } from '@/lib/time';
import { colors, font, motion, PAD, space, text } from '@/theme';
import { INTENTS, type Item } from '@/types';

const KIND_OF: Record<string, string> = { images: 'image', links: 'link', notes: 'text' };

/** "Everything" — the archive. One row of lenses to narrow it; free-text to find. */
export default function Everything() {
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const [lens, setLens] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);

  const kind = lens && KIND_OF[lens] ? KIND_OF[lens] : null;
  const intent = lens && !KIND_OF[lens] ? lens : null;

  const listEverything = useStore((s) => s.listEverything);
  // re-run when the session's items change (a fresh drop while navigating back)
  const itemsVersion = useStore((s) => Object.keys(s.items).join());

  const load = useCallback(async () => {
    setItems(await listEverything({ query: q, intent, kind }));
  }, [q, intent, kind, listEverything, itemsVersion]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{
          paddingTop: insets.top + space(4),
          paddingBottom: insets.bottom + space(16),
          paddingHorizontal: PAD,
        }}
      >
        <BackLink />
        <Text
          style={{
            fontFamily: font.sansBold,
            fontSize: 27,
            lineHeight: 30,
            letterSpacing: -0.7,
            color: colors.ink,
            marginTop: space(2),
            marginBottom: space(8),
          }}
        >
          Everything
        </Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
          <SearchGlyph size={17} color={q ? colors.ember : colors.ash} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="find"
            placeholderTextColor={colors.ash}
            selectionColor={colors.ember}
            autoCapitalize="none"
            style={[text.title, { flex: 1, color: colors.ink, paddingVertical: space(2) }]}
          />
          {!!q && (
            <Pressable onPress={() => setQ('')} hitSlop={12} style={{ padding: space(1) }}>
              <Text style={[text.meta, { color: colors.ash }]}>clear</Text>
            </Pressable>
          )}
        </View>

        <LensRow
          active={lens}
          onPick={(l) => setLens((cur) => (cur === l ? null : l))}
        />

        <View style={{ marginTop: space(9) }}>
          {items.length === 0 ? (
            <Text style={[text.body, { color: colors.slate }]}>
              {q || lens ? 'nothing here.' : 'nothing left yet.'}
            </Text>
          ) : (
            items.map((it, i) => <ResultRow key={it.id} item={it} index={i} />)
          )}
        </View>
      </ScrollView>
    </View>
  );
}

type GlyphProps = { size?: number; color?: string };
const TMark = ({ color }: GlyphProps) => (
  <Text style={{ fontFamily: text.title.fontFamily, fontSize: 15, color: color ?? colors.slate }}>T</Text>
);
const TYPE_LENSES: { key: string; Glyph: React.ComponentType<GlyphProps> }[] = [
  { key: 'images', Glyph: ImageGlyph },
  { key: 'links', Glyph: LinkGlyph },
  { key: 'notes', Glyph: TMark },
];

/**
 * "What this is" (image / link / text) is a small set of symbols, anchored on
 * the left — it never scrolls away. "What it's for" (the 7 categories) is words
 * that scroll horizontally beside it. Glyphs vs words + a hairline = the two
 * axes read apart with no second row. Active = an ember wash, same on both.
 */
function LensRow({ active, onPick }: { active: string | null; onPick: (l: string) => void }) {
  const ref = useRef<ScrollView>(null);
  const [x, setX] = useState(0);
  const [cw, setCw] = useState(0);
  const [lw, setLw] = useState(0);
  const nudged = useRef(false);

  useEffect(() => {
    if (nudged.current) return;
    nudged.current = true;
    const a = setTimeout(() => ref.current?.scrollTo({ x: 22, animated: true }), 450);
    const b = setTimeout(() => ref.current?.scrollTo({ x: 0, animated: true }), 830);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, []);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    setX(e.nativeEvent.contentOffset.x);
  const showLeft = x > 3;
  const showRight = cw - lw - x > 3;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: space(5) }}>
      {/* anchored — what this is */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(1) }}>
        {TYPE_LENSES.map(({ key, Glyph }) => {
          const on = active === key;
          return (
            <Pressable
              key={key}
              hitSlop={8}
              onPress={() => onPick(key)}
              style={{
                width: 30,
                height: 30,
                borderRadius: 9,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: on ? 'rgba(200,84,46,0.45)' : 'transparent',
                backgroundColor: on ? 'rgba(200,84,46,0.16)' : 'transparent',
              }}
            >
              <Glyph size={16} color={on ? colors.ember : colors.slate} />
            </Pressable>
          );
        })}
      </View>

      <View
        style={{
          width: 1,
          height: 22,
          backgroundColor: colors.ash,
          marginHorizontal: space(3.5),
        }}
      />

      {/* scrolling — what it's for */}
      <View style={{ flex: 1 }}>
        <ScrollView
          ref={ref}
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={32}
          onScroll={onScroll}
          onContentSizeChange={(w) => setCw(w)}
          onLayout={(e) => setLw(e.nativeEvent.layout.width)}
          contentContainerStyle={{ alignItems: 'center', gap: space(4), paddingRight: space(8) }}
        >
          {INTENTS.map((l) => (
            <Chip key={l} label={l} active={active === l} onPress={() => onPick(l)} />
          ))}
        </ScrollView>
        {showLeft && <EdgeFade side="left" />}
        {showRight && <EdgeFade side="right" />}
      </View>
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={{
        paddingHorizontal: space(2.5),
        paddingVertical: space(1.5),
        borderRadius: 8,
        borderWidth: 1,
        borderColor: active ? 'rgba(200,84,46,0.45)' : 'transparent',
        backgroundColor: active ? 'rgba(200,84,46,0.16)' : 'transparent',
      }}
    >
      <Text style={[text.meta, { color: active ? colors.ember : colors.slate }]}>{label}</Text>
    </Pressable>
  );
}

function EdgeFade({ side }: { side: 'left' | 'right' }) {
  const steps = [0.0, 0.28, 0.6, 0.92];
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        [side]: 0,
        width: 28,
        flexDirection: side === 'right' ? 'row' : 'row-reverse',
      }}
    >
      {steps.map((o, i) => (
        <View key={i} style={{ flex: 1, backgroundColor: colors.paper, opacity: o }} />
      ))}
    </View>
  );
}

/**
 * Each item is drawn as the kind of thing it is — not one table schema for all.
 * Image → a real thumbnail with presence. Link → its domain as identity. Text →
 * the first words of the note itself. The hairline structure and left alignment
 * never change; only the content inside does.
 */
function ResultRow({ item, index }: { item: Item; index: number }) {
  const p = useSharedValue(0);
  const scale = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(p.value, [0, 1], [1, 0.985]) }],
  }));
  const wash = useAnimatedStyle(() => ({ opacity: interpolate(p.value, [0, 1], [0, 1]) }));

  const isImage = item.kind === 'image' && !!item.fileUri && !item.sensitive;
  const eyebrow = item.kind === 'link' && !item.sensitive ? domainOf(item.rawText) : null;
  const preview = previewOf(item);
  const title = item.sensitive ? 'private note' : (item.title ?? 'untitled');

  return (
    <Animated.View entering={FadeIn.duration(motion.enter).delay(index * 18)}>
      <Pressable
        onPressIn={() => {
          p.value = withTiming(1, { duration: motion.press, easing: Easing.out(Easing.quad) });
        }}
        onPressOut={() => {
          p.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.quad) });
        }}
        onPress={() => router.push(`/item/${item.id}`)}
      >
        <Animated.View style={scale}>
          <Animated.View
            style={[
              {
                position: 'absolute',
                left: -space(4),
                right: -space(4),
                top: 0,
                bottom: 0,
                backgroundColor: 'rgba(200,84,46,0.07)',
              },
              wash,
            ]}
          />
          <View
            style={{
              paddingVertical: preview || isImage ? space(4) : space(3.5),
              borderBottomWidth: 1,
              borderBottomColor: colors.haze,
              flexDirection: 'row',
              alignItems: isImage ? 'center' : 'flex-start',
            }}
          >
            <ItemMark item={item} size={isImage ? 62 : 26} />
            <View style={{ flex: 1, marginLeft: isImage ? space(4) : space(3.5) }}>
              {eyebrow && (
                <Text style={[text.meta, { color: colors.slate, marginBottom: space(1) }]}>
                  {eyebrow}
                </Text>
              )}
              <Text
                style={[text.title, { color: item.sensitive || item.title ? colors.ink : colors.ash }]}
                numberOfLines={2}
              >
                {title}
              </Text>
              {preview && (
                <Text
                  style={[text.body, { color: colors.slate, marginTop: space(1.5) }]}
                  numberOfLines={1}
                >
                  {preview}
                </Text>
              )}
              <Text style={[text.meta, { color: colors.ash, marginTop: space(2) }]}>
                {item.sensitive ? 'private' : metaLine(item)}
              </Text>
            </View>
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

function domainOf(url?: string | null): string {
  try {
    return new URL(url ?? '').hostname.replace(/^www\./, '');
  } catch {
    return 'link';
  }
}

/** A line of the actual content — the detail, or the note's body past its first line. */
function previewOf(item: Item): string | null {
  if (item.sensitive) return null;
  const note = item.note?.trim();
  if (note && note !== (item.title ?? '').trim()) return note;
  if (item.kind === 'text' && item.rawText) {
    const nl = item.rawText.indexOf('\n');
    const rest = nl >= 0 ? item.rawText.slice(nl + 1).trim() : '';
    if (rest) return rest;
  }
  return null;
}

function metaLine(item: Item): string {
  const lead = item.archivedAt ? 'done' : item.intent;
  return [lead, ago(item.createdAt)].filter(Boolean).join('  ·  ');
}
