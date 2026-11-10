import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet, Text } from 'react-native';
import Svg, { G, Path, Rect } from 'react-native-svg';
import { avatarPaths, composeAvatar, composeTraveller, type Avatar } from '@/lib/avatar';
import type { JourneyMode } from '@/lib/journey';
import { buildBikeOverlay, buildJourneyFrame, riderPlacement, SH, SW } from '@/lib/journeyScene';
import { colors, fonts } from '@/lib/theme';

const SPEED: Record<JourneyMode, number> = { walk: 7, bike: 14, train: 34, plane: 22, parked: 0 }; // scene units / second
type Pop = { id: number; x: number; y: number; text: string; coins: number; dx: number; anim: Animated.Value };

// A chunky pixel coin.
const COIN = ['..aaa..', '.abbba.', 'abbcbba', 'abbcbba', 'abbcbba', '.abbba.', '..aaa..'];
const COIN_COL: Record<string, string> = { a: '#8A5A12', b: '#F2C230', c: '#FFF1A8' };
export function PixelCoin({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 7 7" {...({ shapeRendering: 'crispEdges' } as object)}>
      {COIN.flatMap((row, y) => [...row].map((ch, x) => (ch === '.' ? null : <Rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={COIN_COL[ch]} />)))}
    </Svg>
  );
}

/** The side-scrolling journey with the player's traveller. Tap to travel faster. */
export function JourneyScene({ width, mode, avatar, tapLabel, onTap }: {
  width: number; mode: JourneyMode; avatar: Avatar; tapLabel: string; onTap: () => number; // returns coins dropped by this tap
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

  const place = riderPlacement(mode);
  const grid = useMemo(() => (place.portrait ? composeAvatar(avatar) : composeTraveller(avatar)), [avatar, place.portrait]);
  const rider = useMemo(() => avatarPaths(grid, place.portrait ? { y0: 0, y1: 14 } : undefined), [grid, place.portrait]);
  const t = frame * 83;
  const paths = buildJourneyFrame(mode, offset.current, t);
  const bike = mode === 'bike' ? buildBikeOverlay(t) : [];
  const bob = mode === 'walk' && !reduce ? (Math.floor(t / 250) % 2) * 0.6 : 0;

  function tap(e: { nativeEvent: { locationX: number; locationY: number } }) {
    const coins = onTap();
    burstUntil.current = Date.now() + 350;
    const { locationX: x, locationY: y } = e.nativeEvent;
    const make = (text: string, c: number, dx = 0): Pop => ({ id: popId.current++, x, y, text, coins: c, dx, anim: new Animated.Value(0) });
    // Jackpots shower several coins; a normal coin drop pops one big coin; other taps show the distance.
    const fresh = coins >= 10 ? [make(`+${coins} JACKPOT!`, coins), ...[-46, -24, 24, 46].map((dx) => make('', 1, dx))]
      : coins > 0 ? [make(`+${coins}`, coins)] : [make(tapLabel, 0)];
    setPops((list) => [...list.slice(-10), ...fresh]);
    fresh.forEach((p) => Animated.timing(p.anim, { toValue: 1, duration: p.coins ? 900 : 650, useNativeDriver: true })
      .start(() => setPops((list) => list.filter((q) => q.id !== p.id))));
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
      {pops.map((p) => p.coins ? (
        <Animated.View key={p.id} pointerEvents="none" style={[styles.coinPop, {
          left: p.x - 40 + p.dx, top: p.y - 34,
          opacity: p.anim.interpolate({ inputRange: [0, 0.75, 1], outputRange: [1, 1, 0] }),
          transform: [
            { translateY: p.anim.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, -46, -30] }) },
            { translateX: p.anim.interpolate({ inputRange: [0, 1], outputRange: [0, p.dx * 0.4] }) },
            { scale: p.anim.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.4, p.coins >= 10 ? 1.5 : 1.2, 1] }) },
          ],
        }]}>
          <PixelCoin size={p.coins >= 10 ? 30 : 24} />
          {p.text ? <Text style={[styles.coinText, p.coins >= 10 ? { fontSize: 15 } : null]}>{p.text}</Text> : null}
        </Animated.View>
      ) : (
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
  coinPop: { position: 'absolute', width: 80, alignItems: 'center', gap: 2 },
  coinText: { fontFamily: fonts.labelBold, fontSize: 13, color: '#FFE27A', textShadowColor: colors.ink, textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 0 },
  pop: { position: 'absolute', width: 60, textAlign: 'center', fontFamily: fonts.labelBold, fontSize: 12, color: colors.paper, textShadowColor: colors.ink, textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 0 },
});

