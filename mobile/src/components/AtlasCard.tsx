import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { wikiImage } from '@/lib/media';
import { colors, fonts, hardShadow } from '@/lib/theme';
import { Icon, Label } from './ui';

// The photo-and-text card used for countries and cities in the Atlas.
export function AtlasCard({ photo, kicker, title, meta, status, statusOn, onPress }: {
  photo: string | null; kicker?: string; title: string; meta: string; status: string; statusOn: boolean; onPress: () => void;
}) {
  const src = wikiImage(photo);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={title}
      style={({ pressed }) => [styles.card, hardShadow(pressed ? 1 : 4, pressed ? 1 : 4)]}>
      <View style={styles.photo}>
        {src ? <Image source={src} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} /> : <Icon name="map" color={colors.silver} />}
      </View>
      <View style={styles.info}>
        {kicker ? <Label color={colors.stamp} style={{ fontSize: 9 }}>{kicker}</Label> : null}
        <Text style={styles.name} numberOfLines={1}>{title}</Text>
        <Text style={styles.meta} numberOfLines={2}>{meta}</Text>
        <Text style={[styles.count, { color: statusOn ? colors.teal : colors.muted }]}>{status}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', backgroundColor: colors.card, borderWidth: 3, borderColor: colors.ink, overflow: 'hidden' },
  photo: { width: 104, minHeight: 96, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', borderRightWidth: 3, borderRightColor: colors.ink },
  info: { flex: 1, padding: 12, gap: 2, justifyContent: 'center' },
  name: { fontFamily: fonts.display, fontSize: 20, color: colors.ink },
  meta: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.muted },
  count: { fontFamily: fonts.bodyBold, fontSize: 12, marginTop: 4 },
});
