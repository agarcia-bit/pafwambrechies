-- ── Actus proposées par les adhérents ────────────────────────────────────────
-- Un adhérent peut proposer une actu depuis l'application ; elle n'est visible de tous qu'une fois
-- publiée par le bureau ou un admin (comme les offres, voir offres_membres.sql).
--
--   * actus.statut : 'publiee' (toutes les actus existantes) ou 'en_attente' ;
--   * l'actu d'un adhérent est toujours 'en_attente', même après une modification de sa part ;
--     il peut la modifier ou la retirer tant qu'elle n'est pas publiée ;
--   * l'auteur est actus.auteur_id, déjà rempli par actus_set_auteur ;
--   * à la publication, la date devient celle du jour, pour qu'elle arrive en tête du fil ;
--   * notifications : une proposition prévient le bureau, pas les adhérents ; ils sont prévenus
--     à la publication (déclencheur on_actu_publiee, même fonction notify-new-actu).
-- Peut être relancé sans risque.

alter table public.actus add column if not exists statut text not null default 'publiee';
alter table public.actus drop constraint if exists actus_statut_check;
alter table public.actus add constraint actus_statut_check check (statut in ('publiee', 'en_attente'));

-- Un adhérent ne publie jamais lui-même, ne change ni l'auteur ni l'association.
create or replace function public.actus_garde_adherent()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_bureau_or_admin() then
    if tg_op = 'UPDATE' then
      new.auteur_id := old.auteur_id;
      new.tenant_id := old.tenant_id;
    end if;
    new.statut := 'en_attente';
  elsif tg_op = 'UPDATE' and old.statut = 'en_attente' and new.statut = 'publiee' then
    new.date := (now() at time zone 'Europe/Paris')::date;
  end if;
  return new;
end;
$$;

drop trigger if exists actus_garde_adherent on public.actus;
create trigger actus_garde_adherent
  before insert or update on public.actus
  for each row execute function public.actus_garde_adherent();

-- ── Règles d'accès ───────────────────────────────────────────────────────────
drop policy if exists "Users read tenant actus" on public.actus;
create policy "Users read tenant actus"
  on public.actus for select to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and (statut = 'publiee' or auteur_id = auth.uid() or public.is_bureau_or_admin())
  );

drop policy if exists "Members propose actus" on public.actus;
create policy "Members propose actus"
  on public.actus for insert to authenticated
  with check (tenant_id = public.current_tenant_id() and auteur_id = auth.uid() and statut = 'en_attente');

drop policy if exists "Members update own pending actus" on public.actus;
create policy "Members update own pending actus"
  on public.actus for update to authenticated
  using (tenant_id = public.current_tenant_id() and auteur_id = auth.uid() and statut = 'en_attente')
  with check (tenant_id = public.current_tenant_id() and auteur_id = auth.uid());

drop policy if exists "Members delete own pending actus" on public.actus;
create policy "Members delete own pending actus"
  on public.actus for delete to authenticated
  using (tenant_id = public.current_tenant_id() and auteur_id = auth.uid() and statut = 'en_attente');

-- Les photos d'un adhérent vont dans son propre dossier.
drop policy if exists "Members upload own actus photos" on storage.objects;
create policy "Members upload own actus photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'actus-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ── Notification à la publication ────────────────────────────────────────────
-- Même webhook que on_new_actu (copié, la clé de service n'apparaît pas ici), déclenché quand le
-- bureau publie une proposition.
do $$
declare
  v_def text;
begin
  select pg_get_triggerdef(t.oid) into v_def
    from pg_trigger t
    where t.tgname = 'on_new_actu' and t.tgrelid = 'public.actus'::regclass;
  if v_def is null then
    raise exception 'on_new_actu introuvable : créer le webhook on_actu_publiee à la main';
  end if;
  v_def := replace(v_def, 'TRIGGER on_new_actu AFTER INSERT', 'TRIGGER on_actu_publiee AFTER UPDATE');
  v_def := replace(v_def, 'FOR EACH ROW EXECUTE', 'FOR EACH ROW WHEN (old.statut = ''en_attente'' and new.statut = ''publiee'') EXECUTE');
  if v_def not like '%on_actu_publiee AFTER UPDATE%WHEN%' then
    raise exception 'Définition inattendue de on_new_actu : %', v_def;
  end if;
  drop trigger if exists on_actu_publiee on public.actus;
  execute v_def;
end $$;
