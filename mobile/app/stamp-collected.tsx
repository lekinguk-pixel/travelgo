import { Image } from 'expo-image';
import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Body, Label, PixelButton, SegmentBar, TextLink } from '@/components/ui';
import { lastStamp } from '@/lib/draft';
import { levelProgress, SKILLS } from '@/lib/levels';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { colors, fonts, hardShadow, rarityColor } from '@/lib/theme';

// 08 Stamp collected: the loot screen.
export default function StampCollected() {
  const s = lastStamp.value;
  const { refreshProfile, session } = useSession();
  const [skillXp, setSkillXp] = useState<Record<string, number>>({});
  useEffect(() => {
    refreshProfile();
    if (session) supabase.from('skill_xp').select('skill, xp').eq('user_id', session.user.id)
      .then(({ data }) => setSkillXp(Object.fromEntries((data ?? []).map((r) => [r.skill as string, Number(r.xp)]))));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!s) return <Redirect href="/(tabs)" />;

  const rc = rarityColor(s.rarity);
  const r = s.rewards;
  const date = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
  const city = r?.city;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={[styles.loot, { backgroundColor: rc }, hardShadow(4, 4)]}>
          <Text style={styles.star}>★</Text>
          <Text style={styles.lootText}>{s.status === 'verified' ? `${s.rarity.toUpperCase()} STAMP COLLECTED` : 'STAMP SAVED'}</Text>
          <Text style={styles.star}>★</Text>
        </View>

        <View style={styles.art}>
          <View style={[styles.ring, { borderColor: rc }]}>
            <View style={[styles.inner, { borderColor: rc }]}>
              {s.photoUri ? <Image source={{ uri: s.photoUri }} style={styles.photo} contentFit="cover" /> : null}
            </View>
          </View>
          <View style={[styles.label, { backgroundColor: rc }, hardShadow(3, 3)]}>
            <Text style={styles.labelBig} numberOfLines={1}>{s.landmark.toUpperCase()}</Text>
            <Text style={styles.labelSmall}>{date}</Text>
          </View>
        </View>

        {s.status === 'verified' && r ? (
          <>
            <Text style={styles.xp}>+{r.xp_total} XP</Text>
            <View style={styles.gains}>
              {r.skills.map((g) => {
                const name = SKILLS.find((k) => k.key === g.skill)?.name ?? g.skill;
                const up = g.level_after > g.level_before;
                return (
                  <View key={g.skill} style={{ gap: 6 }}>
                    <View style={styles.gainTop}>
                      <Text style={styles.gainName}>{name} · Lv {g.level_after}</Text>
                      <Text style={[styles.gainNote, { color: up ? colors.gold : '#8ACB6E' }]}>{up ? 'LEVEL UP!' : `+${g.xp} XP`}</Text>
                    </View>
                    <SegmentBar value={levelProgress(skillXp[g.skill] ?? 0)} color={up ? colors.stamp : colors.teal} track="rgba(246,240,226,0.15)" />
                  </View>
                );
              })}
              {r.quests_completed.map((q) => <Text key={q} style={styles.quest}>Quest complete: {q}</Text>)}
              {r.new_city_tiers.map((t) => <Text key={t} style={styles.quest}>{t.toUpperCase()} chapter earned!</Text>)}
            </View>
            {city ? <Label style={{ alignSelf: 'center', fontSize: 11 }}>{`${city.stamped} / ${city.major_landmarks} stamped in this city`}</Label> : null}
          </>
        ) : (
          <Body style={{ textAlign: 'center' }}>{s.message}</Body>
        )}

        <PixelButton label="Back to my chapter" onPress={() => router.replace('/(tabs)')} style={{ marginTop: 8 }} />
        <TextLink label="See it in my book" onPress={() => router.replace('/(tabs)/book')} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: { padding: 24, gap: 18, alignItems: 'stretch' },
  loot: { flexDirection: 'row', alignSelf: 'center', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 3, borderColor: colors.ink },
  star: { fontFamily: fonts.display, fontSize: 16, color: colors.gold },
  lootText: { fontFamily: fonts.labelBold, fontSize: 13, color: colors.paper },
  art: { alignItems: 'center', height: 290 },
  ring: { width: 270, height: 270, borderRadius: 135, borderWidth: 6, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  inner: { width: 238, height: 238, borderRadius: 119, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photo: { width: 200, height: 200, borderRadius: 100 },
  label: { position: 'absolute', bottom: 18, transform: [{ rotate: '-6deg' }], paddingHorizontal: 14, paddingVertical: 6, borderWidth: 2, borderColor: colors.ink, alignItems: 'center', maxWidth: 280 },
  labelBig: { fontFamily: fonts.labelBold, fontSize: 14, color: colors.paper },
  labelSmall: { fontFamily: fonts.label, fontSize: 9, color: colors.paper },
  xp: { fontFamily: fonts.display, fontSize: 40, color: colors.gold, textAlign: 'center', textShadowColor: colors.ink, textShadowOffset: { width: 3, height: 3 }, textShadowRadius: 0 },
  gains: { backgroundColor: colors.ink, borderWidth: 3, borderColor: colors.gold, padding: 18, gap: 14 },
  gainTop: { flexDirection: 'row', justifyContent: 'space-between' },
  gainName: { fontFamily: fonts.display, fontSize: 16, color: colors.paper },
  gainNote: { fontFamily: fonts.label, fontSize: 11 },
  quest: { fontFamily: fonts.labelBold, fontSize: 12, color: colors.gold },
});
