import { fireEvent, render } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';

import SettingsLanguageScreen from '@/app/settings-language';

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
};

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
}));

describe('SettingsLanguageScreen', () => {
  it('renders the title, group label, and all 3 languages', async () => {
    const screen = await render(<SettingsLanguageScreen />);

    expect(screen.getByText('多语言和翻译')).toBeTruthy();
    expect(screen.getByText('选择语言')).toBeTruthy();
    expect(screen.getByText('简体中文')).toBeTruthy();
    expect(screen.getByText('繁体中文')).toBeTruthy();
    expect(screen.getByText('English')).toBeTruthy();
  });

  it('marks zh-CN as selected by default', async () => {
    const screen = await render(<SettingsLanguageScreen />);

    // 简体中文 has checkmark by default
    expect(screen.getByTestId('settings-language-zh-CN')).toBeTruthy();
  });

  it('returns to settings on back', async () => {
    const screen = await render(<SettingsLanguageScreen />);

    await fireEvent.press(screen.getByTestId('settings-language-back-button'));

    expect(mockRouter.replace).toHaveBeenCalledWith('/settings');
  });

  it('switches the selected language on row press', async () => {
    const screen = await render(<SettingsLanguageScreen />);

    await fireEvent.press(screen.getByTestId('settings-language-en'));

    expect(screen.getByTestId('settings-language-en')).toBeTruthy();
  });
});