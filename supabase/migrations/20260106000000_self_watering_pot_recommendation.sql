alter table public.care_profiles
  add column self_watering_pot_recommendation text not null default 'depends'
    check (self_watering_pot_recommendation in ('recommended', 'not_recommended', 'depends')),
  add column self_watering_pot_notes text not null default '';
