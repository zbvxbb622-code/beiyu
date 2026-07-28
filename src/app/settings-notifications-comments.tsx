import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';

import { ScreenShell } from '@/components/mixology/ScreenShell';
import { Toggle } from '@/components/mixology/Toggle';
import { colors, radii, spacing } from '@/styles/mixologyTheme';

export default function SettingsNotificationsCommentsScreen() {
  const router = useRouter();
  const [commentNotify, setCommentNotify] = useState(true);
  const [filterSpam, setFilterSpam] = useState(true);

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
            testID="settings-notifications-comments-back-button"
          >
            <View style={styles.headerSideInner}>
              <ChevronLeft color={colors.text} size={26} />
            </View>
          </Pressable>
          <Text style={styles.headerTitle}>评论</Text>
          <View style={styles.headerSidePlaceholder} />
        </View>

        <View style={styles.body}>
          <View style={styles.card}>
            <Row
              title="评论通知"
              onPress={() => setCommentNotify((v) => !v)}
              trailing={<Toggle value={commentNotify} onColor={colors.red} />}
              testID="comments-notify"
            />
          </View>

          <Text style={styles.sectionLabel}>可能打扰的评论管理</Text>

          <View style={styles.card}>
            <Row
              title="过滤可能打扰的评论通知"
              onPress={() => setFilterSpam((v) => !v)}
              trailing={<Toggle value={filterSpam} onColor={colors.red} />}
              isLast
              testID="comments-filter"
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
  trailing?: React.ReactNode;
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
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 8,
    marginLeft: 4,
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