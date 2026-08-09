-- Public free-traffic tools surface (/tools/*). Three tables:
--   - tool_leads: every public tool submission (anonymous unless email opt-in)
--   - tool_scan_cache: cached URL-scan results (GDPR scanner, conversion audit, AI visibility)
--   - tool_rate_limits: per-IP-hash sliding-window rate limit buckets
--
-- All three are server-action only; anon role gets no access. The service-role
-- key is required for writes (see src/features/tools/shared/store.ts).

-- ─── tool_leads ─────────────────────────────────────────────────────────────

create table if not exists public.tool_leads (
    id uuid primary key default gen_random_uuid(),
    tool_slug text not null,
    email text,
    payload jsonb not null default '{}'::jsonb,
    result jsonb not null default '{}'::jsonb,
    share_token text unique,
    ip_hash text,
    user_agent_hash text,
    locale text,
    referrer text,
    utm jsonb default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists tool_leads_tool_slug_created_at_idx
    on public.tool_leads (tool_slug, created_at desc);

create index if not exists tool_leads_email_idx
    on public.tool_leads (lower(email))
    where email is not null;

create index if not exists tool_leads_share_token_idx
    on public.tool_leads (share_token)
    where share_token is not null;

alter table public.tool_leads enable row level security;

-- No anon policies: writes happen via service-role from server actions only.
-- Share pages do their own service-role lookup by share_token.

-- ─── tool_scan_cache ────────────────────────────────────────────────────────

create table if not exists public.tool_scan_cache (
    id uuid primary key default gen_random_uuid(),
    tool_slug text not null,
    cache_key text not null,
    result jsonb not null,
    fetched_at timestamptz not null default now(),
    expires_at timestamptz not null,
    constraint tool_scan_cache_slug_key_unique unique (tool_slug, cache_key)
);

create index if not exists tool_scan_cache_expires_at_idx
    on public.tool_scan_cache (expires_at);

alter table public.tool_scan_cache enable row level security;

-- ─── tool_rate_limits ───────────────────────────────────────────────────────

create table if not exists public.tool_rate_limits (
    bucket text primary key,
    count integer not null default 0,
    window_start timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists tool_rate_limits_window_start_idx
    on public.tool_rate_limits (window_start);

alter table public.tool_rate_limits enable row level security;

-- ─── atomic rate-limit increment ────────────────────────────────────────────
--
-- Increment a bucket's counter inside a single round-trip and return the
-- post-increment count. The bucket key encodes ip-hash + tool-slug + day, so
-- we can use a coarse 24h window without per-window cleanup.

create or replace function public.tool_rate_limit_increment(
    p_bucket text,
    p_window_start timestamptz
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    new_count integer;
begin
    insert into public.tool_rate_limits (bucket, count, window_start, updated_at)
    values (p_bucket, 1, p_window_start, now())
    on conflict (bucket) do update
        set count = case
                when public.tool_rate_limits.window_start < p_window_start
                    then 1
                else public.tool_rate_limits.count + 1
            end,
            window_start = greatest(public.tool_rate_limits.window_start, p_window_start),
            updated_at = now()
    returning count into new_count;

    return new_count;
end;
$$;

revoke all on function public.tool_rate_limit_increment(text, timestamptz) from public;
grant execute on function public.tool_rate_limit_increment(text, timestamptz) to service_role;

-- ─── cache eviction helper (called by cron in app code) ────────────────────

create or replace function public.tool_scan_cache_evict_expired()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    rows_deleted integer;
begin
    delete from public.tool_scan_cache where expires_at < now();
    get diagnostics rows_deleted = row_count;
    return rows_deleted;
end;
$$;

revoke all on function public.tool_scan_cache_evict_expired() from public;
grant execute on function public.tool_scan_cache_evict_expired() to service_role;
