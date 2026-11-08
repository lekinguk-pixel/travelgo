import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

// The mmGO logo as real pixel art: cream letters, an ink outline and a
// stamp-red then ink drop shadow, with a shine that sweeps across now and then.

const GLYPHS: Record<string, string[]> = {
  m: [
    '#########.',
    '##..##..##',
    '##..##..##',
    '##..##..##',
    '##..##..##',
    '##..##..##',
    '##..##..##',
  ],
  G: [
    '..######.',
    '.########',
    '##.......',
    '##.......',
    '##..#####',
    '##..#####',
    '##.....##',
    '##.....##',
    '.########',
    '..######.',
  ],
  O: [
    '..#####..',
    '.#######.',
    '##.....##',
    '##.....##',
    '##.....##',
    '##.....##',
    '##.....##',
    '##.....##',
    '.#######.',
    '..#####..',
  ],
};
const CAP = 10, GAP = 2, PAD = 1, DROP = 2;

export function buildLogo(word = 'mmGO') {
  const letters = [...word].map((ch) => GLYPHS[ch]);
  const textW = letters.reduce((s, g) => s + g[0].length, 0) + GAP * (letters.length - 1);
  const w = textW + PAD * 2, h = CAP + PAD * 2 + DROP;
  const mask: boolean[][] = Array.from({ length: h }, () => Array(w).fill(false));
  let x0 = PAD;
  letters.forEach((g) => {
    const top = PAD + CAP - g.length; // sit on the baseline
    g.forEach((row, y) => [...row].forEach((c, x) => { if (c === '#') mask[top + y][x0 + x] = true; }));
    x0 += g[0].length + GAP;
  });
  const at = (x: number, y: number) => y >= 0 && y < h && x >= 0 && x < w && mask[y][x];
  const cells: { x: number; y: number; c: string }[] = [];
  const outline = (x: number, y: number) => !at(x, y) && [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]].some(([dx, dy]) => at(x + dx, y + dy));
  // The drop shadow only falls below each column's lowest outlined pixel, never inside a letter.
  const lowest = Array.from({ length: w }, (_, x) => { let b = -1; for (let y = 0; y < h; y++) if (at(x, y) || outline(x, y)) b = y; return b; });
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (at(x, y)) cells.push({ x, y, c: 'W' });
    else if (outline(x, y)) cells.push({ x, y, c: 'K' });
    else if (lowest[x] >= 0 && y === lowest[x] + 1) cells.push({ x, y, c: 'R' });
    else if (lowest[x] >= 0 && y === lowest[x] + 2) cells.push({ x, y, c: 'K' });
  }
  return { w, h, cells };
}

const COLORS: Record<string, string> = { W: '#F6F0E2', K: '#1B2A41', R: '#C8553D', H: '#FFFFFF', S: '#E8DCC0' };

export function logoPaths(logo: ReturnType<typeof buildLogo>, shine: number | null) {
  const by = new Map<string, string[]>();
  for (const cell of logo.cells) {
    let c = cell.c;
    // A soft lower half to the letters, and a diagonal shine band when it's passing.
    if (c === 'W' && cell.y >= PAD + CAP - 3) c = 'S';
    if (cell.c === 'W' && shine !== null) { const d = cell.x + cell.y * 0.6 - shine; if (d >= 0 && d < 3) c = 'H'; }
    (by.get(c) ?? by.set(c, []).get(c)!).push(`M${cell.x} ${cell.y}h1v1h-1z`);
  }
  return [...by.entries()].map(([c, d]) => ({ c, color: COLORS[c], d: d.join('') }));
}

export function PixelLogo({ width }: { width: number }) {
  const logo = useMemo(() => buildLogo(), []);
  const [shine, setShine] = useState<number | null>(null);
  useEffect(() => {
    let reduce = false; let id: ReturnType<typeof setInterval> | undefined; let frame = 0;
    AccessibilityInfo.isReduceMotionEnabled().then((r) => { reduce = r; }).catch(() => {});
    const start = () => {
      if (reduce) return;
      frame = -6;
      id = setInterval(() => { frame += 2; if (frame > logo.w + 6) { clearInterval(id); setShine(null); } else setShine(frame); }, 45);
    };
    const first = setTimeout(start, 1600);
    const every = setInterval(start, 5200);
    return () => { clearTimeout(first); clearInterval(every); if (id) clearInterval(id); };
  }, [logo.w]);
  const unit = Math.floor(width / logo.w);
  const paths = logoPaths(logo, shine);
  return (
    <View accessible accessibilityRole="header" accessibilityLabel="mmGO">
      <Svg width={unit * logo.w} height={unit * logo.h} viewBox={`0 0 ${logo.w} ${logo.h}`} {...({ shapeRendering: 'crispEdges' } as object)}>
        {paths.map((p) => <Path key={p.c} d={p.d} fill={p.color} />)}
      </Svg>
    </View>
  );
}
