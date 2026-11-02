import { Redirect, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Body, Label, Panel, PixelButton, PixelInput, StepHeader, Title } from '@/components/ui';
import { travellerDraft } from '@/lib/draft';
import { useSession } from '@/lib/session';
import { friendlyError, supabase } from '@/lib/supabase';
import { colors, fonts } from '@/lib/theme';

type City = { id: number; name: string; region: string | null; country_code: string; landmarks: { count: number }[] };

// 05 Where does your adventure begin? Picking a home city creates the traveller.
export default function HomeCity() {
  const { session, refreshProfile } = useSession();
  const [cities, setCities] = useState<City[] | null>(null);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<City | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.from('cities').select('id, name, region, country_code, landmarks(count)').order('name')
      .then(({ data, error: e }) => { if (e) setError(friendlyError(e)); setCities((data as City[] | null) ?? []); });
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = cities ?? [];
    return q ? list.filter((c) => c.name.toLowerCase().includes(q)) : list;
  }, [cities, query]);

  if (!session) return <Redirect href="/" />;
  if (!travellerDraft.name || !travellerDraft.dateOfBirth) return <Redirect href="/create-traveller" />;

  async function begin() {
    if (!picked) return;
    setBusy(true); setError('');
    const { error: e } = await supabase.rpc('create_traveller', {
      p_name: travellerDraft.name, p_date_of_birth: travellerDraft.dateOfBirth,
      p_home_city_id: picked.id, p_avatar: travellerDraft.look,
    });
    if (e) { setBusy(false); setError(friendlyError(e)); return; }
    await refreshProfile();
    setBusy(false);
    router.replace({ pathname: '/send-off', params: { city: picked.name } });
  }

  const count = (c: City) => c.landmarks?.[0]?.count ?? 0;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
      <StepHeader step={3} onBack={() => router.back()} />
      <FlatList
        data={shown}
        keyExtractor={(c) => String(c.id)}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={{ gap: 14, marginBottom: 4 }}>
            <Title>Where does your adventure begin?</Title>
            <Body>Pick your home town. Its landmarks become chapter one of your book, so you can start stamping today.</Body>
            <PixelInput value={query} onChangeText={setQuery} placeholder="Search towns and cities" accessibilityLabel="Search towns and cities" autoCorrect={false} />
            <Label>{query ? 'Results' : 'Available now'}</Label>
            {cities === null ? <ActivityIndicator color={colors.ink} /> : null}
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => {
          const on = picked?.id === item.id;
          const n = count(item);
          return (
            <Panel onPress={() => setPicked(item)} accent={on ? colors.stamp : undefined} style={styles.city}>
              <View style={[styles.ini, on ? { backgroundColor: colors.stamp } : null]}>
                <Text style={[styles.iniText, on ? { color: colors.paper } : null]}>{item.name[0]}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cityName}>{item.name}</Text>
                <Text style={styles.cityMeta}>{item.region ?? item.country_code} · {n > 0 ? `${n} landmarks` : 'landmarks coming soon'}</Text>
              </View>
            </Panel>
          );
        }}
        ListEmptyComponent={cities ? <Body>No match yet. More towns are being added; pick the nearest city for now.</Body> : undefined}
        ListFooterComponent={
          <View style={{ gap: 10, marginTop: 20 }}>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <PixelButton label={picked ? `Begin in ${picked.name}` : 'Choose your home'} onPress={begin} disabled={!picked} busy={busy} />
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 32 },
  city: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12 },
  ini: { width: 40, height: 40, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  iniText: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
  cityName: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
  cityMeta: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
  error: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.stamp },
});
