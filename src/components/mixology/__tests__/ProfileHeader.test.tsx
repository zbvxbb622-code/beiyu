import { render, userEvent, waitFor } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';

import { ProfileHeader } from '@/components/profile/ProfileHeader';

const mockProfile = {
  nickname: '游客调酒师',
  avatarKey: 'avatarOne',
  avatarUri: null,
  signature: '测试签名',
  city: '上海·青浦区',
  gender: null,
  birthday: null,
  showBirthdayTag: true,
  showAge: true,
  showZodiac: true,
  occupation: null,
  school: null,
};

const mockStats = {
  posts: 0,
  receivedLikes: 0,
  following: 12,
  fans: 34,
};

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
}));

describe('ProfileHeader', () => {
  it('opens share sheet when share button is pressed', async () => {
    const screen = await render(<ProfileHeader profile={mockProfile} stats={mockStats} />);
    const user = userEvent.setup();

    expect(screen.queryByTestId('share-sheet')).toBeNull();

    await user.press(screen.getByTestId('profile-share-button'));
    await waitFor(() => {
      expect(screen.getByTestId('share-sheet')).toBeTruthy();
    });

    expect(screen.getByText('分享至')).toBeTruthy();
    expect(screen.getByTestId('share-option-wechat')).toBeTruthy();
    expect(screen.getByTestId('share-option-moments')).toBeTruthy();
    expect(screen.getByTestId('share-option-qq')).toBeTruthy();
    expect(screen.getByTestId('share-option-qzone')).toBeTruthy();
    expect(screen.getByTestId('share-option-invite')).toBeTruthy();
    expect(screen.getByTestId('share-option-link')).toBeTruthy();
  });

  it('closes share sheet when close button is pressed', async () => {
    const screen = await render(<ProfileHeader profile={mockProfile} stats={mockStats} />);
    const user = userEvent.setup();

    await user.press(screen.getByTestId('profile-share-button'));
    await waitFor(() => {
      expect(screen.getByTestId('share-sheet')).toBeTruthy();
    });

    await user.press(screen.getByTestId('share-sheet-close'));
    await waitFor(() => {
      expect(screen.queryByTestId('share-sheet')).toBeNull();
    });
  });

  it('closes share sheet when an option is pressed', async () => {
    const screen = await render(<ProfileHeader profile={mockProfile} stats={mockStats} />);
    const user = userEvent.setup();

    await user.press(screen.getByTestId('profile-share-button'));
    await waitFor(() => {
      expect(screen.getByTestId('share-sheet')).toBeTruthy();
    });

    await user.press(screen.getByTestId('share-option-link'));
    await waitFor(() => {
      expect(screen.queryByTestId('share-sheet')).toBeNull();
    });
  });
});
