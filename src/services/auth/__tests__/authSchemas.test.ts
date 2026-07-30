import { describe, expect, it } from '@jest/globals';

import { apiErrorPayloadSchema } from '@/services/api/apiSchemas';
import {
  bootstrapResponseSchema,
  loginResponseSchema,
  tokenResponseSchema,
} from '@/services/auth/authSchemas';

const validUser = {
  id: '0f38f737-b8e9-4f75-8bb3-0b5a53f93afc',
  phoneMasked: '138****0000',
  status: 'ACTIVE',
  ageConfirmed: true,
  memoryEnabled: true,
  membershipLevel: 'FREE',
};

const validDevice = {
  id: '5364864c-3a48-4ca8-90b7-04f049b3227b',
  platform: 'IOS',
  deviceName: 'Test iPhone',
  appVersion: '1.0.0',
  lastActiveAt: '2026-07-29T08:00:00.000Z',
  isCurrent: true,
};

const validLogin = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  tokenType: 'bearer',
  expiresIn: 900,
  refreshExpiresIn: 2_592_000,
  isNewUser: false,
  user: validUser,
  device: validDevice,
};

describe('auth schemas', () => {
  it('parses login and refresh token responses', () => {
    expect(loginResponseSchema.parse(validLogin).refreshToken).toBe('refresh-token');
    expect(
      tokenResponseSchema.parse({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 900,
        refreshExpiresIn: 2_592_000,
      })
    ).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresIn: 900,
      refreshExpiresIn: 2_592_000,
    });
  });

  it('accepts every backend membership level', () => {
    expect(
      loginResponseSchema.parse({
        ...validLogin,
        user: { ...validUser, membershipLevel: 'MEMBER' },
      }).user.membershipLevel
    ).toBe('MEMBER');
  });

  it('parses the current bootstrap allowance contract', () => {
    const response = bootstrapResponseSchema.parse({
      user: validUser,
      profile: {
        nickname: '杯友',
        avatarKey: 'avatar-default',
        avatarUri: null,
        signature: '',
        city: '上海',
        gender: null,
        birthday: null,
        showBirthdayTag: false,
        showAge: false,
        showZodiac: false,
        occupation: null,
        school: null,
      },
      privacy: {
        localOnlyMode: false,
        analyticsOptIn: false,
        syncWhenLoggedIn: true,
      },
      accountSecurity: {
        phone: '13800000000',
        phoneVerified: true,
        devices: [
          {
            id: validDevice.id,
            name: 'Test iPhone',
            platform: 'IOS',
            lastActiveAt: validDevice.lastActiveAt,
            isCurrent: true,
          },
        ],
      },
      cellar: { items: [] },
      ai: {
        dailyMessageLimit: 50,
        messagesUsedToday: 0,
        remaining: 50,
        resetsAt: '2026-07-29T16:00:00Z',
      },
      featureFlags: { aiChat: true },
    });

    expect(response.ai).toEqual({
      dailyMessageLimit: 50,
      messagesUsedToday: 0,
      remaining: 50,
      resetsAt: '2026-07-29T16:00:00Z',
    });
  });

  it('parses the shared API error payload', () => {
    expect(
      apiErrorPayloadSchema.parse({
        code: 'AUTH_INVALID',
        message: '登录已失效',
        details: { reason: 'expired' },
      })
    ).toEqual({
      code: 'AUTH_INVALID',
      message: '登录已失效',
      details: { reason: 'expired' },
    });
  });
});
