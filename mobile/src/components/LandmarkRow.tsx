import { StyleSheet, Text, View } from 'react-native';
import { formatDistance, type Chapter } from '@/lib/useChapter';
import { colors, fonts, rarityColor, rarityXp } from '@/lib/theme';
import { Icon, Panel } from './ui';

type Row = Chapter['landmarks'][number];

export function LandmarkRow({ landmark, onPress }: { landmark: Row; onPress?: () => void }) {
  const rc = rarityColor(landmark.rarity);
  const done = landmark.stamped;
  return (
    <Panel onPress={onPress} style={styles.row}>
      <View style={[styles.slot, done ? { backgroundColor: colors.stamp, borderColor: colors.ink } : { backgroundColor: colors.ink, borderColor: rc }]}>
        <Icon name={done ? 'check' : 'map'} color={colors.paper} />
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 14 },
  slot: { width: 48, height: 48, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: fonts.display, fontSize: 17, color: colors.ink },
  detail: { fontFamily: fonts.bodySemi, fontSize: 12 },
  xp: { backgroundColor: colors.ink, borderWidth: 2, borderColor: colors.ink, paddingHorizontal: 8, paddingVertical: 4 },
  xpText: { fontFamily: fonts.label, fontSize: 11, color: colors.gold },
});
