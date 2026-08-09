import { parseArgs } from 'node:util';
import { recordCronWrapperHealth } from './lib/cron-health';
import { getSiteUrl } from '../src/shared/lib/site-url';

const args = parseArgs({
  options: {
    date: {
      type: 'string',
    },
    'dry-run': {
      type: 'boolean',
    },
  },
});

async function main() {
  const secret = process.env.GSC_SYNC_SECRET?.trim() || process.env.CRON_SECRET?.trim();
  const siteUrl = getSiteUrl();
  const targetUrl = `${siteUrl}/api/seo/google-search-console/sync`;
  const startedAt = Date.now();

  if (args.values['dry-run']) {
    console.log(
      JSON.stringify({
        event: 'gsc_sync_cron_trigger_dry_run',
        ok: true,
        endpoint: targetUrl,
        has_secret: !!secret,
        targetDate: args.values.date || '3_days_ago'
      })
    );
    process.exit(0);
  }

  if (!secret) {
    await recordCronWrapperHealth({
      integrationKey: 'gsc-sync',
      status: 'failing',
      message: 'GSC sync cron wrapper is missing its bearer secret.',
      errorCode: 'missing_secret',
      workspaceSlugs: [process.env.GSC_WORKSPACE_SLUG],
      details: { endpoint: targetUrl, targetDate: args.values.date || '3_days_ago' },
    });
    console.error(JSON.stringify({ event: 'gsc_sync_cron_trigger', ok: false, error: 'Missing GSC_SYNC_SECRET or CRON_SECRET' }));
    process.exit(1);
  }

  const payload: { targetDate?: string } = {};
  if (args.values.date) {
    payload.targetDate = args.values.date;
  }

  let res: Response;
  try {
    res = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    await recordCronWrapperHealth({
      integrationKey: 'gsc-sync',
      status: 'failing',
      message: error instanceof Error ? error.message : 'GSC sync cron network failure.',
      latencyMs: Date.now() - startedAt,
      statusCode: 0,
      errorCode: 'network_failure',
      workspaceSlugs: [process.env.GSC_WORKSPACE_SLUG],
      details: { endpoint: targetUrl, payload },
    });
    console.error(JSON.stringify({
      event: 'gsc_sync_cron_trigger',
      status: 0,
      ok: false,
      error: error instanceof Error ? error.message : 'Network failure',
    }));
    process.exit(1);
  }

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  const degraded = res.status === 207 || json?.partial === true || json?.health === 'degraded';
  const ok = res.ok && json?.ok !== false && !degraded;
  await recordCronWrapperHealth({
    integrationKey: 'gsc-sync',
    status: ok ? 'healthy' : degraded ? 'degraded' : 'failing',
    message: ok
      ? `GSC sync cron completed for ${json?.syncedDatesCount ?? 0} date(s).`
      : typeof json?.error === 'string' ? json.error : `GSC sync cron returned HTTP ${res.status}.`,
    latencyMs: Date.now() - startedAt,
    statusCode: res.status,
    errorCode: ok ? null : 'gsc_sync_failed',
    workspaceSlugs: [process.env.GSC_WORKSPACE_SLUG],
    details: {
      endpoint: targetUrl,
      targetDate: args.values.date || '3_days_ago',
      syncedDatesCount: json?.syncedDatesCount ?? null,
      failedDatesCount: json?.failedDatesCount ?? null,
      rowsFetched: json?.rowsFetched ?? null,
      rowsRetained: json?.rowsRetained ?? null,
      rowsPersisted: json?.rowsPersisted ?? null,
    },
  });

  console.log(JSON.stringify({
    event: 'gsc_sync_cron_trigger',
    status: res.status,
    ok,
    response: json,
  }));

  if (!ok) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(JSON.stringify({
    event: 'gsc_sync_cron_trigger',
    ok: false,
    error: err instanceof Error ? err.message : 'Fatal error in GSC sync trigger',
  }));
  process.exit(1);
});
