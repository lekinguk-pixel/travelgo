import { supabase } from './supabase';

export type JourneyMode = 'walk' | 'bike' | 'train' | 'plane' | 'parked';
export type CityRef = { id: number; name: string; country: string; photo: string | null };
export type Boost = { stamps: number; countries: number; bronze: number; silver: number; gold: number; multiplier: number; bike: boolean; train: boolean; pilot: boolean };
export type ArrivalItem = { key: string; name: string; slot: 'hat' | 'top' | 'bottom' | 'shoes' | 'neck' | 'pack'; rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' };
export type Arrival = { city_id: number; name: string; country: string; photo: string | null; coins: number; first_visit: boolean; km: number; items?: ArrivalItem[] };
export type JourneyState = {
  city: CityRef; to: CityRef | null;
  route_km: number; progress_km: number; left_km: number; eta_minutes: number | null;
  mode: JourneyMode; kmh: number; tap_km: number;
  coins: number; total_km: number; taps: number;
  boots: number; companion: number; boots_cost: number | null; companion_cost: number | null;
  postcards: number; boost: Boost; arrival: Arrival | null;
};

export async function journeyRpc(fn: 'journey_sync' | 'journey_go' | 'journey_upgrade' | 'journey_buy_item', args: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data as JourneyState;
}

/** Mirrors the server's pace rules, to preview a trip before setting off. */
export function previewPace(routeKm: number, boost: Boost, boots: number, companion: number) {
  let mode: JourneyMode, base: number;
  if (routeKm > 800) { mode = 'plane'; base = boost.pilot ? 500 : 250; }
  else if (boost.train) { mode = 'train'; base = 80; }
  else if (boost.bike) { mode = 'bike'; base = 25; }
  else { mode = 'walk'; base = 12; }
  const kmh = base * boost.multiplier * (1 + 0.2 * companion);
  return { mode, kmh, tapKm: 0.04 * (1 + 0.5 * boots) * (mode === 'plane' ? 5 : 1) * boost.multiplier };
}

export function routeKm(straightKm: number) { return straightKm * (straightKm > 800 ? 1 : 1.2); }

export function formatEta(minutes: number | null) {
  if (minutes === null || !isFinite(minutes)) return '';
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))}m`;
  const h = Math.floor(minutes / 60), m = Math.round(minutes % 60);
  if (h < 24) return m ? `${h}h ${m}m` : `${h}h`;
  const d = Math.floor(h / 24), hh = h % 24;
  return hh ? `${d}d ${hh}h` : `${d}d`;
}

export const MODE_LABEL: Record<JourneyMode, string> = {
  walk: 'On foot', bike: 'By bike', train: 'By train', plane: 'By plane', parked: 'Sightseeing',
};
