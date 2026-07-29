import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { randomUUID } from 'expo-crypto';
import * as Device from 'expo-device';

import type { DeviceInput } from './authSchemas';

const INSTALLATION_ID_KEY = 'beiyu.installation-id.v1';

function platformForOs(osName: string | null): DeviceInput['platform'] {
  switch (osName?.toUpperCase()) {
    case 'IOS':
    case 'IPADOS':
      return 'IOS';
    case 'ANDROID':
      return 'ANDROID';
    default:
      return 'WEB';
  }
}

async function getInstallationId(): Promise<string> {
  const storedInstallationId = await AsyncStorage.getItem(INSTALLATION_ID_KEY);
  if (storedInstallationId) {
    return storedInstallationId;
  }

  const installationId = randomUUID();
  await AsyncStorage.setItem(INSTALLATION_ID_KEY, installationId);
  return installationId;
}

export async function getDeviceIdentity(): Promise<DeviceInput> {
  return {
    installationId: await getInstallationId(),
    platform: platformForOs(Device.osName),
    deviceName: Device.deviceName ?? Device.modelName ?? 'Unknown device',
    appVersion: Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? 'unknown',
  };
}
