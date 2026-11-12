import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LandmarkRow } from '@/components/LandmarkRow';
import { SpinBanner } from '@/components/SpinBanner';
import { FirstStampCard } from '@/components/FirstStampCard';
import { Body, Icon, Label, PixelButton } from '@/components/ui';
import { useSession } from '@/lib/session';
import { wikiImage } from '@/lib/media';
import { supabase } from '@/lib/supabase';
import { useChapter } from '@/lib/useChapter';
import { colors, fonts, hardShadow } from '@/lib/theme';

// 06 City chapter: your home city's landmarks, tier progress and quests.
export default function Explore() {
  const { profile } = useSession();
  const { chapter, error, reload } = useChapter(profile?.home_city_id, profile?.id);
  const [tab, setTab] = useState<'todo' | 'done'>('todo');
  const [refreshing, setRefreshing] = useState(false);
  const [unread, setUnread] = useState(0);
  const [cover, setCover] = useState<ReturnType<typeof wikiImage>>(null);
  useFocusEffect(useCallback(() => {
    supabase.rpc('inbox_unread_count').then(({ data }) => setUnread(typeof data === 'number' ? data : 0));
  }, []));
  useEffect(() => {
    // A photo of somewhere else for the Atlas card: the nearest other city that has one.
    if (!profile?.home_city_id) return;
    supabase.from('cities').select('id, photo_thumb_url').neq('id', profile.home_city_id).not('photo_thumb_url', 'is', null).limit(12)
      .then(({ data }) => {
        const list = data ?? [];
        if (list.length) setCover(wikiImage(list[Math.floor(Math.random() * list.length)].photo_thumb_url as string));
      });
  }, [profile?.home_city_id]);

  if (error) return (
    <SafeAreaView style={styles.center}><Body>Couldn't load your chapter: {error}</Body><PixelButton label="Try again" onPress={reload} /></SafeAreaView>
  );
  if (!chapter) return <SafeAreaView style={styles.center}><ActivityIndicator color={colors.ink} /></SafeAreaView>;

  const { city, landmarks, stamped, major, quests, rank } = chapter;
  const bronze = Math.ceil(major * 0.5), silver = Math.ceil(major * 0.8), gold = major;
  const nextTier = stamped < bronze ? ['Bronze', bronze] : stamped < silver ? ['Silver', silver] : stamped < gold ? ['Gold', gold] : null;
  const todo = landmarks.filter((l) => !l.stamped), done = landmarks.filter((l) => l.stamped);
  const shown = tab === 'todo' ? todo : done;
  const quest = quests.find((q) => !q.completed) ?? quests[0];
  // First quest: the nearest landmark, or the city's headline sight if we don't know where you are.
  const RANK = ['legendary', 'epic', 'rare', 'uncommon', 'common'];
  const firstQuest = todo[0]?.distanceM != null ? todo[0] : [...todo].sort((a, b) => RANK.indexOf(a.rarity) - RANK.indexOf(b.rarity))[0];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={['top']}>
      <ScrollView contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await reload(); setRefreshing(false); }} />}>
        <View style={styles.header}>
          <View style={{ gap: 2, flex: 1 }}>
            <Label color={colors.stamp} style={{ fontSize: 11 }}>Chapter 1 · Your home city</Label>
            <Text style={styles.city}>{city?.name}</Text>
            <Text style={styles.meta}>{city?.region ?? city?.country_code} · {major} major landmarks</Text>
          </View>
          <Pressable onPress={() => router.push('/inbox')} hitSlop={8} accessibilityRole="button"
            accessibilityLabel={unread ? `Inbox, ${unread} unread` : 'Inbox'}
            style={({ pressed }) => [styles.inboxBtn, hardShadow(pressed ? 1 : 3, pressed ? 1 : 3)]}>
            <Icon name="mail" />
            {unread ? <View style={styles.badge}><Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text></View> : null}
          </Pressable>
        </View>

        <View style={styles.pills}>
          <View style={[styles.pill, { borderColor: colors.gold, backgroundColor: '#F6E7C3' }]}><Text style={[styles.pillText, { color: colors.bronze }]}>{(profile?.total_xp ?? 0).toLocaleString()} XP</Text></View>
          <View style={[styles.pill, { borderColor: colors.teal, backgroundColor: '#D7E9E5' }]}><Text style={[styles.pillText, { color: colors.teal }]}>{rank ? `#${rank} in ${city?.name}` : 'Unranked'}</Text></View>
        </View>

        {stamped === 0 && firstQuest ? <FirstStampCard lm={firstQuest} distanceM={firstQuest.distanceM} /> : null}

        <View style={[styles.card, hardShadow(4, 4)]}>
          <View style={styles.cardTop}>
            <Text style={styles.count}>{stamped}<Text style={styles.countOf}> / {major} stamped</Text></Text>
            <Text style={styles.next}>{nextTier ? `${(nextTier[1] as number) - stamped} more for ${nextTier[0]}` : 'Gold chapter!'}</Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${major ? (stamped / major) * 100 : 0}%` }]} />
            {Array.from({ length: 27 }, (_, i) => <View key={i} style={[styles.tick, { left: `${((i + 1) * 100) / 28}%` }]} />)}
            {([['Bronze', bronze, colors.bronze], ['Silver', silver, colors.silver], ['Gold', gold, colors.gold]] as const).map(([n, at, c]) => (
              <View key={n} style={[styles.marker, { left: `${major ? (at / major) * 100 : 0}%`, backgroundColor: c }]} />
            ))}
          </View>
          <View style={styles.tierLabels}>
            <Text style={[styles.tierText, { color: colors.bronze }]}>Bronze {bronze}</Text>
            <Text style={[styles.tierText, { color: colors.silver }]}>Silver {silver}</Text>
            <Text style={[styles.tierText, { color: colors.gold }]}>Gold {gold}</Text>
          </View>
        </View>

        {quest ? (
          <View style={[styles.quest, hardShadow(4, 4)]}>
            <View style={styles.questMark}><Text style={styles.questBang}>!</Text></View>
            <View style={{ flex: 1, gap: 2 }}>
              <Label color={colors.gold}>{quest.completed ? 'Quest complete' : 'Quest'}</Label>
              <Text style={styles.questName}>{quest.name}</Text>
              <Text style={styles.questMeta}>{quest.done} of {quest.steps} stamps · +{quest.xp_reward} XP reward</Text>
            </View>
          </View>
        ) : null}

        <Pressable onPress={() => router.push('/atlas')} accessibilityRole="button" accessibilityLabel="Open the Atlas"
          style={({ pressed }) => [styles.atlas, hardShadow(pressed ? 1 : 4, pressed ? 1 : 4)]}>
          {cover ? <Image source={cover} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
          <View style={styles.atlasShade} />
          <View style={{ gap: 2 }}>
            <Label color={colors.gold}>Where next?</Label>
            <Text style={styles.atlasTitle}>Open the Atlas</Text>
            <Text style={styles.atlasSub}>Browse other cities, read about their landmarks and plan your next chapter.</Text>
          </View>
        </Pressable>

        <SpinBanner />

        <View style={styles.tabs}>
          {([['todo', `To collect · ${todo.length}`], ['done', `Stamped · ${done.length}`]] as const).map(([k, l]) => (
            <Pressable key={k} onPress={() => setTab(k)} accessibilityRole="tab" accessibilityState={{ selected: tab === k }}
              style={[styles.tab, tab === k ? styles.tabOn : null]}>
              <Text style={[styles.tabText, { color: tab === k ? colors.ink : colors.muted }]}>{l}</Text>
            </Pressable>
          ))}
        </View>

        {shown.length === 0 ? (
          <Body>{tab === 'todo' ? 'You\'ve stamped every landmark here. Legendary!' : 'No stamps yet. Pick a landmark above and go and find it.'}</Body>
        ) : shown.map((l) => (
          <LandmarkRow key={l.id} landmark={l} onPress={() => router.push(`/landmark/${l.id}`)} />
        ))}
        {landmarks.length > 0 && landmarks[0].distanceM === null ? (
          <View style={styles.hint}><Icon name="map" color={colors.teal} size={16} /><Text style={styles.hintText}>Tap the Stamp button to turn on location and see what's nearby.</Text></View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  atlas: { minHeight: 132, backgroundColor: colors.ink, borderWidth: 3, borderColor: colors.gold, padding: 16, justifyContent: 'flex-end', overflow: 'hidden' },
  atlasShade: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(27,42,65,0.55)' },
  atlasTitle: { fontFamily: fonts.display, fontSize: 22, color: colors.paper },
  atlasSub: { fontFamily: fonts.body, fontSize: 13, color: colors.paper },
  inboxBtn: { width: 48, height: 48, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -8, right: -8, minWidth: 22, height: 22, paddingHorizontal: 4, backgroundColor: colors.stamp, borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: fonts.labelBold, fontSize: 10, color: colors.paper },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16, backgroundColor: colors.paper },
  body: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40, gap: 14 },
  city: { fontFamily: fonts.display, fontSize: 40, lineHeight: 44, color: colors.ink },
  meta: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.muted },
  pills: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  pill: { borderWidth: 2, paddingHorizontal: 12, paddingVertical: 6 },
  pillText: { fontFamily: fonts.label, fontSize: 11 },
  card: { backgroundColor: colors.ink, borderWidth: 3, borderColor: colors.gold, padding: 18, gap: 12 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  count: { fontFamily: fonts.display, fontSize: 34, color: colors.paper },
  countOf: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.silver },
  next: { fontFamily: fonts.label, fontSize: 11, color: colors.gold, marginBottom: 6 },
  track: { height: 12, backgroundColor: 'rgba(246,240,226,0.18)', position: 'relative' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.stamp },
  tick: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: colors.ink },
  marker: { position: 'absolute', top: -2, width: 14, height: 16, marginLeft: -12, borderWidth: 2, borderColor: colors.ink },
  tierLabels: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  tierText: { fontFamily: fonts.bodyBold, fontSize: 10 },
  quest: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.ink, borderWidth: 3, borderColor: colors.gold, padding: 14 },
  questMark: { width: 44, height: 44, backgroundColor: colors.gold, borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  questBang: { fontFamily: fonts.display, fontSize: 28, color: colors.ink },
  questName: { fontFamily: fonts.display, fontSize: 18, color: colors.paper },
  questMeta: { fontFamily: fonts.body, fontSize: 12, color: colors.silver },
  tabs: { flexDirection: 'row', gap: 6, padding: 4, backgroundColor: '#ECE5D4' },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 9 },
  tabOn: { backgroundColor: colors.card, borderWidth: 2, borderColor: colors.ink },
  tabText: { fontFamily: fonts.bodyBold, fontSize: 13 },
  hint: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  hintText: { fontFamily: fonts.bodySemi, fontSize: 12.5, color: colors.teal, flex: 1 },
});
