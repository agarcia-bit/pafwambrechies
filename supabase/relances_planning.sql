-- ── Relances d'un planning de présences ─────────────────────────────────────────────────────────
-- Quand il manque du monde, le bureau prévient les adhérents qui ne sont pas encore inscrits
-- (bouton « Prévenir les membres » de la page Planning). La fonction relancer-planning envoie la
-- notification ou l'e-mail, puis note la relance ici : la page affiche « Dernière relance : hier à
-- 18 h, 12 personnes prévenues » et demande confirmation si la précédente a moins de 24 h.
--
-- Seul le bureau lit cet historique. Personne n'y écrit depuis l'app ou l'espace bureau : c'est la
-- fonction relancer-planning (clé de service) qui l'ajoute, après avoir vérifié qui la demande.
-- Script rejouable sans risque.

create table if not exists public.relances_planning (
  id              bigint generated always as identity primary key,
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  action_id       bigint not null references public.actions(id) on delete cascade,
  envoye_par      uuid references public.profiles(id) on delete set null,
  message         text not null check (length(trim(message)) between 1 and 1000),
  nb_notifications integer not null default 0 check (nb_notifications >= 0),
  nb_emails       integer not null default 0 check (nb_emails >= 0),
  created_at      timestamptz not null default now()
);
create index if not exists relances_planning_action_idx on public.relances_planning (action_id, created_at desc);
alter table public.relances_planning enable row level security;

drop policy if exists "Relances : le bureau lit" on public.relances_planning;
create policy "Relances : le bureau lit" on public.relances_planning for select to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_bureau_or_admin());
