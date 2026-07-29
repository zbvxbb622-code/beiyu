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

  it('conditionally clears an initially empty refresh-token slot', async () => {
    await expect(tokenStore.clearRefreshToken(null)).resolves.toBe(true);
    await expect(tokenStore.getRefreshToken()).resolves.toBeNull();
  });

  it('continues queued token operations after a read rejects', async () => {
    jest.spyOn(SecureStore, 'getItemAsync').mockRejectedValueOnce(new Error('secure store unavailable'));

    await expect(tokenStore.getRefreshToken()).rejects.toThrow('secure store unavailable');
    await tokenStore.setRefreshToken('next-refresh');
    await tokenStore.clearRefreshToken('next-refresh');

    await expect(tokenStore.getRefreshToken()).resolves.toBeNull();
  });

  it('continues queued token operations after deletion rejects', async () => {
    await tokenStore.setRefreshToken('current-refresh');
    jest.spyOn(SecureStore, 'deleteItemAsync').mockRejectedValueOnce(new Error('secure store unavailable'));

    await expect(tokenStore.clearRefreshToken('current-refresh')).rejects.toThrow('secure store unavailable');
    await tokenStore.setRefreshToken('replacement-refresh');
    await tokenStore.clearRefreshToken('replacement-refresh');

    await expect(tokenStore.getRefreshToken()).resolves.toBeNull();
  });

  it('does not let an older conditional clear delete a later token write', async () => {
    await tokenStore.setRefreshToken('older-refresh');

    const writeNewer = tokenStore.setRefreshToken('newer-refresh');
    const clearOlder = tokenStore.clearRefreshToken('older-refresh');
    await Promise.all([writeNewer, clearOlder]);

    await expect(tokenStore.getRefreshToken()).resolves.toBe('newer-refresh');
  });
});
