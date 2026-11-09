import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { DealsCard } from '@/components/DealsCard';
import { LandmarkRow } from '@/components/LandmarkRow';
import { Body, Icon, Label, SegmentBar, TextLink } from '@/components/ui';
import { travelTime, wikiImage, type Media } from '@/lib/media';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { distanceM, LANDMARK_FIELDS, type Chapter, type Landmark } from '@/lib/useChapter';
import { colors, fonts, hardShadow, type Rarity } from '@/lib/theme';

type City = Media & { id: number; name: string; region: string | null; country_code: string; lat: number; lng: number; countries: { name: string } | null };
const ORDER: Rarity[] = ['legendary', 'epic', 'rare', 'uncommon', 'common'];

// A city chapter seen from afar: what it's like, how far it is, and its landmarks.
export default function CityPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useSession();
  const insets = useSafeAreaInsets();
  const [city, setCity] = useState<City | null>(null);
  const [rows, setRows] = useState<Chapter['landmarks'] | null>(null);
  const [km, setKm] = useState<{ km: number; same: boolean } | null>(null);
  const [expanded, setExpanded] = useState(false);

  useFocusEffect(useCallback(() => {
    (async () => {
      const cityId = Number(id);
      const [c, l, s, home] = await Promise.all([
        supabase.from('cities').select('id, name, region, country_code, lat, lng, summary, description:region, wiki_url, photo_url, photo_thumb_url, photo_credit, photo_license, photo_license_url, photo_source_url, countries(name)').eq('id', cityId).single(),
        supabase.from('landmarks').select(LANDMARK_FIELDS).eq('city_id', cityId),
        profile ? supabase.from('stamps').select('landmark_id').eq('user_id', profile.id).neq('status', 'rejected') : Promise.resolve({ data: [] }),
        profile?.home_city_id ? supabase.from('cities').select('lat, lng, country_code').eq('id', profile.home_city_id).single() : Promise.resolve({ data: null }),
      ]);
      const cc = c.data as unknown as City | null;
      setCity(cc);
      let pos: { lat: number; lng: number } | null = null;
      try {
        if ((await Location.getForegroundPermissionsAsync()).granted) {
          const p = await Location.getLastKnownPositionAsync();
          if (p) pos = { lat: p.coords.latitude, lng: p.coords.longitude };
        }
      } catch { /* optional */ }
      const mine = new Set(((s.data ?? []) as { landmark_id: number }[]).map((x) => x.landmark_id));
      const list = ((l.data ?? []) as Landmark[]).map((x) => ({
        ...x, stamped: mine.has(x.id), distanceM: pos ? distanceM(pos.lat, pos.lng, x.lat, x.lng) : null,
      }));
      list.sort((a, b) => ORDER.indexOf(a.rarity) - ORDER.indexOf(b.rarity) || a.name.localeCompare(b.name));
      setRows(list);
      const h = home.data as { lat: number; lng: number; country_code: string } | null;
      if (h && cc && cc.id !== profile?.home_city_id) setKm({ km: distanceM(h.lat, h.lng, cc.lat, cc.lng) / 1000, same: h.country_code === cc.country_code });
    })();
  }, [id, profile]));

  const back = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));
  if (!city || !rows) return <SafeAreaView style={styles.center}><ActivityIndicator color={colors.ink} /></SafeAreaView>;

  const photo = wikiImage(city.photo_url ?? city.photo_thumb_url);
  const major = rows.filter((r) => r.is_major);
  const done = major.filter((r) => r.stamped).length;
  const summary = city.summary ?? '';
  const long = summary.length > 360;

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        <View style={styles.hero}>
          {photo ? <Image source={photo} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : null}
          <View style={styles.shade} />
          <Pressable onPress={back} accessibilityRole="button" accessibilityLabel="Back" style={[styles.round, { top: insets.top + 8 }]}>
            <Icon name="back" color={colors.paper} />
          </Pressable>
          <View style={styles.heroText}>
            <Label color={colors.gold}>{city.countries?.name ?? city.country_code}</Label>
            <Text style={styles.name}>{city.name}</Text>
            {km ? <Text style={styles.sub}>{travelTime(km.km, km.same)} from home</Text> : null}
          </View>
        </View>
        {city.photo_credit && photo ? (
          <Pressable onPress={() => city.photo_source_url && Linking.openURL(city.photo_source_url)} accessibilityRole="link" style={{ paddingHorizontal: 20, paddingTop: 6 }}>
            <Text style={styles.credit} numberOfLines={2}>Photo: {city.photo_credit} · {city.photo_license} · Wikimedia Commons</Text>
          </Pressable>
        ) : null}

        <View style={styles.body}>
          {summary ? (
            <View style={{ gap: 6 }}>
              <Text style={styles.summary}>{long && !expanded ? summary.slice(0, 360).replace(/\s+\S*$/, '') + '…' : summary}</Text>
              {long ? <TextLink label={expanded ? 'Show less' : 'Read more'} color={colors.teal} onPress={() => setExpanded((e) => !e)} /> : null}
              {city.wiki_url ? <Pressable onPress={() => Linking.openURL(city.wiki_url!)} accessibilityRole="link"><Text style={styles.source}>Text from Wikipedia, CC BY-SA 4.0</Text></Pressable> : null}
            </View>
          ) : null}

          {city.id !== profile?.home_city_id ? <DealsCard cityId={city.id} cityName={city.name} source="city" /> : null}

          {major.length ? (
            <View style={[styles.progress, hardShadow(4, 4)]}>
              <Text style={styles.progressText}>{done} / {major.length} major landmarks stamped</Text>
              <SegmentBar value={major.length ? done / major.length : 0} color={colors.gold} track="rgba(246,240,226,0.15)" />
              <Text style={styles.progressSub}>Bronze at {Math.ceil(major.length * 0.5)} · Silver at {Math.ceil(major.length * 0.8)} · Gold at {major.length}</Text>
            </View>
          ) : null}

          <Label>Landmarks · {rows.length}</Label>
          {rows.length === 0 ? <Body>This chapter is coming soon. Its landmarks are being added.</Body>
            : rows.map((r) => <LandmarkRow key={r.id} landmark={r} onPress={() => router.push(`/landmark/${r.id}`)} />)}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper },
  hero: { height: 280, backgroundColor: colors.ink, borderBottomWidth: 4, borderBottomColor: colors.ink, justifyContent: 'flex-end', overflow: 'hidden' },
  shade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 150, backgroundColor: 'rgba(27,42,65,0.62)' },
  round: { position: 'absolute', left: 16, width: 44, height: 44, backgroundColor: 'rgba(27,42,65,0.75)', borderWidth: 2, borderColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  heroText: { padding: 20, gap: 4 },
  name: { fontFamily: fonts.display, fontSize: 34, color: colors.paper },
  sub: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.paper },
  credit: { fontFamily: fonts.body, fontSize: 10, color: colors.muted },
  body: { paddingHorizontal: 20, paddingTop: 16, gap: 14 },
  summary: { fontFamily: fonts.body, fontSize: 15, lineHeight: 23, color: colors.ink },
  source: { fontFamily: fonts.body, fontSize: 11, color: colors.teal },
  progress: { backgroundColor: colors.ink, borderWidth: 3, borderColor: colors.gold, padding: 14, gap: 8 },
  progressText: { fontFamily: fonts.display, fontSize: 17, color: colors.paper },
  progressSub: { fontFamily: fonts.body, fontSize: 12, color: colors.silver },
});
