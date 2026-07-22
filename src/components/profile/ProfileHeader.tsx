import { LinearGradient } from 'expo-linear-gradient';
import { type Href, useRouter } from 'expo-router';
import { MapPin, PenLine, Settings } from 'lucide-react-native';
import { useState } from 'react';
import { Image, ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';

import { getImageAsset } from '@/data/imageAssets';
import { colors, radii, spacing } from '@/styles/mixologyTheme';
import type { UserProfile } from '@/types/mixology';
import { resolveAvatarSource } from '@/utils/profileFeed';

type Stats = {
  posts: number;
  receivedLikes: number;
  following: number;
  fans: number;
};

export function ProfileHeader({
  profile,
  stats,
  onPressSettings,
}: {
  profile: UserProfile;
  stats: Stats;
  onPressSettings: () => void;
}) {
  const router = useRouter();
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);

  const avatarSource = avatarLoadFailed ? getImageAsset('avatarOne') : resolveAvatarSource(profile);

  return (
    <ImageBackground source={getImageAsset('barShelf')} resizeMode="cover" style={styles.hero}>
      <LinearGradient colors={['rgba(7,0,4,0.42)', 'rgba(7,0,4,0.96)']} style={styles.heroOverlay}>
        <View style={styles.topRow}>
          <Text style={styles.screenTitle}>我的</Text>
          <Pressable onPress={onPressSettings} style={styles.settingsButton} testID="profile-settings-button">
            <Settings color={colors.text} size={21} />
          </Pressable>
        </View>

        <View style={styles.identityRow}>
          <View style={styles.avatarRing}>
            <Image
              testID="profile-avatar"
              source={avatarSource}
              style={styles.avatar}
              onError={() => setAvatarLoadFailed(true)}
            />
          </View>
          <View style={styles.identityCopy}>
            <Text style={styles.name} numberOfLines={1}>
              {profile.nickname || '游客调酒师'}
            </Text>
            {profile.city ? (
              <View style={styles.cityPill}>
                <MapPin color={colors.pink} size={11} />
                <Text style={styles.cityText}>{profile.city}</Text>
              </View>
            ) : null}
          </View>
          <Pressable onPress={() => router.push('/edit-profile' as Href)} style={styles.editButton} testID="edit-profile-button">
            <PenLine color={colors.pink} size={14} />
            <Text style={styles.editButtonText}>编辑资料</Text>
          </Pressable>
        </View>

        <Text style={styles.signature} numberOfLines={2}>
          {profile.signature || '这个人很懒，什么都没写'}
        </Text>

        <View style={styles.statsRow}>
          <StatItem label="笔记" value={stats.posts} />
          <StatItem label="获赞" value={stats.receivedLikes} />
          <StatItem label="关注" value={stats.following} />
          <StatItem label="粉丝" value={stats.fans} />
        </View>
      </LinearGradient>
    </ImageBackground>
  );
}

function StatItem({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.bgDeep,
  },
  heroOverlay: {
    paddingHorizontal: spacing.pageX,
    paddingTop: 12,
    paddingBottom: 18,
  },
  topRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  screenTitle: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '900',
  },
  settingsButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 14,
  },
  avatarRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    borderColor: colors.pink,
    overflow: 'hidden',
    backgroundColor: colors.panel,
    shadowColor: colors.pink,
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  identityCopy: {
    flex: 1,
    minWidth: 0,
    gap: 8,
  },
  name: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  cityPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,47,159,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,47,159,0.3)',
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  cityText: {
    color: colors.textSoft,
    fontSize: 11,
    fontWeight: '800',
  },
  editButton: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.pink,
    paddingHorizontal: 13,
    backgroundColor: 'rgba(255,47,159,0.1)',
  },
  editButtonText: {
    color: colors.pink,
    fontSize: 13,
    fontWeight: '900',
  },
  signature: {
    color: colors.textSoft,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 12,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 14,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 10,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 3,
  },
});
