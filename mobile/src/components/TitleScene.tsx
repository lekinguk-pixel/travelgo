import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, useWindowDimensions, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { HERO_MINI, HERO_TOP, heroPalette, LEGS_A, LEGS_B, type Bitmap, type Look, type Palette } from '@/lib/pixel';

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

type Props = { look: Look; walking?: boolean; onWalkDone?: () => void };

export function TitleScene({ look, walking = false, onWalkDone }: Props) {
  const { width } = useWindowDimensions();
  const statics = useMemo(buildStatic, []);
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
  const pal = heroPalette(look);
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
  const height = (width * H) / W;

  return (
    <View style={{ width, height, backgroundColor: '#1F2250', overflow: 'hidden' }} accessible accessibilityRole="image"
      accessibilityLabel="A pixel-art traveller at the edge of their home town at dawn, looking down a path toward distant landmarks">
      <Svg width={width} height={height} viewBox={`0 0 ${W} ${H}`} shapeRendering="crispEdges">
        {statics.sky.map((p) => <Path key={'s' + p.color} d={p.d} fill={p.color} />)}
        {starCells.map((c, i) => <Path key={'a' + i} d={`M${c.x} ${c.y}h1v1h-1z`} fill={c.c} fillOpacity={c.a} />)}
        {gridToPaths(back).map((p) => <Path key={'b' + p.color} d={p.d} fill={p.color} />)}
        {statics.fg.map((p) => <Path key={'f' + p.color} d={p.d} fill={p.color} />)}
        {smokeCells.map((c, i) => <Path key={'m' + i} d={`M${c.x} ${c.y}h1v1h-1z`} fill={c.c} fillOpacity={c.a} />)}
        {gridToPaths(front).map((p) => <Path key={'h' + p.color} d={p.d} fill={p.color} />)}
      </Svg>
    </View>
  );
}
