import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Body, Icon, PixelArt, TextLink, Title } from '@/components/ui';
import { Character } from '@/components/Character';
import { WorldFirsts } from '@/components/WorldFirsts';
import { FirstTip } from '@/components/FirstTip';
import { toAvatar } from '@/lib/avatar';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { colors, fonts, hardShadow } from '@/lib/theme';

type Row = { rank: number; entry_id: string; name: string; avatar: unknown; xp: number; is_me: boolean };
type Scope = { key: string; label: string; scope: 'city' | 'country' | 'continent' | 'world'; id: string | null };

// 10 Leaderboards: city, country, continent and world; solo, friends or clans; this week or all time.
export default function Ranks() {
  const { profile } = useSession();
  const [scopes, setScopes] = useState<Scope[]>([{ key: 'world', label: 'World', scope: 'world', id: null }]);
  const [scope, setScope] = useState('city');
  const [mode, setMode] = useState<'solo' | 'friends' | 'clans'>('solo');
  const [period, setPeriod] = useState<'week' | 'all'>('week');
  const [board, setBoard] = useState<'xp' | 'firsts'>('xp');
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    if (!profile?.home_city_id) return;
    supabase.from('cities').select('id, name, country_code, countries(name, continent_code, continents(name))').eq('id', profile.home_city_id).single()
      .then(({ data }) => {
        const c = data as any;
        if (!c) return;
        setScopes([
          { key: 'city', label: c.name, scope: 'city', id: String(c.id) },
          { key: 'country', label: c.countries?.name === 'United Kingdom' ? 'UK' : c.countries?.name ?? c.country_code, scope: 'country', id: c.country_code },
          { key: 'continent', label: c.countries?.continents?.name ?? 'Continent', scope: 'continent', id: c.countries?.continent_code ?? null },
          { key: 'world', label: 'World', scope: 'world', id: null },
        ]);
      });
  }, [profile?.home_city_id]);

  const current = scopes.find((s) => s.key === scope) ?? scopes[scopes.length - 1];
  const load = useCallback(async () => {
    setRows(null);
    const { data } = await supabase.rpc('leaderboard', { p_scope: current.scope, p_scope_id: current.id, p_period: period, p_mode: mode, p_limit: 50 });
    setRows((data ?? []) as Row[]);
  }, [current.scope, current.id, period, mode]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const medal = (r: number) => (r === 1 ? colors.gold : r === 2 ? colors.silver : r === 3 ? colors.bronze : null);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={['top']}>
      <ScrollView contentContainerStyle={styles.body}>
        <Title style={{ fontSize: 32 }}>Leaderboards</Title>
        <View style={styles.boards}>
          {([['xp', 'XP leagues'], ['firsts', 'World firsts']] as const).map(([k, label]) => (
            <Pressable key={k} onPress={() => setBoard(k)} accessibilityRole="tab" accessibilityState={{ selected: board === k }}
              style={[styles.board, board === k ? styles.boardOn : null]}>
              <Text style={[styles.boardText, board === k ? { color: colors.ink } : null]}>{k === 'firsts' ? '🏁 ' : ''}{label.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>
        <FirstTip id="ranks" title="Leaderboards" text="Climb the XP leagues in your city, or switch to World firsts and race to be the first to stamp a whole city, country or the world." />
        {board === 'firsts' ? <WorldFirsts /> : (<>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {scopes.map((s) => (
            <Pressable key={s.key} onPress={() => setScope(s.key)} accessibilityRole="tab" accessibilityState={{ selected: current.key === s.key }}
              style={[styles.chip, current.key === s.key ? styles.chipOn : null]}>
              <Text style={[styles.chipText, current.key === s.key ? { color: colors.paper } : null]}>{s.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.seg}>
          {(['solo', 'friends', 'clans'] as const).map((m) => (
            <Pressable key={m} onPress={() => setMode(m)} style={[styles.segItem, mode === m ? styles.segOn : null]} accessibilityRole="tab" accessibilityState={{ selected: mode === m }}>
              <Text style={[styles.segText, { color: mode === m ? colors.ink : colors.muted }]}>{m[0].toUpperCase() + m.slice(1)}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable onPress={() => setPeriod((p) => (p === 'week' ? 'all' : 'week'))} style={[styles.league, hardShadow(4, 4)]} accessibilityRole="button" accessibilityLabel="Switch between this week and all time">
          <View style={styles.trophy}><Icon name="trophy" color={colors.ink} size={22} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.leagueTitle}>{period === 'week' ? 'This week' : 'All time'}</Text>
            <Text style={styles.leagueMeta}>{period === 'week' ? 'Resets every Monday · tap for all time' : 'Every XP you\'ve earned · tap for this week'}</Text>
          </View>
        </Pressable>

        {rows === null ? <ActivityIndicator color={colors.ink} /> : rows.length === 0 ? (
          <View style={{ gap: 8 }}>
            <Body>{mode === 'friends' ? 'Add friends to compete with them here.' : mode === 'clans' ? 'No clans have earned XP here yet.' : 'Nobody has earned XP here yet. Collect a stamp to take first place!'}</Body>
            {mode === 'friends' ? <TextLink label="Add friends" color={colors.stamp} onPress={() => router.push('/friends')} /> : null}
            {mode === 'clans' ? <TextLink label="Start or join a clan" color={colors.stamp} onPress={() => router.push('/clan')} /> : null}
          </View>
        ) : (
          <View style={[styles.list, hardShadow(3, 3)]}>
            {rows.map((r, i) => {
              const m = medal(r.rank);
              const gap = i > 0 && r.rank > rows[i - 1].rank + 1;
              return (
                <View key={r.entry_id}>
                  {gap ? <Text style={styles.gap}>···</Text> : null}
                  <View style={[styles.row, i > 0 && !gap ? styles.rowLine : null, r.is_me ? { backgroundColor: '#FBEDE6' } : null]}>
                    <View style={[styles.rank, m ? { backgroundColor: m, borderWidth: 2, borderColor: colors.ink } : null]}><Text style={styles.rankText}>{r.rank}</Text></View>
                    <View style={styles.avatar}>
                      {r.avatar ? <Character avatar={toAvatar(r.avatar)} size={2} crop="portrait" /> : <Text style={styles.clanInitial}>{r.name[0]}</Text>}
                    </View>
                    <Text style={[styles.name, r.is_me ? { fontFamily: fonts.bodyBold } : null]} numberOfLines={1}>{r.is_me && mode !== 'clans' ? `${r.name} (you)` : r.name}</Text>
                    <Text style={[styles.xp, r.is_me ? { color: colors.stamp } : null]}>{Number(r.xp).toLocaleString()} XP</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
        </>)}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40, gap: 14 },
  boards: { flexDirection: 'row', borderWidth: 3, borderColor: colors.ink },
  board: { flex: 1, alignItems: 'center', paddingVertical: 10, backgroundColor: colors.ink },
  boardOn: { backgroundColor: colors.gold },
  boardText: { fontFamily: fonts.labelBold, fontSize: 11, color: colors.paper },
  chip: { borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.card, paddingHorizontal: 14, paddingVertical: 8 },
  chipOn: { backgroundColor: colors.ink },
  chipText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink },
  seg: { flexDirection: 'row', gap: 4, padding: 4, backgroundColor: '#ECE5D4' },
  segItem: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  segOn: { backgroundColor: colors.card, borderWidth: 2, borderColor: colors.ink },
  segText: { fontFamily: fonts.bodyBold, fontSize: 13 },
  league: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.ink, borderWidth: 3, borderColor: colors.gold, padding: 14 },
  trophy: { width: 40, height: 40, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  leagueTitle: { fontFamily: fonts.display, fontSize: 17, color: colors.paper },
  leagueMeta: { fontFamily: fonts.body, fontSize: 12, color: colors.silver },
  list: { backgroundColor: colors.card, borderWidth: 2, borderColor: colors.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 11 },
  rowLine: { borderTopWidth: 1, borderTopColor: colors.line },
  rank: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  rankText: { fontFamily: fonts.display, fontSize: 14, color: colors.ink },
  avatar: { width: 36, height: 36, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  clanInitial: { fontFamily: fonts.display, fontSize: 16, color: colors.paper },
  name: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 14, color: colors.ink },
  xp: { fontFamily: fonts.label, fontSize: 12, color: colors.muted },
  gap: { textAlign: 'center', fontFamily: fonts.bodyBold, color: colors.muted, paddingVertical: 2 },
});
