import { z } from 'zod';

export const aiMessageRoleSchema = z.enum(['USER', 'ASSISTANT']);
export const aiSafetyLabelSchema = z.enum([
  'SAFE',
  'ALCOHOL_OVERUSE',
  'MINOR_ALCOHOL',
  'SELF_HARM_CRISIS',
  'PRIVACY_SENSITIVE',
  'OUTPUT_REPLACED',
]);
export const aiMemoryCategorySchema = z.enum([
  'DRINK_PREFERENCE',
  'EMOTIONAL_PREFERENCE',
  'SAFETY_REMINDER',
]);

export const aiUsageResponseSchema = z.object({
  limit: z.number().int().min(0),
  used: z.number().int().min(0),
  remaining: z.number().int().min(0),
  resetsAt: z.string().datetime(),
});

export const conversationResponseSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(80),
  lastMessageAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

const conversationPaginationResponseSchema = z.object({
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1).max(50),
  totalItems: z.number().int().min(0),
  totalPages: z.number().int().min(0),
});

const messagePaginationResponseSchema = z.object({
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1).max(100),
  totalItems: z.number().int().min(0),
  totalPages: z.number().int().min(0),
});

export const conversationListResponseSchema = z.object({
  items: z.array(conversationResponseSchema),
  pagination: conversationPaginationResponseSchema,
});

export const aiMessageResponseSchema = z.object({
  id: z.string().uuid(),
  role: aiMessageRoleSchema,
  content: z.string().min(1).max(8_000),
  recipeIds: z.array(z.string().uuid()).default([]),
  safetyLabel: aiSafetyLabelSchema,
  createdAt: z.string().datetime(),
});

export const messageListResponseSchema = z.object({
  items: z.array(aiMessageResponseSchema),
  pagination: messagePaginationResponseSchema,
});

export const sendMessageRequestSchema = z.object({
  content: z.string().trim().min(1).max(2_000),
  clientMessageId: z.string().uuid(),
});

export const temporaryContextMessageSchema = z.object({
  role: aiMessageRoleSchema,
  content: z.string().trim().min(1).max(2_000),
});

export const temporaryMessageRequestSchema = sendMessageRequestSchema.extend({
  context: z.array(temporaryContextMessageSchema).max(20).refine(
    (messages) => messages.reduce((sum, message) => sum + message.role.length + message.content.length, 0) <= 12_000,
    'temporary context exceeds character budget'
  ),
});

export const memoryChangeActionSchema = z.enum(['CREATED', 'UPDATED']);

export const aiMemoryResponseSchema = z.object({
  id: z.string().uuid(),
  category: aiMemoryCategorySchema,
  summary: z.string().min(1).max(240),
  createdAt: z.string().datetime(),
});

export const memoryListResponseSchema = z.object({
  items: z.array(aiMemoryResponseSchema),
});

export const memoryChangeSchema = z.object({
  id: z.string().uuid(),
  action: memoryChangeActionSchema,
  category: aiMemoryCategorySchema,
  summary: z.string().min(1).max(240),
});

export const sendMessageResponseSchema = z.object({
  conversation: conversationResponseSchema,
  userMessage: aiMessageResponseSchema,
  assistantMessage: aiMessageResponseSchema,
  usage: aiUsageResponseSchema,
  memoryChanges: z.array(memoryChangeSchema).default([]),
});

export const temporaryMessageResponseSchema = z.object({
  assistantMessage: aiMessageResponseSchema,
  usage: aiUsageResponseSchema,
  memoryChanges: z.array(memoryChangeSchema).default([]),
});

export const memorySettingsRequestSchema = z.object({
  enabled: z.boolean(),
});

export const memorySettingsResponseSchema = z.object({
  enabled: z.boolean(),
});

export const emptyAiResponseSchema = z.undefined();

export type AiMessageRole = z.infer<typeof aiMessageRoleSchema>;
export type AiSafetyLabel = z.infer<typeof aiSafetyLabelSchema>;
export type AiMemoryCategory = z.infer<typeof aiMemoryCategorySchema>;
export type AiUsageResponse = z.infer<typeof aiUsageResponseSchema>;
export type ConversationResponse = z.infer<typeof conversationResponseSchema>;
export type ConversationListResponse = z.infer<typeof conversationListResponseSchema>;
export type AiMessageResponse = z.infer<typeof aiMessageResponseSchema>;
export type MessageListResponse = z.infer<typeof messageListResponseSchema>;
export type SendMessageRequest = z.infer<typeof sendMessageRequestSchema>;
export type TemporaryContextMessage = z.infer<typeof temporaryContextMessageSchema>;
export type TemporaryMessageRequest = z.infer<typeof temporaryMessageRequestSchema>;
export type AiMemoryResponse = z.infer<typeof aiMemoryResponseSchema>;
export type MemoryListResponse = z.infer<typeof memoryListResponseSchema>;
export type MemoryChange = z.infer<typeof memoryChangeSchema>;
export type SendMessageResponse = z.infer<typeof sendMessageResponseSchema>;
export type TemporaryMessageResponse = z.infer<typeof temporaryMessageResponseSchema>;
export type MemorySettingsResponse = z.infer<typeof memorySettingsResponseSchema>;
