import { act, fireEvent, render } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import LoginScreen from '@/app/login';
import { useAuth } from '@/state/AuthState';

const mockReplace = jest.fn();
const mockRequestSmsCode = jest.fn<(phone: string) => Promise<{ expiresIn: number; retryAfter: number }>>();
const mockLogin = jest.fn<(phone: string, code: string) => Promise<void>>();

jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }) }));
jest.mock('@/state/AuthState', () => ({ useAuth: jest.fn() }));

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({ requestSmsCode: mockRequestSmsCode, login: mockLogin });
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
});
