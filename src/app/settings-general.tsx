import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';

import { ScreenShell } from '@/components/mixology/ScreenShell';
import { SettingsGeneralSection } from '@/components/mixology/SettingsGeneralSection';
import { colors, spacing } from '@/styles/mixologyTheme';

export default function SettingsGeneralScreen() {
  const router = useRouter();
  const [useSystemFont, setUseSystemFont] = useState(true);

  return (
    <ScreenShell padded={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => router.replace('/settings' as Href)}
            style={({ pressed }) => [styles.headerSidePressable, pressed ? styles.pressed : null]}
            testID="settings-general-back-button"
          >
            <View style={styles.headerSideInner}>
              <ChevronLeft color={colors.text} size={26} />
            </View>
          </Pressable>
          <Text style={styles.headerTitle}>通用设置</Text>
          <View style={styles.headerSidePlaceholder} />
        </View>

        <View style={styles.body}>
          <SettingsGeneralSection
            useSystemFont={useSystemFont}
            onToggleSystemFont={() => setUseSystemFont((v) => !v)}
          />
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.bottomNavPadding,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.pageX,
    paddingTop: 6,
    paddingBottom: 10,
  },
  headerSidePressable: {
    width: 44,
    height: 44,
  },
  headerSideInner: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSidePlaceholder: {
    width: 44,
    height: 44,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  body: {
    paddingHorizontal: spacing.pageX,
    paddingTop: 6,
  },
  pressed: {
    opacity: 0.72,
  },
});
