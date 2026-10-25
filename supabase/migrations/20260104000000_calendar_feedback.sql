alter table public.plants
  add column water_interval_override int check (water_interval_override is null or water_interval_override > 0);

alter table public.care_profiles
  add column ai_confidence text check (ai_confidence in ('low','medium','high')),
  add column ai_model text;

create table public.plant_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plant_id uuid references public.plants(id) on delete set null,
  ai_species_common text,
  ai_species_scientific text,
  ai_confidence text,
  model_used text,
  user_suggested_species text,
  note text,
  image_path text,
  status text not null default 'new' check (status in ('new','reviewed')),
  created_at timestamptz not null default now()
);

alter table public.plant_feedback enable row level security;

create policy "read own feedback" on public.plant_feedback for select
  using (auth.uid() = user_id);
