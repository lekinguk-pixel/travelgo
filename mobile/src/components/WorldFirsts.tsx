import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Character } from '@/components/Character';
import { Body, Label, SegmentBar, TextLink } from '@/components/ui';
import { toAvatar } from '@/lib/avatar';
import { supabase } from '@/lib/supabase';
import { colors, fonts, hardShadow } from '@/lib/theme';

type Who = { name: string; avatar?: unknown; at?: string; is_me: boolean | null };
type Board = {
  world: { total: number; mine: number; finishers: (Who & { place: number })[]; leaders: (Who & { n: number })[] };
  continents: { code: string; name: string; total: number; mine: number; first: Who | null }[];
  countries: { code: string; name: string; continent: string; total: number; mine: number; finishers: number; first: Who | null; leader: (Who & { n: number }) | null }[];
  recent_cities: (Who & { city_id: number; city: string; country: string; total: number })[];
  races: { city_id: number; city: string; country: string; total: number; n: number; pct: number; name: string; is_me: boolean | null }[];
  mine: { scope: string; ref: string; place: number; at: string; label: string }[];
};

const PLACE = ['', '1st', '2nd', '3rd'];
const placeColor = (p: number) => (p === 1 ? colors.gold : p === 2 ? colors.silver : p === 3 ? colors.bronze : colors.line);
const when = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const pct = (a: number, b: number) => (b ? Math.min(1, a / b) : 0);

/**
 * The race to be first: stamp every landmark in a city, a country, a continent or the whole world.
 * The first three to finish each one are on the board for good.
 */
export function WorldFirsts() {
  const [b, setB] = useState<Board | null>(null);
  const [allCountries, setAllCountries] = useState(false);
  useFocusEffect(useCallback(() => {
    supabase.rpc('world_firsts_board').then(({ data }) => setB((data as Board | null) ?? null));
  }, []));

  const countries = useMemo(() => {
    if (!b) return [];
    // Claimed first (newest first), then the closest races, then by name.
    return [...b.countries].sort((x, y) =>
      (y.first ? 1 : 0) - (x.first ? 1 : 0)
      || (x.first && y.first ? String(y.first.at).localeCompare(String(x.first.at)) : 0)
      || pct(y.leader?.n ?? 0, y.total) - pct(x.leader?.n ?? 0, x.total)
      || pct(y.mine, y.total) - pct(x.mine, x.total)
      || x.name.localeCompare(y.name));
  }, [b]);

  if (!b) return <ActivityIndicator color={colors.ink} />;
  const shown = allCountries ? countries : countries.slice(0, 8);

  return (
    <View style={{ gap: 16 }}>
      <Body>Be the first traveller to stamp every landmark in a city, a country, a continent, or the whole world. The first three to finish each one stay on this board for good.</Body>

      {b.mine.length ? (
        <View style={[styles.mine, hardShadow(3, 3)]}>
          <Label color={colors.gold}>Your world firsts</Label>
          <View style={styles.chips}>
            {b.mine.map((m) => (
              <View key={`${m.scope}-${m.ref}`} style={[styles.chip, { borderColor: placeColor(m.place) }]}>
                <Text style={styles.chipText}>{m.place <= 3 ? PLACE[m.place] : `#${m.place}`} · {m.label}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* The big one */}
      <View style={[styles.world, hardShadow(4, 4)]}>
        <Label color={colors.gold}>The whole world</Label>
        <Text style={styles.worldTitle}>{Number(b.world.total).toLocaleString()} landmarks</Text>
        {b.world.finishers.length ? (
          <View style={styles.podium}>
            {b.world.finishers.map((f) => <Finisher key={f.place} who={f} place={f.place} dark />)}
          </View>
        ) : <Text style={styles.unclaimed}>UNCLAIMED · nobody has finished the world yet</Text>}
        {b.world.leaders.map((l, i) => (
          <View key={l.name} style={styles.leader}>
            <Text style={styles.leaderRank}>{i + 1}</Text>
            <View style={styles.face}>{l.avatar ? <Character avatar={toAvatar(l.avatar)} size={2} crop="portrait" /> : null}</View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.leaderName} numberOfLines={1}>{l.name}{l.is_me ? ' (you)' : ''}</Text>
              <SegmentBar value={pct(l.n, b.world.total)} color={colors.gold} track="rgba(246,240,226,0.15)" height={6} />
            </View>
            <Text style={styles.leaderN}>{Number(l.n).toLocaleString()}</Text>
          </View>
        ))}
        <Text style={styles.worldMine}>You: {Number(b.world.mine).toLocaleString()} of {Number(b.world.total).toLocaleString()} ({(pct(b.world.mine, b.world.total) * 100).toFixed(1)}%)</Text>
      </View>

      <Label>Continents</Label>
      <View style={[styles.list, hardShadow(3, 3)]}>
        {b.continents.map((c, i) => (
          <Row key={c.code} first={i === 0} title={c.name} sub={`${c.total.toLocaleString()} landmarks · you ${c.mine}`}
            progress={pct(c.mine, c.total)} holder={c.first} />
        ))}
      </View>

      {b.races.length ? (
        <>
          <Label>Closest city races</Label>
          <View style={[styles.list, hardShadow(3, 3)]}>
            {b.races.map((r, i) => (
              <Pressable key={r.city_id} onPress={() => router.push(`/city/${r.city_id}`)} accessibilityRole="button"
                style={[styles.row, i > 0 ? styles.rowLine : null]}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{r.city} <Text style={styles.rowCountry}>{r.country}</Text></Text>
                  <SegmentBar value={r.pct} color={r.is_me ? colors.stamp : colors.teal} height={6} />
                  <Text style={styles.rowSub}>{r.is_me ? 'You lead' : `${r.name} leads`} · {r.n}/{r.total} landmarks</Text>
                </View>
                <Text style={styles.open}>OPEN</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      {b.recent_cities.length ? (
        <>
          <Label>Latest city world firsts</Label>
          <View style={[styles.list, hardShadow(3, 3)]}>
            {b.recent_cities.map((c, i) => (
              <Row key={c.city_id} first={i === 0} title={c.city} sub={`${c.country} · ${c.total} landmarks`} holder={c} onPress={() => router.push(`/city/${c.city_id}`)} />
            ))}
          </View>
        </>
      ) : null}

      <Label>Countries</Label>
      <View style={[styles.list, hardShadow(3, 3)]}>
        {shown.map((c, i) => (
          <Row key={c.code} first={i === 0} title={c.name}
            sub={c.first ? `${c.total} landmarks · ${c.finishers} finished` : c.leader ? `${c.leader.is_me ? 'You lead' : `${c.leader.name} leads`} · ${c.leader.n}/${c.total}` : `${c.total} landmarks · nobody's started`}
            progress={pct(c.mine, c.total)} holder={c.first} />
        ))}
      </View>
      {countries.length > 8 ? <TextLink label={allCountries ? 'Show fewer countries' : `Show all ${countries.length} countries`} color={colors.stamp} onPress={() => setAllCountries((v) => !v)} /> : null}
    </View>
  );
}

function Finisher({ who, place, dark }: { who: Who; place: number; dark?: boolean }) {
  return (
    <View style={[styles.finisher, { borderColor: placeColor(place) }]}>
      <Text style={[styles.place, { color: placeColor(place) }]}>{PLACE[place]}</Text>
      <View style={styles.face}>{who.avatar ? <Character avatar={toAvatar(who.avatar)} size={2} crop="portrait" /> : null}</View>
      <Text style={[styles.finName, dark ? { color: colors.paper } : null]} numberOfLines={1}>{who.name}{who.is_me ? ' (you)' : ''}</Text>
      <Text style={styles.finDate}>{when(who.at)}</Text>
    </View>
  );
}

function Row({ title, sub, progress, holder, first, onPress }: { title: string; sub: string; progress?: number; holder: Who | null; first: boolean; onPress?: () => void }) {
  const body = (
    <View style={[styles.row, !first ? styles.rowLine : null]}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>{title}</Text>
        <Text style={styles.rowSub} numberOfLines={1}>{sub}</Text>
        {progress !== undefined && !holder ? <SegmentBar value={progress} color={colors.stamp} height={5} /> : null}
      </View>
      {holder ? (
        <View style={styles.holder}>
          <View style={styles.faceSmall}>{holder.avatar ? <Character avatar={toAvatar(holder.avatar)} size={2} crop="portrait" /> : null}</View>
          <View style={{ maxWidth: 110 }}>
            <Text style={styles.holderTag}>WORLD FIRST</Text>
            <Text style={styles.holderName} numberOfLines={1}>{holder.name}{holder.is_me ? ' (you)' : ''}</Text>
          </View>
        </View>
      ) : <Text style={styles.unclaimedSmall}>UNCLAIMED</Text>}
    </View>
  );
  return onPress ? <Pressable onPress={onPress} accessibilityRole="button">{body}</Pressable> : body;
}

const styles = StyleSheet.create({
  mine: { backgroundColor: colors.ink, borderWidth: 3, borderColor: colors.gold, padding: 12, gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 2, paddingHorizontal: 8, paddingVertical: 4 },
  chipText: { fontFamily: fonts.labelBold, fontSize: 10.5, color: colors.paper },
  world: { backgroundColor: colors.night, borderWidth: 3, borderColor: colors.gold, padding: 14, gap: 10 },
  worldTitle: { fontFamily: fonts.display, fontSize: 26, color: colors.paper },
  worldMine: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.silver },
  podium: { flexDirection: 'row', gap: 8 },
  finisher: { flex: 1, alignItems: 'center', gap: 4, borderWidth: 2, padding: 8 },
  place: { fontFamily: fonts.labelBold, fontSize: 13 },
  finName: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: colors.ink },
  finDate: { fontFamily: fonts.body, fontSize: 11, color: colors.silver },
  unclaimed: { fontFamily: fonts.labelBold, fontSize: 11, color: colors.gold },
  leader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  leaderRank: { fontFamily: fonts.display, fontSize: 14, color: colors.gold, width: 16 },
  leaderName: { fontFamily: fonts.bodySemi, fontSize: 13.5, color: colors.paper },
  leaderN: { fontFamily: fonts.label, fontSize: 12, color: colors.paper },
  face: { width: 34, height: 34, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  faceSmall: { width: 28, height: 28, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  list: { backgroundColor: colors.card, borderWidth: 2, borderColor: colors.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11 },
  rowLine: { borderTopWidth: 1, borderTopColor: colors.line },
  rowTitle: { fontFamily: fonts.bodyBold, fontSize: 14.5, color: colors.ink },
  rowCountry: { fontFamily: fonts.body, fontSize: 12.5, color: colors.muted },
  rowSub: { fontFamily: fonts.body, fontSize: 12.5, color: colors.muted },
  holder: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  holderTag: { fontFamily: fonts.labelBold, fontSize: 9, color: colors.gold },
  holderName: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: colors.ink },
  unclaimedSmall: { fontFamily: fonts.labelBold, fontSize: 9.5, color: colors.muted },
  open: { fontFamily: fonts.labelBold, fontSize: 10, color: colors.stamp },
});
