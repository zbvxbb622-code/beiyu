import { describe, expect, it } from '@jest/globals';

import { validateMainlandAdultId } from '@/utils/identityVerification';

const fixedNow = new Date('2026-08-01T00:00:00+08:00');
const testAdultId = '00000019900101123X';
const testUnderageId = '00000020100101123X';

describe('validateMainlandAdultId', () => {
  it('accepts a valid mainland ID whose birth date is at least 18 years ago', () => {
    expect(validateMainlandAdultId(testAdultId, fixedNow)).toEqual({ valid: true });
  });

  it('rejects a valid mainland ID whose owner is under 18', () => {
    expect(validateMainlandAdultId(testUnderageId, fixedNow)).toEqual({
      valid: false,
      reason: 'underage',
    });
  });

  it('rejects an ID with an invalid checksum', () => {
    expect(validateMainlandAdultId('000000199001011230', fixedNow)).toEqual({
      valid: false,
      reason: 'invalid',
    });
  });
});
