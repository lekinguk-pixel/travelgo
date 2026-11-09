import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { SpinWheel } from '@/components/SpinWheel';
import { Label } from '@/components/ui';
import { colors, fonts, hardShadow } from '@/lib/theme';

const BLANK = Array.from({ length: 8 }, () => '');

/** Entry point to the "spin the globe" wheel, with a slowly turning mini wheel. */
export function SpinBanner() {
  const rotation = useRef(new Animated.Value(0)).current;
  const [bulbs, setBulbs] = useState(false);
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce) return;
      loop = Animated.loop(Animated.timing(rotation, { toValue: 360, duration: 14000, easing: Easing.linear, useNativeDriver: true }));
      loop.start();
    }).catch(() => {});
    const id = setInterval(() => setBulbs((b) => !b), 700);
    return () => { loop?.stop(); clearInterval(id); };
  }, [rotation]);

  return (
    <Pressable onPress={() => router.push('/spin')} accessibilityRole="button" accessibilityLabel="Spin the globe: pick a random destination"
      style={({ pressed }) => [styles.card, hardShadow(pressed ? 1 : 4, pressed ? 1 : 4)]}>
      <View pointerEvents="none" style={{ marginTop: -14 }}>
        <SpinWheel size={104} names={BLANK} rotation={rotation} bulbsOn={bulbs} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Label color={colors.gold}>Feeling lucky?</Label>
        <Text style={styles.title}>Spin the globe</Text>
        <Text style={styles.sub}>Let Lady Luck pick where you go next.</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.night, borderWidth: 3, borderColor: colors.gold, paddingVertical: 10, paddingHorizontal: 14 },
  title: { fontFamily: fonts.display, fontSize: 22, color: colors.paper },
  sub: { fontFamily: fonts.body, fontSize: 13, color: colors.paper },
});
