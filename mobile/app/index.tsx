import { Redirect, router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TitleScene } from '@/components/TitleScene';
import { PixelButton, TextLink } from '@/components/ui';
import { DEFAULT_LOOK } from '@/lib/pixel';
import { useSession } from '@/lib/session';
import { colors, fonts } from '@/lib/theme';

const HEADLINE = 'Your adventure starts here...';

// 01 Title screen: the whole screen is the dawn scene, with the start buttons
// in an RPG-style dialogue box. Signed-in players skip straight to their book.
export default function TitleScreen() {
  const { session, profile } = useSession();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [panelH, setPanelH] = useState(300);
  const [typed, setTyped] = useState(0);
  const [reduce, setReduce] = useState(false);
  const float = useRef(new Animated.Value(0)).current;
  const panelIn = useRef(new Animated.Value(0)).current;
  const cursor = useRef(new Animated.Value(1)).current;

  useEffect(() => { AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => {}); }, []);
  useEffect(() => {
    if (reduce) { setTyped(HEADLINE.length); panelIn.setValue(1); return; }
    Animated.timing(panelIn, { toValue: 1, duration: 700, delay: 500, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }).start();
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(float, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(float, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    const blink = Animated.loop(Animated.sequence([
      Animated.timing(cursor, { toValue: 0, duration: 0, delay: 450, useNativeDriver: true }),
      Animated.timing(cursor, { toValue: 1, duration: 0, delay: 450, useNativeDriver: true }),
    ]));
    loop.start(); blink.start();
    let i = 0;
    const start = setTimeout(() => {
      const id = setInterval(() => { i += 1; setTyped(i); if (i >= HEADLINE.length) clearInterval(id); }, 55);
    }, 1000);
    return () => { loop.stop(); blink.stop(); clearTimeout(start); };
  }, [reduce, float, panelIn, cursor]);

  if (session && profile) return <Redirect href="/(tabs)" />;
  if (session && !profile) return <Redirect href="/create-traveller" />;

  const lift = float.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });
  const rise = panelIn.interpolate({ inputRange: [0, 1], outputRange: [60, 0] });

  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <TitleScene look={DEFAULT_LOOK} height={height} groundPad={panelH + insets.bottom} />
      </View>

      <Animated.View style={[styles.logoWrap, { top: insets.top + 28, transform: [{ translateY: lift }] }]} pointerEvents="none">
        <Text style={styles.tagline}>✦ THE REAL-WORLD TRAVEL GAME ✦</Text>
        <View>
          <Text style={[styles.logo, styles.logoShadow2]}>mmGO</Text>
          <Text style={[styles.logo, styles.logoShadow1]}>mmGO</Text>
          <Text style={styles.logo}>mmGO</Text>
        </View>
        <Text style={styles.subline}>Massively multiplayer · in real life</Text>
      </Animated.View>

      <Animated.View onLayout={(e) => setPanelH(Math.round(e.nativeEvent.layout.height))}
        style={[styles.panelWrap, { paddingBottom: insets.bottom + 16, opacity: panelIn, transform: [{ translateY: rise }] }]}>
        <View style={styles.panelOuter}>
          <View style={styles.panel}>
            <View style={styles.corners} pointerEvents="none">
              {[{ top: 4, left: 4 }, { top: 4, right: 4 }, { bottom: 4, left: 4 }, { bottom: 4, right: 4 }].map((p, i) => <View key={i} style={[styles.corner, p]} />)}
            </View>
            <Text style={styles.chapter}>CHAPTER 1 · YOUR FIRST JOURNEY</Text>
            <View style={styles.headlineRow} accessible accessibilityLabel={HEADLINE}>
              <Text style={styles.headline}>
                {HEADLINE.slice(0, typed)}
                <Text style={styles.headlineGhost}>{HEADLINE.slice(typed)}</Text>
              </Text>
              {typed >= HEADLINE.length ? <Animated.Text style={[styles.cursor, { opacity: cursor }]}>▌</Animated.Text> : null}
            </View>
            <Text style={styles.body}>Explore real places, take a photo of yourself there and fill your book with stamps, from your home town to the far side of the world.</Text>
            <View style={styles.actions}>
              <PixelButton label="Begin your journey" onPress={() => router.push('/sign-in')} />
              <TextLink label="Continue my adventure" color={colors.gold} onPress={() => router.push({ pathname: '/sign-in', params: { returning: '1' } })} />
            </View>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const LOGO = 88;
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#141633' },
  logoWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  tagline: { fontFamily: fonts.labelBold, fontSize: 11, letterSpacing: 1, color: colors.gold, marginBottom: 2, textShadowColor: colors.ink, textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 0 },
  logo: { fontFamily: fonts.display, fontSize: LOGO, lineHeight: LOGO * 1.1, color: colors.paper, textShadowColor: colors.ink, textShadowOffset: { width: 3, height: 3 }, textShadowRadius: 0, textAlign: 'center' },
  logoShadow1: { position: 'absolute', left: 0, right: 0, top: 6, color: colors.stamp, textShadowColor: 'transparent' },
  logoShadow2: { position: 'absolute', left: 0, right: 0, top: 11, color: colors.ink, textShadowColor: 'transparent' },
  subline: { fontFamily: fonts.label, fontSize: 10, color: colors.paper, opacity: 0.85, marginTop: 6, textShadowColor: colors.ink, textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 0 },
  panelWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16 },
  panelOuter: { borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.ink, padding: 3 },
  panel: { borderWidth: 3, borderColor: colors.gold, backgroundColor: 'rgba(27,42,65,0.92)', paddingHorizontal: 18, paddingTop: 18, paddingBottom: 14, gap: 10 },
  corners: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  corner: { position: 'absolute', width: 6, height: 6, backgroundColor: colors.gold },
  chapter: { fontFamily: fonts.label, fontSize: 10, letterSpacing: 1, color: colors.gold },
  headlineRow: { flexDirection: 'row', alignItems: 'flex-end' },
  headline: { flexShrink: 1, fontFamily: fonts.display, fontSize: 26, lineHeight: 32, color: colors.paper },
  headlineGhost: { color: 'transparent' },
  cursor: { fontFamily: fonts.display, fontSize: 22, lineHeight: 30, color: colors.gold, marginLeft: 2 },
  body: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: '#D9D2C0' },
  actions: { gap: 10, marginTop: 6 },
});
