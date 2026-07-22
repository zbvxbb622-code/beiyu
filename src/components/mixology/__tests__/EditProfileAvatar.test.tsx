import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';

import EditProfileScreen from '@/app/edit-profile';

const mockUpdateUserProfile = jest.fn(() => Promise.resolve());

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
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
    },
    updateUserProfile: mockUpdateUserProfile,
  }),
}));

jest.mock('@/services/avatarPickerService', () => ({
  pickAvatarFromLibrary: () => Promise.resolve(null),
}));

describe('EditProfileScreen avatar selection', () => {
  it('selecting a preset avatar saves it and clears custom uri', async () => {
    const screen = await render(<EditProfileScreen />);

    fireEvent.press(screen.getByTestId('preset-avatar-avatarTwo'));

    // React 19：等 dirty 状态刷新、保存按钮解禁后再点
    await waitFor(() => {
      expect(screen.getByTestId('edit-save-button').props.accessibilityState?.disabled).toBe(false);
    });
    fireEvent.press(screen.getByTestId('edit-save-button'));

    await waitFor(() => {
      expect(mockUpdateUserProfile).toHaveBeenCalledTimes(1);
    });
    expect(mockUpdateUserProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        avatarKey: 'avatarTwo',
        avatarUri: null,
      })
    );
  });
});
