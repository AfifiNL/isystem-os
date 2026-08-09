-- Atomic check-and-record for the AI rate limiter to eliminate the
-- check-then-insert race window. The previous pattern counted recent
-- requests, then — if under the cap — inserted a new row. Two concurrent
-- callers could both read the count before either insert landed and both be
-- admitted past the cap.
--
-- This function advisory-locks the (workspace, route) tuple for the scope of
-- the transaction, re-reads the count inside that lock, and only inserts when
-- still under the cap. Returns the decision plus the new `remaining` value.
--
-- The caller should stop calling the per-step `count_recent_ai_requests` and
-- `record_ai_request` functions when using this one. They are kept around for
-- other observability use-cases.

create or replace function public.check_and_record_ai_request(
  p_workspace_id uuid,
  p_route text,
  p_max_per_window integer,
  p_window_secs integer default 60
)
returns table (
  allowed boolean,
  used integer,
  remaining integer,
  retry_after_secs integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_lock_key bigint;
  v_used integer;
begin
  if p_max_per_window is null or p_max_per_window <= 0 then
    return query select true, 0, 0, 0;
    return;
  end if;

  -- 64-bit advisory lock keyed on workspace + route hash. Held only for the
  -- duration of the enclosing transaction (which this function runs in) so
  -- concurrent callers serialize inside this function but not across the rest
  -- of the request.
  v_lock_key := ('x' || substr(md5(p_workspace_id::text || ':' || p_route), 1, 16))::bit(64)::bigint;
  perform pg_advisory_xact_lock(v_lock_key);

  select count(*)::integer
    into v_used
    from public.ai_request_log
   where workspace_id = p_workspace_id
     and route = p_route
     and created_at > now() - make_interval(secs => p_window_secs);

  if v_used >= p_max_per_window then
    return query select false, v_used, 0, p_window_secs;
    return;
  end if;

  insert into public.ai_request_log (workspace_id, route)
       values (p_workspace_id, p_route);

  return query select true, v_used + 1, greatest(0, p_max_per_window - v_used - 1), 0;
end;
$$;

revoke all on function public.check_and_record_ai_request(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.check_and_record_ai_request(uuid, text, integer, integer) to service_role;

comment on function public.check_and_record_ai_request is
  'Atomic rate-limit check + record. Replaces count_recent_ai_requests + record_ai_request for decisions. Uses per-(workspace, route) advisory lock to serialize concurrent callers.';
