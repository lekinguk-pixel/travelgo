import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { wikiImage } from '@/lib/media';
import { formatDistance, type Chapter } from '@/lib/useChapter';
import { colors, fonts, rarityColor, rarityXp } from '@/lib/theme';
import { Icon, Panel } from './ui';

type Row = Chapter['landmarks'][number];

export function LandmarkRow({ landmark, onPress }: { landmark: Row; onPress?: () => void }) {
  const rc = rarityColor(landmark.rarity);
  const done = landmark.stamped;
  const photo = wikiImage(landmark.photo_thumb_url);
  return (
    <Panel onPress={onPress} style={styles.row}>
      <View style={[styles.slot, { borderColor: done ? colors.ink : rc, backgroundColor: colors.ink }]}>
        {photo ? <Image source={photo} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} /> : <Icon name="map" color={colors.paper} />}
        {done ? <View style={styles.check}><Icon name="check" color={colors.paper} size={16} /></View> : null}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.name} numberOfLines={1}>{landmark.name}</Text>
        <Text style={[styles.detail, { color: done ? colors.muted : rc }]} numberOfLines={1}>
          {landmark.rarity.toUpperCase()}{done ? ' · Stamped' : landmark.distanceM !== null ? ` · ${formatDistance(landmark.distanceM)}` : ''}
        </Text>
      </View>
      <View style={[styles.xp, done ? { backgroundColor: colors.paper } : null]}>
        <Text style={[styles.xpText, done ? { color: colors.muted } : null]}>+{rarityXp[landmark.rarity]} XP</Text>
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10, paddingHorizontal: 12 },
  slot: { width: 60, height: 60, borderWidth: 3, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  check: { position: 'absolute', right: 0, bottom: 0, backgroundColor: colors.stamp, borderTopWidth: 2, borderLeftWidth: 2, borderColor: colors.ink, padding: 2 },
  name: { fontFamily: fonts.display, fontSize: 17, color: colors.ink },
  detail: { fontFamily: fonts.bodySemi, fontSize: 12 },
  xp: { backgroundColor: colors.ink, borderWidth: 2, borderColor: colors.ink, paddingHorizontal: 8, paddingVertical: 4 },
  xpText: { fontFamily: fonts.label, fontSize: 11, color: colors.gold },
});
