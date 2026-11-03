import * as Location from 'expo-location';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LandmarkRow } from '@/components/LandmarkRow';
import { Body, Label, PixelButton, Title } from '@/components/ui';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { distanceM, formatDistance, LANDMARK_FIELDS, type Chapter, type Landmark } from '@/lib/useChapter';
import { colors, fonts } from '@/lib/theme';

type Near = Chapter['landmarks'][number];

// The centre Stamp button: finds the nearest landmark you haven't stamped yet.
export default function StampNearest() {
  const { profile } = useSession();
  const [perm, setPerm] = useState<Location.PermissionResponse | null>(null);
  const [nearby, setNearby] = useState<Near[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    const p = await Location.getForegroundPermissionsAsync();
    setPerm(p);
    if (!p.granted || !profile) return;
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude: lat, longitude: lng } = pos.coords;
      // Landmarks within roughly 25 km.
      const d = 0.25;
      const [lm, st] = await Promise.all([
        supabase.from('landmarks').select(LANDMARK_FIELDS)
          .gte('lat', lat - d).lte('lat', lat + d).gte('lng', lng - d * 1.6).lte('lng', lng + d * 1.6),
        supabase.from('stamps').select('landmark_id').eq('user_id', profile.id),
      ]);
      if (lm.error) throw lm.error;
      const mine = new Set((st.data ?? []).map((s) => s.landmark_id as number));
      const rows = ((lm.data ?? []) as Landmark[])
        .map((l) => ({ ...l, stamped: mine.has(l.id), distanceM: distanceM(lat, lng, l.lat, l.lng) }))
        .filter((l) => !l.stamped)
        .sort((a, b) => a.distanceM - b.distanceM)
        .slice(0, 5);
      setNearby(rows);
    } catch {
      setError('Couldn\'t get your location. Check that location is switched on and try again.');
    }
  }, [profile]);

  useFocusEffect(useCallback(() => { setNearby(null); load(); }, [load]));

  if (!perm) return <SafeAreaView style={styles.center}><ActivityIndicator color={colors.ink} /></SafeAreaView>;
  if (!perm.granted) return (
    <SafeAreaView style={styles.wrap}>
      <Title>Where are you, traveller?</Title>
      <Body>mmGO uses your location to find landmarks near you and to confirm you're really there when you stamp one. It's only checked while you're using the app.</Body>
      <PixelButton label={perm.canAskAgain ? 'Allow location' : 'Open settings'}
        onPress={async () => { if (!perm.canAskAgain) { Linking.openSettings(); return; } await Location.requestForegroundPermissionsAsync(); load(); }} />
    </SafeAreaView>
  );

  const closest = nearby?.[0];
  const ready = !!closest && (closest.distanceM ?? Infinity) <= closest.radius_m;
  return (
    <SafeAreaView style={styles.wrap} edges={['top']}>
      <Label color={colors.stamp} style={{ fontSize: 11 }}>Stamp a landmark</Label>
      <Title>{nearby === null ? 'Looking around...' : !closest ? 'No landmarks nearby yet' : ready ? `You're at ${closest.name}!` : 'Nearest landmarks'}</Title>
      {error ? <Body>{error}</Body> : null}
      {nearby === null && !error ? <ActivityIndicator color={colors.ink} /> : null}
      {closest ? (
        <>
          <Body>{ready ? 'Take a photo of yourself here to collect the stamp.' : `${closest.name} is ${formatDistance(closest.distanceM ?? null)}. Get within ${closest.radius_m} m to stamp it.`}</Body>
          {ready ? <PixelButton label={`Stamp ${closest.name}`} onPress={() => router.push(`/camera/${closest.id}`)} /> : null}
          <View style={{ gap: 10 }}>
            {nearby!.map((l) => <LandmarkRow key={l.id} landmark={l} onPress={() => router.push(`/camera/${l.id}`)} />)}
          </View>
        </>
      ) : nearby ? (
        <Body>We're adding landmarks city by city. Head to your home chapter on the Explore tab to see what's ready.</Body>
      ) : null}
      <Text style={styles.refresh} onPress={() => { setNearby(null); load(); }}>REFRESH</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper },
  wrap: { flex: 1, backgroundColor: colors.paper, padding: 24, gap: 16 },
  refresh: { fontFamily: fonts.label, fontSize: 12, color: colors.ink, alignSelf: 'center', padding: 8 },
});
