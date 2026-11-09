import { Animated, View } from 'react-native';
import Svg, { Circle, G, Path, Polygon, Rect, Text as SvgText } from 'react-native-svg';
import { colors, fonts } from '@/lib/theme';

export const WEDGE_COLORS = ['#C8553D', '#D9A441', '#2A7F75', '#8E44C9', '#2F6FCF', '#E07B1F', '#3E9B4F', '#B5784A', '#1B2A41', '#A7B1BC', '#C8553D', '#2A7F75'];
const LIGHT = new Set(['#D9A441', '#E07B1F', '#A7B1BC']);

const shortName = (s: string) => (s.length > 13 ? s.slice(0, 12).trimEnd() + '…' : s);

function wedge(cx: number, cy: number, r: number, a0: number, a1: number) {
  // Angles in degrees, clockwise from 12 o'clock.
  const p = (a: number) => [cx + r * Math.sin((a * Math.PI) / 180), cy - r * Math.cos((a * Math.PI) / 180)];
  const [x0, y0] = p(a0), [x1, y1] = p(a1);
  return `M${cx} ${cy} L${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
}

/** The pixel prize wheel: coloured wedges with city names, a bulb-lit rim and a pointer at the top. */
export function SpinWheel({ size, names, rotation, bulbsOn }: {
  size: number; names: string[]; rotation: Animated.Value; bulbsOn: boolean;
}) {
  const n = Math.max(names.length, 2);
  const seg = 360 / n;
  const k = size / 360;
  const c = size / 2, rRim = c - Math.max(6, 14 * k), rFace = rRim - Math.max(5, 12 * k);
  const top = Math.round(Math.max(8, 18 * k)), b = Math.max(3, 8 * k), hub = Math.max(7, 26 * k);
  const spin = rotation.interpolate({ inputRange: [-36000, 36000], outputRange: ['-36000deg', '36000deg'] });
  const bulbs = 20;

  return (
    <View style={{ width: size, height: size + top }}>
      <View style={{ position: 'absolute', top, left: 0, width: size, height: size }}>
        {/* Static rim with bulbs */}
        <Svg width={size} height={size} style={{ position: 'absolute' }}>
          <Circle cx={c} cy={c} r={rRim + Math.max(3, 8 * k)} fill={colors.ink} />
          <Circle cx={c} cy={c} r={rRim + 2} fill="#8B5A2B" stroke={colors.ink} strokeWidth={3} />
          {Array.from({ length: bulbs }, (_, i) => {
            const a = (i / bulbs) * Math.PI * 2;
            const x = c + (rRim - 3 * k) * Math.sin(a), y = c - (rRim - 3 * k) * Math.cos(a);
            const on = (i % 2 === 0) === bulbsOn;
            return <Rect key={i} x={x - b / 2} y={y - b / 2} width={b} height={b} fill={on ? '#FFE9A8' : '#6B4A22'} stroke={colors.ink} strokeWidth={1.5} />;
          })}
        </Svg>
        {/* Spinning face */}
        <Animated.View style={{ position: 'absolute', width: size, height: size, transform: [{ rotate: spin }] }}>
          <Svg width={size} height={size}>
            {names.map((name, i) => {
              const fill = WEDGE_COLORS[i % WEDGE_COLORS.length];
              const mid = i * seg + seg / 2;
              return (
                <G key={i}>
                  <Path d={wedge(c, c, rFace, i * seg, (i + 1) * seg)} fill={fill} stroke={colors.ink} strokeWidth={Math.max(1.5, 3 * k)} strokeLinejoin="round" />
                  <G transform={mid > 180 ? `rotate(${mid + 90} ${c} ${c})` : `rotate(${mid - 90} ${c} ${c})`}>
                    <SvgText x={mid > 180 ? c - rFace + 12 * k : c + rFace - 12 * k} y={c + 4} textAnchor={mid > 180 ? 'start' : 'end'}
                      fontFamily={fonts.labelBold} fontSize={size > 300 ? 11 : 10}
                      fill={LIGHT.has(fill) ? colors.ink : colors.paper}>{shortName(name).toUpperCase()}</SvgText>
                  </G>
                </G>
              );
            })}
            {/* Hub: a little pixel globe */}
            <Circle cx={c} cy={c} r={hub} fill={colors.ink} />
            <Circle cx={c} cy={c} r={hub * 0.77} fill={colors.teal} stroke={colors.paper} strokeWidth={Math.max(1, 2 * k)} />
            <G transform={`translate(${c} ${c}) scale(${hub / 26})`}>
              <Path d="M-9 -8h7v4h4v5h-5v6h-5z M3 -13h5v3h4v6h-4v-3h-5z M6 4h6v4h-3v5h-3z" fill={colors.grass} />
            </G>
          </Svg>
        </Animated.View>
      </View>
      {/* Pointer */}
      <Svg width={size} height={top + 30 * Math.max(k, 0.4)} style={{ position: 'absolute', top: 0, left: 0 }}>
        <Polygon points={`${c - 15 * Math.max(k, 0.45)},2 ${c + 15 * Math.max(k, 0.45)},2 ${c},${top + 22 * Math.max(k, 0.4)}`} fill={colors.stamp} stroke={colors.ink} strokeWidth={Math.max(2, 3 * k)} strokeLinejoin="round" />
        {k > 0.6 ? <Rect x={c - 4} y={7} width={8} height={8} fill={colors.paper} /> : null}
      </Svg>
    </View>
  );
}
