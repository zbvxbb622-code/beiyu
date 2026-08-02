import {
  barVenues,
  communityPosts,
  heroSlides,
  homeShortcuts,
  sharedCellarCards,
} from '@/data/content';
import type { CommunityComment, CommunityPost, FeedCategory } from '@/types/mixology';

export function getHeroSlides() {
  return heroSlides;
}

export function getHomeShortcuts() {
  return homeShortcuts;
}

// 合并静态帖子与用户本地发布的帖子
export function mergeCommunityPosts(localPosts: CommunityPost[] = []): CommunityPost[] {
  const seen = new Set<string>();
  const merged: CommunityPost[] = [];
  // 本地帖子优先（最新发布在前）
  for (const post of [...localPosts, ...communityPosts]) {
    if (!seen.has(post.id)) {
      seen.add(post.id);
      merged.push(post);
    }
  }
  return merged;
}

export function getCommunityPosts(
  category?: FeedCategory,
  localPosts: CommunityPost[] = [],
  followedAuthorIds: string[] = []
) {
  // 仅自己可见的帖子不进社区 Feed（仍可在「我的-笔记」和详情页查看）
  const all = mergeCommunityPosts(localPosts).filter((post) => post.visibility !== 'private');
  if (!category) {
    return all;
  }

  if (category === 'following') {
    const followed = new Set(followedAuthorIds);
    if (followed.size === 0) {
      return all.filter((post) => post.category === 'following');
    }
    return all.filter((post) => post.category === 'following' && followed.has(post.authorId));
  }

  return all.filter((post) => post.category === category);
}

export function getCommunityPostById(id: string, localPosts: CommunityPost[] = []) {
  return mergeCommunityPosts(localPosts).find((post) => post.id === id);
}

// 合并静态评论与本地新增评论
export function mergePostComments(
  post: CommunityPost,
  localComments: Record<string, CommunityComment[]> = {}
): CommunityComment[] {
  const extras = localComments[post.id] ?? [];
  return [...post.comments, ...extras];
}

export function getBarVenues() {
  return barVenues;
}

export function getBarVenueById(id: string) {
  return barVenues.find((venue) => venue.id === id);
}

export function getSharedCellarCards() {
  return sharedCellarCards;
}

export function getSharedCellarCardById(id: string) {
  return sharedCellarCards.find((card) => card.id === id);
}
