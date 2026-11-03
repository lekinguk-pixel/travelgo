import type { ImageSource } from 'expo-image';

// Wikimedia asks apps to identify themselves when loading its images.
const HEADERS = { 'User-Agent': 'mmGO/0.1 (https://github.com/lekinguk-pixel/travelgo)' };

/** An expo-image source for a Wikimedia photo, or null if there isn't one. */
export function wikiImage(uri: string | null | undefined): ImageSource | null {
  return uri ? { uri, headers: HEADERS, cacheKey: uri } : null;
}

export type Media = {
  summary: string | null;
  description: string | null;
  wiki_url: string | null;
  photo_url: string | null;
  photo_thumb_url: string | null;
  photo_credit: string | null;
  photo_license: string | null;
  photo_license_url: string | null;
  photo_source_url: string | null;
};

export const SKILL_NAMES: Record<string, string> = {
  explorer: 'Explorer', wanderer: 'Wanderer', culture: 'Culture', nature: 'Nature', foodie: 'Foodie', pilgrim: 'Pilgrim',
};

/** Rough travel time between two points, matching the inbox's estimate. */
export function travelTime(km: number, sameCountry: boolean): string {
  const train = sameCountry && km < 450;
  const min = train ? Math.max(30, Math.round((km / 110) * 60 / 5) * 5) : Math.max(45, Math.round(((km / 700) * 60 + 30) / 5) * 5);
  const h = Math.floor(min / 60), m = min % 60;
  const t = h === 0 ? `${m}m` : m === 0 ? `${h}h` : `${h}h ${m}m`;
  return `about ${t} by ${train ? 'train' : 'plane'}`;
}
