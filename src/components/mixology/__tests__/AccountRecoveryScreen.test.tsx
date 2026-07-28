import { fireEvent, render } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';

import AccountRecoveryScreen from '@/app/account-recovery';
import { defaultAccountSecurity } from '@/services/storageService';

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
};

const mockAccountSecurity = { ...defaultAccountSecurity };

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
}));

jest.mock('@/state/MixologyState', () => ({
  useMixology: () => ({
    accountSecurity: mockAccountSecurity,
  }),
}));

describe('AccountRecoveryScreen', () => {
  it('shows recovery steps and sends a code', async () => {
    const screen = await render(<AccountRecoveryScreen />);

    expect(screen.getByText('账号找回')).toBeTruthy();
    expect(screen.getByText('找回步骤')).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('recovery-account-input'), '13800001234');
    await fireEvent.press(screen.getByTestId('recovery-send'));

    expect(screen.getByText('验证码已发送至 13800001234，请查收。')).toBeTruthy();
  });

  it('returns to account-security on back', async () => {
    const screen = await render(<AccountRecoveryScreen />);

    await fireEvent.press(screen.getByTestId('recovery-back-button'));

    expect(mockRouter.replace).toHaveBeenCalledWith('/account-security');
  });
});
