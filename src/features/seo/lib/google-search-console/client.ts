import { OAuth2Client } from 'google-auth-library';
import { GscSearchAnalyticsResponse } from './types';

/**
 * Fetches Google Search Console analytics data using OAuth2 refresh token auth.
 */
export async function fetchSearchAnalytics(
  startDate: string,
  endDate: string,
  options: {
    siteUrl?: string;
    clientId?: string;
    clientSecret?: string;
    refreshToken?: string;
    startRow?: number;
    rowLimit?: number;
  } = {}
): Promise<GscSearchAnalyticsResponse> {
  const siteUrl = options.siteUrl || process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL;
  const clientId = options.clientId || process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_ID;
  const clientSecret = options.clientSecret || process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET;
  const refreshToken = options.refreshToken || process.env.GOOGLE_SEARCH_CONSOLE_REFRESH_TOKEN;

  if (!siteUrl) {
    throw new Error('GOOGLE_SEARCH_CONSOLE_SITE_URL is required');
  }
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('GSC OAuth credentials (client ID, client secret, refresh token) are missing');
  }

  const oauth2Client = new OAuth2Client(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(
    siteUrl
  )}/searchAnalytics/query`;

  const startRow = options.startRow ?? 0;
  const rowLimit = options.rowLimit ?? 25000;

  const response = await oauth2Client.request<GscSearchAnalyticsResponse>({
    url,
    method: 'POST',
    data: {
      startDate,
      endDate,
      dimensions: ['query', 'page', 'country', 'device'],
      rowLimit,
      startRow,
    },
  });

  return response.data;
}
