-- Enable RLS
create extension if not exists "uuid-ossp";

-- Projects
create table projects (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_at timestamptz default now(),
  created_by uuid references auth.users(id)
);

-- Project lines (rows inside a project)
create table project_lines (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete cascade not null,
  name text not null default 'Naamloos',
  owner_id uuid references auth.users(id),
  owner_name text,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'review', 'done')),
  prio int not null default 3 check (prio between 1 and 5),
  start_date date not null default current_date,
  due_date date,
  created_at timestamptz default now(),
  sort_order int default 0
);

-- Chat messages per line
create table line_messages (
  id uuid primary key default uuid_generate_v4(),
  line_id uuid references project_lines(id) on delete cascade not null,
  user_id uuid references auth.users(id),
  user_name text not null default 'Anoniem',
  content text not null,
  created_at timestamptz default now()
);

-- RLS policies
alter table projects enable row level security;
alter table project_lines enable row level security;
alter table line_messages enable row level security;

-- Allow all authenticated users to read/write (team tool)
create policy "team access projects" on projects for all using (auth.role() = 'authenticated');
create policy "team access lines" on project_lines for all using (auth.role() = 'authenticated');
create policy "team access messages" on line_messages for all using (auth.role() = 'authenticated');

-- Realtime
alter publication supabase_realtime add table project_lines;
alter publication supabase_realtime add table line_messages;
alter publication supabase_realtime add table projects;
