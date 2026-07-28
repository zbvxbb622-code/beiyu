import { type Href, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Check, ChevronLeft, Monitor, Smartphone, Tablet } from 'lucide-react-native';

import { ScreenShell } from '@/components/mixology/ScreenShell';
import { useMixology } from '@/state/MixologyState';
import { colors, radii, spacing, touchTarget } from '@/styles/mixologyTheme';
import type { LoginDevice } from '@/types/mixology';

function deviceIcon(platform: LoginDevice['platform']) {
  if (platform === 'Android') return <Smartphone color={colors.text} size={22} />;
  if (platform === 'Web') return <Monitor color={colors.text} size={22} />;
  return <Tablet color={colors.text} size={22} />;
}

export default function DeviceManagementScreen() {
  const router = useRouter();
  const { accountSecurity, removeDevice } = useMixology();

  return (
    <ScreenShell padded={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => router.replace('/account-security' as Href)}
            style={({ pressed }) => [styles.headerSidePressable, pressed ? styles.pressed : null]}
            testID="device-management-back-button"
          >
            <View style={styles.headerSideInner}>
              <ChevronLeft color={colors.text} size={26} />
            </View>
          </Pressable>
          <Text style={styles.headerTitle}>登录设备管理</Text>
          <View style={styles.headerSidePlaceholder} />
        </View>

        <View style={styles.body}>
          <Text style={styles.sectionHint}>
            以下是最近登录过你账号的设备，如非本人操作请及时退出。
          </Text>

          {accountSecurity.devices.map((device) => (
            <View key={device.id} style={styles.card}>
              <View style={styles.iconCircle}>{deviceIcon(device.platform)}</View>
              <View style={styles.cardInfo}>
                <Text style={styles.deviceName}>{device.name}</Text>
                <Text style={styles.deviceMeta}>
                  {device.platform} · {device.lastActive}
                </Text>
              </View>
              {device.isCurrent ? (
                <View style={styles.currentBadge}>
                  <Check color={colors.pink} size={14} />
                  <Text style={styles.currentBadgeText}>当前使用</Text>
                </View>
              ) : (
                <Pressable
                  onPress={() => removeDevice(device.id)}
                  style={({ pressed }) => [styles.logoutPressable, pressed ? styles.pressed : null]}
                  testID={`device-logout-${device.id}`}
                >
                  <View style={styles.logoutInner}>
                    <Text style={styles.logoutText}>退出登录</Text>
                  </View>
                </Pressable>
              )}
            </View>
          ))}
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
  sectionHint: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.panelSoft,
    borderRadius: radii.lg,
    padding: 14,
    marginBottom: 12,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.shortcutBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardInfo: {
    flex: 1,
  },
  deviceName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  deviceMeta: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  currentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,47,159,0.14)',
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  currentBadgeText: {
    color: colors.pink,
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  logoutPressable: {
    justifyContent: 'center',
  },
  logoutInner: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  logoutText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.72,
  },
});
