import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackHeader, timeAgo } from '@/components/social';
import { Body, Label, PixelButton, TextLink } from '@/components/ui';
import { friendlyError, supabase } from '@/lib/supabase';
import { colors, fonts, hardShadow } from '@/lib/theme';

type Link = { key: string; label: string; partner: string; promo_code: string | null; promo_text: string | null };
type Message = {
  id: number; kind: 'travel_idea' | 'social' | 'game' | 'referral'; title: string; body: string;
  route: string | null; city_id: number | null; created_at: string; read_at: string | null; links: Link[];
};
type Settings = { eligible: boolean; travel_ideas: boolean; frequency: 'weekly' | 'monthly' };

const KIND_LABEL: Record<Message['kind'], string> = { travel_idea: 'Travel idea', social: 'Friends', game: 'Your journey', referral: 'Invites' };
const KIND_COLOR: Record<Message['kind'], string> = { travel_idea: colors.gold, social: colors.teal, game: colors.stamp, referral: colors.bronze };

// Inbox: game and friend news, plus (for adults who opted in) one travel idea a week.
export default function Inbox() {
  const [items, setItems] = useState<Message[] | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState('');
  const [opening, setOpening] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [m, s] = await Promise.all([supabase.rpc('my_inbox', { p_limit: 50 }), supabase.rpc('inbox_settings')]);
    if (m.error) { setError(friendlyError(m.error)); setItems([]); return; }
    setError('');
    setItems((m.data ?? []) as Message[]);
    setSettings((s.data as Settings | null) ?? null);
    // Opening the inbox counts as reading it.
    if ((m.data ?? []).some((x: Message) => !x.read_at)) supabase.rpc('mark_inbox_read', { p_id: null }).then(() => {});
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function openPartner(msg: Message, link: Link) {
    setOpening(`${msg.id}:${link.key}`);
    const { data, error: e } = await supabase.rpc('inbox_click', { p_message_id: msg.id, p_partner: link.key });
    setOpening(null);
    if (e || typeof data !== 'string') { setError(friendlyError(e)); return; }
    Linking.openURL(data).catch(() => setError('Couldn\'t open that link.'));
  }

  async function dismiss(msg: Message, notInterested: boolean) {
    setItems((list) => (list ?? []).filter((x) => x.id !== msg.id));
    await supabase.rpc('dismiss_inbox', { p_id: msg.id, p_not_interested: notInterested });
  }

  async function switchOn() {
    const { data, error: e } = await supabase.rpc('set_travel_ideas', { p_on: true });
    if (e) { setError(friendlyError(e)); return; }
    setSettings(data as Settings);
    load();
  }

  const city = (m: Message) => m.title.replace(/^Your next chapter:\s*/, '');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
      <BackHeader title="Inbox" right={<TextLink label="Settings" color={colors.muted} onPress={() => router.push('/inbox-settings')} />} />
      <ScrollView contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {settings?.eligible && !settings.travel_ideas ? (
          <View style={[styles.offer, hardShadow(4, 4)]}>
            <Label color={colors.gold}>Optional</Label>
            <Text style={styles.offerTitle}>Get travel ideas</Text>
            <Body style={styles.offerBody}>One suggestion a week for your next chapter, picked from your home city and stamps. They include partner links to stays, tickets and travel.</Body>
            <PixelButton label="Switch on" onPress={switchOn} />
          </View>
        ) : null}

        {items === null ? <ActivityIndicator color={colors.ink} /> : items.length === 0 ? (
          <View style={{ gap: 8, paddingTop: 24 }}>
            <Text style={styles.emptyTitle}>Nothing here yet</Text>
            <Body>Friend requests, chapter medals and invites will turn up here.</Body>
          </View>
        ) : items.map((m) => m.kind === 'travel_idea' ? (
          <View key={m.id} style={[styles.idea, hardShadow(4, 4)]}>
            <View style={styles.ideaTop}>
              <Label color={colors.gold}>Travel idea</Label>
              <Text style={styles.partnerTag}>PARTNER LINKS</Text>
            </View>
            <Text style={styles.ideaTitle}>{m.title}</Text>
            <Text style={styles.ideaBody}>{m.body}</Text>
            <View style={styles.links}>
              {m.links.map((l) => (
                <Pressable key={l.key} onPress={() => openPartner(m, l)} disabled={!!opening}
                  accessibilityRole="link" accessibilityLabel={`${l.label} with ${l.partner}`}
                  style={({ pressed }) => [styles.linkBtn, pressed ? { transform: [{ translateY: 2 }] } : hardShadow(0, 3)]}>
                  {opening === `${m.id}:${l.key}` ? <ActivityIndicator color={colors.ink} size="small" /> : (
                    <>
                      <Text style={styles.linkLabel}>{l.label.toUpperCase()}</Text>
                      <Text style={styles.linkPartner}>{l.partner}</Text>
                    </>
                  )}
                </Pressable>
              ))}
            </View>
            {m.links.filter((l) => l.promo_text).map((l) => (
              <Text key={l.key} style={styles.promo}>{l.promo_text}{l.promo_code ? ` · code ${l.promo_code}` : ''}</Text>
            ))}
            <Text style={styles.disclose}>mmGO may earn a commission if you book through these links. Your price stays the same.</Text>
            <View style={styles.ideaActions}>
              <TextLink label={`Not interested in ${city(m)}`} color={colors.silver} onPress={() => dismiss(m, true)} />
              <TextLink label="Dismiss" color={colors.silver} onPress={() => dismiss(m, false)} />
            </View>
          </View>
        ) : (
          <Pressable key={m.id} onPress={m.route ? () => router.push(m.route as Href) : undefined}
            accessibilityRole={m.route ? 'button' : undefined}
            style={({ pressed }) => [styles.note, hardShadow(pressed ? 1 : 3, pressed ? 1 : 3)]}>
            <View style={[styles.dot, { backgroundColor: m.read_at ? colors.line : KIND_COLOR[m.kind] }]} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.kind, { color: KIND_COLOR[m.kind] }]}>{KIND_LABEL[m.kind].toUpperCase()} · {timeAgo(m.created_at)}</Text>
              <Text style={styles.noteTitle}>{m.title}</Text>
              <Text style={styles.noteBody}>{m.body}</Text>
            </View>
            <Pressable onPress={() => dismiss(m, false)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Dismiss message">
              <Text style={styles.x}>×</Text>
            </Pressable>
          </Pressable>
        ))}

        <TextLink label="Invite friends" color={colors.stamp} onPress={() => router.push('/invite')} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 24, paddingBottom: 40, gap: 14 },
  error: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.paper, backgroundColor: colors.stamp, padding: 10 },
  offer: { backgroundColor: colors.card, borderWidth: 3, borderColor: colors.gold, padding: 16, gap: 8 },
  offerTitle: { fontFamily: fonts.display, fontSize: 20, color: colors.ink },
  offerBody: { fontSize: 14 },
  emptyTitle: { fontFamily: fonts.display, fontSize: 20, color: colors.ink },
  idea: { backgroundColor: colors.ink, borderWidth: 3, borderColor: colors.gold, padding: 16, gap: 10 },
  ideaTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  partnerTag: { fontFamily: fonts.label, fontSize: 9, color: colors.ink, backgroundColor: colors.silver, paddingHorizontal: 6, paddingVertical: 2 },
  ideaTitle: { fontFamily: fonts.display, fontSize: 22, color: colors.paper },
  ideaBody: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.paper },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  linkBtn: { flexGrow: 1, minWidth: '30%', minHeight: 52, backgroundColor: colors.paper, borderWidth: 2, borderColor: colors.gold, paddingVertical: 8, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  linkLabel: { fontFamily: fonts.labelBold, fontSize: 11, color: colors.ink },
  linkPartner: { fontFamily: fonts.body, fontSize: 11, color: colors.muted },
  promo: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.gold },
  disclose: { fontFamily: fonts.body, fontSize: 11, color: colors.silver },
  ideaActions: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap' },
  note: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', backgroundColor: colors.card, borderWidth: 2, borderColor: colors.ink, padding: 14 },
  dot: { width: 10, height: 10, marginTop: 4, borderWidth: 2, borderColor: colors.ink },
  kind: { fontFamily: fonts.label, fontSize: 9 },
  noteTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  noteBody: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  x: { fontFamily: fonts.bodyBold, fontSize: 20, color: colors.muted, lineHeight: 20 },
});
