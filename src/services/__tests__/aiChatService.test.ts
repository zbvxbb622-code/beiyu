import { describe, expect, it } from '@jest/globals';

import { createMockAiReply } from '../aiChatService';

describe('aiChatService', () => {
  it('returns an assistant chat message and recipe cards for a user prompt', () => {
    const result = createMockAiReply({
      prompt: '今晚想喝酸甜一点，有龙舌兰和青柠',
      selectedIngredientIds: ['tequila', 'lime'],
    });

    expect(result.message).toEqual(
      expect.objectContaining({
        role: 'assistant',
      })
    );
    expect(result.message.text).toContain('Mixology');
    expect(result.recipes.length).toBeGreaterThan(0);
    expect(result.recipes.length).toBeLessThanOrEqual(3);
  });
});
