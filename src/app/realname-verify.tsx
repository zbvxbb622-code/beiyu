import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ChevronLeft, ShieldCheck } from 'lucide-react-native';

import { ScreenShell } from '@/components/mixology/ScreenShell';
import { useMixology } from '@/state/MixologyState';
import { colors, radii, spacing, touchTarget } from '@/styles/mixologyTheme';
import { normalizeMainlandId, validateMainlandAdultId } from '@/utils/identityVerification';

export default function RealnameVerifyScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ purpose?: string; next?: string }>();
  const { accountSecurity, verifyAge, verifyRealname } = useMixology();

  const [name, setName] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isAgeGate = params.purpose === 'age-gate';
  const nextPath = params.next === '/login' || params.next === '/' ? params.next : '/login';

  const submit = async () => {
    if (!name.trim()) {
      setError('请输入真实姓名');
      return;
    }
    const idResult = validateMainlandAdultId(idNumber);
    if (!idResult.valid) {
      setError(idResult.reason === 'underage' ? '需年满 18 岁后才能使用杯语' : '请输入有效的二代身份证号');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      if (isAgeGate) {
        await verifyAge();
        router.replace(nextPath as Href);
      } else {
        await verifyRealname(name.trim());
      }
    } catch {
      setError('验证失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const goBack = () => {
    router.replace(isAgeGate ? '/' as Href : '/account-security' as Href);
  };

  return (
    <ScreenShell padded={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <Pressable
            onPress={goBack}
            style={({ pressed }) => [styles.headerSidePressable, pressed ? styles.pressed : null]}
            testID="realname-back-button"
          >
            <View style={styles.headerSideInner}>
              <ChevronLeft color={colors.text} size={26} />
            </View>
          </Pressable>
          <Text style={styles.headerTitle}>实名认证</Text>
          <View style={styles.headerSidePlaceholder} />
        </View>

        <View style={styles.body}>
          {!isAgeGate && accountSecurity.realnameVerified ? (
            <View style={styles.verifiedCard}>
              <View style={styles.verifiedIcon}>
                <ShieldCheck color={colors.pink} size={26} />
              </View>
              <Text style={styles.verifiedTitle}>已通过实名认证</Text>
              <Text style={styles.verifiedName}>{accountSecurity.realnameName}</Text>
            </View>
          ) : (
            <>
              <Text style={styles.hint}>
                {isAgeGate
                  ? '创建账号前需先确认本人已满 18 周岁。姓名与身份证号仅用于本次年龄判断，不会保存在本机。'
                  : '根据相关法律法规，发布内容需完成实名认证。信息仅用于身份核验，不会公开。'}
              </Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={(text) => {
                  setName(text);
                  setError('');
                }}
                placeholder="真实姓名"
                placeholderTextColor={colors.textMuted}
                testID="realname-input"
              />
              <TextInput
                style={styles.input}
                value={idNumber}
                onChangeText={(text) => {
                  setIdNumber(normalizeMainlandId(text).slice(0, 18));
                  setError('');
                }}
                placeholder="身份证号"
                placeholderTextColor={colors.textMuted}
                testID="realname-id-input"
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Pressable
                onPress={() => { void submit(); }}
                style={({ pressed }) => [styles.buttonPressable, pressed ? styles.pressed : null]}
                disabled={submitting}
                testID="realname-submit"
              >
                <View style={styles.buttonInner}>
                  <Text style={styles.buttonText}>{submitting ? '验证中...' : '提交认证'}</Text>
                </View>
              </Pressable>
            </>
          )}
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
  hint: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
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
  error: {
    color: colors.red,
    fontSize: 13,
    marginBottom: 10,
  },
  buttonPressable: {
    justifyContent: 'center',
    marginTop: 6,
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
  verifiedCard: {
    alignItems: 'center',
    backgroundColor: colors.panelSoft,
    borderRadius: radii.lg,
    paddingVertical: 28,
    paddingHorizontal: 20,
  },
  verifiedIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,47,159,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  verifiedTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  verifiedName: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 6,
  },
  pressed: {
    opacity: 0.72,
  },
});
