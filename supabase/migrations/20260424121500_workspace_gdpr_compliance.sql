
create table if not exists workspace_gdpr_settings (
    workspace_id uuid primary key references workspaces(id) on delete cascade,
    dpo_name text,
    dpo_email text,
    privacy_policy_url text,
    terms_url text,
    processing_legal_basis text not null default 'legitimate_interest',
    analytics_retention_days integer not null default 365,
    logs_retention_days integer not null default 90,
    marketing_retention_days integer not null default 730,
    sub_processors jsonb not null default '[]'::jsonb,
    data_regions text[] not null default '{EU}',
    consent_required boolean not null default true,
    cookie_consent_mode text not null default 'banner',
    notes text,
    updated_at timestamptz not null default now(),
    created_at timestamptz not null default now()
);

create table if not exists workspace_gdpr_requests (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references workspaces(id) on delete cascade,
    request_type text not null check (request_type in ('export', 'deletion', 'rectification', 'access', 'portability', 'restriction')),
    status text not null default 'open' check (status in ('open', 'in_progress', 'completed', 'rejected')),
    subject_email text not null,
    subject_name text,
    requested_at timestamptz not null default now(),
    due_at timestamptz not null default now() + interval '30 days',
    completed_at timestamptz,
    completed_by_profile_id uuid references auth.users(id) on delete set null,
    notes text,
    evidence jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists workspace_gdpr_requests_workspace_status_idx
    on public.workspace_gdpr_requests (workspace_id, status, requested_at desc);

create index if not exists workspace_gdpr_requests_subject_email_idx
    on public.workspace_gdpr_requests (workspace_id, subject_email);

alter table public.workspace_gdpr_settings enable row level security;
alter table public.workspace_gdpr_requests enable row level security;

create policy "workspace_gdpr_settings_workspace_members_all"
    on public.workspace_gdpr_settings
    for all
    using (
        workspace_id in (
            select workspace_id from workspace_memberships where profile_id = auth.uid()
        )
    );

create policy "workspace_gdpr_requests_workspace_members_all"
    on public.workspace_gdpr_requests
    for all
    using (
        workspace_id in (
            select workspace_id from workspace_memberships where profile_id = auth.uid()
        )
    );
