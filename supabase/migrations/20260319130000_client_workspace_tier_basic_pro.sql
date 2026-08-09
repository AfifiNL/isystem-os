
alter table public.workspaces
add column if not exists workspace_tier text not null default 'pro';

update public.workspaces
set workspace_tier = coalesce(nullif(workspace_tier, ''), 'pro')
where workspace_tier is null
   or workspace_tier = '';

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'workspaces_workspace_tier_check'
    ) then
        alter table public.workspaces
        add constraint workspaces_workspace_tier_check
        check (workspace_tier in ('basic', 'pro'));
    end if;
end $$;
