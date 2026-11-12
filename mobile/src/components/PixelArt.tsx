import Svg, { Path } from 'react-native-svg';

/** Turn rows of palette letters ('.' = empty) into one SVG path per colour, merging runs along each row. */
export function pixelPaths(rows: string[], palette: Record<string, string>) {
  const byColor: Record<string, string[]> = {};
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (ch === '.' || !palette[ch]) { x++; continue; }
      let end = x;
      while (end + 1 < row.length && row[end + 1] === ch) end++;
      (byColor[palette[ch]] ??= []).push(`M${x} ${y}h${end - x + 1}v1h-${end - x + 1}z`);
      x = end + 1;
    }
  });
  return Object.entries(byColor).map(([color, parts]) => ({ color, d: parts.join('') }));
}

/** A crisp pixel-art sprite at any scale. */
export function PixelArt({ rows, palette, scale = 4 }: { rows: string[]; palette: Record<string, string>; scale?: number }) {
  const w = Math.max(...rows.map((r) => r.length)), h = rows.length;
  return (
    <Svg width={w * scale} height={h * scale} viewBox={`0 0 ${w} ${h}`} {...({ shapeRendering: 'crispEdges' } as object)}>
      {pixelPaths(rows, palette).map((p) => <Path key={p.color} d={p.d} fill={p.color} />)}
    </Svg>
  );
}
