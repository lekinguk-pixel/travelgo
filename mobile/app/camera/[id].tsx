import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, Icon, PixelButton, TextLink, Title } from '@/components/ui';
import { lastStamp, type StampReward } from '@/lib/draft';
import { useSession } from '@/lib/session';
import { friendlyError, supabase } from '@/lib/supabase';
import { distanceM, type Landmark } from '@/lib/useChapter';
import { colors, fonts, hardShadow, rarityColor } from '@/lib/theme';

type Fix = { lat: number; lng: number; accuracy: number; mocked: boolean };

// 07 Stamp capture: prove you're there with GPS and a photo, then claim the stamp.
export default function StampCamera() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const insets = useSafeAreaInsets();
  const [landmark, setLandmark] = useState<Landmark | null>(null);
  const [camPerm, requestCam] = useCameraPermissions();
  const [locPerm, setLocPerm] = useState<Location.PermissionResponse | null>(null);
  const [fix, setFix] = useState<Fix | null>(null);
  const [facing, setFacing] = useState<CameraType>('front');
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const cam = useRef<CameraView>(null);

  useEffect(() => {
    supabase.from('landmarks').select('id, city_id, name, lat, lng, radius_m, rarity, is_major, skills').eq('id', Number(id)).single()
      .then(({ data }) => setLandmark(data as Landmark | null));
    Location.getForegroundPermissionsAsync().then(setLocPerm);
  }, [id]);

  useEffect(() => {
    if (!locPerm?.granted) return;
    let sub: Location.LocationSubscription | null = null;
    Location.watchPositionAsync({ accuracy: Location.Accuracy.Highest, distanceInterval: 3, timeInterval: 2000 }, (p) =>
      setFix({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy ?? 999, mocked: !!p.mocked }),
    ).then((s) => { sub = s; }).catch(() => setError('Couldn\'t read your location. Check that location is switched on.'));
    return () => sub?.remove();
  }, [locPerm?.granted]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));

  // ---- permissions, asked only now, with the reason ----
  if (!locPerm || !camPerm) return <View style={styles.dark}><ActivityIndicator color={colors.paper} /></View>;
  if (!locPerm.granted || !camPerm.granted) {
    const needLoc = !locPerm.granted;
    const blocked = needLoc ? !locPerm.canAskAgain : !camPerm.canAskAgain;
    return (
      <SafeAreaView style={styles.permWrap}>
        <Title>{needLoc ? 'Where are you, traveller?' : 'Time for a photo'}</Title>
        <Body>{needLoc
          ? 'mmGO needs your location to confirm you\'re really at a landmark. It\'s only checked while you\'re stamping, never in the background.'
          : 'mmGO needs your camera to take the photo that proves you visited. Photos are private to you unless you share them.'}</Body>
        <PixelButton label={blocked ? 'Open settings' : needLoc ? 'Allow location' : 'Allow camera'}
          onPress={async () => {
            if (blocked) { Linking.openSettings(); return; }
            if (needLoc) setLocPerm(await Location.requestForegroundPermissionsAsync()); else await requestCam();
          }} />
        <TextLink label="Not now" onPress={close} />
      </SafeAreaView>
    );
  }

  if (!landmark) return <View style={styles.dark}><ActivityIndicator color={colors.paper} /></View>;

  const dist = fix ? distanceM(fix.lat, fix.lng, landmark.lat, landmark.lng) : null;
  const inRange = !!fix && dist !== null && dist <= landmark.radius_m + Math.min(fix.accuracy, 50) && fix.accuracy <= 100 && !fix.mocked;
  const status = !fix ? 'Finding your location...'
    : fix.mocked ? 'Fake GPS detected. Turn off mock location to stamp.'
    : fix.accuracy > 100 ? 'GPS signal is weak. Move somewhere more open.'
    : inRange ? `You're here · ${Math.round(dist!)} m away`
    : `Get closer · ${dist! < 1000 ? Math.round(dist!) + ' m' : (dist! / 1000).toFixed(1) + ' km'} away`;

  async function shoot() {
    try {
      const pic = await cam.current?.takePictureAsync({ quality: 0.6, skipProcessing: false });
      if (pic?.uri) setPhoto(pic.uri);
    } catch { setError('The camera couldn\'t take a photo. Try again.'); }
  }

  async function claim() {
    if (!photo || !fix || !session || !landmark) return;
    setBusy(true); setError('');
    const path = `${session.user.id}/${landmark.id}-${Date.now()}.jpg`;
    try {
      const bytes = await (await fetch(photo)).arrayBuffer();
      const up = await supabase.storage.from('stamp-photos').upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
      if (up.error) throw up.error;
      const { data, error: e } = await supabase.rpc('claim_stamp', {
        p_landmark_id: landmark.id, p_lat: fix.lat, p_lng: fix.lng, p_accuracy_m: fix.accuracy, p_photo_path: path,
      });
      if (e) { await supabase.storage.from('stamp-photos').remove([path]); throw e; }
      lastStamp.value = { ...(data as StampReward), photoUri: photo };
      // Ask for the AI photo check (it does nothing unless screening is switched on).
      supabase.functions.invoke('moderate-photo', { body: { stamp_id: (data as StampReward).stamp_id } }).catch(() => {});
      router.replace('/stamp-collected');
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  }

  return (
    <View style={styles.dark}>
      {photo ? <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" />
        : <CameraView ref={cam} style={StyleSheet.absoluteFill} facing={facing} mirror={facing === 'front'} />}

      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close camera" style={styles.round}><Icon name="close" color={colors.paper} /></Pressable>
        <View style={[styles.place, { borderColor: rarityColor(landmark.rarity) }]}>
          <Text style={styles.placeName} numberOfLines={1}>{landmark.name}</Text>
          <Text style={[styles.placeStatus, { color: inRange ? '#8ACB6E' : colors.paper }]}>{status}</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      {!photo ? <View style={styles.guide} pointerEvents="none" /> : null}

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 20 }]}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!photo ? (
          <>
            <Text style={styles.hint}>Get yourself and {landmark.name} in the shot</Text>
            <View style={styles.controls}>
              <View style={{ width: 52 }} />
              <Pressable onPress={inRange ? shoot : undefined} accessibilityRole="button" accessibilityLabel="Take photo"
                accessibilityState={{ disabled: !inRange }} style={[styles.shutterRing, { opacity: inRange ? 1 : 0.4 }]}>
                <View style={styles.shutter} />
              </Pressable>
              <Pressable onPress={() => setFacing((f) => (f === 'front' ? 'back' : 'front'))} accessibilityRole="button" accessibilityLabel="Flip camera" style={styles.round}>
                <Icon name="flip" color={colors.paper} />
              </Pressable>
            </View>
            <Text style={styles.fine}>Photos must be taken in mmGO to count</Text>
          </>
        ) : (
          <View style={{ gap: 12, alignSelf: 'stretch', paddingHorizontal: 24 }}>
            <PixelButton label={busy ? 'Stamping...' : 'Stamp it!'} onPress={claim} busy={busy} disabled={!inRange} />
            {!busy ? <TextLink label="Retake" color={colors.paper} onPress={() => { setPhoto(null); setError(''); }} /> : null}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dark: { flex: 1, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  permWrap: { flex: 1, backgroundColor: colors.paper, padding: 24, gap: 16, justifyContent: 'center' },
  top: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 16 },
  round: { width: 48, height: 48, backgroundColor: 'rgba(27,42,65,0.7)', borderWidth: 2, borderColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  place: { flex: 1, marginHorizontal: 10, backgroundColor: 'rgba(27,42,65,0.85)', borderWidth: 3, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center' },
  placeName: { fontFamily: fonts.display, fontSize: 18, color: colors.paper },
  placeStatus: { fontFamily: fonts.bodyBold, fontSize: 12 },
  guide: { position: 'absolute', top: '20%', bottom: '28%', left: '10%', right: '10%', borderWidth: 2, borderColor: 'rgba(246,240,226,0.7)', borderStyle: 'dashed' },
  bottom: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', gap: 14 },
  hint: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.paper, textAlign: 'center', paddingHorizontal: 32, textShadowColor: colors.ink, textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 0 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', alignSelf: 'stretch', paddingHorizontal: 32 },
  shutterRing: { width: 84, height: 84, borderWidth: 4, borderColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  shutter: { width: 64, height: 64, backgroundColor: colors.stamp, borderWidth: 3, borderColor: colors.ink },
  fine: { fontFamily: fonts.label, fontSize: 9, color: colors.silver },
  error: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.paper, backgroundColor: colors.stamp, paddingHorizontal: 12, paddingVertical: 8, marginHorizontal: 24, textAlign: 'center', ...hardShadow(3, 3) },
});
