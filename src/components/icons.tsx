import { View } from 'react-native';
import { colors } from '@/theme';

/**
 * A tiny drawn icon set — stroke ~1.6, rounded, monochrome. Built from Views so
 * it stays part of our design system (no borrowed icon font) and needs no
 * native dependency. Every glyph takes size + color.
 */

type P = { size?: number; color?: string };

export function Chevron({
  size = 22,
  color = colors.ink,
  dir = 'left',
}: P & { dir?: 'left' | 'right' }) {
  const s = 2;
  const arm = size * 0.42;
  const bar = {
    position: 'absolute' as const,
    left: size / 2 - arm / 2,
    width: arm,
    height: s,
    backgroundColor: color,
    borderRadius: s,
  };
  return (
    <View
      style={{
        width: size,
        height: size,
        transform: [{ scaleX: dir === 'left' ? -1 : 1 }],
      }}
    >
      <View style={[bar, { top: size * 0.32, transform: [{ rotate: '45deg' }] }]} />
      <View style={[bar, { bottom: size * 0.32, transform: [{ rotate: '-45deg' }] }]} />
    </View>
  );
}

export function ArrowLeft({ size = 16, color = colors.graphite }: P) {
  const s = 1.8;
  const head = size * 0.42;
  return (
    <View style={{ width: size, height: size, justifyContent: 'center' }}>
      <View
        style={{
          position: 'absolute',
          left: 0,
          width: size,
          height: s,
          backgroundColor: color,
          borderRadius: s,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: size / 2 - head / 2 - s / 2,
          width: head,
          height: s,
          backgroundColor: color,
          borderRadius: s,
          transform: [{ rotate: '-45deg' }],
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: size / 2 + head / 2 - s / 2,
          width: head,
          height: s,
          backgroundColor: color,
          borderRadius: s,
          transform: [{ rotate: '45deg' }],
        }}
      />
    </View>
  );
}

export function SearchGlyph({ size = 16, color = colors.slate }: P) {
  const s = 1.6;
  const d = size * 0.68;
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={{ width: d, height: d, borderRadius: d / 2, borderWidth: s, borderColor: color }}
      />
      <View
        style={{
          position: 'absolute',
          right: -1,
          bottom: -1,
          width: size * 0.4,
          height: s,
          backgroundColor: color,
          borderRadius: s,
          transform: [{ rotate: '45deg' }],
        }}
      />
    </View>
  );
}

export function Clock({ size = 14, color = colors.slate }: P) {
  const s = 1.5;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: s,
        borderColor: color,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* single hand → ~1 o'clock */}
      <View style={{ width: 0, height: 0, transform: [{ rotate: '48deg' }] }}>
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: -s / 2,
            width: s,
            height: size * 0.32,
            backgroundColor: color,
            borderRadius: s,
          }}
        />
      </View>
    </View>
  );
}

export function Check({ size = 14, color = colors.slate }: P) {
  const s = 1.9;
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={{
          position: 'absolute',
          left: size * 0.06,
          top: size * 0.5,
          width: size * 0.4,
          height: s,
          backgroundColor: color,
          borderRadius: s,
          transform: [{ rotate: '45deg' }],
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: size * 0.3,
          top: size * 0.32,
          width: size * 0.66,
          height: s,
          backgroundColor: color,
          borderRadius: s,
          transform: [{ rotate: '-50deg' }],
        }}
      />
    </View>
  );
}

export function ImageGlyph({ size = 18, color = colors.slate }: P) {
  const s = 1.6;
  const h = size * 0.84;
  return (
    <View
      style={{ width: size, height: h, borderRadius: 4, borderWidth: s, borderColor: color, overflow: 'hidden' }}
    >
      <View
        style={{
          position: 'absolute',
          top: size * 0.16,
          left: size * 0.16,
          width: size * 0.18,
          height: size * 0.18,
          borderRadius: size * 0.1,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: -h * 0.34,
          left: size * 0.12,
          width: h * 0.62,
          height: h * 0.62,
          backgroundColor: color,
          transform: [{ rotate: '45deg' }],
        }}
      />
    </View>
  );
}

export function LinkGlyph({ size = 18, color = colors.slate }: P) {
  const s = 1.6;
  const w = size * 0.62;
  const h = size * 0.34;
  const ring = {
    position: 'absolute' as const,
    width: w,
    height: h,
    borderWidth: s,
    borderColor: color,
    borderRadius: h / 2,
    top: (size - h) / 2,
  };
  return (
    <View
      style={{
        width: size,
        height: size,
        transform: [{ rotate: '-40deg' }],
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View style={[ring, { left: 0 }]} />
      <View style={[ring, { right: 0 }]} />
    </View>
  );
}

export function Trash({ size = 18, color = colors.slate }: P) {
  const s = Math.max(1.5, size * 0.09);
  const bodyW = size * 0.64;
  const bodyH = size * 0.6;
  return (
    <View style={{ width: size, alignItems: 'center' }}>
      {/* handle */}
      <View
        style={{
          width: size * 0.34,
          height: size * 0.16,
          borderColor: color,
          borderWidth: s,
          borderBottomWidth: 0,
          borderTopLeftRadius: 2,
          borderTopRightRadius: 2,
        }}
      />
      {/* lid */}
      <View
        style={{
          width: size * 0.9,
          height: s,
          backgroundColor: color,
          borderRadius: s,
          marginTop: s,
        }}
      />
      {/* can */}
      <View
        style={{
          width: bodyW,
          height: bodyH,
          borderColor: color,
          borderWidth: s,
          borderTopWidth: 0,
          borderBottomLeftRadius: 3,
          borderBottomRightRadius: 3,
          marginTop: s * 0.6,
        }}
      />
    </View>
  );
}

export function TextGlyph({ size = 18, color = colors.slate }: P) {
  const s = 1.6;
  const row = { height: s, backgroundColor: color, borderRadius: s };
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', gap: size * 0.24 }}>
      <View style={[row, { width: '100%' }]} />
      <View style={[row, { width: '100%' }]} />
      <View style={[row, { width: '58%' }]} />
    </View>
  );
}
