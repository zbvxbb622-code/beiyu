import { type Href, useRouter } from 'expo-router';
import {
  ChevronRight,
  LockKeyhole,
  LogIn,
  RotateCcw,
  ShieldCheck,
  UserRound,
} from 'lucide-react-native';
import { type ReactNode, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { ScreenShell } from '@/components/mixology/ScreenShell';
import { MyDrinkCards } from '@/components/profile/MyDrinkCards';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { ProfileQuickActions } from '@/components/profile/ProfileQuickActions';
import { ProfileTabs } from '@/components/profile/ProfileTabs';
import { useMixology } from '@/state/MixologyState';
import { colors, radii, spacing } from '@/styles/mixologyTheme';
import { getProfileStats } from '@/utils/profileFeed';

export default function ProfileScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const { localState, interactionState, userProfile, updatePrivacySettings, resetLocalState } = useMixology();
  const { privacySettings } = localState;
  const stats = getProfileStats(interactionState);

  return (
    <ScreenShell padded={false}>
      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <ProfileHeader
          profile={userProfile}
          stats={stats}
          onPressSettings={() => scrollRef.current?.scrollToEnd({ animated: true })}
        />

        <View style={styles.body}>
          <ProfileQuickActions />
          <ProfileTabs interactionState={interactionState} />
          <MyDrinkCards drawnCards={interactionState.drawnCards} />

          <View style={styles.panel}>
            <PanelHeader icon={<UserRound color={colors.pink} size={21} />} title="账号与安全" />
            <SettingEntry title="手机号登录" description="当前为验证码 Mock，后续接真实短信服务。" value="未登录" onPress={() => router.push('/login' as Href)} />
            <SettingEntry title="数据同步" description="真实同步必须由后端处理鉴权和隔离。" value="未开启" />
            <SettingEntry title="密钥边界" description="OpenAI、短信和管理员密钥不会放进 App。" value="安全" />
          </View>

          <View style={styles.panel}>
            <PanelHeader icon={<LockKeyhole color={colors.acid} size={21} />} title="隐私与安全" />
            <PrivacyRow
              title="本地优先模式"
              description="未登录时年龄、酒柜和输入内容只保存在本机。"
              value={privacySettings.localOnlyMode}
              onValueChange={(value) => updatePrivacySettings({ ...privacySettings, localOnlyMode: value })}
            />
            <PrivacyRow
              title="允许匿名分析"
              description="第一版默认关闭，不上传使用数据。"
              value={privacySettings.analyticsOptIn}
              onValueChange={(value) => updatePrivacySettings({ ...privacySettings, analyticsOptIn: value })}
            />
            <PrivacyRow
              title="登录后自动同步"
              description="当前只是占位，真实同步需要后端隔离。"
              value={privacySettings.syncWhenLoggedIn}
              onValueChange={(value) => updatePrivacySettings({ ...privacySettings, syncWhenLoggedIn: value })}
            />
          </View>

          <View style={styles.panel}>
            <PanelHeader icon={<ShieldCheck color={colors.pink} size={21} />} title="本地数据保险箱" />
            <View style={styles.localDataGrid}>
              <LocalDataItem label="帖子点赞" value={interactionState.likedPostIds.length} />
              <LocalDataItem label="卡片点赞" value={interactionState.likedCellarCardIds.length} />
              <LocalDataItem label="关注作者" value={interactionState.followedAuthorIds.length} />
              <LocalDataItem label="收藏酒吧" value={interactionState.favoriteVenueIds.length} />
            </View>
            <Text style={styles.securityText}>
              App 内不放 OpenAI API Key、短信密钥或后端管理员密钥。后续真实 AI、登录、同步都必须走前后端分离。
            </Text>
            <Pressable onPress={resetLocalState} style={styles.resetButton}>
              <RotateCcw color={colors.text} size={17} />
              <Text style={styles.resetText}>清除本地数据</Text>
            </Pressable>
          </View>

          <View style={styles.loginRow}>
            <Pressable onPress={() => router.push('/login' as Href)} style={styles.loginLink}>
              <LogIn color={colors.textMuted} size={15} />
              <Text style={styles.loginLinkText}>登录/注册入口（Mock）</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

function PanelHeader({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <View style={styles.panelHeader}>
      {icon}
      <Text style={styles.panelTitle}>{title}</Text>
    </View>
  );
}

function SettingEntry({
  title,
  description,
  value,
  onPress,
}: {
  title: string;
  description: string;
  value: string;
  onPress?: () => void;
}) {
  const content = (
    <>
      <View style={styles.settingCopy}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingText}>{description}</Text>
      </View>
      <View style={styles.settingValueWrap}>
        <Text style={styles.settingValue}>{value}</Text>
        {onPress ? <ChevronRight color={colors.textMuted} size={18} /> : null}
      </View>
    </>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={styles.settingRow}>
        {content}
      </Pressable>
    );
  }

  return <View style={styles.settingRow}>{content}</View>;
}

function PrivacyRow({
  title,
  description,
  value,
  onValueChange,
}: {
  title: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingCopy}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingText}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#3a2931', true: colors.pink }}
        thumbColor={colors.text}
      />
    </View>
  );
}

function LocalDataItem({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.localDataItem}>
      <Text style={styles.localDataValue}>{value}</Text>
      <Text style={styles.localDataLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.bottomNavPadding,
  },
  body: {
    paddingHorizontal: spacing.pageX,
    paddingTop: 14,
  },
  panel: {
    borderRadius: radii.lg,
    backgroundColor: colors.panelSoft,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginTop: 16,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  panelTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  settingRow: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
    paddingBottom: 8,
    marginTop: 10,
  },
  settingCopy: {
    flex: 1,
    minWidth: 0,
  },
  settingTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  settingText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  settingValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  settingValue: {
    color: colors.textSoft,
    fontSize: 13,
    fontWeight: '800',
  },
  localDataGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
    marginTop: 14,
  },
  localDataItem: {
    width: '48.5%',
    borderRadius: radii.md,
    backgroundColor: colors.panel,
    padding: 12,
  },
  localDataValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  localDataLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 3,
  },
  securityText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 19,
    marginTop: 14,
  },
  resetButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.pink,
    marginTop: 16,
  },
  resetText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  loginRow: {
    alignItems: 'center',
    marginTop: 18,
  },
  loginLink: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  loginLinkText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
});
