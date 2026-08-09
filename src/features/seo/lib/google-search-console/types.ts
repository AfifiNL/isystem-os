export interface GscSearchAnalyticsRow {
  keys: string[]; // [query, page, country, device]
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscSearchAnalyticsResponse {
  rows?: GscSearchAnalyticsRow[];
}
