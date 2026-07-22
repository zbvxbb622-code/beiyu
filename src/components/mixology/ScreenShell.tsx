import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { gradients, spacing } from '@/styles/mixologyTheme';

export function ScreenShell({
  children,
  padded = true,
}: {
  children: ReactNode;
  padded?: boolean;
}) {
  const { width } = useWindowDimensions();
  const isCompact = width < 380;
  const paddingHorizontal = isCompact ? spacing.pageXCompact : spacing.pageX;

  return (
    <LinearGradient colors={gradients.app} style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View
          style={[
            styles.content,
            padded ? { paddingHorizontal, paddingTop: 8 } : null,
          ]}>
          {children}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});
