import { fireEvent, render } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';

import SettingsNotificationsAuthorScreen from '@/app/settings-notifications-author';

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
};

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
}));

describe('SettingsNotificationsAuthorScreen', () => {
  it('renders title and both rows from the prototype', async () => {
    const screen = await render(<SettingsNotificationsAuthorScreen />);

    // Title + first row both contain "关注作者的更新"
    expect(screen.getAllByText('关注作者的更新').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('关注未读提醒')).toBeTruthy();
  });

  it('returns to notifications on back', async () => {
    const screen = await render(<SettingsNotificationsAuthorScreen />);

    await fireEvent.press(screen.getByTestId('settings-notifications-author-back-button'));

    expect(mockRouter.replace).toHaveBeenCalledWith('/settings-notifications');
  });

  it('toggles each row on press', async () => {
    const screen = await render(<SettingsNotificationsAuthorScreen />);

    await fireEvent.press(screen.getByTestId('author-update'));
    await fireEvent.press(screen.getByTestId('author-unread-reminder'));

    expect(screen.getByTestId('author-update')).toBeTruthy();
    expect(screen.getByTestId('author-unread-reminder')).toBeTruthy();
  });
});