import { type Href, useRouter } from 'expo-router';
import { Heart, Play } from 'lucide-react-native';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { getImageAsset } from '@/data/imageAssets';
import { colors, radii } from '@/styles/mixologyTheme';
import { getPostCoverSource } from '@/utils/postImages';
import type { CommunityPost } from '@/types/mixology';

export function CommunityPostCard({
  post,
  liked,
  onToggleLike,
  cardWidth,
  imageHeight,
}: {
  post: CommunityPost;
  liked: boolean;
  onToggleLike: () => void;
  cardWidth?: number;
  imageHeight?: number;
}) {
  const router = useRouter();

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
          style={[styles.image, imageHeight ? { height: imageHeight, aspectRatio: undefined } : null]}
        />
        <View style={styles.playBadge}>
          <Play color={colors.text} fill={colors.text} size={9} />
        </View>
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
            <Text style={styles.likeText}>{post.likes + (liked ? 1 : 0)}</Text>
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
    borderRadius: radii.sm,
    backgroundColor: '#171014',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  pressed: {
    opacity: 0.86,
  },
  mediaFrame: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: colors.panel,
  },
  image: {
    width: '100%',
    aspectRatio: 1.36,
    backgroundColor: colors.panel,
  },
  playBadge: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.42)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  copy: {
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 9,
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
