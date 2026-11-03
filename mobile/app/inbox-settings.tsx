import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackHeader } from '@/components/social';
import { Body, Label } from '@/components/ui';
import { friendlyError, supabase } from '@/lib/supabase';
import { colors, fonts, hardShadow } from '@/lib/theme';

type Settings = { eligible: boolean; travel_ideas: boolean; frequency: 'weekly' | 'monthly' };

// Inbox settings: the opt-in for travel ideas and partner offers (18+ only).
export default function InboxSettings() {
  const [s, setS] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useFocusEffect(useCallback(() => {
    supabase.rpc('inbox_settings').then(({ data }) => setS(data as Settings));
  }, []));

  async function save(on: boolean, frequency?: Settings['frequency']) {
    setBusy(true); setError('');
    const { data, error: e } = await supabase.rpc('set_travel_ideas', { p_on: on, p_frequency: frequency ?? null });
    setBusy(false);
    if (e) { setError(friendlyError(e)); return; }
    setS(data as Settings);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
      <BackHeader title="Inbox settings" />
      <ScrollView contentContainerStyle={styles.body}>
        {!s ? <ActivityIndicator color={colors.ink} /> : !s.eligible ? (
          <View style={[styles.card, hardShadow(3, 3)]}>
            <Text style={styles.title}>Travel ideas</Text>
            <Body>Travel ideas and partner offers are only for players aged 18 and over. You'll still get friend and journey news in your inbox.</Body>
          </View>
        ) : (
          <>
            <View style={[styles.card, hardShadow(3, 3)]}>
              <View style={styles.row}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.title}>Travel ideas & partner offers</Text>
                  <Text style={styles.sub}>{s.travel_ideas ? 'On' : 'Off'}</Text>
                </View>
                <Switch value={s.travel_ideas} disabled={busy} onValueChange={(v) => save(v)}
                  trackColor={{ true: colors.teal, false: colors.line }} thumbColor={colors.card}
                  accessibilityLabel="Travel ideas and partner offers" />
              </View>
              <Body style={styles.small}>
                A suggestion for your next chapter, with links to partners such as hotels, attraction tickets, trains and flights. mmGO may earn a commission when you book; your price stays the same.
              </Body>
            </View>

            {s.travel_ideas ? (
              <View style={{ gap: 8 }}>
                <Label>How often</Label>
                <View style={styles.seg}>
                  {(['weekly', 'monthly'] as const).map((f) => (
                    <Pressable key={f} onPress={() => save(true, f)} disabled={busy}
                      accessibilityRole="radio" accessibilityState={{ selected: s.frequency === f }}
                      style={[styles.segBtn, s.frequency === f ? styles.segOn : null]}>
                      <Text style={[styles.segText, { color: s.frequency === f ? colors.paper : colors.ink }]}>
                        {f === 'weekly' ? 'Up to once a week' : 'Up to once a month'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            <View style={{ gap: 6 }}>
              <Label>Your privacy</Label>
              <Body style={styles.small}>Ideas are chosen from your home city, your stamps and your friends' recent cities. Never your live location.</Body>
              <Body style={styles.small}>Partners see which suggestion a click came from, never who you are.</Body>
              <Body style={styles.small}>Switching off hides travel ideas straight away.</Body>
            </View>
          </>
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 24, paddingBottom: 40, gap: 18 },
  card: { backgroundColor: colors.card, borderWidth: 3, borderColor: colors.ink, padding: 16, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
  sub: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.muted },
  small: { fontSize: 13 },
  seg: { flexDirection: 'row', gap: 8 },
  segBtn: { flex: 1, borderWidth: 2, borderColor: colors.ink, paddingVertical: 12, alignItems: 'center', backgroundColor: colors.card },
  segOn: { backgroundColor: colors.ink },
  segText: { fontFamily: fonts.bodyBold, fontSize: 13 },
  error: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.paper, backgroundColor: colors.stamp, padding: 10 },
});
