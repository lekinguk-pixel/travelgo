import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { Redirect, router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Character } from '@/components/Character';
import { JourneyScene, PixelCoin } from '@/components/JourneyScene';
import { Pip } from '@/components/PrologueArt';
import { PixelButton, SegmentBar, TextLink } from '@/components/ui';
import { toAvatar } from '@/lib/avatar';
import { wikiImage } from '@/lib/media';
import { useSession } from '@/lib/session';
import { friendlyError, supabase } from '@/lib/supabase';
import { colors, fonts, hardShadow, rarityColor, type Rarity } from '@/lib/theme';
import { distanceM, LANDMARK_FIELDS, type Landmark } from '@/lib/useChapter';

type Preview = {
  from: { id: number; name: string } | null;
  to: { id: number; name: string; country: string; photo: string | null; flag_key: string; flag_name: string } | null;
  done: boolean;
};
type Finished = { coins: number; flag_key: string; city: { id: number; name: string; country: string; photo: string | null } };
const TAPS = 15;

// The first-run tour, after the send-off: a 15-tap first journey with real rewards, then your first real quest.
export default function FirstJourney() {
  const { session, profile, refreshProfile } = useSession();
  const { width } = useWindowDimensions();
  const [stage, setStage] = useState<'travel' | 'arrived' | 'quest'>('travel');
  const [p, setP] = useState<Preview | null>(null);
  const [taps, setTaps] = useState(0);
  const [won, setWon] = useState<Finished | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [quest, setQuest] = useState<{ lm: Landmark; d: number | null } | null>(null);
  const [looking, setLooking] = useState(false);
  const pop = useRef(new Animated.Value(0)).current;
  const avatar = toAvatar(profile?.avatar);

  useEffect(() => {
    supabase.rpc('tour_preview').then(({ data }) => {
      const pr = data as Preview | null;
      setP(pr);
      if (pr?.done || !pr?.to) setStage('quest');
    });
  }, []);
  useEffect(() => {
    if (stage !== 'travel') { pop.setValue(0); Animated.spring(pop, { toValue: 1, friction: 5, useNativeDriver: true }).start(); }
  }, [stage, pop]);

  if (!session) return <Redirect href="/" />;

  async function done() {
    await supabase.rpc('tour_complete');
    router.replace('/(tabs)');
  }

  function tap() {
    if (busy || taps >= TAPS) return 0;
    const n = taps + 1;
    setTaps(n);
    if (n >= TAPS) arrive();
    return n % 5 === 0 ? 1 : 0;
  }
  async function arrive() {
    setBusy(true); setError('');
    const { data, error: e } = await supabase.rpc('tour_finish');
    setBusy(false);
    if (e) { setError(friendlyError(e)); setStage('quest'); return; }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setWon(data as Finished);
    setStage('arrived');
  }
  async function wear() {
    if (!won || !profile) return;
    setBusy(true);
    await supabase.from('profiles').update({ avatar: { ...avatar, top: won.flag_key } }).eq('id', profile.id);
    await refreshProfile();
    setBusy(false);
    setStage('quest');
  }
  async function findNearest() {
    if (!profile?.home_city_id) return;
    setLooking(true);
    let pos: { lat: number; lng: number } | null = null;
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.granted) {
        const l = (await Location.getLastKnownPositionAsync()) ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
        if (l) pos = { lat: l.coords.latitude, lng: l.coords.longitude };
      }
    } catch { /* fall back to the city's best landmark */ }
    const { data } = await supabase.from('landmarks').select(LANDMARK_FIELDS).eq('city_id', profile.home_city_id);
    const list = (data ?? []) as Landmark[];
    const order: Rarity[] = ['legendary', 'epic', 'rare', 'uncommon', 'common'];
    const pick = pos
      ? list.map((lm) => ({ lm, d: distanceM(pos!.lat, pos!.lng, lm.lat, lm.lng) })).sort((a, b) => a.d - b.d)[0]
      : list.filter((l) => l.is_major).sort((a, b) => order.indexOf(a.rarity) - order.indexOf(b.rarity)).map((lm) => ({ lm, d: null }))[0];
    setQuest(pick ?? null);
    setLooking(false);
  }
  function showWay() {
    if (!quest) return;
    const { lat, lng, name } = quest.lm;
    const label = encodeURIComponent(name);
    const url = Platform.OS === 'android' ? `geo:${lat},${lng}?q=${lat},${lng}(${label})` : `https://maps.apple.com/?ll=${lat},${lng}&q=${label}`;
    Linking.openURL(url).catch(() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`));
    done();
  }

  const scale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });
  const say = (title: string, text: string) => (
    <View style={styles.panelOuter}>
      <View style={styles.panel}>
        <View style={styles.pipRow}>
          <View style={styles.pipFrame}><Pip scale={3} /></View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.kicker}>PIP</Text>
            <Text style={styles.title}>{title}</Text>
          </View>
        </View>
        <Text style={styles.text}>{text}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.night }}>
      <View style={styles.top}>
        <Text style={styles.step}>{stage === 'quest' ? 'STEP 2 OF 2 · YOUR FIRST REAL STAMP' : 'STEP 1 OF 2 · YOUR FIRST JOURNEY'}</Text>
        <Pressable onPress={done} accessibilityRole="button" accessibilityLabel="Skip the tour"><Text style={styles.skip}>SKIP ▸▸</Text></Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        {!p ? <ActivityIndicator color={colors.gold} style={{ marginTop: 80 }} /> : null}

        {p && stage === 'travel' && p.to ? (
          <>
            {say(`Let's go to ${p.to.name}!`, `Before your first real stamp, a quick taste of travel. Tap the scene to walk your traveller from ${p.from?.name ?? 'home'} to ${p.to.name}, ${p.to.country}. Every 5th tap drops a coin.`)}
            <View style={[styles.sceneWrap, hardShadow(4, 4)]}>
              <JourneyScene width={width - 46} mode="walk" avatar={avatar} tapLabel="+1 step" onTap={tap} />
            </View>
            <View style={{ gap: 6 }}>
              <View style={styles.route}><Text style={styles.routeText}>{p.from?.name}</Text><Text style={styles.routeText}>{p.to.name}</Text></View>
              <SegmentBar value={taps / TAPS} color={colors.gold} track="rgba(246,240,226,0.15)" height={12} />
              <Text style={styles.left}>{busy ? 'Arriving…' : `${TAPS - taps} taps to go`}</Text>
            </View>
          </>
        ) : null}

        {stage === 'arrived' && won ? (
          <Animated.View style={{ gap: 14, transform: [{ scale }], opacity: pop }}>
            <View style={[styles.card, hardShadow(4, 4)]}>
              {won.city.photo ? <Image source={wikiImage(won.city.photo)} style={styles.photo} contentFit="cover" /> : null}
              <View style={{ padding: 14, gap: 4 }}>
                <Text style={styles.cardKicker}>📮 POSTCARD COLLECTED</Text>
                <Text style={styles.cardTitle}>Welcome to {won.city.name}!</Text>
                <View style={styles.coinRow}><PixelCoin size={20} /><Text style={styles.coins}>+{won.coins} coins</Text></View>
              </View>
            </View>
            <View style={[styles.tee, hardShadow(4, 4)]}>
              <Character avatar={{ ...avatar, top: won.flag_key }} size={5} noPet />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.cardKicker}>NEW OUTFIT</Text>
                <Text style={styles.teeName}>{won.city.country} flag tee</Text>
                <Text style={styles.teeNote}>Every country you visit, for real or on a journey, adds its flag to your collection.</Text>
              </View>
            </View>
            {say('That\'s the Journey game', 'Your traveller can keep exploring the world here any time, even while you\'re busy. Postcards, coins and outfits from every city.')}
            <PixelButton label="Wear my new tee" onPress={wear} busy={busy} />
            <TextLink label="Keep my look" color={colors.silver} onPress={() => setStage('quest')} />
          </Animated.View>
        ) : null}

        {stage === 'quest' ? (
          <Animated.View style={{ gap: 14, transform: [{ scale }], opacity: pop }}>
            {say('Now, the real thing', 'The best stamps are earned in person. Let\'s find the landmark nearest to you. It\'s your first quest, and it might be just down the road.')}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {quest ? (
              <View style={[styles.card, hardShadow(4, 4), { borderColor: rarityColor(quest.lm.rarity) }]}>
                {quest.lm.photo_thumb_url ? <Image source={wikiImage(quest.lm.photo_thumb_url)} style={styles.photo} contentFit="cover" /> : null}
                <View style={{ padding: 14, gap: 4 }}>
                  <Text style={[styles.cardKicker, { color: colors.stamp }]}>YOUR FIRST QUEST · {quest.lm.rarity.toUpperCase()}</Text>
                  <Text style={styles.cardTitle}>{quest.lm.name}</Text>
                  <Text style={styles.teeNote}>{quest.d !== null ? (quest.d < 1000 ? `${Math.round(quest.d)} m away` : `${(quest.d / 1000).toFixed(1)} km away`) : 'One of the highlights of your home city'}</Text>
                  <Text style={styles.teeNote}>Go there, take a photo of yourself with it in the Stamp tab, and it's yours.</Text>
                </View>
              </View>
            ) : (
              <PixelButton label={looking ? 'Looking…' : 'Find my nearest landmark'} busy={looking} onPress={findNearest} />
            )}
            {!quest ? <Text style={styles.small}>We'll ask to use your location so we can find the closest one. You can say no and we'll pick a highlight instead.</Text> : null}
            {quest ? <PixelButton label="Show me the way" onPress={showWay} /> : null}
            <PixelButton label={quest ? 'Open my book' : 'Skip for now'} tone="ink" onPress={done} />
          </Animated.View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 10 },
  step: { fontFamily: fonts.labelBold, fontSize: 10.5, color: colors.gold, letterSpacing: 0.5 },
  skip: { fontFamily: fonts.labelBold, fontSize: 11, color: colors.silver },
  body: { paddingHorizontal: 20, paddingBottom: 40, gap: 16 },
  panelOuter: { borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.ink, padding: 3 },
  panel: { borderWidth: 3, borderColor: colors.gold, backgroundColor: 'rgba(27,42,65,0.95)', padding: 14, gap: 8 },
  pipRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pipFrame: { backgroundColor: '#F3E6C8', borderWidth: 3, borderColor: colors.ink, padding: 3 },
  kicker: { fontFamily: fonts.labelBold, fontSize: 10, color: colors.gold },
  title: { fontFamily: fonts.display, fontSize: 21, lineHeight: 25, color: colors.paper },
  text: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.paper },
  sceneWrap: { borderWidth: 3, borderColor: colors.ink, alignSelf: 'center' },
  route: { flexDirection: 'row', justifyContent: 'space-between' },
  routeText: { fontFamily: fonts.labelBold, fontSize: 11, color: colors.paper },
  left: { fontFamily: fonts.label, fontSize: 11, color: colors.gold, textAlign: 'center' },
  card: { backgroundColor: colors.card, borderWidth: 3, borderColor: colors.gold, overflow: 'hidden' },
  photo: { width: '100%', height: 170, backgroundColor: colors.ink },
  cardKicker: { fontFamily: fonts.labelBold, fontSize: 10.5, color: colors.teal },
  cardTitle: { fontFamily: fonts.display, fontSize: 24, color: colors.ink },
  coinRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  coins: { fontFamily: fonts.labelBold, fontSize: 14, color: colors.ink },
  tee: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#FFF8E6', borderWidth: 3, borderColor: colors.gold, padding: 12 },
  teeName: { fontFamily: fonts.display, fontSize: 19, color: colors.ink },
  teeNote: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.muted },
  small: { fontFamily: fonts.body, fontSize: 12.5, color: colors.silver, textAlign: 'center' },
  error: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.paper, backgroundColor: colors.stamp, padding: 10 },
});
