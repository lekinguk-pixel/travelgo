import { router } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Body, PixelButton, StepHeader, Title } from '@/components/ui';
import { signInDraft } from '@/lib/draft';
import { friendlyError, supabase } from '@/lib/supabase';
import { colors, fonts, hardShadow } from '@/lib/theme';

const LENGTH = 6;

// 03 Check your email: enter the one-time code.
export default function Verify() {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [wait, setWait] = useState(60);
  const input = useRef<ComponentRef<typeof TextInput>>(null);

  useEffect(() => {
    const id = setInterval(() => setWait((w) => (w > 0 ? w - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, []);

  async function confirm(value = code) {
    if (value.length !== LENGTH) return;
    setBusy(true); setError('');
    const { error: e } = await supabase.auth.verifyOtp({ email: signInDraft.email, token: value, type: 'email' });
    setBusy(false);
    if (e) { setError('That code didn\'t work. Check it, or send a new one.'); return; }
    // The title screen decides where to go next: book if you have a traveller, otherwise creation.
    router.replace('/');
  }

  async function resend() {
    setError('');
    const { error: e } = await supabase.auth.signInWithOtp({ email: signInDraft.email });
    if (e) setError(friendlyError(e)); else setWait(60);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
      <StepHeader step={1} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Title>Check your email</Title>
        <Body>We sent a {LENGTH}-digit code to <Text style={{ color: colors.ink, fontFamily: fonts.bodyBold }}>{signInDraft.email}</Text>. Enter it below to continue.</Body>

        <Pressable onPress={() => input.current?.focus()} style={styles.boxes} accessibilityLabel={`${LENGTH}-digit code`}>
          {Array.from({ length: LENGTH }, (_, i) => {
            const active = i === code.length && !busy;
            return (
              <View key={i} style={[styles.box, hardShadow(3, 3), active ? { borderColor: colors.stamp, borderWidth: 3 } : null]}>
                <Text style={styles.digit}>{code[i] ?? ''}</Text>
              </View>
            );
          })}
        </Pressable>
        <TextInput
          ref={input} value={code} autoFocus keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code"
          maxLength={LENGTH} style={styles.hidden} caretHidden
          onChangeText={(v) => { const d = v.replace(/\D/g, '').slice(0, LENGTH); setCode(d); setError(''); if (d.length === LENGTH) confirm(d); }}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.resendRow}>
          <Text style={styles.resendText}>Didn't get it?</Text>
          <Pressable onPress={wait === 0 ? resend : undefined} hitSlop={8}>
            <Text style={[styles.resendText, { fontFamily: fonts.bodyBold, color: wait === 0 ? colors.stamp : colors.ink }]}>
              {wait === 0 ? 'Send a new code' : `Resend in 0:${String(wait).padStart(2, '0')}`}
            </Text>
          </Pressable>
        </View>
        <View style={styles.tip}>
          <Text style={styles.tipLabel}>TIP</Text>
          <Text style={styles.tipText}>Check your spam folder if the email hasn't arrived within a minute.</Text>
        </View>
        <PixelButton label="Confirm code" onPress={() => confirm()} disabled={code.length !== LENGTH} busy={busy} style={{ marginTop: 8 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 32, gap: 16 },
  boxes: { flexDirection: 'row', gap: 8 },
  box: { flex: 1, height: 60, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  digit: { fontFamily: fonts.display, fontSize: 28, color: colors.ink },
  hidden: { position: 'absolute', opacity: 0, height: 1, width: 1 },
  error: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.stamp },
  resendRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  resendText: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  tip: { backgroundColor: colors.gold, borderWidth: 2, borderColor: colors.ink, padding: 12, gap: 4 },
  tipLabel: { fontFamily: fonts.label, fontSize: 10, color: colors.ink },
  tipText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.ink },
});
