import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { ApiError, createAuthenticatedClient, type AuthenticatedClient } from '@/services/api/authenticatedClient';
import { AuthRepository, type LocalSyncInput } from '@/services/auth/authRepository';
import type { BootstrapResponse, DeviceInput } from '@/services/auth/authSchemas';
import { getDeviceIdentity } from '@/services/auth/deviceIdentity';
import { tokenStore } from '@/services/auth/tokenStore';
import { loadGuestState } from '@/services/storageService';

export type AuthStatus = 'restoring' | 'signedOut' | 'signedIn';
export type AuthSession = { userId: string | null; generation: number };
type AuthRequestIdentity = { generation: number; refreshToken: string | null };
type AuthRequestHandlers = {
  getAuthIdentity: () => AuthRequestIdentity;
  isAuthIdentityCurrent: (identity: unknown) => boolean;
  refresh: (identity: unknown) => Promise<void>;
  onUnauthorized: (identity: unknown) => Promise<void>;
};

export type AuthRuntime = {
  repository: AuthRepository;
  authenticatedRequest: AuthenticatedClient['request'];
  getDeviceIdentity: () => Promise<DeviceInput>;
  loadLocalSyncInput: () => Promise<LocalSyncInput>;
  setAccessToken: (accessToken: string | null) => void;
  setUnauthorizedHandler: (handler: () => Promise<void>) => void;
  setRequestIdentityHandlers?: (handlers: AuthRequestHandlers | null) => void;
};

type AuthContextValue = {
  status: AuthStatus;
  session: AuthSession;
  repository: AuthRepository;
  bootstrapData: BootstrapResponse | null;
  requestSmsCode: (phone: string) => Promise<{ expiresIn: number; retryAfter: number }>;
  login: (phone: string, code: string) => Promise<void>;
  authenticatedRequest: AuthenticatedClient['request'];
  bootstrap: () => Promise<BootstrapResponse>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export async function loadLocalSyncInput(): Promise<LocalSyncInput> {
  const { localState, userProfile: profile } = await loadGuestState();
  return {
    ageVerified: localState.ageVerified,
    profile,
    privacySettings: localState.privacySettings,
    cellarIngredientIds: localState.cellarIngredientIds,
  };
}

export function createAuthRuntime(): AuthRuntime {
  let accessToken: string | null = null;
  let repository: AuthRepository;
  const anonymousRequestIdentity: AuthRequestIdentity = { generation: 0, refreshToken: null };
  let unauthorizedHandler = async () => {
    await tokenStore.clearRefreshToken();
  };
  let requestIdentityHandlers: AuthRequestHandlers = {
    getAuthIdentity: () => anonymousRequestIdentity,
    isAuthIdentityCurrent: (identity) => identity === anonymousRequestIdentity,
    refresh: async () => {
      const tokens = await repository.refresh();
      accessToken = tokens.accessToken;
    },
    onUnauthorized: async () => unauthorizedHandler(),
  };
  const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

  const authenticatedClient = createAuthenticatedClient({
    apiBaseUrl,
    fetch,
    timeoutMs: 15_000,
    getAccessToken: () => accessToken,
    getAuthIdentity: () => requestIdentityHandlers.getAuthIdentity(),
    isAuthIdentityCurrent: (identity) => requestIdentityHandlers.isAuthIdentityCurrent(identity),
    refresh: (identity) => requestIdentityHandlers.refresh(identity),
    onUnauthorized: (identity) => requestIdentityHandlers.onUnauthorized(identity),
  });

  repository = new AuthRepository({
    apiBaseUrl,
    fetch,
    timeoutMs: 15_000,
    authenticatedClient,
  });

  return {
    repository,
    authenticatedRequest: authenticatedClient.request,
    getDeviceIdentity,
    loadLocalSyncInput,
    setAccessToken: (nextAccessToken) => {
      accessToken = nextAccessToken;
    },
    setUnauthorizedHandler: (handler) => {
      unauthorizedHandler = handler;
    },
    setRequestIdentityHandlers: (handlers) => {
      requestIdentityHandlers = handlers ?? {
        getAuthIdentity: () => anonymousRequestIdentity,
        isAuthIdentityCurrent: (identity) => identity === anonymousRequestIdentity,
        refresh: async () => {
          const tokens = await repository.refresh();
          accessToken = tokens.accessToken;
        },
        onUnauthorized: async () => unauthorizedHandler(),
      };
    },
  };
}

export function AuthProvider({ children, runtime }: { children: ReactNode; runtime?: AuthRuntime }) {
  const defaultRuntime = useMemo(() => createAuthRuntime(), []);
  const activeRuntime = runtime ?? defaultRuntime;
  const [status, setStatus] = useState<AuthStatus>('restoring');
  const [bootstrapData, setBootstrapData] = useState<BootstrapResponse | null>(null);
  const [session, setSession] = useState<AuthSession>({ userId: null, generation: 0 });
  const isMountedRef = useRef(true);
  const generationRef = useRef(0);
  const refreshTokenRef = useRef<string | null>(null);
  const authIdentityRef = useRef<AuthRequestIdentity>({ generation: 0, refreshToken: null });

  const setIfMounted = useCallback((callback: () => void) => {
    if (isMountedRef.current) {
      callback();
    }
  }, []);

  const isCurrentGeneration = useCallback((generation: number) => (
    isMountedRef.current && generationRef.current === generation
  ), []);

  const publishSignedOut = useCallback((generation: number) => {
    setIfMounted(() => {
      if (!isCurrentGeneration(generation)) return;
      setBootstrapData(null);
      setStatus('signedOut');
      setSession({ userId: null, generation });
    });
  }, [isCurrentGeneration, setIfMounted]);

  const beginGeneration = useCallback(() => {
    generationRef.current += 1;
    authIdentityRef.current = {
      generation: generationRef.current,
      refreshToken: refreshTokenRef.current,
    };
    return generationRef.current;
  }, []);

  const setRefreshTokenIdentity = useCallback((refreshToken: string | null) => {
    refreshTokenRef.current = refreshToken;
    authIdentityRef.current = {
      generation: generationRef.current,
      refreshToken,
    };
  }, []);

  const isCurrentRequestIdentity = useCallback((identity: unknown): identity is AuthRequestIdentity => (
    typeof identity === 'object'
    && identity !== null
    && 'generation' in identity
    && typeof identity.generation === 'number'
    && isCurrentGeneration(identity.generation)
  ), [isCurrentGeneration]);

  const clearSession = useCallback(async (expectedGeneration?: number) => {
    if (expectedGeneration !== undefined && !isCurrentGeneration(expectedGeneration)) return;
    const refreshToken = refreshTokenRef.current;
    const generation = beginGeneration();
    setRefreshTokenIdentity(null);
    activeRuntime.setAccessToken(null);
    publishSignedOut(generation);
    try {
      await tokenStore.clearRefreshToken(refreshToken);
    } catch {
      // Token cleanup is best effort and must not obscure the authentication failure.
    }
  }, [activeRuntime, beginGeneration, isCurrentGeneration, publishSignedOut, setRefreshTokenIdentity]);

  const beginLogin = useCallback(() => {
    const refreshToken = refreshTokenRef.current;
    const generation = beginGeneration();
    setRefreshTokenIdentity(null);
    activeRuntime.setAccessToken(null);
    publishSignedOut(generation);
    if (refreshToken !== null) {
      void tokenStore.clearRefreshToken(refreshToken).catch(() => undefined);
    }
    return generation;
  }, [activeRuntime, beginGeneration, publishSignedOut, setRefreshTokenIdentity]);

  const bootstrap = useCallback(async (expectedGeneration = generationRef.current) => {
    const data = await activeRuntime.repository.bootstrap();
    if (!isCurrentGeneration(expectedGeneration)) return data;
    const generation = beginGeneration();
    setIfMounted(() => {
      if (!isCurrentGeneration(generation)) return;
      setBootstrapData(data);
      setStatus('signedIn');
      setSession({ userId: data.user.id, generation });
    });
    return data;
  }, [activeRuntime, beginGeneration, isCurrentGeneration, setIfMounted]);

  useEffect(() => {
    activeRuntime.setUnauthorizedHandler(clearSession);
    return () => {
      activeRuntime.setUnauthorizedHandler(async () => {
        activeRuntime.setAccessToken(null);
        try {
          await tokenStore.clearRefreshToken();
        } catch {
          // The authenticated client preserves its original unauthorized error.
        }
      });
    };
  }, [activeRuntime, clearSession]);

  useEffect(() => {
    activeRuntime.setRequestIdentityHandlers?.({
      getAuthIdentity: () => authIdentityRef.current,
      isAuthIdentityCurrent: isCurrentRequestIdentity,
      refresh: async (identity) => {
        if (!isCurrentRequestIdentity(identity)) {
          throw new ApiError('stale-session', 401, {});
        }
        const tokens = await activeRuntime.repository.refresh(identity.refreshToken);
        if (!isCurrentRequestIdentity(identity)) {
          throw new ApiError('stale-session', 401, {});
        }
        setRefreshTokenIdentity(tokens.refreshToken);
        activeRuntime.setAccessToken(tokens.accessToken);
      },
      onUnauthorized: async (identity) => {
        if (!isCurrentRequestIdentity(identity)) return;
        await clearSession(identity.generation);
      },
    });
    return () => activeRuntime.setRequestIdentityHandlers?.(null);
  }, [activeRuntime, clearSession, isCurrentRequestIdentity, setRefreshTokenIdentity]);

  useEffect(() => {
    isMountedRef.current = true;
    let cancelled = false;
    const restoreGeneration = generationRef.current;

    const restore = async () => {
      try {
        const refreshToken = await tokenStore.getRefreshToken();
        if (!refreshToken) {
          if (!cancelled && isCurrentGeneration(restoreGeneration)) {
            publishSignedOut(restoreGeneration);
          }
          return;
        }

        if (cancelled || !isCurrentGeneration(restoreGeneration)) return;
        setRefreshTokenIdentity(refreshToken);
        const tokens = await activeRuntime.repository.refresh(refreshToken);
        if (cancelled || !isCurrentGeneration(restoreGeneration)) return;
        setRefreshTokenIdentity(tokens.refreshToken);
        activeRuntime.setAccessToken(tokens.accessToken);
        await bootstrap(restoreGeneration);
      } catch {
        if (!cancelled && isCurrentGeneration(restoreGeneration)) {
          await clearSession(restoreGeneration);
        }
      }
    };

    void restore();
    return () => {
      cancelled = true;
      isMountedRef.current = false;
    };
  }, [activeRuntime, bootstrap, clearSession, isCurrentGeneration, publishSignedOut, setRefreshTokenIdentity]);

  const requestSmsCode = useCallback(
    async (phone: string) => {
      const device = await activeRuntime.getDeviceIdentity();
      return activeRuntime.repository.requestSmsCode(phone, device.installationId);
    },
    [activeRuntime]
  );

  const login = useCallback(
    async (phone: string, code: string) => {
      const loginGeneration = beginLogin();
      const device = await activeRuntime.getDeviceIdentity();
      const response = await activeRuntime.repository.login({ phone, code, device });
      if (!isCurrentGeneration(loginGeneration)) return;
      setRefreshTokenIdentity(response.refreshToken);
      activeRuntime.setAccessToken(response.accessToken);

      try {
        if (response.isNewUser) {
          await activeRuntime.repository.syncLocalState(await activeRuntime.loadLocalSyncInput());
          if (!isCurrentGeneration(loginGeneration)) return;
        }
        await bootstrap(loginGeneration);
      } catch (error) {
        await clearSession(loginGeneration);
        throw error;
      }
    },
    [activeRuntime, beginLogin, bootstrap, clearSession, isCurrentGeneration, setRefreshTokenIdentity]
  );

  const logout = useCallback(async () => {
    const cleanup = clearSession();
    try {
      await activeRuntime.repository.logout();
    } catch {
      // Local revocation is authoritative even if the logout request cannot reach the server.
    } finally {
      await cleanup;
    }
  }, [activeRuntime, clearSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      repository: activeRuntime.repository,
      bootstrapData,
      requestSmsCode,
      login,
      authenticatedRequest: activeRuntime.authenticatedRequest,
      bootstrap,
      logout,
    }),
    [activeRuntime, bootstrap, bootstrapData, login, logout, requestSmsCode, session, status]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return value;
}
