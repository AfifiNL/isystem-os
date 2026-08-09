/**
 * Normalizes Google Search Console URLs to match application inventory slugs.
 * Accepts a dynamic siteUrl parameter.
 * Returns null if the URL is external.
 */
export function normalizeGscUrl(gscUrl: string, siteUrl: string): string | null {
  if (!gscUrl) return null;

  // 1. Strip query parameter and hash
  const cleanUrl = gscUrl.split('?')[0].split('#')[0];

  // 2. Format siteUrl with trailing slash for comparison
  const siteUrlWithSlash = siteUrl.endsWith('/') ? siteUrl : `${siteUrl}/`;
  const siteUrlWithoutSlash = siteUrl.endsWith('/') ? siteUrl.slice(0, -1) : siteUrl;

  if (
    !cleanUrl.startsWith(siteUrlWithSlash) &&
    cleanUrl !== siteUrlWithSlash &&
    cleanUrl !== siteUrlWithoutSlash
  ) {
    // Safely ignore external URLs
    return null;
  }

  // Extract path relative to siteUrl
  let path = '';
  if (cleanUrl.startsWith(siteUrlWithSlash)) {
    path = cleanUrl.substring(siteUrlWithSlash.length);
  } else {
    path = '';
  }

  // Clean trailing and leading slashes
  path = path.replace(/^\/+|\/+$/g, '');

  // 3. Map locale-prefixed routes to the canonical content slug
  const locales = ['en', 'nl', 'ar'];
  for (const locale of locales) {
    if (path === locale) {
      return 'home';
    }
    if (path.startsWith(`${locale}/`)) {
      path = path.substring(locale.length + 1).replace(/^\/+|\/+$/g, '');
      break;
    }
  }

  return path || 'home';
}
