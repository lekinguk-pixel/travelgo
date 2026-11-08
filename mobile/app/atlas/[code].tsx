import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AtlasCard } from '@/components/AtlasCard';
import { Body, Icon, Label, PixelInput } from '@/components/ui';
import { loadAtlas, type AtlasCountry } from '@/lib/atlas';
import { travelTime, wikiImage } from '@/lib/media';
import { useSession } from '@/lib/session';
import { friendlyError, supabase } from '@/lib/supabase';
import { colors, fonts, hardShadow, rarityColor, type Rarity } from '@/lib/theme';

type LandmarkHit = { id: number; name: string; city_id: number; rarity: Rarity; photo_thumb_url: string | null };

// One country: its cities, and a search across its cities and landmarks.
export default function AtlasCountry() {
  const { code, q: initial } = useLocalSearchParams<{ code: string; q?: string }>();
  const { profile } = useSession();
  const insets = useSafeAreaInsets();
  const [country, setCountry] = useState<AtlasCountry | null>(null);
  const [homeCountry, setHomeCountry] = useState<string | undefined>();
  const [landmarks, setLandmarks] = useState<LandmarkHit[]>([]);
  const [q, setQ] = useState(initial ?? '');
  const [error, setError] = useState('');

  useFocusEffect(useCallback(() => {
    (async () => {
      try {
        const a = await loadAtlas(profile?.id, profile?.home_city_id);
        const co = a.countries.find((x) => x.code === code) ?? null;
        setCountry(co); setHomeCountry(a.homeCountry);
        if (co?.cities.length) {
          const { data } = await supabase.from('landmarks').select('id, name, city_id, rarity, photo_thumb_url')
            .in('city_id', co.cities.map((c) => c.id)).order('name');
          setLandmarks((data ?? []) as LandmarkHit[]);
        }
      } catch (e) { setError(friendlyError(e)); }
    })();
  }, [code, profile?.id, profile?.home_city_id]));

  const t = q.trim().toLowerCase();
  const cities = useMemo(() => (country?.cities ?? []).filter((c) => !t || c.name.toLowerCase().includes(t) || (c.region ?? '').toLowerCase().includes(t)), [country, t]);
  const hits = useMemo(() => (t ? landmarks.filter((l) => l.name.toLowerCase().includes(t)).slice(0, 30) : []), [landmarks, t]);
  const cityName = (id: number) => country?.cities.find((c) => c.id === id)?.name ?? '';

  const back = () => (router.canGoBack() ? router.back() : router.replace('/atlas'));
  if (error) return <View style={styles.center}><Body>{error}</Body></View>;
  if (!country) return <View style={styles.center}><ActivityIndicator color={colors.ink} /></View>;

  const hero = wikiImage(country.photo);
  const home = country.code === homeCountry;
  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          {hero ? <Image source={hero} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : null}
          <View style={styles.shade} />
          <Pressable onPress={back} accessibilityRole="button" accessibilityLabel="Back" style={[styles.round, { top: insets.top + 8 }]}>
            <Icon name="back" color={colors.paper} />
          </Pressable>
          <View style={styles.heroText}>
            <Label color={colors.gold}>{home ? 'Your country' : 'Atlas'}</Label>
            <Text style={styles.name}>{country.name}</Text>
            <Text style={styles.sub}>
              {country.cities.length} {country.cities.length === 1 ? 'city' : 'cities'} · {country.count} landmarks
              {!home && country.km !== null ? ` · ${travelTime(country.km, false)}` : ''}
            </Text>
          </View>
        </View>

        <View style={styles.body}>
          {country.mine ? (
            <View style={[styles.progress, hardShadow(4, 4)]}>
              <Text style={styles.progressText}>{country.mine} of {country.count} landmarks stamped in {country.name}</Text>
            </View>
          ) : null}
          <PixelInput value={q} onChangeText={setQ} placeholder={`Search cities and landmarks in ${country.name}`} autoCorrect={false} />

          {hits.length ? (
            <View style={{ gap: 10 }}>
              <Label>Landmarks · {hits.length}</Label>
              {hits.map((l) => {
                const src = wikiImage(l.photo_thumb_url);
                return (
                  <Pressable key={l.id} onPress={() => router.push(`/landmark/${l.id}`)} accessibilityRole="button" accessibilityLabel={l.name}
                    style={({ pressed }) => [styles.hit, hardShadow(pressed ? 1 : 3, pressed ? 1 : 3)]}>
                    <View style={[styles.hitPhoto, { borderColor: rarityColor(l.rarity) }]}>
                      {src ? <Image source={src} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Icon name="map" color={colors.paper} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.hitName} numberOfLines={1}>{l.name}</Text>
                      <Text style={[styles.hitMeta, { color: rarityColor(l.rarity) }]}>{l.rarity.toUpperCase()} · {cityName(l.city_id)}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          <Label>{t ? `Cities · ${cities.length}` : 'Cities'}</Label>
          {cities.length === 0 ? <Body>{t ? `No cities in ${country.name} match “${q}”.` : 'Chapters here are coming soon.'}</Body> : cities.map((c) => {
            const isHome = c.id === profile?.home_city_id;
            return (
              <AtlasCard key={c.id} photo={c.photo_thumb_url} kicker={isHome ? 'Home city' : undefined} title={c.name}
                meta={`${c.region ?? country.name}${!isHome && c.km !== null ? ` · ${travelTime(c.km, c.country_code === homeCountry)}` : ''}`}
                statusOn={c.count > 0}
                status={c.count === 0 ? 'Chapter coming soon' : c.mine ? `${c.mine} of ${c.count} landmarks stamped` : `${c.count} landmarks to discover`}
                onPress={() => router.push(`/city/${c.id}`)} />
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper, padding: 24 },
  hero: { height: 260, backgroundColor: colors.ink, borderBottomWidth: 4, borderBottomColor: colors.ink, justifyContent: 'flex-end', overflow: 'hidden' },
  shade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 150, backgroundColor: 'rgba(27,42,65,0.62)' },
  round: { position: 'absolute', left: 16, width: 44, height: 44, backgroundColor: 'rgba(27,42,65,0.75)', borderWidth: 2, borderColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  heroText: { padding: 20, gap: 4 },
  name: { fontFamily: fonts.display, fontSize: 34, color: colors.paper },
  sub: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.paper },
  body: { paddingHorizontal: 20, paddingTop: 16, gap: 14 },
  progress: { backgroundColor: colors.ink, borderWidth: 3, borderColor: colors.gold, padding: 14 },
  progressText: { fontFamily: fonts.display, fontSize: 16, color: colors.paper },
  hit: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.ink, padding: 8 },
  hitPhoto: { width: 52, height: 52, borderWidth: 3, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  hitName: { fontFamily: fonts.display, fontSize: 16, color: colors.ink },
  hitMeta: { fontFamily: fonts.bodySemi, fontSize: 11 },
});
