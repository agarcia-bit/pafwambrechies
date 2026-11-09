-- ── Engagement des adhérents ─────────────────────────────────────────────────
-- Le bureau voit, adhérent par adhérent, s'il ouvre l'app, lit les actus, réagit, répond et
-- propose, pour savoir avec qui reprendre contact. Les adhérents en sont prévenus par la
-- politique de confidentialité.
--
--   * visites : un jour par adhérent (pas chaque ouverture) : assez pour la fréquence, plus discret ;
--   * actus_lectures : les actus ouvertes, jusqu'ici gardées seulement sur le téléphone ;
--   * aucun adhérent ne peut lire ces tables : il ajoute ses propres lignes par noter_visite et
--     noter_lecture, et seul le bureau obtient les chiffres, par engagement_bureau ;
--   * notifications : un téléphone enregistré (device_tokens), que l'app retire à la première
--     ouverture après que l'adhérent les a coupées dans les réglages du téléphone ;
--   * effacement automatique au-delà de 13 mois.
-- Peut être relancé sans risque.

create table if not exists public.visites (
  user_id   uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  jour      date not null,
  primary key (user_id, jour)
);
create index if not exists visites_tenant_jour on public.visites (tenant_id, jour);

create table if not exists public.actus_lectures (
  user_id   uuid not null references auth.users(id) on delete cascade,
  actu_id   bigint not null references public.actus(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  lu_le     timestamptz not null default now(),
  primary key (user_id, actu_id)
);
create index if not exists actus_lectures_tenant on public.actus_lectures (tenant_id, lu_le);

-- Pas de politique : personne ne lit ni n'écrit directement, tout passe par les fonctions.
alter table public.visites enable row level security;
alter table public.actus_lectures enable row level security;

-- Le jour compte à l'heure de Paris : une ouverture à 0 h 30 compte pour le nouveau jour.
create or replace function public.noter_visite()
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.visites (user_id, tenant_id, jour)
  select p.id, p.tenant_id, (now() at time zone 'Europe/Paris')::date
    from public.profiles p
   where p.id = auth.uid()
  on conflict do nothing;
$$;

create or replace function public.noter_lecture(p_actu bigint)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.actus_lectures (user_id, actu_id, tenant_id)
  select p.id, a.id, p.tenant_id
    from public.profiles p
    join public.actus a on a.id = p_actu and a.tenant_id = p.tenant_id
   where p.id = auth.uid()
  on conflict do nothing;
$$;

revoke all on function public.noter_visite() from public, anon;
revoke all on function public.noter_lecture(bigint) from public, anon;
grant execute on function public.noter_visite() to authenticated;
grant execute on function public.noter_lecture(bigint) to authenticated;

-- Les chiffres du bureau, en un appel : le début du suivi, les actifs semaine par semaine et,
-- pour chaque adhérent, son activité sur les p_jours derniers jours.
create or replace function public.engagement_bureau(p_jours int default 30, p_semaines int default 12)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.current_tenant_id();
  v_depuis timestamptz := now() - make_interval(days => p_jours);
  v_jour_depuis date := (now() at time zone 'Europe/Paris')::date - p_jours;
begin
  if not public.is_bureau_or_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'debut', (select min(jour) from public.visites where tenant_id = v_tenant),
    'actus_publiees', (select count(*) from public.actus where tenant_id = v_tenant and created_at >= v_depuis),
    'semaines', coalesce((
      select jsonb_agg(jsonb_build_object('semaine', s.semaine, 'actifs', s.actifs) order by s.semaine)
        from (
          select date_trunc('week', jour)::date as semaine, count(distinct user_id) as actifs
            from public.visites
           where tenant_id = v_tenant and jour >= date_trunc('week', now() - make_interval(weeks => p_semaines - 1))::date
           group by 1
        ) s), '[]'::jsonb),
    'membres', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'prenom', p.prenom, 'nom', p.nom, 'role', p.role, 'inscrit_le', p.created_at,
        'jours_visite', (select count(*) from public.visites v where v.user_id = p.id and v.tenant_id = v_tenant and v.jour >= v_jour_depuis),
        'derniere_visite', (select max(jour) from public.visites v where v.user_id = p.id and v.tenant_id = v_tenant),
        -- Parmi les actus publiées sur la période, pour comparer à actus_publiees.
        'actus_lues', (select count(*) from public.actus_lectures l join public.actus a on a.id = l.actu_id
                        where l.user_id = p.id and l.tenant_id = v_tenant and a.created_at >= v_depuis),
        'likes', (select count(*) from public.actus_likes x where x.user_id = p.id and x.tenant_id = v_tenant and x.created_at >= v_depuis),
        'commentaires', (select count(*) from public.actus_commentaires x where x.user_id = p.id and x.tenant_id = v_tenant and x.created_at >= v_depuis),
        'sondages', (select count(distinct x.sondage_id) from public.sondage_reponses x where x.user_id = p.id and x.tenant_id = v_tenant and x.created_at >= v_depuis),
        'evenements', (select count(*) from public.evenement_reponses x where x.user_id = p.id and x.tenant_id = v_tenant and x.updated_at >= v_depuis),
        'idees', (select count(*) from public.idees x where x.user_id = p.id and x.tenant_id = v_tenant and x.created_at >= v_depuis),
        'offres', (select count(*) from public.offres x where x.user_id = p.id and x.tenant_id = v_tenant and x.created_at >= v_depuis),
        'fiche_annuaire', exists (select 1 from public.annuaire x where x.user_id = p.id and x.tenant_id = v_tenant),
        -- Un téléphone enregistré : l'app le retire quand l'adhérent coupe les notifications.
        'notifications', exists (select 1 from public.device_tokens x where x.user_id = p.id and x.tenant_id = v_tenant)
      ))
        from public.profiles p
       where p.tenant_id = v_tenant), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.engagement_bureau(int, int) from public, anon;
grant execute on function public.engagement_bureau(int, int) to authenticated;

-- Effacement au-delà de 13 mois, comme l'annonce la politique de confidentialité.
select cron.unschedule('engagement-retention') where exists (select 1 from cron.job where jobname = 'engagement-retention');
select cron.schedule(
  'engagement-retention',
  '45 3 * * *',
  $$ delete from public.visites where jour < current_date - interval '13 months';
     delete from public.actus_lectures where lu_le < now() - interval '13 months' $$
);
