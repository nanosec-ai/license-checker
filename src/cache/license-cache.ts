/**
 * In-memory cache for package license lookups.
 * Licenses don't change for a given package@version.
 */
const cache = new Map<string, string>();

function key(name: string, version: string): string {
  return `${name}@${version}`;
}

export function getCachedLicense(name: string, version: string): string | undefined {
  return cache.get(key(name, version));
}

export function setCachedLicense(name: string, version: string, license: string): void {
  cache.set(key(name, version), license);
}

export function clearLicenseCache(): void {
  cache.clear();
}
