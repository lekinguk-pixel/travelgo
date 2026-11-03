import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackHeader, timeAgo } from '@/components/social';
import { Body, Label } from '@/components/ui';
import { friendlyError, supabase } from '@/lib/supabase';
import { colors, fonts, hardShadow } from '@/lib/theme';

type Report = { reason: string; details: string | null; by: string; at: string };
type Item = {
  stamp_id: number; user_id: string; traveller_name: string; landmark: string; city: string; claimed_at: string;
  photo_path: string; photo_status: string; stamp_status: string; moderation: { categories?: Record<string, boolean>; top?: string } | null;
  distance_m: number; reports: Report[];
};

const REASON: Record<string, string> = { inappropriate: 'Inappropriate photo', not_there: 'Not taken there', bullying: 'Bullying or harassment', other: 'Something else' };
const STATUS: Record<string, { text: string; colour: string }> = {
  flagged: { text: 'FLAGGED BY AI · HIDDEN', colour: colors.legendary },
  hidden: { text: 'HIDDEN AFTER REPORTS', colour: colors.stamp },
  approved: { text: 'VISIBLE TO FRIENDS', colour: colors.uncommon },
  pending: { text: 'WAITING FOR AI CHECK', colour: colors.muted },
  removed: { text: 'PHOTO REMOVED', colour: colors.muted },
};

// Moderators only: review flagged, reported and suspicious stamps.
export default function Moderation() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data, error: e } = await supabase.rpc('moderation_queue');
    if (e) { setError(friendlyError(e)); setItems([]); return; }
    const list = (data ?? []) as Item[];
    setItems(list);
    if (list.length) {
      const { data: signed } = await supabase.storage.from('stamp-photos').createSignedUrls(list.map((i) => i.photo_path), 1800);
      setUrls(Object.fromEntries((signed ?? []).filter((d) => d.signedUrl).map((d) => [d.path ?? '', d.signedUrl as string] as [string, string])));
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  function act(item: Item, action: 'keep' | 'hide' | 'remove') {
    const copy = {
      keep: { title: 'Keep this stamp?', body: 'The photo becomes visible to their friends again and the reports are closed.', button: 'Keep' },
      hide: { title: 'Hide the photo?', body: 'They keep the stamp and its XP, but nobody else will see the photo.', button: 'Hide photo' },
      remove: { title: 'Remove the stamp?', body: 'Use this for cheating. The stamp and its XP are taken away. This can\'t be undone.', button: 'Remove stamp' },
    }[action];
    Alert.alert(copy.title, copy.body, [
      { text: 'Cancel', style: 'cancel' },
      { text: copy.button, style: action === 'keep' ? 'default' : 'destructive', onPress: async () => {
        const { error: e } = await supabase.rpc('moderate_stamp', { p_stamp_id: item.stamp_id, p_action: action });
        if (e) Alert.alert('That didn\'t work', friendlyError(e)); else load();
      } },
    ]);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
      <BackHeader title="Moderation" />
      <ScrollView contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
        {error ? <Body>{error}</Body> : items === null ? <ActivityIndicator color={colors.ink} /> : items.length === 0 ? (
          <Body>Nothing to review. Flagged photos, reported stamps and suspicious travel will appear here.</Body>
        ) : items.map((it) => {
          const st = STATUS[it.photo_status] ?? STATUS.approved;
          const flags = it.moderation?.categories ? Object.entries(it.moderation.categories).filter(([, v]) => v).map(([k]) => k) : [];
          return (
            <View key={it.stamp_id} style={[styles.card, hardShadow(3, 3)]}>
              <View style={[styles.status, { backgroundColor: st.colour }]}><Text style={styles.statusText}>{st.text}</Text></View>
              {it.stamp_status === 'pending_review' ? <Text style={styles.warn}>Impossible-travel check: XP held until you decide.</Text> : null}
              <View style={styles.photo}>
                {urls[it.photo_path] ? <Image source={{ uri: urls[it.photo_path] }} style={StyleSheet.absoluteFill} contentFit="contain" /> : null}
              </View>
              <Text style={styles.title}>{it.traveller_name} · {it.landmark}</Text>
              <Text style={styles.meta}>{it.city} · {timeAgo(it.claimed_at)} · {Math.round(it.distance_m)} m from the landmark</Text>
              {flags.length ? <Text style={styles.flags}>AI flagged: {flags.join(', ')}</Text> : null}
              {it.reports.length ? (
                <View style={{ gap: 4 }}>
                  <Label color={colors.stamp}>Reports · {it.reports.length}</Label>
                  {it.reports.map((r, i) => (
                    <Text key={i} style={styles.report}>• {REASON[r.reason] ?? r.reason}{r.details ? `: "${r.details}"` : ''} <Text style={styles.by}>({r.by}, {timeAgo(r.at)})</Text></Text>
                  ))}
                </View>
              ) : null}
              <View style={styles.actions}>
                <Pressable onPress={() => act(it, 'keep')} style={[styles.btn, { backgroundColor: colors.uncommon }]} accessibilityRole="button"><Text style={styles.btnText}>KEEP</Text></Pressable>
                <Pressable onPress={() => act(it, 'hide')} style={[styles.btn, { backgroundColor: colors.ink }]} accessibilityRole="button"><Text style={styles.btnText}>HIDE PHOTO</Text></Pressable>
                <Pressable onPress={() => act(it, 'remove')} style={[styles.btn, { backgroundColor: colors.stamp }]} accessibilityRole="button"><Text style={styles.btnText}>REMOVE</Text></Pressable>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 24, paddingBottom: 40, gap: 16 },
  card: { backgroundColor: colors.card, borderWidth: 2, borderColor: colors.ink, padding: 12, gap: 8 },
  status: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderWidth: 2, borderColor: colors.ink },
  statusText: { fontFamily: fonts.labelBold, fontSize: 10, color: colors.paper },
  warn: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.legendary },
  photo: { aspectRatio: 1, backgroundColor: colors.ink, overflow: 'hidden' },
  title: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  meta: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
  flags: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.legendary },
  report: { fontFamily: fonts.body, fontSize: 13, color: colors.ink },
  by: { color: colors.muted, fontSize: 11 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  btn: { flex: 1, borderWidth: 2, borderColor: colors.ink, paddingVertical: 10, alignItems: 'center' },
  btnText: { fontFamily: fonts.labelBold, fontSize: 10, color: colors.paper },
});
