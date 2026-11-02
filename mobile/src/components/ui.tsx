import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View,
  type StyleProp, type TextStyle, type ViewStyle,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { bitmapToPaths, ICONS, type Bitmap, type Palette } from '@/lib/pixel';
import { colors, fonts, hardShadow } from '@/lib/theme';

// ---------- pixel art ----------
export function PixelArt({ rows, palette, size, style }: { rows: Bitmap; palette: Palette; size: number; style?: StyleProp<ViewStyle> }) {
  const w = rows[0].length, h = rows.length;
  const paths = bitmapToPaths(rows, palette);
  return (
    <Svg width={size * w} height={size * h} viewBox={`0 0 ${w} ${h}`} style={style} {...({ shapeRendering: 'crispEdges' } as object)}>
      {paths.map((p) => <Path key={p.color} d={p.d} fill={p.color} />)}
    </Svg>
  );
}

export function Icon({ name, color = colors.ink, size = 24 }: { name: keyof typeof ICONS; color?: string; size?: number }) {
  return <PixelArt rows={ICONS[name]} palette={{ '#': color }} size={size / 12} />;
}

// ---------- text ----------
export function Title({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.title, style]}>{children}</Text>;
}
export function Body({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.body, style]}>{children}</Text>;
}
export function Label({ children, color = colors.muted, style }: { children: ReactNode; color?: string; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.label, { color }, style]}>{children}</Text>;
}

// ---------- buttons ----------
export function PixelButton({ label, onPress, disabled, busy, tone = 'red', style }: {
  label: string; onPress: () => void; disabled?: boolean; busy?: boolean; tone?: 'red' | 'ink'; style?: StyleProp<ViewStyle>;
}) {
  const off = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!busy }}
      onPress={off ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: off ? colors.silver : tone === 'red' ? colors.stamp : colors.ink },
        off ? null : hardShadow(0, pressed ? 1 : 5),
        pressed && !off ? { transform: [{ translateY: 4 }] } : null,
        style,
      ]}
    >
      {busy ? <ActivityIndicator color={colors.paper} /> : <Text style={styles.buttonText}>{label.toUpperCase()}</Text>}
    </Pressable>
  );
}

export function TextLink({ label, onPress, color = colors.ink }: { label: string; onPress: () => void; color?: string }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={10} style={{ padding: 6, alignSelf: 'center' }}>
      <Text style={[styles.link, { color }]}>{label.toUpperCase()}</Text>
    </Pressable>
  );
}

// ---------- panels and inputs ----------
export function Panel({ children, style, onPress, accent }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; accent?: string }) {
  const content = (pressed: boolean) => [
    styles.panel,
    accent ? { borderColor: accent, backgroundColor: '#FBEDE6' } : null,
    hardShadow(pressed ? 1 : 3, pressed ? 1 : 3),
    accent ? { shadowColor: accent } : null,
    pressed ? { transform: [{ translateX: 2 }, { translateY: 2 }] } : null,
    style,
  ];
  if (!onPress) return <View style={content(false)}>{children}</View>;
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => content(pressed)}>{children}</Pressable>;
}

export function PixelInput(props: ComponentProps<typeof TextInput> & { invalid?: boolean }) {
  const { invalid, style, ...rest } = props;
  return (
    <TextInput
      placeholderTextColor={colors.silver}
      {...rest}
      style={[styles.input, hardShadow(3, 3), invalid ? { borderColor: colors.stamp } : null, style]}
    />
  );
}

// ---------- onboarding header ----------
export function StepHeader({ step, total = 3, onBack }: { step: number; total?: number; onBack?: () => void }) {
  return (
    <View style={styles.stepHeader}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} hitSlop={10} style={{ opacity: onBack ? 1 : 0 }}>
        <Icon name="back" />
      </Pressable>
      <View style={styles.progress}>
        {Array.from({ length: total }, (_, i) => (
          <View key={i} style={[styles.progressBar, { backgroundColor: i < step ? colors.stamp : colors.line }]} />
        ))}
      </View>
      <Text style={styles.stepText}>{step} of {total}</Text>
    </View>
  );
}

/** Segmented, pixel-style progress bar. */
export function SegmentBar({ value, color, track = colors.line, height = 10 }: { value: number; color: string; track?: string; height?: number }) {
  return (
    <View style={{ height, backgroundColor: track, flexDirection: 'row', overflow: 'hidden' }}>
      <View style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`, backgroundColor: color }} />
    </View>
  );
}

export const styles = StyleSheet.create({
  title: { fontFamily: fonts.display, fontSize: 28, lineHeight: 32, color: colors.ink },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 23, color: colors.muted },
  label: { fontFamily: fonts.label, fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase' },
  button: { borderWidth: 3, borderColor: colors.ink, paddingVertical: 16, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', minHeight: 58 },
  buttonText: { fontFamily: fonts.labelBold, fontSize: 15, letterSpacing: 1.5, color: colors.paper },
  link: { fontFamily: fonts.label, fontSize: 12, letterSpacing: 0.8 },
  panel: { backgroundColor: colors.card, borderWidth: 2, borderColor: colors.ink },
  input: { backgroundColor: colors.card, borderWidth: 2, borderColor: colors.ink, paddingHorizontal: 14, paddingVertical: 12, fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 8 },
  progress: { flex: 1, flexDirection: 'row', gap: 6 },
  progressBar: { flex: 1, height: 6 },
  stepText: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.muted },
});
