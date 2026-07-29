import { LinearGradient } from 'expo-linear-gradient';
import { type Href, useRouter } from 'expo-router';
import { Menu, ShieldCheck, Star } from 'lucide-react-native';
import { ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';

import { GradientButton } from '@/components/mixology/GradientButton';
import { getImageAsset } from '@/data/imageAssets';
import { colors, radii, spacing } from '@/styles/mixologyTheme';
import { useMixology } from '@/state/MixologyState';

export function WelcomeScreen() {
  const router = useRouter();
  const { verifyAge } = useMixology();
  const [ageError, setAgeError] = useState<string | null>(null);

  const enterApp = async () => {
    setAgeError(null);
    try {
      await verifyAge();
      router.replace('/login' as Href);
    } catch {
      setAgeError('验证失败，请重试');
    }
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
          <Text style={styles.title}>欢迎来到杯语</Text>
          <Text style={styles.script}>Beiyu</Text>
          <Text style={styles.subtitle}>你的 AI 调酒陪伴</Text>
          <GradientButton testID="welcome-age-consent" label="我已满18岁，继续" onPress={enterApp} style={styles.cta} />
          {ageError ? <Text style={styles.ageError}>{ageError}</Text> : null}
          <Pressable onPress={() => router.push('/login' as Href)} style={styles.loginLink}>
            <Text style={styles.loginText}>已有账号，手机号登录</Text>
          </Pressable>
        </View>
        <View style={styles.privacyBadge}>
          <ShieldCheck color={colors.acid} size={16} />
          <Text style={styles.privacyText}>请理性饮酒。杯语不会鼓励过量饮酒。</Text>
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
  ageError: {
    color: colors.pink,
    fontSize: 13,
    marginTop: 10,
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
