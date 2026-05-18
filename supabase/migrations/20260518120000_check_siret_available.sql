create or replace function public.check_siret_available(p_siret text)
returns boolean
language sql
security definer
stable
as $$
  select not exists (
    select 1 from profiles where siret = p_siret
  );
$$;
