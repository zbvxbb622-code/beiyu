import { type Href, useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

import { ScreenShell } from '@/components/mixology/ScreenShell';
import { Toggle } from '@/components/mixology/Toggle';
import { colors, radii, spacing } from '@/styles/mixologyTheme';

export default function SettingsNotificationsScreen() {
  const router = useRouter();
  const [prefs, setPrefs] = useState({
    likesFavorites: true,
    newFollows: true,
    mentions: true,
    shares: true,
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
            onPress={() => router.replace('/settings' as Href)}
            style={({ pressed }) => [
              styles.headerSidePressable,
              pressed ? styles.pressed : null,
            ]}
            testID="settings-notifications-back-button"
          >
            <View style={styles.headerSideInner}>
              <ChevronLeft color={colors.text} size={26} />
            </View>
          </Pressable>
          <Text style={styles.headerTitle}>通知设置</Text>
          <View style={styles.headerSidePlaceholder} />
        </View>

        <View style={styles.body}>
          <Text style={styles.groupLabel}>互动通知</Text>
          <Card>
            <Row
              title="赞和收藏"
              onPress={() => toggle('likesFavorites')}
              trailing={<Toggle value={prefs.likesFavorites} />}
              testID="notifications-likes"
            />
            <Row
              title="新增关注"
              onPress={() => toggle('newFollows')}
              trailing={<Toggle value={prefs.newFollows} />}
              testID="notifications-new-follows"
            />
            <Row
              title="评论"
              value="接收"
              showArrow
              onPress={() => router.push('/settings-notifications-comments' as Href)}
              testID="notifications-comments"
            />
            <Row
              title="@"
              onPress={() => toggle('mentions')}
              trailing={<Toggle value={prefs.mentions} />}
              testID="notifications-mentions"
            />
            <Row
              title="分享"
              onPress={() => toggle('shares')}
              trailing={<Toggle value={prefs.shares} />}
              isLast
              testID="notifications-shares"
            />
          </Card>

          <Text style={styles.groupLabel}>私信通知</Text>
          <Card>
            <Row
              title="私信"
              value="接收"
              showArrow
              onPress={() => router.push('/settings-notifications-messages' as Href)}
              isLast
              testID="notifications-dm"
            />
          </Card>

          <Text style={styles.groupLabel}>社区内容通知</Text>
          <Card>
            <Row
              title="关注作者的更新"
              value="接收"
              showArrow
              onPress={() => router.push('/settings-notifications-author' as Href)}
              isLast
              testID="notifications-author-update"
            />
          </Card>
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

function Row({
  title,
  value,
  showArrow = false,
  trailing,
  isLast = false,
  onPress,
  testID,
}: {
  title: string;
  value?: string;
  showArrow?: boolean;
  trailing?: ReactNode;
  isLast?: boolean;
  onPress?: () => void;
  testID?: string;
}) {
  const inner = (
    <View style={[styles.rowInner, isLast ? null : styles.rowDivider]}>
      <Text style={styles.rowTitle}>{title}</Text>
      <View style={styles.rowRight}>
        {value ? <Text style={styles.rowValue}>{value}</Text> : null}
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
  headerSideInner: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSidePlaceholder: { width: 44, height: 44 },
  headerTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  body: { paddingHorizontal: spacing.pageX, paddingTop: 6 },
  groupLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 8,
    marginLeft: 4,
  },
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
  rowValue: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
    marginRight: 4,
  },
  pressed: { opacity: 0.72 },
});