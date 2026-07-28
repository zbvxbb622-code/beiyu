import { fireEvent, render } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';

import SettingsScreen from '@/app/settings';

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
};

const mockLogout = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
}));

jest.mock('@/state/MixologyState', () => ({
  useMixology: () => ({
    logout: mockLogout,
  }),
}));

describe('SettingsScreen', () => {
  it('renders header and all settings groups', async () => {
    const screen = await render(<SettingsScreen />);

    expect(screen.getByText('设置')).toBeTruthy();
    expect(screen.getByTestId('settings-back-button')).toBeTruthy();

    // Group 1
    expect(screen.getByText('账号与安全')).toBeTruthy();
    expect(screen.getByText('通用设置')).toBeTruthy();
    expect(screen.getByText('通知设置')).toBeTruthy();
    expect(screen.getByText('多语言和翻译')).toBeTruthy();
    expect(screen.getByText('隐私设置')).toBeTruthy();

    // Group 2
    expect(screen.getByText('帮助与客服')).toBeTruthy();
  });

  it('navigates to account security from account security entry', async () => {
    const screen = await render(<SettingsScreen />);

    await fireEvent.press(screen.getByTestId('settings-account-security'));

    expect(mockRouter.push).toHaveBeenCalledWith('/account-security');
  });

  it('switches account via the bottom action', async () => {
    const screen = await render(<SettingsScreen />);

    await fireEvent.press(screen.getByTestId('settings-switch-account'));

    expect(mockRouter.push).toHaveBeenCalledWith('/login');
  });

  it('logs out via the logout button', async () => {
    const screen = await render(<SettingsScreen />);

    expect(screen.getByTestId('settings-logout-button')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('settings-logout-button'));

    expect(mockLogout).toHaveBeenCalled();
    expect(mockRouter.replace).toHaveBeenCalledWith('/');
  });

  it('returns to profile on back', async () => {
    const screen = await render(<SettingsScreen />);

    await fireEvent.press(screen.getByTestId('settings-back-button'));

    expect(mockRouter.replace).toHaveBeenCalledWith('/profile');
  });

  it('navigates to general settings from the general entry', async () => {
    const screen = await render(<SettingsScreen />);

    await fireEvent.press(screen.getByTestId('settings-general'));

    expect(mockRouter.push).toHaveBeenCalledWith('/settings-general');
  });

  it('navigates to notifications from the notifications entry', async () => {
    const screen = await render(<SettingsScreen />);

    await fireEvent.press(screen.getByTestId('settings-notifications'));

    expect(mockRouter.push).toHaveBeenCalledWith('/settings-notifications');
  });

  it('navigates to language from the language entry', async () => {
    const screen = await render(<SettingsScreen />);

    await fireEvent.press(screen.getByTestId('settings-language'));

    expect(mockRouter.push).toHaveBeenCalledWith('/settings-language');
  });

  it('navigates to privacy from the privacy entry', async () => {
    const screen = await render(<SettingsScreen />);

    await fireEvent.press(screen.getByTestId('settings-privacy'));

    expect(mockRouter.push).toHaveBeenCalledWith('/settings-privacy');
  });
});
