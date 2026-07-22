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
  it('renders profile identity, tabs and panels', async () => {
    const screen = await render(<ProfileScreen />);

    // 小红书式资料区
    expect(screen.getByText('霓虹酒保')).toBeTruthy();
    expect(screen.getByText('上海')).toBeTruthy();
    expect(screen.getByText('周五晚上只喝尼格罗尼')).toBeTruthy();
    // 三 Tab（testID 断言，避免与统计行"笔记"重名）
    expect(screen.getByTestId('profile-tab-posts')).toBeTruthy();
    expect(screen.getByTestId('profile-tab-favorites')).toBeTruthy();
    expect(screen.getByTestId('profile-tab-liked')).toBeTruthy();
    // 我的酒卡 + 底部面板
    expect(screen.getByText('我的酒卡')).toBeTruthy();
    expect(screen.getByText('账号与安全')).toBeTruthy();
    expect(screen.getByText('隐私与安全')).toBeTruthy();
    expect(screen.getByText('本地数据保险箱')).toBeTruthy();
  });

  it('opens the private cellar from quick actions', async () => {
    const screen = await render(<ProfileScreen />);

    fireEvent.press(screen.getByTestId('profile-action-private-cellar'));

    expect(mockRouter.push).toHaveBeenCalledWith('/private-cellar');
  });

  it('navigates to edit profile page', async () => {
    const screen = await render(<ProfileScreen />);

    fireEvent.press(screen.getByTestId('edit-profile-button'));

    expect(mockRouter.push).toHaveBeenCalledWith('/edit-profile');
  });
});
