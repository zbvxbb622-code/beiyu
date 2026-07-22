import { LinearGradient } from 'expo-linear-gradient';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { Heart, MessageCircle, Send } from 'lucide-react-native';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { TopBar } from '@/components/mixology/TopBar';
import { ScreenShell } from '@/components/mixology/ScreenShell';
import { getImageAsset } from '@/data/imageAssets';
import { getCommunityPostById, mergePostComments } from '@/services/contentService';
import { useMixology } from '@/state/MixologyState';
import { colors, gradients, radii } from '@/styles/mixologyTheme';
import { getPostImages, resolvePostImageSource } from '@/utils/postImages';

export default function CommunityPostDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { interactionState, togglePostLike, toggleAuthorFollow, addPostComment } = useMixology();
  const post = getCommunityPostById(String(id), interactionState.localCommunityPosts);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  if (!post) {
    return (
      <ScreenShell>
        <TopBar title="详情" backHref="/community" />
        <Text style={styles.empty}>这条笔记不存在</Text>
      </ScreenShell>
    );
  }

  const liked = interactionState.likedPostIds.includes(post.id);
  const followed = interactionState.followedAuthorIds.includes(post.authorId);
  const comments = mergePostComments(post, interactionState.localPostComments);
  const postImages = getPostImages(post);
  const commentsEnabled = post.allowComments !== false;

  const handleSend = async () => {
    if (!draft.trim() || sending) return;
    setSending(true);
    try {
      await addPostComment(post.id, draft);
      setDraft('');
    } finally {
      setSending(false);
    }
  };

  return (
    <ScreenShell>
      <TopBar title="详情" backHref="/community" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.authorRow}>
          <Image source={getImageAsset(post.authorAvatarKey)} style={styles.avatar} />
          <Text style={styles.authorName}>{post.authorName}</Text>
          <Pressable onPress={() => toggleAuthorFollow(post.authorId)} style={styles.follow}>
            <LinearGradient colors={followed ? gradients.card : gradients.cta} style={styles.followGradient}>
              <Text style={styles.followText}>{followed ? '已关注' : '关注'}</Text>
            </LinearGradient>
          </Pressable>
        </View>
        {postImages.length > 1 ? (
          <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gallery}>
              {postImages.map((image, index) => (
                <Image
                  key={image.id}
                  testID={index === 0 ? 'community-detail-image' : `community-detail-image-${index}`}
                  source={resolvePostImageSource(image)}
                  resizeMode="cover"
                  style={styles.galleryImage}
                />
              ))}
            </ScrollView>
            <View style={styles.galleryBadge}>
              <Text style={styles.galleryBadgeText}>共{postImages.length}图</Text>
            </View>
          </View>
        ) : (
          <Image
            testID="community-detail-image"
            source={resolvePostImageSource(postImages[0])}
            resizeMode="cover"
            style={styles.image}
          />
        )}
        <Text style={styles.title}>{post.title}</Text>
        <Text style={styles.body}>{post.body}</Text>
        {post.topics?.length ? (
          <View style={styles.topicRow}>
            {post.topics.map((topic) => (
              <Text key={topic} style={styles.topicText}>#{topic}</Text>
            ))}
          </View>
        ) : null}
        <Text style={styles.date}>{post.date}</Text>
        <Text style={styles.commentsTitle}>{commentsEnabled ? `共${comments.length}条评论` : '作者已关闭评论'}</Text>
        {commentsEnabled
          ? comments.map((comment) => (
              <View key={comment.id} style={styles.comment}>
                <Image source={getImageAsset(comment.authorAvatarKey)} style={styles.commentAvatar} />
                <View style={styles.commentCopy}>
                  <Text style={styles.commentAuthor}>{comment.authorName}</Text>
                  <Text style={styles.commentText}>{comment.text}</Text>
                  <Text style={styles.date}>{comment.date}</Text>
                </View>
              </View>
            ))
          : null}
        {post.venueId ? (
          <Pressable onPress={() => router.push({ pathname: '/bar/[id]', params: { id: post.venueId } } as unknown as Href)} style={styles.venueLink}>
            <Text style={styles.venueLinkText}>查看关联酒吧</Text>
          </Pressable>
        ) : null}
      </ScrollView>
      <View style={styles.bottomBar}>
        {commentsEnabled ? (
          <>
            <TextInput
              placeholder="说点什么..."
              placeholderTextColor="#806f79"
              style={styles.commentInput}
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={handleSend}
              returnKeyType="send"
            />
            <Pressable onPress={handleSend} disabled={!draft.trim() || sending} style={[styles.sendButton, (!draft.trim() || sending) && styles.sendButtonDisabled]}>
              <Send color={colors.text} size={18} />
            </Pressable>
          </>
        ) : (
          <View style={styles.commentsOff}>
            <Text style={styles.commentsOffText}>作者已关闭评论</Text>
          </View>
        )}
        <Pressable onPress={() => togglePostLike(post.id)} style={styles.action}>
          <Heart color={liked ? colors.pink : colors.text} fill={liked ? colors.pink : 'transparent'} size={24} />
          <Text style={styles.actionText}>{post.likes + (liked ? 1 : 0)}</Text>
        </Pressable>
        <View style={styles.action}>
          <MessageCircle color={colors.text} size={24} />
          <Text style={styles.actionText}>{comments.length}</Text>
        </View>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 108,
  },
  empty: {
    color: colors.text,
    fontSize: 18,
    marginTop: 24,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 18,
    marginBottom: 18,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  authorName: {
    flex: 1,
    color: colors.textSoft,
    fontSize: 18,
    fontWeight: '800',
  },
  follow: {
    width: 112,
    borderRadius: radii.pill,
  },
  followGradient: {
    minHeight: 46,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  image: {
    width: '100%',
    height: 224,
    borderRadius: radii.md,
    backgroundColor: colors.panel,
  },
  gallery: {
    gap: 10,
  },
  galleryImage: {
    width: 280,
    height: 224,
    borderRadius: radii.md,
    backgroundColor: colors.panel,
  },
  galleryBadge: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  galleryBadgeText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
  },
  topicRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  topicText: {
    color: colors.pink,
    fontSize: 15,
    fontWeight: '700',
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    marginTop: 24,
  },
  body: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 29,
    marginTop: 18,
  },
  date: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 14,
  },
  commentsTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '900',
    marginTop: 28,
  },
  comment: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  commentAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  commentCopy: {
    flex: 1,
  },
  commentAuthor: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  commentText: {
    color: colors.textSoft,
    fontSize: 16,
    lineHeight: 23,
    marginTop: 4,
  },
  venueLink: {
    minHeight: 48,
    borderRadius: radii.pill,
    backgroundColor: colors.panelSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  venueLinkText: {
    color: colors.text,
    fontWeight: '900',
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 18,
    backgroundColor: 'rgba(7,0,4,0.96)',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  commentInput: {
    flex: 1,
    minHeight: 46,
    borderRadius: radii.pill,
    backgroundColor: '#34242b',
    color: colors.text,
    paddingHorizontal: 18,
    fontSize: 15,
  },
  commentsOff: {
    flex: 1,
    minHeight: 46,
    borderRadius: radii.pill,
    backgroundColor: '#34242b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentsOffText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.pink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.panelStrong,
    opacity: 0.5,
  },
  action: {
    alignItems: 'center',
    minWidth: 38,
  },
  actionText: {
    color: colors.text,
    fontSize: 12,
    marginTop: 2,
  },
});
