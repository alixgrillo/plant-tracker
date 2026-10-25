create table public.plants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  nickname text not null,
  species_common text,
  species_scientific text,
  photo_path text,
  location text,
  acquired_on date,
  notes text,
  created_at timestamptz not null default now()
);

create table public.care_profiles (
  plant_id uuid primary key references public.plants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  description text,
  light text,
  water_min_days int,
  water_max_days int,
  water_notes text,
  health_signs text,
  source text not null default 'ai' check (source in ('ai','manual')),
  model text,
  created_at timestamptz not null default now()
);

alter table public.plants enable row level security;
alter table public.care_profiles enable row level security;

create policy "own plants" on public.plants for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own care profiles" on public.care_profiles for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public) values ('plant-photos', 'plant-photos', false);

create policy "own photos" on storage.objects for all
  using (bucket_id = 'plant-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'plant-photos' and (storage.foldername(name))[1] = auth.uid()::text);
