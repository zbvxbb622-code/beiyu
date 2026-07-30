import { z } from 'zod';

export const devicePlatformSchema = z.enum(['IOS', 'ANDROID', 'WEB']);

export const deviceInputSchema = z.object({
  installationId: z.string().min(8).max(200),
  platform: devicePlatformSchema,
  deviceName: z.string().min(1).max(120),
  appVersion: z.string().min(1).max(40),
});

const authenticatedUserSchema = z.object({
  id: z.string().uuid(),
  phoneMasked: z.string(),
  status: z.enum(['ACTIVE', 'BANNED', 'DELETED']),
  ageConfirmed: z.boolean(),
  memoryEnabled: z.boolean(),
  membershipLevel: z.enum(['FREE', 'MEMBER']),
});

const authenticatedDeviceSchema = z.object({
  id: z.string().uuid(),
  platform: devicePlatformSchema,
  deviceName: z.string(),
  appVersion: z.string(),
  lastActiveAt: z.string().datetime(),
  isCurrent: z.boolean(),
});

export const tokenResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  tokenType: z.string().optional(),
  expiresIn: z.number().int(),
  refreshExpiresIn: z.number().int(),
});

export const loginResponseSchema = tokenResponseSchema.extend({
  isNewUser: z.boolean(),
  user: authenticatedUserSchema,
  device: authenticatedDeviceSchema,
});

const profileSchema = z.object({
  nickname: z.string(),
  avatarKey: z.string(),
  avatarUri: z.string().nullable(),
  signature: z.string(),
  city: z.string(),
  gender: z.string().nullable(),
  birthday: z.string().date().nullable(),
  showBirthdayTag: z.boolean(),
  showAge: z.boolean(),
  showZodiac: z.boolean(),
  occupation: z.string().nullable(),
  school: z.string().nullable(),
});

const privacySettingsSchema = z.object({
  localOnlyMode: z.boolean(),
  analyticsOptIn: z.boolean(),
  syncWhenLoggedIn: z.boolean(),
});

const accountDeviceSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  platform: devicePlatformSchema,
  lastActiveAt: z.string().datetime(),
  isCurrent: z.boolean(),
});

const accountSecuritySchema = z.object({
  phone: z.string(),
  phoneVerified: z.boolean(),
  wechatBound: z.boolean().optional(),
  wechatAccount: z.string().optional(),
  passwordSet: z.boolean().optional(),
  realnameVerified: z.boolean().optional(),
  realnameName: z.string().optional(),
  officialVerified: z.boolean().optional(),
  officialType: z.string().optional(),
  devices: z.array(accountDeviceSchema),
});

const cellarItemSchema = z.object({
  id: z.string().uuid(),
  ingredientId: z.string().nullable(),
  customName: z.string().nullable(),
  amountLabel: z.string().nullable(),
  note: z.string().nullable(),
  source: z.enum(['MANUAL', 'LOCAL_SYNC']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const aiAllowanceSchema = z.object({
  dailyMessageLimit: z.number().int(),
  messagesUsedToday: z.number().int(),
  remaining: z.number().int(),
  resetsAt: z.string().datetime(),
});

const featureFlagsSchema = z.object({
  realSms: z.boolean().optional(),
  mediaUpload: z.boolean().optional(),
  legalNameVerification: z.boolean().optional(),
  aiChat: z.boolean().optional(),
  community: z.boolean().optional(),
});

export const bootstrapResponseSchema = z.object({
  user: authenticatedUserSchema,
  profile: profileSchema,
  privacy: privacySettingsSchema,
  accountSecurity: accountSecuritySchema,
  cellar: z.object({ items: z.array(cellarItemSchema) }),
  ai: aiAllowanceSchema,
  featureFlags: featureFlagsSchema,
});

export const smsCodeResponseSchema = z.object({
  expiresIn: z.number().int(),
  retryAfter: z.number().int(),
});

export const ageConfirmationResponseSchema = z.object({
  ageConfirmed: z.literal(true),
  confirmedAt: z.string().datetime(),
});

export const profileResponseSchema = profileSchema;
export const privacySettingsResponseSchema = privacySettingsSchema;
export const cellarItemResponseSchema = cellarItemSchema;
export const cellarListResponseSchema = z.object({ items: z.array(cellarItemSchema) });

export type DeviceInput = z.infer<typeof deviceInputSchema>;
export type LoginResponse = z.infer<typeof loginResponseSchema>;
export type TokenResponse = z.infer<typeof tokenResponseSchema>;
export type BootstrapResponse = z.infer<typeof bootstrapResponseSchema>;
