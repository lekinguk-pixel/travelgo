import { PixelifySans_700Bold } from '@expo-google-fonts/pixelify-sans';
import { PlusJakartaSans_400Regular, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans';
import { Silkscreen_400Regular, Silkscreen_700Bold } from '@expo-google-fonts/silkscreen';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider, useSession } from '@/lib/session';
import { colors } from '@/lib/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

function Root() {
  const [fontsLoaded] = useFonts({
    PixelifySans_700Bold, Silkscreen_400Regular, Silkscreen_700Bold,
    PlusJakartaSans_400Regular, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold,
  });
  const { ready } = useSession();
  useEffect(() => { if (fontsLoaded && ready) SplashScreen.hideAsync().catch(() => {}); }, [fontsLoaded, ready]);
  if (!fontsLoaded || !ready) return null;
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper }, animation: 'fade' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="camera/[id]" options={{ animation: 'slide_from_bottom', contentStyle: { backgroundColor: colors.ink } }} />
        <Stack.Screen name="stamp-collected" options={{ animation: 'fade', gestureEnabled: false }} />
      </Stack>
    </>
  );
}

export default function Layout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <Root />
      </SessionProvider>
    </SafeAreaProvider>
  );
}
