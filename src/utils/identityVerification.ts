type IdentityValidationReason = 'invalid' | 'underage';

type IdentityValidationResult =
  | { valid: true }
  | { valid: false; reason: IdentityValidationReason };

const mainlandIdPattern = /^\d{17}[\dX]$/;
const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2] as const;
const checksumCharacters = '10X98765432';

function isRealDate(year: number, month: number, day: number) {
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function ageOnDate(year: number, month: number, day: number, now: Date) {
  let age = now.getFullYear() - year;
  const birthdayHasPassed = now.getMonth() + 1 > month || (now.getMonth() + 1 === month && now.getDate() >= day);
  if (!birthdayHasPassed) age -= 1;
  return age;
}

export function normalizeMainlandId(idNumber: string) {
  return idNumber.replace(/\s/g, '').toUpperCase();
}

export function validateMainlandAdultId(idNumber: string, now = new Date()): IdentityValidationResult {
  const normalized = normalizeMainlandId(idNumber);
  if (!mainlandIdPattern.test(normalized)) {
    return { valid: false, reason: 'invalid' };
  }

  const checksum = weights.reduce((sum, weight, index) => sum + Number(normalized[index]) * weight, 0);
  if (checksumCharacters[checksum % 11] !== normalized[17]) {
    return { valid: false, reason: 'invalid' };
  }

  const year = Number(normalized.slice(6, 10));
  const month = Number(normalized.slice(10, 12));
  const day = Number(normalized.slice(12, 14));
  if (!isRealDate(year, month, day)) {
    return { valid: false, reason: 'invalid' };
  }

  return ageOnDate(year, month, day, now) >= 18
    ? { valid: true }
    : { valid: false, reason: 'underage' };
}
