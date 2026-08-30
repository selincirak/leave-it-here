import { Image, Text, View } from 'react-native';
import { LinkGlyph } from '@/components/icons';
import { colors, font } from '@/theme';
import type { Item } from '@/types';

/**
 * One coherent family of marks — the item's identity at a glance:
 *   image  → the real thumbnail
 *   link   → a link symbol
 *   text   → a "T"
 * All on the same neutral warm ground; nothing colour-coded (the category is
 * already a word in the row, so a colour would only make you wonder).
 */
export function ItemMark({ item, size = 40 }: { item: Item; size?: number }) {
  const radius = Math.round(size * 0.28);

  if (item.kind === 'image' && item.fileUri && !item.sensitive) {
    return (
      <Image
        source={{ uri: item.fileUri }}
        style={{ width: size, height: size, borderRadius: radius, backgroundColor: colors.haze }}
      />
    );
  }

  const isLink = item.kind === 'link';

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: 'rgba(33,29,24,0.06)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {item.sensitive ? (
        <Text style={{ fontFamily: font.mono, fontSize: Math.round(size * 0.4), color: colors.slate }}>
          •
        </Text>
      ) : isLink ? (
        <LinkGlyph size={Math.round(size * 0.46)} color={colors.slate} />
      ) : (
        <Text
          style={{
            fontFamily: font.sansSemi,
            fontSize: Math.round(size * 0.44),
            color: colors.slate,
          }}
        >
          T
        </Text>
      )}
    </View>
  );
}
