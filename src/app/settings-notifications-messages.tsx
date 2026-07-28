import { type Href, useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';

import { ScreenShell } from '@/components/mixology/ScreenShell';
import { Toggle } from '@/components/mixology/Toggle';
import { colors, radii, spacing } from '@/styles/mixologyTheme';

export default function SettingsNotificationsMessagesScreen() {
  const router = useRouter();
  const [prefs, setPrefs] = useState({
    privateChat: true,
    groupChat: true,
    strangers: true,
  });
  const toggle = (key: keyof typeof prefs) =>
    setPrefs((p) => ({ ...p, [key]: !p[key] }));

  return (
    <ScreenShell padded={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => router.replace('/settings-notifications' as Href)}
            style={({ pressed }) => [styles.headerSidePressable, pressed ? styles.pressed : null]}
            testID="settings-notifications-messages-back-button"
          >
            <View style={styles.headerSideInner}>
              <ChevronLeft color={colors.text} size={26} />
            </View>
          </Pressable>
          <Text style={styles.headerTitle}>私信</Text>
          <View style={styles.headerSidePlaceholder} />
        </View>

        <View style={styles.body}>
          <View style={styles.card}>
            <Row
              title="私聊"
              onPress={() => toggle('privateChat')}
              trailing={<Toggle value={prefs.privateChat} onColor={colors.red} />}
              testID="messages-private"
            />
            <Row
              title="群聊"
              onPress={() => toggle('groupChat')}
              trailing={<Toggle value={prefs.groupChat} onColor={colors.red} />}
              testID="messages-group"
            />
            <Row
              title="陌生人"
              onPress={() => toggle('strangers')}
              trailing={<Toggle value={prefs.strangers} onColor={colors.red} />}
              isLast
              testID="messages-strangers"
            />
          </View>
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

function Row({
  title,
  trailing,
  isLast = false,
  onPress,
  testID,
}: {
  title: string;
  trailing?: ReactNode;
  isLast?: boolean;
  onPress?: () => void;
  testID?: string;
}) {
  const inner = (
    <View style={[styles.rowInner, isLast ? null : styles.rowDivider]}>
      <Text style={styles.rowTitle}>{title}</Text>
      <View style={styles.rowRight}>{trailing}</View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.rowPressable, pressed ? styles.pressed : null]}
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

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.bottomNavPadding },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.pageX,
    paddingTop: 6,
    paddingBottom: 10,
  },
  headerSidePressable: { width: 44, height: 44 },
  headerSideInner: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerSidePlaceholder: { width: 44, height: 44 },
  headerTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  body: { paddingHorizontal: spacing.pageX, paddingTop: 6 },
  card: {
    borderRadius: radii.lg,
    backgroundColor: colors.panelSoft,
    marginBottom: 14,
    overflow: 'hidden',
  },
  rowPressable: { minHeight: 54, justifyContent: 'center' },
  rowInner: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  rowTitle: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '600' },
  rowRight: { flexDirection: 'row', alignItems: 'center' },
  pressed: { opacity: 0.72 },
});