import { getImageAsset } from '@/data/imageAssets';
import { getBarVenueById, mergeCommunityPosts } from '@/services/contentService';
import type { BarVenue, CommunityPost, LocalInteractionState, UserProfile } from '@/types/mixology';
import type { ImageSourcePropType } from 'react-native';

// 「笔记」Tab：我发布的帖子
export function getMyPosts(interactionState: LocalInteractionState): CommunityPost[] {
  return interactionState.localCommunityPosts;
}

// 「收藏」Tab：收藏的酒吧（过滤无效 id）
export function getFavoriteVenues(interactionState: LocalInteractionState): BarVenue[] {
  return interactionState.favoriteVenueIds
    .map((venueId) => getBarVenueById(venueId))
    .filter((venue): venue is BarVenue => Boolean(venue));
}

// 「赞过」Tab：点赞过的帖子（本地帖 + 静态帖合并后过滤）
export function getLikedPosts(interactionState: LocalInteractionState): CommunityPost[] {
  return mergeCommunityPosts(interactionState.localCommunityPosts).filter((post) =>
    interactionState.likedPostIds.includes(post.id)
  );
}

// 统计行：笔记 / 获赞 / 关注 / 粉丝
export function getProfileStats(interactionState: LocalInteractionState) {
  const myPosts = interactionState.localCommunityPosts;
  const myPostIds = new Set(myPosts.map((post) => post.id));

  // 获赞 = 我帖子的点赞数 + 我帖子收到的本地评论数（本地环境无他人点赞的合理近似）
  const likesOnMyPosts = myPosts.reduce((sum, post) => sum + post.likes, 0);
  const commentsOnMyPosts = Object.entries(interactionState.localPostComments)
    .filter(([postId]) => myPostIds.has(postId))
    .reduce((sum, [, comments]) => sum + comments.length, 0);

  return {
    posts: myPosts.length,
    receivedLikes: likesOnMyPosts + commentsOnMyPosts,
    following: interactionState.followedAuthorIds.length,
    fans: 0, // 本地无粉丝概念，保持占位，不编造
  };
}

// 头像解析：自定义 uri 优先，其次预设 key，坏 key 回退 avatarOne
export function resolveAvatarSource(profile: Pick<UserProfile, 'avatarKey' | 'avatarUri'>): ImageSourcePropType {
  if (profile.avatarUri) {
    return { uri: profile.avatarUri };
  }
  return getImageAsset(profile.avatarKey || 'avatarOne');
}
