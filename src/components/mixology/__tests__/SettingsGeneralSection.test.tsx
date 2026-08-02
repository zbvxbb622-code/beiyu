import { fireEvent, render } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';

import { SettingsGeneralSection } from '@/components/mixology/SettingsGeneralSection';

describe('SettingsGeneralSection', () => {
  it('renders the display group label and all rows', async () => {
    const screen = await render(
      <SettingsGeneralSection
        useSystemFont
        onToggleSystemFont={jest.fn()}
      />
    );

    expect(screen.getByText('显示')).toBeTruthy();
    expect(screen.getByText('字体大小')).toBeTruthy();
    expect(screen.getByText('使用系统默认字体')).toBeTruthy();
    expect(screen.getByText('深色模式')).toBeTruthy();
    expect(screen.getAllByText('暂未开放')).toHaveLength(2);

    expect(screen.getByTestId('settings-general-font-size')).toBeTruthy();
    expect(screen.getByTestId('settings-general-system-font')).toBeTruthy();
    expect(screen.getByTestId('settings-general-dark-mode')).toBeTruthy();
  });

  it('invokes onToggleSystemFont when system-font row is pressed', async () => {
    const onToggle = jest.fn();
    const screen = await render(
      <SettingsGeneralSection useSystemFont onToggleSystemFont={onToggle} />
    );

    await fireEvent.press(screen.getByTestId('settings-general-system-font'));

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('keeps font size and dark mode unavailable instead of invoking local-only handlers', async () => {
    const onToggle = jest.fn();
    const onFontSize = jest.fn();
    const onDarkMode = jest.fn();
    const screen = await render(
      <SettingsGeneralSection
        useSystemFont={false}
        onToggleSystemFont={onToggle}
        onPressFontSize={onFontSize}
        onPressDarkMode={onDarkMode}
      />
    );

    await fireEvent.press(screen.getByTestId('settings-general-font-size'));
    await fireEvent.press(screen.getByTestId('settings-general-dark-mode'));

    expect(onFontSize).not.toHaveBeenCalled();
    expect(onDarkMode).not.toHaveBeenCalled();
    // Toggle handler must NOT fire for the other rows.
    expect(onToggle).not.toHaveBeenCalled();
  });
});
