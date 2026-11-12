import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Redirect, router } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlobeArt, LoopArt, Pip, SomedayArt, StampArt, SunriseArt } from '@/components/PrologueArt';
import { TitleScene } from '@/components/TitleScene';
import { PixelButton } from '@/components/ui';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { colors, fonts, hardShadow } from '@/lib/theme';

export const PROLOGUE_SEEN = 'mmgo.prologueSeen';

type Page = { kicker: string; title: string; text: string; art: (size: number) => ReactNode };

// The prologue: why travel at all? Five short beats, told by Pip the postal pigeon.
export default function Prologue() {
  const { session } = useSession();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState(0);
  const [reduce, setReduce] = useState(false);
  const [stats, setStats] = useState({ landmarks: 3000, countries: 100 });
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => { AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => {}); }, []);
  // Seen it before (e.g. came back mid-sign-up)? Go straight on.
  useEffect(() => { AsyncStorage.getItem(PROLOGUE_SEEN).then((v) => { if (v) router.replace('/create-traveller'); }).catch(() => {}); }, []);
  useEffect(() => {
    Promise.all([
      supabase.from('landmarks').select('id', { count: 'exact', head: true }),
      supabase.from('countries').select('code', { count: 'exact', head: true }),
    ]).then(([l, c]) => setStats({ landmarks: l.count ?? 3000, countries: c.count ?? 100 })).catch(() => {});
  }, []);

  const pages: Page[] = [
    { kicker: 'PROLOGUE', title: 'Same week, on repeat',
      text: 'Most people live the same week over and over. Wake up, work, scroll, sleep... then do it all again.',
      art: (s) => <LoopArt size={s} /> },
    { kicker: 'PROLOGUE', title: 'Someday...',
      text: 'We all say we\'ll see the world someday. But someday has a habit of never arriving, and a lot of people never really start living their story.',
      art: (s) => <SomedayArt size={s} /> },
    { kicker: 'MEANWHILE', title: 'The world is huge',
      text: 'Out there are 195 countries and seven continents, with more castles, temples, mountains and markets than anyone could see in a lifetime.',
      art: (s) => <GlobeArt size={s} /> },
    { kicker: 'SO LET\'S PLAY', title: 'Visit. Snap. Stamp.',
      text: `mmGO turns the real world into your adventure. Visit a landmark, take a photo there and earn its stamp. ${stats.landmarks.toLocaleString()} landmarks in ${stats.countries} countries are already waiting.`,
      art: (s) => <StampArt size={s} /> },
    { kicker: 'CHAPTER 1', title: 'Your story starts today',
      text: 'You don\'t need a big trip to begin. Your first stamp is probably just down the road. Ready to make your traveller?',
      art: (s) => <SunriseArt size={s} /> },
  ];
  const page = pages[i];
  const done = typed >= page.text.length;

  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: reduce ? 0 : 380, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    if (reduce) { setTyped(page.text.length); return; }
    setTyped(0);
    let n = 0;
    const id = setInterval(() => { n += 2; setTyped(n); if (n >= page.text.length) clearInterval(id); }, 28);
    return () => clearInterval(id);
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!session) return <Redirect href="/" />;

  async function finish() {
    try { await AsyncStorage.setItem(PROLOGUE_SEEN, '1'); } catch { /* fine */ }
    router.replace('/create-traveller');
  }
  function next() {
    if (!done) { setTyped(page.text.length); return; }   // first tap finishes the sentence
    Haptics.selectionAsync().catch(() => {});
    if (i < pages.length - 1) setI(i + 1); else finish();
  }

  const art = Math.min(width - 80, height * 0.34, 300);
  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none"><TitleScene height={height} groundPad={height * 0.42} /></View>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(20,22,52,0.45)' }]} pointerEvents="none" />

      <Pressable onPress={finish} style={[styles.skip, { top: insets.top + 10 }]} accessibilityRole="button" accessibilityLabel="Skip the story">
        <Text style={styles.skipText}>SKIP ▸▸</Text>
      </Pressable>

      <Pressable onPress={next} style={{ flex: 1, paddingTop: insets.top + 48, paddingBottom: insets.bottom + 16, paddingHorizontal: 18 }}
        accessibilityRole="button" accessibilityLabel={`${page.title}. ${page.text}. Tap to continue.`}>
        <Animated.View style={[styles.frameOuter, hardShadow(5, 5), { opacity: fade,
          transform: [{ scale: fade.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }] }]}>
          <View style={[styles.frame, { width: art + 24, height: art + 24 }]}>
            {page.art(art)}
          </View>
        </Animated.View>

        <View style={{ flex: 1 }} />

        <View style={styles.panelOuter}>
          <View style={styles.panel}>
            {[{ top: 4, left: 4 }, { top: 4, right: 4 }, { bottom: 4, left: 4 }, { bottom: 4, right: 4 }].map((p, k) => <View key={k} style={[styles.corner, p]} />)}
            <View style={styles.pipRow}>
              <View style={styles.pipFrame}><Pip scale={4} /></View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.kicker}>{page.kicker} · PIP THE POSTAL PIGEON</Text>
                <Text style={styles.title}>{page.title}</Text>
              </View>
            </View>
            <Text style={styles.text}>
              {page.text.slice(0, typed)}<Text style={{ color: 'transparent' }}>{page.text.slice(typed)}</Text>
            </Text>
            <View style={styles.footer}>
              <View style={styles.dots}>
                {pages.map((_, k) => <View key={k} style={[styles.dot, k === i ? styles.dotOn : null, k < i ? { backgroundColor: colors.gold } : null]} />)}
              </View>
              {i === pages.length - 1 && done
                ? <View style={{ flex: 1, maxWidth: 220 }}><PixelButton label="Begin my story" onPress={finish} /></View>
                : <Text style={[styles.tap, { opacity: done ? 1 : 0.4 }]}>TAP ▸</Text>}
            </View>
          </View>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.night },
  skip: { position: 'absolute', right: 16, zIndex: 2, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: 'rgba(27,42,65,0.7)', borderWidth: 2, borderColor: colors.silver },
  skipText: { fontFamily: fonts.labelBold, fontSize: 11, color: colors.paper },
  frameOuter: { alignSelf: 'center', borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.ink, padding: 3 },
  frame: { borderWidth: 3, borderColor: colors.gold, backgroundColor: '#22284F', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  panelOuter: { borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.ink, padding: 3 },
  panel: { borderWidth: 3, borderColor: colors.gold, backgroundColor: 'rgba(27,42,65,0.95)', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, gap: 10 },
  corner: { position: 'absolute', width: 6, height: 6, backgroundColor: colors.gold },
  pipRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pipFrame: { backgroundColor: '#F3E6C8', borderWidth: 3, borderColor: colors.ink, padding: 4 },
  kicker: { fontFamily: fonts.labelBold, fontSize: 10, letterSpacing: 0.6, color: colors.gold },
  title: { fontFamily: fonts.display, fontSize: 24, lineHeight: 28, color: colors.paper },
  text: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24, color: colors.paper, minHeight: 96 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 44 },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 10, height: 10, borderWidth: 2, borderColor: colors.gold },
  dotOn: { backgroundColor: colors.paper, borderColor: colors.paper },
  tap: { fontFamily: fonts.labelBold, fontSize: 12, color: colors.gold },
});
