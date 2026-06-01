-- ───────────────────────────────────────────────────────────────────────
-- Video Agent — Supabase schema
--
-- Voer dit uit in de Supabase SQL editor om de Video Agent tabellen aan
-- te maken. Hergebruikt bestaande `brands` tabel uit Brandstudio.
--
-- Format gebaseerd op het FRENKY Dag 1 voorbeeld:
--   brief = één draaidag, bevat N scripts
--   elk script = 14 vaste velden incl. cast, productie-toets, shotlist,
--                tekst-in-beeld, montage, CTA, caption, variaties.
-- ───────────────────────────────────────────────────────────────────────

-- Briefs (één draaidag = N scripts)
create table video_briefs (
  id uuid primary key default uuid_generate_v4(),
  brand_id uuid references brands(id) on delete set null,
  dag_titel text not null,                            -- "Dag 1 — Op locatie"
  intro_subtitel text,                                -- "ibizz × FRENKY"
  overzicht text,                                     -- korte omschrijving wat in deze dag zit
  cast_totaal jsonb not null default '[]'::jsonb,     -- [{rol, aantal, omschrijving}]
  locaties jsonb not null default '[]'::jsonb,        -- [{naam, scripts: int[], toelichting}]
  status text not null default 'draft'
    check (status in ('draft', 'in_review', 'approved', 'archived')),
  versie int not null default 1,
  created_by uuid references auth.users(id),
  created_by_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Per script (1..N per brief)
create table video_scripts (
  id uuid primary key default uuid_generate_v4(),
  brief_id uuid references video_briefs(id) on delete cascade not null,
  nummer int not null,                                -- positie in dag-bundel (1..N)
  titel text not null,                                -- "De stille walk-by"
  doel text,
  inzicht text,
  locatie text,
  lengte_sec int,                                     -- ~35
  cast_rollen jsonb not null default '[]'::jsonb,     -- [{rol, aantal, omschrijving}] — 'cast' is reserved in PG
  productie_toets jsonb,                              -- {cast, locatie, props, permits, productietijd, risico, kostencategorie}
  hook text,
  concept text,
  script_lines jsonb not null default '[]'::jsonb,    -- [{type: 'vo'|'direction', text}]
  shotlist jsonb not null default '[]'::jsonb,        -- [{nummer, tag, beschrijving, start_sec, end_sec}]
  tekst_in_beeld jsonb not null default '[]'::jsonb,  -- [{start_sec, end_sec, text}]
  montage text,
  cta text,
  caption text,
  variaties text[] not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (brief_id, nummer)
);

-- Research videos (gescrapete TikTok/IG of handmatig geplakte URLs)
create table video_research (
  id uuid primary key default uuid_generate_v4(),
  brief_id uuid references video_briefs(id) on delete cascade not null,
  platform text not null
    check (platform in ('tiktok', 'instagram', 'youtube_shorts', 'other')),
  url text not null,
  caption text,
  views bigint,
  likes bigint,
  comments bigint,
  transcript text,                                    -- eerste 3 sec / volledige transcriptie
  hook_pattern text,                                  -- "POV / vergelijking / shock open / etc."
  notes text,
  source text not null default 'manual'
    check (source in ('scraped', 'manual')),
  added_by uuid references auth.users(id),
  added_by_name text,
  created_at timestamptz default now()
);

-- Versies + auto-changelog
create table video_brief_versions (
  id uuid primary key default uuid_generate_v4(),
  brief_id uuid references video_briefs(id) on delete cascade not null,
  versie int not null,
  snapshot jsonb not null,                            -- { brief: VideoBrief, scripts: VideoScript[] }
  changelog jsonb not null default '[]'::jsonb,      -- [{script_nummer, veld, tekst}]
  created_at timestamptz default now(),
  created_by uuid references auth.users(id),
  unique (brief_id, versie)
);

-- ───────────────────────────────────────────────────────────────────────
-- RLS (alle authenticated users → zelfde patroon als seo_briefs)
-- ───────────────────────────────────────────────────────────────────────
alter table video_briefs enable row level security;
alter table video_scripts enable row level security;
alter table video_research enable row level security;
alter table video_brief_versions enable row level security;

create policy "video_briefs auth read"   on video_briefs   for select using (auth.role() = 'authenticated');
create policy "video_briefs auth write"  on video_briefs   for all    using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "video_scripts auth read"  on video_scripts  for select using (auth.role() = 'authenticated');
create policy "video_scripts auth write" on video_scripts  for all    using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "video_research auth read"  on video_research for select using (auth.role() = 'authenticated');
create policy "video_research auth write" on video_research for all    using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "video_brief_versions auth read"  on video_brief_versions for select using (auth.role() = 'authenticated');
create policy "video_brief_versions auth write" on video_brief_versions for all    using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ───────────────────────────────────────────────────────────────────────
-- Indices
-- ───────────────────────────────────────────────────────────────────────
create index video_scripts_brief_id_idx       on video_scripts(brief_id);
create index video_research_brief_id_idx      on video_research(brief_id);
create index video_brief_versions_brief_id_idx on video_brief_versions(brief_id);

-- ───────────────────────────────────────────────────────────────────────
-- Auto-update updated_at trigger
-- ───────────────────────────────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger video_briefs_updated_at
  before update on video_briefs
  for each row execute function set_updated_at();

create trigger video_scripts_updated_at
  before update on video_scripts
  for each row execute function set_updated_at();
