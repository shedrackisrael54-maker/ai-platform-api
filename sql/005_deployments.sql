-- Milestone 8: tracks each deployment of a project to Vercel.

create table public.deployments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  provider text not null default 'vercel',
  external_deployment_id text,
  status text not null default 'queued' check (status in ('queued', 'building', 'ready', 'error')),
  url text,
  created_at timestamptz default now()
);

alter table public.deployments enable row level security;

create policy "Users can view deployments for their own projects"
  on public.deployments for select
  using (exists (select 1 from public.projects where projects.id = deployments.project_id and projects.owner_id = auth.uid()));

create policy "Users can insert deployments for their own projects"
  on public.deployments for insert
  with check (exists (select 1 from public.projects where projects.id = deployments.project_id and projects.owner_id = auth.uid()));
