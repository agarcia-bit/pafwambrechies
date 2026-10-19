-- Optional photo on an actu (the Allianceo feed shows it as the post's picture).
-- The PAF web app selects "*" and simply ignores the new column.

alter table public.actus add column if not exists image_url text;

-- Public bucket: photos are served by their URL, like the directory photos.
-- No SELECT policy on purpose (it would let anyone list the file names), and
-- only admins can upload. The photo is resized by the app before sending; the
-- limits below are a backstop.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('actus-photos', 'actus-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admins upload actus photos" on storage.objects;
create policy "Admins upload actus photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'actus-photos' and public.is_admin());
