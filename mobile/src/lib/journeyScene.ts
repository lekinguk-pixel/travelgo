// The Journey tab's side-scrolling pixel scene, as pure drawing code.
// 96 x 54 grid. `offset` is how far the world has scrolled; `t` is time in ms.
import type { JourneyMode } from './journey';

export const SW = 96, SH = 54;
type Cells = Map<string, string[]>;

function cell(m: Cells, c: string, x: number, y: number, w = 1) {
  if (y < 0 || y >= SH || x + w <= 0 || x >= SW) return;
  const x0 = Math.max(0, x), x1 = Math.min(SW, x + w);
  (m.get(c) ?? m.set(c, []).get(c)!).push(`M${x0} ${y}h${x1 - x0}v1h-${x1 - x0}z`);
}
function bitmap(m: Cells, rows: string[], x: number, y: number, pal: Record<string, string>) {
  rows.forEach((r, dy) => { let dx = 0; while (dx < r.length) { const ch = r[dx]; if (ch === '.') { dx++; continue; } let e = dx; while (e + 1 < r.length && r[e + 1] === ch) e++; cell(m, pal[ch], x + dx, y + dy, e - dx + 1); dx = e + 1; } });
}
const mod = (a: number, n: number) => ((a % n) + n) % n;

const CLOUD = ['...wwww.....', '.wwwwwwww...', 'wwwwwwwwwwww', '.ssssssssss.'];
const TREE = ['..ggg..', '.ggggg.', 'ggggGgg', 'gGggggg', '.ggggg.', '...t...', '...t...'];
const PINE = ['...g...', '..ggg..', '.ggGgg.', '..ggg..', '.ggggg.', 'gggGggg', '...t...'];
const HOUSE = ['...rr...', '..rrrr..', '.rrrrrr.', 'rrrrrrrr', '.wwwwww.', '.wywwdw.', '.wwwwdw.'];

export function buildJourneyFrame(mode: JourneyMode, offset: number, t: number) {
  const m: Cells = new Map();
  const plane = mode === 'plane';
  // sky
  const sky = plane ? ['#5AA6DB', '#74B8E3', '#93CAEB', '#B5DCF2'] : ['#6FB7E0', '#86C5E8', '#A2D4EE', '#C2E4F4'];
  for (let y = 0; y < SH; y++) cell(m, sky[Math.min(3, Math.floor(y / (plane ? 12 : 9)))], 0, y, SW);
  // sun
  for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) if (x * x + y * y <= 17) cell(m, '#FFE7A3', 80 + x, 9 + y);
  for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) { const d = x * x + y * y; if (d > 17 && d <= 34 && (x + y) % 2 === 0) cell(m, '#FFF3C4', 80 + x, 9 + y); }

  // clouds: slow in the background, fast when flying
  const cloudSpeed = plane ? 1.4 : 0.15;
  for (let i = -1; i < 6; i++) {
    const wx = i * 26 - mod(offset * cloudSpeed, 26);
    const seed = Math.floor((offset * cloudSpeed) / 26) + i;
    const y = 4 + mod(seed * 7, plane ? 34 : 14);
    bitmap(m, CLOUD, Math.round(wx), y, { w: '#FFFFFF', s: '#DDEEF7' });
  }

  if (plane) {
    // the sea far below, with moving wave glints
    for (let y = 46; y < SH; y++) cell(m, y === 46 ? '#6FB0DC' : '#3E86C6', 0, y, SW);
    for (let i = 0; i < 14; i++) cell(m, '#B5DCF2', Math.round(mod(i * 13 - offset * 0.6, SW + 6)) - 3, 48 + (i % 5), 3);
    // the plane: a big airliner, nose to the right, with our traveller at the front window
    const by = 17 + (Math.floor(t / 600) % 2);
    for (let y = 0; y < 16; y++) {
      const r = y < 2 ? 2 : y > 13 ? 2 : 0;
      for (let x = 8 + r; x < 86 - (y < 4 ? 4 - y : y > 11 ? y - 11 : 0) * 2; x++) {
        const c = y === 9 ? '#C8553D' : y >= 12 ? '#D9DEE6' : '#F6F0E2';
        cell(m, c, x, by + y);
      }
    }
    for (let i = 0; i < 9; i++) for (let y = 4; y < 7; y++) cell(m, '#5A7EA8', 24 + i * 5, by + y, 3);   // cabin windows
    for (let y = 3; y < 9; y++) cell(m, '#9FC7E8', 66, by + y, 10);                                 // traveller's window
    for (let y = 3; y < 9; y++) { cell(m, '#2B3F5C', 79 + Math.max(0, y - 6), by + y, 4); }          // cockpit
    for (let y = -9; y < 0; y++) cell(m, '#C8553D', 9 + Math.floor((y + 9) / 2), by + y, 7 - Math.floor((y + 9) / 3));  // tail fin
    for (let y = 0; y < 5; y++) cell(m, '#A7B1BC', 40 - y * 2, by + 13 + y, 18);                     // wing
    cell(m, '#8A8FA8', 46, by + 16, 8); cell(m, '#8A8FA8', 46, by + 17, 8);                          // engine
    return group(m);
  }

  // far mountains and hills (parallax)
  for (let x = 0; x < SW; x++) {
    const wx = x + offset * 0.25;
    const peak = 26 + Math.round(5 * Math.abs(((wx / 18) % 2) - 1) * 2 + 2 * Math.sin(wx / 7));
    for (let y = peak; y < 40; y++) cell(m, y < peak + 2 && peak < 30 ? '#F6F0E2' : '#8E9DCF', x, y);
    const wx2 = x + offset * 0.5;
    const hill = 36 + Math.round(2.5 * Math.sin(wx2 / 9) + 1.5 * Math.sin(wx2 / 4.3));
    for (let y = hill; y < 44; y++) cell(m, y === hill ? '#7CC27A' : '#5DAE5F', x, y);
  }
  // trees and the odd cottage along the way
  for (let i = -1; i < 9; i++) {
    const step = 13;
    const wx = i * step - mod(offset, step);
    const k = Math.floor(offset / step) + i;
    const kind = mod(k * 5 + 3, 7);
    const x = Math.round(wx);
    if (kind === 0) bitmap(m, HOUSE, x, 37, { r: '#C8553D', w: '#F6F0E2', y: '#FFE7A3', d: '#7A4E2E' });
    else if (kind < 4) bitmap(m, kind % 2 ? TREE : PINE, x, 37, { g: '#3E9B4F', G: '#2E7D3F', t: '#7A4E2E' });
  }
  // ground
  for (let y = 44; y < SH; y++) cell(m, '#4E9F5A', 0, y, SW);
  if (mode === 'train') {
    for (let x = 0; x < SW; x++) if (mod(x + offset, 4) < 1) cell(m, '#7A4E2E', x, 48, 1);
    cell(m, '#6E7A88', 0, 47, SW);
    // the carriage, standing still while the world rushes by, with our traveller at the middle window
    const ty = 27 + (Math.floor(t / 180) % 2);
    for (let y = 0; y < 19; y++) for (let x = 12; x < 84; x++) {
      if ((y === 0) && (x < 14 || x > 81)) continue;
      const c = y < 2 ? '#8E3A2A' : y >= 16 ? '#2B2B33' : y === 13 ? '#F6F0E2' : '#C8553D';
      cell(m, c, x, ty + y);
    }
    for (let i = 0; i < 5; i++) for (let y = 4; y < 11; y++) cell(m, '#9FC7E8', 15 + i * 14, ty + y, 11);
    for (let y = 3; y < 15; y++) cell(m, '#8E3A2A', 13, ty + y);                                      // door
    for (const wx of [18, 26, 66, 74]) for (let y = 17; y < 19; y++) cell(m, Math.floor(t / 90) % 2 ? '#4A4A55' : '#2B2B33', wx, ty + y, 4);
    return group(m);
  }
  // the road
  for (let y = 45; y < 49; y++) cell(m, y === 45 || y === 48 ? '#B89557' : '#D9B878', 0, y, SW);
  if (mode !== 'parked') for (let x = 0; x < SW; x++) if (mod(x + offset, 10) < 4) cell(m, '#F6F0E2', x, 46, 1);
  // grass tufts and flowers below the road
  for (let i = 0; i < 16; i++) {
    const x = Math.round(mod(i * 17 - offset * 1.2, SW + 4)) - 2, y = 50 + (i * 3) % 4;
    cell(m, i % 4 === 0 ? '#F7C766' : i % 4 === 1 ? '#E58FB1' : '#3F8A5E', x, y);
  }
  return group(m);
}

/** The bicycle, drawn in front of the rider. */
export function buildBikeOverlay(t: number) {
  const m: Cells = new Map();
  const spin = Math.floor(t / 90) % 2;
  const wheel = spin ? ['..ooo..', '.o...o.', 'o..x..o', 'o.xxx.o', 'o..x..o', '.o...o.', '..ooo..'] : ['..ooo..', '.o.x.o.', 'o..x..o', 'oxxxxxo', 'o..x..o', '.o.x.o.', '..ooo..'];
  bitmap(m, wheel, 33, 39, { o: '#2B2B33', x: '#A7B1BC' });
  bitmap(m, wheel, 56, 39, { o: '#2B2B33', x: '#A7B1BC' });
  bitmap(m, [
    '.....................hh.',
    '....................c...',
    '..sss..............c....',
    '....c..............c....',
    '....cccccccccccccccc....',
    '.....c............c.....',
    '......c..........c......',
    '.......c...pp...c.......',
  ], 34, 35, { c: '#C8553D', s: '#2B2B33', h: '#2B2B33', p: '#6E7A88' });
  return group(m);
}

/** Where the traveller sits in the scene for each mode (in scene units). */
export function riderPlacement(mode: JourneyMode) {
  switch (mode) {
    case 'bike': return { x: 41.6, y: 22, scale: 0.8, portrait: false };
    case 'train': return { x: 43.3, y: 31.5, scale: 0.42, portrait: true };
    case 'plane': return { x: 67.2, y: 20.6, scale: 0.36, portrait: true };
    default: return { x: 41.6, y: 26, scale: 0.8, portrait: false };
  }
}

function group(m: Cells) { return [...m.entries()].map(([color, d]) => ({ color, d: d.join('') })); }
