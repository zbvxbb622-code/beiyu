import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { AuthenticatedClient, FetchLike } from '@/services/api/authenticatedClient';
import { AuthRepository } from '@/services/auth/authRepository';
import { tokenStore } from '@/services/auth/tokenStore';

const validTokenResponse = {
  accessToken: 'next-access-token',
  refreshToken: 'next-refresh-token',
  expiresIn: 900,
  refreshExpiresIn: 2_592_000,
};

const validLoginResponse = {
  ...validTokenResponse,
  isNewUser: false,
  user: {
    id: '0f38f737-b8e9-4f75-8bb3-0b5a53f93afc',
    phoneMasked: '138****0000',
    status: 'ACTIVE',
    ageConfirmed: true,
    memoryEnabled: true,
    membershipLevel: 'FREE',
  },
  device: {
    id: '5364864c-3a48-4ca8-90b7-04f049b3227b',
    platform: 'IOS',
    deviceName: 'Test iPhone',
    appVersion: '1.0.0',
    lastActiveAt: '2026-07-29T08:00:00.000Z',
    isCurrent: true,
  },
};

const validCommunityPost = {
  id: 'post-1',
  category: 'recommended',
  title: '后端社区笔记',
  authorId: 'author-1',
  authorName: '杯语用户',
  authorAvatarKey: 'avatarOne',
  imageKey: 'communityGrid',
  body: '社区帖子已经走后端。',
  date: '2026-08-02',
  likes: 0,
  comments: [],
  images: [{ id: 'cover', kind: 'asset', assetKey: 'communityGrid' }],
  topics: ['调酒'],
  visibility: 'public',
  allowComments: true,
};

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async (): Promise<unknown> => body,
  } as unknown as Response;
}

function rawOnlyClient(): AuthenticatedClient {
  return {
    request: async () => {
      throw new Error('authenticated client should not be used');
    },
  };
}

function createRepository(fetch: FetchLike, client?: AuthenticatedClient) {
  return new AuthRepository({
    apiBaseUrl: 'https://api.example.test/api/v1',
    fetch,
    timeoutMs: 100,
    authenticatedClient: client ?? rawOnlyClient(),
  });
}

describe('AuthRepository', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('sends SMS requests through the raw client and parses its typed response', async () => {
    const fetchMock = jest.fn<FetchLike>().mockResolvedValue(
      jsonResponse({ expiresIn: 300, retryAfter: 60 }, 202)
    );
    const repository = createRepository(fetchMock);

    await expect(repository.requestSmsCode('13800000000', 'installation-123')).resolves.toEqual({
      expiresIn: 300,
      retryAfter: 60,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/api/v1/auth/sms-codes',
      expect.objectContaining({
        body: JSON.stringify({
          phone: '13800000000',
          installationId: 'installation-123',
          scene: 'LOGIN',
        }),
      })
    );
  });

  it('refreshes through the raw client and rotates the secure refresh token', async () => {
    const getRefreshToken = jest.spyOn(tokenStore, 'getRefreshToken').mockResolvedValue('stored-refresh-token');
    const setRefreshToken = jest.spyOn(tokenStore, 'setRefreshToken').mockResolvedValue();
    const fetchMock = jest.fn<FetchLike>().mockResolvedValue(jsonResponse(validTokenResponse));
    const repository = createRepository(fetchMock);

    await expect(repository.refresh()).resolves.toEqual(validTokenResponse);
    expect(getRefreshToken).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/api/v1/auth/refresh',
      expect.objectContaining({ body: JSON.stringify({ refreshToken: 'stored-refresh-token' }) })
    );
    expect(setRefreshToken).toHaveBeenCalledWith('next-refresh-token');
  });

  it('uses the authenticated client for protected logout and clears the refresh token after its 204 response', async () => {
    const request = jest.fn(async () => undefined) as unknown as AuthenticatedClient['request'];
    const clearRefreshToken = jest.spyOn(tokenStore, 'clearRefreshToken').mockResolvedValue(true);
    const repository = createRepository(jest.fn<FetchLike>(), { request });

    await expect(repository.logout()).resolves.toBeUndefined();
    expect(request).toHaveBeenCalledWith('/auth/logout', { method: 'POST' }, expect.anything());
    expect(clearRefreshToken).toHaveBeenCalledTimes(1);
  });

  it('sends a single-field cellar patch without clearing the other editable field', async () => {
    const request = jest.fn(async () => undefined) as unknown as AuthenticatedClient['request'];
    const repository = createRepository(jest.fn<FetchLike>(), { request });

    await repository.patchCellarItem('cellar-item-id', { note: 'Keep chilled' });

    expect(request).toHaveBeenCalledWith(
      '/cellar/items/cellar-item-id',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ note: 'Keep chilled' }),
      }),
      expect.anything()
    );
  });

  it('stores login refresh tokens from the raw typed login response', async () => {
    const setRefreshToken = jest.spyOn(tokenStore, 'setRefreshToken').mockResolvedValue();
    const fetchMock = jest.fn<FetchLike>().mockResolvedValue(jsonResponse(validLoginResponse));
    const repository = createRepository(fetchMock);

    await expect(
      repository.login({
        phone: '13800000000',
        code: '123456',
        device: {
          installationId: 'installation-123',
          platform: 'IOS',
          deviceName: 'Test iPhone',
          appVersion: '1.0.0',
        },
      })
    ).resolves.toEqual(validLoginResponse);
    expect(setRefreshToken).toHaveBeenCalledWith('next-refresh-token');
  });

  it('lists community posts through the authenticated client with category filters', async () => {
    const request = jest.fn(async () => ({ items: [validCommunityPost] })) as unknown as AuthenticatedClient['request'];
    const repository = createRepository(jest.fn<FetchLike>(), { request });

    await expect(repository.listCommunityPosts('recommended')).resolves.toEqual({ items: [validCommunityPost] });
    expect(request).toHaveBeenCalledWith('/community/posts?category=recommended', { method: 'GET' }, expect.anything());
  });

  it('creates community posts and comments through the authenticated client', async () => {
    const validComment = {
      id: 'comment-1',
      authorName: '杯语用户',
      authorAvatarKey: 'avatarOne',
      text: '看起来不错',
      date: '2026-08-02',
    };
    const requestMock = jest.fn<() => Promise<unknown>>()
      .mockResolvedValueOnce(validCommunityPost)
      .mockResolvedValueOnce(validComment);
    const request = requestMock as unknown as AuthenticatedClient['request'];
    const repository = createRepository(jest.fn<FetchLike>(), { request });

    await expect(repository.createCommunityPost({
      title: '后端社区笔记',
      body: '社区帖子已经走后端。',
      category: 'recommended',
      imageKey: 'communityGrid',
      images: [
        { id: 'cover', kind: 'asset', assetKey: 'communityGrid' },
        { id: 'local', kind: 'uri', uri: 'file:///tmp/local.jpg' },
      ],
      topics: ['调酒'],
      visibility: 'public',
      allowComments: true,
    })).resolves.toEqual(validCommunityPost);
    await expect(repository.addCommunityComment('post-1', '看起来不错', 'comment-1')).resolves.toEqual(validComment);

    expect(requestMock).toHaveBeenNthCalledWith(
      1,
      '/community/posts',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          title: '后端社区笔记',
          body: '社区帖子已经走后端。',
          category: 'recommended',
          imageKey: 'communityGrid',
          images: [
            { id: 'cover', kind: 'asset', assetKey: 'communityGrid' },
            { id: 'local', kind: 'uri', uri: 'file:///tmp/local.jpg' },
          ],
          topics: ['调酒'],
          visibility: 'public',
          allowComments: true,
        }),
      }),
      expect.anything()
    );
    expect(requestMock).toHaveBeenNthCalledWith(
      2,
      '/community/posts/post-1/comments',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ text: '看起来不错', parentCommentId: 'comment-1' }),
      }),
      expect.anything()
    );
  });

  it('likes and unlikes community comments through the authenticated client', async () => {
    const likedComment = {
      id: 'comment-1',
      authorName: '杯语用户',
      authorAvatarKey: 'avatarOne',
      text: '看起来不错',
      date: '2026-08-02',
      likes: 1,
      likedByMe: true,
    };
    const unlikedComment = { ...likedComment, likes: 0, likedByMe: false };
    const requestMock = jest.fn<() => Promise<unknown>>()
      .mockResolvedValueOnce(likedComment)
      .mockResolvedValueOnce(unlikedComment);
    const request = requestMock as unknown as AuthenticatedClient['request'];
    const repository = createRepository(jest.fn<FetchLike>(), { request });

    await expect(repository.likeCommunityComment('comment-1')).resolves.toEqual(likedComment);
    await expect(repository.unlikeCommunityComment('comment-1')).resolves.toEqual(unlikedComment);

    expect(requestMock).toHaveBeenNthCalledWith(
      1,
      '/community/comments/comment-1/like',
      { method: 'POST' },
      expect.anything()
    );
    expect(requestMock).toHaveBeenNthCalledWith(
      2,
      '/community/comments/comment-1/like',
      { method: 'DELETE' },
      expect.anything()
    );
  });

  it('likes and unlikes community posts through the authenticated client', async () => {
    const likedPost = { ...validCommunityPost, likes: 1, likedByMe: true };
    const unlikedPost = { ...validCommunityPost, likes: 0, likedByMe: false };
    const requestMock = jest.fn<() => Promise<unknown>>()
      .mockResolvedValueOnce(likedPost)
      .mockResolvedValueOnce(unlikedPost);
    const request = requestMock as unknown as AuthenticatedClient['request'];
    const repository = createRepository(jest.fn<FetchLike>(), { request });

    await expect(repository.likeCommunityPost('post-1')).resolves.toEqual(likedPost);
    await expect(repository.unlikeCommunityPost('post-1')).resolves.toEqual(unlikedPost);

    expect(requestMock).toHaveBeenNthCalledWith(
      1,
      '/community/posts/post-1/like',
      { method: 'POST' },
      expect.anything()
    );
    expect(requestMock).toHaveBeenNthCalledWith(
      2,
      '/community/posts/post-1/like',
      { method: 'DELETE' },
      expect.anything()
    );
  });

  it('deletes community posts through the authenticated client', async () => {
    const requestMock = jest.fn<() => Promise<unknown>>().mockResolvedValueOnce(undefined);
    const request = requestMock as unknown as AuthenticatedClient['request'];
    const repository = createRepository(jest.fn<FetchLike>(), { request });

    await expect(repository.deleteCommunityPost('post-1')).resolves.toBeUndefined();

    expect(requestMock).toHaveBeenCalledWith(
      '/community/posts/post-1',
      { method: 'DELETE' },
      expect.anything()
    );
  });

  it('reports community posts and comments through the authenticated client', async () => {
    const report = {
      id: 'report-1',
      reporterId: 'user-1',
      targetType: 'post',
      postId: 'post-1',
      reason: 'spam',
      detail: '重复内容',
      status: 'open',
      createdAt: '2026-08-02T00:00:00.000Z',
    };
    const requestMock = jest.fn<() => Promise<unknown>>()
      .mockResolvedValueOnce(report)
      .mockResolvedValueOnce({ ...report, id: 'report-2', targetType: 'comment', commentId: 'comment-1' });
    const request = requestMock as unknown as AuthenticatedClient['request'];
    const repository = createRepository(jest.fn<FetchLike>(), { request });

    await expect(repository.reportCommunityPost('post-1', { reason: 'spam', detail: '重复内容' })).resolves.toEqual(report);
    await expect(repository.reportCommunityComment('comment-1', { reason: 'harassment' })).resolves.toEqual({
      ...report,
      id: 'report-2',
      targetType: 'comment',
      commentId: 'comment-1',
    });

    expect(requestMock).toHaveBeenNthCalledWith(
      1,
      '/community/posts/post-1/reports',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ reason: 'spam', detail: '重复内容' }),
      }),
      expect.anything()
    );
    expect(requestMock).toHaveBeenNthCalledWith(
      2,
      '/community/comments/comment-1/reports',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ reason: 'harassment' }),
      }),
      expect.anything()
    );
  });
});
