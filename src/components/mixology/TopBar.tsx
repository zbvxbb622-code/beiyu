import { type Href, useRouter } from 'expo-router';
import { ChevronLeft, MoreHorizontal } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/styles/mixologyTheme';

export function TopBar({
  title,
  right,
  showBack = true,
  backHref,
}: {
  title?: string;
  right?: ReactNode;
  showBack?: boolean;
  backHref?: Href;
}) {
  const router = useRouter();
  const handleBack = () => {
    if (backHref) {
      router.replace(backHref);
      return;
    }

    router.back();
  };

  return (
    <View style={styles.root}>
      {showBack ? (
        <Pressable
          accessibilityRole="button"
          testID="topbar-back-button"
          onPress={handleBack}
          hitSlop={12}
          style={styles.iconButton}>
          <ChevronLeft color={colors.pink} size={30} />
        </Pressable>
      ) : (
        <View style={styles.iconButton} />
      )}
      <Text style={styles.title}>{title}</Text>
      <View style={styles.right}>{right ?? <MoreHorizontal color="transparent" size={26} />}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconButton: {
    width: 44,
    minHeight: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  right: {
    width: 44,
    minHeight: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
});
