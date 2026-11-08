import { supabase } from './supabase';
import { distanceM } from './useChapter';

export type AtlasCity = {
  id: number; name: string; region: string | null; country_code: string; lat: number; lng: number;
  photo_thumb_url: string | null; countryName: string;
  count: number;   // landmarks
  mine: number;    // landmarks this player has stamped
  km: number | null; // from home
};

export type AtlasCountry = {
  code: string; name: string; cities: AtlasCity[];
  count: number; mine: number; km: number | null; photo: string | null;
};

/** Every city with its landmark count, the player's progress and distance from home. */
export async function loadAtlas(userId: string | undefined, homeCityId: number | null | undefined) {
  const [c, s] = await Promise.all([
    supabase.from('cities').select('id, name, region, country_code, lat, lng, photo_thumb_url, countries(name), landmarks(count)'),
    userId ? supabase.from('stamps').select('landmark_id, landmarks(city_id)').eq('user_id', userId).neq('status', 'rejected') : Promise.resolve({ data: [], error: null }),
  ]);
  if (c.error) throw c.error;
  const raw = (c.data ?? []) as any[];
  const home = raw.find((x) => x.id === homeCityId);
  const perCity = new Map<number, Set<number>>();
  for (const r of ((s.data ?? []) as any[])) {
    const cid = r.landmarks?.city_id; if (!cid) continue;
    if (!perCity.has(cid)) perCity.set(cid, new Set());
    perCity.get(cid)!.add(r.landmark_id);
  }
  const cities: AtlasCity[] = raw.map((x) => ({
    id: x.id, name: x.name, region: x.region, country_code: x.country_code, lat: x.lat, lng: x.lng,
    photo_thumb_url: x.photo_thumb_url, countryName: x.countries?.name ?? x.country_code,
    count: x.landmarks?.[0]?.count ?? 0,
    mine: perCity.get(x.id)?.size ?? 0,
    km: home ? distanceM(home.lat, home.lng, x.lat, x.lng) / 1000 : null,
  }));

  const byCode = new Map<string, AtlasCountry>();
  for (const city of cities) {
    let co = byCode.get(city.country_code);
    if (!co) { co = { code: city.country_code, name: city.countryName, cities: [], count: 0, mine: 0, km: null, photo: null }; byCode.set(city.country_code, co); }
    co.cities.push(city);
    co.count += city.count;
    co.mine += city.mine;
    if (city.km !== null && (co.km === null || city.km < co.km)) co.km = city.km;
  }
  for (const co of byCode.values()) {
    co.cities.sort((a, b) => (a.km ?? 0) - (b.km ?? 0));
    // The country's picture is its best-known city's: the one with the most landmarks.
    co.photo = [...co.cities].sort((a, b) => b.count - a.count).find((x) => x.photo_thumb_url)?.photo_thumb_url ?? null;
  }
  const countries = [...byCode.values()].sort((a, b) => (a.km ?? 0) - (b.km ?? 0));
  return { cities, countries, homeCountry: home?.country_code as string | undefined };
}
