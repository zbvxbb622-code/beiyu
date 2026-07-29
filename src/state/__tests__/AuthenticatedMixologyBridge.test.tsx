import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { useEffect, useState, type ReactNode } from 'react';
import { Text } from 'react-native';

import { AuthenticatedMixologyBridge } from '@/state/AuthenticatedMixologyBridge';
import { MixologyProvider, useMixology } from '@/state/MixologyState';
import type { BootstrapResponse } from '@/services/auth/authSchemas';

const mockRepository = {};
let mockAuthSnapshot: { status: 'signedOut' | 'signedIn'; bootstrapData: BootstrapResponse | null; repository: typeof mockRepository };
let refreshBridge: (() => void) | null = null;

jest.mock('@/state/AuthState', () => ({
  useAuth: () => mockAuthSnapshot,
}));

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

function ProfileProbe() {
  const { userProfile } = useMixology();
  return <Text>{userProfile.nickname}</Text>;
}

function Harness({ children, onReady }: { children: ReactNode; onReady: (refresh: () => void) => void }) {
  const [, refresh] = useState(0);
  useEffect(() => {
    onReady(() => refresh((value) => value + 1));
  }, [onReady]);
  return <MixologyProvider><AuthenticatedMixologyBridge>{children}</AuthenticatedMixologyBridge></MixologyProvider>;
}

describe('AuthenticatedMixologyBridge', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    mockAuthSnapshot = { status: 'signedOut', bootstrapData: null, repository: mockRepository };
    refreshBridge = null;
  });

  it('applies bootstrap once per authenticated user and ignores signed-out stale data', async () => {
    const first = bootstrapFor('5364864c-3a48-4ca8-90b7-04f049b3227b', '第一位杯友');
    const second = bootstrapFor('6364864c-3a48-4ca8-90b7-04f049b3227b', '第二位杯友');
    const screen = await render(<Harness onReady={(refresh) => { refreshBridge = refresh; }}><ProfileProbe /></Harness>);

    await waitFor(() => expect(screen.getByText('游客调酒师')).toBeTruthy());
    await waitFor(() => expect(refreshBridge).not.toBeNull());
    mockAuthSnapshot = { status: 'signedIn', bootstrapData: first, repository: mockRepository };
    await act(async () => { refreshBridge!(); });
    await screen.findByText('第一位杯友');

    mockAuthSnapshot = { status: 'signedOut', bootstrapData: second, repository: mockRepository };
    await act(async () => { refreshBridge!(); });
    expect(screen.queryByText('第二位杯友')).toBeNull();

    mockAuthSnapshot = { status: 'signedIn', bootstrapData: second, repository: mockRepository };
    await act(async () => { refreshBridge!(); });
    await screen.findByText('第二位杯友');

    mockAuthSnapshot = { status: 'signedIn', bootstrapData: { ...first, profile: { ...first.profile, nickname: '陈旧数据' } }, repository: mockRepository };
    await act(async () => { refreshBridge!(); });
    expect(screen.queryByText('陈旧数据')).toBeNull();
    expect(screen.getByText('第二位杯友')).toBeTruthy();
  });
});
