import { act, fireEvent, render } from '@testing-library/react-native';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { ReactNode } from 'react';
import * as mockReact from 'react';
import { Text as mockRouterLinkText } from 'react-native';

import LoginScreen from '@/app/login';
import { useAuth } from '@/state/AuthState';

const mockReplace = jest.fn();
const mockPush = jest.fn();
let mockSearchParams: Record<string, string | undefined> = {};
const mockRequestSmsCode = jest.fn<(phone: string) => Promise<{ expiresIn: number; retryAfter: number }>>();
const mockLogin = jest.fn<(phone: string, code: string) => Promise<void>>();
const mockLinkText = mockRouterLinkText as unknown as mockReact.ComponentType<{
  href: string;
  children?: ReactNode;
} & Record<string, unknown>>;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

jest.mock('expo-router', () => {
  return {
    Link: ({ href, children, ...props }: { href: string; children: ReactNode }) =>
      mockReact.createElement(mockLinkText, { href, ...props }, children),
    useLocalSearchParams: () => mockSearchParams,
    useRouter: () => ({ replace: mockReplace, push: mockPush }),
  };
});
jest.mock('@/state/AuthState', () => ({ useAuth: jest.fn() }));

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = {};
    (useAuth as jest.Mock).mockReturnValue({ requestSmsCode: mockRequestSmsCode, login: mockLogin });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('uses controlled phone and six-digit code fields, and requires agreement before submitting', async () => {
    const screen = await render(<LoginScreen />);
    const submit = screen.getByTestId('login-submit');

    expect(submit.props.accessibilityState.disabled).toBe(true);
    await fireEvent.changeText(screen.getByTestId('login-phone'), '13800000000');
    await fireEvent.changeText(screen.getByTestId('login-code'), '12345a678');
    await fireEvent.press(screen.getByTestId('login-agreement'));

    expect(screen.getByTestId('login-code').props.value).toBe('123456');
    expect(submit.props.accessibilityState.disabled).toBe(false);
  });

  it('shows separate service agreement and privacy policy links before login', async () => {
    const screen = await render(<LoginScreen />);

    expect(screen.getByText('我已经阅读并同意')).toBeTruthy();
    expect(screen.getByTestId('login-terms-link').props.href).toBe('/terms');
    expect(screen.getByText('《服务协议》')).toBeTruthy();
    expect(screen.getByTestId('login-privacy-link').props.href).toBe('/privacy');
    expect(screen.getByText('《隐私说明》')).toBeTruthy();
  });

  it('shows request failures and counts down retryAfter before allowing another code request', async () => {
    mockRequestSmsCode.mockRejectedValueOnce(new Error('短信服务暂不可用')).mockResolvedValueOnce({ expiresIn: 300, retryAfter: 2 });
    const screen = await render(<LoginScreen />);
    await fireEvent.changeText(screen.getByTestId('login-phone'), '13800000000');

    await fireEvent.press(screen.getByTestId('request-sms-code'));

    expect(mockRequestSmsCode).toHaveBeenCalledWith('13800000000');
    expect(screen.getByText('短信服务暂不可用')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('request-sms-code'));
    expect(screen.getByText('2 秒后重试')).toBeTruthy();
    expect(screen.getByTestId('request-sms-code').props.accessibilityState.disabled).toBe(true);
  });

  it('prevents duplicate login submission and only navigates after login and bootstrap succeed', async () => {
    let completeLogin!: () => void;
    mockLogin.mockImplementationOnce(() => new Promise<void>((resolve) => { completeLogin = resolve; }));
    const screen = await render(<LoginScreen />);
    await fireEvent.changeText(screen.getByTestId('login-phone'), '13800000000');
    await fireEvent.changeText(screen.getByTestId('login-code'), '123456');
    await fireEvent.press(screen.getByTestId('login-agreement'));

    await fireEvent.press(screen.getByTestId('login-submit'));
    await fireEvent.press(screen.getByTestId('login-submit'));
    expect(mockLogin).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();

    await act(async () => { completeLogin(); });
    expect(mockLogin).toHaveBeenCalledWith('13800000000', '123456');
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('returns to the requested protected screen after login succeeds', async () => {
    mockSearchParams = { next: '/ai' };
    mockLogin.mockResolvedValueOnce();
    const screen = await render(<LoginScreen />);
    await fireEvent.changeText(screen.getByTestId('login-phone'), '13800000000');
    await fireEvent.changeText(screen.getByTestId('login-code'), '123456');
    await fireEvent.press(screen.getByTestId('login-agreement'));

    await fireEvent.press(screen.getByTestId('login-submit'));

    expect(mockLogin).toHaveBeenCalledWith('13800000000', '123456');
    expect(mockReplace).toHaveBeenCalledWith('/ai');
  });

  it('keeps login errors visible and does not navigate', async () => {
    mockLogin.mockRejectedValueOnce(new Error('验证码错误'));
    const screen = await render(<LoginScreen />);
    await fireEvent.changeText(screen.getByTestId('login-phone'), '13800000000');
    await fireEvent.changeText(screen.getByTestId('login-code'), '123456');
    await fireEvent.press(screen.getByTestId('login-agreement'));

    await fireEvent.press(screen.getByTestId('login-submit'));

    expect(screen.getByText('验证码错误')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('does not update after unmount when a started SMS countdown ticks and login later succeeds', async () => {
    jest.useFakeTimers();
    const login = deferred<void>();
    mockRequestSmsCode.mockResolvedValueOnce({ expiresIn: 300, retryAfter: 2 });
    mockLogin.mockImplementationOnce(() => login.promise);
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const screen = await render(<LoginScreen />);
    await fireEvent.changeText(screen.getByTestId('login-phone'), '13800000000');
    await fireEvent.press(screen.getByTestId('request-sms-code'));
    expect(screen.getByText('2 秒后重试')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('login-code'), '123456');
    await fireEvent.press(screen.getByTestId('login-agreement'));
    await fireEvent.press(screen.getByTestId('login-submit'));

    await act(async () => { screen.unmount(); });
    expect(mockReplace).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(1_000);
      login.resolve();
    });

    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    const unmountedWarnings = consoleError.mock.calls.filter((args) =>
      args.some((value) => typeof value === 'string' && /(unmounted|state update)/i.test(value))
    );
    expect(unmountedWarnings).toEqual([]);
  });
});
