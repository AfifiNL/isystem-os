
begin;

-- newsletter_campaigns.automation_id was created without a foreign key in
-- 20260422230000_isystem_newsletter_management.sql. Add the reference so that
-- deleting an automation nulls its linked campaigns instead of leaving orphans.

update public.newsletter_campaigns c
set automation_id = null
where c.automation_id is not null
  and not exists (
    select 1 from public.newsletter_automations a where a.id = c.automation_id
  );

alter table public.newsletter_campaigns
drop constraint if exists newsletter_campaigns_automation_id_fkey;

alter table public.newsletter_campaigns
add constraint newsletter_campaigns_automation_id_fkey
foreign key (automation_id)
references public.newsletter_automations(id)
on delete set null;

create index if not exists newsletter_campaigns_automation_idx
on public.newsletter_campaigns (automation_id)
where automation_id is not null;

commit;
