create table public.watering_events (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid not null references public.plants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  watered_at timestamptz not null default now()
);

create index on public.watering_events (plant_id, watered_at desc);

alter table public.watering_events enable row level security;

create policy "own watering events" on public.watering_events for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
