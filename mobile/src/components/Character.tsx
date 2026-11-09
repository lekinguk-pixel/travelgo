import { useMemo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { avatarPaths, composeAvatar, H, W, type Avatar } from '@/lib/avatar';

/** The player's pixel traveller. `crop="portrait"` shows head and shoulders only. */
export function Character({ avatar, size, crop, style }: { avatar: Avatar; size: number; crop?: 'portrait'; style?: StyleProp<ViewStyle> }) {
  const grid = useMemo(() => composeAvatar(avatar), [avatar]);
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
