grant usage on schema public to authenticated;

do $$
declare
  current_table_name text;
  app_tables text[] := array[
    'students',
    'projects',
    'update_runs',
    'update_events',
    'review_statuses',
    'comments',
    'ai_analysis_jobs',
    'ai_reports',
    'project_ai_descriptions'
  ];
  admin_condition text := '(((select auth.jwt()) -> ''app_metadata'' ->> ''pilot_tracker_role'') = ''admin'')';
begin
  foreach current_table_name in array app_tables loop
    execute format(
      'alter table public.%I enable row level security',
      current_table_name
    );

    execute format(
      'revoke all on table public.%I from anon',
      current_table_name
    );

    execute format(
      'grant select, insert, update, delete on table public.%I to authenticated',
      current_table_name
    );

    execute format(
      'drop policy if exists pilot_tracker_admin_access on public.%I',
      current_table_name
    );

    execute format(
      'create policy pilot_tracker_admin_access on public.%I for all to authenticated using (%s) with check (%s)',
      current_table_name,
      admin_condition,
      admin_condition
    );
  end loop;
end;
$$;
