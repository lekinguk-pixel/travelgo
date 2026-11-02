import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TitleScene } from '@/components/TitleScene';
import { Body, PixelButton, Title } from '@/components/ui';
import { DEFAULT_LOOK } from '@/lib/pixel';
import { useSession } from '@/lib/session';
import { colors, fonts, hardShadow } from '@/lib/theme';

// The send-off: your new traveller walks out of town, then chapter 1 begins.
export default function SendOff() {
  const { city } = useLocalSearchParams<{ city?: string }>();
  const { profile } = useSession();
  const insets = useSafeAreaInsets();
  const [arrived, setArrived] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper, paddingBottom: insets.bottom + 24 }}>
      <View>
        <TitleScene look={profile?.avatar ?? DEFAULT_LOOK} walking onWalkDone={() => setArrived(true)} />
        {arrived ? (
          <View style={[styles.banner, hardShadow(4, 4)]}>
            <Text style={styles.bannerSmall}>CHAPTER 1 · {(city ?? 'Home').toUpperCase()}</Text>
            <Text style={styles.bannerBig}>Good luck, {profile?.traveller_name ?? 'traveller'}!</Text>
          </View>
        ) : null}
        <View style={{ height: 6, backgroundColor: colors.ink }} />
      </View>
      <View style={{ paddingHorizontal: 24, paddingTop: 20, gap: 10 }}>
        <Title>{arrived ? 'Your journey has begun' : 'Setting off...'}</Title>
        <Body>Your first chapter is {city ?? 'your home town'}. Visit its landmarks, take a photo of yourself at each one and collect the stamps.</Body>
      </View>
      <View style={{ marginTop: 'auto', paddingHorizontal: 24 }}>
        <PixelButton label="Open my book" onPress={() => router.replace('/(tabs)')} disabled={!arrived} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { position: 'absolute', alignSelf: 'center', top: '42%', backgroundColor: colors.ink, borderWidth: 3, borderColor: colors.gold, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center', maxWidth: '88%' },
  bannerSmall: { fontFamily: fonts.label, fontSize: 10, color: colors.gold },
  bannerBig: { fontFamily: fonts.display, fontSize: 22, color: colors.paper, textAlign: 'center' },
});
