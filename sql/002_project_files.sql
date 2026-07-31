-- Milestone 2: stores AI-generated file contents before the sandbox
-- (Milestone 3) exists to hold them. Once sandboxes are wired in,
-- this table becomes a cache/fallback rather than the source of truth.

create table public.project_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  path text not null,
  content text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (project_id, path)
);

alter table public.project_files enable row level security;

-- Users can only see/modify files belonging to projects they own.
create policy "Users can view files in their own projects"
  on public.project_files for select
  using (
    exists (
      select 1 from public.projects
      where projects.id = project_files.project_id
      and projects.owner_id = auth.uid()
    )
  );

create policy "Users can insert files in their own projects"
  on public.project_files for insert
  with check (
    exists (
      select 1 from public.projects
      where projects.id = project_files.project_id
      and projects.owner_id = auth.uid()
    )
  );

create policy "Users can update files in their own projects"
  on public.project_files for update
  using (
    exists (
      select 1 from public.projects
      where projects.id = project_files.project_id
      and projects.owner_id = auth.uid()
    )
  );

create policy "Users can delete files in their own projects"
  on public.project_files for delete
  using (
    exists (
      select 1 from public.projects
      where projects.id = project_files.project_id
      and projects.owner_id = auth.uid()
    )
  );
