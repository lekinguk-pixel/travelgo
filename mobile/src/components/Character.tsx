import { useMemo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { avatarPaths, composeAvatar, composeTraveller, H, type Avatar } from '@/lib/avatar';

/** The player's pixel traveller, with their pet beside them. `crop="portrait"` shows head and shoulders only. */
export function Character({ avatar, size, crop, noPet, style }: { avatar: Avatar; size: number; crop?: 'portrait'; noPet?: boolean; style?: StyleProp<ViewStyle> }) {
  const grid = useMemo(() => (crop === 'portrait' || noPet ? composeAvatar(avatar) : composeTraveller(avatar)), [avatar, crop, noPet]);
  const W = grid[0].length;
  const range = crop === 'portrait' ? { y0: 0, y1: 14 } : { y0: 0, y1: H };
  const paths = useMemo(() => avatarPaths(grid, range), [grid, range.y0, range.y1]); // eslint-disable-line react-hooks/exhaustive-deps
  const rows = range.y1 - range.y0;
  return (
    <View style={style} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={W * size} height={rows * size} viewBox={`0 0 ${W} ${rows}`} {...({ shapeRendering: 'crispEdges' } as object)}>
        {paths.map((p) => <Path key={p.color} d={p.d} fill={p.color} />)}
      </Svg>
    </View>
  );
}
