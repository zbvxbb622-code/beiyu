import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { useEffect } from 'react';
import { Text } from 'react-native';

import type { BootstrapResponse } from '@/services/auth/authSchemas';
import type { AuthRepository } from '@/services/auth/authRepository';
import { loadAuthenticatedState, loadLocalState, loadUserProfile } from '@/services/storageService';
import { MixologyProvider, useMixology } from '@/state/MixologyState';

type MixologyValue = ReturnType<typeof useMixology>;

let currentValue: MixologyValue | null = null;
const mockRepository = {
  confirmAge: jest.fn<AuthRepository['confirmAge']>(),
  patchProfile: jest.fn<AuthRepository['patchProfile']>(),
  patchPrivacy: jest.fn<AuthRepository['patchPrivacy']>(),
  batchCellarItems: jest.fn<AuthRepository['batchCellarItems']>(),
};
let mockAuthSnapshot: {
  status: 'signedOut' | 'signedIn';
  repository: typeof mockRepository;
} = {
  status: 'signedOut',
  repository: mockRepository,
};

jest.mock('@/state/AuthState', () => ({
  useAuth: () => mockAuthSnapshot,
}));

const bootstrap: BootstrapResponse = {
  user: {
    id: '5364864c-3a48-4ca8-90b7-04f049b3227b',
    phoneMasked: '138****0000',
    status: 'ACTIVE',
    ageConfirmed: true,
    memoryEnabled: true,
    membershipLevel: 'FREE',
  },
  profile: {
    nickname: '云端杯友',
    avatarKey: 'avatarTwo',
    avatarUri: null,
    signature: '只喝经典',
    city: '上海',
    gender: '女',
    birthday: '1998-01-02',
    showBirthdayTag: false,
    showAge: false,
    showZodiac: true,
    occupation: '调酒师',
    school: '杯语学院',
  },
  privacy: {
    localOnlyMode: false,
    analyticsOptIn: true,
    syncWhenLoggedIn: true,
  },
  accountSecurity: {
    phone: '138****0000',
    phoneVerified: true,
    wechatBound: true,
    wechatAccount: 'cup-friend',
    passwordSet: true,
    realnameVerified: true,
    realnameName: '杯友',
    officialVerified: true,
    officialType: '调酒师',
    devices: [
      {
        id: '6364864c-3a48-4ca8-90b7-04f049b3227b',
        name: 'Test iPhone',
        platform: 'IOS',
        lastActiveAt: '2026-07-29T08:00:00.000Z',
        isCurrent: true,
      },
    ],
  },
  cellar: {
    items: [
      {
        id: '7364864c-3a48-4ca8-90b7-04f049b3227b',
        ingredientId: 'gin',
        customName: null,
        amountLabel: null,
        note: null,
        source: 'MANUAL',
        createdAt: '2026-07-29T08:00:00.000Z',
        updatedAt: '2026-07-29T08:00:00.000Z',
      },
      {
        id: '8364864c-3a48-4ca8-90b7-04f049b3227b',
        ingredientId: null,
        customName: '自制糖浆',
        amountLabel: null,
        note: null,
        source: 'MANUAL',
        createdAt: '2026-07-29T08:00:00.000Z',
        updatedAt: '2026-07-29T08:00:00.000Z',
      },
    ],
  },
  ai: {
    dailyMessageLimit: 50,
    messagesUsedToday: 0,
    remaining: 50,
    resetsAt: '2026-07-29T16:00:00.000Z',
  },
  featureFlags: { aiChat: true },
};

function Probe() {
  const value = useMixology();

  useEffect(() => {
    currentValue = value;
  }, [value]);

  return <Text>{value.isHydrated ? 'hydrated' : 'loading'}</Text>;
}

describe('MixologyProvider', () => {
  beforeEach(async () => {
    currentValue = null;
    await AsyncStorage.clear();
    mockAuthSnapshot = { status: 'signedOut', repository: mockRepository };
    Object.values(mockRepository).forEach((method) => method.mockReset());
  });

  it('preserves rapid interaction updates from the same rendered snapshot', async () => {
    const screen = await render(
      <MixologyProvider>
        <Probe />
      </MixologyProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('hydrated')).toBeTruthy();
    });

    const snapshot = currentValue;
    expect(snapshot).not.toBeNull();

    await act(async () => {
      await Promise.all([
        snapshot!.togglePostLike('post-1'),
        snapshot!.toggleAuthorFollow('author-1'),
      ]);
    });

    await waitFor(() => {
      expect(currentValue?.interactionState.likedPostIds).toEqual(['post-1']);
      expect(currentValue?.interactionState.followedAuthorIds).toEqual(['author-1']);
    });
  });

  it('maps bootstrap data to memory and all local mirrors together', async () => {
    const screen = await render(
      <MixologyProvider>
        <Probe />
      </MixologyProvider>
    );
    await screen.findByText('hydrated');

    await act(async () => {
      await currentValue!.applyBootstrap(bootstrap);
    });

    expect(currentValue?.userProfile).toEqual(bootstrap.profile);
    expect(currentValue?.localState).toEqual({
      ageVerified: true,
      cellarIngredientIds: ['gin'],
      privacySettings: bootstrap.privacy,
    });
    expect(currentValue?.accountSecurity).toEqual({
      phone: '138****0000',
      phoneVerified: true,
      wechatBound: true,
      wechatAccount: 'cup-friend',
      passwordSet: true,
      realnameVerified: true,
      realnameName: '',
      officialVerified: true,
      officialType: '调酒师',
      devices: [{
        id: '6364864c-3a48-4ca8-90b7-04f049b3227b',
        name: 'Test iPhone',
        platform: 'iOS',
        lastActive: '2026-07-29T08:00:00.000Z',
        isCurrent: true,
      }],
    });
    await expect(loadAuthenticatedState(bootstrap.user.id)).resolves.toEqual({
      userProfile: bootstrap.profile,
      localState: { ageVerified: true, cellarIngredientIds: ['gin'], privacySettings: bootstrap.privacy },
      accountSecurity: currentValue?.accountSecurity,
    });
  });

  it('keeps the saved profile snapshot unchanged when the remote patch rejects', async () => {
    mockAuthSnapshot = { status: 'signedIn', repository: mockRepository };
    mockRepository.patchProfile.mockRejectedValueOnce(new Error('offline'));
    const screen = await render(<MixologyProvider><Probe /></MixologyProvider>);
    await screen.findByText('hydrated');
    const savedProfile = currentValue!.userProfile;

    await act(async () => {
      await expect(currentValue!.updateUserProfile({ nickname: '未保存的编辑' })).rejects.toThrow('offline');
    });

    expect(currentValue?.userProfile).toEqual(savedProfile);
    await expect(loadUserProfile()).resolves.toEqual(savedProfile);
  });

  it('keeps age and privacy snapshots unchanged when their remote updates reject', async () => {
    mockAuthSnapshot = { status: 'signedIn', repository: mockRepository };
    mockRepository.confirmAge.mockRejectedValueOnce(new Error('age offline'));
    mockRepository.patchPrivacy.mockRejectedValueOnce(new Error('privacy offline'));
    const screen = await render(<MixologyProvider><Probe /></MixologyProvider>);
    await screen.findByText('hydrated');
    const savedLocalState = currentValue!.localState;

    await act(async () => {
      await expect(currentValue!.verifyAge()).rejects.toThrow('age offline');
      await expect(currentValue!.updatePrivacySettings({
        localOnlyMode: false,
        analyticsOptIn: true,
        syncWhenLoggedIn: true,
      })).rejects.toThrow('privacy offline');
    });

    expect(currentValue?.localState).toEqual(savedLocalState);
    await expect(loadLocalState()).resolves.toEqual(savedLocalState);
  });

  it('marks realname verification without persisting the submitted name', async () => {
    mockAuthSnapshot = { status: 'signedIn', repository: mockRepository };
    const screen = await render(<MixologyProvider><Probe /></MixologyProvider>);
    await screen.findByText('hydrated');

    await act(async () => {
      await currentValue!.verifyRealname('张三');
    });

    expect(currentValue?.accountSecurity.realnameVerified).toBe(true);
    expect(currentValue?.accountSecurity.realnameName).toBe('');
    await expect(loadAuthenticatedState('__test-session__')).resolves.toMatchObject({
      accountSecurity: {
        realnameVerified: true,
        realnameName: '',
      },
    });
  });

  it('uses the server cellar response as the final state across rapid toggles', async () => {
    mockAuthSnapshot = { status: 'signedIn', repository: mockRepository };
    mockRepository.batchCellarItems
      .mockResolvedValueOnce({ items: [bootstrap.cellar.items[0]] })
      .mockResolvedValueOnce({ items: [bootstrap.cellar.items[0], { ...bootstrap.cellar.items[0], id: '9364864c-3a48-4ca8-90b7-04f049b3227b', ingredientId: 'lime' }] });
    const screen = await render(<MixologyProvider><Probe /></MixologyProvider>);
    await screen.findByText('hydrated');

    await act(async () => {
      await Promise.all([
        currentValue!.toggleCellarIngredient('gin'),
        currentValue!.toggleCellarIngredient('lime'),
      ]);
    });

    expect(mockRepository.batchCellarItems).toHaveBeenNthCalledWith(1, ['gin']);
    expect(mockRepository.batchCellarItems).toHaveBeenNthCalledWith(2, ['gin', 'lime']);
    expect(currentValue?.localState.cellarIngredientIds).toEqual(['gin', 'lime']);
  });

  it('retries a failed cellar toggle from the last saved server snapshot', async () => {
    mockAuthSnapshot = { status: 'signedIn', repository: mockRepository };
    mockRepository.batchCellarItems
      .mockRejectedValueOnce(new Error('cellar offline'))
      .mockResolvedValueOnce({ items: [bootstrap.cellar.items[0]] });
    const screen = await render(<MixologyProvider><Probe /></MixologyProvider>);
    await screen.findByText('hydrated');

    await act(async () => {
      await expect(currentValue!.toggleCellarIngredient('gin')).rejects.toThrow('cellar offline');
    });
    expect(currentValue?.localState.cellarIngredientIds).toEqual([]);

    await act(async () => {
      await currentValue!.toggleCellarIngredient('gin');
    });

    expect(mockRepository.batchCellarItems).toHaveBeenNthCalledWith(1, ['gin']);
    expect(mockRepository.batchCellarItems).toHaveBeenNthCalledWith(2, ['gin']);
    expect(currentValue?.localState.cellarIngredientIds).toEqual(['gin']);
  });
});
