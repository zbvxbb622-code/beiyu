import { render, waitFor, userEvent } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';

import EditProfileScreen from '@/app/edit-profile';

const mockRouterBack = jest.fn();
const mockUpdateUserProfile = jest.fn(() => Promise.resolve());

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: mockRouterBack,
  }),
}));

jest.mock('@/state/MixologyState', () => ({
  useMixology: () => ({
    userProfile: {
      nickname: '游客调酒师',
      avatarKey: 'avatarOne',
      avatarUri: null,
      signature: '',
      city: '',
      gender: null,
      birthday: '1995-06-01',
      showBirthdayTag: true,
      showAge: true,
      showZodiac: false,
    },
    updateUserProfile: mockUpdateUserProfile,
  }),
}));

describe('EditProfileScreen birthday editor inline', () => {
  it('opens inline birthday editor from birthday row', async () => {
    const screen = await render(<EditProfileScreen />);
    const user = userEvent.setup();

    await user.press(screen.getByTestId('birthday-row'));
    await waitFor(() => {
      expect(screen.getByTestId('birthday-editor-modal')).toBeTruthy();
      expect(screen.getByText('编辑生日')).toBeTruthy();
      expect(screen.getByTestId('birthday-info-row')).toBeTruthy();
    });
  });

  it('toggles display switches and updates preview', async () => {
    const screen = await render(<EditProfileScreen />);
    const user = userEvent.setup();

    await user.press(screen.getByTestId('birthday-row'));
    await waitFor(() => {
      expect(screen.getByTestId('birthday-editor-modal')).toBeTruthy();
    });

    await user.press(screen.getByTestId('toggle-show-zodiac'));
    await waitFor(() => {
      expect(screen.getByText('双子座')).toBeTruthy();
    });

    await user.press(screen.getByTestId('toggle-show-age'));
    await waitFor(() => {
      expect(screen.queryByText(/\d+岁/)).toBeNull();
    });
  });

  it('opens date picker inside inline editor and can cancel', async () => {
    const screen = await render(<EditProfileScreen />);
    const user = userEvent.setup();

    await user.press(screen.getByTestId('birthday-row'));
    await waitFor(() => {
      expect(screen.getByTestId('birthday-editor-modal')).toBeTruthy();
    });

    await user.press(screen.getByTestId('birthday-info-row'));
    await waitFor(() => {
      expect(screen.getByTestId('birthday-picker-modal')).toBeTruthy();
      expect(screen.getByText('选择你的生日')).toBeTruthy();
    });

    await user.press(screen.getByTestId('birthday-picker-cancel'));
    await waitFor(() => {
      expect(screen.queryByTestId('birthday-picker-modal')).toBeNull();
    });
  });

  it('closes inline editor with save button', async () => {
    const screen = await render(<EditProfileScreen />);
    const user = userEvent.setup();

    await user.press(screen.getByTestId('birthday-row'));
    await waitFor(() => {
      expect(screen.getByTestId('birthday-editor-modal')).toBeTruthy();
    });

    await user.press(screen.getByTestId('birthday-editor-save'));
    await waitFor(() => {
      expect(screen.queryByTestId('birthday-editor-modal')).toBeNull();
    });
  });
});
