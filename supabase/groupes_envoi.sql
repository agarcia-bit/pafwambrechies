-- ── Groupes de destinataires des messages ────────────────────────────────────
-- Le bureau enregistre des listes nommées d'adhérents (« Commerçants du centre », « Bénévoles »…)
-- pour les réutiliser dans « Envoyer un message ». Les groupes par catégorie de l'annuaire, eux,
-- sont calculés à la volée par l'espace bureau et ne sont pas stockés ici.
--
--   * un groupe garde les adresses e-mail : elles désignent aussi bien un adhérent inscrit
--     qu'un adhérent importé qui n'a pas encore de compte ;
--   * seuls le bureau et les admins de l'association voient et modifient ses groupes.
-- Peut être relancé sans risque.

create table if not exists public.groupes_envoi (
  id         bigint generated always as identity primary key,
  tenant_id  uuid not null default public.current_tenant_id() references public.tenants(id) on delete cascade,
  nom        text not null check (char_length(btrim(nom)) between 1 and 60),
  emails     text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists groupes_envoi_tenant_idx on public.groupes_envoi (tenant_id);

alter table public.groupes_envoi enable row level security;

drop policy if exists "Bureau manages tenant groupes_envoi" on public.groupes_envoi;
create policy "Bureau manages tenant groupes_envoi"
  on public.groupes_envoi for all to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_bureau_or_admin())
  with check (tenant_id = public.current_tenant_id() and public.is_bureau_or_admin());
