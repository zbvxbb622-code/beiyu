import { fireEvent, render } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';

import { WelcomeScreen } from '@/components/mixology/WelcomeScreen';

const mockReplace = jest.fn();
const mockVerifyAge = jest.fn();

jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, push: jest.fn() }) }));
jest.mock('@/state/MixologyState', () => ({ useMixology: () => ({ verifyAge: mockVerifyAge }) }));

describe('WelcomeScreen', () => {
  it('saves first-run age consent and routes to login without claiming guests can skip', async () => {
    const screen = await render(<WelcomeScreen />);

    expect(screen.queryByText(/游客可跳过/)).toBeNull();
    await fireEvent.press(screen.getByTestId('welcome-age-consent'));

    expect(mockVerifyAge).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith('/login');
  });
});
