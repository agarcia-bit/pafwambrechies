-- ── Notification « Nouvel événement » ────────────────────────────────────────
-- Quand le bureau ajoute un événement à l'agenda, tous les adhérents reçoivent une notification
-- (« Nouvel événement : titre · date », plus « Venez-vous ? » si l'événement demande une réponse).
-- Même webhook que les actus (on_new_actu, copié : la clé de service n'apparaît pas ici), même
-- fonction notify-new-actu, qui reconnaît la table « evenements ». Les rappels 7 et 2 jours avant
-- (notify-evenements) ne changent pas. Peut être relancé sans risque.

do $$
declare
  v_def text;
begin
  select pg_get_triggerdef(t.oid) into v_def
    from pg_trigger t
    where t.tgname = 'on_new_actu' and t.tgrelid = 'public.actus'::regclass;
  if v_def is null then
    raise exception 'on_new_actu introuvable : créer le webhook on_new_evenement à la main';
  end if;
  v_def := replace(v_def, 'TRIGGER on_new_actu AFTER INSERT ON public.actus', 'TRIGGER on_new_evenement AFTER INSERT ON public.evenements');
  if v_def not like '%on_new_evenement AFTER INSERT ON public.evenements%notify-new-actu%' then
    raise exception 'Définition inattendue de on_new_actu : %', v_def;
  end if;
  drop trigger if exists on_new_evenement on public.evenements;
  execute v_def;
end $$;
