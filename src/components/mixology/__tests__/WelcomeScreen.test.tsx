import { fireEvent, render } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { WelcomeScreen } from '@/components/mixology/WelcomeScreen';

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockVerifyAge = jest.fn<() => Promise<void>>();

jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, push: mockPush }) }));
jest.mock('@/state/MixologyState', () => ({ useMixology: () => ({ verifyAge: mockVerifyAge }) }));

describe('WelcomeScreen', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockReplace.mockClear();
    mockVerifyAge.mockReset();
    mockVerifyAge.mockResolvedValue(undefined);
  });

  it('routes first-run age consent into realname age verification before phone login', async () => {
    const screen = await render(<WelcomeScreen />);

    expect(screen.queryByText(/游客可跳过/)).toBeNull();
    expect(screen.queryByText('已有账号，手机号登录')).toBeNull();
    await fireEvent.press(screen.getByTestId('welcome-age-consent'));

    expect(mockVerifyAge).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/realname-verify',
      params: { purpose: 'age-gate', next: '/login' },
    });
    expect(mockReplace).not.toHaveBeenCalledWith('/login');
  });

  it('routes the header shortcut through the same realname age check', async () => {
    const screen = await render(<WelcomeScreen />);

    await fireEvent.press(screen.getByTestId('welcome-realname-shortcut'));

    expect(mockVerifyAge).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/realname-verify',
      params: { purpose: 'age-gate', next: '/login' },
    });
  });
});
