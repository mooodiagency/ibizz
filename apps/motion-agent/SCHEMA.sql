-- ───────────────────────────────────────────────────────────────────────
-- Motion Agent — Supabase schema (foto → video AI-animatie)
-- Hergebruikt bestaande `brands` tabel uit Brandstudio.
-- ───────────────────────────────────────────────────────────────────────

create table motion_generations (
  id uuid primary key default uuid_generate_v4(),
  brand_id uuid references brands(id) on delete set null,
  user_id uuid references auth.users(id),
  user_name text,
  prompt text not null,
  model text not null,                                 -- veo-3.1 / veo-3.1-fast / veo-3.1-lite / kling / runway
  aspect_ratio text not null default '9:16'
    check (aspect_ratio in ('16:9', '9:16')),
  resolution text not null default '720p'
    check (resolution in ('720p', '1080p')),
  duration_sec int,
  source_image_url text not null,                      -- bron-foto (public URL)
  source_image_path text not null,                     -- storage path bron-foto
  status text not null default 'running'
    check (status in ('running', 'succeeded', 'failed')),
  operation_name text,                                 -- Veo long-running operation ref
  result_url text,                                     -- resultaat-video public URL
  result_storage_path text,
  error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS — alle authenticated users (zelfde patroon als andere apps)
alter table motion_generations enable row level security;

create policy "motion_generations auth read"  on motion_generations
  for select using (auth.role() = 'authenticated');
create policy "motion_generations auth write" on motion_generations
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create index motion_generations_brand_idx   on motion_generations(brand_id);
create index motion_generations_status_idx  on motion_generations(status);
create index motion_generations_created_idx on motion_generations(created_at desc);

-- Auto-update updated_at
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger motion_generations_updated_at
  before update on motion_generations
  for each row execute function set_updated_at();

-- ───────────────────────────────────────────────────────────────────────
-- STORAGE BUCKET (handmatig aanmaken in Supabase dashboard, of via deze SQL)
-- Bucket: motion-generations  → PUBLIC
-- ───────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('motion-generations', 'motion-generations', true)
on conflict (id) do nothing;

-- Storage policies: authenticated upload + delete, public read
create policy "motion bucket public read"
  on storage.objects for select
  using (bucket_id = 'motion-generations');

create policy "motion bucket auth upload"
  on storage.objects for insert
  with check (bucket_id = 'motion-generations' and auth.role() = 'authenticated');

create policy "motion bucket auth update"
  on storage.objects for update
  using (bucket_id = 'motion-generations' and auth.role() = 'authenticated');

create policy "motion bucket auth delete"
  on storage.objects for delete
  using (bucket_id = 'motion-generations' and auth.role() = 'authenticated');
