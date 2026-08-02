import { LinearGradient } from 'expo-linear-gradient';
import { type Href, useRouter } from 'expo-router';
import {
  BadgeCheck,
  MapPin,
  PenLine,
  Settings,
  Share2,
  X,
} from 'lucide-react-native';
import { useState } from 'react';
import { Image, Modal, Pressable, Share, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';

import { getImageAsset } from '@/data/imageAssets';
import { colors, radii, spacing } from '@/styles/mixologyTheme';
import type { UserProfile } from '@/types/mixology';
import { resolveAvatarSource } from '@/utils/profileFeed';

const SHARE_ICON_SIZE = 52;
const SHARE_COLUMN_GAP = 16;
const SHARE_COLUMNS = 5;

type Stats = {
  posts: number;
  receivedLikes: number;
  following: number;
  fans: number;
};

export function ProfileHeader({ profile, stats }: { profile: UserProfile; stats: Stats }) {
  const router = useRouter();
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const [shareVisible, setShareVisible] = useState(false);

  const avatarSource = avatarLoadFailed ? getImageAsset('avatarOne') : resolveAvatarSource(profile);

  return (
    <View>
      <View style={styles.hero}>
        <Image source={getImageAsset('oldFashioned')} style={styles.heroBg} blurRadius={28} />
        <LinearGradient
          colors={['rgba(7,0,4,0.35)', 'rgba(7,0,4,0.72)', 'rgba(7,0,4,0.97)']}
          style={styles.heroOverlay}
        />

        <View style={styles.topRow}>
          <Pressable
            onPress={() => router.push('/settings' as Href)}
            style={({ pressed }) => [styles.settingsPressable, pressed ? styles.pressed : null]}
            testID="profile-settings-button"
          >
            <View style={styles.settingsButton}>
              <Settings color="#fff" size={18} />
            </View>
          </Pressable>
          <View style={styles.topActions}>
            <Pressable
              onPress={() => router.push('/edit-profile' as Href)}
              style={({ pressed }) => [styles.actionPressable, pressed ? styles.pressed : null]}
              testID="edit-profile-button"
            >
              <View style={styles.editButton}>
                <PenLine color="#fff" size={13} />
                <Text style={styles.editButtonText}>编辑资料</Text>
              </View>
            </Pressable>
            <Pressable
              onPress={() => setShareVisible(true)}
              style={({ pressed }) => [styles.actionPressable, pressed ? styles.pressed : null]}
              testID="profile-share-button"
            >
              <View style={styles.shareButton}>
                <Share2 color="#fff" size={16} />
              </View>
            </Pressable>
          </View>
        </View>

        <View style={styles.identityRow}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatarRing}>
              <LinearGradient colors={[colors.pink, colors.amber]} style={styles.avatarRingGrad} />
              <Image
                testID="profile-avatar"
                source={avatarSource}
                style={styles.avatar}
                resizeMode="cover"
                onError={() => setAvatarLoadFailed(true)}
              />
            </View>
            <View style={styles.verified}>
              <BadgeCheck color="#04141a" size={13} fill="#2fe7ff" />
            </View>
          </View>
          <View style={styles.identityCopy}>
            <Text style={styles.name} numberOfLines={1}>
              {profile.nickname || '游客调酒师'}
            </Text>
            {profile.city ? (
              <View style={styles.cityPill}>
                <MapPin color={colors.cyan} size={11} />
                <Text style={styles.cityText}>{profile.city}</Text>
              </View>
            ) : null}
            <Text style={styles.signature} numberOfLines={2}>
              {profile.signature || '点击这里，填写简介'}
            </Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <StatItem label="关注" value={stats.following} />
          <StatItem label="粉丝" value={stats.fans} />
          <StatItem label="获赞与收藏" value={stats.receivedLikes} />
        </View>
      </View>

      <ShareSheet
        profile={profile}
        visible={shareVisible}
        onClose={() => setShareVisible(false)}
      />
    </View>
  );
}

function ShareSheet({
  profile,
  visible,
  onClose,
}: {
  profile: UserProfile;
  visible: boolean;
  onClose: () => void;
}) {
  const shareRows = [
    {
      id: 'row-invite',
      items: [{ id: 'invite', label: '邀请好友', source: require('../../../assets/mixology/share/invite.png') }],
    },
    {
      id: 'row-social',
      items: [
        { id: 'private', label: '私信好友', source: require('../../../assets/mixology/share/privatemsg.png') },
        { id: 'wechat', label: '微信好友', source: require('../../../assets/mixology/share/wechat.png') },
        { id: 'moments', label: '朋友圈', source: require('../../../assets/mixology/share/moments.png') },
        { id: 'qq', label: 'QQ好友', source: require('../../../assets/mixology/share/qq.png') },
        { id: 'qzone', label: 'QQ空间', source: require('../../../assets/mixology/share/qzone.png') },
      ],
    },
    {
      id: 'row-actions',
      items: [
        { id: 'ask', label: '问点点', source: require('../../../assets/mixology/share/ask.png') },
        { id: 'link', label: '复制链接', source: require('../../../assets/mixology/share/link.png') },
        { id: 'qrcode', label: '我的二维码', source: require('../../../assets/mixology/share/qrcode.png') },
      ],
    },
  ];

  const handlePress = async () => {
    onClose();
    await Share.share({
      title: '分享杯语资料',
      message: `来杯语看看 ${profile.nickname || '游客调酒师'} 的调酒主页。`,
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="overFullScreen"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
      testID="share-sheet"
    >
      <View style={styles.shareBackdrop}>
        <Pressable style={styles.shareBackdropPressable} onPress={onClose} testID="share-sheet-backdrop" />
        <View style={styles.shareSheet}>
          <View style={styles.shareHeader}>
            <View style={styles.shareHeaderSpacer} />
            <Text style={styles.shareTitle}>分享至</Text>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.shareClosePressable, pressed ? styles.pressed : null]}
              testID="share-sheet-close"
            >
              <View style={styles.shareCloseButton}>
                <X color={colors.textMuted} size={18} />
              </View>
            </Pressable>
          </View>

          <View style={styles.shareDivider} />

          {shareRows.map((row, rowIndex) => (
            <View key={row.id}>
              <View style={styles.shareRow}>
                {Array.from({ length: SHARE_COLUMNS }).map((_, columnIndex) => {
                  const item = row.items[columnIndex];
                  const isLastColumn = columnIndex === SHARE_COLUMNS - 1;
                  if (!item) {
                    return <View key={`${row.id}-empty-${columnIndex}`} style={isLastColumn ? styles.shareColumnLast : styles.shareColumn} />;
                  }
                  return (
                    <Pressable
                      key={item.id}
                      onPress={handlePress}
                      style={({ pressed }) => [styles.shareItemPressable, pressed ? styles.pressed : null]}
                      testID={`share-option-${item.id}`}
                    >
                      <View style={isLastColumn ? styles.shareItemLast : styles.shareItem}>
                        <BrandIconImage source={item.source} />
                        <Text style={styles.shareItemLabel}>{item.label}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
              {rowIndex < shareRows.length - 1 ? <View style={styles.shareDivider} /> : null}
            </View>
          ))}
        </View>
      </View>
    </Modal>
  );
}

function BrandIconImage({ source }: { source: ImageSourcePropType }) {
  return (
    <View style={styles.shareIconCircle}>
      <Image source={source} style={styles.brandIconImage} resizeMode="cover" />
    </View>
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
    position: 'relative',
    minHeight: 244,
    paddingTop: 18,
    paddingBottom: 26,
    paddingHorizontal: spacing.pageX,
    backgroundColor: colors.bgDeep,
    overflow: 'hidden',
  },
  heroBg: {
    position: 'absolute',
    width: '122%',
    height: '122%',
    top: '-11%',
    left: '-11%',
    resizeMode: 'cover',
  },
  heroOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingsPressable: {
    // Pressable 本身只负责点击态，避免在原生端被 css-interop 吞掉布局属性
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionPressable: {
    // 间距已下沉到内部 View，避免原生端 Pressable 样式丢失导致按钮贴在一起
  },
  editButton: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 13,
    paddingVertical: 8,
    marginLeft: 14,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
    marginLeft: 5,
  },
  shareButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    marginLeft: 12,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.96 }],
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 28,
  },
  avatarWrap: {
    width: 90,
    height: 90,
    marginRight: 20,
  },
  avatarRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    overflow: 'hidden',
  },
  avatarRingGrad: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 45,
  },
  avatar: {
    position: 'absolute',
    top: 2,
    left: 2,
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: colors.bgDeep,
    resizeMode: 'cover',
  },
  verified: {
    position: 'absolute',
    right: 0,
    bottom: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.cyan,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bg,
  },
  identityCopy: {
    flex: 1,
    minWidth: 0,
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
    borderRadius: radii.pill,
    backgroundColor: 'rgba(47,231,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(47,231,255,0.3)',
    paddingHorizontal: 9,
    paddingVertical: 3,
    marginTop: 8,
  },
  cityText: {
    color: colors.textSoft,
    fontSize: 11,
    fontWeight: '800',
    marginLeft: 4,
  },
  signature: {
    color: colors.textSoft,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 9,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 22,
  },
  statValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
    marginRight: 4,
  },
  statLabel: {
    color: colors.textSoft,
    fontSize: 12,
  },
  // 分享面板样式
  shareBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  shareBackdropPressable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  shareSheet: {
    backgroundColor: colors.bgDeep,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingTop: 14,
    paddingBottom: 24,
    paddingHorizontal: spacing.pageX,
  },
  shareHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 36,
  },
  shareHeaderSpacer: {
    width: 34,
  },
  shareTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  shareClosePressable: {
    // 视觉样式下沉到内部 View，避免原生端 Pressable 样式丢失
  },
  shareCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  shareDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginVertical: 18,
  },
  shareRow: {
    flexDirection: 'row',
    alignSelf: 'center',
    width: SHARE_COLUMNS * SHARE_ICON_SIZE + (SHARE_COLUMNS - 1) * SHARE_COLUMN_GAP,
    paddingVertical: 6,
  },
  shareColumn: {
    width: SHARE_ICON_SIZE,
    marginRight: SHARE_COLUMN_GAP,
  },
  shareColumnLast: {
    width: SHARE_ICON_SIZE,
    marginRight: 0,
  },
  shareItemPressable: {
    // 视觉样式下沉到内部 shareItem，避免原生端 Pressable 样式丢失
  },
  shareItem: {
    width: SHARE_ICON_SIZE,
    marginRight: SHARE_COLUMN_GAP,
    alignItems: 'center',
  },
  shareItemLast: {
    width: SHARE_ICON_SIZE,
    marginRight: 0,
    alignItems: 'center',
  },
  shareIconCircle: {
    width: SHARE_ICON_SIZE,
    height: SHARE_ICON_SIZE,
    borderRadius: SHARE_ICON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  brandIconImage: {
    width: '100%',
    height: '100%',
  },
  shareItemLabel: {
    color: colors.textSoft,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 10,
  },
});
