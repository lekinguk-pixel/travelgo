import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Character } from '@/components/Character';
import { PixelArt, pixelPaths } from '@/components/PixelArt';
import { DEFAULT_AVATAR, type Avatar } from '@/lib/avatar';
import { colors, fonts } from '@/lib/theme';

function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => { AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => {}); }, []);
  return reduce;
}
function useTicker(ms: number, on = true) {
  const [t, setT] = useState(0);
  useEffect(() => { if (!on) return; const id = setInterval(() => setT((n) => n + 1), ms); return () => clearInterval(id); }, [ms, on]);
  return t;
}

// ---------- Pip, the postal pigeon who guides new travellers ----------
const PIP = [
  '................', '......kkkk......', '.....kbbbbk.....', '....kbbbbbbyk...', '...kkkkkkkkkkk..', '...kgggggggggk..',
  '..kgwkgggggggk..', '.kogggggggggggk.', '..kgggggggggggk.', '...kpppppppppk..', '..kgggggggggggk.', '.kggsssssgggggk.',
  '.kggsyyysgggggk.', '..kgsssssggggk..', '...kkggkkggkk...', '....oo...oo.....',
];
const PIP_COL = { b: '#2F6FCF', y: '#F2C230', k: '#1B2A41', g: '#B9C2CF', w: '#FFFFFF', o: '#E07B1F', p: '#6E9F7A', s: '#9C6A3E' };
export function Pip({ scale = 4 }: { scale?: number }) {
  return <PixelArt rows={PIP} palette={PIP_COL} scale={scale} />;
}

// ---------- 1: the weekly loop ----------
const HOUSE = ['...rr...', '..rrrr..', '.rrrrrr.', 'rrrrrrrr', '.wwwwww.', '.wbwwkw.', '.wbwwkw.', '.wwwwww.'];
const CASE = ['..kkkk..', '..k..k..', 'bbbbbbbb', 'bbbbbbbb', 'bbbyybbb', 'bbbbbbbb', 'bbbbbbbb'];
const BED = ['.....zz.', '......z.', '.....zz.', 'k.......', 'kppwwwww', 'kbbbbbbk', 'k......k'];
const PHONE = ['.kkkkk.', '.kllllk', '.kllllk', '.kllllk', '.kllllk', '.kkyykk'];
const ICON_COL = { r: '#C8553D', w: '#F6F0E2', b: '#2F6FCF', k: '#1B2A41', y: '#F2C230', p: '#E58FB1', z: '#A7B1BC', l: '#5AA9E6' };
export function LoopArt({ size = 220 }: { size?: number }) {
  const reduce = useReduceMotion();
  const t = useTicker(80, !reduce);
  const c = size / 2, r = size * 0.36;
  const stops = [HOUSE, CASE, PHONE, BED];
  const labels = ['HOME', 'WORK', 'SCROLL', 'SLEEP'];
  const a = ((t % 90) / 90) * Math.PI * 2 - Math.PI / 2;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={c} cy={c} r={r} stroke="rgba(246,240,226,0.35)" strokeWidth={4} strokeDasharray="6 8" fill="none" />
        {/* Arrow heads showing it goes round and round */}
        {[0, 1, 2, 3].map((i) => {
          const aa = (i / 4) * Math.PI * 2 + Math.PI / 4 - Math.PI / 2;
          const x = c + r * Math.cos(aa), y = c + r * Math.sin(aa);
          const rot = (aa * 180) / Math.PI + 90;
          return <Path key={i} d="M-6 -4 L0 4 L6 -4" stroke={colors.gold} strokeWidth={3} fill="none" transform={`translate(${x} ${y}) rotate(${rot})`} />;
        })}
      </Svg>
      {stops.map((rows, i) => {
        const aa = (i / 4) * Math.PI * 2 - Math.PI / 2;
        return (
          <View key={i} style={{ position: 'absolute', left: c + r * Math.cos(aa) - 20, top: c + r * Math.sin(aa) - 22, width: 40, alignItems: 'center' }}>
            <View style={styles.iconTile}><PixelArt rows={rows} palette={ICON_COL} scale={3} /></View>
            <Text style={styles.iconLabel}>{labels[i]}</Text>
          </View>
        );
      })}
      {/* The tiny traveller going round the loop */}
      <View style={{ position: 'absolute', left: c + r * Math.cos(a) - 7, top: c + r * Math.sin(a) - 12 }}>
        <Character avatar={DEFAULT_AVATAR} size={1} noPet />
      </View>
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={styles.big}>REPEAT</Text>
        <Text style={styles.small}>×52 a year</Text>
      </View>
    </View>
  );
}

// ---------- 2: someday never comes ----------
const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'NEXT YEAR', 'SOMEDAY'];
export function SomedayArt({ size = 220 }: { size?: number }) {
  const reduce = useReduceMotion();
  const [i, setI] = useState(reduce ? DAYS.length - 1 : 0);
  const flip = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) { setI(DAYS.length - 1); return; }
    let n = 0;
    const id = setInterval(() => {
      n = n + 1;
      if (n >= DAYS.length + 6) n = 0;                  // linger on SOMEDAY, then flip again
      if (n < DAYS.length) {
        flip.setValue(0);
        Animated.timing(flip, { toValue: 1, duration: 260, useNativeDriver: true }).start();
        setI(n);
      }
    }, 650);
    return () => clearInterval(id);
  }, [reduce, flip]);
  const some = DAYS[i] === 'SOMEDAY';
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={[styles.cal, { width: size * 0.72, height: size * 0.78 }]}>
        <View style={styles.calTop}>
          {[0, 1].map((k) => <View key={k} style={styles.ring} />)}
        </View>
        <Animated.View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6,
          opacity: flip.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }),
          transform: [{ translateY: flip.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }) }] }}>
          <Text style={[styles.day, some ? { color: colors.stamp, fontSize: 26 } : null]} numberOfLines={1} adjustsFontSizeToFit>{DAYS[i]}</Text>
          <Text style={styles.dayNote}>{some ? 'never on the calendar' : 'busy busy busy'}</Text>
          {some ? <Text style={styles.q}>?</Text> : null}
        </Animated.View>
      </View>
    </View>
  );
}

// ---------- 3: a big world (a spinning pixel globe) ----------
const LAND_W = 64, LAND_H = 30;
function isLand(x: number, y: number) {
  // Smooth blobby "continents" from a few sine waves, wrapping east-west.
  const u = (x / LAND_W) * Math.PI * 2, v = (y / LAND_H) * Math.PI;
  const n = Math.sin(u * 2 + 0.6) * Math.sin(v * 1.6 + 0.3) + 0.6 * Math.sin(u * 3.3 + v * 2.1) + 0.45 * Math.cos(u * 5.1 - v * 3.7);
  return n > 0.42;
}
export function GlobeArt({ size = 220 }: { size?: number }) {
  const reduce = useReduceMotion();
  const t = useTicker(110, !reduce);
  const D = 30, R = D / 2;
  const rows = useMemo(() => {
    const out: string[] = [];
    for (let y = 0; y < D; y++) {
      let row = '';
      for (let x = 0; x < D; x++) {
        const dx = x - R + 0.5, dy = y - R + 0.5, d = Math.sqrt(dx * dx + dy * dy);
        if (d > R) { row += '.'; continue; }
        if (d > R - 1.2) { row += 'k'; continue; }
        if (y < 3 || y > D - 4) { row += 'i'; continue; }
        // Sphere mapping: longitude from x offset, so the land slides around the globe.
        const lon = Math.asin(Math.max(-1, Math.min(1, dx / Math.sqrt(Math.max(0.01, R * R - dy * dy))))) / Math.PI; // -0.5..0.5
        const lx = Math.floor((lon + 0.5) * LAND_W / 2 + t) % LAND_W;
        const shade = dx > R * 0.35;
        row += isLand(lx, y) ? (shade ? 'G' : 'g') : (shade ? 'O' : 'o');
      }
      out.push(row);
    }
    return out;
  }, [t]);
  const pal = { k: colors.ink, i: '#F6F0E2', g: '#3E9B4F', G: '#2E7A3C', o: '#2F6FCF', O: '#22539F' };
  const scale = Math.floor(size / D);
  const sparkle = t % 12;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={D * scale} height={D * scale} viewBox={`0 0 ${D} ${D}`} {...({ shapeRendering: 'crispEdges' } as object)}>
        {pixelPaths(rows, pal).map((p) => <Path key={p.color} d={p.d} fill={p.color} />)}
        <Path d="M8 6h3v1h-3z M6 8h1v3h-1z" fill="rgba(255,255,255,0.55)" />
      </Svg>
      {[[0.1, 0.15], [0.85, 0.2], [0.78, 0.85], [0.12, 0.8]].map(([x, y], i) => (
        <Text key={i} style={[styles.spark, { left: x * size, top: y * size, opacity: (sparkle + i * 3) % 12 < 6 ? 1 : 0.2 }]}>✦</Text>
      ))}
    </View>
  );
}

// ---------- 4: visit, snap, stamp ----------
export function StampArt({ size = 220 }: { size?: number }) {
  const reduce = useReduceMotion();
  const drop = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  const [inked, setInked] = useState(reduce);
  useEffect(() => {
    if (reduce) return;
    const run = () => {
      setInked(false); drop.setValue(0);
      Animated.sequence([
        Animated.delay(500),
        Animated.timing(drop, { toValue: 1, duration: 260, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]).start(() => {
        setInked(true);
        Animated.timing(drop, { toValue: 0, duration: 420, delay: 160, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
      });
    };
    run();
    const id = setInterval(run, 2600);
    return () => clearInterval(id);
  }, [reduce, drop]);
  const HANDLE = ['..mmmm..', '.mmmmmm.', '..mmmm..', '...mm...', '...mm...', 'kkkkkkkk', 'rrrrrrrr'];
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={[styles.passport, { width: size * 0.8, height: size * 0.62 }]}>
        <Text style={styles.passHead}>PASSPORT · STAMPS</Text>
        {[0, 1, 2, 3].map((k) => <View key={k} style={styles.passLine} />)}
        <View style={[styles.oldStamp, { right: 14, top: 26 }]}><Text style={styles.oldStampText}>LONDON</Text></View>
        {inked ? (
          <View style={styles.newStamp}>
            <Text style={styles.newStampTop}>mmGO</Text>
            <Text style={styles.newStampBig}>STAMPED!</Text>
          </View>
        ) : null}
      </View>
      <Animated.View style={{ position: 'absolute', top: size * 0.02,
        transform: [{ translateY: drop.interpolate({ inputRange: [0, 1], outputRange: [0, size * 0.36] }) }] }}>
        <PixelArt rows={HANDLE} palette={{ m: '#B5784A', k: colors.ink, r: colors.stamp }} scale={7} />
      </Animated.View>
    </View>
  );
}

// ---------- 5: your story starts (sunrise and the open road) ----------
export function SunriseArt({ size = 220, avatar }: { size?: number; avatar?: Avatar }) {
  const reduce = useReduceMotion();
  const rise = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  const t = useTicker(260, !reduce);
  useEffect(() => {
    if (reduce) return;
    Animated.timing(rise, { toValue: 1, duration: 2200, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [reduce, rise]);
  const horizon = size * 0.62;
  return (
    <View style={{ width: size, height: size, overflow: 'hidden' }}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#F2A65A' }]} />
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: horizon * 0.5, backgroundColor: '#E07B5A' }} />
      <Animated.View style={{ position: 'absolute', left: size / 2 - size * 0.2, top: horizon - size * 0.2, width: size * 0.4, height: size * 0.4,
        backgroundColor: '#FFE27A', borderRadius: size * 0.2,
        transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [size * 0.3, 0] }) }] }} />
      {/* Hills and the road */}
      <View style={{ position: 'absolute', left: 0, right: 0, top: horizon, bottom: 0, backgroundColor: '#3E9B4F' }} />
      <View style={{ position: 'absolute', left: size * 0.43, width: size * 0.14, top: horizon, bottom: 0, backgroundColor: '#D9B98A', transform: [{ perspective: 200 }, { rotateX: '60deg' }] }} />
      <View style={{ position: 'absolute', left: size / 2 - 2, top: horizon + 10, width: 4, height: 8, backgroundColor: colors.paper }} />
      <View style={{ position: 'absolute', left: size / 2 - 2, top: horizon + 30, width: 4, height: 10, backgroundColor: colors.paper }} />
      <View style={{ position: 'absolute', left: size / 2 - 22, bottom: 8, transform: [{ translateY: t % 2 ? -2 : 0 }] }}>
        <Character avatar={avatar ?? DEFAULT_AVATAR} size={3} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  iconTile: { backgroundColor: colors.paper, borderWidth: 2, borderColor: colors.ink, padding: 3 },
  iconLabel: { fontFamily: fonts.labelBold, fontSize: 9, color: colors.paper, marginTop: 2 },
  big: { fontFamily: fonts.display, fontSize: 24, color: colors.gold },
  small: { fontFamily: fonts.label, fontSize: 10, color: colors.paper },
  cal: { backgroundColor: colors.paper, borderWidth: 3, borderColor: colors.ink },
  calTop: { height: 30, backgroundColor: colors.stamp, borderBottomWidth: 3, borderBottomColor: colors.ink, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-start' },
  ring: { width: 10, height: 16, marginTop: -8, backgroundColor: colors.silver, borderWidth: 2, borderColor: colors.ink },
  day: { fontFamily: fonts.display, fontSize: 22, color: colors.ink, paddingHorizontal: 8 },
  dayNote: { fontFamily: fonts.label, fontSize: 9, color: colors.muted },
  q: { fontFamily: fonts.display, fontSize: 34, color: colors.stamp },
  spark: { position: 'absolute', fontSize: 16, color: '#FFE27A' },
  passport: { backgroundColor: '#F3E6C8', borderWidth: 3, borderColor: colors.ink, padding: 12, gap: 12, marginTop: 40 },
  passHead: { fontFamily: fonts.labelBold, fontSize: 9, color: colors.muted, letterSpacing: 1 },
  passLine: { height: 2, backgroundColor: 'rgba(27,42,65,0.12)' },
  oldStamp: { position: 'absolute', borderWidth: 2, borderColor: colors.teal, paddingHorizontal: 6, paddingVertical: 3, transform: [{ rotate: '8deg' }] },
  oldStampText: { fontFamily: fonts.labelBold, fontSize: 9, color: colors.teal },
  newStamp: { position: 'absolute', left: 18, bottom: 14, borderWidth: 3, borderColor: colors.stamp, paddingHorizontal: 10, paddingVertical: 4, transform: [{ rotate: '-8deg' }], alignItems: 'center' },
  newStampTop: { fontFamily: fonts.labelBold, fontSize: 9, color: colors.stamp },
  newStampBig: { fontFamily: fonts.display, fontSize: 18, color: colors.stamp },
});
