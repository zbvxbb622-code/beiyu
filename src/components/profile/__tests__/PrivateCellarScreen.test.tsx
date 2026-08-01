import { fireEvent, render } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';

import PrivateCellarScreen from '@/app/private-cellar';

const mockRouter = {
  push: jest.fn(),
};

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
}));

jest.mock('@/state/MixologyState', () => ({
  useMixology: () => ({
    interactionState: {
      drawnCards: [],
    },
  }),
}));

jest.mock('@/components/mixology/ScreenShell', () => ({
  ScreenShell: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@/components/mixology/TopBar', () => ({
  TopBar: () => null,
}));

describe('PrivateCellarScreen', () => {
  it('shows an empty personal cellar instead of seeding shared cellar mock cards', async () => {
    const screen = await render(<PrivateCellarScreen />);

    expect(screen.getByTestId('private-cellar-empty-state')).toBeTruthy();
    expect(screen.queryByText('公开')).toBeNull();
  });

  it('opens blind box from the empty personal cellar state', async () => {
    const screen = await render(<PrivateCellarScreen />);

    fireEvent.press(screen.getByTestId('private-cellar-draw-link'));

    expect(mockRouter.push).toHaveBeenCalledWith('/blind-box');
  });
});
