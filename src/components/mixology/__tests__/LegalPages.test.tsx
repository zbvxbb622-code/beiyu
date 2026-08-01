import { fireEvent, render } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import PrivacyScreen from '@/app/privacy';
import TermsScreen from '@/app/terms';

const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
}));

describe('legal pages', () => {
  beforeEach(() => {
    mockBack.mockClear();
  });

  it('renders service agreement text and can return to login', async () => {
    const screen = await render(<TermsScreen />);

    expect(screen.getByText('杯语用户服务协议')).toBeTruthy();
    expect(screen.getByText(/仅向年满 18 周岁的用户提供/)).toBeTruthy();

    await fireEvent.press(screen.getByTestId('legal-back-button'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('renders privacy policy text and can return to login', async () => {
    const screen = await render(<PrivacyScreen />);

    expect(screen.getByText('杯语隐私说明')).toBeTruthy();
    expect(screen.getByText(/姓名与身份证号仅用于本次年龄或实名表单校验/)).toBeTruthy();
    expect(screen.getByText(/不会把姓名和身份证号写入本机持久化存储/)).toBeTruthy();

    await fireEvent.press(screen.getByTestId('legal-back-button'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
