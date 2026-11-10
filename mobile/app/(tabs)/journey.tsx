import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Character } from '@/components/Character';
import { Fireworks } from '@/components/Fireworks';
import { JourneyScene, PixelCoin } from '@/components/JourneyScene';
import { Label, PixelButton, SegmentBar, TextLink } from '@/components/ui';
import type { WardrobeItem } from '@/components/AvatarEditor';
import { toAvatar } from '@/lib/avatar';
import { formatEta, journeyRpc, MODE_LABEL, type Arrival, type JourneyState } from '@/lib/journey';
import { wikiImage } from '@/lib/media';
import { useSession } from '@/lib/session';
import { friendlyError, supabase } from '@/lib/supabase';
import { colors, fonts, hardShadow, rarityColor } from '@/lib/theme';

type Postcard = { city_id: number; name: string; country: string; photo: string | null; visits: number };

// The digital journey: your traveller roams between mmGO's cities in real time,
// even with the app closed. Tapping speeds them up. Real stamps make them faster.
export default function Journey() {
  const { profile } = useSession();
  const { width } = useWindowDimensions();
  const [j, setJ] = useState<JourneyState | null>(null);
  const [syncedAt, setSyncedAt] = useState(Date.now());
  const [, setTick] = useState(0);
  const [arrival, setArrival] = useState<Arrival | null>(null);
  const [postcards, setPostcards] = useState<Postcard[]>([]);
  const [shop, setShop] = useState<WardrobeItem[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const pending = useRef(0);
  const inflight = useRef(0);
  const bump = useRef(new Animated.Value(1)).current;
  const syncing = useRef(false);

  const apply = useCallback((s: JourneyState) => {
    setJ(s); setSyncedAt(Date.now());
    if (s.arrival) { setArrival(s.arrival); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); loadExtras(); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sync = useCallback(async () => {
    if (syncing.current) return;
    syncing.current = true;
    const taps = pending.current; pending.current = 0; inflight.current = taps;
    try { const s = await journeyRpc('journey_sync', { p_taps: taps }); inflight.current = 0; apply(s); setError(''); }
    catch (e) { inflight.current = 0; pending.current += taps; setError(friendlyError(e)); }
    finally { syncing.current = false; }
  }, [apply]);

  function loadExtras() {
    supabase.rpc('my_postcards').then(({ data }) => setPostcards((data ?? []) as Postcard[]));
    supabase.rpc('my_wardrobe').then(({ data }) => setShop(((data ?? []) as WardrobeItem[]).filter((i) => i.source === 'journey')));
  }

  useFocusEffect(useCallback(() => {
    sync(); loadExtras();
    const every = setInterval(() => { if (pending.current > 0) sync(); }, 4000);
    const slow = setInterval(() => sync(), 30000);
    const tick = setInterval(() => setTick((n) => n + 1), 1000);
    return () => { clearInterval(every); clearInterval(slow); clearInterval(tick); if (pending.current > 0) sync(); };
  }, [sync])); // eslint-disable-line react-hooks/exhaustive-deps

  // Progress shown between syncs, worked out locally from the server's pace.
  const travelling = !!j?.to;
  const hours = (Date.now() - syncedAt) / 3_600_000;
  const progress = j && travelling ? Math.min(j.route_km, j.progress_km + j.kmh * hours + pending.current * j.tap_km) : 0;
  const left = j && travelling ? Math.max(0, j.route_km - progress) : 0;
  const eta = j && travelling ? (left / Math.max(0.1, j.kmh)) * 60 : null;
  useEffect(() => { if (j && travelling && left <= 0) sync(); }, [left <= 0]); // eslint-disable-line react-hooks/exhaustive-deps

  // Coins drop on every 5th tap and a 10-coin jackpot on every 50th, counted over lifetime taps (matches the server).
  const tapCoins = (n: number) => Math.floor(n / 5) + 10 * Math.floor(n / 50);
  function onTap() {
    pending.current += 1;
    setTick((n) => n + 1);
    const total = (j?.taps ?? 0) + inflight.current + pending.current;
    const drop = total % 50 === 0 ? 11 : total % 5 === 0 ? 1 : 0;
    if (drop) {
      Haptics.impactAsync(drop > 1 ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      bump.setValue(drop > 1 ? 1.5 : 1.25);
      Animated.spring(bump, { toValue: 1, friction: 4, useNativeDriver: true }).start();
    } else Haptics.selectionAsync().catch(() => {});
    return drop;
  }

  async function act(key: string, fn: () => Promise<JourneyState>) {
    setBusy(key); setError('');
    try { apply(await fn()); loadExtras(); } catch (e) { setError(friendlyError(e)); } finally { setBusy(null); }
  }

  if (!j) return <SafeAreaView style={styles.center}>{error ? <Text style={styles.errorText}>{error}</Text> : <ActivityIndicator color={colors.ink} />}</SafeAreaView>;

  const avatar = toAvatar(profile?.avatar);
  const b = j.boost;
  const dest = j.to;
  const unsynced = inflight.current + pending.current;
  const coinsFmt = (Number(j.coins) + tapCoins(j.taps + unsynced) - tapCoins(j.taps)).toLocaleString();
  const tapLabel = j.mode === 'parked' ? 'Exploring…' : `+${j.tap_km < 0.1 ? Math.round(j.tap_km * 1000) + ' m' : j.tap_km.toFixed(2) + ' km'}`;
  const toNextCoin = 5 - ((j.taps + unsynced) % 5);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Label color={colors.stamp}>Digital journey</Label>
            <Text style={styles.title} numberOfLines={1}>{dest ? `To ${dest.name}` : `In ${j.city.name}`}</Text>
          </View>
          <Animated.View style={[styles.coins, hardShadow(3, 3), { transform: [{ scale: bump }] }]}><PixelCoin size={18} /><Text style={styles.coinText}>{coinsFmt}</Text></Animated.View>
        </View>

        <View style={styles.sceneWrap}>
          <JourneyScene width={width} mode={j.mode} avatar={avatar} tapLabel={tapLabel} onTap={onTap} />
          <View style={styles.modeTag}><Text style={styles.modeText}>{MODE_LABEL[j.mode].toUpperCase()}{j.mode !== 'parked' ? ` · ${Math.round(j.kmh)} KM/H` : ''}</Text></View>
          <Text style={styles.tapHint}>TAP TO {j.mode === 'parked' ? 'EXPLORE' : 'GO FASTER'} · COIN IN {toNextCoin}</Text>
        </View>

        <View style={styles.body}>
          {dest ? (
            <View style={[styles.route, hardShadow(4, 4)]}>
              <View style={styles.routeTop}>
                <Image source={wikiImage(dest.photo) ?? undefined} style={styles.routePhoto} contentFit="cover" />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.routeFrom}>{j.city.name} → {dest.name}</Text>
                  <Text style={styles.routeBig}>{left < 10 ? left.toFixed(1) : Math.round(left).toLocaleString()} km to go</Text>
                  <Text style={styles.routeSub}>Arrives in about {formatEta(eta)} · keeps going while you're away (up to 8h)</Text>
                </View>
              </View>
              <SegmentBar value={j.route_km ? progress / j.route_km : 0} color={colors.gold} track="rgba(246,240,226,0.15)" />
              <TextLink label="Change destination" color={colors.silver} onPress={() => router.push('/journey-destinations')} />
            </View>
          ) : (
            <View style={[styles.route, hardShadow(4, 4)]}>
              <Text style={styles.routeBig}>Sightseeing in {j.city.name}</Text>
              <Text style={styles.routeSub}>Earning 30 coins an hour while you rest here. Pick where your traveller heads next.</Text>
              <PixelButton label="Choose a destination" onPress={() => router.push('/journey-destinations')} />
            </View>
          )}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={[styles.boost, hardShadow(4, 4)]}>
            <View style={styles.boostTop}>
              <Text style={styles.boostBig}>×{Number(b.multiplier).toFixed(2)}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.boostTitle}>Real-world boost</Text>
                <Text style={styles.boostSub}>Every real stamp and city medal makes your traveller faster.</Text>
              </View>
            </View>
            <Unlock done={b.bike} title="Bicycle" detail={`Stamp 5 real landmarks (${Math.min(b.stamps, 5)}/5)`} />
            <Unlock done={b.train} title="Train pass" detail="Earn a bronze medal in any real city" />
            <Unlock done={b.pilot} title="Pilot's licence · flights twice as fast" detail={`Stamp landmarks in 2 real countries (${Math.min(b.countries, 2)}/2)`} />
            <TextLink label="Find a landmark to stamp" color={colors.gold} onPress={() => router.push('/(tabs)')} />
          </View>

          <Label>Upgrades</Label>
          <View style={styles.upRow}>
            <Upgrade title="Boots" level={j.boots} effect="+50% distance per tap" cost={j.boots_cost} coins={j.coins} busy={busy === 'boots'}
              onBuy={() => act('boots', () => journeyRpc('journey_upgrade', { p_kind: 'boots' }))} />
            <Upgrade title="Companion" level={j.companion} effect="+20% speed while away" cost={j.companion_cost} coins={j.coins} busy={busy === 'companion'}
              onBuy={() => act('companion', () => journeyRpc('journey_upgrade', { p_kind: 'companion' }))} />
          </View>

          <View style={styles.rowBetween}>
            <Label>Postcards · {j.postcards}</Label>
            <Text style={styles.small}>{Number(j.total_km).toLocaleString()} km travelled</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 24 }}>
            {postcards.map((p) => (
              <Pressable key={p.city_id} onPress={() => router.push(`/city/${p.city_id}`)} accessibilityRole="button" accessibilityLabel={`Postcard from ${p.name}`}
                style={[styles.postcard, hardShadow(3, 3)]}>
                <Image source={wikiImage(p.photo) ?? undefined} style={styles.postPhoto} contentFit="cover" />
                <Text style={styles.postName} numberOfLines={1}>{p.name}</Text>
                <Text style={styles.postSub} numberOfLines={1}>{p.country}{p.visits > 1 ? ` · ×${p.visits}` : ''}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Label>Journey shop</Label>
          <View style={styles.shop}>
            {shop.map((it) => (
              <View key={it.key} style={[styles.item, { borderColor: rarityColor(it.rarity) }]}>
                <Character avatar={{ ...avatar, [it.slot]: it.key }} size={3} noPet crop={it.slot === 'hat' ? 'portrait' : undefined} />
                <Text style={styles.itemName} numberOfLines={2}>{it.name}</Text>
                {it.owned ? <TextLink label="Wear it" color={colors.teal} onPress={() => router.push('/wardrobe')} />
                  : <PixelButton label={`${it.price_coins}`} tone="ink" busy={busy === it.key} disabled={j.coins < (it.price_coins ?? 0)}
                      onPress={() => act(it.key, () => journeyRpc('journey_buy_item', { p_key: it.key }))} />}
              </View>
            ))}
          </View>
          <Text style={styles.small}>The digital journey earns coins, postcards and shop outfits only. XP and leaderboards are for real stamps, and landmark outfits can only be won by visiting for real.</Text>
        </View>
      </ScrollView>

      <Modal visible={!!arrival} transparent animationType="fade" onRequestClose={() => setArrival(null)}>
        <View style={styles.modalBack}>
          <View style={[styles.modal, hardShadow(6, 6)]}>
            <Text style={styles.modalKicker}>{arrival?.first_visit ? 'NEW POSTCARD' : 'WELCOME BACK'}</Text>
            <Image source={wikiImage(arrival?.photo) ?? undefined} style={styles.modalPhoto} contentFit="cover" />
            <Text style={styles.modalTitle}>{arrival?.name}</Text>
            <Text style={styles.modalSub}>{arrival?.country} · {arrival ? Math.round(arrival.km).toLocaleString() : 0} km journey</Text>
            <Text style={styles.modalCoins}>+{arrival?.coins} coins</Text>
            {arrival?.items?.length ? (
              <View style={styles.wonRow}>
                {arrival.items.map((it) => (
                  <View key={it.key} style={[styles.wonItem, { borderColor: rarityColor(it.rarity) }]}>
                    <Character avatar={{ ...avatar, [it.slot]: it.key }} size={3} noPet crop={it.slot === 'hat' ? 'portrait' : undefined} />
                    <Text style={styles.wonName} numberOfLines={2}>{it.name}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            {arrival?.items?.length ? <Text style={styles.wonNote}>Unlocked! Find {arrival.items.length > 1 ? 'them' : 'it'} in your Wardrobe.</Text> : null}
            <PixelButton label="Choose next destination" onPress={() => { setArrival(null); router.push('/journey-destinations'); }} />
            <TextLink label={`Visit ${arrival?.name} for real`} color={colors.gold} onPress={() => { const id = arrival?.city_id; setArrival(null); if (id) router.push(`/city/${id}`); }} />
          </View>
          {arrival ? <Fireworks size="small" onDone={() => {}} /> : null}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Unlock({ done, title, detail }: { done: boolean; title: string; detail: string }) {
  return (
    <View style={styles.unlock}>
      <View style={[styles.check, done ? { backgroundColor: colors.gold } : null]}><Text style={styles.checkText}>{done ? '✓' : ''}</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.unlockTitle, done ? { color: colors.gold } : null]}>{title}</Text>
        {!done ? <Text style={styles.unlockDetail}>{detail}</Text> : null}
      </View>
    </View>
  );
}

function Upgrade({ title, level, effect, cost, coins, busy, onBuy }: { title: string; level: number; effect: string; cost: number | null; coins: number; busy: boolean; onBuy: () => void }) {
  return (
    <View style={[styles.up, hardShadow(3, 3)]}>
      <Text style={styles.upTitle}>{title}</Text>
      <Text style={styles.upLevel}>Level {level}{level >= 10 ? ' · MAX' : ''}</Text>
      <Text style={styles.upEffect}>{effect}</Text>
      {cost ? <PixelButton label={`${cost} coins`} tone="ink" disabled={coins < cost} busy={busy} onPress={onBuy} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper, padding: 24 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 10 },
  title: { fontFamily: fonts.display, fontSize: 26, color: colors.ink },
  coins: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.ink, borderWidth: 2, borderColor: colors.gold, paddingHorizontal: 10, paddingVertical: 6 },
  coinDot: { width: 12, height: 12, backgroundColor: colors.gold, borderWidth: 2, borderColor: '#B8862E' },
  coinText: { fontFamily: fonts.labelBold, fontSize: 13, color: colors.gold },
  sceneWrap: { borderTopWidth: 3, borderBottomWidth: 3, borderColor: colors.ink },
  modeTag: { position: 'absolute', left: 10, top: 10, backgroundColor: 'rgba(27,42,65,0.85)', paddingHorizontal: 8, paddingVertical: 4 },
  modeText: { fontFamily: fonts.labelBold, fontSize: 10, color: colors.paper },
  tapHint: { position: 'absolute', right: 10, top: 12, fontFamily: fonts.labelBold, fontSize: 10, color: colors.paper, textShadowColor: colors.ink, textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 0 },
  body: { paddingHorizontal: 20, paddingTop: 16, gap: 14 },
  route: { backgroundColor: colors.ink, borderWidth: 3, borderColor: colors.gold, padding: 14, gap: 10 },
  routeTop: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  routePhoto: { width: 64, height: 64, borderWidth: 2, borderColor: colors.gold, backgroundColor: '#24365A' },
  routeFrom: { fontFamily: fonts.label, fontSize: 10, color: colors.silver },
  routeBig: { fontFamily: fonts.display, fontSize: 22, color: colors.paper },
  routeSub: { fontFamily: fonts.body, fontSize: 12.5, color: colors.silver, lineHeight: 18 },
  errorText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.paper, backgroundColor: colors.stamp, padding: 10 },
  boost: { backgroundColor: colors.card, borderWidth: 3, borderColor: colors.ink, padding: 14, gap: 10 },
  boostTop: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  boostBig: { fontFamily: fonts.display, fontSize: 30, color: colors.stamp },
  boostTitle: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
  boostSub: { fontFamily: fonts.body, fontSize: 12.5, color: colors.muted },
  unlock: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  check: { width: 20, height: 20, borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.ink },
  unlockTitle: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
  unlockDetail: { fontFamily: fonts.body, fontSize: 12.5, color: colors.muted },
  upRow: { flexDirection: 'row', gap: 10 },
  up: { flex: 1, backgroundColor: colors.card, borderWidth: 3, borderColor: colors.ink, padding: 12, gap: 4 },
  upTitle: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
  upLevel: { fontFamily: fonts.labelBold, fontSize: 10, color: colors.stamp },
  upEffect: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, marginBottom: 6 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  small: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, lineHeight: 17 },
  postcard: { width: 128, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.ink, padding: 6, gap: 2 },
  postPhoto: { width: '100%', height: 80, backgroundColor: '#D7E9E5' },
  postName: { fontFamily: fonts.display, fontSize: 15, color: colors.ink },
  postSub: { fontFamily: fonts.body, fontSize: 11, color: colors.muted },
  shop: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  item: { width: '31%', flexGrow: 1, alignItems: 'center', gap: 6, backgroundColor: colors.card, borderWidth: 3, padding: 8 },
  itemName: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.ink, textAlign: 'center' },
  modalBack: { flex: 1, backgroundColor: 'rgba(20,22,51,0.8)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modal: { width: '100%', backgroundColor: colors.ink, borderWidth: 3, borderColor: colors.gold, padding: 18, gap: 10, alignItems: 'center' },
  modalKicker: { fontFamily: fonts.labelBold, fontSize: 12, color: colors.gold, letterSpacing: 1 },
  modalPhoto: { width: '100%', height: 180, borderWidth: 3, borderColor: colors.paper, backgroundColor: '#24365A' },
  modalTitle: { fontFamily: fonts.display, fontSize: 30, color: colors.paper },
  modalSub: { fontFamily: fonts.body, fontSize: 13, color: colors.silver },
  wonRow: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  wonItem: { width: 96, alignItems: 'center', gap: 4, padding: 6, borderWidth: 2, backgroundColor: '#FFF8E6' },
  wonName: { fontFamily: fonts.bodyBold, fontSize: 11.5, color: colors.ink, textAlign: 'center' },
  wonNote: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.paper, textAlign: 'center' },
  modalCoins: { fontFamily: fonts.display, fontSize: 22, color: colors.gold },
});
