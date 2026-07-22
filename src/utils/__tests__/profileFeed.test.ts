import { describe, expect, it } from '@jest/globals';

import { communityPosts } from '@/data/content';
import type { LocalInteractionState } from '@/types/mixology';
import { getFavoriteVenues, getLikedPosts, getMyPosts, getProfileStats, resolveAvatarSource } from '@/utils/profileFeed';

function makeState(patch: Partial<LocalInteractionState>): LocalInteractionState {
  return {
    likedPostIds: [],
    followedAuthorIds: [],
    likedCellarCardIds: [],
    favoriteVenueIds: [],
    localCommunityPosts: [],
    localPostComments: {},
    searchHistory: [],
    lastDrawDate: null,
    drawnCards: [],
    ...patch,
  };
}

const myPost = {
  id: 'local-post-1',
  category: 'recommended' as const,
  title: '我的第一杯特调',
  authorId: 'local-user',
  authorName: '霓虹酒保',
  authorAvatarKey: 'avatarTwo',
  imageKey: 'mojito',
  body: '薄荷加倍更清爽',
  date: '2026-07-20',
  likes: 5,
  comments: [],
};

describe('profileFeed', () => {
  it('getMyPosts returns local posts', () => {
    expect(getMyPosts(makeState({ localCommunityPosts: [myPost] }))).toHaveLength(1);
    expect(getMyPosts(makeState({}))).toHaveLength(0);
  });

  it('getLikedPosts only returns liked posts from merged pool', () => {
    const likedStaticId = communityPosts[0].id;
    const state = makeState({
      localCommunityPosts: [myPost],
      likedPostIds: [likedStaticId, myPost.id],
    });

    const liked = getLikedPosts(state);
    const likedIds = liked.map((post) => post.id);

    expect(likedIds).toContain(likedStaticId);
    expect(likedIds).toContain(myPost.id);
    expect(liked).toHaveLength(2);
  });

  it('getFavoriteVenues maps ids and drops invalid ones', () => {
    const state = makeState({ favoriteVenueIds: ['amor-fati', 'not-exist'] });
    const venues = getFavoriteVenues(state);

    expect(venues).toHaveLength(1);
    expect(venues[0].id).toBe('amor-fati');
  });

  it('getProfileStats counts posts/likes/following and keeps fans at 0', () => {
    const state = makeState({
      localCommunityPosts: [myPost],
      localPostComments: { 'local-post-1': [{ id: 'c1', authorName: 'a', authorAvatarKey: 'avatarOne', text: '赞', date: '2026-07-20' }] },
      followedAuthorIds: ['author-1', 'author-2'],
    });

    expect(getProfileStats(state)).toEqual({
      posts: 1,
      receivedLikes: 6, // 5 likes + 1 评论
      following: 2,
      fans: 0,
    });
  });

  it('resolveAvatarSource prefers uri then preset key then fallback', () => {
    expect(resolveAvatarSource({ avatarKey: 'avatarTwo', avatarUri: 'file:///x.jpg' })).toEqual({ uri: 'file:///x.jpg' });
    expect(resolveAvatarSource({ avatarKey: 'avatarTwo', avatarUri: null })).toBeTruthy();
    expect(resolveAvatarSource({ avatarKey: '', avatarUri: null })).toBeTruthy(); // 回退 avatarOne
  });
});
