import { Redirect, router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TitleScene } from '@/components/TitleScene';
import { Body, Label, PixelButton, TextLink, Title } from '@/components/ui';
import { DEFAULT_LOOK } from '@/lib/pixel';
import { useSession } from '@/lib/session';
import { colors, fonts } from '@/lib/theme';

// 01 Title screen. Signed-in players with a traveller skip straight to their book.
export default function TitleScreen() {
  const { session, profile } = useSession();
  const insets = useSafeAreaInsets();
  if (session && profile) return <Redirect href="/(tabs)" />;
  if (session && !profile) return <Redirect href="/create-traveller" />;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.paper }} contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 24 }}>
      <View>
        <TitleScene look={DEFAULT_LOOK} />
        <View style={[styles.logoWrap, { top: insets.top + 40 }]} pointerEvents="none">
          <Text style={styles.tagline}>THE REAL-WORLD TRAVEL GAME</Text>
          <Text style={styles.logoShadow2}>mmGO</Text>
          <Text style={styles.logoShadow1}>mmGO</Text>
          <Text style={styles.logo}>mmGO</Text>
        </View>
        <View style={styles.edge} />
      </View>
      <View style={styles.copy}>
        <Label color={colors.stamp} style={{ fontSize: 11 }}>Chapter 1 · Your first journey</Label>
        <Title>Your adventure starts here...</Title>
        <Body>Every great journey begins at your front door. Explore real places, take a photo of yourself there and collect stamps, from your home town to the far side of the world.</Body>
      </View>
      <View style={styles.actions}>
        <PixelButton label="Begin your journey" onPress={() => router.push('/sign-in')} />
        <TextLink label="Continue my adventure" onPress={() => router.push({ pathname: '/sign-in', params: { returning: '1' } })} />
      </View>
    </ScrollView>
  );
}

const LOGO = 92;
const styles = StyleSheet.create({
  logoWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  tagline: { fontFamily: fonts.labelBold, fontSize: 11, letterSpacing: 1, color: colors.gold, marginBottom: 2, textShadowColor: colors.ink, textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 0 },
  logo: { fontFamily: fonts.display, fontSize: LOGO, lineHeight: LOGO * 1.1, color: colors.paper, textShadowColor: colors.ink, textShadowOffset: { width: 3, height: 3 }, textShadowRadius: 0 },
  logoShadow1: { position: 'absolute', top: 20 + 6, fontFamily: fonts.display, fontSize: LOGO, lineHeight: LOGO * 1.1, color: colors.stamp },
  logoShadow2: { position: 'absolute', top: 20 + 11, fontFamily: fonts.display, fontSize: LOGO, lineHeight: LOGO * 1.1, color: colors.ink },
  edge: { height: 6, backgroundColor: colors.ink },
  copy: { paddingHorizontal: 24, paddingTop: 20, gap: 10 },
  actions: { marginTop: 'auto', paddingHorizontal: 24, paddingTop: 20, gap: 12 },
});
