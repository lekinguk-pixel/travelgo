import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackHeader } from '@/components/social';
import { Body, Label, PixelButton, PixelInput } from '@/components/ui';
import { friendlyError, supabase } from '@/lib/supabase';
import { colors, fonts, hardShadow } from '@/lib/theme';

const REASONS = [
  { key: 'inappropriate', title: 'Inappropriate photo', sub: 'Nudity, violence, offensive gestures or anything not suitable for 13+' },
  { key: 'not_there', title: 'Not taken there', sub: 'Looks like a fake or reused photo, or they weren\'t really at the landmark' },
  { key: 'bullying', title: 'Bullying or harassment', sub: 'The photo targets, mocks or shows someone without their consent' },
  { key: 'other', title: 'Something else', sub: 'Tell us what\'s wrong below' },
] as const;

// Report a friend's stamp photo.
export default function ReportStamp() {
  const { id, name, place } = useLocalSearchParams<{ id: string; name?: string; place?: string }>();
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function send() {
    if (!reason) return;
    setBusy(true); setError('');
    const { error: e } = await supabase.rpc('report_stamp', { p_stamp_id: Number(id), p_reason: reason, p_details: details });
    setBusy(false);
    if (e) { setError(friendlyError(e)); return; }
    setDone(true);
  }

  if (done) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
      <BackHeader title="Report sent" />
      <View style={styles.body}>
        <Body>Thanks for letting us know. A moderator will look at this photo, and if enough players report it, it's hidden straight away while we check.</Body>
        <Body>{name ? `${name} won't be told who reported it.` : 'Reports are anonymous.'}</Body>
        <PixelButton label="Done" onPress={() => router.back()} />
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
      <BackHeader title="Report photo" />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Body>{name && place ? `What's wrong with ${name}'s photo at ${place}?` : 'What\'s wrong with this photo?'} Reports are anonymous.</Body>
        <View style={{ gap: 10 }} accessibilityRole="radiogroup">
          {REASONS.map((r) => {
            const on = reason === r.key;
            return (
              <Pressable key={r.key} onPress={() => setReason(r.key)} accessibilityRole="radio" accessibilityState={{ selected: on }}
                style={[styles.option, hardShadow(on ? 3 : 2, on ? 3 : 2), on ? { borderColor: colors.stamp, backgroundColor: '#FBEDE6' } : null]}>
                <View style={[styles.dot, on ? { backgroundColor: colors.stamp } : null]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.optTitle}>{r.title}</Text>
                  <Text style={styles.optSub}>{r.sub}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
        <Label>Anything else we should know? (optional)</Label>
        <PixelInput value={details} onChangeText={setDetails} placeholder="Add details" multiline maxLength={500}
          style={{ minHeight: 90, textAlignVertical: 'top' }} accessibilityLabel="Details" />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PixelButton label="Send report" onPress={send} busy={busy} disabled={!reason || (reason === 'other' && details.trim().length < 3)} />
        <Text style={styles.urgent}>If someone is in danger, contact the emergency services on 999.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 24, paddingBottom: 40, gap: 14 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.ink, padding: 12 },
  dot: { width: 18, height: 18, borderWidth: 2, borderColor: colors.ink },
  optTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  optSub: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
  error: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.stamp },
  urgent: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, textAlign: 'center' },
});
