import { fireEvent, render } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';

import SettingsGeneralScreen from '@/app/settings-general';

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
};

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
}));

describe('SettingsGeneralScreen', () => {
  it('renders the title and back button', async () => {
    const screen = await render(<SettingsGeneralScreen />);

    expect(screen.getByText('通用设置')).toBeTruthy();
    expect(screen.getByTestId('settings-general-back-button')).toBeTruthy();
  });

  it('renders the display group with all rows', async () => {
    const screen = await render(<SettingsGeneralScreen />);

    expect(screen.getByText('显示')).toBeTruthy();
    expect(screen.getByText('字体大小')).toBeTruthy();
    expect(screen.getByText('使用系统默认字体')).toBeTruthy();
    expect(screen.getByText('深色模式')).toBeTruthy();
  });

  it('returns to settings on back', async () => {
    const screen = await render(<SettingsGeneralScreen />);

    await fireEvent.press(screen.getByTestId('settings-general-back-button'));

    expect(mockRouter.replace).toHaveBeenCalledWith('/settings');
  });

  it('toggles system font on press without crashing', async () => {
    const screen = await render(<SettingsGeneralScreen />);

    const row = screen.getByTestId('settings-general-system-font');
    await fireEvent.press(row);
    await fireEvent.press(row);

    expect(row).toBeTruthy();
  });
});
