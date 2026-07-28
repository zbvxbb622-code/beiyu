import { ChevronRight } from 'lucide-react-native';
import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii } from '@/styles/mixologyTheme';

export type SettingsGeneralSectionProps = {
  useSystemFont: boolean;
  onToggleSystemFont: () => void;
  onPressFontSize?: () => void;
  onPressDarkMode?: () => void;
};

export function SettingsGeneralSection({
  useSystemFont,
  onToggleSystemFont,
  onPressFontSize,
  onPressDarkMode,
}: SettingsGeneralSectionProps) {
  return (
    <View style={styles.root}>
      <Text style={styles.groupLabel}>显示</Text>
      <View style={styles.group}>
        <SettingsRow
          title="字体大小"
          onPress={onPressFontSize}
          showArrow
          testID="settings-general-font-size"
        />
        <SettingsRow
          title="使用系统默认字体"
          onPress={onToggleSystemFont}
          trailing={<Toggle value={useSystemFont} />}
          testID="settings-general-system-font"
        />
        <SettingsRow
          title="深色模式"
          onPress={onPressDarkMode}
          showArrow
          isLast
          testID="settings-general-dark-mode"
        />
      </View>
    </View>
  );
}

function SettingsRow({
  title,
  onPress,
  showArrow = false,
  trailing,
  isLast = false,
  testID,
}: {
  title: string;
  onPress?: () => void;
  showArrow?: boolean;
  trailing?: ReactNode;
  isLast?: boolean;
  testID?: string;
}) {
  const inner = (
    <View
      style={[
        styles.rowInner,
        isLast ? styles.rowInnerLast : styles.rowInnerDivider,
      ]}
    >
      <Text style={styles.rowTitle}>{title}</Text>
      <View style={styles.rowRight}>
        {trailing}
        {showArrow ? <ChevronRight color={colors.textMuted} size={18} /> : null}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.rowPressable,
          pressed ? styles.pressed : null,
        ]}
        testID={testID}
      >
        {inner}
      </Pressable>
    );
  }

  return (
    <View style={styles.rowPressable} testID={testID}>
      {inner}
    </View>
  );
}

function Toggle({ value }: { value: boolean }) {
  return (
    <View
      style={[
        styles.toggleTrack,
        value ? styles.toggleTrackOn : styles.toggleTrackOff,
      ]}
    >
      <View
        style={[
          styles.toggleThumb,
          value ? styles.toggleThumbOn : styles.toggleThumbOff,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    marginBottom: 14,
  },
  groupLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 8,
    marginLeft: 4,
  },
  group: {
    borderRadius: radii.lg,
    backgroundColor: colors.panelSoft,
    overflow: 'hidden',
  },
  rowPressable: {
    minHeight: 54,
    justifyContent: 'center',
  },
  rowInner: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  rowInnerDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  rowInnerLast: {},
  rowTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleTrack: {
    width: 46,
    height: 26,
    borderRadius: 13,
    padding: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleTrackOn: {
    backgroundColor: '#FFFFFF',
    justifyContent: 'flex-end',
  },
  toggleTrackOff: {
    backgroundColor: colors.panelStrong,
    justifyContent: 'flex-start',
  },
  toggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  toggleThumbOn: {
    backgroundColor: colors.bg,
  },
  toggleThumbOff: {
    backgroundColor: '#FFFFFF',
  },
  pressed: {
    opacity: 0.72,
  },
});