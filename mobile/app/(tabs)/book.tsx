import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Body, Icon, Label, Title } from '@/components/ui';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { colors, fonts, hardShadow, rarityColor, type Rarity } from '@/lib/theme';

type Entry = { id: number; claimed_at: string; status: string; photo_status: string; photo_path: string; landmarks: { name: string; rarity: Rarity; cities: { name: string } | null } | null };

// 11 My book: your stamps as a scrapbook, newest first, grouped by month.
export default function Book() {
  const { profile } = useSession();
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase.from('stamps')
      .select('id, claimed_at, status, photo_status, photo_path, landmarks(name, rarity, cities(name))')
      .eq('user_id', profile.id).order('claimed_at', { ascending: false });
    const list = (data ?? []) as unknown as Entry[];
    setEntries(list);
    if (list.length) {
      const { data: signed } = await supabase.storage.from('stamp-photos').createSignedUrls(list.map((e) => e.photo_path), 60 * 60);
      setUrls(Object.fromEntries((signed ?? []).filter((s) => s.signedUrl).map((s) => [s.path ?? '', s.signedUrl as string] as [string, string])));
    }
  }, [profile]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onThisDay = useMemo(() => {
    const now = new Date();
    return entries?.find((e) => {
      const d = new Date(e.claimed_at);
      return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() < now.getFullYear();
    });
  }, [entries]);

  const months = useMemo(() => {
    const groups: { key: string; items: Entry[] }[] = [];
    for (const e of entries ?? []) {
      const key = new Date(e.claimed_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
      const g = groups.find((x) => x.key === key);
      if (g) g.items.push(e); else groups.push({ key, items: [e] });
    }
    return groups;
  }, [entries]);

  if (entries === null) return <SafeAreaView style={styles.center}><ActivityIndicator color={colors.ink} /></SafeAreaView>;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={['top']}>
      <ScrollView contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
        <Title style={{ fontSize: 32 }}>My book</Title>
        {onThisDay ? (
          <View style={[styles.otd, hardShadow(3, 3)]}>
            <Label color={colors.bronze}>On this day · {new Date().getFullYear() - new Date(onThisDay.claimed_at).getFullYear()} year ago</Label>
            <Text style={styles.otdName}>{onThisDay.landmarks?.name}, {onThisDay.landmarks?.cities?.name}</Text>
          </View>
        ) : null}
        {entries.length === 0 ? (
          <View style={{ gap: 12, alignItems: 'center', paddingTop: 40 }}>
            <Icon name="book" color={colors.muted} size={48} />
            <Body style={{ textAlign: 'center' }}>Your book is empty for now. Every stamp you collect lands here with your photo, so you can look back on your adventures.</Body>
          </View>
        ) : months.map((m) => (
          <View key={m.key} style={{ gap: 12 }}>
            <View style={styles.monthRow}>
              <Text style={styles.month}>{m.key}</Text>
              <Text style={styles.monthCount}>{m.items.length} stamp{m.items.length === 1 ? '' : 's'}</Text>
            </View>
            <View style={styles.grid}>
              {m.items.map((e) => (
                <View key={e.id} style={[styles.polaroid, hardShadow(2, 3)]}>
                  <View style={[styles.photo, { borderColor: rarityColor(e.landmarks?.rarity ?? 'common') }]}>
                    {urls[e.photo_path] ? <Image source={{ uri: urls[e.photo_path] }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Icon name="user" color={colors.muted} size={28} />}
                    {e.status === 'pending_review' || e.photo_status === 'pending' ? <Text style={styles.pending}>BEING CHECKED</Text>
                      : e.photo_status === 'flagged' || e.photo_status === 'hidden' ? <Text style={styles.pending}>UNDER REVIEW · ONLY YOU CAN SEE IT</Text>
                      : e.photo_status === 'removed' ? <Text style={styles.pending}>HIDDEN BY A MODERATOR</Text> : null}
                  </View>
                  <View style={styles.caption}>
                    <Text style={styles.capName} numberOfLines={1}>{(e.landmarks?.name ?? '').toUpperCase()}</Text>
                    <Text style={styles.capDate}>{new Date(e.claimed_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase()}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper },
  body: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40, gap: 18 },
  otd: { backgroundColor: '#F6E7C3', borderWidth: 2, borderColor: colors.gold, padding: 14, gap: 4 },
  otdName: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  monthRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  month: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
  monthCount: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  polaroid: { width: '47%', backgroundColor: colors.card, padding: 8, paddingBottom: 10, gap: 8 },
  photo: { aspectRatio: 1, backgroundColor: '#D7E9E5', borderBottomWidth: 3, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  pending: { position: 'absolute', bottom: 6, backgroundColor: colors.ink, color: colors.gold, fontFamily: fonts.label, fontSize: 9, paddingHorizontal: 6, paddingVertical: 2 },
  caption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6 },
  capName: { fontFamily: fonts.labelBold, fontSize: 10, color: colors.ink, flex: 1 },
  capDate: { fontFamily: fonts.label, fontSize: 9, color: colors.stamp },
});
