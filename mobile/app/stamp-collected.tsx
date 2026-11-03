import { Image } from 'expo-image';
import { Redirect, router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Fireworks, type FireworksSize } from '@/components/Fireworks';
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
  const [cityName, setCityName] = useState<string | null>(null);
  const [showFireworks, setShowFireworks] = useState(true);
  const [showBanner, setShowBanner] = useState(true);
  const pop = useRef(new Animated.Value(0)).current;
  const celebration = celebrate(s, cityName);
  useEffect(() => {
    if (!s || s.status !== 'verified') return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (s.rewards?.city?.city_id) supabase.from('cities').select('name').eq('id', s.rewards.city.city_id).single()
      .then(({ data }) => setCityName((data as { name: string } | null)?.name ?? null));
    Animated.spring(pop, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
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
      {celebration && showBanner ? (
        <Pressable onPress={() => setShowBanner(false)} style={styles.bannerWrap} accessibilityRole="button" accessibilityLabel={`${celebration.title}. ${celebration.sub}. Tap to close.`}>
          <Animated.View style={[styles.banner, celebration.size === 'epic' ? styles.bannerEpic : null, hardShadow(5, 5),
            { transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }], opacity: pop }]}>
            <Text style={styles.bannerSmall}>{celebration.kicker}</Text>
            <Text style={[styles.bannerBig, celebration.size === 'epic' ? { fontSize: 30 } : null]}>{celebration.title}</Text>
            <Text style={styles.bannerSub}>{celebration.sub}</Text>
          </Animated.View>
        </Pressable>
      ) : null}
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
      {s.status === 'verified' && showFireworks ? (
        <Fireworks size={celebration?.size ?? 'small'} onDone={() => { setShowFireworks(false); setTimeout(() => setShowBanner(false), 1500); }} />
      ) : null}
    </SafeAreaView>
  );
}

type Celebration = { size: FireworksSize; kicker: string; title: string; sub: string };
const skillName = (k: string) => SKILLS.find((x) => x.key === k)?.name ?? k;

/** Picks the biggest moment in this stamp: a 99, a city chapter, a quest, or a level-up. */
function celebrate(s: typeof lastStamp.value, cityName: string | null): Celebration | null {
  const r = s?.rewards;
  if (!s || s.status !== 'verified' || !r) return null;
  const maxed = r.skills.find((g) => g.level_after >= 99 && g.level_before < 99);
  if (maxed) return { size: 'epic', kicker: 'CONGRATULATIONS', title: `99 ${skillName(maxed.skill).toUpperCase()}!`, sub: `You've mastered ${skillName(maxed.skill)}. Legendary.` };
  const city = cityName ?? 'City';
  if (r.new_city_tiers.includes('gold')) return { size: 'epic', kicker: 'CHAPTER COMPLETE', title: `${city.toUpperCase()} GOLD!`, sub: `Every major landmark in ${city} stamped.` };
  const tier = r.new_city_tiers.includes('silver') ? 'Silver' : r.new_city_tiers.includes('bronze') ? 'Bronze' : null;
  if (tier) return { size: 'big', kicker: 'CHAPTER MILESTONE', title: `${city.toUpperCase()} ${tier.toUpperCase()}!`, sub: `You've earned the ${tier} chapter for ${city}.` };
  if (r.quests_completed.length) return { size: 'big', kicker: 'QUEST COMPLETE', title: r.quests_completed[0], sub: 'Quest reward added to your XP.' };
  const up = r.skills.find((g) => g.level_after > g.level_before);
  if (up) return { size: 'big', kicker: 'LEVEL UP', title: `${skillName(up.skill).toUpperCase()} ${up.level_after}`, sub: `Your ${skillName(up.skill)} level is now ${up.level_after}.` };
  return null;
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
  bannerWrap: { position: 'absolute', top: 70, left: 0, right: 0, zIndex: 10, alignItems: 'center', paddingHorizontal: 24 },
  banner: { backgroundColor: colors.ink, borderWidth: 3, borderColor: colors.gold, paddingHorizontal: 20, paddingVertical: 14, alignItems: 'center', gap: 4, maxWidth: 360 },
  bannerEpic: { borderWidth: 5, borderColor: colors.legendary },
  bannerSmall: { fontFamily: fonts.label, fontSize: 10, color: colors.gold, letterSpacing: 1 },
  bannerBig: { fontFamily: fonts.display, fontSize: 26, color: colors.paper, textAlign: 'center' },
  bannerSub: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.silver, textAlign: 'center' },
});
