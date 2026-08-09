
alter table workspace_market_monitor_results
    add column if not exists archived boolean not null default false,
    add column if not exists archived_at timestamptz;

create index if not exists workspace_market_monitor_results_workspace_detected_idx
    on workspace_market_monitor_results (workspace_id, detected_at desc);

create index if not exists workspace_market_monitor_results_workspace_archived_idx
    on workspace_market_monitor_results (workspace_id, archived);
