import * as Clipboard from 'expo-clipboard';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, BackHeader } from '@/components/social';
import { Body, Label, PixelButton, PixelInput, TextLink, Title } from '@/components/ui';
import type { Look } from '@/lib/pixel';
import { useSession } from '@/lib/session';
import { friendlyError, supabase } from '@/lib/supabase';
import { colors, fonts, hardShadow } from '@/lib/theme';

type Member = { user_id: string; traveller_name: string; avatar: Look; total_xp: number; role: 'leader' | 'member'; joined_at: string };
type Clan = { id: number; name: string; role: 'leader' | 'member'; code: string | null; week_xp: number; members: Member[] };

// Clans: start one, join one with an invite code, see your clanmates.
export default function ClanScreen() {
  const { profile } = useSession();
  const [clan, setClan] = useState<Clan | null | undefined>(undefined);
  const [rank, setRank] = useState<number | null>(null);
  const [newName, setNewName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc('my_clan');
    setClan((data as Clan | null) ?? null);
    if (data) {
      const { data: board } = await supabase.rpc('leaderboard', { p_scope: 'world', p_scope_id: null, p_period: 'week', p_mode: 'clans', p_limit: 100 });
      setRank(((board ?? []) as { rank: number; is_me: boolean }[]).find((r) => r.is_me)?.rank ?? null);
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function create() {
    setBusy('create'); setError('');
    const { error: e } = await supabase.rpc('create_clan', { p_name: newName });
    setBusy(null);
    if (e) { setError(friendlyError(e)); return; }
    setNewName(''); load();
  }
  async function join() {
    setBusy('join'); setError('');
    const { error: e } = await supabase.rpc('join_clan', { p_code: code });
    setBusy(null);
    if (e) { setError(friendlyError(e)); return; }
    setCode(''); load();
  }
  function leave() {
    if (!clan) return;
    const others = clan.members.length - 1;
    Alert.alert(`Leave ${clan.name}?`,
      clan.role === 'leader' && others > 0 ? 'Your longest-serving clanmate will become the new leader.'
        : others === 0 ? 'You\'re the last member, so the clan will be disbanded.' : 'You can rejoin later with the invite code.',
      [{ text: 'Stay', style: 'cancel' }, { text: 'Leave', style: 'destructive', onPress: async () => { await supabase.rpc('leave_clan'); load(); } }]);
  }
  function kick(m: Member) {
    Alert.alert(`Remove ${m.traveller_name}?`, 'They can rejoin only with a new invite code.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        await supabase.rpc('kick_clan_member', { p_user_id: m.user_id });
        await supabase.rpc('reset_clan_code');
        load();
      } },
    ]);
  }
  async function copyCode() {
    if (!clan?.code) return;
    await Clipboard.setStringAsync(clan.code);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }
  function share() {
    if (!clan?.code) return;
    Share.share({ message: `Join my clan "${clan.name}" on mmGO! Open the app, go to Me → Clan, and enter the invite code ${clan.code}` }).catch(() => {});
  }

  if (clan === undefined) return <SafeAreaView style={styles.center}><ActivityIndicator color={colors.ink} /></SafeAreaView>;

  if (clan === null) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
      <BackHeader title="Clan" />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Body>Team up with friends, pool your XP and climb the clan leaderboards together. You can be in one clan at a time.</Body>
        <View style={[styles.card, hardShadow(4, 4)]}>
          <Label color={colors.gold}>Start a clan</Label>
          <PixelInput value={newName} onChangeText={(v) => { setNewName(v); setError(''); }} placeholder="Clan name, e.g. Thames Wanderers"
            maxLength={30} accessibilityLabel="Clan name" />
          <PixelButton label="Create clan" onPress={create} busy={busy === 'create'} disabled={newName.trim().length < 3 || busy !== null} />
        </View>
        <View style={[styles.card, hardShadow(4, 4)]}>
          <Label color={colors.gold}>Join with an invite code</Label>
          <PixelInput value={code} onChangeText={(v) => { setCode(v.toUpperCase()); setError(''); }} placeholder="6-character code"
            autoCapitalize="characters" autoCorrect={false} maxLength={8} accessibilityLabel="Invite code" style={{ letterSpacing: 4, textAlign: 'center' }} />
          <PixelButton label="Join clan" tone="ink" onPress={join} busy={busy === 'join'} disabled={code.replace(/[^A-Za-z0-9]/g, '').length !== 6 || busy !== null} />
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );

  const leader = clan.role === 'leader';
  const total = clan.members.reduce((s, m) => s + Number(m.total_xp), 0);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
      <BackHeader title="Clan" />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={[styles.banner, hardShadow(4, 4)]}>
          <Label color={colors.gold}>{leader ? 'You lead' : 'Your clan'}</Label>
          <Title style={{ color: colors.paper, textAlign: 'center' }}>{clan.name}</Title>
          <View style={styles.statsRow}>
            <View style={styles.stat}><Text style={styles.statNum}>{clan.members.length}</Text><Text style={styles.statLabel}>members</Text></View>
            <View style={styles.stat}><Text style={styles.statNum}>{Number(clan.week_xp).toLocaleString()}</Text><Text style={styles.statLabel}>XP this week</Text></View>
            <View style={styles.stat}><Text style={styles.statNum}>{rank ? `#${rank}` : '–'}</Text><Text style={styles.statLabel}>world rank</Text></View>
          </View>
        </View>

        {clan.code ? (
          <View style={[styles.codeCard, hardShadow(3, 3)]}>
            <View style={{ flex: 1 }}>
              <Label>Invite code</Label>
              <Text style={styles.code} selectable>{clan.code}</Text>
            </View>
            <Pressable onPress={copyCode} style={styles.codeBtn} accessibilityRole="button"><Text style={styles.codeBtnText}>{copied ? 'COPIED' : 'COPY'}</Text></Pressable>
            <Pressable onPress={share} style={[styles.codeBtn, { backgroundColor: colors.stamp }]} accessibilityRole="button"><Text style={[styles.codeBtnText, { color: colors.paper }]}>SHARE</Text></Pressable>
          </View>
        ) : null}

        <Label>Members · {Number(total).toLocaleString()} XP combined</Label>
        {clan.members.map((m, i) => (
          <Pressable key={m.user_id} onPress={m.user_id === profile?.id ? undefined : () => router.push(`/traveller/${m.user_id}`)}
            onLongPress={leader && m.user_id !== profile?.id ? () => kick(m) : undefined}
            style={[styles.row, hardShadow(3, 3), m.user_id === profile?.id ? { backgroundColor: '#FBEDE6' } : null]} accessibilityRole="button">
            <Text style={styles.pos}>{i + 1}</Text>
            <Avatar look={m.avatar} size={36} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{m.traveller_name}{m.user_id === profile?.id ? ' (you)' : ''}</Text>
              <Text style={[styles.role, m.role === 'leader' ? { color: colors.gold } : null]}>{m.role === 'leader' ? '♛ LEADER' : 'MEMBER'}</Text>
            </View>
            <Text style={styles.xp}>{Number(m.total_xp).toLocaleString()} XP</Text>
          </Pressable>
        ))}
        {leader && clan.members.length > 1 ? <Text style={styles.hint}>Press and hold a member to remove them. Their old invite code stops working.</Text> : null}
        <TextLink label="Leave clan" color={colors.muted} onPress={leave} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper },
  body: { paddingHorizontal: 24, paddingBottom: 40, gap: 16 },
  card: { backgroundColor: colors.ink, borderWidth: 3, borderColor: colors.gold, padding: 16, gap: 12 },
  error: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.stamp },
  banner: { backgroundColor: colors.ink, borderWidth: 3, borderColor: colors.gold, padding: 18, alignItems: 'center', gap: 8 },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 6, alignSelf: 'stretch' },
  stat: { flex: 1, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(246,240,226,0.25)', paddingVertical: 8 },
  statNum: { fontFamily: fonts.display, fontSize: 18, color: colors.gold },
  statLabel: { fontFamily: fonts.body, fontSize: 10, color: colors.silver },
  codeCard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.ink, padding: 12 },
  code: { fontFamily: fonts.display, fontSize: 26, letterSpacing: 4, color: colors.ink },
  codeBtn: { borderWidth: 2, borderColor: colors.ink, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: colors.card },
  codeBtnText: { fontFamily: fonts.labelBold, fontSize: 10, color: colors.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.ink, padding: 10 },
  pos: { fontFamily: fonts.display, fontSize: 14, color: colors.muted, width: 20, textAlign: 'center' },
  name: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
  role: { fontFamily: fonts.label, fontSize: 9, color: colors.muted },
  xp: { fontFamily: fonts.label, fontSize: 11, color: colors.bronze },
  hint: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, textAlign: 'center' },
});
