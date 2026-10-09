/** Colour palette (SPEC §5.1). */
export const PALETTE = {
  background: 0x1b1f2a,
  grass: 0x8cc63f,
  grassDark: 0x6fa82e,
  dirt: 0xd9b382,
  path: 0xc9a06d,
  cliff: 0x5e6b5a,
  water: 0x4aa3df,
  wood: 0x8b5a2b,
  woodDark: 0x6b431d,
  stone: 0xb8bcc4,
  stoneDark: 0x8d929c,
  roof: 0xb5483a,
  gold: 0xf7c948,
  goldDark: 0xc9961a,
  heroBlue: 0x2f6de1,
  enemyRed: 0xe53935,
  enemyDark: 0x9c1f1c,
  giantPink: 0xf4b6c2,
  gearBlue: 0x4fc3f7,
  skin: 0xf2c9a0,
  white: 0xffffff,
  dark: 0x2b2f3a,
  padGreen: 0x3dbe5a,
  leaf: 0x3f8f3a,
  ember: 0xff8a3d,
} as const;

/** Tunic colour per archer tier: brown, forge blue, gold. */
export const ARCHER_TIER_COLORS = [PALETTE.wood, PALETTE.gearBlue, PALETTE.gold] as const;
