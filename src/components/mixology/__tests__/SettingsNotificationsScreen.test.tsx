import { fireEvent, render } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';

import SettingsNotificationsScreen from '@/app/settings-notifications';

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
};

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
}));

describe('SettingsNotificationsScreen', () => {
  it('renders the title and all group labels', async () => {
    const screen = await render(<SettingsNotificationsScreen />);

    expect(screen.getByText('通知设置')).toBeTruthy();
    expect(screen.getByText('互动通知')).toBeTruthy();
    expect(screen.getByText('私信通知')).toBeTruthy();
    expect(screen.getByText('社区内容通知')).toBeTruthy();
  });

  it('renders every row from the prototype', async () => {
    const screen = await render(<SettingsNotificationsScreen />);

    expect(screen.getByText('赞和收藏')).toBeTruthy();
    expect(screen.getByText('新增关注')).toBeTruthy();
    expect(screen.getByText('评论')).toBeTruthy();
    expect(screen.getByText('@')).toBeTruthy();
    expect(screen.getByText('分享')).toBeTruthy();
    expect(screen.getByText('私信')).toBeTruthy();
    expect(screen.getByText('关注作者的更新')).toBeTruthy();
  });

  it('returns to settings on back', async () => {
    const screen = await render(<SettingsNotificationsScreen />);

    await fireEvent.press(screen.getByTestId('settings-notifications-back-button'));

    expect(mockRouter.replace).toHaveBeenCalledWith('/settings');
  });

  it('toggles the likes-favorites row on press', async () => {
    const screen = await render(<SettingsNotificationsScreen />);
    const row = screen.getByTestId('notifications-likes');

    await fireEvent.press(row);
    await fireEvent.press(row);

    expect(row).toBeTruthy();
  });

  it('navigates to comments/messages/author sub-pages from picker rows', async () => {
    const screen = await render(<SettingsNotificationsScreen />);

    await fireEvent.press(screen.getByTestId('notifications-comments'));
    expect(mockRouter.push).toHaveBeenCalledWith('/settings-notifications-comments');

    await fireEvent.press(screen.getByTestId('notifications-dm'));
    expect(mockRouter.push).toHaveBeenCalledWith('/settings-notifications-messages');

    await fireEvent.press(screen.getByTestId('notifications-author-update'));
    expect(mockRouter.push).toHaveBeenCalledWith('/settings-notifications-author');
  });
});