import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';

import { colors, gradients, radii } from '@/styles/mixologyTheme';

export function GradientButton({
  label,
  onPress,
  icon,
  style,
  testID,
}: {
  label: string;
  onPress?: () => void;
  icon?: ReactNode;
  style?: ViewStyle;
  testID?: string;
}) {
  return (
    <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [styles.pressable, style, pressed ? styles.pressed : null]}>
      <LinearGradient colors={gradients.cta} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.gradient}>
        <Text style={styles.label}>{label}</Text>
        {icon}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    borderRadius: radii.pill,
  },
  pressed: {
    opacity: 0.82,
  },
  gradient: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    borderRadius: radii.pill,
    paddingHorizontal: 24,
    shadowColor: colors.pink,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 22,
    elevation: 8,
  },
  label: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
});
