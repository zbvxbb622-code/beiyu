import { describe, expect, it } from '@jest/globals';

import { normalizeApiV1BaseUrl } from '@/services/api/apiBaseUrl';

describe('API base URL normalization', () => {
  it('accepts an origin and appends the v1 API prefix', () => {
    expect(normalizeApiV1BaseUrl('https://api.example.test')).toBe('https://api.example.test/api/v1');
  });

  it('accepts an already versioned API URL without duplicating the prefix', () => {
    expect(normalizeApiV1BaseUrl('https://api.example.test/api/v1/')).toBe('https://api.example.test/api/v1');
  });

  it('keeps an empty value empty so offline repositories can fall back to bundled data', () => {
    expect(normalizeApiV1BaseUrl('  ')).toBe('');
  });

  it('rejects malformed non-empty values', () => {
    expect(() => normalizeApiV1BaseUrl('api.example.test')).toThrow('invalid-api-url');
  });
});
