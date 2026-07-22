import { fireEvent, render } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { TopBar } from '@/components/mixology/TopBar';

const mockRouter = {
  back: jest.fn(),
  replace: jest.fn(),
};

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
}));

describe('TopBar', () => {
  beforeEach(() => {
    mockRouter.back.mockClear();
    mockRouter.replace.mockClear();
  });

  it('returns to an explicit route when backHref is provided', async () => {
    const screen = await render(<TopBar title="详情" backHref="/community" />);

    fireEvent.press(screen.getByTestId('topbar-back-button'));

    expect(mockRouter.replace).toHaveBeenCalledWith('/community');
    expect(mockRouter.back).not.toHaveBeenCalled();
  });
});
