// Pixel-art helpers: sprites are arrays of strings, one character per pixel.

export type Bitmap = string[];
export type Palette = Record<string, string>;

/** Merges each row's runs of the same colour into SVG path data, one path per colour. */
export function bitmapToPaths(rows: Bitmap, palette: Palette, cell = 1): { color: string; d: string }[] {
  const byColor = new Map<string, string[]>();
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      const color = palette[ch];
      if (ch === '.' || !color) { x++; continue; }
      let end = x;
      while (end + 1 < row.length && row[end + 1] === ch) end++;
      const w = (end - x + 1) * cell;
      const list = byColor.get(color) ?? [];
      list.push(`M${x * cell} ${y * cell}h${w}v${cell}h-${w}z`);
      byColor.set(color, list);
      x = end + 1;
    }
  });
  return [...byColor.entries()].map(([color, parts]) => ({ color, d: parts.join('') }));
}

export const ICONS: Record<string, Bitmap> = {
  map: ['....####....','...######...','..##....##..','..##.##.##..','..##.##.##..','..##....##..','...######...','....####....','.....##.....','.....##.....','............','............'],
  book: ['............','.####..####.','#....##....#','#.##.##.##.#','#....##....#','#.##.##.##.#','#....##....#','#.##.##.##.#','#....##....#','.####..####.','.....##.....','............'],
  camera: ['............','....####....','.##########.','#..........#','#...####...#','#..#....#..#','#..#....#..#','#...####...#','#..........#','.##########.','............','............'],
  trophy: ['............','.##########.','#.########.#','#.########.#','.#.######.#.','...######...','....####....','.....##.....','.....##.....','...######...','...######...','............'],
  user: ['............','....####....','...######...','...######...','...######...','....####....','............','..########..','.##########.','.##########.','.##########.','............'],
  check: ['............','............','..........##','.........##.','........##..','.##....##...','..##..##....','...####.....','....##......','............','............','............'],
  back: ['............','.......##...','......##....','.....##.....','....##......','...##.......','....##......','.....##.....','......##....','.......##...','............','............'],
  close: ['............','.##......##.','..##....##..','...##..##...','....####....','.....##.....','....####....','...##..##...','..##....##..','.##......##.','............','............'],
  flame: ['.....#......','....##......','....###.....','...####.#...','...#####....','..########..','..###..###..','.###....###.','.###....###.','..###..###..','...######...','............'],
  globe: ['....####....','..##.##.##..','.#..#..#..#.','.#..#..#..#.','############','#...#..#...#','#...#..#...#','############','.#..#..#..#.','.#..#..#..#.','..##.##.##..','....####....'],
  mail: ['............','############','##........##','#.#......#.#','#..#....#..#','#...#..#...#','#....##....#','#..........#','#..........#','############','............','............'],
  flip: ['............','...######...','..##....##..','.##......#..','.#.......###','.#........#.','.#..........','.##......##.','..##....##..','...######...','............','............'],
};

// ---------- the traveller ----------
export type Look = { hat: string; coat: string; pack: string };
export const DEFAULT_LOOK: Look = { hat: '#C8553D', coat: '#2A7F75', pack: '#B5784A' };

export const HERO_TOP: Bitmap = ['.HHHH.','HHHHHH','.SSSS.','BBBBBB','BbBBbB','CBBBBC','CBBBBC','.CCCC.'];
export const LEGS_A: Bitmap = ['.L..L.','.L..L.'];
export const LEGS_B: Bitmap = ['..LL..','.L..L.'];
export const HERO_MINI: Bitmap = ['.H.','BBB','.C.','L.L'];

function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c * k)));
  return '#' + [f(n >> 16), f((n >> 8) & 255), f(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join('');
}

export function heroPalette(look: Look): Palette {
  return { H: look.hat, S: '#E8B48A', B: look.pack, b: shade(look.pack, 0.75), C: look.coat, L: '#1B2A41' };
}

export const LOOK_OPTIONS = {
  hat: [['Red', '#C8553D'], ['Teal', '#2A7F75'], ['Gold', '#D9A441'], ['Purple', '#8E44C9'], ['Navy', '#1B2A41']],
  coat: [['Teal', '#2A7F75'], ['Red', '#C8553D'], ['Blue', '#2F6FCF'], ['Green', '#3E9B4F'], ['Bronze', '#B5784A']],
  pack: [['Bronze', '#B5784A'], ['Navy', '#1B2A41'], ['Gold', '#D9A441'], ['Silver', '#A7B1BC'], ['Orange', '#E07B1F']],
} as const;
