import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Label, PixelArt, SegmentBar, TextLink } from '@/components/ui';
import { levelForXp, levelProgress, SKILLS } from '@/lib/levels';
import { HERO_TOP, heroPalette, LEGS_A } from '@/lib/pixel';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { colors, fonts, hardShadow } from '@/lib/theme';

const SKILL_COLOR: Record<string, string> = { explorer: colors.stamp, wanderer: colors.teal, culture: colors.bronze, nature: colors.teal, foodie: colors.gold, pilgrim: colors.stamp };
const TIER_COLOR: Record<string, string> = { gold: colors.gold, silver: colors.silver, bronze: colors.bronze };

// 09 Profile and skills.
export default function Me() {
  const { profile, refreshProfile, signOut } = useSession();
  const [xp, setXp] = useState<Record<string, number>>({});
  const [stats, setStats] = useState({ stamps: 0, cities: 0, countries: 0 });
  const [awards, setAwards] = useState<{ city: string; tier: string }[]>([]);

  useFocusEffect(useCallback(() => {
    if (!profile) return;
    refreshProfile();
    Promise.all([
      supabase.from('skill_xp').select('skill, xp').eq('user_id', profile.id),
      supabase.from('stamps').select('landmarks(city_id, cities(country_code))').eq('user_id', profile.id).eq('status', 'verified'),
      supabase.from('city_awards').select('tier, cities(name)').eq('user_id', profile.id),
    ]).then(([s, st, a]) => {
      setXp(Object.fromEntries((s.data ?? []).map((r) => [r.skill as string, Number(r.xp)])));
      const list = (st.data ?? []) as any[];
      setStats({
        stamps: list.length,
        cities: new Set(list.map((r) => r.landmarks?.city_id)).size,
        countries: new Set(list.map((r) => r.landmarks?.cities?.country_code)).size,
      });
      // Show the best tier per city.
      const best = new Map<string, string>();
      const order = ['bronze', 'silver', 'gold'];
      for (const r of (a.data ?? []) as any[]) {
        const c = r.cities?.name ?? '';
        if (!best.has(c) || order.indexOf(r.tier) > order.indexOf(best.get(c)!)) best.set(c, r.tier);
      }
      setAwards([...best.entries()].map(([city, tier]) => ({ city, tier })));
    });
  }, [profile?.id])); // eslint-disable-line react-hooks/exhaustive-deps

  if (!profile) return null;
  const totalLevel = SKILLS.reduce((sum, s) => sum + levelForXp(xp[s.key] ?? 0), 0);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={['top']}>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.player}>
          <View style={[styles.avatar, hardShadow(4, 4)]}>
            <PixelArt rows={[...HERO_TOP, ...LEGS_A]} palette={heroPalette(profile.avatar)} size={6} />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={styles.name} numberOfLines={1}>{profile.traveller_name}</Text>
            <Text style={styles.sub}>Adventurer · Total level {totalLevel}</Text>
            <Label color={colors.bronze} style={{ fontSize: 11 }}>{Number(profile.total_xp).toLocaleString()} XP</Label>
          </View>
        </View>

        <View style={styles.stats}>
          {([['Stamps', stats.stamps], ['Cities', stats.cities], ['Countries', stats.countries]] as const).map(([l, n]) => (
            <View key={l} style={[styles.stat, hardShadow(3, 3)]}>
              <Text style={styles.statNum}>{n}</Text>
              <Text style={styles.statLabel}>{l}</Text>
            </View>
          ))}
        </View>

        <Label>Skills</Label>
        <View style={styles.skills}>
          {SKILLS.map((s) => {
            const v = xp[s.key] ?? 0;
            return (
              <View key={s.key} style={[styles.skill, hardShadow(3, 3)]}>
                <View style={styles.skillTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.skillName}>{s.name}</Text>
                    <Text style={styles.skillBlurb}>{s.blurb}</Text>
                  </View>
                  <Text style={styles.level}>{levelForXp(v)}/99</Text>
                </View>
                <SegmentBar value={levelProgress(v)} color={SKILL_COLOR[s.key]} track="rgba(246,240,226,0.15)" height={6} />
              </View>
            );
          })}
        </View>

        <Label>Chapters completed</Label>
        {awards.length === 0 ? (
          <Text style={styles.sub}>Stamp half of a city's major landmarks to earn its bronze chapter.</Text>
        ) : (
          <View style={styles.medals}>
            {awards.map((a) => (
              <View key={a.city} style={[styles.medal, hardShadow(3, 3)]}>
                <View style={[styles.medalDot, { backgroundColor: TIER_COLOR[a.tier] }]}><Text style={styles.medalLetter}>{a.tier[0].toUpperCase()}</Text></View>
                <View><Text style={styles.medalCity}>{a.city}</Text><Text style={styles.skillBlurbDark}>{a.tier[0].toUpperCase() + a.tier.slice(1)}</Text></View>
              </View>
            ))}
          </View>
        )}

        <TextLink label="Sign out" color={colors.muted} onPress={async () => { await signOut(); router.replace('/'); }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40, gap: 16 },
  player: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: { width: 76, height: 76, backgroundColor: colors.ink, borderWidth: 4, borderColor: colors.gold, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 4, overflow: 'hidden' },
  name: { fontFamily: fonts.display, fontSize: 24, color: colors.ink },
  sub: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.muted },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 12, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.ink },
  statNum: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  statLabel: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.muted },
  skills: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  skill: { width: '48%', flexGrow: 1, backgroundColor: colors.ink, borderWidth: 3, borderColor: colors.bronze, padding: 12, gap: 10 },
  skillTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  skillName: { fontFamily: fonts.display, fontSize: 16, color: colors.paper },
  skillBlurb: { fontFamily: fonts.body, fontSize: 11, color: colors.silver },
  skillBlurbDark: { fontFamily: fonts.body, fontSize: 11, color: colors.muted },
  level: { fontFamily: fonts.label, fontSize: 13, color: colors.gold },
  medals: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  medal: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.ink, paddingHorizontal: 12, paddingVertical: 10 },
  medalDot: { width: 28, height: 28, borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  medalLetter: { fontFamily: fonts.display, fontSize: 12, color: colors.ink },
  medalCity: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink },
});
