import { fireEvent, render } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';

import RealnameVerifyScreen from '@/app/realname-verify';
import { defaultAccountSecurity } from '@/services/storageService';
import type { AccountSecurity } from '@/types/mixology';

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
};

const mockVerifyRealname = jest.fn();

// 可变账户状态，便于在单测间切换「未认证 / 已认证」
let mockAccountSecurity: AccountSecurity = { ...defaultAccountSecurity };

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
}));

jest.mock('@/state/MixologyState', () => ({
  useMixology: () => ({
    accountSecurity: mockAccountSecurity,
    verifyRealname: mockVerifyRealname,
  }),
}));

describe('RealnameVerifyScreen', () => {
  it('submits realname verification', async () => {
    mockAccountSecurity = { ...defaultAccountSecurity };
    const screen = await render(<RealnameVerifyScreen />);

    expect(screen.getByText('实名认证')).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('realname-input'), '张三');
    await fireEvent.changeText(screen.getByTestId('realname-id-input'), '110101199001011234');
    await fireEvent.press(screen.getByTestId('realname-submit'));

    expect(mockVerifyRealname).toHaveBeenCalledWith('张三');
  });

  it('shows verified state when already verified', async () => {
    mockAccountSecurity = {
      ...defaultAccountSecurity,
      realnameVerified: true,
      realnameName: '李四',
    };
    const screen = await render(<RealnameVerifyScreen />);

    expect(screen.getByText('已通过实名认证')).toBeTruthy();
    expect(screen.getByText('李四')).toBeTruthy();
  });

  it('returns to account-security on back', async () => {
    mockAccountSecurity = { ...defaultAccountSecurity };
    const screen = await render(<RealnameVerifyScreen />);

    await fireEvent.press(screen.getByTestId('realname-back-button'));

    expect(mockRouter.replace).toHaveBeenCalledWith('/account-security');
  });
});
