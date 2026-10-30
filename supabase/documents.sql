-- Documents of the association (statuts, comptes rendus, formulaires…), shared with the members.
--
--   * The bureau and the admins add and remove documents; every member of the association reads them.
--   * Files live in a PRIVATE bucket, under a folder named after the association: nobody can read
--     another association's files, and the app opens a document through a short-lived signed link.
--   * The module can be turned off per association (module_documents = 'off', like the others).

-- ── Table ───────────────────────────────────────────────────────────────────
create table if not exists public.documents (
  id          bigint generated always as identity primary key,
  tenant_id   uuid not null default public.current_tenant_id() references public.tenants(id) on delete cascade,
  titre       text not null check (char_length(btrim(titre)) between 2 and 120),
  categorie   text check (categorie is null or char_length(btrim(categorie)) between 1 and 60),
  path        text not null,
  nom_fichier text not null,
  mime        text,
  taille      bigint check (taille is null or taille >= 0),
  created_by  uuid default auth.uid() references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists documents_tenant_idx on public.documents (tenant_id, created_at desc);

alter table public.documents enable row level security;

drop policy if exists "Members read tenant documents" on public.documents;
create policy "Members read tenant documents"
  on public.documents for select to authenticated
  using (tenant_id = public.current_tenant_id());

drop policy if exists "Bureau adds tenant documents" on public.documents;
create policy "Bureau adds tenant documents"
  on public.documents for insert to authenticated
  with check (tenant_id = public.current_tenant_id() and public.is_bureau_or_admin()
              and path like tenant_id::text || '/%');

drop policy if exists "Bureau edits tenant documents" on public.documents;
create policy "Bureau edits tenant documents"
  on public.documents for update to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_bureau_or_admin())
  with check (tenant_id = public.current_tenant_id() and public.is_bureau_or_admin());

drop policy if exists "Bureau removes tenant documents" on public.documents;
create policy "Bureau removes tenant documents"
  on public.documents for delete to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_bureau_or_admin());

-- ── Private bucket ──────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 20971520, array[
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'text/csv'
])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- The first folder of a file is the association's id.
drop policy if exists "Members read tenant document files" on storage.objects;
create policy "Members read tenant document files"
  on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = public.current_tenant_id()::text);

drop policy if exists "Bureau uploads tenant document files" on storage.objects;
create policy "Bureau uploads tenant document files"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and public.is_bureau_or_admin()
              and (storage.foldername(name))[1] = public.current_tenant_id()::text);

drop policy if exists "Bureau removes tenant document files" on storage.objects;
create policy "Bureau removes tenant document files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and public.is_bureau_or_admin()
         and (storage.foldername(name))[1] = public.current_tenant_id()::text);

-- ── The module switch travels with the branding ─────────────────────────────
-- Same function as in cotisations.sql, with module_documents added.
create or replace function public.branding_for_tenant(p_tenant uuid)
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select jsonb_build_object('slug', t.slug, 'name', t.name)
         || coalesce((
              select jsonb_object_agg(s.key, s.value)
              from public.app_settings s
              where s.tenant_id = t.id
                and s.key in ('tenant_name', 'tenant_tagline', 'tenant_primary_color',
                              'tenant_secondary_color', 'tenant_logo_url', 'tenant_login_bg_url',
                              'module_annuaire', 'module_offres', 'module_agenda',
                              'module_idees', 'module_liens', 'module_documents',
                              'label_annuaire', 'label_offres', 'label_nom',
                              'annuaire_categories', 'offres_categories',
                              'module_cotisations', 'cotisation_url', 'cotisation_montant',
                              'cotisation_libelle', 'cotisation_ouverture', 'cotisation_fin')
            ), '{}'::jsonb)
  from public.tenants t
  where t.id = p_tenant;
$$;
revoke all on function public.branding_for_tenant(uuid) from public, anon, authenticated;
