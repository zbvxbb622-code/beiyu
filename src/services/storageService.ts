import AsyncStorage from '@react-native-async-storage/async-storage';

import type { LocalState, PrivacySettings, UserProfile } from '@/types/mixology';

const AGE_VERIFIED_KEY = 'mixology.ageVerified';
const CELLAR_KEY = 'mixology.cellarIngredientIds';
const PRIVACY_KEY = 'mixology.privacySettings';
const USER_PROFILE_KEY = 'mixology.userProfile';

export const defaultPrivacySettings: PrivacySettings = {
  localOnlyMode: true,
  analyticsOptIn: false,
  syncWhenLoggedIn: false,
};

export const defaultLocalState: LocalState = {
  ageVerified: false,
  cellarIngredientIds: [],
  privacySettings: defaultPrivacySettings,
};

export const defaultUserProfile: UserProfile = {
  nickname: '游客调酒师',
  avatarKey: 'avatarOne',
  avatarUri: null,
  signature: '',
  city: '',
};

async function readJson<T>(key: string, fallback: T): Promise<T> {
  let rawValue: string | null;

  try {
    rawValue = await AsyncStorage.getItem(key);
  } catch {
    return fallback;
  }

  if (!rawValue) {
    return fallback;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    return fallback;
  }
}

export async function loadLocalState(): Promise<LocalState> {
  const [ageVerified, cellarIngredientIds, privacySettings] = await Promise.all([
    readJson<boolean>(AGE_VERIFIED_KEY, defaultLocalState.ageVerified),
    readJson<string[]>(CELLAR_KEY, defaultLocalState.cellarIngredientIds),
    readJson<PrivacySettings>(PRIVACY_KEY, defaultPrivacySettings),
  ]);

  return {
    ageVerified,
    cellarIngredientIds,
    privacySettings,
  };
}

export async function saveAgeVerified(ageVerified: boolean) {
  await writeJson(AGE_VERIFIED_KEY, ageVerified);
}

export async function saveCellarIngredientIds(cellarIngredientIds: string[]) {
  await writeJson(CELLAR_KEY, cellarIngredientIds);
}

export async function savePrivacySettings(privacySettings: PrivacySettings) {
  await writeJson(PRIVACY_KEY, privacySettings);
}

export async function loadUserProfile(): Promise<UserProfile> {
  return readJson<UserProfile>(USER_PROFILE_KEY, defaultUserProfile);
}

export async function saveUserProfile(profile: UserProfile) {
  await writeJson(USER_PROFILE_KEY, profile);
}

export async function clearLocalState() {
  await Promise.all([
    removeKey(AGE_VERIFIED_KEY),
    removeKey(CELLAR_KEY),
    removeKey(PRIVACY_KEY),
    removeKey(USER_PROFILE_KEY),
  ]);
}

async function writeJson(key: string, value: unknown) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Keep UI usable in Expo Go even if native storage is unavailable.
  }
}

async function removeKey(key: string) {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // Keep UI usable in Expo Go even if native storage is unavailable.
  }
}
