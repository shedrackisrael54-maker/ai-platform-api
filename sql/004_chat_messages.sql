-- Milestone 5: stores the chat history for each project's iterative
-- editing conversation.

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  created_at timestamptz default now()
);

alter table public.chat_messages enable row level security;

create policy "Users can view chat messages in their own projects"
  on public.chat_messages for select
  using (exists (select 1 from public.projects where projects.id = chat_messages.project_id and projects.owner_id = auth.uid()));

create policy "Users can insert chat messages in their own projects"
  on public.chat_messages for insert
  with check (exists (select 1 from public.projects where projects.id = chat_messages.project_id and projects.owner_id = auth.uid()));
