-- Isolation test between associations (tenants). Run it in the Supabase SQL Editor.
--
-- It impersonates (1) the admin of the "demo" association, (2) a simple member of the PAF and
-- (3) a visitor who is not signed in, and tries to read, change, delete and insert data of
-- the PAF, and to promote itself. Every attempt goes through the row-level security rules,
-- exactly like a request from the app.
--
-- NOTHING IS KEPT: the script ends with an error on purpose, which cancels everything it did.
-- The report is the text of that error ("RESULTAT ..."). Expected: "TOTAL FUITES: 0".
-- Run it again after every change of access rules, and before adding an association.
do $$
declare
  out text[] := '{}';
  paf uuid; demo uuid;
  demo_admin uuid; paf_member uuid; paf_admin uuid;
  t text; n bigint; has_col boolean;
  tables text[] := array['actus','actus_commentaires','actus_likes','annuaire','offres','evenements','liens','idees','idees_commentaires','idees_likes','sondages','sondage_options','sondage_reponses','app_settings','profiles','device_tokens','push_subscriptions','actions','taches'];
  leaks int := 0;
begin
  select id into paf from public.tenants where slug = 'paf-wambrechies';
  select id into demo from public.tenants where slug = 'demo';
  select id into demo_admin from public.profiles where tenant_id = demo and role = 'admin' limit 1;
  select id into paf_member from public.profiles where tenant_id = paf and role = 'adherent' limit 1;
  select id into paf_admin from public.profiles where tenant_id = paf and role = 'admin' limit 1;
  if paf is null or demo is null or demo_admin is null or paf_member is null then
    raise exception 'Test impossible: il faut les associations paf-wambrechies et demo, un admin demo et un adherent PAF';
  end if;

  -- A. admin of the DEMO association against the PAF -----------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', demo_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', demo_admin::text, true);
  set local role authenticated;
  out := out || '--- A. admin DEMO -> donnees PAF ---';
  foreach t in array tables loop
    select exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = t and column_name = 'tenant_id') into has_col;
    if not has_col then out := out || format('%s: pas de tenant_id, ignoré', t); continue; end if;
    begin
      execute format('select count(*) from public.%I where tenant_id = $1', t) into n using paf;
      if n > 0 then leaks := leaks + 1; end if;
      out := out || format('LECTURE %s: %s lignes PAF visibles%s', t, n, case when n > 0 then '  <<< FUITE' else '' end);
    exception when others then out := out || format('LECTURE %s: erreur %s', t, sqlerrm); end;
    begin
      execute format('update public.%I set tenant_id = tenant_id where tenant_id = $1', t) using paf;
      get diagnostics n = row_count;
      if n > 0 then leaks := leaks + 1; end if;
      out := out || format('MODIF %s: %s lignes PAF modifiables%s', t, n, case when n > 0 then '  <<< FUITE' else '' end);
    exception when others then out := out || format('MODIF %s: refusé (%s)', t, left(sqlerrm, 50)); end;
    begin
      execute format('delete from public.%I where tenant_id = $1', t) using paf;
      get diagnostics n = row_count;
      if n > 0 then leaks := leaks + 1; end if;
      out := out || format('SUPPR %s: %s lignes PAF supprimables%s', t, n, case when n > 0 then '  <<< FUITE' else '' end);
    exception when others then out := out || format('SUPPR %s: refusé (%s)', t, left(sqlerrm, 50)); end;
  end loop;
  begin
    insert into public.actus (tenant_id, titre, categorie, date) values (paf, 'intrusion', 'Actu Asso', current_date);
    leaks := leaks + 1; out := out || 'INSERT actus dans PAF: ACCEPTE <<< FUITE';
  exception when others then out := out || format('INSERT actus dans PAF: refusé (%s)', left(sqlerrm, 60)); end;
  begin
    insert into public.offres (tenant_id, commercant, titre, categorie) values (paf, 'x', 'intrusion', 'Particulier');
    leaks := leaks + 1; out := out || 'INSERT offres dans PAF: ACCEPTE <<< FUITE';
  exception when others then out := out || format('INSERT offres dans PAF: refusé (%s)', left(sqlerrm, 60)); end;
  begin
    insert into public.annuaire (tenant_id, nom_entreprise, categorie, user_id) values (paf, 'intrusion', 'Services', demo_admin);
    leaks := leaks + 1; out := out || 'INSERT annuaire dans PAF: ACCEPTE <<< FUITE';
  exception when others then out := out || format('INSERT annuaire dans PAF: refusé (%s)', left(sqlerrm, 60)); end;
  begin
    perform public.set_member_role(paf_member, 'admin');
    leaks := leaks + 1; out := out || 'set_member_role sur un membre PAF: ACCEPTE <<< FUITE';
  exception when others then out := out || format('set_member_role sur un membre PAF: refusé (%s)', left(sqlerrm, 60)); end;
  select count(*) into n from public.member_names();
  out := out || format('member_names() depuis DEMO: %s (attendu 1)', n);
  if n > 1 then leaks := leaks + 1; end if;
  select count(*) into n from public.bureau_members();
  out := out || format('bureau_members() depuis DEMO: %s (attendu au plus 1)', n);
  if n > 1 then leaks := leaks + 1; end if;
  select count(*) into n from public.actus_auteurs();
  out := out || format('actus_auteurs() depuis DEMO: %s (attendu 0)', n);
  if n > 0 then leaks := leaks + 1; end if;
  select count(*) into n from public.profiles;
  out := out || format('profiles lisibles par l''admin DEMO: %s (attendu 1)', n);
  if n > 1 then leaks := leaks + 1; end if;
  update public.profiles set role = 'adherent' where id = paf_admin;
  get diagnostics n = row_count;
  out := out || format('retrograder un admin PAF depuis DEMO: %s ligne(s) (attendu 0)', n);
  if n > 0 then leaks := leaks + 1; end if;
  reset role;

  -- B. simple member of the PAF ---------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', paf_member, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', paf_member::text, true);
  set local role authenticated;
  out := out || '--- B. membre PAF simple ---';
  select count(*) into n from public.profiles;
  out := out || format('profiles lisibles par un membre: %s (attendu 1)', n);
  if n > 1 then leaks := leaks + 1; end if;
  begin
    update public.profiles set role = 'admin' where id = paf_member;
    leaks := leaks + 1; out := out || 'se passer admin: ACCEPTE <<< FUITE';
  exception when others then out := out || format('se passer admin: refusé (%s)', left(sqlerrm, 60)); end;
  begin
    insert into public.actus (tenant_id, titre, categorie, date) values (paf, 'faux', 'Actu Asso', current_date);
    leaks := leaks + 1; out := out || 'publier une actu: ACCEPTE <<< FUITE';
  exception when others then out := out || format('publier une actu: refusé (%s)', left(sqlerrm, 50)); end;
  select count(*) into n from public.app_settings;
  out := out || format('réglages lisibles par un membre: %s (attendu 0)', n);
  if n > 0 then leaks := leaks + 1; end if;
  update public.annuaire set nom_entreprise = 'pirate' where user_id is distinct from paf_member and tenant_id = paf;
  get diagnostics n = row_count;
  out := out || format('modifier la fiche d''un autre: %s ligne(s) (attendu 0)', n);
  if n > 0 then leaks := leaks + 1; end if;
  update public.offres set titre = 'pirate' where user_id is distinct from paf_member and tenant_id = paf;
  get diagnostics n = row_count;
  out := out || format('modifier l''offre d''un autre: %s ligne(s) (attendu 0)', n);
  if n > 0 then leaks := leaks + 1; end if;
  begin
    insert into public.offres (tenant_id, commercant, titre, categorie) values (paf, 'moi', 'test proposition', 'Particulier') returning statut into t;
    out := out || format('proposer une offre: acceptée, statut forcé à "%s" (attendu en_attente)', t);
    if t <> 'en_attente' then leaks := leaks + 1; end if;
  exception when others then out := out || format('proposer une offre: erreur (%s)', left(sqlerrm, 60)); end;
  begin
    perform public.set_member_role(paf_member, 'admin');
    leaks := leaks + 1; out := out || 'set_member_role par un membre: ACCEPTE <<< FUITE';
  exception when others then out := out || format('set_member_role par un membre: refusé (%s)', left(sqlerrm, 50)); end;
  reset role;

  -- C. visitor who is not signed in -----------------------------------------------------
  set local role anon;
  out := out || '--- C. visiteur non connecté ---';
  foreach t in array array['actus','annuaire','offres','profiles','sondages','app_settings'] loop
    begin
      execute format('select count(*) from public.%I', t) into n;
      if n > 0 then leaks := leaks + 1; end if;
      out := out || format('anon lit %s: %s lignes%s', t, n, case when n > 0 then '  <<< FUITE' else '' end);
    exception when others then out := out || format('anon lit %s: refusé', t); end;
  end loop;
  reset role;

  out := out || format('=== TOTAL FUITES: %s ===', leaks);
  raise exception E'RESULTAT\n%', array_to_string(out, E'\n');
end $$;
