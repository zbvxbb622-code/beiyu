import { fireEvent, render } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';

import OfficialVerifyScreen from '@/app/official-verify';
import { defaultAccountSecurity } from '@/services/storageService';
import type { AccountSecurity } from '@/types/mixology';

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
};

const mockVerifyOfficial = jest.fn();

let mockAccountSecurity: AccountSecurity = { ...defaultAccountSecurity };

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
}));

jest.mock('@/state/MixologyState', () => ({
  useMixology: () => ({
    accountSecurity: mockAccountSecurity,
    verifyOfficial: mockVerifyOfficial,
  }),
}));

describe('OfficialVerifyScreen', () => {
  it('submits the selected certification type', async () => {
    mockAccountSecurity = { ...defaultAccountSecurity };
    const screen = await render(<OfficialVerifyScreen />);

    expect(screen.getByText('官方认证')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('official-option-企业'));
    await fireEvent.press(screen.getByTestId('official-submit'));

    expect(mockVerifyOfficial).toHaveBeenCalledWith('企业');
  });

  it('shows verified state when already verified', async () => {
    mockAccountSecurity = {
      ...defaultAccountSecurity,
      officialVerified: true,
      officialType: '个人职业资质',
    };
    const screen = await render(<OfficialVerifyScreen />);

    expect(screen.getByText('已通过官方认证')).toBeTruthy();
    expect(screen.getByText('个人职业资质')).toBeTruthy();
  });

  it('returns to account-security on back', async () => {
    mockAccountSecurity = { ...defaultAccountSecurity };
    const screen = await render(<OfficialVerifyScreen />);

    await fireEvent.press(screen.getByTestId('official-back-button'));

    expect(mockRouter.replace).toHaveBeenCalledWith('/account-security');
  });
});
