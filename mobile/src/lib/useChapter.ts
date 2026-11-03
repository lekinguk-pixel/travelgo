import * as Location from 'expo-location';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { supabase } from './supabase';
import type { Rarity } from './theme';

export type Landmark = {
  id: number; city_id: number; name: string; lat: number; lng: number; radius_m: number;
  rarity: Rarity; is_major: boolean; skills: string[]; photo_thumb_url?: string | null;
};
export const LANDMARK_FIELDS = 'id, city_id, name, lat, lng, radius_m, rarity, is_major, skills, photo_thumb_url';
export type Chapter = {
  city: { id: number; name: string; region: string | null; country_code: string } | null;
  landmarks: (Landmark & { stamped: boolean; distanceM: number | null })[];
  stamped: number; major: number;
  quests: { id: number; name: string; description: string | null; xp_reward: number; steps: number; done: number; completed: boolean }[];
  rank: number | null;
};

export function distanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(a));
}

export function formatDistance(m: number | null): string {
  if (m === null) return '';
  return m < 1000 ? `${Math.round(m / 10) * 10} m away` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km away`;
}

/** Last known position if location permission is already granted; never prompts. */
async function quietPosition(): Promise<{ lat: number; lng: number } | null> {
  try {
    const perm = await Location.getForegroundPermissionsAsync();
    if (!perm.granted) return null;
    const last = (await Location.getLastKnownPositionAsync()) ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    return last ? { lat: last.coords.latitude, lng: last.coords.longitude } : null;
  } catch { return null; }
}

/** Everything the city chapter screen needs, reloaded whenever the screen comes into focus. */
export function useChapter(cityId: number | null | undefined, userId: string | undefined) {
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!cityId || !userId) return;
    setError(null);
    const [cityR, lmR, stR, qR, rankR, pos] = await Promise.all([
      supabase.from('cities').select('id, name, region, country_code').eq('id', cityId).single(),
      supabase.from('landmarks').select(LANDMARK_FIELDS).eq('city_id', cityId),
      supabase.from('stamps').select('landmark_id, status').eq('user_id', userId),
      supabase.from('quests').select('id, name, description, xp_reward, quest_steps(landmark_id), quest_completions(user_id)').eq('city_id', cityId),
      supabase.rpc('leaderboard', { p_scope: 'city', p_scope_id: String(cityId), p_period: 'all', p_mode: 'solo', p_limit: 100 }),
      quietPosition(),
    ]);
    const err = cityR.error ?? lmR.error ?? stR.error ?? qR.error;
    if (err) { setError(err.message); return; }
    const stampedIds = new Set((stR.data ?? []).filter((s) => s.status !== 'rejected').map((s) => s.landmark_id as number));
    const landmarks = ((lmR.data ?? []) as Landmark[]).map((l) => ({
      ...l, stamped: stampedIds.has(l.id), distanceM: pos ? distanceM(pos.lat, pos.lng, l.lat, l.lng) : null,
    }));
    landmarks.sort((a, b) => (a.distanceM ?? 0) - (b.distanceM ?? 0) || a.name.localeCompare(b.name));
    const quests = (qR.data ?? []).map((q: any) => {
      const steps: number[] = (q.quest_steps ?? []).map((s: any) => s.landmark_id);
      return {
        id: q.id, name: q.name, description: q.description, xp_reward: q.xp_reward, steps: steps.length,
        done: steps.filter((id) => stampedIds.has(id)).length,
        completed: (q.quest_completions ?? []).some((c: any) => c.user_id === userId),
      };
    });
    const me = ((rankR.data ?? []) as { rank: number; is_me: boolean }[]).find((r) => r.is_me);
    setChapter({
      city: cityR.data, landmarks, quests, rank: me?.rank ?? null,
      stamped: landmarks.filter((l) => l.is_major && l.stamped).length,
      major: landmarks.filter((l) => l.is_major).length,
    });
  }, [cityId, userId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  return { chapter, error, reload: load };
}
