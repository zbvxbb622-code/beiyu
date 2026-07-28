import { fireEvent, render } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';

import SettingsNotificationsMessagesScreen from '@/app/settings-notifications-messages';

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
};

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
}));

describe('SettingsNotificationsMessagesScreen', () => {
  it('renders title and all 3 rows from the prototype', async () => {
    const screen = await render(<SettingsNotificationsMessagesScreen />);

    expect(screen.getByText('私信')).toBeTruthy();
    expect(screen.getByText('私聊')).toBeTruthy();
    expect(screen.getByText('群聊')).toBeTruthy();
    expect(screen.getByText('陌生人')).toBeTruthy();
  });

  it('returns to notifications on back', async () => {
    const screen = await render(<SettingsNotificationsMessagesScreen />);

    await fireEvent.press(screen.getByTestId('settings-notifications-messages-back-button'));

    expect(mockRouter.replace).toHaveBeenCalledWith('/settings-notifications');
  });

  it('toggles each row on press', async () => {
    const screen = await render(<SettingsNotificationsMessagesScreen />);

    await fireEvent.press(screen.getByTestId('messages-private'));
    await fireEvent.press(screen.getByTestId('messages-group'));
    await fireEvent.press(screen.getByTestId('messages-strangers'));

    expect(screen.getByTestId('messages-private')).toBeTruthy();
    expect(screen.getByTestId('messages-group')).toBeTruthy();
    expect(screen.getByTestId('messages-strangers')).toBeTruthy();
  });
});