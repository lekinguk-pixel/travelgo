import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Body, Label, Panel, PixelArt, PixelButton, PixelInput, StepHeader, Title } from '@/components/ui';
import { signInDraft } from '@/lib/draft';
import { HERO_TOP, LEGS_A } from '@/lib/pixel';
import { friendlyError, supabase } from '@/lib/supabase';
import { colors, fonts, hardShadow } from '@/lib/theme';

const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

// 02 Save your adventure: sign in with a one-time email code.
export default function SignIn() {
  const { returning } = useLocalSearchParams<{ returning?: string }>();
  const [email, setEmail] = useState(signInDraft.email);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showEmail, setShowEmail] = useState(false);

  async function sendCode() {
    setBusy(true); setError('');
    const address = email.trim().toLowerCase();
    const { error: e } = await supabase.auth.signInWithOtp({ email: address, options: { shouldCreateUser: true } });
    setBusy(false);
    if (e) { setError(friendlyError(e)); return; }
    signInDraft.email = address;
    router.push('/verify');
  }

  const silhouette = { H: '#3A4A6B', S: '#3A4A6B', B: '#3A4A6B', b: '#3A4A6B', C: '#3A4A6B', L: '#3A4A6B' };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <StepHeader step={1} onBack={() => router.back()} />
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <View style={[styles.stage, hardShadow(4, 4)]}>
            <Text style={styles.q}>?</Text>
            <PixelArt rows={[...HERO_TOP, ...LEGS_A]} palette={silhouette} size={8} style={styles.sprite} />
            <View style={styles.grass} />
          </View>
          <Title>{returning ? 'Welcome back, traveller' : 'Save your adventure'}</Title>
          <Body>Create an account so your stamps, levels and memories are kept safe, and so you can appear on the leaderboards.</Body>

          {!showEmail ? (
            <>
              <Panel onPress={() => setShowEmail(true)} style={styles.choice}>
                <Text style={styles.at}>@</Text>
                <Text style={styles.choiceText}>Continue with email</Text>
              </Panel>
              <Panel style={[styles.choice, { opacity: 0.55 }]}>
                <View style={styles.gMark}><Text style={styles.gText}>G</Text></View>
                <Text style={styles.choiceText}>Google sign-in coming soon</Text>
              </Panel>
            </>
          ) : (
            <View style={{ gap: 8 }}>
              <Label>Email address</Label>
              <PixelInput
                value={email} onChangeText={(v) => { setEmail(v); setError(''); }}
                placeholder="you@example.com" autoCapitalize="none" autoComplete="email" keyboardType="email-address"
                autoFocus returnKeyType="send" onSubmitEditing={() => emailOk(email) && sendCode()}
                accessibilityLabel="Email address"
              />
              <Body style={styles.small}>We'll email you a code to sign in. No password needed.</Body>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <PixelButton label="Send my code" onPress={sendCode} disabled={!emailOk(email)} busy={busy} />
            </View>
          )}

          <View style={styles.age}>
            <View style={styles.badge}><Text style={styles.badgeText}>13+</Text></View>
            <Text style={styles.ageText}>You must be 13 or older to play mmGO.</Text>
          </View>
          <Body style={styles.small}>By continuing you agree to the Terms of Service and Privacy Policy.</Body>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 32, gap: 16 },
  stage: { height: 150, backgroundColor: colors.ink, borderWidth: 3, borderColor: colors.gold, overflow: 'hidden', alignItems: 'center' },
  q: { fontFamily: fonts.display, fontSize: 34, color: colors.gold, marginTop: 4 },
  sprite: { position: 'absolute', bottom: 22 },
  grass: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 26, backgroundColor: colors.grass, borderTopWidth: 4, borderTopColor: colors.grassTop },
  choice: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 15 },
  choiceText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  at: { fontFamily: fonts.display, fontSize: 18, color: colors.stamp },
  gMark: { width: 26, height: 26, borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  gText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.rare },
  small: { fontSize: 12.5, lineHeight: 19 },
  error: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.stamp },
  age: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  badge: { backgroundColor: colors.ink, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { fontFamily: fonts.labelBold, fontSize: 12, color: colors.gold },
  ageText: { fontFamily: fonts.bodySemi, fontSize: 12.5, color: colors.ink, flex: 1 },
});
