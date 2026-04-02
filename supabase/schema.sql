-- ============================================================
-- PAF Wambrechies – Supabase Schema
-- Run this in the Supabase SQL editor
-- ============================================================

-- ── profiles ──────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  prenom     text,
  nom        text,
  role       text not null default 'adherent',
  created_at timestamptz not null default now()
);

-- ── actus ─────────────────────────────────────────────────────────────────
create table if not exists public.actus (
  id         bigint generated always as identity primary key,
  titre      text not null,
  date       date not null,
  categorie  text not null,
  excerpt    text,
  contenu    text,
  created_at timestamptz not null default now()
);

-- ── annuaire ──────────────────────────────────────────────────────────────
create table if not exists public.annuaire (
  id          bigint generated always as identity primary key,
  nom         text not null,
  categorie   text not null,
  adresse     text,
  telephone   text,
  description text,
  created_at  timestamptz not null default now()
);

-- ── offres ────────────────────────────────────────────────────────────────
create table if not exists public.offres (
  id          bigint generated always as identity primary key,
  commercant  text not null,
  titre       text not null,
  description text,
  expiration  date,
  tag         text,
  created_at  timestamptz not null default now()
);

-- ── evenements ────────────────────────────────────────────────────────────
create table if not exists public.evenements (
  id          bigint generated always as identity primary key,
  titre       text not null,
  date        date not null,
  heure       text,
  lieu        text,
  description text,
  created_at  timestamptz not null default now()
);

-- ── idees ─────────────────────────────────────────────────────────────────
create table if not exists public.idees (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  prenom     text,
  categorie  text not null,
  texte      text not null,
  visible    boolean not null default true,
  created_at timestamptz not null default now()
);

-- ── idees_likes ───────────────────────────────────────────────────────────
create table if not exists public.idees_likes (
  id         bigint generated always as identity primary key,
  idee_id    bigint not null references public.idees(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (idee_id, user_id)
);

-- ── idees_commentaires ────────────────────────────────────────────────────
create table if not exists public.idees_commentaires (
  id         bigint generated always as identity primary key,
  idee_id    bigint not null references public.idees(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  prenom     text,
  texte      text not null,
  created_at timestamptz not null default now()
);

-- ── push_subscriptions ────────────────────────────────────────────────────
create table if not exists public.push_subscriptions (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  endpoint   text not null,
  p256dh     text,
  auth       text,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.profiles           enable row level security;
alter table public.actus              enable row level security;
alter table public.annuaire           enable row level security;
alter table public.offres             enable row level security;
alter table public.evenements         enable row level security;
alter table public.idees              enable row level security;
alter table public.idees_likes        enable row level security;
alter table public.idees_commentaires enable row level security;
alter table public.push_subscriptions enable row level security;

-- profiles
create policy "Users can read own profile"
  on public.profiles for select to authenticated using (auth.uid() = id);
create policy "Admins can read all profiles"
  on public.profiles for select to authenticated using (public.is_admin());

create policy "Users can update own profile"
  on public.profiles for update to authenticated using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert to authenticated with check (auth.uid() = id);

-- actus
create policy "Authenticated users can read actus"
  on public.actus for select to authenticated using (true);

-- annuaire
create policy "Authenticated users can read annuaire"
  on public.annuaire for select to authenticated using (true);

-- offres
create policy "Authenticated users can read offres"
  on public.offres for select to authenticated using (true);

-- evenements
create policy "Authenticated users can read evenements"
  on public.evenements for select to authenticated using (true);

-- idees
create policy "Authenticated users can read visible idees"
  on public.idees for select to authenticated using (visible = true);

create policy "Users can insert own idees"
  on public.idees for insert to authenticated with check (auth.uid() = user_id);

create policy "Users can update own idees"
  on public.idees for update to authenticated using (auth.uid() = user_id);

-- idees_likes
create policy "Authenticated users can read likes"
  on public.idees_likes for select to authenticated using (true);

create policy "Users can insert own likes"
  on public.idees_likes for insert to authenticated with check (auth.uid() = user_id);

create policy "Users can delete own likes"
  on public.idees_likes for delete to authenticated using (auth.uid() = user_id);

-- idees_commentaires
create policy "Authenticated users can read comments"
  on public.idees_commentaires for select to authenticated using (true);

create policy "Users can insert own comments"
  on public.idees_commentaires for insert to authenticated with check (auth.uid() = user_id);

create policy "Users can delete own comments"
  on public.idees_commentaires for delete to authenticated using (auth.uid() = user_id);

-- push_subscriptions
create policy "Users can manage own push subscriptions"
  on public.push_subscriptions for all to authenticated using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- Realtime
-- ============================================================
alter publication supabase_realtime add table public.idees;
alter publication supabase_realtime add table public.idees_likes;
alter publication supabase_realtime add table public.idees_commentaires;
