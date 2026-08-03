import { fireEvent, render, waitFor, userEvent } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import EditProfileScreen from '@/app/edit-profile';

const mockRouterReplace = jest.fn();
const mockUpdateUserProfile = jest.fn(() => Promise.resolve());

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: mockRouterReplace,
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

describe('EditProfileScreen', () => {
  beforeEach(() => {
    mockRouterReplace.mockClear();
    mockUpdateUserProfile.mockReset();
    mockUpdateUserProfile.mockResolvedValue(undefined);
  });

  it('edits nickname/city and saves profile then goes back', async () => {
    const screen = await render(<EditProfileScreen />);

    const user = userEvent.setup();

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

    // React 19：等 dirty 状态刷新、保存按钮解禁后再点
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
      })
    );
    expect(mockRouterReplace).toHaveBeenCalledWith('/profile');
  });

  it('keeps the edited draft visible and offers retry when remote saving fails', async () => {
    mockUpdateUserProfile.mockRejectedValueOnce(new Error('offline'));
    const screen = await render(<EditProfileScreen />);

    fireEvent.changeText(screen.getByTestId('nickname-input'), '未保存的杯友');
    await waitFor(() => {
      expect(screen.getByTestId('edit-save-button').props.accessibilityState?.disabled).toBe(false);
    });
    await fireEvent.press(screen.getByTestId('edit-save-button'));

    await waitFor(() => {
      expect(screen.getByText('保存失败，请重试')).toBeTruthy();
    });
    expect(screen.getByTestId('nickname-input').props.value).toBe('未保存的杯友');
    expect(mockRouterReplace).not.toHaveBeenCalledWith('/profile');
  });
});
