import { fireEvent, render } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';

import AccountSecurityScreen from '@/app/account-security';
import { defaultAccountSecurity } from '@/services/storageService';

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
};

const mockSetPhone = jest.fn();
const mockSetPassword = jest.fn();
const mockBindWechat = jest.fn();
const mockUnbindWechat = jest.fn();
const mockDeleteAccount = jest.fn();
const mockAccountSecurity = { ...defaultAccountSecurity };

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
}));

jest.mock('@/state/MixologyState', () => ({
  useMixology: () => ({
    accountSecurity: mockAccountSecurity,
    setPhone: mockSetPhone,
    setPassword: mockSetPassword,
    bindWechat: mockBindWechat,
    unbindWechat: mockUnbindWechat,
    deleteAccount: mockDeleteAccount,
  }),
}));

describe('AccountSecurityScreen', () => {
  it('renders header and all security rows (no Weibo / Pro rows)', async () => {
    const screen = await render(<AccountSecurityScreen />);

    expect(screen.getByText('账号与安全')).toBeTruthy();
    expect(screen.getByTestId('account-security-back-button')).toBeTruthy();

    // Group 1: credentials
    expect(screen.getByText('手机号')).toBeTruthy();
    expect(screen.getByText('+86190****9105')).toBeTruthy();
    expect(screen.getByText('登录密码')).toBeTruthy();

    // Group 2: third-party accounts (Weibo removed)
    expect(screen.getByText('微信账号')).toBeTruthy();
    expect(screen.queryByText('微博账号')).toBeNull();

    // Group 3: verification
    expect(screen.getByText('实名认证')).toBeTruthy();
    expect(screen.getByText('官方认证')).toBeTruthy();

    // Group 4-6 (Pro removed)
    expect(screen.getByText('登录设备管理')).toBeTruthy();
    expect(screen.getByText('账号找回')).toBeTruthy();
    expect(screen.getByText('注销账号')).toBeTruthy();
    expect(screen.queryByText('专业号')).toBeNull();
  });

  it('shows logged-in device count', async () => {
    const screen = await render(<AccountSecurityScreen />);
    expect(screen.getByText('2 台')).toBeTruthy();
  });

  it('navigates to available sub pages and keeps official verification closed', async () => {
    const screen = await render(<AccountSecurityScreen />);

    await fireEvent.press(screen.getByTestId('account-security-realname'));
    expect(mockRouter.push).toHaveBeenCalledWith('/realname-verify');

    await fireEvent.press(screen.getByTestId('account-security-official'));
    expect(mockRouter.push).not.toHaveBeenCalledWith('/official-verify');
    expect(screen.getByText('暂未开放')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('account-security-devices'));
    expect(mockRouter.push).toHaveBeenCalledWith('/device-management');

    await fireEvent.press(screen.getByTestId('account-security-recovery'));
    expect(mockRouter.push).toHaveBeenCalledWith('/account-recovery');
  });

  it('opens phone sheet and saves a new phone', async () => {
    const screen = await render(<AccountSecurityScreen />);

    await fireEvent.press(screen.getByTestId('account-security-phone'));
    const input = screen.getByTestId('phone-input');
    await fireEvent.changeText(input, '13800001234');
    await fireEvent.press(screen.getByTestId('phone-confirm'));

    expect(mockSetPhone).toHaveBeenCalledWith('13800001234');
  });

  it('binds WeChat from the WeChat sheet', async () => {
    const screen = await render(<AccountSecurityScreen />);

    await fireEvent.press(screen.getByTestId('account-security-wechat'));
    await fireEvent.press(screen.getByTestId('wechat-bind'));

    expect(mockBindWechat).toHaveBeenCalled();
  });

  it('deletes account and returns to welcome', async () => {
    const screen = await render(<AccountSecurityScreen />);

    await fireEvent.press(screen.getByTestId('account-security-delete'));
    await fireEvent.press(screen.getByTestId('delete-confirm'));

    expect(mockDeleteAccount).toHaveBeenCalled();
    expect(mockRouter.replace).toHaveBeenCalledWith('/');
  });

  it('returns to settings on back', async () => {
    const screen = await render(<AccountSecurityScreen />);

    await fireEvent.press(screen.getByTestId('account-security-back-button'));

    expect(mockRouter.replace).toHaveBeenCalledWith('/settings');
  });
});
