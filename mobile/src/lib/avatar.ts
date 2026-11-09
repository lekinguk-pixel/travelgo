// The traveller, front view, 16 x 24 pixels, drawn in layers.
// Clothing is described by body region (shoulders, arms, torso, hips, legs, feet),
// so every outfit fits every body style automatically.

export type BodyStyle = 'masc' | 'fem' | 'neutral';
export type Slot = 'hat' | 'top' | 'bottom' | 'shoes' | 'neck' | 'pack';

export type Avatar = {
  v: 2;
  body: BodyStyle;
  skin: string;
  hair: string; hairColor: string;
  top: string; topColor: string;
  bottom: string; bottomColor: string;
  shoes: string; shoesColor: string;
  hat: string; hatColor: string;
  neck: string; neckColor: string;
  pack: string; packColor: string;
  pet: PetKind; petColor: string;
};

export type PetKind = 'none' | 'cat' | 'dog' | 'rat' | 'bird';

export const W = 16, H = 24;
const INK = '#1B2A41';

export const SKIN_TONES = ['#F6D3B3', '#EBB58C', '#D29A6C', '#A86B45', '#7A4A2E', '#4E2F1E'];
export const HAIR_COLORS = ['#1E1A1A', '#4A2E1E', '#8A5A33', '#D9B26A', '#C8553D', '#B9B4AE', '#E58FB1', '#4F7FD9'];
export const CLOTH_COLORS = ['#2A7F75', '#C8553D', '#2F6FCF', '#3E9B4F', '#D9A441', '#8E44C9', '#1B2A41', '#F6F0E2', '#B5784A', '#E07B1F', '#E58FB1', '#4A4A55'];

export const DEFAULT_AVATAR: Avatar = {
  v: 2, body: 'neutral', skin: SKIN_TONES[1], hair: 'short', hairColor: HAIR_COLORS[1],
  top: 'jacket', topColor: '#2A7F75', bottom: 'jeans', bottomColor: '#2F4A73', shoes: 'trainers', shoesColor: '#C8553D',
  hat: 'cap', hatColor: '#C8553D', neck: 'none', neckColor: '#D9A441', pack: 'backpack', packColor: '#B5784A',
  pet: 'none', petColor: '#E07B1F',
};

/** Read whatever is stored on a profile (old 3-colour looks included) as a full avatar. */
export function toAvatar(raw: unknown): Avatar {
  const r = (raw ?? {}) as Record<string, unknown>;
  if (r.v === 2) return { ...DEFAULT_AVATAR, ...(r as Partial<Avatar>), v: 2 };
  const old = r as { hat?: string; coat?: string; pack?: string };
  return { ...DEFAULT_AVATAR, hatColor: old.hat ?? DEFAULT_AVATAR.hatColor, topColor: old.coat ?? DEFAULT_AVATAR.topColor, packColor: old.pack ?? DEFAULT_AVATAR.packColor };
}

// ---------- body ----------
const HEAD: string[] = [
  '................', '................', '................',
  '......ssss......',
  '.....ssssss.....',
  '.....ssssss.....',
  '.....sesses.....',
  '.....ssssss.....',
  '......smms......',
  '.......ss.......',
  '.......ss.......',
];
const TORSO: Record<BodyStyle, string[]> = {
  masc: [
    '...ssssssssss...',
    '..ssssssssssss..',
    '..ss.ssssss.ss..',
    '..ss.ssssss.ss..',
    '..ss.ssssss.ss..',
    '..ss.ssssss.ss..',
    '..ss.ssssss.ss..',
  ],
  fem: [
    '....ssssssss....',
    '...ssssssssss...',
    '..ss.ssssss.ss..',
    '..ss.ssssss.ss..',
    '..ss..ssss..ss..',
    '..ss.ssssss.ss..',
    '..ss.ssssss.ss..',
  ],
  neutral: [
    '....ssssssss....',
    '..ssssssssssss..',
    '..ss.ssssss.ss..',
    '..ss.ssssss.ss..',
    '..ss.ssssss.ss..',
    '..ss.ssssss.ss..',
    '..ss.ssssss.ss..',
  ],
};
const LOWER: string[] = [
  '..ss.ss..ss.ss..',
  '.....ss..ss.....',
  '.....ss..ss.....',
  '.....ss..ss.....',
  '.....ss..ss.....',
  '....sss..sss....',
];

export type Region = 'head' | 'neck' | 'shoulder' | 'arm' | 'hand' | 'torso' | 'hips' | 'leg' | 'foot';
export function regionOf(x: number, y: number): Region {
  if (y <= 9) return 'head';
  if (y === 10) return 'neck';
  if (y <= 12) return 'shoulder';
  if (y <= 17) return x <= 4 || x >= 11 ? 'arm' : y === 17 ? 'hips' : 'torso';
  if (y === 18) return x <= 4 || x >= 11 ? 'hand' : 'leg';
  if (y <= 21) return 'leg';
  return 'foot';
}

function bodyMask(style: BodyStyle): string[] {
  return [...HEAD, ...TORSO[style], ...LOWER];
}

// ---------- clothing, by region ----------
// Each rule returns a palette code for a body pixel: c = colour, d = shade, a = accent, w = cream, '' = leave skin.
type Rule = (r: Region, x: number, y: number) => string;
type Extra = { y: number; rows: string[] }; // pixels drawn regardless of the body (hoods, skirts, straps)

export type ItemArt = {
  slot: Slot; rule?: Rule; front?: Extra; back?: Extra;
  colors?: Record<string, string>; // fixed colours for special items
};

const torsoMid = (x: number) => x >= 7 && x <= 8;

export const ART: Record<string, ItemArt> = {
  // tops
  tee: { slot: 'top', rule: (r, x, y) => (r === 'shoulder' ? 'c' : r === 'arm' && y === 13 ? 'd' : r === 'torso' ? (y === 16 ? 'd' : 'c') : '') },
  vest: { slot: 'top', rule: (r, x, y) => ((r === 'shoulder' && x >= 5 && x <= 10) || r === 'torso' ? (y === 16 ? 'd' : 'c') : '') },
  hoodie: {
    slot: 'top',
    rule: (r, x, y) => (r === 'shoulder' || r === 'arm' ? (y === 17 ? 'd' : 'c') : r === 'torso' ? (y === 15 && x >= 6 && x <= 9 ? 'd' : y === 12 ? 'c' : 'c') : r === 'neck' ? 'c' : ''),
    front: { y: 11, rows: ['................', '.......w..w.....'] },
    back: { y: 8, rows: ['....cccccccc....', '....cc....cc....', '....cc....cc....'] },
  },
  jacket: { slot: 'top', rule: (r, x, y) => (r === 'shoulder' ? (y === 11 && (x === 6 || x === 9) ? 'd' : torsoMid(x) ? 'w' : 'c') : r === 'arm' ? (y === 17 ? 'd' : 'c') : r === 'torso' ? (torsoMid(x) ? 'w' : 'c') : '') },
  jumper: { slot: 'top', rule: (r, x, y) => (r === 'shoulder' || r === 'arm' || r === 'torso' ? (y === 13 || y === 15 ? 'a' : y === 17 && r === 'arm' ? 'd' : 'c') : ''), colors: { a: '#F6F0E2' } },
  raincoat: {
    slot: 'top',
    rule: (r, x, y) => (r === 'shoulder' || r === 'arm' ? (y === 17 ? 'd' : 'c') : r === 'torso' || r === 'hips' ? (x === 8 && (y === 13 || y === 15) ? 'a' : 'c') : r === 'leg' && y === 18 ? 'c' : ''),
    front: { y: 18, rows: ['.....cccccc.....'] }, colors: { a: '#F6F0E2' },
  },
  // bottoms
  jeans: { slot: 'bottom', rule: (r, x, y) => (r === 'hips' ? 'd' : r === 'leg' ? (y === 21 ? 'd' : 'c') : '') },
  shorts: { slot: 'bottom', rule: (r, x, y) => (r === 'hips' ? 'd' : r === 'leg' && y <= 19 ? 'c' : '') },
  cargo: { slot: 'bottom', rule: (r, x, y) => (r === 'hips' ? 'd' : r === 'leg' ? (y === 19 && (x === 5 || x === 10) ? 'd' : 'c') : '') },
  skirt: { slot: 'bottom', rule: (r) => (r === 'hips' ? 'c' : ''), front: { y: 18, rows: ['....cccccccc....', '...dddddddddd...'] } },
  // shoes
  trainers: { slot: 'shoes', rule: (r, x, y) => (r === 'foot' ? (y === 23 ? 'w' : 'c') : '') },
  boots: { slot: 'shoes', rule: (r, x, y) => (r === 'foot' ? (y === 23 ? 'd' : 'c') : r === 'leg' && y === 21 ? 'c' : '') },
  sandals: { slot: 'shoes', rule: (r, x, y) => (r === 'foot' && y === 23 ? 'c' : '') },
  // hats
  cap: { slot: 'hat', front: { y: 2, rows: ['......cccc......', '.....cccccc.....', '....dddddddd....'] } },
  beanie: { slot: 'hat', front: { y: 1, rows: ['.......w........', '......cccc......', '.....cccccc.....', '.....dddddd.....'] } },
  bucket: { slot: 'hat', front: { y: 2, rows: ['......cccc......', '.....cccccc.....', '....dddddddd....'] } },
  sunhat: { slot: 'hat', front: { y: 2, rows: ['......cccc......', '.....aaaaaa.....', '..dddddddddddd..'] }, colors: { a: '#C8553D' } },
  // neck
  scarf: { slot: 'neck', front: { y: 10, rows: ['.....cccccc.....', '......cddc......', '.........dc.....'] } },
  camera: { slot: 'neck', front: { y: 10, rows: ['.....a....a.....', '......a..a......', '.......aa.......', '......cccc......', '......cwwc......'] }, colors: { a: INK, c: '#2B2B33', w: '#9FB7D9' } },
  // packs
  backpack: { slot: 'pack', front: { y: 11, rows: ['.....c....c.....', '.....c....c.....', '.....c....c.....', '.....d....d.....'] }, back: { y: 11, rows: ['..cccccccccccc..', '.cccccccccccccc.', '.cccccccccccccc.', '.dddddddddddddd.', '.dddddddddddddd.', '..dddddddddddd..'] } },
  satchel: { slot: 'pack', front: { y: 11, rows: ['..........c.....', '.........c......', '........c.......', '.......c........', '......c.........', '.cccc...........', '.cddc...........'] } },

  // ---------- location exclusives (fixed colours) ----------
  bearskin: { slot: 'hat', front: { y: 0, rows: ['.....cccccc.....', '....cccccccc....', '....cccccccc....', '....cccccccc....', '....cccccccc....', '....c......c....', '....a......a....', '.....a....a.....', '......aaaa......'] }, colors: { c: '#1A1A20', a: '#D9A441' } },
  beret: { slot: 'hat', front: { y: 1, rows: ['.......c........', '.....cccccc.....', '....cccccccc....', '.....dddddd.....'] }, colors: { c: '#2B2B3A', d: '#1A1A22' } },
  tartan_scarf: { slot: 'neck', front: { y: 10, rows: ['.....cacacc.....', '......abba......', '.........ac.....', '.........ca.....'] }, colors: { c: '#C8553D', a: '#2E6B3F', b: '#1B2A41' } },
  viking_helmet: { slot: 'hat', front: { y: 1, rows: ['..a..........a..', '..aa.cccccc.aa..', '...aacccccccaa..', '.....dddddd.....'] }, colors: { c: '#A7B1BC', d: '#6E7A88', a: '#F6F0E2' } },
  laurel_wreath: { slot: 'hat', front: { y: 2, rows: ['.....c.cc.c.....', '....c......c....', '....c......c....'] }, colors: { c: '#D9A441' } },
  liberty_crown: { slot: 'hat', front: { y: 0, rows: ['..c..c..c..c..c.', '...c.c..c..c.c..', '....cccccccc....', '....dddddddd....'] }, colors: { c: '#6FAF9A', d: '#4E8C78' } },
  flower_crown: { slot: 'hat', front: { y: 3, rows: ['....rgyrgyrg....', '....g......g....'] }, colors: { r: '#E58FB1', g: '#3E9B4F', y: '#F7C766' } },
  sakura_pin: { slot: 'hat', front: { y: 3, rows: ['..........pwp...', '...........p....'] }, colors: { p: '#F2A7C3', w: '#FFF3F8' } },
  alpine_hat: { slot: 'hat', front: { y: 0, rows: ['...........f....', '......cccf......', '.....cccccc.....', '.....aaaaaa.....', '...dddddddddd...'] }, colors: { c: '#3E6B3F', d: '#2E5530', a: '#C8553D', f: '#F6F0E2' } },
  dragon_scarf: { slot: 'neck', front: { y: 10, rows: ['.....cccwww.....', '......ggww......', '.........gg.....', '.........rc.....'] }, colors: { c: '#C8553D', w: '#F6F0E2', g: '#3E9B4F', r: '#C8553D' } },
  fez: { slot: 'hat', front: { y: 0, rows: ['.......a........', '......cca.......', '......ccca......', '.....cccccc.....', '.....dddddd.....'] }, colors: { c: '#B8323A', d: '#8E2229', a: '#1A1A20' } },
  // ---------- more starter clothes ----------
  fedora: { slot: 'hat', front: { y: 1, rows: ['......cccc......', '.....cccccc.....', '.....aaaaaa.....', '...dddddddddd...'] }, colors: { a: INK } },
  headband: { slot: 'hat', front: { y: 4, rows: ['.....cccccc.....'] } },
  visor: { slot: 'hat', front: { y: 4, rows: ['.....cccccc.....', '....ddddddd.....'] } },
  bandana: { slot: 'hat', front: { y: 2, rows: ['......cccc......', '.....cwcwcc.....', '.....cccccc.....', '...........cc...'] } },
  polo: { slot: 'top', rule: (r, x, y) => (r === 'shoulder' ? (y === 11 && x >= 6 && x <= 9 ? 'a' : 'c') : r === 'arm' && y === 13 ? 'd' : r === 'torso' ? (x === 8 && (y === 13 || y === 14) ? 'w' : 'c') : '') },
  flannel: { slot: 'top', rule: (r, x, y) => (r === 'shoulder' || r === 'arm' || r === 'torso' ? (y % 3 === 0 || x % 3 === 0 ? 'd' : 'c') : '') },
  cardigan: { slot: 'top', rule: (r, x, y) => (r === 'shoulder' || r === 'arm' ? (y === 17 ? 'd' : 'c') : r === 'torso' ? (x >= 7 && x <= 8 ? (y === 14 || y === 16 ? 'd' : 'w') : 'c') : '') },
  windbreaker: { slot: 'top', rule: (r, x, y) => (r === 'shoulder' || r === 'arm' || r === 'torso' ? (x === 8 && r === 'torso' ? 'd' : y <= 13 ? 'a' : 'c') : r === 'neck' ? 'a' : '') },
  dress: { slot: 'top', rule: (r, x, y) => ((r === 'shoulder' && (x === 6 || x === 9 || y === 12)) || r === 'torso' || r === 'hips' ? (y === 16 ? 'd' : 'c') : ''), front: { y: 18, rows: ['....cccccccc....', '...cccccccccc...', '...dddddddddd...'] } },
  tracktop: { slot: 'top', rule: (r, x, y) => (r === 'shoulder' || r === 'arm' ? (x === 2 || x === 13 ? 'w' : y === 17 ? 'd' : 'c') : r === 'torso' ? (x === 8 ? 'w' : 'c') : r === 'neck' ? 'c' : '') },
  joggers: { slot: 'bottom', rule: (r, x, y) => (r === 'hips' ? 'd' : r === 'leg' ? (y === 21 ? 'd' : 'c') : '') },
  leggings: { slot: 'bottom', rule: (r) => (r === 'hips' || r === 'leg' ? 'c' : '') },
  dungarees: { slot: 'bottom', rule: (r, x, y) => (r === 'hips' || r === 'leg' ? (y === 19 && (x === 6 || x === 9) ? 'd' : 'c') : r === 'torso' && x >= 6 && x <= 9 && y >= 14 ? (y === 15 && x >= 7 && x <= 8 ? 'd' : 'c') : r === 'shoulder' && (x === 6 || x === 9) ? 'c' : (r === 'torso' && (x === 6 || x === 9)) ? 'c' : '') },
  longskirt: { slot: 'bottom', rule: (r) => (r === 'hips' ? 'c' : ''), front: { y: 18, rows: ['....cccccccc....', '....cccccccc....', '...cccccccccc...', '...dddddddddd...'] } },
  hightops: { slot: 'shoes', rule: (r, x, y) => (r === 'foot' ? (y === 23 ? 'w' : 'c') : r === 'leg' && y === 21 ? (x === 5 || x === 10 ? 'w' : 'c') : '') },
  loafers: { slot: 'shoes', rule: (r, x, y) => (r === 'foot' ? (y === 23 ? 'd' : 'c') : '') },
  wellies: { slot: 'shoes', rule: (r, x, y) => (r === 'foot' ? (y === 23 ? 'd' : 'c') : r === 'leg' && y >= 19 ? 'c' : '') },
  headphones: { slot: 'neck', front: { y: 10, rows: ['....cc....cc....', '....cdaaaadc....'] }, colors: { a: '#2B2B33' } },
  necklace: { slot: 'neck', front: { y: 11, rows: ['......a..a......', '.......aa.......', '.......cc.......'] }, colors: { a: '#D9A441' } },
  duffel: { slot: 'pack', front: { y: 11, rows: ['..........c.....', '...........c....', '............c...', '...........cccc.', '...........cccc.', '...........dddd.'] } },
  bumbag: { slot: 'pack', front: { y: 16, rows: ['....cccccccc....', '......dddd......'] } },

  // ---------- more location exclusives ----------
  graffiti_jacket: {
    slot: 'top',
    rule: (r, x, y) => (r === 'shoulder' || r === 'arm' || r === 'torso' ? ((x * 7 + y * 3) % 5 === 0 ? 'p' : (x * 3 + y * 5) % 7 === 0 ? 'y' : (x + y * 2) % 11 === 0 ? 'b' : 'c') : ''),
    colors: { c: '#2B2B33', p: '#E58FB1', y: '#F7C766', b: '#4FC1D9' },
  },
  crystal_pendant: { slot: 'neck', front: { y: 11, rows: ['......a..a......', '.......aa.......', '.......gw.......', '.......gg.......'] }, colors: { a: '#C9CED6', g: '#B8323A', w: '#FFD6DA' } },
  top_hat: { slot: 'hat', front: { y: 0, rows: ['.....cccccc.....', '.....cccccc.....', '.....cccccc.....', '.....aaaaaa.....', '...dddddddddd...'] }, colors: { c: '#1A1A20', d: '#0E0E12', a: '#B8323A' } },
  mosaic_scarf: { slot: 'neck', front: { y: 10, rows: ['.....rbygbr.....', '......gbyr......', '.........yb.....', '.........br.....'] }, colors: { r: '#C8553D', b: '#2F6FCF', y: '#F7C766', g: '#3E9B4F' } },
  navigator_hat: { slot: 'hat', front: { y: 1, rows: ['......cccc......', '...cccccccccc...', '..a.cccccccc.a..', '....aaaaaaaa....'] }, colors: { c: '#1B2A41', a: '#D9A441' } },
  mortarboard: { slot: 'hat', front: { y: 1, rows: ['...dddddddddd...', '.....cccccc..t..', '.....cccccc..t..', '.............t..'] }, colors: { d: '#1A1A20', c: '#2B2B33', t: '#D9A441' } },
  athenian_sandals: { slot: 'shoes', rule: (r, x, y) => (r === 'foot' ? (y === 23 ? 'c' : x % 2 === 0 ? 'c' : '') : r === 'leg' && y >= 19 && (x + y) % 2 === 0 ? 'c' : ''), colors: { c: '#B5784A' } },
  happi_coat: { slot: 'top', rule: (r, x, y) => (r === 'shoulder' || (r === 'arm' && y <= 14) || r === 'torso' ? (x === 6 || x === 9 || y === 16 ? 'w' : 'c') : ''), colors: { c: '#2E3F7A', w: '#F6F0E2' } },
  hussar_jacket: { slot: 'top', rule: (r, x, y) => (r === 'shoulder' || r === 'arm' ? (y === 11 && x >= 6 && x <= 9 ? 'a' : y === 17 ? 'a' : 'c') : r === 'torso' ? (y % 2 === 0 && x !== 7 && x !== 8 ? 'a' : 'c') : ''), colors: { c: '#B8323A', a: '#D9A441' } },
  dragon_hood: { slot: 'hat', front: { y: 0, rows: ['....a......a....', '....cc....cc....', '...cwkccccwkc...', '...cccccccccc...', '...ctttttttttc..', '...c........c...', '...c........c...', '...c........c...', '....c......c....'] }, colors: { c: '#3E9B4F', a: '#F6F0E2', w: '#F7C766', k: INK, t: '#F6F0E2' } },
  guitar: { slot: 'pack', back: { y: 4, rows: ['.d..............', '.d..............', '.d..............', '.d..............', '.d..............', '.d..............', '.d..............', '.d..............', 'ccc.............', 'ccc.............', 'ckc.............', 'ccc.............', 'ccc.............', '.c..............'] }, front: { y: 11, rows: ['..........k.....', '.........k......', '........k.......', '.......k........', '......k.........'] }, colors: { c: '#B5784A', d: '#6E4A2E', k: '#2B2B33' } },
  toga: { slot: 'top', rule: (r, x, y) => ((r === 'shoulder' && x <= 8) || r === 'torso' || r === 'hips' ? (y === 16 ? 'a' : (x - y) % 4 === 0 ? 'd' : 'c') : (r === 'arm' && x <= 4 && y <= 13) ? 'c' : ''), front: { y: 18, rows: ['....cccccccc....', '....dccccccd....'] }, colors: { c: '#F6F0E2', d: '#DCD3BE', a: '#D9A441' } },
  // ---------- journey shop ----------
  pith_helmet: { slot: 'hat', front: { y: 1, rows: ['......cccc......', '.....cccccc.....', '.....aaaaaa.....', '...dddddddddd...'] }, colors: { c: '#E3D2A8', d: '#C9B489', a: '#8A6A3F' } },
  pilot_cap: { slot: 'hat', front: { y: 2, rows: ['.....cccccc.....', '....cgggggcc....', '....c......c....'] }, colors: { c: '#7A4E2E', g: '#9FB7D9' } },
  captain_hat: { slot: 'hat', front: { y: 1, rows: ['.....wwwwww.....', '....wwwwwwww....', '....aaaaaaaa....', '....cccccccc....'] }, colors: { w: '#F6F0E2', a: '#D9A441', c: '#1B2A41' } },
  puffer: { slot: 'top', rule: (r, x, y) => (r === 'shoulder' || r === 'arm' || r === 'torso' || r === 'hips' ? (y === 12 || y === 14 || y === 16 ? 'd' : 'c') : r === 'neck' ? 'c' : '') },
  hiking_boots: { slot: 'shoes', rule: (r, x, y) => (r === 'foot' ? (y === 23 ? 'a' : 'c') : r === 'leg' && y >= 20 ? 'c' : ''), colors: { c: '#7A4E2E', a: '#2B2B33' } },
  medal: { slot: 'neck', front: { y: 10, rows: ['.....r....r.....', '......r..r......', '.......rr.......', '.......cc.......', '.......cc.......'] }, colors: { r: '#2F6FCF', c: '#D9A441' } },
};

// ---------- hair ----------
type HairArt = { front: Extra; back?: Extra };
export const HAIR: Record<string, HairArt> = {
  none: { front: { y: 0, rows: [] } },
  buzz: { front: { y: 3, rows: ['......hhhh......', '.....hhhhhh.....'] } },
  short: { front: { y: 2, rows: ['......hhhh......', '.....hhhhhh.....', '.....hhhhhhh....', '.....h....h.....'] } },
  curly: { front: { y: 1, rows: ['.....h.hh.h.....', '....hhhkhhkh....', '....hkhhhhhh....', '....hhhhkhhh....', '....h......h....', '....h......h....'] } },
  long: { front: { y: 2, rows: ['......hhhh......', '.....hhhhhh.....', '.....hhhhhhh....', '....h......h....'] }, back: { y: 4, rows: ['....hhhhhhhh....', '....hhhhhhhh....', '....hhhhhhhh....', '....hhhhhhhh....', '....hhhhhhhh....', '....hhhhhhhh....', '...hhhhhhhhhh...', '...hhhhhhhhhh...', '...hhhhhhhhhh...', '....kk....kk....'] } },
  bob: { front: { y: 2, rows: ['......hhhh......', '.....hhhhhh.....', '....hhhhhhhh....', '....h......h....'] }, back: { y: 4, rows: ['....hhhhhhhh....', '....hhhhhhhh....', '....hhhhhhhh....', '....hhhhhhhh....', '....kkkkkkkk....'] } },
  bun: { front: { y: 0, rows: ['.......hh.......', '......hkhh......', '......hhhh......', '.....hhhhhh.....', '.....hhhhhh.....'] } },
  afro: { front: { y: 0, rows: ['....hhhhhhhh....', '...hhhkhhhkhh...', '...hhhhhhhhhh...', '...hkhhhhhhkh...', '...hhhhhhhhhh...', '...hhh....hhh...', '...hh......hh...'] } },
};
export const HAIR_STYLES = Object.keys(HAIR);

// ---------- pets (sit beside the traveller) ----------
export const PET_KINDS: PetKind[] = ['cat', 'dog', 'rat', 'bird'];
export const PET_COLORS: Record<Exclude<PetKind, 'none'>, string[]> = {
  cat: ['#1E1A1A', '#F6F0E2', '#E07B1F', '#8A8FA8', '#7A4E2E', '#E3D2A8'],
  dog: ['#1E1A1A', '#F6F0E2', '#C88A4A', '#8A8FA8', '#7A4E2E', '#E3D2A8'],
  rat: ['#F6F0E2', '#A7A39C', '#7A4E2E', '#1E1A1A'],
  bird: ['#4F9BD9', '#3E9B4F', '#F7C766', '#C8553D', '#8A8FA8', '#F6F0E2'],
};
const PETS: Record<Exclude<PetKind, 'none'>, string[]> = {
  cat: ['.c.....c..', '.cc...cc..', '.ccccccc..', '.cecccec..', '..ccncc...', '..ccccc..d', '.ccaaacc.d', '.ccaaaccdd'],
  dog: ['..cccccc..', '.dccccccd.', '.dceccecd.', '.dccaaccd.', '...cnnc...', '..cccccc..', '..caaaac.d', '..caaaacdd'],
  rat: ['..pp......', '.cppc.....', 'ceccccccc.', 'ncccccccc.', '.c...c..tt'],
  bird: ['..cc....', '.cecc...', 'bccccc..', '.caacccd', '..ccccdd', '...y.y..'],
};
const PET_GAP = 1;

// ---------- compose ----------
export function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c * k)));
  return '#' + [f(n >> 16), f((n >> 8) & 255), f(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join('');
}

function paletteFor(base: string, fixed?: Record<string, string>) {
  return { c: base, d: shade(base, 0.72), a: shade(base, 1.25), w: '#F6F0E2', ...(fixed ?? {}) } as Record<string, string>;
}

export type Pixel = { x: number; y: number; color: string };

/** Composite the avatar to a grid of colours (null = transparent), with an ink outline. */
export function composeAvatar(av: Avatar): (string | null)[][] {
  const grid: (string | null)[][] = Array.from({ length: H }, () => Array(W).fill(null));
  const put = (x: number, y: number, c: string | undefined) => { if (c && x >= 0 && x < W && y >= 0 && y < H) grid[y][x] = c; };
  const drawExtra = (ex: Extra | undefined, pal: Record<string, string>) => {
    ex?.rows.forEach((row, dy) => [...row].forEach((ch, x) => { if (ch !== '.') put(x, ex.y + dy, pal[ch]); }));
  };
  const items = (['pack', 'top', 'bottom', 'shoes', 'neck', 'hat'] as Slot[]).map((slot) => {
    const key = av[slot];
    const art = ART[key];
    const color = (av as unknown as Record<string, string>)[`${slot}Color`] ?? '#888888';
    return art && art.slot === slot ? { art, pal: paletteFor(color, art.colors) } : null;
  });
  const hair = HAIR[av.hair] ?? HAIR.short;
  const hairPal = { h: av.hairColor, k: shade(av.hairColor, 0.75) };

  // 1. things behind the body: pack, hood, long hair
  items.forEach((it) => drawExtra(it?.art.back, it?.pal ?? {}));
  drawExtra(hair.back, hairPal);
  // 2. body, then clothing by region (shoes before trousers so boots sit under jeans hems correctly)
  const mask = bodyMask(av.body);
  const skinPal = { s: av.skin, e: INK, m: shade(av.skin, 0.8) };
  mask.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.') return;
    put(x, y, skinPal[ch as 's' | 'e' | 'm']);
    for (const slot of ['shoes', 'bottom', 'top'] as Slot[]) {
      const it = items[['pack', 'top', 'bottom', 'shoes', 'neck', 'hat'].indexOf(slot)];
      const code = it?.art.rule?.(regionOf(x, y), x, y);
      if (code) put(x, y, it!.pal[code]);
    }
  }));
  // 3. things in front: skirt hems, straps, scarves, hair fringe, hats
  for (const slot of ['bottom', 'top', 'pack', 'neck'] as Slot[]) {
    const it = items[['pack', 'top', 'bottom', 'shoes', 'neck', 'hat'].indexOf(slot)];
    drawExtra(it?.art.front, it?.pal ?? {});
  }
  drawExtra(hair.front, hairPal);
  const hat = items[5];
  drawExtra(hat?.art.front, hat?.pal ?? {});

  // 4. ink outline around the whole figure
  const out = grid.map((r) => [...r]);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (grid[y][x]) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => grid[y + dy]?.[x + dx])) out[y][x] = INK;
  }
  return out;
}

/** The character plus their pet (if any), sitting beside them, on one grid. */
export function composeTraveller(av: Avatar): (string | null)[][] {
  const body = composeAvatar(av);
  if (!av.pet || av.pet === 'none' || !PETS[av.pet]) return body;
  const pet = PETS[av.pet];
  const pw = pet[0].length;
  const width = W + PET_GAP + pw;
  const grid: (string | null)[][] = body.map((r) => [...r, ...Array(width - W).fill(null)]);
  const light = shade(av.petColor, 1.18);
  const pal: Record<string, string> = { c: av.petColor, d: shade(av.petColor, 0.72), a: light === av.petColor ? shade(av.petColor, 0.88) : light,
    e: INK, n: av.pet === 'dog' ? INK : '#E58FB1', p: '#E8A8A0', t: '#E8A8A0', b: '#E07B1F', y: '#E07B1F' };
  const x0 = W + PET_GAP, y0 = H - pet.length;
  const mask: boolean[][] = Array.from({ length: H }, () => Array(width).fill(false));
  pet.forEach((row, dy) => [...row].forEach((ch, dx) => {
    if (ch === '.') return;
    const x = x0 + dx, y = y0 + dy;
    if (y >= 0 && y < H && x < width) { grid[y][x] = pal[ch]; mask[y][x] = true; }
  }));
  for (let y = 0; y < H; y++) for (let x = 0; x < width; x++) {
    if (grid[y][x]) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => mask[y + dy]?.[x + dx])) grid[y][x] = INK;
  }
  return grid;
}

/** One SVG path per colour. */
export function avatarPaths(grid: (string | null)[][], crop?: { y0: number; y1: number }) {
  const by = new Map<string, string[]>();
  const y0 = crop?.y0 ?? 0, y1 = crop?.y1 ?? grid.length;
  for (let y = y0; y < y1; y++) {
    let x = 0;
    const w = grid[y].length;
    while (x < w) {
      const c = grid[y][x];
      if (!c) { x++; continue; }
      let e = x; while (e + 1 < w && grid[y][e + 1] === c) e++;
      (by.get(c) ?? by.set(c, []).get(c)!).push(`M${x} ${y - y0}h${e - x + 1}v1h-${e - x + 1}z`);
      x = e + 1;
    }
  }
  return [...by.entries()].map(([color, d]) => ({ color, d: d.join('') }));
}

/** Colours for the tiny back-view traveller used in the title and journey scenes. */
export function backPalette(av: Avatar): Record<string, string> {
  const head = av.hat !== 'none' && ART[av.hat] ? (ART[av.hat].colors?.c ?? av.hatColor) : av.hairColor;
  const pack = av.pack !== 'none' ? av.packColor : av.topColor;
  return { H: head, S: av.skin, B: pack, b: shade(pack, 0.75), C: av.topColor, L: av.bottomColor };
}
