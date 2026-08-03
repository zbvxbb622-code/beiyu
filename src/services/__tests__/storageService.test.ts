import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  clearLocalState,
  loadLocalState,
  loadAuthenticatedState,
  saveAgeVerified,
  saveAuthenticatedState,
  saveCellarIngredientIds,
  savePrivacySettings,
} from '../storageService';

describe('storageService', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('loads privacy-first defaults when nothing is stored', async () => {
    const state = await loadLocalState();

    expect(state).toEqual({
      ageVerified: false,
      cellarIngredientIds: [],
      privacySettings: {
        localOnlyMode: true,
        analyticsOptIn: false,
        syncWhenLoggedIn: false,
      },
    });
  });

  it('persists age gate, cellar ingredients, and privacy settings locally', async () => {
    await saveAgeVerified(true);
    await saveCellarIngredientIds(['gin', 'lime']);
    await savePrivacySettings({
      localOnlyMode: true,
      analyticsOptIn: false,
      syncWhenLoggedIn: true,
    });

    await expect(loadLocalState()).resolves.toEqual({
      ageVerified: true,
      cellarIngredientIds: ['gin', 'lime'],
      privacySettings: {
        localOnlyMode: true,
        analyticsOptIn: false,
        syncWhenLoggedIn: true,
      },
    });
  });

  it('does not persist realname names in authenticated account security snapshots', async () => {
    await saveAuthenticatedState({
      userId: 'user-1',
      localState: {
        ageVerified: true,
        cellarIngredientIds: [],
        privacySettings: {
          localOnlyMode: true,
          analyticsOptIn: false,
          syncWhenLoggedIn: false,
        },
      },
      userProfile: {
        nickname: '测试用户',
        avatarKey: 'avatarOne',
        avatarUri: null,
        signature: '',
        city: '',
        gender: null,
        birthday: null,
        showBirthdayTag: true,
        showAge: true,
        showZodiac: false,
        occupation: null,
        school: null,
      },
      accountSecurity: {
        phone: '138****0000',
        phoneVerified: true,
        wechatBound: false,
        wechatAccount: '',
        passwordSet: false,
        realnameVerified: true,
        realnameName: '张三',
        officialVerified: false,
        officialType: '',
        devices: [],
      },
    });

    await expect(loadAuthenticatedState('user-1')).resolves.toMatchObject({
      accountSecurity: {
        realnameVerified: true,
        realnameName: '',
      },
    });
    await expect(AsyncStorage.getItem('mixology.account.user-1.accountSecurity.v1')).resolves.not.toContain('张三');
  });

  it('clears local state for privacy reset', async () => {
    await saveAgeVerified(true);
    await saveCellarIngredientIds(['tequila']);
    await clearLocalState();

    const state = await loadLocalState();

    expect(state.ageVerified).toBe(false);
    expect(state.cellarIngredientIds).toEqual([]);
  });

  it('returns privacy-first defaults when native storage cannot be read', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValue(new Error('Native module is null'));

    await expect(loadLocalState()).resolves.toEqual({
      ageVerified: false,
      cellarIngredientIds: [],
      privacySettings: {
        localOnlyMode: true,
        analyticsOptIn: false,
        syncWhenLoggedIn: false,
      },
    });
  });

  it('does not throw when native storage cannot save or clear local state', async () => {
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValue(new Error('Native module is null'));
    jest.spyOn(AsyncStorage, 'removeItem').mockRejectedValue(new Error('Native module is null'));

    await expect(saveAgeVerified(true)).resolves.toBeUndefined();
    await expect(saveCellarIngredientIds(['gin'])).resolves.toBeUndefined();
    await expect(
      savePrivacySettings({
        localOnlyMode: true,
        analyticsOptIn: false,
        syncWhenLoggedIn: true,
      })
    ).resolves.toBeUndefined();
    await expect(clearLocalState()).resolves.toBeUndefined();
  });
});
