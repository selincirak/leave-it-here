import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useShallow } from 'zustand/react/shallow';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  selectReadyToComeBack,
  selectRecentlyLeft,
  selectUpcoming,
  useStore,
} from '@/store';
import { ItemMark } from '@/components/ItemMark';
import { LinkGlyph } from '@/components/icons';
import { haptic } from '@/lib/haptics';
import { remindStamp } from '@/lib/reminders';
import { colors, font, motion, PAD, space, text } from '@/theme';
import type { Item } from '@/types';

/**
 * Home = the shelf. LAND → HOLD → RETURN.
 *   · things you just left rest on a shelf, shown as their real content
 *   · a reminder that's due steps forward as a raised card
 *   · a fresh drop travels into place and settles with a spring + one haptic
 * The full archive + categories live in Everything.
 */
export default function Home() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const now = useStore(useShallow(selectReadyToComeBack));
  const upcomingAll = useStore(useShallow(selectUpcoming));
  // Hard caps — Home answers "what matters now?", never "how much have I saved?".
  // No internal scroll; overflow just lives in Everything (+ still notifies).
  const ready = useMemo(() => now.slice(0, 2), [now]);
  const coming = useMemo(() => upcomingAll.slice(0, 3), [upcomingAll]);
  const recent = useStore(useShallow(selectRecentlyLeft));
  const libraryEmpty = useStore((s) => s.libraryEmpty);
  const hydrated = useStore((s) => s.hydrated);
  const justLandedId = useStore((s) => s.justLandedId);
  const clearJustLanded = useStore((s) => s.clearJustLanded);

  const hasNow = now.length > 0;
  const hasComing = coming.length > 0;
  const hasRecent = recent.length > 0;
  const emptyEverything = !hasNow && !hasComing;
  const firstRun = hydrated && libraryEmpty && emptyEverything && !hasRecent;
  // "just left" is a permanent section — its contents are what's temporary.
  const showShelf = !firstRun;

  const tileW = Math.floor((width - PAD * 2 - space(3) * 2) / 3);
  const tileH = Math.round(tileW * 1.24);

  // A fresh drop plays its landing once, then the flag is released.
  useEffect(() => {
    if (!justLandedId) return;
    const t = setTimeout(clearJustLanded, 1600);
    return () => clearTimeout(t);
  }, [justLandedId, clearJustLanded]);

  // RETURN: when something crosses into "due" while you're on Home, a quiet
  // success tap. Silent on the first mount — opening the app isn't an event.
  const seenDue = useRef<Set<string> | null>(null);
  useEffect(() => {
    const ids = new Set(now.map((i) => i.id));
    if (seenDue.current === null) {
      seenDue.current = ids;
      return;
    }
    let fresh = false;
    ids.forEach((id) => {
      if (!seenDue.current!.has(id)) fresh = true;
    });
    seenDue.current = ids;
    if (fresh) haptic.set();
  }, [now]);

  const kicker = useMemo(() => {
    if (hasNow) return `${now.length} ready`;
    if (hasComing) return 'coming up';
    return new Date()
      .toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
      .toLowerCase()
      .replace(',', '');
  }, [hasNow, hasComing, now.length]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + space(10),
          paddingBottom: insets.bottom + space(36),
          paddingHorizontal: PAD,
        }}
      >
        <Animated.View entering={FadeIn.duration(motion.enter)}>
          <Text style={[text.meta, { color: colors.ash }]}>{kicker}</Text>
          <Text style={[text.masthead, { color: colors.ink, marginTop: space(3) }]}>
            {hasNow
              ? 'Time to bring\nthese back.'
              : hasComing
                ? 'Nothing right now.\nSoon, though.'
                : 'Nothing to bring\nback right now.'}
          </Text>
        </Animated.View>

        {hasNow && (
          <View style={{ marginTop: space(11) }}>
            {ready.map((it, i) => (
              <Row key={it.id} item={it} index={i} live justLanded={it.id === justLandedId} />
            ))}
          </View>
        )}

        {hasComing && (
          <Section label="coming up">
            {coming.map((it, i) => (
              <Row key={it.id} item={it} index={i} justLanded={it.id === justLandedId} />
            ))}
          </Section>
        )}

        {showShelf && (
          <Shelf items={recent} w={tileW} h={tileH} landedId={justLandedId} />
        )}

        {firstRun && <FirstRun />}
      </ScrollView>

      <BottomBar bottom={insets.bottom} />
    </View>
  );
}

/** deterministic rest angle for a shelf object — an object set down, not aligned */
function restRot(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((Math.abs(h) % 100) / 100 - 0.5) * 2.2; // -1.1° … 1.1°
}

/**
 * The shelf. Up to 3 recent drops, newest on the left, each shown as its own
 * content resting on a hairline surface with a soft shadow and a barely-there
 * tilt. It clears itself after a few days — never an archive.
 */
function Shelf({
  items,
  w,
  h,
  landedId,
}: {
  items: Item[];
  w: number;
  h: number;
  landedId: string | null;
}) {
  return (
    <Animated.View
      entering={FadeIn.duration(motion.gentle).delay(90)}
      style={{ marginTop: space(14) }}
    >
      <Text style={[text.meta, { color: colors.ash, marginBottom: space(5) }]}>just left</Text>

      {items.length > 0 ? (
        <View style={{ flexDirection: 'row', gap: space(3), minHeight: h }}>
          {items.map((it) => (
            <ShelfObject key={it.id} item={it} w={w} h={h} landed={it.id === landedId} />
          ))}
        </View>
      ) : (
        <View style={{ paddingBottom: space(4) }}>
          <Text style={[text.meta, { color: colors.ash }]}>nothing here yet</Text>
        </View>
      )}

      {/* the surface */}
      <View
        style={{
          marginHorizontal: -PAD,
          marginTop: space(3),
          height: 1,
          backgroundColor: colors.haze,
        }}
      />
    </Animated.View>
  );
}

function ShelfObject({
  item,
  w,
  h,
  landed,
}: {
  item: Item;
  w: number;
  h: number;
  landed: boolean;
}) {
  const rot = useMemo(() => restRot(item.id), [item.id]);
  const start = useState(() => landed)[0];
  const p = useSharedValue(start ? 0 : 1);
  const press = useSharedValue(0);

  useEffect(() => {
    if (!start) return;
    p.value = withSpring(1, { damping: 15, stiffness: 180, mass: 0.85 }, (f) => {
      if (f) runOnJS(haptic.saved)();
    });
  }, [start, p]);

  const aStyle = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.2, 1], [0, 1, 1]),
    transform: [
      { translateY: interpolate(p.value, [0, 1], [42, 0]) },
      {
        scale:
          interpolate(p.value, [0, 1], [0.9, 1]) *
          interpolate(press.value, [0, 1], [1, 0.97]),
      },
      { rotate: `${interpolate(p.value, [0, 1], [rot - 4, rot])}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[
        {
          width: w,
          height: h,
          borderRadius: 14,
          backgroundColor: colors.paper,
          shadowColor: '#211D18',
          shadowOpacity: 0.13,
          shadowRadius: 9,
          shadowOffset: { width: 0, height: 5 },
          elevation: 4,
        },
        aStyle,
      ]}
    >
      <Pressable
        onPressIn={() => {
          press.value = withTiming(1, { duration: 120 });
        }}
        onPressOut={() => {
          press.value = withTiming(0, { duration: 200 });
        }}
        onPress={() => router.push(`/item/${item.id}`)}
        style={{
          flex: 1,
          borderRadius: 14,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: colors.haze,
        }}
      >
        <ShelfContent item={item} />
      </Pressable>
    </Animated.View>
  );
}

function ShelfContent({ item }: { item: Item }) {
  if (item.sensitive) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: font.mono, fontSize: 15, color: colors.slate }}>•••</Text>
        <Text style={[text.meta, { color: colors.ash, marginTop: space(2) }]}>private</Text>
      </View>
    );
  }

  if (item.kind === 'image' && item.fileUri) {
    return (
      <Image
        source={{ uri: item.fileUri }}
        style={{ flex: 1, width: '100%', backgroundColor: colors.haze }}
        resizeMode="cover"
      />
    );
  }

  if (item.kind === 'link') {
    return (
      <View style={{ flex: 1, padding: space(3), justifyContent: 'space-between' }}>
        <LinkGlyph size={17} color={colors.slate} />
        <Text style={[text.meta, { color: colors.slate }]} numberOfLines={2}>
          {item.title ?? 'link'}
        </Text>
      </View>
    );
  }

  // text — a small torn page
  return (
    <View style={{ flex: 1, padding: space(3) }}>
      <Text
        style={{ fontFamily: font.sans, fontSize: 12.5, lineHeight: 17, color: colors.graphite }}
        numberOfLines={6}
      >
        {item.title ?? item.rawText ?? ''}
      </Text>
    </View>
  );
}

function FirstRun() {
  const rows: { g: React.ReactNode; title: string; meta: string; live: boolean }[] = [
    {
      g: <LinkGlyph size={18} color={colors.slate} />,
      title: 'the jacket Priya linked',
      meta: 'ready now  ·  buy',
      live: true,
    },
    {
      g: (
        <Text style={{ fontFamily: text.title.fontFamily, fontSize: 17, color: colors.slate }}>
          T
        </Text>
      ),
      title: 'the ramen place downtown',
      meta: 'this weekend',
      live: false,
    },
  ];
  return (
    <Animated.View entering={FadeIn.duration(motion.gentle).delay(120)} style={{ marginTop: space(12) }}>
     <View style={{ opacity: 0.55 }}>
      <Text style={[text.meta, { color: colors.ash, marginBottom: space(3) }]}>an example</Text>
      {rows.map((r, i) => (
        <View
          key={i}
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            paddingVertical: space(4),
            borderBottomWidth: 1,
            borderBottomColor: colors.haze,
          }}
        >
          <View>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 11,
                backgroundColor: 'rgba(33,29,24,0.06)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {r.g}
            </View>
            {r.live && (
              <View
                style={{
                  position: 'absolute',
                  top: -3,
                  right: -3,
                  width: 12,
                  height: 12,
                  borderRadius: 6,
                  backgroundColor: colors.ember,
                  borderWidth: 2.5,
                  borderColor: colors.paper,
                }}
              />
            )}
          </View>
          <View style={{ flex: 1, marginLeft: space(3.5), paddingTop: space(0.5) }}>
            <Text style={[text.title, { color: colors.ink }]}>{r.title}</Text>
            <Text
              style={[
                text.meta,
                { color: r.live ? colors.emberInk : colors.slate, marginTop: space(2) },
              ]}
            >
              {r.meta}
            </Text>
          </View>
        </View>
      ))}
      <Text style={[text.body, { color: colors.slate, marginTop: space(5) }]}>
        Drop a link, a photo, a thought. It comes back when it matters.
      </Text>
     </View>
    </Animated.View>
  );
}

function Section({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <View
      style={{
        marginTop: space(12),
        borderTopWidth: 1,
        borderTopColor: colors.haze,
        paddingTop: label ? space(3) : space(2),
      }}
    >
      {label && (
        <Text style={[text.meta, { color: colors.ash, marginBottom: space(3) }]}>{label}</Text>
      )}
      {children}
    </View>
  );
}

function Row({
  item,
  index,
  live,
  justLanded,
}: {
  item: Item;
  index: number;
  live?: boolean;
  justLanded?: boolean;
}) {
  const press = useSharedValue(0);
  const land = useState(() => !!justLanded)[0];
  const lp = useSharedValue(land ? 0 : 1);

  useEffect(() => {
    if (!land) return;
    lp.value = withSpring(1, { damping: 15, stiffness: 180, mass: 0.85 }, (f) => {
      if (f) runOnJS(haptic.saved)();
    });
  }, [land, lp]);

  const aStyle = useAnimatedStyle(() => ({
    opacity: interpolate(lp.value, [0, 0.2, 1], [0, 1, 1]),
    transform: [
      { translateY: interpolate(lp.value, [0, 1], [40, 0]) },
      {
        scale:
          interpolate(lp.value, [0, 1], [0.93, 1]) *
          interpolate(press.value, [0, 1], [1, 0.985]),
      },
    ],
  }));

  const meta = live
    ? `ready now${item.intent ? `  ·  ${item.intent}` : ''}`
    : item.reminderAt
      ? remindStamp(item.reminderAt)
      : '';

  const inner = (
    <View
      style={
        live
          ? {
              flexDirection: 'row',
              alignItems: 'flex-start',
              backgroundColor: colors.paper,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.haze,
              padding: space(4),
              marginBottom: space(3),
              shadowColor: '#211D18',
              shadowOpacity: 0.12,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 5 },
              elevation: 4,
            }
          : {
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: space(3.5),
              borderBottomWidth: 1,
              borderBottomColor: colors.haze,
            }
      }
    >
      <View>
        <ItemMark item={item} size={live ? 44 : 36} />
        {live && (
          <View
            style={{
              position: 'absolute',
              top: -3,
              right: -3,
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: colors.ember,
              borderWidth: 2.5,
              borderColor: colors.paper,
            }}
          />
        )}
      </View>
      <View style={{ flex: 1, marginLeft: space(3.5) }}>
        <Text
          numberOfLines={live ? 2 : 1}
          style={[
            text.title,
            { color: item.sensitive || item.title ? colors.ink : colors.ash },
          ]}
        >
          {item.sensitive ? 'private note' : (item.title ?? 'untitled')}
        </Text>
        {!!meta && (
          <Text
            style={[
              text.meta,
              { color: live ? colors.emberInk : colors.ash, marginTop: space(1.5) },
            ]}
          >
            {meta}
          </Text>
        )}
      </View>
    </View>
  );

  return (
    <Animated.View
      entering={
        land
          ? undefined
          : FadeInDown.duration(motion.enter)
              .delay(index * motion.stagger)
              .easing(Easing.out(Easing.quad))
      }
      style={aStyle}
    >
      <Pressable
        onPressIn={() => {
          press.value = withTiming(1, { duration: motion.press });
        }}
        onPressOut={() => {
          press.value = withTiming(0, { duration: 200 });
        }}
        onPress={() => router.push(`/item/${item.id}`)}
      >
        {inner}
      </Pressable>
    </Animated.View>
  );
}

function BottomBar({ bottom }: { bottom: number }) {
  const lp = useSharedValue(0);
  const ep = useSharedValue(0);
  const press = (v: typeof lp, to: number) =>
    (v.value = withTiming(to, {
      duration: to ? 90 : 200,
      easing: Easing.out(Easing.quad),
    }));

  const leaveStyle = useAnimatedStyle(() => ({
    opacity: interpolate(lp.value, [0, 1], [1, 0.9]),
    transform: [{ scale: interpolate(lp.value, [0, 1], [1, 0.955]) }],
  }));
  const everyStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ep.value, [0, 1], [1, 0.5]),
  }));

  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: PAD,
        paddingTop: space(3.5),
        paddingBottom: Math.max(bottom, space(4)) + space(3),
        backgroundColor: colors.paper,
        borderTopWidth: 1,
        borderTopColor: colors.paperEdge,
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
      }}
    >
      <Pressable
        onPressIn={() => press(lp, 1)}
        onPressOut={() => press(lp, 0)}
        onPress={() => router.push('/drop')}
        hitSlop={{ top: 20, bottom: 24, left: 6, right: 40 }}
        style={{ paddingVertical: space(1.5) }}
      >
        <Animated.View style={[{ flexDirection: 'row', alignItems: 'baseline' }, leaveStyle]}>
          <Text
            style={{
              fontFamily: font.sansBold,
              fontSize: 22,
              color: colors.ember,
              marginRight: space(2.5),
              marginLeft: -1,
            }}
          >
            +
          </Text>
          <Text style={{ fontFamily: font.sansBold, fontSize: 20, letterSpacing: -0.4, color: colors.ink }}>
            leave something
          </Text>
        </Animated.View>
      </Pressable>

      <Pressable
        onPressIn={() => press(ep, 1)}
        onPressOut={() => press(ep, 0)}
        onPress={() => router.push('/search')}
        hitSlop={{ top: 20, bottom: 24, left: 40, right: 6 }}
        style={{ paddingVertical: space(1.5) }}
      >
        <Animated.View style={everyStyle}>
          <Text
            style={{ fontFamily: font.sansSemi, fontSize: 14, letterSpacing: -0.1, color: colors.graphite }}
          >
            everything
          </Text>
        </Animated.View>
      </Pressable>
    </View>
  );
}
