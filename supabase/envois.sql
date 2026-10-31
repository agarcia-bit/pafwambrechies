-- E-mails sent by the bureau from the web dashboard (bureau/), with their history.
--
--   * public.envois: one row per message (subject, body, who sent it, when);
--   * public.envoi_destinataires: one row per recipient, so the dashboard can show
--     "dernière relance le ..." next to each member.
--
-- Nobody writes these tables from the client: the send-mail edge function sends the
-- e-mails (Resend) with the service_role key and records them here. The bureau and the
-- admins of the association read them. Safe to run again.

create table if not exists public.envois (
  id          bigint generated always as identity primary key,
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  envoye_par  uuid references auth.users(id) on delete set null,
  sujet       text not null,
  corps       text not null,
  nb          integer not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.envoi_destinataires (
  envoi_id    bigint not null references public.envois(id) on delete cascade,
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  email       text not null,
  user_id     uuid references auth.users(id) on delete set null,
  statut      text not null default 'envoye', -- 'envoye' | 'echec'
  primary key (envoi_id, email)
);
create index if not exists envoi_destinataires_tenant_email on public.envoi_destinataires (tenant_id, email);

alter table public.envois enable row level security;
alter table public.envoi_destinataires enable row level security;

drop policy if exists "Bureau reads envois" on public.envois;
create policy "Bureau reads envois"
  on public.envois for select to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_bureau_or_admin());

drop policy if exists "Bureau reads envoi_destinataires" on public.envoi_destinataires;
create policy "Bureau reads envoi_destinataires"
  on public.envoi_destinataires for select to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_bureau_or_admin());
-- No insert/update/delete policy on purpose: only the edge function (service_role) writes.
