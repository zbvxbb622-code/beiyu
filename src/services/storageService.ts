import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AccountSecurity, LocalState, PrivacySettings, UserProfile } from '@/types/mixology';

const AGE_VERIFIED_KEY = 'mixology.ageVerified';
const CELLAR_KEY = 'mixology.cellarIngredientIds';
const PRIVACY_KEY = 'mixology.privacySettings';
const USER_PROFILE_KEY = 'mixology.userProfile';
const ACCOUNT_SECURITY_KEY = 'mixology.accountSecurity';
const GUEST_AGE_VERIFIED_KEY = 'mixology.guest.ageVerified.v1';
const GUEST_CELLAR_KEY = 'mixology.guest.cellarIngredientIds.v1';
const GUEST_PRIVACY_KEY = 'mixology.guest.privacySettings.v1';
const GUEST_USER_PROFILE_KEY = 'mixology.guest.userProfile.v1';

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
  gender: null,
  birthday: null,
  showBirthdayTag: true,
  showAge: true,
  showZodiac: false,
  occupation: null,
  school: null,
};

export const defaultAccountSecurity: AccountSecurity = {
  phone: '+86190****9105',
  phoneVerified: true,
  wechatBound: false,
  wechatAccount: '',
  passwordSet: false,
  realnameVerified: false,
  realnameName: '',
  officialVerified: false,
  officialType: '',
  devices: [
    {
      id: 'device-current',
      name: 'iPhone 15 Pro',
      platform: 'iOS',
      lastActive: '当前使用',
      isCurrent: true,
    },
    {
      id: 'device-ipad',
      name: 'iPad Air',
      platform: 'iOS',
      lastActive: '3 天前',
      isCurrent: false,
    },
  ],
};

export const anonymousAccountSecurity: AccountSecurity = {
  phone: '',
  phoneVerified: false,
  wechatBound: false,
  wechatAccount: '',
  passwordSet: false,
  realnameVerified: false,
  realnameName: '',
  officialVerified: false,
  officialType: '',
  devices: [],
};

function sanitizeAccountSecurity(accountSecurity: AccountSecurity): AccountSecurity {
  return {
    ...accountSecurity,
    realnameName: '',
  };
}

function accountKey(userId: string, name: string) {
  return `mixology.account.${encodeURIComponent(userId)}.${name}.v1`;
}

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
  const stored = await readJson<UserProfile>(USER_PROFILE_KEY, defaultUserProfile);
  return { ...defaultUserProfile, ...stored };
}

export async function saveUserProfile(profile: UserProfile) {
  await writeJson(USER_PROFILE_KEY, profile);
}

export async function loadAccountSecurity(): Promise<AccountSecurity> {
  const stored = await readJson<Partial<AccountSecurity>>(ACCOUNT_SECURITY_KEY, defaultAccountSecurity);
  return sanitizeAccountSecurity({ ...defaultAccountSecurity, ...stored });
}

export async function saveAccountSecurity(accountSecurity: AccountSecurity) {
  await writeJson(ACCOUNT_SECURITY_KEY, sanitizeAccountSecurity(accountSecurity));
}

export async function saveAuthenticatedState({
  userId,
  localState,
  userProfile,
  accountSecurity,
}: {
  userId: string;
  localState: LocalState;
  userProfile: UserProfile;
  accountSecurity: AccountSecurity;
}) {
  try {
    await AsyncStorage.multiSet([
      [accountKey(userId, 'ageVerified'), JSON.stringify(localState.ageVerified)],
      [accountKey(userId, 'cellarIngredientIds'), JSON.stringify(localState.cellarIngredientIds)],
      [accountKey(userId, 'privacySettings'), JSON.stringify(localState.privacySettings)],
      [accountKey(userId, 'userProfile'), JSON.stringify(userProfile)],
      [accountKey(userId, 'accountSecurity'), JSON.stringify(sanitizeAccountSecurity(accountSecurity))],
    ]);
  } catch {
    // Keep UI usable in Expo Go even if native storage is unavailable.
  }
}

export async function loadAuthenticatedState(userId: string): Promise<{
  localState: LocalState;
  userProfile: UserProfile;
  accountSecurity: AccountSecurity;
}> {
  const [ageVerified, cellarIngredientIds, privacySettings, userProfile, accountSecurity] = await Promise.all([
    readJson<boolean>(accountKey(userId, 'ageVerified'), false),
    readJson<string[]>(accountKey(userId, 'cellarIngredientIds'), []),
    readJson<PrivacySettings>(accountKey(userId, 'privacySettings'), defaultPrivacySettings),
    readJson<UserProfile>(accountKey(userId, 'userProfile'), defaultUserProfile),
    readJson<AccountSecurity>(accountKey(userId, 'accountSecurity'), anonymousAccountSecurity),
  ]);
  return {
    localState: { ageVerified, cellarIngredientIds, privacySettings },
    userProfile: { ...defaultUserProfile, ...userProfile },
    accountSecurity: sanitizeAccountSecurity({ ...anonymousAccountSecurity, ...accountSecurity }),
  };
}

export async function loadGuestState(): Promise<{ localState: LocalState; userProfile: UserProfile }> {
  const [ageVerified, cellarIngredientIds, privacySettings, profile] = await Promise.all([
    readJson<boolean>(GUEST_AGE_VERIFIED_KEY, false),
    readJson<string[]>(GUEST_CELLAR_KEY, []),
    readJson<PrivacySettings>(GUEST_PRIVACY_KEY, defaultPrivacySettings),
    readJson<UserProfile>(GUEST_USER_PROFILE_KEY, defaultUserProfile),
  ]);
  return {
    localState: { ageVerified, cellarIngredientIds, privacySettings },
    userProfile: { ...defaultUserProfile, ...profile },
  };
}

export async function saveGuestState(localState: LocalState, userProfile: UserProfile) {
  try {
    await AsyncStorage.multiSet([
      [GUEST_AGE_VERIFIED_KEY, JSON.stringify(localState.ageVerified)],
      [GUEST_CELLAR_KEY, JSON.stringify(localState.cellarIngredientIds)],
      [GUEST_PRIVACY_KEY, JSON.stringify(localState.privacySettings)],
      [GUEST_USER_PROFILE_KEY, JSON.stringify(userProfile)],
    ]);
  } catch {
    // Keep UI usable in Expo Go even if native storage is unavailable.
  }
}

export async function clearLocalState() {
  await Promise.all([
    removeKey(AGE_VERIFIED_KEY),
    removeKey(CELLAR_KEY),
    removeKey(PRIVACY_KEY),
    removeKey(USER_PROFILE_KEY),
    removeKey(ACCOUNT_SECURITY_KEY),
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
