import { Redirect, router } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AvatarEditor } from '@/components/AvatarEditor';
import { Character } from '@/components/Character';
import { Label, PixelButton, PixelInput, StepHeader, TextLink, Title } from '@/components/ui';
import type { Avatar } from '@/lib/avatar';
import { travellerDraft } from '@/lib/draft';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { colors, fonts, hardShadow } from '@/lib/theme';

type NameState = 'empty' | 'invalid' | 'checking' | 'taken' | 'ok';

function ageFrom(d: number, m: number, y: number): { valid: boolean; age: number } {
  const born = new Date(y, m - 1, d);
  if (born.getFullYear() !== y || born.getMonth() !== m - 1 || born.getDate() !== d || y < 1900) return { valid: false, age: 0 };
  const now = new Date();
  if (born > now) return { valid: false, age: 0 };
  let age = now.getFullYear() - y;
  if (now.getMonth() < m - 1 || (now.getMonth() === m - 1 && now.getDate() < d)) age--;
  return { valid: true, age };
}

// 04 Create your traveller: body, hair and clothes, traveller name and date of birth (13+).
export default function CreateTraveller() {
  const { session, profile, signOut } = useSession();
  const [avatar, setAvatar] = useState<Avatar>(travellerDraft.avatar);
  const [name, setName] = useState(travellerDraft.name);
  const [nameState, setNameState] = useState<NameState>(travellerDraft.name ? 'ok' : 'empty');
  const [[dd, mm, yyyy], setDob] = useState<[string, string, string]>(['', '', '']);
  const mmRef = useRef<ComponentRef<typeof TextInput>>(null), yyRef = useRef<ComponentRef<typeof TextInput>>(null);

  // A returning player who already has a traveller skips this screen (but not mid-creation).
  useEffect(() => { if (profile && !travellerDraft.dateOfBirth) router.replace('/(tabs)'); }, [profile]);

  // Live name availability, debounced.
  useEffect(() => {
    const v = name.trim();
    if (!v) { setNameState('empty'); return; }
    if (!/^[A-Za-z0-9_]{3,16}$/.test(v)) { setNameState('invalid'); return; }
    setNameState('checking');
    const id = setTimeout(async () => {
      const { data, error } = await supabase.rpc('traveller_name_available', { p_name: v });
      setNameState(error ? 'ok' : data ? 'ok' : 'taken');
    }, 400);
    return () => clearTimeout(id);
  }, [name]);

  const dob = useMemo(() => {
    if (!dd || !mm || yyyy.length < 4) return { state: 'empty' as const };
    const r = ageFrom(+dd, +mm, +yyyy);
    if (!r.valid) return { state: 'invalid' as const };
    if (r.age < 13) return { state: 'young' as const };
    return { state: 'ok' as const, iso: `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}` };
  }, [dd, mm, yyyy]);

  if (!session) return <Redirect href="/" />;

  const canContinue = nameState === 'ok' && dob.state === 'ok';
  function next() {
    if (dob.state !== 'ok') return;
    travellerDraft.name = name.trim();
    travellerDraft.dateOfBirth = dob.iso;
    travellerDraft.avatar = avatar;
    router.push('/home-city');
  }

  const nameMessage: Record<NameState, { text: string; color: string }> = {
    empty: { text: 'Shown on leaderboards, so don\'t use your full real name.', color: colors.muted },
    invalid: { text: 'Use 3 to 16 letters, numbers or underscores, with no spaces.', color: colors.stamp },
    checking: { text: 'Checking...', color: colors.muted },
    taken: { text: `${name.trim()} is taken. Try adding a number or a place.`, color: colors.stamp },
    ok: { text: `✓ ${name.trim()} is available`, color: colors.uncommon },
  };
  const dobMessage = {
    empty: { text: 'You must be 13 or older. We never show this to anyone.', color: colors.muted },
    invalid: { text: 'That date doesn\'t look right. Check the day, month and year.', color: colors.stamp },
    young: { text: 'mmGO is for players aged 13 and over. Come back when you\'re 13!', color: colors.stamp },
    ok: { text: '✓ Thanks. We never show this to anyone.', color: colors.uncommon },
  }[dob.state];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <StepHeader step={2} onBack={undefined} />
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Title>Create your traveller</Title>
          <View style={[styles.stage, hardShadow(4, 4)]}>
            <View style={styles.tag}><Text style={styles.tagText} numberOfLines={1}>{(name.trim() || 'New traveller').toUpperCase()} · LV 1</Text></View>
            <View style={styles.grass} />
            <Character avatar={avatar} size={7} style={styles.sprite} />
          </View>

          <AvatarEditor value={avatar} onChange={setAvatar} quick />
          <Text style={styles.hint}>Just the basics for now. Hats, bags, pets and rare outfits from famous landmarks are waiting in your Wardrobe.</Text>

          <View style={{ gap: 6 }}>
            <Label>Traveller name</Label>
            <PixelInput value={name} onChangeText={setName} placeholder="e.g. WanderingDave" autoCapitalize="none" autoCorrect={false}
              maxLength={16} invalid={nameState === 'invalid' || nameState === 'taken'} accessibilityLabel="Traveller name" />
            <Text style={[styles.status, { color: nameMessage[nameState].color }]}>{nameMessage[nameState].text}</Text>
          </View>

          <View style={{ gap: 6 }}>
            <Label>Date of birth</Label>
            <View style={styles.dob}>
              <PixelInput style={{ flex: 1, textAlign: 'center' }} value={dd} placeholder="DD" keyboardType="number-pad" maxLength={2} accessibilityLabel="Day of birth"
                onChangeText={(v) => { const d = v.replace(/\D/g, ''); setDob([d, mm, yyyy]); if (d.length === 2) mmRef.current?.focus(); }} />
              <PixelInput ref={mmRef} style={{ flex: 1, textAlign: 'center' }} value={mm} placeholder="MM" keyboardType="number-pad" maxLength={2} accessibilityLabel="Month of birth"
                onChangeText={(v) => { const d = v.replace(/\D/g, ''); setDob([dd, d, yyyy]); if (d.length === 2) yyRef.current?.focus(); }} />
              <PixelInput ref={yyRef} style={{ flex: 1.6, textAlign: 'center' }} value={yyyy} placeholder="YYYY" keyboardType="number-pad" maxLength={4} accessibilityLabel="Year of birth"
                onChangeText={(v) => setDob([dd, mm, v.replace(/\D/g, '')])} />
            </View>
            <Text style={[styles.status, { color: dobMessage.color }]}>{dobMessage.text}</Text>
          </View>

          <PixelButton label="Create my traveller" onPress={next} disabled={!canContinue} />
          <TextLink label="Use a different email" onPress={async () => { await signOut(); router.replace('/'); }} color={colors.muted} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 32, gap: 16 },
  stage: { height: 230, backgroundColor: colors.ink, borderWidth: 3, borderColor: colors.gold, overflow: 'hidden', alignItems: 'center' },
  tag: { marginTop: 12, backgroundColor: colors.stamp, borderWidth: 1, borderColor: colors.paper, paddingHorizontal: 8, paddingVertical: 3, maxWidth: '90%' },
  tagText: { fontFamily: fonts.labelBold, fontSize: 10, color: colors.paper },
  sprite: { position: 'absolute', bottom: 14 },
  hint: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, lineHeight: 19 },
  grass: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 28, backgroundColor: colors.grass, borderTopWidth: 4, borderTopColor: colors.grassTop },
  swRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  swatch: { width: 36, height: 36, borderWidth: 2, borderColor: colors.line },
  swatchOn: { width: 40, height: 40, borderWidth: 3, borderColor: colors.ink },
  status: { fontFamily: fonts.bodySemi, fontSize: 12.5, lineHeight: 18 },
  dob: { flexDirection: 'row', gap: 8 },
});
