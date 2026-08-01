import { fireEvent, render } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';

import ProfileScreen from '@/app/profile';

const mockRouter = {
  push: jest.fn(),
};

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
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
      localCommunityPosts: [],
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
  }),
}));

describe('ProfileScreen', () => {
  it('renders the redesigned profile: identity, stats, AI rec, tabs, settings button', async () => {
    const screen = await render(<ProfileScreen />);

    // 身份区
    expect(screen.getByText('霓虹酒保')).toBeTruthy();
    expect(screen.getByText('上海')).toBeTruthy();
    expect(screen.getByText('周五晚上只喝尼格罗尼')).toBeTruthy();
    // 统计行
    expect(screen.getByText('关注')).toBeTruthy();
    expect(screen.getByText('粉丝')).toBeTruthy();
    expect(screen.getByText('获赞与收藏')).toBeTruthy();
    // AI 推荐
    expect(screen.getByText('AI 调酒师')).toBeTruthy();
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
});
