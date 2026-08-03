import { render } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';

import { ProfileQuickActions } from '@/components/profile/ProfileQuickActions';

const mockRouter = {
  push: jest.fn(),
};

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
}));

describe('ProfileQuickActions', () => {
  it('keeps the retired shared cellar entry out of profile shortcuts', async () => {
    const screen = await render(<ProfileQuickActions />);

    expect(screen.queryByText('大家酒柜')).toBeNull();
    expect(screen.queryByText('共享酒柜')).toBeNull();
  });

  it('does not expose the retired personal cellar shortcut', async () => {
    const screen = await render(<ProfileQuickActions />);

    expect(screen.queryByText('我的酒柜')).toBeNull();
    expect(screen.queryByTestId('profile-action-private-cellar')).toBeNull();
  });
});
