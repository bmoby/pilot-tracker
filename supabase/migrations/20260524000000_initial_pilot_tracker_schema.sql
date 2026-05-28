create table if not exists public.students (
  id text primary key check (id ~ '^student_'),
  display_name text not null check (btrim(display_name) <> ''),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id text primary key check (id ~ '^project_'),
  student_id text not null unique references public.students(id) on delete cascade,
  repository_url text,
  default_branch text not null default 'main' check (default_branch = 'main'),
  current_branch text,
  last_known_commit text,
  last_updated_at timestamptz,
  last_update_event_id text,
  status text not null check (
    status in (
      'not_connected',
      'never_updated',
      'updating',
      'first_loaded',
      'no_changes',
      'has_changes',
      'update_error',
      'local_copy_missing',
      'local_copy_unavailable',
      'repository_unavailable'
    )
  ),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.update_runs (
  id text primary key check (id ~ '^run_'),
  scope text not null check (scope in ('all_projects', 'single_project')),
  student_id text references public.students(id) on delete set null,
  project_id text references public.projects(id) on delete set null,
  status text not null check (
    status in (
      'running',
      'completed',
      'completed_with_errors',
      'failed'
    )
  ),
  started_at timestamptz not null,
  finished_at timestamptz,
  summary jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.update_events (
  id text primary key check (id ~ '^update_'),
  run_id text not null references public.update_runs(id) on delete cascade,
  student_id text not null references public.students(id) on delete cascade,
  project_id text not null references public.projects(id) on delete cascade,
  status text not null check (
    status in (
      'running',
      'completed',
      'failed',
      'interrupted'
    )
  ),
  started_at timestamptz not null,
  finished_at timestamptz,
  occurred_at timestamptz,
  repository_url_snapshot text,
  local_path_snapshot text,
  branch text not null default 'main' check (branch = 'main'),
  previous_commit text,
  new_commit text,
  new_commits_count integer check (new_commits_count is null or new_commits_count >= 0),
  has_changes boolean not null default false,
  result text check (
    result is null or result in (
      'skipped_no_repository',
      'cloned',
      'updated_with_changes',
      'updated_no_changes',
      'error'
    )
  ),
  error text,
  analysis_boundary_recorded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.review_statuses (
  id text primary key check (id ~ '^review_status_'),
  update_event_id text not null unique references public.update_events(id) on delete cascade,
  status text not null check (
    status in (
      'not_reviewed',
      'in_review',
      'reviewed',
      'needs_work',
      'needs_recheck',
      'skipped'
    )
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.comments (
  id text primary key check (id ~ '^comment_'),
  update_event_id text not null references public.update_events(id) on delete cascade,
  student_id text not null references public.students(id) on delete cascade,
  project_id text not null references public.projects(id) on delete cascade,
  body text not null check (btrim(body) <> ''),
  based_on_ai_report_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_analysis_jobs (
  id text primary key check (id ~ '^ai_job_'),
  update_event_id text not null references public.update_events(id) on delete cascade,
  student_id text not null references public.students(id) on delete cascade,
  project_id text not null references public.projects(id) on delete cascade,
  status text not null check (
    status in (
      'queued',
      'running',
      'completed',
      'failed',
      'interrupted'
    )
  ),
  queued_at timestamptz not null,
  started_at timestamptz,
  finished_at timestamptz,
  ai_report_id text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ai_analysis_jobs_one_active_per_update
  on public.ai_analysis_jobs(update_event_id)
  where status in ('queued', 'running');

create table if not exists public.ai_reports (
  id text primary key check (id ~ '^ai_report_'),
  update_event_id text not null references public.update_events(id) on delete cascade,
  student_id text not null references public.students(id) on delete cascade,
  project_id text not null references public.projects(id) on delete cascade,
  ai_job_id text references public.ai_analysis_jobs(id) on delete set null,
  status text not null check (status in ('running', 'ready', 'error')),
  analysis_mode text not null check (
    analysis_mode in (
      'current_state',
      'changes_between_commits'
    )
  ),
  previous_commit text,
  new_commit text not null,
  started_at timestamptz not null,
  finished_at timestamptz,
  summary text,
  functionality_summary text,
  manual_check_items jsonb not null default '[]'::jsonb,
  questions jsonb not null default '[]'::jsonb,
  draft_comment text,
  full_text text,
  structured_result jsonb not null default '{}'::jsonb,
  technical_details jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'comments_based_on_ai_report_id_fkey'
  ) then
    alter table public.comments
      add constraint comments_based_on_ai_report_id_fkey
      foreign key (based_on_ai_report_id)
      references public.ai_reports(id)
      on delete set null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'ai_analysis_jobs_ai_report_id_fkey'
  ) then
    alter table public.ai_analysis_jobs
      add constraint ai_analysis_jobs_ai_report_id_fkey
      foreign key (ai_report_id)
      references public.ai_reports(id)
      on delete set null;
  end if;
end $$;

create table if not exists public.project_ai_descriptions (
  id text primary key check (id ~ '^project_description_'),
  project_id text not null unique references public.projects(id) on delete cascade,
  status text not null check (status in ('missing', 'running', 'ready', 'error')),
  summary text,
  idea text,
  key_parts jsonb not null default '[]'::jsonb,
  source_ai_report_id text references public.ai_reports(id) on delete set null,
  source_commit text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_student_id_idx
  on public.projects(student_id);

create index if not exists update_events_student_id_idx
  on public.update_events(student_id);

create index if not exists update_events_project_id_idx
  on public.update_events(project_id);

create index if not exists update_events_occurred_at_idx
  on public.update_events(occurred_at desc);

create index if not exists comments_update_event_id_idx
  on public.comments(update_event_id);

create index if not exists review_statuses_update_event_id_idx
  on public.review_statuses(update_event_id);

create index if not exists ai_reports_update_event_id_idx
  on public.ai_reports(update_event_id);

create index if not exists ai_analysis_jobs_status_idx
  on public.ai_analysis_jobs(status);

create index if not exists ai_analysis_jobs_update_event_id_idx
  on public.ai_analysis_jobs(update_event_id);
