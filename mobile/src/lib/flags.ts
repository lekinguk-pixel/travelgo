// 3×3 pixel flag patches for the flag tees, one per country (simplified to read at tiny size).
// Letters: r red, w white, b navy, l sky blue, g green, y yellow, k black, o orange, m maroon, s silver, a aqua.
export const FLAG_COLORS: Record<string, string> = {
  r: '#D2303C', w: '#F6F0E2', b: '#1F3F8F', l: '#5AA9E6', g: '#2E8B4F', y: '#F2C230',
  k: '#1A1A20', o: '#E8862A', m: '#8A1C2B', s: '#A7B1BC', a: '#2FB5B5',
};

const V = (a: string, b: string, c: string) => [a + b + c, a + b + c, a + b + c];   // vertical tricolour
const H = (a: string, b: string, c: string) => [a.repeat(3), b.repeat(3), c.repeat(3)]; // horizontal tricolour
const X = (bg: string, cr: string) => [bg + cr + bg, cr.repeat(3), bg + cr + bg];    // centred cross
const D = (bg: string, dot: string) => [bg.repeat(3), bg + dot + bg, bg.repeat(3)];   // disc / emblem

export const FLAGS: Record<string, string[]> = {
  // Europe
  gb: ['brb', 'rrr', 'brb'], ie: V('g', 'w', 'o'), fr: V('b', 'w', 'r'), be: V('k', 'y', 'r'), nl: H('r', 'w', 'b'),
  lu: H('r', 'w', 'l'), de: H('k', 'r', 'y'), at: H('r', 'w', 'r'), ch: X('r', 'w'), li: ['byb', 'bbb', 'rrr'],
  it: V('g', 'w', 'r'), sm: ['www', 'lll', 'lll'], va: ['yww', 'yww', 'yww'], mt: ['swr', 'wwr', 'wwr'], es: H('r', 'y', 'r'),
  pt: ['ggr', 'gyr', 'ggr'], ad: V('b', 'y', 'r'), mc: ['rrr', 'www', 'www'], dk: X('r', 'w'), no: ['rbr', 'bbb', 'rbr'],
  se: X('b', 'y'), fi: X('w', 'b'), is: ['bry', 'rrr', 'brb'], ee: H('l', 'k', 'w'), lv: H('m', 'w', 'm'),
  lt: H('y', 'g', 'r'), pl: ['www', 'www', 'rrr'], cz: ['bww', 'bbr', 'brr'], sk: ['www', 'bwb', 'rrr'], si: ['www', 'lbb', 'rrr'],
  hu: H('r', 'w', 'g'), ro: V('b', 'y', 'r'), md: ['byr', 'bor', 'byr'], bg: H('w', 'g', 'r'), gr: ['bwb', 'wbw', 'bwb'],
  cy: D('w', 'o'), hr: ['rrr', 'wrw', 'bbb'], ba: ['byb', 'bby', 'bbb'], rs: ['rrr', 'byb', 'www'], me: ['yyy', 'yry', 'yyy'],
  al: D('r', 'k'), mk: ['yry', 'ryr', 'yry'], xk: D('b', 'y'), tr: D('r', 'w'),
  // Americas
  us: ['bbr', 'www', 'rrr'], ca: ['rwr', 'rrr', 'rwr'], mx: ['gwr', 'gyr', 'gwr'], gt: V('l', 'w', 'l'), bz: ['rrr', 'bwb', 'rrr'],
  hn: ['bbb', 'wbw', 'bbb'], sv: ['bbb', 'wyw', 'bbb'], ni: ['lll', 'www', 'lll'], cr: ['bwb', 'rrr', 'bwb'], pa: ['wrr', 'www', 'bbw'],
  do: ['bwr', 'www', 'rwb'], pr: ['brr', 'bww', 'brr'], jm: ['ygy', 'kyk', 'ygy'], bs: ['kaa', 'kyy', 'kaa'], bb: ['byb', 'bkb', 'byb'],
  aw: ['rll', 'lll', 'yyy'], cw: ['wbb', 'bbb', 'yyy'], tt: ['rwk', 'wkw', 'kwr'],
  br: ['gyg', 'yby', 'gyg'], ar: ['lll', 'wyw', 'lll'], cl: ['bww', 'www', 'rrr'], pe: V('r', 'w', 'r'), co: ['yyy', 'bbb', 'rrr'],
  ec: ['yyy', 'byb', 'rrr'], bo: H('r', 'y', 'g'), uy: ['ybb', 'www', 'bbb'], py: H('r', 'w', 'b'), gy: ['ryg', 'ryy', 'ryg'],
  sr: ['ggg', 'ryr', 'ggg'],
  // Asia
  jp: D('w', 'r'), kr: ['kwk', 'wrw', 'wbk'], cn: ['yrr', 'rrr', 'rrr'], hk: D('r', 'w'), mo: D('g', 'w'),
  tw: ['bbr', 'bbr', 'rrr'], mn: ['ybr', 'rbr', 'rbr'], th: ['rrr', 'bbb', 'rrr'], vn: D('r', 'y'), kh: ['bbb', 'rwr', 'bbb'],
  la: ['rrr', 'bwb', 'rrr'], my: ['byr', 'bbw', 'rrr'], sg: ['wrr', 'rrr', 'www'], id: ['rrr', 'rrr', 'www'], ph: ['wbb', 'wyr', 'wrr'],
  bn: ['ywy', 'yry', 'yky'], in: ['ooo', 'wbw', 'ggg'], np: ['rwb', 'rrr', 'rwb'], lk: ['gom', 'gom', 'yyy'], mv: ['rrr', 'gwg', 'rrr'],
  bt: ['yyw', 'ywo', 'woo'], uz: H('l', 'w', 'g'), kz: D('l', 'y'), kg: ['ryr', 'yyy', 'ryr'], ge: ['wrw', 'rrr', 'wrw'],
  am: H('r', 'b', 'o'), az: H('l', 'r', 'g'),
};
