import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, Icon, Label, PixelButton, TextLink } from '@/components/ui';
import { SKILL_NAMES, wikiImage, type Media } from '@/lib/media';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { distanceM, formatDistance, type Landmark } from '@/lib/useChapter';
import { colors, fonts, hardShadow, rarityColor, rarityXp } from '@/lib/theme';

type Detail = Landmark & Media & { cities: { id: number; name: string; country_code: string } | null };

// A landmark's page: photo, what it is, where it is, and the way to stamp it.
export default function LandmarkDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useSession();
  const insets = useSafeAreaInsets();
  const [lm, setLm] = useState<Detail | null>(null);
  const [stampedAt, setStampedAt] = useState<string | null>(null);
  const [away, setAway] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('landmarks')
        .select('id, city_id, name, lat, lng, radius_m, rarity, is_major, skills, description, summary, wiki_url, photo_url, photo_thumb_url, photo_credit, photo_license, photo_license_url, photo_source_url, cities(id, name, country_code)')
        .eq('id', Number(id)).single();
      if (!data) { setMissing(true); return; }
      setLm(data as unknown as Detail);
      if (profile) {
        const { data: s } = await supabase.from('stamps').select('claimed_at').eq('user_id', profile.id).eq('landmark_id', Number(id))
          .neq('status', 'rejected').order('claimed_at').limit(1);
        setStampedAt(s?.[0]?.claimed_at ?? null);
      }
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (perm.granted) {
          const p = await Location.getLastKnownPositionAsync();
          if (p) setAway(distanceM(p.coords.latitude, p.coords.longitude, (data as unknown as Detail).lat, (data as unknown as Detail).lng));
        }
      } catch { /* distance is optional */ }
    })();
  }, [id, profile]);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));
  if (missing) return <SafeAreaView style={styles.center}><Body>That landmark couldn't be found.</Body><TextLink label="Back" onPress={back} /></SafeAreaView>;
  if (!lm) return <SafeAreaView style={styles.center}><ActivityIndicator color={colors.ink} /></SafeAreaView>;

  const rc = rarityColor(lm.rarity);
  const photo = wikiImage(lm.photo_url ?? lm.photo_thumb_url);
  const summary = lm.summary ?? '';
  const long = summary.length > 420;
  const openMaps = () => {
    const label = encodeURIComponent(lm.name);
    const url = Platform.OS === 'android' ? `geo:${lm.lat},${lm.lng}?q=${lm.lat},${lm.lng}(${label})`
      : `https://maps.apple.com/?ll=${lm.lat},${lm.lng}&q=${label}`;
    Linking.openURL(url).catch(() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lm.lat},${lm.lng}`));
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}>
        <View style={[styles.hero, { borderColor: rc }]}>
          {photo ? <Image source={photo} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
            : <View style={styles.noPhoto}><Icon name="map" color={colors.silver} size={48} /></View>}
          <View style={styles.heroShade} />
          <Pressable onPress={back} accessibilityRole="button" accessibilityLabel="Back"
            style={[styles.round, { top: insets.top + 8 }]}><Icon name="back" color={colors.paper} /></Pressable>
          <View style={styles.heroText}>
            <View style={[styles.rarity, { backgroundColor: rc }]}><Text style={styles.rarityText}>{lm.rarity.toUpperCase()}</Text></View>
            <Text style={styles.name}>{lm.name}</Text>
            <Text style={styles.city}>{lm.cities?.name}{lm.description ? ` · ${lm.description}` : ''}</Text>
          </View>
        </View>
        {lm.photo_credit && photo ? (
          <Pressable onPress={() => lm.photo_source_url && Linking.openURL(lm.photo_source_url)} accessibilityRole="link" style={styles.creditRow}>
            <Text style={styles.credit} numberOfLines={2}>Photo: {lm.photo_credit} · {lm.photo_license} · Wikimedia Commons</Text>
          </Pressable>
        ) : null}

        <View style={styles.body}>
          <View style={styles.facts}>
            <View style={[styles.fact, hardShadow(3, 3)]}><Text style={styles.factBig}>+{rarityXp[lm.rarity]}</Text><Text style={styles.factLabel}>XP</Text></View>
            <View style={[styles.fact, hardShadow(3, 3)]}><Text style={styles.factBig}>{away === null ? '—' : formatDistance(away).replace(' away', '')}</Text><Text style={styles.factLabel}>From you</Text></View>
            <View style={[styles.fact, hardShadow(3, 3), stampedAt ? { backgroundColor: colors.stamp } : null]}>
              <Text style={[styles.factBig, stampedAt ? { color: colors.paper } : null]}>{stampedAt ? '✓' : '—'}</Text>
              <Text style={[styles.factLabel, stampedAt ? { color: colors.paper } : null]}>{stampedAt ? new Date(stampedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not stamped'}</Text>
            </View>
          </View>

          <View style={styles.skills}>
            {lm.skills.map((s) => <View key={s} style={styles.skill}><Text style={styles.skillText}>{(SKILL_NAMES[s] ?? s).toUpperCase()}</Text></View>)}
            {lm.is_major ? <View style={[styles.skill, { borderColor: colors.gold }]}><Text style={[styles.skillText, { color: colors.bronze }]}>COUNTS TO CHAPTER</Text></View> : null}
          </View>

          {summary ? (
            <View style={{ gap: 8 }}>
              <Label>About</Label>
              <Text style={styles.summary}>{long && !expanded ? summary.slice(0, 420).replace(/\s+\S*$/, '') + '…' : summary}</Text>
              {long ? <TextLink label={expanded ? 'Show less' : 'Read more'} color={colors.teal} onPress={() => setExpanded((e) => !e)} /> : null}
              {lm.wiki_url ? (
                <Pressable onPress={() => Linking.openURL(lm.wiki_url!)} accessibilityRole="link">
                  <Text style={styles.source}>Text from Wikipedia, CC BY-SA 4.0 · Open the full article</Text>
                </Pressable>
              ) : null}
            </View>
          ) : <Body>More about this place is on its way.</Body>}

          <View style={{ gap: 8 }}>
            <Label>Getting there</Label>
            <Text style={styles.how}>Stamp it within {lm.radius_m} m of the spot. Your photo must be taken in mmGO while you're there.</Text>
            <PixelButton label="Open in maps" tone="ink" onPress={openMaps} />
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <PixelButton label={stampedAt ? 'Stamp again' : 'Stamp it'} onPress={() => router.push(`/camera/${lm.id}`)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.paper, padding: 24 },
  hero: { height: 340, backgroundColor: colors.ink, borderBottomWidth: 4, overflow: 'hidden', justifyContent: 'flex-end' },
  noPhoto: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  heroShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 170, backgroundColor: 'rgba(27,42,65,0.62)' },
  round: { position: 'absolute', left: 16, width: 44, height: 44, backgroundColor: 'rgba(27,42,65,0.75)', borderWidth: 2, borderColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  heroText: { padding: 20, gap: 6 },
  rarity: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderWidth: 2, borderColor: colors.ink },
  rarityText: { fontFamily: fonts.labelBold, fontSize: 10, color: colors.paper },
  name: { fontFamily: fonts.display, fontSize: 30, color: colors.paper, lineHeight: 34 },
  city: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.paper },
  creditRow: { paddingHorizontal: 20, paddingTop: 6 },
  credit: { fontFamily: fonts.body, fontSize: 10, color: colors.muted },
  body: { paddingHorizontal: 20, paddingTop: 16, gap: 20 },
  facts: { flexDirection: 'row', gap: 10 },
  fact: { flex: 1, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.ink, paddingVertical: 10, alignItems: 'center', gap: 2 },
  factBig: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
  factLabel: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.muted, textAlign: 'center' },
  skills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  skill: { borderWidth: 2, borderColor: colors.ink, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: colors.card },
  skillText: { fontFamily: fonts.label, fontSize: 9, color: colors.ink },
  summary: { fontFamily: fonts.body, fontSize: 15, lineHeight: 23, color: colors.ink },
  source: { fontFamily: fonts.body, fontSize: 11, color: colors.teal },
  how: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.muted },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12, backgroundColor: colors.paper, borderTopWidth: 3, borderTopColor: colors.ink },
});
