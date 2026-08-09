-- Closes three integration gaps surfaced in the client/SLA/booking audit:
--
-- 1. client_portal_users.profile_id was declared NOT NULL but the manager-side
--    "Add Client" UI and createPortalClientWithProfile() insert NULL when no
--    profile is linked yet. The booking provisioning path always supplies a
--    profile, while the manual creation path does not. Relax to
--    nullable to match application semantics.
--
-- 2. booking_reservations only links to the provisioned portal client via a
--    string buried inside the metadata JSONB blob. Add a proper FK column so
--    we can query "bookings for client X" without scanning JSON, and so the
--    UI can render bidirectional links between booking and client surfaces.
--
-- 3. Backfill the new FK from existing metadata so existing client history
--    remains linked.

alter table public.client_portal_users
    alter column profile_id drop not null;

alter table public.booking_reservations
    add column if not exists portal_client_id uuid
        references public.client_portal_users(id) on delete set null;

create index if not exists booking_reservations_portal_client_id_idx
    on public.booking_reservations (portal_client_id)
    where portal_client_id is not null;

-- Backfill from metadata. The provisioned id is stored as a string under
-- metadata->>'provisionedPortalClientId'; only adopt values that still
-- resolve to a real client_portal_users row in the same workspace.
update public.booking_reservations as r
set portal_client_id = cpu.id
from public.client_portal_users as cpu
where r.portal_client_id is null
  and r.metadata ? 'provisionedPortalClientId'
  and (r.metadata ->> 'provisionedPortalClientId') is not null
  -- Guard against historical rows that may have non-UUID test data at this
  -- key. Without the regex gate, a single malformed value would abort the
  -- migration on whatever client DB carries it.
  and (r.metadata ->> 'provisionedPortalClientId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and (r.metadata ->> 'provisionedPortalClientId')::uuid = cpu.id
  and cpu.workspace_id = r.workspace_id;
