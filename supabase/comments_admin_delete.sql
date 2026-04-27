-- ── Admins can delete any comment (actus + idees) ──────────────────────────
-- Members already have a "delete own" policy on each comments table.
-- These policies extend that so anyone with role='admin' in public.profiles
-- can also delete other users' comments (moderation).

create policy "Admins can delete actus comments"
  on public.actus_commentaires for delete to authenticated
  using (public.is_admin());

create policy "Admins can delete idees comments"
  on public.idees_commentaires for delete to authenticated
  using (public.is_admin());
