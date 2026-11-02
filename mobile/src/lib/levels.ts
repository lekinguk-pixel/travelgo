// Same curve as the database's skill_levels table: RuneScape's formula scaled down 10x.
const table: number[] = [];
let points = 0;
for (let level = 1; level <= 99; level++) {
  table[level] = Math.floor(Math.floor(points) / 4 / 10);
  points += Math.floor(level + 300 * Math.pow(2, level / 7));
}

export function xpForLevel(level: number): number {
  return table[Math.max(1, Math.min(99, level))];
}

export function levelForXp(xp: number): number {
  let level = 1;
  for (let l = 2; l <= 99; l++) if (xp >= table[l]) level = l;
  return level;
}

/** 0..1 progress from the current level to the next. */
export function levelProgress(xp: number): number {
  const level = levelForXp(xp);
  if (level >= 99) return 1;
  const from = table[level];
  const to = table[level + 1];
  return Math.max(0, Math.min(1, (xp - from) / (to - from)));
}

export const SKILLS = [
  { key: 'explorer', name: 'Explorer', blurb: 'New places' },
  { key: 'wanderer', name: 'Wanderer', blurb: 'Distance' },
  { key: 'culture', name: 'Culture', blurb: 'Museums & history' },
  { key: 'nature', name: 'Nature', blurb: 'Parks & peaks' },
  { key: 'foodie', name: 'Foodie', blurb: 'Markets & cafés' },
  { key: 'pilgrim', name: 'Pilgrim', blurb: 'Sacred sites' },
] as const;
export type SkillKey = (typeof SKILLS)[number]['key'];
