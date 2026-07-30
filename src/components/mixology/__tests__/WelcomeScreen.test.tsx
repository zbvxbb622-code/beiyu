import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { WelcomeScreen } from '@/components/mixology/WelcomeScreen';

const mockReplace = jest.fn();
const mockVerifyAge = jest.fn<() => Promise<void>>();

jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, push: jest.fn() }) }));
jest.mock('@/state/MixologyState', () => ({ useMixology: () => ({ verifyAge: mockVerifyAge }) }));

describe('WelcomeScreen', () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockVerifyAge.mockReset();
    mockVerifyAge.mockResolvedValue(undefined);
  });

  it('saves first-run age consent and routes to login without claiming guests can skip', async () => {
    const screen = await render(<WelcomeScreen />);

    expect(screen.queryByText(/游客可跳过/)).toBeNull();
    await fireEvent.press(screen.getByTestId('welcome-age-consent'));

    expect(mockVerifyAge).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith('/login');
  });

  it('shows a retryable error instead of leaking a rejected age confirmation', async () => {
    mockVerifyAge.mockRejectedValueOnce(new Error('offline'));
    const screen = await render(<WelcomeScreen />);

    await fireEvent.press(screen.getByTestId('welcome-age-consent'));

    await waitFor(() => expect(screen.getByText('验证失败，请重试')).toBeTruthy());
    expect(mockReplace).not.toHaveBeenCalledWith('/login');
  });
});
