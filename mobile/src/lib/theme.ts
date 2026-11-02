export const colors = {
  night: '#1F2250',
  paper: '#F6F0E2',
  card: '#FFFDF8',
  ink: '#1B2A41',
  stamp: '#C8553D',
  teal: '#2A7F75',
  gold: '#D9A441',
  bronze: '#B5784A',
  silver: '#A7B1BC',
  muted: '#5F5B52',
  line: '#E4DCCB',
  grass: '#4E9F5A',
  grassTop: '#8ACB6E',
  uncommon: '#3E9B4F',
  rare: '#2F6FCF',
  epic: '#8E44C9',
  legendary: '#E07B1F',
  common: '#6E6A60',
} as const;

export const fonts = {
  display: 'PixelifySans_700Bold',
  label: 'Silkscreen_400Regular',
  labelBold: 'Silkscreen_700Bold',
  body: 'PlusJakartaSans_400Regular',
  bodySemi: 'PlusJakartaSans_600SemiBold',
  bodyBold: 'PlusJakartaSans_700Bold',
} as const;

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export const rarityColor = (r: Rarity) => colors[r];
export const rarityXp: Record<Rarity, number> = { common: 80, uncommon: 100, rare: 120, epic: 150, legendary: 250 };

/** Hard "pixel" drop shadow used on panels and buttons. */
export const hardShadow = (x = 3, y = 3) => ({
  shadowColor: colors.ink,
  shadowOffset: { width: x, height: y },
  shadowOpacity: 1,
  shadowRadius: 0,
  elevation: 0,
});
