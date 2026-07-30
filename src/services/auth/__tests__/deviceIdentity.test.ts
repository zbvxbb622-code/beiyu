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

  it('serializes concurrent first calls into one stored installation ID', async () => {
    jest
      .mocked(Crypto.randomUUID)
      .mockReturnValueOnce('7c9304c4-4430-4c96-8afd-b5df2b18e2d3')
      .mockReturnValueOnce('a0ff3d87-f1ef-4e72-a4d2-a6c81bb4b6f3');

    const [first, second] = await Promise.all([getDeviceIdentity(), getDeviceIdentity()]);

    expect(first.installationId).toBe(second.installationId);
    expect(Crypto.randomUUID).toHaveBeenCalledTimes(1);
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'beiyu.installation-id.v1',
      first.installationId
    );
  });
});
