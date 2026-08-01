import { describe, expect, it } from '@jest/globals';

import { communityPostSchema } from '@/services/community/communitySchemas';

describe('community schemas', () => {
  it('accepts backend posts without an associated venue', () => {
    const parsed = communityPostSchema.parse({
      id: 'post-1',
      category: 'recommended',
      title: '发布笔记',
      authorId: 'author-1',
      authorName: '杯语 Demo',
      authorAvatarKey: 'avatarOne',
      imageKey: 'communityGrid',
      body: '后端返回 venueId null 时前端也应接受。',
      date: '2026-08-02',
      likes: 0,
      likedByMe: false,
      comments: [],
      venueId: null,
      images: [{ id: 'cover', kind: 'asset', assetKey: 'communityGrid' }],
      topics: ['居家调酒'],
      visibility: 'public',
      allowComments: true,
      createdAt: '2026-08-02T00:00:00.000Z',
    });

    expect(parsed.venueId).toBeUndefined();
  });
});
