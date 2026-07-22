import { fireEvent, render, waitFor } from '@testing-library/react-native';
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
    },
    updateUserProfile: mockUpdateUserProfile,
  }),
}));

jest.mock('@/services/avatarPickerService', () => ({
  pickAvatarFromLibrary: () => Promise.resolve(null),
}));

describe('EditProfileScreen', () => {
  it('edits nickname/city and saves profile then goes back', async () => {
    const screen = await render(<EditProfileScreen />);

    fireEvent.changeText(screen.getByTestId('nickname-input'), '霓虹酒保');
    fireEvent.changeText(screen.getByTestId('city-input'), '上海');

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
        nickname: '霓虹酒保',
        city: '上海',
        avatarKey: 'avatarOne',
      })
    );
    expect(mockRouterBack).toHaveBeenCalled();
  });
});
