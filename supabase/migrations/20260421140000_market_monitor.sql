
create table if not exists workspace_market_monitor_config (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references workspaces(id) on delete cascade,
    competitor_domains text[] not null default '{}',
    authority_domains text[] not null default '{}',
    industry_keywords text[] not null default '{}',
    enabled boolean not null default false,
    last_run_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (workspace_id)
);

create table if not exists workspace_market_monitor_results (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references workspaces(id) on delete cascade,
    config_id uuid not null references workspace_market_monitor_config(id) on delete cascade,
    url text not null,
    title text,
    snippet text,
    change_type text not null,
    trust_tier integer not null default 1,
    published_date text,
    detected_at timestamptz not null default now(),
    read boolean not null default false,
    unique (workspace_id, url)
);

alter table workspace_market_monitor_config enable row level security;
alter table workspace_market_monitor_results enable row level security;

create policy "workspace members can manage monitor config"
    on workspace_market_monitor_config
    for all
    using (
        workspace_id in (
            select workspace_id from workspace_memberships where profile_id = auth.uid()
        )
    );

create policy "workspace members can read monitor results"
    on workspace_market_monitor_results
    for all
    using (
        workspace_id in (
            select workspace_id from workspace_memberships where profile_id = auth.uid()
        )
    );
