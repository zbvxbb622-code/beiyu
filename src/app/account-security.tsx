import { type Href, useRouter } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ChevronLeft, ChevronRight, QrCode, ShieldCheck } from 'lucide-react-native';

import { BottomSheet } from '@/components/mixology/BottomSheet';
import { ScreenShell } from '@/components/mixology/ScreenShell';
import { useMixology } from '@/state/MixologyState';
import { colors, radii, spacing, touchTarget, typography } from '@/styles/mixologyTheme';

export default function AccountSecurityScreen() {
  const router = useRouter();
  const {
    accountSecurity,
    setPhone,
    setPassword,
    bindWechat,
    unbindWechat,
    deleteAccount,
  } = useMixology();

  const [phoneSheet, setPhoneSheet] = useState(false);
  const [passwordSheet, setPasswordSheet] = useState(false);
  const [wechatSheet, setWechatSheet] = useState(false);
  const [deleteSheet, setDeleteSheet] = useState(false);

  const [phoneInput, setPhoneInput] = useState(accountSecurity.phone);
  const [phoneError, setPhoneError] = useState('');
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdError, setPwdError] = useState('');

  const confirmPhone = () => {
    const next = phoneInput.trim();
    if (!next) {
      setPhoneError('请输入手机号');
      return;
    }
    setPhoneError('');
    setPhone(next);
    setPhoneSheet(false);
  };

  const confirmPassword = () => {
    if (newPwd.length < 6) {
      setPwdError('新密码至少 6 位');
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdError('两次输入的密码不一致');
      return;
    }
    setPwdError('');
    setPassword();
    setOldPwd('');
    setNewPwd('');
    setConfirmPwd('');
    setPasswordSheet(false);
  };

  const confirmDelete = () => {
    setDeleteSheet(false);
    deleteAccount();
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
            onPress={() => router.replace('/settings' as Href)}
            style={({ pressed }) => [styles.headerSidePressable, pressed ? styles.pressed : null]}
            testID="account-security-back-button"
          >
            <View style={styles.headerSideInner}>
              <ChevronLeft color={colors.text} size={26} />
            </View>
          </Pressable>
          <Text style={styles.headerTitle}>账号与安全</Text>
          <View style={styles.headerSidePlaceholder} />
        </View>

        <View style={styles.body}>
          <SecurityGroup>
            <SecurityRow
              title="手机号"
              value={accountSecurity.phone}
              onPress={() => {
                setPhoneInput(accountSecurity.phone);
                setPhoneError('');
                setPhoneSheet(true);
              }}
              testID="account-security-phone"
            />
            <SecurityRow
              title="登录密码"
              value={accountSecurity.passwordSet ? '已设置' : '未设置'}
              onPress={() => {
                setOldPwd('');
                setNewPwd('');
                setConfirmPwd('');
                setPwdError('');
                setPasswordSheet(true);
              }}
              testID="account-security-password"
            />
          </SecurityGroup>

          <SecurityGroup>
            <SecurityRow
              title="微信账号"
              value={accountSecurity.wechatBound ? '已绑定' : '未绑定'}
              onPress={() => setWechatSheet(true)}
              testID="account-security-wechat"
            />
          </SecurityGroup>

          <SecurityGroup>
            <SecurityRow
              title="实名认证"
              value={accountSecurity.realnameVerified ? '已认证' : '未认证'}
              onPress={() => router.push('/realname-verify' as Href)}
              testID="account-security-realname"
            />
            <SecurityRow
              title="官方认证"
              subtitle="个人职业资质、机构、企业认证能力上线前暂不开放"
              value={accountSecurity.officialVerified ? accountSecurity.officialType : '暂未开放'}
              showArrow={false}
              testID="account-security-official"
            />
          </SecurityGroup>

          <SecurityGroup>
            <SecurityRow
              title="登录设备管理"
              value={`${accountSecurity.devices.length} 台`}
              onPress={() => router.push('/device-management' as Href)}
              testID="account-security-devices"
            />
          </SecurityGroup>

          <SecurityGroup>
            <SecurityRow
              title="账号找回"
              subtitle="无法登录其他账号，通过该方式找回并登录"
              onPress={() => router.push('/account-recovery' as Href)}
              testID="account-security-recovery"
            />
          </SecurityGroup>

          <SecurityGroup>
            <SecurityRow
              title="注销账号"
              onPress={() => setDeleteSheet(true)}
              testID="account-security-delete"
            />
          </SecurityGroup>
        </View>
      </ScrollView>

      <BottomSheet
        visible={phoneSheet}
        onClose={() => setPhoneSheet(false)}
        title="手机号"
        testID="phone-sheet"
      >
        <Text style={styles.sheetDesc}>用于登录与找回账号，修改后需重新验证。</Text>
        <TextInput
          style={styles.input}
          value={phoneInput}
          onChangeText={(text) => {
            setPhoneInput(text);
            setPhoneError('');
          }}
          placeholder="请输入手机号"
          placeholderTextColor={colors.textMuted}
          keyboardType="phone-pad"
          autoFocus
          testID="phone-input"
        />
        {phoneError ? <Text style={styles.sheetError}>{phoneError}</Text> : null}
        <SheetButton label="保存" onPress={confirmPhone} testID="phone-confirm" />
      </BottomSheet>

      <BottomSheet
        visible={passwordSheet}
        onClose={() => setPasswordSheet(false)}
        title="修改登录密码"
        testID="password-sheet"
      >
        <Text style={styles.sheetDesc}>请使用字母、数字或符号组合，至少 6 位。</Text>
        <TextInput
          style={styles.input}
          value={oldPwd}
          onChangeText={setOldPwd}
          placeholder="旧密码"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          testID="old-password-input"
        />
        <TextInput
          style={styles.input}
          value={newPwd}
          onChangeText={(text) => {
            setNewPwd(text);
            setPwdError('');
          }}
          placeholder="新密码"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          testID="new-password-input"
        />
        <TextInput
          style={styles.input}
          value={confirmPwd}
          onChangeText={(text) => {
            setConfirmPwd(text);
            setPwdError('');
          }}
          placeholder="确认新密码"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          testID="confirm-password-input"
        />
        {pwdError ? <Text style={styles.sheetError}>{pwdError}</Text> : null}
        <SheetButton label="保存" onPress={confirmPassword} testID="password-confirm" />
      </BottomSheet>

      <BottomSheet
        visible={wechatSheet}
        onClose={() => setWechatSheet(false)}
        title="微信账号"
        testID="wechat-sheet"
      >
        {accountSecurity.wechatBound ? (
          <>
            <View style={styles.wechatBoundCard}>
              <View style={styles.wechatAvatar}>
                <Text style={styles.wechatAvatarText}>微</Text>
              </View>
              <View style={styles.wechatBoundInfo}>
                <Text style={styles.wechatBoundName}>微信账号</Text>
                <Text style={styles.wechatBoundId}>{accountSecurity.wechatAccount}</Text>
              </View>
              <ShieldCheck color={colors.pink} size={20} />
            </View>
            <SheetButton
              label="解除绑定"
              onPress={() => {
                unbindWechat();
                setWechatSheet(false);
              }}
              variant="danger"
              testID="wechat-unbind"
            />
          </>
        ) : (
          <>
            <View style={styles.qrBox}>
              <QrCode color={colors.textMuted} size={64} />
            </View>
            <Text style={styles.sheetDescCenter}>使用微信扫一扫，绑定你的微信账号</Text>
            <SheetButton label="绑定微信" onPress={bindWechat} testID="wechat-bind" />
          </>
        )}
      </BottomSheet>

      <BottomSheet
        visible={deleteSheet}
        onClose={() => setDeleteSheet(false)}
        title="注销账号"
        testID="delete-sheet"
      >
        <Text style={styles.sheetWarn}>
          注销后，你的个人资料、本地数据将被清除且无法恢复。请确认后再操作。
        </Text>
        <SheetButton label="确认注销" onPress={confirmDelete} variant="danger" testID="delete-confirm" />
      </BottomSheet>
    </ScreenShell>
  );
}

function SecurityGroup({ children }: { children: ReactNode }) {
  return <View style={styles.group}>{children}</View>;
}

function SecurityRow({
  title,
  subtitle,
  value,
  showArrow = true,
  onPress,
  testID,
}: {
  title: string;
  subtitle?: string;
  value?: string;
  showArrow?: boolean;
  onPress?: () => void;
  testID?: string;
}) {
  const content = (
    <View style={styles.rowInner}>
      <View style={styles.rowLeft}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.rowRight}>
        {value ? <Text style={styles.rowValue}>{value}</Text> : null}
        {showArrow ? <ChevronRight color={colors.textMuted} size={18} /> : null}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.rowPressable, pressed ? styles.pressed : null]}
        testID={testID}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View style={styles.rowPressable} testID={testID}>
      {content}
    </View>
  );
}

function SheetButton({
  label,
  onPress,
  variant = 'primary',
  testID,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'danger';
  testID?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.sheetButtonPressable, pressed ? styles.pressed : null]}
      testID={testID}
    >
      <View
        style={[
          styles.sheetButtonInner,
          variant === 'danger' ? styles.sheetButtonDanger : styles.sheetButtonPrimary,
        ]}
      >
        <Text
          style={[
            styles.sheetButtonText,
            variant === 'danger' ? styles.sheetButtonTextDanger : null,
          ]}
        >
          {label}
        </Text>
      </View>
    </Pressable>
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
  group: {
    borderRadius: radii.lg,
    backgroundColor: colors.panelSoft,
    marginBottom: 14,
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  rowLeft: {
    flex: 1,
    justifyContent: 'center',
  },
  rowTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '600',
  },
  rowSubtitle: {
    color: colors.textMuted,
    fontSize: typography.bodySmall,
    fontWeight: '400',
    marginTop: 2,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  rowValue: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
    marginRight: 4,
  },
  pressed: {
    opacity: 0.72,
  },
  sheetDesc: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  sheetDescCenter: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 16,
  },
  sheetError: {
    color: colors.red,
    fontSize: 13,
    marginBottom: 10,
  },
  sheetWarn: {
    color: colors.textSoft,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 18,
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
  qrBox: {
    width: 132,
    height: 132,
    alignSelf: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.bgDeep,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  wechatBoundCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgDeep,
    borderRadius: radii.md,
    padding: 14,
    marginBottom: 16,
  },
  wechatAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#07c160',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  wechatAvatarText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  wechatBoundInfo: {
    flex: 1,
  },
  wechatBoundName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  wechatBoundId: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  sheetButtonPressable: {
    marginTop: 6,
    justifyContent: 'center',
  },
  sheetButtonInner: {
    minHeight: 48,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetButtonPrimary: {
    backgroundColor: colors.pink,
  },
  sheetButtonDanger: {
    backgroundColor: 'rgba(255,48,56,0.16)',
    borderWidth: 1,
    borderColor: colors.red,
  },
  sheetButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  sheetButtonTextDanger: {
    color: colors.red,
  },
});
