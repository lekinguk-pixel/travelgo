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
  const [password, setPassword] = useState('');
  const [isNew, setIsNew] = useState(!returning);
  const [reveal, setReveal] = useState(false);

  // Email + password (used while email codes are switched off for testing).
  async function submitPassword() {
    setBusy(true); setError('');
    const address = email.trim().toLowerCase();
    if (isNew) {
      const { data, error: e } = await supabase.auth.signUp({ email: address, password });
      setBusy(false);
      if (e) {
        setError(/registered|exists/i.test(e.message) ? 'That email already has an account. Tap "I already have an account" below.' : friendlyError(e));
        return;
      }
      if (!data.session) { setError('Your account was created, but it needs confirming by email first.'); return; }
    } else {
      const { error: e } = await supabase.auth.signInWithPassword({ email: address, password });
      setBusy(false);
      if (e) { setError('That email and password don\'t match. Check them and try again.'); return; }
    }
    signInDraft.email = address;
    router.replace('/');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // Email-code sign-in, back on once a proper email sender is set up (see README).
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
                autoFocus accessibilityLabel="Email address"
              />
              <Label style={{ marginTop: 6 }}>{isNew ? 'Choose a password' : 'Password'}</Label>
              <View>
                <PixelInput
                  value={password} onChangeText={(v) => { setPassword(v); setError(''); }}
                  placeholder={isNew ? 'At least 8 characters' : 'Your password'} secureTextEntry={!reveal}
                  autoCapitalize="none" autoComplete={isNew ? 'new-password' : 'current-password'}
                  returnKeyType="go" onSubmitEditing={() => emailOk(email) && password.length >= 8 && submitPassword()}
                  accessibilityLabel="Password" style={{ paddingRight: 64 }}
                />
                <Text onPress={() => setReveal((r) => !r)} style={styles.reveal} accessibilityRole="button">{reveal ? 'HIDE' : 'SHOW'}</Text>
              </View>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <PixelButton label={isNew ? 'Create my account' : 'Sign in'} onPress={submitPassword}
                disabled={!emailOk(email) || password.length < (isNew ? 8 : 1)} busy={busy} style={{ marginTop: 6 }} />
              <Text onPress={() => { setIsNew((n) => !n); setError(''); }} style={styles.switch} accessibilityRole="button">
                {isNew ? 'I already have an account' : 'I\'m new here: create an account'}
              </Text>
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
  reveal: { position: 'absolute', right: 14, top: 15, fontFamily: fonts.label, fontSize: 11, color: colors.muted },
  switch: { fontFamily: fonts.label, fontSize: 11, color: colors.ink, alignSelf: 'center', padding: 8, textTransform: 'uppercase' },
  age: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  badge: { backgroundColor: colors.ink, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { fontFamily: fonts.labelBold, fontSize: 12, color: colors.gold },
  ageText: { fontFamily: fonts.bodySemi, fontSize: 12.5, color: colors.ink, flex: 1 },
});
