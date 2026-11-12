import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Pip } from '@/components/PrologueArt';
import { wikiImage } from '@/lib/media';
import { colors, fonts, hardShadow, rarityColor } from '@/lib/theme';
import type { Landmark } from '@/lib/useChapter';

/** Pinned on Explore until the player's first stamp: the nearest landmark, as their first quest. */
export function FirstStampCard({ lm, distanceM }: { lm: Landmark; distanceM: number | null }) {
  const img = wikiImage(lm.photo_thumb_url);
  const far = distanceM === null ? 'In your home city' : distanceM < 1000 ? `${Math.round(distanceM)} m away` : `${(distanceM / 1000).toFixed(1)} km away`;
  return (
    <Pressable onPress={() => router.push(`/landmark/${lm.id}`)} accessibilityRole="button"
      accessibilityLabel={`Your first quest: ${lm.name}, ${far}. Open it.`}
      style={({ pressed }) => [styles.card, hardShadow(pressed ? 1 : 4, pressed ? 1 : 4)]}>
      <View style={styles.photo}>
        {img ? <Image source={img} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
        <View style={styles.pip}><Pip scale={2} /></View>
      </View>
      <View style={{ flex: 1, padding: 12, gap: 3 }}>
        <Text style={styles.kicker}>YOUR FIRST QUEST</Text>
        <Text style={styles.name} numberOfLines={2}>{lm.name}</Text>
        <Text style={[styles.meta, { color: rarityColor(lm.rarity) }]}>{lm.rarity.toUpperCase()} · <Text style={{ color: colors.paper }}>{far}</Text></Text>
        <Text style={styles.cta}>Go there and snap it in the Stamp tab ▸</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', backgroundColor: colors.night, borderWidth: 3, borderColor: colors.gold, overflow: 'hidden' },
  photo: { width: 110, backgroundColor: colors.ink },
  pip: { position: 'absolute', left: 4, bottom: 4, backgroundColor: '#F3E6C8', borderWidth: 2, borderColor: colors.ink, padding: 2 },
  kicker: { fontFamily: fonts.labelBold, fontSize: 10.5, color: colors.gold, letterSpacing: 0.5 },
  name: { fontFamily: fonts.display, fontSize: 20, lineHeight: 23, color: colors.paper },
  meta: { fontFamily: fonts.labelBold, fontSize: 10.5 },
  cta: { fontFamily: fonts.bodySemi, fontSize: 12.5, color: colors.silver, marginTop: 2 },
});
