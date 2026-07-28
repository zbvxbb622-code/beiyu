import { fireEvent, render } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';

import DeviceManagementScreen from '@/app/device-management';
import { defaultAccountSecurity } from '@/services/storageService';

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
};

const mockRemoveDevice = jest.fn();
const mockAccountSecurity = { ...defaultAccountSecurity };

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
}));

jest.mock('@/state/MixologyState', () => ({
  useMixology: () => ({
    accountSecurity: mockAccountSecurity,
    removeDevice: mockRemoveDevice,
  }),
}));

describe('DeviceManagementScreen', () => {
  it('renders all devices and current badge', async () => {
    const screen = await render(<DeviceManagementScreen />);

    expect(screen.getByText('登录设备管理')).toBeTruthy();
    expect(screen.getByText('iPhone 15 Pro')).toBeTruthy();
    expect(screen.getByText('iPad Air')).toBeTruthy();
    expect(screen.getByText('当前使用')).toBeTruthy();
  });

  it('logs out a non-current device', async () => {
    const screen = await render(<DeviceManagementScreen />);

    await fireEvent.press(screen.getByTestId('device-logout-device-ipad'));

    expect(mockRemoveDevice).toHaveBeenCalledWith('device-ipad');
  });

  it('returns to account-security on back', async () => {
    const screen = await render(<DeviceManagementScreen />);

    await fireEvent.press(screen.getByTestId('device-management-back-button'));

    expect(mockRouter.replace).toHaveBeenCalledWith('/account-security');
  });
});
