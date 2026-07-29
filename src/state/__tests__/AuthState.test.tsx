import { act, render, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Text } from 'react-native';

import { AuthProvider, createAuthRuntime, loadLocalSyncInput, useAuth, type AuthRuntime } from '@/state/AuthState';
import { AuthRepository, type LocalSyncInput } from '@/services/auth/authRepository';
import type { DeviceInput } from '@/services/auth/authSchemas';
import { tokenStore } from '@/services/auth/tokenStore';
import { defaultUserProfile, loadAuthenticatedState, saveAuthenticatedState } from '@/services/storageService';

const bootstrap = {
  user: {
    id: '0f38f737-b8e9-4f75-8bb3-0b5a53f93afc',
    phoneMasked: '138****0000',
    status: 'ACTIVE' as const,
    ageConfirmed: true,
    memoryEnabled: true,
    membershipLevel: 'FREE' as const,
  },
  profile: {
    nickname: '杯友', avatarKey: 'avatar-default', avatarUri: null, signature: '', city: '上海', gender: null,
    birthday: null, showBirthdayTag: false, showAge: false, showZodiac: false, occupation: null, school: null,
  },
  privacy: { localOnlyMode: false, analyticsOptIn: false, syncWhenLoggedIn: true },
  accountSecurity: { phone: '13800000000', phoneVerified: true, devices: [] },
  cellar: { items: [] },
  ai: { dailyMessageLimit: 50, messagesUsedToday: 0, remaining: 50, resetsAt: '2026-07-29T16:00:00Z' },
  featureFlags: { aiChat: true },
};

type RepositoryMethods = Pick<
  AuthRuntime['repository'],
  'requestSmsCode' | 'login' | 'refresh' | 'logout' | 'bootstrap' | 'syncLocalState'
>;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

type TestRuntime = AuthRuntime & { triggerUnauthorized: () => Promise<void> };

function createRuntime(methods: Partial<RepositoryMethods> = {}, isNewUser = false): TestRuntime {
  const requestSmsCode = jest.fn<AuthRepository['requestSmsCode']>();
  const login = jest.fn<AuthRepository['login']>().mockResolvedValue({
    accessToken: 'login-access',
    refreshToken: 'login-refresh',
    expiresIn: 900,
    refreshExpiresIn: 2_592_000,
    isNewUser,
    user: bootstrap.user,
    device: {
      id: '5364864c-3a48-4ca8-90b7-04f049b3227b',
      platform: 'IOS',
      deviceName: 'Test iPhone',
      appVersion: '1.0.0',
      lastActiveAt: '2026-07-29T08:00:00.000Z',
      isCurrent: true,
    },
  });
  const refresh = jest.fn<AuthRepository['refresh']>().mockResolvedValue({
    accessToken: 'restored-access', refreshToken: 'rotated-refresh', expiresIn: 900, refreshExpiresIn: 2_592_000,
  });
  const logout = jest.fn<AuthRepository['logout']>().mockResolvedValue();
  const loadBootstrap = jest.fn<AuthRepository['bootstrap']>().mockResolvedValue(bootstrap);
  const syncLocalState = jest.fn<AuthRepository['syncLocalState']>().mockResolvedValue(bootstrap);
  const repository = {
    requestSmsCode,
    login,
    refresh,
    logout,
    bootstrap: loadBootstrap,
    syncLocalState,
    ...methods,
  } as unknown as AuthRuntime['repository'];

  let unauthorizedHandler: () => Promise<void> = async () => undefined;
  return {
    repository,
    authenticatedRequest: (async () => undefined) as AuthRuntime['authenticatedRequest'],
    setAccessToken: jest.fn<(accessToken: string | null) => void>(),
    getDeviceIdentity: jest.fn<() => Promise<DeviceInput>>().mockResolvedValue({
      installationId: 'installation-123', platform: 'IOS', deviceName: 'Test iPhone', appVersion: '1.0.0',
    }),
    loadLocalSyncInput: jest.fn<() => Promise<LocalSyncInput>>().mockResolvedValue({
      ageVerified: true,
      profile: { nickname: '本地杯友' },
      privacySettings: { localOnlyMode: true },
      cellarIngredientIds: ['gin'],
    }),
    setUnauthorizedHandler: (handler) => {
      unauthorizedHandler = handler;
    },
    triggerUnauthorized: () => unauthorizedHandler(),
  };
}

function StatusProbe() {
  const { status } = useAuth();
  return <Text>{status}</Text>;
}

function AuthProbe({ onReady }: { onReady: (auth: ReturnType<typeof useAuth>) => void }) {
  const auth = useAuth();
  onReady(auth);
  return <Text>{auth.status}</Text>;
}

function SessionProbe({ onReady }: { onReady: (auth: ReturnType<typeof useAuth>) => void }) {
  const auth = useAuth();
  onReady(auth);
  return <Text>{`${auth.status}:${auth.bootstrapData?.profile.nickname ?? 'none'}:${auth.session.userId ?? 'none'}`}</Text>;
}

function bootstrapFor(userId: string, nickname: string) {
  return {
    ...bootstrap,
    user: { ...bootstrap.user, id: userId },
    profile: { ...bootstrap.profile, nickname },
  };
}

describe('AuthProvider', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('does not include a previous account mirror when syncing a new account', async () => {
    const previousUserId = '5364864c-3a48-4ca8-90b7-04f049b3227b';
    await saveAuthenticatedState({
      userId: previousUserId,
      localState: { ageVerified: true, cellarIngredientIds: ['gin'], privacySettings: { localOnlyMode: false, analyticsOptIn: true, syncWhenLoggedIn: true } },
      userProfile: { ...defaultUserProfile, nickname: 'A 的资料' },
      accountSecurity: (await loadAuthenticatedState(previousUserId)).accountSecurity,
    });
    const runtime = createRuntime({}, true);
    runtime.loadLocalSyncInput = loadLocalSyncInput;
    jest.spyOn(tokenStore, 'getRefreshToken').mockResolvedValue(null);
    let auth: ReturnType<typeof useAuth> | undefined;
    const screen = await render(<AuthProvider runtime={runtime}><AuthProbe onReady={(value) => { auth = value; }} /></AuthProvider>);
    await screen.findByText('signedOut');

    await act(async () => { await auth?.login('13800000000', '123456'); });

    expect(runtime.repository.syncLocalState).toHaveBeenCalledWith(expect.objectContaining({
      ageVerified: false,
      cellarIngredientIds: [],
      profile: expect.objectContaining({ nickname: '游客调酒师' }),
    }));
  });

  it('restores a stored session, keeps the access token in memory, and bootstraps the account', async () => {
    jest.spyOn(tokenStore, 'getRefreshToken').mockResolvedValue('stored-refresh-token');
    const runtime = createRuntime();
    const screen = await render(<AuthProvider runtime={runtime}><StatusProbe /></AuthProvider>);

    expect(await screen.findByText('signedIn')).toBeTruthy();
    expect(runtime.repository.refresh).toHaveBeenCalledTimes(1);
    expect(runtime.repository.bootstrap).toHaveBeenCalledTimes(1);
  });

  it('becomes signed out without calling refresh when no refresh token is stored', async () => {
    jest.spyOn(tokenStore, 'getRefreshToken').mockResolvedValue(null);
    const runtime = createRuntime();
    const screen = await render(<AuthProvider runtime={runtime}><StatusProbe /></AuthProvider>);

    expect(await screen.findByText('signedOut')).toBeTruthy();
    expect(runtime.repository.refresh).not.toHaveBeenCalled();
    expect(runtime.repository.bootstrap).not.toHaveBeenCalled();
  });

  it('clears the stored refresh token and becomes signed out when restore refresh fails', async () => {
    jest.spyOn(tokenStore, 'getRefreshToken').mockResolvedValue('expired-refresh-token');
    const clearRefreshToken = jest.spyOn(tokenStore, 'clearRefreshToken').mockResolvedValue();
    const refresh = jest.fn<AuthRepository['refresh']>().mockRejectedValue(new Error('expired'));
    const runtime = createRuntime({ refresh });
    const screen = await render(<AuthProvider runtime={runtime}><StatusProbe /></AuthProvider>);

    expect(await screen.findByText('signedOut')).toBeTruthy();
    expect(clearRefreshToken).toHaveBeenCalledTimes(1);
  });

  it('ends restoration as signed out when SecureStore cannot read the refresh token', async () => {
    jest.spyOn(tokenStore, 'getRefreshToken').mockRejectedValue(new Error('secure storage unavailable'));
    const runtime = createRuntime();
    const screen = await render(<AuthProvider runtime={runtime}><StatusProbe /></AuthProvider>);

    expect(await screen.findByText('signedOut')).toBeTruthy();
    expect(runtime.repository.refresh).not.toHaveBeenCalled();
  });

  it('syncs local first-run data before bootstrapping a new account', async () => {
    jest.spyOn(tokenStore, 'getRefreshToken').mockResolvedValue(null);
    const runtime = createRuntime({}, true);
    let auth: ReturnType<typeof useAuth> | undefined;
    const screen = await render(<AuthProvider runtime={runtime}><AuthProbe onReady={(value) => { auth = value; }} /></AuthProvider>);
    await screen.findByText('signedOut');

    await act(async () => { await auth?.login('13800000000', '123456'); });

    expect(runtime.loadLocalSyncInput).toHaveBeenCalledTimes(1);
    expect(runtime.repository.syncLocalState).toHaveBeenCalledWith({
      ageVerified: true,
      profile: { nickname: '本地杯友' },
      privacySettings: { localOnlyMode: true },
      cellarIngredientIds: ['gin'],
    });
    expect(runtime.repository.bootstrap).toHaveBeenCalledTimes(1);
    expect(
      (runtime.repository.syncLocalState as jest.Mock).mock.invocationCallOrder[0]
    ).toBeLessThan((runtime.repository.bootstrap as jest.Mock).mock.invocationCallOrder[0]);
    expect(screen.getByText('signedIn')).toBeTruthy();
  });

  it('bootstraps an existing account without overwriting it from local data', async () => {
    jest.spyOn(tokenStore, 'getRefreshToken').mockResolvedValue(null);
    const runtime = createRuntime({}, false);
    let auth: ReturnType<typeof useAuth> | undefined;
    const screen = await render(<AuthProvider runtime={runtime}><AuthProbe onReady={(value) => { auth = value; }} /></AuthProvider>);
    await screen.findByText('signedOut');

    await act(async () => { await auth?.login('13800000000', '123456'); });

    expect(runtime.loadLocalSyncInput).not.toHaveBeenCalled();
    expect(runtime.repository.syncLocalState).not.toHaveBeenCalled();
    expect(runtime.repository.bootstrap).toHaveBeenCalledTimes(1);
  });

  it('rolls back both token stores when post-login initialization fails', async () => {
    jest.spyOn(tokenStore, 'getRefreshToken').mockResolvedValue(null);
    const clearRefreshToken = jest.spyOn(tokenStore, 'clearRefreshToken').mockResolvedValue();
    const initializationFailure = new Error('local sync timed out');
    const runtime = createRuntime({ syncLocalState: jest.fn<AuthRepository['syncLocalState']>().mockRejectedValue(initializationFailure) }, true);
    let auth: ReturnType<typeof useAuth> | undefined;
    const screen = await render(<AuthProvider runtime={runtime}><AuthProbe onReady={(value) => { auth = value; }} /></AuthProvider>);
    await screen.findByText('signedOut');
    expect(auth?.repository).toBe(runtime.repository);

    await act(async () => {
      await expect(auth?.login('13800000000', '123456')).rejects.toThrow(initializationFailure);
    });

    expect(runtime.repository.syncLocalState).toHaveBeenCalledTimes(1);
    expect(runtime.setAccessToken).toHaveBeenLastCalledWith(null);
    expect(clearRefreshToken).toHaveBeenCalledTimes(1);
    expect(screen.getByText('signedOut')).toBeTruthy();
  });

  it('preserves the original initialization failure when refresh-token cleanup also fails', async () => {
    jest.spyOn(tokenStore, 'getRefreshToken').mockResolvedValue(null);
    const cleanupFailure = new Error('secure storage unavailable');
    const originalFailure = new Error('bootstrap timed out');
    const clearRefreshToken = jest.spyOn(tokenStore, 'clearRefreshToken').mockRejectedValue(cleanupFailure);
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const runtime = createRuntime({ bootstrap: jest.fn<AuthRepository['bootstrap']>().mockRejectedValue(originalFailure) });
    let auth: ReturnType<typeof useAuth> | undefined;
    const screen = await render(<AuthProvider runtime={runtime}><AuthProbe onReady={(value) => { auth = value; }} /></AuthProvider>);
    await screen.findByText('signedOut');

    await act(async () => {
      await expect(auth?.login('13800000000', '123456')).rejects.toBe(originalFailure);
    });

    expect(clearRefreshToken).toHaveBeenCalledTimes(1);
    expect(runtime.setAccessToken).toHaveBeenLastCalledWith(null);
    expect(screen.getByText('signedOut')).toBeTruthy();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('moves a mounted provider to signed out when the authenticated client invalidates a session', async () => {
    jest.spyOn(tokenStore, 'getRefreshToken').mockResolvedValue('stored-refresh-token');
    const clearRefreshToken = jest.spyOn(tokenStore, 'clearRefreshToken').mockResolvedValue();
    const runtime = createRuntime();
    const screen = await render(<AuthProvider runtime={runtime}><StatusProbe /></AuthProvider>);
    await screen.findByText('signedIn');

    await act(async () => { await runtime.triggerUnauthorized(); });

    expect(runtime.setAccessToken).toHaveBeenLastCalledWith(null);
    expect(clearRefreshToken).toHaveBeenCalledTimes(1);
    expect(screen.getByText('signedOut')).toBeTruthy();
  });

  it('logs out through the repository and clears the in-memory authenticated state', async () => {
    jest.spyOn(tokenStore, 'getRefreshToken').mockResolvedValue('stored-refresh-token');
    const runtime = createRuntime();
    let auth: ReturnType<typeof useAuth> | undefined;
    const screen = await render(<AuthProvider runtime={runtime}><AuthProbe onReady={(value) => { auth = value; }} /></AuthProvider>);
    await screen.findByText('signedIn');

    await act(async () => { await auth?.logout(); });

    expect(runtime.repository.logout).toHaveBeenCalledTimes(1);
    expect(screen.getByText('signedOut')).toBeTruthy();
  });

  it('does not let a delayed A bootstrap replace B after logout and login', async () => {
    jest.spyOn(tokenStore, 'getRefreshToken').mockResolvedValue(null);
    const a = bootstrapFor('5364864c-3a48-4ca8-90b7-04f049b3227b', 'A');
    const b = bootstrapFor('6364864c-3a48-4ca8-90b7-04f049b3227b', 'B');
    const delayedA = deferred<typeof bootstrap>();
    const loadBootstrap = jest.fn<AuthRepository['bootstrap']>()
      .mockImplementationOnce(() => delayedA.promise)
      .mockResolvedValueOnce(b);
    const runtime = createRuntime({ bootstrap: loadBootstrap });
    let auth: ReturnType<typeof useAuth> | undefined;
    const screen = await render(<AuthProvider runtime={runtime}><SessionProbe onReady={(value) => { auth = value; }} /></AuthProvider>);
    await screen.findByText('signedOut:none:none');

    let loggingInAsA!: Promise<void>;
    await act(async () => {
      loggingInAsA = auth!.login('13800000000', '123456');
      await Promise.resolve();
    });
    await waitFor(() => expect(loadBootstrap).toHaveBeenCalledTimes(1));
    await act(async () => { await auth!.logout(); });
    await act(async () => { await auth!.login('13900000000', '123456'); });
    expect(screen.getByText(`signedIn:B:${b.user.id}`)).toBeTruthy();

    await act(async () => {
      delayedA.resolve(a);
      await loggingInAsA;
    });

    expect(screen.getByText(`signedIn:B:${b.user.id}`)).toBeTruthy();
    expect(screen.queryByText(`signedIn:A:${a.user.id}`)).toBeNull();
  });

  it('revokes visible auth state before a delayed refresh-token cleanup can finish', async () => {
    jest.spyOn(tokenStore, 'getRefreshToken').mockResolvedValue('stored-refresh-token');
    const delayedClear = deferred<void>();
    jest.spyOn(tokenStore, 'clearRefreshToken').mockImplementation(() => delayedClear.promise);
    const b = bootstrapFor('6364864c-3a48-4ca8-90b7-04f049b3227b', 'B');
    const runtime = createRuntime({ bootstrap: jest.fn<AuthRepository['bootstrap']>().mockResolvedValueOnce(bootstrap).mockResolvedValueOnce(b) });
    let auth: ReturnType<typeof useAuth> | undefined;
    const screen = await render(<AuthProvider runtime={runtime}><SessionProbe onReady={(value) => { auth = value; }} /></AuthProvider>);
    await screen.findByText(`signedIn:${bootstrap.profile.nickname}:${bootstrap.user.id}`);

    let loggingOut!: Promise<void>;
    await act(async () => {
      loggingOut = auth!.logout();
      await Promise.resolve();
    });

    expect(screen.getByText('signedOut:none:none')).toBeTruthy();
    expect(runtime.setAccessToken).toHaveBeenLastCalledWith(null);

    await act(async () => { await auth!.login('13900000000', '123456'); });
    expect(screen.getByText(`signedIn:B:${b.user.id}`)).toBeTruthy();

    await act(async () => {
      delayedClear.resolve();
      await loggingOut;
    });

    expect(screen.getByText(`signedIn:B:${b.user.id}`)).toBeTruthy();
  });

  it('does not update React state after it unmounts while restoring', async () => {
    const refresh = deferred<Awaited<ReturnType<AuthRepository['refresh']>>>();
    jest.spyOn(tokenStore, 'getRefreshToken').mockResolvedValue('stored-refresh-token');
    const runtime = createRuntime({ refresh: jest.fn<AuthRepository['refresh']>(() => refresh.promise) });
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const screen = await render(<AuthProvider runtime={runtime}><StatusProbe /></AuthProvider>);

    screen.unmount();
    await act(async () => {
      refresh.resolve({
        accessToken: 'late-access', refreshToken: 'rotated-refresh', expiresIn: 900, refreshExpiresIn: 2_592_000,
      });
    });

    expect(consoleError).not.toHaveBeenCalledWith(expect.stringContaining('unmounted'));
  });

  it('builds the production runtime from the Task 2-3 repository and authenticated client', () => {
    expect(createAuthRuntime()).toEqual(expect.objectContaining({
      repository: expect.anything(),
      authenticatedRequest: expect.any(Function),
    }));
  });
});
