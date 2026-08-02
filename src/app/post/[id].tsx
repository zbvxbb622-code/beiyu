import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { Heart, Send, X } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';

import { TopBar } from '@/components/mixology/TopBar';
import { ScreenShell } from '@/components/mixology/ScreenShell';
import { getImageAsset } from '@/data/imageAssets';
import { getCommunityPostById, mergePostComments } from '@/services/contentService';
import { useMixology } from '@/state/MixologyState';
import { colors, gradients, radii } from '@/styles/mixologyTheme';
import type { CommunityComment } from '@/types/mixology';
import { getPostImages, resolvePostImageSource } from '@/utils/postImages';

const reportReasons = [
  { key: 'spam', label: '垃圾广告' },
  { key: 'harassment', label: '骚扰攻击' },
  { key: 'illegal', label: '违法违规' },
] as const;

type ReportTarget = { type: 'post' } | { type: 'comment'; commentId: string };
type ReportReason = (typeof reportReasons)[number]['key'];

export default function CommunityPostDetailScreen() {
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  const {
    interactionState,
    togglePostLike,
    toggleCommentLike,
    toggleAuthorFollow,
    addPostComment,
    reportPost,
    reportComment,
  } = useMixology();
  const { width } = useWindowDimensions();
  const post = getCommunityPostById(String(id), interactionState.localCommunityPosts);
  const [draft, setDraft] = useState('');
  const [replyingTo, setReplyingTo] = useState<CommunityComment | null>(null);
  const [sending, setSending] = useState(false);
  const [failedImageIds, setFailedImageIds] = useState<Record<string, true>>({});
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [reportReason, setReportReason] = useState<ReportReason>('spam');
  const [reportDetail, setReportDetail] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const contentWidth = width - 32;
  const detailImageHeight = Math.min(Math.max(contentWidth * 0.68, 190), 260);
  const galleryImageWidth = Math.min(contentWidth, 300);
  const galleryImageHeight = Math.min(Math.max(galleryImageWidth * 0.68, 190), 240);

  if (!post) {
    return (
      <ScreenShell>
        <TopBar title="详情" backHref="/community" />
        <Text style={styles.empty}>这条笔记不存在</Text>
      </ScreenShell>
    );
  }

  const liked = post.likedByMe ?? interactionState.likedPostIds.includes(post.id);
  const likeCount = post.likedByMe === undefined ? post.likes + (liked ? 1 : 0) : post.likes;
  const followed = interactionState.followedAuthorIds.includes(post.authorId);
  const comments = mergePostComments(post, interactionState.localPostComments);
  const rootCommentIds = new Set(comments.filter((comment) => !comment.parentId).map((comment) => comment.id));
  const rootComments = comments.filter((comment) => !comment.parentId || !rootCommentIds.has(comment.parentId));
  const repliesByParent = comments.reduce<Record<string, CommunityComment[]>>((next, comment) => {
    if (comment.parentId && rootCommentIds.has(comment.parentId)) {
      next[comment.parentId] = [...(next[comment.parentId] ?? []), comment];
    }
    return next;
  }, {});
  const postImages = getPostImages(post);
  const imageSourceFor = (image: (typeof postImages)[number]) =>
    failedImageIds[image.id] ? getImageAsset(post.imageKey) : resolvePostImageSource(image);
  const handleImageError = (imageId: string) => {
    setFailedImageIds((current) => ({ ...current, [imageId]: true }));
  };
  const commentsEnabled = post.allowComments !== false;
  const canSendComment = commentsEnabled && draft.trim().length > 0 && !sending;

  const handleSend = async () => {
    if (!draft.trim() || sending) return;
    setSending(true);
    try {
      if (replyingTo) {
        await addPostComment(post.id, draft, replyingTo.parentId ?? replyingTo.id);
      } else {
        await addPostComment(post.id, draft);
      }
      setDraft('');
      setReplyingTo(null);
    } catch (error) {
      Alert.alert('评论失败', error instanceof Error ? error.message : '请稍后重试');
    } finally {
      setSending(false);
    }
  };

  const handleCommentLike = async (commentId: string) => {
    try {
      await toggleCommentLike(post.id, commentId);
    } catch (error) {
      Alert.alert('操作失败', error instanceof Error ? error.message : '请稍后重试');
    }
  };

  const openReportSheet = (target: ReportTarget) => {
    setReportTarget(target);
    setReportReason('spam');
    setReportDetail('');
  };

  const closeReportSheet = () => {
    if (submittingReport) return;
    setReportTarget(null);
    setReportDetail('');
  };

  const submitReport = async () => {
    if (!reportTarget || submittingReport) return;
    setSubmittingReport(true);
    try {
      const payload = { reason: reportReason, detail: reportDetail.trim() };
      if (reportTarget.type === 'post') {
        await reportPost(post.id, payload);
        Alert.alert('已提交举报', '我们会尽快审核这条内容。');
      } else {
        await reportComment(post.id, reportTarget.commentId, payload);
        Alert.alert('已提交举报', '我们会尽快审核这条评论。');
      }
      setReportTarget(null);
      setReportDetail('');
    } catch (error) {
      Alert.alert('举报失败', error instanceof Error ? error.message : '请稍后重试');
    } finally {
      setSubmittingReport(false);
    }
  };

  const renderComment = (comment: CommunityComment, replies: CommunityComment[] = [], isReply = false) => {
    const likedComment = comment.likedByMe === true;
    const likeCountLabel = comment.likes ?? 0;
    return (
      <View key={comment.id} style={[styles.comment, isReply ? styles.replyComment : null]}>
        <Image source={getImageAsset(comment.authorAvatarKey)} style={isReply ? styles.replyAvatar : styles.commentAvatar} />
        <View style={styles.commentCopy}>
          <Text style={styles.commentAuthor}>{comment.authorName}</Text>
          <Text style={styles.commentText}>{comment.text}</Text>
          <View testID={`community-comment-meta-${comment.id}`} style={styles.commentMeta}>
            <View style={styles.commentMetaLeft}>
              <Text style={styles.commentDate}>{comment.date}</Text>
              <Pressable
                testID={`community-comment-reply-${comment.id}`}
                onPress={() => setReplyingTo(comment)}
                hitSlop={8}
                style={({ pressed }) => pressed ? styles.pressed : null}>
                <Text style={styles.commentActionText}>{replies.length ? `回复 ${replies.length}` : '回复'}</Text>
              </Pressable>
              <Pressable
                testID={`community-comment-report-${comment.id}`}
                onPress={() => openReportSheet({ type: 'comment', commentId: comment.id })}
                hitSlop={8}
                style={({ pressed }) => pressed ? styles.pressed : null}>
                <Text style={styles.commentActionText}>举报</Text>
              </Pressable>
            </View>
            <Pressable
              testID={`community-comment-like-${comment.id}`}
              onPress={() => handleCommentLike(comment.id)}
              hitSlop={8}
              style={({ pressed }) => [styles.commentLike, pressed ? styles.pressed : null]}>
              <View testID={`community-comment-like-content-${comment.id}`} style={styles.commentLikeContent}>
                <Heart color={colors.pink} fill={likedComment ? colors.pink : 'transparent'} size={15} strokeWidth={2.4} />
                <Text style={styles.commentActionText} numberOfLines={1}>{likeCountLabel}</Text>
              </View>
            </Pressable>
          </View>
          {replies.length ? (
            <View style={styles.replies}>
              {replies.map((reply) => renderComment(reply, [], true))}
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <ScreenShell>
      <TopBar title="详情" backHref={from === 'profile' ? '/profile' : '/community'} />
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
                  source={imageSourceFor(image)}
                  resizeMode="cover"
                  onError={() => handleImageError(image.id)}
                  style={[styles.galleryImage, { width: galleryImageWidth, height: galleryImageHeight }]}
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
            source={imageSourceFor(postImages[0])}
            resizeMode="cover"
            onError={() => handleImageError(postImages[0].id)}
            style={[styles.image, { height: detailImageHeight }]}
          />
        )}
        <Text style={styles.body}>
          {post.title}
          {'\n\n'}
          {post.body}
        </Text>
        {post.topics?.length ? (
          <View style={styles.topicRow}>
            {post.topics.map((topic) => (
              <Text key={topic} style={styles.topicText}>#{topic}</Text>
            ))}
          </View>
        ) : null}
        <View style={styles.postMetaRow}>
          <Text style={styles.date}>{post.date}</Text>
          <Pressable
            testID="community-post-report-button"
            onPress={() => openReportSheet({ type: 'post' })}
            hitSlop={8}
            style={({ pressed }) => pressed ? styles.pressed : null}>
            <Text style={styles.reportText}>举报</Text>
          </Pressable>
        </View>
        <Text style={styles.commentsTitle}>{commentsEnabled ? `共${comments.length}条评论` : '作者已关闭评论'}</Text>
        {commentsEnabled
          ? rootComments.map((comment) => renderComment(comment, repliesByParent[comment.id] ?? []))
          : null}
      </ScrollView>
      <View style={styles.bottomBar}>
        {commentsEnabled ? (
          <View style={styles.commentArea}>
            <View style={styles.commentInputWrap}>
              {replyingTo ? (
                <Pressable
                  testID="community-comment-cancel-reply"
                  onPress={() => setReplyingTo(null)}
                  hitSlop={8}
                  style={({ pressed }) => [styles.cancelReplyButton, pressed ? styles.pressed : null]}>
                  <X color={colors.textMuted} size={16} strokeWidth={2.5} />
                </Pressable>
              ) : null}
              <TextInput
                placeholder={replyingTo ? `回复 ${replyingTo.authorName}…` : '说点什么…'}
                placeholderTextColor="#8a7a83"
                style={styles.commentInput}
                value={draft}
                onChangeText={setDraft}
                onSubmitEditing={handleSend}
                returnKeyType="send"
                editable={!sending}
              />
              <Pressable
                testID="community-comment-send-button"
                onPress={handleSend}
                disabled={!canSendComment}
                style={({ pressed }) => [styles.commentSendButton, pressed && canSendComment ? styles.pressed : null, !canSendComment ? styles.disabled : null]}
                accessibilityLabel="发送评论">
                <Send color={colors.text} size={18} strokeWidth={2.5} />
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.commentsOff}>
            <Text style={styles.commentsOffText}>作者已关闭评论</Text>
          </View>
        )}
        <Pressable onPress={() => togglePostLike(post.id)} style={styles.action} hitSlop={8}>
          <Heart color={colors.pink} fill={liked ? colors.pink : 'transparent'} size={25} />
          <Text style={styles.actionText}>{likeCount}</Text>
        </Pressable>
      </View>
      <Modal visible={reportTarget !== null} transparent animationType="fade" onRequestClose={closeReportSheet}>
        <View style={styles.reportBackdrop}>
          <View style={styles.reportSheet}>
            <View style={styles.reportHeader}>
              <Text style={styles.reportTitle}>举报内容</Text>
              <Pressable onPress={closeReportSheet} hitSlop={8} testID="community-report-cancel">
                <X color={colors.textMuted} size={18} strokeWidth={2.5} />
              </Pressable>
            </View>
            <View style={styles.reportReasonRow}>
              {reportReasons.map((reason) => {
                const selected = reportReason === reason.key;
                return (
                  <Pressable
                    key={reason.key}
                    testID={`community-report-reason-${reason.key}`}
                    onPress={() => setReportReason(reason.key)}
                    style={[styles.reportReasonButton, selected ? styles.reportReasonSelected : null]}>
                    <Text style={[styles.reportReasonText, selected ? styles.reportReasonTextSelected : null]}>{reason.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <TextInput
              testID="community-report-detail-input"
              value={reportDetail}
              onChangeText={setReportDetail}
              placeholder="补充说明（选填）"
              placeholderTextColor="#8a7a83"
              style={styles.reportDetailInput}
              multiline
              maxLength={200}
            />
            <View style={styles.reportActions}>
              <Pressable onPress={closeReportSheet} style={[styles.reportActionButton, styles.reportCancelButton]}>
                <Text style={styles.reportCancelText}>取消</Text>
              </Pressable>
              <Pressable
                testID="community-report-submit"
                onPress={submitReport}
                disabled={submittingReport}
                style={[styles.reportActionButton, styles.reportSubmitButton, submittingReport ? styles.disabled : null]}>
                <Text style={styles.reportSubmitText}>{submittingReport ? '提交中' : '确认举报'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
    marginTop: 10,
    marginBottom: 14,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  authorName: {
    flex: 1,
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  follow: {
    width: 104,
    borderRadius: radii.pill,
  },
  followGradient: {
    minHeight: 42,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  image: {
    width: '100%',
    borderRadius: radii.md,
    backgroundColor: colors.panel,
  },
  gallery: {
    gap: 10,
  },
  galleryImage: {
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
  body: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 27,
    marginTop: 18,
  },
  date: {
    color: colors.textMuted,
    fontSize: 13,
  },
  postMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    marginTop: 12,
  },
  reportText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  commentsTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 24,
  },
  comment: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  replyComment: {
    gap: 9,
    marginTop: 12,
  },
  commentAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  replyAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  commentCopy: {
    flex: 1,
  },
  commentAuthor: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  commentText: {
    color: colors.textSoft,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 4,
  },
  commentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  commentMetaLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  commentDate: {
    color: colors.textMuted,
    fontSize: 12,
  },
  commentActionText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  commentLike: {
    flexShrink: 0,
    paddingLeft: 10,
  },
  commentLikeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 28,
  },
  replies: {
    marginTop: 4,
    paddingLeft: 2,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 18,
    backgroundColor: 'rgba(7,0,4,0.96)',
  },
  commentArea: {
    flex: 1,
    minWidth: 0,
  },
  commentInputWrap: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.pill,
    backgroundColor: colors.inputDark,
    paddingLeft: 18,
    paddingRight: 5,
  },
  cancelReplyButton: {
    width: 28,
    height: 28,
    flexShrink: 0,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
    backgroundColor: colors.panel,
  },
  commentInput: {
    flex: 1,
    minWidth: 0,
    color: colors.text,
    fontSize: 15,
    paddingVertical: 10,
  },
  commentSendButton: {
    width: 36,
    height: 36,
    flexShrink: 0,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.pink,
  },
  commentsOff: {
    flex: 1,
    minHeight: 46,
    borderRadius: radii.pill,
    backgroundColor: colors.inputDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentsOffText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  action: {
    alignItems: 'center',
    minWidth: 36,
  },
  actionText: {
    color: colors.text,
    fontSize: 12,
    marginTop: 2,
  },
  reportBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.58)',
  },
  reportSheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    backgroundColor: colors.bgDeep,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reportTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  reportReasonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
  },
  reportReasonButton: {
    minHeight: 38,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    paddingHorizontal: 14,
    backgroundColor: colors.panel,
  },
  reportReasonSelected: {
    borderColor: colors.pink,
    backgroundColor: 'rgba(255,47,159,0.16)',
  },
  reportReasonText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  reportReasonTextSelected: {
    color: colors.pink,
  },
  reportDetailInput: {
    minHeight: 88,
    marginTop: 14,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    backgroundColor: colors.inputDark,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  reportActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  reportActionButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportCancelButton: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  reportSubmitButton: {
    backgroundColor: colors.pink,
  },
  reportCancelText: {
    color: colors.textSoft,
    fontSize: 15,
    fontWeight: '800',
  },
  reportSubmitText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.78,
  },
  disabled: {
    opacity: 0.45,
  },
});
