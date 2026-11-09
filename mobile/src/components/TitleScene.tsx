import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, useWindowDimensions, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { backPalette, DEFAULT_AVATAR, type Avatar } from '@/lib/avatar';
import { HERO_MINI, HERO_TOP, LEGS_A, LEGS_B, type Bitmap, type Palette } from '@/lib/pixel';

// The mmGO title scene: a traveller at the edge of their home town at dawn.
// Same artwork and timings as design/title-screen-prototype.html.

const W = 69, H = 90;
type Grid = (string | null)[][];
const blank = (): Grid => Array.from({ length: H }, () => Array<string | null>(W).fill(null));

function gridToPaths(grid: Grid) {
  const by = new Map<string, string[]>();
  for (let y = 0; y < H; y++) {
    let x = 0;
    while (x < W) {
      const c = grid[y][x];
      if (!c) { x++; continue; }
      let e = x;
      while (e + 1 < W && grid[y][e + 1] === c) e++;
      const list = by.get(c) ?? [];
      list.push(`M${x} ${y}h${e - x + 1}v1h-${e - x + 1}z`);
      by.set(c, list);
      x = e + 1;
    }
  }
  return [...by.entries()].map(([color, parts]) => ({ color, d: parts.join('') }));
}

// Merge single-pixel lights with the same colour and (rounded) brightness into one path each.
function groupCells(cells: { x: number; y: number; c: string; a: number }[]) {
  const by = new Map<string, { c: string; a: number; d: string[] }>();
  for (const cell of cells) {
    const a = Math.round(Math.max(0, Math.min(1, cell.a)) * 10) / 10;
    if (a <= 0) continue;
    const k = cell.c + a;
    let g = by.get(k); if (!g) { g = { c: cell.c, a, d: [] }; by.set(k, g); }
    g.d.push(`M${cell.x} ${cell.y}h1v1h-1z`);
  }
  return [...by.entries()].map(([k, g]) => ({ k, c: g.c, a: g.a, d: g.d.join('') }));
}

function stamp(grid: Grid, rows: Bitmap, ox: number, oy: number, map: Palette) {
  rows.forEach((r, y) => [...r].forEach((ch, x) => {
    const c = map[ch];
    if (ch !== '.' && c && oy + y >= 0 && oy + y < H && ox + x >= 0 && ox + x < W) grid[oy + y][ox + x] = c;
  }));
}

const pathX = (y: number) => { const t = (y - 63) / (H - 1 - 63); return Math.round(45 + (33 - 45) * t + 3 * Math.sin(t * 3.2)); };

function buildStatic() {
  const sky = blank(), fg = blank();
  const bands: [number, string][] = [[0,'#1F2250'],[10,'#2E2C6E'],[19,'#4B3290'],[27,'#7A3E98'],[34,'#B44E86'],[41,'#E0705F'],[48,'#F29A4E'],[54,'#F7C766']];
  for (let y = 0; y < 64; y++) {
    let i = 0; bands.forEach((b, k) => { if (y >= b[0]) i = k; });
    for (let x = 0; x < W; x++) {
      let c = bands[i][1]; const nx = bands[i + 1];
      if (nx && y === nx[0] - 1 && (x + y) % 2 === 0) c = nx[1];
      sky[y][x] = c;
    }
  }
  const peaks: [number, number][] = [[4,46],[17,49],[29,43],[56,47],[66,50]];
  for (let x = 0; x < W; x++) {
    let h = 99; peaks.forEach(([p, ph]) => { h = Math.min(h, ph + Math.abs(x - p)); });
    for (let y = h; y <= 63; y++) fg[y][x] = y === h ? '#6A4C93' : '#4A3570';
  }
  const sil = { '#': '#33285A' };
  stamp(fg, ['..#..','..#..','..#..','.###.','..#..','.###.','.#.#.','.###.','.#.#.','##.##','#...#','#...#'], 22, 49, sil);
  stamp(fg, ['...#...','.#####.','#######','..###..','.#####.','#######','..###..','..#.#..','..###..'], 60, 52, sil);
  stamp(fg, ['...#...','..###..','.#####.','#######','#######','#.#.#.#','#######'], 39, 54, sil);
  stamp(fg, ['.#.','.#.','###','###','###','###'], 50, 55, sil);
  for (let x = 0; x < W; x++) { const h = 62 + Math.round(2.5 * Math.sin(x / 6)); for (let y = h; y < H; y++) fg[y][x] = y === h ? '#3F8A5E' : '#2F6B4F'; }
  for (let x = 0; x < W; x++) { const h = 70 + Math.round(2 * Math.sin(x / 5 + 1)); for (let y = h; y < H; y++) fg[y][x] = y === h ? '#8ACB6E' : y === h + 1 ? '#6DB662' : '#4E9F5A'; }
  for (let y = 63; y < H; y++) {
    const t = (y - 63) / (H - 1 - 63); const cx = pathX(y); const w = Math.round(1 + 12 * t * t + 2 * t);
    for (let x = cx - w; x <= cx + w; x++) if (x >= 0 && x < W) fg[y][x] = x === cx - w || x === cx + w ? '#C9A465' : '#E8C98A';
  }
  let seed = 11; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  for (let i = 0; i < 40; i++) { const x = Math.floor(rnd() * W), y = 72 + Math.floor(rnd() * 17); if (fg[y][x] === '#4E9F5A') fg[y][x] = '#3F8A5E'; }
  const house = { R: '#C8553D', r: '#9E3F2D', W: '#F6F0E2', O: '#F7C766', D: '#1B2A41', K: '#6E4A2E' };
  const hb = ['......K..','...RRRK..','..RRRRR..','.RRRRRRR.','rrrrrrrrr','.WWWWWWW.','.WOWWWOW.','.WWWDWWW.','.WWWDWWW.'];
  stamp(fg, hb, 2, 69, house); stamp(fg, hb, 12, 72, house);
  stamp(fg, ['..RRR..','.RRRRR.','rrrrrrr','.WWWWW.','.WOWDW.','.WWWDW.'], 1, 80, house);
  const tree = { G: '#2F6B4F', g: '#3F8A5E', T: '#6E4A2E' }; const tb = ['.ggg.','gGGGg','GGGGG','.GGG.','..T..','..T..'];
  stamp(fg, tb, 22, 72, tree); stamp(fg, tb, 9, 82, tree);
  stamp(fg, ['SSSSSSS','SPSSSPS','...P...','...P...','...P...','...P...'], 46, 74, { S: '#E8C98A', P: '#6E4A2E' });
  const stars = Array.from({ length: 34 }, () => ({ x: Math.floor(rnd() * W), y: Math.floor(rnd() * 18), gold: rnd() > 0.7, s: 0.8 + rnd() * 2.4, p: rnd() * 6.28 }));
  return { sky: gridToPaths(sky), fg: gridToPaths(fg), stars };
}

const CLOUD: Bitmap = ['..####....','.######.##','##########'];
const CLOUDS = [{ x: 4, y: 24, v: 0.9 }, { x: 40, y: 31, v: 0.6 }, { x: 58, y: 18, v: 1.2 }];
const BIRDS = [{ x: -4, y: 33, v: 4.5, p: 0 }, { x: -12, y: 29, v: 4.0, p: 1.3 }, { x: -20, y: 35, v: 4.8, p: 2.2 }];
const CHIMNEYS: [number, number][] = [[8, 68], [18, 71]];

// Cozy extras: glowing windows, lanterns, a campfire and fireflies.
const WINDOWS: [number, number][] = [[4, 75], [8, 75], [14, 78], [18, 78], [3, 84]];
const LANTERNS: [number, number][] = [[37, 68], [51, 62]];
const FIRE = { x: 55, y: 83 };
const FLAMES: Bitmap[] = [
  ['..a..', '..a..', '.aba.', '.bcb.', 'bcdcb'],
  ['.a...', '..a..', '..ab.', '.bcb.', 'bcdcb'],
  ['...a.', '..a..', '.ba..', '.bcb.', 'bcdcb'],
  ['.....', '..a..', '.aba.', 'abcba', 'bcdcb'],
];
const MOON: Bitmap = ['..###..', '.##....', '##.....', '##.....', '##.....', '.##....', '..###..'];
const FLAME_PAL = { a: '#FFE7A3', b: '#F7C766', c: '#E0705F', d: '#C8553D' };

// Extra sky above the scene and extra meadow below it, so the scene can fill a tall screen.
function buildExtras(top: number, bottom: number) {
  const rects: { d: string; c: string }[] = [];
  const sky: Record<string, string[]> = {};
  const add = (c: string, x: number, y: number, w = 1) => { (sky[c] ??= []).push(`M${x} ${y}h${w}v1h-${w}z`); };
  for (let y = -top; y < 0; y++) {
    const deep = y < -top * 0.55;
    const c = deep ? '#141633' : '#1A1D45';
    add(c, 0, y, W);
    if (y === Math.floor(-top * 0.55)) for (let x = 0; x < W; x += 2) add('#1A1D45', x + (y & 1), y);
    if (y === -1) for (let x = 0; x < W; x += 2) add('#1F2250', x, y);
  }
  let seed = 7; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  for (let y = H; y < H + bottom; y++) {
    const t = Math.min(1, (y - 63) / (H - 1 - 63));
    const cx = pathX(Math.min(H - 1, y)) - Math.round((y - H) * 0.15);
    const w = Math.round(1 + 12 * t * t + 2 * t) + Math.round((y - H) * 0.25);
    add('#4E9F5A', 0, y, W);
    for (let x = Math.max(0, cx - w); x <= Math.min(W - 1, cx + w); x++) add(x === cx - w || x === cx + w ? '#C9A465' : '#E8C98A', x, y);
  }
  for (let i = 0; i < bottom * 3; i++) {
    const x = Math.floor(rnd() * W), y = H + Math.floor(rnd() * bottom);
    add(['#3F8A5E', '#3F8A5E', '#F6B07A', '#F7C766', '#E0705F'][Math.floor(rnd() * 5)], x, y);
  }
  for (const [c, parts] of Object.entries(sky)) rects.push({ c, d: parts.join('') });
  const stars = Array.from({ length: Math.round((top * W) / 45) }, () => ({
    x: Math.floor(rnd() * W), y: -top + Math.floor(rnd() * Math.max(1, top)), gold: rnd() > 0.75, big: rnd() > 0.85, s: 0.6 + rnd() * 2.2, p: rnd() * 6.28,
  }));
  const flies = Array.from({ length: 14 }, () => ({ x: rnd() * W, y: 64 + rnd() * (H - 64 + bottom * 0.25), s: 0.3 + rnd() * 0.6, p: rnd() * 6.28, r: 1.5 + rnd() * 3 }));
  return { rects, stars, flies };
}

type Props = {
  avatar?: Avatar; walking?: boolean; onWalkDone?: () => void;
  /** Fill this height (dp) by adding sky above and meadow below. */
  height?: number;
  /** Extra meadow (dp) at the bottom, e.g. behind a panel laid over the scene. */
  groundPad?: number;
};

export function TitleScene({ avatar = DEFAULT_AVATAR, walking = false, onWalkDone, height: target, groundPad = 0 }: Props) {
  const { width } = useWindowDimensions();
  const statics = useMemo(buildStatic, []);
  const unit = width / W;
  const bottom = target ? Math.ceil(groundPad / unit) : 0;
  const top = target ? Math.max(0, Math.ceil(target / unit - H - bottom)) : 0;
  const extras = useMemo(() => buildExtras(top, bottom), [top, bottom]);
  const sparks = useRef<{ x: number; y: number; born: number; drift: number }[]>([]);
  const [t, setT] = useState(0);
  const [reduce, setReduce] = useState(false);
  const t0 = useRef(Date.now());
  const walkStart = useRef<number | null>(null);
  const smoke = useRef<{ x: number; y: number; born: number; drift: number }[]>([]);
  const doneRef = useRef(false);

  useEffect(() => { AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => {}); }, []);
  useEffect(() => {
    const id = setInterval(() => setT(Date.now() - t0.current), 90);   // ~11 fps keeps the pixel feel
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (walking) { walkStart.current = Date.now(); doneRef.current = false; } else walkStart.current = null;
  }, [walking]);

  // ---- dynamic layers for this frame ----
  const back = blank(), front = blank();
  const starCells: { x: number; y: number; c: string; a: number }[] = [];
  const smokeCells: { x: number; y: number; c: string; a: number }[] = [];
  const dawn = Math.min(1, t / 6000);
  statics.stars.forEach((s) => starCells.push({ x: s.x, y: s.y, c: s.gold ? '#F7C766' : '#F6F0E2', a: (reduce ? 0.8 : 0.35 + 0.65 * Math.abs(Math.sin((t / 1000) * s.s + s.p))) * (1 - dawn * 0.5) }));
  const sunY = reduce ? 59 : Math.max(59, 72 - (t / 4000) * 13);
  for (let y = Math.ceil(sunY - 12); y <= 61; y++) for (let x = 34; x <= 58; x++) {
    const d = Math.hypot(x - 46, y - sunY);
    if (y >= 0 && d <= 12 && !(y > 51 && (y === 53 || y === 56 || y === 58))) back[y][x] = d > 10.8 ? '#FFD27A' : '#FFE7A3';
  }
  CLOUDS.forEach((c) => {
    const x = Math.floor(((c.x + (reduce ? 0 : (t / 1000) * c.v)) % (W + 14)) - 10);
    stamp(back, CLOUD, x, c.y, { '#': '#F6B07A' });
    for (let i = 0; i < 10; i++) if (x + i >= 0 && x + i < W) back[c.y + 2][x + i] = '#D9826E';
  });
  if (!reduce) BIRDS.forEach((b) => {
    const x = Math.floor((b.x + (t / 1000) * b.v) % (W + 30));
    stamp(back, Math.floor(t / 220 + b.p) % 2 === 0 ? ['#.#', '.#.'] : ['.#.', '#.#'], x, b.y, { '#': '#2E2C6E' });
  });
  if (!reduce) {
    CHIMNEYS.forEach(([x, y]) => { if (Math.random() < 0.25) smoke.current.push({ x, y, born: t, drift: 0.4 + Math.random() * 0.6 }); });
    smoke.current = smoke.current.filter((s) => (t - s.born) / 1000 <= 2.6);
    smoke.current.forEach((s) => { const age = (t - s.born) / 1000; smokeCells.push({ x: Math.round(s.x + age * s.drift * 2), y: Math.round(s.y - age * 4), c: '#F6F0E2', a: 0.75 * (1 - age / 2.6) }); });
  }
  const pal = backPalette(avatar);
  if (walkStart.current === null) {
    const bob = reduce ? 0 : Math.floor(t / 520) % 2;
    stamp(front, HERO_TOP, 31, 77 + bob, pal); stamp(front, LEGS_A, 31, 85, pal);
  } else {
    const elapsed = Date.now() - walkStart.current;
    const k = Math.min(1, elapsed / 5200); const fy = 86 - k * 22; const fx = pathX(Math.round(fy));
    if (fy > 72) { stamp(front, HERO_TOP, fx - 3, Math.round(fy) - 9, pal); stamp(front, Math.floor(elapsed / 180) % 2 === 0 ? LEGS_A : LEGS_B, fx - 3, Math.round(fy) - 1, pal); }
    else if (k < 1) stamp(front, HERO_MINI, fx - 1, Math.round(fy) - 3, pal);
    if (k >= 1 && !doneRef.current) { doneRef.current = true; setTimeout(() => onWalkDone?.(), 0); }
  }
  // ---- cozy layer: sky sparkle, shooting stars, glowing windows, lanterns, campfire, fireflies ----
  const glow: { x: number; y: number; c: string; a: number }[] = [];
  const sec = t / 1000;
  extras.stars.forEach((s) => {
    const a = reduce ? 0.7 : 0.25 + 0.75 * Math.abs(Math.sin(sec * s.s + s.p));
    const c = s.gold ? '#F7C766' : '#F6F0E2';
    glow.push({ x: s.x, y: s.y, c, a });
    if (s.big && a > 0.8) [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => glow.push({ x: s.x + dx, y: s.y + dy, c, a: a * 0.45 }));
  });
  if (!reduce) {
    // A shooting star every ~7 s, somewhere new each time.
    const cycle = Math.floor(sec / 7), phase = sec - cycle * 7;
    if (phase < 1.1) {
      const r = Math.abs(Math.sin(cycle * 12.9898) * 43758.5453) % 1;
      const x0 = 4 + Math.floor(r * (W - 30)), y0 = -top + Math.floor(r * Math.max(4, top * 0.8 + 10));
      const hx = x0 + phase * 26, hy = y0 + phase * 10;
      for (let i = 0; i < 7; i++) glow.push({ x: Math.round(hx - i * 1.6), y: Math.round(hy - i * 0.6), c: i === 0 ? '#FFFFFF' : '#FFE7A3', a: (1 - i / 7) * (1 - phase / 1.1) });
    }
  }
  const flick = (seed: number) => (reduce ? 0.8 : 0.65 + 0.35 * Math.abs(Math.sin(sec * 3.1 + seed) * Math.sin(sec * 1.7 + seed * 2)));
  WINDOWS.forEach(([x, y], i) => {
    const a = flick(i);
    glow.push({ x, y, c: '#FFE7A3', a });
    [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dx, dy]) => glow.push({ x: x + dx, y: y + dy, c: '#F7C766', a: a * 0.25 }));
  });
  LANTERNS.forEach(([x, y], i) => {
    front[y + 1][x] = '#6E4A2E'; front[y + 2][x] = '#6E4A2E'; front[y + 3][x] = '#6E4A2E'; front[y + 4][x] = '#6E4A2E';
    front[y][x] = '#FFE7A3';
    const a = flick(i + 7);
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const d = Math.hypot(dx, dy); if (d > 0 && d <= 2.3) glow.push({ x: x + dx, y: y + dy, c: '#F7C766', a: a * (0.32 - d * 0.1) });
    }
  });
  // Campfire with a warm pool of light and rising sparks.
  const fa = flick(11);
  for (let dy = -5; dy <= 5; dy++) for (let dx = -8; dx <= 8; dx++) {
    const d = Math.hypot(dx / 1.6, dy); if (d <= 5.5) glow.push({ x: FIRE.x + 2 + dx, y: FIRE.y + 4 + dy, c: '#F7C766', a: fa * 0.26 * (1 - d / 5.5) });
  }
  stamp(front, FLAMES[reduce ? 0 : Math.floor(t / 140) % FLAMES.length], FIRE.x, FIRE.y - 1, FLAME_PAL);
  stamp(front, ['K.K.K', '.KKK.'], FIRE.x, FIRE.y + 4, { K: '#6E4A2E' });
  stamp(front, ['s......s', 'ss....ss'], FIRE.x - 1, FIRE.y + 4, { s: '#8A8FA8' });
  stamp(front, ['LLLL'], FIRE.x + 7, FIRE.y + 3, { L: '#9E6B3F' });
  // A crescent moon in the top-right corner, clear of the logo, with a soft round glow.
  const moonY = top > 22 ? -top + 4 : -top + 1;
  MOON.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === '#') glow.push({ x: 59 + x, y: moonY + y, c: '#F6F0E2', a: 1 }); }));
  for (let dy = -3; dy <= 9; dy++) for (let dx = -3; dx <= 9; dx++) {
    const d = Math.hypot(dx - 3, dy - 3); if (d > 3.2 && d <= 6) glow.push({ x: 59 + dx, y: moonY + dy, c: '#F6F0E2', a: 0.08 * (1 - (d - 3.2) / 2.8) + 0.02 });
  }
  if (!reduce) {
    if (Math.random() < 0.35) sparks.current.push({ x: FIRE.x + 2, y: FIRE.y, born: t, drift: Math.random() - 0.5 });
    sparks.current = sparks.current.filter((s) => (t - s.born) / 1000 <= 1.6);
    sparks.current.forEach((s) => { const age = (t - s.born) / 1000; glow.push({ x: Math.round(s.x + age * s.drift * 4), y: Math.round(s.y - age * 7), c: age < 0.6 ? '#FFE7A3' : '#F29A4E', a: 1 - age / 1.6 }); });
    extras.flies.forEach((f) => {
      const x = Math.round((f.x + Math.sin(sec * f.s + f.p) * f.r + W) % W), y = Math.round(f.y + Math.cos(sec * f.s * 1.3 + f.p) * 2);
      const a = Math.max(0, Math.sin(sec * 2.2 + f.p * 3));
      if (a > 0.05) { glow.push({ x, y, c: '#FFF3B0', a }); glow.push({ x: x + 1, y, c: '#F7C766', a: a * 0.3 }); glow.push({ x: x - 1, y, c: '#F7C766', a: a * 0.3 }); }
    });
  }

  const rows = H + top + bottom;
  const height = (width * rows) / W;

  return (
    <View style={{ width, height, backgroundColor: '#141633', overflow: 'hidden' }} accessible accessibilityRole="image"
      accessibilityLabel="A pixel-art traveller by a campfire at the edge of their home town at dawn, looking down a path toward distant landmarks">
      <Svg width={width} height={height} viewBox={`0 ${-top} ${W} ${rows}`} {...({ shapeRendering: 'crispEdges' } as object)}>
        {extras.rects.map((p) => <Path key={'x' + p.c} d={p.d} fill={p.c} />)}
        {statics.sky.map((p) => <Path key={'s' + p.color} d={p.d} fill={p.color} />)}
        {groupCells(starCells).map((g) => <Path key={'a' + g.k} d={g.d} fill={g.c} fillOpacity={g.a} />)}
        {gridToPaths(back).map((p) => <Path key={'b' + p.color} d={p.d} fill={p.color} />)}
        {statics.fg.map((p) => <Path key={'f' + p.color} d={p.d} fill={p.color} />)}
        {groupCells(smokeCells).map((g) => <Path key={'m' + g.k} d={g.d} fill={g.c} fillOpacity={g.a} />)}
        {gridToPaths(front).map((p) => <Path key={'h' + p.color} d={p.d} fill={p.color} />)}
        {groupCells(glow).map((g) => <Path key={'g' + g.k} d={g.d} fill={g.c} fillOpacity={g.a} />)}
      </Svg>
    </View>
  );
}
