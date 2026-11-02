import { Redirect, Tabs } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/ui';
import { useSession } from '@/lib/session';
import { colors, fonts, hardShadow } from '@/lib/theme';

const TABS: { name: string; label: string; icon: 'map' | 'book' | 'camera' | 'trophy' | 'user' }[] = [
  { name: 'index', label: 'Explore', icon: 'map' },
  { name: 'book', label: 'My book', icon: 'book' },
  { name: 'stamp', label: 'Stamp', icon: 'camera' },
  { name: 'ranks', label: 'Ranks', icon: 'trophy' },
  { name: 'me', label: 'Me', icon: 'user' },
];

export default function TabsLayout() {
  const { session, profile } = useSession();
  const insets = useSafeAreaInsets();
  if (!session) return <Redirect href="/" />;
  if (!profile) return <Redirect href="/create-traveller" />;

  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.paper } }}
      tabBar={({ state, navigateToTab }: { state: { index: number; routes: { key: string; name: string }[] }; navigateToTab: (routeKey: string) => void }) => (
        <View style={[styles.bar, { paddingBottom: insets.bottom + 10 }]}>
          {state.routes.map((route, i) => {
            const tab = TABS.find((t) => t.name === route.name);
            if (!tab) return null;
            const focused = state.index === i;
            const onPress = () => { if (!focused) navigateToTab(route.key); };
            if (tab.name === 'stamp') {
              return (
                <Pressable key={route.key} onPress={onPress} accessibilityRole="button" accessibilityLabel="Stamp the nearest landmark"
                  style={({ pressed }) => [styles.stampBtn, hardShadow(0, pressed ? 1 : 4), pressed ? { transform: [{ translateY: 3 }] } : null]}>
                  <Icon name="camera" color={colors.paper} size={28} />
                </Pressable>
              );
            }
            const tint = focused ? colors.stamp : colors.muted;
            return (
              <Pressable key={route.key} onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={tab.label} style={styles.item}>
                <Icon name={tab.icon} color={tint} />
                <Text style={[styles.label, { color: tint }]}>{tab.label.toUpperCase()}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
    >
      {TABS.map((t) => <Tabs.Screen key={t.name} name={t.name} options={{ title: t.label }} />)}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.card, borderTopWidth: 3, borderTopColor: colors.ink, paddingTop: 8, paddingHorizontal: 18 },
  item: { alignItems: 'center', gap: 4, minWidth: 56, paddingVertical: 4 },
  label: { fontFamily: fonts.label, fontSize: 9 },
  stampBtn: { width: 64, height: 64, backgroundColor: colors.stamp, borderWidth: 3, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center', marginTop: -24 },
});
