alter table public.care_profiles
  add column fertilizer_every_days int check (fertilizer_every_days is null or fertilizer_every_days > 0),
  add column fertilizer_notes text;

create table public.fertilizer_events (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid not null references public.plants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  fertilized_at timestamptz not null default now()
);

create index on public.fertilizer_events (plant_id, fertilized_at desc);

alter table public.fertilizer_events enable row level security;

create policy "own fertilizer events" on public.fertilizer_events for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
