import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { friendlyError, supabase } from '@/lib/supabase';
import { colors, fonts, hardShadow } from '@/lib/theme';

type Link = { key: string; label: string; partner: string; promo_code: string | null; promo_text: string | null };
type Deals = { eligible: boolean; from_city?: string | null; links: Link[] };
export type DealSource = 'city' | 'landmark' | 'spin' | 'journey' | 'stamp';

// A little pixel glyph per partner type so the buttons read at a glance.
const GLYPH: Record<string, string> = { stays: '⌂', flights: '✈', trains: '▤', tickets: '★' };

/**
 * "Plan the trip" card: stays, flights, trains and tickets for a city, built for the player's
 * own route from home. Shown to players aged 18+ only; clearly marked as partner links.
 */
export function DealsCard({ cityId, cityName, source, compact }: { cityId: number; cityName: string; source: DealSource; compact?: boolean }) {
  const [deals, setDeals] = useState<Deals | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    setDeals(null);
    supabase.rpc('city_deals', { p_city_id: cityId }).then(({ data }) => { if (live) setDeals((data as Deals | null) ?? null); });
    return () => { live = false; };
  }, [cityId]);

  if (!deals?.eligible || deals.links.length === 0) return null;

  async function open(link: Link) {
    setOpening(link.key); setError('');
    const { data, error: e } = await supabase.rpc('deal_click', { p_city_id: cityId, p_partner: link.key, p_source: source });
    setOpening(null);
    if (e || typeof data !== 'string') { setError(friendlyError(e)); return; }
    Linking.openURL(data).catch(() => setError('Couldn\'t open that link.'));
  }

  const promos = deals.links.filter((l) => l.promo_text);
  return (
    <View style={[styles.card, hardShadow(4, 4)]} accessibilityLabel={`Plan a trip to ${cityName}. Partner links.`}>
      <View style={styles.top}>
        <Text style={styles.kicker}>PLAN THE TRIP</Text>
        <Text style={styles.tag}>PARTNER LINKS</Text>
      </View>
      {!compact ? (
        <Text style={styles.title}>{deals.from_city ? `${deals.from_city} → ${cityName}` : `Get to ${cityName}`}</Text>
      ) : null}
      <View style={styles.grid}>
        {deals.links.map((l) => (
          <Pressable key={l.key} onPress={() => open(l)} disabled={!!opening}
            accessibilityRole="link" accessibilityLabel={`${l.label} with ${l.partner}`}
            style={({ pressed }) => [styles.btn, pressed ? { transform: [{ translateY: 2 }] } : hardShadow(0, 3)]}>
            {opening === l.key ? <ActivityIndicator color={colors.ink} size="small" /> : (
              <>
                <Text style={styles.glyph}>{GLYPH[l.key] ?? '→'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label} numberOfLines={1}>{l.label.toUpperCase()}</Text>
                  <Text style={styles.partner} numberOfLines={1}>{l.partner}</Text>
                </View>
              </>
            )}
          </Pressable>
        ))}
      </View>
      {promos.map((l) => <Text key={l.key} style={styles.promo}>{l.promo_text}{l.promo_code ? ` · code ${l.promo_code}` : ''}</Text>)}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Text style={styles.disclose}>mmGO may earn a commission if you book. Your price stays the same.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.ink, borderWidth: 3, borderColor: colors.gold, padding: 14, gap: 10 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kicker: { fontFamily: fonts.labelBold, fontSize: 12, color: colors.gold, letterSpacing: 0.6 },
  tag: { fontFamily: fonts.label, fontSize: 9, color: colors.ink, backgroundColor: colors.silver, paddingHorizontal: 6, paddingVertical: 2 },
  title: { fontFamily: fonts.display, fontSize: 20, color: colors.paper },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  btn: { flexBasis: '47%', flexGrow: 1, minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.paper, borderWidth: 2, borderColor: colors.gold, paddingVertical: 8, paddingHorizontal: 10 },
  glyph: { fontFamily: fonts.bodyBold, fontSize: 20, color: colors.stamp, width: 22, textAlign: 'center' },
  label: { fontFamily: fonts.labelBold, fontSize: 11, color: colors.ink },
  partner: { fontFamily: fonts.body, fontSize: 11.5, color: colors.muted },
  promo: { fontFamily: fonts.bodySemi, fontSize: 12.5, color: colors.gold },
  error: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: colors.paper, backgroundColor: colors.stamp, padding: 8 },
  disclose: { fontFamily: fonts.body, fontSize: 11, color: colors.silver },
});
