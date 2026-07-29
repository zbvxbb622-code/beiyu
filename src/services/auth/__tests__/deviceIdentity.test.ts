import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

import { getDeviceIdentity } from '@/services/auth/deviceIdentity';

describe('getDeviceIdentity', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  it('creates one stable installation identity with Expo metadata', async () => {
    await expect(getDeviceIdentity()).resolves.toEqual(
      expect.objectContaining({
        installationId: expect.any(String),
        platform: expect.stringMatching(/IOS|ANDROID|WEB/),
        appVersion: '1.0.0',
      })
    );

    const first = await getDeviceIdentity();
    const second = await getDeviceIdentity();

    expect(second.installationId).toBe(first.installationId);
    expect(Crypto.randomUUID).toHaveBeenCalledTimes(1);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'beiyu.installation-id.v1',
      first.installationId
    );
  });
});
