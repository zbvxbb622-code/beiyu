import { z } from 'zod';

import {
  ApiError,
  createRawRequest,
  type AuthenticatedClient,
  type FetchLike,
} from '@/services/api/authenticatedClient';
import {
  ageConfirmationResponseSchema,
  bootstrapResponseSchema,
  cellarItemResponseSchema,
  cellarListResponseSchema,
  loginResponseSchema,
  privacySettingsResponseSchema,
  profileResponseSchema,
  smsCodeResponseSchema,
  tokenResponseSchema,
  type BootstrapResponse,
  type DeviceInput,
} from '@/services/auth/authSchemas';
import {
  communityCommentSchema,
  communityPostListSchema,
  communityPostSchema,
} from '@/services/community/communitySchemas';
import { tokenStore } from '@/services/auth/tokenStore';
import type { CommunityPost, FeedCategory, PostImage, PostVisibility } from '@/types/mixology';

const emptyResponseSchema = z.undefined();

type AuthRepositoryOptions = {
  apiBaseUrl: string;
  fetch: FetchLike;
  timeoutMs: number;
  authenticatedClient: AuthenticatedClient;
};

export type LoginInput = {
  phone: string;
  code: string;
  device: DeviceInput;
};

export type LocalSyncInput = {
  ageVerified?: boolean;
  profile?: Partial<BootstrapResponse['profile']>;
  privacySettings?: Partial<BootstrapResponse['privacy']>;
  cellarIngredientIds?: string[];
};

export type CellarItemInput = Pick<
  BootstrapResponse['cellar']['items'][number],
  'ingredientId' | 'customName' | 'amountLabel' | 'note'
>;

export type CellarItemPatch = Partial<Pick<CellarItemInput, 'amountLabel' | 'note'>>;

export type CommunityPostCreateInput = {
  title: string;
  body: string;
  category: FeedCategory;
  imageKey?: string;
  images?: PostImage[];
  topics?: string[];
  venueId?: string;
  visibility?: PostVisibility;
  allowComments?: boolean;
};

function jsonRequest(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export class AuthRepository {
  private readonly rawRequest;

  constructor(private readonly options: AuthRepositoryOptions) {
    this.rawRequest = createRawRequest(options);
  }

  requestSmsCode(phone: string, installationId: string, scene = 'LOGIN') {
    return this.rawRequest(
      '/auth/sms-codes',
      jsonRequest('POST', { phone, installationId, scene }),
      smsCodeResponseSchema
    );
  }

  async login(input: LoginInput) {
    const response = await this.rawRequest('/auth/login', jsonRequest('POST', input), loginResponseSchema);
    await tokenStore.setRefreshToken(response.refreshToken);
    return response;
  }

  async refresh(expectedRefreshToken?: string | null) {
    const refreshToken = expectedRefreshToken === undefined
      ? await tokenStore.getRefreshToken()
      : expectedRefreshToken;
    if (!refreshToken) {
      throw new ApiError('refresh-token-missing', 401, {});
    }

    const response = await this.rawRequest(
      '/auth/refresh',
      jsonRequest('POST', { refreshToken }),
      tokenResponseSchema
    );
    if (expectedRefreshToken === undefined) {
      await tokenStore.setRefreshToken(response.refreshToken);
    } else {
      const replaced = await tokenStore.replaceRefreshToken(refreshToken, response.refreshToken);
      if (!replaced) {
        throw new ApiError('stale-session', 401, {});
      }
    }
    return response;
  }

  async logout(expectedRefreshToken?: string | null): Promise<void> {
    const refreshToken = expectedRefreshToken === undefined
      ? await tokenStore.getRefreshToken()
      : expectedRefreshToken;
    try {
      await this.options.authenticatedClient.request(
        '/auth/logout',
        { method: 'POST' },
        emptyResponseSchema
      );
    } finally {
      await tokenStore.clearRefreshToken(refreshToken);
    }
  }

  bootstrap() {
    return this.options.authenticatedClient.request(
      '/me/bootstrap',
      { method: 'GET' },
      bootstrapResponseSchema
    );
  }

  syncLocalState(input: LocalSyncInput) {
    return this.options.authenticatedClient.request(
      '/me/local-sync',
      jsonRequest('POST', input),
      bootstrapResponseSchema
    );
  }

  confirmAge() {
    return this.options.authenticatedClient.request(
      '/me/age-confirmation',
      jsonRequest('POST', { confirmed: true }),
      ageConfirmationResponseSchema
    );
  }

  patchProfile(patch: Partial<BootstrapResponse['profile']>) {
    return this.options.authenticatedClient.request(
      '/me/profile',
      jsonRequest('PATCH', patch),
      profileResponseSchema
    );
  }

  patchPrivacy(patch: Partial<BootstrapResponse['privacy']>) {
    return this.options.authenticatedClient.request(
      '/me/privacy',
      jsonRequest('PATCH', patch),
      privacySettingsResponseSchema
    );
  }

  listCellarItems() {
    return this.options.authenticatedClient.request(
      '/cellar/items',
      { method: 'GET' },
      cellarListResponseSchema
    );
  }

  createCellarItem(input: CellarItemInput) {
    return this.options.authenticatedClient.request(
      '/cellar/items',
      jsonRequest('POST', input),
      cellarItemResponseSchema
    );
  }

  patchCellarItem(itemId: string, patch: CellarItemPatch) {
    return this.options.authenticatedClient.request(
      `/cellar/items/${encodeURIComponent(itemId)}`,
      jsonRequest('PATCH', patch),
      cellarItemResponseSchema
    );
  }

  deleteCellarItem(itemId: string) {
    return this.options.authenticatedClient.request(
      `/cellar/items/${encodeURIComponent(itemId)}`,
      { method: 'DELETE' },
      emptyResponseSchema
    );
  }

  batchCellarItems(ingredientIds: string[]) {
    return this.options.authenticatedClient.request(
      '/cellar/items/batch',
      jsonRequest('POST', { ingredientIds }),
      cellarListResponseSchema
    );
  }

  listCommunityPosts(category?: FeedCategory) {
    const path = category
      ? `/community/posts?category=${encodeURIComponent(category)}`
      : '/community/posts';
    return this.options.authenticatedClient.request(
      path,
      { method: 'GET' },
      communityPostListSchema
    );
  }

  createCommunityPost(input: CommunityPostCreateInput): Promise<CommunityPost> {
    return this.options.authenticatedClient.request(
      '/community/posts',
      jsonRequest('POST', input),
      communityPostSchema
    );
  }

  getCommunityPost(postId: string): Promise<CommunityPost> {
    return this.options.authenticatedClient.request(
      `/community/posts/${encodeURIComponent(postId)}`,
      { method: 'GET' },
      communityPostSchema
    );
  }

  addCommunityComment(postId: string, text: string) {
    return this.options.authenticatedClient.request(
      `/community/posts/${encodeURIComponent(postId)}/comments`,
      jsonRequest('POST', { text }),
      communityCommentSchema
    );
  }

  likeCommunityPost(postId: string): Promise<CommunityPost> {
    return this.options.authenticatedClient.request(
      `/community/posts/${encodeURIComponent(postId)}/like`,
      { method: 'POST' },
      communityPostSchema
    );
  }

  unlikeCommunityPost(postId: string): Promise<CommunityPost> {
    return this.options.authenticatedClient.request(
      `/community/posts/${encodeURIComponent(postId)}/like`,
      { method: 'DELETE' },
      communityPostSchema
    );
  }
}
