import { render } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';

import CommunityScreen from '@/app/community';

jest.mock('@/state/MixologyState', () => ({
  useMixology: () => ({
    interactionState: {
      likedPostIds: [],
    },
    togglePostLike: jest.fn(),
  }),
}));

describe('CommunityScreen', () => {
  it('uses focused community tabs without the extra mixology tab', async () => {
    const screen = await render(<CommunityScreen />);

    expect(screen.getByText('关注')).toBeTruthy();
    expect(screen.getByText('发现')).toBeTruthy();
    expect(screen.getByText('附近')).toBeTruthy();
    expect(screen.queryByText('调酒')).toBeNull();
    expect(screen.queryByText('上海')).toBeNull();
  });
});
