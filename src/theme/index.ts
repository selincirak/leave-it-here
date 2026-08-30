/**
 * Leave It Here — visual system.
 *
 * Warm monochrome canvas, one ember accent used only for the live moment.
 * Space Grotesk set tight and small for editorial voice; Space Mono, lowercase
 * and wide-tracked, for all metadata (times, ages, counts) — the "receipt" voice.
 * Minimal chrome: no cards, no borders beyond hairlines, no filled buttons.
 */

export const colors = {
  // warm neutral ramp (paper -> ink)
  paper: '#F7F4EF',
  paperEdge: '#EFEAE1',
  haze: '#E4DDD0',
  ash: '#B7AE9F',
  slate: '#8A8173',
  graphite: '#575047',
  ink: '#211D18',

  // the only non-neutral — the live/active moment, used sparingly
  ember: '#C8542E',
  emberInk: '#8F3A1E',

  // dark surface (drop sheet)
  night: '#211D18',
  nightPaper: '#2C2721',
  nightAsh: '#8F8779',
  nightInk: '#F3EEE4',
} as const;

/** 4px spatial grid. */
export const space = (n: number) => n * 4;

/** Consistent screen gutter. */
export const PAD = space(7);

export const font = {
  sans: 'SpaceGrotesk_500Medium',
  sansSemi: 'SpaceGrotesk_600SemiBold',
  sansBold: 'SpaceGrotesk_700Bold',
  mono: 'SpaceMono_400Regular',
} as const;

/** Type ramp — small and confident. size / lineHeight / letterSpacing. */
export const text = {
  masthead: { fontFamily: font.sansBold, fontSize: 34, lineHeight: 37, letterSpacing: -0.9 },
  title: { fontFamily: font.sansSemi, fontSize: 21, lineHeight: 25, letterSpacing: -0.4 },
  body: { fontFamily: font.sans, fontSize: 16, lineHeight: 23, letterSpacing: -0.1 },
  meta: { fontFamily: font.mono, fontSize: 11.5, lineHeight: 15, letterSpacing: 0.6 },
} as const;

/**
 * Legacy tokens — only `app/item/[id].tsx` and `app/search.tsx` still read these,
 * until their own redesign pass. Mapped onto the new system so they stay coherent.
 */
export const palette = {
  paper: colors.paper,
  ink: colors.ink,
  inkSoft: colors.slate,
  accent: colors.ember,
  accentSoft: colors.haze,
  line: colors.haze,
  ok: '#4C9A6B',
  danger: colors.emberInk,
  white: '#FFFFFF',
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 40 } as const;
export const radius = { sm: 8, md: 14, lg: 22, pill: 999 } as const;
export const type = {
  title: { fontFamily: font.sansBold, fontSize: 24 },
  heading: { fontFamily: font.sansSemi, fontSize: 17 },
  body: { fontFamily: font.sans, fontSize: 15 },
  label: { fontFamily: font.mono, fontSize: 12 },
} as const;

/** Fast, physical. */
export const motion = {
  press: 140,
  enter: 240,
  move: 300,
  gentle: 520,
  ease: [0, 0, 0.2, 1] as const, // cubic-bezier ease-out
  stagger: 32,
} as const;
