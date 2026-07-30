import type { AuthenticatedClient } from '@/services/api/authenticatedClient';
import { AiRepository } from '@/services/ai/aiRepository';

export function createAiRepository(authenticatedClient: AuthenticatedClient) {
  return new AiRepository({ authenticatedClient });
}
