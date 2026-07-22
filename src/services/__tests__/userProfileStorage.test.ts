import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import {
  defaultUserProfile,
  loadUserProfile,
  saveUserProfile,
} from '@/services/storageService';

describe('userProfile storage', () => {
  beforeEach(() => {
    jest.clearAllMocks?.();
  });

  it('returns default profile when nothing stored', async () => {
    await expect(loadUserProfile()).resolves.toEqual(defaultUserProfile);
    expect(defaultUserProfile.nickname).toBe('游客调酒师');
    expect(defaultUserProfile.avatarKey).toBe('avatarOne');
    expect(defaultUserProfile.avatarUri).toBeNull();
  });

  it('persists profile and reads it back', async () => {
    const profile = {
      nickname: '霓虹酒保',
      avatarKey: 'avatarTwo',
      avatarUri: null,
      signature: '周五晚上只喝尼格罗尼',
      city: '上海',
    };

    await saveUserProfile(profile);
    await expect(loadUserProfile()).resolves.toEqual(profile);
  });

  it('falls back to default when stored json is corrupted', async () => {
    await AsyncStorage.setItem('mixology.userProfile', '{bad json');
    await expect(loadUserProfile()).resolves.toEqual(defaultUserProfile);
  });

  it('tolerates native storage failures', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('Native module is null'));
    await expect(loadUserProfile()).resolves.toEqual(defaultUserProfile);

    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('Native module is null'));
    await expect(saveUserProfile(defaultUserProfile)).resolves.toBeUndefined();
  });
});
