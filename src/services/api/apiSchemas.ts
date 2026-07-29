import { z } from 'zod';

export const apiErrorPayloadSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.string(), z.unknown()),
});

export const apiErrorEnvelopeSchema = z.object({
  error: apiErrorPayloadSchema,
});

export type ApiErrorPayload = z.infer<typeof apiErrorPayloadSchema>;
