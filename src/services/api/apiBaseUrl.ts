export function normalizeApiV1BaseUrl(value: string): string {
  const normalized = value.trim().replace(/\/+$/, '');
  if (!normalized) {
    return '';
  }
  if (!/^https?:\/\/[^/]+/i.test(normalized)) {
    throw new Error('invalid-api-url');
  }
  return normalized.endsWith('/api/v1') ? normalized : `${normalized}/api/v1`;
}
