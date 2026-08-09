begin;

-- Existing production data may already contain duplicate automation
-- enrollments from the pre-launch runner that inserted a row for every
-- trigger. Collapse those historical duplicates before adding idempotency
-- indexes. Keep the most actionable/latest enrollment and let dependent
-- dispatch jobs cascade for discarded duplicates.
with ranked_contact_enrollments as (
    select
        id,
        row_number() over (
            partition by automation_id, contact_id
            order by
                case status
                    when 'active' then 0
                    when 'pending' then 1
                    when 'completed' then 2
                    when 'stopped' then 3
                    when 'failed' then 4
                    else 5
                end,
                current_step_position desc,
                coalesce(next_run_at, updated_at, created_at) desc,
                created_at desc
        ) as duplicate_rank
    from public.newsletter_automation_enrollments
    where contact_id is not null
)
delete from public.newsletter_automation_enrollments e
using ranked_contact_enrollments r
where e.id = r.id
  and r.duplicate_rank > 1;

with ranked_content_enrollments as (
    select
        id,
        row_number() over (
            partition by automation_id, source_content_id
            order by
                case status
                    when 'active' then 0
                    when 'pending' then 1
                    when 'completed' then 2
                    when 'stopped' then 3
                    when 'failed' then 4
                    else 5
                end,
                current_step_position desc,
                coalesce(next_run_at, updated_at, created_at) desc,
                created_at desc
        ) as duplicate_rank
    from public.newsletter_automation_enrollments
    where source_content_id is not null
)
delete from public.newsletter_automation_enrollments e
using ranked_content_enrollments r
where e.id = r.id
  and r.duplicate_rank > 1;

create unique index if not exists newsletter_automation_enrollments_contact_unique_idx
    on public.newsletter_automation_enrollments (automation_id, contact_id)
    where contact_id is not null;

create unique index if not exists newsletter_automation_enrollments_content_unique_idx
    on public.newsletter_automation_enrollments (automation_id, source_content_id)
    where source_content_id is not null;

with ranked_active_jobs as (
    select
        id,
        row_number() over (
            partition by automation_enrollment_id
            order by
                case status when 'running' then 0 when 'pending' then 1 else 2 end,
                run_at asc,
                created_at asc
        ) as duplicate_rank
    from public.newsletter_dispatch_jobs
    where job_type = 'automation_step'
      and automation_enrollment_id is not null
      and status in ('pending', 'running')
)
delete from public.newsletter_dispatch_jobs j
using ranked_active_jobs r
where j.id = r.id
  and r.duplicate_rank > 1;

create unique index if not exists newsletter_dispatch_jobs_active_automation_enrollment_unique_idx
    on public.newsletter_dispatch_jobs (automation_enrollment_id)
    where job_type = 'automation_step'
      and automation_enrollment_id is not null
      and status in ('pending', 'running');

commit;
