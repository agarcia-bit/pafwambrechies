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
