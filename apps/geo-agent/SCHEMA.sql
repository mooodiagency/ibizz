-- ───────────────────────────────────────────────────────────────────────
-- GEO Agent — Supabase schema (AI-zichtbaarheid & citatie-intelligence)
-- Hergebruikt bestaande `brands` tabel uit Brandstudio.
-- ───────────────────────────────────────────────────────────────────────

-- Projecten = wat we monitoren (merk + markt + concurrenten + topics)
create table geo_projects (
  id uuid primary key default uuid_generate_v4(),
  brand_id uuid references brands(id) on delete set null,
  name text not null,
  market text not null default 'Netherlands',
  website_url text,
  brand_terms text[] not null default '{}',        -- namen/varianten waarop we 't merk herkennen
  competitors text[] not null default '{}',
  topics text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  created_by uuid references auth.users(id),
  created_by_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Prompts = de vragen die de doelgroep aan LLM's stelt
create table geo_prompts (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references geo_projects(id) on delete cascade not null,
  text text not null,
  intent text not null default 'informational'
    check (intent in ('informational', 'commercial', 'comparison', 'transactional', 'navigational')),
  topic text,
  persona text,
  source text not null default 'ai'
    check (source in ('ai', 'reddit', 'cbs', 'news', 'trends', 'manual')),
  active boolean not null default true,
  created_at timestamptz default now()
);

-- Persona's = CBS-gegronde doelgroep-segmenten
create table geo_personas (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references geo_projects(id) on delete cascade not null,
  name text not null,
  segment text,
  demographics jsonb,
  situation text,
  motivations text[] not null default '{}',
  how_they_ask text,
  share int,
  source text not null default 'ai' check (source in ('cbs', 'ai')),
  created_at timestamptz default now()
);

-- Runs = een simulatie op een moment (alle actieve prompts tegen een engine)
create table geo_runs (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references geo_projects(id) on delete cascade not null,
  engine text not null check (engine in ('claude', 'gemini', 'openai', 'perplexity')),
  status text not null default 'running' check (status in ('running', 'done', 'failed')),
  prompt_count int not null default 0,
  summary jsonb,                                   -- {sov, brandMentions, sentiment, topCompetitors, topSources}
  error text,
  created_at timestamptz default now(),
  created_by uuid references auth.users(id)
);

-- Results = per prompt per run het geparste antwoord
create table geo_results (
  id uuid primary key default uuid_generate_v4(),
  run_id uuid references geo_runs(id) on delete cascade not null,
  prompt_id uuid references geo_prompts(id) on delete cascade not null,
  engine text not null,
  answer text not null default '',
  brand_mentioned boolean not null default false,
  brand_position int,
  competitors text[] not null default '{}',
  cited_sources jsonb not null default '[]'::jsonb,  -- [{domain, url, title}]
  sentiment text check (sentiment in ('positive', 'neutral', 'negative')),
  created_at timestamptz default now()
);

-- RLS — alle authenticated users
alter table geo_projects enable row level security;
alter table geo_prompts  enable row level security;
alter table geo_personas enable row level security;
alter table geo_runs     enable row level security;
alter table geo_results  enable row level security;

create policy "geo_projects auth" on geo_projects for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "geo_prompts auth"  on geo_prompts  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "geo_personas auth" on geo_personas for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "geo_runs auth"     on geo_runs     for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "geo_results auth"  on geo_results  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create index geo_personas_project_idx on geo_personas(project_id);
create index geo_prompts_project_idx on geo_prompts(project_id);
create index geo_runs_project_idx    on geo_runs(project_id);
create index geo_results_run_idx     on geo_results(run_id);

-- Auto-update updated_at
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger geo_projects_updated_at before update on geo_projects
  for each row execute function set_updated_at();
