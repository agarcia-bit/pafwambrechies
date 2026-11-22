-- Retours sur l'application : un bug ou une idée d'amélioration, envoyé par n'importe quel membre
-- (app ou espace bureau) au propriétaire de la plateforme, pas au bureau de l'association : ils
-- concernent l'outil, commun à toutes les associations.
--
--   * retours : le message, son type, une capture facultative et l'appareil d'où il vient ;
--     l'auteur voit les siens, seul le propriétaire de la plateforme voit tout et change le statut ;
--   * retours-captures : espace de rangement PRIVÉ (une capture peut montrer des données de
--     l'association) ; chacun dépose dans son dossier, seul le propriétaire de la plateforme lit ;
--   * à chaque nouveau retour, la fonction notify-retour envoie l'e-mail (clé de service lue
--     dans le coffre, comme supabase/taches_notifications.sql).
-- Script rejouable sans risque.

create table if not exists public.retours (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  auteur      uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  tenant_id   uuid not null default public.current_tenant_id() references public.tenants(id) on delete cascade,
  type        text not null check (type in ('bug', 'idee')),
  texte       text not null check (length(trim(texte)) between 3 and 4000),
  capture     text,            -- chemin dans retours-captures
  appareil    jsonb not null default '{}'::jsonb, -- version, système, écran
  statut      text not null default 'nouveau' check (statut in ('nouveau', 'en_cours', 'fait'))
);
create index if not exists retours_date_idx on public.retours (created_at desc);
alter table public.retours enable row level security;

drop policy if exists "Retours : chacun envoie les siens" on public.retours;
create policy "Retours : chacun envoie les siens" on public.retours for insert to authenticated
  with check (auteur = auth.uid() and statut = 'nouveau');
drop policy if exists "Retours : l'auteur et la plateforme lisent" on public.retours;
create policy "Retours : l'auteur et la plateforme lisent" on public.retours for select to authenticated
  using (auteur = auth.uid() or public.is_platform_admin());
drop policy if exists "Retours : la plateforme suit le statut" on public.retours;
create policy "Retours : la plateforme suit le statut" on public.retours for update to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- Les captures : privées, chacun dans le dossier à son identifiant.
insert into storage.buckets (id, name, public) values ('retours-captures', 'retours-captures', false)
  on conflict (id) do update set public = false;
drop policy if exists "Retours : chacun dépose ses captures" on storage.objects;
create policy "Retours : chacun dépose ses captures" on storage.objects for insert to authenticated
  with check (bucket_id = 'retours-captures' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Retours : la plateforme lit les captures" on storage.objects;
create policy "Retours : la plateforme lit les captures" on storage.objects for select to authenticated
  using (bucket_id = 'retours-captures' and public.is_platform_admin());

-- L'e-mail au propriétaire de la plateforme, dès l'envoi.
create or replace function public.retours_prevenir() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url := 'https://ancwbfyjzaebxahtlqkm.supabase.co/functions/v1/notify-retour',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' ||
      (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')),
    body := jsonb_build_object('id', new.id));
  return new;
end $$;
revoke all on function public.retours_prevenir() from public, anon, authenticated;
drop trigger if exists retours_prevenir on public.retours;
create trigger retours_prevenir after insert on public.retours
  for each row execute function public.retours_prevenir();

-- La page « Retours » de l'espace bureau : tous les retours, toutes associations, avec le nom de
-- l'auteur et de son association (que le propriétaire ne lirait pas autrement, chaque association
-- étant cloisonnée). Vide pour tout autre compte.
create or replace function public.retours_de_la_plateforme()
returns table (
  id bigint, created_at timestamptz, type text, texte text, capture text, appareil jsonb, statut text,
  auteur text, email text, association text
)
language sql security definer stable set search_path = public as $$
  select r.id, r.created_at, r.type, r.texte, r.capture, r.appareil, r.statut,
         nullif(trim(concat_ws(' ', p.prenom, p.nom)), ''), p.email,
         coalesce(nullif(trim(s.value), ''), t.name)
    from public.retours r
    left join public.profiles p on p.id = r.auteur
    left join public.tenants t on t.id = r.tenant_id
    left join public.app_settings s on s.tenant_id = r.tenant_id and s.key = 'tenant_name'
   where public.is_platform_admin()
   order by r.created_at desc
   limit 500;
$$;
revoke all on function public.retours_de_la_plateforme() from public, anon;
grant execute on function public.retours_de_la_plateforme() to authenticated;
