import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, BackHeader, timeAgo } from '@/components/social';
import { Body, Label, SegmentBar, TextLink } from '@/components/ui';
import { levelForXp, levelProgress, SKILLS } from '@/lib/levels';
import type { Look } from '@/lib/pixel';
import { useSession } from '@/lib/session';
import { friendlyError, supabase } from '@/lib/supabase';
import { colors, fonts, hardShadow, rarityColor, type Rarity } from '@/lib/theme';

type Traveller = { id: string; traveller_name: string; avatar: Look; total_xp: number; home_city_id: number | null; cities: { name: string } | null };
type Stamp = { stamp_id: number; landmark: string; rarity: Rarity; city: string; claimed_at: string; photo_path: string };

// A friend's journey: their skills and stamp book.
export default function TravellerJourney() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useSession();
  const [who, setWho] = useState<Traveller | null>(null);
  const [xp, setXp] = useState<Record<string, number>>({});
  const [stamps, setStamps] = useState<Stamp[] | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [p, s, j] = await Promise.all([
        supabase.from('profiles').select('id, traveller_name, avatar, total_xp, home_city_id, cities(name)').eq('id', id).single(),
        supabase.from('skill_xp').select('skill, xp').eq('user_id', id),
        supabase.rpc('traveller_journey', { p_user_id: id }),
      ]);
      if (p.data) setWho(p.data as unknown as Traveller);
      setXp(Object.fromEntries((s.data ?? []).map((r) => [r.skill as string, Number(r.xp)])));
      if (j.error) { setError(friendlyError(j.error)); setStamps([]); return; }
      const list = (j.data ?? []) as Stamp[];
      setStamps(list);
      if (list.length) {
        const { data } = await supabase.storage.from('stamp-photos').createSignedUrls(list.map((x) => x.photo_path), 3600);
        setUrls(Object.fromEntries((data ?? []).filter((d) => d.signedUrl).map((d) => [d.path ?? '', d.signedUrl as string] as [string, string])));
      }
    })();
  }, [id]);

  const stats = useMemo(() => ({
    stamps: stamps?.length ?? 0,
    cities: new Set((stamps ?? []).map((s) => s.city)).size,
  }), [stamps]);

  function unfriend() {
    if (!who) return;
    Alert.alert(`Remove ${who.traveller_name}?`, 'You\'ll stop seeing each other\'s stamps and photos.', [
      { text: 'Keep', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { await supabase.rpc('remove_friend', { p_user_id: who.id }); router.back(); } },
    ]);
  }

  const totalLevel = SKILLS.reduce((sum, s) => sum + levelForXp(xp[s.key] ?? 0), 0);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
      <BackHeader title={who ? `${who.traveller_name}'s journey` : 'Journey'} />
      <ScrollView contentContainerStyle={styles.body}>
        {who ? (
          <View style={styles.player}>
            <View style={hardShadow(4, 4)}><Avatar look={who.avatar} size={72} ring={colors.gold} /></View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={styles.name}>{who.traveller_name}</Text>
              <Text style={styles.sub}>{who.cities?.name ?? 'Traveller'} · Total level {totalLevel}</Text>
              <Label color={colors.bronze} style={{ fontSize: 11 }}>{Number(who.total_xp).toLocaleString()} XP · {stats.stamps} stamps · {stats.cities} cities</Label>
            </View>
          </View>
        ) : <ActivityIndicator color={colors.ink} />}

        <View style={styles.skills}>
          {SKILLS.map((s) => (
            <View key={s.key} style={styles.skill}>
              <View style={styles.skillTop}><Text style={styles.skillName}>{s.name}</Text><Text style={styles.level}>{levelForXp(xp[s.key] ?? 0)}</Text></View>
              <SegmentBar value={levelProgress(xp[s.key] ?? 0)} color={colors.gold} track="rgba(246,240,226,0.15)" height={5} />
            </View>
          ))}
        </View>

        <Label>Stamp book</Label>
        {error ? <Body>{error}</Body> : stamps === null ? <ActivityIndicator color={colors.ink} /> : stamps.length === 0 ? (
          <Body>No stamps yet. Their first adventure is still ahead of them.</Body>
        ) : (
          <View style={styles.grid}>
            {stamps.map((s) => (
              <View key={s.stamp_id} style={[styles.polaroid, hardShadow(2, 3)]}>
                <View style={[styles.photo, { borderColor: rarityColor(s.rarity) }]}>
                  {urls[s.photo_path] ? <Image source={{ uri: urls[s.photo_path] }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
                </View>
                <Text style={styles.cap} numberOfLines={1}>{s.landmark.toUpperCase()}</Text>
                <Text style={styles.capSub} numberOfLines={1}>{s.city} · {timeAgo(s.claimed_at)}</Text>
              </View>
            ))}
          </View>
        )}
        {who && profile && who.id !== profile.id && !error ? <TextLink label="Remove friend" color={colors.muted} onPress={unfriend} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 24, paddingBottom: 40, gap: 16 },
  player: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  name: { fontFamily: fonts.display, fontSize: 24, color: colors.ink },
  sub: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.muted },
  skills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  skill: { width: '31%', flexGrow: 1, backgroundColor: colors.ink, borderWidth: 2, borderColor: colors.bronze, padding: 8, gap: 6 },
  skillTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  skillName: { fontFamily: fonts.display, fontSize: 13, color: colors.paper },
  level: { fontFamily: fonts.label, fontSize: 12, color: colors.gold },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  polaroid: { width: '47%', backgroundColor: colors.card, padding: 8, gap: 4 },
  photo: { aspectRatio: 1, backgroundColor: '#D7E9E5', borderBottomWidth: 3, overflow: 'hidden' },
  cap: { fontFamily: fonts.labelBold, fontSize: 10, color: colors.ink, marginTop: 4 },
  capSub: { fontFamily: fonts.body, fontSize: 11, color: colors.muted },
});
