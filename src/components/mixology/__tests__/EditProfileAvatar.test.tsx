import { fireEvent, render, waitFor, userEvent } from '@testing-library/react-native';
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
      gender: null,
      birthday: null,
      occupation: null,
      school: null,
    },
    updateUserProfile: mockUpdateUserProfile,
  }),
}));

jest.mock('@/services/avatarPickerService', () => ({
  pickAvatarFromLibrary: () => Promise.resolve(null),
}));

describe('EditProfileScreen avatar selection', () => {
  it('keeps default avatar when upload is cancelled, then saves edited profile', async () => {
    const screen = await render(<EditProfileScreen />);

    const user = userEvent.setup();

    // 点击头像/背景图行，由于 mock 返回 null，头像不会真正改变
    await user.press(screen.getByTestId('upload-avatar-button'));

    // 修改昵称和城市让保存按钮可用
    fireEvent.changeText(screen.getByTestId('nickname-input'), '霓虹酒保');
    await user.press(screen.getByTestId('region-row'));
    await waitFor(() => {
      expect(screen.getByTestId('region-option-上海')).toBeTruthy();
    });
    // 上海有区县数据 → 进入二级选区
    await user.press(screen.getByTestId('region-option-上海'));
    await waitFor(() => {
      expect(screen.getByTestId('region-option-青浦区')).toBeTruthy();
    });
    await user.press(screen.getByTestId('region-option-青浦区'));
    await waitFor(() => {
      expect(screen.getByText('上海·青浦区')).toBeTruthy();
    });

    await waitFor(() => {
      expect(screen.getByTestId('edit-save-button').props.accessibilityState?.disabled).toBe(false);
    });
    await user.press(screen.getByTestId('edit-save-button'));

    await waitFor(() => {
      expect(mockUpdateUserProfile).toHaveBeenCalledTimes(1);
    });
    expect(mockUpdateUserProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        nickname: '霓虹酒保',
        city: '上海·青浦区',
        avatarKey: 'avatarOne',
        avatarUri: null,
      })
    );
  });
});
