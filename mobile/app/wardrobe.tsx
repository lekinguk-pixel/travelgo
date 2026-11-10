import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AvatarEditor, type WardrobeItem } from '@/components/AvatarEditor';
import { Character } from '@/components/Character';
import { BackHeader } from '@/components/social';
import { PixelButton } from '@/components/ui';
import { toAvatar, type Avatar } from '@/lib/avatar';
import { useSession } from '@/lib/session';
import { friendlyError, supabase } from '@/lib/supabase';
import { colors, fonts, hardShadow } from '@/lib/theme';

// Change your traveller's look. Exclusive outfits come from stamping landmarks
// or from the journey shop; locked ones say how to get them.
export default function Wardrobe() {
  const { profile, refreshProfile } = useSession();
  const [avatar, setAvatar] = useState<Avatar>(toAvatar(profile?.avatar));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const changed = JSON.stringify(avatar) !== JSON.stringify(toAvatar(profile?.avatar));

  async function save() {
    if (!profile) return;
    setBusy(true); setError('');
    const { error: e } = await supabase.from('profiles').update({ avatar }).eq('id', profile.id);
    setBusy(false);
    if (e) { setError(friendlyError(e)); return; }
    await refreshProfile();
    router.back();
  }

  function locked(it: WardrobeItem) {
    if (it.source === 'landmark') {
      Alert.alert(`${it.name} 🔒`, `${it.description ?? ''}\n\nStamp ${it.landmark_name} in ${it.city_name} to unlock it.`, [
        { text: 'OK', style: 'cancel' },
        ...(it.landmark_id ? [{ text: 'See landmark', onPress: () => router.push(`/landmark/${it.landmark_id}`) }] : []),
      ]);
    } else if (it.source === 'arrival') {
      Alert.alert(`${it.name} 🔒`, `${it.description ?? ''}\n\nSend your digital traveller to ${it.city_name} on the Journey tab to unlock it.`, [
        { text: 'OK', style: 'cancel' }, { text: 'Go to Journey', onPress: () => router.push('/journey-destinations') },
      ]);
    } else if (it.source === 'flag') {
      Alert.alert(`${it.name} 🔒`, `Stamp any landmark in ${it.city_name}, or arrive there on your digital journey.`, [
        { text: 'OK', style: 'cancel' }, { text: 'Go to Journey', onPress: () => router.push('/journey-destinations') },
      ]);
    } else {
      Alert.alert(`${it.name} 🔒`, `Buy it in the Journey shop for ${it.price_coins} coins.`, [
        { text: 'OK', style: 'cancel' }, { text: 'Go to Journey', onPress: () => router.push('/journey') },
      ]);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
      <BackHeader title="Wardrobe" />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={[styles.stage, hardShadow(4, 4)]}>
          <View style={styles.grass} />
          <Character avatar={avatar} size={7} style={styles.sprite} />
        </View>
        <AvatarEditor value={avatar} onChange={setAvatar} onLocked={locked} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
      <View style={styles.footer}>
        <PixelButton label={changed ? 'Save my look' : 'Looking good'} onPress={save} busy={busy} disabled={!changed} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 24, paddingBottom: 120, gap: 16 },
  stage: { height: 210, backgroundColor: colors.ink, borderWidth: 3, borderColor: colors.gold, overflow: 'hidden', alignItems: 'center' },
  grass: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 28, backgroundColor: colors.grass, borderTopWidth: 4, borderTopColor: colors.grassTop },
  sprite: { position: 'absolute', bottom: 14 },
  error: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.paper, backgroundColor: colors.stamp, padding: 10 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 20, paddingBottom: 28, backgroundColor: colors.paper, borderTopWidth: 3, borderTopColor: colors.ink },
});
