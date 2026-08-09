import { NextResponse } from 'next/server';
import { createAdminClient } from '@/shared/lib/supabase/admin';
import { fetchSearchAnalytics } from '@/features/seo/lib/google-search-console/client';
import { normalizeGscUrl } from '@/features/seo/lib/google-search-console/normalize';
import { gscPropertyMatchesWorkspaceDomain, resolveGscPropertyHost } from '@/features/seo/lib/google-search-console/site-association';
import {
  assertGscSyncRunUpdated,
  resolveGscSyncOutcome,
  type GscSyncDateResult,
} from '@/features/seo/lib/google-search-console/sync-outcome';
import { subDays, format } from 'date-fns';
import { recordBusinessIntegrationHealthCheck } from '@/features/business-spine/integrations';
import { recordGscBusinessEvent } from '@/features/business-spine/recorders';
import { timingSafeEqual } from 'node:crypto';
import { parseGscSyncDates } from '@/features/seo/lib/google-search-console/sync-request';

interface GscDbRow {
  workspace_id: string;
  site_url: string;
  date: string;
  page_url: string;
  page_slug: string;
  query: string;
  country: string;
  device: string;
  search_type: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export const maxDuration = 300; // 5 minutes max

function getAcceptedSecrets(): string[] {
  return [process.env.GSC_SYNC_SECRET, process.env.CRON_SECRET]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
}

function isAuthorized(authHeader: string | null): boolean {
  if (!authHeader?.startsWith('Bearer ')) return false;
  const candidate = Buffer.from(authHeader.slice('Bearer '.length).trim());
  return getAcceptedSecrets().some((secret) => {
    const expected = Buffer.from(secret);
    if (candidate.length !== expected.length) return false;
    return timingSafeEqual(candidate, expected);
  });
}

export async function POST(req: Request) {
  const startedAt = Date.now();
  let workspaceIdForHealth: string | null = null;
  try {
    const authHeader = req.headers.get('Authorization');

    if (!isAuthorized(authHeader)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Retrieve env credentials
    const siteUrl = process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL;
    const clientId = process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_SEARCH_CONSOLE_REFRESH_TOKEN;

    if (!siteUrl || !clientId || !clientSecret || !refreshToken) {
      return NextResponse.json(
        {
          error: 'Missing GSC integration environment variables',
          details: {
            siteUrl: !!siteUrl,
            clientId: !!clientId,
            clientSecret: !!clientSecret,
            refreshToken: !!refreshToken,
          },
        },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { targetDate, startDate, endDate } = body;

    const supabase = createAdminClient();

    // Fetch the target workspace
    const workspaceSlug = process.env.GSC_WORKSPACE_SLUG?.trim();
    if (!workspaceSlug) {
      return NextResponse.json({ error: 'GSC_WORKSPACE_SLUG is required' }, { status: 500 });
    }
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('id')
      .eq('slug', workspaceSlug)
      .single();

    if (!workspace) {
      return NextResponse.json({ error: `Workspace ${workspaceSlug} not found` }, { status: 404 });
    }

    const { data: workspaceSettings, error: workspaceSettingsError } = await supabase
      .from('workspace_settings')
      .select('site_domain')
      .eq('workspace_id', workspace.id)
      .maybeSingle();
    if (workspaceSettingsError || !workspaceSettings?.site_domain) {
      return NextResponse.json({ error: 'The GSC workspace has no configured site domain' }, { status: 409 });
    }
    if (!gscPropertyMatchesWorkspaceDomain(siteUrl, workspaceSettings.site_domain)) {
      return NextResponse.json({ error: 'GSC site URL does not match the configured workspace domain' }, { status: 409 });
    }
    const workspaceHost = resolveGscPropertyHost(workspaceSettings.site_domain);
    if (!workspaceHost) {
      return NextResponse.json({ error: 'The configured workspace domain is invalid' }, { status: 409 });
    }
    const workspaceSiteUrl = `https://${workspaceHost}`;

    const workspaceId = workspace.id;
    workspaceIdForHealth = workspaceId;

    // Calculate date range to sync
    let datesToSync: string[];
    try {
      datesToSync = parseGscSyncDates({ targetDate, startDate, endDate });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid date range.' }, { status: 400 });
    }
    if (datesToSync.length === 0) {
      datesToSync = [];
      // Default rolling 14 days, accounting for GSC 3-day data processing lag (days -17 to -3)
      for (let i = 17; i >= 3; i--) {
        datesToSync.push(format(subDays(new Date(), i), 'yyyy-MM-dd'));
      }
    }

    const allSyncedRowsAcrossAllDates: GscDbRow[] = [];
    const resultsSummary: Record<string, GscSyncDateResult> = {};

    for (const dateStr of datesToSync) {
      // Create gsc_sync_run entry
      const { data: syncRun, error: syncRunError } = await supabase
        .from('gsc_sync_runs')
        .insert({
          workspace_id: workspaceId,
          target_date: dateStr,
          status: 'in_progress',
        })
        .select('id')
        .single();

      if (syncRunError || !syncRun) {
        resultsSummary[dateStr] = {
          status: 'failed_database',
          rowsSynced: 0,
          error: syncRunError?.message ?? 'Failed to create GSC sync run.',
        };
        continue;
      }

      try {
        let startRow = 0;
        const rowLimit = 5000;
        let fetchedRows = 0;
        let persistedRows = 0;
        let hasMore = true;
        const dateRows: GscDbRow[] = [];

        while (hasMore) {
          const analytics = await fetchSearchAnalytics(dateStr, dateStr, {
            siteUrl,
            clientId,
            clientSecret,
            refreshToken,
            startRow,
            rowLimit,
          });

          const rows = analytics.rows || [];
          if (rows.length === 0) {
            hasMore = false;
            break;
          }

          for (const r of rows) {
            const query = r.keys[0];
            const pageUrl = r.keys[1];
            const country = r.keys[2];
            const device = r.keys[3];
            const pageSlug = normalizeGscUrl(pageUrl, workspaceSiteUrl);

            if (pageSlug) {
              dateRows.push({
                workspace_id: workspaceId,
                site_url: siteUrl,
                date: dateStr,
                page_url: pageUrl,
                page_slug: pageSlug,
                query,
                country,
                device,
                search_type: 'web',
                clicks: r.clicks,
                impressions: r.impressions,
                ctr: r.ctr,
                position: r.position,
              });
            }
          }

          fetchedRows += rows.length;
          if (rows.length < rowLimit) {
            hasMore = false;
          } else {
            startRow += rowLimit;
          }
        }

        // Chunk and upsert raw rows
        if (dateRows.length > 0) {
          for (let i = 0; i < dateRows.length; i += 1000) {
            const chunk = dateRows.slice(i, i + 1000);
            const { error: upsertError } = await supabase
              .from('gsc_search_analytics_rows')
              .upsert(chunk, {
                onConflict: 'workspace_id, site_url, date, page_url, query, country, device, search_type',
              });

            if (upsertError) throw upsertError;
            persistedRows += chunk.length;
          }
          allSyncedRowsAcrossAllDates.push(...dateRows);
        }

        // Mark sync run as successful
        const { error: successUpdateError } = await supabase
          .from('gsc_sync_runs')
          .update({
            status: 'success',
            rows_synced: persistedRows,
            completed_at: new Date().toISOString(),
          })
          .eq('id', syncRun.id);
        assertGscSyncRunUpdated(successUpdateError);

        resultsSummary[dateStr] = {
          status: 'success',
          rowsSynced: persistedRows,
          rowsFetched: fetchedRows,
          rowsRetained: dateRows.length,
          rowsPersisted: persistedRows,
        };
      } catch (err) {
        console.error(`GSC Sync Failed for date ${dateStr}:`, err);
        let status = 'failed_other';
        const errMsg = err instanceof Error ? err.message : String(err);
        if (errMsg.includes('403')) status = 'failed_403';
        else if (errMsg.includes('429')) status = 'failed_429';

        const { error: failureUpdateError } = await supabase
          .from('gsc_sync_runs')
          .update({
            status,
            error_details: errMsg,
            completed_at: new Date().toISOString(),
          })
          .eq('id', syncRun.id);
        assertGscSyncRunUpdated(failureUpdateError);

        resultsSummary[dateStr] = { status, rowsSynced: 0, error: errMsg };
      }
    }

    // Recompute and upsert summaries if we synced any rows in this run
    if (allSyncedRowsAcrossAllDates.length > 0) {
      // Fetch all raw rows for this workspace and site from the last 90 days to perform a stable aggregate
      const ninetyDaysAgo = format(subDays(new Date(), 90), 'yyyy-MM-dd');
      const rawRows: GscDbRow[] = [];
      let from = 0;
      const step = 1000;
      let hasMoreRaw = true;

      while (hasMoreRaw) {
        const { data: chunk, error: rawError } = await supabase
          .from('gsc_search_analytics_rows')
          .select('*')
          .eq('workspace_id', workspaceId)
          .eq('site_url', siteUrl)
          .gte('date', ninetyDaysAgo)
          .range(from, from + step - 1);

        if (rawError) {
          throw new Error(`Failed to fetch raw GSC rows for summary recomputation: ${rawError.message}`);
        }

        if (!chunk || chunk.length === 0) {
          hasMoreRaw = false;
        } else {
          rawRows.push(...chunk);
          if (chunk.length < step) {
            hasMoreRaw = false;
          } else {
            from += step;
          }
        }
      }

      const dailyMap = new Map<string, {
        workspace_id: string;
        site_url: string;
        page_slug: string;
        date: string;
        total_impressions: number;
        total_clicks: number;
        sum_position_weight: number;
      }>();

      const queryMap = new Map<string, {
        workspace_id: string;
        site_url: string;
        page_slug: string;
        query: string;
        min_date: string;
        max_date: string;
        total_impressions: number;
        total_clicks: number;
        sum_position_weight: number;
      }>();

      for (const row of (rawRows ?? [])) {
        const dailyKey = `${row.page_slug}|${row.date}`;
        const existingDaily = dailyMap.get(dailyKey) || {
          workspace_id: row.workspace_id,
          site_url: row.site_url,
          page_slug: row.page_slug,
          date: row.date,
          total_impressions: 0,
          total_clicks: 0,
          sum_position_weight: 0,
        };
        existingDaily.total_impressions += row.impressions;
        existingDaily.total_clicks += row.clicks;
        existingDaily.sum_position_weight += row.position * row.impressions;
        dailyMap.set(dailyKey, existingDaily);

        const queryKey = `${row.page_slug}|${row.query}`;
        const existingQuery = queryMap.get(queryKey) || {
          workspace_id: row.workspace_id,
          site_url: row.site_url,
          page_slug: row.page_slug,
          query: row.query,
          min_date: row.date,
          max_date: row.date,
          total_impressions: 0,
          total_clicks: 0,
          sum_position_weight: 0,
        };
        if (row.date < existingQuery.min_date) existingQuery.min_date = row.date;
        if (row.date > existingQuery.max_date) existingQuery.max_date = row.date;
        existingQuery.total_impressions += row.impressions;
        existingQuery.total_clicks += row.clicks;
        existingQuery.sum_position_weight += row.position * row.impressions;
        queryMap.set(queryKey, existingQuery);
      }

      const dailyInserts = Array.from(dailyMap.values()).map(d => ({
        workspace_id: d.workspace_id,
        site_url: d.site_url,
        page_slug: d.page_slug,
        date: d.date,
        total_impressions: d.total_impressions,
        total_clicks: d.total_clicks,
        avg_ctr: d.total_impressions > 0 ? d.total_clicks / d.total_impressions : 0,
        avg_position: d.total_impressions > 0 ? d.sum_position_weight / d.total_impressions : 0,
        updated_at: new Date().toISOString(),
      }));

      const queryInserts = Array.from(queryMap.values()).map(q => ({
        workspace_id: q.workspace_id,
        site_url: q.site_url,
        page_slug: q.page_slug,
        query: q.query,
        min_date: q.min_date,
        max_date: q.max_date,
        total_impressions: q.total_impressions,
        total_clicks: q.total_clicks,
        avg_ctr: q.total_impressions > 0 ? q.total_clicks / q.total_impressions : 0,
        avg_position: q.total_impressions > 0 ? q.sum_position_weight / q.total_impressions : 0,
        updated_at: new Date().toISOString(),
      }));

      // Chunk and upsert daily summaries
      for (let i = 0; i < dailyInserts.length; i += 1000) {
        const chunk = dailyInserts.slice(i, i + 1000);
        const { error: upsertError } = await supabase
          .from('gsc_page_daily_summary')
          .upsert(chunk, {
            onConflict: 'workspace_id, site_url, page_slug, date',
          });
        if (upsertError) {
          throw new Error(`Failed to upsert GSC daily summary chunk: ${upsertError.message}`);
        }
      }

      // Chunk and upsert query summaries
      for (let i = 0; i < queryInserts.length; i += 1000) {
        const chunk = queryInserts.slice(i, i + 1000);
        const { error: upsertError } = await supabase
          .from('gsc_page_query_summary')
          .upsert(chunk, {
            onConflict: 'workspace_id, site_url, page_slug, query',
          });
        if (upsertError) {
          throw new Error(`Failed to upsert GSC query summary chunk: ${upsertError.message}`);
        }
      }

      const { data: nearPageOneRows } = await supabase
        .from('gsc_page_query_summary')
        .select('id,page_slug,query,total_impressions,total_clicks,avg_ctr,avg_position')
        .eq('workspace_id', workspaceId)
        .eq('site_url', siteUrl)
        .gte('avg_position', 4)
        .lte('avg_position', 12)
        .gte('total_impressions', 20)
        .order('total_impressions', { ascending: false })
        .limit(10);

      for (const row of nearPageOneRows ?? []) {
        await recordGscBusinessEvent({
          supabase,
          workspaceId,
          opportunityId: row.id,
          title: `Refresh ${row.page_slug} for "${row.query}"`,
          url: row.page_slug,
          payload: {
            siteUrl,
            pageSlug: row.page_slug,
            query: row.query,
            impressions: row.total_impressions,
            clicks: row.total_clicks,
            ctr: row.avg_ctr,
            position: row.avg_position,
          },
        });
      }
    }

    const outcome = resolveGscSyncOutcome(resultsSummary);
    const rowsFetched = Object.values(resultsSummary).reduce((sum, result) => sum + (result.rowsFetched ?? 0), 0);
    const rowsRetained = Object.values(resultsSummary).reduce((sum, result) => sum + (result.rowsRetained ?? 0), 0);
    const rowsPersisted = Object.values(resultsSummary).reduce((sum, result) => sum + (result.rowsPersisted ?? 0), 0);
    await recordBusinessIntegrationHealthCheck({
      workspaceId,
      provider: 'cron',
      integrationKey: 'gsc-sync',
      status: outcome.health,
      latencyMs: Date.now() - startedAt,
      message: `GSC sync processed ${datesToSync.length} date(s).`,
      details: {
        datesToSync: datesToSync.length,
        rowsFetched,
        rowsRetained,
        rowsPersisted,
        resultsSummary,
      },
    });

    return NextResponse.json({
      ok: outcome.ok,
      partial: outcome.status === 207,
      syncedDatesCount: outcome.succeeded,
      failedDatesCount: outcome.failed,
      health: outcome.health,
      rowsFetched,
      rowsRetained,
      rowsPersisted,
      resultsSummary,
    }, { status: outcome.status });
  } catch (error) {
    console.error('Fatal GSC sync error:', error);
    const errMsg = error instanceof Error ? error.message : String(error);
    if (workspaceIdForHealth) {
      await recordBusinessIntegrationHealthCheck({
        workspaceId: workspaceIdForHealth,
        provider: 'cron',
        integrationKey: 'gsc-sync',
        status: 'failing',
        latencyMs: Date.now() - startedAt,
        message: errMsg,
        details: { source: 'gsc_sync_route' },
      });
    }
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
