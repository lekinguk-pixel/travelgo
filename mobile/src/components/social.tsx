import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { toAvatar } from '@/lib/avatar';
import { colors, fonts } from '@/lib/theme';
import { Character } from './Character';
import { Icon } from './ui';

/** Head-and-shoulders pixel avatar in a dark square. */
export function Avatar({ look, size = 40, ring }: { look: unknown; size?: number; ring?: string }) {
  const cell = Math.max(1, Math.floor(size / 16));
  return (
    <View style={[styles.avatar, { width: size, height: size }, ring ? { borderWidth: 2, borderColor: ring } : null]}>
      {look ? <Character avatar={toAvatar(look)} size={cell} crop="portrait" /> : null}
    </View>
  );
}

/** Title bar with a back arrow, for screens outside the tabs. */
export function BackHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} hitSlop={10}
        accessibilityRole="button" accessibilityLabel="Back">
        <Icon name="back" />
      </Pressable>
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      <View style={{ minWidth: 24 }}>{right}</View>
    </View>
  );
}

/** "just now", "5 min ago", "3 h ago", "2 days ago", then a date. */
export function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 7) { const d = Math.floor(s / 86400); return `${d} day${d === 1 ? '' : 's'} ago`; }
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

const styles = StyleSheet.create({
  avatar: { backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 10 },
  title: { flex: 1, fontFamily: fonts.display, fontSize: 24, color: colors.ink },
});
