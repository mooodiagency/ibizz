-- ───────────────────────────────────────────────────────────────────────
-- SEO Agent — Supabase schema
--
-- Voer dit uit in de Supabase SQL editor om de SEO Agent tabellen aan te
-- maken. Hergebruikt bestaande `brands` tabel uit Brandstudio.
-- ───────────────────────────────────────────────────────────────────────

-- Briefs (per klant / campagne / project)
create table seo_briefs (
  id uuid primary key default uuid_generate_v4(),
  brand_id uuid references brands(id) on delete set null,
  title text not null,
  goal text,
  monthly_target text,                     -- vrij tekstveld bv. "1000 organic visitors/maand"
  primary_market text not null default 'Netherlands',
  website_url text,
  competitors text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'in_review', 'approved', 'archived')),
  created_by uuid references auth.users(id),
  created_by_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Personas per brief (meerdere mogelijk)
create table seo_personas (
  id uuid primary key default uuid_generate_v4(),
  brief_id uuid references seo_briefs(id) on delete cascade not null,
  name text not null,                      -- "Tech-savvy Tom"
  avatar_emoji text not null default '👤',
  one_liner text,                          -- "ZZP'er die overweegt eigen BV op te richten"
  demographics jsonb,                      -- { age_range, occupation, location, family, income }
  pains text[] not null default '{}',
  motivations text[] not null default '{}',
  search_behavior text[] not null default '{}',
  channels text[] not null default '{}',
  sort_order int not null default 0,
  created_at timestamptz default now()
);

-- Themes per brief
create table seo_themes (
  id uuid primary key default uuid_generate_v4(),
  brief_id uuid references seo_briefs(id) on delete cascade not null,
  name text not null,
  description text,
  search_intent text check (search_intent in ('informational', 'commercial', 'transactional', 'navigational')),
  status text not null default 'active' check (status in ('active', 'on_hold', 'archived')),
  sort_order int not null default 0,
  created_at timestamptz default now()
);

-- Koppelingstabel persona × theme (welk thema bedient welke persona)
create table seo_persona_themes (
  persona_id uuid references seo_personas(id) on delete cascade,
  theme_id uuid references seo_themes(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (persona_id, theme_id)
);

-- Messages per brief (kernboodschappen)
create table seo_messages (
  id uuid primary key default uuid_generate_v4(),
  brief_id uuid references seo_briefs(id) on delete cascade not null,
  message text not null,
  notes text,
  created_at timestamptz default now()
);

create table seo_message_personas (
  message_id uuid references seo_messages(id) on delete cascade,
  persona_id uuid references seo_personas(id) on delete cascade,
  primary key (message_id, persona_id)
);

-- Content map: pages te schrijven
create table seo_pages (
  id uuid primary key default uuid_generate_v4(),
  brief_id uuid references seo_briefs(id) on delete cascade not null,
  persona_id uuid references seo_personas(id) on delete set null,
  theme_id uuid references seo_themes(id) on delete set null,
  topic text not null,
  target_keyword text,
  secondary_keywords text[] not null default '{}',
  search_intent text check (search_intent in ('informational', 'commercial', 'transactional', 'navigational')),
  estimated_volume int,
  status text not null default 'idea' check (status in ('idea', 'planned', 'in_progress', 'review', 'published')),
  notes text,
  lessons_applied text[] not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Writer briefs (de PDFs die naar Caven gaan)
create table seo_writer_briefs (
  id uuid primary key default uuid_generate_v4(),
  page_id uuid references seo_pages(id) on delete cascade not null,
  content jsonb not null,                  -- volledige brief structuur
  pdf_url text,                            -- gegenereerde PDF in storage
  sent_to text,                            -- "Caven"
  sent_at timestamptz,
  status text not null default 'draft' check (status in ('draft', 'sent', 'completed')),
  created_at timestamptz default now()
);

-- Articles — gegenereerde content per pagina (kan meerdere versies hebben per pagina)
create table seo_articles (
  id uuid primary key default uuid_generate_v4(),
  page_id uuid references seo_pages(id) on delete cascade not null,
  writer_brief_id uuid references seo_writer_briefs(id) on delete set null,
  title text not null,
  meta_title text,                           -- SEO titel (max 60 char ideaal)
  meta_description text,                     -- SEO beschrijving (max 160 char ideaal)
  content_markdown text not null,            -- Hoofdcontent in markdown
  model text not null,                       -- bv. 'claude-sonnet-4-6'
  word_count int not null default 0,
  status text not null default 'draft' check (status in ('draft', 'review', 'approved', 'published')),
  is_active boolean not null default true,   -- per page slechts 1 active = de gebruikte versie
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references auth.users(id),
  created_by_name text
);

create index seo_articles_page_idx on seo_articles(page_id, is_active);

alter table seo_articles enable row level security;
create policy "authenticated all" on seo_articles for all using (auth.role() = 'authenticated');

-- Lessons learned — wat werkte goed/fout per persona/theme
create table seo_lessons (
  id uuid primary key default uuid_generate_v4(),
  brief_id uuid references seo_briefs(id) on delete cascade not null,
  persona_id uuid references seo_personas(id) on delete set null,
  theme_id uuid references seo_themes(id) on delete set null,
  type text not null check (type in ('success', 'failure', 'observation')),
  description text not null,
  context text,                            -- bijv. URL van de page
  created_at timestamptz default now(),
  created_by uuid references auth.users(id)
);

-- ───────────────────────────────────────────────────────────────────────
-- RLS — team tool, alle authenticated users mogen alles
-- ───────────────────────────────────────────────────────────────────────

alter table seo_briefs enable row level security;
alter table seo_personas enable row level security;
alter table seo_themes enable row level security;
alter table seo_persona_themes enable row level security;
alter table seo_messages enable row level security;
alter table seo_message_personas enable row level security;
alter table seo_pages enable row level security;
alter table seo_writer_briefs enable row level security;
alter table seo_lessons enable row level security;

create policy "authenticated all" on seo_briefs            for all using (auth.role() = 'authenticated');
create policy "authenticated all" on seo_personas          for all using (auth.role() = 'authenticated');
create policy "authenticated all" on seo_themes            for all using (auth.role() = 'authenticated');
create policy "authenticated all" on seo_persona_themes    for all using (auth.role() = 'authenticated');
create policy "authenticated all" on seo_messages          for all using (auth.role() = 'authenticated');
create policy "authenticated all" on seo_message_personas  for all using (auth.role() = 'authenticated');
create policy "authenticated all" on seo_pages             for all using (auth.role() = 'authenticated');
create policy "authenticated all" on seo_writer_briefs     for all using (auth.role() = 'authenticated');
create policy "authenticated all" on seo_lessons           for all using (auth.role() = 'authenticated');

-- ───────────────────────────────────────────────────────────────────────
-- Indexes voor performance
-- ───────────────────────────────────────────────────────────────────────

create index seo_personas_brief_idx       on seo_personas(brief_id, sort_order);
create index seo_themes_brief_idx         on seo_themes(brief_id, sort_order);
create index seo_pages_brief_idx          on seo_pages(brief_id, status);
create index seo_pages_persona_idx        on seo_pages(persona_id);
create index seo_pages_theme_idx          on seo_pages(theme_id);
create index seo_lessons_brief_idx        on seo_lessons(brief_id);
create index seo_lessons_persona_idx      on seo_lessons(persona_id);
