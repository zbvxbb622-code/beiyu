import { describe, expect, it } from '@jest/globals';

import type { CommunityPost } from '@/types/mixology';

import {
  getBarVenueById,
  getBarVenues,
  getCommunityPostById,
  getCommunityPosts,
  getHeroSlides,
  getHomeShortcuts,
  getSharedCellarCardById,
  getSharedCellarCards,
} from '../contentService';

describe('contentService', () => {
  it('provides the Beiyu home structure from the redesign plan', () => {
    expect(getHeroSlides()).toHaveLength(4);
    expect(getHeroSlides()[0]).toEqual(
      expect.objectContaining({
        id: 'welcome-bar',
        brand: 'Beiyu',
        ctaLabel: '去AI调酒',
      })
    );
    expect(getHomeShortcuts().map((shortcut) => shortcut.id)).toEqual([
      'blind-box',
      'drink-knowledge',
      'classic-series',
    ]);
  });

  it('provides community posts, bar venues, and shared cellar cards with detail records', () => {
    const post = getCommunityPosts('recommended')[0];
    const venue = getBarVenues()[0];
    const cellarCard = getSharedCellarCards()[0];

    expect(getCommunityPostById(post.id)?.title).toBe(post.title);
    expect(getBarVenueById(venue.id)?.menu.length).toBeGreaterThan(0);
    expect(getSharedCellarCardById(cellarCard.id)?.steps.length).toBeGreaterThan(0);
  });

  it('provides enough community posts for a real two-column feed', () => {
    expect(getCommunityPosts('recommended').length).toBeGreaterThanOrEqual(6);
    expect(getCommunityPosts('nearby').length).toBeGreaterThanOrEqual(3);
    expect(getCommunityPosts('following').length).toBeGreaterThanOrEqual(3);
  });

  it('limits following feed posts to followed authors instead of mixing recommendations', () => {
    const followed = getCommunityPosts('following', [], ['pool']);

    expect(followed.length).toBeGreaterThan(0);
    expect(followed.every((post) => post.authorId === 'pool')).toBe(true);
    expect(followed.every((post) => post.category === 'following')).toBe(true);
  });

  it('excludes private posts from feed but keeps them reachable by id', () => {
    const privatePost: CommunityPost = {
      id: 'local-post-private',
      category: 'recommended',
      title: '仅自己可见的笔记',
      authorId: 'local-user',
      authorName: '我',
      authorAvatarKey: 'avatarOne',
      imageKey: 'barInterior',
      body: '这是一条私密笔记',
      date: '2026-07-21',
      likes: 0,
      comments: [],
      visibility: 'private',
    };

    const feed = getCommunityPosts('recommended', [privatePost]);
    expect(feed.some((post) => post.id === privatePost.id)).toBe(false);
    expect(getCommunityPostById(privatePost.id, [privatePost])?.title).toBe(privatePost.title);
  });
});
