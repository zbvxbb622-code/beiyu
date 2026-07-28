import { StyleSheet, View } from 'react-native';

import { colors } from '@/styles/mixologyTheme';

export type ToggleProps = {
  value: boolean;
  /** 开启态轨道颜色（默认白色） */
  onColor?: string;
  /** 关闭态轨道颜色（默认 panelStrong） */
  offColor?: string;
  /** 开启态圆点颜色（默认白色） */
  thumbOnColor?: string;
  /** 关闭态圆点颜色（默认白色） */
  thumbOffColor?: string;
};

/**
 * iOS 风格 Toggle（46×26）。开启态圆点靠右，关闭态靠左。
 * 通过 4 个颜色 prop 自由配色，适配「白轨深点」与「品牌红轨白点」等不同场景。
 */
export function Toggle({
  value,
  onColor = '#FFFFFF',
  offColor = colors.panelStrong,
  thumbOnColor = '#FFFFFF',
  thumbOffColor = '#FFFFFF',
}: ToggleProps) {
  return (
    <View style={[styles.track, value ? styles.trackOn : styles.trackOff]}>
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: value ? onColor : offColor, borderRadius: 13 },
        ]}
        pointerEvents="none"
      />
      <View
        style={[
          styles.thumb,
          { backgroundColor: value ? thumbOnColor : thumbOffColor },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: 46,
    height: 26,
    borderRadius: 13,
    padding: 2,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  trackOn: { justifyContent: 'flex-end' },
  trackOff: { justifyContent: 'flex-start' },
  thumb: { width: 22, height: 22, borderRadius: 11 },
});