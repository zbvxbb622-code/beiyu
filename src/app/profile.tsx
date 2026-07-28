import { type Href, useRouter } from 'expo-router';
import { LogIn } from 'lucide-react-native';
import { useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ScreenShell } from '@/components/mixology/ScreenShell';
import { MyDrinkCards } from '@/components/profile/MyDrinkCards';
import { ProfileAIRecommendation } from '@/components/profile/ProfileAIRecommendation';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { ProfileTabs } from '@/components/profile/ProfileTabs';
import { useMixology } from '@/state/MixologyState';
import { colors, spacing } from '@/styles/mixologyTheme';
import { getProfileStats } from '@/utils/profileFeed';

export default function ProfileScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const { interactionState, userProfile } = useMixology();
  const stats = getProfileStats(interactionState);

  return (
    <ScreenShell padded={false}>
      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <ProfileHeader profile={userProfile} stats={stats} />

        <View style={styles.body}>
          <ProfileAIRecommendation />
          <MyDrinkCards drawnCards={interactionState.drawnCards} />
          <ProfileTabs interactionState={interactionState} />

          <View style={styles.loginRow}>
            <Pressable onPress={() => router.push('/login' as Href)} style={styles.loginLink}>
              <LogIn color={colors.textMuted} size={15} style={styles.loginIcon} />
              <Text style={styles.loginLinkText}>登录/注册入口（Mock）</Text>
            </Pressable>
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
  body: {
    paddingHorizontal: spacing.pageX,
    paddingTop: 10,
  },
  loginRow: {
    alignItems: 'center',
    marginTop: 26,
  },
  loginLink: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
  },
  loginIcon: {
    marginRight: 6,
  },
  loginLinkText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
});