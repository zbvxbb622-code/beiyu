import { fireEvent, render } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import CommunityScreen from '@/app/community';

const mockRouterNavigate = jest.fn();
const mockRouterPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    navigate: mockRouterNavigate,
    push: mockRouterPush,
  }),
}));

jest.mock('@/state/MixologyState', () => ({
  useMixology: () => ({
    interactionState: {
      likedPostIds: [],
    },
    togglePostLike: jest.fn(),
  }),
}));

describe('CommunityScreen', () => {
  beforeEach(() => {
    mockRouterNavigate.mockClear();
    mockRouterPush.mockClear();
  });

  it('uses the design feed tabs 推荐/关注/附近', async () => {
    const screen = await render(<CommunityScreen />);

    expect(screen.getByText('推荐')).toBeTruthy();
    expect(screen.getByText('关注')).toBeTruthy();
    expect(screen.getByText('附近')).toBeTruthy();
    expect(screen.queryByText('发现')).toBeNull();
    expect(screen.queryByText('调酒')).toBeNull();
  });

  it('opens the publish screen from a header compose button', async () => {
    const screen = await render(<CommunityScreen />);

    fireEvent.press(screen.getByTestId('community-publish-button'));

    expect(mockRouterPush).toHaveBeenCalledWith('/publish-post');
  });
});
