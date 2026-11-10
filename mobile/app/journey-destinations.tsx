import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackHeader } from '@/components/social';
import { Body, PixelInput } from '@/components/ui';
import { formatEta, journeyRpc, MODE_LABEL, previewPace, routeKm, type JourneyState } from '@/lib/journey';
import { wikiImage } from '@/lib/media';
import { friendlyError, supabase } from '@/lib/supabase';
import { distanceM } from '@/lib/useChapter';
import { colors, fonts, hardShadow } from '@/lib/theme';

type City = { id: number; name: string; lat: number; lng: number; photo_thumb_url: string | null; country_code: string; countries: { name: string } | null };

// Where should the digital traveller head next? Nearest first, with how long each trip takes.
export default function JourneyDestinations() {
  const [j, setJ] = useState<JourneyState | null>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [have, setHave] = useState<Set<number>>(new Set());
  const [q, setQ] = useState('');
  const [outfits, setOutfits] = useState<Map<number, string[]>>(new Map());
  const [flags, setFlags] = useState<Set<string>>(new Set());
  const [onlyUnlocks, setOnlyUnlocks] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState('');

  useFocusEffect(useCallback(() => {
    (async () => {
      try {
        const [s, c, p, a, w] = await Promise.all([
          journeyRpc('journey_sync', { p_taps: 0 }),
          supabase.from('cities').select('id, name, lat, lng, photo_thumb_url, country_code, countries(name)'),
          supabase.rpc('my_postcards'),
          supabase.rpc('arrival_rewards'),
          supabase.rpc('my_wardrobe'),
        ]);
        const m = new Map<number, string[]>();
        ((a.data ?? []) as { city_id: number; item_name: string; owned: boolean }[]).filter((x) => !x.owned)
          .forEach((x) => m.set(x.city_id, [...(m.get(x.city_id) ?? []), x.item_name]));
        setOutfits(m);
        setFlags(new Set(((w.data ?? []) as { key: string; source: string; owned: boolean }[]).filter((x) => x.source === 'flag' && x.owned).map((x) => x.key)));
        setJ(s); setCities((c.data ?? []) as unknown as City[]);
        setHave(new Set(((p.data ?? []) as { city_id: number }[]).map((x) => x.city_id)));
      } catch (e) { setError(friendlyError(e)); }
    })();
  }, []));

  const here = cities.find((c) => c.id === j?.city.id);
  const rows = useMemo(() => {
    if (!j || !here) return [];
    const t = q.trim().toLowerCase();
    return cities.filter((c) => c.id !== here.id && (!onlyUnlocks || outfits.has(c.id)) && (!t || c.name.toLowerCase().includes(t) || (c.countries?.name ?? '').toLowerCase().includes(t)))
      .map((c) => {
        const km = routeKm(distanceM(here.lat, here.lng, c.lat, c.lng) / 1000);
        const pace = previewPace(km, j.boost, j.boots, j.companion);
        return { c, km, pace, eta: (km / pace.kmh) * 60 };
      }).sort((a, b) => a.km - b.km);
  }, [cities, here, j, q, onlyUnlocks, outfits]);

  async function go(id: number) {
    setBusy(id); setError('');
    try { await journeyRpc('journey_go', { p_city_id: id }); router.back(); }
    catch (e) { setError(friendlyError(e)); setBusy(null); }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
      <BackHeader title="Where next?" />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {j ? <Body>Your traveller sets off from {j.city.name}. Long trips keep going while you're away, up to 8 hours at a time.</Body> : null}
        <PixelInput value={q} onChangeText={setQ} placeholder="Search a city or country" autoCorrect={false} />
        <Pressable onPress={() => setOnlyUnlocks((v) => !v)} accessibilityRole="checkbox" accessibilityState={{ checked: onlyUnlocks }} style={styles.toggle}>
          <View style={[styles.box, onlyUnlocks ? { backgroundColor: colors.gold } : null]}>{onlyUnlocks ? <Text style={styles.tick}>✓</Text> : null}</View>
          <Text style={styles.toggleText}>Only cities with an outfit to unlock ({outfits.size})</Text>
        </Pressable>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!j ? <ActivityIndicator color={colors.ink} /> : rows.map(({ c, km, pace, eta }) => {
          const src = wikiImage(c.photo_thumb_url);
          return (
            <Pressable key={c.id} onPress={() => go(c.id)} disabled={busy !== null} accessibilityRole="button"
              accessibilityLabel={`Travel to ${c.name}, ${Math.round(km)} kilometres, about ${formatEta(eta)}`}
              style={({ pressed }) => [styles.card, hardShadow(pressed ? 1 : 4, pressed ? 1 : 4), j.to?.id === c.id ? { borderColor: colors.gold } : null]}>
              <View style={styles.photo}>{src ? <Image source={src} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}</View>
              <View style={{ flex: 1, padding: 10, gap: 2 }}>
                <Text style={styles.name} numberOfLines={1}>{c.name}</Text>
                <Text style={styles.meta}>{c.countries?.name} · {Math.round(km).toLocaleString()} km</Text>
                <Text style={styles.eta}>{MODE_LABEL[pace.mode]} · about {formatEta(eta)}</Text>
                {outfits.has(c.id) ? <Text style={styles.unlock} numberOfLines={1}>UNLOCKS {outfits.get(c.id)!.join(' + ').toUpperCase()}</Text> : null}
                {!flags.has(`flag_${c.country_code.toLowerCase()}`) ? <Text style={styles.flag}>+ {(c.countries?.name ?? '').toUpperCase()} FLAG TEE</Text> : null}
                {have.has(c.id) ? <Text style={styles.have}>✓ POSTCARD COLLECTED</Text> : j.to?.id === c.id ? <Text style={styles.have}>HEADING HERE NOW</Text> : null}
              </View>
              {busy === c.id ? <ActivityIndicator color={colors.ink} style={{ marginRight: 12 }} /> : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  box: { width: 24, height: 24, borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  tick: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
  toggleText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.ink },
  unlock: { fontFamily: fonts.labelBold, fontSize: 10, color: colors.stamp, marginTop: 2 },
  flag: { fontFamily: fonts.labelBold, fontSize: 9.5, color: colors.teal },
  body: { paddingHorizontal: 24, paddingBottom: 40, gap: 12 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderWidth: 3, borderColor: colors.ink, overflow: 'hidden' },
  photo: { width: 92, alignSelf: 'stretch', minHeight: 84, backgroundColor: '#D7E9E5', borderRightWidth: 3, borderRightColor: colors.ink },
  name: { fontFamily: fonts.display, fontSize: 19, color: colors.ink },
  meta: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.muted },
  eta: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.teal },
  have: { fontFamily: fonts.labelBold, fontSize: 9, color: colors.bronze, marginTop: 2 },
  error: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.paper, backgroundColor: colors.stamp, padding: 10 },
});
