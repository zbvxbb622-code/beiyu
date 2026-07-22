import { LinearGradient } from 'expo-linear-gradient';
import { type Href, useRouter } from 'expo-router';
import { Menu, ShieldCheck, Star } from 'lucide-react-native';
import { ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';

import { GradientButton } from '@/components/mixology/GradientButton';
import { getImageAsset } from '@/data/imageAssets';
import { colors, radii, spacing } from '@/styles/mixologyTheme';
import { useMixology } from '@/state/MixologyState';

export function WelcomeScreen() {
  const router = useRouter();
  const { verifyAge } = useMixology();

  const enterApp = async () => {
    await verifyAge();
  };

  return (
    <ImageBackground source={getImageAsset('welcome')} resizeMode="cover" style={styles.root}>
      <LinearGradient colors={['rgba(7,0,4,0.26)', 'rgba(7,0,4,0.72)', colors.bg]} style={styles.overlay}>
        <View style={styles.topRow}>
          <Menu color={colors.pink} size={28} />
          <Pressable onPress={() => router.push('/login' as Href)} style={styles.loginIcon}>
            <Star color={colors.pink} size={18} />
          </Pressable>
        </View>
        <View style={styles.heroCopy}>
          <Text style={styles.title}>欢迎来到 Mixology</Text>
          <Text style={styles.script}>Bartender</Text>
          <Text style={styles.subtitle}>只属于你的专业调酒师</Text>
          <GradientButton label="我已满18岁，去聊天" onPress={enterApp} style={styles.cta} />
          <Pressable onPress={() => router.push('/login' as Href)} style={styles.loginLink}>
            <Text style={styles.loginText}>手机号登录 / 游客可跳过</Text>
          </Pressable>
        </View>
        <View style={styles.privacyBadge}>
          <ShieldCheck color={colors.acid} size={16} />
          <Text style={styles.privacyText}>第一版仅本地 Mock，不上传酒柜、年龄或 AI 输入。</Text>
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
    paddingTop: 64,
    paddingBottom: 56,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  loginIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.pink,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  heroCopy: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 180,
  },
  title: {
    color: colors.text,
    fontSize: 35,
    lineHeight: 44,
    fontWeight: '900',
    textAlign: 'center',
  },
  script: {
    color: colors.pink,
    fontSize: 34,
    fontStyle: 'italic',
    fontWeight: '300',
    marginTop: -2,
    textShadowColor: colors.shadowPink,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 16,
    marginTop: 16,
  },
  cta: {
    width: '64%',
    marginTop: 44,
  },
  loginLink: {
    marginTop: 18,
    borderRadius: radii.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  loginText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  privacyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(0,0,0,0.36)',
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  privacyText: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
});
