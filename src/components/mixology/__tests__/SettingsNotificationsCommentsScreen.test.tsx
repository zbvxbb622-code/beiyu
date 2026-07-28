import { fireEvent, render } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';

import SettingsNotificationsCommentsScreen from '@/app/settings-notifications-comments';

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
};

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
}));

describe('SettingsNotificationsCommentsScreen', () => {
  it('renders title and section label', async () => {
    const screen = await render(<SettingsNotificationsCommentsScreen />);

    expect(screen.getByText('评论')).toBeTruthy();
    expect(screen.getByText('评论通知')).toBeTruthy();
    expect(screen.getByText('可能打扰的评论管理')).toBeTruthy();
    expect(screen.getByText('过滤可能打扰的评论通知')).toBeTruthy();
  });

  it('returns to notifications on back', async () => {
    const screen = await render(<SettingsNotificationsCommentsScreen />);

    await fireEvent.press(screen.getByTestId('settings-notifications-comments-back-button'));

    expect(mockRouter.replace).toHaveBeenCalledWith('/settings-notifications');
  });

  it('toggles the comment notify row on press', async () => {
    const screen = await render(<SettingsNotificationsCommentsScreen />);

    await fireEvent.press(screen.getByTestId('comments-notify'));
    await fireEvent.press(screen.getByTestId('comments-filter'));

    expect(screen.getByTestId('comments-notify')).toBeTruthy();
    expect(screen.getByTestId('comments-filter')).toBeTruthy();
  });
});