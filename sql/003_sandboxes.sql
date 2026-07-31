-- Milestone 3: tracks which E2B sandbox (if any) is currently
-- running for a given project, so we can reconnect to it across
-- requests instead of creating a new one every time.

create table public.sandboxes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  provider text not null default 'e2b',
  external_sandbox_id text not null,
  status text not null default 'running' check (status in ('provisioning', 'running', 'stopped', 'error')),
  preview_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (project_id)
);

alter table public.sandboxes enable row level security;

create policy "Users can view sandboxes for their own projects"
  on public.sandboxes for select
  using (exists (select 1 from public.projects where projects.id = sandboxes.project_id and projects.owner_id = auth.uid()));

create policy "Users can insert sandboxes for their own projects"
  on public.sandboxes for insert
  with check (exists (select 1 from public.projects where projects.id = sandboxes.project_id and projects.owner_id = auth.uid()));

create policy "Users can update sandboxes for their own projects"
  on public.sandboxes for update
  using (exists (select 1 from public.projects where projects.id = sandboxes.project_id and projects.owner_id = auth.uid()));

create policy "Users can delete sandboxes for their own projects"
  on public.sandboxes for delete
  using (exists (select 1 from public.projects where projects.id = sandboxes.project_id and projects.owner_id = auth.uid()));
