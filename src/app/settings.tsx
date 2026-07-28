import { type Href, useRouter } from 'expo-router';
import { type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Headphones,
  Languages,
  LockKeyhole,
  Settings,
  UserRound,
} from 'lucide-react-native';

import { ScreenShell } from '@/components/mixology/ScreenShell';
import { useMixology } from '@/state/MixologyState';
import { colors, radii, spacing } from '@/styles/mixologyTheme';

export default function SettingsScreen() {
  const router = useRouter();
  const { logout } = useMixology();

  const handleLogout = async () => {
    await logout();
    router.replace('/' as Href);
  };

  return (
    <ScreenShell padded={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => router.replace('/profile' as Href)}
            style={({ pressed }) => [styles.headerSidePressable, pressed ? styles.pressed : null]}
            testID="settings-back-button"
          >
            <View style={styles.headerSideInner}>
              <ChevronLeft color={colors.text} size={26} />
            </View>
          </Pressable>
          <Text style={styles.headerTitle}>设置</Text>
          <View style={styles.headerSidePlaceholder} />
        </View>

        <View style={styles.body}>
          <SettingsGroup>
            <SettingsItem
              icon={<UserRound color={colors.text} size={21} />}
              title="账号与安全"
              onPress={() => router.push('/account-security' as Href)}
              testID="settings-account-security"
            />
            <SettingsItem
              icon={<Settings color={colors.text} size={21} />}
              title="通用设置"
              onPress={() => router.push('/settings-general' as Href)}
              testID="settings-general"
            />
            <SettingsItem
              icon={<Bell color={colors.text} size={21} />}
              title="通知设置"
              onPress={() => router.push('/settings-notifications' as Href)}
              testID="settings-notifications"
            />
            <SettingsItem
              icon={<Languages color={colors.text} size={21} />}
              title="多语言和翻译"
              onPress={() => router.push('/settings-language' as Href)}
              testID="settings-language"
            />
            <SettingsItem
              icon={<LockKeyhole color={colors.text} size={21} />}
              title="隐私设置"
              onPress={() => router.push('/settings-privacy' as Href)}
              testID="settings-privacy"
            />
          </SettingsGroup>

          <SettingsGroup>
            <SettingsItem
              icon={<Headphones color={colors.text} size={21} />}
              title="帮助与客服"
              testID="settings-help"
            />
          </SettingsGroup>

          <View style={styles.bottomActions}>
            <Pressable
              onPress={() => router.push('/login' as Href)}
              style={({ pressed }) => [styles.bottomActionPressable, pressed ? styles.pressed : null]}
              testID="settings-switch-account"
            >
              <View style={styles.bottomActionInner}>
                <Text style={styles.bottomActionText}>切换账号</Text>
              </View>
            </Pressable>
            <View style={styles.bottomDivider} />
            <Pressable
              onPress={handleLogout}
              style={({ pressed }) => [styles.bottomActionPressable, pressed ? styles.pressed : null]}
              testID="settings-logout-button"
            >
              <View style={styles.bottomActionInner}>
                <Text style={[styles.bottomActionText, styles.logoutText]}>退出登录</Text>
              </View>
            </Pressable>
          </View>

          <View style={styles.legalLinks}>
            <Text style={styles.legalText}>
              《个人信息收集清单》《第三方信息共享清单》
            </Text>
            <Text style={styles.legalText}>
              《小红书用户服务协议》《小红书用户隐私政策》
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

function SettingsGroup({ children }: { children: ReactNode }) {
  return <View style={styles.group}>{children}</View>;
}

function SettingsItem({
  icon,
  title,
  value,
  showArrow = true,
  trailing,
  onPress,
  testID,
}: {
  icon: ReactNode;
  title: string;
  value?: string;
  showArrow?: boolean;
  trailing?: ReactNode;
  onPress?: () => void;
  testID?: string;
}) {
  const content = (
    <View style={styles.itemInner}>
      <View style={styles.itemIcon}>{icon}</View>
      <Text style={styles.itemTitle}>{title}</Text>
      <View style={styles.itemRight}>
        {value ? <Text style={styles.itemValue}>{value}</Text> : null}
        {trailing}
        {!trailing && showArrow ? (
          <ChevronRight color={colors.textMuted} size={18} />
        ) : null}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.itemPressable, pressed ? styles.pressed : null]}
        testID={testID}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View style={styles.itemPressable} testID={testID}>
      {content}
    </View>
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
  group: {
    borderRadius: radii.lg,
    backgroundColor: colors.panelSoft,
    marginBottom: 14,
    overflow: 'hidden',
  },
  itemPressable: {
    minHeight: 54,
    justifyContent: 'center',
  },
  itemInner: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  itemIcon: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  itemTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  itemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemValue: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
    marginRight: 4,
  },
  bottomActions: {
    borderRadius: radii.lg,
    backgroundColor: colors.panelSoft,
    marginBottom: 18,
    overflow: 'hidden',
  },
  bottomActionPressable: {
    minHeight: 50,
    justifyContent: 'center',
  },
  bottomActionInner: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 16,
  },
  bottomActionText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  logoutText: {
    color: colors.red,
  },
  legalLinks: {
    alignItems: 'center',
    paddingHorizontal: spacing.pageX,
    marginBottom: 24,
  },
  legalText: {
    color: colors.cyan,
    fontSize: 12,
    lineHeight: 18,
    opacity: 0.9,
  },
  pressed: {
    opacity: 0.72,
  },
});
