import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { tokenStore } from '@/services/auth/tokenStore';

describe('tokenStore', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  it('persists and clears refresh tokens only through SecureStore', async () => {
    await tokenStore.setRefreshToken('refresh-token');

    await expect(tokenStore.getRefreshToken()).resolves.toBe('refresh-token');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'beiyu.refresh-token.v1',
      'refresh-token'
    );
    expect(AsyncStorage.setItem).not.toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('refresh-token')
    );

    await tokenStore.clearRefreshToken();

    await expect(tokenStore.getRefreshToken()).resolves.toBeNull();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('beiyu.refresh-token.v1');
  });
});
