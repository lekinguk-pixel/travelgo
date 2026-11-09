import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AtlasCard } from '@/components/AtlasCard';
import { SpinBanner } from '@/components/SpinBanner';
import { BackHeader } from '@/components/social';
import { Body, PixelInput } from '@/components/ui';
import { loadAtlas, type AtlasCountry } from '@/lib/atlas';
import { travelTime } from '@/lib/media';
import { useSession } from '@/lib/session';
import { friendlyError } from '@/lib/supabase';
import { colors } from '@/lib/theme';

// The Atlas starts with countries, nearest to home first.
export default function AtlasCountries() {
  const { profile } = useSession();
  const [countries, setCountries] = useState<AtlasCountry[] | null>(null);
  const [homeCountry, setHomeCountry] = useState<string | undefined>();
  const [q, setQ] = useState('');
  const [error, setError] = useState('');

  useFocusEffect(useCallback(() => {
    loadAtlas(profile?.id, profile?.home_city_id)
      .then((a) => { setCountries(a.countries); setHomeCountry(a.homeCountry); })
      .catch((e) => { setError(friendlyError(e)); setCountries([]); });
  }, [profile?.id, profile?.home_city_id]));

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return countries ?? [];
    // Match the country, or any of its cities, so "Kyoto" finds Japan.
    return (countries ?? []).filter((c) => c.name.toLowerCase().includes(t) || c.cities.some((x) => x.name.toLowerCase().includes(t)));
  }, [countries, q]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
      <BackHeader title="Atlas" />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Body>Choose a country to see its cities and landmarks.</Body>
        {!q ? <SpinBanner /> : null}
        <PixelInput value={q} onChangeText={setQ} placeholder="Search a country or city" autoCorrect={false} />
        {error ? <Body>{error}</Body> : null}
        {countries === null ? <ActivityIndicator color={colors.ink} /> : shown.length === 0 ? <Body>No countries match “{q}”.</Body> : shown.map((c) => {
          const home = c.code === homeCountry;
          const cityWord = `${c.cities.length} ${c.cities.length === 1 ? 'city' : 'cities'}`;
          return (
            <AtlasCard key={c.code} photo={c.photo} kicker={home ? 'Your country' : undefined} title={c.name}
              meta={home || c.km === null ? cityWord : `${cityWord} · ${travelTime(c.km, false)}`}
              statusOn={c.count > 0}
              status={c.count === 0 ? 'Chapters coming soon' : c.mine ? `${c.mine} of ${c.count} landmarks stamped` : `${c.count} landmarks to discover`}
              onPress={() => router.push({ pathname: '/atlas/[code]', params: { code: c.code, q: q.trim() } })} />
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 24, paddingBottom: 40, gap: 14 },
});
