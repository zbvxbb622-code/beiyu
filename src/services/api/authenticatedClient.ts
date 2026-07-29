import type { z } from 'zod';

import { apiErrorEnvelopeSchema } from './apiSchemas';

export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly details: Record<string, unknown>
  ) {
    super(code);
    this.name = 'ApiError';
  }
}

type RequestWithSchema = <Schema extends z.ZodType>(
  path: string,
  init: RequestInit,
  schema: Schema
) => Promise<z.output<Schema>>;

type ClientOptions = {
  apiBaseUrl: string;
  fetch: FetchLike;
  timeoutMs: number;
};

export type AuthenticatedClient = {
  request: RequestWithSchema;
};

type AuthenticatedClientOptions = ClientOptions & {
  getAccessToken: () => string | null;
  refresh: () => Promise<void>;
  onUnauthorized: () => Promise<void> | void;
};

function normalizeApiBaseUrl(value: string): string {
  const normalized = value.trim().replace(/\/+$/, '');
  if (!/^https?:\/\/[^/]+/i.test(normalized)) {
    throw new ApiError('invalid-api-url', 0, {});
  }
  return normalized;
}

function headersFor(init: RequestInit, accessToken?: string | null): Headers {
  const headers = new Headers(init.headers);
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }
  return headers;
}

function toApiError(error: unknown, code = 'request-failed', status = 0): ApiError {
  if (error instanceof ApiError) {
    return error;
  }
  return new ApiError(code, status, {});
}

async function fetchWithTimeout(
  options: ClientOptions,
  path: string,
  init: RequestInit,
  accessToken?: string | null
): Promise<Response> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        controller.abort();
        reject(new ApiError('request-timeout', 0, {}));
      }, options.timeoutMs);
    });
    const response = await Promise.race([
      options.fetch(`${normalizeApiBaseUrl(options.apiBaseUrl)}${path}`, {
        ...init,
        headers: headersFor(init, accessToken),
        signal: controller.signal,
      }),
      timeoutPromise,
    ]);

    return response;
  } catch (error) {
    throw toApiError(error);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

async function apiErrorFrom(response: Response): Promise<ApiError> {
  try {
    const result = apiErrorEnvelopeSchema.safeParse(await response.json());
    if (result.success) {
      return new ApiError(result.data.error.code, response.status, result.data.error.details);
    }
  } catch {
    // Malformed error bodies are intentionally reduced to a stable public error.
  }

  return new ApiError(response.status === 401 ? 'unauthorized' : 'request-failed', response.status, {});
}

async function parseResponse<Schema extends z.ZodType>(
  response: Response,
  schema: Schema
): Promise<z.output<Schema>> {
  if (!response.ok) {
    throw await apiErrorFrom(response);
  }

  if (response.status === 204) {
    return undefined as z.output<Schema>;
  }

  try {
    const result = schema.safeParse(await response.json());
    if (result.success) {
      return result.data;
    }
  } catch {
    // JSON parser failures must not surface response contents to the app.
  }

  throw new ApiError('invalid-response', response.status, {});
}

export function createRawRequest(options: ClientOptions): RequestWithSchema {
  return async <Schema extends z.ZodType>(path: string, init: RequestInit, schema: Schema) =>
    parseResponse(await fetchWithTimeout(options, path, init), schema);
}

export function createAuthenticatedClient(
  options: AuthenticatedClientOptions
): AuthenticatedClient {
  let refreshPromise: Promise<void> | null = null;

  function refreshAccessToken(): Promise<void> {
    if (!refreshPromise) {
      refreshPromise = options.refresh().finally(() => {
        refreshPromise = null;
      });
    }
    return refreshPromise;
  }

  async function cleanUpUnauthorized(): Promise<void> {
    try {
      await options.onUnauthorized();
    } catch {
      // Cleanup failures must not replace the authentication error that triggered them.
    }
  }

  async function request<Schema extends z.ZodType>(
    path: string,
    init: RequestInit,
    schema: Schema,
    retried = false
  ): Promise<z.output<Schema>> {
    const response = await fetchWithTimeout(options, path, init, options.getAccessToken());

    if (response.status !== 401) {
      return parseResponse(response, schema);
    }

    if (retried) {
      await cleanUpUnauthorized();
      throw await apiErrorFrom(response);
    }

    try {
      await refreshAccessToken();
    } catch (error) {
      await cleanUpUnauthorized();
      throw toApiError(error, 'refresh-failed', 401);
    }

    return request(path, init, schema, true);
  }

  return { request };
}
