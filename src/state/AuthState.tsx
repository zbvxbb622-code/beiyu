import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { createAuthenticatedClient, type AuthenticatedClient } from '@/services/api/authenticatedClient';
import { AuthRepository, type LocalSyncInput } from '@/services/auth/authRepository';
import type { BootstrapResponse, DeviceInput } from '@/services/auth/authSchemas';
import { getDeviceIdentity } from '@/services/auth/deviceIdentity';
import { tokenStore } from '@/services/auth/tokenStore';
import { loadLocalState, loadUserProfile } from '@/services/storageService';

export type AuthStatus = 'restoring' | 'signedOut' | 'signedIn';

export type AuthRuntime = {
  repository: AuthRepository;
  authenticatedRequest: AuthenticatedClient['request'];
  getDeviceIdentity: () => Promise<DeviceInput>;
  loadLocalSyncInput: () => Promise<LocalSyncInput>;
  setAccessToken: (accessToken: string | null) => void;
};

type AuthContextValue = {
  status: AuthStatus;
  repository: AuthRepository;
  bootstrapData: BootstrapResponse | null;
  requestSmsCode: (phone: string) => Promise<{ expiresIn: number; retryAfter: number }>;
  login: (phone: string, code: string) => Promise<void>;
  authenticatedRequest: AuthenticatedClient['request'];
  bootstrap: () => Promise<BootstrapResponse>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function loadLocalSyncInput(): Promise<LocalSyncInput> {
  const [localState, profile] = await Promise.all([loadLocalState(), loadUserProfile()]);
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
  const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

  const authenticatedClient = createAuthenticatedClient({
    apiBaseUrl,
    fetch,
    timeoutMs: 15_000,
    getAccessToken: () => accessToken,
    refresh: async () => {
      const tokens = await repository.refresh();
      accessToken = tokens.accessToken;
    },
    onUnauthorized: async () => {
      accessToken = null;
      await tokenStore.clearRefreshToken();
    },
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
  };
}

export function AuthProvider({ children, runtime }: { children: ReactNode; runtime?: AuthRuntime }) {
  const defaultRuntime = useMemo(() => createAuthRuntime(), []);
  const activeRuntime = runtime ?? defaultRuntime;
  const [status, setStatus] = useState<AuthStatus>('restoring');
  const [bootstrapData, setBootstrapData] = useState<BootstrapResponse | null>(null);
  const isMountedRef = useRef(true);

  const setIfMounted = useCallback((callback: () => void) => {
    if (isMountedRef.current) {
      callback();
    }
  }, []);

  const bootstrap = useCallback(async () => {
    const data = await activeRuntime.repository.bootstrap();
    setIfMounted(() => {
      setBootstrapData(data);
      setStatus('signedIn');
    });
    return data;
  }, [activeRuntime, setIfMounted]);

  useEffect(() => {
    isMountedRef.current = true;
    let cancelled = false;

    const restore = async () => {
      const refreshToken = await tokenStore.getRefreshToken();
      if (!refreshToken) {
        if (!cancelled) {
          setIfMounted(() => setStatus('signedOut'));
        }
        return;
      }

      try {
        const tokens = await activeRuntime.repository.refresh();
        activeRuntime.setAccessToken(tokens.accessToken);
        await bootstrap();
      } catch {
        activeRuntime.setAccessToken(null);
        await tokenStore.clearRefreshToken();
        if (!cancelled) {
          setIfMounted(() => {
            setBootstrapData(null);
            setStatus('signedOut');
          });
        }
      }
    };

    void restore();
    return () => {
      cancelled = true;
      isMountedRef.current = false;
    };
  }, [activeRuntime, bootstrap, setIfMounted]);

  const requestSmsCode = useCallback(
    async (phone: string) => {
      const device = await activeRuntime.getDeviceIdentity();
      return activeRuntime.repository.requestSmsCode(phone, device.installationId);
    },
    [activeRuntime]
  );

  const login = useCallback(
    async (phone: string, code: string) => {
      const device = await activeRuntime.getDeviceIdentity();
      const response = await activeRuntime.repository.login({ phone, code, device });
      activeRuntime.setAccessToken(response.accessToken);

      try {
        if (response.isNewUser) {
          await activeRuntime.repository.syncLocalState(await activeRuntime.loadLocalSyncInput());
        }
        await bootstrap();
      } catch (error) {
        setIfMounted(() => setStatus('signedOut'));
        throw error;
      }
    },
    [activeRuntime, bootstrap, setIfMounted]
  );

  const logout = useCallback(async () => {
    try {
      await activeRuntime.repository.logout();
    } finally {
      activeRuntime.setAccessToken(null);
      setIfMounted(() => {
        setBootstrapData(null);
        setStatus('signedOut');
      });
    }
  }, [activeRuntime, setIfMounted]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      repository: activeRuntime.repository,
      bootstrapData,
      requestSmsCode,
      login,
      authenticatedRequest: activeRuntime.authenticatedRequest,
      bootstrap,
      logout,
    }),
    [activeRuntime, bootstrap, bootstrapData, login, logout, requestSmsCode, status]
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
