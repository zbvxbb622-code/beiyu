import { fireEvent, render } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Alert, StyleSheet } from 'react-native';

import ProfileScreen from '@/app/profile';

const mockRouter = {
  push: jest.fn(),
};
let mockAuthStatus = 'signedOut';
const mockDeletePost = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
let mockLocalCommunityPosts: unknown[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
}));

jest.mock('@/state/AuthState', () => ({
  useAuth: () => ({
    status: mockAuthStatus,
  }),
}));

jest.mock('@/state/MixologyState', () => ({
  useMixology: () => ({
    localState: {
      ageVerified: true,
      cellarIngredientIds: ['gin', 'lime', 'syrup'],
      privacySettings: {
        localOnlyMode: true,
        analyticsOptIn: false,
        syncWhenLoggedIn: false,
      },
    },
    interactionState: {
      likedPostIds: ['p1'],
      followedAuthorIds: ['a1', 'a2'],
      likedCellarCardIds: ['c1'],
      favoriteVenueIds: ['amor-fati'],
      localCommunityPosts: mockLocalCommunityPosts,
      localPostComments: {},
      searchHistory: [],
      lastDrawDate: null,
      drawnCards: [],
    },
    userProfile: {
      nickname: '霓虹酒保',
      avatarKey: 'avatarTwo',
      avatarUri: null,
      signature: '周五晚上只喝尼格罗尼',
      city: '上海',
    },
    updatePrivacySettings: jest.fn(),
    resetLocalState: jest.fn(),
    deletePost: mockDeletePost,
  }),
}));

describe('ProfileScreen', () => {
  beforeEach(() => {
    mockAuthStatus = 'signedOut';
    mockLocalCommunityPosts = [];
    mockDeletePost.mockClear();
    mockDeletePost.mockResolvedValue(undefined);
    mockRouter.push.mockClear();
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.style === 'destructive')?.onPress?.();
    });
  });

  it('renders the redesigned profile without the retired recommendation block', async () => {
    const screen = await render(<ProfileScreen />);

    // 身份区
    expect(screen.getByText('霓虹酒保')).toBeTruthy();
    expect(screen.getByText('上海')).toBeTruthy();
    expect(screen.getByText('周五晚上只喝尼格罗尼')).toBeTruthy();
    // 统计行
    expect(screen.getByText('关注')).toBeTruthy();
    expect(screen.getByText('粉丝')).toBeTruthy();
    expect(screen.getByText('获赞与收藏')).toBeTruthy();
    // 已下线的为你推荐模块
    expect(screen.queryByText('为你推荐')).toBeNull();
    expect(screen.queryByText('AI 调酒师')).toBeNull();
    // 三 Tab（testID 断言，避免与统计行重名）
    expect(screen.getByTestId('profile-tab-posts')).toBeTruthy();
    expect(screen.getByTestId('profile-tab-favorites')).toBeTruthy();
    expect(screen.getByTestId('profile-tab-liked')).toBeTruthy();
    // 我的酒卡
    expect(screen.getByText('我的酒卡')).toBeTruthy();
    // 设置已收成单个按钮（不再内联三个面板）
    expect(screen.getByTestId('profile-settings-button')).toBeTruthy();
    expect(screen.queryByText('账号与安全')).toBeNull();
    expect(screen.getByText('登录/注册')).toBeTruthy();
    expect(screen.queryByText(/Mock/)).toBeNull();
  });

  it('hides the login entry after the user is signed in', async () => {
    mockAuthStatus = 'signedIn';

    const screen = await render(<ProfileScreen />);

    expect(screen.queryByText('登录/注册')).toBeNull();
  });

  it('navigates to edit profile page', async () => {
    const screen = await render(<ProfileScreen />);

    await fireEvent.press(screen.getByTestId('edit-profile-button'));

    expect(mockRouter.push).toHaveBeenCalledWith('/edit-profile');
  });

  it('navigates to the settings screen from the single settings button', async () => {
    const screen = await render(<ProfileScreen />);

    await fireEvent.press(screen.getByTestId('profile-settings-button'));

    expect(mockRouter.push).toHaveBeenCalledWith('/settings');
  });

  it('deletes a post from the my posts tab after confirmation', async () => {
    mockLocalCommunityPosts = [
      {
        id: 'my-post-1',
        category: 'recommended',
        title: '我的第一篇笔记',
        authorId: 'user-1',
        authorName: '霓虹酒保',
        authorAvatarKey: 'avatarTwo',
        imageKey: 'mojito',
        body: '测试删除',
        date: '2026-08-02',
        likes: 0,
        comments: [],
      },
    ];
    const screen = await render(<ProfileScreen />);

    await fireEvent.press(screen.getByTestId('profile-delete-post-my-post-1'));

    expect(Alert.alert).toHaveBeenCalledWith('删除笔记', '删除后这条笔记会从我的主页和社区中移除。', expect.any(Array));
    expect(mockDeletePost).toHaveBeenCalledWith('my-post-1');
  });

  it('places the delete action beside the post title instead of over the image', async () => {
    mockLocalCommunityPosts = [
      {
        id: 'my-post-1',
        category: 'recommended',
        title: '我的第一篇笔记',
        authorId: 'user-1',
        authorName: '霓虹酒保',
        authorAvatarKey: 'avatarTwo',
        imageKey: 'mojito',
        body: '测试删除位置',
        date: '2026-08-02',
        likes: 0,
        comments: [],
      },
    ];
    const screen = await render(<ProfileScreen />);

    expect(screen.getByTestId('profile-post-title-row-my-post-1')).toBeTruthy();
    const deleteStyle = StyleSheet.flatten(screen.getByTestId('profile-delete-post-my-post-1').props.style);

    expect(deleteStyle.position).toBeUndefined();
  });

  it('opens my posts with a profile return source', async () => {
    mockLocalCommunityPosts = [
      {
        id: 'my-post-1',
        category: 'recommended',
        title: '我的第一篇笔记',
        authorId: 'user-1',
        authorName: '霓虹酒保',
        authorAvatarKey: 'avatarTwo',
        imageKey: 'mojito',
        body: '测试返回',
        date: '2026-08-02',
        likes: 0,
        comments: [],
      },
    ];
    const screen = await render(<ProfileScreen />);

    await fireEvent.press(screen.getByTestId('profile-post-card-my-post-1'));

    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/post/[id]',
      params: { id: 'my-post-1', from: 'profile' },
    });
  });
});
