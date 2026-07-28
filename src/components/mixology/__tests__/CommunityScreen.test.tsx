import { render } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';

import CommunityScreen from '@/app/community';

jest.mock('expo-router', () => ({
  useRouter: () => ({
    navigate: jest.fn(),
    push: jest.fn(),
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
  it('uses the design feed tabs 推荐/关注/附近', async () => {
    const screen = await render(<CommunityScreen />);

    expect(screen.getByText('推荐')).toBeTruthy();
    expect(screen.getByText('关注')).toBeTruthy();
    expect(screen.getByText('附近')).toBeTruthy();
    expect(screen.queryByText('发现')).toBeNull();
    expect(screen.queryByText('调酒')).toBeNull();
  });
});
