const preAgeVerificationRoutes = new Set(['/realname-verify', '/terms', '/privacy']);

export function canAccessBeforeAgeVerification(pathname: string) {
  return preAgeVerificationRoutes.has(pathname);
}
