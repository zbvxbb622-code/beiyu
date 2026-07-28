import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { CircleCheck } from 'lucide-react-native';
import { ImageBackground, StyleSheet, Text, TextInput, View } from 'react-native';

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
      <LinearGradient colors={['rgba(7,0,4,0.45)', 'rgba(7,0,4,0.78)', colors.bg]} style={styles.overlay}>
        <View style={styles.copy}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>欢迎来到杯语</Text>
            <Text style={styles.script}>Beiyu</Text>
          </View>
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
            <Text style={styles.codeButtonText}>获取验证码</Text>
          </View>
          <GradientButton label="确认登录" onPress={enter} style={styles.loginButton} />
          <View style={styles.agreementRow}>
            <CircleCheck color={colors.text} fill={colors.pink} size={17} />
            <Text style={styles.agreement}>我已经阅读并同意《服务协议》《隐私说明》</Text>
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
  loginButton: {
    marginTop: 40,
  },
  agreementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 6,
  },
  agreement: {
    color: colors.textMuted,
    fontSize: 13,
  },
});
