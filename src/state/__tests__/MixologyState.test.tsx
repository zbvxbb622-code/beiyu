import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { useEffect } from 'react';
import { Text } from 'react-native';

import type { BootstrapResponse } from '@/services/auth/authSchemas';
import type { AuthRepository } from '@/services/auth/authRepository';
import { loadAuthenticatedState, loadLocalState, loadUserProfile } from '@/services/storageService';
import { MixologyProvider, useMixology } from '@/state/MixologyState';

type MixologyValue = ReturnType<typeof useMixology>;

let currentValue: MixologyValue | null = null;
const mockRepository = {
  confirmAge: jest.fn<AuthRepository['confirmAge']>(),
  patchProfile: jest.fn<AuthRepository['patchProfile']>(),
  patchPrivacy: jest.fn<AuthRepository['patchPrivacy']>(),
  batchCellarItems: jest.fn<AuthRepository['batchCellarItems']>(),
  listCommunityPosts: jest.fn<AuthRepository['listCommunityPosts']>(),
  createCommunityPost: jest.fn<AuthRepository['createCommunityPost']>(),
  addCommunityComment: jest.fn<AuthRepository['addCommunityComment']>(),
  likeCommunityPost: jest.fn<AuthRepository['likeCommunityPost']>(),
  unlikeCommunityPost: jest.fn<AuthRepository['unlikeCommunityPost']>(),
  deleteCommunityPost: jest.fn<AuthRepository['deleteCommunityPost']>(),
  likeCommunityComment: jest.fn<AuthRepository['likeCommunityComment']>(),
  unlikeCommunityComment: jest.fn<AuthRepository['unlikeCommunityComment']>(),
  reportCommunityPost: jest.fn<AuthRepository['reportCommunityPost']>(),
  reportCommunityComment: jest.fn<AuthRepository['reportCommunityComment']>(),
};
let mockAuthSnapshot: {
  status: 'signedOut' | 'signedIn';
  repository: typeof mockRepository;
} = {
  status: 'signedOut',
  repository: mockRepository,
};

jest.mock('@/state/AuthState', () => ({
  useAuth: () => mockAuthSnapshot,
}));

const bootstrap: BootstrapResponse = {
  user: {
    id: '5364864c-3a48-4ca8-90b7-04f049b3227b',
    phoneMasked: '138****0000',
    status: 'ACTIVE',
    ageConfirmed: true,
    memoryEnabled: true,
    membershipLevel: 'FREE',
  },
  profile: {
    nickname: '云端杯友',
    avatarKey: 'avatarTwo',
    avatarUri: null,
    signature: '只喝经典',
    city: '上海',
    gender: '女',
    birthday: '1998-01-02',
    showBirthdayTag: false,
    showAge: false,
    showZodiac: true,
    occupation: '调酒师',
    school: '杯语学院',
  },
  privacy: {
    localOnlyMode: false,
    analyticsOptIn: true,
    syncWhenLoggedIn: true,
  },
  accountSecurity: {
    phone: '138****0000',
    phoneVerified: true,
    wechatBound: true,
    wechatAccount: 'cup-friend',
    passwordSet: true,
    realnameVerified: true,
    realnameName: '杯友',
    officialVerified: true,
    officialType: '调酒师',
    devices: [
      {
        id: '6364864c-3a48-4ca8-90b7-04f049b3227b',
        name: 'Test iPhone',
        platform: 'IOS',
        lastActiveAt: '2026-07-29T08:00:00.000Z',
        isCurrent: true,
      },
    ],
  },
  cellar: {
    items: [
      {
        id: '7364864c-3a48-4ca8-90b7-04f049b3227b',
        ingredientId: 'gin',
        customName: null,
        amountLabel: null,
        note: null,
        source: 'MANUAL',
        createdAt: '2026-07-29T08:00:00.000Z',
        updatedAt: '2026-07-29T08:00:00.000Z',
      },
      {
        id: '8364864c-3a48-4ca8-90b7-04f049b3227b',
        ingredientId: null,
        customName: '自制糖浆',
        amountLabel: null,
        note: null,
        source: 'MANUAL',
        createdAt: '2026-07-29T08:00:00.000Z',
        updatedAt: '2026-07-29T08:00:00.000Z',
      },
    ],
  },
  ai: {
    dailyMessageLimit: 50,
    messagesUsedToday: 0,
    remaining: 50,
    resetsAt: '2026-07-29T16:00:00.000Z',
  },
  featureFlags: { aiChat: true },
};

function Probe() {
  const value = useMixology();

  useEffect(() => {
    currentValue = value;
  }, [value]);

  return <Text>{value.isHydrated ? 'hydrated' : 'loading'}</Text>;
}

describe('MixologyProvider', () => {
  beforeEach(async () => {
    currentValue = null;
    await AsyncStorage.clear();
    mockAuthSnapshot = { status: 'signedOut', repository: mockRepository };
    Object.values(mockRepository).forEach((method) => method.mockReset());
    mockRepository.listCommunityPosts.mockResolvedValue({ items: [] });
  });

  it('preserves rapid interaction updates from the same rendered snapshot', async () => {
    const screen = await render(
      <MixologyProvider>
        <Probe />
      </MixologyProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('hydrated')).toBeTruthy();
    });

    const snapshot = currentValue;
    expect(snapshot).not.toBeNull();

    await act(async () => {
      await Promise.all([
        snapshot!.togglePostLike('post-1'),
        snapshot!.toggleAuthorFollow('author-1'),
      ]);
    });

    await waitFor(() => {
      expect(currentValue?.interactionState.likedPostIds).toEqual(['post-1']);
      expect(currentValue?.interactionState.followedAuthorIds).toEqual(['author-1']);
    });
  });

  it('maps bootstrap data to memory and all local mirrors together', async () => {
    const screen = await render(
      <MixologyProvider>
        <Probe />
      </MixologyProvider>
    );
    await screen.findByText('hydrated');

    await act(async () => {
      await currentValue!.applyBootstrap(bootstrap);
    });

    expect(currentValue?.userProfile).toEqual(bootstrap.profile);
    expect(currentValue?.localState).toEqual({
      ageVerified: true,
      cellarIngredientIds: ['gin'],
      privacySettings: bootstrap.privacy,
    });
    expect(currentValue?.accountSecurity).toEqual({
      phone: '138****0000',
      phoneVerified: true,
      wechatBound: true,
      wechatAccount: 'cup-friend',
      passwordSet: true,
      realnameVerified: true,
      realnameName: '',
      officialVerified: true,
      officialType: '调酒师',
      devices: [{
        id: '6364864c-3a48-4ca8-90b7-04f049b3227b',
        name: 'Test iPhone',
        platform: 'iOS',
        lastActive: '2026-07-29T08:00:00.000Z',
        isCurrent: true,
      }],
    });
    await expect(loadAuthenticatedState(bootstrap.user.id)).resolves.toEqual({
      userProfile: bootstrap.profile,
      localState: { ageVerified: true, cellarIngredientIds: ['gin'], privacySettings: bootstrap.privacy },
      accountSecurity: currentValue?.accountSecurity,
    });
  });

  it('keeps the saved profile snapshot unchanged when the remote patch rejects', async () => {
    mockAuthSnapshot = { status: 'signedIn', repository: mockRepository };
    mockRepository.patchProfile.mockRejectedValueOnce(new Error('offline'));
    const screen = await render(<MixologyProvider><Probe /></MixologyProvider>);
    await screen.findByText('hydrated');
    const savedProfile = currentValue!.userProfile;

    await act(async () => {
      await expect(currentValue!.updateUserProfile({ nickname: '未保存的编辑' })).rejects.toThrow('offline');
    });

    expect(currentValue?.userProfile).toEqual(savedProfile);
    await expect(loadUserProfile()).resolves.toEqual(savedProfile);
  });

  it('keeps age and privacy snapshots unchanged when their remote updates reject', async () => {
    mockAuthSnapshot = { status: 'signedIn', repository: mockRepository };
    mockRepository.confirmAge.mockRejectedValueOnce(new Error('age offline'));
    mockRepository.patchPrivacy.mockRejectedValueOnce(new Error('privacy offline'));
    const screen = await render(<MixologyProvider><Probe /></MixologyProvider>);
    await screen.findByText('hydrated');
    const savedLocalState = currentValue!.localState;

    await act(async () => {
      await expect(currentValue!.verifyAge()).rejects.toThrow('age offline');
      await expect(currentValue!.updatePrivacySettings({
        localOnlyMode: false,
        analyticsOptIn: true,
        syncWhenLoggedIn: true,
      })).rejects.toThrow('privacy offline');
    });

    expect(currentValue?.localState).toEqual(savedLocalState);
    await expect(loadLocalState()).resolves.toEqual(savedLocalState);
  });

  it('marks realname verification without persisting the submitted name', async () => {
    mockAuthSnapshot = { status: 'signedIn', repository: mockRepository };
    const screen = await render(<MixologyProvider><Probe /></MixologyProvider>);
    await screen.findByText('hydrated');

    await act(async () => {
      await currentValue!.verifyRealname('张三');
    });

    expect(currentValue?.accountSecurity.realnameVerified).toBe(true);
    expect(currentValue?.accountSecurity.realnameName).toBe('');
    await expect(loadAuthenticatedState('__test-session__')).resolves.toMatchObject({
      accountSecurity: {
        realnameVerified: true,
        realnameName: '',
      },
    });
  });

  it('uses the server cellar response as the final state across rapid toggles', async () => {
    mockAuthSnapshot = { status: 'signedIn', repository: mockRepository };
    mockRepository.batchCellarItems
      .mockResolvedValueOnce({ items: [bootstrap.cellar.items[0]] })
      .mockResolvedValueOnce({ items: [bootstrap.cellar.items[0], { ...bootstrap.cellar.items[0], id: '9364864c-3a48-4ca8-90b7-04f049b3227b', ingredientId: 'lime' }] });
    const screen = await render(<MixologyProvider><Probe /></MixologyProvider>);
    await screen.findByText('hydrated');

    await act(async () => {
      await Promise.all([
        currentValue!.toggleCellarIngredient('gin'),
        currentValue!.toggleCellarIngredient('lime'),
      ]);
    });

    expect(mockRepository.batchCellarItems).toHaveBeenNthCalledWith(1, ['gin']);
    expect(mockRepository.batchCellarItems).toHaveBeenNthCalledWith(2, ['gin', 'lime']);
    expect(currentValue?.localState.cellarIngredientIds).toEqual(['gin', 'lime']);
  });

  it('retries a failed cellar toggle from the last saved server snapshot', async () => {
    mockAuthSnapshot = { status: 'signedIn', repository: mockRepository };
    mockRepository.batchCellarItems
      .mockRejectedValueOnce(new Error('cellar offline'))
      .mockResolvedValueOnce({ items: [bootstrap.cellar.items[0]] });
    const screen = await render(<MixologyProvider><Probe /></MixologyProvider>);
    await screen.findByText('hydrated');

    await act(async () => {
      await expect(currentValue!.toggleCellarIngredient('gin')).rejects.toThrow('cellar offline');
    });
    expect(currentValue?.localState.cellarIngredientIds).toEqual([]);

    await act(async () => {
      await currentValue!.toggleCellarIngredient('gin');
    });

    expect(mockRepository.batchCellarItems).toHaveBeenNthCalledWith(1, ['gin']);
    expect(mockRepository.batchCellarItems).toHaveBeenNthCalledWith(2, ['gin']);
    expect(currentValue?.localState.cellarIngredientIds).toEqual(['gin']);
  });

  it('uses backend community posts for signed-in publishing and refreshes visible posts', async () => {
    const remotePost = {
      id: 'remote-post-1',
      category: 'recommended' as const,
      title: '云端笔记',
      authorId: bootstrap.user.id,
      authorName: bootstrap.profile.nickname,
      authorAvatarKey: bootstrap.profile.avatarKey,
      imageKey: 'communityGrid',
      body: '这条帖子来自后端。',
      date: '2026-08-02',
      likes: 0,
      likedByMe: false,
      comments: [],
      images: [{ id: 'cover', kind: 'asset' as const, assetKey: 'communityGrid' }],
      topics: ['调酒'],
      visibility: 'public' as const,
      allowComments: true,
    };
    mockAuthSnapshot = { status: 'signedIn', repository: mockRepository };
    mockRepository.createCommunityPost.mockResolvedValueOnce(remotePost);
    const screen = await render(<MixologyProvider><Probe /></MixologyProvider>);
    await screen.findByText('hydrated');

    await act(async () => {
      await currentValue!.publishPost({
        title: ' 云端笔记 ',
        body: ' 这条帖子来自后端。 ',
        imageKey: 'communityGrid',
        images: [
          { id: 'cover', kind: 'asset', assetKey: 'communityGrid' },
          { id: 'local', kind: 'uri', uri: 'file:///tmp/local.jpg' },
        ],
        topics: ['调酒'],
      });
    });

    expect(mockRepository.createCommunityPost).toHaveBeenCalledWith({
      title: '云端笔记',
      body: '这条帖子来自后端。',
      category: 'recommended',
      imageKey: 'communityGrid',
      images: [
        { id: 'cover', kind: 'asset', assetKey: 'communityGrid' },
        { id: 'local', kind: 'uri', uri: 'file:///tmp/local.jpg' },
      ],
      topics: ['调酒'],
      venueId: undefined,
      visibility: 'public',
      allowComments: true,
    });
    expect(currentValue?.interactionState.localCommunityPosts[0]).toEqual(remotePost);
    await expect(AsyncStorage.getItem('beiyu.interactions')).resolves.toBeNull();
  });

  it('keeps a picked local photo in signed-in community publish payloads', async () => {
    const remotePost = {
      id: 'remote-post-local-photo',
      category: 'recommended' as const,
      title: '相册笔记',
      authorId: bootstrap.user.id,
      authorName: bootstrap.profile.nickname,
      authorAvatarKey: bootstrap.profile.avatarKey,
      imageKey: 'barInterior',
      body: '这条帖子使用相册图片。',
      date: '2026-08-02',
      likes: 0,
      likedByMe: false,
      comments: [],
      images: [{ id: 'local', kind: 'uri' as const, uri: 'file:///tmp/local.jpg' }],
      topics: [],
      visibility: 'public' as const,
      allowComments: true,
    };
    mockAuthSnapshot = { status: 'signedIn', repository: mockRepository };
    mockRepository.createCommunityPost.mockResolvedValueOnce(remotePost);
    const screen = await render(<MixologyProvider><Probe /></MixologyProvider>);
    await screen.findByText('hydrated');

    await act(async () => {
      await currentValue!.publishPost({
        title: '相册笔记',
        body: '这条帖子使用相册图片。',
        images: [{ id: 'local', kind: 'uri', uri: 'file:///tmp/local.jpg' }],
      });
    });

    expect(mockRepository.createCommunityPost).toHaveBeenCalledWith({
      title: '相册笔记',
      body: '这条帖子使用相册图片。',
      category: 'recommended',
      imageKey: 'barInterior',
      images: [{ id: 'local', kind: 'uri', uri: 'file:///tmp/local.jpg' }],
      topics: undefined,
      venueId: undefined,
      visibility: 'public',
      allowComments: true,
    });
    expect(currentValue?.interactionState.localCommunityPosts[0]).toEqual(remotePost);
  });

  it('uses backend comments for signed-in community posts', async () => {
    const remotePost = {
      id: 'remote-post-2',
      category: 'recommended' as const,
      title: '可评论笔记',
      authorId: bootstrap.user.id,
      authorName: bootstrap.profile.nickname,
      authorAvatarKey: bootstrap.profile.avatarKey,
      imageKey: 'communityGrid',
      body: '评论应写入后端。',
      date: '2026-08-02',
      likes: 0,
      likedByMe: false,
      comments: [],
      images: [{ id: 'cover', kind: 'asset' as const, assetKey: 'communityGrid' }],
      topics: ['调酒'],
      visibility: 'public' as const,
      allowComments: true,
    };
    const remoteComment = {
      id: 'remote-comment-1',
      authorName: bootstrap.profile.nickname,
      authorAvatarKey: bootstrap.profile.avatarKey,
      text: '后端评论',
      date: '2026-08-02',
      likes: 0,
    };
    mockAuthSnapshot = { status: 'signedIn', repository: mockRepository };
    mockRepository.listCommunityPosts.mockResolvedValueOnce({ items: [remotePost] });
    mockRepository.addCommunityComment.mockResolvedValueOnce(remoteComment);
    const screen = await render(<MixologyProvider><Probe /></MixologyProvider>);
    await screen.findByText('hydrated');
    await waitFor(() => expect(currentValue?.interactionState.localCommunityPosts).toEqual([remotePost]));

    await act(async () => {
      await currentValue!.addPostComment('remote-post-2', ' 后端评论 ', 'parent-comment-1');
    });

    expect(mockRepository.addCommunityComment).toHaveBeenCalledWith('remote-post-2', '后端评论', 'parent-comment-1');
    expect(currentValue?.interactionState.localCommunityPosts[0].comments).toEqual([remoteComment]);
    await expect(AsyncStorage.getItem('beiyu.interactions')).resolves.toBeNull();
  });

  it('keeps comments local for signed-in static community posts that are not on the backend', async () => {
    mockAuthSnapshot = { status: 'signedIn', repository: mockRepository };
    const screen = await render(<MixologyProvider><Probe /></MixologyProvider>);
    await screen.findByText('hydrated');

    await act(async () => {
      await currentValue!.addPostComment('static-community-post', ' 静态帖子评论 ');
    });

    expect(mockRepository.addCommunityComment).not.toHaveBeenCalled();
    expect(currentValue?.interactionState.localPostComments.staticCommunityPost).toBeUndefined();
    expect(currentValue?.interactionState.localPostComments['static-community-post']).toEqual([
      expect.objectContaining({
        authorName: currentValue?.userProfile.nickname,
        text: '静态帖子评论',
      }),
    ]);
  });

  it('uses backend likes for signed-in community posts without persisting local liked ids', async () => {
    const remotePost = {
      id: 'remote-post-like',
      category: 'recommended' as const,
      title: '点赞笔记',
      authorId: bootstrap.user.id,
      authorName: bootstrap.profile.nickname,
      authorAvatarKey: bootstrap.profile.avatarKey,
      imageKey: 'communityGrid',
      body: '点赞应写入后端。',
      date: '2026-08-02',
      likes: 0,
      likedByMe: false,
      comments: [],
      images: [{ id: 'cover', kind: 'asset' as const, assetKey: 'communityGrid' }],
      topics: ['调酒'],
      visibility: 'public' as const,
      allowComments: true,
    };
    mockAuthSnapshot = { status: 'signedIn', repository: mockRepository };
    mockRepository.listCommunityPosts.mockResolvedValueOnce({ items: [remotePost] });
    mockRepository.likeCommunityPost.mockResolvedValueOnce({ ...remotePost, likes: 1, likedByMe: true });
    mockRepository.unlikeCommunityPost.mockResolvedValueOnce(remotePost);
    const screen = await render(<MixologyProvider><Probe /></MixologyProvider>);
    await screen.findByText('hydrated');
    await waitFor(() => expect(currentValue?.interactionState.localCommunityPosts).toEqual([remotePost]));

    await act(async () => {
      await currentValue!.togglePostLike('remote-post-like');
    });

    expect(mockRepository.likeCommunityPost).toHaveBeenCalledWith('remote-post-like');
    expect(currentValue?.interactionState.localCommunityPosts[0]).toMatchObject({ likes: 1, likedByMe: true });
    expect(currentValue?.interactionState.likedPostIds).toEqual([]);

    await act(async () => {
      await currentValue!.togglePostLike('remote-post-like');
    });

    expect(mockRepository.unlikeCommunityPost).toHaveBeenCalledWith('remote-post-like');
    expect(currentValue?.interactionState.localCommunityPosts[0]).toMatchObject({ likes: 0, likedByMe: false });
    expect(currentValue?.interactionState.likedPostIds).toEqual([]);
    await expect(AsyncStorage.getItem('beiyu.interactions')).resolves.toBeNull();
  });

  it('uses backend likes for signed-in community comments', async () => {
    const remoteComment = {
      id: 'remote-comment-like',
      authorName: bootstrap.profile.nickname,
      authorAvatarKey: bootstrap.profile.avatarKey,
      text: '评论也可以点赞',
      date: '2026-08-02',
      likes: 0,
      likedByMe: false,
    };
    const likedComment = { ...remoteComment, likes: 1, likedByMe: true };
    const remotePost = {
      id: 'remote-post-comment-like',
      category: 'recommended' as const,
      title: '评论点赞笔记',
      authorId: bootstrap.user.id,
      authorName: bootstrap.profile.nickname,
      authorAvatarKey: bootstrap.profile.avatarKey,
      imageKey: 'communityGrid',
      body: '评论点赞应写入后端。',
      date: '2026-08-02',
      likes: 0,
      likedByMe: false,
      comments: [remoteComment],
      images: [{ id: 'cover', kind: 'asset' as const, assetKey: 'communityGrid' }],
      topics: ['调酒'],
      visibility: 'public' as const,
      allowComments: true,
    };
    mockAuthSnapshot = { status: 'signedIn', repository: mockRepository };
    mockRepository.listCommunityPosts.mockResolvedValueOnce({ items: [remotePost] });
    mockRepository.likeCommunityComment.mockResolvedValueOnce(likedComment);
    mockRepository.unlikeCommunityComment.mockResolvedValueOnce(remoteComment);
    const screen = await render(<MixologyProvider><Probe /></MixologyProvider>);
    await screen.findByText('hydrated');
    await waitFor(() => expect(currentValue?.interactionState.localCommunityPosts).toEqual([remotePost]));

    await act(async () => {
      await currentValue!.toggleCommentLike('remote-post-comment-like', 'remote-comment-like');
    });

    expect(mockRepository.likeCommunityComment).toHaveBeenCalledWith('remote-comment-like');
    expect(currentValue?.interactionState.localCommunityPosts[0].comments[0]).toMatchObject({ likes: 1, likedByMe: true });

    await act(async () => {
      await currentValue!.toggleCommentLike('remote-post-comment-like', 'remote-comment-like');
    });

    expect(mockRepository.unlikeCommunityComment).toHaveBeenCalledWith('remote-comment-like');
    expect(currentValue?.interactionState.localCommunityPosts[0].comments[0]).toMatchObject({ likes: 0, likedByMe: false });
  });

  it('deletes signed-in community posts from the backend cache', async () => {
    const remotePost = {
      id: 'remote-post-delete',
      category: 'recommended' as const,
      title: '待删除笔记',
      authorId: bootstrap.user.id,
      authorName: bootstrap.profile.nickname,
      authorAvatarKey: bootstrap.profile.avatarKey,
      imageKey: 'communityGrid',
      body: '删除应写入后端。',
      date: '2026-08-02',
      likes: 0,
      likedByMe: false,
      comments: [{ id: 'remote-comment-delete', authorName: '杯语用户', authorAvatarKey: 'avatarOne', text: '会一起删除', date: '2026-08-02', likes: 0 }],
      images: [{ id: 'cover', kind: 'asset' as const, assetKey: 'communityGrid' }],
      topics: ['调酒'],
      visibility: 'public' as const,
      allowComments: true,
    };
    mockAuthSnapshot = { status: 'signedIn', repository: mockRepository };
    mockRepository.listCommunityPosts.mockResolvedValueOnce({ items: [remotePost] });
    mockRepository.deleteCommunityPost.mockResolvedValueOnce(undefined);
    const screen = await render(<MixologyProvider><Probe /></MixologyProvider>);
    await screen.findByText('hydrated');
    await waitFor(() => expect(currentValue?.interactionState.localCommunityPosts).toEqual([remotePost]));

    await act(async () => {
      await currentValue!.deletePost('remote-post-delete');
    });

    expect(mockRepository.deleteCommunityPost).toHaveBeenCalledWith('remote-post-delete');
    expect(currentValue?.interactionState.localCommunityPosts).toEqual([]);
  });

  it('reports signed-in community posts and comments through the backend', async () => {
    const remoteComment = {
      id: 'remote-comment-report',
      authorName: '杯语用户',
      authorAvatarKey: 'avatarOne',
      text: '待举报评论',
      date: '2026-08-02',
      likes: 0,
      likedByMe: false,
    };
    const remotePost = {
      id: 'remote-post-report',
      category: 'recommended' as const,
      title: '待举报笔记',
      authorId: bootstrap.user.id,
      authorName: bootstrap.profile.nickname,
      authorAvatarKey: bootstrap.profile.avatarKey,
      imageKey: 'communityGrid',
      body: '举报应写入后端。',
      date: '2026-08-02',
      likes: 0,
      likedByMe: false,
      comments: [remoteComment],
      images: [{ id: 'cover', kind: 'asset' as const, assetKey: 'communityGrid' }],
      topics: ['调酒'],
      visibility: 'public' as const,
      allowComments: true,
    };
    mockAuthSnapshot = { status: 'signedIn', repository: mockRepository };
    mockRepository.listCommunityPosts.mockResolvedValueOnce({ items: [remotePost] });
    mockRepository.reportCommunityPost.mockResolvedValueOnce({
      id: 'report-post-1',
      reporterId: bootstrap.user.id,
      targetType: 'post',
      postId: 'remote-post-report',
      reason: 'inappropriate',
      detail: '',
      status: 'open',
      createdAt: '2026-08-02T00:00:00.000Z',
    });
    mockRepository.reportCommunityComment.mockResolvedValueOnce({
      id: 'report-comment-1',
      reporterId: bootstrap.user.id,
      targetType: 'comment',
      commentId: 'remote-comment-report',
      reason: 'inappropriate',
      detail: '',
      status: 'open',
      createdAt: '2026-08-02T00:00:00.000Z',
    });
    const screen = await render(<MixologyProvider><Probe /></MixologyProvider>);
    await screen.findByText('hydrated');
    await waitFor(() => expect(currentValue?.interactionState.localCommunityPosts).toEqual([remotePost]));

    await act(async () => {
      await currentValue!.reportPost('remote-post-report');
      await currentValue!.reportComment('remote-post-report', 'remote-comment-report');
    });

    expect(mockRepository.reportCommunityPost).toHaveBeenCalledWith('remote-post-report', { reason: 'inappropriate' });
    expect(mockRepository.reportCommunityComment).toHaveBeenCalledWith('remote-comment-report', { reason: 'inappropriate' });
  });

  it('rejects reports before sign-in', async () => {
    const screen = await render(<MixologyProvider><Probe /></MixologyProvider>);
    await screen.findByText('hydrated');

    await act(async () => {
      await expect(currentValue!.reportPost('local-post')).rejects.toThrow('请先登录后举报');
      await expect(currentValue!.reportComment('local-post', 'local-comment')).rejects.toThrow('请先登录后举报');
    });
    expect(mockRepository.reportCommunityPost).not.toHaveBeenCalled();
    expect(mockRepository.reportCommunityComment).not.toHaveBeenCalled();
  });
});
