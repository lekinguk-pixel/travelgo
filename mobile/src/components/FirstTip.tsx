import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Pip } from '@/components/PrologueArt';
import { colors, fonts, hardShadow } from '@/lib/theme';

/** A one-time tip from Pip the first time a player opens a feature. Tap to dismiss for good. */
export function FirstTip({ id, title, text, dark }: { id: string; title: string; text: string; dark?: boolean }) {
  const key = `mmgo.tip.${id}`;
  const [show, setShow] = useState(false);
  useEffect(() => { AsyncStorage.getItem(key).then((v) => setShow(!v)).catch(() => {}); }, [key]);
  if (!show) return null;
  function close() { setShow(false); AsyncStorage.setItem(key, '1').catch(() => {}); }
  return (
    <Pressable onPress={close} accessibilityRole="button" accessibilityLabel={`Tip: ${title}. ${text}. Tap to dismiss.`}
      style={[styles.tip, dark ? styles.dark : null, hardShadow(3, 3)]}>
      <View style={styles.pip}><Pip scale={2} /></View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.title, dark ? { color: colors.gold } : null]}>NEW · {title.toUpperCase()}</Text>
        <Text style={[styles.text, dark ? { color: colors.paper } : null]}>{text}</Text>
        <Text style={styles.ok}>GOT IT ✓</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tip: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: '#FFF8E6', borderWidth: 3, borderColor: colors.gold, padding: 10 },
  dark: { backgroundColor: colors.ink },
  pip: { backgroundColor: '#F3E6C8', borderWidth: 2, borderColor: colors.ink, padding: 2 },
  title: { fontFamily: fonts.labelBold, fontSize: 10.5, color: colors.stamp },
  text: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.ink },
  ok: { fontFamily: fonts.labelBold, fontSize: 9.5, color: colors.teal, marginTop: 2 },
});
