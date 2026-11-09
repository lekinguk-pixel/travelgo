import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, Easing, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DealsCard } from '@/components/DealsCard';
import { BackHeader } from '@/components/social';
import { SpinWheel } from '@/components/SpinWheel';
import { Body, Label, PixelButton, TextLink } from '@/components/ui';
import { wikiImage } from '@/lib/media';
import { friendlyError, supabase } from '@/lib/supabase';
import { colors, fonts, hardShadow } from '@/lib/theme';

type SpinCity = { id: number; name: string; country: string; continent: string; photo_thumb_url: string | null; summary: string | null; landmarks: number };
const CONTINENTS: { key: string | null; label: string }[] = [
  { key: null, label: 'Anywhere' }, { key: 'EU', label: 'Europe' }, { key: 'AS', label: 'Asia' },
  { key: 'NA', label: 'N. America' }, { key: 'SA', label: 'S. America' },
];

// Spin the globe: let Lady Luck pick your next chapter.
export default function Spin() {
  const { width } = useWindowDimensions();
  const size = Math.min(width - 40, 360);
  const [continent, setContinent] = useState<string | null>(null);
  const [fresh, setFresh] = useState(false);
  const [cities, setCities] = useState<SpinCity[] | null>(null);
  const [winner, setWinner] = useState<SpinCity | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [bulbs, setBulbs] = useState(false);
  const [error, setError] = useState('');
  const [reduce, setReduce] = useState(false);
  const rotation = useRef(new Animated.Value(0)).current;
  const angle = useRef(0);
  const lastTick = useRef(0);
  const scroll = useRef<{ scrollToEnd: (o?: { animated?: boolean }) => void } | null>(null);

  useEffect(() => { AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => {}); }, []);
  useEffect(() => {
    const id = setInterval(() => setBulbs((b) => !b), spinning ? 120 : 600);
    return () => clearInterval(id);
  }, [spinning]);

  const load = useCallback(async () => {
    setCities(null); setWinner(null); setError('');
    const { data, error: e } = await supabase.rpc('spin_cities', { p_continent: continent, p_unstamped: fresh, p_count: 8 });
    if (e) { setError(friendlyError(e)); setCities([]); return; }
    setCities((data ?? []) as SpinCity[]);
  }, [continent, fresh]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const n = cities?.length || 8;
    const id = rotation.addListener(({ value }) => {
      angle.current = value;
      const tick = Math.floor(value / (360 / n));
      if (tick !== lastTick.current) { lastTick.current = tick; Haptics.selectionAsync().catch(() => {}); }
    });
    return () => rotation.removeListener(id);
  }, [rotation, cities?.length]);

  function spin() {
    if (!cities || cities.length < 2 || spinning) return;
    const n = cities.length, seg = 360 / n;
    const pick = Math.floor(Math.random() * n);
    const jitter = (Math.random() - 0.5) * seg * 0.6;           // don't always stop dead centre
    const from = angle.current;
    const base = from - (((from % 360) + 360) % 360);
    const target = base + 360 * (reduce ? 1 : 6) + (360 - (pick * seg + seg / 2)) + jitter;
    setWinner(null); setSpinning(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    Animated.timing(rotation, {
      toValue: target, duration: reduce ? 700 : 4800, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start(() => {
      setSpinning(false);
      setWinner(cities[pick]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 250);
    });
  }

  const photo = winner ? wikiImage(winner.photo_thumb_url) : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.night }}>
      <View style={{ backgroundColor: colors.paper }}><BackHeader title="Spin the globe" /></View>
      <ScrollView ref={scroll as never} contentContainerStyle={styles.body}>
        <View style={{ gap: 4, alignItems: 'center' }}>
          <Label color={colors.gold}>Feeling lucky?</Label>
          <Text style={styles.title}>Let Lady Luck pick your next chapter</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}>
          {CONTINENTS.map((c) => (
            <Pressable key={c.label} disabled={spinning} onPress={() => setContinent(c.key)} accessibilityRole="radio" accessibilityState={{ selected: continent === c.key }}
              style={[styles.chip, continent === c.key ? styles.chipOn : null]}>
              <Text style={[styles.chipText, continent === c.key ? { color: colors.ink } : null]}>{c.label.toUpperCase()}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <Pressable disabled={spinning} onPress={() => setFresh((f) => !f)} accessibilityRole="checkbox" accessibilityState={{ checked: fresh }} style={styles.toggle}>
          <View style={[styles.box, fresh ? { backgroundColor: colors.gold } : null]}>{fresh ? <Text style={styles.tick}>✓</Text> : null}</View>
          <Text style={styles.toggleText}>Only places I haven't stamped yet</Text>
        </Pressable>

        <View style={{ alignItems: 'center', minHeight: size + 18 }}>
          {cities === null ? <ActivityIndicator color={colors.gold} style={{ marginTop: size / 2 }} />
            : cities.length < 2 ? <Body style={{ color: colors.paper, marginTop: 40, textAlign: 'center' }}>{error || 'Not enough places to spin for here yet. Try another continent.'}</Body>
            : (
              <Pressable onPress={spin} accessibilityRole="button" accessibilityLabel="Spin the wheel" disabled={spinning}>
                <SpinWheel size={size} names={cities.map((c) => c.name)} rotation={rotation} bulbsOn={bulbs} />
              </Pressable>
            )}
        </View>

        {cities && cities.length >= 2 ? (
          <View style={{ gap: 10 }}>
            <PixelButton label={spinning ? 'Spinning…' : winner ? 'Spin it again' : 'Spin!'} disabled={spinning} onPress={spin} />
            {!spinning ? <TextLink label="Shuffle the places on the wheel" color={colors.silver} onPress={load} /> : null}
          </View>
        ) : null}

        {winner ? (
          <View style={{ gap: 14 }}>
            <View style={[styles.result, hardShadow(4, 4)]}>
              {photo ? <Image source={photo} style={styles.photo} contentFit="cover" transition={200} /> : null}
              <View style={{ padding: 14, gap: 6 }}>
                <Label color={colors.stamp}>Lady Luck says…</Label>
                <Text style={styles.city}>{winner.name}</Text>
                <Text style={styles.meta}>{winner.country} · {winner.landmarks} landmarks to stamp</Text>
                {winner.summary ? <Text style={styles.summary} numberOfLines={4}>{winner.summary}</Text> : null}
                <PixelButton label={`Explore ${winner.name}`} onPress={() => router.push(`/city/${winner.id}`)} />
              </View>
            </View>
            <DealsCard cityId={winner.id} cityName={winner.name} source="spin" />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 48, gap: 16 },
  title: { fontFamily: fonts.display, fontSize: 24, lineHeight: 28, color: colors.paper, textAlign: 'center' },
  chip: { borderWidth: 2, borderColor: colors.silver, paddingHorizontal: 12, paddingVertical: 8 },
  chipOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipText: { fontFamily: fonts.labelBold, fontSize: 11, color: colors.paper },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  box: { width: 24, height: 24, borderWidth: 2, borderColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  tick: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
  toggleText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.paper },
  result: { backgroundColor: colors.card, borderWidth: 3, borderColor: colors.gold, overflow: 'hidden' },
  photo: { width: '100%', height: 180, backgroundColor: colors.ink },
  city: { fontFamily: fonts.display, fontSize: 30, color: colors.ink },
  meta: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.muted },
  summary: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.ink },
});
