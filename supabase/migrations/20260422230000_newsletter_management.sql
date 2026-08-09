
begin;

alter table public.content_items
drop constraint if exists content_items_type_check;

alter table public.content_items
add constraint content_items_type_check
check (type = any (array['video'::text, 'blog'::text, 'page'::text, 'newsletter_issue'::text]));

create table if not exists public.newsletter_audiences (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    name text not null,
    slug text not null,
    description text,
    is_default boolean not null default false,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (workspace_id, slug)
);

create table if not exists public.newsletter_contacts (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    email text not null,
    email_normalized text not null,
    first_name text,
    last_name text,
    locale text,
    status text not null default 'subscribed' check (status = any (array['subscribed'::text, 'unsubscribed'::text, 'bounced'::text, 'complained'::text])),
    source text not null default 'public_form',
    resend_contact_id text,
    subscribed_at timestamptz,
    unsubscribed_at timestamptz,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (workspace_id, email_normalized)
);

create table if not exists public.newsletter_audience_members (
    id uuid primary key default gen_random_uuid(),
    audience_id uuid not null references public.newsletter_audiences(id) on delete cascade,
    contact_id uuid not null references public.newsletter_contacts(id) on delete cascade,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    unique (audience_id, contact_id)
);

create table if not exists public.newsletter_campaign_templates (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    name text not null,
    slug text not null,
    workflow_type text not null default 'broadcast',
    subject_template text not null,
    preheader_template text,
    body_markdown_template text not null,
    html_template text,
    cta_label text,
    cta_url text,
    is_system boolean not null default false,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (workspace_id, slug)
);

create table if not exists public.newsletter_campaigns (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    source_content_id uuid references public.content_items(id) on delete set null,
    template_id uuid references public.newsletter_campaign_templates(id) on delete set null,
    automation_id uuid,
    audience_id uuid references public.newsletter_audiences(id) on delete set null,
    title text not null,
    workflow_type text not null default 'broadcast',
    status text not null default 'draft' check (status = any (array['draft'::text, 'scheduled'::text, 'sending'::text, 'sent'::text, 'paused'::text, 'failed'::text])),
    subject_line text not null,
    preheader text,
    body_markdown text not null,
    html_body text,
    from_name text,
    from_email text,
    reply_to_email text,
    scheduled_for timestamptz,
    sent_at timestamptz,
    last_error text,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.newsletter_campaign_recipients (
    id uuid primary key default gen_random_uuid(),
    campaign_id uuid not null references public.newsletter_campaigns(id) on delete cascade,
    contact_id uuid not null references public.newsletter_contacts(id) on delete cascade,
    email text not null,
    provider_message_id text,
    send_status text not null default 'pending' check (send_status = any (array['pending'::text, 'sent'::text, 'delivered'::text, 'opened'::text, 'clicked'::text, 'bounced'::text, 'complained'::text, 'unsubscribed'::text, 'failed'::text])),
    sent_at timestamptz,
    delivered_at timestamptz,
    opened_at timestamptz,
    clicked_at timestamptz,
    bounced_at timestamptz,
    complained_at timestamptz,
    unsubscribed_at timestamptz,
    last_error text,
    open_count integer not null default 0,
    click_count integer not null default 0,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (campaign_id, contact_id)
);

create table if not exists public.newsletter_automations (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    name text not null,
    slug text not null,
    trigger_type text not null check (trigger_type = any (array['manual'::text, 'contact_subscribed'::text, 'content_published'::text])),
    status text not null default 'draft' check (status = any (array['draft'::text, 'active'::text, 'paused'::text, 'archived'::text])),
    audience_id uuid references public.newsletter_audiences(id) on delete set null,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (workspace_id, slug)
);

create table if not exists public.newsletter_automation_steps (
    id uuid primary key default gen_random_uuid(),
    automation_id uuid not null references public.newsletter_automations(id) on delete cascade,
    position integer not null,
    step_type text not null check (step_type = any (array['send_campaign'::text, 'wait'::text])),
    template_id uuid references public.newsletter_campaign_templates(id) on delete set null,
    delay_minutes integer not null default 0,
    subject_line_override text,
    preheader_override text,
    body_markdown_override text,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (automation_id, position)
);

create table if not exists public.newsletter_automation_enrollments (
    id uuid primary key default gen_random_uuid(),
    automation_id uuid not null references public.newsletter_automations(id) on delete cascade,
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    contact_id uuid references public.newsletter_contacts(id) on delete cascade,
    source_content_id uuid references public.content_items(id) on delete set null,
    status text not null default 'pending' check (status = any (array['pending'::text, 'active'::text, 'completed'::text, 'stopped'::text, 'failed'::text])),
    current_step_position integer not null default 0,
    next_run_at timestamptz,
    last_error text,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.newsletter_dispatch_jobs (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    job_type text not null check (job_type = any (array['campaign_send'::text, 'automation_step'::text])),
    campaign_id uuid references public.newsletter_campaigns(id) on delete cascade,
    automation_enrollment_id uuid references public.newsletter_automation_enrollments(id) on delete cascade,
    status text not null default 'pending' check (status = any (array['pending'::text, 'running'::text, 'completed'::text, 'failed'::text])),
    run_at timestamptz not null default now(),
    attempts integer not null default 0,
    last_error text,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.newsletter_webhook_events (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid references public.workspaces(id) on delete set null,
    provider text not null,
    event_type text not null,
    provider_event_id text,
    payload jsonb not null default '{}'::jsonb,
    processed_at timestamptz,
    created_at timestamptz not null default now(),
    unique (provider, provider_event_id)
);

create index if not exists newsletter_audiences_workspace_idx on public.newsletter_audiences (workspace_id, created_at desc);
create index if not exists newsletter_contacts_workspace_idx on public.newsletter_contacts (workspace_id, status, created_at desc);
create index if not exists newsletter_audience_members_audience_idx on public.newsletter_audience_members (audience_id, created_at desc);
create index if not exists newsletter_campaigns_workspace_idx on public.newsletter_campaigns (workspace_id, status, created_at desc);
create index if not exists newsletter_campaign_recipients_campaign_idx on public.newsletter_campaign_recipients (campaign_id, send_status);
create index if not exists newsletter_campaign_recipients_provider_idx on public.newsletter_campaign_recipients (provider_message_id);
create index if not exists newsletter_automations_workspace_idx on public.newsletter_automations (workspace_id, status, created_at desc);
create index if not exists newsletter_automation_enrollments_next_run_idx on public.newsletter_automation_enrollments (workspace_id, status, next_run_at);
create index if not exists newsletter_dispatch_jobs_run_idx on public.newsletter_dispatch_jobs (workspace_id, status, run_at);
create index if not exists newsletter_webhook_events_workspace_idx on public.newsletter_webhook_events (workspace_id, created_at desc);

alter table public.newsletter_audiences enable row level security;
alter table public.newsletter_contacts enable row level security;
alter table public.newsletter_audience_members enable row level security;
alter table public.newsletter_campaign_templates enable row level security;
alter table public.newsletter_campaigns enable row level security;
alter table public.newsletter_campaign_recipients enable row level security;
alter table public.newsletter_automations enable row level security;
alter table public.newsletter_automation_steps enable row level security;
alter table public.newsletter_automation_enrollments enable row level security;
alter table public.newsletter_dispatch_jobs enable row level security;
alter table public.newsletter_webhook_events enable row level security;

do $$
declare
    target_table text;
begin
    foreach target_table in array array[
        'newsletter_audiences',
        'newsletter_contacts',
        'newsletter_audience_members',
        'newsletter_campaign_templates',
        'newsletter_campaigns',
        'newsletter_campaign_recipients',
        'newsletter_automations',
        'newsletter_automation_steps',
        'newsletter_automation_enrollments',
        'newsletter_dispatch_jobs',
        'newsletter_webhook_events'
    ] loop
        execute format('drop policy if exists "%s_select_policy" on public.%I', target_table, target_table);
        execute format('drop policy if exists "%s_insert_policy" on public.%I', target_table, target_table);
        execute format('drop policy if exists "%s_update_policy" on public.%I', target_table, target_table);
        execute format('drop policy if exists "%s_delete_policy" on public.%I', target_table, target_table);
    end loop;
end $$;

create policy "newsletter_audiences_select_policy" on public.newsletter_audiences for select using (public.can_access_workspace(workspace_id, null));
create policy "newsletter_audiences_insert_policy" on public.newsletter_audiences for insert with check (public.can_access_workspace(workspace_id, 'content.write'));
create policy "newsletter_audiences_update_policy" on public.newsletter_audiences for update using (public.can_access_workspace(workspace_id, 'content.write')) with check (public.can_access_workspace(workspace_id, 'content.write'));
create policy "newsletter_audiences_delete_policy" on public.newsletter_audiences for delete using (public.can_access_workspace(workspace_id, 'content.write'));

create policy "newsletter_contacts_select_policy" on public.newsletter_contacts for select using (public.can_access_workspace(workspace_id, null));
create policy "newsletter_contacts_insert_policy" on public.newsletter_contacts for insert with check (public.can_access_workspace(workspace_id, 'content.write'));
create policy "newsletter_contacts_update_policy" on public.newsletter_contacts for update using (public.can_access_workspace(workspace_id, 'content.write')) with check (public.can_access_workspace(workspace_id, 'content.write'));
create policy "newsletter_contacts_delete_policy" on public.newsletter_contacts for delete using (public.can_access_workspace(workspace_id, 'content.write'));

create policy "newsletter_audience_members_select_policy" on public.newsletter_audience_members for select using (exists (select 1 from public.newsletter_audiences a where a.id = audience_id and public.can_access_workspace(a.workspace_id, null)));
create policy "newsletter_audience_members_insert_policy" on public.newsletter_audience_members for insert with check (exists (select 1 from public.newsletter_audiences a where a.id = audience_id and public.can_access_workspace(a.workspace_id, 'content.write')));
create policy "newsletter_audience_members_update_policy" on public.newsletter_audience_members for update using (exists (select 1 from public.newsletter_audiences a where a.id = audience_id and public.can_access_workspace(a.workspace_id, 'content.write'))) with check (exists (select 1 from public.newsletter_audiences a where a.id = audience_id and public.can_access_workspace(a.workspace_id, 'content.write')));
create policy "newsletter_audience_members_delete_policy" on public.newsletter_audience_members for delete using (exists (select 1 from public.newsletter_audiences a where a.id = audience_id and public.can_access_workspace(a.workspace_id, 'content.write')));

create policy "newsletter_campaign_templates_select_policy" on public.newsletter_campaign_templates for select using (public.can_access_workspace(workspace_id, null));
create policy "newsletter_campaign_templates_insert_policy" on public.newsletter_campaign_templates for insert with check (public.can_access_workspace(workspace_id, 'content.write'));
create policy "newsletter_campaign_templates_update_policy" on public.newsletter_campaign_templates for update using (public.can_access_workspace(workspace_id, 'content.write')) with check (public.can_access_workspace(workspace_id, 'content.write'));
create policy "newsletter_campaign_templates_delete_policy" on public.newsletter_campaign_templates for delete using (public.can_access_workspace(workspace_id, 'content.write'));

create policy "newsletter_campaigns_select_policy" on public.newsletter_campaigns for select using (public.can_access_workspace(workspace_id, null));
create policy "newsletter_campaigns_insert_policy" on public.newsletter_campaigns for insert with check (public.can_access_workspace(workspace_id, 'content.write'));
create policy "newsletter_campaigns_update_policy" on public.newsletter_campaigns for update using (public.can_access_workspace(workspace_id, 'content.write')) with check (public.can_access_workspace(workspace_id, 'content.write'));
create policy "newsletter_campaigns_delete_policy" on public.newsletter_campaigns for delete using (public.can_access_workspace(workspace_id, 'content.write'));

create policy "newsletter_campaign_recipients_select_policy" on public.newsletter_campaign_recipients for select using (exists (select 1 from public.newsletter_campaigns c where c.id = campaign_id and public.can_access_workspace(c.workspace_id, null)));
create policy "newsletter_campaign_recipients_insert_policy" on public.newsletter_campaign_recipients for insert with check (exists (select 1 from public.newsletter_campaigns c where c.id = campaign_id and public.can_access_workspace(c.workspace_id, 'content.write')));
create policy "newsletter_campaign_recipients_update_policy" on public.newsletter_campaign_recipients for update using (exists (select 1 from public.newsletter_campaigns c where c.id = campaign_id and public.can_access_workspace(c.workspace_id, 'content.write'))) with check (exists (select 1 from public.newsletter_campaigns c where c.id = campaign_id and public.can_access_workspace(c.workspace_id, 'content.write')));
create policy "newsletter_campaign_recipients_delete_policy" on public.newsletter_campaign_recipients for delete using (exists (select 1 from public.newsletter_campaigns c where c.id = campaign_id and public.can_access_workspace(c.workspace_id, 'content.write')));

create policy "newsletter_automations_select_policy" on public.newsletter_automations for select using (public.can_access_workspace(workspace_id, null));
create policy "newsletter_automations_insert_policy" on public.newsletter_automations for insert with check (public.can_access_workspace(workspace_id, 'content.write'));
create policy "newsletter_automations_update_policy" on public.newsletter_automations for update using (public.can_access_workspace(workspace_id, 'content.write')) with check (public.can_access_workspace(workspace_id, 'content.write'));
create policy "newsletter_automations_delete_policy" on public.newsletter_automations for delete using (public.can_access_workspace(workspace_id, 'content.write'));

create policy "newsletter_automation_steps_select_policy" on public.newsletter_automation_steps for select using (exists (select 1 from public.newsletter_automations a where a.id = automation_id and public.can_access_workspace(a.workspace_id, null)));
create policy "newsletter_automation_steps_insert_policy" on public.newsletter_automation_steps for insert with check (exists (select 1 from public.newsletter_automations a where a.id = automation_id and public.can_access_workspace(a.workspace_id, 'content.write')));
create policy "newsletter_automation_steps_update_policy" on public.newsletter_automation_steps for update using (exists (select 1 from public.newsletter_automations a where a.id = automation_id and public.can_access_workspace(a.workspace_id, 'content.write'))) with check (exists (select 1 from public.newsletter_automations a where a.id = automation_id and public.can_access_workspace(a.workspace_id, 'content.write')));
create policy "newsletter_automation_steps_delete_policy" on public.newsletter_automation_steps for delete using (exists (select 1 from public.newsletter_automations a where a.id = automation_id and public.can_access_workspace(a.workspace_id, 'content.write')));

create policy "newsletter_automation_enrollments_select_policy" on public.newsletter_automation_enrollments for select using (public.can_access_workspace(workspace_id, null));
create policy "newsletter_automation_enrollments_insert_policy" on public.newsletter_automation_enrollments for insert with check (public.can_access_workspace(workspace_id, 'content.write'));
create policy "newsletter_automation_enrollments_update_policy" on public.newsletter_automation_enrollments for update using (public.can_access_workspace(workspace_id, 'content.write')) with check (public.can_access_workspace(workspace_id, 'content.write'));
create policy "newsletter_automation_enrollments_delete_policy" on public.newsletter_automation_enrollments for delete using (public.can_access_workspace(workspace_id, 'content.write'));

create policy "newsletter_dispatch_jobs_select_policy" on public.newsletter_dispatch_jobs for select using (public.can_access_workspace(workspace_id, null));
create policy "newsletter_dispatch_jobs_insert_policy" on public.newsletter_dispatch_jobs for insert with check (public.can_access_workspace(workspace_id, 'content.write'));
create policy "newsletter_dispatch_jobs_update_policy" on public.newsletter_dispatch_jobs for update using (public.can_access_workspace(workspace_id, 'content.write')) with check (public.can_access_workspace(workspace_id, 'content.write'));
create policy "newsletter_dispatch_jobs_delete_policy" on public.newsletter_dispatch_jobs for delete using (public.can_access_workspace(workspace_id, 'content.write'));

create policy "newsletter_webhook_events_select_policy" on public.newsletter_webhook_events for select using (workspace_id is null or public.can_access_workspace(workspace_id, null));
create policy "newsletter_webhook_events_insert_policy" on public.newsletter_webhook_events for insert with check (workspace_id is null or public.can_access_workspace(workspace_id, 'content.write'));
create policy "newsletter_webhook_events_update_policy" on public.newsletter_webhook_events for update using (workspace_id is null or public.can_access_workspace(workspace_id, 'content.write')) with check (workspace_id is null or public.can_access_workspace(workspace_id, 'content.write'));
create policy "newsletter_webhook_events_delete_policy" on public.newsletter_webhook_events for delete using (workspace_id is null or public.can_access_workspace(workspace_id, 'content.write'));

do $$
declare
    trigger_table text;
begin
    foreach trigger_table in array array[
        'newsletter_audiences',
        'newsletter_contacts',
        'newsletter_campaign_templates',
        'newsletter_campaigns',
        'newsletter_campaign_recipients',
        'newsletter_automations',
        'newsletter_automation_steps',
        'newsletter_automation_enrollments',
        'newsletter_dispatch_jobs'
    ] loop
        if not exists (
            select 1 from pg_trigger
            where tgname = format('set_updated_at_%s', trigger_table)
        ) then
            execute format(
                'create trigger %I before update on public.%I for each row execute function public.handle_updated_at()',
                format('set_updated_at_%s', trigger_table),
                trigger_table
            );
        end if;
    end loop;
end $$;

commit;
