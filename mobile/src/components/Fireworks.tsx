import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

// RuneScape-style pixel fireworks. "small" plays after every stamp; "big" for
// level-ups, quests and city chapters; "epic" for a level 99 or a gold chapter.

export type FireworksSize = 'small' | 'big' | 'epic';

const CELLS_ACROSS = 72;
const TICK_MS = 50;
const GRAVITY = 0.035;
const COLOURS = ['#D9A441', '#F7C766', '#C8553D', '#2F6FCF', '#8E44C9', '#3E9B4F', '#E07B1F', '#F6F0E2'];
const PLAN: Record<FireworksSize, { rockets: number; over: number; spark: [number, number]; gold: boolean }> = {
  small: { rockets: 4, over: 1400, spark: [22, 30], gold: false },
  big: { rockets: 12, over: 3600, spark: [30, 42], gold: false },
  epic: { rockets: 26, over: 6500, spark: [38, 54], gold: true },
};

type Rocket = { x: number; y: number; vy: number; burstAt: number; colour: string };
type Spark = { x: number; y: number; vx: number; vy: number; life: number; max: number; colour: string };

export function Fireworks({ size, onDone }: { size: FireworksSize; onDone?: () => void }) {
  const { width, height } = useWindowDimensions();
  const cell = width / CELLS_ACROSS;
  const rows = Math.ceil(height / cell);
  const [, setFrame] = useState(0);
  const [reduce, setReduce] = useState<boolean | null>(null);
  const rockets = useRef<Rocket[]>([]);
  const sparks = useRef<Spark[]>([]);

  useEffect(() => { AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => setReduce(false)); }, []);

  useEffect(() => {
    if (reduce === null) return;
    if (reduce) { onDone?.(); return; }
    const plan = PLAN[size];
    const start = Date.now();
    let launched = 0;
    const launch = () => {
      const colour = plan.gold && Math.random() < 0.4 ? '#D9A441' : COLOURS[Math.floor(Math.random() * COLOURS.length)];
      rockets.current.push({
        x: 6 + Math.random() * (CELLS_ACROSS - 12), y: rows + 1,
        vy: -(1.6 + Math.random() * 0.8), burstAt: rows * (0.12 + Math.random() * 0.35), colour,
      });
    };
    const burst = (r: Rocket) => {
      const [lo, hi] = plan.spark;
      const n = lo + Math.floor(Math.random() * (hi - lo));
      const second = Math.random() < 0.35 ? COLOURS[Math.floor(Math.random() * COLOURS.length)] : r.colour;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.2;
        const speed = 0.7 + Math.random() * (size === 'small' ? 0.7 : 1.1);
        const max = 14 + Math.floor(Math.random() * 12);
        sparks.current.push({ x: r.x, y: r.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: max, max, colour: i % 3 === 0 ? second : r.colour });
      }
      if (size !== 'small') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    };
    const id = setInterval(() => {
      const t = Date.now() - start;
      while (launched < plan.rockets && t >= (launched / plan.rockets) * plan.over) { launch(); launched++; }
      rockets.current = rockets.current.filter((r) => {
        r.y += r.vy;
        if (r.y <= r.burstAt) { burst(r); return false; }
        return true;
      });
      sparks.current = sparks.current.filter((s) => {
        s.x += s.vx; s.y += s.vy; s.vy += GRAVITY; s.vx *= 0.97; s.life -= 1;
        return s.life > 0;
      });
      setFrame((f) => f + 1);
      if (launched >= plan.rockets && rockets.current.length === 0 && sparks.current.length === 0) {
        clearInterval(id);
        onDone?.();
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, [reduce, size, rows]); // eslint-disable-line react-hooks/exhaustive-deps

  if (reduce !== false) return null;

  // Group cells by colour and brightness so each frame is a handful of paths.
  const paths = new Map<string, string[]>();
  const add = (key: string, x: number, y: number) => {
    const gx = Math.round(x), gy = Math.round(y);
    if (gx < 0 || gx >= CELLS_ACROSS || gy < 0 || gy >= rows) return;
    const list = paths.get(key) ?? [];
    list.push(`M${gx} ${gy}h1v1h-1z`);
    paths.set(key, list);
  };
  for (const r of rockets.current) {
    add(`${r.colour}|1`, r.x, r.y);
    add(`#F7C766|0.6`, r.x, r.y + 1);
    if (Math.random() < 0.6) add(`#F6F0E2|0.4`, r.x + (Math.random() < 0.5 ? -1 : 1) * Math.random(), r.y + 2 + Math.random() * 2);
  }
  for (const s of sparks.current) {
    const k = s.life / s.max;
    const alpha = k > 0.66 ? 1 : k > 0.33 ? 0.65 : 0.3;
    add(`${s.colour}|${alpha}`, s.x, s.y);
    if (k > 0.5) add(`${s.colour}|0.3`, s.x - s.vx, s.y - s.vy);
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants">
      <Svg width={width} height={rows * cell} viewBox={`0 0 ${CELLS_ACROSS} ${rows}`} {...({ shapeRendering: 'crispEdges' } as object)}>
        {[...paths.entries()].map(([key, parts]) => {
          const [colour, alpha] = key.split('|');
          return <Path key={key} d={parts.join('')} fill={colour} fillOpacity={Number(alpha)} />;
        })}
      </Svg>
    </View>
  );
}
