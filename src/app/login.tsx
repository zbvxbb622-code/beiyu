import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ImageBackground, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { GradientButton } from '@/components/mixology/GradientButton';
import { getImageAsset } from '@/data/imageAssets';
import { useMixology } from '@/state/MixologyState';
import { colors, radii, spacing } from '@/styles/mixologyTheme';

export default function LoginScreen() {
  const router = useRouter();
  const { verifyAge } = useMixology();

  const enter = async () => {
    await verifyAge();
    router.replace('/');
  };

  return (
    <ImageBackground source={getImageAsset('loginBg')} resizeMode="cover" style={styles.root}>
      <LinearGradient colors={['rgba(7,0,4,0.25)', 'rgba(7,0,4,0.86)', colors.bg]} style={styles.overlay}>
        <View style={styles.copy}>
          <Text style={styles.title}>欢迎来到 Mixology</Text>
          <Text style={styles.script}>Bartender</Text>
          <Text style={styles.subtitle}>未注册的手机号验证通过后将自动注册</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputRow}>
            <Text style={styles.country}>+86</Text>
            <TextInput
              keyboardType="phone-pad"
              defaultValue="18862538888"
              placeholderTextColor="#766872"
              style={styles.phoneInput}
            />
          </View>
          <View style={styles.inputRow}>
            <TextInput keyboardType="number-pad" defaultValue="6756" style={styles.codeInput} />
            <Pressable style={styles.codeButton}>
              <Text style={styles.codeButtonText}>获取验证码</Text>
            </Pressable>
          </View>
          <GradientButton label="确认登录" onPress={enter} style={styles.loginButton} />
          <Pressable onPress={enter} style={styles.skip}>
            <Text style={styles.skipText}>游客模式进入</Text>
          </Pressable>
          <Text style={styles.agreement}>● 我已经阅读并同意《服务协议》《隐私说明》</Text>
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
    paddingTop: 190,
  },
  copy: {
    marginBottom: 70,
  },
  title: {
    color: colors.text,
    fontSize: 36,
    lineHeight: 46,
    fontWeight: '900',
  },
  script: {
    color: colors.pink,
    fontSize: 30,
    fontStyle: 'italic',
    marginLeft: 206,
    marginTop: -16,
    textShadowColor: colors.shadowPink,
    textShadowRadius: 10,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 17,
    marginTop: 8,
  },
  form: {
    gap: 20,
  },
  inputRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.md,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 22,
  },
  country: {
    color: colors.text,
    fontSize: 22,
    marginRight: 24,
  },
  phoneInput: {
    flex: 1,
    color: colors.text,
    fontSize: 22,
  },
  codeInput: {
    flex: 1,
    color: colors.text,
    fontSize: 22,
  },
  codeButton: {
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  codeButtonText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  loginButton: {
    marginTop: 72,
  },
  skip: {
    alignSelf: 'center',
    paddingVertical: 6,
  },
  skipText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '800',
  },
  agreement: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
