import { fireEvent, render } from '@testing-library/react-native';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import RealnameVerifyScreen from '@/app/realname-verify';
import { defaultAccountSecurity } from '@/services/storageService';
import type { AccountSecurity } from '@/types/mixology';

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
};

const mockVerifyRealname = jest.fn();
const mockVerifyAge = jest.fn<() => Promise<void>>();
let mockParams: { purpose?: string; next?: string } = {};
const testAdultId = '00000019900101123X';
const testUnderageId = '00000020100101123X';

// 可变账户状态，便于在单测间切换「未认证 / 已认证」
let mockAccountSecurity: AccountSecurity = { ...defaultAccountSecurity };

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
}));

jest.mock('@/state/MixologyState', () => ({
  useMixology: () => ({
    accountSecurity: mockAccountSecurity,
    verifyRealname: mockVerifyRealname,
    verifyAge: mockVerifyAge,
  }),
}));

describe('RealnameVerifyScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ now: new Date('2026-08-01T00:00:00+08:00') });
    mockParams = {};
    mockAccountSecurity = { ...defaultAccountSecurity };
    mockVerifyAge.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('submits account-security realname verification with a valid adult ID', async () => {
    const screen = await render(<RealnameVerifyScreen />);

    expect(screen.getByText('实名认证')).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('realname-input'), '张三');
    await fireEvent.changeText(screen.getByTestId('realname-id-input'), testAdultId);
    await fireEvent.press(screen.getByTestId('realname-submit'));

    expect(mockVerifyRealname).toHaveBeenCalledWith('张三');
    expect(mockVerifyAge).not.toHaveBeenCalled();
  });

  it('verifies an adult ID before first phone login without storing name or ID in account security', async () => {
    mockParams = { purpose: 'age-gate', next: '/login' };
    const screen = await render(<RealnameVerifyScreen />);

    await fireEvent.changeText(screen.getByTestId('realname-input'), '张三');
    await fireEvent.changeText(screen.getByTestId('realname-id-input'), testAdultId);
    await fireEvent.press(screen.getByTestId('realname-submit'));

    expect(mockVerifyAge).toHaveBeenCalledTimes(1);
    expect(mockVerifyRealname).not.toHaveBeenCalled();
    expect(mockRouter.replace).toHaveBeenCalledWith('/login');
  });

  it('rejects underage IDs before first phone login', async () => {
    mockParams = { purpose: 'age-gate', next: '/login' };
    const screen = await render(<RealnameVerifyScreen />);

    await fireEvent.changeText(screen.getByTestId('realname-input'), '李四');
    await fireEvent.changeText(screen.getByTestId('realname-id-input'), testUnderageId);
    await fireEvent.press(screen.getByTestId('realname-submit'));

    expect(screen.getByText('需年满 18 岁后才能使用杯语')).toBeTruthy();
    expect(mockVerifyAge).not.toHaveBeenCalled();
    expect(mockVerifyRealname).not.toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalledWith('/login');
  });

  it('rejects invalid ID checksums without accepting the realname form', async () => {
    const screen = await render(<RealnameVerifyScreen />);

    await fireEvent.changeText(screen.getByTestId('realname-input'), '王五');
    await fireEvent.changeText(screen.getByTestId('realname-id-input'), '000000199001011230');
    await fireEvent.press(screen.getByTestId('realname-submit'));

    expect(screen.getByText('请输入有效的二代身份证号')).toBeTruthy();
    expect(mockVerifyRealname).not.toHaveBeenCalled();
  });

  it('shows verified state when already verified', async () => {
    mockAccountSecurity = {
      ...defaultAccountSecurity,
      realnameVerified: true,
      realnameName: '李四',
    };
    const screen = await render(<RealnameVerifyScreen />);

    expect(screen.getByText('已通过实名认证')).toBeTruthy();
    expect(screen.getByText('认证信息不会在本机展示或保存')).toBeTruthy();
    expect(screen.queryByText('李四')).toBeNull();
  });

  it('returns to account-security on back', async () => {
    const screen = await render(<RealnameVerifyScreen />);

    await fireEvent.press(screen.getByTestId('realname-back-button'));

    expect(mockRouter.replace).toHaveBeenCalledWith('/account-security');
  });

  it('returns to the welcome screen from first-run age verification', async () => {
    mockParams = { purpose: 'age-gate', next: '/login' };
    const screen = await render(<RealnameVerifyScreen />);

    await fireEvent.press(screen.getByTestId('realname-back-button'));

    expect(mockRouter.replace).toHaveBeenCalledWith('/');
  });
});
