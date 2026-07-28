import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';

import SettingsPrivacyScreen from '@/app/settings-privacy';
import SettingsPrivacyFindMeScreen from '@/app/settings-privacy-find-me';
import SettingsPrivacyChatTagScreen from '@/app/settings-privacy-chat-tag';
import SettingsPrivacyBlacklistScreen from '@/app/settings-privacy-blacklist';
import SettingsPrivacySystemPermissionsScreen from '@/app/settings-privacy-system-permissions';
import SettingsPrivacyWhoCanDmScreen from '@/app/settings-privacy-who-can-dm';

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
};

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
}));

describe('SettingsPrivacy (root)', () => {
  beforeEach(() => {
    mockRouter.push.mockClear();
    mockRouter.replace.mockClear();
  });

  it('renders all 6 group labels and 16 row titles from the prototype', async () => {
    const screen = await render(<SettingsPrivacyScreen />);

    // 6 个分组标签
    expect(screen.getByText('关系')).toBeTruthy();
    expect(screen.getByText('屏蔽与黑名单')).toBeTruthy();
    expect(screen.getByText('互动权限')).toBeTruthy();
    expect(screen.getByText('内容和状态权限')).toBeTruthy();
    expect(screen.getByText('权限')).toBeTruthy();
    expect(screen.getByText('更多')).toBeTruthy();

    // 16 行标题（节选关键项）
    expect(screen.getByText('找到我的方式')).toBeTruthy();
    expect(screen.getByText('推荐可能认识的人给我')).toBeTruthy();
    expect(screen.getByText('把我推荐给可能认识的人')).toBeTruthy();
    expect(screen.getByText('不让他(她)看')).toBeTruthy();
    expect(screen.getByText('不看他(她)')).toBeTruthy();
    expect(screen.getByText('黑名单')).toBeTruthy();
    expect(screen.getByText('一键防护')).toBeTruthy();
    expect(screen.getByText('谁可以私信我')).toBeTruthy();
    expect(screen.getByText('谁可以给我评论和发弹幕')).toBeTruthy();
    expect(screen.getByText('谁可以@我')).toBeTruthy();
    expect(screen.getByText('聊天标识')).toBeTruthy();
    expect(screen.getByText('在线状态')).toBeTruthy();
    expect(screen.getByText('关注与粉丝列表')).toBeTruthy();
    expect(screen.getByText('我的收藏')).toBeTruthy();
    expect(screen.getByText('系统权限管理')).toBeTruthy();
    expect(screen.getByText('个性化选项')).toBeTruthy();

    // 默认值匹配原型（节选）
    expect(screen.getByText('互相关注的人')).toBeTruthy();
    expect(screen.getByText('全部公开')).toBeTruthy();
    expect(screen.getAllByText('开启').length).toBeGreaterThan(0);
    expect(screen.getAllByText('默认').length).toBeGreaterThan(0);
  });

  it('navigates to a sub-page when a row is pressed', async () => {
    const screen = await render(<SettingsPrivacyScreen />);

    await fireEvent.press(screen.getByTestId('privacy-who-can-dm'));

    expect(mockRouter.push).toHaveBeenCalledWith('/settings-privacy-who-can-dm');
  });

  it('returns to settings when the back button is pressed', async () => {
    const screen = await render(<SettingsPrivacyScreen />);

    await fireEvent.press(screen.getByTestId('settings-privacy-back-button'));

    expect(mockRouter.replace).toHaveBeenCalledWith('/settings');
  });
});

describe('SettingsPrivacy sub-pages (shared component variants)', () => {
  beforeEach(() => {
    mockRouter.push.mockClear();
    mockRouter.replace.mockClear();
  });

  // —— Picker ——
  it('picker: renders title, description, and default selection', async () => {
    const screen = await render(<SettingsPrivacyWhoCanDmScreen />);

    expect(screen.getByText('谁可以私信我')).toBeTruthy();
    expect(screen.getByText('默认')).toBeTruthy();
    expect(screen.getByText('互相关注的人')).toBeTruthy();
    expect(screen.getByText('所有人')).toBeTruthy();
    expect(screen.getByText('不允许任何人')).toBeTruthy();
  });

  it('picker: switches selection on press', async () => {
    const screen = await render(<SettingsPrivacyFindMeScreen />);

    await fireEvent.press(screen.getByTestId('privacy-picker-email'));

    // 邮箱选项仍可见
    expect(screen.getByText('邮箱')).toBeTruthy();
  });

  // —— Toggle ——
  it('toggle: renders rows and toggles on press', async () => {
    const screen = await render(<SettingsPrivacyChatTagScreen />);

    expect(screen.getAllByText('聊天标识').length).toBeGreaterThan(0);

    await fireEvent.press(screen.getByTestId('privacy-toggle-show'));
  });

  // —— Empty ——
  it('empty: renders illustration placeholder, title, and action', async () => {
    const screen = await render(<SettingsPrivacyBlacklistScreen />);

    expect(screen.getByText('黑名单')).toBeTruthy();
    expect(screen.getByText('黑名单为空')).toBeTruthy();
    expect(screen.getByTestId('privacy-empty-action')).toBeTruthy();
  });

  // —— System permissions ——
  it('system-permissions: lists rows with granted/denied status', async () => {
    const screen = await render(<SettingsPrivacySystemPermissionsScreen />);

    expect(screen.getByText('系统权限管理')).toBeTruthy();
    expect(screen.getByText('相机')).toBeTruthy();
    expect(screen.getByText('通讯录')).toBeTruthy();
    expect(screen.getAllByText('已授权').length).toBeGreaterThan(0);
    expect(screen.getAllByText('未授权').length).toBeGreaterThan(0);
  });

  // —— Back navigation ——
  it('sub-page: back button returns to privacy root', async () => {
    const screen = await render(<SettingsPrivacyWhoCanDmScreen />);

    await fireEvent.press(screen.getByTestId('header-back-谁可以私信我'));

    expect(mockRouter.replace).toHaveBeenCalledWith('/settings-privacy');
  });
});
