-- A new report notifies the bureau and the admins of the association by push notification.
-- Same webhook as on_new_actu (copied from it, so the service key never appears in this file),
-- pointed at the notify-new-report edge function (deploy it first).
do $$
declare
  v_def text;
begin
  select pg_get_triggerdef(t.oid) into v_def
    from pg_trigger t
    where t.tgname = 'on_new_actu' and t.tgrelid = 'public.actus'::regclass;
  if v_def is null then
    raise exception 'on_new_actu not found: create the webhook for public.signalements by hand';
  end if;
  drop trigger if exists on_new_signalement on public.signalements;
  execute replace(replace(replace(v_def, 'on_new_actu', 'on_new_signalement'), 'ON public.actus', 'ON public.signalements'), 'notify-new-actu', 'notify-new-report');
end;
$$;
