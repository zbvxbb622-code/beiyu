import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';

import { ScreenShell } from '@/components/mixology/ScreenShell';
import { useMixology } from '@/state/MixologyState';
import { colors, radii, spacing, touchTarget } from '@/styles/mixologyTheme';

export default function AccountRecoveryScreen() {
  const router = useRouter();
  const { accountSecurity } = useMixology();

  const [account, setAccount] = useState('');
  const [sent, setSent] = useState(false);

  const sendCode = () => {
    if (!account.trim()) return;
    setSent(true);
  };

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
            testID="recovery-back-button"
          >
            <View style={styles.headerSideInner}>
              <ChevronLeft color={colors.text} size={26} />
            </View>
          </Pressable>
          <Text style={styles.headerTitle}>账号找回</Text>
          <View style={styles.headerSidePlaceholder} />
        </View>

        <View style={styles.body}>
          <View style={styles.noticeCard}>
            <Text style={styles.noticeTitle}>无法登录当前账号？</Text>
            <Text style={styles.noticeText}>
              通过绑定的手机号或邮箱验证身份，即可找回账号并重新登录。当前绑定的手机号：
            </Text>
            <Text style={styles.noticePhone}>{accountSecurity.phone}</Text>
          </View>

          <TextInput
            style={styles.input}
            value={account}
            onChangeText={(text) => {
              setAccount(text);
              setSent(false);
            }}
            placeholder="输入手机号或邮箱"
            placeholderTextColor={colors.textMuted}
            testID="recovery-account-input"
          />

          {sent ? (
            <View style={styles.sentCard}>
              <Text style={styles.sentText}>验证码已发送至 {account.trim()}，请查收。</Text>
            </View>
          ) : null}

          <Pressable
            onPress={sendCode}
            style={({ pressed }) => [styles.buttonPressable, pressed ? styles.pressed : null]}
            testID="recovery-send"
          >
            <View style={styles.buttonInner}>
              <Text style={styles.buttonText}>发送验证码</Text>
            </View>
          </Pressable>

          <View style={styles.stepsCard}>
            <Text style={styles.stepsTitle}>找回步骤</Text>
            <Text style={styles.stepItem}>1. 输入绑定的手机号或邮箱</Text>
            <Text style={styles.stepItem}>2. 获取并填写验证码</Text>
            <Text style={styles.stepItem}>3. 验证通过后重置登录密码</Text>
          </View>
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
  noticeCard: {
    backgroundColor: colors.panelSoft,
    borderRadius: radii.lg,
    padding: 16,
    marginBottom: 16,
  },
  noticeTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  noticeText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  noticePhone: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  input: {
    backgroundColor: colors.bgDeep,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
    marginBottom: 12,
  },
  sentCard: {
    backgroundColor: 'rgba(183,255,74,0.12)',
    borderRadius: radii.md,
    padding: 12,
    marginBottom: 12,
  },
  sentText: {
    color: colors.acid,
    fontSize: 13,
  },
  buttonPressable: {
    justifyContent: 'center',
    marginTop: 4,
  },
  buttonInner: {
    minHeight: 48,
    borderRadius: radii.pill,
    backgroundColor: colors.pink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  stepsCard: {
    backgroundColor: colors.panelSoft,
    borderRadius: radii.lg,
    padding: 16,
    marginTop: 18,
  },
  stepsTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  stepItem: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 22,
  },
  pressed: {
    opacity: 0.72,
  },
});
