import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackHeader } from '@/components/social';
import { Body, Label, PixelButton, PixelInput } from '@/components/ui';
import { friendlyError, supabase } from '@/lib/supabase';
import { colors, fonts, hardShadow } from '@/lib/theme';

type Referral = { code: string; invited: number; can_redeem: boolean };

// Invite friends with your code; new players can enter a friend's code in their first 14 days.
export default function Invite() {
  const [r, setR] = useState<Referral | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const { data, error: e } = await supabase.rpc('my_referral');
    if (e) setError(friendlyError(e)); else setR(data as Referral);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function redeem() {
    setBusy(true); setError(''); setMsg('');
    const { data, error: e } = await supabase.rpc('redeem_referral', { p_code: code });
    setBusy(false);
    if (e) { setError(friendlyError(e)); return; }
    setMsg(`You're now friends with ${data as string}.`);
    setCode('');
    load();
  }

  const shareText = r ? `Join me on mmGO and collect stamps at real landmarks. Use my invite code ${r.code} when you start your adventure.` : '';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
      <BackHeader title="Invite friends" />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {!r ? (error ? <Body>{error}</Body> : <ActivityIndicator color={colors.ink} />) : (
          <>
            <View style={[styles.banner, hardShadow(4, 4)]}>
              <Label color={colors.gold}>Your invite code</Label>
              <Text style={styles.code} selectable>{r.code}</Text>
              <Text style={styles.sub}>{r.invited === 0 ? 'No one has joined with it yet.' : `${r.invited} traveller${r.invited === 1 ? '' : 's'} joined with your code.`}</Text>
              <View style={styles.row}>
                <PixelButton label={copied ? 'Copied' : 'Copy'} tone="ink" style={{ flex: 1 }}
                  onPress={async () => { await Clipboard.setStringAsync(r.code); setCopied(true); setTimeout(() => setCopied(false), 1500); }} />
                <PixelButton label="Share" style={{ flex: 1 }} onPress={() => Share.share({ message: shareText }).catch(() => {})} />
              </View>
            </View>
            <Body>When a friend joins with your code, you become friends straight away and can follow each other's journeys.</Body>

            {r.can_redeem ? (
              <View style={{ gap: 10 }}>
                <Label>Got a friend's code?</Label>
                <PixelInput value={code} onChangeText={(t) => setCode(t.toUpperCase())} placeholder="ABC123"
                  autoCapitalize="characters" autoCorrect={false} maxLength={6} />
                <PixelButton label="Use code" onPress={redeem} busy={busy} disabled={code.trim().length !== 6} />
              </View>
            ) : null}
            {msg ? <Text style={styles.ok}>{msg}</Text> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 24, paddingBottom: 40, gap: 16 },
  banner: { backgroundColor: colors.ink, borderWidth: 3, borderColor: colors.gold, padding: 18, gap: 8, alignItems: 'center' },
  code: { fontFamily: fonts.display, fontSize: 40, letterSpacing: 6, color: colors.paper },
  sub: { fontFamily: fonts.body, fontSize: 13, color: colors.silver },
  row: { flexDirection: 'row', gap: 10, alignSelf: 'stretch', marginTop: 6 },
  ok: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.teal },
  error: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.paper, backgroundColor: colors.stamp, padding: 10 },
});
