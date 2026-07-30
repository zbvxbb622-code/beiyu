import { describe, expect, it } from '@jest/globals';

import {
  aiUsageResponseSchema,
  conversationListResponseSchema,
  memoryListResponseSchema,
  sendMessageResponseSchema,
  temporaryMessageRequestSchema,
} from '@/services/ai/aiSchemas';

const conversationId = '0f38f737-b8e9-4f75-8bb3-0b5a53f93afc';
const userMessageId = '5364864c-3a48-4ca8-90b7-04f049b3227b';
const assistantMessageId = 'a6c4c674-f87d-4047-953c-914f720f6d42';
const memoryId = 'f6b2bfb8-02e3-44b5-b63d-12a9a49533aa';

describe('AI API schemas', () => {
  it('parses conversation lists with backend pagination fields', () => {
    expect(
      conversationListResponseSchema.parse({
        items: [
          {
            id: conversationId,
            title: '今晚喝什么',
            lastMessageAt: '2026-07-29T14:45:00Z',
            createdAt: '2026-07-29T14:40:00Z',
          },
        ],
        pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
      }).items[0].title
    ).toBe('今晚喝什么');
  });

  it('parses send responses including messages, usage, and memory changes', () => {
    const parsed = sendMessageResponseSchema.parse({
      conversation: {
        id: conversationId,
        title: '金汤力推荐',
        lastMessageAt: '2026-07-29T14:46:00Z',
        createdAt: '2026-07-29T14:40:00Z',
      },
      userMessage: {
        id: userMessageId,
        role: 'USER',
        content: '给我一杯金汤力',
        recipeIds: [],
        safetyLabel: 'SAFE',
        createdAt: '2026-07-29T14:45:00Z',
      },
      assistantMessage: {
        id: assistantMessageId,
        role: 'ASSISTANT',
        content: '可以，从清爽高球开始。',
        recipeIds: ['d9f72d47-7f0e-40db-87ab-f84f54e2fbcf'],
        safetyLabel: 'SAFE',
        createdAt: '2026-07-29T14:46:00Z',
      },
      usage: {
        limit: 50,
        used: 2,
        remaining: 48,
        resetsAt: '2026-07-29T16:00:00Z',
      },
      memoryChanges: [
        {
          id: memoryId,
          action: 'CREATED',
          category: 'DRINK_PREFERENCE',
          summary: '偏好清爽高球。',
        },
      ],
    });

    expect(parsed.assistantMessage.recipeIds).toEqual(['d9f72d47-7f0e-40db-87ab-f84f54e2fbcf']);
    expect(parsed.usage.remaining).toBe(48);
    expect(parsed.memoryChanges[0].summary).toBe('偏好清爽高球。');
  });

  it('validates temporary context bounds and memory responses', () => {
    const context = Array.from({ length: 21 }, (_, index) => ({
      role: index % 2 === 0 ? 'USER' : 'ASSISTANT',
      content: `message-${index}`,
    }));

    expect(() =>
      temporaryMessageRequestSchema.parse({
        clientMessageId: userMessageId,
        content: '新的临时问题',
        context,
      })
    ).toThrow();

    expect(
      memoryListResponseSchema.parse({
        items: [
          {
            id: memoryId,
            category: 'EMOTIONAL_PREFERENCE',
            summary: '喜欢轻松直接的语气。',
            createdAt: '2026-07-29T14:50:00Z',
          },
        ],
      }).items[0].category
    ).toBe('EMOTIONAL_PREFERENCE');
  });

  it('rejects usage payloads that do not match the OpenAPI shape', () => {
    expect(() =>
      aiUsageResponseSchema.parse({
        dailyMessageLimit: 50,
        messagesUsedToday: 1,
        remaining: 49,
        resetsAt: '2026-07-29T16:00:00Z',
      })
    ).toThrow();
  });
});
