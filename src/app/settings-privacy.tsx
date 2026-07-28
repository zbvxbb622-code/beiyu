import { type Href, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

import { ScreenShell } from '@/components/mixology/ScreenShell';
import { colors, radii, spacing, touchTarget } from '@/styles/mixologyTheme';

type PrivacyRow = {
  title: string;
  subtitle?: string;
  value?: string;
  href: string;
  testID: string;
};

type Group = {
  label: string;
  rows: PrivacyRow[];
};

const GROUPS: Group[] = [
  {
    label: '关系',
    rows: [
      {
        title: '找到我的方式',
        href: '/settings-privacy-find-me',
        testID: 'privacy-find-me',
      },
      {
        title: '推荐可能认识的人给我',
        value: '开启',
        href: '/settings-privacy-recommend-to-me',
        testID: 'privacy-recommend-to-me',
      },
      {
        title: '把我推荐给可能认识的人',
        value: '开启',
        href: '/settings-privacy-recommend-me-to',
        testID: 'privacy-recommend-me-to',
      },
    ],
  },
  {
    label: '屏蔽与黑名单',
    rows: [
      {
        title: '不让他(她)看',
        href: '/settings-privacy-block-from-view',
        testID: 'privacy-block-from-view',
      },
      {
        title: '不看他(她)',
        href: '/settings-privacy-block-view',
        testID: 'privacy-block-view',
      },
      {
        title: '黑名单',
        href: '/settings-privacy-blacklist',
        testID: 'privacy-blacklist',
      },
    ],
  },
  {
    label: '互动权限',
    rows: [
      {
        title: '一键防护',
        value: '关闭',
        href: '/settings-privacy-one-click-protection',
        testID: 'privacy-one-click-protection',
      },
      {
        title: '谁可以私信我',
        value: '默认',
        href: '/settings-privacy-who-can-dm',
        testID: 'privacy-who-can-dm',
      },
      {
        title: '谁可以给我评论和发弹幕',
        value: '全部',
        href: '/settings-privacy-who-can-comment',
        testID: 'privacy-who-can-comment',
      },
      {
        title: '谁可以@我',
        value: '全部',
        href: '/settings-privacy-who-can-at',
        testID: 'privacy-who-can-at',
      },
      {
        title: '聊天标识',
        value: '开启',
        href: '/settings-privacy-chat-tag',
        testID: 'privacy-chat-tag',
      },
    ],
  },
  {
    label: '内容和状态权限',
    rows: [
      {
        title: '在线状态',
        value: '互相关注的人',
        href: '/settings-privacy-online-status',
        testID: 'privacy-online-status',
      },
      {
        title: '关注与粉丝列表',
        value: '全部公开',
        href: '/settings-privacy-follow-fans',
        testID: 'privacy-follow-fans',
      },
      {
        title: '我的收藏',
        value: '公开',
        href: '/settings-privacy-favorites',
        testID: 'privacy-favorites',
      },
    ],
  },
  {
    label: '权限',
    rows: [
      {
        title: '系统权限管理',
        subtitle: 'APP内使用的所有系统权限',
        href: '/settings-privacy-system-permissions',
        testID: 'privacy-system-permissions',
      },
    ],
  },
  {
    label: '更多',
    rows: [
      {
        title: '个性化选项',
        href: '/settings-privacy-personalize',
        testID: 'privacy-personalize',
      },
    ],
  },
];

export default function SettingsPrivacyScreen() {
  const router = useRouter();

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
            testID="settings-privacy-back-button"
          >
            <View style={styles.headerSideInner}>
              <ChevronLeft color={colors.text} size={26} />
            </View>
          </Pressable>
          <Text style={styles.headerTitle}>隐私设置</Text>
          <View style={styles.headerSidePlaceholder} />
        </View>

        <View style={styles.body}>
          {GROUPS.map((group) => (
            <View key={group.label} style={styles.groupSection}>
              <Text style={styles.sectionLabel}>{group.label}</Text>
              <View style={styles.card}>
                {group.rows.map((row, index) => {
                  const isLast = index === group.rows.length - 1;
                  return (
                    <Row
                      key={row.testID}
                      title={row.title}
                      subtitle={row.subtitle}
                      value={row.value}
                      href={row.href}
                      isLast={isLast}
                      testID={row.testID}
                    />
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

function Row({
  title,
  subtitle,
  value,
  href,
  isLast,
  testID,
}: {
  title: string;
  subtitle?: string;
  value?: string;
  href: string;
  isLast: boolean;
  testID: string;
}) {
  const router = useRouter();

  const inner = (
    <View style={[styles.rowInner, isLast ? null : styles.rowDivider]}>
      <View style={styles.rowTextWrap}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.rowRight}>
        {value ? <Text style={styles.rowValue}>{value}</Text> : null}
        <ChevronRight color={colors.textMuted} size={18} />
      </View>
    </View>
  );

  return (
    <Pressable
      onPress={() => router.push(href as Href)}
      style={({ pressed }) => [styles.rowPressable, pressed ? styles.pressed : null]}
      testID={testID}
    >
      {inner}
    </Pressable>
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
  headerSidePressable: {
    width: touchTarget.min,
    height: touchTarget.min,
  },
  headerSideInner: {
    width: touchTarget.min,
    height: touchTarget.min,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSidePlaceholder: {
    width: touchTarget.min,
    height: touchTarget.min,
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
  groupSection: {
    marginBottom: 14,
  },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
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
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  rowTextWrap: {
    flex: 1,
  },
  rowTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  rowSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowValue: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
    marginRight: 4,
  },
  pressed: { opacity: 0.72 },
});
