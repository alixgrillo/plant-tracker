alter table public.watering_events
  add column recommended_water_min_days int,
  add column recommended_water_max_days int,
  add column water_interval_override_days int;

alter table public.fertilizer_events
  add column recommended_fertilizer_every_days int;

create function public.snapshot_watering_schedule()
returns trigger
language plpgsql
as $$
begin
  select c.water_min_days, c.water_max_days, p.water_interval_override
    into new.recommended_water_min_days, new.recommended_water_max_days, new.water_interval_override_days
  from public.plants p
  left join public.care_profiles c on c.plant_id = p.id and c.user_id = p.user_id
  where p.id = new.plant_id and p.user_id = new.user_id;
  if not found then
    raise exception 'Plant not found';
  end if;
  return new;
end;
$$;

create trigger snapshot_watering_schedule
before insert on public.watering_events
for each row execute function public.snapshot_watering_schedule();

create function public.snapshot_fertilizer_schedule()
returns trigger
language plpgsql
as $$
begin
  select c.fertilizer_every_days
    into new.recommended_fertilizer_every_days
  from public.plants p
  left join public.care_profiles c on c.plant_id = p.id and c.user_id = p.user_id
  where p.id = new.plant_id and p.user_id = new.user_id;
  if not found then
    raise exception 'Plant not found';
  end if;
  return new;
end;
$$;

create trigger snapshot_fertilizer_schedule
before insert on public.fertilizer_events
for each row execute function public.snapshot_fertilizer_schedule();
