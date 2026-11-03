import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, BackHeader, timeAgo } from '@/components/social';
import { Body, Label, PixelInput } from '@/components/ui';
import type { Look } from '@/lib/pixel';
import { friendlyError, supabase } from '@/lib/supabase';
import { colors, fonts, hardShadow, rarityColor, type Rarity } from '@/lib/theme';

type Person = { user_id: string; traveller_name: string; avatar: Look; total_xp: number; home_city: string | null; status: 'friend' | 'incoming' | 'outgoing'; since: string };
type FeedItem = { stamp_id: number; user_id: string; traveller_name: string; avatar: Look; landmark: string; rarity: Rarity; city: string; claimed_at: string; photo_path: string | null; xp_awarded: number };

// Friends: add by traveller name, answer requests, and follow your friends' journeys.
export default function Friends() {
  const [people, setPeople] = useState<Person[] | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; good: boolean } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [p, f] = await Promise.all([supabase.rpc('my_friends'), supabase.rpc('friends_feed', { p_limit: 30 })]);
    setPeople((p.data ?? []) as Person[]);
    const items = (f.data ?? []) as FeedItem[];
    setFeed(items);
    const paths = items.map((i) => i.photo_path).filter((p): p is string => !!p);
    if (paths.length) {
      const { data } = await supabase.storage.from('stamp-photos').createSignedUrls(paths, 3600);
      setUrls(Object.fromEntries((data ?? []).filter((d) => d.signedUrl).map((d) => [d.path ?? '', d.signedUrl as string] as [string, string])));
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function add() {
    const v = name.trim();
    if (!v) return;
    setBusy(true); setNotice(null);
    const { data, error } = await supabase.rpc('add_friend', { p_name: v });
    setBusy(false);
    if (error) { setNotice({ text: friendlyError(error), good: false }); return; }
    const msg: Record<string, string> = {
      requested: `Friend request sent to ${v}.`,
      accepted: `You and ${v} are now friends!`,
      already_friends: `You're already friends with ${v}.`,
      already_requested: `You've already asked ${v}. Waiting for them to accept.`,
    };
    setNotice({ text: msg[data as string] ?? 'Done.', good: true });
    setName('');
    load();
  }

  async function respond(id: string, accept: boolean) {
    await supabase.rpc('respond_friend', { p_user_id: id, p_accept: accept });
    load();
  }
  async function cancel(id: string) {
    await supabase.rpc('remove_friend', { p_user_id: id });
    load();
  }

  const friends = (people ?? []).filter((p) => p.status === 'friend');
  const incoming = (people ?? []).filter((p) => p.status === 'incoming');
  const outgoing = (people ?? []).filter((p) => p.status === 'outgoing');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
      <BackHeader title="Friends" />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
        <View style={{ gap: 8 }}>
          <Label>Add a friend by traveller name</Label>
          <View style={styles.addRow}>
            <PixelInput value={name} onChangeText={(v) => { setName(v); setNotice(null); }} placeholder="e.g. WanderingDave"
              autoCapitalize="none" autoCorrect={false} maxLength={16} returnKeyType="send" onSubmitEditing={add}
              accessibilityLabel="Traveller name" style={{ flex: 1 }} />
            <Pressable onPress={add} disabled={busy || !name.trim()} accessibilityRole="button" accessibilityLabel="Add friend"
              style={[styles.addBtn, hardShadow(3, 3), (busy || !name.trim()) ? { backgroundColor: colors.silver } : null]}>
              {busy ? <ActivityIndicator color={colors.paper} /> : <Text style={styles.addText}>ADD</Text>}
            </Pressable>
          </View>
          {notice ? <Text style={[styles.notice, { color: notice.good ? colors.uncommon : colors.stamp }]}>{notice.text}</Text> : null}
        </View>

        {incoming.length ? (
          <View style={{ gap: 10 }}>
            <Label color={colors.stamp}>Friend requests · {incoming.length}</Label>
            {incoming.map((p) => (
              <View key={p.user_id} style={[styles.row, hardShadow(3, 3), { borderColor: colors.stamp }]}>
                <Avatar look={p.avatar} />
                <View style={{ flex: 1 }}><Text style={styles.name}>{p.traveller_name}</Text><Text style={styles.meta}>{p.home_city ?? 'Traveller'} · {Number(p.total_xp).toLocaleString()} XP</Text></View>
                <Pressable onPress={() => respond(p.user_id, true)} style={[styles.small, { backgroundColor: colors.uncommon }]} accessibilityRole="button" accessibilityLabel={`Accept ${p.traveller_name}`}><Text style={styles.smallText}>ACCEPT</Text></Pressable>
                <Pressable onPress={() => respond(p.user_id, false)} style={[styles.small, { backgroundColor: colors.card }]} accessibilityRole="button" accessibilityLabel={`Decline ${p.traveller_name}`}><Text style={[styles.smallText, { color: colors.ink }]}>NO</Text></Pressable>
              </View>
            ))}
          </View>
        ) : null}

        <Label>Friends' journeys</Label>
        {people === null ? <ActivityIndicator color={colors.ink} /> : feed.length === 0 ? (
          <Body>{friends.length ? 'Your friends haven\'t collected any stamps yet. Their adventures will appear here.' : 'Add friends to follow their journeys. Every stamp they collect shows up here with their photo.'}</Body>
        ) : feed.map((f) => (
          <View key={f.stamp_id} style={[styles.post, hardShadow(3, 3)]}>
            <Pressable onPress={() => router.push(`/traveller/${f.user_id}`)} style={styles.postTop} accessibilityRole="button" accessibilityLabel={`Open ${f.traveller_name}'s journey`}>
              <Avatar look={f.avatar} size={34} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{f.traveller_name}</Text>
                <Text style={styles.meta}>stamped <Text style={{ color: rarityColor(f.rarity), fontFamily: fonts.bodyBold }}>{f.landmark}</Text> · {f.city}</Text>
              </View>
              <Text style={styles.when}>{timeAgo(f.claimed_at)}</Text>
            </Pressable>
            <View style={[styles.photo, { borderColor: rarityColor(f.rarity) }]}>
              {f.photo_path && urls[f.photo_path] ? <Image source={{ uri: urls[f.photo_path] }} style={StyleSheet.absoluteFill} contentFit="cover" />
                : !f.photo_path ? <Text style={styles.checking}>Photo being checked</Text> : null}
              <View style={[styles.rarity, { backgroundColor: rarityColor(f.rarity) }]}><Text style={styles.rarityText}>{f.rarity.toUpperCase()} · +{f.xp_awarded} XP</Text></View>
            </View>
            {f.photo_path ? (
              <Pressable onPress={() => router.push({ pathname: '/report/[id]', params: { id: String(f.stamp_id), name: f.traveller_name, place: f.landmark } })}
                hitSlop={8} style={{ alignSelf: 'flex-end' }} accessibilityRole="button" accessibilityLabel={`Report ${f.traveller_name}'s photo`}>
                <Text style={styles.reportLink}>REPORT</Text>
              </Pressable>
            ) : null}
          </View>
        ))}

        <Label>Your friends · {friends.length}</Label>
        {friends.length === 0 && people !== null ? <Body>No friends yet. Ask your friends for their traveller name and add them above.</Body> : null}
        {friends.map((p) => (
          <Pressable key={p.user_id} onPress={() => router.push(`/traveller/${p.user_id}`)} style={[styles.row, hardShadow(3, 3)]}
            accessibilityRole="button" accessibilityLabel={`Open ${p.traveller_name}'s journey`}>
            <Avatar look={p.avatar} />
            <View style={{ flex: 1 }}><Text style={styles.name}>{p.traveller_name}</Text><Text style={styles.meta}>{p.home_city ?? 'Traveller'}</Text></View>
            <Text style={styles.xp}>{Number(p.total_xp).toLocaleString()} XP</Text>
          </Pressable>
        ))}

        {outgoing.length ? (
          <View style={{ gap: 10 }}>
            <Label>Waiting for them to accept · {outgoing.length}</Label>
            {outgoing.map((p) => (
              <View key={p.user_id} style={[styles.row, { opacity: 0.8 }]}>
                <Avatar look={p.avatar} size={34} />
                <Text style={[styles.name, { flex: 1 }]}>{p.traveller_name}</Text>
                <Pressable onPress={() => cancel(p.user_id)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Cancel request to ${p.traveller_name}`}><Text style={styles.cancel}>CANCEL</Text></Pressable>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 24, paddingBottom: 40, gap: 14 },
  addRow: { flexDirection: 'row', gap: 10, alignItems: 'stretch' },
  addBtn: { backgroundColor: colors.stamp, borderWidth: 3, borderColor: colors.ink, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', minWidth: 72 },
  addText: { fontFamily: fonts.labelBold, fontSize: 13, color: colors.paper },
  notice: { fontFamily: fonts.bodyBold, fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.ink, padding: 10 },
  name: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  meta: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
  xp: { fontFamily: fonts.label, fontSize: 11, color: colors.bronze },
  small: { borderWidth: 2, borderColor: colors.ink, paddingHorizontal: 8, paddingVertical: 6 },
  smallText: { fontFamily: fonts.labelBold, fontSize: 10, color: colors.paper },
  post: { backgroundColor: colors.card, borderWidth: 2, borderColor: colors.ink, padding: 10, gap: 10 },
  postTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  when: { fontFamily: fonts.label, fontSize: 9, color: colors.muted },
  photo: { aspectRatio: 4 / 3, backgroundColor: '#D7E9E5', borderBottomWidth: 4, overflow: 'hidden', justifyContent: 'flex-end', alignItems: 'flex-start' },
  rarity: { margin: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 2, borderColor: colors.ink },
  rarityText: { fontFamily: fonts.labelBold, fontSize: 10, color: colors.paper },
  cancel: { fontFamily: fonts.label, fontSize: 11, color: colors.muted },
  checking: { alignSelf: 'center', marginBottom: 'auto', marginTop: 'auto', fontFamily: fonts.label, fontSize: 11, color: colors.teal },
  reportLink: { fontFamily: fonts.label, fontSize: 10, color: colors.muted },
});
