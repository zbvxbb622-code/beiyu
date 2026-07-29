import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';

import type { BootstrapResponse } from '@/services/auth/authSchemas';
import type { AuthRepository } from '@/services/auth/authRepository';
import { MixologyProvider, useMixology } from '@/state/MixologyState';

type MixologyValue = ReturnType<typeof useMixology>;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

const mockRepository = {
  batchCellarItems: jest.fn<AuthRepository['batchCellarItems']>(),
  patchProfile: jest.fn<AuthRepository['patchProfile']>(),
  patchPrivacy: jest.fn<AuthRepository['patchPrivacy']>(),
  confirmAge: jest.fn<AuthRepository['confirmAge']>(),
};
let mockAuthSnapshot: {
  status: 'signedOut' | 'signedIn';
  bootstrapData: BootstrapResponse | null;
  session: { userId: string | null; generation: number };
  repository: typeof mockRepository;
};
let currentValue: MixologyValue | null = null;
let refresh: (() => void) | null = null;

jest.mock('@/state/AuthState', () => ({ useAuth: () => mockAuthSnapshot }));

function bootstrapFor(userId: string, nickname: string): BootstrapResponse {
  return {
    user: { id: userId, phoneMasked: '138****0000', status: 'ACTIVE', ageConfirmed: true, memoryEnabled: true, membershipLevel: 'FREE' },
    profile: { nickname, avatarKey: 'avatarOne', avatarUri: null, signature: '', city: '', gender: null, birthday: null, showBirthdayTag: true, showAge: true, showZodiac: false, occupation: null, school: null },
    privacy: { localOnlyMode: false, analyticsOptIn: false, syncWhenLoggedIn: true },
    accountSecurity: { phone: '138****0000', phoneVerified: true, devices: [] },
    cellar: { items: [] },
    ai: { dailyMessageLimit: 50, messagesUsedToday: 0, remaining: 50, resetsAt: '2026-07-29T16:00:00.000Z' },
    featureFlags: { aiChat: true },
  };
}

function Probe() {
  const value = useMixology();
  useEffect(() => { currentValue = value; }, [value]);
  return <Text>{value.userProfile.nickname}</Text>;
}

function Harness() {
  const [, setVersion] = useState(0);
  useEffect(() => { refresh = () => setVersion((value) => value + 1); }, []);
  return <MixologyProvider><Probe /></MixologyProvider>;
}

async function switchSession(next: typeof mockAuthSnapshot) {
  mockAuthSnapshot = next;
  await act(async () => { refresh!(); });
}

async function applyBootstrap(response: BootstrapResponse) {
  await act(async () => { await currentValue!.applyBootstrap(response); });
}

describe('Mixology session isolation', () => {
  beforeEach(async () => {
    jest.restoreAllMocks();
    await AsyncStorage.clear();
    currentValue = null;
    refresh = null;
    Object.values(mockRepository).forEach((method) => method.mockReset());
    mockAuthSnapshot = {
      status: 'signedOut',
      bootstrapData: null,
      session: { userId: null, generation: 0 },
      repository: mockRepository,
    };
  });

  it('does not let a delayed A bootstrap overwrite B memory after persistence resolves', async () => {
    const a = bootstrapFor('5364864c-3a48-4ca8-90b7-04f049b3227b', 'A');
    const b = bootstrapFor('6364864c-3a48-4ca8-90b7-04f049b3227b', 'B');
    const originalMultiSet = AsyncStorage.multiSet.bind(AsyncStorage);
    const delayedWrite = deferred<void>();
    jest.spyOn(AsyncStorage, 'multiSet')
      .mockImplementationOnce(() => delayedWrite.promise)
      .mockImplementation(originalMultiSet);
    const screen = await render(<Harness />);
    await waitFor(() => expect(refresh).not.toBeNull());

    await switchSession({ status: 'signedIn', bootstrapData: a, session: { userId: a.user.id, generation: 1 }, repository: mockRepository });
    const applyingA = currentValue!.applyBootstrap(a);
    await Promise.resolve();

    await switchSession({ status: 'signedIn', bootstrapData: b, session: { userId: b.user.id, generation: 2 }, repository: mockRepository });
    await applyBootstrap(b);
    await act(async () => { delayedWrite.resolve(); await applyingA; });

    expect(screen.getByText('B')).toBeTruthy();
  });

  it('clears account state when authentication ends instead of exposing the previous user', async () => {
    const a = bootstrapFor('5364864c-3a48-4ca8-90b7-04f049b3227b', 'A');
    const screen = await render(<Harness />);
    await waitFor(() => expect(refresh).not.toBeNull());
    await switchSession({ status: 'signedIn', bootstrapData: a, session: { userId: a.user.id, generation: 1 }, repository: mockRepository });
    await applyBootstrap(a);
    await switchSession({ status: 'signedOut', bootstrapData: null, session: { userId: null, generation: 2 }, repository: mockRepository });

    await waitFor(() => expect(screen.getByText('游客调酒师')).toBeTruthy());
    expect(currentValue?.localState.ageVerified).toBe(false);
    expect(currentValue?.localState.cellarIngredientIds).toEqual([]);
    expect(currentValue?.accountSecurity.devices).toEqual([]);
  });

  it('persists account-security edits only in the active account mirror', async () => {
    const a = bootstrapFor('5364864c-3a48-4ca8-90b7-04f049b3227b', 'A');
    await render(<Harness />);
    await waitFor(() => expect(refresh).not.toBeNull());
    await switchSession({ status: 'signedIn', bootstrapData: a, session: { userId: a.user.id, generation: 1 }, repository: mockRepository });
    await applyBootstrap(a);

    await act(async () => { await currentValue!.updateAccountSecurity({ phone: '139****0000', phoneVerified: true }); });

    expect(currentValue?.accountSecurity.phone).toBe('139****0000');
    expect(AsyncStorage.multiSet).toHaveBeenLastCalledWith(expect.arrayContaining([
      expect.arrayContaining(['mixology.account.5364864c-3a48-4ca8-90b7-04f049b3227b.accountSecurity.v1', expect.stringContaining('139')]),
    ]));
  });

  it('drops queued A cellar work after switching to B and ignores the in-flight response', async () => {
    const a = bootstrapFor('5364864c-3a48-4ca8-90b7-04f049b3227b', 'A');
    const b = bootstrapFor('6364864c-3a48-4ca8-90b7-04f049b3227b', 'B');
    const first = deferred<Awaited<ReturnType<AuthRepository['batchCellarItems']>>>();
    mockRepository.batchCellarItems.mockImplementationOnce(() => first.promise).mockResolvedValueOnce({ items: [] });
    const screen = await render(<Harness />);
    await waitFor(() => expect(refresh).not.toBeNull());
    await switchSession({ status: 'signedIn', bootstrapData: a, session: { userId: a.user.id, generation: 1 }, repository: mockRepository });
    await applyBootstrap(a);

    const firstToggle = currentValue!.toggleCellarIngredient('gin');
    const secondToggle = currentValue!.toggleCellarIngredient('lime');
    await waitFor(() => expect(mockRepository.batchCellarItems).toHaveBeenCalledTimes(1));
    await switchSession({ status: 'signedIn', bootstrapData: b, session: { userId: b.user.id, generation: 2 }, repository: mockRepository });
    await applyBootstrap(b);
    await act(async () => {
      first.resolve({ items: [{ id: '7364864c-3a48-4ca8-90b7-04f049b3227b', ingredientId: 'gin', customName: null, amountLabel: null, note: null, source: 'MANUAL', createdAt: '2026-07-29T08:00:00.000Z', updatedAt: '2026-07-29T08:00:00.000Z' }] });
      await Promise.all([firstToggle, secondToggle]);
    });

    expect(mockRepository.batchCellarItems).toHaveBeenCalledTimes(1);
    expect(screen.getByText('B')).toBeTruthy();
    expect(currentValue?.localState.cellarIngredientIds).toEqual([]);
  });

  it('keeps the newest profile and privacy intent when older responses resolve last', async () => {
    const a = bootstrapFor('5364864c-3a48-4ca8-90b7-04f049b3227b', 'A');
    const profileFirst = deferred<Awaited<ReturnType<AuthRepository['patchProfile']>>>();
    const profileSecond = deferred<Awaited<ReturnType<AuthRepository['patchProfile']>>>();
    const privacyFirst = deferred<Awaited<ReturnType<AuthRepository['patchPrivacy']>>>();
    const privacySecond = deferred<Awaited<ReturnType<AuthRepository['patchPrivacy']>>>();
    mockRepository.patchProfile.mockImplementationOnce(() => profileFirst.promise).mockImplementationOnce(() => profileSecond.promise);
    mockRepository.patchPrivacy.mockImplementationOnce(() => privacyFirst.promise).mockImplementationOnce(() => privacySecond.promise);
    await render(<Harness />);
    await waitFor(() => expect(refresh).not.toBeNull());
    await switchSession({ status: 'signedIn', bootstrapData: a, session: { userId: a.user.id, generation: 1 }, repository: mockRepository });
    await applyBootstrap(a);

    const firstProfile = currentValue!.updateUserProfile({ nickname: '旧意图' });
    const secondProfile = currentValue!.updateUserProfile({ nickname: '新意图' });
    const firstPrivacy = currentValue!.updatePrivacySettings({ ...a.privacy, analyticsOptIn: true });
    const secondPrivacy = currentValue!.updatePrivacySettings({ ...a.privacy, localOnlyMode: true });
    await act(async () => {
      profileSecond.resolve({ ...a.profile, nickname: '新意图' });
      privacySecond.resolve({ ...a.privacy, localOnlyMode: true });
      await Promise.resolve();
      profileFirst.resolve({ ...a.profile, nickname: '旧意图' });
      privacyFirst.resolve({ ...a.privacy, analyticsOptIn: true });
      await Promise.all([firstProfile, secondProfile, firstPrivacy, secondPrivacy]);
    });

    expect(currentValue?.userProfile.nickname).toBe('新意图');
    expect(currentValue?.localState.privacySettings).toEqual({ ...a.privacy, localOnlyMode: true });
  });

  it('does not commit A profile or privacy responses after B becomes active', async () => {
    const a = bootstrapFor('5364864c-3a48-4ca8-90b7-04f049b3227b', 'A');
    const b = bootstrapFor('6364864c-3a48-4ca8-90b7-04f049b3227b', 'B');
    const profile = deferred<Awaited<ReturnType<AuthRepository['patchProfile']>>>();
    const privacy = deferred<Awaited<ReturnType<AuthRepository['patchPrivacy']>>>();
    mockRepository.patchProfile.mockImplementationOnce(() => profile.promise);
    mockRepository.patchPrivacy.mockImplementationOnce(() => privacy.promise);
    const screen = await render(<Harness />);
    await waitFor(() => expect(refresh).not.toBeNull());
    await switchSession({ status: 'signedIn', bootstrapData: a, session: { userId: a.user.id, generation: 1 }, repository: mockRepository });
    await applyBootstrap(a);

    const updatingProfile = currentValue!.updateUserProfile({ nickname: 'A 的旧回包' });
    const updatingPrivacy = currentValue!.updatePrivacySettings({ ...a.privacy, analyticsOptIn: true });
    await switchSession({ status: 'signedIn', bootstrapData: b, session: { userId: b.user.id, generation: 2 }, repository: mockRepository });
    await applyBootstrap(b);
    await act(async () => {
      profile.resolve({ ...a.profile, nickname: 'A 的旧回包' });
      privacy.resolve({ ...a.privacy, analyticsOptIn: true });
      await Promise.all([updatingProfile, updatingPrivacy]);
    });

    expect(screen.getByText('B')).toBeTruthy();
    expect(currentValue?.localState.privacySettings).toEqual(b.privacy);
  });
});
