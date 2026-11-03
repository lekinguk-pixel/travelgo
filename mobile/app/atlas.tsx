import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackHeader } from '@/components/social';
import { Body, Icon, Label, PixelInput } from '@/components/ui';
import { travelTime, wikiImage } from '@/lib/media';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { distanceM } from '@/lib/useChapter';
import { colors, fonts, hardShadow } from '@/lib/theme';

type City = {
  id: number; name: string; region: string | null; country_code: string; lat: number; lng: number;
  photo_thumb_url: string | null; countries: { name: string } | null; landmarks: { count: number }[];
};
type Row = City & { km: number | null; mine: number; count: number };

// The Atlas: every city in mmGO, nearest first, to plan where to go next.
export default function Atlas() {
  const { profile } = useSession();
  const [cities, setCities] = useState<Row[] | null>(null);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');

  useFocusEffect(useCallback(() => {
    (async () => {
      const [c, s] = await Promise.all([
        supabase.from('cities').select('id, name, region, country_code, lat, lng, photo_thumb_url, countries(name), landmarks(count)'),
        profile ? supabase.from('stamps').select('landmark_id, landmarks(city_id)').eq('user_id', profile.id).neq('status', 'rejected') : Promise.resolve({ data: [] }),
      ]);
      if (c.error) { setError(c.error.message); setCities([]); return; }
      const list = (c.data ?? []) as unknown as City[];
      const home = list.find((x) => x.id === profile?.home_city_id);
      const perCity = new Map<number, Set<number>>();
      for (const r of ((s.data ?? []) as any[])) {
        const cid = r.landmarks?.city_id; if (!cid) continue;
        if (!perCity.has(cid)) perCity.set(cid, new Set());
        perCity.get(cid)!.add(r.landmark_id);
      }
      setCities(list.map((x) => ({
        ...x,
        count: x.landmarks?.[0]?.count ?? 0,
        mine: perCity.get(x.id)?.size ?? 0,
        km: home ? distanceM(home.lat, home.lng, x.lat, x.lng) / 1000 : null,
      })).sort((a, b) => (a.km ?? 0) - (b.km ?? 0)));
    })();
  }, [profile]));

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (cities ?? []).filter((c) => !t || c.name.toLowerCase().includes(t) || (c.countries?.name ?? '').toLowerCase().includes(t));
  }, [cities, q]);
  const homeCountry = cities?.find((c) => c.id === profile?.home_city_id)?.country_code;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
      <BackHeader title="Atlas" />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Body>Every chapter in mmGO, nearest to home first. Tap a city to see its landmarks.</Body>
        <PixelInput value={q} onChangeText={setQ} placeholder="Search a city or country" autoCorrect={false} />
        {error ? <Body>{error}</Body> : null}
        {cities === null ? <ActivityIndicator color={colors.ink} /> : shown.map((c) => {
          const photo = wikiImage(c.photo_thumb_url);
          const home = c.id === profile?.home_city_id;
          return (
            <Pressable key={c.id} onPress={() => router.push(`/city/${c.id}`)} accessibilityRole="button" accessibilityLabel={c.name}
              style={({ pressed }) => [styles.card, hardShadow(pressed ? 1 : 4, pressed ? 1 : 4)]}>
              <View style={styles.photo}>
                {photo ? <Image source={photo} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} /> : <Icon name="map" color={colors.silver} />}
              </View>
              <View style={styles.info}>
                {home ? <Label color={colors.stamp} style={{ fontSize: 9 }}>Home city</Label> : null}
                <Text style={styles.name} numberOfLines={1}>{c.name}</Text>
                <Text style={styles.meta} numberOfLines={1}>{c.countries?.name ?? c.country_code}{!home && c.km !== null ? ` · ${travelTime(c.km, c.country_code === homeCountry)}` : ''}</Text>
                <Text style={[styles.count, { color: c.count ? colors.teal : colors.muted }]}>
                  {c.count === 0 ? 'Chapter coming soon' : c.mine ? `${c.mine} of ${c.count} landmarks stamped` : `${c.count} landmarks to discover`}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 24, paddingBottom: 40, gap: 14 },
  card: { flexDirection: 'row', backgroundColor: colors.card, borderWidth: 3, borderColor: colors.ink, overflow: 'hidden' },
  photo: { width: 104, minHeight: 96, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', borderRightWidth: 3, borderRightColor: colors.ink },
  info: { flex: 1, padding: 12, gap: 2, justifyContent: 'center' },
  name: { fontFamily: fonts.display, fontSize: 20, color: colors.ink },
  meta: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.muted },
  count: { fontFamily: fonts.bodyBold, fontSize: 12, marginTop: 4 },
});
