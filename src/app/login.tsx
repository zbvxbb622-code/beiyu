import { LinearGradient } from 'expo-linear-gradient';
import { type Href, Link, useLocalSearchParams, useRouter } from 'expo-router';
import { Circle, CircleCheck } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ImageBackground, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { getImageAsset } from '@/data/imageAssets';
import { useAuth } from '@/state/AuthState';
import { colors, radii, spacing } from '@/styles/mixologyTheme';

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ next?: string }>();
  const { login, requestSmsCode } = useAuth();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [retryAfter, setRetryAfter] = useState(0);
  const [isRequesting, setIsRequesting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitInFlight = useRef(false);
  const isMountedRef = useRef(true);

  const validPhone = /^1\d{10}$/.test(phone);
  const canRequestCode = validPhone && retryAfter === 0 && !isRequesting;
  const canSubmit = validPhone && code.length === 6 && agreed && !isSubmitting;
  const nextPath = params.next === '/ai' ? '/ai' : '/';

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const setIfMounted = (callback: () => void) => {
    if (isMountedRef.current) {
      callback();
    }
  };

  useEffect(() => {
    if (retryAfter <= 0) return;
    const timeout = setTimeout(() => {
      setIfMounted(() => setRetryAfter((current) => Math.max(0, current - 1)));
    }, 1_000);
    return () => clearTimeout(timeout);
  }, [retryAfter]);

  const messageFor = (reason: unknown) => reason instanceof Error ? reason.message : '请求失败，请稍后重试';

  const requestCode = async () => {
    if (!canRequestCode) return;
    setIsRequesting(true);
    setError(null);
    try {
      const result = await requestSmsCode(phone);
      setIfMounted(() => setRetryAfter(result.retryAfter));
    } catch (reason) {
      setIfMounted(() => setError(messageFor(reason)));
    } finally {
      setIfMounted(() => setIsRequesting(false));
    }
  };

  const enter = async () => {
    if (!canSubmit || submitInFlight.current) return;
    submitInFlight.current = true;
    setIsSubmitting(true);
    setError(null);
    try {
      await login(phone, code);
      if (isMountedRef.current) {
        router.replace(nextPath as Href);
      }
    } catch (reason) {
      setIfMounted(() => setError(messageFor(reason)));
    } finally {
      submitInFlight.current = false;
      setIfMounted(() => setIsSubmitting(false));
    }
  };

  return (
    <ImageBackground source={getImageAsset('loginBg')} resizeMode="cover" style={styles.root}>
      <LinearGradient colors={['rgba(7,0,4,0.45)', 'rgba(7,0,4,0.78)', colors.bg]} style={styles.overlay}>
        <View style={styles.copy}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>欢迎来到杯语</Text>
            <Text style={styles.script}>Beiyu</Text>
          </View>
          <Text style={styles.subtitle}>通过实名认证后，手机号验证可登录或创建账号</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputRow}>
            <Text style={styles.country}>+86</Text>
            <TextInput
              keyboardType="phone-pad"
              value={phone}
              onChangeText={(value) => setPhone(value.replace(/\D/g, '').slice(0, 11))}
              placeholderTextColor="#766872"
              style={styles.phoneInput}
              testID="login-phone"
            />
          </View>
          <View style={styles.inputRow}>
            <TextInput
              keyboardType="number-pad"
              value={code}
              onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
              style={styles.codeInput}
              testID="login-code"
            />
            <Pressable
              accessibilityState={{ disabled: !canRequestCode }}
              disabled={!canRequestCode}
              onPress={() => { void requestCode(); }}
              testID="request-sms-code">
              <Text style={[styles.codeButtonText, !canRequestCode ? styles.disabledText : null]}>
                {retryAfter > 0 ? `${retryAfter} 秒后重试` : isRequesting ? '发送中...' : '获取验证码'}
              </Text>
            </Pressable>
          </View>
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <Pressable
            accessibilityState={{ disabled: !canSubmit }}
            disabled={!canSubmit}
            onPress={() => { void enter(); }}
            style={[styles.loginButton, !canSubmit ? styles.disabledButton : null]}
            testID="login-submit">
            <LinearGradient colors={['#f35a9e', '#d72779']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.loginGradient}>
              <Text style={styles.loginLabel}>{isSubmitting ? '登录中...' : '确认登录'}</Text>
            </LinearGradient>
          </Pressable>
          <View style={styles.agreementRow}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: agreed }}
              onPress={() => setAgreed((current) => !current)}
              style={styles.agreementToggle}
              testID="login-agreement">
              {agreed ? <CircleCheck color={colors.text} fill={colors.pink} size={17} /> : <Circle color={colors.textMuted} size={17} />}
            </Pressable>
            <Text style={styles.agreement}>我已经阅读并同意</Text>
            <Link href="/terms" style={styles.agreementLink} testID="login-terms-link">《服务协议》</Link>
            <Text style={styles.agreement}>和</Text>
            <Link href="/privacy" style={styles.agreementLink} testID="login-privacy-link">《隐私说明》</Link>
          </View>
        </View>
      </LinearGradient>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  overlay: {
    flex: 1,
    paddingHorizontal: spacing.pageX,
    paddingTop: 168,
  },
  copy: {
    marginBottom: 46,
  },
  titleRow: {
    position: 'relative',
  },
  title: {
    color: colors.text,
    fontSize: 29,
    lineHeight: 40,
    fontWeight: '800',
  },
  script: {
    position: 'absolute',
    right: 6,
    bottom: -10,
    color: colors.pink,
    fontSize: 26,
    fontStyle: 'italic',
    textShadowColor: colors.shadowPink,
    textShadowRadius: 10,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
    marginTop: 18,
  },
  form: {
    gap: 16,
  },
  inputRow: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.md,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 20,
  },
  country: {
    color: colors.text,
    fontSize: 19,
    marginRight: 26,
  },
  phoneInput: {
    flex: 1,
    color: colors.text,
    fontSize: 19,
  },
  codeInput: {
    flex: 1,
    color: colors.text,
    fontSize: 19,
  },
  codeButtonText: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '600',
    paddingVertical: 10,
    paddingLeft: 12,
  },
  disabledText: {
    color: colors.textMuted,
  },
  error: {
    color: '#ff91b9',
    fontSize: 14,
  },
  loginButton: {
    marginTop: 40,
    borderRadius: radii.pill,
  },
  disabledButton: {
    opacity: 0.45,
  },
  loginGradient: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
  loginLabel: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  agreementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 6,
  },
  agreementToggle: {
    minWidth: 28,
    minHeight: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agreement: {
    color: colors.textMuted,
    fontSize: 13,
  },
  agreementLink: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
});
