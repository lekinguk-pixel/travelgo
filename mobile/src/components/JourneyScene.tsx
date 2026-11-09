import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';
import { avatarPaths, composeAvatar, type Avatar } from '@/lib/avatar';
import type { JourneyMode } from '@/lib/journey';
import { buildBikeOverlay, buildJourneyFrame, riderPlacement, SH, SW } from '@/lib/journeyScene';
import { colors, fonts } from '@/lib/theme';

const SPEED: Record<JourneyMode, number> = { walk: 7, bike: 14, train: 34, plane: 22, parked: 0 }; // scene units / second
type Pop = { id: number; x: number; y: number; text: string; anim: Animated.Value };

/** The side-scrolling journey with the player's traveller. Tap to travel faster. */
export function JourneyScene({ width, mode, avatar, tapLabel, onTap }: {
  width: number; mode: JourneyMode; avatar: Avatar; tapLabel: string; onTap: () => void;
}) {
  const unit = width / SW;
  const [frame, setFrame] = useState(0);
  const offset = useRef(0);
  const burstUntil = useRef(0);
  const last = useRef(Date.now());
  const [reduce, setReduce] = useState(false);
  const [pops, setPops] = useState<Pop[]>([]);
  const popId = useRef(0);

  useEffect(() => { AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => {}); }, []);
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now(), dt = (now - last.current) / 1000; last.current = now;
      const burst = now < burstUntil.current ? 4 : 1;
      offset.current += dt * SPEED[mode] * burst * (reduce ? 0 : 1);
      setFrame((f) => f + 1);
    }, 83);
    return () => clearInterval(id);
  }, [mode, reduce]);

  const grid = useMemo(() => composeAvatar(avatar), [avatar]);
  const place = riderPlacement(mode);
  const rider = useMemo(() => avatarPaths(grid, place.portrait ? { y0: 0, y1: 14 } : undefined), [grid, place.portrait]);
  const t = frame * 83;
  const paths = buildJourneyFrame(mode, offset.current, t);
  const bike = mode === 'bike' ? buildBikeOverlay(t) : [];
  const bob = mode === 'walk' && !reduce ? (Math.floor(t / 250) % 2) * 0.6 : 0;

  function tap(e: { nativeEvent: { locationX: number; locationY: number } }) {
    onTap();
    burstUntil.current = Date.now() + 350;
    const p: Pop = { id: popId.current++, x: e.nativeEvent.locationX, y: e.nativeEvent.locationY, text: tapLabel, anim: new Animated.Value(0) };
    setPops((list) => [...list.slice(-6), p]);
    Animated.timing(p.anim, { toValue: 1, duration: 700, useNativeDriver: true }).start(() => setPops((list) => list.filter((q) => q.id !== p.id)));
  }

  return (
    <Pressable onPress={tap} accessibilityRole="button" accessibilityLabel={`Tap to travel faster. ${tapLabel} per tap.`}
      style={{ width, height: SH * unit, overflow: 'hidden', backgroundColor: '#6FB7E0' }}>
      <Svg width={width} height={SH * unit} viewBox={`0 0 ${SW} ${SH}`} {...({ shapeRendering: 'crispEdges' } as object)}>
        {paths.map((p) => <Path key={p.color} d={p.d} fill={p.color} />)}
        <G transform={`translate(${place.x} ${place.y - bob}) scale(${place.scale})`}>
          {rider.map((p) => <Path key={'r' + p.color} d={p.d} fill={p.color} />)}
        </G>
        {bike.map((p) => <Path key={'b' + p.color} d={p.d} fill={p.color} />)}
      </Svg>
      {pops.map((p) => (
        <Animated.Text key={p.id} pointerEvents="none" style={[styles.pop, {
          left: p.x - 30, top: p.y - 20,
          opacity: p.anim.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }),
          transform: [{ translateY: p.anim.interpolate({ inputRange: [0, 1], outputRange: [0, -36] }) }],
        }]}>{p.text}</Animated.Text>
      ))}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pop: { position: 'absolute', width: 60, textAlign: 'center', fontFamily: fonts.labelBold, fontSize: 12, color: colors.paper, textShadowColor: colors.ink, textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 0 },
});

