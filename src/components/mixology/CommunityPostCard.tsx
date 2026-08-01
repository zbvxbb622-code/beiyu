import { type Href, useRouter } from 'expo-router';
import { Heart } from 'lucide-react-native';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { getImageAsset } from '@/data/imageAssets';
import { colors } from '@/styles/mixologyTheme';
import { getPostCoverSource } from '@/utils/postImages';
import type { CommunityPost } from '@/types/mixology';

export function CommunityPostCard({
  post,
  liked,
  onToggleLike,
  cardWidth,
  imageHeight,
  imageWidth,
}: {
  post: CommunityPost;
  liked: boolean;
  onToggleLike: () => void;
  cardWidth?: number;
  imageHeight?: number;
  imageWidth?: number;
}) {
  const router = useRouter();
  const likeCount = post.likedByMe === undefined ? post.likes + (liked ? 1 : 0) : post.likes;

  return (
    <Pressable
      testID="community-post-card"
      onPress={() => router.push({ pathname: '/post/[id]', params: { id: post.id } } as unknown as Href)}
      style={({ pressed }) => [styles.card, cardWidth ? { width: cardWidth } : null, pressed ? styles.pressed : null]}>
      <View style={styles.mediaFrame}>
        <Image
          testID="community-post-image"
          source={getPostCoverSource(post)}
          resizeMode="cover"
          // 显式数字宽高：Image 的百分比宽度在 Expo 原生端会塌成空白（Web 正常）
          style={[
            styles.image,
            imageWidth ? { width: imageWidth } : null,
            imageHeight ? { height: imageHeight, aspectRatio: undefined } : null,
          ]}
        />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title} numberOfLines={2}>{post.title}</Text>
        <View style={styles.footer}>
          <View style={styles.author}>
            <Image source={getImageAsset(post.authorAvatarKey)} style={styles.avatar} />
            <Text style={styles.authorName} numberOfLines={1}>{post.authorName}</Text>
          </View>
          <Pressable onPress={onToggleLike} hitSlop={10} style={styles.like}>
            <Heart color={liked ? colors.pink : colors.textMuted} fill={liked ? colors.pink : 'transparent'} size={15} />
            <Text style={styles.likeText}>{likeCount}</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '48%',
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.86,
  },
  mediaFrame: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 10,
    backgroundColor: colors.panel,
  },
  image: {
    width: '100%',
    aspectRatio: 1.36,
    backgroundColor: colors.panel,
  },
  copy: {
    paddingHorizontal: 2,
    paddingTop: 8,
    paddingBottom: 4,
  },
  title: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 7,
  },
  author: {
    minWidth: 0,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  avatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  authorName: {
    color: colors.textMuted,
    fontSize: 11,
    flex: 1,
  },
  like: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  likeText: {
    color: colors.textMuted,
    fontSize: 11,
  },
});
